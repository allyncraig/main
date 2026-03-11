/* ═══════════════════════════════════════════════════════
   SERMON ARCHITECT — MOBILE APP
   index.js — All application logic
   ═══════════════════════════════════════════════════════ */

'use strict';

// ── CONSTANTS ────────────────────────────────────────────
const STORAGE_KEY_INDEX = 'sa_sermon_index';
const STORAGE_KEY_PREFIX = 'sa_sermon_';

const STEP_DEFS = [
  { num: 1, label: '1. Scripture & Context' },
  { num: 2, label: '2. FCF — Fallen Condition' },
  { num: 3, label: '3. Relational Doxology' },
  { num: 4, label: '4. Introduction' },
  { num: 5, label: '5. Proposition & Transition' },
  { num: 6, label: '6. Body — Main Points' },
  { num: 7, label: '7. Conclusion & Call' },
  { num: 8, label: '8. Export Outline' },
];

// ── APP STATE ────────────────────────────────────────────
let currentPanel = 0;
let pointCount = 3;
let currentSermonId = null;
let sortField = 'date';    // 'date' | 'title'
let sortDir = 'desc';      // 'asc' | 'desc'  (default: newest first)
let sortDirTitle = 'asc';  // independent direction for title
let editModeActive = false;
let selectedSermonIds = new Set();
let longPressTimer = null;
let confirmCallback = null;

// ── STORAGE HELPERS ──────────────────────────────────────
function getSermonIndex() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY_INDEX) || '[]');
  } catch (e) {
    return [];
  }
}

function saveSermonIndex(index) {
  localStorage.setItem(STORAGE_KEY_INDEX, JSON.stringify(index));
}

function loadSermonData(id) {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY_PREFIX + id) || 'null');
  } catch (e) {
    return null;
  }
}

function saveSermonData(id, data) {
  localStorage.setItem(STORAGE_KEY_PREFIX + id, JSON.stringify(data));
}

function deleteSermonData(id) {
  localStorage.removeItem(STORAGE_KEY_PREFIX + id);
}

function generateId() {
  return 'sermon_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
}

function formatDate(isoString) {
  if (!isoString) {
    return 'No date';
  }
  const d = new Date(isoString);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

// ── COLLECT ALL FORM DATA ────────────────────────────────
function collectFormData() {
  const data = {};

  // Simple inputs / textareas / selects by id
  const ids = [
    'sermon-title', 'sermon-date', 'scripture-ref', 'scripture-support',
    'passage-structure', 'exeg-summary', 'audience',
    'ta-author', 'ta-audience-orig', 'ta-lit-context', 'ta-historical',
    'key-terms', 'ta-word-study', 'ta-theological-loci',
    'grammar-notes', 'ta-verbs', 'ta-connectors', 'ta-indicative',
    'ta-ot-allusions', 'ta-nt-parallels', 'ta-redemptive',
    'ta-author-problem', 'ta-central-assertion', 'ta-author-intent',
    'fcf-condition', 'fcf-evidence', 'fcf-text-diag', 'fcf-gospel-ans', 'fcf-statement',
    'peck-relation', 'peck-doxology', 'peck-pathos',
    'hook-type', 'intro-hook', 'intro-need', 'intro-text-bridge',
    'proposition', 'sermon-aim', 'key-word',
    'conc-restate', 'conc-gospel', 'response-type', 'conc-call', 'conc-image',
  ];

  ids.forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      data[id] = el.value;
    }
  });

  // Radio buttons
  ['lit-genre', 'canon-pos', 'keyword'].forEach(name => {
    const checked = document.querySelector(`input[name="${name}"]:checked`);
    data['radio_' + name] = checked ? checked.value : '';
  });

  // Main points
  data.pointCount = pointCount;
  data.points = [];
  for (let i = 1; i <= pointCount; i++) {
    const block = document.getElementById('point-block-' + i);
    if (!block) {
      continue;
    }
    const ptData = {};
    const classMap = [
      'pt-scripture', 'pt-statement',
      'pt-explain', 'pt-key-terms', 'pt-grammar', 'pt-exeg-idea',
      'pt-xref-confirm', 'pt-xref-ot', 'pt-xref-note', 'pt-xref-locus',
      'pt-apply-fcf', 'pt-apply', 'pt-apply-kfd', 'pt-dox',
      'pt-illus-type', 'pt-illus', 'pt-illus-hinge', 'pt-illus-source',
    ];
    classMap.forEach(cls => {
      const el = block.querySelector('.' + cls);
      if (el) {
        ptData[cls] = el.value;
      }
    });
    data.points.push(ptData);
  }

  return data;
}

