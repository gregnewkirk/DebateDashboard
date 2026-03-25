/**
 * Challenger System — Entrances, Memory, Hall of Shame
 *
 * - Wrestling-style entrance announcements for new challengers
 * - Persistent memory of past challengers (stored to disk)
 * - Hall of Shame leaderboard
 */

const fs = require('fs');
const path = require('path');

const HALL_FILE = path.join(__dirname, 'data', 'hall_of_shame.json');

// ============================================================
// HALL OF SHAME — Persistent memory
// ============================================================

let hallOfShame = [];

function loadHall() {
  try {
    const dir = path.dirname(HALL_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    if (fs.existsSync(HALL_FILE)) {
      hallOfShame = JSON.parse(fs.readFileSync(HALL_FILE, 'utf8'));
      console.log(`[Challenger] Hall of Shame loaded: ${hallOfShame.length} past challengers`);
    }
  } catch { hallOfShame = []; }
}

function saveHall() {
  try {
    const dir = path.dirname(HALL_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(HALL_FILE, JSON.stringify(hallOfShame, null, 2));
  } catch (err) {
    console.warn('[Challenger] Could not save hall:', err.message);
  }
}

/**
 * Record a completed session to the Hall of Shame.
 */
function recordSession(sessionData, reportCard) {
  const entry = {
    nickname: sessionData.nickname,
    nicknameHistory: sessionData.nicknameHistory || [],
    date: new Date().toISOString(),
    claims: sessionData.claimCount || 0,
    debunked: sessionData.debunkedCount || 0,
    misleading: sessionData.misleadingCount || 0,
    loops: sessionData.loopBreakerCount || 0,
    momJokes: sessionData.momJokeCount || 0,
    grade: reportCard?.grade || '?',
    allClaims: sessionData.allClaims || [],
  };
  hallOfShame.push(entry);
  saveHall();
  console.log(`[Challenger] Recorded: ${entry.nickname} (Grade: ${entry.grade})`);
  return entry;
}

/**
 * Check if a challenger has appeared before (by claim similarity).
 */
function findReturningChallenger(claims) {
  if (!claims || claims.length === 0) return null;
  const claimSet = new Set(claims.map(c => c.toLowerCase()));

  let bestMatch = null;
  let bestOverlap = 0;

  for (const past of hallOfShame) {
    const pastSet = new Set((past.allClaims || []).map(c => c.toLowerCase()));
    let overlap = 0;
    for (const c of claimSet) {
      if (pastSet.has(c)) overlap++;
    }
    if (overlap >= 2 && overlap > bestOverlap) {
      bestOverlap = overlap;
      bestMatch = past;
    }
  }

  return bestMatch;
}

function getHallOfShame() {
  return [...hallOfShame].sort((a, b) => b.debunked - a.debunked);
}

/**
 * Find a challenger by name/handle (Greg says their TikTok name at the start).
 */
function findByName(name) {
  if (!name) return null;
  const lower = name.toLowerCase().trim();
  return hallOfShame.find(entry => {
    const names = [
      entry.nickname,
      ...(entry.nicknameHistory || []),
      entry.tiktokName,
    ].filter(Boolean).map(n => n.toLowerCase());
    return names.some(n => n.includes(lower) || lower.includes(n));
  }) || null;
}

/**
 * Set TikTok name for current session (extracted from Greg's greeting).
 */
let currentTikTokName = null;
function setTikTokName(name) {
  currentTikTokName = name;
  console.log(`[Challenger] TikTok name set: ${name}`);
  const past = findByName(name);
  if (past) {
    console.log(`[Challenger] RETURNING! Last grade: ${past.grade}, ${past.debunked} debunked`);
  }
  return past;
}

function getTikTokName() { return currentTikTokName; }

function getWorstEver() {
  if (hallOfShame.length === 0) return null;
  return hallOfShame.reduce((worst, entry) =>
    entry.debunked > (worst?.debunked || 0) ? entry : worst, null);
}

// ============================================================
// ENTRANCE GENERATOR — Wrestling-style intros
// ============================================================

const ENTRANCE_INTROS = [
  "Ladies and gentlemen, entering the arena...",
  "From the depths of a YouTube comment section...",
  "Making their TikTok debut tonight...",
  "Straight from the algorithm's darkest corner...",
  "Back by absolutely nobody's request...",
  "With a search history longer than their attention span...",
  "Armed with nothing but confirmation bias...",
  "Fresh from a 3-hour documentary binge...",
  "Stepping up with the confidence of someone who's never read an abstract...",
  "Hold onto your peer-reviewed studies, folks...",
  "They asked for the mic. They might regret that...",
  "The comment section has produced a challenger!",
  "Someone brave enough to debate a molecular biologist live...",
  "In the red corner, weighing in with zero citations...",
  "They say they've done their own research. Let's test that...",
];

const ENTRANCE_CLOSERS = [
  "Let the debunking begin!",
  "May the facts be ever in our favor.",
  "Marie, warm up the fact-checker.",
  "Science is about to get personal.",
  "The board is ready. The facts are loaded.",
  "Another brave soul steps into the arena of truth.",
  "This should be educational. For someone.",
  "Greg, you ready for this?",
  "The credibility meter starts at 50. Let's see how fast it drops.",
  "Conspiracy bingo cards ready, everyone!",
];

/**
 * Generate a wrestling-style entrance for a new challenger.
 */
function generateEntrance(nickname, firstClaim = null) {
  const intro = ENTRANCE_INTROS[Math.floor(Math.random() * ENTRANCE_INTROS.length)];
  const closer = ENTRANCE_CLOSERS[Math.floor(Math.random() * ENTRANCE_CLOSERS.length)];

  let middle = `Give it up for... ${nickname}!`;
  if (firstClaim) {
    middle = `Someone who thinks ${firstClaim.toLowerCase()}... Give it up for... ${nickname}!`;
  }

  // Check if returning challenger
  const returning = findReturningChallenger(firstClaim ? [firstClaim] : []);
  if (returning) {
    middle = `Oh look who's back! ${returning.nickname} got an ${returning.grade} last time. Let's see if they've improved. Now going by... ${nickname}!`;
  }

  return {
    intro,
    middle,
    closer,
    full: `${intro} ${middle} ${closer}`,
    isReturning: !!returning,
    pastRecord: returning,
  };
}

// Load hall on startup
loadHall();

module.exports = { generateEntrance, recordSession, findReturningChallenger, findByName, setTikTokName, getTikTokName, getHallOfShame, getWorstEver };
