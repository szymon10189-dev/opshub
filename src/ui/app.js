let currentAlerts = [];
let pendingAck = null;
let activeSourceFilter = 'all';

// Stan filtru z pigułek metryk ('crit' | 'warn' | 'unknown' | 'acked' | 'dt' | 'karma' | 'icinga')
let activeMetricFilter = null;

// Stan zaznaczenia i multiselect
let selectedKeys = new Set();
let lastClickedIndex = -1;

// Stan myszy
let isMouseDown = false;
let isDragSelecting = false;
let dragStartIndex = -1;
let dragMode = 'select';

// Stan szerokości kolumn
let colWidths = {
  status: 140,
  time: 75,
  host: 250,
  service: 230
};

// Stan modali
let pendingDoneTarget = null;
let pendingDtTarget = null;

// Stan sortowania i grupowania
let sortField = 'state';
let sortAsc = false;
let expandedHosts = new Set();

// Elementy DOM
const container = document.getElementById('alerts-list');
const searchInput = document.getElementById('search-input');
const hideDoneCheckbox = document.getElementById('hide-done-checkbox');
const hideSourceCheckbox = document.getElementById('hide-source-checkbox');
const hideStatusCheckbox = document.getElementById('hide-status-checkbox');
const groupHostsCheckbox = document.getElementById('group-hosts-checkbox');
const selectAllCheckbox = document.getElementById('select-all-checkbox');
const tabButtons = document.querySelectorAll('.tab-btn');
const themeSelect = document.getElementById('theme-select');
const btnOpenCustomTheme = document.getElementById('btn-open-custom-theme');
const btnViewCompact = document.getElementById('btn-view-compact');
const btnViewCards = document.getElementById('btn-view-cards');
const copyToast = document.getElementById('copy-toast');

// Dropdown Opcji Widoku
const btnToggleOptionsMenu = document.getElementById('btn-toggle-options-menu');
const optionsDropdownMenu = document.getElementById('options-dropdown-menu');

// Pływający dock
const bulkActionBar = document.getElementById('bulk-action-bar');
const bulkSelectedCount = document.getElementById('bulk-selected-count');
const bulkCountNums = document.querySelectorAll('.bulk-count-num');
const btnBulkCopyHs = document.getElementById('btn-bulk-copy-hs');
const btnBulkRecheck = document.getElementById('btn-bulk-recheck');
const btnBulkRefresh = document.getElementById('btn-bulk-refresh');
const btnBulkAck = document.getElementById('btn-bulk-ack');
const btnBulkUnack = document.getElementById('btn-bulk-unack');
const btnBulkDt = document.getElementById('btn-bulk-dt');
const btnBulkRemoveDt = document.getElementById('btn-bulk-remove-dt');
const btnBulkDone = document.getElementById('btn-bulk-done');
const btnBulkUndone = document.getElementById('btn-bulk-undone');
const btnBulkCopyNotes = document.getElementById('btn-bulk-copy-notes');
const btnBulkClear = document.getElementById('btn-bulk-clear');

// Modal DT
const modalDowntime = document.getElementById('modal-downtime');
const dtModalTitle = document.getElementById('dt-modal-title');
const dtTargetLabel = document.getElementById('dt-target-label');
const dtPresetSelect = document.getElementById('dt-preset-select');
const dtCustomMinutes = document.getElementById('dt-custom-minutes');
const dtCalendarWrap = document.getElementById('dt-calendar-wrap');
const dtCalendarInput = document.getElementById('dt-calendar-input');
const dtCommentInput = document.getElementById('dt-comment-input');

// Modal Done
const modalDone = document.getElementById('modal-done');
const doneModalTitle = document.getElementById('done-modal-title');
const doneTargetLabel = document.getElementById('done-target-label');
const doneCommentInput = document.getElementById('done-comment-input');

// Modal Ack
const modalAck = document.getElementById('modal-ack');
const ackModalTitle = document.getElementById('ack-modal-title');
const ackTargetLabel = document.getElementById('ack-target-label');
const ackCommentInput = document.getElementById('ack-comment-input');
const ackPersistentCheckbox = document.getElementById('ack-persistent-checkbox');

// Modal Motyw
const modalCustomTheme = document.getElementById('modal-custom-theme');
const pickerBgApp = document.getElementById('picker-bg-app');
const pickerBgCard = document.getElementById('picker-bg-card');
const pickerText = document.getElementById('picker-text');
const pickerCrit = document.getElementById('picker-crit');
const pickerWarn = document.getElementById('picker-warn');
const pickerKarma = document.getElementById('picker-karma');
const labelBgApp = document.getElementById('label-bg-app');
const labelBgCard = document.getElementById('label-bg-card');
const labelText = document.getElementById('label-text');
const labelCrit = document.getElementById('label-crit');
const labelWarn = document.getElementById('label-warn');
const labelKarma = document.getElementById('label-karma');
const slackThemeString = document.getElementById('slack-theme-string');

// Metryki
const statCritVal = document.getElementById('stat-crit-val');
const statCritWrap = document.getElementById('stat-crit-wrap');
const statWarnVal = document.getElementById('stat-warn-val');
const statWarnWrap = document.getElementById('stat-warn-wrap');
const statUnknownVal = document.getElementById('stat-unknown-val');
const statUnknownWrap = document.getElementById('stat-unknown-wrap');
const statAckedVal = document.getElementById('stat-acked-val');
const statAckedWrap = document.getElementById('stat-acked-wrap');
const statDtVal = document.getElementById('stat-dt-val');
const statDtWrap = document.getElementById('stat-dt-wrap');
const statKarmaVal = document.getElementById('stat-karma-val');
const statKarmaWrap = document.getElementById('stat-karma-wrap');
const statIcingaVal = document.getElementById('stat-icinga-val');
const statIcingaWrap = document.getElementById('stat-icinga-wrap');

// Modale Handover
const modalHandover = document.getElementById('modal-handover');
const modalExportHandover = document.getElementById('modal-export-handover');
const exportHandoverText = document.getElementById('export-handover-text');
const btnImportHandover = document.getElementById('btn-import-handover');
const btnExportHandover = document.getElementById('btn-export-handover');
const btnCopyAgainHandover = document.getElementById('btn-copy-again-handover');
const btnCloseExportHandover = document.getElementById('btn-close-export-handover');

// -------------------------------------------------------------
// OBSŁUGA ROZWIJANEGO MENU OPCJI WIDOKU
// -------------------------------------------------------------
if (btnToggleOptionsMenu && optionsDropdownMenu) {
  btnToggleOptionsMenu.addEventListener('click', (e) => {
    e.stopPropagation();
    const isHidden = optionsDropdownMenu.classList.contains('hidden');
    optionsDropdownMenu.classList.toggle('hidden', !isHidden);
    btnToggleOptionsMenu.classList.toggle('is-open', isHidden);
  });

  window.addEventListener('click', (e) => {
    if (!e.target.closest('.dropdown-options-wrap')) {
      optionsDropdownMenu.classList.add('hidden');
      btnToggleOptionsMenu.classList.remove('is-open');
    }
  });
}

// -------------------------------------------------------------
// Formatowanie czasu trwania i paska postępu DT
// -------------------------------------------------------------
function formatDuration(ms) {
  if (ms === undefined || ms === null || isNaN(ms)) return '< 1m';
  const absMs = Math.abs(ms);
  const sec = Math.max(1, Math.floor(absMs / 1000));
  const min = Math.floor(sec / 60);
  const hrs = Math.floor(min / 60);
  const days = Math.floor(hrs / 24);

  if (days > 0) return `${days}d ${hrs % 24}h`;
  if (hrs > 0) return `${hrs}h ${min % 60}m`;
  if (min > 0) return `${min}m`;
  return `${sec}s`;
}

function formatRemainingDtTime(endMs) {
  if (!endMs || isNaN(endMs)) return '0m left';
  const diff = endMs - Date.now();
  if (diff <= 0) return '0m left';
  const min = Math.floor(diff / 60000);
  const hrs = Math.floor(min / 60);
  const days = Math.floor(hrs / 24);

  if (days > 0) return `${days}d ${hrs % 24}h left`;
  if (hrs > 0) return `${hrs}h ${min % 60}m left`;
  return `${Math.max(1, min)}m left`;
}

function toDatetimeLocalString(d) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// -------------------------------------------------------------
// BIEŻĄCE PRZELICZANIE KOŃCA OKNA DOWNTIME
// -------------------------------------------------------------
function syncDowntimeEndTime(source) {
  const now = new Date();

  if (source === 'preset') {
    const val = dtPresetSelect ? dtPresetSelect.value : '60';
    if (val === 'until_7am') {
      const target = new Date(now);
      if (now.getHours() >= 7) {
        target.setDate(target.getDate() + 1);
      }
      target.setHours(7, 0, 0, 0);
      const diffMin = Math.max(1, Math.round((target.getTime() - now.getTime()) / 60000));
      if (dtCustomMinutes) dtCustomMinutes.value = diffMin;
      if (dtCalendarInput) dtCalendarInput.value = toDatetimeLocalString(target);
    } else if (val === 'calendar') {
      if (dtCalendarInput && !dtCalendarInput.value) {
        const tomorrow = new Date(now.getTime() + 86400000);
        dtCalendarInput.value = toDatetimeLocalString(tomorrow);
      }
      if (dtCalendarInput) {
        const target = new Date(dtCalendarInput.value);
        const diffMin = Math.max(1, Math.round((target.getTime() - now.getTime()) / 60000));
        if (dtCustomMinutes) dtCustomMinutes.value = diffMin;
      }
    } else if (val === 'custom') {
      const min = parseInt(dtCustomMinutes ? dtCustomMinutes.value : '60', 10) || 60;
      const target = new Date(now.getTime() + min * 60000);
      if (dtCalendarInput) dtCalendarInput.value = toDatetimeLocalString(target);
    } else {
      const min = parseInt(val, 10) || 60;
      if (dtCustomMinutes) dtCustomMinutes.value = min;
      const target = new Date(now.getTime() + min * 60000);
      if (dtCalendarInput) dtCalendarInput.value = toDatetimeLocalString(target);
    }
  } else if (source === 'minutes') {
    const min = parseInt(dtCustomMinutes ? dtCustomMinutes.value : '60', 10) || 60;
    const target = new Date(now.getTime() + min * 60000);
    if (dtCalendarInput) dtCalendarInput.value = toDatetimeLocalString(target);

    const matchOpt = Array.from(dtPresetSelect ? dtPresetSelect.options : []).find(o => o.value === String(min));
    if (matchOpt && dtPresetSelect) {
      dtPresetSelect.value = String(min);
    } else if (dtPresetSelect) {
      dtPresetSelect.value = 'custom';
    }
  } else if (source === 'calendar') {
    const calVal = dtCalendarInput ? dtCalendarInput.value : '';
    const target = new Date(calVal);
    if (!isNaN(target.getTime())) {
      const diffMin = Math.max(1, Math.round((target.getTime() - now.getTime()) / 60000));
      if (dtCustomMinutes) dtCustomMinutes.value = diffMin;

      const matchOpt = Array.from(dtPresetSelect ? dtPresetSelect.options : []).find(o => o.value === String(diffMin));
      if (matchOpt && dtPresetSelect) {
        dtPresetSelect.value = String(diffMin);
      } else if (dtPresetSelect) {
        dtPresetSelect.value = 'calendar';
      }
    }
  }
}

