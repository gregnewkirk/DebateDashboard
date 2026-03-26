require('dotenv').config();
const http = require('http');
const fs = require('fs');
const path = require('path');
const { WebSocketServer } = require('ws');

const { analyzeTranscript } = require('./llm');
const { findCachedCard, getCacheStats } = require('./factcache');
const { trackTranscript, getRecentKeywords } = require('./repetition');
const { flashLight, flashPaymentLight, flashAllLights, lightsOff } = require('./shelly');
const { startSession, endSession, isActive, logEvent, incrementStat, getSession, updateNickname, saveSessionLog } = require('./session');
const { generateNickname } = require('./nickname');
const { detectMomJoke, generatePileOn } = require('./momjoke');
const { onFactCheck, onLoopBreaker, onMomJoke, onPayment, onSessionStart, onSessionEnd, onReportCard } = require('./streamerbot');
const { startEmailMonitor } = require('./emailmonitor');
const { initTTS, generateSpeech } = require('./tts');
const { initCache, getCachedAudio, startPreRendering, getCacheStats: getTTSCacheStats } = require('./tts_cache');
const { generateResponse: marieRespond, shouldRespond: marieShouldRespond, shouldStop: marieShouldStop, matchConversation, getRandomFact, getRandomScientist, getRandomMyth, getRandomQuiz, getRandomBreakthrough, getRandomThisOrThat, getRandomOutbreak, getDonationResponse, getMomJokeReaction, getLoopBreakerResponse, getReportCardResponse } = require('./marie');
const { startMicListener, getMicStatus, muteMic, isMuted } = require('./mic');
const { processEvent: moodEvent, getMood, resetMood } = require('./mood');
const { resetCredibility, processClaimResult, processLoopBreaker: credLoopBreaker, getCredibility, getCredibilityComment } = require('./credibility');
const { newBoard: newBingoBoard, checkTranscript: bingoCheck, getBoard: getBingoBoard } = require('./bingo');
const { generateEntrance, recordSession: recordChallenger, setTikTokName, getHallOfShame } = require('./challenger');
const { checkForPrediction } = require('./predictor');
const { addClaim: graphAddClaim, getGraph, getGraphCommentary, resetGraph } = require('./conspiracy_graph');
const { processClaimForTheme, getCurrentTheme, resetTheme } = require('./themes');
const { generateHighlights, generateShareableText } = require('./highlights');
const { recordUse: learnRecord, boostRecentResponses, endSessionLearning } = require('./learning');
const { checkGuestTrigger, getGuestResponse, getActiveGuest, dismissGuest } = require('./guests');
const { checkAudienceTrigger, getShoutoutResponse, getQuestionIntro } = require('./audience');

const LLM_URL = process.env.LLM_URL || 'http://localhost:11434/v1/chat/completions';
const LLM_MODEL = process.env.LLM_MODEL || 'nemotron-3-nano:4b';

const CONFIG = {
  PORT: process.env.PORT || 8080,
  CARD_DISPLAY_SECONDS: 18,
  LOOP_THRESHOLD: 3,
  LOOP_WINDOW_SECONDS: 120,
};

const PORT = CONFIG.PORT;
const recentTopics = [];
let claimsSinceLastNickname = 0;
let marieSpeaking = false; // true while TTS is playing — suppress all triggers

/**
 * Smart TTS — checks pre-rendered cache first (instant), falls through to live generation (~2s).
 */
async function smartTTS(text) {
  // Check pre-rendered cache first
  const cached = getCachedAudio(text);
  if (cached) {
    return cached;
  }
  // Fall through to live generation
  return generateSpeech(text);
}
let marieSpeakingTimer = null;
let marieInConversation = false; // True when responding to a direct question — blocks prompt cycle
let marieConvoTimer = null;

// ============================================================
// ANTI-REPEAT SYSTEM — prevents Marie from looping
// ============================================================
const recentBroadcasts = [];       // Last N broadcast texts
const recentClaimTopics = [];      // Last N claim topics detected
const MAX_RECENT = 20;
const REPEAT_WINDOW_MS = 120000;   // 2 minutes

function isDuplicateBroadcast(text) {
  if (!text) return false;
  const normalized = text.toLowerCase().trim().replace(/[^a-z0-9\s]/g, '');
  const now = Date.now();

  // Clean old entries
  while (recentBroadcasts.length > 0 && now - recentBroadcasts[0].time > REPEAT_WINDOW_MS) {
    recentBroadcasts.shift();
  }

  // Check for exact or near-duplicate
  for (const entry of recentBroadcasts) {
    const entryNorm = entry.text.toLowerCase().trim().replace(/[^a-z0-9\s]/g, '');
    // Exact match
    if (entryNorm === normalized) return true;
    // 80% overlap (fuzzy match)
    const words1 = new Set(normalized.split(/\s+/));
    const words2 = new Set(entryNorm.split(/\s+/));
    const overlap = [...words1].filter(w => words2.has(w)).length;
    const similarity = overlap / Math.max(words1.size, words2.size);
    if (similarity > 0.8) return true;
  }

  recentBroadcasts.push({ text: normalized, time: now });
  if (recentBroadcasts.length > MAX_RECENT) recentBroadcasts.shift();
  return false;
}

function isDuplicateClaim(topic) {
  if (!topic) return false;
  const lower = topic.toLowerCase().trim();
  const now = Date.now();

  // Clean old entries
  while (recentClaimTopics.length > 0 && now - recentClaimTopics[0].time > REPEAT_WINDOW_MS) {
    recentClaimTopics.shift();
  }

  // Check if this claim topic was already detected
  for (const entry of recentClaimTopics) {
    if (entry.topic === lower) return true;
  }

  recentClaimTopics.push({ topic: lower, time: now });
  if (recentClaimTopics.length > MAX_RECENT) recentClaimTopics.shift();
  return false;
}

function clearRecentHistory() {
  recentBroadcasts.length = 0;
  recentClaimTopics.length = 0;
}

/**
 * Safe broadcast for Marie's speech — checks for duplicates before sending.
 * Returns true if sent, false if blocked as duplicate.
 */
function marieSafeBroadcast(wss, msgObj) {
  const text = msgObj.text || '';
  if (isDuplicateBroadcast(text)) {
    console.log(`[AntiRepeat] BLOCKED duplicate: "${text.substring(0, 50)}..."`);
    return false;
  }
  broadcast(wss, msgObj);
  return true;
}

/**
 * Safe fact-check broadcast — checks if the claim topic was already covered.
 */
