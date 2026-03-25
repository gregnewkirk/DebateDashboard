/**
 * Dynamic Show Themes
 *
 * Visual theme shifts based on debate topics.
 * The board's color accent changes to match the dominant topic area.
 * Broadcast theme changes to the client for CSS variable updates.
 */

const THEMES = {
  default: {
    name: 'LIBERTY',
    accent: '#FFD700',
    bg: '#002868',
    glow: 'rgba(255,215,0,0.3)',
    description: 'Default patriotic theme',
  },
  medical: {
    name: 'CLINICAL',
    accent: '#00FF88',
    bg: '#002020',
    glow: 'rgba(0,255,136,0.3)',
    description: 'Vaccine/medical debates',
    triggers: ['vaccine', 'mrna', 'myocarditis', 'pharma', 'vaers', 'immunity', 'spike protein'],
  },
  space: {
    name: 'COSMOS',
    accent: '#4488FF',
    bg: '#000822',
    glow: 'rgba(68,136,255,0.3)',
    description: 'Flat earth / space / NASA debates',
    triggers: ['flat earth', 'nasa', 'moon landing', 'space', 'globe', 'stars'],
  },
  conspiracy: {
    name: 'RED ALERT',
    accent: '#FF4444',
    bg: '#1A0000',
    glow: 'rgba(255,68,68,0.3)',
    description: 'Deep conspiracy territory',
    triggers: ['illuminati', 'new world order', 'deep state', 'bill gates', 'graphene', '5g'],
  },
  nature: {
    name: 'ORGANIC',
    accent: '#88CC44',
    bg: '#0A1A00',
    glow: 'rgba(136,204,68,0.3)',
    description: 'GMO / food / environment debates',
    triggers: ['gmo', 'organic', 'food dyes', 'fluoride', 'terrain theory', 'natural'],
  },
  religion: {
    name: 'GENESIS',
    accent: '#CC88FF',
    bg: '#0A0022',
    glow: 'rgba(204,136,255,0.3)',
    description: 'Creationism / evolution debates',
    triggers: ['creationism', 'young earth', 'evolution', 'god created', 'bible', 'genesis'],
  },
  political: {
    name: 'CAPITOL',
    accent: '#FFFFFF',
    bg: '#1A0A0A',
    glow: 'rgba(255,255,255,0.2)',
    description: 'Political/mandate debates',
    triggers: ['mandate', 'freedom', 'rfk', 'maha', 'censorship', 'government', 'tyranny'],
  },
  science_edu: {
    name: 'AURORA',
    accent: '#FFE080',
    bg: '#0c0c22',
    glow: 'rgba(255,224,128,0.3)',
    description: 'Science education mode (from Dashboard)',
  },
};

let currentTheme = 'default';
let topicCounts = {}; // Track topic hits to determine dominant theme

/**
 * Process a claim and update theme if topic area shifts.
 */
function processClaimForTheme(claimText) {
  const lower = (claimText || '').toLowerCase();

  for (const [id, theme] of Object.entries(THEMES)) {
    if (id === 'default' || id === 'science_edu') continue;
    if (theme.triggers && theme.triggers.some(t => lower.includes(t))) {
      topicCounts[id] = (topicCounts[id] || 0) + 1;
    }
  }

  // Find dominant topic
  const dominant = Object.entries(topicCounts)
    .sort((a, b) => b[1] - a[1])[0];

  if (dominant && dominant[1] >= 2 && dominant[0] !== currentTheme) {
    const prev = currentTheme;
    currentTheme = dominant[0];
    console.log(`[Theme] ${prev} → ${currentTheme} (${THEMES[currentTheme].name})`);
    return { changed: true, theme: currentTheme, ...THEMES[currentTheme] };
  }

  return { changed: false, theme: currentTheme, ...THEMES[currentTheme] };
}

function setTheme(themeId) {
  if (THEMES[themeId]) {
    currentTheme = themeId;
    return THEMES[themeId];
  }
  return null;
}

function getCurrentTheme() {
  return { id: currentTheme, ...THEMES[currentTheme] };
}

function resetTheme() {
  currentTheme = 'default';
  topicCounts = {};
}

module.exports = { processClaimForTheme, setTheme, getCurrentTheme, resetTheme, THEMES };
