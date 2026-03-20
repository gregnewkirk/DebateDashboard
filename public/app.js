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
  const container = document.getElementById("main-content");
  if (!container) return;

  // Clear any existing card
  container.innerHTML = "";

  // Create card
  const card = document.createElement("div");
  card.className = "fact-card";

  const claimEl = document.createElement("div");
  claimEl.className = "claim";
  claimEl.textContent = data.claim || "";

  const verdictEl = document.createElement("div");
  verdictEl.className = "verdict";
  verdictEl.textContent = data.verdict || "";
  verdictEl.style.opacity = "0";

  const factEl = document.createElement("div");
  factEl.className = "fact-text";
  factEl.textContent = data.fact || "";
  factEl.style.opacity = "0";

  const humorEl = document.createElement("div");
  humorEl.className = "humor";
  humorEl.textContent = data.humor || "";
  humorEl.style.opacity = "0";

  card.appendChild(claimEl);
  card.appendChild(verdictEl);
  card.appendChild(factEl);
  card.appendChild(humorEl);

  // Add card with slide-in
  card.classList.add("slide-in");
  container.appendChild(card);

  // Staggered animations
  setTimeout(() => {
    verdictEl.style.opacity = "";
    verdictEl.classList.add("slam-in");
  }, 300);

  setTimeout(() => {
    factEl.style.opacity = "";
    factEl.classList.add("bounce-in");
  }, 600);

  setTimeout(() => {
    humorEl.style.opacity = "";
    humorEl.classList.add("bounce-in");
  }, 900);

  // Fade out after 18 seconds
  setTimeout(() => {
    card.classList.add("fade-out");
    // Remove from DOM after fade-out completes (1s)
    setTimeout(() => {
      if (card.parentNode) {
        card.parentNode.removeChild(card);
      }
    }, 1000);
  }, 18000);
}

function showLoopBreaker(data) {
  const container = document.getElementById("main-content");
  if (!container) return;

  // Clear any existing card
  container.innerHTML = "";

  // Create card
  const card = document.createElement("div");
  card.className = "loop-breaker";

  const headerEl = document.createElement("div");
  headerEl.className = "loop-header";
  headerEl.textContent = "\uD83D\uDD01 BROKEN RECORD ALERT";

  const claimEl = document.createElement("div");
  claimEl.className = "claim";
  claimEl.textContent = data.claim || "";

  const verdictEl = document.createElement("div");
  verdictEl.className = "verdict";
  verdictEl.textContent = data.verdict || "";
  verdictEl.style.opacity = "0";

  const factEl = document.createElement("div");
  factEl.className = "fact-text";
  factEl.textContent = data.fact || "";
  factEl.style.opacity = "0";

  const humorEl = document.createElement("div");
  humorEl.className = "humor";
  humorEl.textContent = data.humor || "";
  humorEl.style.opacity = "0";

  card.appendChild(headerEl);
  card.appendChild(claimEl);
  card.appendChild(verdictEl);
  card.appendChild(factEl);
  card.appendChild(humorEl);

  // Add card with slide-in and shake
  card.classList.add("slide-in", "shake");
  container.appendChild(card);

  // Staggered animations
  setTimeout(() => {
    verdictEl.style.opacity = "";
    verdictEl.classList.add("slam-in");
  }, 300);

  setTimeout(() => {
    factEl.style.opacity = "";
    factEl.classList.add("bounce-in");
  }, 600);

  setTimeout(() => {
    humorEl.style.opacity = "";
    humorEl.classList.add("bounce-in");
  }, 900);

  // Fade out after 22 seconds
  setTimeout(() => {
    card.classList.add("fade-out");
    // Remove from DOM after fade-out completes (1s)
    setTimeout(() => {
      if (card.parentNode) {
        card.parentNode.removeChild(card);
      }
    }, 1000);
  }, 22000);
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

// --- Debug Keyboard Shortcuts ---
document.addEventListener("keydown", (e) => {
  if (e.key === "d" || e.key === "D") {
    showFactCard({
      claim: "VACCINES CAUSE AUTISM",
      verdict: "FALSE. EXPOSED.",
      fact: "1.2M kids studied. Zero link found.",
      humor: "Correlation \u2260 causation. Unless you\u2019re a Facebook researcher.",
      humor_style: "sarcastic"
    });
  }
  if (e.key === "l" || e.key === "L") {
    showLoopBreaker({
      claim: "NATURAL IMMUNITY",
      verdict: "MISLEADING",
      fact: "Vaccines train immunity without the risk.",
      humor: "BOSS DEFEATED: \u2018just get sick\u2019 strategy \uD83D\uDCA5 K.O.",
      humor_style: "boss_battle",
      loopKeyword: "natural immunity"
    });
  }
});

// --- Init ---
document.addEventListener("DOMContentLoaded", () => {
  connectWebSocket();
  startIdleTicker();
  startSpeechRecognition();
});