function safeBroadcastFactCheck(wss, result) {
  const claim = result.claim || '';
  if (isDuplicateClaim(claim)) {
    console.log(`[AntiRepeat] BLOCKED duplicate claim: "${claim.substring(0, 50)}"`);
    return false;
  }
  broadcast(wss, { type: 'fact_check', ...result });
  return true;
}

function marieStartSpeaking(durationMs = 12000) {
  marieSpeaking = true;
  // CRITICAL: Mute mic while Marie speaks — her TTS output feeds back through
  // the Wave Link Stream and Whisper picks it up, causing infinite loops
  muteMic(durationMs + 3000); // Extra 3s buffer for audio to fully stop
  if (marieSpeakingTimer) clearTimeout(marieSpeakingTimer);
  marieSpeakingTimer = setTimeout(() => { marieSpeaking = false; }, durationMs);
}
function marieStopSpeaking() {
  marieSpeaking = false;
  marieInConversation = false;
  if (marieSpeakingTimer) clearTimeout(marieSpeakingTimer);
  if (marieConvoTimer) clearTimeout(marieConvoTimer);
}
function marieStartConversation(durationMs = 20000) {
  marieInConversation = true;
  if (marieConvoTimer) clearTimeout(marieConvoTimer);
  marieConvoTimer = setTimeout(() => { marieInConversation = false; }, durationMs);
}

// Pre-generated debate prompt TTS cache — filled at startup
const DEBATE_PROMPTS = [
  "Patriotism requires vaccines.",
  "GMOs feed the world.",
  "Trump is anti-science.",
  "Climate change is real.",
  "Evolution produced humans.",
];
const promptTTSCache = {}; // { "prompt text": "/tts/prompt_0.wav" }

const MIME_TYPES = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.wav': 'audio/wav',
};

// Fuzzy trigger phrases (all lowercase)
// Session start is now MANUAL ONLY — press S key on dashboard
// These triggers caused false starts from casual conversation
const START_TRIGGERS = [];
const END_TRIGGERS = ["ok bye", "okay bye", "alright bye"];

function matchesTrigger(text, triggers) {
  const lower = text.toLowerCase();
  return triggers.some(t => lower.includes(t));
}

async function generateReportCard(sessionData) {
  const claimsList = sessionData.allClaims.length > 0
    ? sessionData.allClaims.join(', ')
    : 'No claims detected';

  const prompt = `You are a comedy writer for a live debate fact-check show. Generate a funny "Truth Report Card" for a debater.

Session info:
- Nickname: ${sessionData.nickname}
- Nickname history: ${sessionData.nicknameHistory.join(' → ')}
- Total claims: ${sessionData.claimCount}
- Debunked: ${sessionData.debunkedCount}
- Misleading: ${sessionData.misleadingCount}
- Loop breakers (repeated topics): ${sessionData.loopBreakerCount}
- Mom jokes triggered: ${sessionData.momJokeCount}
- Claims made: ${claimsList}

Respond with ONLY this JSON (no extra text):
{
  "grade": "letter grade A+ through F-",
  "grade_joke": "one-liner roasting the grade, max 15 words",
  "superlatives": ["award 1 max 8 words", "award 2 max 8 words", "award 3 max 8 words"],
  "closer": "closing one-liner, max 20 words"
}

RULES:
- grade: letter grade from A+ to F-. Lower grades for more debunked claims.
- grade_joke: savage one-liner about the grade. MAX 15 words.
- superlatives: EXACTLY 3 funny awards. Each MAX 8 words. Make them specific to the claims.
- closer: closing joke. MAX 20 words.
- Return ONLY valid JSON. No markdown, no explanation.`;

  try {
    const response = await fetch(LLM_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: LLM_MODEL,
        temperature: 0.9,
        messages: [
          { role: 'system', content: 'You are a comedy writer. Return only valid JSON.' },
          { role: 'user', content: prompt },
        ],
      }),
    });

    if (!response.ok) {
      console.error(`[ReportCard] LLM request failed: ${response.status}`);
      return fallbackReportCard();
    }

    const data = await response.json();
    let content = data?.choices?.[0]?.message?.content || '';
    content = content.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();

    // Try to extract JSON
    let parsed;
    try {
      parsed = JSON.parse(content);
    } catch {
      const match = content.match(/\{[\s\S]*\}/);
      if (match) {
        parsed = JSON.parse(match[0]);
      } else {
        return fallbackReportCard();
      }
    }

    // Validate required fields
    if (!parsed.grade || !parsed.grade_joke || !Array.isArray(parsed.superlatives) || !parsed.closer) {
      return fallbackReportCard();
    }

    return parsed;
  } catch (err) {
    console.error('[ReportCard] Error:', err.message);
    return fallbackReportCard();
  }
}

function fallbackReportCard() {
  return {
    grade: 'F',
    grade_joke: 'Even the participation trophy is embarrassed',
    superlatives: [
      'Most Creative Misuse of Statistics',
      'Lifetime Achievement in Ignoring Peer Review',
      'Gold Medal in Moving the Goalposts',
    ],
    closer: "Today's debate was brought to you by: Confirmation Bias and a YouTube algorithm",
  };
}

function broadcast(wss, data) {
  const json = JSON.stringify(data);
  let sent = 0;
  for (const client of wss.clients) {
    if (client.readyState === 1) {
      client.send(json);
      sent++;
    }
  }
  if (data.type) {
    console.log(`[Broadcast] ${data.type} → ${sent} clients`);
  }
}

