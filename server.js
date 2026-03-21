const http = require('http');
const fs = require('fs');
const path = require('path');
const { WebSocketServer } = require('ws');

const { analyzeTranscript } = require('./llm');
const { trackTranscript, getRecentKeywords } = require('./repetition');
const { flashLight, flashPaymentLight, flashAllLights } = require('./shelly');
const { startSession, endSession, isActive, logEvent, incrementStat, getSession, updateNickname, saveSessionLog } = require('./session');
const { generateNickname } = require('./nickname');
const { detectMomJoke, generatePileOn } = require('./momjoke');
const { onFactCheck, onLoopBreaker, onMomJoke, onPayment, onSessionStart, onSessionEnd, onReportCard } = require('./streamerbot');

const LLM_URL = 'http://localhost:3000/v1/chat/completions';
const LLM_MODEL = 'qwen2.5';

const CONFIG = {
  PORT: process.env.PORT || 8080,
  CARD_DISPLAY_SECONDS: 18,
  LOOP_THRESHOLD: 3,
  LOOP_WINDOW_SECONDS: 120,
};

const PORT = CONFIG.PORT;
const recentTopics = [];
let claimsSinceLastNickname = 0;

const MIME_TYPES = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
};

// Fuzzy trigger phrases (all lowercase)
const START_TRIGGERS = ["hey how's it going", "hey how is it going", "how's it going"];
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
  for (const client of wss.clients) {
    if (client.readyState === 1) {
      client.send(json);
    }
  }
}

const server = http.createServer((req, res) => {
  // Payment webhook endpoint
  if (req.method === 'POST' && req.url === '/api/payment') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        const payment = JSON.parse(body);
        // payment = { source: 'stripe'|'patreon', name: 'John', amount: '$5.00', message: 'Great stream!' }
        console.log(`[Payment] ${payment.source}: ${payment.name} - ${payment.amount}`);

        // Broadcast to all WebSocket clients
        const msg = JSON.stringify({ type: 'payment', ...payment });
        wss.clients.forEach(client => {
          if (client.readyState === 1) client.send(msg);
        });

        // Flash payment light
        flashPaymentLight().catch(err => console.warn('[Shelly] Error:', err.message));

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

wss.on('connection', (ws) => {
  console.log('Client connected');
  ws.on('message', async (raw) => {
    try {
      const msg = JSON.parse(raw.toString());
      console.log('Received:', msg.type);

      if (msg.type === 'transcript') {
        // Check start/end triggers BEFORE fact-check pipeline
        if (matchesTrigger(msg.text, START_TRIGGERS)) {
          startSession();
          broadcast(wss, { type: 'session_start' });
          onSessionStart();
          console.log('[Session] Started');
        }

        if (matchesTrigger(msg.text, END_TRIGGERS)) {
          const sessionData = endSession();
          broadcast(wss, { type: 'session_end', data: sessionData });
          onSessionEnd(sessionData);
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
        if (detectMomJoke(msg.text) && isActive()) {
          const lastTopic = recentTopics.length > 0 ? recentTopics[recentTopics.length - 1] : null;
          const jokes = await generatePileOn(msg.text, lastTopic);
          incrementStat('momJokeCount');
          logEvent({ type: 'mom_joke', pileOn: jokes });
          broadcast(wss, { type: 'mom_joke', jokes: jokes });
          onMomJoke({ count: jokes.length });
          flashLight().catch((err) => console.warn('[Shelly] Error:', err.message));
          console.log('[MomJoke] Detected! Piling on...');
          return;
        }

        // Only run fact-check pipeline when session is active
        if (isActive()) {
          const loop = trackTranscript(msg.text);
          const loopContext = loop.isLoop ? loop.loopKeyword : null;
          const result = await analyzeTranscript(msg.text, recentTopics, loopContext);

          if (result.found) {
            recentTopics.push(result.claim);
            if (recentTopics.length > 10) recentTopics.shift();

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
              ws.send(JSON.stringify(payload));
              onLoopBreaker(result);
              logEvent({ type: 'loop_breaker', data: result });
              incrementStat('loopBreakerCount');
            } else {
              const payload = { type: 'fact_check', ...result };
              ws.send(JSON.stringify(payload));
              onFactCheck(result);
              logEvent({ type: 'fact_check', data: result });

              // Increment debunked or misleading based on verdict
              const verdict = (result.verdict || '').toUpperCase();
              if (verdict === 'FALSE' || verdict === 'DEBUNKED') {
                incrementStat('debunkedCount');
              } else if (verdict === 'MISLEADING') {
                incrementStat('misleadingCount');
              }
            }

            // Nickname evolution: every 3 claims, generate a new nickname
            claimsSinceLastNickname++;
            if (claimsSinceLastNickname >= 3) {
              claimsSinceLastNickname = 0;
              generateNickname(getSession().allClaims, msg.text).then((newNickname) => {
                updateNickname(newNickname);
                broadcast(wss, { type: 'nickname_update', nickname: newNickname });
                console.log(`[Nickname] Updated to: ${newNickname}`);
              });
            }

            console.log('[Shelly] Flashing light for new fact-check');
            flashLight().catch((err) => console.warn('[Shelly] Error:', err.message));
          }
        }
      }
    } catch (err) {
      console.error('Message handling error:', err.message);
    }
  });
  ws.on('close', () => console.log('Client disconnected'));
});

server.listen(PORT, () => console.log(`Dashboard server running on http://localhost:${PORT}`));
