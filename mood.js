/**
 * Marie's Mood / Emotion State System
 *
 * Tracks Marie's emotional state throughout the show.
 * Her mood affects: response pool selection, TTS speed, avatar glow color,
 * and how she reacts to events.
 *
 * STATES:
 *   IDLE      → Show hasn't started, neutral energy
 *   BORED     → Nobody debating, gets progressively sarcastic
 *   HYPED     → New challenger joined or donation received
 *   FOCUSED   → Active debate, sharp and precise
 *   FRUSTRATED→ Same claim repeated, or challenger won't listen
 *   FURIOUS   → Anti-woman comment or egregious misinformation
 *   IMPRESSED → Rare: challenger makes a valid point
 *   VICTORIOUS→ Report card time, celebration mode
 *
 * Mood decays over time toward baseline (IDLE in solo, FOCUSED in debate).
 * Events push mood in specific directions.
 */

const MOODS = {
  IDLE:       { energy: 0.3, humor: 0.5, aggression: 0.1, color: '#FFD700', speed: 1.0,  label: 'IDLE' },
  BORED:     { energy: 0.2, humor: 0.7, aggression: 0.2, color: '#8888AA', speed: 0.95, label: 'BORED' },
  HYPED:     { energy: 0.9, humor: 0.6, aggression: 0.1, color: '#00FF88', speed: 1.1,  label: 'HYPED' },
  FOCUSED:   { energy: 0.6, humor: 0.3, aggression: 0.3, color: '#4488FF', speed: 1.0,  label: 'FOCUSED' },
  FRUSTRATED:{ energy: 0.7, humor: 0.4, aggression: 0.6, color: '#FF8800', speed: 1.05, label: 'FRUSTRATED' },
  FURIOUS:   { energy: 1.0, humor: 0.1, aggression: 0.9, color: '#FF0000', speed: 1.1,  label: 'FURIOUS' },
  IMPRESSED: { energy: 0.5, humor: 0.5, aggression: 0.0, color: '#00DDFF', speed: 0.95, label: 'IMPRESSED' },
  VICTORIOUS:{ energy: 1.0, humor: 0.8, aggression: 0.2, color: '#FFD700', speed: 1.05, label: 'VICTORIOUS' },
};

let currentMood = 'IDLE';
let moodHistory = []; // Track mood changes over the show
let lastMoodChange = Date.now();
let boredomTimer = null;
let debunkedStreak = 0;   // Consecutive debunked claims
let repeatedClaimCount = 0; // How many times the same topic repeats

// How long each mood lasts before decaying (ms)
const MOOD_DECAY = {
  HYPED: 30000,       // 30s of hype
  FRUSTRATED: 45000,  // 45s of frustration
  FURIOUS: 60000,     // 60s of fury (she holds grudges)
  IMPRESSED: 20000,   // 20s of being impressed (rare, fleeting)
  VICTORIOUS: 45000,  // 45s of victory lap
  BORED: null,        // Bored escalates, doesn't decay
};

let decayTimer = null;

/**
 * Set Marie's mood with logging and decay scheduling.
 */
function setMood(newMood, reason = '') {
  if (!MOODS[newMood]) return;
  const prev = currentMood;
  currentMood = newMood;
  lastMoodChange = Date.now();
  moodHistory.push({ mood: newMood, from: prev, reason, time: new Date().toISOString() });

  // Keep history manageable
  if (moodHistory.length > 100) moodHistory.shift();

  console.log(`[Mood] ${prev} → ${newMood} (${reason})`);

  // Schedule decay back to baseline
  if (decayTimer) clearTimeout(decayTimer);
  const decayMs = MOOD_DECAY[newMood];
  if (decayMs) {
    decayTimer = setTimeout(() => {
      const baseline = isDebateActive ? 'FOCUSED' : 'IDLE';
      setMood(baseline, 'mood decay');
    }, decayMs);
  }
}

let isDebateActive = false;

/**
 * Process events that affect mood.
 */
function processEvent(event) {
  switch (event.type) {
    case 'session_start':
      isDebateActive = true;
      debunkedStreak = 0;
      repeatedClaimCount = 0;
      setMood('HYPED', 'new challenger');
      stopBoredomEscalation();
      break;

    case 'session_end':
      isDebateActive = false;
      setMood('VICTORIOUS', 'session ended');
      startBoredomEscalation();
      break;

    case 'fact_check':
      const verdict = (event.verdict || '').toUpperCase();
      if (verdict === 'FALSE' || verdict === 'DEBUNKED') {
        debunkedStreak++;
        if (debunkedStreak >= 5) {
          setMood('FRUSTRATED', `${debunkedStreak} debunked in a row`);
        } else {
          setMood('FOCUSED', 'fact check delivered');
        }
      } else if (verdict === 'TRUE' || verdict === 'VALID') {
        debunkedStreak = 0;
        setMood('IMPRESSED', 'valid claim detected');
      } else {
        setMood('FOCUSED', 'fact check');
      }
      break;

    case 'loop_breaker':
      repeatedClaimCount++;
      if (repeatedClaimCount >= 3) {
        setMood('FURIOUS', `claim repeated ${repeatedClaimCount} times`);
      } else {
        setMood('FRUSTRATED', 'repeated claim');
      }
      break;

    case 'mom_joke':
      setMood('HYPED', 'mom joke pile-on');
      break;

    case 'payment':
      setMood('HYPED', `donation from ${event.name || 'someone'}`);
      break;

    case 'feminist_trigger':
      setMood('FURIOUS', 'anti-woman comment');
      break;

    case 'report_card':
      setMood('VICTORIOUS', 'report card reveal');
      break;

    case 'good_debate':
      setMood('IMPRESSED', 'good exchange');
      break;

    case 'silence':
      // Called when no activity for a while
      if (!isDebateActive && currentMood !== 'BORED') {
        setMood('BORED', 'extended silence');
      }
      break;
  }
}

/**
 * Boredom escalation — in solo mode, Marie gets progressively more bored.
 */
function startBoredomEscalation() {
  stopBoredomEscalation();
  boredomTimer = setInterval(() => {
    if (!isDebateActive && currentMood === 'IDLE') {
      setMood('BORED', 'nobody debating');
    }
  }, 120000); // Check every 2 minutes
}

function stopBoredomEscalation() {
  if (boredomTimer) {
    clearInterval(boredomTimer);
    boredomTimer = null;
  }
}

/**
 * Get current mood state for use by other systems.
 */
function getMood() {
  return {
    state: currentMood,
    ...MOODS[currentMood],
    since: lastMoodChange,
    sinceAgo: Math.floor((Date.now() - lastMoodChange) / 1000),
    debunkedStreak,
    repeatedClaimCount,
    isDebateActive,
  };
}

/**
 * Get mood history for post-show analysis.
 */
function getMoodHistory() {
  return moodHistory;
}

/**
 * Reset mood for new show.
 */
function resetMood() {
  currentMood = 'IDLE';
  moodHistory = [];
  debunkedStreak = 0;
  repeatedClaimCount = 0;
  isDebateActive = false;
  startBoredomEscalation();
}

// Start boredom escalation on load
startBoredomEscalation();

module.exports = { setMood, processEvent, getMood, getMoodHistory, resetMood, MOODS };
