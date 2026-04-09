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
const { generateResponse: marieRespond, shouldRespond: marieShouldRespond, shouldStop: marieShouldStop, matchConversation, getRandomFact, getRandomScientist, getRandomMyth, getRandomQuiz, getRandomBreakthrough, getRandomThisOrThat, getRandomOutbreak, getDonationResponse, getMomJokeReaction, getLoopBreakerResponse, getReportCardResponse, isRepeatedFactCheck, trackFactCheck, clearRecentHistory: marieClearHistory } = require('./marie');
const { startMicListener, getMicStatus, muteMic, isMuted, getRecentTranscripts, getFullTranscript, getTranscriptPath, resetTranscriptSession } = require('./mic');
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

const os = require('os');

const PORT = CONFIG.PORT;
const recentTopics = [];
let claimsSinceLastNickname = 0;
let marieSpeaking = false; // true while TTS is playing — suppress all triggers

// ============================================================
// BG AUTO-ROTATION — cycles through favorite backgrounds
// ============================================================
let currentBg = 'bg-halo-v6-minimal.html'; // Default background — Greg's favorite

const bgRotation = {
  enabled: false,
  timer: null,
  lastType: null,  // track last type to ensure we always switch
  intervalMs: 5 * 60 * 1000, // 5 minutes
  // Grouped by TYPE so we can guarantee switching between types every rotation
  types: {
    halo: [
      'bg-halo-v6-minimal.html',
      'bg-halo-v4-crimson.html',
      'bg-halo-v3-emerald.html',
      'bg-halo-v2-electric-purple.html',
      'bg-halo-v5-cosmic.html',
      'bg-vanta-halo.html',
      'bg-halo-v1-deep-ocean.html',
    ],
    fog: [
      'bg-vanta-fog.html',
      'bg-fog-v2-purple.html',
      'bg-fog-v1-aurora.html',
      'bg-fog-v3-emerald.html',
    ],
    net: [
      'bg-vanta-net.html',
      'bg-net-v5-multicolor.html',
      'bg-net-v3-purple.html',
      'bg-net-v7-emerald.html',
      'bg-net-v4-minimal.html',
    ],
  },
  // Per-type index for round-robin within each type (so we don't repeat the same bg)
  typeIndex: { halo: 0, fog: 0, net: 0 },
  // Type rotation order — cycles through types in order, never same type twice
  typeOrder: ['halo', 'fog', 'net'],
  typeOrderIndex: 0,
};

function bgRotationTick() {
  if (!bgRotation.enabled) return;

  // Pick the next TYPE (always different from last)
  const nextType = bgRotation.typeOrder[bgRotation.typeOrderIndex];
  bgRotation.typeOrderIndex = (bgRotation.typeOrderIndex + 1) % bgRotation.typeOrder.length;

  // Pick the next BG within that type (round-robin)
  const pool = bgRotation.types[nextType];
  const idx = bgRotation.typeIndex[nextType] % pool.length;
  const bg = pool[idx];
  bgRotation.typeIndex[nextType] = idx + 1;

  bgRotation.lastType = nextType;
  currentBg = bg;
  broadcast(wss, { type: 'set_bg', bg });
  console.log(`[BG] Rotated to: ${bg} (type: ${nextType}, idx: ${idx})`);
}

// Auto-start rotation on server boot
bgRotation.enabled = true;
bgRotation.timer = setInterval(bgRotationTick, bgRotation.intervalMs);
const totalBgs = Object.values(bgRotation.types).reduce((s, arr) => s + arr.length, 0);
console.log(`[BG] Auto-rotation STARTED on boot (${bgRotation.intervalMs / 1000}s interval, ${totalBgs} backgrounds across ${Object.keys(bgRotation.types).length} types)`);

