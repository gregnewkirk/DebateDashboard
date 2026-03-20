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
  const SpeechRecognition =
    window.SpeechRecognition || window.webkitSpeechRecognition;

  if (!SpeechRecognition) {
    console.warn("[Speech] Web Speech API not supported in this browser");
    return;
  }

  const recognition = new SpeechRecognition();
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.lang = "en-US";

  const indicator = document.getElementById("listening-indicator");
  let transcriptBuffer = "";
  let flushTimer = null;

  function flushBuffer() {
    if (!transcriptBuffer.trim()) return;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: "transcript", text: transcriptBuffer.trim() }));
      console.log("[Speech] Sent transcript chunk:", transcriptBuffer.trim().slice(0, 80));
    }
    transcriptBuffer = "";
  }

  function scheduleFlush() {
    if (flushTimer) return;
    flushTimer = setTimeout(() => {
      flushTimer = null;
      flushBuffer();
    }, 10000);
  }

  function maybeFlush() {
    const wordCount = transcriptBuffer.trim().split(/\s+/).filter(Boolean).length;
    if (wordCount >= 20) {
      if (flushTimer) {
        clearTimeout(flushTimer);
        flushTimer = null;
      }
      flushBuffer();
    } else {
      scheduleFlush();
    }
  }

  recognition.addEventListener("result", (event) => {
    for (let i = event.resultIndex; i < event.results.length; i++) {
      if (event.results[i].isFinal) {
        transcriptBuffer += event.results[i][0].transcript + " ";
        maybeFlush();
      }
    }
  });

  recognition.addEventListener("error", (event) => {
    console.error("[Speech] Error:", event.error);
    if (indicator) indicator.classList.remove("active");
    // Attempt restart on recoverable errors
    if (event.error !== "not-allowed" && event.error !== "service-not-allowed") {
      setTimeout(() => {
        try {
          recognition.start();
        } catch (e) {
          console.error("[Speech] Restart after error failed:", e);
        }
      }, 1000);
    }
  });

  recognition.addEventListener("end", () => {
    console.log("[Speech] Recognition ended — restarting");
    if (indicator) indicator.classList.remove("active");
    // Flush any remaining text before restart
    flushBuffer();
    setTimeout(() => {
      try {
        recognition.start();
      } catch (e) {
        console.error("[Speech] Restart failed:", e);
      }
    }, 500);
  });

  recognition.addEventListener("start", () => {
    console.log("[Speech] Recognition started");
    if (indicator) indicator.classList.add("active");
  });

  try {
    recognition.start();
  } catch (e) {
    console.error("[Speech] Initial start failed:", e);
  }
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
  startSpeechRecognition();
});
