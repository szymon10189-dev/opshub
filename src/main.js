const { app, BrowserWindow, Tray, Menu, nativeImage, ipcMain, shell, clipboard } = require('electron');
const path = require('path');
const store = require('./store');

let mainWindow = null;
let authWindow = null;
let authKarmaWindow = null;
let tray = null;
let pollTimer = null;
let cachedAlerts = [];
const firstSeenMemory = {};
const hostSupportCache = new Map(); // Pamięć Support D per host (true | false)

const DEFAULT_ICINGA_URL = 'https://monitoring-dev.hostersi.systems';
const DEFAULT_KARMA_URL = 'https://karma.hostersi.systems';

function getIcingaUrl() {
  return store.get('icingaUrl') || DEFAULT_ICINGA_URL;
}

function getKarmaUrl() {
  return store.get('karmaUrl') || DEFAULT_KARMA_URL;
}

// -------------------------------------------------------------
// ODCZYT CUSTOM VARIABLES 'support_hours: support D' (Z CACHEM)
// -------------------------------------------------------------
async function resolveHostSupport(cleanHost, rawObj) {
  if (!cleanHost || cleanHost === 'Cluster' || cleanHost === 'Host') return false;

  if (hostSupportCache.has(cleanHost)) {
    return hostSupportCache.get(cleanHost);
  }

  if (rawObj) {
    const sStr = JSON.stringify(rawObj);
    if (/support[_\s-]*hours[\s\S]{1,80}?support\s*d\b/i.test(sStr) || /"support_hours"\s*:\s*"support\s*d"/i.test(sStr)) {
      hostSupportCache.set(cleanHost, true);
      return true;
    }
  }

  const cookies = store.get('sessionCookies');
  const icingaUrl = getIcingaUrl();
  if (cookies && icingaUrl && !cleanHost.includes(' ')) {
    try {
      const targetUrl = `${icingaUrl}/icingaweb2/icingadb/host?name=${encodeURIComponent(cleanHost)}`;
      const ctrl = new AbortController();
      const tid = setTimeout(() => ctrl.abort(), 2000);

      const res = await fetch(targetUrl, {
        signal: ctrl.signal,
        headers: {
          'Cookie': cookies,
          'X-Requested-With': 'XMLHttpRequest',
          'Accept': 'text/html,application/json'
        }
      });
      clearTimeout(tid);

      if (res.ok) {
        const text = await res.text();
        const isD = /support[_\s-]*hours[\s\S]{1,120}?support\s*d\b/i.test(text)
                 || /"support_hours"[\s\S]{1,60}?support\s*d/i.test(text);
        hostSupportCache.set(cleanHost, Boolean(isD));
        return Boolean(isD);
      }
    } catch (e) {}
  }

  hostSupportCache.set(cleanHost, false);
  return false;
}