const server = http.createServer(async (req, res) => {
  // Payment webhook endpoint
  if (req.method === 'POST' && req.url === '/api/payment') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        const payment = JSON.parse(body);
        // First name only — protect donor privacy on livestream
        if (payment.name) {
          payment.name = payment.name.trim().split(/\s+/)[0];
        }
        console.log(`[Payment] ${payment.source}: ${payment.name} - ${payment.amount}`);

        // Broadcast to all WebSocket clients (visual first)
        broadcast(wss, { type: 'payment', ...payment });

        // Flash payment light
        flashPaymentLight().catch(err => console.warn('[Shelly] Error:', err.message));
        moodEvent({ type: 'payment', name: payment.name });
        boostRecentResponses(); // Donation = audience liked what was happening
        broadcast(wss, { type: 'mood', ...getMood() });

        // Marie TTS for donation — uses 1000-line Opus-quality pool
        const donationText = getDonationResponse(payment.name, payment.amount);
        smartTTS(donationText).then(audioUrl => {
          marieStartSpeaking(); broadcast(wss, { type: 'tts_ready', audioUrl, text: donationText });
        }).catch(err => console.warn('[TTS] Donation speech failed:', err.message));

        // Streamer.bot payment alert
        onPayment(payment);

        // Log event if session active
        if (isActive()) {
          logEvent({ type: 'payment', data: payment });
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true }));
      } catch (err) {
        res.writeHead(400);
        res.end('Bad request');
      }
    });
    return;
  }

  // Debate prompt — Marie reads and comments on the current prompt
  if (req.method === 'POST' && req.url === '/api/debate-prompt') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
      try {
        const { prompt } = JSON.parse(body);
        if (!prompt) {
          res.writeHead(400);
          res.end('Missing prompt');
          return;
        }

        console.log(`[DebatePrompt] "${prompt}"`);

        // Use pre-cached TTS if available (INSTANT), fall back to live generation
        let audioUrl = promptTTSCache[prompt];
        if (audioUrl) {
          console.log(`[DebatePrompt] Cache HIT — instant playback`);
        } else {
          console.log(`[DebatePrompt] Cache MISS — generating live`);
          audioUrl = await smartTTS(prompt);
          promptTTSCache[prompt] = audioUrl; // cache for next time
        }

        marieStartSpeaking();
        broadcast(wss, { type: 'marie_speak', text: prompt, audioUrl });

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true, audioUrl }));
      } catch (err) {
        if (!res.headersSent) {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: false, error: err.message }));
        }
      }
    });
    return;
  }

  // Marie ALL STOP — kill TTS queue and broadcast stop to clients
  if (req.method === 'POST' && req.url === '/api/marie/stop') {
    marieStopSpeaking();
    broadcast(wss, { type: 'marie_stop' });
    // Kill ALL lights
    lightsOff().catch(() => {});
    // Also end any active session to stop fact-checking
    if (isActive()) {
      endSession();
      console.log('[Session] Ended via ALL STOP');
    }
    console.log('[Marie] ALL STOP — lights off');
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true }));
    return;
  }

  // Lights off
  if (req.method === 'POST' && req.url === '/api/lights/off') {
    lightsOff().catch(() => {});
    console.log('[Shelly] All lights off');
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true }));
    return;
  }

  // === STREAM DECK ENDPOINTS ===
  // All simple POST endpoints for Stream Deck HTTP buttons

  // Reset everything — stop Marie, clear screen, lights off, return to standby
  if (req.method === 'POST' && req.url === '/api/reset') {
    marieStopSpeaking();
    clearRecentHistory();
    lightsOff().catch(() => {});
    broadcast(wss, { type: 'marie_stop' });
    broadcast(wss, { type: 'reset' });
    console.log('[StreamDeck] RESET ALL');
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true }));
    return;
  }

  // Ad screen
  if (req.method === 'POST' && req.url === '/api/adscreen') {
    broadcast(wss, { type: 'show_ad' });
    console.log('[StreamDeck] Ad screen');
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true }));
    return;
  }

  // Report card (test)
  if (req.method === 'POST' && req.url === '/api/reportcard') {
    broadcast(wss, {
      type: 'report_card',
      nickname: getSession()?.nickname || 'CHALLENGER',
      grade: 'F',
      gradeJoke: 'LOWER THAN SNAKE BELLY IN A WAGON RUT',
      superlatives: ['MOST CREATIVE MISUSE OF STATISTICS', 'LIFETIME ACHIEVEMENT IN IGNORING PEER REVIEW', 'GOLD MEDAL IN MOVING GOALPOSTS'],
      closer: "TODAY'S DEBATE BROUGHT TO YOU BY: CONFIRMATION BIAS",
      stats: { claimCount: getSession()?.claimCount || 0, debunkedCount: getSession()?.debunkedCount || 0, misleadingCount: getSession()?.misleadingCount || 0, loopBreakerCount: getSession()?.loopBreakerCount || 0, momJokeCount: getSession()?.momJokeCount || 0 },
    });
    flashAllLights().catch(() => {});
    console.log('[StreamDeck] Report card');
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true }));
    return;
  }

  // Loop breaker (test)
  if (req.method === 'POST' && req.url === '/api/loopbreaker') {
    broadcast(wss, {
      type: 'loop_breaker',
      claim: 'NATURAL IMMUNITY',
      verdict: 'MISLEADING',
      fact: 'VACCINES TRAIN IMMUNITY WITHOUT THE RISK OF SEVERE DISEASE OR DEATH.',
      humor: "THE 'JUST GET SICK' STRATEGY — BROUGHT TO YOU BY PEOPLE WHO NEVER TOOK STATISTICS.",
      source: 'NEJM, 2022',
    });
    flashLight().catch(() => {});
    console.log('[StreamDeck] Loop breaker');
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true }));
    return;
  }

  // Bingo toggle
  if (req.method === 'POST' && req.url === '/api/bingo/toggle') {
    broadcast(wss, { type: 'bingo_toggle' });
    console.log('[StreamDeck] Bingo toggle');
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true }));
    return;
  }

  // Credibility toggle
  if (req.method === 'POST' && req.url === '/api/credibility/toggle') {
    broadcast(wss, { type: 'credibility_toggle' });
    console.log('[StreamDeck] Credibility toggle');
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true }));
    return;
  }

  // Manual session start (S key)
  if (req.method === 'POST' && req.url === '/api/session/start') {
    if (!isActive()) {
      startSession();
      broadcast(wss, { type: 'session_start' });
      console.log('[Session] Started manually (S key)');
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true, active: isActive() }));
    return;
  }

  // Manual session end (Q key reset)
  if (req.method === 'POST' && req.url === '/api/session/end') {
    if (isActive()) {
      const sessionData = endSession();
      broadcast(wss, { type: 'session_end', data: sessionData });
      console.log('[Session] Ended manually (Q key)');
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true, active: isActive() }));
    return;
  }

  // Dev status endpoint — live dashboard state for dev overlay
  if (req.method === 'GET' && req.url === '/api/status') {
    const pkg = require('./package.json');
    const { getTTSStatus } = require('./tts');
    const ttsStatus = getTTSStatus();
    const sessionData = isActive() ? getSession() : null;

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      version: pkg.version,
      uptime: Math.floor(process.uptime()),
      mode: isActive() ? 'DEBATE' : 'SOLO',
      wsClients: wss.clients.size,
      mic: getMicStatus(),
      llm: { model: LLM_MODEL, url: LLM_URL },
      tts: { voice: 'af_heart', queued: ttsStatus.queued, generated: ttsStatus.generated, processing: ttsStatus.processing },
      marie: 'READY',
      shellyRed: process.env.SHELLY_IP || '?',
      shellyGreen: process.env.SHELLY_IP_PAYMENTS || '?',
      email: process.env.EMAIL_USER ? 'CONNECTED' : 'OFF',
      factCache: getCacheStats(),
      mood: getMood(),
      credibility: getCredibility(),
      bingo: getBingoBoard(),
      theme: getCurrentTheme(),
      graph: getGraph(),
      hallOfShame: getHallOfShame().length,
      activeGuest: getActiveGuest()?.name || null,
      session: sessionData ? {
        nickname: sessionData.nickname,
        claims: sessionData.claimCount,
        debunked: sessionData.debunkedCount,
        misleading: sessionData.misleadingCount,
        loops: sessionData.loopBreakerCount,
        momJokes: sessionData.momJokeCount,
      } : null,
    }));
    return;
  }

  // Soundcheck endpoint — tests LLM, Shelly, email connections
  if (req.method === 'GET' && req.url === '/api/soundcheck') {
    const checks = {};

    // 1. WebSocket clients
    checks.websocket = { status: 'ok', clients: wss.clients.size };

    // 2. LLM (OpenClaw)
    try {
      const llmStart = Date.now();
      const llmRes = await fetch(LLM_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: LLM_MODEL,
          messages: [{ role: 'user', content: 'Say OK' }],
          max_tokens: 5,
        }),
        signal: AbortSignal.timeout(5000),
      });
      const llmMs = Date.now() - llmStart;
      if (llmRes.ok) {
        checks.llm = { status: 'ok', latency_ms: llmMs, model: LLM_MODEL };
      } else {
        checks.llm = { status: 'error', code: llmRes.status };
      }
    } catch (err) {
      checks.llm = { status: 'error', message: err.message };
    }

    // 3. Shelly plugs
    const shellyIp = process.env.SHELLY_IP || '192.168.1.100';
    const shellyPayIp = process.env.SHELLY_IP_PAYMENTS || '192.168.1.101';
    for (const [label, ip] of [['shelly_red', shellyIp], ['shelly_green', shellyPayIp]]) {
      try {
        const sRes = await fetch(`http://${ip}/shelly`, { signal: AbortSignal.timeout(2000) });
        if (sRes.ok) {
          const info = await sRes.json();
          checks[label] = { status: 'ok', ip, type: info.type || 'unknown' };
        } else {
          checks[label] = { status: 'error', ip, code: sRes.status };
        }
      } catch (err) {
        checks[label] = { status: 'unreachable', ip };
      }
    }

    // 4. Email monitor
    if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
      checks.email = { status: 'configured', user: process.env.EMAIL_USER };
    } else {
      checks.email = { status: 'not_configured' };
    }

    // 5. Fact cache
    const cacheStats = getCacheStats();
    checks.fact_cache = { status: 'ok', categories: cacheStats.totalClaims, cards: cacheStats.totalCards };

    // 6. Mood system
    checks.mood = { status: 'ok', ...getMood() };

    // 7. Credibility meter
    checks.credibility = { status: 'ok', ...getCredibility() };

    // 8. Conspiracy bingo
    const bingo = getBingoBoard();
    checks.bingo = { status: 'ok', hits: bingo.totalHits, squares: bingo.board?.length * 5 || 25 };

    // 9. Theme engine
    checks.theme = { status: 'ok', ...getCurrentTheme() };

    // 10. Conspiracy graph
    const graph = getGraph();
    checks.conspiracy_graph = { status: 'ok', nodes: graph.nodes.length, edges: graph.edges.length };

    // 11. Hall of Shame
    checks.hall_of_shame = { status: 'ok', entries: getHallOfShame().length };

    // 12. Predictor
    const { getPredictionStats } = require('./predictor');
    checks.predictor = { status: 'ok', chains: 20, ...getPredictionStats() };

    // 13. Learning system
    checks.learning = { status: 'ok' };

    // 14. Guest scientists
    checks.guests = { status: 'ok', available: Object.keys(require('./guests').GUEST_SCIENTISTS).length, active: getActiveGuest()?.name || 'none' };

    // 15. Audience participation
    checks.audience = { status: 'ok' };

    // 16. Highlights generator
    checks.highlights = { status: 'ok' };

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(checks));
    return;
  }

  // Quiz — Marie picks a random quiz and hosts it
  if (req.method === 'POST' && req.url === '/api/quiz') {
    try {
      const quiz = getRandomQuiz();
      if (!quiz) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, error: 'No quizzes loaded' }));
        return;
      }

      const seconds = 30;
      const q = quiz.question;
      const opts = quiz.options;
      const answerText_full = quiz.answer;
      const explanation = quiz.explanation;
      const answerIndex = opts.indexOf(answerText_full);

      // Build Marie's full quiz intro with voting instructions
      const optionLabels = ['A', 'B', 'C', 'D'];
      const optionList = opts.map((opt, i) => `${optionLabels[i]}, ${opt}`).join('. ');
      const introText = `Pop quiz time! ${q}. Your options are: ${optionList}. Type your answer in chat. You have ${seconds} seconds. Go!`;

      const audioUrl = await smartTTS(introText);
      marieStartSpeaking(15000);
      broadcast(wss, { type: 'marie_speak', text: introText, audioUrl });

      // Send quiz card to clients
      broadcast(wss, {
        type: 'quiz',
        question: q,
        options: opts,
        seconds,
      });

      // After countdown, reveal answer + Marie reads explanation
      setTimeout(async () => {
        const correctLetter = answerIndex >= 0 ? optionLabels[answerIndex] : 'the correct answer';

        broadcast(wss, {
          type: 'quiz_reveal',
          answer: answerIndex,
          explanation: explanation,
        });

        // Marie announces the answer clearly
        const revealText = `Time's up! The answer is ${correctLetter}, ${answerText_full}. ${explanation}`;
        try {
          const revealAudio = await smartTTS(revealText);
          marieStartSpeaking();
          broadcast(wss, { type: 'marie_speak', text: revealText, audioUrl: revealAudio });
        } catch {}
      }, (seconds + 3) * 1000);

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true, question: q }));
    } catch (err) {
      if (!res.headersSent) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, error: err.message }));
      }
    }
    return;
  }

  // This or That — Marie picks a random comparison
  if (req.method === 'POST' && req.url === '/api/thisorthat') {
    try {
      const tt = getRandomThisOrThat();
      if (!tt) { res.writeHead(200); res.end(JSON.stringify({ ok: false })); return; }

      broadcast(wss, { type: 'this_or_that', question: tt.q, a: tt.a, al: tt.al, b: tt.b, bl: tt.bl, ans: tt.ans, explanation: tt.e, seconds: 20 });

      const introText = `This or that! ${tt.q}. Option A: ${tt.al}. Option B: ${tt.bl}. Type A or B in chat! You have 20 seconds!`;
      smartTTS(introText).then(audioUrl => {
        marieStartSpeaking(12000);
        broadcast(wss, { type: 'marie_speak', text: introText, audioUrl });
      }).catch(() => {});

      setTimeout(async () => {
        broadcast(wss, { type: 'this_or_that_reveal', ans: tt.ans, explanation: tt.e });
        const revealText = `The answer is ${tt.ans}. ${tt.e}`;
        try {
          const audio = await smartTTS(revealText);
          marieStartSpeaking();
          broadcast(wss, { type: 'marie_speak', text: revealText, audioUrl: audio });
        } catch {}
      }, 23000);

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true, question: tt.q }));
    } catch (err) {
      if (!res.headersSent) { res.writeHead(200); res.end(JSON.stringify({ ok: false, error: err.message })); }
    }
    return;
  }

  // Science Fact card
  if (req.method === 'POST' && req.url === '/api/sciencefact') {
    try {
      const fact = getRandomFact();
      if (!fact) { res.writeHead(200); res.end(JSON.stringify({ ok: false })); return; }
      broadcast(wss, { type: 'science_fact', ...fact });

      const speech = typeof fact === 'string' ? fact : `${fact.title || ''}. ${fact.description || fact.detail || ''}`;
      smartTTS(speech).then(audioUrl => {
        marieStartSpeaking();
        broadcast(wss, { type: 'marie_speak', text: speech, audioUrl });
      }).catch(() => {});

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true }));
    } catch (err) {
      if (!res.headersSent) { res.writeHead(200); res.end(JSON.stringify({ ok: false, error: err.message })); }
    }
    return;
  }

  // Myth Buster card
  if (req.method === 'POST' && req.url === '/api/mythbuster') {
    try {
      const myth = getRandomMyth();
      if (!myth) { res.writeHead(200); res.end(JSON.stringify({ ok: false })); return; }
      broadcast(wss, { type: 'myth_buster', ...myth });

      const speech = typeof myth === 'string' ? myth : `Myth: ${myth.myth || ''}. Verdict: ${myth.verdict || ''}. ${myth.science || ''}`;
      smartTTS(speech).then(audioUrl => {
        marieStartSpeaking();
        broadcast(wss, { type: 'marie_speak', text: speech, audioUrl });
      }).catch(() => {});

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true }));
    } catch (err) {
      if (!res.headersSent) { res.writeHead(200); res.end(JSON.stringify({ ok: false, error: err.message })); }
    }
    return;
  }

  // Marie TTS test — generates speech and broadcasts to all clients
  if (req.method === 'POST' && req.url === '/api/marie/test') {
    const testData = {
      claim: 'VACCINES CAUSE AUTISM',
      verdict: 'DEBUNKED',
      fact: 'THE ORIGINAL 1998 WAKEFIELD STUDY WAS RETRACTED FOR FRAUD.',
    };
    const ttsText = `Claim: ${testData.claim}. Verdict: ${testData.verdict}. ${testData.fact}`;

    // Broadcast the visual card first
    broadcast(wss, { type: 'fact_check', ...testData, humor: 'IMAGINE TRUSTING SOMEONE WHO LOST THEIR MEDICAL LICENSE.', source: 'LANCET RETRACTION 2010' });

    // Generate TTS
    try {
      const audioUrl = await smartTTS(ttsText);
      marieStartSpeaking(); broadcast(wss, { type: 'tts_ready', audioUrl, text: ttsText });
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true, audioUrl }));
    } catch (err) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: false, error: err.message }));
    }
    return;
  }

  // Marie conversation test
  if (req.method === 'POST' && req.url === '/api/marie/speak') {
    try {
      const responseText = await marieRespond({
        transcript: 'Hey Marie, what do you think about flat earthers?',
        lastClaim: 'EARTH IS FLAT',
        lastVerdict: 'FALSE',
        nickname: 'CAPTAIN ANECDOTE',
      });
      const audioUrl = await smartTTS(responseText);
      marieStartSpeaking(); broadcast(wss, { type: 'marie_speak', text: responseText, audioUrl });
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true, text: responseText, audioUrl }));
    } catch (err) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: false, error: err.message }));
    }
    return;
  }

  // Soundcheck test — flashes both Shelly lights
  if (req.method === 'POST' && req.url === '/api/soundcheck/test') {
    const results = {};

    // Flash red (conspiracy)
    try {
      await flashLight(2, 1500);
      results.shelly_red = 'flashed';
    } catch (err) {
      results.shelly_red = 'failed: ' + err.message;
    }

    // Brief pause between
    await new Promise(r => setTimeout(r, 500));

    // Flash green (donation)
    try {
      await flashPaymentLight(2, 1200);
      results.shelly_green = 'flashed';
    } catch (err) {
      results.shelly_green = 'failed: ' + err.message;
    }

    // Turn both off after test
    await new Promise(r => setTimeout(r, 1000));
    await lightsOff();

    // Quick LLM test — generate a one-liner
    try {
      const llmStart = Date.now();
      const llmRes = await fetch(LLM_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: LLM_MODEL,
          messages: [
            { role: 'system', content: 'You are a fact-checker. Return only valid JSON.' },
            { role: 'user', content: 'Someone said "the earth is flat". Respond with: {"found":true,"claim":"EARTH IS FLAT","verdict":"FALSE","fact":"EARTH IS AN OBLATE SPHEROID","humor":"TEST CARD","source":"SCIENCE"}' },
          ],
          max_tokens: 100,
        }),
        signal: AbortSignal.timeout(8000),
      });
      results.llm_latency_ms = Date.now() - llmStart;
      results.llm = llmRes.ok ? 'ok' : 'error';
    } catch (err) {
      results.llm = 'failed: ' + err.message;
    }

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(results));
    return;
  }

  let filePath = path.join(__dirname, 'public', req.url === '/' ? 'index.html' : req.url);
  const ext = path.extname(filePath);
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end('Not found');
      return;
    }
    res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] || 'text/plain' });
    res.end(data);
  });
});