// ── RESTORE FORM DATA ────────────────────────────────────
function restoreFormData(data) {
  if (!data) {
    return;
  }

  // Simple fields
  const ids = [
    'sermon-title', 'sermon-date', 'scripture-ref', 'scripture-support',
    'passage-structure', 'exeg-summary', 'audience',
    'ta-author', 'ta-audience-orig', 'ta-lit-context', 'ta-historical',
    'key-terms', 'ta-word-study', 'ta-theological-loci',
    'grammar-notes', 'ta-verbs', 'ta-connectors', 'ta-indicative',
    'ta-ot-allusions', 'ta-nt-parallels', 'ta-redemptive',
    'ta-author-problem', 'ta-central-assertion', 'ta-author-intent',
    'fcf-condition', 'fcf-evidence', 'fcf-text-diag', 'fcf-gospel-ans', 'fcf-statement',
    'peck-relation', 'peck-doxology', 'peck-pathos',
    'hook-type', 'intro-hook', 'intro-need', 'intro-text-bridge',
    'proposition', 'sermon-aim', 'key-word',
    'conc-restate', 'conc-gospel', 'response-type', 'conc-call', 'conc-image',
  ];

  ids.forEach(id => {
    const el = document.getElementById(id);
    if (el && data[id] !== undefined) {
      el.value = data[id];
    }
  });

  // Radios
  ['lit-genre', 'canon-pos', 'keyword'].forEach(name => {
    const val = data['radio_' + name];
    if (val) {
      const radio = document.querySelector(`input[name="${name}"][value="${CSS.escape(val)}"]`);
      if (radio) {
        radio.checked = true;
      }
    }
  });

  // Points
  pointCount = data.pointCount || 3;
  buildPoints();

  if (data.points && data.points.length) {
    data.points.forEach((ptData, idx) => {
      const i = idx + 1;
      const block = document.getElementById('point-block-' + i);
      if (!block) {
        return;
      }
      Object.keys(ptData).forEach(cls => {
        const el = block.querySelector('.' + cls);
        if (el) {
          el.value = ptData[cls];
        }
      });
    });
  }

  // Update FCF bar after restore
  updateFCF();
}

// ── CLEAR FORM ───────────────────────────────────────────
function clearForm() {
  document.querySelectorAll('#screen-editor input[type="text"], #screen-editor textarea').forEach(el => {
    el.value = '';
  });
  document.querySelectorAll('#screen-editor select').forEach(el => {
    el.selectedIndex = 0;
  });
  // Reset radios to defaults
  const epistle = document.getElementById('lg-epistle');
  if (epistle) {
    epistle.checked = true;
  }
  const redemption = document.getElementById('cp-redemption');
  if (redemption) {
    redemption.checked = true;
  }
  document.querySelectorAll('input[name="keyword"]').forEach(r => {
    r.checked = false;
  });

  pointCount = 3;
  buildPoints();
  updateFCF();
}

// ── AUTO-SAVE ────────────────────────────────────────────
function autoSave() {
  if (!currentSermonId) {
    return;
  }

  const data = collectFormData();
  const title = data['sermon-title'] || 'Untitled Sermon';
  const now = new Date().toISOString();

  saveSermonData(currentSermonId, data);

  const index = getSermonIndex();
  const entry = index.find(s => s.id === currentSermonId);
  if (entry) {
    entry.title = title;
    entry.updatedAt = now;
  } else {
    index.push({ id: currentSermonId, title, updatedAt: now });
  }
  saveSermonIndex(index);

  // Update displayed title in step nav
  const titleDisplay = document.getElementById('current-sermon-title-display');
  if (titleDisplay) {
    titleDisplay.textContent = title;
  }
}

// Throttled auto-save
let autoSaveTimer = null;
function updateData() {
  if (autoSaveTimer) {
    clearTimeout(autoSaveTimer);
  }
  autoSaveTimer = setTimeout(autoSave, 800);
}

// ── SCREEN NAVIGATION ────────────────────────────────────
function showScreen(screenId) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(screenId).classList.add('active');
}

// ── SERMON LIST ──────────────────────────────────────────
function renderSermonList() {
  const container = document.getElementById('sermon-list-container');
  let index = getSermonIndex();

  if (index.length === 0) {
    container.innerHTML = `
      <div class="sermon-list-empty">
        <div class="empty-icon">📖</div>
        <p>No sermons yet.<br>Tap "+ New Sermon" to begin.</p>
      </div>`;
    return;
  }

  // Sort
  index = [...index].sort((a, b) => {
    if (sortField === 'date') {
      const da = new Date(a.updatedAt || 0).getTime();
      const db = new Date(b.updatedAt || 0).getTime();
      return sortDir === 'asc' ? da - db : db - da;
    } else {
      const ta = (a.title || '').toLowerCase();
      const tb = (b.title || '').toLowerCase();
      const cmp = ta < tb ? -1 : ta > tb ? 1 : 0;
      return sortDir === 'asc' ? cmp : -cmp;
    }
  });

  container.innerHTML = '';
  const tpl = document.getElementById('tpl-sermon-item');

  index.forEach(sermon => {
    const clone = tpl.content.cloneNode(true);
    const item = clone.querySelector('.sermon-item');
    item.dataset.id = sermon.id;

    item.querySelector('.sermon-item-title').textContent = sermon.title || 'Untitled Sermon';
    item.querySelector('.sermon-item-meta').textContent =
      'Last edited: ' + formatDate(sermon.updatedAt);

    const checkbox = item.querySelector('.sermon-item-checkbox');
    if (selectedSermonIds.has(sermon.id)) {
      checkbox.classList.add('checked');
    }

    // Tap to open (non-edit mode) or toggle checkbox (edit mode)
    item.addEventListener('click', () => {
      if (editModeActive) {
        toggleSermonSelection(sermon.id, item);
      } else {
        openSermon(sermon.id);
      }
    });

    // Long-press to enter edit mode
    item.addEventListener('touchstart', () => {
      longPressTimer = setTimeout(() => {
        if (!editModeActive) {
          enterEditMode();
          toggleSermonSelection(sermon.id, item);
        }
      }, 600);
    }, { passive: true });

    item.addEventListener('touchend', () => {
      clearTimeout(longPressTimer);
    }, { passive: true });

    item.addEventListener('touchmove', () => {
      clearTimeout(longPressTimer);
    }, { passive: true });

    container.appendChild(clone);
  });
}