function createColorIcon(colorHex) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16">
    <circle cx="8" cy="8" r="7" fill="${colorHex}" stroke="#222" stroke-width="1"/>
  </svg>`;
  return nativeImage.createFromDataURL(`data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`);
}

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1120,
    height: 850,
    minWidth: 650,
    minHeight: 450,
    show: true,
    title: 'OpsHub — Icinga & Karma',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mainWindow.loadFile(path.join(__dirname, 'ui/index.html'));

  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (input.key === 'F12' && input.type === 'keyDown') {
      mainWindow.webContents.toggleDevTools();
    }
  });

  mainWindow.on('close', (e) => {
    if (!app.isQuitting) {
      e.preventDefault();
      if (process.platform === 'darwin' && mainWindow.isFullScreen()) {
        mainWindow.once('leave-full-screen', () => mainWindow.hide());
        mainWindow.setFullScreen(false);
      } else {
        mainWindow.hide();
      }
    }
  });
}

app.on('before-quit', () => {
  app.isQuitting = true;
});

app.on('activate', () => {
  if (mainWindow) {
    mainWindow.show();
    mainWindow.focus();
  }
});

function createTray() {
  tray = new Tray(createColorIcon('#888888'));
  tray.setToolTip('OpsHub — Icinga & Karma');

  const contextMenu = Menu.buildFromTemplate([
    { label: 'Otwórz okno', click: () => { if (mainWindow) { mainWindow.show(); mainWindow.focus(); } } },
    { label: 'Zaloguj do Icinga (SSO)', click: () => startSsoLogin() },
    { label: 'Zaloguj do Karma (SSO)', click: () => startKarmaLogin() },
    { label: 'Odśwież teraz', click: () => fetchAllMonitoringData() },
    { type: 'separator' },
    { 
      label: 'Wyloguj (Wyczyść sesję Icinga)', 
      click: () => {
        store.set('sessionCookies', '');
        console.log('[SSO] Sesja Icinga usunięta.');
        startSsoLogin();
      }
    },
    { 
      label: 'Wyloguj (Wyczyść sesję Karma)', 
      click: () => {
        store.set('karmaCookies', '');
        console.log('[SSO] Sesja Karma usunięta.');
        startKarmaLogin();
      }
    },
    { type: 'separator' },
    { 
      label: 'Zamknij program', 
      click: () => { 
        app.isQuitting = true; 
        app.quit(); 
      } 
    }
  ]);

  tray.setContextMenu(contextMenu);
  tray.on('double-click', () => { if (mainWindow) { mainWindow.show(); mainWindow.focus(); } });
}

function startSsoLogin() {
  if (authWindow) { authWindow.focus(); return; }
  const icingaUrl = getIcingaUrl();

  authWindow = new BrowserWindow({
    width: 600,
    height: 750,
    title: 'Logowanie Icinga (Entra ID)',
    alwaysOnTop: true,
    webPreferences: { contextIsolation: true, nodeIntegration: false }
  });

  authWindow.loadURL(`${icingaUrl}/icingaweb2/authentication/login`);
  const authSession = authWindow.webContents.session;

  authWindow.webContents.on('did-navigate', async (event, url) => {
    const isLoginPage = url.includes('/authentication/login');
    const isMicrosoft = url.includes('login.microsoftonline.com') || url.includes('live.com');
    if (isMicrosoft) return;

    if (url.startsWith(icingaUrl) && !isLoginPage) {
      const domainHost = new URL(icingaUrl).hostname;
      const [byUrl, byDomain] = await Promise.all([
        authSession.cookies.get({ url: icingaUrl }),
        authSession.cookies.get({ domain: domainHost })
      ]);

      const cookieMap = new Map();
      [...(byDomain || []), ...(byUrl || [])].forEach(c => {
        if (c && c.name && c.value) {
          cookieMap.set(c.name, `${c.name}=${c.value}`);
        }
      });

      const cookieString = Array.from(cookieMap.values()).join('; ');

      if (cookieString && (cookieString.includes('Icinga') || cookieString.includes('php') || cookieMap.size > 0)) {
        store.set('sessionCookies', cookieString);
        console.log('[SSO Icinga] Sesja autoryzowana.');
        authWindow.close();
        authWindow = null;
        if (mainWindow) { mainWindow.show(); mainWindow.focus(); }
        startPolling();
        fetchAllMonitoringData();
      }
    }
  });

  authWindow.on('closed', () => { authWindow = null; });
}

function startKarmaLogin() {
  if (authKarmaWindow) { authKarmaWindow.focus(); return; }
  const karmaUrl = getKarmaUrl();

  authKarmaWindow = new BrowserWindow({
    width: 600,
    height: 750,
    title: 'Logowanie Karma (SSO)',
    alwaysOnTop: true,
    webPreferences: { contextIsolation: true, nodeIntegration: false }
  });

  authKarmaWindow.loadURL(karmaUrl);
  const authSession = authKarmaWindow.webContents.session;

  authKarmaWindow.webContents.on('did-navigate', async (event, url) => {
    const isMicrosoft = url.includes('login.microsoftonline.com') || url.includes('live.com');
    if (isMicrosoft) return;

    if (url.startsWith(karmaUrl)) {
      const domainHost = new URL(karmaUrl).hostname;
      const [byUrl, byDomain] = await Promise.all([
        authSession.cookies.get({ url: karmaUrl }),
        authSession.cookies.get({ domain: domainHost })
      ]);

      const cookieMap = new Map();
      [...(byDomain || []), ...(byUrl || [])].forEach(c => {
        if (c && c.name && c.value) {
          cookieMap.set(c.name, `${c.name}=${c.value}`);
        }
      });

      const cookieString = Array.from(cookieMap.values()).join('; ');

      if (cookieString) {
        store.set('karmaCookies', cookieString);
        console.log('[SSO Karma] Sesja Karma zapisana.');
        authKarmaWindow.close();
        authKarmaWindow = null;
        fetchAllMonitoringData();
      }
    }
  });

  authKarmaWindow.on('closed', () => { authKarmaWindow = null; });
}

async function fetchIcingaRaw() {
  const cookies = store.get('sessionCookies');
  const icingaUrl = getIcingaUrl();
  if (!cookies || !icingaUrl) return { error: 'AUTH_REQUIRED', items: [] };

  const candidateUrls = [
    `${icingaUrl}/icingaweb2/icingadb/services?state.is_problem=y&limit=500&format=json`,
    `${icingaUrl}/icingaweb2/icingadb/services?state!=ok&limit=500&format=json`
  ];

  for (const targetUrl of candidateUrls) {
    try {
      const res = await fetch(targetUrl, {
        headers: { 
          'Cookie': cookies,
          'Accept': 'application/json, text/javascript, */*',
          'X-Requested-With': 'XMLHttpRequest'
        }
      });
      if (res.status === 404 || res.status === 403) continue;
      const rawText = await res.text();
      if (rawText.trim().startsWith('<')) continue;
      const parsed = JSON.parse(rawText);
      const items = Array.isArray(parsed) ? parsed : (parsed.data || parsed.results || []);
      return { error: null, items };
    } catch (err) {
      console.warn(`[Icinga DB Błąd]:`, err.message);
    }
  }
  return { error: 'ICINGA_FETCH_FAILED', items: [] };
}

async function fetchIcingaActiveDowntimes() {
  const cookies = store.get('sessionCookies');
  const icingaUrl = getIcingaUrl();
  if (!cookies || !icingaUrl) return [];

  const targetUrl = `${icingaUrl}/icingaweb2/icingadb/downtimes?format=json&limit=500`;
  try {
    const res = await fetch(targetUrl, {
      headers: {
        'Cookie': cookies,
        'Accept': 'application/json, text/javascript, */*',
        'X-Requested-With': 'XMLHttpRequest'
      }
    });
    if (!res.ok) return [];
    const text = await res.text();
    if (text.trim().startsWith('<')) return [];
    const json = JSON.parse(text);
    return Array.isArray(json) ? json : (json.data || json.results || []);
  } catch (err) {
    return [];
  }
}

async function fetchIcingaActiveComments() {
  const cookies = store.get('sessionCookies');
  const icingaUrl = getIcingaUrl();
  if (!cookies || !icingaUrl) return [];

  const candidateUrls = [
    `${icingaUrl}/icingaweb2/icingadb/comments?format=json&limit=500`,
    `${icingaUrl}/icingaweb2/icingadb/comments?limit=500&format=json`
  ];

  for (const targetUrl of candidateUrls) {
    try {
      const res = await fetch(targetUrl, {
        headers: {
          'Cookie': cookies,
          'Accept': 'application/json, text/javascript, */*',
          'X-Requested-With': 'XMLHttpRequest'
        }
      });
      if (!res.ok) continue;
      const text = await res.text();
      if (text.trim().startsWith('<')) continue;
      const json = JSON.parse(text);
      const items = Array.isArray(json) ? json : (json.data || json.results || []);
      if (items && items.length > 0) return items;
    } catch (err) {}
  }
  return [];
}

async function fetchKarmaRaw() {
  const karmaUrl = getKarmaUrl();
  const targetUrl = `${karmaUrl}/alerts.json`;
  const cookies = store.get('karmaCookies') || '';

  const payload = {
    defaultGroupLimit: 5,
    filters: ["@state=active", "severity=critical", "alertname!=RebootRequired"],
    gridLabel: "replica",
    gridLimits: {},
    gridSortReverse: true,
    groupLimits: {},
    sortLabel: "",
    sortOrder: "",
    sortReverse: false
  };

  try {
    const headers = {
      'Accept': 'application/json',
      'Content-Type': 'text/plain;charset=UTF-8',
      'Origin': karmaUrl
    };
    if (cookies) headers['Cookie'] = cookies;

    const res = await fetch(targetUrl, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify(payload)
    });

    if (res.status === 401 || res.status === 403) return { error: 'AUTH_REQUIRED', items: [] };
    if (!res.ok) return { error: `HTTP_${res.status}`, items: [] };

    const data = await res.json();
    let rawAlerts = [];

    if (Array.isArray(data.grids)) {
      for (const grid of data.grids) {
        const gName = String(grid.labelName || grid.label_name || grid.LabelName || '').toLowerCase();
        const gVal = String(grid.labelValue || grid.label_value || grid.LabelValue || '').toLowerCase();

        if (gName === 'replica' && gVal && gVal !== 'replica01') {
          continue;
        }

        if (Array.isArray(grid.alertGroups)) {
          for (const group of grid.alertGroups) {
            if (Array.isArray(group.alerts)) {
              group.alerts.forEach(alert => {
                rawAlerts.push({
                  ...alert,
                  _gridLabelName: gName,
                  _gridLabelValue: gVal,
                  _groupLabels: group.labels,
                  _groupAnnotations: group.annotations
                });
              });
            }
          }
        }
      }
    }

    if (rawAlerts.length === 0 && Array.isArray(data.alertGroups)) {
      for (const group of data.alertGroups) {
        if (Array.isArray(group.alerts)) {
          group.alerts.forEach(alert => {
            rawAlerts.push({
              ...alert,
              _groupLabels: group.labels,
              _groupAnnotations: group.annotations
            });
          });
        }
      }
    }

    return { error: null, items: rawAlerts };
  } catch (err) {
    console.warn('[Karma API Wyjątek]:', err.message);
    return { error: err.message, items: [] };
  }
}

function getValFromSource(source, key) {
  if (!source) return null;
  if (Array.isArray(source)) {
    const found = source.find(item => item && (item.name === key || item.key === key));
    return found ? (found.value || found.val) : null;
  }
  if (typeof source === 'object') return source[key] || null;
  return null;
}

function extractKarmaField(alert, key) {
  return getValFromSource(alert.labels, key)
      || getValFromSource(alert._groupLabels, key)
      || getValFromSource(alert.annotations, key)
      || getValFromSource(alert._groupAnnotations, key);
}

function parseAlertTime(candidates) {
  for (const c of candidates) {
    if (!c) continue;
    if (typeof c === 'number') {
      return c > 1e11 ? c : c * 1000;
    }
    if (typeof c === 'string') {
      const num = Number(c);
      if (!isNaN(num) && num > 0) return num > 1e11 ? num : num * 1000;
      const parsed = Date.parse(c.replace(' ', 'T'));
      if (!isNaN(parsed)) return parsed;
    }
  }
  return null;
}

function formatIcingaDateTime(date) {
  const pad = (n) => String(n).padStart(2, '0');
  const Y = date.getFullYear();
  const m = pad(date.getMonth() + 1);
  const d = pad(date.getDate());
  const H = pad(date.getHours());
  const i = pad(date.getMinutes());
  const s = pad(date.getSeconds());
  return `${Y}-${m}-${d}T${H}:${i}:${s}`;
}

function unmarkLocallyDone(locallyDone, key) {
  if (!key) return;
  delete locallyDone[key];

  const clean = String(key).replace(/^\[KARMA\]\s*/, '');
  const parts = clean.split('!');
  if (parts.length >= 2) {
    const host = parts[0].trim();
    const service = parts[1].trim();

    delete locallyDone[`${host}!${service}`];
    delete locallyDone[`[KARMA] ${host}!${service}`];

    for (const k of Object.keys(locallyDone)) {
      const kClean = k.replace(/^\[KARMA\]\s*/, '');
      if (kClean === `${host}!${service}` || kClean.startsWith(`${host}!${service}!`)) {
        delete locallyDone[k];
      }
    }
  }
}

function getDoneRecord(locallyDone, key) {
  if (!key) return null;
  if (locallyDone[key]) return { record: locallyDone[key], matchedKey: key };

  const clean = String(key).replace(/^\[KARMA\]\s*/, '');
  const parts = clean.split('!');
  if (parts.length >= 2) {
    const legacy1 = `${parts[0].trim()}!${parts[1].trim()}`;
    if (locallyDone[legacy1]) return { record: locallyDone[legacy1], matchedKey: legacy1 };
    const legacy2 = `[KARMA] ${legacy1}`;
    if (locallyDone[legacy2]) return { record: locallyDone[legacy2], matchedKey: legacy2 };
  }
  return null;
}

async function fetchAllMonitoringData() {
  const [icingaRes, karmaRes, rawDowntimes, rawComments] = await Promise.all([
    fetchIcingaRaw(),
    fetchKarmaRaw(),
    fetchIcingaActiveDowntimes(),
    fetchIcingaActiveComments()
  ]);

  const now = Date.now();

  const dtMap = new Map();
  (rawDowntimes || []).forEach(d => {
    const h = String(d['host.name'] || d.host_name || (d.host && d.host.name) || '').toLowerCase();
    const s = String(d['service.name'] || d.service_name || (d.service && d.service.name) || '').toLowerCase();

    const startMs = parseAlertTime([
      d.scheduled_start_time,
      d.scheduled_start,
      d['downtime.scheduled_start_time'],
      d['downtime.scheduled_start'],
      d.start_time,
      d['downtime.start_time'],
      d.start,
      d['downtime.start']
    ]);

    let endMs = parseAlertTime([
      d.scheduled_end_time,
      d.scheduled_end,
      d['downtime.scheduled_end_time'],
      d['downtime.scheduled_end'],
      d.end_time,
      d['downtime.end_time'],
      d.end,
      d['downtime.end'],
      d.expiry_time
    ]);

    if (!endMs && startMs) {
      const durSec = Number(d.duration || d['downtime.duration']);
      if (!isNaN(durSec) && durSec > 0) {
        endMs = startMs + durSec * 1000;
      }
    }

    if (endMs && endMs <= now) return;

    const isCurrentlyActive = (!startMs || startMs <= now) && (!endMs || endMs > now);

    const rawComment = d.comment || d['downtime.comment'] || d.comment_data || '';
    const rawAuthor = d.author_name || d['downtime.author_name'] || d.author || '';
    let fullComment = '';
    if (rawAuthor && rawComment) {
      fullComment = `${rawAuthor}: ${rawComment}`;
    } else {
      fullComment = rawComment || rawAuthor || 'Brak komentarza';
    }

    const dtInfo = {
      id: String(d.id || ''),
      name: String(d.name || d['downtime.name'] || d.downtime_name || d.id || ''),
      startMs: startMs,
      endMs: endMs,
      comment: fullComment,
      isActive: isCurrentlyActive
    };

    const saveIfBetter = (key) => {
      const existing = dtMap.get(key);
      if (!existing || (!existing.isActive && dtInfo.isActive)) {
        dtMap.set(key, dtInfo);
      }
    };

    if (h && s) saveIfBetter(`${h}!${s}`);
    if (h && !s) saveIfBetter(`${h}!*`);
  });

  const ackMap = new Map();
  const sortedComments = [...(rawComments || [])].sort((a, b) => {
    const tA = parseAlertTime([a.entry_time, a['comment.entry_time'], a.time, a.timestamp]) || 0;
    const tB = parseAlertTime([b.entry_time, b['comment.entry_time'], b.time, b.timestamp]) || 0;
    return tA - tB;
  });

  sortedComments.forEach(c => {
    const h = String(c['host.name'] || c.host_name || (c.host && (c.host.name || c.host.display_name)) || '').toLowerCase().trim();
    const s = String(c['service.name'] || c.service_name || (c.service && (c.service.name || c.service.display_name)) || '').toLowerCase().trim();

    const rawComment = c.text || c.comment || c['comment.text'] || c['comment.comment'] || c.message || '';
    const rawAuthor = c.author || c.author_name || c['comment.author'] || c['comment.author_name'] || '';

    let formatted = '';
    if (rawAuthor && rawComment) {
      const cleanAuthor = rawAuthor.includes('@') ? rawAuthor.split('@')[0] : rawAuthor;
      formatted = `${cleanAuthor}: ${rawComment}`;
    } else {
      formatted = rawComment || rawAuthor || '';
    }

    if (formatted) {
      if (h && s) ackMap.set(`${h}!${s}`, formatted);
      if (h && !s) ackMap.set(`${h}!*`, formatted);
    }
  });

  const locallyDone = store.get('locallyDone') || {};
  let needsStoreSave = false;
  const processedList = [];
  let critCount = 0;
  let warnCount = 0;

  // 1. KARMA
  const karmaUrl = getKarmaUrl();
  let karmaIndex = 0;
  for (const a of (karmaRes.items || [])) {
    karmaIndex++;

    const replicaVal = String(
      extractKarmaField(a, 'replica') || 
      (a._gridLabelName === 'replica' ? a._gridLabelValue : '') || 
      ''
    ).trim().toLowerCase();

    if (replicaVal && replicaVal !== 'replica01') {
      continue;
    }

    const isSilenced = a.state === 'suppressed' 
                    || (Array.isArray(a.silencedBy) && a.silencedBy.length > 0)
                    || (Array.isArray(a.inhibitedBy) && a.inhibitedBy.length > 0);
    if (isSilenced) continue;

    let rawHost = extractKarmaField(a, 'instance')
               || extractKarmaField(a, 'node')
               || extractKarmaField(a, 'host')
               || extractKarmaField(a, 'hostname');

    const output = extractKarmaField(a, 'description')
                || extractKarmaField(a, 'summary')
                || extractKarmaField(a, 'message')
                || extractKarmaField(a, 'info')
                || 'Alertmanager Critical Problem';

    if (!rawHost) {
      const match = String(output).match(/(?:na|on|instance|host)\s+([a-zA-Z0-9.\-_]+)/i);
      if (match) rawHost = match[1];
      else rawHost = extractKarmaField(a, 'cluster') || 'Cluster';
    }

    if (rawHost && typeof rawHost === 'string' && rawHost.includes(':')) {
      rawHost = rawHost.split(':')[0];
    }
    rawHost = String(rawHost || 'Cluster');

    const service = String(extractKarmaField(a, 'alertname')
                 || extractKarmaField(a, 'alert_name')
                 || extractKarmaField(a, 'alert')
                 || 'CriticalAlert');

    const uniqueId = String(a.fingerprint || a.id || `${rawHost}-${service}-${karmaIndex}`);
    const key = `[KARMA] ${rawHost}!${service}!${uniqueId}`;

    let startTimestamp = parseAlertTime([
      a.startsAt,
      a.starts_at,
      extractKarmaField(a, 'startsAt'),
      extractKarmaField(a, 'starts_at')
    ]);

    if (!startTimestamp) {
      if (!firstSeenMemory[key]) firstSeenMemory[key] = now - 60000;
      startTimestamp = firstSeenMemory[key];
    }

    const diff = now - startTimestamp;
    const durationMs = Math.max(1000, diff);

    let isDone = false;
    let localNote = null;
    const match = getDoneRecord(locallyDone, key);

    if (match) {
      const rec = match.record;
      let isNewIncident = false;

      if (rec.alertStart && startTimestamp) {
        if (startTimestamp > rec.alertStart + 5000) isNewIncident = true;
      } else if (rec.timestamp && startTimestamp) {
        if (startTimestamp > rec.timestamp + 10000) isNewIncident = true;
      }

      if (isNewIncident) {
        unmarkLocallyDone(locallyDone, key);
        needsStoreSave = true;
      } else {
        isDone = true;
        localNote = rec.note || null;
        if (!rec.alertStart && startTimestamp) {
          rec.alertStart = startTimestamp;
          needsStoreSave = true;
        }
      }
    }

    if (!isDone) critCount++;

    processedList.push({
      id: uniqueId,
      key,
      host: `[KARMA] ${rawHost}`,
      service: service,
      state: 2,
      output: String(output),
      durationMs: durationMs,
      startTimestamp: startTimestamp,
      acknowledged: false,
      inDowntime: false,
      downtimeId: null,
      downtimeName: null,
      downtimeStartMs: null,
      downtimeEndMs: null,
      downtimeComment: '',
      ackComment: '',
      isLocallyDone: isDone,
      localNote: localNote,
      isKarma: true,
      isSupportD: false,
      karmaWebUrl: `${karmaUrl}/?q=%40state%3Dactive&q=severity%3Dcritical&q=alertname%21%3DRebootRequired`
    });
  }

  // 2. ICINGA (Z DETEKCJĄ SUPPORT D)
  const icingaBaseUrl = getIcingaUrl();
  let icingaIndex = 0;
  for (const s of (icingaRes.items || [])) {
    icingaIndex++;

    const host = String(s['host.name'] || s.host_name || (s.host && (s.host.name || s.host.display_name)) || s.host_display_name || 'Host');
    const service = String(s.service_description || s.service_name || s.name || 'Usluga');
    const cleanHost = host.replace(/^\[KARMA\]\s*/, '').toLowerCase();
    const cleanService = service.toLowerCase();

    const matchedDt = dtMap.get(`${cleanHost}!${cleanService}`) || dtMap.get(`${cleanHost}!*`) || null;

    const inDowntime = Boolean(
      (matchedDt && matchedDt.isActive) ||
      s.service_in_downtime ||
      s.in_downtime ||
      s.is_in_downtime ||
      (s.state && (s.state.in_downtime || s.state.is_in_downtime || s.state.in_scheduled_downtime))
    );

    const acknowledged = Boolean(
      s.service_acknowledged ||
      s.acknowledged ||
      s.is_acknowledged ||
      (s.state && (s.state.is_acknowledged || s.state.is_ack))
    );

    let ackComment = ackMap.get(`${cleanHost}!${cleanService}`) || ackMap.get(`${cleanHost}!*`) || '';
    if (!ackComment && acknowledged) {
      const inlineComment = s['acknowledgement.text'] || s['acknowledgement.comment'] || s.acknowledgement_comment || (s.acknowledgement && (s.acknowledgement.text || s.acknowledgement.comment)) || '';
      const inlineAuthor = s['acknowledgement.author'] || s['acknowledgement.author_name'] || s.acknowledgement_author_name || (s.acknowledgement && (s.acknowledgement.author || s.acknowledgement.author_name)) || '';
      if (inlineAuthor && inlineComment) {
        const cleanAuthor = inlineAuthor.includes('@') ? inlineAuthor.split('@')[0] : inlineAuthor;
        ackComment = `${cleanAuthor}: ${inlineComment}`;
      } else if (inlineComment) {
        ackComment = inlineComment;
      }
    }

    let state = 0;
    const textState = (s.state && s.state.text ? s.state.text : '').toLowerCase();

    if (textState === 'critical' || s.service_state === 2 || (s.state && s.state.hard_state === 2)) {
      state = 2;
    } else if (textState === 'warning' || s.service_state === 1 || (s.state && s.state.hard_state === 1)) {
      state = 1;
    } else if (textState === 'unknown' || s.service_state === 3 || (s.state && s.state.hard_state === 3)) {
      state = 3;
    } else if (typeof s.state === 'number') {
      state = s.state;
    }

    if (state === 0 || textState === 'ok') continue;

    const serviceId = String(s.id || `${host}-${service}-${icingaIndex}`);
    const key = `${host}!${service}!${serviceId}`;

    let startTimestamp = parseAlertTime([
      s['state.last_state_change'],
      s['service.last_state_change'],
      s.last_state_change,
      s.state && s.state.last_state_change,
      s['last_state_change'],
      s['state.last_update'],
      s.last_update
    ]);

    if (!startTimestamp) {
      if (!firstSeenMemory[key]) firstSeenMemory[key] = now - 60000;
      startTimestamp = firstSeenMemory[key];
    }

    const diff = now - startTimestamp;
    const durationMs = Math.max(1000, diff);
    const output = String(s.service_output || s.output || (s.state && s.state.output) || 'Brak opisu wyjscia');

    let isDone = false;
    let localNote = null;
    const match = getDoneRecord(locallyDone, key);

    if (match) {
      const rec = match.record;
      let isNewIncident = false;

      if (rec.alertStart && startTimestamp) {
        if (startTimestamp > rec.alertStart + 5000) isNewIncident = true;
      } else if (rec.timestamp && startTimestamp) {
        if (startTimestamp > rec.timestamp + 10000) isNewIncident = true;
      }

      if (isNewIncident) {
        unmarkLocallyDone(locallyDone, key);
        needsStoreSave = true;
      } else {
        isDone = true;
        localNote = rec.note || null;
        if (!rec.alertStart && startTimestamp) {
          rec.alertStart = startTimestamp;
          needsStoreSave = true;
        }
      }
    }

    let isSupportD = await resolveHostSupport(cleanHost, s);
    if (!isSupportD && matchedDt && /support\s*d/i.test(matchedDt.comment)) {
      isSupportD = true;
    }

    const icingaWebUrl = `${icingaBaseUrl}/icingaweb2/icingadb/service?name=${encodeURIComponent(service)}&host.name=${encodeURIComponent(cleanHost)}`;

    processedList.push({
      id: serviceId,
      key,
      host,
      service,
      state,
      output,
      durationMs: durationMs,
      startTimestamp: startTimestamp,
      acknowledged: acknowledged,
      inDowntime: inDowntime,
      downtimeId: matchedDt ? matchedDt.id : null,
      downtimeName: matchedDt ? matchedDt.name : null,
      downtimeStartMs: matchedDt ? matchedDt.startMs : null,
      downtimeEndMs: matchedDt ? matchedDt.endMs : null,
      downtimeComment: matchedDt ? matchedDt.comment : '',
      ackComment: ackComment || '',
      isLocallyDone: isDone,
      localNote: localNote,
      isKarma: false,
      isSupportD: isSupportD,
      icingaWebUrl
    });
  }

  if (needsStoreSave) {
    store.set('locallyDone', locallyDone);
  }

  processedList.sort((a, b) => {
    if (a.isKarma && !b.isKarma) return -1;
    if (!a.isKarma && b.isKarma) return 1;
    return b.state - a.state;
  });

  cachedAlerts = processedList;

  let trayCrit = 0;
  let trayWarn = 0;
  processedList.forEach(a => {
    if (!a.isLocallyDone && !a.acknowledged && !a.inDowntime) {
      if (a.state === 2) trayCrit++;
      if (a.state === 1) trayWarn++;
    }
  });

  const totalActive = trayCrit + trayWarn;
  let status = trayCrit > 0 ? 'CRIT' : (trayWarn > 0 ? 'WARN' : 'OK');
  if (icingaRes.error === 'AUTH_REQUIRED' && processedList.length === 0) status = 'AUTH';
  updateTray(status, totalActive);

  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('alerts-updated', processedList);
  }
}

function updateTray(status, count) {
  if (!tray) return;
  let color = '#2b8a3e';
  let tooltip = 'Monitoring: Wszystko zielone';

  if (status === 'CRIT') { color = '#e03131'; tooltip = `Monitoring: ${count} awarii (CRITICAL)`; }
  else if (status === 'WARN') { color = '#f59f00'; tooltip = `Monitoring: ${count} ostrzeżeń (WARNING)`; }
  else if (status === 'AUTH') { color = '#868e96'; tooltip = 'Monitoring: Wymagane logowanie SSO Icinga'; }
  else if (status === 'ERR') { color = '#495057'; tooltip = 'Monitoring: Błąd pobierania danych'; }

  tray.setImage(createColorIcon(color));
  tray.setToolTip(tooltip);
}

async function executeIcingaForm(relativeUrl, fieldOverrides = {}, preferredButtonText = '') {
  const cookies = store.get('sessionCookies');
  const icingaUrl = getIcingaUrl();
  if (!cookies || !icingaUrl) return { success: false, error: 'NO_AUTH' };

  const fullUrl = `${icingaUrl}/icingaweb2${relativeUrl}`;

  let getRes;
  try {
    getRes = await fetch(fullUrl, {
      headers: {
        'Cookie': cookies,
        'X-Requested-With': 'XMLHttpRequest',
        'X-Icinga-Container': 'modal-content',
        'X-Icinga-Accept': 'text/html'
      }
    });
  } catch (err) {
    return { success: false, error: err.message };
  }

  if (!getRes.ok && getRes.status !== 302) {
    return { success: false, error: `GET failed: HTTP ${getRes.status}` };
  }

  const getHtml = await getRes.text();

  const formMatch = getHtml.match(/<form\b[^>]*action="([^"]*)"[^>]*>/i)
                 || getHtml.match(/<form\b[^>]*action='([^']*)'[^>]*>/i);
  
  let formAction = (formMatch && formMatch[1]) ? formMatch[1] : fullUrl;
  formAction = formAction.replace(/&amp;/g, '&');

  if (formAction && !formAction.startsWith('http')) {
    formAction = `${icingaUrl}${formAction.startsWith('/') ? '' : '/'}${formAction}`;
  }

  const params = new URLSearchParams();

  try {
    const fullUrlObj = new URL(fullUrl);
    const actionUrlObj = new URL(formAction);
    fullUrlObj.searchParams.forEach((val, key) => {
      if (key !== 'showCompact' && !actionUrlObj.searchParams.has(key)) {
        params.append(key, val);
      }
    });
  } catch (e) {}

  const inputTagRegex = /<input\b[^>]*>/gi;
  let tagMatch;
  while ((tagMatch = inputTagRegex.exec(getHtml)) !== null) {
    const tag = tagMatch[0];
    const typeM = tag.match(/\btype=(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i);
    const nameM = tag.match(/\bname=(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i);
    const valM = tag.match(/\bvalue=(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i);

    const type = (typeM ? (typeM[1] || typeM[2] || typeM[3]) : 'text').toLowerCase();
    const name = nameM ? (nameM[1] || nameM[2] || nameM[3]) : '';
    const val = valM ? (valM[1] || valM[2] || valM[3]) : '';

    if (!name) continue;

    if (type === 'checkbox' || type === 'radio') {
      if (/\bchecked\b/i.test(tag)) {
        params.append(name, val || '1');
      }
      continue;
    }

    if (type === 'button' || type === 'submit') continue;
    params.append(name, val);
  }

  let foundSubmitBtn = null;
  const btnRegex = /<button\b([^>]*)>([\s\S]*?)<\/button>/gi;
  let bMatch;
  while ((bMatch = btnRegex.exec(getHtml)) !== null) {
    const attrs = bMatch[1];
    const text = bMatch[2].replace(/<[^>]+>/g, '').trim();

    if (/data-dismiss=["']?modal["']?/i.test(attrs)) continue;
    if (/\bclass=["'][^"']*\bclose\b[^"']*["']/i.test(attrs)) continue;
    if (/^(anuluj|cancel|zamknij|close|×)$/i.test(text)) continue;

    const isSubmit = /type=["']?submit["']?/i.test(attrs) || !/type=["']?button["']?/i.test(attrs);
    if (isSubmit) {
      const nameM = attrs.match(/\bname=(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i);
      const valM = attrs.match(/\bvalue=(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i);
      foundSubmitBtn = {
        name: nameM ? (nameM[1] || nameM[2] || nameM[3]) : 'btn_submit',
        value: valM ? (valM[1] || valM[2] || valM[3]) : (preferredButtonText || text)
      };
      break;
    }
  }

  if (!foundSubmitBtn) {
    const inputSubmitRegex = /<input\b[^>]*type=["']?submit["']?[^>]*>/gi;
    let sMatch = inputSubmitRegex.exec(getHtml);
    if (sMatch) {
      const tag = sMatch[0];
      const nameM = tag.match(/\bname=(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i);
      const valM = tag.match(/\bvalue=(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i);
      foundSubmitBtn = {
        name: nameM ? (nameM[1] || nameM[2] || nameM[3]) : 'btn_submit',
        value: valM ? (valM[1] || valM[2] || valM[3]) : (preferredButtonText || 'Submit')
      };
    }
  }

  if (foundSubmitBtn) {
    params.set(foundSubmitBtn.name, foundSubmitBtn.value);
  } else if (preferredButtonText) {
    params.set('btn_submit', preferredButtonText);
  }

  if (!params.get('CSRFToken')) {
    const tokenMatch = getHtml.match(/name="CSRFToken"\s+value="([^"]+)"/i)
                    || getHtml.match(/value="([^"]+)"\s+name="CSRFToken"/i);
    if (tokenMatch) params.set('CSRFToken', tokenMatch[1]);
  }

  for (const [k, v] of Object.entries(fieldOverrides)) {
    if (v === null || v === undefined) continue;
    if (k === 'persistent' && (v === 'n' || v === false)) {
      params.delete('persistent');
    } else {
      params.set(k, String(v));
    }
  }

  const csrfToken = params.get('CSRFToken');

  try {
    const postRes = await fetch(formAction, {
      method: 'POST',
      redirect: 'manual',
      headers: {
        'Cookie': cookies,
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'X-Requested-With': 'XMLHttpRequest',
        'X-CSRF-Token': csrfToken || '',
        'X-Icinga-Container': 'modal-content',
        'X-Icinga-Accept': 'text/html',
        'Origin': icingaUrl,
        'Referer': fullUrl
      },
      body: params.toString()
    });

    const notif = postRes.headers.get('x-icinga-notification');
    const notifText = notif ? decodeURIComponent(notif) : '';
    const redirectHeader = postRes.headers.get('x-icinga-redirect') || postRes.headers.get('location');
    const resText = await postRes.text();

    console.log(`[Icinga Form Result] URL: ${formAction} | Status: ${postRes.status} | Notif: ${notifText} | Redirect: ${redirectHeader || 'none'}`);

    const isSuccessStatus = postRes.status === 302 || postRes.status === 200 || postRes.status === 204;
    const hasRedirect = Boolean(redirectHeader);
    const hasSuccessNotif = /success|scheduled|initiated|check|acknowledged|removed|deleted|usunięto|powodzen/i.test(notifText);
    const hasCloseModal = resText.includes('closeModal') || (resText.trim() === '' && postRes.status === 200);
    const hasFormErrors = resText.includes('class="errors"') || resText.includes('has-error');

    if (!hasFormErrors && (postRes.status === 302 || hasRedirect || hasSuccessNotif || hasCloseModal)) {
      return { success: true, notif: notifText || 'Success' };
    }

    if (hasFormErrors) {
      const errMatch = resText.match(/<ul[^>]+class="errors"[^>]*>([\s\S]*?)<\/ul>/i);
      const errMsg = errMatch ? errMatch[1].replace(/<[^>]+>/g, ' ').trim() : 'Błąd walidacji formularza';
      console.warn('[Icinga Błędy formularza]:', errMsg);
      return { success: false, error: errMsg };
    }

    return { success: isSuccessStatus, notif: notifText };
  } catch (err) {
    console.error('[Icinga Form Error]:', err.message);
    return { success: false, error: err.message };
  }
}

function parseHandoverLine(rawLine) {
  const line = rawLine.trim();
  if (!line || line.startsWith('#') || line.startsWith('//') || line.startsWith('=')) {
    return null;
  }

  let targetPart = line;
  let notePart = 'Handover z dyżuru';

  if (line.includes(' | ')) {
    const parts = line.split(' | ');
    targetPart = parts[0].trim();
    notePart = parts.slice(1).join(' | ').trim();
  } else if (line.includes(' :: ')) {
    const parts = line.split(' :: ');
    targetPart = parts[0].trim();
    notePart = parts.slice(1).join(' :: ').trim();
  } else if (line.includes(' - ')) {
    const parts = line.split(' - ');
    targetPart = parts[0].trim();
    notePart = parts.slice(1).join(' - ').trim();
  }

  let host = '';
  let service = '';

  if (targetPart.includes(' ! ')) {
    const [h, s] = targetPart.split(' ! ');
    host = h.trim();
    service = s.trim();
  } else if (targetPart.includes('!')) {
    const idx = targetPart.indexOf('!');
    host = targetPart.substring(0, idx).trim();
    service = targetPart.substring(idx + 1).trim();
  } else {
    return null;
  }

  if (!host || !service) return null;
  return { host, service, note: notePart };
}

// IPC Handlers
ipcMain.handle('get-alerts', () => cachedAlerts);
ipcMain.handle('refresh-now', async () => { await fetchAllMonitoringData(); return true; });
ipcMain.on('trigger-sso', () => startSsoLogin());
ipcMain.on('trigger-karma-sso', () => startKarmaLogin());
ipcMain.on('open-external-url', (_e, url) => { if (url) shell.openExternal(url); });

// CONTEXT MENU PPM (BEZ SSH I GUACAMOLE)
ipcMain.on('show-context-menu', (event, { host, service, output, localNote, downtimeComment, ackComment }) => {
  const rawCleanHost = String(host).replace(/^\[KARMA\]\s*/, '').split(':')[0].trim();
  const cleanHost = rawCleanHost.replace(/[^a-zA-Z0-9.-_]/g, '');
  const cleanOutput = String(output || '').replace(/\r?\n|\r/g, ' ').trim();
  const noteText = localNote ? String(localNote).trim() : '';
  const dtCommentText = downtimeComment ? String(downtimeComment).trim() : '';
  const ackCommentText = ackComment ? String(ackComment).trim() : '';

  const clientPrefix = cleanHost.includes('-') ? cleanHost.split('-')[0].trim() : cleanHost;
  const docsUrl = `https://readme.hostersi.systems/search?q=${encodeURIComponent(clientPrefix)}&ref=collection`;

  const menuTemplate = [
    {
      label: `📖 Dokumentacja (${clientPrefix})`,
      click: () => shell.openExternal(docsUrl)
    },
    { type: 'separator' },
    {
      label: `📋 Kopiuj nazwę hosta (${cleanHost})`,
      click: () => { clipboard.writeText(cleanHost); }
    },
    {
      label: `📋 Kopiuj: ${cleanHost} - ${service}`,
      click: () => { clipboard.writeText(`${cleanHost} - ${service}`); }
    },
    {
      label: `📋 Kopiuj całość (host - service - błąd)`,
      click: () => { clipboard.writeText(`${cleanHost} - ${service} - ${cleanOutput}`); }
    },
    {
      label: `📌 Kopiuj notatkę (${noteText})`,
      enabled: Boolean(noteText),
      click: () => { if (noteText) clipboard.writeText(noteText); }
    },
    {
      label: `💬 Kopiuj komentarz DT (${dtCommentText})`,
      enabled: Boolean(dtCommentText),
      click: () => { if (dtCommentText) clipboard.writeText(dtCommentText); }
    },
    {
      label: `💬 Kopiuj komentarz Ack (${ackCommentText})`,
      enabled: Boolean(ackCommentText),
      click: () => { if (ackCommentText) clipboard.writeText(ackCommentText); }
    }
  ];

  const menu = Menu.buildFromTemplate(menuTemplate);
  const win = BrowserWindow.fromWebContents(event.sender);
  menu.popup({ window: win });
});

