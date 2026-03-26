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
        case "tts_ready":
          console.log("[WS] tts_ready received:", msg.audioUrl);
          if (msg.audioUrl) {
            try {
              Marie.speak(msg.audioUrl, msg.text || '');
            } catch (err) {
              console.error("[WS] Marie.speak FAILED:", err);
            }
          }
          break;
        case "marie_stop":
          console.log("[WS] Marie STOP");
          Marie.stop();
          Marie.hideContainer();
          window._promptCycleActive = false; // stop prompt cycle too
          break;
        case "start_prompt_cycle":
          startPromptCycle();
          break;
        case "marie_speak":
          console.log("[WS] marie_speak received:", msg.text?.substring(0, 50), msg.audioUrl);
          if (typeof DevBar !== 'undefined') DevBar.logEvent('MARIE', msg.text?.substring(0, 60) || 'no text');
          if (msg.audioUrl) {
            try {
              Marie.speak(msg.audioUrl, msg.text || '');
            } catch (err) {
              console.error("[WS] Marie.speak FAILED:", err);
              if (typeof DevBar !== 'undefined') DevBar.logEvent('ERROR', err.message);
            }
          } else {
            // Text-only fallback (TTS failed)
            Marie.showContainer();
            const speechEl = document.getElementById('marie-speech');
            if (speechEl) speechEl.textContent = (msg.text || '').toUpperCase();
            setTimeout(() => Marie.hideContainer(), 6000);
          }
          break;
        // === STREAM DECK HANDLERS ===
        case "reset":
          returnToStandby();
          break;
        case "show_ad":
          showAdScreen();
          break;
        case "bingo_toggle":
          { const b = document.getElementById("bingo-board");
            if (b) b.style.display = b.style.display === "none" ? "block" : "none"; }
          break;
        case "credibility_toggle":
          { const c = document.getElementById("credibility-meter");
            if (c) c.style.display = c.style.display === "none" ? "flex" : "none"; }
          break;
        // === NEW FEATURE MESSAGE HANDLERS ===
        case "bingo_update":
          updateBingoBoard(msg);
          break;
        case "bingo_hit":
          animateBingoHit(msg);
          break;
        case "bingo_row":
          showBingoComplete(msg);
          break;
        case "credibility_update":
          updateCredibilityMeter(msg);
          break;
        case "mood_update":
          updateMoodIndicator(msg);
          break;
        case "conspiracy_graph_update":
          updateConspiracyGraph(msg);
          break;
        case "challenger_entrance":
          showChallengerEntrance(msg);
          break;
        case "theme_change":
          applyDynamicTheme(msg);
          break;
        case "prediction":
          showPrediction(msg);
          break;
        case "audience_question":
          showAudienceQuestion(msg);
          break;
        case "highlights":
          showHighlights(msg);
          break;
        case "guest_scientist":
          showGuestScientist(msg);
          break;
        case "quiz":
          showQuiz(msg);
          break;
        case "quiz_reveal":
          revealQuizAnswer(msg);
          break;
        case "this_or_that":
          showThisOrThat(msg);
          break;
        case "science_fact":
          showScienceFact(msg);
          break;
        case "myth_buster":
          showMythBuster(msg);
          break;
        case "scientist_spotlight":
          showScientistSpotlight(msg);
          break;
        case "outbreak":
          showOutbreakCard(msg);
          break;
        case "breakthrough":
          showBreakthroughCard(msg);
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
  SFX.sessionStart();

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
  SFX.reportCard();

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
  SFX.factCheck();

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
    SFX.verdict();
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
  SFX.loopBreaker();
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
        const finalText = event.results[i][0].transcript;
        transcriptBuffer += finalText + " ";
        onSpeechHeard(finalText);
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

  // Prompts cycle SILENTLY on screen — Marie does NOT read them
  // She only reads them when explicitly asked ("what are the debate prompts")

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
  SFX.momJoke();

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

// --- Payment Alert (Full-Screen, Persistent Until Escape) ---

function showPaymentAlert(data) {
  SFX.donation();
  // Full-screen gold flash
  const flashOverlay = document.createElement("div");
  flashOverlay.className = "payment-overlay";
  document.body.appendChild(flashOverlay);

  setTimeout(() => {
    if (flashOverlay.parentNode) flashOverlay.remove();
  }, 600);

  // Full-screen persistent donation alert
  const alertEl = document.createElement("div");
  alertEl.className = "payment-fullscreen";
  alertEl.id = "payment-fullscreen";

  const thankYou = document.createElement("div");
  thankYou.className = "payment-thankyou slam-in";
  thankYou.textContent = "THANK YOU";

  const nameEl = document.createElement("div");
  nameEl.className = "payment-name slam-in";
  // First name only — protect donor privacy on livestream
  nameEl.textContent = (data.name || "ANONYMOUS").trim().split(/\s+/)[0].toUpperCase();

  const amountEl = document.createElement("div");
  amountEl.className = "payment-amount bounce-in";
  amountEl.textContent = data.amount || "";

  const sourceEl = document.createElement("div");
  sourceEl.className = "payment-source bounce-in";
  sourceEl.textContent = "VIA " + (data.source || "DONATION").toUpperCase();

  alertEl.appendChild(thankYou);
  alertEl.appendChild(nameEl);
  alertEl.appendChild(amountEl);
  alertEl.appendChild(sourceEl);

  if (data.message) {
    const msgEl = document.createElement("div");
    msgEl.className = "payment-message bounce-in";
    msgEl.textContent = '"' + data.message + '"';
    alertEl.appendChild(msgEl);
  }

  // Dismiss hint at bottom
  const hint = document.createElement("div");
  hint.className = "payment-dismiss-hint";
  hint.textContent = "";
  alertEl.appendChild(hint);

  document.body.appendChild(alertEl);

  // Hidden dismiss button at the very bottom — only you can see/reach it
  const dismissBtn = document.createElement("div");
  dismissBtn.className = "payment-dismiss-btn";
  dismissBtn.textContent = "DISMISS";
  dismissBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    dismissPaymentAlert();
  });
  alertEl.appendChild(dismissBtn);

  // Pulse animation on the amount — keeps it alive visually
  setTimeout(() => {
    amountEl.classList.add("pulse");
  }, 1500);

  // NO auto-dismiss — persists until click, Escape, or page refresh
}

function dismissPaymentAlert() {
  const el = document.getElementById("payment-fullscreen");
  if (el) {
    el.classList.add("fade-out");
    setTimeout(() => {
      if (el.parentNode) el.remove();
    }, 500);
  }
}

// --- Soundcheck / Pre-Show Test (press T) ---

let soundcheckActive = false;
let lastSpeechHeard = "";

// Hook into speech recognition to capture test audio
function onSpeechHeard(text) {
  lastSpeechHeard = text;
  // If soundcheck is showing, update the mic test live
  const micPreview = document.getElementById("soundcheck-mic-preview");
  if (micPreview) {
    micPreview.textContent = '"' + text.slice(0, 80) + '..."';
    micPreview.style.color = "var(--gold)";
  }
  const micStatus = document.getElementById("soundcheck-mic");
  if (micStatus) {
    micStatus.textContent = "✅ MIC: HEARING YOU";
    micStatus.style.color = "#00ff00";
  }
}

