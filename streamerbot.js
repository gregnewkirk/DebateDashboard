const WebSocket = require('ws');

const STREAMERBOT_PORT = process.env.STREAMERBOT_PORT || 8081;
const RECONNECT_DELAY = 5000;

let ws = null;
let connected = false;

function connect() {
  try {
    ws = new WebSocket(`ws://localhost:${STREAMERBOT_PORT}`);

    ws.on('open', () => {
      connected = true;
      console.log(`[Streamer.bot] Connected on port ${STREAMERBOT_PORT}`);
    });

    ws.on('close', () => {
      connected = false;
      console.warn('[Streamer.bot] Disconnected. Reconnecting in 5s...');
      setTimeout(connect, RECONNECT_DELAY);
    });

    ws.on('error', (err) => {
      connected = false;
      console.warn(`[Streamer.bot] Connection error: ${err.message}`);
      // 'close' event will fire after error, triggering reconnect
    });
  } catch (err) {
    console.warn(`[Streamer.bot] Failed to connect: ${err.message}`);
    setTimeout(connect, RECONNECT_DELAY);
  }
}

async function sendAction(actionName, args = {}) {
  try {
    if (!connected || !ws || ws.readyState !== WebSocket.OPEN) {
      return;
    }
    const payload = JSON.stringify({
      request: 'DoAction',
      action: { name: actionName },
      args: args,
    });
    ws.send(payload);
    console.log(`[Streamer.bot] Sent action: ${actionName}`);
  } catch (err) {
    console.warn(`[Streamer.bot] Failed to send action ${actionName}: ${err.message}`);
  }
}

async function onFactCheck(data) {
  try {
    await sendAction('DebunkAlert', { claim: data.claim, verdict: data.verdict });
  } catch (err) {
    console.warn(`[Streamer.bot] onFactCheck error: ${err.message}`);
  }
}

async function onLoopBreaker(data) {
  try {
    await sendAction('LoopBreakerAlert', { keyword: data.loopKeyword });
  } catch (err) {
    console.warn(`[Streamer.bot] onLoopBreaker error: ${err.message}`);
  }
}

async function onMomJoke(data) {
  try {
    await sendAction('MomJokeAlert', { count: data.count || 1 });
  } catch (err) {
    console.warn(`[Streamer.bot] onMomJoke error: ${err.message}`);
  }
}

async function onPayment(data) {
  try {
    await sendAction('PaymentAlert', { source: data.source, name: data.name, amount: data.amount });
  } catch (err) {
    console.warn(`[Streamer.bot] onPayment error: ${err.message}`);
  }
}

async function onSessionStart() {
  try {
    await sendAction('SessionStart', {});
  } catch (err) {
    console.warn(`[Streamer.bot] onSessionStart error: ${err.message}`);
  }
}

async function onSessionEnd(data) {
  try {
    await sendAction('SessionEnd', { nickname: data.nickname, grade: data.grade });
  } catch (err) {
    console.warn(`[Streamer.bot] onSessionEnd error: ${err.message}`);
  }
}

async function onReportCard(data) {
  try {
    await sendAction('ReportCardReveal', { grade: data.grade, nickname: data.nickname });
  } catch (err) {
    console.warn(`[Streamer.bot] onReportCard error: ${err.message}`);
  }
}

// Auto-connect on module load
connect();

module.exports = {
  sendAction,
  onFactCheck,
  onLoopBreaker,
  onMomJoke,
  onPayment,
  onSessionStart,
  onSessionEnd,
  onReportCard,
};