ipcMain.handle('toggle-local-done', (_e, { key, note }) => {
  const locallyDone = store.get('locallyDone') || {};
  const isDone = Boolean(getDoneRecord(locallyDone, key));

  if (isDone) {
    unmarkLocallyDone(locallyDone, key);
  } else {
    const alert = cachedAlerts.find(a => a.key === key);
    locallyDone[key] = {
      timestamp: Date.now(),
      alertStart: alert ? alert.startTimestamp : null,
      note: note || 'Wyciszone lokalnie'
    };
  }

  store.set('locallyDone', locallyDone);
  fetchAllMonitoringData();
  return true;
});

ipcMain.handle('bulk-local-done', (_e, { keys, note }) => {
  const locallyDone = store.get('locallyDone') || {};
  (keys || []).forEach(k => {
    const alert = cachedAlerts.find(a => a.key === k);
    locallyDone[k] = {
      timestamp: Date.now(),
      alertStart: alert ? alert.startTimestamp : null,
      note: note || 'Wyciszone hurtowo'
    };
  });
  store.set('locallyDone', locallyDone);
  fetchAllMonitoringData();
  return true;
});

ipcMain.handle('bulk-local-undone', (_e, { keys }) => {
  const locallyDone = store.get('locallyDone') || {};
  (keys || []).forEach(k => {
    unmarkLocallyDone(locallyDone, k);
  });
  store.set('locallyDone', locallyDone);
  fetchAllMonitoringData();
  return true;
});