async function showSoundcheck() {
  if (soundcheckActive) {
    dismissSoundcheck();
    return;
  }

  soundcheckActive = true;
  stopIdlePopIns();
  isShowingCard = true;

  const container = document.getElementById("main-content");
  if (!container) return;
  clearContainer(container);

  // Soundcheck panel
  const panel = document.createElement("div");
  panel.className = "soundcheck-panel";
  panel.id = "soundcheck-panel";

  // Header
  const header = document.createElement("div");
  header.className = "soundcheck-header slam-in";
  header.textContent = "SOUNDCHECK";
  panel.appendChild(header);

  const subheader = document.createElement("div");
  subheader.className = "soundcheck-subheader";
  subheader.textContent = "PRE-SHOW SYSTEM TEST";
  panel.appendChild(subheader);

  // Status lines — will be populated by results
  const statusLines = [
    { id: "soundcheck-ws", label: "WEBSOCKET", initial: "⏳ CHECKING..." },
    { id: "soundcheck-mic", label: "MICROPHONE", initial: "⏳ SPEAK TO TEST..." },
    { id: "soundcheck-llm", label: "LLM (OPENCLAW)", initial: "⏳ CHECKING..." },
    { id: "soundcheck-red", label: "SHELLY RED", initial: "⏳ CHECKING..." },
    { id: "soundcheck-green", label: "SHELLY GREEN", initial: "⏳ CHECKING..." },
    { id: "soundcheck-email", label: "EMAIL MONITOR", initial: "⏳ CHECKING..." },
    { id: "soundcheck-cache", label: "FACT CACHE", initial: "⏳ CHECKING..." },
    { id: "soundcheck-mood", label: "MOOD SYSTEM", initial: "⏳ CHECKING..." },
    { id: "soundcheck-cred", label: "CREDIBILITY METER", initial: "⏳ CHECKING..." },
    { id: "soundcheck-bingo", label: "CONSPIRACY BINGO", initial: "⏳ CHECKING..." },
    { id: "soundcheck-theme", label: "THEME ENGINE", initial: "⏳ CHECKING..." },
    { id: "soundcheck-graph", label: "CONSPIRACY GRAPH", initial: "⏳ CHECKING..." },
    { id: "soundcheck-hall", label: "HALL OF SHAME", initial: "⏳ CHECKING..." },
    { id: "soundcheck-predict", label: "CLAIM PREDICTOR", initial: "⏳ CHECKING..." },
    { id: "soundcheck-learn", label: "LEARNING SYSTEM", initial: "⏳ CHECKING..." },
    { id: "soundcheck-guests", label: "GUEST SCIENTISTS", initial: "⏳ CHECKING..." },
    { id: "soundcheck-audience", label: "AUDIENCE SYSTEM", initial: "⏳ CHECKING..." },
    { id: "soundcheck-highlights", label: "HIGHLIGHTS GEN", initial: "⏳ CHECKING..." },
  ];

  const statusContainer = document.createElement("div");
  statusContainer.className = "soundcheck-statuses";

  statusLines.forEach((line, i) => {
    const row = document.createElement("div");
    row.className = "soundcheck-row";
    row.style.animationDelay = (i * 0.1) + "s";

    const label = document.createElement("span");
    label.className = "soundcheck-label";
    label.textContent = line.label;

    const status = document.createElement("span");
    status.className = "soundcheck-status";
    status.id = line.id;
    status.textContent = line.initial;

    row.appendChild(label);
    row.appendChild(status);
    statusContainer.appendChild(row);
  });

  panel.appendChild(statusContainer);

  // Mic preview line
  const micPreview = document.createElement("div");
  micPreview.className = "soundcheck-mic-preview";
  micPreview.id = "soundcheck-mic-preview";
  micPreview.textContent = "(say something to test mic)";
  panel.appendChild(micPreview);

  // Test sequence status area
  const testSection = document.createElement("div");
  testSection.className = "soundcheck-test-section";
  testSection.id = "soundcheck-test-section";
  const testHeader = document.createElement("div");
  testHeader.className = "soundcheck-test-header";
  testHeader.textContent = "AUTOMATION TEST";
  testSection.appendChild(testHeader);
  const testLog = document.createElement("div");
  testLog.className = "soundcheck-test-log";
  testLog.id = "soundcheck-test-log";
  testLog.textContent = "⏳ WAITING FOR CHECKS...";
  testSection.appendChild(testLog);
  panel.appendChild(testSection);

  // Dismiss hint
  const hint = document.createElement("div");
  hint.className = "soundcheck-hint";
  hint.textContent = "PRESS T AGAIN OR ESC TO CLOSE";
  panel.appendChild(hint);

  container.appendChild(panel);

  // --- Run checks ---

  // WebSocket — instant check
  const wsEl = document.getElementById("soundcheck-ws");
  if (ws && ws.readyState === WebSocket.OPEN) {
    wsEl.textContent = "✅ CONNECTED";
    wsEl.style.color = "#00ff00";
  } else {
    wsEl.textContent = "❌ DISCONNECTED";
    wsEl.style.color = "#ff4444";
  }

  // Mic — check server-side mic status (mic is on the server now, not browser)
  const micEl = document.getElementById("soundcheck-mic");
  try {
    const statusRes = await fetch("/api/status");
    const status = await statusRes.json();
    const mic = status.mic || {};
    if (mic.active) {
      micEl.textContent = `✅ SERVER MIC: ${mic.mode || 'ACTIVE'} (${mic.transcripts} transcripts)`;
      micEl.style.color = mic.transcripts > 0 ? "#00ff00" : "#ffdd00";
      if (mic.lastHeard) {
        const micPreview = document.getElementById("soundcheck-mic-preview");
        if (micPreview) {
          micPreview.textContent = '"' + mic.lastHeard + '"';
          micPreview.style.color = "var(--gold)";
        }
      }
    } else {
      micEl.textContent = "❌ SERVER MIC NOT ACTIVE";
      micEl.style.color = "#ff4444";
    }
  } catch {
    micEl.textContent = "❌ CANNOT REACH SERVER";
    micEl.style.color = "#ff4444";
  }

  // Server-side checks via /api/soundcheck
  try {
    const res = await fetch("/api/soundcheck");
    const data = await res.json();

    // LLM
    const llmEl = document.getElementById("soundcheck-llm");
    if (data.llm?.status === "ok") {
      llmEl.textContent = "✅ " + data.llm.model.toUpperCase() + " (" + data.llm.latency_ms + "ms)";
      llmEl.style.color = "#00ff00";
    } else {
      llmEl.textContent = "❌ " + (data.llm?.message || "UNREACHABLE");
      llmEl.style.color = "#ff4444";
    }

    // Shelly Red
    const redEl = document.getElementById("soundcheck-red");
    if (data.shelly_red?.status === "ok") {
      redEl.textContent = "✅ CONNECTED (" + data.shelly_red.ip + ")";
      redEl.style.color = "#00ff00";
    } else {
      redEl.textContent = "❌ " + (data.shelly_red?.ip || "") + " UNREACHABLE";
      redEl.style.color = "#ff4444";
    }

    // Shelly Green
    const greenEl = document.getElementById("soundcheck-green");
    if (data.shelly_green?.status === "ok") {
      greenEl.textContent = "✅ CONNECTED (" + data.shelly_green.ip + ")";
      greenEl.style.color = "#00ff00";
    } else {
      greenEl.textContent = "❌ " + (data.shelly_green?.ip || "") + " UNREACHABLE";
      greenEl.style.color = "#ff4444";
    }

    // Email
    const emailEl = document.getElementById("soundcheck-email");
    if (data.email?.status === "configured") {
      emailEl.textContent = "✅ " + data.email.user;
      emailEl.style.color = "#00ff00";
    } else {
      emailEl.textContent = "⚠️ NOT CONFIGURED";
      emailEl.style.color = "#ffdd00";
    }

    // Fact Cache
    const cacheEl = document.getElementById("soundcheck-cache");
    if (data.fact_cache?.status === "ok") {
      cacheEl.textContent = "✅ " + data.fact_cache.categories + " TOPICS, " + data.fact_cache.cards + " CARDS";
      cacheEl.style.color = "#00ff00";
    } else {
      cacheEl.textContent = "❌ NOT LOADED";
      cacheEl.style.color = "#ff4444";
    }

    // === ALL 13 FEATURE SYSTEMS ===
    const systems = [
      { id: "soundcheck-mood", key: "mood", label: "MOOD SYSTEM", ok: d => `${d.label} (energy: ${d.energy})` },
      { id: "soundcheck-cred", key: "credibility", label: "CREDIBILITY METER", ok: d => `${d.value}%` },
      { id: "soundcheck-bingo", key: "bingo", label: "CONSPIRACY BINGO", ok: d => `${d.hits}/${d.squares} SQUARES` },
      { id: "soundcheck-theme", key: "theme", label: "THEME ENGINE", ok: d => d.name || 'DEFAULT' },
      { id: "soundcheck-graph", key: "conspiracy_graph", label: "CONSPIRACY GRAPH", ok: d => `${d.nodes} NODES, ${d.edges} EDGES` },
      { id: "soundcheck-hall", key: "hall_of_shame", label: "HALL OF SHAME", ok: d => `${d.entries} PAST CHALLENGERS` },
      { id: "soundcheck-predict", key: "predictor", label: "CLAIM PREDICTOR", ok: d => `${d.chains} CHAINS` },
      { id: "soundcheck-learn", key: "learning", label: "LEARNING SYSTEM", ok: () => 'TRACKING' },
      { id: "soundcheck-guests", key: "guests", label: "GUEST SCIENTISTS", ok: d => `${d.available} AVAILABLE` },
      { id: "soundcheck-audience", key: "audience", label: "AUDIENCE PARTICIPATION", ok: () => 'READY' },
      { id: "soundcheck-highlights", key: "highlights", label: "HIGHLIGHTS GENERATOR", ok: () => 'READY' },
    ];

    for (const sys of systems) {
      const el = document.getElementById(sys.id);
      if (!el) continue;
      const sysData = data[sys.key];
      if (sysData?.status === "ok") {
        el.textContent = "✅ " + sys.ok(sysData);
        el.style.color = "#00ff00";
      } else {
        el.textContent = "❌ NOT LOADED";
        el.style.color = "#ff4444";
      }
    }
  } catch (err) {
    // Server unreachable
    ["soundcheck-llm", "soundcheck-red", "soundcheck-green", "soundcheck-email", "soundcheck-cache"].forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        el.textContent = "❌ SERVER ERROR";
        el.style.color = "#ff4444";
      }
    });
  }

  // --- AUTOMATION TEST SEQUENCE ---
  await runAutomationTest();
}