function enterEditMode() {
  editModeActive = true;
  selectedSermonIds.clear();
  document.getElementById('sermon-list-container').classList.add('edit-mode');
  document.getElementById('list-edit-bar').classList.add('visible');
  updateEditBar();
}

function exitEditMode() {
  editModeActive = false;
  selectedSermonIds.clear();
  document.getElementById('sermon-list-container').classList.remove('edit-mode');
  document.getElementById('list-edit-bar').classList.remove('visible');
  renderSermonList();
}

function toggleSermonSelection(id, item) {
  const checkbox = item.querySelector('.sermon-item-checkbox');
  if (selectedSermonIds.has(id)) {
    selectedSermonIds.delete(id);
    checkbox.classList.remove('checked');
  } else {
    selectedSermonIds.add(id);
    checkbox.classList.add('checked');
  }
  updateEditBar();
}

function updateEditBar() {
  const count = selectedSermonIds.size;
  document.getElementById('list-edit-count').textContent =
    count === 0 ? 'None selected' : count + ' selected';
  document.getElementById('btn-delete-selected').disabled = count === 0;
}

function deleteSelectedSermons() {
  if (selectedSermonIds.size === 0) {
    return;
  }
  const count = selectedSermonIds.size;
  const msg = count === 1
    ? 'Delete this sermon? This cannot be undone.'
    : `Delete ${count} sermons? This cannot be undone.`;

  showConfirm('Delete Sermon' + (count > 1 ? 's' : ''), msg, () => {
    let index = getSermonIndex();
    selectedSermonIds.forEach(id => {
      deleteSermonData(id);
      index = index.filter(s => s.id !== id);
    });
    saveSermonIndex(index);
    exitEditMode();
    toast('Deleted ' + count + ' sermon' + (count > 1 ? 's' : '') + ' ✓');
  });
}

// ── SERMON OPEN / CREATE ─────────────────────────────────
function openSermon(id) {
  const data = loadSermonData(id);
  currentSermonId = id;
  clearForm();
  if (data) {
    restoreFormData(data);
  }
  goTo(0);
  showScreen('screen-editor');

  // Update title display
  const title = (data && data['sermon-title']) || 'Untitled Sermon';
  document.getElementById('current-sermon-title-display').textContent = title;
}

function createNewSermon() {
  const id = generateId();
  const now = new Date().toISOString();

  const index = getSermonIndex();
  index.push({ id, title: 'Untitled Sermon', updatedAt: now });
  saveSermonIndex(index);

  currentSermonId = id;
  clearForm();
  goTo(0);
  showScreen('screen-editor');
  document.getElementById('current-sermon-title-display').textContent = 'Untitled Sermon';
}

function saveAndReturn() {
  autoSave();
  exitEditMode();
  showScreen('screen-list');
  renderSermonList();
  toast('Sermon saved ✓');
}

// ── STEP SELECTOR DROPDOWN ───────────────────────────────
function buildStepChips() {
  // No chip grid needed — we use the overlay dropdown instead
  updateStepSelectorLabel();
}

function toggleStepDropdown() {
  let overlay = document.getElementById('step-dropdown-overlay');
  if (overlay) {
    closeStepDropdown();
    return;
  }

  // Build overlay
  overlay = document.createElement('div');
  overlay.id = 'step-dropdown-overlay';

  const list = document.createElement('div');
  list.id = 'step-dropdown-list';

  STEP_DEFS.forEach((step, idx) => {
    const item = document.createElement('button');
    item.className = 'step-dropdown-item' + (idx === currentPanel ? ' active' : '');
    item.textContent = step.label;
    item.addEventListener('click', (e) => {
      e.stopPropagation();
      closeStepDropdown();
      goTo(idx);
    });
    list.appendChild(item);
  });

  overlay.appendChild(list);
  document.getElementById('app-container').appendChild(overlay);

  // Rotate arrow
  document.getElementById('step-selector-arrow').textContent = '▲';

  // Tap outside to close
  setTimeout(() => {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        closeStepDropdown();
      }
    });
  }, 0);
}

function closeStepDropdown() {
  const overlay = document.getElementById('step-dropdown-overlay');
  if (overlay) {
    overlay.remove();
  }
  document.getElementById('step-selector-arrow').textContent = '▼';
}

function updateStepSelectorLabel() {
  const label = document.getElementById('step-selector-label');
  if (label) {
    label.textContent = STEP_DEFS[currentPanel].label;
  }
}

// ── STEP NAVIGATION ──────────────────────────────────────
function goTo(n) {
  closeStepDropdown();

  // Update panels
  document.getElementById('panel-' + currentPanel).classList.remove('active');
  document.getElementById('panel-' + n).classList.add('active');

  currentPanel = n;
  updateStepSelectorLabel();

  // Scroll panel to top
  document.getElementById('panel-scroll-container').scrollTo(0, 0);

  // Update progress bar
  const pct = Math.round(((n + 1) / 8) * 100);
  document.getElementById('editor-progress-fill').style.width = pct + '%';

  // Generate outline on step 8
  if (n === 7) {
    generateOutline();
  }
}