ipcMain.handle('clear-all-done', () => {
  store.set('locallyDone', {});
  fetchAllMonitoringData();
  return true;
});

ipcMain.handle('import-handover', (_e, rawText) => {
  const locallyDone = store.get('locallyDone') || {};
  let count = 0;

  const trimmed = (rawText || '').trim();
  if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
    try {
      const parsed = JSON.parse(trimmed);
      const list = Array.isArray(parsed) ? parsed : Object.values(parsed);
      list.forEach(item => {
        if (item && item.host && item.service) {
          const key = `${item.host.trim()}!${item.service.trim()}`;
          locallyDone[key] = {
            timestamp: Date.now(),
            alertStart: null,
            note: item.note || 'Handover z dyżuru'
          };
          count++;
        }
      });
      store.set('locallyDone', locallyDone);
      fetchAllMonitoringData();
      return count;
    } catch (err) {}
  }

  const lines = (rawText || '').split('\n');
  lines.forEach(line => {
    const parsed = parseHandoverLine(line);
    if (parsed) {
      const key = `${parsed.host}!${parsed.service}`;
      locallyDone[key] = {
        timestamp: Date.now(),
        alertStart: null,
        note: parsed.note
      };
      count++;
    }
  });

  store.set('locallyDone', locallyDone);
  fetchAllMonitoringData();
  return count;
});

