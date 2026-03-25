// ===========================================
//  MARIE CURIE — AI Co-Host Client
//  Audio playback, waveform visualization,
//  avatar animation
// ===========================================

console.log('[Marie] Client module loading...');
const Marie = (() => {
  let audioCtx = null;
  let analyser = null;
  let currentSource = null;
  let animationFrame = null;
  let isPlaying = false;

  const WAVEFORM_BARS = 40;
  const WAVEFORM_COLOR_TOP = '#FFD700';    // Gold strand (top)
  const WAVEFORM_COLOR_BOTTOM = '#BF0A30'; // Red strand (bottom)
  const RUNG_COLOR = 'rgba(255,215,0,0.12)';
  const WAVEFORM_BG = 'transparent';

  // ============================================================
  // AUDIO CONTEXT (lazy init on first user gesture)
  // ============================================================

  function getAudioContext() {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
    return audioCtx;
  }

  // Unlock on first user interaction — try ALL event types
  let audioUnlocked = false;
  function unlockAudio() {
    if (audioUnlocked) return;
    const ctx = getAudioContext();
    if (ctx.state === 'suspended') {
      ctx.resume().then(() => {
        audioUnlocked = true;
        console.log('[Marie] Audio unlocked!');
        // Remove the unlock prompt
        const prompt = document.getElementById('audio-unlock-prompt');
        if (prompt) prompt.remove();
      });
    } else {
      audioUnlocked = true;
      console.log('[Marie] Audio already unlocked');
      const prompt = document.getElementById('audio-unlock-prompt');
      if (prompt) prompt.remove();
    }
  }
  document.addEventListener('click', unlockAudio);
  document.addEventListener('keydown', unlockAudio);
  document.addEventListener('touchstart', unlockAudio);
  document.addEventListener('mousedown', unlockAudio);

  // Show unlock prompt after 2 seconds if still locked
  setTimeout(() => {
    if (!audioUnlocked) {
      const prompt = document.createElement('div');
      prompt.id = 'audio-unlock-prompt';
      prompt.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);z-index:9999;background:rgba(0,14,42,0.95);border:4px solid #FFD700;border-radius:16px;padding:40px 60px;text-align:center;font-family:Oswald,sans-serif;cursor:pointer;';
      prompt.innerHTML = '<div style="font-size:48px;font-weight:900;color:#FFD700;letter-spacing:8px;margin-bottom:16px;">TAP TO ENABLE AUDIO</div><div style="font-size:24px;color:rgba(255,255,255,0.5);letter-spacing:4px;">MARIE NEEDS YOUR PERMISSION</div>';
      prompt.addEventListener('click', () => {
        unlockAudio();
        prompt.remove();
      });
      document.body.appendChild(prompt);
    }
  }, 2000);

  // ============================================================
  // ENTRANCE SOUND EFFECT — ascending bloop
  // ============================================================

  function playEntranceSFX() {
    const ctx = getAudioContext();
    const now = ctx.currentTime;

    // Tone 1: 400Hz
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(400, now);
    gain1.gain.setValueAtTime(0.3, now);
    gain1.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.15);

    // Tone 2: 800Hz (delayed)
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(800, now + 0.1);
    gain2.gain.setValueAtTime(0, now);
    gain2.gain.setValueAtTime(0.25, now + 0.1);
    gain2.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.1);
    osc2.stop(now + 0.3);
  }

  // ============================================================
  // SHOW / HIDE MARIE CONTAINER
  // ============================================================

  function showContainer() {
    const el = document.getElementById('marie-container');
    if (!el) return;
    el.style.display = 'flex';
    el.classList.remove('exiting');
    el.classList.add('entering');
  }

  function hideContainer() {
    const el = document.getElementById('marie-container');
    if (!el) return;
    el.classList.remove('entering');
    el.classList.add('exiting');
    setTimeout(() => {
      el.style.display = 'none';
      el.classList.remove('exiting');
    }, 800);
  }

  // ============================================================
  // WAVEFORM CANVAS RENDERER
  // ============================================================

  function startWaveform() {
    const canvas = document.getElementById('marie-canvas');
    if (!canvas || !analyser) return;

    // Resize canvas for DNA helix spectrogram — Design #5 top-half takeover
    canvas.width = 960;
    canvas.height = 280;

    const ctx2d = canvas.getContext('2d');
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    let time = 0;

    function draw() {
      animationFrame = requestAnimationFrame(draw);
      analyser.getByteFrequencyData(dataArray);
      time += 0.03;

      ctx2d.clearRect(0, 0, canvas.width, canvas.height);

      const barWidth = canvas.width / WAVEFORM_BARS;
      const gap = 4;
      const step = Math.floor(bufferLength / WAVEFORM_BARS);
      const midY = canvas.height / 2;

      let totalAmplitude = 0;

      // Draw DNA rungs first (behind bars)
      ctx2d.strokeStyle = RUNG_COLOR;
      ctx2d.lineWidth = 1.5;
      for (let i = 0; i < WAVEFORM_BARS; i += 2) {
        const x = i * barWidth + barWidth / 2;
        const phase = Math.sin(time + i * 0.3) * 0.3;
        ctx2d.beginPath();
        ctx2d.moveTo(x, midY - 20 + phase * 30);
        ctx2d.lineTo(x, midY + 20 - phase * 30);
        ctx2d.stroke();
      }

      // Draw top strand (gold, grows UP from center)
      for (let i = 0; i < WAVEFORM_BARS; i++) {
        let sum = 0;
        for (let j = 0; j < step; j++) {
          sum += dataArray[i * step + j];
        }
        const avg = sum / step;
        totalAmplitude += avg;

        const barHeight = (avg / 255) * (canvas.height * 0.45);
        const x = i * barWidth + gap / 2;
        // Sine wave offset for helix effect
        const helixOffset = Math.sin(time + i * 0.25) * 8;
        const y = midY - barHeight + helixOffset;

        const grad = ctx2d.createLinearGradient(x, y, x, midY);
        grad.addColorStop(0, WAVEFORM_COLOR_TOP);
        grad.addColorStop(1, 'rgba(255, 215, 0, 0.15)');
        ctx2d.fillStyle = grad;
        ctx2d.fillRect(x, y, barWidth - gap, barHeight);
      }

      // Draw bottom strand (red, grows DOWN from center)
      for (let i = 0; i < WAVEFORM_BARS; i++) {
        let sum = 0;
        for (let j = 0; j < step; j++) {
          sum += dataArray[i * step + j];
        }
        const avg = sum / step;
        const barHeight = (avg / 255) * (canvas.height * 0.4);
        const x = i * barWidth + gap / 2;
        const helixOffset = Math.sin(time + i * 0.25 + Math.PI) * 8;
        const y = midY + helixOffset;

        const grad = ctx2d.createLinearGradient(x, y, x, y + barHeight);
        grad.addColorStop(0, 'rgba(191, 10, 48, 0.15)');
        grad.addColorStop(1, WAVEFORM_COLOR_BOTTOM);
        ctx2d.fillStyle = grad;
        ctx2d.globalAlpha = 0.7;
        ctx2d.fillRect(x, y, barWidth - gap, barHeight);
        ctx2d.globalAlpha = 1;
      }

      // Update avatar glow intensity based on amplitude
      const avgAmplitude = totalAmplitude / WAVEFORM_BARS / 255;
      const glowIntensity = 0.5 + avgAmplitude * 2.0;
      const avatar = document.getElementById('marie-avatar');
      if (avatar) {
        avatar.style.setProperty('--glow-intensity', glowIntensity);
      }

      // Also update the Marie tag glow
      const tag = document.querySelector('.marie-name');
      if (tag) {
        const glow = Math.round(avgAmplitude * 40);
        tag.style.textShadow = `0 0 ${glow}px rgba(255,215,0,${0.3 + avgAmplitude * 0.5})`;
      }
    }

    draw();
  }

  function stopWaveform() {
    if (animationFrame) {
      cancelAnimationFrame(animationFrame);
      animationFrame = null;
    }
    // Clear canvas
    const canvas = document.getElementById('marie-canvas');
    if (canvas) {
      const ctx2d = canvas.getContext('2d');
      ctx2d.clearRect(0, 0, canvas.width, canvas.height);
    }
  }

  // ============================================================
  // PLAY AUDIO WITH VISUALIZATION
  // ============================================================

  async function playAudio(audioUrl) {
    console.log('[Marie] playAudio() called:', audioUrl);
    if (!audioUrl) return;

    // Cancel any currently playing audio
    stop();

    const ctx = getAudioContext();

    try {
      const response = await fetch(audioUrl);
      const arrayBuffer = await response.arrayBuffer();
      const audioBuffer = await ctx.decodeAudioData(arrayBuffer);

      // Create audio graph: source → analyser → gain → destination
      analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.7;

      const gain = ctx.createGain();
      gain.gain.value = 1.0;

      currentSource = ctx.createBufferSource();
      currentSource.buffer = audioBuffer;
      currentSource.connect(analyser);
      analyser.connect(gain);
      gain.connect(ctx.destination);

      // Start avatar animation
      const avatar = document.getElementById('marie-avatar');
      if (avatar) avatar.classList.add('speaking');

      isPlaying = true;
      currentSource.start();
      startWaveform();

      // On audio end
      currentSource.onended = () => {
        isPlaying = false;
        stopWaveform();
        if (avatar) avatar.classList.remove('speaking');

        // Hold for 1.5s then hide
        setTimeout(() => {
          if (!isPlaying) {
            hideContainer();
          }
        }, 1500);
      };
    } catch (err) {
      console.error('[Marie] Audio playback failed:', err);
      isPlaying = false;
    }
  }

  // ============================================================
  // SPEAK — Full lifecycle: show UI + play audio
  // ============================================================

  async function speak(audioUrl, displayText) {
    console.log('[Marie] speak() called:', audioUrl, displayText?.substring(0, 50));
    // Show container
    showContainer();

    // Play entrance SFX
    playEntranceSFX();

    // Set speech text
    const speechEl = document.getElementById('marie-speech');
    if (speechEl) {
      speechEl.textContent = (displayText || '').toUpperCase();
    }

    // Small delay for entrance animation to land
    await new Promise(r => setTimeout(r, 400));

    // Play the TTS audio
    await playAudio(audioUrl);
  }

  // ============================================================
  // STOP — Cancel everything
  // ============================================================

  function stop() {
    if (currentSource) {
      try { currentSource.stop(); } catch {}
      currentSource = null;
    }
    stopWaveform();
    isPlaying = false;
    const avatar = document.getElementById('marie-avatar');
    if (avatar) avatar.classList.remove('speaking');
  }

  // Public API
  return { speak, playAudio, stop, showContainer, hideContainer, isPlaying: () => isPlaying };
})();