// ── PANEL DESCRIPTION TOGGLES ────────────────────────────
function initPanelDescToggles() {
  document.querySelectorAll('.panel-header-top').forEach(headerTop => {
    const wrap = headerTop.parentElement.querySelector('.panel-desc-wrap');
    const arrow = headerTop.querySelector('.panel-desc-toggle');
    if (!wrap || !arrow) {
      return;
    }
    headerTop.addEventListener('click', () => {
      wrap.classList.toggle('open');
      arrow.classList.toggle('open');
    });
  });
}

// ── STRUCT TOGGLES ───────────────────────────────────────
function toggleStruct(header) {
  const body = header.nextElementSibling;
  const toggle = header.querySelector('.struct-toggle');
  if (!body || !toggle) {
    return;
  }
  body.classList.toggle('open');
  toggle.classList.toggle('open');
}

// ── TOP BAR TOGGLE ───────────────────────────────────────
function initTopBar() {
  const topBar = document.getElementById('top-bar');
  const expanded = document.getElementById('top-bar-expanded');
  const chevron = document.getElementById('top-bar-chevron');

  topBar.addEventListener('click', () => {
    expanded.classList.toggle('open');
    chevron.classList.toggle('open');
  });

  // Tap anywhere else to close
  document.addEventListener('click', (e) => {
    if (!topBar.contains(e.target) && expanded.classList.contains('open')) {
      expanded.classList.remove('open');
      chevron.classList.remove('open');
    }
  });
}

// ── SORT ─────────────────────────────────────────────────
function initSortButtons() {
  const btnDate = document.getElementById('sort-btn-date');
  const btnTitle = document.getElementById('sort-btn-title');
  const arrowDate = document.getElementById('sort-arrow-date');
  const arrowTitle = document.getElementById('sort-arrow-title');

  function updateSortUI() {
    btnDate.classList.toggle('active', sortField === 'date');
    btnTitle.classList.toggle('active', sortField === 'title');
    arrowDate.textContent = (sortField === 'date' && sortDir === 'asc') ? '↑' : '↓';
    arrowTitle.textContent = (sortField === 'title' && sortDirTitle === 'asc') ? '↑' : '↓';
  }

  btnDate.addEventListener('click', () => {
    if (sortField === 'date') {
      sortDir = sortDir === 'asc' ? 'desc' : 'asc';
    } else {
      sortField = 'date';
    }
    updateSortUI();
    renderSermonList();
  });

  btnTitle.addEventListener('click', () => {
    if (sortField === 'title') {
      sortDirTitle = sortDirTitle === 'asc' ? 'desc' : 'asc';
      sortDir = sortDirTitle;
    } else {
      sortField = 'title';
      sortDir = sortDirTitle;
    }
    updateSortUI();
    renderSermonList();
  });

  updateSortUI();
}

// ── CONFIRM DIALOG ───────────────────────────────────────
function showConfirm(title, message, onOk) {
  document.getElementById('confirm-title').textContent = title;
  document.getElementById('confirm-message').textContent = message;
  confirmCallback = onOk;
  document.getElementById('confirm-overlay').classList.add('visible');
}

function initConfirmDialog() {
  document.getElementById('confirm-ok').addEventListener('click', () => {
    document.getElementById('confirm-overlay').classList.remove('visible');
    if (confirmCallback) {
      confirmCallback();
    }
    confirmCallback = null;
  });
  document.getElementById('confirm-cancel').addEventListener('click', () => {
    document.getElementById('confirm-overlay').classList.remove('visible');
    confirmCallback = null;
  });
}

// ── MAIN POINTS BUILDER ──────────────────────────────────
function buildPoints() {
  const container = document.getElementById('main-points-container');
  container.innerHTML = '';
  for (let i = 1; i <= pointCount; i++) {
    renderPoint(i);
  }
  const addBtn = document.getElementById('add-point-btn');
  if (addBtn) {
    addBtn.style.display = pointCount >= 4 ? 'none' : 'inline-flex';
  }
}

function renderPoint(i) {
  const container = document.getElementById('main-points-container');
  const tpl = document.getElementById('tpl-point-block');
  const clone = tpl.content.cloneNode(true);
  const block = clone.querySelector('.struct-item');

  block.id = 'point-block-' + i;

  // Set point number/name in header
  block.querySelector('.struct-num').textContent = 'Pt ' + i;
  block.querySelector('.struct-name').textContent =
    'Main Point ' + i + ' — from the text\'s own division';

  // Assign IDs to all named fields so getData() still works for outline
  const fieldMap = {
    'pt-scripture':     'pt' + i + '-scripture',
    'pt-statement':     'pt' + i + '-statement',
    'pt-explain':       'pt' + i + '-explain',
    'pt-key-terms':     'pt' + i + '-key-terms',
    'pt-grammar':       'pt' + i + '-grammar',
    'pt-exeg-idea':     'pt' + i + '-exeg-idea',
    'pt-xref-confirm':  'pt' + i + '-xref-confirm',
    'pt-xref-ot':       'pt' + i + '-xref-ot',
    'pt-xref-note':     'pt' + i + '-xref-note',
    'pt-xref-locus':    'pt' + i + '-xref-locus',
    'pt-apply-fcf':     'pt' + i + '-apply-fcf',
    'pt-apply':         'pt' + i + '-apply',
    'pt-apply-kfd':     'pt' + i + '-apply-kfd',
    'pt-dox':           'pt' + i + '-dox',
    'pt-illus-type':    'pt' + i + '-illus-type',
    'pt-illus':         'pt' + i + '-illus',
    'pt-illus-hinge':   'pt' + i + '-illus-hinge',
    'pt-illus-source':  'pt' + i + '-illus-source',
  };

  Object.entries(fieldMap).forEach(([cls, id]) => {
    const el = block.querySelector('.' + cls);
    if (el) {
      el.id = id;
    }
  });

  container.appendChild(clone);
}

