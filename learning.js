/**
 * Marie Learns Between Shows
 *
 * After each stream, tracks which responses were used and which events
 * they were associated with (donations spikes, Greg's verbal approval, etc.)
 * Over time, weights better responses higher.
 *
 * Storage: data/learning.json
 */

const fs = require('fs');
const path = require('path');

const LEARNING_FILE = path.join(__dirname, 'data', 'learning.json');

let responseScores = {}; // { "response text hash": { uses: N, score: N } }
let sessionResponses = []; // Track responses used this session

function loadLearning() {
  try {
    const dir = path.dirname(LEARNING_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    if (fs.existsSync(LEARNING_FILE)) {
      responseScores = JSON.parse(fs.readFileSync(LEARNING_FILE, 'utf8'));
      console.log(`[Learning] Loaded scores for ${Object.keys(responseScores).length} responses`);
    }
  } catch { responseScores = {}; }
}

function saveLearning() {
  try {
    const dir = path.dirname(LEARNING_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(LEARNING_FILE, JSON.stringify(responseScores, null, 2));
  } catch (err) {
    console.warn('[Learning] Could not save:', err.message);
  }
}

/**
 * Hash a response for tracking (first 60 chars lowercase).
 */
function hashResponse(text) {
  return (text || '').toLowerCase().trim().substring(0, 60);
}

/**
 * Record that a response was used.
 */
function recordUse(responseText) {
  const hash = hashResponse(responseText);
  if (!responseScores[hash]) {
    responseScores[hash] = { uses: 0, score: 0, lastUsed: null };
  }
  responseScores[hash].uses++;
  responseScores[hash].lastUsed = new Date().toISOString();
  sessionResponses.push({ text: responseText, hash, time: Date.now() });
}

/**
 * Boost a response's score (called when Greg approves or donation follows).
 */
function boost(responseText, amount = 1) {
  const hash = hashResponse(responseText);
  if (!responseScores[hash]) {
    responseScores[hash] = { uses: 0, score: 0, lastUsed: null };
  }
  responseScores[hash].score += amount;
}

/**
 * Penalize a response (called when Greg says "Marie stop" right after).
 */
function penalize(responseText, amount = 1) {
  const hash = hashResponse(responseText);
  if (responseScores[hash]) {
    responseScores[hash].score -= amount;
  }
}

/**
 * Get score for a response (-Infinity to +Infinity, 0 = neutral).
 */
function getScore(responseText) {
  const hash = hashResponse(responseText);
  return responseScores[hash]?.score || 0;
}

/**
 * Sort a pool of responses by score (highest first).
 * Responses with no score get a small random value so they still appear.
 */
function rankResponses(pool) {
  return [...pool].sort((a, b) => {
    const sa = getScore(a) + Math.random() * 0.5; // Small jitter for variety
    const sb = getScore(b) + Math.random() * 0.5;
    return sb - sa;
  });
}

/**
 * End of session — save all learning data.
 */
function endSessionLearning() {
  saveLearning();
  const used = sessionResponses.length;
  sessionResponses = [];
  console.log(`[Learning] Session ended. ${used} responses tracked. ${Object.keys(responseScores).length} total scored.`);
}

/**
 * Boost the last few responses (called when a donation comes in —
 * means the audience liked what was happening).
 */
function boostRecentResponses(count = 3) {
  const recent = sessionResponses.slice(-count);
  for (const r of recent) {
    boost(r.text, 0.5);
  }
}

loadLearning();

module.exports = { recordUse, boost, penalize, getScore, rankResponses, endSessionLearning, boostRecentResponses };