async function runAutomationTest() {
  const log = document.getElementById("soundcheck-test-log");
  if (!log) return;

  function logLine(text, color) {
    const line = document.createElement("div");
    line.textContent = text;
    line.style.color = color || "#ffffff";
    log.appendChild(line);
    log.scrollTop = log.scrollHeight;
  }

  log.textContent = "";
  logLine("▶ STARTING AUTOMATION TEST...", "var(--gold)");

  // Step 1: Flash Shelly lights via server
  logLine("⏳ FLASHING SHELLY LIGHTS...", "#ffdd00");
  try {
    const lightRes = await fetch("/api/soundcheck/test", { method: "POST" });
    const lightData = await lightRes.json();

    if (lightData.shelly_red === "flashed") {
      logLine("✅ RED LIGHT FLASHED", "#00ff00");
    } else {
      logLine("❌ RED LIGHT: " + lightData.shelly_red, "#ff4444");
    }
    if (lightData.shelly_green === "flashed") {
      logLine("✅ GREEN LIGHT FLASHED", "#00ff00");
    } else {
      logLine("❌ GREEN LIGHT: " + lightData.shelly_green, "#ff4444");
    }
    if (lightData.llm === "ok") {
      logLine("✅ LLM RESPONSE: " + lightData.llm_latency_ms + "ms", "#00ff00");
    } else {
      logLine("❌ LLM: " + lightData.llm, "#ff4444");
    }
  } catch (err) {
    logLine("❌ LIGHT TEST FAILED: " + err.message, "#ff4444");
  }

  // Step 2: Test fact card (3s display)
  logLine("⏳ TEST FACT CARD IN 2s...", "#ffdd00");
  await new Promise(r => setTimeout(r, 2000));

  // Temporarily show a test card — but put soundcheck back after
  const container = document.getElementById("main-content");
  const soundcheckPanel = document.getElementById("soundcheck-panel");
  if (soundcheckPanel) soundcheckPanel.style.display = "none";

  showFactCard({
    claim: "TEST: EARTH IS FLAT",
    verdict: "FALSE",
    fact: "SOUNDCHECK — IF YOU CAN READ THIS, CARDS ARE WORKING",
    humor: "THIS IS A TEST. THIS IS ONLY A TEST.",
    source: "SOUNDCHECK SYSTEM"
  });

  // Wait for card to display, then bring soundcheck back
  await new Promise(r => setTimeout(r, 5000));

  if (container) clearContainer(container);
  if (soundcheckPanel) {
    container.appendChild(soundcheckPanel);
    soundcheckPanel.style.display = "";
  }

  // Step 3: Test payment popup (3s display)
  logLine("✅ FACT CARD: RENDERED", "#00ff00");
  logLine("⏳ TEST DONATION POPUP IN 2s...", "#ffdd00");
  await new Promise(r => setTimeout(r, 2000));

  showPaymentAlert({
    source: "SOUNDCHECK",
    name: "TEST DONOR",
    amount: "$99.99",
    message: "IF YOU CAN READ THIS, DONATIONS WORK"
  });

  await new Promise(r => setTimeout(r, 4000));
  dismissPaymentAlert();

  logLine("✅ DONATION POPUP: RENDERED", "#00ff00");
  logLine("", "");
  // Step 4: Sound effects test
  logLine("⏳ TESTING SOUND EFFECTS...", "#ffdd00");
  await SFX.testAll();
  logLine("✅ SOUND EFFECTS: ALL PLAYED", "#00ff00");

  // Step 5: Marie TTS test
  logLine("", "");
  logLine("⏳ TESTING MARIE TTS...", "#ffdd00");
  try {
    const rosRes = await fetch("/api/marie/test", { method: "POST" });
    const rosData = await rosRes.json();
    if (rosData.ok && rosData.audioUrl) {
      logLine("✅ MARIE TTS: GENERATED " + rosData.audioUrl, "#00ff00");
      logLine("⏳ PLAYING MARIE...", "#ffdd00");
      // The server broadcast tts_ready which triggers Marie.speak via WebSocket
      // But also play directly as backup
      await Marie.speak(rosData.audioUrl, "CLAIM: VACCINES CAUSE AUTISM. VERDICT: DEBUNKED.");
      logLine("✅ MARIE: SPOKE!", "#00ff00");
    } else {
      logLine("❌ MARIE TTS: " + (rosData.error || "FAILED"), "#ff4444");
    }
  } catch (err) {
    logLine("❌ MARIE TTS: " + err.message, "#ff4444");
  }

  // Step 6: Marie conversation test
  logLine("", "");
  logLine("⏳ TESTING MARIE CONVERSATION...", "#ffdd00");
  try {
    const convRes = await fetch("/api/marie/speak", { method: "POST" });
    const convData = await convRes.json();
    if (convData.ok && convData.audioUrl) {
      logLine("✅ MARIE SAYS: " + convData.text, "#00ff00");
      await Marie.speak(convData.audioUrl, convData.text);
      logLine("✅ MARIE CONVERSATION: WORKING", "#00ff00");
    } else {
      logLine("❌ MARIE CONVERSATION: " + (convData.error || "FAILED"), "#ff4444");
    }
  } catch (err) {
    logLine("❌ MARIE CONVERSATION: " + err.message, "#ff4444");
  }

  logLine("", "");
  logLine("✅ ALL TESTS COMPLETE", "#00ff00");
  logLine("PRESS T OR ESC TO EXIT", "rgba(255,255,255,0.3)");
}

function dismissSoundcheck() {
  soundcheckActive = false;
  const container = document.getElementById("main-content");
  if (container) clearContainer(container);
  isShowingCard = false;
  startIdlePopIns();
}

// --- Debate Prompt Cycle (Marie reads them) ---

async function startPromptCycle() {
  stopIdlePopIns();
  isShowingCard = true;
  window._promptCycleActive = true;

  const container = document.getElementById("main-content");
  if (!container) return;

  for (let i = 0; i < DEBATE_PROMPTS.length; i++) {
    if (!window._promptCycleActive) break; // stopped by "marie stop"

    const prompt = DEBATE_PROMPTS[i];
    clearContainer(container);

    // Show prompt full screen — BIG text
    const el = document.createElement("div");
    el.className = "debate-prompt slam-in";
    el.textContent = prompt;
    container.appendChild(el);

    // Tell server to have Marie read this one (uses pre-cached TTS = instant)
    fetch("/api/debate-prompt", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt }),
    }).catch(() => {});

    // Fast — 3 seconds per prompt, no dead air
    await new Promise(r => setTimeout(r, 3000));

    if (!window._promptCycleActive) break;

    // Instant swap
    el.classList.add("fade-out");
    await new Promise(r => setTimeout(r, 200));
  }

  // Done cycling
  window._promptCycleActive = false;
  if (container) clearContainer(container);
  isShowingCard = false;
  startIdlePopIns();
}