const wss = new WebSocketServer({ server });

// ============================================================
// TRANSCRIPT PROCESSING — called by WebSocket AND mic listener
// ============================================================
async function processTranscript(text) {
  // Drop ALL transcripts while Marie is speaking — prevents feedback snowball
  if (marieSpeaking) {
    return;
  }
  try {
        // === BINGO CHECK — runs on ALL transcripts ===
        const bingoHit = bingoCheck(text);
        if (bingoHit) {
          broadcast(wss, { type: 'bingo_hit', ...bingoHit });
          if (bingoHit.isBingo) {
            broadcast(wss, { type: 'bingo_win', count: bingoHit.bingoCount });
            smartTTS("BINGO! We got a full line! This challenger hit every talking point!").then(audioUrl => {
              marieStartSpeaking();
              broadcast(wss, { type: 'tts_ready', audioUrl, text: 'BINGO!' });
            }).catch(() => {});
          }
        }

        // === PREDICTIVE CLAIM DETECTION ===
        const prediction = checkForPrediction(text);
        if (prediction) {
          broadcast(wss, { type: 'prediction', ...prediction });
          smartTTS(prediction.marie).then(audioUrl => {
            marieStartSpeaking();
            broadcast(wss, { type: 'tts_ready', audioUrl, text: prediction.marie });
          }).catch(() => {});
        }

        // === AUDIENCE PARTICIPATION ===
        const audienceTrigger = checkAudienceTrigger(text);
        if (audienceTrigger) {
          if (audienceTrigger.type === 'shoutout') {
            const resp = getShoutoutResponse();
            broadcast(wss, { type: 'audience_shoutout', name: audienceTrigger.content, marie: resp });
          } else if (audienceTrigger.type === 'question') {
            const intro = getQuestionIntro();
            broadcast(wss, { type: 'audience_question', question: audienceTrigger.content, marie: intro });
          }
        }

        // === GUEST SCIENTIST CHECK ===
        const guestTrigger = checkGuestTrigger(text);
        if (guestTrigger && guestTrigger.type === 'direct_call') {
          const guest = guestTrigger.guest;
          smartTTS(guest.intro).then(audioUrl => {
            marieStartSpeaking();
            broadcast(wss, { type: 'guest_entrance', guest: guest.name, voice: guest.voice, audioUrl, text: guest.intro });
          }).catch(() => {});
        }

        // Check start/end triggers BEFORE fact-check pipeline
        if (matchesTrigger(text, START_TRIGGERS)) {
          startSession();
          broadcast(wss, { type: 'session_start' });
          onSessionStart();
          moodEvent({ type: 'session_start' });
          resetCredibility();
          newBingoBoard();
          resetGraph();
          resetTheme();
          broadcast(wss, { type: 'bingo_board', ...getBingoBoard() });
          broadcast(wss, { type: 'credibility', ...getCredibility() });
          broadcast(wss, { type: 'mood', ...getMood() });

          // Generate challenger entrance
          const session = getSession();
          const entrance = generateEntrance(session.nickname || 'CHALLENGER');
          broadcast(wss, { type: 'entrance', ...entrance });
          smartTTS(entrance.full).then(audioUrl => {
            marieStartSpeaking();
            broadcast(wss, { type: 'tts_ready', audioUrl, text: entrance.full });
          }).catch(() => {});

          console.log('[Session] Started');
        }

        if (matchesTrigger(text, END_TRIGGERS)) {
          const sessionData = endSession();
          broadcast(wss, { type: 'session_end', data: sessionData });
          onSessionEnd(sessionData);
          moodEvent({ type: 'session_end' });

          // Record to Hall of Shame + end learning session
          endSessionLearning();

          // Send final credibility + graph state
          broadcast(wss, { type: 'credibility_final', ...getCredibility() });
          broadcast(wss, { type: 'conspiracy_graph', ...getGraph() });
          const graphComment = getGraphCommentary();
          if (graphComment) {
            broadcast(wss, { type: 'marie_speak', text: graphComment, audioUrl: null });
          }

          console.log('[Session] Ended');

          // Generate and send report card
          generateReportCard(sessionData).then((llmResult) => {
            broadcast(wss, {
              type: 'report_card',
              nickname: sessionData.nickname,
              nicknameHistory: sessionData.nicknameHistory,
              grade: llmResult.grade,
              gradeJoke: llmResult.grade_joke,
              superlatives: llmResult.superlatives,
              closer: llmResult.closer,
              stats: {
                claimCount: sessionData.claimCount,
                debunkedCount: sessionData.debunkedCount,
                misleadingCount: sessionData.misleadingCount,
                loopBreakerCount: sessionData.loopBreakerCount,
                momJokeCount: sessionData.momJokeCount,
              },
            });
            console.log('[ReportCard] Sent to clients');

            // Marie TTS for report card
            const rcText = `Grade: ${llmResult.grade}. ${llmResult.grade_joke}. ${llmResult.closer}`;
            smartTTS(rcText).then(audioUrl => {
              marieStartSpeaking(); broadcast(wss, { type: 'tts_ready', audioUrl, text: rcText });
            }).catch(err => console.warn('[TTS] Report card speech failed:', err.message));

            // Streamer.bot report card reveal
            onReportCard({ grade: llmResult.grade, nickname: sessionData.nickname });

            // Flash all lights for report card finale
            flashAllLights().catch(err => console.warn('[Shelly] Error:', err.message));

            // Save session log with report card data
            try {
              const logFilename = saveSessionLog(sessionData, llmResult);
              console.log(`[Session] Log saved to logs/${logFilename}`);
            } catch (err) {
              console.error('[Session] Failed to save log:', err.message);
            }

            // Record to Hall of Shame
            recordChallenger(sessionData, llmResult);

            // Generate post-show highlights
            const { getMoodHistory } = require('./mood');
            const highlights = generateHighlights(
              sessionData, llmResult, getMoodHistory(),
              getBingoBoard(), getCredibility(), getGraph()
            );
            broadcast(wss, { type: 'highlights', ...highlights });
            const shareText = generateShareableText(highlights);
            console.log(`[Highlights] Shareable:\n${shareText}`);
          }).catch((err) => {
            console.error('[ReportCard] Failed:', err.message);

            // Still save session log even if report card fails
            try {
              const logFilename = saveSessionLog(sessionData);
              console.log(`[Session] Log saved to logs/${logFilename}`);
            } catch (logErr) {
              console.error('[Session] Failed to save log:', logErr.message);
            }
          });
        }

        // Mom joke detection — before fact-check, after triggers
        if (detectMomJoke(text) && isActive()) {
          const lastTopic = recentTopics.length > 0 ? recentTopics[recentTopics.length - 1] : null;
          const jokes = await generatePileOn(text, lastTopic);
          incrementStat('momJokeCount');
          logEvent({ type: 'mom_joke', pileOn: jokes });
          broadcast(wss, { type: 'mom_joke', jokes: jokes });
          onMomJoke({ count: jokes.length });
          flashLight().catch((err) => console.warn('[Shelly] Error:', err.message));
          moodEvent({ type: 'mom_joke' });
          console.log('[MomJoke] Detected! Piling on...');

          // Marie TTS for mom joke
          const momText = jokes.slice(0, 2).join('. ');
          smartTTS(momText).then(audioUrl => {
            marieStartSpeaking(); broadcast(wss, { type: 'tts_ready', audioUrl, text: momText });
          }).catch(err => console.warn('[TTS] Mom joke speech failed:', err.message));

          return;
        }

        // Marie STOP command — kills audio immediately
        if (marieShouldStop(text)) {
          marieStopSpeaking();
          broadcast(wss, { type: 'marie_stop' });
          console.log('[Marie] STOP command received');
        }

        // Marie conversational trigger — mode-aware
        // Skip if Marie is currently speaking (prevents feedback snowball)
        const { getTTSStatus } = require('./tts');
        if (getTTSStatus().processing || getTTSStatus().queued > 0) {
          // TTS is busy — don't trigger Marie again
        } else {
        const marieCheck = marieShouldRespond(text, isActive());
        if (marieCheck.should) {
          const lastClaim = recentTopics.length > 0 ? recentTopics[recentTopics.length - 1] : null;
          const session = isActive() ? getSession() : null;
          console.log(`[Marie] Triggered: ${marieCheck.reason} (${isActive() ? 'debate' : 'solo'} mode)`);

          // Special case: science content pulls
          if (marieCheck.reason.startsWith('science_')) {
            const type = marieCheck.reason.replace('science_', '');
            let speechText = '';
            switch (type) {
              case 'fact': {
                const fact = getRandomFact();
                speechText = fact || "I'm blanking on a fact right now. Ask me again!";
                break;
              }
              case 'scientist': {
                const sci = getRandomScientist();
                speechText = sci ? `One of my favorites: ${sci.name}. ${sci.breakthrough}` : "So many to choose from. My namesake, obviously.";
                break;
              }
              case 'myth': {
                const myth = getRandomMyth();
                speechText = myth ? `Myth: ${myth.myth}. Verdict: ${myth.verdict}. ${myth.science}` : "Give me a myth and I'll bust it.";
                break;
              }
              case 'quiz': {
                const qz = getRandomQuiz();
                speechText = qz ? `Here's one: ${qz.question}. The answer is ${qz.answer}. ${qz.explanation}` : "I'm out of quiz questions. Impressive.";
                break;
              }
              case 'breakthrough': {
                const bt = getRandomBreakthrough();
                speechText = bt || "Every day is a breakthrough in science. Pick a century!";
                break;
              }
            }
            if (speechText) {
              try {
                const audioUrl = await smartTTS(speechText);
                marieStartSpeaking();
                broadcast(wss, { type: 'marie_speak', text: speechText, audioUrl });
                console.log(`[Marie] Science ${type}: "${speechText.substring(0, 60)}..."`);
              } catch (err) {
                broadcast(wss, { type: 'marie_speak', text: speechText, audioUrl: null });
              }
            }
          } else if (marieCheck.reason === 'debate_prompts') {
            if (!marieInConversation) {
              broadcast(wss, { type: 'start_prompt_cycle' });
              console.log('[Marie] Starting debate prompt cycle (explicitly asked)');
            } else {
              console.log('[Marie] Prompt cycle blocked — in conversation');
            }
          } else {
            // Direct conversation — block prompt cycle from interrupting
            marieStartConversation(20000);

            // Try conversation tree match first (instant), then LLM fallback
            const convoMatch = matchConversation(text);
            const responsePromise = convoMatch
              ? Promise.resolve(convoMatch)
              : marieRespond({
                  transcript: text,
                  lastClaim: lastClaim,
                  lastVerdict: null,
                  nickname: session?.nickname || 'CHALLENGER',
                  debateActive: isActive(),
                  isFeminist: marieCheck.isFeminist,
                });
            if (convoMatch) console.log(`[Marie] Conversation match: "${convoMatch.substring(0, 60)}"`);
            responsePromise.then(async (responseText) => {
              try {
                const audioUrl = await smartTTS(responseText);
                marieStartSpeaking();
                broadcast(wss, { type: 'marie_speak', text: responseText, audioUrl });
                console.log(`[Marie] Speaking: "${responseText}"`);
              } catch (err) {
                marieStartSpeaking(5000);
                broadcast(wss, { type: 'marie_speak', text: responseText, audioUrl: null });
                console.warn('[Marie] TTS failed, text only:', err.message);
              }
            }).catch(err => console.error('[Marie] Response failed:', err.message));
          }
        }
        } // end TTS busy check

        // Only run fact-check pipeline when a debate session is active
        // In solo mode, Marie does banter/quizzes but does NOT fact-check
        // (Greg's casual conversation about science kept triggering false positives)
        if (isActive() && !marieSpeaking) {
          const loop = trackTranscript(text);
          const loopContext = loop.isLoop ? loop.loopKeyword : null;

          // Try pre-cached card first (instant), fall back to live LLM
          const cached = findCachedCard(text, recentTopics);
          let result;
          if (cached && !loop.isLoop) {
            result = cached;
            console.log(`[Cache HIT] ${cached._cacheId} (score: ${cached._score}, triggers: ${cached._triggers.join(', ')})`);
          } else {
            result = await analyzeTranscript(text, recentTopics, loopContext);
            if (result.found) {
              console.log('[Cache MISS] Live LLM used — novel claim detected');
            }
          }

          if (result.found) {
            recentTopics.push(result.claim);
            if (recentTopics.length > 10) recentTopics.shift();

            // === WIRE ALL 13 SYSTEMS INTO FACT CHECK ===
            // Credibility meter
            const newCred = processClaimResult(result.verdict);
            broadcast(wss, { type: 'credibility', ...getCredibility() });

            // Mood
            moodEvent({ type: 'fact_check', verdict: result.verdict });
            broadcast(wss, { type: 'mood', ...getMood() });

            // Conspiracy network graph
            const graphResult = graphAddClaim(result.claim);
            if (graphResult.newEdges.length > 0) {
              broadcast(wss, { type: 'conspiracy_graph', ...getGraph() });
            }

            // Dynamic theme
            const themeResult = processClaimForTheme(result.claim);
            if (themeResult.changed) {
              broadcast(wss, { type: 'theme_change', ...themeResult });
            }

            // Learning — record that a fact check happened
            learnRecord(result.claim);

            // Track repeated topics using keywords from the repetition tracker
            const activeKeywords = getRecentKeywords();
            for (const kw of activeKeywords) {
              const session = getSession();
              if (!session.repeatedTopics[kw]) {
                session.repeatedTopics[kw] = 0;
              }
              session.repeatedTopics[kw]++;
            }

            // Push claim to allClaims
            getSession().allClaims.push(result.claim);
            incrementStat('claimCount');

            if (loop.isLoop) {
              const payload = { type: 'loop_breaker', ...result, loopKeyword: loop.loopKeyword };
              broadcast(wss, payload);
              onLoopBreaker(result);
              logEvent({ type: 'loop_breaker', data: result });
              incrementStat('loopBreakerCount');
              credLoopBreaker(); // Extra credibility penalty
              moodEvent({ type: 'loop_breaker' });
              broadcast(wss, { type: 'credibility', ...getCredibility() });

              // Marie TTS for loop breaker
              const loopText = `Broken record! They said ${result.claim} again. Still ${result.verdict}.`;
              smartTTS(loopText).then(audioUrl => {
                marieStartSpeaking(); broadcast(wss, { type: 'tts_ready', audioUrl, text: loopText });
              }).catch(err => console.warn('[TTS] Loop breaker speech failed:', err.message));

            } else {
              // Anti-repeat: skip if we already covered this claim recently
              if (isDuplicateClaim(result.claim)) {
                console.log(`[AntiRepeat] Skipping duplicate claim: "${result.claim}"`);
              } else {
                const payload = { type: 'fact_check', ...result };
                broadcast(wss, payload);
                onFactCheck(result);
                logEvent({ type: 'fact_check', data: result });

                // Increment debunked or misleading based on verdict
                const verdict = (result.verdict || '').toUpperCase();
                if (verdict === 'FALSE' || verdict === 'DEBUNKED') {
                  incrementStat('debunkedCount');
                } else if (verdict === 'MISLEADING') {
                  incrementStat('misleadingCount');
                }

                // Marie TTS for fact check — also deduplicated
                const factText = `Claim: ${result.claim}. Verdict: ${result.verdict}. ${result.fact}`;
                if (!isDuplicateBroadcast(factText)) {
                  smartTTS(factText).then(audioUrl => {
                    marieStartSpeaking(); broadcast(wss, { type: 'tts_ready', audioUrl, text: factText });
                  }).catch(err => console.warn('[TTS] Fact check speech failed:', err.message));
                }
              }
            }

            // Nickname evolution: every 3 claims, generate a new nickname
            claimsSinceLastNickname++;
            if (claimsSinceLastNickname >= 3) {
              claimsSinceLastNickname = 0;
              generateNickname(getSession().allClaims, text).then((newNickname) => {
                updateNickname(newNickname);
                broadcast(wss, { type: 'nickname_update', nickname: newNickname });
                console.log(`[Nickname] Updated to: ${newNickname}`);
              });
            }

            console.log('[Shelly] Flashing light for new fact-check');
            flashLight().catch((err) => console.warn('[Shelly] Error:', err.message));
          }
        }
  } catch (err) {
    console.error('[Transcript] Processing error:', err.message);
  }
}