function addPoint() {
  if (pointCount >= 4) {
    toast('Perry recommends a maximum of 4 main points.');
    return;
  }
  pointCount++;
  renderPoint(pointCount);
  if (pointCount >= 4) {
    document.getElementById('add-point-btn').style.display = 'none';
  }
}

// ── FCF METER ────────────────────────────────────────────
function updateFCF() {
  updateData();
  const fields = ['fcf-condition', 'fcf-evidence', 'fcf-text-diag', 'fcf-gospel-ans', 'fcf-statement'];
  const filled = fields.filter(id => (getData(id) || '').length > 10).length;
  const pct = (filled / fields.length) * 100;
  const bar = document.getElementById('fcf-bar');
  if (bar) {
    bar.style.width = pct + '%';
  }
  const descs = [
    'Begin filling in the FCF fields to clarify your message.',
    'Good start — keep developing the condition and Gospel answer.',
    'Halfway there — the Gospel answer is the most important field.',
    'Strong FCF developing — ensure your Gospel answer is Christ-centered.',
    'FCF is clear. Your sermon has a Gospel spine. ✓',
  ];
  const desc = document.getElementById('fcf-desc');
  if (desc) {
    desc.textContent = descs[Math.min(Math.floor(pct / 25), 4)];
  }
}

// ── DATA HELPERS ─────────────────────────────────────────
function getData(id) {
  const el = document.getElementById(id);
  if (!el) {
    return '';
  }
  return (el.value || '').trim();
}

function getRadio(name) {
  const r = document.querySelector(`input[name="${name}"]:checked`);
  return r ? r.value : '';
}

