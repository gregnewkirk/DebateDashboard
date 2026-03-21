/**
 * Session State Manager
 *
 * Tracks session lifecycle, events, and statistics for
 * timestamp logging and report cards.
 */

let session = createFreshSession();

function createFreshSession() {
  return {
    active: false,
    startTime: null,
    endTime: null,
    nickname: "CHALLENGER",
    nicknameHistory: ["CHALLENGER"],
    events: [],
    claimCount: 0,
    debunkedCount: 0,
    misleadingCount: 0,
    loopBreakerCount: 0,
    momJokeCount: 0,
    repeatedTopics: {},
    allClaims: [],
  };
}

function startSession() {
  session = createFreshSession();
  session.active = true;
  session.startTime = Date.now();
  return session;
}

function endSession() {
  session.active = false;
  session.endTime = Date.now();
  return session;
}

function getSession() {
  return session;
}

function isActive() {
  return session.active;
}

function logEvent(event) {
  const entry = {
    ...event,
    time_seconds: getElapsedSeconds(),
  };
  session.events.push(entry);
  return entry;
}

function getElapsedSeconds() {
  if (!session.startTime) return 0;
  return Math.round((Date.now() - session.startTime) / 1000);
}

function updateNickname(name) {
  session.nickname = name;
  session.nicknameHistory.push(name);
}

function incrementStat(statName) {
  if (typeof session[statName] === 'number') {
    session[statName]++;
  }
}

module.exports = {
  startSession,
  endSession,
  getSession,
  isActive,
  logEvent,
  getElapsedSeconds,
  updateNickname,
  incrementStat,
};
