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

const FUN_STATS = [
  "Days since flat earth was proven: \u221E",
  "Vaccines save 4\u20135 million lives per year",
  "Your DNA is 99.9% identical to every other human",
  "Sharks existed before trees",
  "The scientific method: it just works\u2122",
  "Peer review > YouTube review",
  "97% of climate scientists agree",
  "Correlation \u2260 causation",
  "Evolution: 3.5 billion years of QA testing",
  "mRNA degrades in 48 hours. Your DNA is fine.",
  "Organic food is also made of chemicals",
  "The dose makes the poison \u2014 Paracelsus",
  "Water is a chemical. You drink chemicals daily.",
  "Earth is 4.5 billion years old. Not 6,000.",
  "There are more trees on Earth than stars in the Milky Way",
  "GPS satellites correct for relativity every day",
  "Antibiotics don\u2019t work on viruses. Pass it on.",
  "The placebo effect is real. Irony is also real.",
  "One lightning bolt could toast 100,000 slices of bread",
  "Astronauts grow up to 2 inches taller in space",
  "Gut bacteria outnumber your own cells 10:1",
  "The human brain uses 20% of the body\u2019s energy",
  "Double-blind studies: because we don\u2019t trust ourselves",
  "Sunscreen works. Sunburn doesn\u2019t build immunity.",
  "A photon takes 100,000 years to cross the Milky Way",
  "Consensus isn\u2019t opinion. It\u2019s evidence agreeing.",
  "Atoms are 99.9999% empty space. You\u2019re mostly nothing.",
  "Gravity: still technically \u201Cjust a theory.\u201D",
  "Fun fact: \u201Cnatural\u201D doesn\u2019t mean safe. Arsenic is natural.",
  "There are more bacteria in your mouth than people on Earth",
  "Microwaves don\u2019t make food radioactive. Relax.",
  "Pluto was demoted by data, not feelings",
  "Your nose can detect over 1 trillion scents",
  "Science doesn\u2019t care about your beliefs",
  "The MMR vaccine has been given 500M+ times safely",
  "Steel beams melt at 1510\u00B0C. Jet fuel burns at 1000\u00B0C. Steel weakens at 600\u00B0C.",
  "Fluoride in water: safe since 1945",
  "5G uses non-ionizing radiation. Like a radio.",
  "The universe is 93 billion light-years across",
  "Sample size of 1 is not a study. It\u2019s an anecdote.",
];

// --- Idle Pop-in State ---
let idleTimer = null;
let isShowingCard = false;
let momJokeCount = 0;

// --- Session Timer State ---
let sessionTimerInterval = null;
let sessionStartTime = null;

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
        case "mom_joke":
          showMomJokePileOn(msg);
          break;
        case "nickname_update":
          updateNicknameDisplay(msg.nickname);
          break;
        case "session_start":
          handleSessionStart();
          break;
        case "session_end":
          handleSessionEnd(msg.data);
          break;
        case "report_card":
          showReportCard(msg);
          break;
        case "payment":
          showPaymentAlert(msg);
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

// --- Nickname Display ---

function updateNicknameDisplay(nickname) {
  const bar = document.getElementById("nickname-bar");
  const el = document.getElementById("nickname");
  if (!bar || !el) return;

  bar.style.display = "flex";
  el.textContent = nickname;

  // Slam-in animation
  el.classList.remove("slam-in");
  // Force reflow to restart animation
  void el.offsetWidth;
  el.classList.add("slam-in");
}

// --- Session Timer ---

function startSessionTimer() {
  stopSessionTimer();
  sessionStartTime = Date.now();

  // Create or show timer element
  let timerEl = document.querySelector(".session-timer");
  if (!timerEl) {
    timerEl = document.createElement("div");
    timerEl.className = "session-timer";
    document.body.appendChild(timerEl);
  }
  timerEl.textContent = "00:00";
  timerEl.style.display = "block";

  sessionTimerInterval = setInterval(() => {
    const elapsed = Math.floor((Date.now() - sessionStartTime) / 1000);
    const mm = String(Math.floor(elapsed / 60)).padStart(2, "0");
    const ss = String(elapsed % 60).padStart(2, "0");
    timerEl.textContent = mm + ":" + ss;
  }, 1000);
}

function stopSessionTimer() {
  if (sessionTimerInterval) {
    clearInterval(sessionTimerInterval);
    sessionTimerInterval = null;
  }
  const timerEl = document.querySelector(".session-timer");
  if (timerEl) timerEl.style.display = "none";
}