// RECHECK
ipcMain.handle('icinga-recheck', async (_e, { host, service }) => {
  const cleanHost = host.replace(/^\[KARMA\]\s*/, '');
  const modalUrl = `/icingadb/service/check-now?name=${encodeURIComponent(service)}&host.name=${encodeURIComponent(cleanHost)}&showCompact=1`;
  
  const result = await executeIcingaForm(modalUrl, {}, 'Check now');
  if (result.success) {
    setTimeout(fetchAllMonitoringData, 2500);
    return true;
  }
  return false;
});

// ACKNOWLEDGE (ZAPIS W ICINGA DB)
ipcMain.handle('icinga-ack', async (_e, { host, service, comment, persistent }) => {
  const cleanHost = host.replace(/^\[KARMA\]\s*/, '');
  const modalUrl = `/icingadb/service/acknowledge?name=${encodeURIComponent(service)}&host.name=${encodeURIComponent(cleanHost)}&showCompact=1`;

  const result = await executeIcingaForm(modalUrl, {
    comment: comment || 'Potwierdzone z OpsHub',
    sticky: 'y',
    persistent: persistent !== false ? 'y' : 'n',
    notify: 'n',
    expire: 'n'
  }, 'Acknowledge problem');

  if (result.success) {
    setTimeout(fetchAllMonitoringData, 1500);
    return true;
  }
  return false;
});

