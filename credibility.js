/**
 * Live Credibility Meter
 *
 * Visual gauge that starts at 50% for each challenger.
 * Drops with debunked/false claims, rises slightly with valid points.
 * Marie comments on the meter level.
 */

let credibility = 50; // 0-100
let history = []; // Track all changes

const COMMENTS = {
  critical: [ // 0-10
    "Credibility has flatlined. Somebody call the scientific method.",
    "We're in negative territory if that were possible.",
    "I've seen more credibility in a fortune cookie.",
    "Rock bottom called. It wants its record back.",
    "Credibility level: absolute zero. Fitting, really.",
  ],
  low: [ // 11-25
    "Credibility just dropped below room temperature.",
    "Sinking faster than a lead balloon in a vacuum.",
    "If credibility were a stock, this would be a crash.",
    "Getting dangerously close to flat earth territory.",
    "The meter is begging for mercy at this point.",
  ],
  shaky: [ // 26-40
    "Credibility is wobbling. One more debunk and it's over.",
    "Hanging on by a thread. A very thin, unreviewed thread.",
    "Not great, not terrible. Actually, pretty terrible.",
    "The meter says 'proceed with extreme skepticism.'",
  ],
  neutral: [ // 41-60
    "Middle of the road. Could go either way.",
    "Neutral zone. Let's see some evidence.",
    "Perfectly balanced. As all debates should start.",
  ],
  decent: [ // 61-75
    "Okay, that's a decent point. The meter approves.",
    "Credibility climbing. Someone's been reading actual journals.",
    "Color me slightly impressed. The meter moved up.",
  ],
  strong: [ // 76-100 (almost never happens)
    "I'm genuinely impressed. This doesn't happen often.",
    "The meter is in uncharted territory. Actual good arguments.",
    "Mark this day. A challenger with credibility above 75.",
  ],
};

function resetCredibility() {
  credibility = 50;
  history = [];
  return credibility;
}

function adjustCredibility(delta, reason = '') {
  const prev = credibility;
  credibility = Math.max(0, Math.min(100, credibility + delta));
  history.push({
    from: prev,
    to: credibility,
    delta,
    reason,
    time: new Date().toISOString(),
  });
  return credibility;
}

function processClaimResult(verdict) {
  const v = (verdict || '').toUpperCase();
  if (v === 'FALSE' || v === 'DEBUNKED') {
    return adjustCredibility(-12, `Claim debunked`);
  } else if (v === 'MISLEADING') {
    return adjustCredibility(-7, `Misleading claim`);
  } else if (v === 'TRUE' || v === 'VALID') {
    return adjustCredibility(+5, `Valid point`);
  }
  return credibility;
}

function processLoopBreaker() {
  return adjustCredibility(-15, 'Repeated debunked claim');
}

function getCredibility() {
  return {
    value: credibility,
    tier: getTier(),
    history,
  };
}

function getTier() {
  if (credibility <= 10) return 'critical';
  if (credibility <= 25) return 'low';
  if (credibility <= 40) return 'shaky';
  if (credibility <= 60) return 'neutral';
  if (credibility <= 75) return 'decent';
  return 'strong';
}

function getCredibilityComment() {
  const tier = getTier();
  const pool = COMMENTS[tier] || COMMENTS.neutral;
  return pool[Math.floor(Math.random() * pool.length)];
}

module.exports = { resetCredibility, adjustCredibility, processClaimResult, processLoopBreaker, getCredibility, getCredibilityComment };