function handleSessionStart() {
  // Clear ad screen if showing
  dismissAdScreen();
  // Restore banner and ticker
  const topBanner = document.querySelector(".top-banner");
  const bottomTicker = document.querySelector(".bottom-ticker");
  if (topBanner) topBanner.style.display = "flex";
  if (bottomTicker) bottomTicker.style.display = "flex";

  // Stop idle pop-ins during animation
  stopIdlePopIns();
  isShowingCard = true;

  const container = document.getElementById("main-content");
  if (container) container.innerHTML = "";

  // Show "ROUND 1" slam-in animation
  const announce = document.createElement("div");
  announce.className = "round-announce slam-in";
  announce.textContent = "ROUND 1";
  if (container) container.appendChild(announce);

  // After 2s hold, fade out the announcement
  setTimeout(() => {
    announce.classList.add("fade-out");
  }, 2000);

  // After 3s total, transition to active session mode
  setTimeout(() => {
    if (container) container.innerHTML = "";
    isShowingCard = false;

    // Show nickname bar with CHALLENGER
    const bar = document.getElementById("nickname-bar");
    const el = document.getElementById("nickname");
    if (bar) bar.style.display = "flex";
    if (el) el.textContent = "CHALLENGER";

    // Start session timer and resume idle pop-ins
    startSessionTimer();
    startIdlePopIns();
  }, 3000);
}

function handleSessionEnd(data) {
  // Session ended — stop timer, report card will arrive as a separate message
  stopSessionTimer();
  stopIdlePopIns();
  isShowingCard = true;
}

// --- Report Card ---

let reportCardTimeouts = [];

function clearReportCardTimeouts() {
  reportCardTimeouts.forEach((t) => clearTimeout(t));
  reportCardTimeouts = [];
}

function rcTimeout(fn, delay) {
  const t = setTimeout(fn, delay);
  reportCardTimeouts.push(t);
  return t;
}

function showReportCard(data) {
  clearReportCardTimeouts();
  stopIdlePopIns();
  isShowingCard = true;

  const container = document.getElementById("main-content");
  if (!container) return;
  container.innerHTML = "";

  // Hide nickname bar and bottom ticker
  const nicknameBar = document.getElementById("nickname-bar");
  const bottomTicker = document.querySelector(".bottom-ticker");
  if (nicknameBar) nicknameBar.style.display = "none";
  if (bottomTicker) bottomTicker.style.display = "none";

  // Create report card container
  const card = document.createElement("div");
  card.className = "report-card";
  container.appendChild(card);

  // t=0s: Header slams in
  const header = document.createElement("div");
  header.className = "report-header slam-in";
  header.textContent = "TRUTH REPORT CARD";
  card.appendChild(header);

  // t=2s: Nickname bounces in
  rcTimeout(() => {
    const nicknameSection = document.createElement("div");
    nicknameSection.className = "report-nickname bounce-in";
    nicknameSection.textContent = "AWARDED TO:";
    const nameSpan = document.createElement("span");
    nameSpan.className = "name";
    nameSpan.textContent = data.nickname || "CHALLENGER";
    nicknameSection.appendChild(nameSpan);
    card.appendChild(nicknameSection);
  }, 2000);

  // t=5s: Grade slams in huge
  rcTimeout(() => {
    const gradeEl = document.createElement("div");
    gradeEl.className = "report-grade slam-in";
    gradeEl.textContent = data.grade || "F";
    card.appendChild(gradeEl);

    const jokeEl = document.createElement("div");
    jokeEl.className = "grade-joke bounce-in";
    jokeEl.textContent = data.gradeJoke || "";
    card.appendChild(jokeEl);
  }, 5000);

  // t=8s: Stats appear one by one (300ms stagger)
  const stats = data.stats || {};
  const statLines = [
    { label: "CLAIMS DETECTED", value: stats.claimCount || 0 },
    { label: "DEBUNKED", value: stats.debunkedCount || 0 },
    { label: "MISLEADING", value: stats.misleadingCount || 0 },
    { label: "BROKEN RECORDS", value: stats.loopBreakerCount || 0 },
    { label: "MOM JOKES", value: stats.momJokeCount || 0 },
  ];

  rcTimeout(() => {
    const statsContainer = document.createElement("div");
    statsContainer.className = "report-stats";
    card.appendChild(statsContainer);

    statLines.forEach((stat, i) => {
      rcTimeout(() => {
        const line = document.createElement("div");
        line.className = "stat-line bounce-in";
        const labelSpan = document.createElement("span");
        labelSpan.textContent = stat.label;
        const valueSpan = document.createElement("span");
        valueSpan.className = "stat-value";
        valueSpan.textContent = stat.value;
        line.appendChild(labelSpan);
        line.appendChild(valueSpan);
        statsContainer.appendChild(line);
      }, i * 300);
    });
  }, 8000);

  // t=14s: Superlatives bounce in one at a time (2s each)
  const superlatives = data.superlatives || [];
  superlatives.forEach((text, i) => {
    rcTimeout(() => {
      const sup = document.createElement("div");
      sup.className = "superlative bounce-in";
      sup.textContent = text;
      card.appendChild(sup);
    }, 14000 + i * 2000);
  });

  // t=22s: Closing one-liner
  rcTimeout(() => {
    const closer = document.createElement("div");
    closer.className = "report-closer bounce-in";
    closer.textContent = data.closer || "";
    card.appendChild(closer);
  }, 22000);

  // t=26s: Hold for 8 seconds (screenshot moment)
  // t=34s: Fade out
  rcTimeout(() => {
    card.classList.add("fade-out");
    rcTimeout(() => {
      container.innerHTML = "";
      isShowingCard = false;
      showAdScreen();
    }, 1000);
  }, 34000);
}

