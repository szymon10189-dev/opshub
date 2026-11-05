(function () {
  // -------------------------------------------------------------
  // 1. GENERATOR SYNTEZY DŹWIĘKÓW (WEB AUDIO API)
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
    if (e.target.matches('input, textarea, select')) return;
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
  // 3. PAMIĘĆ WACHTY (LOCALSTORAGE)
  // -------------------------------------------------------------
  const STORAGE_KEY_ENGINEERS = 'opshub_ruletka_wachtowi';
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
  // 4. STYLE WIDOKU RULETKI
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
      padding: 20px; width: 440px; color: #f1f3f5;
      box-shadow: 0 0 50px rgba(212, 175, 55, 0.3), 0 25px 60px rgba(0, 0, 0, 0.95);
      text-align: center; position: relative;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    }
    .casino-header {
      display: flex; justify-content: space-between; align-items: center;
      margin-bottom: 12px; border-bottom: 1px solid rgba(212, 175, 55, 0.25); padding-bottom: 8px;
    }
    .casino-title {
      font-size: 13px; font-weight: 800; letter-spacing: 1.5px; color: #ffd700;
      text-transform: uppercase; text-shadow: 0 1px 4px rgba(0,0,0,0.8);
      display: flex; align-items: center; gap: 8px;
    }
    .casino-btn-icon {
      background: rgba(0,0,0,0.55); border: 1px solid rgba(212, 175, 55, 0.4);
      color: #ffd700; cursor: pointer; border-radius: 6px; padding: 4px 8px; font-size: 11px;
      font-weight: 600; transition: all 0.2s;
    }
    .casino-btn-icon:hover { background: rgba(212, 175, 55, 0.2); border-color: #ffd700; }
    .casino-winner-box {
      margin: 10px 0; padding: 8px 12px; min-height: 38px;
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
    .wheel-container { position: relative; width: 310px; height: 310px; margin: 6px auto; }
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
  // 5. STRUKTURA MODALA
  // -------------------------------------------------------------
  const modalEl = document.createElement('div');
  modalEl.id = 'casino-easter-egg';
  modalEl.className = 'casino-overlay hidden';
  modalEl.innerHTML = `
    <div class="casino-card" id="casino-inner-card">
      <div class="casino-header">
        <span class="casino-title">🎯 RULETKA NOC OPSHUB</span>
        <div style="display: flex; gap: 6px;">
          <button id="casino-btn-toggle-config" class="casino-btn-icon" title="Edytuj listę wachy">👥 Wachta</button>
          <button id="casino-btn-close" class="casino-btn-icon" title="Zamknij (Esc)">✕</button>
        </div>
      </div>

      <div id="ruletka-target-box" class="casino-target-badge" style="display: none; font-size: 11px; margin-bottom: 6px; color: #a3e635;"></div>
      <div class="wheel-container">
        <canvas id="ruletka-canvas" width="310" height="310"></canvas>
      </div>
      <div id="ruletka-winner" class="casino-winner-box"><span>Postaw los dyżuru na ruletce!</span></div>
      <button id="ruletka-btn-spin" class="casino-btn-gold">🎲 RZUĆ KULKĘ</button>
      <button id="ruletka-btn-slack" class="ruletka-btn-slack">📋 KOPIUJ NA SLACKA</button>

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

  // -------------------------------------------------------------
  // 6. RYSOWANIE I FIZYKA KOŁA
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

    const duration = 4600;
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
  // 7. ZARZĄDZANIE OKNEM I ZAMYKANIE
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
    drawRoulette();
  }

  function closeCasinoModal() {
    modalEl.classList.add('hidden');
    configPanel.style.display = 'none';
    activeAlertContext = null;
    isRouletteSpinning = false;
    btnSpin.disabled = false;
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
    if (e.target === modalEl) {
      closeCasinoModal();
    }
  });
})();