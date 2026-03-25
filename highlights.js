/**
 * Post-Show Highlights Reel
 *
 * Auto-generates a summary after each stream:
 * - Best Marie one-liners
 * - Worst claims
 * - Best donation messages
 * - Report card grades
 * - Conspiracy bingo results
 * - Mood arc
 */

const fs = require('fs');
const path = require('path');

const HIGHLIGHTS_DIR = path.join(__dirname, 'data', 'highlights');

/**
 * Generate highlights from a completed session.
 */
function generateHighlights(sessionData, reportCard, moodHistory, bingoBoard, credibilityHistory, graphData) {
  const highlights = {
    date: new Date().toISOString(),
    duration: sessionData.duration || 'unknown',

    // Report card
    challenger: {
      nickname: sessionData.nickname,
      nicknameHistory: sessionData.nicknameHistory || [],
      grade: reportCard?.grade || '?',
      gradeJoke: reportCard?.grade_joke || '',
      superlatives: reportCard?.superlatives || [],
      closer: reportCard?.closer || '',
    },

    // Stats
    stats: {
      claims: sessionData.claimCount || 0,
      debunked: sessionData.debunkedCount || 0,
      misleading: sessionData.misleadingCount || 0,
      loops: sessionData.loopBreakerCount || 0,
      momJokes: sessionData.momJokeCount || 0,
    },

    // Top claims (most repeated)
    topClaims: getTopClaims(sessionData.allClaims || []),

    // Mood arc
    moodArc: summarizeMoodArc(moodHistory || []),

    // Bingo results
    bingo: bingoBoard ? {
      hits: bingoBoard.totalHits,
      bingos: bingoBoard.bingoCount,
      hitTopics: bingoBoard.board?.flat().filter(c => c.hit && c.id !== 'free').map(c => c.label) || [],
    } : null,

    // Credibility final score
    credibility: credibilityHistory || null,

    // Conspiracy network
    conspiracyWeb: graphData ? {
      nodes: graphData.nodes?.length || 0,
      edges: graphData.edges?.length || 0,
      pipeline: graphData.sequence?.map(s => s.node).join(' → ') || '',
    } : null,
  };

  // Save to disk
  try {
    if (!fs.existsSync(HIGHLIGHTS_DIR)) fs.mkdirSync(HIGHLIGHTS_DIR, { recursive: true });
    const filename = `highlights-${new Date().toISOString().slice(0, 10)}-${Date.now()}.json`;
    fs.writeFileSync(path.join(HIGHLIGHTS_DIR, filename), JSON.stringify(highlights, null, 2));
    console.log(`[Highlights] Saved to ${filename}`);
  } catch (err) {
    console.warn('[Highlights] Could not save:', err.message);
  }

  return highlights;
}

function getTopClaims(claims) {
  const counts = {};
  for (const c of claims) {
    const key = c.toUpperCase();
    counts[key] = (counts[key] || 0) + 1;
  }
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([claim, count]) => ({ claim, count }));
}

function summarizeMoodArc(history) {
  if (history.length === 0) return 'No mood data';
  const moods = history.map(h => h.mood);
  const unique = [...new Set(moods)];
  const most = moods.sort((a, b) =>
    moods.filter(v => v === a).length - moods.filter(v => v === b).length
  ).pop();
  return {
    totalChanges: history.length,
    uniqueMoods: unique,
    dominantMood: most,
    arc: history.slice(0, 20).map(h => h.mood), // First 20 for summary
  };
}

/**
 * Generate a shareable text summary.
 */
function generateShareableText(highlights) {
  const h = highlights;
  const lines = [
    `🔬 DR. GREG DEBATES — SHOW RECAP`,
    ``,
    `🎭 Challenger: ${h.challenger.nickname}`,
    `📊 Grade: ${h.challenger.grade}`,
    `💬 "${h.challenger.gradeJoke}"`,
    ``,
    `📈 STATS:`,
    `Claims: ${h.stats.claims} | Debunked: ${h.stats.debunked} | Loops: ${h.stats.loops}`,
  ];

  if (h.bingo && h.bingo.bingos > 0) {
    lines.push(`🎯 CONSPIRACY BINGO: ${h.bingo.bingos} BINGO(S)!`);
  }

  if (h.conspiracyWeb && h.conspiracyWeb.nodes > 2) {
    lines.push(`🕸️ Conspiracy pipeline: ${h.conspiracyWeb.pipeline}`);
  }

  if (h.credibility) {
    lines.push(`📉 Final credibility: ${h.credibility.value}%`);
  }

  lines.push(``, `Watch live: @drgregshow`);
  return lines.join('\n');
}

module.exports = { generateHighlights, generateShareableText };