// --- Stub Functions (implemented in later tasks) ---

function showFactCard(data) {
  stopIdlePopIns();
  isShowingCard = true;

  const container = document.getElementById("main-content");
  if (!container) return;

  // Clear any existing card or idle stat
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

  const sourceEl = document.createElement("div");
  sourceEl.className = "source";
  sourceEl.textContent = data.source ? `SOURCE: ${data.source}` : "";
  sourceEl.style.opacity = "0";

  card.appendChild(claimEl);
  card.appendChild(verdictEl);
  card.appendChild(factEl);
  card.appendChild(humorEl);
  card.appendChild(sourceEl);

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

  setTimeout(() => {
    sourceEl.style.opacity = "";
    sourceEl.classList.add("bounce-in");
  }, 1200);

  // Fade out after 18 seconds
  setTimeout(() => {
    card.classList.add("fade-out");
    // Remove from DOM after fade-out completes (1s)
    setTimeout(() => {
      if (card.parentNode) {
        card.parentNode.removeChild(card);
      }
      isShowingCard = false;
      startIdlePopIns();
    }, 1000);
  }, 18000);
}

function showLoopBreaker(data) {
  stopIdlePopIns();
  isShowingCard = true;
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

  const sourceEl = document.createElement("div");
  sourceEl.className = "source";
  sourceEl.textContent = data.source ? `SOURCE: ${data.source}` : "";
  sourceEl.style.opacity = "0";

  card.appendChild(headerEl);
  card.appendChild(claimEl);
  card.appendChild(verdictEl);
  card.appendChild(factEl);
  card.appendChild(humorEl);
  card.appendChild(sourceEl);

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

  setTimeout(() => {
    sourceEl.style.opacity = "";
    sourceEl.classList.add("bounce-in");
  }, 1200);

  // Fade out after 22 seconds
  setTimeout(() => {
    card.classList.add("fade-out");
    // Remove from DOM after fade-out completes (1s)
    setTimeout(() => {
      if (card.parentNode) {
        card.parentNode.removeChild(card);
      }
      isShowingCard = false;
      startIdlePopIns();
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

  let micBlocked = false;

  recognition.addEventListener("error", (event) => {
    console.error("[Speech] Error:", event.error);
    if (indicator) indicator.classList.remove("active");
    if (event.error === "not-allowed" || event.error === "service-not-allowed") {
      micBlocked = true;
      console.warn("[Speech] Mic access denied. Speech recognition disabled. Grant mic permission and reload.");
    }
  });

  recognition.addEventListener("end", () => {
    if (indicator) indicator.classList.remove("active");
    flushBuffer();
    if (micBlocked) return;
    console.log("[Speech] Recognition ended — restarting");
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

// --- Idle Fun Stats Pop-ins ---

function getRandomIdleInterval() {
  // Random interval between 30-45 seconds
  return 30000 + Math.random() * 15000;
}

function showIdleStat() {
  if (isShowingCard) return;

  const container = document.getElementById("main-content");
  if (!container) return;

  // Pick a random fun stat
  const stat = FUN_STATS[Math.floor(Math.random() * FUN_STATS.length)];

  const el = document.createElement("div");
  el.className = "idle-stat bounce-in";
  el.textContent = stat;
  container.appendChild(el);

  // Display for 8 seconds, then fade out and remove
  setTimeout(() => {
    el.classList.add("fade-out");
    setTimeout(() => {
      if (el.parentNode) {
        el.parentNode.removeChild(el);
      }
    }, 1000);
  }, 8000);

  // Schedule next pop-in
  idleTimer = setTimeout(showIdleStat, getRandomIdleInterval());
}

function startIdlePopIns() {
  stopIdlePopIns();
  idleTimer = setTimeout(showIdleStat, getRandomIdleInterval());
}

function stopIdlePopIns() {
  if (idleTimer) {
    clearTimeout(idleTimer);
    idleTimer = null;
  }
  // Remove any existing idle stat from the DOM
  const container = document.getElementById("main-content");
  if (container) {
    const existing = container.querySelectorAll(".idle-stat");
    existing.forEach((el) => el.remove());
  }
}

// --- Mom Joke Pile-On ---

function showMomJokePileOn(data) {
  stopIdlePopIns();
  isShowingCard = true;
  momJokeCount++;

  const container = document.getElementById("main-content");
  if (!container) return;

  container.innerHTML = "";

  const alert = document.createElement("div");
  alert.className = "mom-joke-alert";
  container.appendChild(alert);

  // t=0: Show header
  const header = document.createElement("div");
  header.className = "alert-header shake glow-red";
  header.textContent = "MOM JOKE DETECTED";
  alert.appendChild(header);

  const jokes = data.jokes || [];

  // t=2s: First joke
  setTimeout(() => {
    const existing = alert.querySelector(".pile-on");
    if (existing) existing.remove();
    const joke1 = document.createElement("div");
    joke1.className = "pile-on slam-in";
    joke1.textContent = jokes[0] || "";
    alert.appendChild(joke1);
  }, 2000);

  // t=5s: Second joke (larger)
  setTimeout(() => {
    const existing = alert.querySelector(".pile-on");
    if (existing) existing.remove();
    const joke2 = document.createElement("div");
    joke2.className = "pile-on slam-in";
    joke2.style.fontSize = "clamp(1.6rem, 3.8vw, 3rem)";
    joke2.textContent = jokes[1] || "";
    alert.appendChild(joke2);
  }, 5000);

  // t=8s: Third joke (largest, gold)
  setTimeout(() => {
    const existing = alert.querySelector(".pile-on");
    if (existing) existing.remove();
    const joke3 = document.createElement("div");
    joke3.className = "pile-on final slam-in";
    joke3.textContent = jokes[2] || "";
    alert.appendChild(joke3);
  }, 8000);

  // t=11s: Mom joke count badge
  setTimeout(() => {
    const badge = document.createElement("div");
    badge.className = "mom-counter bounce-in";
    badge.textContent = "MOM JOKE COUNT: " + momJokeCount;
    alert.appendChild(badge);
  }, 11000);

  // t=15s: Fade out and clean up
  setTimeout(() => {
    alert.classList.add("fade-out");
    setTimeout(() => {
      if (alert.parentNode) {
        alert.parentNode.removeChild(alert);
      }
      isShowingCard = false;
      startIdlePopIns();
    }, 1000);
  }, 15000);
}

// --- Ad Screen ---

function showAdScreen() {
  // Clear main content
  const container = document.getElementById("main-content");
  if (container) container.innerHTML = "";

  // Hide nickname bar, bottom ticker, and top banner
  const nicknameBar = document.getElementById("nickname-bar");
  const bottomTicker = document.querySelector(".bottom-ticker");
  const topBanner = document.querySelector(".top-banner");
  if (nicknameBar) nicknameBar.style.display = "none";
  if (bottomTicker) bottomTicker.style.display = "none";
  if (topBanner) topBanner.style.display = "none";

  // Stop idle pop-ins
  stopIdlePopIns();
  isShowingCard = true;

  // Create full-screen overlay
  const overlay = document.createElement("div");
  overlay.className = "ad-screen";
  overlay.id = "ad-screen";

  const url = document.createElement("div");
  url.className = "ad-url";
  url.textContent = "SCIENCEANDFREEDOM.COM";

  const tagline = document.createElement("div");
  tagline.className = "ad-tagline";
  tagline.textContent = "FACTS. FREEDOM. NO BS.";

  overlay.appendChild(url);
  overlay.appendChild(tagline);
  document.body.appendChild(overlay);
}

function dismissAdScreen() {
  const overlay = document.getElementById("ad-screen");
  if (overlay) overlay.remove();
}

function returnToStandby() {
  // Dismiss ad screen if showing
  dismissAdScreen();

  // Clear main content
  const container = document.getElementById("main-content");
  if (container) container.innerHTML = "";

  // Restore top banner
  const topBanner = document.querySelector(".top-banner");
  if (topBanner) topBanner.style.display = "flex";

  // Restore bottom ticker
  const bottomTicker = document.querySelector(".bottom-ticker");
  if (bottomTicker) bottomTicker.style.display = "flex";

  // Hide nickname bar (standby = no active session)
  const nicknameBar = document.getElementById("nickname-bar");
  if (nicknameBar) nicknameBar.style.display = "none";

  // Stop session timer
  stopSessionTimer();

  // Resume idle pop-ins
  isShowingCard = false;
  startIdlePopIns();
}

// --- Payment Alert ---

function showPaymentAlert(data) {
  // Full-page takeover that interrupts whatever is showing
  // data = { type: 'payment', source: 'stripe'|'patreon', name: 'John', amount: '$5.00', message: 'Great stream!' }

  // 1. Full-screen white flash overlay (200ms, fades quickly)
  const flashOverlay = document.createElement("div");
  flashOverlay.className = "payment-overlay";
  document.body.appendChild(flashOverlay);

  // Remove flash overlay after animation completes
  setTimeout(() => {
    if (flashOverlay.parentNode) flashOverlay.remove();
  }, 500);

  // 2. Create the payment alert card
  const alert = document.createElement("div");
  alert.className = "payment-alert bounce-in";

  const sourceEl = document.createElement("div");
  sourceEl.className = "payment-source";
  sourceEl.textContent = (data.source || "DONATION").toUpperCase();

  const nameEl = document.createElement("div");
  nameEl.className = "payment-name";
  nameEl.textContent = data.name || "ANONYMOUS";

  const amountEl = document.createElement("div");
  amountEl.className = "payment-amount";
  amountEl.textContent = data.amount || "";

  alert.appendChild(sourceEl);
  alert.appendChild(nameEl);
  alert.appendChild(amountEl);

  if (data.message) {
    const msgEl = document.createElement("div");
    msgEl.className = "payment-message";
    msgEl.textContent = data.message;
    alert.appendChild(msgEl);
  }

  document.body.appendChild(alert);

  // 3. Hold for 8 seconds, then fade out and remove
  setTimeout(() => {
    alert.classList.add("fade-out");
    setTimeout(() => {
      if (alert.parentNode) alert.remove();
    }, 1000);
  }, 8000);
}

// --- Debug Keyboard Shortcuts ---
document.addEventListener("keydown", (e) => {
  if (e.key === "d" || e.key === "D") {
    showFactCard({
      claim: "VACCINES CAUSE AUTISM",
      verdict: "FALSE. EXPOSED.",
      fact: "1.2M kids studied. Zero link found.",
      humor: "Correlation \u2260 causation. Unless you\u2019re a Facebook researcher.",
      humor_style: "sarcastic",
      source: "Lancet, 2014 (RETRACTED)"
    });
  }
  if (e.key === "r" || e.key === "R") {
    showReportCard({
      nickname: "DR. YOUTUBE",
      nicknameHistory: ["CHALLENGER", "THE GOOGLER", "DR. YOUTUBE"],
      grade: "F-",
      gradeJoke: "Lower than snake belly in a wagon rut",
      superlatives: [
        "Most Creative Misuse of Statistics",
        "Lifetime Achievement in Ignoring Peer Review",
        "Gold Medal in Moving the Goalposts"
      ],
      closer: "Today's debate brought to you by: Confirmation Bias",
      stats: { claimCount: 14, debunkedCount: 11, misleadingCount: 3, loopBreakerCount: 4, momJokeCount: 3 }
    });
  }
  if (e.key === "a" || e.key === "A") {
    showAdScreen();
  }
  if (e.key === "Escape") {
    returnToStandby();
  }
  if (e.key === "p" || e.key === "P") {
    showPaymentAlert({
      type: "payment",
      source: "stripe",
      name: "John",
      amount: "$5.00",
      message: "Love the stream!"
    });
  }
  if (e.key === "l" || e.key === "L") {
    showLoopBreaker({
      claim: "NATURAL IMMUNITY",
      verdict: "MISLEADING",
      fact: "Vaccines train immunity without the risk.",
      humor: "BOSS DEFEATED: \u2018just get sick\u2019 strategy \uD83D\uDCA5 K.O.",
      humor_style: "boss_battle",
      source: "NEJM, 2022",
      loopKeyword: "natural immunity"
    });
  }
});

// --- Init ---
document.addEventListener("DOMContentLoaded", () => {
  connectWebSocket();
  startIdleTicker();
  startIdlePopIns();
  startSpeechRecognition();
});
