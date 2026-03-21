// ===========================================
//  THE GREAT BOARD OF SCIENCE — App JS
//  WebSocket client + Liberty Refined UI
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

const DEBATE_PROMPTS = [
  "Patriotism requires vaccines.",
  "GMOs feed the world.",
  "Trump is anti-science.",
  "Climate change is real.",
  "Evolution produced humans.",
];
let debatePromptIndex = 0;

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
  const el = document.getElementById("challenger-name");
  if (!el) return;

  el.textContent = nickname;

  // Slam-in animation
  el.classList.remove("slam-in");
  void el.offsetWidth;
  el.classList.add("slam-in");
}

// --- Session Timer ---

function startSessionTimer() {
  stopSessionTimer();
  sessionStartTime = Date.now();

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

function clearContainer(container) {
  while (container.firstChild) {
    container.removeChild(container.firstChild);
  }
}

function handleSessionStart() {
  dismissAdScreen();

  // Stop idle pop-ins during animation
  stopIdlePopIns();
  isShowingCard = true;

  const container = document.getElementById("main-content");
  if (container) clearContainer(container);

  // Show "ROUND 1" slam-in animation
  const announce = document.createElement("div");
  announce.className = "round-announce slam-in";
  announce.textContent = "ROUND 1";
  if (container) container.appendChild(announce);

  // After 2s hold, fade out
  setTimeout(() => {
    announce.classList.add("fade-out");
  }, 2000);

  // After 3s total, transition to active session
  setTimeout(() => {
    if (container) clearContainer(container);
    isShowingCard = false;

    // Show challenger name
    const el = document.getElementById("challenger-name");
    if (el) el.textContent = "CHALLENGER";

    startSessionTimer();
    startIdlePopIns();
  }, 3000);
}

function handleSessionEnd(data) {
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
  clearContainer(container);

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

  // t=14s: Superlatives bounce in (2s each)
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

  // t=34s: Fade out → ad screen
  rcTimeout(() => {
    card.classList.add("fade-out");
    rcTimeout(() => {
      clearContainer(container);
      isShowingCard = false;
      showAdScreen();
    }, 1000);
  }, 34000);
}

// --- Fact Card — Liberty Styled Blocks ---

function showFactCard(data) {
  stopIdlePopIns();
  isShowingCard = true;

  const container = document.getElementById("main-content");
  if (!container) return;
  clearContainer(container);

  // Claim block — asymmetric left
  const claimBlock = document.createElement("div");
  claimBlock.className = "claim-block slide-in";
  const claimLabel = document.createElement("div");
  claimLabel.className = "claim-label";
  claimLabel.textContent = "\u2733 CLAIM";
  const claimText = document.createElement("div");
  claimText.className = "claim-text";
  claimText.textContent = data.claim || "";
  claimBlock.appendChild(claimLabel);
  claimBlock.appendChild(claimText);
  container.appendChild(claimBlock);

  // Verdict block — centered, massive
  const verdictBlock = document.createElement("div");
  verdictBlock.className = "verdict-block";
  verdictBlock.style.opacity = "0";
  const verdictText = document.createElement("div");
  verdictText.className = "verdict-text";
  verdictText.textContent = data.verdict || "";
  verdictBlock.appendChild(verdictText);
  container.appendChild(verdictBlock);

  // Fact block — asymmetric right
  const factBlock = document.createElement("div");
  factBlock.className = "fact-block";
  factBlock.style.opacity = "0";
  const factLabel = document.createElement("div");
  factLabel.className = "fact-label";
  factLabel.textContent = "\u25B6 FACT";
  const factValue = document.createElement("div");
  factValue.className = "fact-value";
  factValue.textContent = data.fact || "";
  factBlock.appendChild(factLabel);
  factBlock.appendChild(factValue);
  container.appendChild(factBlock);

  // Humor block
  const humorWrap = document.createElement("div");
  humorWrap.style.opacity = "0";
  humorWrap.style.padding = "8px 0";
  const humorBlock = document.createElement("div");
  humorBlock.className = "humor-block";
  const humorLabel = document.createElement("div");
  humorLabel.className = "humor-label";
  humorLabel.textContent = "\u2733 HUMOR";
  const humorValue = document.createElement("div");
  humorValue.className = "humor-value";
  humorValue.textContent = data.humor || "";
  humorBlock.appendChild(humorLabel);
  humorBlock.appendChild(humorValue);
  humorWrap.appendChild(humorBlock);
  container.appendChild(humorWrap);

  // Source block — narrow centered
  const sourceBlock = document.createElement("div");
  sourceBlock.className = "source-block";
  sourceBlock.style.opacity = "0";
  const sourceLabel = document.createElement("div");
  sourceLabel.className = "source-label";
  sourceLabel.textContent = "SOURCE";
  const sourceValue = document.createElement("div");
  sourceValue.className = "source-value";
  sourceValue.textContent = data.source || "";
  sourceBlock.appendChild(sourceLabel);
  sourceBlock.appendChild(sourceValue);
  container.appendChild(sourceBlock);

  // Staggered animations
  setTimeout(() => {
    verdictBlock.style.opacity = "";
    verdictBlock.classList.add("slam-in");
  }, 300);

  setTimeout(() => {
    factBlock.style.opacity = "";
    factBlock.classList.add("bounce-in");
  }, 600);

  setTimeout(() => {
    humorWrap.style.opacity = "";
    humorWrap.classList.add("bounce-in");
  }, 900);

  setTimeout(() => {
    sourceBlock.style.opacity = "";
    sourceBlock.classList.add("bounce-in");
  }, 1200);

  // Fade out after 18 seconds
  setTimeout(() => {
    container.querySelectorAll(".claim-block, .verdict-block, .fact-block, .humor-block, .source-block").forEach(el => {
      el.classList.add("fade-out");
    });
    humorWrap.classList.add("fade-out");
    setTimeout(() => {
      clearContainer(container);
      isShowingCard = false;
      startIdlePopIns();
    }, 1000);
  }, 18000);
}

// --- Loop Breaker — Threat Alert ---

function showLoopBreaker(data) {
  stopIdlePopIns();
  isShowingCard = true;
  const container = document.getElementById("main-content");
  if (!container) return;
  clearContainer(container);

  // Alert header
  const alertHeader = document.createElement("div");
  alertHeader.className = "loop-alert-header shake";
  const headerText = document.createElement("div");
  headerText.className = "loop-header-text";
  headerText.textContent = "\uD83D\uDD01 BROKEN RECORD ALERT";
  alertHeader.appendChild(headerText);
  container.appendChild(alertHeader);

  // Claim block — red-bordered variant
  const claimBlock = document.createElement("div");
  claimBlock.className = "claim-block loop-claim slide-in";
  const claimLabel = document.createElement("div");
  claimLabel.className = "claim-label";
  claimLabel.textContent = "\u2733 REPEATED CLAIM";
  const claimText = document.createElement("div");
  claimText.className = "claim-text";
  claimText.textContent = data.claim || "";
  claimBlock.appendChild(claimLabel);
  claimBlock.appendChild(claimText);
  container.appendChild(claimBlock);

  // Verdict
  const verdictBlock = document.createElement("div");
  verdictBlock.className = "verdict-block";
  verdictBlock.style.opacity = "0";
  const verdictText = document.createElement("div");
  verdictText.className = "verdict-text";
  verdictText.textContent = data.verdict || "";
  verdictBlock.appendChild(verdictText);
  container.appendChild(verdictBlock);

  // Fact
  const factBlock = document.createElement("div");
  factBlock.className = "fact-block";
  factBlock.style.opacity = "0";
  const factLabel = document.createElement("div");
  factLabel.className = "fact-label";
  factLabel.textContent = "\u25B6 FACT";
  const factValue = document.createElement("div");
  factValue.className = "fact-value";
  factValue.textContent = data.fact || "";
  factBlock.appendChild(factLabel);
  factBlock.appendChild(factValue);
  container.appendChild(factBlock);

  // Humor
  const humorWrap = document.createElement("div");
  humorWrap.style.opacity = "0";
  humorWrap.style.padding = "8px 0";
  const humorBlock = document.createElement("div");
  humorBlock.className = "humor-block";
  const humorLabel = document.createElement("div");
  humorLabel.className = "humor-label";
  humorLabel.textContent = "\u2733 HUMOR";
  const humorValue = document.createElement("div");
  humorValue.className = "humor-value";
  humorValue.textContent = data.humor || "";
  humorBlock.appendChild(humorLabel);
  humorBlock.appendChild(humorValue);
  humorWrap.appendChild(humorBlock);
  container.appendChild(humorWrap);

  // Source
  const sourceBlock = document.createElement("div");
  sourceBlock.className = "source-block";
  sourceBlock.style.opacity = "0";
  const sourceLabel = document.createElement("div");
  sourceLabel.className = "source-label";
  sourceLabel.textContent = "SOURCE";
  const sourceValue = document.createElement("div");
  sourceValue.className = "source-value";
  sourceValue.textContent = data.source || "";
  sourceBlock.appendChild(sourceLabel);
  sourceBlock.appendChild(sourceValue);
  container.appendChild(sourceBlock);

  // Staggered animations
  setTimeout(() => {
    verdictBlock.style.opacity = "";
    verdictBlock.classList.add("slam-in");
  }, 300);

  setTimeout(() => {
    factBlock.style.opacity = "";
    factBlock.classList.add("bounce-in");
  }, 600);

  setTimeout(() => {
    humorWrap.style.opacity = "";
    humorWrap.classList.add("bounce-in");
  }, 900);

  setTimeout(() => {
    sourceBlock.style.opacity = "";
    sourceBlock.classList.add("bounce-in");
  }, 1200);

  // Fade out after 22 seconds
  setTimeout(() => {
    container.querySelectorAll(".loop-alert-header, .claim-block, .verdict-block, .fact-block, .humor-block, .source-block").forEach(el => {
      el.classList.add("fade-out");
    });
    humorWrap.classList.add("fade-out");
    setTimeout(() => {
      clearContainer(container);
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

// --- Idle Debate Prompts ---

function showDebatePrompt() {
  if (isShowingCard) return;

  const container = document.getElementById("main-content");
  if (!container) return;

  const prompt = DEBATE_PROMPTS[debatePromptIndex];
  debatePromptIndex = (debatePromptIndex + 1) % DEBATE_PROMPTS.length;

  const el = document.createElement("div");
  el.className = "debate-prompt bounce-in";
  el.textContent = prompt;
  container.appendChild(el);

  // Display for 12 seconds, then fade out
  setTimeout(() => {
    el.classList.add("fade-out");
    setTimeout(() => {
      if (el.parentNode) {
        el.parentNode.removeChild(el);
      }
    }, 1000);
  }, 12000);

  idleTimer = setTimeout(showDebatePrompt, 14000);
}

function startIdlePopIns() {
  stopIdlePopIns();
  idleTimer = setTimeout(showDebatePrompt, 2000);
}

function stopIdlePopIns() {
  if (idleTimer) {
    clearTimeout(idleTimer);
    idleTimer = null;
  }
  const container = document.getElementById("main-content");
  if (container) {
    const existing = container.querySelectorAll(".debate-prompt");
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
  clearContainer(container);

  const alert = document.createElement("div");
  alert.className = "mom-joke-alert";
  container.appendChild(alert);

  // t=0: Show header
  const header = document.createElement("div");
  header.className = "alert-header shake";
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

  // t=5s: Second joke
  setTimeout(() => {
    const existing = alert.querySelector(".pile-on");
    if (existing) existing.remove();
    const joke2 = document.createElement("div");
    joke2.className = "pile-on slam-in";
    joke2.style.fontSize = "46px";
    joke2.textContent = jokes[1] || "";
    alert.appendChild(joke2);
  }, 5000);

  // t=8s: Third joke (gold, largest)
  setTimeout(() => {
    const existing = alert.querySelector(".pile-on");
    if (existing) existing.remove();
    const joke3 = document.createElement("div");
    joke3.className = "pile-on final slam-in";
    joke3.textContent = jokes[2] || "";
    alert.appendChild(joke3);
  }, 8000);

  // t=11s: Counter badge
  setTimeout(() => {
    const badge = document.createElement("div");
    badge.className = "mom-counter bounce-in";
    badge.textContent = "MOM JOKE COUNT: " + momJokeCount;
    alert.appendChild(badge);
  }, 11000);

  // t=15s: Fade out
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
  const container = document.getElementById("main-content");
  if (container) clearContainer(container);

  stopIdlePopIns();
  isShowingCard = true;

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
  dismissAdScreen();

  const container = document.getElementById("main-content");
  if (container) clearContainer(container);

  // Reset challenger name
  const el = document.getElementById("challenger-name");
  if (el) el.textContent = "AWAITING TARGET";

  stopSessionTimer();

  isShowingCard = false;
  startIdlePopIns();
}

// --- Payment Alert ---

function showPaymentAlert(data) {
  // Gold flash overlay
  const flashOverlay = document.createElement("div");
  flashOverlay.className = "payment-overlay";
  document.body.appendChild(flashOverlay);

  setTimeout(() => {
    if (flashOverlay.parentNode) flashOverlay.remove();
  }, 500);

  // Payment alert card
  const alertEl = document.createElement("div");
  alertEl.className = "payment-alert bounce-in";

  const sourceEl = document.createElement("div");
  sourceEl.className = "payment-source";
  sourceEl.textContent = (data.source || "DONATION").toUpperCase();

  const nameEl = document.createElement("div");
  nameEl.className = "payment-name";
  nameEl.textContent = data.name || "ANONYMOUS";

  const amountEl = document.createElement("div");
  amountEl.className = "payment-amount";
  amountEl.textContent = data.amount || "";

  alertEl.appendChild(sourceEl);
  alertEl.appendChild(nameEl);
  alertEl.appendChild(amountEl);

  if (data.message) {
    const msgEl = document.createElement("div");
    msgEl.className = "payment-message";
    msgEl.textContent = data.message;
    alertEl.appendChild(msgEl);
  }

  document.body.appendChild(alertEl);

  // Hold 8s, then fade out
  setTimeout(() => {
    alertEl.classList.add("fade-out");
    setTimeout(() => {
      if (alertEl.parentNode) alertEl.remove();
    }, 1000);
  }, 8000);
}

// --- Debug Keyboard Shortcuts ---
document.addEventListener("keydown", (e) => {
  if (e.key === "d" || e.key === "D") {
    showFactCard({
      claim: "VACCINES CAUSE AUTISM",
      verdict: "DEBUNKED",
      fact: "THE ORIGINAL 1998 WAKEFIELD STUDY WAS RETRACTED FOR FRAUD. DOZENS OF STUDIES WITH MILLIONS OF CHILDREN FOUND ZERO LINK.",
      humor: "IMAGINE TRUSTING SOMEONE WHO LOST THEIR MEDICAL LICENSE OVER THOUSANDS OF ACTUAL SCIENTISTS.",
      source: "LANCET RETRACTION (2010); TAYLOR ET AL., VACCINE, 2014"
    });
  }
  if (e.key === "r" || e.key === "R") {
    showReportCard({
      nickname: "CAPTAIN ANECDOTE",
      grade: "F-",
      gradeJoke: "LOWER THAN SNAKE BELLY IN A WAGON RUT",
      superlatives: [
        "MOST CREATIVE MISUSE OF STATISTICS",
        "LIFETIME ACHIEVEMENT IN IGNORING PEER REVIEW",
        "GOLD MEDAL IN MOVING THE GOALPOSTS"
      ],
      closer: "TODAY'S DEBATE BROUGHT TO YOU BY: CONFIRMATION BIAS",
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
      name: "JOHN",
      amount: "$5.00",
      message: "LOVE THE STREAM!"
    });
  }
  if (e.key === "l" || e.key === "L") {
    showLoopBreaker({
      claim: "NATURAL IMMUNITY",
      verdict: "MISLEADING",
      fact: "VACCINES TRAIN IMMUNITY WITHOUT THE RISK OF SEVERE DISEASE OR DEATH.",
      humor: "THE 'JUST GET SICK' STRATEGY — BROUGHT TO YOU BY PEOPLE WHO NEVER TOOK STATISTICS.",
      source: "NEJM, 2022"
    });
  }
});

// --- Init ---
document.addEventListener("DOMContentLoaded", () => {
  connectWebSocket();
  startIdlePopIns();
  startSpeechRecognition();
});