// ============================================================
// MARIE FACT-CHECK QUEUE — she analyzes silently, Greg fires
// ============================================================
// Instead of auto-speaking, Marie queues fact-checks with pre-rendered TTS.
// Dashboard flashes red when queue has items. Greg hits F to fire.
const marieQueue = [];  // { text, audioUrl, result, queuedAt }
const MARIE_QUEUE_MAX = 5;  // Keep last 5, drop oldest

// Bait lines — Marie goads chat into debating
let BAIT_LINES = [];
try { BAIT_LINES = JSON.parse(fs.readFileSync(path.join(__dirname, 'marie_bait_lines.json'), 'utf8')); } catch (e) { console.warn('[Marie] No bait lines file found'); }
let baitIndex = 0;

// Citation database — academic sources by topic
let CITATIONS = {};
try { CITATIONS = JSON.parse(fs.readFileSync(path.join(__dirname, 'marie_citations.json'), 'utf8')); } catch (e) { console.warn('[Marie] No citations file found'); }

function getCitationForClaim(claim) {
  if (!claim) return null;
  const lower = claim.toLowerCase();
  const topicMap = {
    vaccines: ['vaccin', 'autism', 'mmr', 'antivax', 'anti-vax', 'jab', 'immuniz'],
    flat_earth: ['flat earth', 'globe', 'horizon', 'curvature'],
    climate: ['climate', 'global warming', 'carbon', 'greenhouse', 'fossil fuel'],
    evolution: ['evolution', 'darwin', 'fossil', 'species', 'primate', 'creationi'],
    gmo: ['gmo', 'genetically modified', 'monsanto', 'roundup'],
    chemtrails: ['chemtrail', 'contrail', 'spray', 'geoengineering'],
    homeopathy: ['homeopath', 'dilut', 'water memory'],
    '5g': ['5g', 'cell tower', 'emf', 'radiation.*phone', 'wifi.*danger'],
    essential_oils: ['essential oil', 'aromatherap', 'doterra', 'young living'],
    fluoride: ['fluoride', 'fluorid', 'water supply.*poison'],
    covid: ['covid', 'sars-cov', 'ivermectin', 'lab leak', 'wuhan', 'coronavirus'],
    moon_landing: ['moon land', 'moon hoax', 'apollo', 'lunar'],
    acupuncture: ['acupunctur', 'meridian', 'chi.*energy', 'qi.*energy'],
  };
  for (const [topic, keywords] of Object.entries(topicMap)) {
    if (keywords.some(kw => new RegExp(kw, 'i').test(lower))) {
      const pool = CITATIONS[topic];
      if (pool && pool.length > 0) return pool[Math.floor(Math.random() * pool.length)];
    }
  }
  // Fallback to general
  const gen = CITATIONS.general;
  return gen && gen.length > 0 ? gen[Math.floor(Math.random() * gen.length)] : null;
}

// ============================================================
// PERSISTENT EVENT LOG — appends every significant event to disk
// ============================================================
const VAULT_CONTENT_DIR = path.join(os.homedir(), 'vaults', 'Mnemosyne', 'DrGreg-Ops', '30-Content');
let eventLogPath = null;
let sessionEvents = []; // in-memory copy for API access

