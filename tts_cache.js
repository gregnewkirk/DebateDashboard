/**
 * TTS Pre-Render Cache
 *
 * Pre-generates WAV files for all Opus-written responses.
 * Runs as a background process — doesn't block the server.
 * Files cached to disk by text hash, persist across restarts.
 *
 * Lookup: text → hash → /public/tts_cache/HASH.wav → instant playback
 * Miss: falls through to live Kokoro TTS (~2s)
 *
 * Priority order:
 *   1. Donation responses (most time-critical)
 *   2. Debate dunks
 *   3. Conversation triggers
 *   4. Solo/banter
 *   5. Science-derived
 */

const { execFile } = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const PYTHON = '/opt/homebrew/bin/python3.12';
const TTS_SCRIPT = path.join(__dirname, 'kokoro_tts.py');
const CACHE_DIR = path.join(__dirname, 'public', 'tts_cache');

let cacheStats = { total: 0, cached: 0, generating: false, queue: 0, errors: 0 };

/**
 * Generate a hash for a text string (used as filename).
 */
function textHash(text) {
  return crypto.createHash('md5').update(text.trim().toLowerCase()).digest('hex').substring(0, 16);
}

/**
 * Get the cached WAV URL for a text string, or null if not cached.
 */
function getCachedAudio(text) {
  const hash = textHash(text);
  const wavPath = path.join(CACHE_DIR, `${hash}.wav`);
  if (fs.existsSync(wavPath)) {
    return `/tts_cache/${hash}.wav`;
  }
  return null;
}

/**
 * Generate and cache a single WAV file.
 */
function generateAndCache(text) {
  return new Promise((resolve, reject) => {
    const hash = textHash(text);
    const wavPath = path.join(CACHE_DIR, `${hash}.wav`);

    // Skip if already cached
    if (fs.existsSync(wavPath)) {
      resolve(`/tts_cache/${hash}.wav`);
      return;
    }

    execFile(PYTHON, [TTS_SCRIPT, text, wavPath], {
      timeout: 30000,
      maxBuffer: 1024 * 1024,
    }, (err) => {
      if (err) {
        cacheStats.errors++;
        reject(err);
      } else {
        cacheStats.cached++;
        resolve(`/tts_cache/${hash}.wav`);
      }
    });
  });
}

/**
 * Initialize cache directory and count existing cached files.
 */
function initCache() {
  if (!fs.existsSync(CACHE_DIR)) {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
  }
  const existing = fs.readdirSync(CACHE_DIR).filter(f => f.endsWith('.wav'));
  cacheStats.cached = existing.length;
  console.log(`[TTS Cache] ${existing.length} pre-rendered WAVs found on disk`);
}

/**
 * Start background pre-rendering of all responses.
 * Runs slowly (one at a time with delays) to not hog the CPU.
 */
async function startPreRendering(allTexts, delayMs = 500) {
  cacheStats.total = allTexts.length;
  cacheStats.generating = true;
  cacheStats.queue = allTexts.length;

  // Count how many are already cached
  let skipped = 0;
  const toGenerate = [];
  for (const text of allTexts) {
    if (getCachedAudio(text)) {
      skipped++;
    } else {
      toGenerate.push(text);
    }
  }

  cacheStats.queue = toGenerate.length;
  console.log(`[TTS Cache] Pre-rendering ${toGenerate.length} responses (${skipped} already cached, ${allTexts.length} total)`);

  if (toGenerate.length === 0) {
    cacheStats.generating = false;
    console.log('[TTS Cache] All responses already cached! 🎉');
    return;
  }

  // Generate in background, one at a time with delay
  let count = 0;
  for (const text of toGenerate) {
    if (!cacheStats.generating) {
      console.log('[TTS Cache] Pre-rendering stopped');
      break;
    }

    try {
      await generateAndCache(text);
      count++;
      cacheStats.queue = toGenerate.length - count;

      // Progress logging every 50
      if (count % 50 === 0) {
        const pct = Math.round((cacheStats.cached / cacheStats.total) * 100);
        console.log(`[TTS Cache] Progress: ${cacheStats.cached}/${cacheStats.total} (${pct}%) — ${cacheStats.queue} remaining`);
      }
    } catch (err) {
      // Skip failed ones, continue
    }

    // Small delay to not hog CPU
    await new Promise(r => setTimeout(r, delayMs));
  }

  cacheStats.generating = false;
  const pct = Math.round((cacheStats.cached / cacheStats.total) * 100);
  console.log(`[TTS Cache] Pre-rendering complete: ${cacheStats.cached}/${cacheStats.total} (${pct}%)`);
}

function stopPreRendering() {
  cacheStats.generating = false;
}

function getCacheStats() {
  return { ...cacheStats };
}

module.exports = { initCache, getCachedAudio, generateAndCache, startPreRendering, stopPreRendering, getCacheStats };