// ===========================================
// FEATURE #1: CONSPIRACY BINGO BOARD
// ===========================================

let bingoState = { squares: [], hits: [] };

function initBingoBoard() {
  let board = document.getElementById("bingo-board");
  if (board) return board;
  board = document.createElement("div");
  board.id = "bingo-board";
  board.className = "bingo-board";
  document.body.appendChild(board);
  return board;
}

function updateBingoBoard(data) {
  bingoState = data;
  const board = initBingoBoard();
  board.innerHTML = "";

  const header = document.createElement("div");
  header.className = "bingo-header";
  header.textContent = "CONSPIRACY BINGO";
  board.appendChild(header);

  const grid = document.createElement("div");
  grid.className = "bingo-grid";

  (data.squares || []).forEach((sq, i) => {
    const cell = document.createElement("div");
    cell.className = "bingo-cell" + ((data.hits || []).includes(i) ? " hit" : "");
    cell.textContent = sq;
    grid.appendChild(cell);
  });

  board.appendChild(grid);
  board.style.display = "block";
}

function animateBingoHit(data) {
  const cells = document.querySelectorAll(".bingo-cell");
  if (cells[data.index]) {
    cells[data.index].classList.add("hit", "slam-in");
    SFX.factCheck();
  }
}

function showBingoComplete(data) {
  const board = document.getElementById("bingo-board");
  if (!board) return;
  const banner = document.createElement("div");
  banner.className = "bingo-complete slam-in";
  banner.textContent = "BINGO!";
  board.appendChild(banner);
  SFX.reportCard();
}

// ===========================================
// FEATURE #2: CREDIBILITY METER
// ===========================================

let credibilityValue = 50;

function initCredibilityMeter() {
  let meter = document.getElementById("credibility-meter");
  if (meter) return meter;
  meter = document.createElement("div");
  meter.id = "credibility-meter";
  meter.className = "credibility-meter";
  meter.innerHTML = `
    <div class="cred-label">CREDIBILITY</div>
    <div class="cred-bar-bg">
      <div class="cred-bar-fill" id="cred-bar-fill" style="width:50%"></div>
    </div>
    <div class="cred-value" id="cred-value">50%</div>
  `;
  document.body.appendChild(meter);
  return meter;
}

function updateCredibilityMeter(data) {
  const meter = initCredibilityMeter();
  const targetVal = Math.max(0, Math.min(100, data.value || 0));
  const fill = document.getElementById("cred-bar-fill");
  const valueEl = document.getElementById("cred-value");

  // Animate the transition
  const startVal = credibilityValue;
  const diff = targetVal - startVal;
  const duration = 1000;
  const startTime = Date.now();

  function animate() {
    const elapsed = Date.now() - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
    const current = Math.round(startVal + diff * eased);

    if (fill) {
      fill.style.width = current + "%";
      // Color shifts: green > 60, yellow 30-60, red < 30
      if (current > 60) fill.style.background = "#00cc44";
      else if (current > 30) fill.style.background = "#FFD700";
      else fill.style.background = "#BF0A30";
    }
    if (valueEl) valueEl.textContent = current + "%";

    if (progress < 1) requestAnimationFrame(animate);
    else credibilityValue = targetVal;
  }
  animate();

  meter.style.display = "flex";

  // Flash if dropped below threshold
  if (targetVal < 20 && credibilityValue >= 20) {
    meter.classList.add("shake");
    setTimeout(() => meter.classList.remove("shake"), 500);
  }
}

// ===========================================
// FEATURE #3: MARIE MOOD INDICATOR
// ===========================================

const MOOD_COLORS = {
  curious: "#4488ff",
  amused: "#FFD700",
  frustrated: "#BF0A30",
  furious: "#ff0000",
  impressed: "#00cc44",
  bored: "#888888",
  excited: "#ff8800",
  fierce: "#ff00ff",
};

function updateMoodIndicator(data) {
  let indicator = document.getElementById("mood-indicator");
  if (!indicator) {
    indicator = document.createElement("div");
    indicator.id = "mood-indicator";
    indicator.className = "mood-indicator";
    document.body.appendChild(indicator);
  }

  const color = MOOD_COLORS[data.mood] || "#FFD700";
  indicator.textContent = (data.label || data.mood || "").toUpperCase();
  indicator.style.borderColor = color;
  indicator.style.color = color;
  indicator.style.display = "block";

  // Pulse on mood change
  indicator.classList.remove("bounce-in");
  void indicator.offsetWidth;
  indicator.classList.add("bounce-in");

  // Update Marie avatar glow
  const avatar = document.getElementById("marie-avatar");
  if (avatar) {
    avatar.style.filter = `drop-shadow(0 0 15px ${color})`;
  }
}

// ===========================================
// FEATURE #4: CONSPIRACY NETWORK GRAPH
// ===========================================

let graphCanvas = null;
let graphNodes = [];
let graphEdges = [];

function updateConspiracyGraph(data) {
  graphNodes = data.nodes || [];
  graphEdges = data.edges || [];

  if (!graphCanvas) {
    graphCanvas = document.createElement("canvas");
    graphCanvas.id = "conspiracy-graph-canvas";
    graphCanvas.className = "conspiracy-graph-canvas";
    graphCanvas.width = 1080;
    graphCanvas.height = 400;
    document.body.appendChild(graphCanvas);
  }

  drawGraph();
}

function drawGraph() {
  if (!graphCanvas || graphNodes.length === 0) return;
  const ctx = graphCanvas.getContext("2d");
  ctx.clearRect(0, 0, 1080, 400);

  // Position nodes in a circle
  const cx = 540, cy = 200, radius = 150;
  const positions = graphNodes.map((n, i) => {
    const angle = (i / graphNodes.length) * Math.PI * 2 - Math.PI / 2;
    return { x: cx + Math.cos(angle) * radius, y: cy + Math.sin(angle) * radius, label: n.label, weight: n.weight || 1 };
  });

  // Draw edges
  ctx.strokeStyle = "rgba(191, 10, 48, 0.4)";
  ctx.lineWidth = 2;
  for (const edge of graphEdges) {
    const from = positions[edge.from];
    const to = positions[edge.to];
    if (from && to) {
      ctx.beginPath();
      ctx.moveTo(from.x, from.y);
      ctx.lineTo(to.x, to.y);
      ctx.stroke();
    }
  }

  // Draw nodes
  for (const pos of positions) {
    const r = 8 + pos.weight * 4;
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, r, 0, Math.PI * 2);
    ctx.fillStyle = "#BF0A30";
    ctx.fill();
    ctx.strokeStyle = "#FFD700";
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = "#FFFFFF";
    ctx.font = "bold 14px Oswald";
    ctx.textAlign = "center";
    ctx.fillText(pos.label, pos.x, pos.y - r - 6);
  }

  graphCanvas.style.display = "block";
}

// ===========================================
// FEATURE #5: CHALLENGER ENTRANCE
// ===========================================

function showChallengerEntrance(data) {
  stopIdlePopIns();
  isShowingCard = true;
  SFX.sessionStart();

  const container = document.getElementById("main-content");
  if (!container) return;
  clearContainer(container);

  // Full entrance screen
  const entrance = document.createElement("div");
  entrance.className = "challenger-entrance";

  const announce = document.createElement("div");
  announce.className = "entrance-announce bounce-in";
  announce.textContent = "ENTERING THE ARENA";

  const intro = document.createElement("div");
  intro.className = "entrance-intro slam-in";
  intro.textContent = data.intro || "A NEW CHALLENGER APPROACHES";

  const nickname = document.createElement("div");
  nickname.className = "entrance-nickname slam-in";
  nickname.textContent = (data.nickname || "CHALLENGER").toUpperCase();

  entrance.appendChild(announce);
  container.appendChild(entrance);

  // Stagger animations
  setTimeout(() => entrance.appendChild(intro), 1500);
  setTimeout(() => entrance.appendChild(nickname), 3000);

  // Fade out after 6 seconds → session starts
  setTimeout(() => {
    entrance.classList.add("fade-out");
    setTimeout(() => {
      clearContainer(container);
      isShowingCard = false;
      handleSessionStart();
    }, 1000);
  }, 6000);
}