function getDateDir() {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

function ensureEventLogFile() {
  if (eventLogPath) return eventLogPath;
  const dateDir = path.join(VAULT_CONTENT_DIR, getDateDir());
  fs.mkdirSync(dateDir, { recursive: true });
  eventLogPath = path.join(dateDir, 'live-events.jsonl');
  console.log(`[Events] Persistent event log: ${eventLogPath}`);
  return eventLogPath;
}

function persistEvent(type, data) {
  try {
    const filePath = ensureEventLogFile();
    const entry = { type, data: data || {}, time: Date.now() };
    fs.appendFileSync(filePath, JSON.stringify(entry) + '\n');
    sessionEvents.push(entry);
  } catch (err) {
    console.error('[Events] Failed to persist event:', err.message);
  }
}

function getSessionEvents() {
  return sessionEvents;
}

function resetEventSession() {
  eventLogPath = null;
  sessionEvents = [];
}

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
  marieClearHistory(); // Also clear Marie's internal anti-repeat tracking
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
  "Climate change is real.",
  "Evolution produced humans.",
  "Fluoride is safe.",
  "Natural immunity fails.",
  "Nuclear is safest.",
  "Organic is marketing.",
  "Earth is ancient.",
  "Homeopathy is placebo.",
  "Gender isn't sex.",
  "We're causing extinction.",
  "Raw milk kills.",
  "Defund pseudoscience.",
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
        // Persistent event log (always, regardless of session)
        persistEvent('payment', payment);

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
  if ((req.method === 'POST' || req.method === 'GET') && req.url === '/api/marie/stop') {
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
  if ((req.method === 'POST' || req.method === 'GET') && req.url === '/api/lights/off') {
    lightsOff().catch(() => {});
    console.log('[Shelly] All lights off');
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true }));
    return;
  }

  // === STREAM DECK URL ALIASES ===
  // Map /api/streamdeck/* to the real endpoints so Stream Deck buttons work
  if (req.url.startsWith('/api/streamdeck/') && (req.method === 'POST' || req.method === 'GET')) {
    const action = req.url.replace('/api/streamdeck/', '');
    const remap = {
      'reset': '/api/reset',
      'donation': '/api/donation/test',
      'reportcard': '/api/reportcard',
      'loopbreaker': '/api/loopbreaker',
      'ad': '/api/adscreen',
      'bingo': '/api/bingo/toggle',
      'credibility': '/api/credibility/toggle',
      'graph': '/api/graph/toggle',
      'thisorthat': '/api/thisorthat',
    };
    if (remap[action]) {
      req.url = remap[action];
      // For donation test, inject test body
      if (action === 'donation') {
        req._testBody = JSON.stringify({ source: 'test', name: 'Test Donor', amount: '$5.00', message: 'Stream Deck test' });
      }
    }
  }

  // === STREAM DECK ENDPOINTS ===
  // All simple POST endpoints for Stream Deck HTTP buttons

  // SCIENCE BUTTON — Random carousel: quiz, this-or-that, fact, myth, scientist, breakthrough, outbreak
  if ((req.method === 'POST' || req.method === 'GET') && req.url === '/api/science') {
    const types = ['quiz', 'thisorthat', 'fact', 'mythbuster', 'scientist', 'breakthrough', 'outbreak'];
    const pick = types[Math.floor(Math.random() * types.length)];
    console.log(`[StreamDeck] SCIENCE → ${pick}`);
    req.method = 'POST'; // Ensure POST for handlers that require it
    req.url = '/api/' + pick;
    // Fall through to the specific handler below
  }

  // FACT CHECK BUTTON — Analyze last 2-3 min of transcript, debunk biggest claim
  if ((req.method === 'POST' || req.method === 'GET') && req.url === '/api/factcheck') {
    const recentTranscripts = getRecentTranscripts ? getRecentTranscripts(180) : []; // last 3 min
    const combined = recentTranscripts.join(' ').trim();
    if (!combined || combined.length < 10) {
      console.log('[StreamDeck] FACT CHECK — no recent transcript');
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: false, error: 'No recent transcript to analyze' }));
      return;
    }
    console.log(`[StreamDeck] FACT CHECK — analyzing ${combined.length} chars from last 3 min`);
    try {
      const result = await analyzeTranscript(combined, [], null);
      if (result.found) {
        broadcast(wss, { type: 'fact_check', ...result });
        flashLight().catch(() => {});
        // Marie reads the fact check
        const ttsText = `Fact check! Claim: ${result.claim}. Verdict: ${result.verdict}. ${result.fact}`;
        smartTTS(ttsText).then(audioUrl => {
          marieStartSpeaking();
          broadcast(wss, { type: 'marie_speak', text: ttsText, audioUrl });
        }).catch(() => {});
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true, claim: result.claim, verdict: result.verdict }));
      } else {
        // Nothing to debunk — Marie says so
        const noClaimText = "I've been listening and honestly, nothing debunkable in the last few minutes. That's either good news or they're being sneaky.";
        smartTTS(noClaimText).then(audioUrl => {
          marieStartSpeaking();
          broadcast(wss, { type: 'marie_speak', text: noClaimText, audioUrl });
        }).catch(() => {});
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true, claim: null, message: 'No conspiracy detected' }));
      }
    } catch (err) {
      console.error('[FactCheck] Error:', err.message);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: false, error: err.message }));
    }
    return;
  }

  // DEBATE MODE TOGGLE — One button: start debate (bingo+cred+graph) / end debate (report card)
  if ((req.method === 'POST' || req.method === 'GET') && req.url === '/api/debate') {
    if (!isActive()) {
      // START debate mode
      startSession();
      newBingoBoard();
      resetCredibility();
      resetGraph();
      resetMood();
      broadcast(wss, { type: 'session_start' });
      broadcast(wss, { type: 'bingo_update', ...getBingoBoard() });
      broadcast(wss, { type: 'credibility_update', value: 50 });
      broadcast(wss, { type: 'conspiracy_graph_update', nodes: [], edges: [] });
      onSessionStart();
      persistEvent('session_start', { trigger: 'streamdeck' });
      console.log('[StreamDeck] DEBATE MODE ON');
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true, mode: 'started' }));
    } else {
      // END debate mode → trigger report card
      const sessionData = endSession();
      broadcast(wss, { type: 'session_end', data: sessionData });
      persistEvent('session_end', { trigger: 'streamdeck', nickname: sessionData.nickname, claimCount: sessionData.claimCount });
      onSessionEnd(sessionData);
      // Generate report card
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
        flashAllLights().catch(() => {});
        try { saveSessionLog(sessionData, llmResult); } catch {}
      }).catch(() => {});
      console.log('[StreamDeck] DEBATE MODE OFF → REPORT CARD');
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true, mode: 'ended' }));
    }
    return;
  }

  // Reset everything — stop Marie, clear screen, lights off, return to standby
  if ((req.method === 'POST' || req.method === 'GET') && req.url === '/api/reset') {
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

  // Set background — switches the dashboard background live
  if (req.method === 'POST' && req.url === '/api/set-bg') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        const { bg } = JSON.parse(body);
        currentBg = bg;
        broadcast(wss, { type: 'set_bg', bg });
        console.log(`[BG] Switched to: ${bg}`);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true, bg }));
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, error: 'Bad JSON' }));
      }
    });
    return;
  }

  // ── BG AUTO-ROTATION — cycles through favorites on a timer ──
  if ((req.method === 'POST' || req.method === 'GET') && req.url === '/api/bg/rotate/start') {
    if (!bgRotation.timer) {
      bgRotation.enabled = true;
      bgRotation.typeOrderIndex = 0;
      bgRotationTick();
      bgRotation.timer = setInterval(bgRotationTick, bgRotation.intervalMs);
      const totalBgs = Object.values(bgRotation.types).reduce((s, arr) => s + arr.length, 0);
      console.log(`[BG] Auto-rotation STARTED (${bgRotation.intervalMs / 1000}s interval, ${totalBgs} backgrounds across ${Object.keys(bgRotation.types).length} types)`);
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true, interval: bgRotation.intervalMs, types: Object.keys(bgRotation.types) }));
    return;
  }

  if ((req.method === 'POST' || req.method === 'GET') && req.url === '/api/bg/rotate/stop') {
    if (bgRotation.timer) {
      clearInterval(bgRotation.timer);
      bgRotation.timer = null;
      bgRotation.enabled = false;
      console.log('[BG] Auto-rotation STOPPED');
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true, message: 'Rotation stopped' }));
    return;
  }

  if (req.method === 'GET' && req.url === '/api/bg/rotate/status') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      ok: true,
      enabled: bgRotation.enabled,
      current: currentBg,
      lastType: bgRotation.lastType,
      nextType: bgRotation.typeOrder[bgRotation.typeOrderIndex],
      interval: bgRotation.intervalMs,
      types: bgRotation.types,
    }));
    return;
  }

  // Ad screen
  if ((req.method === 'POST' || req.method === 'GET') && req.url === '/api/adscreen') {
    broadcast(wss, { type: 'show_ad' });
    console.log('[StreamDeck] Ad screen');
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true }));
    return;
  }

  // Report card (test)
  if ((req.method === 'POST' || req.method === 'GET') && req.url === '/api/reportcard') {
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

  // Bingo toggle
  if ((req.method === 'POST' || req.method === 'GET') && req.url === '/api/bingo/toggle') {
    broadcast(wss, { type: 'bingo_update', squares: getBingoBoard().squares, hits: getBingoBoard().hits });
    console.log('[StreamDeck] Bingo toggled');
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true }));
    return;
  }

  // Credibility toggle
  if ((req.method === 'POST' || req.method === 'GET') && req.url === '/api/credibility/toggle') {
    broadcast(wss, { type: 'credibility_update', value: getCredibility() });
    console.log('[StreamDeck] Credibility toggled');
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true }));
    return;
  }

  // Graph toggle
  if ((req.method === 'POST' || req.method === 'GET') && req.url === '/api/graph/toggle') {
    broadcast(wss, { type: 'conspiracy_graph_update', ...getGraph() });
    console.log('[StreamDeck] Graph toggled');
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true }));
    return;
  }

  // Test donation (Stream Deck / GET-friendly)
  if ((req.method === 'POST' || req.method === 'GET') && req.url === '/api/donation/test') {
    const testPayment = { source: 'test', name: 'Test Donor', amount: '$5.00', message: 'Stream Deck test donation!' };
    testPayment.name = testPayment.name.split(/\s+/)[0];
    broadcast(wss, { type: 'payment', ...testPayment });
    flashPaymentLight().catch(() => {});
    const donationText = getDonationResponse(testPayment.name, testPayment.amount);
    smartTTS(donationText).then(audioUrl => {
      marieStartSpeaking();
      broadcast(wss, { type: 'tts_ready', audioUrl, text: donationText });
    }).catch(() => {});
    console.log('[StreamDeck] Test donation');
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true }));
    return;
  }

  // Loop breaker (test)
  if ((req.method === 'POST' || req.method === 'GET') && req.url === '/api/loopbreaker') {
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
  if ((req.method === 'POST' || req.method === 'GET') && req.url === '/api/bingo/toggle') {
    broadcast(wss, { type: 'bingo_toggle' });
    console.log('[StreamDeck] Bingo toggle');
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true }));
    return;
  }

  // Credibility toggle
  if ((req.method === 'POST' || req.method === 'GET') && req.url === '/api/credibility/toggle') {
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
      persistEvent('session_start', { trigger: 'manual' });
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
      persistEvent('session_end', { trigger: 'manual', nickname: sessionData.nickname, claimCount: sessionData.claimCount });
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
  if ((req.method === 'POST' || req.method === 'GET') && req.url === '/api/quiz') {
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
  if ((req.method === 'POST' || req.method === 'GET') && req.url === '/api/thisorthat') {
    try {
      const tt = getRandomThisOrThat();
      if (!tt) { res.writeHead(200); res.end(JSON.stringify({ ok: false })); return; }

      const question = tt.question || tt.q;
      const labelA = tt.al;
      const labelB = tt.bl;
      const answer = tt.ans || tt.answer;
      const explanation = tt.explanation || tt.e;

      broadcast(wss, { type: 'this_or_that', question, a: tt.a, al: labelA, b: tt.b, bl: labelB, ans: answer, explanation, seconds: 20 });

      const introText = `This or that! ${question}. Option A: ${labelA}. Option B: ${labelB}. Type A or B in chat! You have 20 seconds!`;
      smartTTS(introText).then(audioUrl => {
        marieStartSpeaking(12000);
        broadcast(wss, { type: 'marie_speak', text: introText, audioUrl });
      }).catch(() => {});

      setTimeout(async () => {
        broadcast(wss, { type: 'this_or_that_reveal', ans: answer, explanation });
        const revealText = `The answer is ${answer}. ${explanation}`;
        try {
          const audio = await smartTTS(revealText);
          marieStartSpeaking();
          broadcast(wss, { type: 'marie_speak', text: revealText, audioUrl: audio });
        } catch {}
      }, 23000);

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true, question }));
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

  // Science Fact
  if ((req.method === 'POST' || req.method === 'GET') && req.url === '/api/fact') {
    try {
      const fact = getRandomFact();
      if (!fact) { res.writeHead(200); res.end(JSON.stringify({ ok: false })); return; }
      const factObj = typeof fact === 'string' ? { title: fact, description: '', source: '' } : fact;
      broadcast(wss, { type: 'science_fact', ...factObj });
      const speech = typeof fact === 'string' ? fact : `${factObj.title || ''}. ${factObj.description || ''}`;
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

  // Scientist Spotlight
  if ((req.method === 'POST' || req.method === 'GET') && req.url === '/api/scientist') {
    try {
      const sci = getRandomScientist();
      if (!sci) { res.writeHead(200); res.end(JSON.stringify({ ok: false })); return; }
      const sciObj = typeof sci === 'string' ? { name: sci } : sci;
      broadcast(wss, { type: 'scientist_spotlight', ...sciObj });
      const speech = typeof sci === 'string' ? sci : `Scientist spotlight: ${sciObj.name || ''}. ${sciObj.breakthrough || ''}`;
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

  // Breakthrough
  if ((req.method === 'POST' || req.method === 'GET') && req.url === '/api/breakthrough') {
    try {
      const bt = getRandomBreakthrough();
      if (!bt) { res.writeHead(200); res.end(JSON.stringify({ ok: false })); return; }
      const btObj = typeof bt === 'string' ? { title: bt } : bt;
      broadcast(wss, { type: 'breakthrough', ...btObj });
      const speech = typeof bt === 'string' ? bt : `Breakthrough: ${btObj.title || ''}. ${btObj.simple || ''}`;
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

  // Outbreak Report
  if ((req.method === 'POST' || req.method === 'GET') && req.url === '/api/outbreak') {
    try {
      const ob = getRandomOutbreak();
      if (!ob) { res.writeHead(200); res.end(JSON.stringify({ ok: false })); return; }
      broadcast(wss, { type: 'outbreak', ...ob });
      const speech = `Outbreak report: ${ob.disease || ob.title || ''}. ${ob.headline || ob.detail || ''}`;
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

  // Myth Buster (alias)
  if ((req.method === 'POST' || req.method === 'GET') && req.url === '/api/myth') {
    req.url = '/api/mythbuster';
    // Fall through
  }

  // Marie TTS test — generates speech and broadcasts to all clients
  if ((req.method === 'POST' || req.method === 'GET') && req.url === '/api/marie/test') {
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

  // ── MARIE FIRE — Greg hits this to make Marie speak the queued fact-check ──
  if ((req.method === 'POST' || req.method === 'GET') && req.url === '/api/marie/fire') {
    if (marieQueue.length === 0) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: false, error: 'Queue empty — nothing to fire' }));
      return;
    }

    // Pop the FIRST (oldest/most relevant) queued fact-check
    const queued = marieQueue.shift();
    console.log(`[Marie] FIRED! "${queued.text.substring(0, 80)}..." (${marieQueue.length} remaining in queue)`);

    // Show the visual fact card — enhanced with citation
    if (queued.result) {
      const citation = getCitationForClaim(queued.result.claim);
      broadcast(wss, { type: 'fact_check', ...queued.result, citation: citation || queued.result.source || null });
    }

    // Play the pre-rendered TTS immediately — zero delay
    if (queued.audioUrl) {
      marieStartSpeaking();
      broadcast(wss, { type: 'tts_ready', audioUrl: queued.audioUrl, text: queued.text });
    } else {
      // TTS wasn't ready — generate now (slight delay)
      try {
        const audioUrl = await smartTTS(queued.text);
        marieStartSpeaking();
        broadcast(wss, { type: 'tts_ready', audioUrl, text: queued.text });
      } catch (err) {
        marieStartSpeaking(5000);
        broadcast(wss, { type: 'marie_speak', text: queued.text, audioUrl: null });
      }
    }

    // Update queue status on dashboard
    broadcast(wss, { type: 'marie_queue_status', count: marieQueue.length, items: marieQueue.map(q => ({ text: q.text.substring(0, 80), queuedAt: q.queuedAt })) });

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true, fired: queued.text.substring(0, 100), remaining: marieQueue.length }));
    return;
  }

  // ── MARIE QUEUE STATUS — check what's queued ──
  if (req.method === 'GET' && req.url === '/api/marie/queue') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      ok: true,
      count: marieQueue.length,
      items: marieQueue.map(q => ({
        text: q.text.substring(0, 120),
        claim: q.result?.claim || '',
        verdict: q.result?.verdict || '',
        queuedAt: q.queuedAt,
        hasAudio: !!q.audioUrl
      }))
    }));
    return;
  }

  // ── MARIE QUEUE CLEAR — flush the queue ──
  if (req.method === 'POST' && req.url === '/api/marie/queue/clear') {
    marieQueue.length = 0;
    broadcast(wss, { type: 'marie_queue_status', count: 0, items: [] });
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true, message: 'Queue cleared' }));
    return;
  }

  // ── MARIE BAIT — Goad chat into debating ──
  if ((req.method === 'POST' || req.method === 'GET') && req.url === '/api/marie/bait') {
    if (BAIT_LINES.length === 0) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: false, error: 'No bait lines loaded' }));
      return;
    }
    const line = BAIT_LINES[baitIndex % BAIT_LINES.length];
    baitIndex++;

    // Show bait card on dashboard
    broadcast(wss, { type: 'marie_bait', text: line });

    // Also TTS it — Marie speaks the bait line
    smartTTS(line).then(audioUrl => {
      marieStartSpeaking();
      broadcast(wss, { type: 'tts_ready', audioUrl, text: line });
    }).catch(() => {
      broadcast(wss, { type: 'marie_speak', text: line, audioUrl: null });
    });

    console.log(`[Marie] BAIT: "${line.substring(0, 80)}..."`);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true, bait: line }));
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

  // Full transcript for current session (persistent log)
  if (req.method === 'GET' && req.url === '/api/transcript') {
    const transcript = getFullTranscript();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ count: transcript.length, path: getTranscriptPath(), segments: transcript }));
    return;
  }

  // Full event log for current session (persistent log)
  if (req.method === 'GET' && req.url === '/api/events') {
    const events = getSessionEvents();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ count: events.length, events }));
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
          persistEvent('bingo_hit', bingoHit);
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
          persistEvent('session_start', { trigger: 'voice' });
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
          persistEvent('session_end', { trigger: 'voice', nickname: sessionData.nickname, claimCount: sessionData.claimCount });
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
            persistEvent('report_card', { nickname: sessionData.nickname, grade: llmResult.grade, stats: { claimCount: sessionData.claimCount, debunkedCount: sessionData.debunkedCount } });

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
        // REDESIGN: In debate mode, Marie does NOT auto-speak. Only queues fact-checks.
        // In solo mode, she only speaks when Greg hits bait button or direct-addresses her.
        const { getTTSStatus } = require('./tts');
        if (getTTSStatus().processing || getTTSStatus().queued > 0) {
          // TTS is busy — don't trigger Marie again
        } else {
        const marieCheck = marieShouldRespond(text, isActive());
        // Only allow auto-speaking for: direct address by name, feminist defense, and stop commands
        // Block all random facts, science pulls, solo hype, and debate banter
        const allowedReasons = ['direct', 'feminist', 'stop'];
        const isAllowed = marieCheck.should && allowedReasons.some(r => marieCheck.reason?.includes(r));
        if (isAllowed) {
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
            persistEvent('credibility_update', { verdict: result.verdict, ...getCredibility() });

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
              persistEvent('fact_check', { ...result, loopBreaker: true, loopKeyword: loop.loopKeyword });
              incrementStat('loopBreakerCount');
              credLoopBreaker(); // Extra credibility penalty
              moodEvent({ type: 'loop_breaker' });
              broadcast(wss, { type: 'credibility', ...getCredibility() });

              // Marie QUEUES loop breaker — same queue system
              const loopText = `Broken record! They said ${result.claim} again. Still ${result.verdict}.`;
              const loopEntry = { text: loopText, audioUrl: null, result, queuedAt: new Date().toISOString() };
              if (marieQueue.length >= MARIE_QUEUE_MAX) marieQueue.shift();
              marieQueue.push(loopEntry);
              broadcast(wss, { type: 'marie_queued', count: marieQueue.length, claim: result.claim, verdict: 'LOOP: ' + result.verdict });
              console.log(`[Marie] QUEUED loop-breaker: "${result.claim}" (${marieQueue.length} in queue)`);
              smartTTS(loopText).then(audioUrl => { loopEntry.audioUrl = audioUrl; }).catch(() => {});

            } else {
              // Anti-repeat: skip if we already covered this claim recently
              if (isDuplicateClaim(result.claim)) {
                console.log(`[AntiRepeat] Skipping duplicate claim: "${result.claim}"`);
              } else {
                const payload = { type: 'fact_check', ...result };
                broadcast(wss, payload);
                onFactCheck(result);
                logEvent({ type: 'fact_check', data: result });
                persistEvent('fact_check', result);

                // Increment debunked or misleading based on verdict
                const verdict = (result.verdict || '').toUpperCase();
                if (verdict === 'FALSE' || verdict === 'DEBUNKED') {
                  incrementStat('debunkedCount');
                } else if (verdict === 'MISLEADING') {
                  incrementStat('misleadingCount');
                }

                // Marie QUEUES fact check — pre-renders TTS but does NOT speak
                // Greg sees red flash on dashboard, hits F to fire
                const factText = `Claim: ${result.claim}. Verdict: ${result.verdict}. ${result.fact}`;
                if (!isDuplicateBroadcast(factText)) {
                  // Pre-render TTS in background so it's instant when Greg fires
                  const queueEntry = { text: factText, audioUrl: null, result, queuedAt: new Date().toISOString() };

                  // Drop oldest if queue is full
                  if (marieQueue.length >= MARIE_QUEUE_MAX) marieQueue.shift();
                  marieQueue.push(queueEntry);

                  // Flash red on dashboard — Marie has something ready
                  broadcast(wss, {
                    type: 'marie_queued',
                    count: marieQueue.length,
                    claim: result.claim,
                    verdict: result.verdict,
                  });
                  console.log(`[Marie] QUEUED fact-check: "${result.claim}" (${marieQueue.length} in queue) — waiting for Greg to fire`);

                  // Pre-render TTS in background (so it plays instantly when fired)
                  smartTTS(factText).then(audioUrl => {
                    queueEntry.audioUrl = audioUrl;
                    console.log(`[Marie] TTS pre-rendered for: "${result.claim.substring(0, 50)}"`);
                  }).catch(err => {
                    console.warn('[TTS] Pre-render failed (will generate on fire):', err.message);
                  });
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
  // Send current background to new clients immediately
  if (currentBg) {
    ws.send(JSON.stringify({ type: 'set_bg', bg: currentBg }));
  }
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