// ============================================================
// WEBSOCKET — delegates transcript to processTranscript()
// ============================================================
wss.on('connection', (ws) => {
  console.log('Client connected');
  ws.on('message', async (raw) => {
    try {
      const msg = JSON.parse(raw.toString());
      if (msg.type === 'transcript') {
        await processTranscript(msg.text);
      }
    } catch (err) {
      console.error('Message handling error:', err.message);
    }
  });
  ws.on('close', () => console.log('Client disconnected'));
});

server.listen(PORT, () => {
  initTTS();
  initCache();
  const stats = getCacheStats();
  console.log(`Dashboard server running on http://localhost:${PORT}`);
  console.log(`[FactCache] Loaded ${stats.totalClaims} claim categories with ${stats.totalCards} pre-generated card variants`);

  // Start email donation monitor if credentials are configured
  if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
    startEmailMonitor({
      email: process.env.EMAIL_USER,
      password: process.env.EMAIL_PASS,
      host: process.env.EMAIL_HOST || 'imap.gmail.com',
      port: parseInt(process.env.EMAIL_PORT || '993'),
    });
  } else {
    console.log('[EmailMonitor] Not started — set EMAIL_USER and EMAIL_PASS in .env');
  }

  // Start server-side mic listener (feeds into same pipeline as browser speech)
  // This means Safari can be fullscreen display-only — no mic permission needed
  startMicListener((text) => {
    console.log(`[Mic] Transcript: "${text.substring(0, 80)}..."`);
    processTranscript(text);
  });

  // Pre-generate TTS for all debate prompts so they play INSTANTLY
  console.log('[TTS] Pre-generating debate prompt audio...');
  (async () => {
    for (let i = 0; i < DEBATE_PROMPTS.length; i++) {
      const prompt = DEBATE_PROMPTS[i];
      try {
        const audioUrl = await smartTTS(prompt);
        promptTTSCache[prompt] = audioUrl;
        console.log(`[TTS] Pre-cached prompt ${i + 1}/${DEBATE_PROMPTS.length}: "${prompt}"`);
      } catch (err) {
        console.warn(`[TTS] Failed to pre-cache: "${prompt}":`, err.message);
      }
    }
    console.log(`[TTS] ${Object.keys(promptTTSCache).length} debate prompts pre-cached`);

    // After debate prompts, start background pre-rendering ALL responses
    // Priority: donations first, then debate, then conversation, then science
    const allTexts = [];
    try {
      const donations = JSON.parse(fs.readFileSync(path.join(__dirname, 'marie_donations.json'), 'utf8'));
      const donationList = donations.donation_responses || donations;
      // Add donation templates with placeholder replacements for common names
      for (const d of donationList.slice(0, 200)) { // Top 200 donation lines
        allTexts.push(d.replace(/\{name\}/g, 'friend').replace(/\{amount\}/g, 'the donation'));
      }
    } catch {}

    try {
      const responses = JSON.parse(fs.readFileSync(path.join(__dirname, 'marie_responses.json'), 'utf8'));
      for (const [cat, items] of Object.entries(responses)) {
        allTexts.push(...items.slice(0, 30)); // Top 30 per category
      }
    } catch {}

    try {
      const convos = JSON.parse(fs.readFileSync(path.join(__dirname, 'marie_conversations.json'), 'utf8'));
      const groups = convos.conversations || convos;
      for (const g of groups) {
        allTexts.push(...g.responses.slice(0, 5)); // Top 5 per conversation group
      }
    } catch {}

    try {
      const sciResp = JSON.parse(fs.readFileSync(path.join(__dirname, 'marie_science_responses.json'), 'utf8'));
      const sr = sciResp.science_responses || sciResp;
      for (const [cat, items] of Object.entries(sr)) {
        allTexts.push(...items.slice(0, 50)); // Top 50 per science category
      }
    } catch {}

    console.log(`[TTS Cache] Queuing ${allTexts.length} high-priority responses for background pre-rendering`);
    startPreRendering(allTexts, 300); // 300ms between each (gentle on CPU)
  })();
});
