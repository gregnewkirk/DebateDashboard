const SHELLY_IP = process.env.SHELLY_IP || '192.168.1.100';
const SHELLY_IP_PAYMENTS = process.env.SHELLY_IP_PAYMENTS || '192.168.1.101';

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

async function flashPaymentLight(times = 5, intervalMs = 200) {
  // Same pattern but uses SHELLY_IP_PAYMENTS
  // More flashes, faster interval — celebratory feel
  try {
    for (let i = 0; i < times; i++) {
      await fetch(`http://${SHELLY_IP_PAYMENTS}/relay/0?turn=on`);
      await sleep(intervalMs);
      await fetch(`http://${SHELLY_IP_PAYMENTS}/relay/0?turn=off`);
      await sleep(intervalMs);
    }
    await fetch(`http://${SHELLY_IP_PAYMENTS}/relay/0?turn=on`);
  } catch (err) {
    console.warn('[Shelly] Payment light flash failed:', err.message);
  }
}

async function flashAllLights() {
  // Flash BOTH lights simultaneously — for report card finale
  await Promise.all([flashLight(5, 200), flashPaymentLight(5, 200)]);
}

module.exports = { flashLight, flashPaymentLight, flashAllLights };
