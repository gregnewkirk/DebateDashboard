/**
 * Repetition Detector / Loop Breaker
 *
 * Tracks keyword frequency over a sliding 2-minute window to detect
 * when debate topics are going in circles.
 */

const WINDOW_MS = 120000; // 2 minutes
const LOOP_THRESHOLD = 3;

// Topic keyword groups (all lowercase)
const TOPIC_KEYWORDS = [
  // Vaccines
  'vaccine', 'vaccines', 'vaxxed', 'vax', 'immunization', 'jab',
  // Autism
  'autism', 'autistic',
  // Evolution
  'evolution', 'evolve', 'darwin', 'natural selection', 'species',
  // Climate
  'climate', 'warming', 'carbon', 'co2', 'greenhouse', 'fossil fuel',
  // COVID
  'covid', 'coronavirus', 'pandemic', 'lockdown', 'mask', 'masks',
  // GMO
  'gmo', 'gmos', 'genetically modified', 'monsanto', 'organic',
  // General anti-science
  'toxin', 'toxins', 'natural', 'chemical', 'chemicals', 'big pharma', 'pharma', 'conspiracy',
];

// Separate single-word and multi-word keywords for matching
const MULTI_WORD_KEYWORDS = TOPIC_KEYWORDS.filter(k => k.includes(' '));
const SINGLE_WORD_KEYWORDS = TOPIC_KEYWORDS.filter(k => !k.includes(' '));

// Map of keyword -> [timestamp, timestamp, ...]
const keywordTimestamps = new Map();

/**
 * Extract matching keywords from text.
 */
function extractKeywords(text) {
  const lower = text.toLowerCase();
  const found = new Set();

  // Check multi-word keywords first (phrase matching)
  for (const phrase of MULTI_WORD_KEYWORDS) {
    if (lower.includes(phrase)) {
      found.add(phrase);
    }
  }

  // Check single-word keywords
  const words = lower.split(/\s+/).map(w => w.replace(/[^a-z0-9]/g, ''));
  for (const word of words) {
    if (word && SINGLE_WORD_KEYWORDS.includes(word)) {
      found.add(word);
    }
  }

  return Array.from(found);
}

/**
 * Prune timestamps older than the sliding window.
 */
function pruneOld(now) {
  const cutoff = now - WINDOW_MS;
  for (const [keyword, timestamps] of keywordTimestamps) {
    const filtered = timestamps.filter(t => t > cutoff);
    if (filtered.length === 0) {
      keywordTimestamps.delete(keyword);
    } else {
      keywordTimestamps.set(keyword, filtered);
    }
  }
}

/**
 * Track a transcript chunk for keyword repetition.
 * @param {string} text - The transcript text to analyze
 * @returns {{ isLoop: boolean, loopKeyword: string | null, count: number }}
 */
function trackTranscript(text) {
  const now = Date.now();
  const keywords = extractKeywords(text);

  // Record timestamps for found keywords
  for (const kw of keywords) {
    if (!keywordTimestamps.has(kw)) {
      keywordTimestamps.set(kw, []);
    }
    keywordTimestamps.get(kw).push(now);
  }

  // Prune old entries
  pruneOld(now);

  // Check for loops
  let loopKeyword = null;
  let maxCount = 0;

  for (const [keyword, timestamps] of keywordTimestamps) {
    if (timestamps.length >= LOOP_THRESHOLD && timestamps.length > maxCount) {
      maxCount = timestamps.length;
      loopKeyword = keyword;
    }
  }

  return {
    isLoop: loopKeyword !== null,
    loopKeyword,
    count: maxCount,
  };
}

/**
 * Get all active keywords in the current window (for debugging).
 * @returns {string[]}
 */
function getRecentKeywords() {
  pruneOld(Date.now());
  return Array.from(keywordTimestamps.keys());
}

module.exports = { trackTranscript, getRecentKeywords };