if (dtPresetSelect) {
  dtPresetSelect.addEventListener('change', () => syncDowntimeEndTime('preset'));
}

if (dtCustomMinutes) {
  dtCustomMinutes.addEventListener('input', () => syncDowntimeEndTime('minutes'));
}

if (dtCalendarInput) {
  dtCalendarInput.addEventListener('input', () => syncDowntimeEndTime('calendar'));
  dtCalendarInput.addEventListener('change', () => syncDowntimeEndTime('calendar'));
}

// -------------------------------------------------------------
// Toast & Schowek
// -------------------------------------------------------------
let toastTimer = null;
function showToast(message) {
  if (!copyToast) return;
  copyToast.innerText = message;
  copyToast.classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    copyToast.classList.add('hidden');
  }, 2200);
}

function copyToClipboard(text, label) {
  navigator.clipboard.writeText(text);
  showToast(`📋 Skopiowano ${label}: ${text}`);
}

// -------------------------------------------------------------
// RESIZING KOLUMN JAK W EXCELU
// -------------------------------------------------------------
function applyColumnWidths() {
  let styleTag = document.getElementById('dynamic-grid-styles');
  if (!styleTag) {
    styleTag = document.createElement('style');
    styleTag.id = 'dynamic-grid-styles';
    document.head.appendChild(styleTag);
  }

  styleTag.innerHTML = `
    :root, .table-header-row, body[data-view="compact"] .alert-item {
      --col-status: ${colWidths.status}px !important;
      --col-time: ${colWidths.time}px !important;
      --col-host: ${colWidths.host}px !important;
      --col-service: ${colWidths.service}px !important;
    }
  `;
}

function initColumnResizers() {
  const saved = JSON.parse(localStorage.getItem('opshub_col_widths') || '{}');
  colWidths = { ...colWidths, ...saved };
  applyColumnWidths();

  const resizers = document.querySelectorAll('.col-resizer');
  resizers.forEach(resizer => {
    resizer.addEventListener('mousedown', (e) => {
      e.stopPropagation();
      e.preventDefault();

      const colName = resizer.getAttribute('data-col');
      const startX = e.clientX;
      const startWidth = colWidths[colName] || 150;

      document.body.classList.add('is-col-resizing');
      resizer.classList.add('is-active');

      function onMouseMove(moveEvent) {
        const delta = moveEvent.clientX - startX;
        const newWidth = Math.max(45, Math.round(startWidth + delta));
        colWidths[colName] = newWidth;
        applyColumnWidths();
      }

      function onMouseUp() {
        window.removeEventListener('mousemove', onMouseMove);
        window.removeEventListener('mouseup', onMouseUp);
        document.body.classList.remove('is-col-resizing');
        resizer.classList.remove('is-active');
        localStorage.setItem('opshub_col_widths', JSON.stringify(colWidths));
      }

      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onMouseUp);
    });
  });
}

// -------------------------------------------------------------
// Sortowanie interaktywne
// -------------------------------------------------------------
document.querySelectorAll('.col-sortable').forEach(header => {
  header.addEventListener('click', (e) => {
    if (e.target.closest('.col-resizer')) return;
    const field = header.getAttribute('data-sort');
    if (sortField === field) {
      sortAsc = !sortAsc;
    } else {
      sortField = field;
      sortAsc = field !== 'state' && field !== 'duration';
    }
    updateSortIcons();
    renderAlerts();
  });
});

function updateSortIcons() {
  const iconState = document.getElementById('sort-state-icon');
  const iconDuration = document.getElementById('sort-duration-icon');
  const iconHost = document.getElementById('sort-host-icon');
  const iconService = document.getElementById('sort-service-icon');

  if (iconState) iconState.innerText = sortField === 'state' ? (sortAsc ? '▲' : '▼') : '';
  if (iconDuration) iconDuration.innerText = sortField === 'duration' ? (sortAsc ? '▲' : '▼') : '';
  if (iconHost) iconHost.innerText = sortField === 'host' ? (sortAsc ? '▲' : '▼') : '';
  if (iconService) iconService.innerText = sortField === 'service' ? (sortAsc ? '▲' : '▼') : '';
}

// -------------------------------------------------------------
// Widok: Kompaktowy vs Karty
// -------------------------------------------------------------
function setViewMode(mode) {
  document.body.setAttribute('data-view', mode);
  localStorage.setItem('opshub_view', mode);

  if (btnViewCompact && btnViewCards) {
    btnViewCompact.classList.toggle('active', mode === 'compact');
    btnViewCards.classList.toggle('active', mode === 'cards');
  }
  renderAlerts();
}

if (btnViewCompact) btnViewCompact.addEventListener('click', () => setViewMode('compact'));
if (btnViewCards) btnViewCards.addEventListener('click', () => setViewMode('cards'));

// -------------------------------------------------------------
// Silnik motywów
// -------------------------------------------------------------
const defaultCustomTheme = {
  bgApp: '#0b0c0e',
  bgCard: '#15181c',
  text: '#f1f3f5',
  crit: '#fa5252',
  warn: '#fd7e14',
  karma: '#9775fa'
};