// ── OUTLINE GENERATOR ────────────────────────────────────
function generateOutline() {
  const title     = getData('sermon-title') || '[Untitled Sermon]';
  const date      = getData('sermon-date');
  const ref       = getData('scripture-ref') || '[Scripture Reference]';
  const support   = getData('scripture-support');
  const litGenre  = getRadio('lit-genre');
  const passageStruct = getData('passage-structure');
  const exeg      = getData('exeg-summary');
  const keyTerms  = getData('key-terms');
  const grammarNotes = getData('grammar-notes');
  const audience  = getData('audience');

  const taAuthor          = getData('ta-author');
  const taAudienceOrig    = getData('ta-audience-orig');
  const taLitContext      = getData('ta-lit-context');
  const taHistorical      = getData('ta-historical');
  const taWordStudy       = getData('ta-word-study');
  const taTheologicalLoci = getData('ta-theological-loci');
  const taVerbs           = getData('ta-verbs');
  const taConnectors      = getData('ta-connectors');
  const taIndicative      = getData('ta-indicative');
  const taOtAllusions     = getData('ta-ot-allusions');
  const taNtParallels     = getData('ta-nt-parallels');
  const taRedemptive      = getData('ta-redemptive');
  const taAuthorProblem   = getData('ta-author-problem');
  const taCentralAssertion = getData('ta-central-assertion');
  const taAuthorIntent    = getData('ta-author-intent');

  const fcfCond      = getData('fcf-condition');
  const fcfGospel    = getData('fcf-gospel-ans');
  const fcfStatement = getData('fcf-statement');

  const peckRel = getData('peck-relation');
  const peckDox = getData('peck-doxology');
  const canonPos = getRadio('canon-pos');

  const hookType   = getData('hook-type');
  const introHook  = getData('intro-hook');
  const introNeed  = getData('intro-need');
  const introBridge = getData('intro-text-bridge');

  const prop    = getData('proposition');
  const aim     = getData('sermon-aim');
  const keyWord = getData('key-word');
  const keyword = getRadio('keyword');

  const concRestate  = getData('conc-restate');
  const concGospel   = getData('conc-gospel');
  const responseType = getData('response-type');
  const concCall     = getData('conc-call');
  const concImage    = getData('conc-image');

  const hr  = '─'.repeat(58);
  const hr2 = '═'.repeat(58);
  let out = '';

  out += `${hr2}\n  EXPOSITORY SERMON OUTLINE\n  ${title.toUpperCase()}\n${hr2}\n`;
  if (date) { out += `  Date / Occasion: ${date}\n`; }
  out += `  Pericope:        ${ref}\n`;
  if (support) { out += `  Support Texts:   ${support}\n`; }
  if (litGenre) { out += `  Literary Genre:  ${litGenre}\n`; }
  if (audience) { out += `  Congregation:    ${audience}\n`; }
  out += `${hr}\n\n`;

  out += `┌─ TEXTUAL ANALYSIS ──────────────────────────────┐\n`;
  out += `  A. Historical-Grammatical Context\n`;
  if (taAuthor) { out += wrap('     Author/Date:      ' + taAuthor, 58) + '\n'; }
  if (taAudienceOrig) { out += wrap('     Orig. Audience:   ' + taAudienceOrig, 58) + '\n'; }
  if (taLitContext) { out += wrap('     Lit. Context:     ' + taLitContext, 58) + '\n'; }
  if (taHistorical) { out += wrap('     Hist. Background: ' + taHistorical, 58) + '\n'; }
  out += `  B. Word Study\n`;
  if (keyTerms) { out += `     Key Terms:        ${keyTerms}\n`; }
  if (taWordStudy) { out += wrap('     Word Study:       ' + taWordStudy, 58) + '\n'; }
  if (taTheologicalLoci) { out += `     Theol. Loci:      ${taTheologicalLoci}\n`; }
  out += `  C. Syntactical & Grammatical Analysis\n`;
  if (grammarNotes) { out += wrap('     Grammar Notes:    ' + grammarNotes, 58) + '\n'; }
  if (taVerbs) { out += wrap('     Verb Analysis:    ' + taVerbs, 58) + '\n'; }
  if (taConnectors) { out += wrap('     Connectors:       ' + taConnectors, 58) + '\n'; }
  if (taIndicative) { out += wrap('     Indicat→Imperat:  ' + taIndicative, 58) + '\n'; }
  out += `  D. Intertextual & Canonical Connections\n`;
  if (taOtAllusions) { out += wrap('     OT Allusions:     ' + taOtAllusions, 58) + '\n'; }
  if (taNtParallels) { out += wrap('     NT Parallels:     ' + taNtParallels, 58) + '\n'; }
  if (taRedemptive) { out += wrap('     Redemptive Arc:   ' + taRedemptive, 58) + '\n'; }
  out += `  E. Authorial Intent\n`;
  if (taAuthorProblem) { out += wrap('     Author\'s Problem: ' + taAuthorProblem, 58) + '\n'; }
  if (taCentralAssertion) { out += wrap('     Central Assert.:  ' + taCentralAssertion, 58) + '\n'; }
  if (taAuthorIntent) { out += wrap('     Intent/Response:  ' + taAuthorIntent, 58) + '\n'; }
  out += `└─────────────────────────────────────────────────┘\n\n`;

  out += `┌─ EXEGESIS ──────────────────────────────────────┐\n`;
  if (exeg) { out += wrap('  Exeg. Idea:      ' + exeg, 58) + '\n'; }
  if (passageStruct) { out += wrap('  Passage Struct:  ' + passageStruct.replace(/\n/g, ' | '), 58) + '\n'; }
  out += `└─────────────────────────────────────────────────┘\n\n`;

  out += `┌─ CHAPELL · FCF ─────────────────────────────────┐\n`;
  out += wrap('  Fallen Condition: ' + (fcfCond || '[not filled]'), 58) + '\n';
  out += wrap('  Gospel Answer:    ' + (fcfGospel || '[not filled]'), 58) + '\n';
  if (fcfStatement) { out += wrap('  FCF Statement:   ' + fcfStatement, 58) + '\n'; }
  out += `└─────────────────────────────────────────────────┘\n\n`;

  out += `┌─ PECKHAM · RELATIONAL DOXOLOGY ─────────────────┐\n`;
  out += wrap('  God\'s Pursuit:   ' + (peckRel || '[not filled]'), 58) + '\n';
  out += wrap('  Doxological Aim: ' + (peckDox || '[not filled]'), 58) + '\n';
  out += `  Canonical Locus:  ${canonPos || '[not selected]'}\n`;
  out += `└─────────────────────────────────────────────────┘\n\n`;

  out += `${hr}\nI. INTRODUCTION\n${hr}\n\n`;
  if (hookType) { out += `   Hook Type:       ${hookType}\n`; }
  if (introHook) { out += wrap('   A. Attention: ' + introHook, 58) + '\n'; }
  if (introNeed) { out += wrap('   B. Need:      ' + introNeed, 58) + '\n'; }
  if (introBridge) { out += wrap('   C. Text:      ' + introBridge, 58) + '\n'; }
  out += '\n';

  out += `${hr}\nII. PROPOSITION  [Homiletical Idea from the Text]\n${hr}\n\n`;
  out += wrap('   ' + (prop || '[Proposition not yet written]'), 58) + '\n\n';
  if (aim) { out += wrap('   Aim: ' + aim, 58) + '\n'; }
  if (keyWord || keyword) { out += `   Key Word: ${keyword || keyWord}\n`; }
  out += '\n';

  out += `${hr}\nIII. BODY  [Points Derived from Passage Divisions]\n${hr}\n\n`;

  for (let i = 1; i <= pointCount; i++) {
    const numeral   = ['A', 'B', 'C', 'D'][i - 1];
    const stmt      = getData('pt' + i + '-statement');
    const scr       = getData('pt' + i + '-scripture');
    const exp       = getData('pt' + i + '-explain');
    const ptTerms   = getData('pt' + i + '-key-terms');
    const ptGram    = getData('pt' + i + '-grammar');
    const ptExegId  = getData('pt' + i + '-exeg-idea');
    const xrefConf  = getData('pt' + i + '-xref-confirm');
    const xrefOT    = getData('pt' + i + '-xref-ot');
    const xrefNote  = getData('pt' + i + '-xref-note');
    const xrefLocus = getData('pt' + i + '-xref-locus');
    const appFCF    = getData('pt' + i + '-apply-fcf');
    const app       = getData('pt' + i + '-apply');
    const appKFD    = getData('pt' + i + '-apply-kfd');
    const dox       = getData('pt' + i + '-dox');
    const illusType = getData('pt' + i + '-illus-type');
    const ill       = getData('pt' + i + '-illus');
    const illusHinge = getData('pt' + i + '-illus-hinge');
    const illusSrc  = getData('pt' + i + '-illus-source');

    out += `   ${numeral}. ${stmt || '[Main Point ' + i + ' — not yet written]'}\n`;
    if (scr) { out += `      Passage:              ${scr}\n`; }
    out += '\n';

    out += `      ┌ EXEGESIS ─────────────────────────────┐\n`;
    if (exp) { out += wrap('      Exposition:          ' + exp, 58) + '\n'; }
    if (ptTerms) { out += `      Key Terms:            ${ptTerms}\n`; }
    if (ptGram) { out += wrap('      Grammar:             ' + ptGram, 58) + '\n'; }
    if (ptExegId) { out += wrap('      Exeg. Idea:          ' + ptExegId, 58) + '\n'; }
    out += `      └───────────────────────────────────────┘\n\n`;

    out += `      ┌ CROSS-REFERENCE VALIDATION ────────────┐\n`;
    if (xrefConf) { out += `      Confirming Refs:      ${xrefConf}\n`; }
    if (xrefOT) { out += wrap('      OT Foundation:       ' + xrefOT, 58) + '\n'; }
    if (xrefNote) { out += wrap('      Validation Note:     ' + xrefNote, 58) + '\n'; }
    if (xrefLocus) { out += `      Theological Locus:    ${xrefLocus}\n`; }
    out += `      └───────────────────────────────────────┘\n\n`;

    out += `      ┌ APPLICATION ──────────────────────────┐\n`;
    if (appFCF) { out += wrap('      FCF Connection:      ' + appFCF, 58) + '\n'; }
    if (app) { out += wrap('      Application:         ' + app, 58) + '\n'; }
    if (appKFD) { out += wrap('      Know·Feel·Do:        ' + appKFD, 58) + '\n'; }
    if (dox) { out += wrap('      ✦ Doxological Brdg:  ' + dox, 58) + '\n'; }
    out += `      └───────────────────────────────────────┘\n\n`;

    out += `      ┌ ILLUSTRATION ─────────────────────────┐\n`;
    if (illusType) { out += `      Type:                 ${illusType}\n`; }
    if (ill) { out += wrap('      Illustration:         ' + ill, 58) + '\n'; }
    if (illusHinge) { out += wrap('      Hinge to Text:        ' + illusHinge, 58) + '\n'; }
    if (illusSrc) { out += `      Source:               ${illusSrc}\n`; }
    out += `      └───────────────────────────────────────┘\n\n`;
  }

  out += `${hr}\nIV. CONCLUSION\n${hr}\n\n`;
  if (concRestate) { out += wrap('   Restatement: ' + concRestate, 58) + '\n\n'; }
  if (concGospel) { out += wrap('   Gospel Resolution (FCF): ' + concGospel, 58) + '\n\n'; }
  if (responseType) { out += `   Response Type: ${responseType}\n`; }
  if (concCall) { out += wrap('   Call: ' + concCall, 58) + '\n\n'; }
  if (concImage) { out += wrap('   Closing Image: ' + concImage, 58) + '\n\n'; }

  out += `${hr2}\n  SOLI DEO GLORIA\n${hr2}\n`;

  document.getElementById('full-outline').textContent = out;
  buildChecklist();
}