// UNACK
ipcMain.handle('icinga-remove-ack', async (_e, { host, service }) => {
  const cleanHost = host.replace(/^\[KARMA\]\s*/, '');
  const modalUrl = `/icingadb/service/remove-acknowledgement?name=${encodeURIComponent(service)}&host.name=${encodeURIComponent(cleanHost)}&showCompact=1`;

  const result = await executeIcingaForm(modalUrl, {}, 'Remove acknowledgement');
  if (result.success) {
    setTimeout(fetchAllMonitoringData, 1500);
    return true;
  }
  return false;
});

// DOWNTIME
ipcMain.handle('icinga-downtime', async (_e, { host, service, minutes, comment, startStr, endStr }) => {
  const cleanHost = host.replace(/^\[KARMA\]\s*/, '');
  const modalUrl = `/icingadb/service/schedule-downtime?name=${encodeURIComponent(service)}&host.name=${encodeURIComponent(cleanHost)}&showCompact=1`;

  const now = new Date();
  const finalMinutes = Math.max(1, Number(minutes) || 60);
  const durationSec = finalMinutes * 60;
  const finalStart = startStr || formatIcingaDateTime(now);

  let finalEnd = endStr;
  if (!finalEnd) {
    const end = new Date(now.getTime() + durationSec * 1000);
    finalEnd = formatIcingaDateTime(end);
  }

  const result = await executeIcingaForm(modalUrl, {
    start: finalStart,
    end: finalEnd,
    duration: String(durationSec),
    flexible: 'n',
    child_options: '0',
    comment: comment || `Prace serwisowe (${finalMinutes}m)`
  }, 'Schedule downtime');

  if (result.success) {
    setTimeout(fetchAllMonitoringData, 1500);
    return true;
  }
  return false;
});