function hexToRgba(hex, alpha) {
  const clean = hex.replace('#', '');
  const r = parseInt(clean.substring(0, 2), 16);
  const g = parseInt(clean.substring(2, 4), 16);
  const b = parseInt(clean.substring(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function applyCustomCssVariables(t) {
  const root = document.documentElement;
  root.style.setProperty('--bg-app', t.bgApp);
  root.style.setProperty('--bg-card', t.bgCard);
  root.style.setProperty('--bg-card-hover', hexToRgba(t.bgCard, 0.85));
  root.style.setProperty('--text-main', t.text);

  root.style.setProperty('--crit', t.crit);
  root.style.setProperty('--crit-bg', hexToRgba(t.crit, 0.12));
  root.style.setProperty('--crit-bg-hover', hexToRgba(t.crit, 0.20));
  root.style.setProperty('--crit-border', hexToRgba(t.crit, 0.35));

  root.style.setProperty('--warn', t.warn);
  root.style.setProperty('--warn-bg', hexToRgba(t.warn, 0.12));
  root.style.setProperty('--warn-bg-hover', hexToRgba(t.warn, 0.20));
  root.style.setProperty('--warn-border', hexToRgba(t.warn, 0.35));

  root.style.setProperty('--karma-color', t.karma);
  root.style.setProperty('--karma-bg', hexToRgba(t.karma, 0.10));
  root.style.setProperty('--karma-bg-hover', hexToRgba(t.karma, 0.18));
  root.style.setProperty('--karma-border', hexToRgba(t.karma, 0.38));
  root.style.setProperty('--karma-badge', t.karma);
}

function clearCustomCssVariables() {
  const root = document.documentElement;
  [
    '--bg-app', '--bg-card', '--bg-card-hover', '--text-main',
    '--crit', '--crit-bg', '--crit-bg-hover', '--crit-border',
    '--warn', '--warn-bg', '--warn-bg-hover', '--warn-border',
    '--karma-color', '--karma-bg', '--karma-bg-hover', '--karma-border', '--karma-badge'
  ].forEach(prop => root.style.removeProperty(prop));
}

function updateSlackStringFromPickers() {
  if (!pickerBgApp || !pickerBgCard || !pickerText || !pickerCrit || !pickerWarn || !pickerKarma) return;

  const vals = [
    pickerBgApp.value, pickerBgCard.value, pickerText.value,
    pickerCrit.value, pickerWarn.value, pickerKarma.value
  ].map(s => s.toUpperCase());

  if (slackThemeString) slackThemeString.value = vals.join(',');
  if (labelBgApp) labelBgApp.innerText = pickerBgApp.value;
  if (labelBgCard) labelBgCard.innerText = pickerBgCard.value;
  if (labelText) labelText.innerText = pickerText.value;
  if (labelCrit) labelCrit.innerText = pickerCrit.value;
  if (labelWarn) labelWarn.innerText = pickerWarn.value;
  if (labelKarma) labelKarma.innerText = pickerKarma.value;
}

function loadPickersFromTheme(t) {
  if (!pickerBgApp) return;
  pickerBgApp.value = t.bgApp;
  pickerBgCard.value = t.bgCard;
  pickerText.value = t.text;
  pickerCrit.value = t.crit;
  pickerWarn.value = t.warn;
  pickerKarma.value = t.karma;
  updateSlackStringFromPickers();
}

[pickerBgApp, pickerBgCard, pickerText, pickerCrit, pickerWarn, pickerKarma].forEach(p => {
  if (p) p.addEventListener('input', updateSlackStringFromPickers);
});

if (slackThemeString) {
  slackThemeString.addEventListener('input', () => {
    const parts = slackThemeString.value.split(',').map(s => s.trim());
    if (parts.length === 6 && parts.every(p => /^#[0-9A-Fa-f]{6}$/.test(p))) {
      pickerBgApp.value = parts[0];
      pickerBgCard.value = parts[1];
      pickerText.value = parts[2];
      pickerCrit.value = parts[3];
      pickerWarn.value = parts[4];
      pickerKarma.value = parts[5];
      updateSlackStringFromPickers();
    }
  });
}

if (btnOpenCustomTheme) {
  btnOpenCustomTheme.addEventListener('click', () => {
    const saved = JSON.parse(localStorage.getItem('opshub_custom_palette') || JSON.stringify(defaultCustomTheme));
    loadPickersFromTheme(saved);
    if (modalCustomTheme) modalCustomTheme.classList.remove('hidden');
  });
}

const btnCancelTheme = document.getElementById('btn-cancel-theme');
if (btnCancelTheme) {
  btnCancelTheme.addEventListener('click', () => {
    if (modalCustomTheme) modalCustomTheme.classList.add('hidden');
  });
}

const btnResetTheme = document.getElementById('btn-reset-theme');
if (btnResetTheme) {
  btnResetTheme.addEventListener('click', () => loadPickersFromTheme(defaultCustomTheme));
}

const btnApplyTheme = document.getElementById('btn-apply-theme');
if (btnApplyTheme) {
  btnApplyTheme.addEventListener('click', () => {
    const newTheme = {
      bgApp: pickerBgApp.value,
      bgCard: pickerBgCard.value,
      text: pickerText.value,
      crit: pickerCrit.value,
      warn: pickerWarn.value,
      karma: pickerKarma.value
    };
    localStorage.setItem('opshub_custom_palette', JSON.stringify(newTheme));
    localStorage.setItem('opshub_theme', 'custom');
    if (themeSelect) themeSelect.value = 'custom';
    document.body.setAttribute('data-theme', 'custom');
    applyCustomCssVariables(newTheme);
    if (modalCustomTheme) modalCustomTheme.classList.add('hidden');
  });
}

const btnCopyThemeString = document.getElementById('btn-copy-theme-string');
if (btnCopyThemeString) {
  btnCopyThemeString.addEventListener('click', () => {
    if (slackThemeString) {
      navigator.clipboard.writeText(slackThemeString.value);
      showToast('📋 Skopiowano ciąg motywu do schowka!');
    }
  });
}

function initSettings() {
  const savedTheme = localStorage.getItem('opshub_theme') || 'obsidian';
  document.body.setAttribute('data-theme', savedTheme);
  if (themeSelect) themeSelect.value = savedTheme;

  if (savedTheme === 'custom') {
    const customPalette = JSON.parse(localStorage.getItem('opshub_custom_palette') || JSON.stringify(defaultCustomTheme));
    applyCustomCssVariables(customPalette);
  } else {
    clearCustomCssVariables();
  }

  const savedView = localStorage.getItem('opshub_view') || 'compact';
  setViewMode(savedView);

  const hideSource = localStorage.getItem('opshub_hide_source') === 'true';
  if (hideSourceCheckbox) hideSourceCheckbox.checked = hideSource;
  document.body.setAttribute('data-hide-source', hideSource ? 'true' : 'false');

  const hideStatus = localStorage.getItem('opshub_hide_status') === 'true';
  if (hideStatusCheckbox) hideStatusCheckbox.checked = hideStatus;
  document.body.setAttribute('data-hide-status', hideStatus ? 'true' : 'false');

  const groupHosts = localStorage.getItem('opshub_group_hosts') === 'true';
  if (groupHostsCheckbox) groupHostsCheckbox.checked = groupHosts;

  initColumnResizers();
}

if (themeSelect) {
  themeSelect.addEventListener('change', (e) => {
    const selected = e.target.value;
    localStorage.setItem('opshub_theme', selected);
    document.body.setAttribute('data-theme', selected);

    if (selected === 'custom') {
      const customPalette = JSON.parse(localStorage.getItem('opshub_custom_palette') || JSON.stringify(defaultCustomTheme));
      applyCustomCssVariables(customPalette);
      loadPickersFromTheme(customPalette);
      if (modalCustomTheme) modalCustomTheme.classList.remove('hidden');
    } else {
      clearCustomCssVariables();
    }
  });
}

if (hideSourceCheckbox) {
  hideSourceCheckbox.addEventListener('change', (e) => {
    const isHidden = e.target.checked;
    document.body.setAttribute('data-hide-source', isHidden ? 'true' : 'false');
    localStorage.setItem('opshub_hide_source', isHidden ? 'true' : 'false');
  });
}

if (hideStatusCheckbox) {
  hideStatusCheckbox.addEventListener('change', (e) => {
    const isHidden = e.target.checked;
    document.body.setAttribute('data-hide-status', isHidden ? 'true' : 'false');
    localStorage.setItem('opshub_hide_status', isHidden ? 'true' : 'false');
  });
}

if (groupHostsCheckbox) {
  groupHostsCheckbox.addEventListener('change', (e) => {
    localStorage.setItem('opshub_group_hosts', e.target.checked ? 'true' : 'false');
    renderAlerts();
  });
}

function matchesSearchQuery(item, query) {
  if (!query) return true;
  const rawCleanHost = String(item.host || '').replace(/^\[KARMA\]\s*/, '');
  const noteText = item.localNote ? ` ${item.localNote}` : '';
  const targetText = `${rawCleanHost} ${item.service} ${item.output}${noteText}`.toLowerCase();
  const tokens = query.split(/\s+/).filter(Boolean);

  for (const token of tokens) {
    let isNegation = false;
    let pattern = token;

    if (pattern.startsWith('!')) {
      isNegation = true;
      pattern = pattern.substring(1).trim();
      if (!pattern) continue;
    }

    let isMatch = false;
    try {
      const rx = new RegExp(pattern, 'i');
      isMatch = rx.test(targetText);
    } catch {
      isMatch = targetText.includes(pattern.toLowerCase());
    }

    if (isNegation && isMatch) return false;
    if (!isNegation && !isMatch) return false;
  }
  return true;
}

// -------------------------------------------------------------
// Telemetria NOC i Aktywne Filtry Pigułek (Z LICZNIKAMI ACKED I DT)
// -------------------------------------------------------------
function updateTelemetry(alerts) {
  let crit = 0;
  let warn = 0;
  let unknown = 0;
  let acked = 0;
  let dt = 0;
  let karma = 0;
  let icinga = 0;

  (alerts || []).forEach(a => {
    if (a.inDowntime) {
      dt++;
    } else if (a.acknowledged) {
      acked++;
    } else if (!a.isLocallyDone) {
      if (a.state === 2) crit++;
      else if (a.state === 1) warn++;
      else if (a.state === 3) unknown++;
    }

    if (!a.acknowledged && !a.inDowntime) {
      if (a.isKarma) karma++;
      else icinga++;
    }
  });

  if (statCritVal) statCritVal.innerText = crit;
  if (statWarnVal) statWarnVal.innerText = warn;
  if (statUnknownVal) statUnknownVal.innerText = unknown;
  if (statAckedVal) statAckedVal.innerText = acked;
  if (statDtVal) statDtVal.innerText = dt;
  if (statKarmaVal) statKarmaVal.innerText = karma;
  if (statIcingaVal) statIcingaVal.innerText = icinga;

  if (statCritWrap) statCritWrap.classList.toggle('has-alerts', crit > 0);
  if (statWarnWrap) statWarnWrap.classList.toggle('has-alerts', warn > 0);
  if (statUnknownWrap) statUnknownWrap.classList.toggle('has-alerts', unknown > 0);
  if (statAckedWrap) statAckedWrap.classList.toggle('has-alerts', acked > 0);
  if (statDtWrap) statDtWrap.classList.toggle('has-alerts', dt > 0);
}

function setMetricFilter(filterName) {
  if (activeMetricFilter === filterName) {
    activeMetricFilter = null;
  } else {
    activeMetricFilter = filterName;
  }
  updateMetricPillVisuals();
  renderAlerts();
}

function updateMetricPillVisuals() {
  if (statCritWrap) statCritWrap.classList.toggle('is-active', activeMetricFilter === 'crit');
  if (statWarnWrap) statWarnWrap.classList.toggle('is-active', activeMetricFilter === 'warn');
  if (statUnknownWrap) statUnknownWrap.classList.toggle('is-active', activeMetricFilter === 'unknown');
  if (statAckedWrap) statAckedWrap.classList.toggle('is-active', activeMetricFilter === 'acked');
  if (statDtWrap) statDtWrap.classList.toggle('is-active', activeMetricFilter === 'dt');
  if (statKarmaWrap) statKarmaWrap.classList.toggle('is-active', activeMetricFilter === 'karma');
  if (statIcingaWrap) statIcingaWrap.classList.toggle('is-active', activeMetricFilter === 'icinga');
}

if (statCritWrap) statCritWrap.addEventListener('click', () => setMetricFilter('crit'));
if (statWarnWrap) statWarnWrap.addEventListener('click', () => setMetricFilter('warn'));
if (statUnknownWrap) statUnknownWrap.addEventListener('click', () => setMetricFilter('unknown'));
if (statAckedWrap) statAckedWrap.addEventListener('click', () => setMetricFilter('acked'));
if (statDtWrap) statDtWrap.addEventListener('click', () => setMetricFilter('dt'));
if (statKarmaWrap) statKarmaWrap.addEventListener('click', () => setMetricFilter('karma'));
if (statIcingaWrap) statIcingaWrap.addEventListener('click', () => setMetricFilter('icinga'));

function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>'"]/g, tag => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  }[tag] || tag));
}

function escapeJs(str) {
  return String(str ?? '').replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

function updateBulkBarUI(visibleItemsCount) {
  const count = selectedKeys.size;
  if (bulkSelectedCount) bulkSelectedCount.innerText = count;
  bulkCountNums.forEach(el => { el.innerText = count; });

  if (bulkActionBar) {
    if (count > 0) {
      bulkActionBar.classList.remove('hidden');
    } else {
      bulkActionBar.classList.add('hidden');
    }
  }

  // TWARDE STEROWANIE WIDOCZNOŚCIĄ PRZYCISKÓW DOKU
  const isAckedView = (activeMetricFilter === 'acked');
  const isDtView = (activeMetricFilter === 'dt');

  // UNACK: wyłącznie w widoku ACKED
  if (btnBulkUnack) {
    btnBulkUnack.classList.toggle('hidden', !isAckedView);
    btnBulkUnack.style.setProperty('display', isAckedView ? 'inline-flex' : 'none', 'important');
  }
  // ACK: w głównym widoku (ukryj w ACKED i DT)
  if (btnBulkAck) {
    btnBulkAck.classList.toggle('hidden', isAckedView || isDtView);
    btnBulkAck.style.setProperty('display', (isAckedView || isDtView) ? 'none' : 'inline-flex', 'important');
  }
  // REMOVE DT: wyłącznie w widoku DT
  if (btnBulkRemoveDt) {
    btnBulkRemoveDt.classList.toggle('hidden', !isDtView);
    btnBulkRemoveDt.style.setProperty('display', isDtView ? 'inline-flex' : 'none', 'important');
    if (isDtView) {
      btnBulkRemoveDt.innerHTML = `🛑 Remove DT (<span class="bulk-count-num">${count}</span>)`;
    }
  }
  // DT: w głównym widoku (ukryj w DT i ACKED)
  if (btnBulkDt) {
    btnBulkDt.classList.toggle('hidden', isDtView || isAckedView);
    btnBulkDt.style.setProperty('display', (isDtView || isAckedView) ? 'none' : 'inline-flex', 'important');
  }

  if (selectAllCheckbox) {
    if (count === 0) {
      selectAllCheckbox.checked = false;
      selectAllCheckbox.indeterminate = false;
    } else if (count >= visibleItemsCount && visibleItemsCount > 0) {
      selectAllCheckbox.checked = true;
      selectAllCheckbox.indeterminate = false;
    } else {
      selectAllCheckbox.indeterminate = true;
    }
  }
}

function syncDomSelectionVisuals() {
  if (!container) return;
  const items = container.querySelectorAll('.alert-item');
  items.forEach(el => {
    const key = el.getAttribute('data-key');
    const isSel = selectedKeys.has(key);
    el.classList.toggle('is-selected', isSel);
    const cb = el.querySelector('.row-checkbox');
    if (cb) cb.checked = isSel;
  });
  updateBulkBarUI(currentlyRenderedAlerts.length);
}

let currentlyRenderedAlerts = [];

function renderAlerts() {
  if (!container) return;

  try {
    const query = (searchInput?.value || '').trim();
    const hideDone = hideDoneCheckbox?.checked || false;
    const isGrouped = groupHostsCheckbox?.checked || false;
    const isCompact = document.body.getAttribute('data-view') === 'compact';

    let filtered = (currentAlerts || []).filter(item => {
      if (hideDone && item.isLocallyDone) return false;
      
      if (activeSourceFilter === 'karma' && !item.isKarma) return false;
      if (activeSourceFilter === 'icinga' && item.isKarma) return false;

      // FILTRY WIDOKÓW
      if (activeMetricFilter === 'dt') {
        if (!item.inDowntime) return false;
      } else if (activeMetricFilter === 'acked') {
        if (!item.acknowledged || item.inDowntime) return false;
      } else {
        if (item.acknowledged || item.inDowntime) return false;

        if (activeMetricFilter === 'crit' && item.state !== 2) return false;
        if (activeMetricFilter === 'warn' && item.state !== 1) return false;
        if (activeMetricFilter === 'unknown' && item.state !== 3) return false;
        if (activeMetricFilter === 'karma' && !item.isKarma) return false;
        if (activeMetricFilter === 'icinga' && item.isKarma) return false;
      }

      return matchesSearchQuery(item, query);
    });

    filtered.sort((a, b) => {
      if (a.isKarma && !b.isKarma) return -1;
      if (!a.isKarma && b.isKarma) return 1;

      let valA, valB;
      if (sortField === 'state') {
        valA = a.state; valB = b.state;
      } else if (sortField === 'duration') {
        valA = a.durationMs || 0; valB = b.durationMs || 0;
      } else if (sortField === 'host') {
        valA = String(a.host).toLowerCase(); valB = String(b.host).toLowerCase();
      } else if (sortField === 'service') {
        valA = String(a.service).toLowerCase(); valB = String(b.service).toLowerCase();
      }

      if (valA < valB) return sortAsc ? -1 : 1;
      if (valA > valB) return sortAsc ? 1 : -1;
      return 0;
    });

    updateTelemetry(currentAlerts);

    if (filtered.length === 0) {
      let emptyTitle = 'Środowisko stabilne';
      let emptyDesc = 'Brak aktywnych alertów spełniających wybrane kryteria.';
      if (activeMetricFilter === 'acked') {
        emptyTitle = 'Brak potwierdzonych alertów';
        emptyDesc = 'Wszystkie potwierdzone problemy zostały rozwiązane lub zdjęto z nich Ack.';
      } else if (activeMetricFilter === 'dt') {
        emptyTitle = 'Brak alertów w Downtime';
        emptyDesc = 'Żaden serwis nie znajduje się obecnie w zaplanowanym oknie prac.';
      }

      container.innerHTML = `
        <div class="empty-placeholder">
          <span style="font-size: 26px;">🛡️</span>
          <strong>${emptyTitle}</strong>
          <span>${emptyDesc}</span>
        </div>`;
      updateBulkBarUI(0);
      currentlyRenderedAlerts = [];
      return;
    }

    let itemsToRender = [];
    if (isGrouped) {
      const groups = new Map();
      filtered.forEach(item => {
        const h = String(item.host);
        if (!groups.has(h)) groups.set(h, []);
        groups.get(h).push(item);
      });

      groups.forEach((groupAlerts, hostName) => {
        const isExpanded = expandedHosts.has(hostName);
        const parentAlert = groupAlerts[0];
        const extraCount = groupAlerts.length - 1;

        itemsToRender.push({
          alert: parentAlert,
          hasChildren: extraCount > 0,
          childrenCount: extraCount,
          isExpanded: isExpanded,
          isChild: false,
          groupHostName: hostName
        });

        if (isExpanded && extraCount > 0) {
          for (let i = 1; i < groupAlerts.length; i++) {
            itemsToRender.push({
              alert: groupAlerts[i],
              hasChildren: false,
              childrenCount: 0,
              isExpanded: false,
              isChild: true,
              groupHostName: hostName
            });
          }
        }
      });
    } else {
      itemsToRender = filtered.map(a => ({
        alert: a,
        hasChildren: false,
        childrenCount: 0,
        isExpanded: false,
        isChild: false,
        groupHostName: null
      }));
    }

    currentlyRenderedAlerts = itemsToRender.map(x => x.alert);

    container.innerHTML = itemsToRender.map(({ alert: a, hasChildren, childrenCount, isExpanded, isChild, groupHostName }, index) => {
      const rawCleanHost = String(a.host || '').replace(/^\[KARMA\]\s*/, '');
      const statusClass = a.isKarma ? 'karma-card' : 'state-' + a.state;
      const doneClass = a.isLocallyDone ? 'locally-done' : '';
      const childClass = isChild ? 'child-row' : '';
      const isSelected = selectedKeys.has(a.key);
      const selectedClass = isSelected ? 'is-selected' : '';

      let stateBadgeClass = 'warn';
      let stateBadgeText = 'WARN';
      if (a.state === 2) {
        stateBadgeClass = 'crit'; stateBadgeText = 'CRIT';
      } else if (a.state === 3) {
        stateBadgeClass = 'unknown'; stateBadgeText = 'UNKNOWN';
      }

      // WIDŻET PASEK POSTĘPU DOWNTIME (INSPIROWANY ICINGA DB)
      let dtBadgeHtml = '';
      if (a.inDowntime) {
        const now = Date.now();
        const endMs = a.downtimeEndMs || (now + 60000);
        const startMs = a.downtimeStartMs || (endMs - 3600000);
        const totalSpan = Math.max(60000, endMs - startMs);
        const remainingMs = Math.max(0, endMs - now);
        const pctRemaining = Math.min(100, Math.max(0, Math.round((remainingMs / totalSpan) * 100)));

        dtBadgeHtml = `
          <div class="dt-progress-badge" title="Koniec DT: ${a.downtimeEndMs ? new Date(a.downtimeEndMs).toLocaleString() : 'aktywne'} (Pozostało: ${pctRemaining}%)">
            <div class="dt-progress-bar" style="width: ${pctRemaining}%;"></div>
            <div class="dt-progress-content">
              <span class="dt-progress-icon">⏳</span>
              <span class="dt-progress-text">${formatRemainingDtTime(a.downtimeEndMs)}</span>
            </div>
          </div>
        `;
      }

      const badgesHtml = `
        ${a.isKarma 
          ? `<span class="badge badge-source-karma">KARMA</span>` 
          : `<span class="badge badge-source-icinga">ICINGA</span>`}
        <span class="badge ${stateBadgeClass}">${stateBadgeText}</span>
        ${dtBadgeHtml}
        ${a.acknowledged ? `<span class="badge badge-ack">ACK</span>` : ''}
        ${a.isLocallyDone ? `<span class="badge badge-done">DONE</span>` : ''}
      `;

      const groupToggleBtn = hasChildren ? `
        <button class="btn-group-toggle" onclick="event.stopPropagation(); toggleHostGroup('${escapeJs(groupHostName)}')">
          ${isExpanded ? '▲ Zwiń' : `▼ +${childrenCount} więcej`}
        </button>
      ` : '';

      const ackButtonHtml = a.acknowledged ? `
        <button class="btn-act btn-act-unack" onclick="event.stopPropagation(); handleRemoveAck('${escapeJs(a.id || '')}', '${escapeJs(a.host)}', '${escapeJs(a.service)}', this)" title="Zdejmij potwierdzenie (Remove Ack)">🔓 Unack</button>
      ` : `
        <button class="btn-act" onclick="event.stopPropagation(); openAckModal('${escapeJs(a.id || '')}', '${escapeJs(a.host)}', '${escapeJs(a.service)}', this)" title="Potwierdź (Ack)">💬 Ack</button>
      `;

      const dtButtonHtml = a.inDowntime ? `
        <button class="btn-act btn-act-unack" onclick="event.stopPropagation(); handleRemoveDowntime('${escapeJs(a.id || '')}', '${escapeJs(a.host)}', '${escapeJs(a.service)}', '${escapeJs(a.downtimeName || '')}', '${escapeJs(a.downtimeId || '')}', this)" title="Zdejmij okno prac (Remove Downtime)">🛑 End DT</button>
      ` : `
        <button class="btn-act" onclick="event.stopPropagation(); openSingleDowntimeModal('${escapeJs(a.id || '')}', '${escapeJs(a.host)}', '${escapeJs(a.service)}')" title="Zaplanuj Downtime">⏳ DT</button>
      `;

      const actionsHtml = a.isKarma ? `
        <button class="btn-act btn-copy-hs" onclick="event.stopPropagation(); copyToClipboard('${escapeJs(rawCleanHost)} - ${escapeJs(a.service)}', 'host - serwis')" title="Kopiuj: host - serwis">📋 Copy</button>
        ${a.karmaWebUrl ? `<button class="btn-act" onclick="event.stopPropagation(); window.api?.openExternal('${escapeJs(a.karmaWebUrl)}')">🔗 Karma</button>` : ''}
        <button class="btn-act ${a.isLocallyDone ? 'btn-undone-action' : ''}" onclick="event.stopPropagation(); handleDoneClick('${escapeJs(a.key)}', '${escapeJs(rawCleanHost)}', '${escapeJs(a.service)}', ${Boolean(a.isLocallyDone)})">
          ${a.isLocallyDone ? '↩️ Undone' : '✔️ Done'}
        </button>
      ` : `
        <button class="btn-act btn-copy-hs" onclick="event.stopPropagation(); copyToClipboard('${escapeJs(rawCleanHost)} - ${escapeJs(a.service)}', 'host - serwis')" title="Kopiuj: host - serwis">📋 Copy</button>
        ${a.icingaWebUrl ? `<button class="btn-act" onclick="event.stopPropagation(); window.api?.openExternal('${escapeJs(a.icingaWebUrl)}')">🔗 Icinga</button>` : ''}
        <button class="btn-act" onclick="event.stopPropagation(); handleRecheck('${escapeJs(a.id || '')}', '${escapeJs(a.host)}', '${escapeJs(a.service)}', this)" title="Wymuś sprawdzenie (Check now)">🔄 Recheck</button>
        ${ackButtonHtml}
        ${dtButtonHtml}
        <button class="btn-act ${a.isLocallyDone ? 'btn-undone-action' : ''}" onclick="event.stopPropagation(); handleDoneClick('${escapeJs(a.key)}', '${escapeJs(rawCleanHost)}', '${escapeJs(a.service)}', ${Boolean(a.isLocallyDone)})">
          ${a.isLocallyDone ? '↩️ Undone' : '✔️ Done'}
        </button>
      `;

      const noteTagHtml = a.localNote ? `
        <span class="handover-tag" onclick="event.stopPropagation(); copyToClipboard('${escapeJs(a.localNote)}', 'notatkę')" title="Kliknij, aby skopiować notatkę">
          📌 ${escapeHtml(a.localNote)}
        </span>
      ` : '';

      if (isCompact) {
        return `
          <div class="alert-item ${statusClass} ${doneClass} ${childClass} ${selectedClass}" data-key="${escapeHtml(a.key)}" data-index="${index}">
            <div class="row-check">
              <input type="checkbox" class="row-checkbox" data-key="${escapeHtml(a.key)}" data-index="${index}" ${isSelected ? 'checked' : ''} />
            </div>

            <div class="row-status">${badgesHtml}</div>

            <div class="row-time" title="Czas trwania">${formatDuration(a.durationMs)}</div>
            
            <div class="row-host-wrap">
              <div class="row-host copyable-cell" data-copy-type="host" data-copy-val="${escapeHtml(rawCleanHost)}" title="Kliknij, aby zaznaczyć i skopiować host">
                <span class="${a.isKarma ? 'karma-host-text' : ''}">${escapeHtml(a.host)}</span>
              </div>
              ${groupToggleBtn}
            </div>

            <div class="row-service copyable-cell" data-copy-type="usługę" data-copy-val="${escapeHtml(a.service)}" title="Kliknij, aby zaznaczyć i skopiować usługę">
              <span class="service-text">${escapeHtml(a.service)}</span>
              ${noteTagHtml}
            </div>

            <div class="row-output copyable-cell" data-copy-type="komunikat błędu" data-copy-val="${escapeHtml(a.output)}" title="Kliknij, aby zaznaczyć i skopiować błąd">
              ${escapeHtml(a.output)}
            </div>

            <div class="row-actions">${actionsHtml}</div>
          </div>
        `;
      } else {
        return `
          <div class="alert-item ${statusClass} ${doneClass} ${childClass} ${selectedClass}" data-key="${escapeHtml(a.key)}" data-index="${index}">
            <div class="alert-item-header">
              <div class="header-left">
                <input type="checkbox" class="row-checkbox" data-key="${escapeHtml(a.key)}" data-index="${index}" ${isSelected ? 'checked' : ''} />
                <div class="row-host copyable-cell" data-copy-type="host" data-copy-val="${escapeHtml(rawCleanHost)}" title="Kopiuj host">
                  <span class="${a.isKarma ? 'karma-host-text' : ''}">${escapeHtml(a.host)}</span>
                  ${groupToggleBtn}
                </div>
                <div class="row-service copyable-cell" data-copy-type="usługę" data-copy-val="${escapeHtml(a.service)}" title="Kopiuj usługę">
                  <span class="service-text">&rsaquo; ${escapeHtml(a.service)}</span>
                  ${noteTagHtml}
                </div>
                <span class="row-time" style="margin-left: 8px;">⏳ ${formatDuration(a.durationMs)}</span>
              </div>
              <div class="row-status">${badgesHtml}</div>
            </div>

            <div class="row-output copyable-cell" data-copy-type="komunikat błędu" data-copy-val="${escapeHtml(a.output)}" title="Kopiuj treść błędu">
              ${escapeHtml(a.output)}
            </div>

            <div class="row-actions">${actionsHtml}</div>
          </div>
        `;
      }
    }).join('');

    updateBulkBarUI(currentlyRenderedAlerts.length);

  } catch (err) {
    console.error('[Render Error]:', err);
    container.innerHTML = `<div class="empty-placeholder" style="color:#ff6b6b;">Błąd renderowania: ${err.message}</div>`;
  }
}

// -------------------------------------------------------------
// OBSŁUGA PRAWEGO PRZYCISKU MYSZY (OPEN IN SSH CONTEXT MENU)
// -------------------------------------------------------------
if (container) {
  container.addEventListener('contextmenu', (e) => {
    const item = e.target.closest('.alert-item');
    if (!item) return;
    e.preventDefault();

    const key = item.getAttribute('data-key');
    const alert = currentAlerts.find(a => a.key === key);
    if (!alert) return;

    const rawCleanHost = String(alert.host || '').replace(/^\[KARMA\]\s*/, '').split(':')[0].trim();
    window.api?.showContextMenu({
      host: rawCleanHost,
      service: alert.service,
      output: alert.output,
      localNote: alert.localNote,
      isKarma: alert.isKarma
    });
  });

  container.addEventListener('mousedown', (e) => {
    if (e.button !== 0) return;
    if (e.target.closest('button, textarea, select, .col-resizer, .handover-tag')) return;

    const item = e.target.closest('.alert-item');
    if (!item) {
      if (selectedKeys.size > 0) {
        selectedKeys.clear();
        syncDomSelectionVisuals();
      }
      return;
    }

    isMouseDown = true;
    isDragSelecting = false;
    dragStartIndex = parseInt(item.getAttribute('data-index'), 10);

    const key = item.getAttribute('data-key');
    dragMode = selectedKeys.has(key) ? 'deselect' : 'select';
  });

  window.addEventListener('mousemove', (e) => {
    if (!isMouseDown || dragStartIndex === -1) return;

    const itemUnderCursor = document.elementFromPoint(e.clientX, e.clientY)?.closest('.alert-item');
    if (!itemUnderCursor) return;

    const hoverIndex = parseInt(itemUnderCursor.getAttribute('data-index'), 10);
    if (isNaN(hoverIndex)) return;

    if (hoverIndex !== dragStartIndex) {
      if (!isDragSelecting) {
        isDragSelecting = true;
        document.body.classList.add('is-drag-selecting');
      }

      const start = Math.min(dragStartIndex, hoverIndex);
      const end = Math.max(dragStartIndex, hoverIndex);

      for (let i = start; i <= end; i++) {
        const ai = currentlyRenderedAlerts[i];
        if (ai) {
          if (dragMode === 'select') selectedKeys.add(ai.key);
          else selectedKeys.delete(ai.key);
        }
      }
      syncDomSelectionVisuals();
    }
  });

  window.addEventListener('mouseup', () => {
    if (isMouseDown) {
      isMouseDown = false;
      dragStartIndex = -1;
      document.body.classList.remove('is-drag-selecting');
    }
  });

  container.addEventListener('click', (e) => {
    if (e.target.closest('button, textarea, select, .col-resizer, .handover-tag')) return;
    if (isDragSelecting) return;

    const item = e.target.closest('.alert-item');
    if (!item) return;

    const key = item.getAttribute('data-key');
    const index = parseInt(item.getAttribute('data-index'), 10);
    const cb = e.target.closest('.row-checkbox');
    const copyCell = e.target.closest('.copyable-cell');

    if (copyCell) {
      const copyType = copyCell.getAttribute('data-copy-type');
      const copyVal = copyCell.getAttribute('data-copy-val');
      if (copyType && copyVal) copyToClipboard(copyVal, copyType);
    }

    if (cb && e.shiftKey && lastClickedIndex !== -1 && lastClickedIndex !== index) {
      const start = Math.min(lastClickedIndex, index);
      const end = Math.max(lastClickedIndex, index);
      const shouldSelect = cb.checked;
      for (let i = start; i <= end; i++) {
        const ai = currentlyRenderedAlerts[i];
        if (ai) {
          if (shouldSelect) selectedKeys.add(ai.key);
          else selectedKeys.delete(ai.key);
        }
      }
    } else {
      if (selectedKeys.has(key)) {
        selectedKeys.delete(key);
      } else {
        selectedKeys.add(key);
      }
      lastClickedIndex = index;
    }
    syncDomSelectionVisuals();
  });
}

if (selectAllCheckbox) {
  selectAllCheckbox.addEventListener('click', (e) => {
    const checkAll = e.target.checked;
    if (checkAll) {
      currentlyRenderedAlerts.forEach(a => selectedKeys.add(a.key));
    } else {
      currentlyRenderedAlerts.forEach(a => selectedKeys.delete(a.key));
    }
    syncDomSelectionVisuals();
  });
}

if (btnBulkClear) {
  btnBulkClear.addEventListener('click', () => {
    selectedKeys.clear();
    syncDomSelectionVisuals();
  });
}

// -------------------------------------------------------------
// KOPIOWANIE H - S (DOCK MASOWY)
// -------------------------------------------------------------
if (btnBulkCopyHs) {
  btnBulkCopyHs.addEventListener('click', () => {
    const selectedAlerts = (currentAlerts || []).filter(a => selectedKeys.has(a.key));
    if (selectedAlerts.length === 0) {
      showToast('⚠️ Brak zaznaczonych alertów do skopiowania');
      return;
    }
    const text = selectedAlerts.map(a => {
      const cleanHost = String(a.host || '').replace(/^\[KARMA\]\s*/, '');
      return `${cleanHost} - ${a.service}`;
    }).join('\n');
    navigator.clipboard.writeText(text);
    showToast(`📋 Skopiowano ${selectedAlerts.length} alertów (host - service)!`);
  });
}

// -------------------------------------------------------------
// REFRESH W DOLNYM DOKU
// -------------------------------------------------------------
if (btnBulkRefresh) {
  btnBulkRefresh.addEventListener('click', async () => {
    const orig = btnBulkRefresh.innerText;
    btnBulkRefresh.innerText = '⏳...';
    btnBulkRefresh.disabled = true;
    try {
      await window.api?.refreshNow();
      showToast('⚡ Odświeżono stan monitoringu!');
    } catch (err) {
      showToast('❌ Błąd odświeżania');
    }
    btnBulkRefresh.innerText = orig;
    btnBulkRefresh.disabled = false;
  });
}

// -------------------------------------------------------------
// HURTOWY UNACK W DOLNYM DOKU (WIDOK ACKED)
// -------------------------------------------------------------
if (btnBulkUnack) {
  btnBulkUnack.addEventListener('click', async () => {
    const selectedAlerts = (currentAlerts || []).filter(a => selectedKeys.has(a.key));
    const ackedAlerts = selectedAlerts.filter(a => !a.isKarma && a.acknowledged);

    if (ackedAlerts.length === 0) {
      showToast('⚠️ Żaden z zaznaczonych alertów nie ma aktywnego Ack');
      return;
    }

    btnBulkUnack.innerText = `⏳ Unack (${ackedAlerts.length})...`;
    btnBulkUnack.disabled = true;

    let success = 0;
    for (const a of ackedAlerts) {
      try {
        const ok = await window.api?.removeAckService(a.id, a.host, a.service);
        if (ok) {
          a.acknowledged = false;
          success++;
        }
      } catch (e) {}
    }

    showToast(`🔓 Usunięto Ack z ${success}/${ackedAlerts.length} alertów!`);
    selectedKeys.clear();
    renderAlerts();
    setTimeout(() => window.api?.refreshNow(), 1500);
    btnBulkUnack.disabled = false;
  });
}

// -------------------------------------------------------------
// HURTOWY REMOVE DOWNTIME W DOLNYM DOKU (WIDOK DT)
// -------------------------------------------------------------
if (btnBulkRemoveDt) {
  btnBulkRemoveDt.addEventListener('click', async () => {
    const selectedAlerts = (currentAlerts || []).filter(a => selectedKeys.has(a.key));
    const dtAlerts = selectedAlerts.filter(a => !a.isKarma && a.inDowntime);

    if (dtAlerts.length === 0) {
      showToast('⚠️ Żaden z zaznaczonych alertów nie jest w oknie prac (DT)');
      return;
    }

    btnBulkRemoveDt.innerText = `⏳ Usuwam (${dtAlerts.length})...`;
    btnBulkRemoveDt.disabled = true;

    let success = 0;
    for (const a of dtAlerts) {
      try {
        const ok = await window.api?.removeDowntimeService(a.id, a.host, a.service, a.downtimeName, a.downtimeId);
        if (ok) {
          a.inDowntime = false;
          a.downtimeId = null;
          a.downtimeName = null;
          a.downtimeEndMs = null;
          success++;
        }
      } catch (e) {}
    }

    showToast(`🛑 Usunięto Downtime z ${success}/${dtAlerts.length} alertów!`);
    selectedKeys.clear();
    renderAlerts();
    setTimeout(() => window.api?.refreshNow(), 1500);
    btnBulkRemoveDt.disabled = false;
  });
}

// -------------------------------------------------------------
// KOPIOWANIE NOTATEK (DOCK MASOWY)
// -------------------------------------------------------------
if (btnBulkCopyNotes) {
  btnBulkCopyNotes.addEventListener('click', () => {
    const selectedAlerts = (currentAlerts || []).filter(a => selectedKeys.has(a.key) && a.localNote);
    if (selectedAlerts.length === 0) {
      showToast('⚠️ Żaden z zaznaczonych alertów nie ma notatki');
      return;
    }
    const notesText = selectedAlerts.map(a => `${a.host} - ${a.service}: ${a.localNote}`).join('\n');
    navigator.clipboard.writeText(notesText);
    showToast(`📋 Skopiowano ${selectedAlerts.length} notatek do schowka!`);
  });
}

// -------------------------------------------------------------
// DOWNTIME
// -------------------------------------------------------------
function openSingleDowntimeModal(id, host, service) {
  pendingDtTarget = { id, host, service, isBulk: false };
  if (dtModalTitle) dtModalTitle.innerText = '⏳ Zaplanuj Downtime';
  if (dtTargetLabel) dtTargetLabel.innerText = `${host} ➔ ${service}`;
  if (dtPresetSelect) dtPresetSelect.value = '60';
  if (dtCustomMinutes) dtCustomMinutes.value = '60';
  if (dtCommentInput) dtCommentInput.value = 'Prace planowane (DT)';

  syncDowntimeEndTime('preset');

  if (modalDowntime) modalDowntime.classList.remove('hidden');
  setTimeout(() => { dtCommentInput?.focus(); dtCommentInput?.select(); }, 50);
}

if (btnBulkDt) {
  btnBulkDt.addEventListener('click', () => {
    const selectedAlerts = (currentAlerts || []).filter(a => selectedKeys.has(a.key));
    const icingaAlerts = selectedAlerts.filter(a => !a.isKarma);

    if (icingaAlerts.length === 0) {
      showToast('⚠️ Downtime jest obsługiwany dla hostów i usług Icinga DB');
      return;
    }

    pendingDtTarget = { isBulk: true };
    if (dtModalTitle) dtModalTitle.innerText = `⏳ Hurtowy Downtime (${icingaAlerts.length} alertów)`;
    if (dtTargetLabel) dtTargetLabel.innerText = `Wybrano ${icingaAlerts.length} pozycji do wyciszenia w Icinga`;
    if (dtPresetSelect) dtPresetSelect.value = '60';
    if (dtCustomMinutes) dtCustomMinutes.value = '60';
    if (dtCommentInput) dtCommentInput.value = 'Prace serwisowe hurtowe';

    syncDowntimeEndTime('preset');

    if (modalDowntime) modalDowntime.classList.remove('hidden');
    setTimeout(() => { dtCommentInput?.focus(); dtCommentInput?.select(); }, 50);
  });
}

async function submitDowntimeModal() {
  if (!pendingDtTarget) return;

  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const formatIcingaDt = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:00`;

  let minutes = 60;
  let finalStart = formatIcingaDt(now);
  let finalEnd = null;

  const preset = dtPresetSelect ? dtPresetSelect.value : '60';

  if (preset === 'until_7am') {
    const target = new Date(now);
    if (now.getHours() >= 7) {
      target.setDate(target.getDate() + 1);
    }
    target.setHours(7, 0, 0, 0);
    minutes = Math.max(1, Math.round((target.getTime() - now.getTime()) / 60000));
    finalEnd = formatIcingaDt(target);
  } else if (preset === 'calendar') {
    if (dtCalendarInput && dtCalendarInput.value) {
      const target = new Date(dtCalendarInput.value);
      if (!isNaN(target.getTime())) {
        finalEnd = formatIcingaDt(target);
        minutes = Math.max(1, Math.round((target.getTime() - now.getTime()) / 60000));
      }
    }
  } else {
    // Odczyt z pola minut – dokładnie tyle, ile wpisano (np. 5)
    minutes = parseInt(dtCustomMinutes ? dtCustomMinutes.value : preset, 10) || parseInt(preset, 10) || 60;
    const target = new Date(now.getTime() + minutes * 60000);
    finalEnd = formatIcingaDt(target);
  }

  const comment = (dtCommentInput ? dtCommentInput.value.trim() : '') || 'Downtime z OpsHub';
  if (modalDowntime) modalDowntime.classList.add('hidden');

  if (pendingDtTarget.isBulk) {
    const selectedAlerts = (currentAlerts || []).filter(a => selectedKeys.has(a.key));
    const icingaAlerts = selectedAlerts.filter(a => !a.isKarma);

    const targetKeys = new Set(icingaAlerts.map(a => a.key));
    currentAlerts.forEach(a => {
      if (targetKeys.has(a.key)) a.inDowntime = true;
    });
    selectedKeys.clear();
    renderAlerts();

    showToast(`⏳ Planuję DT (${minutes}m) dla ${icingaAlerts.length} pozycji...`);
    let dtSuccess = 0;
    for (const a of icingaAlerts) {
      try {
        const ok = await window.api?.downtimeService(a.id, a.host, a.service, minutes, comment, finalStart, finalEnd);
        if (ok) dtSuccess++;
      } catch (e) {}
    }

    showToast(`⏳ Zlecono Downtime dla ${dtSuccess}/${icingaAlerts.length} pozycji!`);
    setTimeout(() => window.api?.refreshNow(), 1500);
  } else {
    const { id, host, service, key } = pendingDtTarget;

    const found = currentAlerts.find(a => a.id === id || a.key === key);
    if (found) found.inDowntime = true;
    renderAlerts();

    try {
      const ok = await window.api?.downtimeService(id, host, service, minutes, comment, finalStart, finalEnd);
      showToast(ok ? `⏳ Nadano Downtime (${minutes}m) dla ${host}` : `❌ Błąd nadawania DT`);
    } catch (e) {
      showToast('❌ Błąd nadawania DT');
    }
    setTimeout(() => window.api?.refreshNow(), 1500);
  }

  pendingDtTarget = null;
}

const btnSaveDtModal = document.getElementById('btn-save-dt-modal');
if (btnSaveDtModal) btnSaveDtModal.addEventListener('click', submitDowntimeModal);

const btnCancelDtModal = document.getElementById('btn-cancel-dt-modal');
if (btnCancelDtModal) {
  btnCancelDtModal.addEventListener('click', () => {
    if (modalDowntime) modalDowntime.classList.add('hidden');
    pendingDtTarget = null;
  });
}

// -------------------------------------------------------------
// AKCJE DONE & UNDONE
// -------------------------------------------------------------
function handleDoneClick(key, host, service, isLocallyDone) {
  if (isLocallyDone) {
    const alert = currentAlerts.find(a => a.key === key);
    if (alert) {
      alert.isLocallyDone = false;
      alert.localNote = null;
    }
    renderAlerts();

    window.api?.toggleLocalDone(key);
    showToast(`↩️ Przywrócono alert: ${host}`);
    return;
  }

  pendingDoneTarget = { key, isBulk: false };
  if (doneModalTitle) doneModalTitle.innerText = '✔️ Wyciszenie lokalne (Done)';
  if (doneTargetLabel) doneTargetLabel.innerText = `${host} ➔ ${service}`;
  if (doneCommentInput) doneCommentInput.value = 'Wyciszone z dyżuru';

  if (modalDone) modalDone.classList.remove('hidden');
  setTimeout(() => {
    doneCommentInput?.focus();
    doneCommentInput?.select();
  }, 50);
}

if (btnBulkDone) {
  btnBulkDone.addEventListener('click', () => {
    const count = selectedKeys.size;
    if (count === 0) return;

    pendingDoneTarget = { isBulk: true };
    if (doneModalTitle) doneModalTitle.innerText = `✔️ Hurtowe wyciszenie (${count} pozycji)`;
    if (doneTargetLabel) doneTargetLabel.innerText = `Wybrano ${count} alertów do wyciszenia`;
    if (doneCommentInput) doneCommentInput.value = 'Wyciszone hurtowo z dyżuru';

    if (modalDone) modalDone.classList.remove('hidden');
    setTimeout(() => {
      doneCommentInput?.focus();
      doneCommentInput?.select();
    }, 50);
  });
}

if (btnBulkUndone) {
  btnBulkUndone.addEventListener('click', async () => {
    const count = selectedKeys.size;
    if (count === 0) return;

    const keysArray = Array.from(selectedKeys);
    btnBulkUndone.innerText = `⏳ Undone (${count})...`;
    btnBulkUndone.disabled = true;

    currentAlerts.forEach(a => {
      if (selectedKeys.has(a.key)) {
        a.isLocallyDone = false;
        a.localNote = null;
      }
    });
    selectedKeys.clear();
    renderAlerts();

    try {
      await window.api?.bulkLocalUndone(keysArray);
      showToast(`↩️ Przywrócono (Undone) ${count} pozycji!`);
    } catch (err) {
      showToast('❌ Błąd cofania wyciszenia');
    }

    btnBulkUndone.disabled = false;
  });
}

async function submitDoneModal() {
  if (!pendingDoneTarget) return;
  const note = (doneCommentInput ? doneCommentInput.value.trim() : '') || 'Wyciszone z dyżuru';
  if (modalDone) modalDone.classList.add('hidden');

  if (pendingDoneTarget.isBulk) {
    const keysArray = Array.from(selectedKeys);

    currentAlerts.forEach(a => {
      if (selectedKeys.has(a.key)) {
        a.isLocallyDone = true;
        a.localNote = note;
      }
    });
    selectedKeys.clear();
    renderAlerts();

    try {
      await window.api?.bulkLocalDone(keysArray, note);
      showToast(`✔️ Wyciszono ${keysArray.length} pozycji z notatką!`);
    } catch (e) {
      showToast('❌ Błąd zapisu');
    }
  } else {
    const alert = currentAlerts.find(a => a.key === pendingDoneTarget.key);
    if (alert) {
      alert.isLocallyDone = true;
      alert.localNote = note;
    }
    renderAlerts();

    try {
      await window.api?.toggleLocalDone(pendingDoneTarget.key, note);
      showToast(`✔️ Wyciszono z notatką: ${note}`);
    } catch (e) {
      showToast('❌ Błąd zapisu');
    }
  }
  pendingDoneTarget = null;
}

const btnSaveDoneModal = document.getElementById('btn-save-done-modal');
if (btnSaveDoneModal) btnSaveDoneModal.addEventListener('click', submitDoneModal);

const btnCancelDoneModal = document.getElementById('btn-cancel-done-modal');
if (btnCancelDoneModal) {
  btnCancelDoneModal.addEventListener('click', () => {
    if (modalDone) modalDone.classList.add('hidden');
    pendingDoneTarget = null;
  });
}

// -------------------------------------------------------------
// AKCJE MASOWE (RECHECK & ACK)
// -------------------------------------------------------------
if (btnBulkRecheck) {
  btnBulkRecheck.addEventListener('click', async () => {
    const count = selectedKeys.size;
    if (count === 0) return;

    const selectedAlerts = (currentAlerts || []).filter(a => selectedKeys.has(a.key));
    const icingaAlerts = selectedAlerts.filter(a => !a.isKarma);

    if (icingaAlerts.length === 0) {
      showToast('⚠️ Żaden z zaznaczonych alertów nie pochodzi z Icingi');
      return;
    }

    btnBulkRecheck.innerText = `⏳ Zlecam (${icingaAlerts.length})...`;
    btnBulkRecheck.disabled = true;

    let successCount = 0;
    for (const a of icingaAlerts) {
      try {
        const ok = await window.api?.recheckService(a.id, a.host, a.service);
        if (ok) successCount++;
      } catch (e) {}
    }

    showToast(`🔄 Zlecono recheck dla ${successCount}/${icingaAlerts.length} alertów!`);
    selectedKeys.clear();
    btnBulkRecheck.disabled = false;
    setTimeout(() => window.api?.refreshNow(), 1500);
  });
}

let isBulkAckPending = false;

if (btnBulkAck) {
  btnBulkAck.addEventListener('click', () => {
    const selectedAlerts = (currentAlerts || []).filter(a => selectedKeys.has(a.key));
    const icingaAlerts = selectedAlerts.filter(a => !a.isKarma);

    if (icingaAlerts.length === 0) {
      showToast('⚠️ Acknowledge obsługuje alerty z Icinga DB');
      return;
    }

    isBulkAckPending = true;
    pendingAck = null;
    if (ackModalTitle) ackModalTitle.innerText = `💬 Hurtowe potwierdzenie (${icingaAlerts.length} alertów)`;
    if (ackTargetLabel) ackTargetLabel.innerText = `Wybrano ${icingaAlerts.length} usług Icinga`;
    if (ackCommentInput) ackCommentInput.value = 'Hurtowe potwierdzenie dyżurnego';
    if (ackPersistentCheckbox) ackPersistentCheckbox.checked = true;

    if (modalAck) modalAck.classList.remove('hidden');
    setTimeout(() => {
      ackCommentInput?.focus();
      ackCommentInput?.select();
    }, 50);
  });
}

function toggleHostGroup(hostName) {
  if (expandedHosts.has(hostName)) {
    expandedHosts.delete(hostName);
  } else {
    expandedHosts.add(hostName);
  }
  renderAlerts();
}

window.addEventListener('keydown', (e) => {
  if (e.key === '/' && document.activeElement !== searchInput) {
    e.preventDefault();
    if (searchInput) {
      searchInput.focus();
      searchInput.select();
    }
  }
});

tabButtons.forEach(btn => {
  btn.addEventListener('click', () => {
    tabButtons.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    activeSourceFilter = btn.getAttribute('data-filter') || 'all';
    activeMetricFilter = null;
    updateMetricPillVisuals();
    renderAlerts();
  });
});

async function handleRecheck(id, host, service, btn) {
  const orig = btn.innerText;
  btn.innerText = '⏳';
  btn.disabled = true;
  try {
    const ok = await window.api?.recheckService(id, host, service);
    btn.innerText = ok ? '✅' : '❌';
  } catch (err) {
    btn.innerText = '❌';
  }
  setTimeout(() => { btn.innerText = orig; btn.disabled = false; }, 3000);
}

// POJEDYNCZY UNACK Z GŁÓWNEJ LISTY
async function handleRemoveAck(id, host, service, btn) {
  const orig = btn ? btn.innerText : '🔓 Unack';
  if (btn) { btn.innerText = '⏳'; btn.disabled = true; }

  try {
    const ok = await window.api?.removeAckService(id, host, service);
    if (ok) {
      showToast(`🔓 Zdjęto potwierdzenie (Unack): ${host} ➔ ${service}`);
      const found = currentAlerts.find(a => a.id === id || a.key === `${host}!${service}!${id}`);
      if (found) found.acknowledged = false;
      renderAlerts();
      setTimeout(() => window.api?.refreshNow(), 1500);
    } else {
      showToast('❌ Błąd usuwania potwierdzenia');
      if (btn) btn.innerText = '❌';
    }
  } catch (err) {
    showToast('❌ Błąd usuwania potwierdzenia');
    if (btn) btn.innerText = '❌';
  }
  setTimeout(() => { if (btn) { btn.innerText = orig; btn.disabled = false; } }, 2000);
}

// POJEDYNCZY REMOVE DOWNTIME
async function handleRemoveDowntime(id, host, service, dtName, dtId, btn) {
  const orig = btn ? btn.innerText : '🛑 End DT';
  if (btn) { btn.innerText = '⏳'; btn.disabled = true; }

  try {
    const ok = await window.api?.removeDowntimeService(id, host, service, dtName, dtId);
    if (ok) {
      showToast(`🛑 Zdjęto okno prac (Downtime): ${host} ➔ ${service}`);
      const found = currentAlerts.find(a => a.id === id || a.key === `${host}!${service}!${id}`);
      if (found) {
        found.inDowntime = false;
        found.downtimeId = null;
        found.downtimeName = null;
        found.downtimeEndMs = null;
      }
      renderAlerts();
      setTimeout(() => window.api?.refreshNow(), 1500);
    } else {
      showToast('❌ Błąd usuwania okna prac');
      if (btn) btn.innerText = '❌';
    }
  } catch (err) {
    showToast('❌ Błąd usuwania okna prac');
    if (btn) btn.innerText = '❌';
  }
  setTimeout(() => { if (btn) { btn.innerText = orig; btn.disabled = false; } }, 2000);
}

function openAckModal(id, host, service, btn) {
  isBulkAckPending = false;
  pendingAck = { id, host, service, btn, key: `${host}!${service}` };
  if (ackModalTitle) ackModalTitle.innerText = 'Potwierdzenie problemu (Acknowledge)';
  if (ackTargetLabel) ackTargetLabel.innerText = `${host} ➔ ${service}`;
  if (ackCommentInput) ackCommentInput.value = 'W trakcie weryfikacji';
  if (ackPersistentCheckbox) ackPersistentCheckbox.checked = true;
  if (modalAck) modalAck.classList.remove('hidden');
  setTimeout(() => {
    ackCommentInput?.focus();
    ackCommentInput?.select();
  }, 50);
}

function closeAckModal() {
  if (modalAck) modalAck.classList.add('hidden');
  pendingAck = null;
  isBulkAckPending = false;
}

async function submitAckModal() {
  const comment = (ackCommentInput ? ackCommentInput.value.trim() : '') || 'Potwierdzone z OpsHub';
  const isPersistent = Boolean(ackPersistentCheckbox ? ackPersistentCheckbox.checked : true);

  if (isBulkAckPending) {
    const selectedAlerts = (currentAlerts || []).filter(a => selectedKeys.has(a.key));
    const icingaAlerts = selectedAlerts.filter(a => !a.isKarma);

    closeAckModal();

    const targetKeys = new Set(icingaAlerts.map(a => a.key));
    currentAlerts.forEach(a => {
      if (targetKeys.has(a.key)) a.acknowledged = true;
    });
    selectedKeys.clear();
    renderAlerts();

    showToast(`⏳ Wysyłam Ack do ${icingaAlerts.length} alertów...`);

    let ackSuccess = 0;
    for (const a of icingaAlerts) {
      try {
        const ok = await window.api?.ackService(a.id, a.host, a.service, comment, isPersistent);
        if (ok) ackSuccess++;
      } catch (e) {}
    }

    showToast(`💬 Potwierdzono ${ackSuccess}/${icingaAlerts.length} alertów!`);
    setTimeout(() => window.api?.refreshNow(), 1500);
    return;
  }

  if (!pendingAck) return;
  const { id, host, service, key } = pendingAck;
  closeAckModal();

  const found = currentAlerts.find(a => a.id === id || a.key === key || a.key.startsWith(`${host}!${service}`));
  if (found) found.acknowledged = true;
  renderAlerts();

  try {
    const ok = await window.api?.ackService(id, host, service, comment, isPersistent);
    showToast(ok ? `💬 Potwierdzono: ${host}` : '❌ Błąd potwierdzenia');
  } catch (err) {
    showToast('❌ Błąd potwierdzenia');
  }
  setTimeout(() => window.api?.refreshNow(), 1500);
}

const btnSaveAck = document.getElementById('btn-save-ack');
if (btnSaveAck) btnSaveAck.addEventListener('click', submitAckModal);

const btnCancelAck = document.getElementById('btn-cancel-ack');
if (btnCancelAck) btnCancelAck.addEventListener('click', closeAckModal);

async function handleDowntime(id, host, service, btn) {
  openSingleDowntimeModal(id, host, service);
}

if (searchInput) searchInput.addEventListener('input', renderAlerts);
if (hideDoneCheckbox) hideDoneCheckbox.addEventListener('change', renderAlerts);

const btnRefresh = document.getElementById('btn-refresh');
if (btnRefresh) btnRefresh.addEventListener('click', () => window.api?.refreshNow());

const btnLogin = document.getElementById('btn-login');
if (btnLogin) btnLogin.addEventListener('click', () => window.api?.triggerSso());

const btnLoginKarma = document.getElementById('btn-login-karma');
if (btnLoginKarma) btnLoginKarma.addEventListener('click', () => window.api?.triggerKarmaSso());

const btnClearDone = document.getElementById('btn-clear-done');
if (btnClearDone) {
  btnClearDone.addEventListener('click', async () => {
    await window.api?.clearAllDone();
  });
}

// -------------------------------------------------------------
// OBSŁUGA HANDOVERU (EKSPORT & IMPORT)
// -------------------------------------------------------------
if (btnExportHandover) {
  btnExportHandover.addEventListener('click', () => {
    const doneAlerts = (currentAlerts || []).filter(a => a.isLocallyDone);

    if (doneAlerts.length === 0) {
      showToast('⚠️ Brak wyciszonych alertów (Done) do przekazania');
      return;
    }

    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const dateFormatted = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`;

    const lines = [
      `# ========================================================`,
      `# OPSHUB HANDOVER EXPORT — ${dateFormatted}`,
      `# Liczba przekazanych pozycji: ${doneAlerts.length}`,
      `# Wklej ten tekst w OpsHub (Import) na kolejnej zmianie.`,
      `# ========================================================`
    ];

    doneAlerts.forEach(a => {
      const cleanHost = String(a.host || '').replace(/^\[KARMA\]\s*/, '');
      lines.push(`${cleanHost} ! ${a.service} | ${a.localNote || 'Wyciszone w handoverze'}`);
    });

    const exportText = lines.join('\n');
    navigator.clipboard.writeText(exportText);

    if (exportHandoverText) exportHandoverText.value = exportText;
    if (modalExportHandover) modalExportHandover.classList.remove('hidden');

    showToast(`📤 Skopiowano handover (${doneAlerts.length} alertów) do schowka!`);
  });
}

if (btnCopyAgainHandover) {
  btnCopyAgainHandover.addEventListener('click', () => {
    if (exportHandoverText && exportHandoverText.value) {
      navigator.clipboard.writeText(exportHandoverText.value);
      showToast('📋 Ponownie skopiowano do schowka!');
    }
  });
}

if (btnCloseExportHandover) {
  btnCloseExportHandover.addEventListener('click', () => {
    if (modalExportHandover) modalExportHandover.classList.add('hidden');
  });
}

if (btnImportHandover) {
  btnImportHandover.addEventListener('click', () => {
    const handoverText = document.getElementById('handover-text');
    if (handoverText) handoverText.value = '';
    if (modalHandover) modalHandover.classList.remove('hidden');
    setTimeout(() => {
      handoverText?.focus();
    }, 50);
  });
}

const btnCancelHandover = document.getElementById('btn-cancel-handover');
if (btnCancelHandover) {
  btnCancelHandover.addEventListener('click', () => {
    if (modalHandover) modalHandover.classList.add('hidden');
  });
}

const btnSaveHandover = document.getElementById('btn-save-handover');
if (btnSaveHandover) {
  btnSaveHandover.addEventListener('click', async () => {
    const handoverText = document.getElementById('handover-text');
    const text = handoverText ? handoverText.value : '';
    if (text && text.trim()) {
      const importedCount = await window.api?.importHandover(text);
      if (handoverText) handoverText.value = '';
      if (modalHandover) modalHandover.classList.add('hidden');
      showToast(`📥 Zaimportowano i wyciszono ${importedCount || 0} alertów z handoveru!`);
    } else {
      showToast('⚠️ Wklej tekst handoveru do pola');
    }
  });
}

function bootstrap() {
  initSettings();
  updateSortIcons();
  if (window.api?.getAlerts) {
    window.api.getAlerts().then(initial => {
      if (Array.isArray(initial) && initial.length > 0) {
        currentAlerts = initial;
        renderAlerts();
      }
    }).catch(e => console.warn('[Init getAlerts]:', e));
  }
}

if (document.readyState === 'loading') {
  window.addEventListener('DOMContentLoaded', bootstrap);
} else {
  bootstrap();
}

window.api?.onAlertsUpdated?.((alerts) => {
  currentAlerts = Array.isArray(alerts) ? alerts : [];
  renderAlerts();
});
