/**
 * Session State Manager
 *
 * Tracks session lifecycle, events, and statistics for
 * timestamp logging and report cards.
 */

const fs = require('fs');
const path = require('path');

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

function saveSessionLog(sessionData, reportCard) {
  const logsDir = path.join(__dirname, 'logs');
  fs.mkdirSync(logsDir, { recursive: true });

  const startDate = new Date(sessionData.startTime);
  const endDate = new Date(sessionData.endTime);
  const durationSeconds = Math.round((sessionData.endTime - sessionData.startTime) / 1000);

  // Format timestamp for filename: YYYY-MM-DD-HH-MM-SS
  const pad = (n) => String(n).padStart(2, '0');
  const ts = `${startDate.getFullYear()}-${pad(startDate.getMonth() + 1)}-${pad(startDate.getDate())}-${pad(startDate.getHours())}-${pad(startDate.getMinutes())}-${pad(startDate.getSeconds())}`;

  // Find most repeated topic
  let mostRepeatedTopic = { keyword: 'none', count: 0 };
  for (const [keyword, count] of Object.entries(sessionData.repeatedTopics)) {
    if (count > mostRepeatedTopic.count) {
      mostRepeatedTopic = { keyword, count };
    }
  }

  const logData = {
    session_id: `${startDate.getFullYear()}-${pad(startDate.getMonth() + 1)}-${pad(startDate.getDate())}T${pad(startDate.getHours())}-${pad(startDate.getMinutes())}-${pad(startDate.getSeconds())}`,
    start_time: startDate.toISOString(),
    end_time: endDate.toISOString(),
    duration_seconds: durationSeconds,
    opponent_nickname: sessionData.nickname,
    nickname_history: sessionData.nicknameHistory,
    events: sessionData.events,
    stats: {
      claims_detected: sessionData.claimCount,
      debunked: sessionData.debunkedCount,
      misleading: sessionData.misleadingCount,
      loop_breakers: sessionData.loopBreakerCount,
      mom_jokes: sessionData.momJokeCount,
      most_repeated_topic: mostRepeatedTopic,
    },
  };

  if (reportCard) {
    logData.report_card = reportCard;
  }

  const filename = `session-${ts}.json`;
  const filePath = path.join(logsDir, filename);
  fs.writeFileSync(filePath, JSON.stringify(logData, null, 2));

  return filename;
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
  saveSessionLog,
};
