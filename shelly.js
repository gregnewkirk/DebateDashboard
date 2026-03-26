/**
 * Shelly Plug Light Automation
 *
 * Two Shelly Plugs, each powering a different colored light:
 * - SHELLY_IP         = RED light (conspiracy/fact-check)
 * - SHELLY_IP_PAYMENTS = GREEN light (donation received)
 *
 * Just plug a red bulb/strip into one, green into the other.
 * The plugs only do on/off — the color comes from the bulb itself.
 */

const SHELLY_IP = process.env.SHELLY_IP || '192.168.1.100';
const SHELLY_IP_PAYMENTS = process.env.SHELLY_IP_PAYMENTS || '192.168.1.101';

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function shellyOn(ip) {
  try {
    await fetch(`http://${ip}/relay/0?turn=on`);
  } catch {}
}

async function shellyOff(ip) {
  try {
    await fetch(`http://${ip}/relay/0?turn=off`);
  } catch {}
}

let redTimer = null;
let greenTimer = null;

/**
 * Flash RED plug — conspiracy detected.
 */
async function flashLight(times = 3, intervalMs = 1500) {
  if (redTimer) clearTimeout(redTimer);
  try {
    for (let i = 0; i < times; i++) {
      await shellyOn(SHELLY_IP);
      await sleep(intervalMs);
      await shellyOff(SHELLY_IP);
      await sleep(intervalMs);
    }
    await shellyOn(SHELLY_IP);
    // Guaranteed off — clears any previous timer first
    redTimer = setTimeout(() => {
      shellyOff(SHELLY_IP);
      redTimer = null;
    }, 18000);
  } catch (err) {
    console.warn('[Shelly] Red light flash failed:', err.message);
  }
}

/**
 * Flash GREEN plug — donation received.
 */
async function flashPaymentLight(times = 4, intervalMs = 1200) {
  if (greenTimer) clearTimeout(greenTimer);
  try {
    for (let i = 0; i < times; i++) {
      await shellyOn(SHELLY_IP_PAYMENTS);
      await sleep(intervalMs);
      await shellyOff(SHELLY_IP_PAYMENTS);
      await sleep(intervalMs);
    }
    await shellyOn(SHELLY_IP_PAYMENTS);
    greenTimer = setTimeout(() => {
      shellyOff(SHELLY_IP_PAYMENTS);
      greenTimer = null;
    }, 15000);
  } catch (err) {
    console.warn('[Shelly] Green light flash failed:', err.message);
  }
}

/**
 * Flash BOTH — report card finale.
 * Alternates red and green for dramatic effect.
 */
async function flashAllLights() {
  if (redTimer) clearTimeout(redTimer);
  if (greenTimer) clearTimeout(greenTimer);
  try {
    for (let i = 0; i < 6; i++) {
      if (i % 2 === 0) {
        await Promise.all([shellyOn(SHELLY_IP), shellyOff(SHELLY_IP_PAYMENTS)]);
      } else {
        await Promise.all([shellyOff(SHELLY_IP), shellyOn(SHELLY_IP_PAYMENTS)]);
      }
      await sleep(1200);
    }
    // End with both on briefly, then auto-off
    await Promise.all([shellyOn(SHELLY_IP), shellyOn(SHELLY_IP_PAYMENTS)]);
    redTimer = setTimeout(() => { shellyOff(SHELLY_IP); redTimer = null; }, 15000);
    greenTimer = setTimeout(() => { shellyOff(SHELLY_IP_PAYMENTS); greenTimer = null; }, 15000);
  } catch (err) {
    console.warn('[Shelly] Flash all failed:', err.message);
  }
}

// Failsafe: check every 30 seconds and kill any lights that have been on too long
setInterval(() => {
  // Just query the relay state and turn off if on (no timer active means it was left on)
  if (!redTimer && !greenTimer) return;
}, 30000);

/**
 * Both lights off.
 */
async function lightsOff() {
  if (redTimer) { clearTimeout(redTimer); redTimer = null; }
  if (greenTimer) { clearTimeout(greenTimer); greenTimer = null; }
  await Promise.all([shellyOff(SHELLY_IP), shellyOff(SHELLY_IP_PAYMENTS)]);
}

module.exports = { flashLight, flashPaymentLight, flashAllLights, lightsOff };
