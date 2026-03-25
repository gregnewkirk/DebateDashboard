// ===========================================
//  DEBATE DASHBOARD — Sound Effects Engine
//  Web Audio API synth + optional .mp3 overrides
//
//  Drop custom .mp3 files in /public/sfx/ to override:
//    sfx/fact-check.mp3
//    sfx/loop-breaker.mp3
//    sfx/donation.mp3
//    sfx/report-card.mp3
//    sfx/mom-joke.mp3
//    sfx/session-start.mp3
//    sfx/verdict.mp3
// ===========================================

const SFX = (() => {
  let ctx = null;
  const fileCache = {};
  const SFX_PATH = "sfx/";

  function getCtx() {
    if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === "suspended") ctx.resume();
    return ctx;
  }

  // --- Try to play an .mp3 override, return true if found ---
  async function tryFile(name) {
    const url = SFX_PATH + name + ".mp3";

    // Check cache
    if (fileCache[name] === false) return false; // known missing
    if (fileCache[name]) {
      playBuffer(fileCache[name]);
      return true;
    }

    // Try to load
    try {
      const res = await fetch(url);
      if (!res.ok) {
        fileCache[name] = false;
        return false;
      }
      const arrayBuf = await res.arrayBuffer();
      const audioBuf = await getCtx().decodeAudioData(arrayBuf);
      fileCache[name] = audioBuf;
      playBuffer(audioBuf);
      return true;
    } catch {
      fileCache[name] = false;
      return false;
    }
  }

  function playBuffer(buffer) {
    const c = getCtx();
    const source = c.createBufferSource();
    source.buffer = buffer;
    const gain = c.createGain();
    gain.gain.value = 0.6;
    source.connect(gain);
    gain.connect(c.destination);
    source.start();
  }

  // ============================================================
  // SYNTH SOUNDS (Web Audio API)
  // ============================================================

  function playTone(freq, type, duration, volume = 0.3) {
    const c = getCtx();
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(volume, c.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + duration);
    osc.connect(gain);
    gain.connect(c.destination);
    osc.start();
    osc.stop(c.currentTime + duration);
  }

  // --- FACT CHECK: dramatic low hit + rising tone ---
  function synthFactCheck() {
    const c = getCtx();
    // Low impact hit
    playTone(80, "sine", 0.4, 0.5);
    // Rising sweep
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(150, c.currentTime);
    osc.frequency.exponentialRampToValueAtTime(600, c.currentTime + 0.3);
    gain.gain.setValueAtTime(0.2, c.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.4);
    osc.connect(gain);
    gain.connect(c.destination);
    osc.start();
    osc.stop(c.currentTime + 0.5);
    // Stinger note
    setTimeout(() => playTone(440, "square", 0.15, 0.15), 300);
  }

  // --- VERDICT SLAM: big bass hit ---
  function synthVerdict() {
    const c = getCtx();
    // Bass slam
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(200, c.currentTime);
    osc.frequency.exponentialRampToValueAtTime(40, c.currentTime + 0.3);
    gain.gain.setValueAtTime(0.6, c.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.5);
    osc.connect(gain);
    gain.connect(c.destination);
    osc.start();
    osc.stop(c.currentTime + 0.6);
    // Click
    playTone(1200, "square", 0.03, 0.3);
  }

  // --- LOOP BREAKER: alarm siren ---
  function synthLoopBreaker() {
    const c = getCtx();
    // Two-tone siren
    for (let i = 0; i < 3; i++) {
      setTimeout(() => {
        playTone(800, "square", 0.15, 0.2);
        setTimeout(() => playTone(600, "square", 0.15, 0.2), 150);
      }, i * 300);
    }
    // Buzz underneath
    playTone(100, "sawtooth", 0.9, 0.15);
  }

  // --- DONATION: cash register cha-ching ---
  function synthDonation() {
    const c = getCtx();
    // Sparkle up
    const notes = [523, 659, 784, 1047]; // C5 E5 G5 C6
    notes.forEach((freq, i) => {
      setTimeout(() => playTone(freq, "sine", 0.3, 0.25), i * 80);
    });
    // Bell shimmer
    setTimeout(() => {
      playTone(2093, "sine", 0.8, 0.15);
      playTone(2637, "sine", 0.6, 0.1);
    }, 350);
    // Register click
    setTimeout(() => playTone(4000, "square", 0.02, 0.2), 100);
  }

  // --- REPORT CARD: dramatic reveal fanfare ---
  function synthReportCard() {
    const c = getCtx();
    // Trumpet-style fanfare (major chord arpeggiated)
    const fanfare = [262, 330, 392, 523, 659, 784];
    fanfare.forEach((freq, i) => {
      setTimeout(() => playTone(freq, "sawtooth", 0.4, 0.15), i * 120);
    });
    // Timpani roll
    for (let i = 0; i < 6; i++) {
      setTimeout(() => playTone(80 + Math.random() * 20, "sine", 0.15, 0.3), i * 50);
    }
  }

  // --- MOM JOKE: comedy rimshot ---
  function synthMomJoke() {
    // Ba-dum-tss
    playTone(200, "sine", 0.1, 0.4); // ba
    setTimeout(() => playTone(150, "sine", 0.1, 0.4), 150); // dum
    setTimeout(() => {
      // tss (white noise burst)
      const c = getCtx();
      const bufSize = c.sampleRate * 0.2;
      const buf = c.createBuffer(1, bufSize, c.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < bufSize; i++) {
        data[i] = (Math.random() * 2 - 1) * (1 - i / bufSize);
      }
      const noise = c.createBufferSource();
      noise.buffer = buf;
      const gain = c.createGain();
      gain.gain.value = 0.2;
      const filter = c.createBiquadFilter();
      filter.type = "highpass";
      filter.frequency.value = 5000;
      noise.connect(filter);
      filter.connect(gain);
      gain.connect(c.destination);
      noise.start();
    }, 350);
  }

  // --- SESSION START: boxing bell ---
  function synthSessionStart() {
    const c = getCtx();
    // Bell hits
    for (let i = 0; i < 3; i++) {
      setTimeout(() => {
        playTone(1200, "sine", 0.6, 0.3);
        playTone(2400, "sine", 0.4, 0.1);
        playTone(3600, "sine", 0.3, 0.05);
      }, i * 250);
    }
  }

  // ============================================================
  // PUBLIC API — tries .mp3 file first, falls back to synth
  // ============================================================

  return {
    async factCheck() {
      if (!(await tryFile("fact-check"))) synthFactCheck();
    },
    async verdict() {
      if (!(await tryFile("verdict"))) synthVerdict();
    },
    async loopBreaker() {
      if (!(await tryFile("loop-breaker"))) synthLoopBreaker();
    },
    async donation() {
      if (!(await tryFile("donation"))) synthDonation();
    },
    async reportCard() {
      if (!(await tryFile("report-card"))) synthReportCard();
    },
    async momJoke() {
      if (!(await tryFile("mom-joke"))) synthMomJoke();
    },
    async sessionStart() {
      if (!(await tryFile("session-start"))) synthSessionStart();
    },

    // Init — call once to unlock AudioContext on user gesture
    init() {
      document.addEventListener("click", () => getCtx(), { once: true });
      document.addEventListener("keydown", () => getCtx(), { once: true });
    },

    // Test all sounds with 1.5s gaps
    async testAll() {
      const sounds = ["sessionStart", "factCheck", "verdict", "loopBreaker", "donation", "momJoke", "reportCard"];
      for (const name of sounds) {
        await this[name]();
        await new Promise(r => setTimeout(r, 1500));
      }
    }
  };
})();

// Init on load
SFX.init();
