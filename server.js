const http = require('http');
const fs = require('fs');
const path = require('path');
const { WebSocketServer } = require('ws');

const { analyzeTranscript } = require('./llm');
const { trackTranscript } = require('./repetition');
const { flashLight } = require('./shelly');

const PORT = 8080;
const recentTopics = [];

const MIME_TYPES = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
};

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
        const loop = trackTranscript(msg.text);
        const loopContext = loop.isLoop ? loop.loopKeyword : null;
        const result = await analyzeTranscript(msg.text, recentTopics, loopContext);

        if (result.found) {
          recentTopics.push(result.claim);
          if (recentTopics.length > 10) recentTopics.shift();

          if (loop.isLoop) {
            ws.send(JSON.stringify({ type: 'loop_breaker', ...result, loopKeyword: loop.loopKeyword }));
          } else {
            ws.send(JSON.stringify({ type: 'fact_check', ...result }));
          }

          console.log('[Shelly] Flashing light for new fact-check');
          flashLight().catch((err) => console.warn('[Shelly] Error:', err.message));
        }
      }
    } catch (err) {
      console.error('Message handling error:', err.message);
    }
  });
  ws.on('close', () => console.log('Client disconnected'));
});

server.listen(PORT, () => console.log(`Dashboard server running on http://localhost:${PORT}`));