// ===========================================
// FEATURE #6: DYNAMIC THEMES
// ===========================================

function applyDynamicTheme(data) {
  const root = document.documentElement;
  if (data.primary) root.style.setProperty("--deep", data.primary);
  if (data.accent) root.style.setProperty("--gold", data.accent);
  if (data.danger) root.style.setProperty("--red", data.danger);

  // Add theme class for CSS-level changes
  document.body.className = document.body.className.replace(/theme-\S+/g, "");
  if (data.name) document.body.classList.add("theme-" + data.name.toLowerCase().replace(/\s+/g, "-"));
}

// ===========================================
// FEATURE #7: PREDICTIVE CLAIM DETECTION
// ===========================================

function showPrediction(data) {
  let el = document.getElementById("prediction-banner");
  if (!el) {
    el = document.createElement("div");
    el.id = "prediction-banner";
    el.className = "prediction-banner";
    document.body.appendChild(el);
  }

  el.textContent = "MARIE PREDICTS: " + (data.predicted || "").toUpperCase();
  el.style.display = "block";
  el.classList.remove("slide-in");
  void el.offsetWidth;
  el.classList.add("slide-in");

  // Auto-hide after 8s
  setTimeout(() => {
    el.classList.add("fade-out");
    setTimeout(() => {
      el.style.display = "none";
      el.classList.remove("fade-out");
    }, 500);
  }, 8000);
}

// ===========================================
// FEATURE #8: AUDIENCE PARTICIPATION
// ===========================================

function showAudienceQuestion(data) {
  let overlay = document.getElementById("audience-overlay");
  if (!overlay) {
    overlay = document.createElement("div");
    overlay.id = "audience-overlay";
    overlay.className = "audience-overlay";
    document.body.appendChild(overlay);
  }

  overlay.innerHTML = "";
  const badge = document.createElement("div");
  badge.className = "audience-badge bounce-in";
  badge.textContent = "AUDIENCE ASKS";

  const question = document.createElement("div");
  question.className = "audience-question slam-in";
  question.textContent = (data.question || "").toUpperCase();

  const from = document.createElement("div");
  from.className = "audience-from";
  from.textContent = "— " + (data.from || "VIEWER").toUpperCase();

  overlay.appendChild(badge);
  overlay.appendChild(question);
  overlay.appendChild(from);
  overlay.style.display = "flex";

  // Auto-hide after 12s
  setTimeout(() => {
    overlay.classList.add("fade-out");
    setTimeout(() => {
      overlay.style.display = "none";
      overlay.classList.remove("fade-out");
    }, 500);
  }, 12000);
}

// ===========================================
// FEATURE #9: POST-SHOW HIGHLIGHTS
// ===========================================

function showHighlights(data) {
  stopIdlePopIns();
  isShowingCard = true;

  const container = document.getElementById("main-content");
  if (!container) return;
  clearContainer(container);

  const panel = document.createElement("div");
  panel.className = "highlights-panel";

  const header = document.createElement("div");
  header.className = "highlights-header slam-in";
  header.textContent = "SHOW HIGHLIGHTS";
  panel.appendChild(header);

  const items = data.highlights || [];
  items.forEach((item, i) => {
    setTimeout(() => {
      const line = document.createElement("div");
      line.className = "highlights-item bounce-in";
      line.textContent = item;
      panel.appendChild(line);
    }, 1500 + i * 1200);
  });

  // Best one-liner
  if (data.bestLine) {
    setTimeout(() => {
      const best = document.createElement("div");
      best.className = "highlights-best slam-in";
      best.textContent = '"' + data.bestLine + '"';
      panel.appendChild(best);
    }, 1500 + items.length * 1200 + 2000);
  }

  container.appendChild(panel);

  // Fade after all shown + 10s hold
  const totalTime = 1500 + items.length * 1200 + 12000;
  setTimeout(() => {
    panel.classList.add("fade-out");
    setTimeout(() => {
      clearContainer(container);
      isShowingCard = false;
      showAdScreen();
    }, 1000);
  }, totalTime);
}

// ===========================================
// FEATURE #10: GUEST SCIENTIST INTRO
// ===========================================

function showGuestScientist(data) {
  let overlay = document.getElementById("guest-overlay");
  if (!overlay) {
    overlay = document.createElement("div");
    overlay.id = "guest-overlay";
    overlay.className = "guest-overlay";
    document.body.appendChild(overlay);
  }

  overlay.innerHTML = "";

  const badge = document.createElement("div");
  badge.className = "guest-badge bounce-in";
  badge.textContent = "CALLING IN BACKUP";

  const name = document.createElement("div");
  name.className = "guest-name slam-in";
  name.textContent = (data.name || "").toUpperCase();

  const title = document.createElement("div");
  title.className = "guest-title";
  title.textContent = (data.title || "").toUpperCase();

  const specialty = document.createElement("div");
  specialty.className = "guest-specialty";
  specialty.textContent = (data.specialty || "").toUpperCase();

  overlay.appendChild(badge);
  setTimeout(() => overlay.appendChild(name), 1000);
  setTimeout(() => overlay.appendChild(title), 2000);
  setTimeout(() => overlay.appendChild(specialty), 2500);

  overlay.style.display = "flex";
  SFX.sessionStart();

  // Auto-hide after 8s
  setTimeout(() => {
    overlay.classList.add("fade-out");
    setTimeout(() => {
      overlay.style.display = "none";
      overlay.classList.remove("fade-out");
    }, 500);
  }, 8000);
}

// ===========================================
// MARIE-HOSTED QUIZ SYSTEM
// ===========================================

let quizTimerInterval = null;
let quizData = null;

function showQuiz(data) {
  stopIdlePopIns();
  isShowingCard = true;
  if (quizTimerInterval) clearInterval(quizTimerInterval);
  quizData = data;

  const container = document.getElementById("main-content");
  if (!container) return;
  clearContainer(container);

  const card = document.createElement("div");
  card.className = "quiz-card";
  card.id = "quiz-card";

  // POP QUIZ header
  const header = document.createElement("div");
  header.className = "quiz-header slam-in";
  header.textContent = "POP QUIZ";
  card.appendChild(header);

  // Question
  const question = document.createElement("div");
  question.className = "quiz-question bounce-in";
  question.textContent = (data.question || "").toUpperCase();
  card.appendChild(question);

  // Options — ALL 3 VISIBLE for the entire 30 seconds
  const optionsContainer = document.createElement("div");
  optionsContainer.className = "quiz-options";
  optionsContainer.id = "quiz-options";
  const labels = ["A", "B", "C"];
  (data.options || []).forEach((opt, i) => {
    const optEl = document.createElement("div");
    optEl.className = "quiz-option bounce-in";
    optEl.id = "quiz-option-" + i;
    optEl.style.animationDelay = (0.3 + i * 0.15) + "s";
    const labelEl = document.createElement("span");
    labelEl.className = "quiz-option-label";
    labelEl.textContent = labels[i];
    const textEl = document.createElement("span");
    textEl.className = "quiz-option-text";
    textEl.textContent = (opt || "").toUpperCase();
    optEl.appendChild(labelEl);
    optEl.appendChild(textEl);
    optionsContainer.appendChild(optEl);
  });
  card.appendChild(optionsContainer);

  // CTA — always visible during countdown
  const cta = document.createElement("div");
  cta.className = "quiz-cta";
  cta.id = "quiz-cta";
  cta.innerHTML = '<span class="quiz-cta-main">TYPE A, B, OR C IN CHAT!</span><span class="quiz-cta-sub">ANSWER REVEALS IN 30 SECONDS</span>';
  card.appendChild(cta);

  // Timer bar with time display
  const timerWrap = document.createElement("div");
  timerWrap.className = "quiz-timer-wrap";
  timerWrap.id = "quiz-timer-wrap";
  const timerBar = document.createElement("div");
  timerBar.className = "quiz-timer-bar";
  timerBar.id = "quiz-timer-bar";
  timerWrap.appendChild(timerBar);
  const timerText = document.createElement("div");
  timerText.className = "quiz-timer-text";
  timerText.id = "quiz-timer-text";
  timerText.textContent = "0:" + String(data.seconds || 30).padStart(2, "0");
  timerWrap.appendChild(timerText);
  card.appendChild(timerWrap);

  // Answer reveal container — hidden, slides up on reveal
  const revealEl = document.createElement("div");
  revealEl.className = "quiz-reveal";
  revealEl.id = "quiz-reveal";
  card.appendChild(revealEl);

  container.appendChild(card);

  // Countdown from 30s
  let remaining = data.seconds || 30;
  const total = remaining;
  quizTimerInterval = setInterval(() => {
    remaining--;
    const pct = (remaining / total) * 100;
    const bar = document.getElementById("quiz-timer-bar");
    const text = document.getElementById("quiz-timer-text");
    if (bar) bar.style.width = pct + "%";
    if (text) text.textContent = "0:" + String(remaining).padStart(2, "0");

    // Color shift as time runs out
    if (bar) {
      if (remaining <= 5) bar.style.background = "var(--red)";
      else if (remaining <= 10) bar.style.background = "var(--gold)";
    }

    // Timer shake at 5s
    if (remaining === 5) {
      const wrap = document.getElementById("quiz-timer-wrap");
      if (wrap) wrap.classList.add("shake");
    }

    if (remaining <= 0) {
      clearInterval(quizTimerInterval);
      quizTimerInterval = null;
      // Server will send quiz_reveal
    }
  }, 1000);
}

