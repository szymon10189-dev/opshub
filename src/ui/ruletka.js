(function () {
  // -------------------------------------------------------------
  // 1. GENERATOR SYNTEZY DŹWIĘKÓW (WEB AUDIO API - ZERO PLIKÓW MP3)
  // -------------------------------------------------------------
  let audioCtx = null;

  function getAudioContext() {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
    return audioCtx;
  }

  function playBallBounce(volume = 0.2) {
    try {
      const ctx = getAudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1400 + Math.random() * 400, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(120, ctx.currentTime + 0.025);
      gain.gain.setValueAtTime(volume, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.025);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.025);
    } catch (e) {}
  }

  function playBallRollClick(volume = 0.08) {
    try {
      const ctx = getAudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(400 + Math.random() * 200, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(80, ctx.currentTime + 0.015);
      gain.gain.setValueAtTime(volume, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.015);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.015);
    } catch (e) {}
  }

  function playReelStopSound() {
    try {
      const ctx = getAudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(180, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(30, ctx.currentTime + 0.05);
      gain.gain.setValueAtTime(0.18, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.05);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.05);
    } catch (e) {}
  }

  function playCardSnapSound() {
    try {
      const ctx = getAudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(850, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(180, ctx.currentTime + 0.035);
      gain.gain.setValueAtTime(0.16, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.035);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.035);
    } catch (e) {}
  }

  function playWinCoinsSound() {
    try {
      const ctx = getAudioContext();
      const freqs = [523.25, 659.25, 783.99, 1046.50, 1318.51];
      freqs.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        const start = ctx.currentTime + idx * 0.07;
        osc.frequency.setValueAtTime(freq, start);
        gain.gain.setValueAtTime(0.14, start);
        gain.gain.exponentialRampToValueAtTime(0.001, start + 0.22);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(start);
        osc.stop(start + 0.22);
      });
    } catch (e) {}
  }

  // -------------------------------------------------------------
  // 2. DETEKCJA ALERTU I AKTYWACJI "ruletka"
  // -------------------------------------------------------------
  function getCurrentlySelectedAlert() {
    const selectedEl = document.querySelector('.alert-item.is-selected');
    if (!selectedEl) return null;
    const hostEl = selectedEl.querySelector('.row-host');
    const serviceEl = selectedEl.querySelector('.service-text');
    const hostRaw = hostEl ? (hostEl.getAttribute('data-copy-val') || hostEl.textContent.trim()) : '';
    const serviceRaw = serviceEl ? serviceEl.textContent.trim() : '';
    const cleanHost = hostRaw.replace(/^\[KARMA\]\s*/, '').trim();
    return (cleanHost && serviceRaw) ? { host: cleanHost, service: serviceRaw } : null;
  }

  let inputBuffer = '';
  let activeAlertContext = null;

  window.addEventListener('keydown', (e) => {
    if (e.target.matches('input, textarea')) return;
    if (e.key && e.key.length === 1) {
      inputBuffer += e.key.toLowerCase();
      if (inputBuffer.length > 20) inputBuffer = inputBuffer.slice(-10);
      if (inputBuffer.endsWith('ruletka')) {
        inputBuffer = '';
        activeAlertContext = getCurrentlySelectedAlert();
        openCasinoModal();
      }
    }
  });

  // -------------------------------------------------------------
  // 3. PAMIĘĆ LOCALSTORAGE
  // -------------------------------------------------------------
  const STORAGE_KEY_ENGINEERS = 'opshub_ruletka_wachtowi';
  const STORAGE_KEY_CREDITS = 'opshub_casino_credits';
  const defaultEngineers = ['Szymon', 'Dawid', 'Bartek', 'Kamil', 'Wojtek'];

  function getEngineers() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY_ENGINEERS);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {}
    return defaultEngineers;
  }

  function saveEngineers(list) {
    localStorage.setItem(STORAGE_KEY_ENGINEERS, JSON.stringify(list));
  }

  function getCredits() {
    const c = parseInt(localStorage.getItem(STORAGE_KEY_CREDITS), 10);
    return isNaN(c) ? 1000 : c;
  }

  function saveCredits(amount) {
    localStorage.setItem(STORAGE_KEY_CREDITS, String(Math.max(0, amount)));
    updateAllCreditsDisplays();
  }

  function getRoulettePockets() {
    const list = getEngineers();
    const pockets = [{ label: '0 (JA)', isZero: true, color: '#15803d', weight: 0.45 }];
    list.forEach((name, idx) => {
      pockets.push({
        label: name,
        isZero: false,
        color: idx % 2 === 0 ? '#991b1b' : '#18181b',
        weight: 1.0
      });
    });
    const totalWeight = pockets.reduce((sum, p) => sum + p.weight, 0);
    let cumulative = 0;
    return pockets.map(p => {
      const startAngle = (cumulative / totalWeight) * 2 * Math.PI;
      const angleSpan = (p.weight / totalWeight) * 2 * Math.PI;
      cumulative += p.weight;
      return { ...p, startAngle, angleSpan, midAngle: startAngle + angleSpan / 2 };
    });
  }

  // -------------------------------------------------------------
  // 4. STYLE CSS KASYNA
  // -------------------------------------------------------------
  const styleEl = document.createElement('style');
  styleEl.textContent = `
    .casino-overlay {
      position: fixed; inset: 0; background: rgba(2, 8, 4, 0.92);
      backdrop-filter: blur(7px); z-index: 999999;
      display: flex; align-items: center; justify-content: center;
    }
    .casino-overlay.hidden { display: none !important; }
    .casino-card {
      background: radial-gradient(circle at 50% 20%, #0d381e 0%, #061d0f 75%, #020b06 100%);
      border: 2px solid #d4af37; border-radius: 18px;
      padding: 20px; width: 510px; color: #f1f3f5;
      box-shadow: 0 0 50px rgba(212, 175, 55, 0.3), 0 25px 60px rgba(0, 0, 0, 0.95);
      text-align: center; position: relative;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    }
    .casino-header {
      display: flex; justify-content: space-between; align-items: center;
      margin-bottom: 10px; border-bottom: 1px solid rgba(212, 175, 55, 0.25); padding-bottom: 8px;
    }
    .casino-title {
      font-size: 13px; font-weight: 800; letter-spacing: 1.5px; color: #ffd700;
      text-transform: uppercase; text-shadow: 0 1px 4px rgba(0,0,0,0.8);
      display: flex; align-items: center; gap: 8px;
    }
    .casino-tabs {
      display: flex; gap: 4px; justify-content: center; margin-bottom: 10px;
      background: rgba(0, 0, 0, 0.45); padding: 4px; border-radius: 8px; border: 1px solid rgba(212, 175, 55, 0.2);
    }
    .casino-tab-btn {
      flex: 1; background: transparent; border: 1px solid transparent; color: #a1a1aa;
      padding: 6px 4px; font-size: 10.5px; font-weight: 700; border-radius: 6px; cursor: pointer;
      transition: all 0.2s; white-space: nowrap;
    }
    .casino-tab-btn:hover { color: #f4f4f5; background: rgba(255,255,255,0.06); }
    .casino-tab-btn.active {
      background: linear-gradient(135deg, rgba(212, 175, 55, 0.3), rgba(212, 175, 55, 0.08));
      border-color: #d4af37; color: #ffd700; box-shadow: 0 0 10px rgba(212, 175, 55, 0.25);
    }
    .casino-btn-icon {
      background: rgba(0,0,0,0.55); border: 1px solid rgba(212, 175, 55, 0.4);
      color: #ffd700; cursor: pointer; border-radius: 6px; padding: 4px 8px; font-size: 11px;
      font-weight: 600; transition: all 0.2s;
    }
    .casino-btn-icon:hover { background: rgba(212, 175, 55, 0.2); border-color: #ffd700; }
    
    .casino-winner-box {
      margin: 8px 0; padding: 8px 12px; min-height: 38px;
      background: rgba(0, 0, 0, 0.55); border: 1px dashed rgba(212, 175, 55, 0.4);
      border-radius: 8px; font-size: 13px; font-weight: 600;
      display: flex; align-items: center; justify-content: center; gap: 8px;
    }
    .casino-btn-gold {
      background: linear-gradient(135deg, #d4af37, #997a15);
      color: #111; border: 1px solid #ffe58f; padding: 10px 20px; font-size: 13px;
      font-weight: 800; letter-spacing: 0.5px; border-radius: 6px; cursor: pointer; width: 100%;
      box-shadow: 0 4px 15px rgba(212, 175, 55, 0.35); transition: transform 0.1s, opacity 0.2s;
    }
    .casino-btn-gold:active { transform: scale(0.98); }
    .casino-btn-gold:disabled { opacity: 0.4; cursor: not-allowed; }

    /* =================== SLOTS STYL =================== */
    .slots-paytable-ticker {
      display: flex; justify-content: space-around; align-items: center;
      background: rgba(0, 0, 0, 0.6); border: 1px solid rgba(212, 175, 55, 0.3);
      border-radius: 6px; padding: 4px 8px; margin-bottom: 8px;
      font-size: 10px; font-weight: 700; color: #ffd700;
    }
    .slots-cabinet {
      background: radial-gradient(circle at 50% 30%, #201a09 0%, #0e0d07 70%, #050503 100%);
      border: 3px solid #d4af37; border-radius: 14px;
      padding: 14px; margin: 6px 0; box-shadow: inset 0 0 25px rgba(0,0,0,0.9), 0 0 20px rgba(212, 175, 55, 0.2);
    }
    .slots-reels-window {
      display: flex; gap: 12px; justify-content: center;
      background: #000; padding: 10px; border-radius: 10px;
      border: 2px solid #523f06; box-shadow: inset 0 8px 18px rgba(0,0,0,0.95);
    }
    .slot-reel {
      width: 105px; height: 110px; overflow: hidden;
      background: radial-gradient(circle, #27272a 0%, #18181b 70%, #09090b 100%);
      border-radius: 8px; border: 2px solid #3f3f46;
      box-shadow: inset 0 12px 18px rgba(0,0,0,0.8), inset 0 -12px 18px rgba(0,0,0,0.8);
      display: flex; align-items: center; justify-content: center;
      font-size: 52px; user-select: none; position: relative;
    }
    .slots-dashboard {
      display: flex; justify-content: space-between; align-items: center;
      margin-top: 10px; background: rgba(0,0,0,0.65); padding: 7px 12px; border-radius: 8px;
      border: 1px solid rgba(212, 175, 55, 0.3); font-size: 12px; font-weight: 700;
    }
    .slots-bet-btn {
      background: #27272a; border: 1px solid #52525b; color: #f4f4f5;
      padding: 3px 8px; font-size: 11px; font-weight: 700; border-radius: 4px; cursor: pointer;
    }
    .slots-bet-btn.active {
      background: #d4af37; color: #111; border-color: #ffd700;
    }
    .gamble-panel {
      display: none; margin-top: 8px; padding: 8px; border-radius: 8px;
      background: rgba(0,0,0,0.7); border: 1px dashed #d4af37;
    }

    /* =================== POKER STYL =================== */
    .poker-cabinet {
      background: radial-gradient(circle at 50% 20%, #0d381e 0%, #051a0d 80%, #020b06 100%);
      border: 2px solid #d4af37; border-radius: 12px;
      padding: 12px 10px; margin: 6px 0; box-shadow: inset 0 0 20px rgba(0,0,0,0.8);
    }
    .poker-paytable {
      display: grid; grid-template-columns: repeat(3, 1fr); gap: 4px;
      font-size: 9.5px; font-weight: 700; background: rgba(0,0,0,0.55);
      padding: 6px 8px; border-radius: 6px; margin-bottom: 10px;
      border: 1px solid rgba(212, 175, 55, 0.25); text-align: left;
    }
    .poker-pay-item { color: #a1a1aa; display: flex; justify-content: space-between; padding: 1px 4px; }
    .poker-pay-item.highlight { background: rgba(212, 175, 55, 0.3); color: #ffd700; border-radius: 3px; }
    .poker-cards-container {
      display: flex; gap: 8px; justify-content: center; margin: 12px 0 6px 0; min-height: 115px;
    }
    .poker-card {
      width: 78px; height: 112px; background: #ffffff;
      border-radius: 8px; border: 1px solid #d4d4d8; color: #18181b;
      display: flex; flex-direction: column; justify-content: space-between;
      padding: 6px 7px; box-shadow: 0 5px 12px rgba(0,0,0,0.65);
      cursor: pointer; position: relative; user-select: none;
      transition: transform 0.15s, box-shadow 0.15s; box-sizing: border-box;
    }
    .poker-card.is-red { color: #dc2626; }
    .poker-card.held {
      border: 2.5px solid #ffd700; box-shadow: 0 0 16px rgba(255, 215, 0, 0.8);
      transform: translateY(-8px);
    }
    .poker-hold-badge {
      display: none; position: absolute; top: -11px; left: 50%; transform: translateX(-50%);
      background: #ffd700; color: #000; font-size: 9px; font-weight: 900;
      padding: 1px 6px; border-radius: 4px; box-shadow: 0 2px 5px rgba(0,0,0,0.6);
    }
    .poker-card.held .poker-hold-badge { display: block; }
    .poker-card-corner { font-size: 13px; font-weight: 800; line-height: 1; text-align: left; }
    .poker-card-center { font-size: 28px; line-height: 1; text-align: center; }
    .poker-card-corner.bottom { text-align: right; transform: rotate(180deg); }

    /* ================= BLACKJACK STYL ================= */
    .bj-table {
      background: radial-gradient(circle at 50% 30%, #0f4425 0%, #072513 75%, #031209 100%);
      border: 2px solid #d4af37; border-radius: 14px;
      padding: 12px 14px; margin: 6px 0; box-shadow: inset 0 0 25px rgba(0,0,0,0.85);
      text-align: left;
    }
    .bj-hand-label {
      font-size: 11px; font-weight: 800; color: #ffd700; letter-spacing: 0.5px;
      margin-bottom: 4px; display: flex; justify-content: space-between; align-items: center;
    }
    .bj-score-badge {
      background: rgba(0,0,0,0.6); border: 1px solid rgba(212,175,55,0.4);
      color: #fff; padding: 1px 6px; border-radius: 4px; font-size: 11px;
    }
    .bj-cards-row {
      display: flex; gap: 8px; min-height: 94px; align-items: center; margin-bottom: 8px;
    }
    .bj-card {
      width: 64px; height: 92px; background: #ffffff;
      border-radius: 6px; border: 1px solid #d4d4d8; color: #18181b;
      display: flex; flex-direction: column; justify-content: space-between;
      padding: 5px 6px; box-shadow: 0 4px 10px rgba(0,0,0,0.6);
      user-select: none; box-sizing: border-box; flex-shrink: 0;
    }
    .bj-card.is-red { color: #dc2626; }
    .bj-card.is-hidden {
      background: repeating-linear-gradient(45deg, #1e3a8a, #1e3a8a 6px, #172554 6px, #172554 12px);
      border: 2px solid #93c5fd; color: transparent;
    }
    .bj-card-corner { font-size: 12px; font-weight: 800; line-height: 1; text-align: left; }
    .bj-card-center { font-size: 22px; line-height: 1; text-align: center; }
    .bj-card-corner.bottom { text-align: right; transform: rotate(180deg); }
    .bj-actions-bar {
      display: flex; gap: 8px; justify-content: center; margin-top: 8px;
    }
    .bj-btn-action {
      flex: 1; background: #27272a; border: 1px solid #d4af37; color: #ffd700;
      padding: 9px 12px; font-size: 12px; font-weight: 800; border-radius: 6px; cursor: pointer;
      box-shadow: 0 3px 10px rgba(0,0,0,0.5); transition: all 0.15s;
    }
    .bj-btn-action:hover { background: rgba(212, 175, 55, 0.2); }
    .bj-btn-action:disabled { opacity: 0.35; cursor: not-allowed; }

    .wheel-container { position: relative; width: 310px; height: 310px; margin: 4px auto; }
    #ruletka-canvas { width: 310px; height: 310px; border-radius: 50%; box-shadow: 0 0 25px rgba(0,0,0,0.95); }
    .ruletka-btn-slack {
      display: none; margin-top: 8px; background: #4a154b;
      color: #fff; border: 1px solid #ecb22e; padding: 8px 16px; font-size: 12px;
      font-weight: 700; border-radius: 6px; cursor: pointer; width: 100%;
    }
    .ruletka-btn-slack:hover { background: #611f69; }

    .wachtowi-panel {
      text-align: left; margin-top: 10px; border-top: 1px solid rgba(212, 175, 55, 0.2); padding-top: 10px;
    }
    .wachtowi-textarea {
      width: 100%; height: 75px; background: #050b07; color: #ffd700;
      border: 1px solid rgba(212, 175, 55, 0.3); border-radius: 6px;
      padding: 8px; font-size: 12px; box-sizing: border-box; resize: none;
    }
    .wachtowi-actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 8px; }
  `;
  document.head.appendChild(styleEl);

  // -------------------------------------------------------------
  // 5. STRUKTURA MODALA (4 ZAKŁADKI)
  // -------------------------------------------------------------
  const modalEl = document.createElement('div');
  modalEl.id = 'casino-easter-egg';
  modalEl.className = 'casino-overlay hidden';
  modalEl.innerHTML = `
    <div class="casino-card">
      <div class="casino-header">
        <span class="casino-title">🎰 KASYNO NOC OPSHUB</span>
        <div style="display: flex; gap: 6px;">
          <button id="casino-btn-refill" class="casino-btn-icon" title="Darmowe doładowanie żetonów">🏦 +500</button>
          <button id="casino-btn-toggle-config" class="casino-btn-icon" title="Edytuj listę wachy">👥 Wachta</button>
          <button id="casino-btn-close" class="casino-btn-icon" title="Zamknij (Esc)">✕</button>
        </div>
      </div>

      <div class="casino-tabs">
        <button id="tab-btn-ruletka" class="casino-tab-btn active">🎯 Ruletka</button>
        <button id="tab-btn-slots" class="casino-tab-btn">🎰 Slots</button>
        <button id="tab-btn-poker" class="casino-tab-btn">🃏 Poker</button>
        <button id="tab-btn-bj" class="casino-tab-btn">♠️ Blackjack</button>
      </div>

      <!-- 1. RULETKA -->
      <div id="view-ruletka">
        <div id="ruletka-target-box" class="casino-target-badge" style="display: none; font-size: 11px; margin-bottom: 6px; color: #a3e635;"></div>
        <div class="wheel-container">
          <canvas id="ruletka-canvas" width="310" height="310"></canvas>
        </div>
        <div id="ruletka-winner" class="casino-winner-box"><span>Postaw los dyżuru na ruletce!</span></div>
        <button id="ruletka-btn-spin" class="casino-btn-gold">🎲 RZUĆ KULKĘ</button>
        <button id="ruletka-btn-slack" class="ruletka-btn-slack">📋 KOPIUJ NA SLACKA</button>
      </div>

      <!-- 2. VEGAS SLOTS -->
      <div id="view-slots" style="display: none;">
        <div class="slots-paytable-ticker">
          <span>7️⃣ x100</span><span>👑 x50</span><span>💎 x25</span><span>🔔 x15</span><span>🍀 x10</span><span>🍒 x5</span>
        </div>

        <div class="slots-cabinet">
          <div class="slots-reels-window">
            <div class="slot-reel"><div id="reel-1">👑</div></div>
            <div class="slot-reel"><div id="reel-2">7️⃣</div></div>
            <div class="slot-reel"><div id="reel-3">💎</div></div>
          </div>

          <div class="slots-dashboard">
            <div>
              <span style="color: #a1a1aa;">Żetony: </span>
              <span id="slots-credits" style="color: #ffd700; font-size: 13px;">1000</span>
            </div>
            <div style="display: flex; gap: 4px; align-items: center;">
              <span style="color: #a1a1aa; margin-right: 4px;">Stawka:</span>
              <button class="slots-bet-btn active" data-bet="10">10</button>
              <button class="slots-bet-btn" data-bet="25">25</button>
              <button class="slots-bet-btn" data-bet="50">50</button>
              <button class="slots-bet-btn" data-bet="100">100</button>
              <button id="slots-btn-max" class="slots-bet-btn" style="color: #ffd700; border-color: #d4af37;">MAX</button>
            </div>
          </div>
        </div>

        <div id="slots-msg" class="casino-winner-box"><span>Pociągnij za dźwignię, gdy nie ma alertów!</span></div>

        <div id="slots-gamble-panel" class="gamble-panel">
          <div style="font-size: 11px; margin-bottom: 6px; color: #ffd700;">Zaryzykuj wygraną x2! Wybierz kolor karty:</div>
          <div style="display: flex; gap: 8px; justify-content: center;">
            <button id="btn-gamble-red" class="casino-btn-icon" style="background: #991b1b; color: #fff; width: 100px; font-weight: 800;">🔴 CZERWONE</button>
            <button id="btn-gamble-black" class="casino-btn-icon" style="background: #18181b; color: #fff; width: 100px; font-weight: 800;">⚫ CZARNE</button>
          </div>
        </div>

        <button id="slots-btn-spin" class="casino-btn-gold">🎰 SPIN (ZAKRĘĆ)</button>
      </div>

      <!-- 3. VIDEO POKER -->
      <div id="view-poker" style="display: none;">
        <div class="poker-cabinet">
          <div class="poker-paytable">
            <div class="poker-pay-item" data-hand="royal"><span>Poker Król.</span><span>x250</span></div>
            <div class="poker-pay-item" data-hand="strflush"><span>Poker</span><span>x50</span></div>
            <div class="poker-pay-item" data-hand="four"><span>Kareta</span><span>x25</span></div>
            <div class="poker-pay-item" data-hand="full"><span>Full</span><span>x9</span></div>
            <div class="poker-pay-item" data-hand="flush"><span>Kolor</span><span>x6</span></div>
            <div class="poker-pay-item" data-hand="straight"><span>Strit</span><span>x4</span></div>
            <div class="poker-pay-item" data-hand="three"><span>Trójka</span><span>x3</span></div>
            <div class="poker-pay-item" data-hand="twopair"><span>Dwie pary</span><span>x2</span></div>
            <div class="poker-pay-item" data-hand="jacks"><span>Para J+</span><span>x1</span></div>
          </div>

          <div id="poker-cards-box" class="poker-cards-container"></div>

          <div class="slots-dashboard">
            <div>
              <span style="color: #a1a1aa;">Żetony: </span>
              <span id="poker-credits" style="color: #ffd700; font-size: 13px;">1000</span>
            </div>
            <div style="display: flex; gap: 4px; align-items: center;">
              <span style="color: #a1a1aa; margin-right: 4px;">Stawka:</span>
              <button class="poker-bet-btn slots-bet-btn active" data-bet="10">10</button>
              <button class="poker-bet-btn slots-bet-btn" data-bet="25">25</button>
              <button class="poker-bet-btn slots-bet-btn" data-bet="50">50</button>
              <button class="poker-bet-btn slots-bet-btn" data-bet="100">100</button>
            </div>
          </div>
        </div>

        <div id="poker-msg" class="casino-winner-box"><span>Kliknij ROZDAJ, wybierz karty do zatrzymania i dobierz!</span></div>
        <button id="poker-btn-action" class="casino-btn-gold">🃏 ROZDAJ (DEAL)</button>
      </div>

      <!-- 4. BLACKJACK (21 / OCZKO) -->
      <div id="view-bj" style="display: none;">
        <div class="bj-table">
          <div class="bj-hand-label">
            <span>KRUPIER</span>
            <span id="bj-dealer-score" class="bj-score-badge">?</span>
          </div>
          <div id="bj-dealer-cards" class="bj-cards-row"></div>

          <div class="bj-hand-label" style="margin-top: 10px;">
            <span>GRACZ</span>
            <span id="bj-player-score" class="bj-score-badge">0</span>
          </div>
          <div id="bj-player-cards" class="bj-cards-row"></div>

          <div class="slots-dashboard">
            <div>
              <span style="color: #a1a1aa;">Żetony: </span>
              <span id="bj-credits" style="color: #ffd700; font-size: 13px;">1000</span>
            </div>
            <div style="display: flex; gap: 4px; align-items: center;">
              <span style="color: #a1a1aa; margin-right: 4px;">Stawka:</span>
              <button class="bj-bet-btn slots-bet-btn active" data-bet="10">10</button>
              <button class="bj-bet-btn slots-bet-btn" data-bet="25">25</button>
              <button class="bj-bet-btn slots-bet-btn" data-bet="50">50</button>
              <button class="bj-bet-btn slots-bet-btn" data-bet="100">100</button>
            </div>
          </div>
        </div>

        <div id="bj-msg" class="casino-winner-box"><span>Wybierz stawkę i kliknij ROZDAJ KARTY!</span></div>

        <div id="bj-panel-deal">
          <button id="bj-btn-deal" class="casino-btn-gold">♠️ ROZDAJ KARTY</button>
        </div>

        <div id="bj-panel-play" class="bj-actions-bar" style="display: none;">
          <button id="bj-btn-hit" class="bj-btn-action">➕ HIT (DOBIERZ)</button>
          <button id="bj-btn-stand" class="bj-btn-action">✋ STAND (PAS)</button>
          <button id="bj-btn-double" class="bj-btn-action">⚡ DOUBLE (x2)</button>
        </div>
      </div>

      <!-- KONFIGURACJA WACHTY -->
      <div id="wachtowi-config-panel" class="wachtowi-panel" style="display: none;">
        <label style="font-size: 11px; font-weight: 700; color: #ffd700;">Wachtowi (jedno imię w wierszu):</label>
        <textarea id="wachtowi-list-input" class="wachtowi-textarea" placeholder="Wpisz imiona..."></textarea>
        <div class="wachtowi-actions">
          <button id="wachtowi-btn-save" class="casino-btn-icon" style="background: #d4af37; color: #111; border: none; font-weight: 700;">Zapisz</button>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(modalEl);

  function updateAllCreditsDisplays() {
    const c = getCredits();
    ['slots-credits', 'poker-credits', 'bj-credits'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.innerText = c;
    });
  }

  // -------------------------------------------------------------
  // 6. PRZEŁĄCZANIE ZAKŁADEK
  // -------------------------------------------------------------
  const tabBtnRuletka = document.getElementById('tab-btn-ruletka');
  const tabBtnSlots = document.getElementById('tab-btn-slots');
  const tabBtnPoker = document.getElementById('tab-btn-poker');
  const tabBtnBj = document.getElementById('tab-btn-bj');
  const viewRuletka = document.getElementById('view-ruletka');
  const viewSlots = document.getElementById('view-slots');
  const viewPoker = document.getElementById('view-poker');
  const viewBj = document.getElementById('view-bj');

  function switchTab(tab) {
    [tabBtnRuletka, tabBtnSlots, tabBtnPoker, tabBtnBj].forEach(b => b.classList.remove('active'));
    [viewRuletka, viewSlots, viewPoker, viewBj].forEach(v => v.style.display = 'none');

    if (tab === 'ruletka') {
      tabBtnRuletka.classList.add('active');
      viewRuletka.style.display = 'block';
      drawRoulette();
    } else if (tab === 'slots') {
      tabBtnSlots.classList.add('active');
      viewSlots.style.display = 'block';
    } else if (tab === 'poker') {
      tabBtnPoker.classList.add('active');
      viewPoker.style.display = 'block';
      if (!pokerGameInProgress) resetPokerBoard();
    } else if (tab === 'bj') {
      tabBtnBj.classList.add('active');
      viewBj.style.display = 'block';
      if (!bjInProgress) resetBjBoard();
    }
    updateAllCreditsDisplays();
  }

  tabBtnRuletka.addEventListener('click', () => switchTab('ruletka'));
  tabBtnSlots.addEventListener('click', () => switchTab('slots'));
  tabBtnPoker.addEventListener('click', () => switchTab('poker'));
  tabBtnBj.addEventListener('click', () => switchTab('bj'));

  document.getElementById('casino-btn-refill').addEventListener('click', () => {
    saveCredits(getCredits() + 500);
    playWinCoinsSound();
    const msg = '🏦 Pobrano 500 żetonów z sejfu dyżurnego!';
    ['slots-msg', 'poker-msg', 'bj-msg'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.innerHTML = `<span style="color: #ffd700;">${msg}</span>`;
    });
  });

  // -------------------------------------------------------------
  // 7. TALIA KART (WSPÓLNA DLA POKERA I BLACKJACKA)
  // -------------------------------------------------------------
  function createStandardDeck() {
    const suits = [
      { sym: '♠', isRed: false },
      { sym: '♥', isRed: true },
      { sym: '♦', isRed: true },
      { sym: '♣', isRed: false }
    ];
    const ranks = [
      { r: 2, label: '2' }, { r: 3, label: '3' }, { r: 4, label: '4' }, { r: 5, label: '5' },
      { r: 6, label: '6' }, { r: 7, label: '7' }, { r: 8, label: '8' }, { r: 9, label: '9' },
      { r: 10, label: '10' }, { r: 11, label: 'J' }, { r: 12, label: 'Q' }, { r: 13, label: 'K' },
      { r: 14, label: 'A' }
    ];
    const deck = [];
    for (const s of suits) {
      for (const r of ranks) {
        deck.push({ ...r, ...s });
      }
    }
    for (let i = deck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    return deck;
  }

  // -------------------------------------------------------------
  // 8. LOGIKA BLACKJACK (21 / OCZKO)
  // -------------------------------------------------------------
  const bjDealerCardsBox = document.getElementById('bj-dealer-cards');
  const bjPlayerCardsBox = document.getElementById('bj-player-cards');
  const bjDealerScoreEl = document.getElementById('bj-dealer-score');
  const bjPlayerScoreEl = document.getElementById('bj-player-score');
  const bjMsgEl = document.getElementById('bj-msg');
  const bjPanelDeal = document.getElementById('bj-panel-deal');
  const bjPanelPlay = document.getElementById('bj-panel-play');
  const bjBtnDeal = document.getElementById('bj-btn-deal');
  const bjBtnHit = document.getElementById('bj-btn-hit');
  const bjBtnStand = document.getElementById('bj-btn-stand');
  const bjBtnDouble = document.getElementById('bj-btn-double');
  const bjBetButtons = document.querySelectorAll('.bj-bet-btn');

  let currentBjBet = 10;
  let activeBjBet = 10;
  let bjInProgress = false;
  let bjDeck = [];
  let bjPlayerHand = [];
  let bjDealerHand = [];
  let bjHoleHidden = true;

  bjBetButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      if (bjInProgress) return;
      bjBetButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentBjBet = parseInt(btn.getAttribute('data-bet'), 10) || 10;
    });
  });

  function calculateHandScore(hand, hideFirst = false) {
    let score = 0;
    let aces = 0;
    const cards = hideFirst ? hand.slice(1) : hand;

    cards.forEach(c => {
      if (c.r === 14) {
        aces += 1;
        score += 11;
      } else if (c.r >= 10) {
        score += 10;
      } else {
        score += c.r;
      }
    });

    while (score > 21 && aces > 0) {
      score -= 10;
      aces -= 1;
    }
    return score;
  }

  function renderBjHand(containerEl, hand, hideHole) {
    containerEl.innerHTML = '';
    hand.forEach((card, idx) => {
      const cardEl = document.createElement('div');
      const isHiddenCard = (hideHole && idx === 0);
      cardEl.className = `bj-card ${card.isRed ? 'is-red' : ''} ${isHiddenCard ? 'is-hidden' : ''}`;
      if (isHiddenCard) {
        cardEl.innerHTML = `<div class="bj-card-center" style="font-size: 28px;">🂠</div>`;
      } else {
        cardEl.innerHTML = `
          <div class="bj-card-corner">${card.label}<br><span style="font-size: 10px;">${card.sym}</span></div>
          <div class="bj-card-center">${card.sym}</div>
          <div class="bj-card-corner bottom">${card.label}<br><span style="font-size: 10px;">${card.sym}</span></div>
        `;
      }
      containerEl.appendChild(cardEl);
    });
  }

  function resetBjBoard() {
    bjDealerCardsBox.innerHTML = '';
    bjPlayerCardsBox.innerHTML = '';
    bjDealerScoreEl.innerText = '?';
    bjPlayerScoreEl.innerText = '0';
    bjPanelDeal.style.display = 'block';
    bjPanelPlay.style.display = 'none';
  }

  function startBjGame() {
    let credits = getCredits();
    if (credits < currentBjBet) {
      bjMsgEl.innerHTML = `<span style="color: #fa5252;">Brak żetonów! Użyj przycisku 🏦 +500 na górze!</span>`;
      return;
    }

    credits -= currentBjBet;
    activeBjBet = currentBjBet;
    saveCredits(credits);

    bjDeck = createStandardDeck();
    bjPlayerHand = [bjDeck.pop(), bjDeck.pop()];
    bjDealerHand = [bjDeck.pop(), bjDeck.pop()];
    bjHoleHidden = true;
    bjInProgress = true;

    bjPanelDeal.style.display = 'none';
    bjPanelPlay.style.display = 'flex';
    bjBtnDouble.disabled = (getCredits() < activeBjBet);

    renderBjHand(bjDealerCardsBox, bjDealerHand, true);
    renderBjHand(bjPlayerCardsBox, bjPlayerHand, false);
    playCardSnapSound();

    const pScore = calculateHandScore(bjPlayerHand);
    bjPlayerScoreEl.innerText = pScore;
    bjDealerScoreEl.innerText = calculateHandScore(bjDealerHand, true);

    // Naturalny Blackjack (21 z 2 kart)
    if (pScore === 21) {
      endBjGame('blackjack');
    } else {
      bjMsgEl.innerHTML = `<span>Twój ruch: Dobierz (Hit), Pasuj (Stand) lub Podwój (Double)!</span>`;
    }
  }

  function handleBjHit() {
    if (!bjInProgress) return;
    bjPlayerHand.push(bjDeck.pop());
    renderBjHand(bjPlayerCardsBox, bjPlayerHand, false);
    playCardSnapSound();
    bjBtnDouble.disabled = true;

    const pScore = calculateHandScore(bjPlayerHand);
    bjPlayerScoreEl.innerText = pScore;

    if (pScore > 21) {
      endBjGame('bust');
    } else if (pScore === 21) {
      handleBjStand();
    }
  }

  function handleBjDouble() {
    if (!bjInProgress || getCredits() < activeBjBet) return;
    saveCredits(getCredits() - activeBjBet);
    activeBjBet *= 2;
    bjBtnDouble.disabled = true;

    bjPlayerHand.push(bjDeck.pop());
    renderBjHand(bjPlayerCardsBox, bjPlayerHand, false);
    playCardSnapSound();

    const pScore = calculateHandScore(bjPlayerHand);
    bjPlayerScoreEl.innerText = pScore;

    if (pScore > 21) {
      endBjGame('bust');
    } else {
      handleBjStand();
    }
  }

  function handleBjStand() {
    if (!bjInProgress) return;
    bjHoleHidden = false;
    renderBjHand(bjDealerCardsBox, bjDealerHand, false);
    playCardSnapSound();

    let dScore = calculateHandScore(bjDealerHand);
    bjDealerScoreEl.innerText = dScore;

    // Krupier dobiera do minimum 17
    while (dScore < 17) {
      bjDealerHand.push(bjDeck.pop());
      dScore = calculateHandScore(bjDealerHand);
    }

    renderBjHand(bjDealerCardsBox, bjDealerHand, false);
    bjDealerScoreEl.innerText = dScore;

    const pScore = calculateHandScore(bjPlayerHand);

    if (dScore > 21) {
      endBjGame('dealer_bust');
    } else if (pScore > dScore) {
      endBjGame('win');
    } else if (pScore === dScore) {
      endBjGame('push');
    } else {
      endBjGame('lose');
    }
  }

  function endBjGame(outcome) {
    bjInProgress = false;
    bjHoleHidden = false;
    renderBjHand(bjDealerCardsBox, bjDealerHand, false);
    bjDealerScoreEl.innerText = calculateHandScore(bjDealerHand);

    bjPanelPlay.style.display = 'none';
    bjPanelDeal.style.display = 'block';

    if (outcome === 'blackjack') {
      const payout = Math.floor(activeBjBet * 2.5); // 3:2
      saveCredits(getCredits() + payout);
      playWinCoinsSound();
      bjMsgEl.innerHTML = `<span style="color: #ffd700; font-weight: 800;">🔥 NATURALNY BLACKJACK (21)! Wygrywasz +${payout} pkt (3:2)!</span>`;
    } else if (outcome === 'win' || outcome === 'dealer_bust') {
      const payout = activeBjBet * 2;
      saveCredits(getCredits() + payout);
      playWinCoinsSound();
      const reason = outcome === 'dealer_bust' ? 'Krupier przekroczył 21!' : 'Lepsza ręka niż krupier!';
      bjMsgEl.innerHTML = `<span style="color: #22c55e; font-weight: 800;">🎉 WYGRANA (+${payout} pkt)! ${reason}</span>`;
    } else if (outcome === 'push') {
      saveCredits(getCredits() + activeBjBet);
      bjMsgEl.innerHTML = `<span style="color: #ffd700; font-weight: 800;">🤝 REMIS (PUSH)! Zwrot stawki (${activeBjBet} pkt).</span>`;
    } else {
      const reason = outcome === 'bust' ? 'Przekroczyłeś 21 (Bust)!' : 'Krupier ma wyższy wynik.';
      bjMsgEl.innerHTML = `<span style="color: #fa5252; font-weight: 800;">💀 PRZEGRANA! ${reason}</span>`;
    }
  }

  bjBtnDeal.addEventListener('click', startBjGame);
  bjBtnHit.addEventListener('click', handleBjHit);
  bjBtnStand.addEventListener('click', handleBjStand);
  bjBtnDouble.addEventListener('click', handleBjDouble);

  // -------------------------------------------------------------
  // 9. VEGAS SLOTS (Z TRYBEM GAMBLE x2)
  // -------------------------------------------------------------
  const reel1 = document.getElementById('reel-1');
  const reel2 = document.getElementById('reel-2');
  const reel3 = document.getElementById('reel-3');
  const slotsMsgEl = document.getElementById('slots-msg');
  const btnSpinSlots = document.getElementById('slots-btn-spin');
  const gamblePanel = document.getElementById('slots-gamble-panel');
  const betButtons = document.querySelectorAll('.slots-bet-btn');

  const symbols = ['7️⃣', '👑', '💎', '🔔', '🍀', '🍒'];
  let currentSlotsBet = 10;
  let isSlotsSpinning = false;
  let currentWonAmount = 0;

  betButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      if (isSlotsSpinning) return;
      if (btn.id === 'slots-btn-max') {
        betButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentSlotsBet = 100;
        return;
      }
      const bVal = parseInt(btn.getAttribute('data-bet'), 10);
      if (bVal) {
        betButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentSlotsBet = bVal;
      }
    });
  });

  function spinSlots() {
    let credits = getCredits();
    if (credits < currentSlotsBet) {
      slotsMsgEl.innerHTML = `<span style="color: #fa5252;">Brak żetonów! Użyj przycisku 🏦 +500 na górze!</span>`;
      return;
    }

    if (isSlotsSpinning) return;
    isSlotsSpinning = true;
    btnSpinSlots.disabled = true;
    gamblePanel.style.display = 'none';

    credits -= currentSlotsBet;
    saveCredits(credits);
    slotsMsgEl.innerHTML = `<span>🎰 Bębny w ruchu...</span>`;

    const result = [
      symbols[Math.floor(Math.random() * symbols.length)],
      symbols[Math.floor(Math.random() * symbols.length)],
      symbols[Math.floor(Math.random() * symbols.length)]
    ];

    if (Math.random() < 0.05) {
      const lucky = symbols[Math.floor(Math.random() * symbols.length)];
      result[0] = lucky; result[1] = lucky; result[2] = lucky;
    }

    let step = 0;
    const interval = setInterval(() => {
      step++;
      if (step < 12) reel1.innerText = symbols[Math.floor(Math.random() * symbols.length)];
      if (step < 18) reel2.innerText = symbols[Math.floor(Math.random() * symbols.length)];
      if (step < 24) reel3.innerText = symbols[Math.floor(Math.random() * symbols.length)];
      playBallRollClick(0.04);
    }, 65);

    setTimeout(() => { reel1.innerText = result[0]; playReelStopSound(); }, 850);
    setTimeout(() => { reel2.innerText = result[1]; playReelStopSound(); }, 1250);
    setTimeout(() => {
      clearInterval(interval);
      reel3.innerText = result[2];
      playReelStopSound();
      isSlotsSpinning = false;
      btnSpinSlots.disabled = false;
      evaluateSlotsWin(result);
    }, 1650);
  }

  function evaluateSlotsWin(res) {
    const [s1, s2, s3] = res;
    let multiplier = 0;
    let title = '';

    if (s1 === '7️⃣' && s2 === '7️⃣' && s3 === '7️⃣') { multiplier = 100; title = '🔥 MEGA JACKPOT 777! 🔥'; }
    else if (s1 === '👑' && s2 === '👑' && s3 === '👑') { multiplier = 50; title = '👑 KRÓLEWSKI STRZAŁ! 👑'; }
    else if (s1 === '💎' && s2 === '💎' && s3 === '💎') { multiplier = 25; title = '💎 DIAMENTY! 💎'; }
    else if (s1 === '🔔' && s2 === '🔔' && s3 === '🔔') { multiplier = 15; title = '🔔 ZŁOTE DZWONY! 🔔'; }
    else if (s1 === '🍀' && s2 === '🍀' && s3 === '🍀') { multiplier = 10; title = '🍀 CZTEROLISTNA KONICZYNA! 🍀'; }
    else if (s1 === '🍒' && s2 === '🍒' && s3 === '🍒') { multiplier = 5; title = '🍒 POTRÓJNE WIŚNIE! 🍒'; }
    else if ((s1 === '🍒' && s2 === '🍒') || (s2 === '🍒' && s3 === '🍒') || (s1 === '🍒' && s3 === '🍒')) {
      multiplier = 2; title = '🍒 Dwie wiśnie (Zwrot x2)';
    }

    if (multiplier > 0) {
      currentWonAmount = currentSlotsBet * multiplier;
      saveCredits(getCredits() + currentWonAmount);
      playWinCoinsSound();
      slotsMsgEl.innerHTML = `<span style="color: #ffd700; font-weight: 800;">${title} (+${currentWonAmount} pkt)!</span>`;
      gamblePanel.style.display = 'block';
    } else {
      currentWonAmount = 0;
      slotsMsgEl.innerHTML = `<span style="color: #a1a1aa;">Pudło. Spróbuj jeszcze raz!</span>`;
    }
  }

  function handleGamble(chosenColor) {
    if (currentWonAmount <= 0) return;
    const cardColor = Math.random() < 0.5 ? 'red' : 'black';
    const cardSymbol = cardColor === 'red' ? (Math.random() < 0.5 ? '♥' : '♦') : (Math.random() < 0.5 ? '♠' : '♣');

    if (chosenColor === cardColor) {
      const bonus = currentWonAmount;
      saveCredits(getCredits() + bonus);
      currentWonAmount *= 2;
      playWinCoinsSound();
      slotsMsgEl.innerHTML = `<span style="color: #22c55e; font-weight: 800;">Wypadło ${cardSymbol}! PODWOJONO! Masz teraz +${currentWonAmount} pkt!</span>`;
    } else {
      saveCredits(getCredits() - currentWonAmount);
      slotsMsgEl.innerHTML = `<span style="color: #fa5252; font-weight: 800;">Wypadło ${cardSymbol}! Niestety, tracisz wygraną.</span>`;
      currentWonAmount = 0;
      gamblePanel.style.display = 'none';
    }
  }

  document.getElementById('btn-gamble-red').addEventListener('click', () => handleGamble('red'));
  document.getElementById('btn-gamble-black').addEventListener('click', () => handleGamble('black'));
  btnSpinSlots.addEventListener('click', spinSlots);

  // -------------------------------------------------------------
  // 10. VIDEO POKER (JACKS OR BETTER)
  // -------------------------------------------------------------
  const pokerCardsBox = document.getElementById('poker-cards-box');
  const pokerMsgEl = document.getElementById('poker-msg');
  const pokerBtnAction = document.getElementById('poker-btn-action');
  const pokerBetButtons = document.querySelectorAll('.poker-bet-btn');

  let currentPokerBet = 10;
  let pokerGameInProgress = false;
  let pokerDeck = [];
  let pokerHand = [];
  let pokerHeld = [false, false, false, false, false];

  pokerBetButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      if (pokerGameInProgress) return;
      pokerBetButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentPokerBet = parseInt(btn.getAttribute('data-bet'), 10) || 10;
    });
  });

  function resetPokerBoard() {
    pokerCardsBox.innerHTML = '';
    for (let i = 0; i < 5; i++) {
      const dummy = document.createElement('div');
      dummy.className = 'poker-card';
      dummy.innerHTML = `
        <div class="poker-card-corner">?</div>
        <div class="poker-card-center" style="opacity: 0.3;">🃏</div>
        <div class="poker-card-corner bottom">?</div>
      `;
      pokerCardsBox.appendChild(dummy);
    }
    highlightPokerPaytable(null);
  }

  function renderPokerCards() {
    pokerCardsBox.innerHTML = '';
    pokerHand.forEach((card, idx) => {
      const cardEl = document.createElement('div');
      cardEl.className = `poker-card ${card.isRed ? 'is-red' : ''} ${pokerHeld[idx] ? 'held' : ''}`;
      cardEl.innerHTML = `
        <div class="poker-hold-badge">HELD</div>
        <div class="poker-card-corner">${card.label}<br><span style="font-size: 11px;">${card.sym}</span></div>
        <div class="poker-card-center">${card.sym}</div>
        <div class="poker-card-corner bottom">${card.label}<br><span style="font-size: 11px;">${card.sym}</span></div>
      `;
      cardEl.addEventListener('click', () => {
        if (!pokerGameInProgress) return;
        pokerHeld[idx] = !pokerHeld[idx];
        cardEl.classList.toggle('held', pokerHeld[idx]);
        playCardSnapSound();
      });
      pokerCardsBox.appendChild(cardEl);
    });
  }

  function handlePokerAction() {
    let credits = getCredits();

    if (!pokerGameInProgress) {
      if (credits < currentPokerBet) {
        pokerMsgEl.innerHTML = `<span style="color: #fa5252;">Brak żetonów! Użyj przycisku 🏦 +500 na górze!</span>`;
        return;
      }

      credits -= currentPokerBet;
      saveCredits(credits);

      pokerDeck = createStandardDeck();
      pokerHand = [pokerDeck.pop(), pokerDeck.pop(), pokerDeck.pop(), pokerDeck.pop(), pokerDeck.pop()];
      pokerHeld = [false, false, false, false, false];

      renderPokerCards();
      playCardSnapSound();

      pokerGameInProgress = true;
      pokerBtnAction.innerText = '🔄 DOBIERZ (DRAW)';
      pokerMsgEl.innerHTML = `<span>Wybierz karty do zatrzymania i kliknij DOBIERZ!</span>`;
      highlightPokerPaytable(null);
    } else {
      for (let i = 0; i < 5; i++) {
        if (!pokerHeld[i]) {
          pokerHand[i] = pokerDeck.pop();
        }
      }

      renderPokerCards();
      playCardSnapSound();

      pokerGameInProgress = false;
      pokerBtnAction.innerText = '🃏 ROZDAJ (DEAL)';

      evaluatePokerHand();
    }
  }

  function evaluatePokerHand() {
    const ranks = pokerHand.map(c => c.r).sort((a, b) => b - a);
    const suits = pokerHand.map(c => c.sym);

    const isFlush = suits.every(s => s === suits[0]);
    let isStraight = false;

    if (ranks[0] - ranks[1] === 1 && ranks[1] - ranks[2] === 1 && ranks[2] - ranks[3] === 1 && ranks[3] - ranks[4] === 1) {
      isStraight = true;
    }
    if (ranks[0] === 14 && ranks[1] === 5 && ranks[2] === 4 && ranks[3] === 3 && ranks[4] === 2) {
      isStraight = true;
    }

    const counts = {};
    ranks.forEach(r => { counts[r] = (counts[r] || 0) + 1; });
    const countVals = Object.values(counts).sort((a, b) => b - a);

    let resultKey = null;
    let multiplier = 0;
    let handName = '';

    if (isFlush && isStraight && ranks[0] === 14 && ranks[4] === 10) {
      resultKey = 'royal'; multiplier = 250; handName = '👑 POKER KRÓLEWSKI (ROYAL FLUSH)!';
    } else if (isFlush && isStraight) {
      resultKey = 'strflush'; multiplier = 50; handName = '🔥 POKER (STRAIGHT FLUSH)!';
    } else if (countVals[0] === 4) {
      resultKey = 'four'; multiplier = 25; handName = '💣 KARETA (FOUR OF A KIND)!';
    } else if (countVals[0] === 3 && countVals[1] === 2) {
      resultKey = 'full'; multiplier = 9; handName = '🏠 FULL (FULL HOUSE)!';
    } else if (isFlush) {
      resultKey = 'flush'; multiplier = 6; handName = '🍷 KOLOR (FLUSH)!';
    } else if (isStraight) {
      resultKey = 'straight'; multiplier = 4; handName = '📏 STRIT (STRAIGHT)!';
    } else if (countVals[0] === 3) {
      resultKey = 'three'; multiplier = 3; handName = '🥉 TRÓJKA (THREE OF A KIND)!';
    } else if (countVals[0] === 2 && countVals[1] === 2) {
      resultKey = 'twopair'; multiplier = 2; handName = '✌️ DWIE PARY (TWO PAIR)!';
    } else if (countVals[0] === 2) {
      const pairRank = parseInt(Object.keys(counts).find(k => counts[k] === 2), 10);
      if (pairRank >= 11) {
        resultKey = 'jacks'; multiplier = 1; handName = '🃏 PARA WALETÓW LUB LEPIEJ (JACKS OR BETTER)!';
      }
    }

    highlightPokerPaytable(resultKey);

    if (multiplier > 0) {
      const win = currentPokerBet * multiplier;
      saveCredits(getCredits() + win);
      playWinCoinsSound();
      pokerMsgEl.innerHTML = `<span style="color: #ffd700; font-weight: 800;">${handName} (+${win} pkt)!</span>`;
    } else {
      pokerMsgEl.innerHTML = `<span style="color: #a1a1aa;">Brak wygrywającego układu. Spróbuj jeszcze raz!</span>`;
    }
  }

  function highlightPokerPaytable(key) {
    document.querySelectorAll('.poker-pay-item').forEach(el => {
      el.classList.toggle('highlight', el.getAttribute('data-hand') === key);
    });
  }

  pokerBtnAction.addEventListener('click', handlePokerAction);

  // -------------------------------------------------------------
  // 11. KOCIOŁEK RULETKI
  // -------------------------------------------------------------
  const canvas = document.getElementById('ruletka-canvas');
  const ctx = canvas.getContext('2d');
  const winnerBox = document.getElementById('ruletka-winner');
  const btnSpin = document.getElementById('ruletka-btn-spin');
  const btnSlack = document.getElementById('ruletka-btn-slack');
  const targetBox = document.getElementById('ruletka-target-box');
  const configPanel = document.getElementById('wachtowi-config-panel');
  const textareaList = document.getElementById('wachtowi-list-input');

  let wheelAngle = 0;
  let ballAngle = 0;
  let ballRadius = 140;
  let isRouletteSpinning = false;
  let lastRollTick = 0;
  let lastBouncePocket = -1;

  function drawRoulette() {
    const center = canvas.width / 2;
    const pockets = getRoulettePockets();

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const woodGrad = ctx.createRadialGradient(center, center, 130, center, center, center);
    woodGrad.addColorStop(0, '#2e1008');
    woodGrad.addColorStop(0.7, '#1f0904');
    woodGrad.addColorStop(1, '#0e0301');

    ctx.beginPath();
    ctx.arc(center, center, center - 2, 0, 2 * Math.PI);
    ctx.fillStyle = woodGrad;
    ctx.fill();
    ctx.strokeStyle = '#d4af37';
    ctx.lineWidth = 3;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(center, center, 142, 0, 2 * Math.PI);
    ctx.strokeStyle = 'rgba(212, 175, 55, 0.4)';
    ctx.lineWidth = 2;
    ctx.stroke();

    for (let d = 0; d < 8; d++) {
      const da = d * (Math.PI / 4);
      const dx = center + 140 * Math.cos(da);
      const dy = center + 140 * Math.sin(da);
      ctx.beginPath();
      ctx.arc(dx, dy, 2.5, 0, 2 * Math.PI);
      ctx.fillStyle = '#ffd700';
      ctx.fill();
    }

    ctx.save();
    ctx.translate(center, center);
    ctx.rotate(wheelAngle);

    pockets.forEach(p => {
      ctx.beginPath();
      ctx.fillStyle = p.color;
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, 126, p.startAngle, p.startAngle + p.angleSpan);
      ctx.lineTo(0, 0);
      ctx.fill();

      ctx.strokeStyle = '#d4af37';
      ctx.lineWidth = 1.6;
      ctx.stroke();

      ctx.save();
      ctx.rotate(p.midAngle);
      ctx.textAlign = 'right';
      ctx.fillStyle = p.isZero ? '#ffd700' : '#ffffff';
      ctx.font = p.isZero ? 'bold 11px sans-serif' : 'bold 11px "JetBrains Mono", Consolas, sans-serif';
      ctx.shadowColor = 'rgba(0,0,0,0.9)';
      ctx.shadowBlur = 3;
      ctx.fillText(p.label, 114, 4);
      ctx.restore();
    });

    const coneGrad = ctx.createRadialGradient(0, 0, 10, 0, 0, 50);
    coneGrad.addColorStop(0, '#fff3bf');
    coneGrad.addColorStop(0.4, '#d4af37');
    coneGrad.addColorStop(1, '#523f06');

    ctx.beginPath();
    ctx.arc(0, 0, 48, 0, 2 * Math.PI);
    ctx.fillStyle = coneGrad;
    ctx.fill();
    ctx.strokeStyle = '#111';
    ctx.lineWidth = 2;
    ctx.stroke();

    for (let arm = 0; arm < 4; arm++) {
      ctx.save();
      ctx.rotate(arm * (Math.PI / 2));
      ctx.beginPath();
      ctx.rect(-3, 8, 6, 28);
      ctx.fillStyle = '#ffd700';
      ctx.fill();
      ctx.strokeStyle = '#333';
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(0, 38, 4.5, 0, 2 * Math.PI);
      ctx.fillStyle = '#fff3bf';
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }

    ctx.beginPath();
    ctx.arc(0, 0, 11, 0, 2 * Math.PI);
    ctx.fillStyle = '#1a1005';
    ctx.fill();
    ctx.strokeStyle = '#ffd700';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.restore();

    // Kulka
    const bx = center + ballRadius * Math.cos(ballAngle);
    const by = center + ballRadius * Math.sin(ballAngle);

    ctx.beginPath();
    ctx.arc(bx + 2, by + 3, 5, 0, 2 * Math.PI);
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fill();

    const ballGrad = ctx.createRadialGradient(bx - 1.5, by - 1.5, 1, bx, by, 5.5);
    ballGrad.addColorStop(0, '#ffffff');
    ballGrad.addColorStop(0.7, '#e4e4e7');
    ballGrad.addColorStop(1, '#a1a1aa');

    ctx.beginPath();
    ctx.arc(bx, by, 5.5, 0, 2 * Math.PI);
    ctx.fillStyle = ballGrad;
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.4)';
    ctx.lineWidth = 0.5;
    ctx.stroke();
  }

  function spinRoulette() {
    if (isRouletteSpinning) return;
    const list = getEngineers();
    if (list.length < 2) {
      alert('Podaj przynajmniej 2 wachtowych!');
      return;
    }

    isRouletteSpinning = true;
    btnSpin.disabled = true;
    btnSlack.style.display = 'none';
    winnerBox.innerHTML = `<span>🎰 Kulka toczy się po bieżni...</span>`;

    const wheelTotalRot = (4 + Math.random() * 2) * 2 * Math.PI;
    const startWheelAngle = wheelAngle;
    const endWheelAngle = wheelAngle + wheelTotalRot;

    const ballRotations = (8 + Math.random() * 3) * 2 * Math.PI;
    const startBallAngle = ballAngle;
    const endBallAngle = ballAngle - ballRotations;

    const duration = 4800;
    const startTime = performance.now();
    lastRollTick = 0;
    lastBouncePocket = -1;

    function animate(time) {
      const elapsed = time - startTime;
      const progress = Math.min(1, elapsed / duration);

      const easeOutWheel = 1 - Math.pow(1 - progress, 2.5);
      wheelAngle = startWheelAngle + (endWheelAngle - startWheelAngle) * easeOutWheel;

      const easeOutBall = 1 - Math.pow(1 - progress, 3);
      ballAngle = startBallAngle + (endBallAngle - startBallAngle) * easeOutBall;

      if (progress < 0.55) {
        ballRadius = 140;
        if (time - lastRollTick > (40 + progress * 80)) {
          lastRollTick = time;
          playBallRollClick(0.09 * (1 - progress));
        }
      } else if (progress < 0.88) {
        const dropProgress = (progress - 0.55) / 0.33;
        ballRadius = 140 - dropProgress * 44;

        const currentSector = Math.floor(Math.abs(ballAngle) / (Math.PI / 6));
        if (currentSector !== lastBouncePocket) {
          lastBouncePocket = currentSector;
          playBallBounce(0.18 * (1 - dropProgress));
        }
      } else {
        const settleProgress = (progress - 0.88) / 0.12;
        const jitter = Math.sin(settleProgress * Math.PI * 4) * (2 * (1 - settleProgress));
        ballRadius = 96 + jitter;

        if (settleProgress < 0.4 && lastBouncePocket !== 999) {
          lastBouncePocket = 999;
          playBallBounce(0.12);
        }
      }

      drawRoulette();

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        isRouletteSpinning = false;
        btnSpin.disabled = false;
        determineRouletteWinner();
      }
    }

    requestAnimationFrame(animate);
  }

  function determineRouletteWinner() {
    const pockets = getRoulettePockets();

    const normWheel = (wheelAngle % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI);
    const normBall = (ballAngle % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI);
    const relativeAngle = (normBall - normWheel + 2 * Math.PI) % (2 * Math.PI);

    let winningPocket = pockets.find(p => relativeAngle >= p.startAngle && relativeAngle < (p.startAngle + p.angleSpan));
    if (!winningPocket) winningPocket = pockets[0];

    const isZero = winningPocket.isZero;
    const winnerName = winningPocket.label;

    if (isZero) {
      winnerBox.innerHTML = `
        <div style="font-weight: 800; color: #22c55e; font-size: 14px;">
          🎯 ZIELONE 0! <span style="color: #fff; text-decoration: underline;">BIORĘ TO NA SIEBIE!</span>
        </div>
      `;
    } else {
      winnerBox.innerHTML = `
        <div style="font-weight: 800; color: #ffd700; font-size: 14px;">
          🎲 Wypadło na: <span style="color: #fff; text-decoration: underline;">@${winnerName}</span>
        </div>
      `;
    }

    let copyPayload = '';
    if (isZero) {
      copyPayload = activeAlertContext
        ? `@ja (biorę sam)  ${activeAlertContext.host} - ${activeAlertContext.service}`
        : `@ja (biorę sam)`;
      btnSlack.innerText = `📋 Kopiuj na Slacka (@ja bierze sam)`;
    } else {
      copyPayload = activeAlertContext
        ? `@${winnerName}  ${activeAlertContext.host} - ${activeAlertContext.service}`
        : `@${winnerName}`;
      btnSlack.innerText = `📋 Kopiuj na Slacka (@${winnerName} ${activeAlertContext ? activeAlertContext.host : ''})`;
    }

    btnSlack.onclick = () => {
      navigator.clipboard.writeText(copyPayload);
      const orig = btnSlack.innerText;
      btnSlack.innerText = '✅ Skopiowano do schowka!';
      setTimeout(() => { btnSlack.innerText = orig; }, 2000);
    };

    btnSlack.style.display = 'block';
  }

  // -------------------------------------------------------------
  // 12. ZARZĄDZANIE OKNEM
  // -------------------------------------------------------------
  function openCasinoModal() {
    if (activeAlertContext) {
      targetBox.innerText = `🎯 Cel: ${activeAlertContext.host} - ${activeAlertContext.service}`;
      targetBox.style.display = 'block';
    } else {
      targetBox.style.display = 'none';
    }

    btnSlack.style.display = 'none';
    modalEl.classList.remove('hidden');
    ballRadius = 140;
    switchTab('ruletka');
    updateAllCreditsDisplays();
  }

  function closeCasinoModal() {
    if (isRouletteSpinning || isSlotsSpinning || pokerGameInProgress || bjInProgress) return;
    modalEl.classList.add('hidden');
    configPanel.style.display = 'none';
    activeAlertContext = null;
  }

  document.getElementById('casino-btn-close').addEventListener('click', closeCasinoModal);
  btnSpin.addEventListener('click', spinRoulette);

  document.getElementById('casino-btn-toggle-config').addEventListener('click', () => {
    if (configPanel.style.display === 'none') {
      textareaList.value = getEngineers().join('\n');
      configPanel.style.display = 'block';
    } else {
      configPanel.style.display = 'none';
    }
  });

  document.getElementById('wachtowi-btn-save').addEventListener('click', () => {
    const names = textareaList.value
      .split('\n')
      .map(s => s.trim())
      .filter(Boolean);

    if (names.length < 2) {
      alert('Podaj przynajmniej 2 imiona!');
      return;
    }
    saveEngineers(names);
    configPanel.style.display = 'none';
    drawRoulette();
  });

  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !modalEl.classList.contains('hidden')) {
      closeCasinoModal();
    }
  });

  modalEl.addEventListener('click', (e) => {
    if (e.target === modalEl) closeCasinoModal();
  });
})();
