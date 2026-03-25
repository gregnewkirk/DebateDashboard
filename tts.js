/**
 * TTS Module — Marie Curie Voice (af_heart via Kokoro)
 *
 * Wraps the Python Kokoro TTS subprocess.
 * Serial queue ensures one generation at a time (~1.6s per clip on M4 Pro).
 * Generated WAVs served from public/tts/ via the HTTP server.
 */

const { execFile } = require('child_process');
const path = require('path');
const fs = require('fs');

const PYTHON = '/opt/homebrew/bin/python3.12';
const TTS_SCRIPT = path.join(__dirname, 'kokoro_tts.py');
const OUTPUT_DIR = path.join(__dirname, 'public', 'tts');

let counter = 0;
const queue = [];
let processing = false;

/**
 * Initialize TTS — create output dir, clean old files.
 */
function initTTS() {
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }
  // Clean old WAV files from previous sessions
  try {
    const files = fs.readdirSync(OUTPUT_DIR);
    for (const f of files) {
      if (f.endsWith('.wav')) {
        fs.unlinkSync(path.join(OUTPUT_DIR, f));
      }
    }
    console.log(`[TTS] Cleaned ${files.length} old WAV files`);
  } catch {}
  console.log('[TTS] Marie voice (af_heart) ready');
}

/**
 * Generate speech from text. Returns a URL path for the browser to fetch.
 * @param {string} text - Text for Marie to speak
 * @param {number} speed - Speech speed (0.5–2.0, default 1.0)
 * @returns {Promise<string>} URL path like '/tts/marie_0001.wav'
 */
function generateSpeech(text, speed = 1.0) {
  return new Promise((resolve, reject) => {
    if (!text || text.trim().length === 0) {
      return reject(new Error('Empty text'));
    }
    queue.push({ text: text.trim(), speed, resolve, reject });
    processQueue();
  });
}

async function processQueue() {
  if (processing || queue.length === 0) return;
  processing = true;

  const { text, speed, resolve, reject } = queue.shift();
  const filename = `marie_${String(++counter).padStart(4, '0')}.wav`;
  const outPath = path.join(OUTPUT_DIR, filename);
  const urlPath = `/tts/${filename}`;

  const startTime = Date.now();

  execFile(PYTHON, [TTS_SCRIPT, text, outPath, String(speed)], {
    timeout: 30000, // 30s max
    maxBuffer: 1024 * 1024,
  }, (err, stdout, stderr) => {
    const elapsed = Date.now() - startTime;

    if (err) {
      console.error(`[TTS] Generation failed (${elapsed}ms):`, err.message);
      if (stderr) console.error('[TTS] stderr:', stderr.substring(0, 200));
      reject(err);
    } else {
      console.log(`[TTS] Generated ${filename} (${elapsed}ms) — ${stdout.trim()}`);
      resolve(urlPath);
    }

    processing = false;
    processQueue();
  });
}

/**
 * Get queue status.
 */
function getTTSStatus() {
  return {
    queued: queue.length,
    processing,
    generated: counter,
  };
}

module.exports = { initTTS, generateSpeech, getTTSStatus };