function revealQuizAnswer(data) {
  if (quizTimerInterval) { clearInterval(quizTimerInterval); quizTimerInterval = null; }

  const answerIndex = data.answer;
  const labels = ["A", "B", "C"];
  SFX.verdict();

  // Highlight correct answer green, fade wrong ones
  const options = document.querySelectorAll(".quiz-option");
  options.forEach((opt, i) => {
    if (i === answerIndex) {
      opt.classList.add("quiz-correct");
    } else {
      opt.classList.add("quiz-wrong");
    }
  });

  // Hide CTA
  const cta = document.getElementById("quiz-cta");
  if (cta) cta.style.display = "none";

  // Hide timer
  const timerWrap = document.getElementById("quiz-timer-wrap");
  if (timerWrap) timerWrap.style.display = "none";

  // Slide in the answer explanation from bottom
  const revealEl = document.getElementById("quiz-reveal");
  if (revealEl) {
    const answerLetter = labels[answerIndex] || "?";
    const answerText = (data.options && data.options[answerIndex]) ? data.options[answerIndex] : "";
    revealEl.innerHTML =
      '<div class="quiz-reveal-label">ANSWER</div>' +
      '<div class="quiz-reveal-answer">' + answerLetter + ": " + (answerText).toUpperCase() + '</div>' +
      '<div class="quiz-reveal-explanation">' + (data.explanation || "").toUpperCase() + '</div>';
    revealEl.classList.add("show");
  }

  // Hold 12 seconds then fade out
  const card = document.getElementById("quiz-card");
  setTimeout(() => {
    if (card) card.classList.add("fade-out");
    setTimeout(() => {
      const container = document.getElementById("main-content");
      if (container) clearContainer(container);
      isShowingCard = false;
      startIdlePopIns();
    }, 1000);
  }, 12000);
}

// --- New Card Display Functions ---

function showThisOrThat(data) {
  stopIdlePopIns();
  isShowingCard = true;
  if (quizTimerInterval) clearInterval(quizTimerInterval);

  const container = document.getElementById("main-content");
  if (!container) return;
  clearContainer(container);

  const card = document.createElement("div");
  card.className = "tot-card";
  card.id = "tot-card";

  // Header
  const header = document.createElement("div");
  header.className = "tot-header slam-in";
  header.textContent = "THIS OR THAT";
  card.appendChild(header);

  // Question
  const question = document.createElement("div");
  question.className = "tot-question bounce-in";
  question.textContent = (data.question || "").toUpperCase();
  card.appendChild(question);

  // VS layout
  const vsWrap = document.createElement("div");
  vsWrap.className = "tot-vs-wrap";

  const optA = document.createElement("div");
  optA.className = "tot-option-box tot-option-a bounce-in";
  optA.innerHTML =
    '<span class="tot-emoji">' + (data.emojiA || "A") + '</span>' +
    '<span class="tot-label">' + (data.labelA || "OPTION A").toUpperCase() + '</span>' +
    '<span class="tot-letter">A</span>';

  const vsDivider = document.createElement("div");
  vsDivider.className = "tot-vs-divider";
  vsDivider.textContent = "VS";

  const optB = document.createElement("div");
  optB.className = "tot-option-box tot-option-b bounce-in";
  optB.innerHTML =
    '<span class="tot-emoji">' + (data.emojiB || "B") + '</span>' +
    '<span class="tot-label">' + (data.labelB || "OPTION B").toUpperCase() + '</span>' +
    '<span class="tot-letter">B</span>';

  vsWrap.appendChild(optA);
  vsWrap.appendChild(vsDivider);
  vsWrap.appendChild(optB);
  card.appendChild(vsWrap);

  // CTA
  const cta = document.createElement("div");
  cta.className = "tot-cta";
  cta.id = "tot-cta";
  cta.innerHTML = '<span class="tot-cta-main">TYPE A OR B IN CHAT!</span>';
  card.appendChild(cta);

  // Timer
  const timerWrap = document.createElement("div");
  timerWrap.className = "quiz-timer-wrap";
  timerWrap.id = "tot-timer-wrap";
  const timerBar = document.createElement("div");
  timerBar.className = "quiz-timer-bar";
  timerBar.id = "tot-timer-bar";
  timerWrap.appendChild(timerBar);
  const timerText = document.createElement("div");
  timerText.className = "quiz-timer-text";
  timerText.id = "tot-timer-text";
  timerText.textContent = "0:20";
  timerWrap.appendChild(timerText);
  card.appendChild(timerWrap);

  // Reveal container
  const revealEl = document.createElement("div");
  revealEl.className = "tot-reveal";
  revealEl.id = "tot-reveal";
  card.appendChild(revealEl);

  container.appendChild(card);

  // 20s countdown
  let remaining = data.seconds || 20;
  const total = remaining;
  quizTimerInterval = setInterval(() => {
    remaining--;
    const pct = (remaining / total) * 100;
    const bar = document.getElementById("tot-timer-bar");
    const text = document.getElementById("tot-timer-text");
    if (bar) bar.style.width = pct + "%";
    if (text) text.textContent = "0:" + String(remaining).padStart(2, "0");
    if (bar) {
      if (remaining <= 5) bar.style.background = "var(--red)";
      else if (remaining <= 10) bar.style.background = "var(--gold)";
    }
    if (remaining <= 0) {
      clearInterval(quizTimerInterval);
      quizTimerInterval = null;
      // Auto-reveal
      revealThisOrThat(data);
    }
  }, 1000);
}

function revealThisOrThat(data) {
  if (quizTimerInterval) { clearInterval(quizTimerInterval); quizTimerInterval = null; }
  SFX.verdict();

  const cta = document.getElementById("tot-cta");
  if (cta) cta.style.display = "none";
  const timerWrap = document.getElementById("tot-timer-wrap");
  if (timerWrap) timerWrap.style.display = "none";

  const revealEl = document.getElementById("tot-reveal");
  if (revealEl) {
    revealEl.innerHTML =
      '<div class="tot-reveal-label">ANSWER</div>' +
      '<div class="tot-reveal-answer">' + (data.answer || "").toUpperCase() + '</div>' +
      '<div class="tot-reveal-explanation">' + (data.explanation || "").toUpperCase() + '</div>';
    revealEl.classList.add("show");
  }

  const card = document.getElementById("tot-card");
  setTimeout(() => {
    if (card) card.classList.add("fade-out");
    setTimeout(() => {
      const container = document.getElementById("main-content");
      if (container) clearContainer(container);
      isShowingCard = false;
      startIdlePopIns();
    }, 1000);
  }, 12000);
}

