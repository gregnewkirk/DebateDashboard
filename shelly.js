const SHELLY_IP = process.env.SHELLY_IP || '192.168.1.100';

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function flashLight(times = 3, intervalMs = 300) {
  try {
    for (let i = 0; i < times; i++) {
      await fetch(`http://${SHELLY_IP}/relay/0?turn=on`);
      await sleep(intervalMs);
      await fetch(`http://${SHELLY_IP}/relay/0?turn=off`);
      await sleep(intervalMs);
    }
    // Leave light on after flashing
    await fetch(`http://${SHELLY_IP}/relay/0?turn=on`);
  } catch (err) {
    console.warn('[Shelly] Failed to flash light:', err.message);
  }
}

module.exports = { flashLight };