// ── TEXT WRAP UTILITY ────────────────────────────────────
function wrap(text, width) {
  const lines = [];
  const words = text.split(' ');
  let line = '';
  for (const w of words) {
    if ((line + ' ' + w).trim().length > width) {
      lines.push(line.trim());
      line = '      ' + w;
    } else {
      line = (line ? line + ' ' : '') + w;
    }
  }
  if (line) {
    lines.push(line.trim());
  }
  return lines.join('\n');
}

// ── CHECKLIST ────────────────────────────────────────────
function buildChecklist() {
  const checks = [
    { label: 'Sermon title entered', ok: !!getData('sermon-title') },
    { label: 'Primary pericope reference provided', ok: !!getData('scripture-ref') },
    { label: 'Passage structure mapped', ok: getData('passage-structure').length > 20 },
    { label: 'Exegetical idea articulated', ok: getData('exeg-summary').length > 15 },
    { label: 'FCF — fallen condition identified in the text', ok: getData('fcf-condition').length > 15 },
    { label: 'FCF — Gospel answer is Christ-centered', ok: getData('fcf-gospel-ans').length > 20 },
    { label: 'FCF one-sentence statement written', ok: !!getData('fcf-statement') },
    { label: 'God\'s relational pursuit articulated (Peckham)', ok: getData('peck-relation').length > 10 },
    { label: 'Doxological aim / response defined', ok: getData('peck-doxology').length > 10 },
    { label: 'Introduction has an attention-getter', ok: getData('intro-hook').length > 10 },
    { label: 'Need statement connects FCF to congregation', ok: getData('intro-need').length > 10 },
    { label: 'Homiletical proposition derived from the text', ok: getData('proposition').length > 15 },
    { label: 'Main Point 1 has a passage reference', ok: !!getData('pt1-scripture') },
    { label: 'Main Point 1 statement written', ok: !!getData('pt1-statement') },
    { label: 'Main Point 1 — exegesis developed', ok: getData('pt1-explain').length > 20 },
    { label: 'Main Point 1 — cross-reference(s) provided', ok: !!getData('pt1-xref-confirm') },
    { label: 'Main Point 1 — application is FCF-grounded', ok: getData('pt1-apply').length > 15 },
    { label: 'Main Point 1 — illustration written', ok: getData('pt1-illus').length > 20 },
    { label: 'Main Point 2 has a passage reference', ok: !!getData('pt2-scripture') },
    { label: 'Main Point 2 statement written', ok: !!getData('pt2-statement') },
    { label: 'Main Point 2 — exegesis developed', ok: getData('pt2-explain').length > 20 },
    { label: 'Main Point 2 — cross-reference(s) provided', ok: !!getData('pt2-xref-confirm') },
    { label: 'Main Point 2 — application is FCF-grounded', ok: getData('pt2-apply').length > 15 },
    { label: 'Main Point 2 — illustration written', ok: getData('pt2-illus').length > 20 },
    { label: 'Conclusion delivers Gospel resolution of FCF', ok: getData('conc-gospel').length > 20 },
    { label: 'Response call is doxological, not merely moralistic', ok: getData('conc-call').length > 10 },
  ];

  const passed = checks.filter(c => c.ok).length;
  const pct = Math.round((passed / checks.length) * 100);

  const container = document.getElementById('checklist');

  const meterDiv = document.createElement('div');
  meterDiv.style.marginBottom = '1rem';
  meterDiv.innerHTML = `
    <div style="font-family:'JetBrains Mono',monospace;font-size:0.7rem;letter-spacing:0.1em;color:var(--teal);margin-bottom:0.4rem">
      SERMON READINESS: ${pct}% (${passed}/${checks.length})
    </div>
    <div class="fcf-bar-track"><div class="fcf-bar-fill" style="width:${pct}%;background:linear-gradient(90deg,var(--teal),var(--gold))"></div></div>`;

  const listDiv = document.createElement('div');
  listDiv.style.display = 'flex';
  listDiv.style.flexDirection = 'column';
  listDiv.style.gap = '0.35rem';
  listDiv.style.marginTop = '0.75rem';

  checks.forEach(c => {
    const item = document.createElement('div');
    item.className = 'checklist-item';
    item.style.color = c.ok ? 'var(--teal)' : '#aaa';
    item.innerHTML = `
      <span class="checklist-icon">${c.ok ? '✓' : '○'}</span>
      <span>${c.label}</span>`;
    listDiv.appendChild(item);
  });

  container.innerHTML = '';
  container.appendChild(meterDiv);
  container.appendChild(listDiv);
}