function showScienceFact(data) {
  stopIdlePopIns();
  isShowingCard = true;

  const container = document.getElementById("main-content");
  if (!container) return;
  clearContainer(container);

  const card = document.createElement("div");
  card.className = "science-fact-card";
  card.id = "science-fact-card";

  const header = document.createElement("div");
  header.className = "sf-header slam-in";
  header.textContent = "SCIENCE FACT";
  card.appendChild(header);

  const icon = document.createElement("div");
  icon.className = "sf-icon bounce-in";
  icon.textContent = data.icon || "\uD83E\uDDEC";
  card.appendChild(icon);

  const title = document.createElement("div");
  title.className = "sf-title bounce-in";
  title.textContent = (data.title || "").toUpperCase();
  card.appendChild(title);

  const body = document.createElement("div");
  body.className = "sf-body bounce-in";
  body.textContent = (data.body || data.description || "").toUpperCase();
  card.appendChild(body);

  if (data.source) {
    const source = document.createElement("div");
    source.className = "sf-source";
    source.textContent = "SOURCE: " + (data.source || "").toUpperCase();
    card.appendChild(source);
  }

  container.appendChild(card);

  // Hold 15 seconds then fade
  setTimeout(() => {
    card.classList.add("fade-out");
    setTimeout(() => {
      clearContainer(container);
      isShowingCard = false;
      startIdlePopIns();
    }, 1000);
  }, 15000);
}

function showMythBuster(data) {
  stopIdlePopIns();
  isShowingCard = true;

  const container = document.getElementById("main-content");
  if (!container) return;
  clearContainer(container);

  const card = document.createElement("div");
  card.className = "myth-buster-card";
  card.id = "myth-buster-card";

  const header = document.createElement("div");
  header.className = "myth-header slam-in";
  header.textContent = "MYTH BUSTED";
  card.appendChild(header);

  // Verdict badge
  const verdictClass = (data.verdict || "").toLowerCase() === "false" ? "myth-false" :
    (data.verdict || "").toLowerCase() === "misleading" ? "myth-misleading" : "myth-misunderstood";
  const verdict = document.createElement("div");
  verdict.className = "myth-verdict-badge " + verdictClass;
  verdict.textContent = (data.verdict || "FALSE").toUpperCase();
  card.appendChild(verdict);

  // The myth claim
  const claim = document.createElement("div");
  claim.className = "myth-claim bounce-in";
  claim.textContent = "\u201C" + (data.myth || data.claim || "").toUpperCase() + "\u201D";
  card.appendChild(claim);

  // Conspiracy context
  if (data.conspiracy) {
    const conspiracy = document.createElement("div");
    conspiracy.className = "myth-conspiracy";
    conspiracy.textContent = (data.conspiracy || "").toUpperCase();
    card.appendChild(conspiracy);
  }

  // The actual science
  const scienceLabel = document.createElement("div");
  scienceLabel.className = "myth-science-label";
  scienceLabel.textContent = "THE ACTUAL SCIENCE";
  card.appendChild(scienceLabel);

  const science = document.createElement("div");
  science.className = "myth-science bounce-in";
  science.textContent = (data.science || data.fact || "").toUpperCase();
  card.appendChild(science);

  if (data.evidence) {
    const evidence = document.createElement("div");
    evidence.className = "myth-evidence";
    evidence.textContent = "EVIDENCE: " + (data.evidence || "").toUpperCase();
    card.appendChild(evidence);
  }

  container.appendChild(card);

  setTimeout(() => {
    card.classList.add("fade-out");
    setTimeout(() => {
      clearContainer(container);
      isShowingCard = false;
      startIdlePopIns();
    }, 1000);
  }, 18000);
}

function showScientistSpotlight(data) {
  stopIdlePopIns();
  isShowingCard = true;

  const container = document.getElementById("main-content");
  if (!container) return;
  clearContainer(container);

  const card = document.createElement("div");
  card.className = "spotlight-card";
  card.id = "spotlight-card";

  const header = document.createElement("div");
  header.className = "spot-header slam-in";
  header.textContent = "SCIENTIST SPOTLIGHT";
  card.appendChild(header);

  if (data.image || data.img) {
    const img = document.createElement("img");
    img.className = "spot-photo";
    img.src = data.image || data.img;
    img.alt = data.name || "";
    img.onerror = function() { this.style.display = "none"; };
    card.appendChild(img);
  }

  const name = document.createElement("div");
  name.className = "spot-name bounce-in";
  name.textContent = (data.name || "").toUpperCase();
  card.appendChild(name);

  if (data.title) {
    const title = document.createElement("div");
    title.className = "spot-title";
    title.textContent = (data.title || "").toUpperCase();
    card.appendChild(title);
  }

  if (data.institution || data.inst) {
    const inst = document.createElement("div");
    inst.className = "spot-inst";
    inst.textContent = (data.institution || data.inst || "").toUpperCase();
    card.appendChild(inst);
  }

  if (data.tags && data.tags.length) {
    const tagsWrap = document.createElement("div");
    tagsWrap.className = "spot-tags";
    data.tags.forEach(function(t) {
      const tag = document.createElement("span");
      tag.className = "spot-tag";
      tag.textContent = t.toUpperCase();
      tagsWrap.appendChild(tag);
    });
    card.appendChild(tagsWrap);
  }

  if (data.breakthrough) {
    const btWrap = document.createElement("div");
    btWrap.className = "spot-breakthrough";
    btWrap.innerHTML =
      '<div class="spot-bt-label">LATEST BREAKTHROUGH</div>' +
      '<div class="spot-bt-text">' + (data.breakthrough || "").toUpperCase() + '</div>';
    card.appendChild(btWrap);
  }

  container.appendChild(card);

  setTimeout(() => {
    card.classList.add("fade-out");
    setTimeout(() => {
      clearContainer(container);
      isShowingCard = false;
      startIdlePopIns();
    }, 1000);
  }, 18000);
}

function showOutbreakCard(data) {
  stopIdlePopIns();
  isShowingCard = true;

  const container = document.getElementById("main-content");
  if (!container) return;
  clearContainer(container);

  const card = document.createElement("div");
  card.className = "outbreak-card";
  card.id = "outbreak-card";

  const header = document.createElement("div");
  header.className = "outbreak-header slam-in";
  header.innerHTML =
    '<span class="outbreak-emoji">' + (data.emoji || "\uD83E\uDDA0") + '</span>' +
    '<span class="outbreak-title">OUTBREAK REPORT</span>';
  card.appendChild(header);

  const disease = document.createElement("div");
  disease.className = "outbreak-disease-badge bounce-in";
  disease.textContent = (data.disease || "").toUpperCase();
  card.appendChild(disease);

  if (data.status || data.year) {
    const status = document.createElement("div");
    status.className = "outbreak-status";
    status.textContent = ((data.status || "") + " \u00B7 " + (data.year || "")).toUpperCase();
    card.appendChild(status);
  }

  const headline = document.createElement("div");
  headline.className = "outbreak-headline bounce-in";
  headline.textContent = (data.headline || "").toUpperCase();
  card.appendChild(headline);

  // Stats grid
  if (data.stats && data.stats.length) {
    const statsGrid = document.createElement("div");
    statsGrid.className = "outbreak-stats-grid";
    data.stats.forEach(function(s) {
      const stat = document.createElement("div");
      stat.className = "ob-stat";
      const trendClass = s.trend === "up" ? "ob-val-up" : s.trend === "down" ? "ob-val-down" : "ob-val-baseline";
      stat.innerHTML =
        '<div class="ob-stat-val ' + trendClass + '">' + (s.value || "") + '</div>' +
        '<div class="ob-stat-label">' + (s.label || "").toUpperCase() + '</div>';
      statsGrid.appendChild(stat);
    });
    card.appendChild(statsGrid);
  }

  if (data.detail) {
    const detail = document.createElement("div");
    detail.className = "outbreak-detail";
    detail.textContent = (data.detail || "").toUpperCase();
    card.appendChild(detail);
  }

  if (data.cdc) {
    const cdc = document.createElement("div");
    cdc.className = "outbreak-cdc";
    cdc.textContent = (data.cdc || "").toUpperCase();
    card.appendChild(cdc);
  }

  container.appendChild(card);

  setTimeout(() => {
    card.classList.add("fade-out");
    setTimeout(() => {
      clearContainer(container);
      isShowingCard = false;
      startIdlePopIns();
    }, 1000);
  }, 18000);
}

