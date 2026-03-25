// ===========================================
//  DEV BAR — Live status overlay (top of screen)
//  Toggle with backtick (`) key
//  Auto-refreshes every 2 seconds
// ===========================================

const DevBar = (() => {
  let visible = false;
  let pollTimer = null;
  let barEl = null;
  const recentEvents = []; // track recent WS events for debug

  function create() {
    barEl = document.createElement('div');
    barEl.id = 'dev-bar';
    barEl.style.cssText = `
      position: fixed;
      top: 0; left: 0;
      width: 1080px;
      z-index: 9999;
      background: rgba(0,0,0,0.92);
      border-bottom: 2px solid #FFD700;
      padding: 8px 16px;
      font-family: 'Courier New', monospace;
      font-size: 14px;
      color: #00FF00;
      display: none;
      pointer-events: auto;
      line-height: 1.5;
    `;
    barEl.innerHTML = '<div style="color:#FFD700;font-weight:bold;font-size:16px;">DEV BAR — Loading...</div>';
    document.body.appendChild(barEl);
  }

  function toggle() {
    visible = !visible;
    if (!barEl) create();
    barEl.style.display = visible ? 'block' : 'none';
    if (visible) {
      refresh();
      pollTimer = setInterval(refresh, 2000);
    } else {
      if (pollTimer) clearInterval(pollTimer);
    }
  }

  async function refresh() {
    try {
      const res = await fetch('/api/status');
      const s = await res.json();
      if (!barEl) return;

      const modeColor = s.mode === 'DEBATE' ? '#BF0A30' : '#00FF00';
      const mic = s.mic || {};
      const micActive = mic.active;
      const micColor = micActive ? '#00FF00' : '#FF4444';
      const emailColor = s.email === 'CONNECTED' ? '#00FF00' : '#FF4444';
      const upMin = Math.floor(s.uptime / 60);
      const upSec = s.uptime % 60;

      let sessionLine = '';
      if (s.session) {
        sessionLine = `
          <div style="margin-top:4px;border-top:1px solid #333;padding-top:4px;">
            <span style="color:#FFD700;">SESSION</span>
            <span style="color:#FFF;">${s.session.nickname}</span> |
            Claims: <span style="color:#FFF;">${s.session.claims}</span> |
            Debunked: <span style="color:#BF0A30;">${s.session.debunked}</span> |
            Misleading: <span style="color:#FFA500;">${s.session.misleading}</span> |
            Loops: <span style="color:#FF4444;">${s.session.loops}</span> |
            Mom: <span style="color:#FFD700;">${s.session.momJokes}</span>
          </div>`;
      }

      // Mic last heard line
      const micHeard = mic.lastHeard ? `"${mic.lastHeard}"` : 'nothing yet';
      const micHeardColor = mic.transcripts > 0 ? '#00FF00' : '#FF4444';

      barEl.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <span style="color:#FFD700;font-weight:bold;font-size:16px;">DEV BAR</span>
          <span style="color:#888;">v${s.version} | up ${upMin}m${String(upSec).padStart(2,'0')}s</span>
        </div>
        <div style="display:flex;flex-wrap:wrap;gap:12px;margin-top:6px;">
          <span>MODE: <b style="color:${modeColor};">${s.mode}</b></span>
          <span>MARIE: <b style="color:#00FF00;">${s.marie}</b></span>
          <span>WS: <b style="color:#FFF;">${s.wsClients}</b></span>
          <span>EMAIL: <b style="color:${emailColor};">${s.email}</b></span>
        </div>
        <div style="margin-top:4px;border-top:1px solid #333;padding-top:4px;">
          <span>MIC: <b style="color:${micColor};">${micActive ? 'LISTENING' : 'OFF'}</b></span> |
          <span>Chunks: <b style="color:#FFF;">${mic.chunks || 0}</b></span> |
          <span>Transcripts: <b style="color:${micHeardColor};">${mic.transcripts || 0}</b></span> |
          <span>Last: <b style="color:#FFF;">${mic.lastHeardAgo || 'never'}</b></span>
        </div>
        <div style="margin-top:2px;font-size:12px;color:#888;max-height:28px;overflow:hidden;">
          HEARD: <span style="color:${micHeardColor};">${micHeard}</span>
        </div>
        <div style="display:flex;flex-wrap:wrap;gap:12px;margin-top:4px;">
          <span>LLM: <b style="color:#FFF;">${s.llm.model}</b></span>
          <span>TTS: <b style="color:#FFF;">af_heart</b> (gen: ${s.tts.generated}, q: ${s.tts.queued})</span>
          <span>CACHE: <b style="color:#FFF;">${s.factCache.totalClaims} / ${s.factCache.totalCards}</b></span>
        </div>
        <div style="display:flex;flex-wrap:wrap;gap:12px;margin-top:4px;">
          <span>🔴 <b style="color:#FFF;">${s.shellyRed}</b></span>
          <span>🟢 <b style="color:#FFF;">${s.shellyGreen}</b></span>
        </div>
        ${sessionLine}
        <div style="margin-top:4px;border-top:1px solid #333;padding-top:4px;font-size:11px;color:#666;max-height:80px;overflow-y:auto;">
          ${recentEvents.map(e => `<div>${e}</div>`).join('')}
        </div>
        <div style="margin-top:6px;">
          <button onclick="Marie.stop(); Marie.hideContainer(); fetch('/api/marie/stop',{method:'POST'}).catch(()=>{});" style="background:#BF0A30;color:white;border:2px solid #FFD700;padding:6px 20px;font-family:Oswald,sans-serif;font-weight:700;font-size:16px;letter-spacing:4px;cursor:pointer;margin-right:10px;">⬛ ALL STOP</button>
        </div>
      `;
    } catch (err) {
      if (barEl) {
        barEl.innerHTML = '<div style="color:#FF4444;font-weight:bold;">DEV BAR — Server unreachable</div>';
      }
    }
  }

  function logEvent(type, detail) {
    const ts = new Date().toLocaleTimeString();
    recentEvents.push(`${ts} [${type}] ${detail}`);
    if (recentEvents.length > 8) recentEvents.shift();
  }

  // Toggle with backtick key
  document.addEventListener('keydown', (e) => {
    if (e.key === '`') toggle();
  });

  return { toggle, refresh, logEvent };
})();