// ── COPY & PRINT ─────────────────────────────────────────
function copyOutline() {
  const text = document.getElementById('full-outline').textContent;
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(() => {
      toast('Outline copied to clipboard ✓');
    });
  } else {
    // Fallback for environments without clipboard API
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    toast('Outline copied to clipboard ✓');
  }
}

function printOutline() {
  const text = document.getElementById('full-outline').textContent;
  const win = window.open('', '_blank');
  win.document.write(`<html><head><title>Sermon Outline</title>
    <style>body{font-family:Georgia,serif;font-size:11pt;line-height:1.8;margin:2cm;white-space:pre-wrap}
    @page{margin:2cm}</style></head>
    <body>${text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</body></html>`);
  win.document.close();
  win.print();
}

// ── TOAST ────────────────────────────────────────────────
function toast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 3000);
}

// ── INIT ─────────────────────────────────────────────────
function init() {
  initTopBar();
  initSortButtons();
  initConfirmDialog();
  buildStepChips();
  buildPoints();
  initPanelDescToggles();

  // Open all struct bodies in panels by default
  document.querySelectorAll('.struct-header').forEach(h => {
    const body = h.nextElementSibling;
    const toggle = h.querySelector('.struct-toggle');
    if (body && toggle) {
      body.classList.add('open');
      toggle.classList.add('open');
    }
  });

  // New sermon button
  document.getElementById('btn-new-sermon').addEventListener('click', createNewSermon);

  // Save & Return button
  document.getElementById('btn-save-return').addEventListener('click', saveAndReturn);

  // Edit mode button
  const editBtn = document.createElement('button');
  editBtn.id = 'btn-list-edit';
  editBtn.textContent = 'Edit';
  editBtn.style.cssText = `
    background: transparent;
    border: 1px solid rgba(184,135,42,0.4);
    color: var(--gold-light);
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.65rem;
    letter-spacing: 0.1em;
    padding: 0.3rem 0.7rem;
    border-radius: 3px;
    cursor: pointer;
    white-space: nowrap;
  `;
  editBtn.addEventListener('click', enterEditMode);
  // Insert after the sort bar
  document.getElementById('list-toolbar').appendChild(editBtn);

  document.getElementById('btn-cancel-edit').addEventListener('click', exitEditMode);
  document.getElementById('btn-delete-selected').addEventListener('click', deleteSelectedSermons);

  // Render list
  renderSermonList();

  // Dismiss splash screen
  // Use a short delay so fonts have a chance to load before we reveal the app
  const splash = document.getElementById('splash-screen');
  if (splash) {
    setTimeout(() => {
      splash.classList.add('fade-out');
      setTimeout(() => {
        splash.remove();
      }, 500);
    }, 800);
  }

  // Cordova deviceready
  document.addEventListener('deviceready', () => {
    // Cordova is ready
    console.log('Cordova deviceready');
  }, false);
}

// Wait for DOM
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}