function showBreakthroughCard(data) {
  stopIdlePopIns();
  isShowingCard = true;

  const container = document.getElementById("main-content");
  if (!container) return;
  clearContainer(container);

  const card = document.createElement("div");
  card.className = "breakthrough-card";
  card.id = "breakthrough-card";

  const header = document.createElement("div");
  header.className = "bt-header slam-in";
  header.textContent = "BREAKTHROUGH";
  card.appendChild(header);

  if (data.year) {
    const year = document.createElement("div");
    year.className = "bt-year bounce-in";
    year.textContent = data.year;
    card.appendChild(year);
  }

  const icon = document.createElement("div");
  icon.className = "bt-icon bounce-in";
  icon.textContent = data.emoji || "\uD83D\uDD2C";
  card.appendChild(icon);

  const title = document.createElement("div");
  title.className = "bt-title bounce-in";
  title.textContent = (data.title || "").toUpperCase();
  card.appendChild(title);

  const simple = document.createElement("div");
  simple.className = "bt-simple bounce-in";
  simple.textContent = (data.simple || data.description || "").toUpperCase();
  card.appendChild(simple);

  if (data.impact) {
    const impactWrap = document.createElement("div");
    impactWrap.className = "bt-impact";
    impactWrap.innerHTML =
      '<div class="bt-impact-label">WHY IT MATTERS TODAY</div>' +
      '<div class="bt-impact-text">' + (data.impact || "").toUpperCase() + '</div>';
    card.appendChild(impactWrap);
  }

  container.appendChild(card);

  setTimeout(() => {
    card.classList.add("fade-out");
    setTimeout(() => {
      clearContainer(container);
      isShowingCard = false;
      startIdlePopIns();
    }, 1000);
  }, 18000);
}

// --- Debug Keyboard Shortcuts ---
document.addEventListener("keydown", (e) => {
  if (e.key === "d" || e.key === "D") {
    // Trigger through server so Marie TTS fires too
    fetch("/api/marie/test", { method: "POST" }).catch(() => {
      // Fallback to local-only if server unreachable
      showFactCard({
        claim: "VACCINES CAUSE AUTISM",
        verdict: "DEBUNKED",
        fact: "THE ORIGINAL 1998 WAKEFIELD STUDY WAS RETRACTED FOR FRAUD.",
        humor: "IMAGINE TRUSTING SOMEONE WHO LOST THEIR MEDICAL LICENSE.",
        source: "LANCET RETRACTION (2010)"
      });
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
  if (e.key === "q" || e.key === "Q") {
    // Q = quit/reset everything back to home
    dismissPaymentAlert();
    dismissSoundcheck();
    Marie.stop();
    Marie.hideContainer();
    window._promptCycleActive = false;
    // Hide all overlays
    const bingo = document.getElementById("bingo-board");
    if (bingo) bingo.style.display = "none";
    const cred = document.getElementById("credibility-meter");
    if (cred) cred.style.display = "none";
    const graph = document.getElementById("conspiracy-graph-canvas");
    if (graph) graph.style.display = "none";
    const mood = document.getElementById("mood-indicator");
    if (mood) mood.style.display = "none";
    const pred = document.getElementById("prediction-banner");
    if (pred) pred.style.display = "none";
    const audience = document.getElementById("audience-overlay");
    if (audience) audience.style.display = "none";
    const guest = document.getElementById("guest-overlay");
    if (guest) guest.style.display = "none";
    const adScreen = document.getElementById("ad-screen");
    if (adScreen) adScreen.remove();
    // Tell server to stop EVERYTHING — Marie, session, all state
    fetch("/api/marie/stop", { method: "POST" }).catch(() => {});
    fetch("/api/session/end", { method: "POST" }).catch(() => {});
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
  if (e.key === "t" || e.key === "T") {
    showSoundcheck();
  }
  if (e.key === "s" || e.key === "S") {
    // S = start debate session manually
    fetch("/api/session/start", { method: "POST" }).catch(() => {});
  }
  if (e.key === "z" || e.key === "Z") {
    // Z = trigger quiz via server (Marie hosts it)
    fetch("/api/quiz", { method: "POST" }).catch(() => {});
  }
  if (e.key === "x" || e.key === "X") {
    // X = trigger this-or-that test card
    showThisOrThat({
      question: "WHICH IS MORE DANGEROUS?",
      emojiA: "\uD83E\uDDA0", labelA: "MEASLES",
      emojiB: "\uD83D\uDC89", labelB: "MMR VACCINE",
      answer: "MEASLES — 1-2 DEATHS PER 1000 CASES",
      explanation: "THE MMR VACCINE HAS A SERIOUS ADVERSE EVENT RATE OF ABOUT 1 IN A MILLION. MEASLES KILLS 1-2 PER 1,000 INFECTED.",
      seconds: 20
    });
  }
  if (e.key === "f" || e.key === "F") {
    // F = trigger science fact test card
    showScienceFact({
      icon: "\uD83E\uDDEC",
      title: "YOUR DNA IS 99.9% IDENTICAL TO EVERY OTHER HUMAN",
      body: "THE 0.1% DIFFERENCE ACCOUNTS FOR ALL HUMAN GENETIC VARIATION — SKIN COLOR, HEIGHT, DISEASE RISK. WE ARE FAR MORE ALIKE THAN DIFFERENT.",
      source: "HUMAN GENOME PROJECT, NIH"
    });
  }
  if (e.key === "m" || e.key === "M") {
    // M = trigger myth buster test card
    showMythBuster({
      verdict: "FALSE",
      myth: "VACCINES CAUSE AUTISM",
      conspiracy: "ANTI-VAX GROUPS CITE A RETRACTED 1998 STUDY BY ANDREW WAKEFIELD",
      science: "DOZENS OF STUDIES INVOLVING MILLIONS OF CHILDREN HAVE FOUND ZERO LINK BETWEEN VACCINES AND AUTISM.",
      evidence: "LANCET RETRACTION (2010), COCHRANE REVIEW (2012), CDC STUDIES"
    });
  }
  if (e.key === "b" || e.key === "B") {
    // Toggle bingo board visibility
    const board = document.getElementById("bingo-board");
    if (board) board.style.display = board.style.display === "none" ? "block" : "none";
  }
  if (e.key === "g" || e.key === "G") {
    // Toggle conspiracy graph — create with demo data if doesn't exist
    let graph = document.getElementById("conspiracy-graph-canvas");
    if (!graph) {
      updateConspiracyGraph({
        nodes: [
          { label: "VACCINES", weight: 3 },
          { label: "BIG PHARMA", weight: 2 },
          { label: "BILL GATES", weight: 1 },
          { label: "5G", weight: 1 },
          { label: "FLAT EARTH", weight: 2 },
        ],
        edges: [
          { from: 0, to: 1 }, { from: 1, to: 2 },
          { from: 2, to: 3 }, { from: 0, to: 3 },
          { from: 3, to: 4 },
        ],
      });
    } else {
      graph.style.display = graph.style.display === "none" ? "block" : "none";
    }
  }
  if (e.key === "c" || e.key === "C") {
    // Toggle credibility meter — create if doesn't exist
    let meter = document.getElementById("credibility-meter");
    if (!meter) {
      updateCredibilityMeter({ value: 50 });
    } else {
      meter.style.display = meter.style.display === "none" ? "flex" : "none";
    }
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

// --- Slide-out Toolbar ---
function toggleToolbar() {
  const toolbar = document.getElementById("toolbar");
  const tab = document.getElementById("toolbar-tab");
  const isOpen = toolbar.classList.contains("open");
  toolbar.classList.toggle("open");
  tab.classList.toggle("open");
  // Click outside to close
  if (!isOpen) {
    setTimeout(() => {
      document.addEventListener("click", closeToolbarOutside, { once: true });
    }, 100);
  }
}
function closeToolbarOutside(e) {
  const toolbar = document.getElementById("toolbar");
  const tab = document.getElementById("toolbar-tab");
  if (toolbar && !toolbar.contains(e.target) && e.target !== tab) {
    toolbar.classList.remove("open");
    tab.classList.remove("open");
  }
}

// --- Init ---
document.addEventListener("DOMContentLoaded", () => {
  connectWebSocket();
  startIdlePopIns();
  // Browser mic disabled — mic is server-side via UDP stream from Windows PC
  // startSpeechRecognition();
});