// REMOVE DOWNTIME
ipcMain.handle('icinga-remove-downtime', async (_e, arg1, arg2, arg3, arg4, arg5) => {
  let host, service, dtName, dtId;
  if (typeof arg1 === 'object' && arg1 !== null) {
    ({ host, service, dtName, dtId } = arg1);
  } else if (arg5 !== undefined) {
    host = arg2; service = arg3; dtName = arg4; dtId = arg5;
  } else if (arg4 !== undefined) {
    host = arg1; service = arg2; dtName = arg3; dtId = arg4;
  } else {
    host = arg1; service = arg2;
  }

  const cleanHost = String(host || '').replace(/^\[KARMA\]\s*/, '').trim();
  const cleanService = String(service || '').trim();
  const cookies = store.get('sessionCookies');
  const icingaUrl = getIcingaUrl();
  if (!cookies || !icingaUrl || !cleanHost) return false;

  console.log(`[Icinga Remove Downtime] Wycofywanie okna prac dla: ${cleanHost} - ${cleanService}`);

  let idToUse = dtId;
  const activeList = await fetchIcingaActiveDowntimes();
  const match = activeList.find(d => {
    const h = String(d['host.name'] || d.host_name || (d.host && d.host.name) || '').toLowerCase();
    const s = String(d['service.name'] || d.service_name || (d.service && d.service.name) || '').toLowerCase();
    return h === cleanHost.toLowerCase() && (s === cleanService.toLowerCase() || !s);
  });
  if (match && match.id) {
    idToUse = match.id;
  }

  if (idToUse) {
    const idUrl = `/icingadb/downtimes/delete?id=${encodeURIComponent(idToUse)}&showCompact=1`;
    const resId = await executeIcingaForm(idUrl, {}, 'Delete downtime');
    if (resId.success) {
      setTimeout(fetchAllMonitoringData, 1500);
      return true;
    }
  }

  const targetRelativeUrl = `/icingadb/downtimes/delete?service.name=${encodeURIComponent(cleanService)}&host.name=${encodeURIComponent(cleanHost)}&showCompact=1`;
  const res = await executeIcingaForm(targetRelativeUrl, {}, 'Delete downtime');

  if (res.success) {
    setTimeout(fetchAllMonitoringData, 1500);
    return true;
  }

  return false;
});

function startPolling() {
  if (pollTimer) clearInterval(pollTimer);
  const interval = (store.get('checkIntervalSec') || 30) * 1000;
  pollTimer = setInterval(fetchAllMonitoringData, interval);
}

app.whenReady().then(() => {
  createMainWindow();
  createTray();
  startPolling();
  fetchAllMonitoringData();
});