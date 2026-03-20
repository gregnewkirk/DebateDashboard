// ===========================================
//  DEBATE DASHBOARD — App JS
//  WebSocket client + UI stubs + idle ticker
// ===========================================

const SCIENCE_FACTS = [
  "Octopuses have three hearts and blue blood",
  "A teaspoon of neutron star weighs 6 billion tons",
  "Bananas are naturally radioactive",
  "Honey never spoils — 3000-year-old honey is still edible",
  "Sound travels 4.3 times faster in water than in air",
  "Venus spins backwards compared to most planets",
  "Your body contains about 37.2 trillion cells",
  "Lightning is five times hotter than the surface of the sun",
  "Sharks existed before trees on Earth",
  "A day on Venus is longer than a year on Venus",
];

// --- WebSocket Connection ---
let ws = null;

function connectWebSocket() {
  ws = new WebSocket("ws://localhost:8080");

  ws.addEventListener("open", () => {
    console.log("[WS] Connected");
  });

  ws.addEventListener("message", (event) => {
    try {
      const msg = JSON.parse(event.data);
      switch (msg.type) {
        case "fact_check":
          showFactCard(msg);
          break;
        case "loop_breaker":
          showLoopBreaker(msg);
          break;
        default:
          console.log("[WS] Unknown message type:", msg.type);
      }
    } catch (err) {
      console.error("[WS] Failed to parse message:", err);
    }
  });

  ws.addEventListener("close", () => {
    console.log("[WS] Disconnected — reconnecting in 3s");
    setTimeout(connectWebSocket, 3000);
  });

  ws.addEventListener("error", (err) => {
    console.error("[WS] Error:", err);
  });
}

// --- Stub Functions (implemented in later tasks) ---

function showFactCard(data) {
  // TODO: Render a fact card with animations into #main-content
}

function showLoopBreaker(data) {
  // TODO: Render a loop breaker alert into #main-content
}

function startSpeechRecognition() {
  // TODO: Set up Web Speech API and listening indicator
}

// --- Idle Ticker ---
// NOTE: Uses innerHTML with hardcoded content only (no user input) — safe from XSS.

function startIdleTicker() {
  const track = document.querySelector(".ticker-track");
  if (!track) return;

  // Build ticker items using safe DOM methods
  for (let copy = 0; copy < 2; copy++) {
    SCIENCE_FACTS.forEach((fact) => {
      const span = document.createElement("span");
      span.textContent = fact;
      track.appendChild(span);
    });
  }

  // Apply the scrolling animation class
  track.classList.add("ticker-scroll");
}

// --- Init ---
document.addEventListener("DOMContentLoaded", () => {
  connectWebSocket();
  startIdleTicker();
});
