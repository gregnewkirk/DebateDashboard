const http = require('http');
const fs = require('fs');
const path = require('path');
const { WebSocketServer } = require('ws');

const { analyzeTranscript } = require('./llm');
const { trackTranscript, getRecentKeywords } = require('./repetition');
const { flashLight } = require('./shelly');
const { startSession, endSession, isActive, logEvent, incrementStat, getSession } = require('./session');

const CONFIG = {
  PORT: process.env.PORT || 8080,
  CARD_DISPLAY_SECONDS: 18,
  LOOP_THRESHOLD: 3,
  LOOP_WINDOW_SECONDS: 120,
};

const PORT = CONFIG.PORT;
const recentTopics = [];

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

function broadcast(wss, data) {
  const json = JSON.stringify(data);
  for (const client of wss.clients) {
    if (client.readyState === 1) {
      client.send(json);
    }
  }
}

const server = http.createServer((req, res) => {
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
          console.log('[Session] Started');
        }

        if (matchesTrigger(msg.text, END_TRIGGERS)) {
          const sessionData = endSession();
          broadcast(wss, { type: 'session_end', data: sessionData });
          console.log('[Session] Ended');
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
              logEvent({ type: 'loop_breaker', data: result });
              incrementStat('loopBreakerCount');
            } else {
              const payload = { type: 'fact_check', ...result };
              ws.send(JSON.stringify(payload));
              logEvent({ type: 'fact_check', data: result });

              // Increment debunked or misleading based on verdict
              const verdict = (result.verdict || '').toUpperCase();
              if (verdict === 'FALSE' || verdict === 'DEBUNKED') {
                incrementStat('debunkedCount');
              } else if (verdict === 'MISLEADING') {
                incrementStat('misleadingCount');
              }
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
