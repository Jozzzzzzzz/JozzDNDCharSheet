
// Disable source map loading to prevent D&D Beyond errors
if (typeof window !== 'undefined') {
  // Override console methods to prevent source map errors
  const originalError = console.error;
  console.error = function(...args) {
    const message = args.join(' ');
    if (!message.includes('source map') && !message.includes('dndbeyond.com')) {
      originalError.apply(console, args);
    }
  };
  
  // Disable source map requests
  const originalFetch = window.fetch;
  window.fetch = function(url, options) {
    if (typeof url === 'string' && url.includes('dndbeyond.com')) {
      return Promise.reject(new Error('D&D Beyond resources blocked'));
    }
    return originalFetch.call(this, url, options);
  };
}

function getDefaultSpellData() {
  return {
    cantrips: [],
    spells: [],
    spellcastingInfo: {}
  };
}

function normalizeSpellData(raw = {}) {
  return {
    cantrips: Array.isArray(raw.cantrips) ? raw.cantrips : [],
    spells: Array.isArray(raw.spells) ? raw.spells : [],
    spellcastingInfo: raw.spellcastingInfo || {}
  };
}

function getDefaultFavoritesData() {
  return {
    cantrips: [],
    spells: []
  };
}

function normalizeFavoritesData(raw = {}) {
  return {
    cantrips: Array.isArray(raw.cantrips) ? raw.cantrips : [],
    spells: Array.isArray(raw.spells) ? raw.spells : []
  };
}

function safeParseJSON(raw, fallback) {
  if (typeof raw !== 'string' || !raw.trim()) return fallback;
  try {
    const parsed = JSON.parse(raw);
    return parsed == null ? fallback : parsed;
  } catch (error) {
    console.warn('Invalid JSON payload in storage. Using fallback.', error);
    return fallback;
  }
}

function getStoredJSON(key, fallback) {
  return safeParseJSON(localStorage.getItem(key), fallback);
}

function setStoredJSON(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (error) {
    console.error(`Failed writing ${key} to localStorage`, error);
    return false;
  }
}

window.safeParseJSON = safeParseJSON;
window.getStoredJSON = getStoredJSON;
window.setStoredJSON = setStoredJSON;

// Notes tab + global notes: unified sizing/word-limit logic hooks into all note textareas.
const NOTE_BOX_SELECTOR = 'textarea.basic-textarea, textarea.notes-textarea, textarea.table-notes';
const NOTE_BOX_MAX_CHARS = Number.MAX_SAFE_INTEGER;
const noteBoxPopupState = {
  source: null,
  keyHandler: null,
  active: false
};

function getCharCount(text) {
  return text ? text.length : 0;
}

function getNoteBoxBaselineFromCSS(textarea) {
  const style = window.getComputedStyle(textarea);
  const minHeight = parseFloat(style.minHeight) || 0;
  const rootStyle = window.getComputedStyle(document.documentElement);
  let fallback = parseFloat(rootStyle.getPropertyValue('--note-default-height')) || 0;
  if (textarea.classList.contains('notes-textarea')) fallback = Math.max(fallback, 160);
  if (textarea.classList.contains('table-notes')) fallback = Math.max(fallback, 100);
  if (!fallback) fallback = 120;
  return minHeight > 0 ? minHeight : fallback;
}

function getNoteBoxDefaultHeight(textarea) {
  const baseline = getNoteBoxBaselineFromCSS(textarea);
  const forced = parseFloat(textarea.dataset.noteBaseHeight);
  if (!Number.isNaN(forced) && forced > 0) {
    // Guard against stale/incorrect oversized baselines that block shrinking.
    if (forced > baseline * 2.5) {
      textarea.dataset.noteBaseHeight = `${baseline}`;
      return baseline;
    }
    return forced;
  }
  return baseline;
}

function getNoteBoxTitle(textarea) {
  if (textarea.dataset.popupTitle) return textarea.dataset.popupTitle;
  const container = textarea.closest('.notes-subsection') || textarea.closest('.section');
  if (container) {
    const header = container.querySelector('h3, h2, label');
    if (header && header.textContent.trim()) {
      return header.textContent.trim();
    }
  }
  return textarea.getAttribute('aria-label') || textarea.placeholder || 'Notes';
}

function getContainerDefaultHeight(container) {
  if (!container) return 0;
  if (!container.dataset.baseMinHeight) {
    const style = window.getComputedStyle(container);
    const minHeight = parseFloat(style.minHeight) || 0;
    container.dataset.baseMinHeight = `${minHeight}`;
  }
  return parseFloat(container.dataset.baseMinHeight) || 0;
}

function updateNoteBoxContainerHeight(textarea, textareaHeight) {
  const container = textarea.closest('.notes-subsection, .actions-notes-section, .quick-notes-section') || textarea.closest('.section');
  if (!container) return;
  const style = window.getComputedStyle(container);
  const padding = (parseFloat(style.paddingTop) || 0) + (parseFloat(style.paddingBottom) || 0);
  const header = container.querySelector('h3, h2, label');
  const headerHeight = header ? header.getBoundingClientRect().height : 0;
  const targetHeight = Math.ceil(textareaHeight + headerHeight + padding + 12);
  const defaultHeight = getContainerDefaultHeight(container);
  const nextHeight = Math.max(defaultHeight, targetHeight);
  container.style.minHeight = `${nextHeight}px`;
  const flexibleContainer = container.classList.contains('notes-subsection')
    || container.classList.contains('actions-notes-section')
    || container.classList.contains('quick-notes-section')
    || container.closest('#page6')
    || container.closest('#page2');
  if (flexibleContainer) {
    container.style.height = 'auto';
  } else {
    container.style.height = `${nextHeight}px`;
  }
}

function updateNoteBoxSizing(textarea) {
  const defaultHeight = getNoteBoxDefaultHeight(textarea);
  const charCount = getCharCount(textarea.value);
  textarea.dataset.charCount = `${charCount}`;

  textarea.style.setProperty('height', 'auto', 'important');
  textarea.style.overflowY = 'hidden';
  let targetHeight = Math.max(defaultHeight, Math.ceil(textarea.scrollHeight));
  if (textarea.id === 'proficiencies_training') {
    const section = textarea.closest('.section');
    if (section) {
      // Only stretch to match sibling panel heights when this card shares a row
      // (the wide 4-column layout). If it wraps to its own row, keep normal note sizing.
      const parent = section.parentElement;
      const sectionTop = section.getBoundingClientRect().top;
      const sameRowSiblings = parent
        ? Array.from(parent.children).filter((child) => {
            if (child === section || !child.classList || !child.classList.contains('section')) return false;
            return Math.abs(child.getBoundingClientRect().top - sectionTop) < 8;
          })
        : [];

      if (sameRowSiblings.length > 0) {
        // Temporarily reset siblings to natural height so we don't ratchet off inflated values
        const savedHeights = sameRowSiblings.map(s => ({ el: s, minH: s.style.minHeight, h: s.style.height }));
        sameRowSiblings.forEach(s => { s.style.minHeight = ''; s.style.height = 'auto'; });
        const rowTargetHeight = sameRowSiblings.reduce((maxHeight, sibling) => {
          const siblingHeight = Math.ceil(sibling.scrollHeight);
          return Math.max(maxHeight, siblingHeight);
        }, 0);
        savedHeights.forEach(({ el, minH, h }) => { el.style.minHeight = minH; el.style.height = h; });

        const sectionStyle = window.getComputedStyle(section);
        const sectionPadding = (parseFloat(sectionStyle.paddingTop) || 0) + (parseFloat(sectionStyle.paddingBottom) || 0);
        const header = section.querySelector('h3, h2, label');
        const headerHeight = header ? header.getBoundingClientRect().height : 0;
        const availableHeight = Math.max(0, Math.floor(rowTargetHeight - sectionPadding - headerHeight - 12));
        targetHeight = Math.max(targetHeight, availableHeight);
      }
    }
  }
  textarea.style.setProperty('height', `${targetHeight}px`, 'important');
  textarea.dataset.lastHeight = `${targetHeight}`;

  if (document.activeElement !== textarea || (textarea.selectionStart === 0 && textarea.selectionEnd === 0)) {
    textarea.scrollTop = 0;
  }

  updateNoteBoxContainerHeight(textarea, targetHeight);

  // After setting this section's height, push siblings to match if we grew taller
  if (textarea.id === 'proficiencies_training') {
    const section = textarea.closest('.section');
    if (section) {
      const finalSectionHeight = Math.ceil(section.getBoundingClientRect().height);
      const parent = section.parentElement;
      const sectionTop = section.getBoundingClientRect().top;
      if (parent) {
        Array.from(parent.children).forEach(sibling => {
          if (sibling === section || !sibling.classList.contains('section')) return;
          if (Math.abs(sibling.getBoundingClientRect().top - sectionTop) >= 8) return;
          if (Math.ceil(sibling.getBoundingClientRect().height) < finalSectionHeight) {
            sibling.style.minHeight = `${finalSectionHeight}px`;
            sibling.style.height = `${finalSectionHeight}px`;
          }
        });
      }
    }
  }
}

function scheduleNoteBoxSizing(textarea) {
  // Character-accurate resize immediately.
  updateNoteBoxSizing(textarea);

  // Second pass on next frame ensures shrink after bulk deletes/wrap changes.
  if (textarea.__noteResizeRaf) cancelAnimationFrame(textarea.__noteResizeRaf);
  textarea.__noteResizeRaf = requestAnimationFrame(() => {
    updateNoteBoxSizing(textarea);
    textarea.__noteResizeRaf = null;
  });

  // Third pass after DOM/input pipelines settle (Ctrl+A/delete and large cuts).
  if (textarea.__noteResizeTimeout) clearTimeout(textarea.__noteResizeTimeout);
  textarea.__noteResizeTimeout = setTimeout(() => {
    updateNoteBoxSizing(textarea);
    textarea.__noteResizeTimeout = null;
  }, 30);
}

function trapNoteBoxPopupFocus(popupId, initialFocus) {
  const popup = document.getElementById(popupId);
  if (!popup) return;
  const focusable = popup.querySelectorAll(
    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
  );
  const first = focusable[0];
  const last = focusable[focusable.length - 1];

  const handler = (event) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      closeNotesEditorPopup();
      return;
    }
    if (event.key !== 'Tab' || focusable.length === 0) return;
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  popup.addEventListener('keydown', handler);
  noteBoxPopupState.keyHandler = handler;
  if (initialFocus) {
    initialFocus.focus();
  } else if (first) {
    first.focus();
  }
}

function openNotesEditorPopup(textarea) {
  if (!textarea) return;
  noteBoxPopupState.source = textarea;
  noteBoxPopupState.active = true;
  currentNotesField = textarea.id || null;
  currentNotesElement = textarea;

  document.body.classList.add('notes-editor-open');
  document.getElementById('notesEditorTitle').textContent = getNoteBoxTitle(textarea);
  const editor = document.getElementById('notesEditorTextarea');
  editor.value = textarea.value;
  showPopup('notesEditorPopup');
  trapNoteBoxPopupFocus('notesEditorPopup', editor);
}

function closeNotesEditorPopup() {
  if (noteBoxPopupState.keyHandler) {
    const popup = document.getElementById('notesEditorPopup');
    popup.removeEventListener('keydown', noteBoxPopupState.keyHandler);
    noteBoxPopupState.keyHandler = null;
  }
  closePopup('notesEditorPopup');
  noteBoxPopupState.active = false;
  document.body.classList.remove('notes-editor-open');
  if (noteBoxPopupState.source) {
    noteBoxPopupState.source.dataset.ignoreNextFocus = '1';
    noteBoxPopupState.source.focus();
  }
  noteBoxPopupState.source = null;
  currentNotesElement = null;
  currentNotesField = null;
}

// Auto-resize containers when textareas change
function setupNoteBoxHandlers() {
  // Notes are rendered/initialized in HTML and dynamic builders; call this after inserting any new note textareas.
  document.querySelectorAll(NOTE_BOX_SELECTOR).forEach(textarea => {
    if (textarea.__noteBoxReady) return;
    textarea.__noteBoxReady = true;
    textarea.classList.add('note-box');

    if (!textarea.dataset.noteBaseHeight) {
      const computed = window.getComputedStyle(textarea);
      const rootStyle = window.getComputedStyle(document.documentElement);
      let fallbackBase = parseFloat(rootStyle.getPropertyValue('--note-default-height')) || 120;
      if (textarea.classList.contains('notes-textarea')) fallbackBase = Math.max(fallbackBase, 160);
      if (textarea.classList.contains('table-notes')) fallbackBase = Math.max(fallbackBase, 100);
      const minHeight = parseFloat(computed.minHeight) || 0;
      textarea.dataset.noteBaseHeight = `${Math.max(minHeight, fallbackBase)}`;
    }

    const onclick = textarea.getAttribute('onclick') || '';
    const match = onclick.match(/showNotesPopup\('([^']+)',\s*'([^']+)'\)/);
    if (match) {
      textarea.dataset.popupId = match[1];
      textarea.dataset.popupTitle = match[2];
      textarea.removeAttribute('onclick');
    }

    const refreshSizing = () => {
      scheduleNoteBoxSizing(textarea);
    };

    textarea.addEventListener('blur', () => {
      textarea.dataset.suppressPopup = '';
      refreshSizing();
    });
    textarea.addEventListener('focus', refreshSizing);

    const handleNoteInput = () => {
      // Autosize on every edit, including per-character changes and deleted wraps.
      scheduleNoteBoxSizing(textarea);
    };

    textarea.addEventListener('input', handleNoteInput);
    textarea.addEventListener('beforeinput', handleNoteInput);
    textarea.addEventListener('paste', handleNoteInput);
    textarea.addEventListener('cut', handleNoteInput);
    textarea.addEventListener('keyup', handleNoteInput);
    textarea.addEventListener('change', handleNoteInput);

    scheduleNoteBoxSizing(textarea);
  });
}

function setupNoteBoxObserver() {
  if (window.noteBoxObserver) return;
  const observer = new MutationObserver(() => {
    if (observer._raf) return;
    observer._raf = requestAnimationFrame(() => {
      observer._raf = null;
      setupNoteBoxHandlers();
    });
  });
  observer.observe(document.body, { childList: true, subtree: true });
  window.noteBoxObserver = observer;
}

function refreshAllNoteBoxes() {
  const textareas = Array.from(document.querySelectorAll(NOTE_BOX_SELECTOR));
  textareas.forEach(textarea => {
    updateNoteBoxSizing(textarea);
  });

  // Second pass after layout settles (media-query reflow, zoom, DevTools drag).
  if (window.__noteResizeRefreshRaf) {
    cancelAnimationFrame(window.__noteResizeRefreshRaf);
  }
  window.__noteResizeRefreshRaf = requestAnimationFrame(() => {
    textareas.forEach(textarea => {
      updateNoteBoxSizing(textarea);
    });
    window.__noteResizeRefreshRaf = null;
  });
}
function setupMobileTextareaAutoGrow() {
  if (window.innerWidth > 768) return;
  document.querySelectorAll('textarea:not(.note-box)').forEach(textarea => {
    const resize = () => {
      textarea.style.height = 'auto';
      textarea.style.height = `${textarea.scrollHeight}px`;
      const section = textarea.closest('.section');
      if (section) {
        const minHeight = Math.max(section.scrollHeight, textarea.scrollHeight + 40);
        section.style.minHeight = `${minHeight}px`;
        if (section.getBoundingClientRect().height < minHeight) {
          section.style.height = `${minHeight}px`;
        }
      }
    };
    textarea.addEventListener('input', resize);
    resize();
  });
}

function loadLayout() {
  // Add layout loading logic here if needed
}

// ========== GLOBAL VARIABLES ==========
let weaponsData = [];
let equipmentData = [];
let currentCharacter = null;
let deleteState = 0;
let deleteTargetCharacterId = null;
const LAST_SELECTED_CHARACTER_KEY = 'dndLastSelectedCharacter';
const LAST_SELECTED_CHARACTER_AT_KEY = 'dndLastSelectedCharacterAt';
const CHARACTER_FAVORITES_KEY = 'dndFavoriteCharacters';
const LAST_SELECTION_MAX_AGE_MS = 12 * 60 * 60 * 1000;
const MAX_FAVORITE_CHARACTERS = 5;

function generateCharacterId() {
  return `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function getFavoriteCharacterIds() {
  const raw = JSON.parse(localStorage.getItem(CHARACTER_FAVORITES_KEY) || '[]');
  if (!Array.isArray(raw)) return [];
  return raw.filter(id => typeof id === 'string');
}

function setFavoriteCharacterIds(ids) {
  localStorage.setItem(CHARACTER_FAVORITES_KEY, JSON.stringify(ids));
}

function isFavoriteCharacter(characterId) {
  return getFavoriteCharacterIds().includes(characterId);
}

function toggleFavoriteCharacter(characterId) {
  const favs = new Set(getFavoriteCharacterIds());
  if (favs.has(characterId)) {
    favs.delete(characterId);
  } else {
    if (favs.size >= MAX_FAVORITE_CHARACTERS) {
      showPopup('favoritesLimitPopup');
      return;
    }
    favs.add(characterId);
  }
  setFavoriteCharacterIds(Array.from(favs));
  loadCharacterList();
}

function rememberSelectedCharacter(characterId) {
  if (!characterId) return;
  localStorage.setItem(LAST_SELECTED_CHARACTER_KEY, characterId);
  localStorage.setItem(LAST_SELECTED_CHARACTER_AT_KEY, `${Date.now()}`);
}

function clearRememberedSelectedCharacter() {
  localStorage.removeItem(LAST_SELECTED_CHARACTER_KEY);
  localStorage.removeItem(LAST_SELECTED_CHARACTER_AT_KEY);
}

function getRecentSelectedCharacterId(characters) {
  const storedId = localStorage.getItem(LAST_SELECTED_CHARACTER_KEY);
  const storedAt = Number(localStorage.getItem(LAST_SELECTED_CHARACTER_AT_KEY) || '');
  if (!storedId || !Number.isFinite(storedAt)) {
    clearRememberedSelectedCharacter();
    return null;
  }

  const ageMs = Date.now() - storedAt;
  const exists = characters.some(char => char.id === storedId);
  if (ageMs > LAST_SELECTION_MAX_AGE_MS || ageMs < 0 || !exists) {
    clearRememberedSelectedCharacter();
    return null;
  }
  return storedId;
}

function sortCharactersForDisplay(characters) {
  const byName = (a, b) => (a.name || '').localeCompare((b.name || ''), undefined, { sensitivity: 'base' });
  const favorites = [];
  const others = [];
  characters.forEach(char => {
    if (isFavoriteCharacter(char.id)) {
      favorites.push(char);
    } else {
      others.push(char);
    }
  });
  favorites.sort(byName);
  others.sort(byName);
  return { favorites, others };
}

// ========== THEME MANAGEMENT ==========
function showDarkModeOnlyPopup() {
  const themeToggle = document.getElementById('themeToggle');
  if (themeToggle) themeToggle.checked = false;

  const settingsDropdown = document.getElementById('settingsDropdown');
  if (settingsDropdown) settingsDropdown.style.display = 'none';

  document.documentElement.removeAttribute('data-theme');
  localStorage.setItem('dndTheme', 'dark');
  document.body.classList.add('modal-open');
  document.body.classList.add('dark-mode-only-open');

  const popup = document.getElementById('darkModeOnlyPopup');
  const backdrop = document.getElementById('popupBackdrop');
  if (!popup || !backdrop) return;

  backdrop.style.display = 'block';
  backdrop.style.zIndex = '2000';
  popup.style.display = 'flex';
  popup.style.zIndex = '2001';

  requestAnimationFrame(() => {
    backdrop.classList.add('show');
    popup.classList.add('show');
  });
}

function toggleTheme() {
  const themeToggle = document.getElementById('themeToggle');
  if (!themeToggle.checked) {
    document.documentElement.removeAttribute('data-theme');
    localStorage.setItem('dndTheme', 'dark');
    return;
  }
  const now = Date.now();
  const lastJoke = Number(localStorage.getItem('dndLightModeJokeAt') || 0);
  const inLightMode = document.documentElement.getAttribute('data-theme') === 'light';

  if (inLightMode) {
    // Already in light mode, toggling off
    document.documentElement.removeAttribute('data-theme');
    localStorage.setItem('dndTheme', 'dark');
    return;
  }

  const jokedRecently = now - lastJoke < 60000;
  const onCooldown = now - lastJoke < 86400000; // 24h

  if (onCooldown && !jokedRecently) {
    // Showed joke in last 24h but not in last 60s — show joke again, reset 60s window
    localStorage.setItem('dndLightModeJokeAt', String(now));
    showDarkModeOnlyPopup();
  } else if (jokedRecently) {
    // Second attempt within 60s — they mean it, let them in
    document.documentElement.setAttribute('data-theme', 'light');
    localStorage.setItem('dndTheme', 'light');
    localStorage.setItem('dndLightModeJokeAt', '0');
  } else {
    // First attempt, no recent history — show joke
    localStorage.setItem('dndLightModeJokeAt', String(now));
    showDarkModeOnlyPopup();
  }
}

function setAccentDerivedColors(color) {
  const hex = color.replace('#', '');
  const r = parseInt(hex.substr(0, 2), 16);
  const g = parseInt(hex.substr(2, 2), 16);
  const b = parseInt(hex.substr(4, 2), 16);

  // Mix toward grey to desaturate (soften) the accent for button fills
  const mix = (v, target, amt) => Math.round(v + (target - v) * amt);
  const grey = 140;
  const mr = mix(r, grey, 0.35);
  const mg = mix(g, grey, 0.35);
  const mb = mix(b, grey, 0.35);

  const borderColor  = `rgba(${r}, ${g}, ${b}, 0.5)`;
  const softColor    = `rgba(${r}, ${g}, ${b}, 0.14)`;
  const mutedColor   = `rgba(${mr}, ${mg}, ${mb}, 0.55)`;  // desaturated, semi-transparent fill

  const yiq = (r * 299 + g * 587 + b * 114) / 1000;
  const contrast = yiq >= 128 ? '#111111' : '#f0f0f0';
  const lighten = (value, amount) => Math.min(255, Math.round(value + (255 - value) * amount));
  const accentText = yiq < 120
    ? `rgb(${lighten(r, 0.65)}, ${lighten(g, 0.65)}, ${lighten(b, 0.65)})`
    : color;

  document.documentElement.style.setProperty('--accent-border', borderColor);
  document.documentElement.style.setProperty('--accent-soft', softColor);
  document.documentElement.style.setProperty('--accent-muted', mutedColor);
  document.documentElement.style.setProperty('--accent-contrast', contrast);
  document.documentElement.style.setProperty('--accent-text', accentText);
}

function updateAccentColor(color) {
  document.documentElement.style.setProperty('--accent', color);
  localStorage.setItem('dndAccentColor', color);
  setAccentDerivedColors(color);
}

// ========== BACKGROUND PICKER ==========

const BG_PRESETS = [
  { id: 'none',               label: 'None',             url: null },
  { id: 'bg-forest',          label: 'Forest',           url: 'assets/backgrounds/bg-forest.jpg' },
  { id: 'bg-dark-forest-path',label: 'Dark Forest Path', url: 'assets/backgrounds/bg-dark-forest-path.jpg' },
  { id: 'bg-elven-city',      label: 'Elven City',       url: 'assets/backgrounds/bg-elven-city.jpg' },
  { id: 'bg-medieval-town',   label: 'Medieval Town',    url: 'assets/backgrounds/bg-medieval-town.jpg' },
  { id: 'bg-tavern',          label: 'Tavern',           url: 'assets/backgrounds/bg-tavern.jpg' },
  { id: 'bg-dungeon-hall',    label: 'Dungeon Hall',     url: 'assets/backgrounds/bg-dungeon-hall.jpg' },
  { id: 'bg-sewers',          label: 'Sewers',           url: 'assets/backgrounds/bg-sewers.jpg' },
  { id: 'bg-ruined-gates',    label: 'Ruined Gates',     url: 'assets/backgrounds/bg-ruined-gates.jpg' },
  { id: 'bg-lost-temple',     label: 'Lost Temple',      url: 'assets/backgrounds/bg-lost-temple.webp' },
  // To add more presets: { id: 'bg-<slug>', label: '<Name>', url: 'assets/backgrounds/<file>' },
];

function bgGetCustoms() {
  return getStoredJSON('dndBgCustoms') || [];
}

function bgSaveCustoms(list) {
  localStorage.setItem('dndBgCustoms', JSON.stringify(list));
}

function bgApply(url) {
  const pseudo = document.getElementById('bg-pseudo-style') || (() => {
    const s = document.createElement('style');
    s.id = 'bg-pseudo-style';
    document.head.appendChild(s);
    return s;
  })();
  if (url) {
    pseudo.textContent = `body::before { background-image: url('${url}') !important; opacity: 1 !important; }`;
    document.documentElement.classList.add('has-bg-image');
    localStorage.setItem('dndBgImage', url);
  } else {
    pseudo.textContent = '';
    document.documentElement.classList.remove('has-bg-image');
    localStorage.removeItem('dndBgImage');
  }
  bgRenderPicker();
}

function bgHandleUpload(event) {
  const file = event.target.files && event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function(e) {
    const name = file.name.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    bgAddCustom(e.target.result, name);
  };
  reader.readAsDataURL(file);
  event.target.value = '';
}

function bgPromptUrl() {
  const url = window.prompt('Paste an image URL:');
  if (!url || !url.trim()) return;
  const trimmed = url.trim();
  const name = trimmed.split('/').pop().replace(/\?.*$/, '').replace(/\.[^.]+$/, '').replace(/[-_]/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) || 'Custom';
  bgAddCustom(trimmed, name);
}

function bgAddCustom(url, name) {
  const customs = bgGetCustoms();
  const id = 'bgc_' + Date.now();
  customs.push({ id, label: name, url });
  bgSaveCustoms(customs);
  bgApply(url);
}

function bgDeleteCustom(id) {
  const customs = bgGetCustoms().filter(c => c.id !== id);
  bgSaveCustoms(customs);
  const current = localStorage.getItem('dndBgImage') || '';
  const deleted = bgGetCustoms().find(c => c.id === id);
  if (deleted && current === deleted.url) bgApply(null);
  bgRenderPicker();
}

function bgRenderThumb(opt, current, deletable) {
  const isActive = opt.url === null ? current === '' : current === opt.url;
  const thumb = opt.url ? `style="background-image:url('${CSS.escape ? opt.url : opt.url}')"` : '';
  const del = deletable
    ? `<button type="button" class="bg-thumb-delete" onclick="event.stopPropagation();bgDeleteCustom('${opt.id}')" title="Remove">✕</button>`
    : '';
  return `<div class="bg-thumb-wrap">
    <button type="button" class="bg-picker-thumb${isActive ? ' bg-picker-active' : ''}" onclick="bgApply(${opt.url ? `'${opt.url.replace(/'/g, "\\'")}'` : 'null'})" title="${escapeHtml(opt.label)}" ${thumb}>
      <span class="bg-picker-label">${escapeHtml(opt.label)}</span>
    </button>${del}
  </div>`;
}

function bgRenderPicker() {
  const presetGrid = document.getElementById('bgPickerGrid');
  const customGrid = document.getElementById('bgCustomGrid');
  const customLabel = document.getElementById('bgCustomLabel');
  if (!presetGrid) return;

  const current = localStorage.getItem('dndBgImage') || '';
  const customs = bgGetCustoms();

  presetGrid.innerHTML = BG_PRESETS.map(opt => bgRenderThumb(opt, current, false)).join('');

  if (customGrid) {
    if (customs.length === 0) {
      customGrid.innerHTML = '<p class="settings-note" style="font-style:italic;opacity:0.6;">No custom backgrounds yet.</p>';
      if (customLabel) customLabel.style.display = 'block';
    } else {
      if (customLabel) customLabel.style.display = 'block';
      customGrid.innerHTML = customs.map(opt => bgRenderThumb(opt, current, true)).join('');
    }
  }
}

function loadBgSetting() {
  const saved = localStorage.getItem('dndBgImage');
  if (saved) {
    bgApply(saved);
  } else {
    bgApply(null);
  }
}

window.bgApply = bgApply;
window.bgHandleUpload = bgHandleUpload;
window.bgPromptUrl = bgPromptUrl;
window.bgDeleteCustom = bgDeleteCustom;
window.bgRenderPicker = bgRenderPicker;

function clampTextScalePercent(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return 100;
  const clamped = Math.min(140, Math.max(85, num));
  // Always snap to 5% steps so UI stays predictable across devices.
  return Math.round(clamped / 5) * 5;
}

function applyTextScalePercent(percentValue) {
  const percent = clampTextScalePercent(percentValue);
  const scale = (percent / 100).toFixed(2);
  document.documentElement.style.setProperty('--text-scale', scale);
  document.documentElement.style.fontSize = `${(16 * percent / 100).toFixed(2)}px`;
  localStorage.setItem('dndTextScalePercent', String(percent));
  const slider = document.getElementById('textScaleSlider');
  const valueLabel = document.getElementById('textScaleValue');
  if (slider) slider.value = String(percent);
  if (valueLabel) valueLabel.textContent = `${percent}%`;
}

function updateTextScaleFromSlider(percentValue) {
  applyTextScalePercent(percentValue);
}

window.updateTextScaleFromSlider = updateTextScaleFromSlider;

function stepTextScale(deltaPercent) {
  const current = clampTextScalePercent(localStorage.getItem('dndTextScalePercent') || 100);
  applyTextScalePercent(current + Number(deltaPercent || 0));
}

window.stepTextScale = stepTextScale;

const FONT_OPTIONS = [
  { value: 'segoe',    label: 'Segoe UI (Default)', stack: "'Segoe UI', sans-serif" },
  { value: 'system',   label: 'System Default',     stack: "-apple-system, BlinkMacSystemFont, 'Helvetica Neue', Arial, sans-serif" },
  { value: 'roboto',   label: 'Roboto',             stack: "'Roboto', sans-serif" },
  { value: 'georgia',  label: 'Georgia (Serif)',     stack: "Georgia, 'Times New Roman', serif" },
  { value: 'garamond', label: 'Garamond (Elegant)',  stack: "Garamond, 'EB Garamond', 'Times New Roman', serif" },
  { value: 'verdana',  label: 'Verdana (Wide)',      stack: "Verdana, Geneva, sans-serif" },
  { value: 'tahoma',   label: 'Tahoma (Compact)',    stack: "Tahoma, Geneva, sans-serif" },
  { value: 'trebuchet',label: 'Trebuchet MS',        stack: "'Trebuchet MS', Helvetica, sans-serif" },
  { value: 'courier',  label: 'Courier (Monospace)', stack: "'Courier New', Courier, monospace" },
];

function applyFontFamily(value) {
  const opt = FONT_OPTIONS.find(f => f.value === value) || FONT_OPTIONS[0];
  document.documentElement.style.setProperty('--font-family', opt.stack);
  localStorage.setItem('dndFontFamily', opt.value);
  const select = document.getElementById('fontFamilySelect');
  if (select) select.value = opt.value;
}

window.applyFontFamily = applyFontFamily;

function loadThemeSettings() {
  const themeToggle = document.getElementById('themeToggle');

  // Force dark mode regardless of saved preference.
  document.documentElement.removeAttribute('data-theme');
  localStorage.setItem('dndTheme', 'dark');
  if (themeToggle) themeToggle.checked = false;
  
  // Load accent color
  const savedAccentColor = localStorage.getItem('dndAccentColor');
  if (savedAccentColor) {
    document.documentElement.style.setProperty('--accent', savedAccentColor);
    const colorPicker = document.getElementById('accentColor');
    if (colorPicker) colorPicker.value = savedAccentColor;
    setAccentDerivedColors(savedAccentColor);
  }

  const savedTextScale = localStorage.getItem('dndTextScalePercent');
  applyTextScalePercent(savedTextScale || 100);

  const savedFont = localStorage.getItem('dndFontFamily');
  if (savedFont) applyFontFamily(savedFont);

  loadBgSetting();
  bgRenderPicker();
}

// ========== INITIALIZATION ==========
  // Suggestion Form Functions
  function initializeSuggestionForm() {
    const form = document.getElementById('suggestionForm');
    if (form) {
      form.addEventListener('submit', handleSuggestionSubmit);
    }
  }

  async function handleSuggestionSubmit(event) {
    event.preventDefault();
    
    const suggestionType = document.getElementById('suggestionType').value;
    const suggestionText = document.getElementById('suggestionText').value;
    
    if (!suggestionType || !suggestionText.trim()) {
      showSuggestionStatus('Please fill in all fields', 'error');
      return;
    }
    
    // Get user's email from Firebase auth
    const userEmail = window.currentUser ? window.currentUser.email : 'anonymous@example.com';
    
    // Show sending status
    showSuggestionStatus('Sending suggestion...', 'info');
    
    try {
      // Send suggestion using a simple method
      await sendSuggestionEmail(userEmail, suggestionType, suggestionText);
      showSuggestionStatus('Suggestion sent successfully! Thank you for your feedback.', 'success');
      
      // Clear form
      document.getElementById('suggestionType').value = '';
      document.getElementById('suggestionText').value = '';
    } catch (error) {
      console.error('Error sending suggestion:', error);
      showSuggestionStatus('Failed to send suggestion. Please try again later.', 'error');
    }
  }
  
  // Send suggestion email using a simple method
  async function sendSuggestionEmail(userEmail, suggestionType, suggestionText) {
    // Create the email content
    const subject = `D&D Character Sheet Suggestion - ${suggestionType}`;
    const body = `Hello Joz,

I have a suggestion for the D&D Character Sheet:

Suggestion Type: ${suggestionType}

My Suggestion:
${suggestionText}

Submitted by: ${userEmail}

Thanks for creating this awesome character sheet!

Best regards,
${userEmail}`;

    const formData = new FormData();
    formData.append('email', userEmail);
    formData.append('subject', subject);
    formData.append('message', body);
    formData.append('suggestion_type', suggestionType);
    formData.append('_replyto', userEmail);
    formData.append('_subject', subject);

    const response = await fetch('https://formspree.io/f/xovnrwbd', {
      method: 'POST',
      headers: {
        'Accept': 'application/json'
      },
      body: formData
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Suggestion request failed:', response.status, errorText);
      throw new Error('Suggestion request failed');
    }

    return { success: true, method: 'formspree' };
  }

  function showSuggestionStatus(message, type) {
    const statusDiv = document.getElementById('suggestionStatus');
    if (statusDiv) {
      statusDiv.textContent = message;
      statusDiv.className = `status-message ${type}`;
      statusDiv.style.display = 'block';
      
      // Hide after 5 seconds
      setTimeout(() => {
        statusDiv.style.display = 'none';
      }, 5000);
    }
  }

// Web App / PWA Initialization
function initializeWebApp() {
  // Improved double-tap handling - only prevent zoom on form elements
  let lastTouchEnd = 0;
  document.addEventListener('touchend', function (event) {
    const now = (new Date()).getTime();
    const target = event.target;
    
    // Only prevent zoom on form elements, not on scrollable content
    if (now - lastTouchEnd <= 300 && 
        (target.tagName === 'INPUT' || 
         target.tagName === 'TEXTAREA' || 
         target.tagName === 'SELECT' ||
         target.classList.contains('button') ||
         target.classList.contains('btn'))) {
      event.preventDefault();
    }
    lastTouchEnd = now;
  }, false);
  
  // Prevent context menu on long press
  document.addEventListener('contextmenu', function(e) {
    e.preventDefault();
  });
  
  // Handle orientation changes
  window.addEventListener('orientationchange', function() {
    setTimeout(function() {
      // Force a reflow to fix layout issues
      document.body.style.height = '100vh';
      setTimeout(function() {
        document.body.style.height = '';
      }, 100);
    }, 500);
  });
  
  // Minimal touch handling - rely on CSS overscroll-behavior for pull-to-refresh prevention
  // No JavaScript touch event prevention to avoid console errors
  
  // Handle viewport changes for web app mode
  function handleViewportChange() {
    const vh = window.innerHeight * 0.01;
    document.documentElement.style.setProperty('--vh', `${vh}px`);
  }
  
  window.addEventListener('resize', handleViewportChange);
  window.addEventListener('orientationchange', handleViewportChange);
  handleViewportChange();

  // Portrait upload
  document.addEventListener('change', function(e) {
    if (e.target.id !== 'portraitUpload') return;
    const file = e.target.files[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      alert('Please upload an image file (JPG, PNG, GIF, WebP, etc.)');
      e.target.value = '';
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      alert('Image must be under 2MB to keep your character data manageable.');
      e.target.value = '';
      return;
    }
    const reader = new FileReader();
    reader.onload = function(ev) {
      const preview = document.getElementById('portraitPreview');
      if (!preview) return;
      preview.innerHTML = '';
      const img = document.createElement('img');
      img.src = ev.target.result;
      img.style.width = '100%';
      img.style.height = '100%';
      img.style.objectFit = 'cover';
      img.style.borderRadius = '12px';
      preview.appendChild(img);
      autosave();
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  });
}


// ========== BACKGROUND CUSTOM FIELDS ==========

const BG_DEFAULT_FIELDS = [
  { id: 'personality_traits', title: 'Personality Traits',  placeholder: 'Describe your character\'s personality traits...',       isDefault: true },
  { id: 'traits_ideals',      title: 'Ideals',              placeholder: 'What ideals drive your character?',                       isDefault: true },
  { id: 'traits_bonds',       title: 'Bonds',               placeholder: 'What bonds tie your character to people, places, or events?', isDefault: true },
  { id: 'traits_flaws',       title: 'Flaws',               placeholder: 'What flaws or weaknesses does your character have?',      isDefault: true },
  { id: 'traits_allies',      title: 'Allies & Organizations', placeholder: 'List your character\'s allies and organizations...',   isDefault: true },
  { id: 'traits_appearance',  title: 'Appearance',          placeholder: 'Describe your character\'s physical appearance...',       isDefault: true },
];

let bgCustomFields = [];   // array of { id, title, placeholder, isDefault }
let bgReorderMode  = false;

// --- delete state per field id ---
const bgDeleteState = {};   // { [fieldId]: 0|1|2|3 }
let bgDeleteTimer = null;

// ============================================================
// NOTES PAGE — folder + card system
// ============================================================
// Data shape: noteFolders = [{ id, title, cards: [{ id, title, body }] }]

const NOTES_DEFAULT_FOLDERS = [
  {
    id: 'nfd_quests', title: 'Quests & Missions', isDefault: true,
    cards: [
      { id: 'nfc_q1', isDefault: true, title: '📋 Example — Active Quest',
        body: 'Quest name: The Missing Merchant\nGiven by: Mayor Aldric of Millhaven\nObjective: Find out what happened to Torvin the trader, last seen on the Eastern Road.\nReward: 200gp + a letter of introduction to the Merchant Guild\nStatus: In progress\n\n— Copy this card format for each new quest you track.' },
    ]
  },
  {
    id: 'nfd_npcs', title: 'NPCs', isDefault: true,
    cards: [
      { id: 'nfc_n1', isDefault: true, title: '📋 Example — NPC',
        body: 'Name: Sera Dunwhite\nRace / Class: Human Innkeeper\nLocation: The Broken Antler Inn, Millhaven\nRole: Quest giver / information source\nPersonality: Warm but nosy. Loves gossip.\nRelationship to party: Friendly — gave us a discount room\nKnown info: Saw Torvin arguing with a cloaked figure the night he vanished.\nNotes: Might know more if we bring her wine from the capital.\n\n— Add a new card for each NPC you meet.' },
    ]
  },
  {
    id: 'nfd_locations', title: 'Locations', isDefault: true,
    cards: [
      { id: 'nfc_l1', isDefault: true, title: '📋 Example — Location',
        body: 'Name: Millhaven\nType: Small town\nRegion: The Thornwood Reaches\nFirst visited: Session 1\nKey NPCs: Mayor Aldric, Sera (innkeeper), Gruff the blacksmith\nPoints of interest: The Broken Antler Inn, the old watchtower, the market square\nDangers: Bandit activity on the Eastern Road\nNotes: Population ~400. Loyal to the Crown but ignored by them.\n\n— Add a new card for each place you discover.' },
    ]
  },
  {
    id: 'nfd_lore', title: 'Lore & World Notes', isDefault: true,
    cards: [
      { id: 'nfc_lw1', isDefault: true, title: '📋 Example — Faction',
        body: 'Name: The Ember Court\nGoals: Restore the old empire by any means necessary\nLeader: Unknown — believed to be a noble in the capital\nHow they feel about us: Hostile — we disrupted their operation in Millhaven\nUseful contacts inside: None yet\nNotes: Their agents wear a red signet ring with a flame motif.\n\n— Add a new card for each faction, deity, or piece of lore you uncover.' },
    ]
  },
  {
    id: 'nfd_session', title: 'Session Notes', isDefault: true,
    cards: [
      { id: 'nfc_s1', isDefault: true, title: '📋 Example — Session Recap',
        body: 'Session #: 1\nDate played: 2026-01-10\nWhere we started: Millhaven, The Broken Antler Inn\n\nWhat happened:\nWe arrived in Millhaven after answering a job posting. The mayor hired us to find Torvin the merchant. Sera the innkeeper told us about the cloaked figure. We investigated the Eastern Road and found cart tracks leading into the Greyfen Marsh.\n\nKey decisions made:\n— Decided to head into the marsh rather than wait for backup.\n— Chose not to report the Ember Court signet ring to the guards (don\'t trust them yet).\n\nLoose ends:\n— Who is the cloaked figure?\n— Why does the mayor seem nervous when the Ember Court is mentioned?\n\nWhere we ended: Camp at the edge of Greyfen Marsh.\n\n— Duplicate this card for each session.' },
    ]
  },
  {
    id: 'nfd_party', title: 'Party & Allies', isDefault: true,
    cards: [
      { id: 'nfc_p1', isDefault: true, title: '📋 Example — Party Member',
        body: 'Name: Korrath Ashveil\nClass: Fighter (Battle Master) / Level 3\nPlayer: Dan\nRace: Half-orc\nPersonality: Blunt, honourable, secretly afraid of failure\nStrengths: Front-line tank, intimidation\nWeaknesses: Low Charisma, reckless in combat\nNotes: Has a bounty on his head in the capital. Doesn\'t talk about it.\n\n— Add a card for each party member and key ally.' },
    ]
  },
  {
    id: 'nfd_enemies', title: 'Enemies & Threats', isDefault: true,
    cards: [
      { id: 'nfc_e1', isDefault: true, title: '📋 Example — Enemy',
        body: 'Name: Marsh Stalker (Crocodile variant)\nType / CR: Beast / CR 2\nLocation: Greyfen Marsh\nMotivation: Territorial predator\nWeaknesses: Fire damage, bright light\nAttacks: Bite (+4, 1d10+2), Tail (+4, 1d8+2)\nDefeated? Not yet — fled after taking 15 damage.\nNotes: There are at least two of them. One has an old arrow wound on its left flank.\n\n— Add a card for each notable enemy or boss.' },
    ]
  },
  {
    id: 'nfd_items', title: 'Items & Treasure', isDefault: true,
    cards: [
      { id: 'nfc_i1', isDefault: true, title: '📋 Example — Magic Item',
        body: 'Name: Cloak of the Marsh Walker\nRarity: Uncommon\nAttuned to: Nyx (our Ranger)\nProperties: Advantage on Stealth checks in swamp/marsh terrain. Wearer does not sink in mud.\nWhere found: Looted from the Ember Court agent\'s body, Session 1.\nNotes: The lining has the Ember Court flame embroidered in faded red thread.\n\n— Add a card for each magic item, notable piece of loot, or thing you want to sell.' },
    ]
  },
  {
    id: 'nfd_combat', title: 'Combat & Tactics', isDefault: true,
    cards: [
      { id: 'nfc_c1', isDefault: true, title: '📋 Example — Tactic',
        body: 'Tactic: The Bottleneck\nWho\'s involved: Korrath (Fighter) + Nyx (Ranger) + Zara (Wizard)\nSetup: Korrath holds a doorway or narrow passage. Nyx fires from range. Zara casts area spells behind the melee line.\nEffect: Enemies can\'t flank us. Zara\'s AOE never hits allies.\nBest used when: Indoors, dungeon corridors, chokepoints.\nWeakness: Falls apart in open terrain or against ranged-heavy enemies.\n\n— Add a card for combos, recurring enemy tactics, or anything useful to remember mid-fight.' },
    ]
  },
  {
    id: 'nfd_misc', title: 'Miscellaneous', isDefault: true,
    cards: [
      { id: 'nfc_m1', isDefault: true, title: '📋 Example — House Rule',
        body: 'Rule: Inspiration can be spent for a free re-roll on any d20 check (not just one).\nAgreed on: Session 0, all players present.\nNotes: DM awards Inspiration for good roleplay, creative thinking, or making the session more fun for everyone.\n\n— Use this folder for anything that doesn\'t fit elsewhere: house rules, campaign goals, mysteries, random ideas.' },
    ]
  },
];

let noteFolders = [];
let notesReorderMode = false;
let notesCardReorderMode = false;
let notesActiveFolderId = null;
let notesEditingCardId = null;

// --- multi-step delete state (mirrors bgDeleteState pattern) ---
const notesDeleteState = {};  // { [id]: 0|1|2|3 }
let notesDeleteTimer = null;

function notesSetDeleteBtn(btn, state) {
  if (state === 0) {
    btn.textContent = 'Delete';
    btn.classList.remove('notes-delete-warn', 'notes-delete-counting', 'notes-delete-final');
    btn.disabled = false;
  } else if (state === 1) {
    btn.textContent = 'Sure?';
    btn.classList.add('notes-delete-warn');
    btn.classList.remove('notes-delete-counting', 'notes-delete-final');
  } else if (state === 2) {
    btn.classList.add('notes-delete-counting');
    btn.classList.remove('notes-delete-warn', 'notes-delete-final');
    btn.disabled = true;
  } else if (state === 3) {
    btn.textContent = 'Confirm';
    btn.classList.add('notes-delete-final');
    btn.classList.remove('notes-delete-warn', 'notes-delete-counting');
    btn.disabled = false;
  }
}

function notesResetDelete(id, btn) {
  notesDeleteState[id] = 0;
  if (btn) notesSetDeleteBtn(btn, 0);
}

function notesHandleDelete(id, btn, onConfirm) {
  const state = notesDeleteState[id] || 0;

  if (state === 0) {
    notesDeleteState[id] = 1;
    notesSetDeleteBtn(btn, 1);
    clearTimeout(notesDeleteTimer);
    notesDeleteTimer = setTimeout(() => notesResetDelete(id, btn), 4000);
    return;
  }

  if (state === 1) {
    clearTimeout(notesDeleteTimer);
    notesDeleteState[id] = 2;
    notesSetDeleteBtn(btn, 2);
    let secs = 3;
    btn.textContent = `Wait ${secs}s…`;
    const tick = setInterval(() => {
      secs--;
      if (secs > 0) {
        btn.textContent = `Wait ${secs}s…`;
      } else {
        clearInterval(tick);
        notesDeleteState[id] = 3;
        notesSetDeleteBtn(btn, 3);
      }
    }, 1000);
    return;
  }

  if (state === 3) {
    delete notesDeleteState[id];
    onConfirm();
  }
}

// --- render helpers ---

function renderNoteFolders() {
  const grid = document.getElementById('notesFoldersGrid');
  if (!grid) return;
  grid.innerHTML = '';
  noteFolders.forEach((folder, index) => {
    grid.appendChild(makeNoteFolderEl(folder, index));
  });
}

function makeNoteFolderEl(folder, index) {
  const wrap = document.createElement('div');
  wrap.className = 'notes-folder-card';
  wrap.dataset.folderId = folder.id;

  const header = document.createElement('div');
  header.className = 'notes-folder-header';

  const title = document.createElement('h3');
  title.className = 'notes-folder-title';
  title.textContent = folder.title;

  const count = document.createElement('span');
  count.className = 'notes-folder-count';
  count.textContent = folder.cards.length + ' note' + (folder.cards.length !== 1 ? 's' : '');

  header.appendChild(title);
  header.appendChild(count);
  wrap.appendChild(header);

  if (notesReorderMode) {
    const controls = document.createElement('div');
    controls.className = 'notes-reorder-controls';

    const upBtn = document.createElement('button');
    upBtn.textContent = '▲';
    upBtn.disabled = index === 0;
    upBtn.onclick = () => moveNoteFolder(index, -1);

    const downBtn = document.createElement('button');
    downBtn.textContent = '▼';
    downBtn.disabled = index === noteFolders.length - 1;
    downBtn.onclick = () => moveNoteFolder(index, 1);

    controls.appendChild(upBtn);
    controls.appendChild(downBtn);
    if (!folder.isDefault) {
      const delBtn = document.createElement('button');
      delBtn.className = 'notes-delete-btn';
      notesSetDeleteBtn(delBtn, notesDeleteState[folder.id] || 0);
      delBtn.onclick = () => notesHandleDelete(folder.id, delBtn, () => {
        noteFolders.splice(index, 1);
        renderNoteFolders();
        autosave();
      });
      controls.appendChild(delBtn);
    }
    wrap.appendChild(controls);

    // drag handle
    const dragHandle = document.createElement('div');
    dragHandle.className = 'notes-drag-handle';
    dragHandle.textContent = '⠿';
    dragHandle.title = 'Drag to reorder';
    dragHandle.addEventListener('mousedown', notesFolderDragStart);
    dragHandle.addEventListener('touchstart', notesFolderDragStart, { passive: false });
    wrap.appendChild(dragHandle);
  } else {
    wrap.style.cursor = 'pointer';
    wrap.addEventListener('click', () => openFolderView(folder.id));
  }

  return wrap;
}

function renderNoteCards(folderId) {
  const folder = noteFolders.find(f => f.id === folderId);
  const grid = document.getElementById('notesCardsGrid');
  if (!grid || !folder) return;
  grid.innerHTML = '';
  folder.cards.forEach((card, index) => {
    grid.appendChild(makeNoteCardEl(folder, card, index));
  });
}

function makeNoteCardEl(folder, card, index) {
  const wrap = document.createElement('div');
  wrap.className = 'notes-note-card';
  wrap.dataset.cardId = card.id;

  const titleRow = document.createElement('div');
  titleRow.className = 'notes-note-title-row';

  const title = document.createElement('h3');
  title.className = 'notes-note-title';
  title.textContent = card.title || 'Untitled';
  titleRow.appendChild(title);

  if (card.isDefault) {
    const badge = document.createElement('span');
    badge.className = 'notes-template-badge';
    badge.textContent = 'template';
    titleRow.appendChild(badge);
  }

  const preview = document.createElement('p');
  preview.className = 'notes-note-preview';
  preview.textContent = card.body ? card.body.slice(0, 120) : '';

  wrap.appendChild(titleRow);
  wrap.appendChild(preview);

  if (notesCardReorderMode) {
    const controls = document.createElement('div');
    controls.className = 'notes-reorder-controls';

    const upBtn = document.createElement('button');
    upBtn.textContent = '▲';
    upBtn.disabled = index === 0;
    upBtn.onclick = () => moveNoteCard(folder.id, index, -1);

    const downBtn = document.createElement('button');
    downBtn.textContent = '▼';
    downBtn.disabled = index === folder.cards.length - 1;
    downBtn.onclick = () => moveNoteCard(folder.id, index, 1);

    controls.appendChild(upBtn);
    controls.appendChild(downBtn);

    if (!card.isDefault) {
      const delBtn = document.createElement('button');
      delBtn.className = 'notes-delete-btn';
      notesSetDeleteBtn(delBtn, notesDeleteState[card.id] || 0);
      delBtn.onclick = () => notesHandleDelete(card.id, delBtn, () => {
        folder.cards.splice(index, 1);
        renderNoteCards(folder.id);
        autosave();
      });
      controls.appendChild(delBtn);
    }

    wrap.appendChild(controls);

    if (!card.isDefault) {
      const dragHandle = document.createElement('div');
      dragHandle.className = 'notes-drag-handle';
      dragHandle.textContent = '⠿';
      dragHandle.title = 'Drag to reorder';
      dragHandle.addEventListener('mousedown', notesCardDragStart);
      dragHandle.addEventListener('touchstart', notesCardDragStart, { passive: false });
      wrap.appendChild(dragHandle);
    }
  } else {
    wrap.style.cursor = 'pointer';
    wrap.addEventListener('click', () => openNoteEditor(folder.id, card.id));
  }

  return wrap;
}

// --- navigation ---

function openFolderView(folderId) {
  const folder = noteFolders.find(f => f.id === folderId);
  if (!folder) return;
  notesActiveFolderId = folderId;
  notesCardReorderMode = false;
  document.getElementById('notesFolderView').style.display = 'none';
  const cardView = document.getElementById('notesCardView');
  cardView.style.display = '';
  const crumb = document.getElementById('notesBreadcrumb');
  if (crumb) crumb.textContent = folder.title;
  const cardToggle = document.getElementById('notesCardReorderToggle');
  if (cardToggle) cardToggle.classList.remove('active');
  renderNoteCards(folderId);
}

function notesGoBack() {
  notesActiveFolderId = null;
  notesCardReorderMode = false;
  const cardView = document.getElementById('notesCardView');
  const folderView = document.getElementById('notesFolderView');
  if (cardView) cardView.style.display = 'none';
  if (folderView) folderView.style.display = '';
  renderNoteFolders();
  const page = document.getElementById('page6');
  if (page) page.scrollTop = 0;
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// --- reorder mode toggles ---

function toggleNotesReorderMode() {
  notesReorderMode = !notesReorderMode;
  const btn = document.getElementById('notesReorderToggle');
  if (btn) btn.classList.toggle('active', notesReorderMode);
  renderNoteFolders();
}

function toggleNotesCardReorderMode() {
  notesCardReorderMode = !notesCardReorderMode;
  const btn = document.getElementById('notesCardReorderToggle');
  if (btn) btn.classList.toggle('active', notesCardReorderMode);
  if (notesActiveFolderId) renderNoteCards(notesActiveFolderId);
}

// --- move ---

function moveNoteFolder(index, dir) {
  const newIndex = index + dir;
  if (newIndex < 0 || newIndex >= noteFolders.length) return;
  const tmp = noteFolders[index];
  noteFolders[index] = noteFolders[newIndex];
  noteFolders[newIndex] = tmp;
  renderNoteFolders();
  autosave();
}

function moveNoteCard(folderId, index, dir) {
  const folder = noteFolders.find(f => f.id === folderId);
  if (!folder) return;
  const newIndex = index + dir;
  if (newIndex < 0 || newIndex >= folder.cards.length) return;
  const tmp = folder.cards[index];
  folder.cards[index] = folder.cards[newIndex];
  folder.cards[newIndex] = tmp;
  renderNoteCards(folderId);
  autosave();
}

// --- add folder popup ---

function showAddFolderPopup() {
  const popup = document.getElementById('addFolderPopup');
  if (!popup) return;
  popup.style.display = 'flex';
  const input = document.getElementById('folderTitleInput');
  if (input) { input.value = ''; setTimeout(() => input.focus(), 50); }
}

function closeAddFolderPopup() {
  const popup = document.getElementById('addFolderPopup');
  if (popup) popup.style.display = 'none';
}

function confirmAddFolder() {
  const input = document.getElementById('folderTitleInput');
  const title = input ? input.value.trim() : '';
  if (!title) { alert('Please enter a folder name.'); return; }
  noteFolders.push({ id: 'nf_' + Date.now(), title, cards: [] });
  renderNoteFolders();
  closeAddFolderPopup();
  autosave();
}

// --- add card popup ---

function showAddNoteCardPopup() {
  const popup = document.getElementById('addNoteCardPopup');
  if (!popup) return;
  popup.style.display = 'flex';
  const input = document.getElementById('noteCardTitleInput');
  if (input) { input.value = ''; setTimeout(() => input.focus(), 50); }
}

function closeAddNoteCardPopup() {
  const popup = document.getElementById('addNoteCardPopup');
  if (popup) popup.style.display = 'none';
}

function confirmAddNoteCard() {
  const input = document.getElementById('noteCardTitleInput');
  const title = input ? input.value.trim() : '';
  if (!title) { alert('Please enter a card title.'); return; }
  const folder = noteFolders.find(f => f.id === notesActiveFolderId);
  if (!folder) return;
  const newCard = { id: 'nc_' + Date.now(), title, body: '' };
  folder.cards.push(newCard);
  renderNoteCards(folder.id);
  closeAddNoteCardPopup();
  autosave();
  // open the editor immediately
  openNoteEditor(folder.id, newCard.id);
}

// --- note editor popup ---

function openNoteEditor(folderId, cardId) {
  const folder = noteFolders.find(f => f.id === folderId);
  if (!folder) return;
  const card = folder.cards.find(c => c.id === cardId);
  if (!card) return;
  notesEditingCardId = cardId;
  notesActiveFolderId = folderId;
  const popup = document.getElementById('noteEditorPopup');
  if (!popup) return;
  document.getElementById('noteEditorTitle').value = card.title || '';
  document.getElementById('noteEditorBody').value = card.body || '';
  popup.style.display = 'flex';
  setTimeout(() => document.getElementById('noteEditorBody').focus(), 50);
}

function closeNoteEditor() {
  const popup = document.getElementById('noteEditorPopup');
  if (popup) popup.style.display = 'none';
  notesEditingCardId = null;
  // refresh card preview
  if (notesActiveFolderId) renderNoteCards(notesActiveFolderId);
}

function onNoteEditorTitleChange() {
  if (!notesEditingCardId || !notesActiveFolderId) return;
  const folder = noteFolders.find(f => f.id === notesActiveFolderId);
  if (!folder) return;
  const card = folder.cards.find(c => c.id === notesEditingCardId);
  if (!card) return;
  card.title = document.getElementById('noteEditorTitle').value;
  autosave();
}

function onNoteEditorBodyChange() {
  if (!notesEditingCardId || !notesActiveFolderId) return;
  const folder = noteFolders.find(f => f.id === notesActiveFolderId);
  if (!folder) return;
  const card = folder.cards.find(c => c.id === notesEditingCardId);
  if (!card) return;
  card.body = document.getElementById('noteEditorBody').value;
  autosave();
}

// --- drag-to-reorder: folders ---

let _nfDragGhost = null, _nfDragSrc = null, _nfDragPlaceholder = null, _nfDragOffX = 0, _nfDragOffY = 0, _nfDragLastX = 0, _nfDragTilt = 0;

function notesFolderDragStart(e) {
  const handle = e.currentTarget;
  const card = handle.closest('.notes-folder-card');
  const grid = document.getElementById('notesFoldersGrid');
  if (!card || !grid) return;
  e.preventDefault();

  const rect = card.getBoundingClientRect();
  const clientX = e.touches ? e.touches[0].clientX : e.clientX;
  const clientY = e.touches ? e.touches[0].clientY : e.clientY;
  _nfDragOffX = clientX - rect.left;
  _nfDragOffY = clientY - rect.top;
  _nfDragLastX = clientX;
  _nfDragTilt = 0;

  _nfDragSrc = card;
  _nfDragGhost = card.cloneNode(true);
  _nfDragGhost.className += ' notes-drag-ghost';
  _nfDragGhost.style.width = rect.width + 'px';
  _nfDragGhost.style.left = (clientX - _nfDragOffX) + 'px';
  _nfDragGhost.style.top = (clientY - _nfDragOffY) + 'px';
  document.body.appendChild(_nfDragGhost);

  _nfDragPlaceholder = document.createElement('div');
  _nfDragPlaceholder.className = 'notes-drag-placeholder';
  _nfDragPlaceholder.style.width = rect.width + 'px';
  _nfDragPlaceholder.style.height = rect.height + 'px';
  card.parentNode.insertBefore(_nfDragPlaceholder, card);
  card.style.display = 'none';

  document.addEventListener('mousemove', notesFolderDragMove);
  document.addEventListener('touchmove', notesFolderDragMove, { passive: false });
  document.addEventListener('mouseup', notesFolderDragEnd);
  document.addEventListener('touchend', notesFolderDragEnd);
}

function notesFolderDragMove(e) {
  if (!_nfDragGhost) return;
  e.preventDefault();
  const clientX = e.touches ? e.touches[0].clientX : e.clientX;
  const clientY = e.touches ? e.touches[0].clientY : e.clientY;
  const dx = clientX - _nfDragLastX;
  _nfDragLastX = clientX;
  _nfDragTilt = Math.max(-12, Math.min(12, _nfDragTilt * 0.88 + dx * 0.25));
  _nfDragGhost.style.left = (clientX - _nfDragOffX) + 'px';
  _nfDragGhost.style.top = (clientY - _nfDragOffY) + 'px';
  _nfDragGhost.style.transform = `rotate(${_nfDragTilt}deg) scale(1.03)`;

  const grid = document.getElementById('notesFoldersGrid');
  if (!grid) return;
  const cards = [...grid.children].filter(c => c !== _nfDragSrc && !c.classList.contains('notes-drag-ghost') && !c.classList.contains('notes-drag-placeholder'));
  let inserted = false;
  for (const c of cards) {
    const r = c.getBoundingClientRect();
    const midY = r.top + r.height / 2;
    const midX = r.left + r.width / 2;
    if (clientY < midY || (Math.abs(clientY - midY) < 10 && clientX < midX)) {
      grid.insertBefore(_nfDragPlaceholder, c);
      inserted = true;
      break;
    }
  }
  if (!inserted) grid.appendChild(_nfDragPlaceholder);
}

function notesFolderDragEnd(e) {
  document.removeEventListener('mousemove', notesFolderDragMove);
  document.removeEventListener('touchmove', notesFolderDragMove);
  document.removeEventListener('mouseup', notesFolderDragEnd);
  document.removeEventListener('touchend', notesFolderDragEnd);

  if (!_nfDragGhost || !_nfDragSrc || !_nfDragPlaceholder) return;

  const grid = document.getElementById('notesFoldersGrid');
  const allChildren = [...grid.children];
  const phPos = allChildren.indexOf(_nfDragPlaceholder);
  const srcFolderId = _nfDragSrc.dataset.folderId;
  const srcIndex = noteFolders.findIndex(f => f.id === srcFolderId);
  let dest = allChildren.filter(c => !c.classList.contains('notes-drag-placeholder') && !c.classList.contains('notes-drag-ghost')).indexOf(
    allChildren.filter(c => !c.classList.contains('notes-drag-placeholder') && !c.classList.contains('notes-drag-ghost'))[phPos] || null
  );
  // simpler: count non-ghost, non-placeholder children before placeholder
  dest = allChildren.slice(0, phPos).filter(c => c !== _nfDragSrc && !c.classList.contains('notes-drag-ghost') && !c.classList.contains('notes-drag-placeholder')).length;

  document.body.removeChild(_nfDragGhost);
  _nfDragPlaceholder.remove();
  _nfDragSrc.style.display = '';
  _nfDragGhost = null; _nfDragSrc = null; _nfDragPlaceholder = null;

  const moved = noteFolders.splice(srcIndex, 1)[0];
  dest = Math.max(0, Math.min(dest, noteFolders.length));
  noteFolders.splice(dest, 0, moved);
  renderNoteFolders();
  autosave();
}

// --- drag-to-reorder: cards ---

let _ncDragGhost = null, _ncDragSrc = null, _ncDragPlaceholder = null, _ncDragOffX = 0, _ncDragOffY = 0, _ncDragLastX = 0, _ncDragTilt = 0;

function notesCardDragStart(e) {
  const handle = e.currentTarget;
  const card = handle.closest('.notes-note-card');
  const grid = document.getElementById('notesCardsGrid');
  if (!card || !grid) return;
  e.preventDefault();

  const rect = card.getBoundingClientRect();
  const clientX = e.touches ? e.touches[0].clientX : e.clientX;
  const clientY = e.touches ? e.touches[0].clientY : e.clientY;
  _ncDragOffX = clientX - rect.left;
  _ncDragOffY = clientY - rect.top;
  _ncDragLastX = clientX;
  _ncDragTilt = 0;

  _ncDragSrc = card;
  _ncDragGhost = card.cloneNode(true);
  _ncDragGhost.className += ' notes-drag-ghost';
  _ncDragGhost.style.width = rect.width + 'px';
  _ncDragGhost.style.left = (clientX - _ncDragOffX) + 'px';
  _ncDragGhost.style.top = (clientY - _ncDragOffY) + 'px';
  document.body.appendChild(_ncDragGhost);

  _ncDragPlaceholder = document.createElement('div');
  _ncDragPlaceholder.className = 'notes-drag-placeholder';
  _ncDragPlaceholder.style.width = rect.width + 'px';
  _ncDragPlaceholder.style.height = rect.height + 'px';
  card.parentNode.insertBefore(_ncDragPlaceholder, card);
  card.style.display = 'none';

  document.addEventListener('mousemove', notesCardDragMove);
  document.addEventListener('touchmove', notesCardDragMove, { passive: false });
  document.addEventListener('mouseup', notesCardDragEnd);
  document.addEventListener('touchend', notesCardDragEnd);
}

function notesCardDragMove(e) {
  if (!_ncDragGhost) return;
  e.preventDefault();
  const clientX = e.touches ? e.touches[0].clientX : e.clientX;
  const clientY = e.touches ? e.touches[0].clientY : e.clientY;
  const dx = clientX - _ncDragLastX;
  _ncDragLastX = clientX;
  _ncDragTilt = Math.max(-12, Math.min(12, _ncDragTilt * 0.88 + dx * 0.25));
  _ncDragGhost.style.left = (clientX - _ncDragOffX) + 'px';
  _ncDragGhost.style.top = (clientY - _ncDragOffY) + 'px';
  _ncDragGhost.style.transform = `rotate(${_ncDragTilt}deg) scale(1.03)`;

  const grid = document.getElementById('notesCardsGrid');
  if (!grid) return;
  const cards = [...grid.children].filter(c => c !== _ncDragSrc && !c.classList.contains('notes-drag-ghost') && !c.classList.contains('notes-drag-placeholder'));
  let inserted = false;
  for (const c of cards) {
    const r = c.getBoundingClientRect();
    const midY = r.top + r.height / 2;
    const midX = r.left + r.width / 2;
    if (clientY < midY || (Math.abs(clientY - midY) < 10 && clientX < midX)) {
      grid.insertBefore(_ncDragPlaceholder, c);
      inserted = true;
      break;
    }
  }
  if (!inserted) grid.appendChild(_ncDragPlaceholder);
}

function notesCardDragEnd(e) {
  document.removeEventListener('mousemove', notesCardDragMove);
  document.removeEventListener('touchmove', notesCardDragMove);
  document.removeEventListener('mouseup', notesCardDragEnd);
  document.removeEventListener('touchend', notesCardDragEnd);

  if (!_ncDragGhost || !_ncDragSrc || !_ncDragPlaceholder) return;

  const grid = document.getElementById('notesCardsGrid');
  const allChildren = [...grid.children];
  const phPos = allChildren.indexOf(_ncDragPlaceholder);
  const srcCardId = _ncDragSrc.dataset.cardId;
  const folder = noteFolders.find(f => f.id === notesActiveFolderId);
  if (!folder) return;
  const srcIndex = folder.cards.findIndex(c => c.id === srcCardId);
  const dest = allChildren.slice(0, phPos).filter(c => c !== _ncDragSrc && !c.classList.contains('notes-drag-ghost') && !c.classList.contains('notes-drag-placeholder')).length;

  document.body.removeChild(_ncDragGhost);
  _ncDragPlaceholder.remove();
  _ncDragSrc.style.display = '';
  _ncDragGhost = null; _ncDragSrc = null; _ncDragPlaceholder = null;

  const moved = folder.cards.splice(srcIndex, 1)[0];
  folder.cards.splice(Math.max(0, Math.min(dest, folder.cards.length)), 0, moved);
  renderNoteCards(folder.id);
  autosave();
}

// --- init notes page ---
function initNotesPage() {
  const folderView = document.getElementById('notesFolderView');
  if (!folderView) return;
  notesReorderMode = false;
  notesCardReorderMode = false;
  if (noteFolders.length === 0) {
    noteFolders = NOTES_DEFAULT_FOLDERS.map(f => ({ ...f, cards: f.cards.map(c => ({ ...c })) }));
  }
  // show folder view, hide card view
  folderView.style.display = '';
  const cardView = document.getElementById('notesCardView');
  if (cardView) cardView.style.display = 'none';
  renderNoteFolders();
}

// ============================================================
function makeBgFieldEl(field, index) {
  const wrap = document.createElement('div');
  wrap.className = 'section bg-field-wrap';
  wrap.dataset.fieldId = field.id;
  wrap.dataset.index = index;

  const header = document.createElement('div');
  header.className = 'bg-field-header';

  const title = document.createElement('h3');
  title.textContent = field.title;
  header.appendChild(title);

  const controls = document.createElement('div');
  controls.className = 'bg-reorder-controls';
  controls.style.display = bgReorderMode ? 'flex' : 'none';

  const upBtn = document.createElement('button');
  upBtn.className = 'bg-arrow-btn';
  upBtn.textContent = '▲';
  upBtn.title = 'Move up';
  upBtn.disabled = index === 0;
  upBtn.onclick = () => moveBgField(index, -1);

  const downBtn = document.createElement('button');
  downBtn.className = 'bg-arrow-btn';
  downBtn.textContent = '▼';
  downBtn.title = 'Move down';
  downBtn.disabled = index === bgCustomFields.length - 1;
  downBtn.onclick = () => moveBgField(index, 1);

  controls.appendChild(upBtn);
  controls.appendChild(downBtn);
  header.appendChild(controls);

  // Delete button sits outside the reorder controls so it's always visible
  if (!field.isDefault) {
    const removeBtn = document.createElement('button');
    removeBtn.className = 'bg-remove-btn';
    removeBtn.dataset.fieldId = field.id;
    removeBtn.onclick = () => handleBgFieldDelete(field.id, false, removeBtn);
    setBgDeleteBtnAppearance(removeBtn, bgDeleteState[field.id] || 0, false);
    header.appendChild(removeBtn);
  }

  wrap.appendChild(header);

  if (bgReorderMode) {
    const handle = document.createElement('div');
    handle.className = 'bg-drag-handle';
    handle.textContent = '⠿';
    handle.title = 'Drag to reorder';
    handle.addEventListener('pointerdown', onBgPointerDown);
    wrap.appendChild(handle);
    wrap.classList.add('bg-draggable');
  }

  const ta = document.createElement('textarea');
  ta.className = 'basic-textarea';
  ta.id = field.id;
  ta.placeholder = field.placeholder || '';
  ta.addEventListener('input', () => {
    autosave();
    updateBgFieldOverflow(ta, overflowHint);
  });
  ta.addEventListener('click', () => {
    if (ta.value.length > 450) openNotesEditorPopup(ta);
  });
  wrap.appendChild(ta);

  // Overflow hint shown when content exceeds 450 chars
  const overflowHint = document.createElement('div');
  overflowHint.className = 'bg-overflow-hint';
  overflowHint.textContent = 'Tap to expand full text';
  overflowHint.style.display = 'none';
  overflowHint.addEventListener('click', () => openNotesEditorPopup(ta));
  wrap.appendChild(overflowHint);

  return wrap;
}

function updateBgFieldOverflow(ta, hint) {
  if (ta.value.length > 450) {
    hint.style.display = 'block';
    ta.classList.add('bg-textarea-capped');
  } else {
    hint.style.display = 'none';
    ta.classList.remove('bg-textarea-capped');
  }
}

function setBgDeleteBtnAppearance(btn, state, isDefault) {
  if (state === 0) {
    btn.textContent = '✕';
    btn.title = isDefault ? 'Hide this box' : 'Remove box';
    btn.classList.remove('bg-delete-warn', 'bg-delete-final', 'bg-delete-counting');
  } else if (state === 1) {
    btn.textContent = 'Sure?';
    btn.title = 'Click again to start deletion countdown';
    btn.classList.add('bg-delete-warn');
    btn.classList.remove('bg-delete-final', 'bg-delete-counting');
  } else if (state === 2) {
    btn.classList.add('bg-delete-counting');
    btn.classList.remove('bg-delete-warn', 'bg-delete-final');
  } else if (state === 3) {
    btn.textContent = isDefault ? 'Hide it' : 'Remove it';
    btn.title = 'Final confirmation — click to remove';
    btn.classList.add('bg-delete-final');
    btn.classList.remove('bg-delete-warn', 'bg-delete-counting');
  }
}

function handleBgFieldDelete(fieldId, isDefault, btn) {
  const state = bgDeleteState[fieldId] || 0;

  if (state === 0) {
    // Step 1 — first click, ask if sure
    bgDeleteState[fieldId] = 1;
    setBgDeleteBtnAppearance(btn, 1, isDefault);
    // Auto-reset if user walks away
    clearTimeout(bgDeleteTimer);
    bgDeleteTimer = setTimeout(() => resetBgDeleteState(fieldId, btn, isDefault), 5000);
    return;
  }

  if (state === 1) {
    // Step 2 — countdown
    clearTimeout(bgDeleteTimer);
    bgDeleteState[fieldId] = 2;
    btn.disabled = true;
    let secs = 3;
    btn.textContent = `Wait ${secs}s…`;
    setBgDeleteBtnAppearance(btn, 2, isDefault);
    btn.textContent = `Wait ${secs}s…`;

    const tick = setInterval(() => {
      secs--;
      if (secs > 0) {
        btn.textContent = `Wait ${secs}s…`;
      } else {
        clearInterval(tick);
        bgDeleteState[fieldId] = 3;
        btn.disabled = false;
        setBgDeleteBtnAppearance(btn, 3, isDefault);
      }
    }, 1000);
    return;
  }

  if (state === 3) {
    // Final — actually remove
    resetBgDeleteState(fieldId, btn, isDefault);
    const vals = captureBgFieldValues();
    if (!isDefault) delete vals[fieldId];
    bgCustomFields = bgCustomFields.filter(f => f.id !== fieldId);
    delete bgDeleteState[fieldId];
    renderBgFields();
    applyBgFieldValues(vals);
    autosave();
  }
}

function resetBgDeleteState(fieldId, btn, isDefault) {
  bgDeleteState[fieldId] = 0;
  if (btn) setBgDeleteBtnAppearance(btn, 0, isDefault);
}

function renderBgFields() {
  const grid = document.getElementById('bgCustomFieldsGrid');
  if (!grid) return;
  const vals = captureBgFieldValues();
  grid.innerHTML = '';

  bgCustomFields.forEach((field, index) => {
    grid.appendChild(makeBgFieldEl(field, index));
  });

  applyBgFieldValues(vals);
}

function toggleBgReorderMode() {
  bgReorderMode = !bgReorderMode;
  const btn = document.getElementById('bgReorderToggle');
  if (btn) {
    btn.classList.toggle('active', bgReorderMode);
    btn.textContent = bgReorderMode ? 'Done Reordering' : 'Reorder Mode';
  }
  renderBgFields();
}

function moveBgField(index, dir) {
  const newIndex = index + dir;
  if (newIndex < 0 || newIndex >= bgCustomFields.length) return;
  const vals = captureBgFieldValues();
  const tmp = bgCustomFields[index];
  bgCustomFields[index] = bgCustomFields[newIndex];
  bgCustomFields[newIndex] = tmp;
  renderBgFields();
  applyBgFieldValues(vals);
  // Brief highlight on the moved card so user sees where it landed
  const grid = document.getElementById('bgCustomFieldsGrid');
  const landed = grid ? [...grid.children][newIndex] : null;
  if (landed) {
    landed.classList.add('bg-just-moved');
    setTimeout(() => landed.classList.remove('bg-just-moved'), 400);
  }
  autosave();
}

function showAddBgFieldPopup() {
  const popup = document.getElementById('addBgFieldPopup');
  if (!popup) return;
  document.getElementById('bgFieldTitleInput').value = '';
  document.getElementById('bgFieldPlaceholderInput').value = '';
  popup.style.display = 'flex';
  document.getElementById('bgFieldTitleInput').focus();
}

function closeBgFieldPopup() {
  const popup = document.getElementById('addBgFieldPopup');
  if (popup) popup.style.display = 'none';
}

function confirmAddBgField() {
  const title = document.getElementById('bgFieldTitleInput').value.trim();
  if (!title) { alert('Please enter a title.'); return; }
  const placeholder = document.getElementById('bgFieldPlaceholderInput').value.trim();
  const id = 'bgcustom_' + Date.now();
  const vals = captureBgFieldValues();
  bgCustomFields.push({ id, title, placeholder, isDefault: false });
  renderBgFields();
  applyBgFieldValues(vals);
  closeBgFieldPopup();
  autosave();
}

function captureBgFieldValues() {
  const out = {};
  bgCustomFields.forEach(f => {
    const el = document.getElementById(f.id);
    if (el) out[f.id] = el.value;
  });
  return out;
}

function applyBgFieldValues(vals) {
  Object.entries(vals).forEach(([id, v]) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.value = v;
    // Sync overflow hint state after value is set
    const hint = el.parentNode ? el.parentNode.querySelector('.bg-overflow-hint') : null;
    if (hint) updateBgFieldOverflow(el, hint);
  });
}

// ---- Pointer-based drag (works on mouse + touch + pen) ----
let bgDrag = null;  // { srcIndex, ghost, placeholder, offsetX, offsetY }

function onBgPointerDown(e) {
  if (!bgReorderMode) return;
  e.preventDefault();
  const handle = e.currentTarget;
  const card = handle.closest('.bg-field-wrap');
  const grid = document.getElementById('bgCustomFieldsGrid');
  if (!card || !grid) return;

  const cards = [...grid.children].filter(c => c.classList.contains('bg-field-wrap'));
  const srcIndex = cards.indexOf(card);
  if (srcIndex === -1) return;

  const rect = card.getBoundingClientRect();
  const clientX = e.touches ? e.touches[0].clientX : e.clientX;
  const clientY = e.touches ? e.touches[0].clientY : e.clientY;

  // Ghost: visual clone that follows the pointer
  const ghost = card.cloneNode(true);
  ghost.classList.add('bg-ghost');
  ghost.style.width  = rect.width  + 'px';
  ghost.style.height = rect.height + 'px';
  ghost.style.left   = rect.left + 'px';
  ghost.style.top    = rect.top  + 'px';
  document.body.appendChild(ghost);

  // Placeholder: empty slot that stays in grid
  const placeholder = document.createElement('div');
  placeholder.className = 'bg-drop-placeholder';
  placeholder.style.height = rect.height + 'px';
  grid.insertBefore(placeholder, card);
  card.classList.add('bg-dragging');

  bgDrag = {
    srcIndex,
    card,
    ghost,
    placeholder,
    offsetX: clientX - rect.left,
    offsetY: clientY - rect.top,
    lastX: clientX,
    tilt: 0,
  };

  document.addEventListener('pointermove', onBgPointerMove, { passive: false });
  document.addEventListener('pointerup',   onBgPointerUp);
  document.addEventListener('touchmove',   e => e.preventDefault(), { passive: false });
}

function onBgPointerMove(e) {
  if (!bgDrag) return;
  e.preventDefault();
  const clientX = e.touches ? e.touches[0].clientX : e.clientX;
  const clientY = e.touches ? e.touches[0].clientY : e.clientY;

  // Tilt based on horizontal velocity — clamp to ±15 deg, decay toward 0
  const dx = clientX - bgDrag.lastX;
  bgDrag.lastX = clientX;
  bgDrag.tilt = Math.max(-12, Math.min(12, bgDrag.tilt * 0.88 + dx * 0.25));

  // Move ghost and apply tilt
  bgDrag.ghost.style.left      = (clientX - bgDrag.offsetX) + 'px';
  bgDrag.ghost.style.top       = (clientY - bgDrag.offsetY) + 'px';
  bgDrag.ghost.style.transform = `rotate(${bgDrag.tilt}deg) scale(1.03)`;

  // Find which card the centre of the ghost is over and move placeholder
  const grid = document.getElementById('bgCustomFieldsGrid');
  if (!grid) return;
  const cards = [...grid.children].filter(c =>
    c.classList.contains('bg-field-wrap') && !c.classList.contains('bg-dragging')
  );

  let inserted = false;
  for (const c of cards) {
    const r = c.getBoundingClientRect();
    const mid = r.top + r.height / 2;
    if (clientY < mid) {
      grid.insertBefore(bgDrag.placeholder, c);
      inserted = true;
      break;
    }
  }
  if (!inserted) grid.appendChild(bgDrag.placeholder);
}

function onBgPointerUp(e) {
  document.removeEventListener('pointermove', onBgPointerMove);
  document.removeEventListener('pointerup',   onBgPointerUp);

  if (!bgDrag) return;
  const { srcIndex, card, ghost, placeholder } = bgDrag;
  bgDrag = null;

  // Find destination: index of placeholder among field-wrap cards
  const grid = document.getElementById('bgCustomFieldsGrid');
  const allChildren = [...grid.children];
  const phPos = allChildren.indexOf(placeholder);

  // Count only field-wrap cards before placeholder (excluding the dragging card)
  let dest = 0;
  for (let i = 0; i < phPos; i++) {
    const ch = allChildren[i];
    if (ch.classList.contains('bg-field-wrap') && !ch.classList.contains('bg-dragging')) dest++;
  }

  // Clean up DOM
  ghost.remove();
  placeholder.remove();
  card.classList.remove('bg-dragging');

  if (dest === srcIndex) {
    renderBgFields(); // just restore
    return;
  }

  const vals = captureBgFieldValues();
  const moved = bgCustomFields.splice(srcIndex, 1)[0];
  dest = Math.max(0, Math.min(dest, bgCustomFields.length));
  bgCustomFields.splice(dest, 0, moved);
  renderBgFields();
  applyBgFieldValues(vals);

  // Highlight landed card
  const landed = [...grid.children][dest];
  if (landed) {
    landed.classList.add('bg-just-moved');
    setTimeout(() => landed.classList.remove('bg-just-moved'), 400);
  }
  autosave();
}

window.addEventListener('resize', refreshAllNoteBoxes);
window.addEventListener('orientationchange', refreshAllNoteBoxes);

let rollingBannerLastIndex = -1;
let bannerFirstShown = false;

function getRollingBannerMessages() {
  const external = window.BANNER_MESSAGES;
  if (Array.isArray(external) && external.length > 0) {
    return external.filter(msg => typeof msg === 'string' && msg.trim().length > 0);
  }

  async function handleSettingsSuggestionSubmit(event) {
    event.preventDefault();

    const suggestionType = document.getElementById('settingsSuggestionType')?.value;
    const suggestionText = document.getElementById('settingsSuggestionText')?.value;
    const statusDiv = document.getElementById('settingsSuggestionStatus');
    const setStatus = (message, type) => {
      if (!statusDiv) return;
      statusDiv.textContent = message;
      statusDiv.className = `status-message ${type}`;
      statusDiv.style.display = 'block';
      setTimeout(() => {
        statusDiv.style.display = 'none';
      }, 5000);
    };

    if (!suggestionType || !suggestionText || !suggestionText.trim()) {
      setStatus('Please fill in all fields', 'error');
      return;
    }

    const userEmail = window.currentUser ? window.currentUser.email : 'anonymous@example.com';
    setStatus('Sending suggestion...', 'info');
    try {
      await sendSuggestionEmail(userEmail, suggestionType, suggestionText);
      setStatus('Suggestion sent successfully! Thank you for your feedback.', 'success');
      const typeEl = document.getElementById('settingsSuggestionType');
      const textEl = document.getElementById('settingsSuggestionText');
      if (typeEl) typeEl.value = '';
      if (textEl) textEl.value = '';
    } catch (error) {
      console.error('Error sending settings suggestion:', error);
      setStatus('Failed to send suggestion. Please try again later.', 'error');
    }
  }

  window.handleSettingsSuggestionSubmit = handleSettingsSuggestionSubmit;
  return ['This sheet autosaves character data to your browser. Use Export to back up your character.'];
}

function rollBannerMessage() {
  const textEl = document.getElementById('rollingBannerText');
  const messages = getRollingBannerMessages();
  if (!textEl || messages.length === 0) return;

  if (!bannerFirstShown) {
    bannerFirstShown = true;
    const firstMsg = typeof window.BANNER_FIRST_MESSAGE === 'string' && window.BANNER_FIRST_MESSAGE.trim()
      ? window.BANNER_FIRST_MESSAGE.trim()
      : null;
    if (firstMsg) {
      textEl.textContent = firstMsg;
      return;
    }
  }

  const dynamicMessage = Math.random() < 0.35 ? buildCurrencyWealthBannerMessage() : null;
  let nextMessage = dynamicMessage;

  if (!nextMessage) {
    let nextIndex = Math.floor(Math.random() * messages.length);
    if (messages.length > 1 && nextIndex === rollingBannerLastIndex) {
      nextIndex = (nextIndex + 1) % messages.length;
    }
    rollingBannerLastIndex = nextIndex;
    nextMessage = messages[nextIndex];
  }

  textEl.classList.add('is-fading');
  setTimeout(() => {
    textEl.textContent = nextMessage;
    textEl.classList.remove('is-fading');
  }, 140);
}

// ========== CHARACTER MANAGEMENT ==========
function showHomePage() {
  const homePage = document.getElementById('home');
  document.querySelectorAll('.page').forEach(page => {
    page.classList.remove('active');
    page.style.display = 'none';
    page.style.opacity = '0';
    page.style.transform = 'translateY(10px)';
  });

  if (homePage) {
    homePage.style.display = 'block';
    requestAnimationFrame(() => {
      homePage.classList.add('active');
      homePage.style.opacity = '1';
      homePage.style.transform = 'translateY(0)';
    });
  }

  document.querySelectorAll('.tab').forEach(tab => tab.classList.remove('active'));
  window.scrollTo({ top: 0, left: 0 });
}

function createNewCharacter() {
  const charName = document.getElementById('newCharName').value.trim();
  const createStatus = document.getElementById('createStatus');

  if (!charName) {
    if (createStatus) {
      createStatus.textContent = 'Please enter a character name';
      createStatus.className = 'status-message error';
      createStatus.style.display = 'block';
      setTimeout(() => {
        createStatus.style.display = 'none';
      }, 3000);
    }
    return;
  }

  try {
    const nowIso = new Date().toISOString();
    const newChar = {
      id: generateCharacterId(),
      name: charName,
      createdAt: nowIso,
      updatedAt: nowIso,
      data: {
        characterInfo: { name: charName },
        page1: {},
        page2: {},
        page3: {},
        page4: {},
        page6: {},
        weapons: [],
        equipment: []
      }
    };

    let characters = getStoredJSON('dndCharacters', []);
    characters.push(newChar);
    localStorage.setItem('dndCharacters', JSON.stringify(characters));
    if (window.currentUser && !window.__adminPreviewActive) {
      syncToCloud(true);
    }

    loadCharacterList();
    loadSelectedCharacter(newChar.id);
    document.getElementById('newCharName').value = '';

    if (createStatus) {
      createStatus.textContent = `Character "${charName}" created successfully!`;
      createStatus.className = 'status-message success';
      createStatus.style.display = 'block';
      setTimeout(() => {
        createStatus.style.display = 'none';
      }, 3000);
    }
  } catch (error) {
    console.error('Error creating character:', error);
    if (createStatus) {
      createStatus.textContent = 'Error creating character. Please try again.';
      createStatus.className = 'status-message error';
      createStatus.style.display = 'block';
      setTimeout(() => {
        createStatus.style.display = 'none';
      }, 3000);
    }
  }
}

function loadCharacterList() {
  const characters = getStoredJSON('dndCharacters', []);
  const favoritesList = document.getElementById('favoriteCharacterList');
  const loadList = document.getElementById('characterList');
  if (!loadList) return;
  if (favoritesList) favoritesList.innerHTML = '';
  loadList.innerHTML = '';

  if (!characters.some(char => char.id === currentCharacter)) {
    currentCharacter = null;
  }

  const renderEmpty = (container, message) => {
    if (!container) return;
    const empty = document.createElement('div');
    empty.className = 'character-list-empty';
    empty.textContent = message;
    container.appendChild(empty);
    container.setAttribute('aria-disabled', 'true');
  };

  if (characters.length === 0) {
    renderEmpty(favoritesList, 'No favourite characters');
    renderEmpty(loadList, 'No characters found');
    return;
  }

  if (favoritesList) favoritesList.removeAttribute('aria-disabled');
  loadList.removeAttribute('aria-disabled');
  const { favorites, others } = sortCharactersForDisplay(characters);
  const renderItem = (container, char) => {
    if (!container) return;
    const item = document.createElement('div');
    item.className = `character-list-item${char.id === currentCharacter ? ' selected' : ''}`;
    item.dataset.characterId = char.id;
    item.tabIndex = 0;
    item.setAttribute('role', 'option');
    item.setAttribute('aria-selected', char.id === currentCharacter ? 'true' : 'false');
    item.addEventListener('click', () => loadSelectedCharacter(char.id));
    item.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        loadSelectedCharacter(char.id);
      }
    });

    const name = document.createElement('span');
    name.className = 'character-list-name';
    name.textContent = char.name || 'Unnamed';
    item.appendChild(name);

    const actions = document.createElement('div');
    actions.className = 'character-item-actions';

    const star = document.createElement('button');
    star.type = 'button';
    star.className = `character-favorite-btn${isFavoriteCharacter(char.id) ? ' is-favorite' : ''}`;
    star.textContent = isFavoriteCharacter(char.id) ? '★' : '☆';
    star.title = isFavoriteCharacter(char.id) ? 'Remove from favourites' : 'Add to favourites';
    star.setAttribute('aria-label', star.title);
    star.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      toggleFavoriteCharacter(char.id);
    });
    actions.appendChild(star);

    const del = document.createElement('button');
    del.type = 'button';
    del.className = 'character-delete-btn';
    del.textContent = 'Delete';
    del.title = `Delete ${char.name || 'character'}`;
    del.setAttribute('aria-label', del.title);
    del.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      initiateDelete(char.id);
    });
    actions.appendChild(del);

    item.appendChild(actions);

    container.appendChild(item);
  };

  if (favorites.length === 0) {
    renderEmpty(favoritesList, 'No favourite characters');
  } else {
    favorites.forEach(char => renderItem(favoritesList, char));
  }

  if (others.length === 0) {
    renderEmpty(loadList, 'All characters are in favourites');
  } else {
    others.forEach(char => renderItem(loadList, char));
  }
}

// Clear all form fields to prevent old character data from persisting
function clearAllFormFields() {
  // Clear character info fields
  const charInfoFields = ['char_name', 'char_race', 'char_background', 'char_class', 'char_subclass', 'char_level'];
  charInfoFields.forEach(id => {
    const element = document.getElementById(id);
    if (element) element.value = '';
  });

  // Clear ability scores and bonuses
  const abilityFields = ['str', 'dex', 'con', 'int', 'wis', 'cha'];
  abilityFields.forEach(ability => {
    const scoreElement = document.getElementById(ability);
    const bonusElement = document.getElementById(`${ability}_bonus`);
    const saveElement = document.getElementById(`${ability}_save`);
    const profElement = document.getElementById(`${ability}_save_prof`);

    if (scoreElement) scoreElement.value = '';
    if (bonusElement) bonusElement.value = '';
    if (saveElement) saveElement.value = '';
    if (profElement) profElement.checked = false;
  });

  // Clear combat stats
  const combatFields = ['ac', 'initiative', 'speed', 'prof_bonus'];
  combatFields.forEach(id => {
    const element = document.getElementById(id);
    if (element) element.value = '';
  });

  // Clear health fields
  const healthFields = ['max_hp', 'curr_hp', 'hit_dice_spend', 'con_modifier', 'hit_die_size', 'potion_type'];
  healthFields.forEach(id => {
    const element = document.getElementById(id);
    if (element) element.value = '';
  });

  // Clear temp HP display
  const tempHPDisplay = document.getElementById('temp_hp_display');
  if (tempHPDisplay) {
    tempHPDisplay.classList.remove('show');
    const tempHPText = document.getElementById('temp_hp_text');
    if (tempHPText) tempHPText.textContent = '';
  }

  // Clear skills
  const skillNames = ['acrobatics', 'animal_handling', 'arcana', 'athletics', 'deception', 'history',
                     'insight', 'intimidation', 'investigation', 'medicine', 'nature', 'perception',
                     'performance', 'persuasion', 'religion', 'sleight_of_hand', 'stealth', 'survival'];

  skillNames.forEach(skill => {
    const profElement = document.getElementById(`prof_${skill}`);
    const adjElement = document.getElementById(`adj_${skill}`);
    const bonusElement = document.getElementById(`bonus_${skill}`);

    if (profElement) profElement.checked = false;
    if (adjElement) adjElement.value = '+0';
    if (bonusElement) bonusElement.value = '';
  });

  // Clear death saves
  for (let i = 1; i <= 3; i++) {
    const successElement = document.getElementById(`death_save_success_${i}`);
    const failureElement = document.getElementById(`death_save_failure_${i}`);
    const successCheckbox = document.getElementById(`death_save_success_${i}_checkbox`);
    const failureCheckbox = document.getElementById(`death_save_failure_${i}_checkbox`);

    if (successElement) successElement.classList.remove('checked');
    if (failureElement) failureElement.classList.remove('checked');
    if (successCheckbox) successCheckbox.checked = false;
    if (failureCheckbox) failureCheckbox.checked = false;
  }

  // Clear action tracker
  const actionFields = ['action_counter', 'bonus_action_counter'];
  actionFields.forEach(id => {
    const element = document.getElementById(id);
    if (element) element.value = '';
  });

  const actionTicks = ['action_tick', 'bonus_action_tick'];
  actionTicks.forEach(id => {
    const element = document.getElementById(id);
    if (element) element.checked = false;
  });

  // Clear background fields — reset to defaults and blank values
  bgCustomFields = BG_DEFAULT_FIELDS.map(f => ({ ...f }));
  bgReorderMode = false;
  const bgToggle = document.getElementById('bgReorderToggle');
  if (bgToggle) { bgToggle.classList.remove('active'); bgToggle.textContent = 'Reorder Mode'; }
  renderBgFields();
  ['char_backstory', 'personality_traits', 'traits_ideals', 'traits_bonds',
   'traits_flaws', 'traits_allies', 'traits_appearance'].forEach(id => {
    const element = document.getElementById(id);
    if (element) element.value = '';
  });

  // Clear portrait
  const portraitPreview = document.getElementById('portraitPreview');
  if (portraitPreview) {
    portraitPreview.innerHTML = '<span style="color: #666;">No image</span>';
  }

  // Clear spell fields
  const spellFields = ['spell_notes', 'spellcasting_ability', 'spell_save_dc', 'spell_attack_bonus',
                      'caster_type', 'spells_prepared'];
  spellFields.forEach(id => {
    const element = document.getElementById(id);
    if (element) element.value = '';
  });

  // Clear inventory fields
  const inventoryFields = ['currency_cp', 'currency_sp', 'currency_ep', 'gold_field', 'max_weight_capacity'];
  inventoryFields.forEach(id => {
    const element = document.getElementById(id);
    if (element) element.value = '';
  });
  const customCurrencyRows = document.getElementById('custom_currency_rows');
  if (customCurrencyRows) customCurrencyRows.innerHTML = '';

  // Clear notes (folder+card system)
  noteFolders = [];
  notesActiveFolderId = null;
  notesEditingCardId = null;
  notesReorderMode = false;
  notesCardReorderMode = false;
  initNotesPage();

  // Clear actions and features
  const actionsNotes = document.getElementById('actions_notes');
  if (actionsNotes) actionsNotes.value = '';

  // Clear inventory data
  const proficienciesTraining = document.getElementById('proficiencies_training');
  if (proficienciesTraining) proficienciesTraining.value = '';

  const statsQuickNotes = document.getElementById('stats_quick_notes');
  if (statsQuickNotes) statsQuickNotes.value = '';

  // Clear weapons and equipment data
  weaponsData = [];
  equipmentData = [];
  updateWeaponsPreview();
  updateEquipmentPreviews();

  // Clear conditions
  const conditionsContainer = document.getElementById('conditions_container');
  if (conditionsContainer) {
    conditionsContainer.innerHTML = '';
  }

  // Clear inventory containers
  const extraContainers = document.getElementById('extra_containers');
  if (extraContainers) {
    extraContainers.innerHTML = '';
  }

  // Clear main inventory table
  const inventoryTable = document.getElementById('inventory_table');
  if (inventoryTable) {
    const tbody = inventoryTable.querySelector('tbody');
    if (tbody) tbody.innerHTML = '';
  }

  // Reset inventory data
  inventoryData = {
    equipment: [],
    mainInventory: [],
    storageContainers: [],
    maxWeightCapacity: 0
  };

  // Clear actions data
  actionsData = {
    actions: []
  };
  displayActions('action');
  updateFavorites();

  // Clear spells data
  spellsData = {
    cantrips: [],
    spells: []
  };
  favoritesData = {
    cantrips: [],
    spells: []
  };
  manualSpellSlots = [];
  manualSpellSlotsUsed = {};
  customResources = [];
  customResourcesUsed = {};

  // Update spell system
  updateSpellSlots();
  updateCustomResources();
  renderSpells();
}

function loadSelectedCharacter(charId) {
  if (!charId) return;
  const characters = getStoredJSON('dndCharacters', []);
  if (!characters.some(char => char.id === charId)) return;

  rememberSelectedCharacter(charId);
  deleteTargetCharacterId = null;
  currentCharacter = charId;
  loadCharacterList();

  resetDeleteUI();
  loadData();
  document.querySelector('.tab[data-tab="page1"]').click();

  if (typeof onActiveCharacterChanged === 'function') {
    onActiveCharacterChanged(charId);
  }
}

function initiateDelete(charId) {
  const btn = document.getElementById('deleteCharacterActionBtn');
  const message = document.getElementById('deleteCharacterMessage');
  const characters = getStoredJSON('dndCharacters', []);
  const targetId =
    charId ||
    deleteTargetCharacterId ||
    (characters.some(char => char.id === currentCharacter) ? currentCharacter : null);
  const target = targetId ? characters.find(char => char.id === targetId) : null;

  if (!btn || !message) return;
  if (!targetId || !target) {
    alert('No character selected to delete');
    resetDeleteUI();
    return;
  }

  // If a countdown is already running, do nothing
  if (btn.dataset.counting === '1') return;

  if (deleteTargetCharacterId && deleteTargetCharacterId !== targetId) {
    resetDeleteUI();
  }
  deleteTargetCharacterId = targetId;
  showPopup('deleteCharacterPopup');

  if (deleteState === 0) {
    // Step 1: first click — show confirm button
    deleteState = 1;
    message.textContent = `Delete "${target.name || 'Character'}"? This cannot be undone.`;
    btn.textContent = 'Confirm Delete';
    btn.classList.add('danger');
    btn.classList.remove('warning');
    btn.disabled = false;
  } else if (deleteState === 1) {
    // Step 2: confirm clicked — countdown, then enable final delete button
    deleteState = 2;
    btn.dataset.counting = '1';
    btn.disabled = true;

    let secs = 3;
    btn.textContent = `Wait ${secs}s...`;
    message.textContent = `Are you really sure? You can still cancel.`;

    const tick = setInterval(() => {
      secs--;
      if (secs > 0) {
        btn.textContent = `Wait ${secs}s...`;
      } else {
        clearInterval(tick);
        delete btn.dataset.counting;
        deleteState = 3;
        btn.disabled = false;
        btn.textContent = `Delete Forever`;
        message.textContent = `Last chance — click to permanently delete "${target.name || 'Character'}".`;
      }
    }, 1000);

  } else if (deleteState === 3) {
    // Step 3: final button clicked after countdown — actually delete
    const finalChars = getStoredJSON('dndCharacters', []);
    const updatedChars = finalChars.filter(c => c.id !== deleteTargetCharacterId);
    localStorage.setItem('dndCharacters', JSON.stringify(updatedChars));
    setFavoriteCharacterIds(getFavoriteCharacterIds().filter(id => id !== deleteTargetCharacterId));

    closePopup('deleteCharacterPopup');
    resetDeleteUI();

    if (updatedChars.length > 0) {
      currentCharacter = updatedChars[0].id;
      rememberSelectedCharacter(currentCharacter);
      loadCharacterList();
      loadData();
      window.setupSkillCalculationFields();
      window.enforceAutoMathNumericInputs();
      document.querySelector('.tab[data-tab="page1"]').click();
    } else {
      currentCharacter = null;
      clearRememberedSelectedCharacter();
      loadCharacterList();
      showHomePage();
    }
  }
}

function resetDeleteUI() {
  const btn = document.getElementById('deleteCharacterActionBtn');
  const message = document.getElementById('deleteCharacterMessage');

  deleteState = 0;
  deleteTargetCharacterId = null;
  if (!btn || !message) return;
  message.textContent = 'Are you sure you want to delete this character?';
  btn.textContent = 'Delete Character';
  btn.classList.remove('warning', 'danger');
  btn.disabled = false;
  delete btn.dataset.counting;
}


function autosave() {
  try {
  if (typeof window.presenceHeartbeat === 'function') {
    window.presenceHeartbeat();
  }
  // Ensure a character target exists
  if (!currentCharacter) {
    let characters = getStoredJSON('dndCharacters', []);
    if (characters.length === 0) {
      const defaultChar = {
        id: generateCharacterId(),
        name: 'New Character',
        createdAt: new Date().toISOString(),
        data: { characterInfo: { name: 'New Character' }, page1: {}, page2: {}, page3: {}, page4: {}, page6: {}, weapons: [], equipment: [] }
      };
      characters = [defaultChar];
      localStorage.setItem('dndCharacters', JSON.stringify(characters));
      currentCharacter = defaultChar.id;
      rememberSelectedCharacter(currentCharacter);
      loadCharacterList();
    } else {
      currentCharacter = characters[0].id;
      rememberSelectedCharacter(currentCharacter);
    }
  }

  const characters = getStoredJSON('dndCharacters', []);
  const charIndex = characters.findIndex(char => char.id === currentCharacter);
  if (charIndex === -1) return;

  // Helper: read element value safely; returns null if element missing (signals "not in DOM")
  const el = id => document.getElementById(id);
  const val = id => { const e = el(id); return e ? e.value : null; };
  const chk = id => { const e = el(id); return e ? e.checked : null; };

  // Start from existing saved data so pages not currently in DOM are preserved
  const existing = characters[charIndex].data || {};

  // --- characterInfo (always in chrome/header, should always exist) ---
  const charNameVal = val('char_name');
  const characterInfo = charNameVal !== null ? {
    name: charNameVal,
    race: val('char_race'),
    background: val('char_background'),
    class: val('char_class'),
    subclass: val('char_subclass'),
    level: val('char_level')
  } : existing.characterInfo;

  // --- actionTracker ---
  const actionTrackerInDom = el('action_counter');
  const actionTracker = actionTrackerInDom ? {
    actions: val('action_counter'),
    actionUsed: chk('action_tick'),
    bonusActions: val('bonus_action_counter'),
    bonusActionUsed: chk('bonus_action_tick')
  } : existing.actionTracker;

  // --- page1 (stats page) ---
  const page1InDom = el('str');
  const page1 = page1InDom ? {
    abilities: ['str','dex','con','int','wis','cha'].reduce((obj, ability) => {
      obj[ability] = val(ability);
      obj[`${ability}_bonus`] = val(`${ability}_bonus`);
      obj[`${ability}_save`] = val(`${ability}_save`);
      obj[`${ability}_save_prof`] = chk(`${ability}_save_prof`);
      return obj;
    }, {}),
    combatStats: {
      ac: val('ac'),
      initiative: val('initiative'),
      speed: val('speed'),
      prof_bonus: val('prof_bonus')
    },
    health: {
      max_hp: val('max_hp'),
      curr_hp: val('curr_hp'),
      temp_hp: el('temp_hp_text')?.textContent?.match(/\d+/)?.[0] || '0',
      hit_dice_spend: val('hit_dice_spend'),
      con_modifier: val('con_modifier'),
      hit_die_size: val('hit_die_size'),
      potion_type: val('potion_type')
    },
    skills: ['acrobatics','animal_handling','arcana','athletics','deception','history',
             'insight','intimidation','investigation','medicine','nature','perception',
             'performance','persuasion','religion','sleight_of_hand','stealth','survival']
             .reduce((obj, skill) => {
      obj[`prof_${skill}`] = chk(`prof_${skill}`);
      obj[`adj_${skill}`] = val(`adj_${skill}`) ?? '+0';
      obj[`bonus_${skill}`] = val(`bonus_${skill}`);
      return obj;
    }, {}),
    deathSaves: {
      success: [
        chk('death_save_success_1_checkbox'),
        chk('death_save_success_2_checkbox'),
        chk('death_save_success_3_checkbox')
      ],
      failure: [
        chk('death_save_failure_1_checkbox'),
        chk('death_save_failure_2_checkbox'),
        chk('death_save_failure_3_checkbox')
      ]
    },
    actionsData: actionsData,
    actionsNotes: val('actions_notes'),
    inventoryData: inventoryData,
    maxWeightCapacity: val('max_weight_capacity'),
    equipmentData: inventoryData.equipment.map(item => ({
      name: item.name,
      type: item.type,
      bonus: item.bonus,
      weight: item.weight,
      notes: item.description
    })),
    proficienciesTraining: val('proficiencies_training'),
    statsQuickNotes: val('stats_quick_notes')
  } : existing.page1;

  // --- page2 (background) ---
  const page2InDom = el('char_backstory');
  const page2 = page2InDom ? {
    portrait: el('portraitPreview')?.querySelector('img')?.src || null,
    backstory: val('char_backstory'),
    traits: {
      personality: val('personality_traits'),
      ideals: val('traits_ideals'),
      bonds: val('traits_bonds'),
      flaws: val('traits_flaws'),
      allies: val('traits_allies'),
      appearance: val('traits_appearance')
    },
    customFields: bgCustomFields.map(f => ({
      id: f.id,
      title: f.title,
      placeholder: f.placeholder || '',
      isDefault: !!f.isDefault,
      value: val(f.id) || ''
    }))
  } : existing.page2;

  // --- page3 (spells) ---
  const page3InDom = el('spell_notes');
  const page3 = page3InDom ? {
    spellNotes: val('spell_notes'),
    spellcastingInfo: {
      ability: val('spellcasting_ability'),
      saveDC: val('spell_save_dc'),
      attackBonus: val('spell_attack_bonus'),
      casterType: val('caster_type'),
      spellsPrepared: val('spells_prepared')
    },
    manualSpellSlots: manualSpellSlots,
    manualSpellSlotsUsed: manualSpellSlotsUsed,
    customResources: customResources,
    customResourcesUsed: customResourcesUsed,
    spellsData: spellsData,
    favoritesData: favoritesData
  } : existing.page3;

  // --- page4 (inventory) ---
  const page4InDom = el('gold_field');
  const page4 = page4InDom ? {
    currency: collectCurrencyData(),
    gold: val('gold_field'),
    equipment: equipmentData,
    inventory: [],
    containers: (typeof inventoryData !== 'undefined' ? (inventoryData.storageContainers || []) : []).map(sc => ({
      name: sc.name,
      maxWeight: sc.maxWeight || 0,
      items: (sc.items || []).map(item => ({
        name: item.name,
        description: item.description || '',
        notes: '',
        weight: (item.weight || 0) * (item.stackable ? (item.quantity || 1) : 1)
      }))
    }))
  } : existing.page4;

  // --- page6 (notes) ---
  const page6 = { noteFolders: noteFolders.map(f => ({
    id: f.id,
    title: f.title,
    isDefault: !!f.isDefault,
    cards: f.cards.map(c => ({ id: c.id, title: c.title, body: c.body, isDefault: !!c.isDefault }))
  })) };

  const data = {
    characterInfo,
    actionTracker,
    page1,
    page2,
    page3,
    page4,
    page6,
    weapons: weaponsData,
    conditions: Array.from(document.querySelectorAll('#conditions_container .condition')).map(condition => {
      try {
        const header = condition.querySelector('.condition-header');
        return {
          name: header?.children[0]?.textContent || '',
          turns: header?.children[1]?.textContent || '',
          effect: condition.children[1]?.textContent || '',
          color: condition.classList.contains('blue') ? 'blue' :
                 condition.classList.contains('green') ? 'green' : 'red'
        };
      } catch(e) { return null; }
    }).filter(Boolean)
  };

  characters[charIndex].data = data;
  characters[charIndex].name = (characterInfo && characterInfo.name) || existing.characterInfo?.name || 'Unnamed';
  characters[charIndex].updatedAt = new Date().toISOString();
  localStorage.setItem('dndCharacters', JSON.stringify(characters));

  if (window.currentUser && !window.__adminPreviewActive) {
    if (typeof scheduleSyncToCloud === 'function') {
      scheduleSyncToCloud();
    } else {
      syncToCloud(true);
    }
  }
  } catch (err) {
    console.error('autosave crashed — data NOT saved:', err);
  }
}

function loadData() {
  if (!currentCharacter) return;
  
  // Clear all old form fields first to prevent data from previous character from persisting
  clearAllFormFields();
  
  const characters = getStoredJSON('dndCharacters', []);
  const character = characters.find(char => char.id === currentCharacter);
  if (!character) return;
  
  const data = character.data;
  
  // Character Info
  if (data.characterInfo) {
    document.getElementById('char_name').value = data.characterInfo.name || '';
    document.getElementById('char_race').value = data.characterInfo.race || '';
    document.getElementById('char_background').value = data.characterInfo.background || '';
    document.getElementById('char_class').value = data.characterInfo.class || '';
    document.getElementById('char_subclass').value = data.characterInfo.subclass || '';
    document.getElementById('char_level').value = data.characterInfo.level || '';
  }

  // Action Tracker
  if (data.actionTracker) {
    document.getElementById('action_counter').value = data.actionTracker.actions || 0;
    document.getElementById('action_tick').checked = data.actionTracker.actionUsed || false;
    document.getElementById('bonus_action_counter').value = data.actionTracker.bonusActions || 0;
    document.getElementById('bonus_action_tick').checked = data.actionTracker.bonusActionUsed || false;
  }

  // Page 1: Stats
    if (data.page1) {
    // Abilities
    for (const ability in data.page1.abilities) {
      const element = document.getElementById(ability);
      if (element) element.value = data.page1.abilities[ability];
  // Add these lines for saving throws:
  const saveElement = document.getElementById(`${ability}_save`);
  if (saveElement) saveElement.value = data.page1.abilities[`${ability}_save`] || '';
  
  // Load saving throw proficiency
  const profElement = document.getElementById(`${ability}_save_prof`);
  if (profElement) profElement.checked = data.page1.abilities[`${ability}_save_prof`] || false;

    }

    // Restore saved proficiency bonus before running derived calculations.
    if (data.page1.combatStats && Object.prototype.hasOwnProperty.call(data.page1.combatStats, 'prof_bonus')) {
      const profBonusInput = document.getElementById('prof_bonus');
      if (profBonusInput && data.page1.combatStats.prof_bonus !== null && data.page1.combatStats.prof_bonus !== undefined) {
        profBonusInput.value = data.page1.combatStats.prof_bonus;
      }
    }

    if (typeof syncAutoMathOverridesFromCurrentValues === 'function') {
      syncAutoMathOverridesFromCurrentValues();
    }
    
    // Calculate ability bonuses after loading
    ['str', 'dex', 'con', 'int', 'wis', 'cha'].forEach(ability => {
      window.calculateAbilityBonus(ability);
      // Format bonus input to ensure + prefix
      window.formatBonusInput(ability + '_bonus');
    });
    
    // Update proficiency bonus after loading
    window.updateProficiencyBonus();
    
    // Calculate saving throws after loading
    ['str', 'dex', 'con', 'int', 'wis', 'cha'].forEach(ability => {
      window.calculateSavingThrow(ability);
      // Format save input to ensure + prefix
      window.formatSaveInput(ability + '_save');
    });
    
    // Combat Stats
    if (data.page1.combatStats) {
      document.getElementById('ac').value = data.page1.combatStats.ac || '';
      document.getElementById('initiative').value = data.page1.combatStats.initiative || '';
      document.getElementById('speed').value = data.page1.combatStats.speed || '';
    }

    // Health
    if (data.page1.health) {
      document.getElementById('max_hp').value = data.page1.health.max_hp || '';
      document.getElementById('curr_hp').value = data.page1.health.curr_hp || '';
      document.getElementById('hit_dice_spend').value = data.page1.health.hit_dice_spend || '1';
      document.getElementById('con_modifier').value = data.page1.health.con_modifier || '0';
      document.getElementById('hit_die_size').value = data.page1.health.hit_die_size || '8';
      document.getElementById('potion_type').value = data.page1.health.potion_type || 'lesser';
      
      // Restore temp HP
      if (data.page1.health.temp_hp) {
        const tempHPText = document.getElementById('temp_hp_text');
        if (tempHPText) {
          tempHPText.textContent = `Temporary HP: ${data.page1.health.temp_hp}`;
          const tempHPDisplay = document.getElementById('temp_hp_display');
          if (tempHPDisplay) {
            tempHPDisplay.classList.add('show');
          }
        }
      }
      
      calculateHitDiceRecovery();
      updatePotionInfo();
    }    // Skills
    if (data.page1.skills) {
      for (const skill in data.page1.skills) {
        if (skill.startsWith('prof_')) {
          const checkbox = document.getElementById(skill);
          if (checkbox) checkbox.checked = data.page1.skills[skill];
        } else if (skill.startsWith('adj_')) {
          const input = document.getElementById(skill);
          if (input) input.value = sanitizeSignedValue(data.page1.skills[skill]);
        } else if (skill.startsWith('bonus_')) {
          // Backward compatibility: old saves stored only bonus_ totals.
          // Convert old total into an adjustment component so auto-math remains correct.
          const skillName = skill.replace('bonus_', '');
          const adjInput = document.getElementById(`adj_${skillName}`);
          if (adjInput && !Object.prototype.hasOwnProperty.call(data.page1.skills, `adj_${skillName}`)) {
            const ability = (typeof SKILL_ABILITY_MAP !== 'undefined') ? SKILL_ABILITY_MAP[skillName] : null;
            const abilityBonusValue = ability ? document.getElementById(`${ability}_bonus`)?.value : '+0';
            const profChecked = document.getElementById(`prof_${skillName}`)?.checked || false;
            const profBonusValue = document.getElementById('prof_bonus')?.value || '+0';
            const savedTotal = (typeof parseSignedNumber === 'function')
              ? parseSignedNumber(data.page1.skills[skill])
              : (parseInt(data.page1.skills[skill], 10) || 0);
            const abilityMod = (typeof parseSignedNumber === 'function')
              ? parseSignedNumber(abilityBonusValue)
              : (parseInt(String(abilityBonusValue).replace('+', ''), 10) || 0);
            const profMod = profChecked
              ? ((typeof parseSignedNumber === 'function')
                  ? parseSignedNumber(profBonusValue)
                  : (parseInt(String(profBonusValue).replace('+', ''), 10) || 0))
              : 0;
            const adjustment = savedTotal - abilityMod - profMod;
            adjInput.value = (typeof formatSignedNumber === 'function')
              ? formatSignedNumber(adjustment)
              : (adjustment >= 0 ? `+${adjustment}` : `${adjustment}`);
          }
        }
      }
    }
    updateAllSkillBonuses();

    // Death Saves
    if (data.page1.deathSaves) {
      for (let i = 0; i < 3; i++) {
        if (data.page1.deathSaves.success[i]) {
          const cb = document.getElementById(`death_save_success_${i+1}_checkbox`);
          const box = document.getElementById(`death_save_success_${i+1}`);
          if (cb) cb.checked = true;
          if (box) box.classList.add('checked');
        }
        if (data.page1.deathSaves.failure[i]) {
          const cb = document.getElementById(`death_save_failure_${i+1}_checkbox`);
          const box = document.getElementById(`death_save_failure_${i+1}`);
          if (cb) cb.checked = true;
          if (box) box.classList.add('checked');
        }
      }
    }
    
    // Initialize death save visual states after loading
    initializeDeathSaves();
    
    // Actions & Features
    if (data.page1.actionsData) {
      actionsData = data.page1.actionsData;
      displayActions('action');
      updateFavorites();
    }
    
    // Actions Notes
    if (data.page1.actionsNotes) {
      document.getElementById('actions_notes').value = data.page1.actionsNotes;
    }
    
    // Inventory Data
    if (data.page1.inventoryData) {
      inventoryData = {
        equipment: [],
        mainInventory: [],
        storageContainers: [],
        maxWeightCapacity: 0,
        purchaseHistory: [],
        encumbranceEnabled: false,
        ...data.page1.inventoryData
      };
      displayEquipment();
      displayEquipmentStats();
      displayMainInventory();
      loadStorageContainers();
      updateWeightDisplay();
      if (typeof displayPurchaseHistory === 'function') displayPurchaseHistory();
      // Restore encumbrance toggle
      const encToggle = document.getElementById('encumbrance_toggle');
      if (encToggle) encToggle.checked = !!inventoryData.encumbranceEnabled;
    } else {
      // If no inventory data, try to load from stats page equipment
      if (window.equipmentData && window.equipmentData.length > 0) {
        inventoryData.equipment = window.equipmentData.map(item => ({
          id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
          name: item.name,
          type: item.type,
          bonus: item.bonus,
          weight: item.weight,
          description: item.notes
        }));
        displayEquipment();
        displayEquipmentStats();
        updateWeightDisplay();
      }
    }
    
    // Max Weight Capacity
    if (data.page1.maxWeightCapacity) {
      document.getElementById('max_weight_capacity').value = data.page1.maxWeightCapacity;
      inventoryData.maxWeightCapacity = parseFloat(data.page1.maxWeightCapacity) || 0;
    }
    
    // Equipment Data for Stats Page
    if (data.page1.equipmentData) {
      window.equipmentData = data.page1.equipmentData;
      updateEquipmentPreviews();
    }
    
    // Sync equipment between stats and inventory pages
    syncEquipmentBetweenPages();
    
    // Proficiencies & Training
    if (data.page1.proficienciesTraining) {
      document.getElementById('proficiencies_training').value = data.page1.proficienciesTraining;
    }
    
    // Quick Notes
    if (data.page1.statsQuickNotes) {
      document.getElementById('stats_quick_notes').value = data.page1.statsQuickNotes;
    }
  }
  
  // Page 2: Background
  if (data.page2) {
    // Portrait
    if (data.page2.portrait) {
      const img = document.createElement('img');
      img.src = data.page2.portrait;
      img.style.width = '100%';
      img.style.height = '100%';
      img.style.objectFit = 'cover';
      img.style.borderRadius = '12px';
      document.getElementById('portraitPreview').innerHTML = '';
      document.getElementById('portraitPreview').appendChild(img);
    }

    // Backstory
    if (data.page2.backstory) {
      document.getElementById('char_backstory').value = data.page2.backstory;
    }

    // Custom fields (includes defaults + user-added)
    if (Array.isArray(data.page2.customFields) && data.page2.customFields.length > 0) {
      bgCustomFields = data.page2.customFields.map(f => ({
        id: f.id, title: f.title, placeholder: f.placeholder || '', isDefault: !!f.isDefault
      }));
      renderBgFields();
      data.page2.customFields.forEach(f => {
        const el = document.getElementById(f.id);
        if (el) el.value = f.value || '';
      });
    } else {
      // First load or old save — restore defaults and fill from legacy traits
      bgCustomFields = BG_DEFAULT_FIELDS.map(f => ({ ...f }));
      renderBgFields();
      if (data.page2.traits) {
        document.getElementById('personality_traits').value = data.page2.traits.personality || '';
        document.getElementById('traits_ideals').value      = data.page2.traits.ideals      || '';
        document.getElementById('traits_bonds').value       = data.page2.traits.bonds       || '';
        document.getElementById('traits_flaws').value       = data.page2.traits.flaws       || '';
        document.getElementById('traits_allies').value      = data.page2.traits.allies      || '';
        document.getElementById('traits_appearance').value  = data.page2.traits.appearance  || '';
      }
    }
  }
  
  // Page 3: Spells
  if (data.page3) {
    const page3Data = data.page3;
    if (page3Data.spellNotes) {
      document.getElementById('spell_notes').value = page3Data.spellNotes;
    }
    
    // Load spellcasting info
    if (page3Data.spellcastingInfo) {
      document.getElementById('spellcasting_ability').value = page3Data.spellcastingInfo.ability || 'int';
      document.getElementById('spell_save_dc').value = page3Data.spellcastingInfo.saveDC || '8';
      document.getElementById('spell_attack_bonus').value = page3Data.spellcastingInfo.attackBonus || '0';
      document.getElementById('caster_type').value = page3Data.spellcastingInfo.casterType || 'prepared';
      document.getElementById('spells_prepared').value = page3Data.spellcastingInfo.spellsPrepared || '0';
    }
    
    // Load manual spell slots
    if (page3Data.manualSpellSlots) {
      manualSpellSlots = page3Data.manualSpellSlots;
    }
    
    // Load manual spell slots used
    if (page3Data.manualSpellSlotsUsed) {
      manualSpellSlotsUsed = page3Data.manualSpellSlotsUsed;
    }
    
    // Load custom resources
    if (page3Data.customResources) {
      customResources = page3Data.customResources;
    }
    
    // Load custom resources used
    if (page3Data.customResourcesUsed) {
      customResourcesUsed = page3Data.customResourcesUsed;
    }
    
    // Load spells data
    spellsData = normalizeSpellData(page3Data.spellsData);
    
    // Load favorites data
    favoritesData = normalizeFavoritesData(page3Data.favoritesData);
    
    // Update spell system
    updateSpellSlots();
    updateCustomResources();
    renderSpells();
  }
  
  // Page 4: Inventory
  if (data.page4) {
    // Currency (CP, SP, GP, custom)
    loadCurrencyData(data.page4);
    
    // Equipment
    if (data.page4.equipment) {
      equipmentData = data.page4.equipment;
      updateEquipmentPreviews();
    }
    
    // Main Inventory - Legacy support (if old inventory table exists)
    if (data.page4.inventory) {
      const inventoryTable = document.getElementById('inventory_table');
      if (inventoryTable) {
        const tbody = inventoryTable.querySelector('tbody');
        if (tbody) {
      tbody.innerHTML = '';
      
      data.page4.inventory.forEach(item => {
        const row = tbody.insertRow();
        row.className = 'item-row';
        row.innerHTML = `
          <td>${item.name || ''}</td>
          <td>${item.description || ''}</td>
          <td class="table-notes">${item.notes || ''}</td>
          <td>${item.weight || 0}</td>
          <td>${(item.weight * 0.453592).toFixed(2)}</td>
          <td><button onclick="event.stopPropagation(); this.closest('tr').remove(); updateWeight(); autosave()">Remove</button></td>
        `;
        row.onclick = () => showItemDetails(item, 'inventory');
      });
      
      updateWeight();
        }
      }
    }
    
    // Containers
    if (data.page4.containers) {
      const extraContainers = document.getElementById('extra_containers');
      extraContainers.innerHTML = '';
      const containerDropdown = document.getElementById('item_container');
      
      if (containerDropdown) {
        while (containerDropdown.children.length > 1) {
          containerDropdown.removeChild(containerDropdown.lastChild);
        }
      }
      
      data.page4.containers.forEach(containerData => {
        const containerId = 'container_' + Date.now();
        const containerHTML = `
          <div class="section" id="${containerId}">
            <div class="inventory-controls">
              <h3>${containerData.name}</h3>
              ${containerData.maxWeight > 0 ? `<div>Max Weight: ${containerData.maxWeight} lbs</div>` : ''}
              <button class="delete-container-btn" onclick="confirmContainerDeletion('${containerId}')">Delete Container</button>
            </div>
            <table>
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Description</th>
                  <th>Notes</th>
                  <th>Weight (lbs)</th>
                  <th>Weight (kg)</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                ${containerData.items.map(item => `
                  <tr class="item-row">
                    <td>${item.name || ''}</td>
                    <td>${item.description || ''}</td>
                    <td class="table-notes">${item.notes || ''}</td>
                    <td>${item.weight || 0}</td>
                    <td>${(item.weight * 0.453592).toFixed(2)}</td>
                    <td><button onclick="event.stopPropagation(); this.closest('tr').remove(); updateContainerWeight('${containerId}'); autosave()">Remove</button></td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
            <button onclick="showAddContainerItemPopup('${containerId}')" style="margin-top: 10px;">+ Add Item</button>
            <div class="weight-display">Current: ${containerData.items.reduce((sum, item) => sum + (parseFloat(item.weight) || 0), 0).toFixed(1)} lbs / 
              ${(containerData.items.reduce((sum, item) => sum + (parseFloat(item.weight) || 0), 0) * 0.453592).toFixed(1)} kg</div>
          </div>
        `;
        
        extraContainers.insertAdjacentHTML('beforeend', containerHTML);
        
        containerData.items.forEach(item => {
          const rows = document.querySelectorAll(`#${containerId} tbody tr`);
          rows.forEach(row => {
            if (row.cells[0].textContent === item.name) {
              row.onclick = () => showItemDetails(item, 'inventory');
            }
          });
        });
        
        const option = document.createElement('option');
        option.value = containerId;
        option.textContent = containerData.name;
        containerDropdown.appendChild(option);
      });
    }
  }
  
  // Page 6: Notes (folder+card system)
  if (data.page6 && Array.isArray(data.page6.noteFolders)) {
    noteFolders = data.page6.noteFolders.map(f => ({
      id: f.id,
      title: f.title || 'Folder',
      isDefault: !!f.isDefault,
      cards: Array.isArray(f.cards) ? f.cards.map(c => ({ id: c.id, title: c.title || '', body: c.body || '', isDefault: !!c.isDefault })) : []
    }));
  } else {
    noteFolders = [];
  }
  // Ensure every default folder exists (handles old characters saved before this system).
  // Append any missing default folders at the end, and inject the template card into any
  // default folder that currently has no cards.
  NOTES_DEFAULT_FOLDERS.forEach(def => {
    let folder = noteFolders.find(f => f.id === def.id);
    if (!folder) {
      folder = { id: def.id, title: def.title, isDefault: true, cards: def.cards.map(c => ({ ...c })) };
      noteFolders.push(folder);
    } else {
      folder.isDefault = true;
      if (folder.cards.length === 0) {
        folder.cards = def.cards.map(c => ({ ...c }));
      }
    }
  });
  initNotesPage();
  
  // Weapons
  if (data.weapons) {
    weaponsData = data.weapons;
    updateWeaponsPreview();
  }
  
  // Conditions
  if (data.conditions) {
    const container = document.getElementById('conditions_container');
    container.innerHTML = '';
    
    data.conditions.forEach(condition => {
      const conditionId = Date.now();
      const conditionHTML = `
        <div class="condition ${condition.color}" id="condition_${conditionId}">
          <div class="condition-header">
            <span>${condition.name}</span>
            <span class="condition-turns">${condition.turns}</span>
          </div>
          <div>${condition.effect}</div>
          <button onclick="removeCondition('${conditionId}')" style="float:right; padding:2px 5px; margin-top:5px;">Remove</button>
        </div>
      `;
      
      container.insertAdjacentHTML('beforeend', conditionHTML);
    });
  }

  // Re-sync note sizing after data is loaded into textareas.
  setupNoteBoxHandlers();
  refreshAllNoteBoxes();

}

function sanitizeFilePart(value, fallback = 'unknown') {
  const cleaned = String(value || '')
    .trim()
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, '')
    .replace(/\s+/g, '_')
    .replace(/\.+$/g, '');
  return cleaned || fallback;
}

function formatDatePart(dateInput) {
  const date = new Date(dateInput);
  if (Number.isNaN(date.getTime())) return 'unknown-date';
  return date.toISOString().split('T')[0];
}

function inferCharacterCreatedAt(character) {
  if (character?.createdAt) return character.createdAt;
  const idNum = Number(character?.id);
  if (Number.isFinite(idNum)) {
    const dateFromId = new Date(idNum);
    if (!Number.isNaN(dateFromId.getTime())) {
      return dateFromId.toISOString();
    }
  }
  return null;
}

function exportData() {
  if (!currentCharacter) {
    alert("No character loaded to export");
    return;
  }
  
  const characters = getStoredJSON('dndCharacters', []);
  const character = characters.find(char => char.id === currentCharacter);
  
  if (!character) {
    alert("Character not found");
    return;
  }
  
  try {
    // Ensure data is up to date before exporting
    autosave();

    const nowIso = new Date().toISOString();
    const characterData = character.data || {};
    const createdAt = inferCharacterCreatedAt(character) || nowIso;

    // Backfill createdAt for older characters so future exports are stable.
    if (!character.createdAt) {
      character.createdAt = createdAt;
      localStorage.setItem('dndCharacters', JSON.stringify(characters));
    }

    const displayName = characterData?.characterInfo?.name || character.name || 'dnd_character';
    const level = characterData?.characterInfo?.level;
    const levelPart = level ? `lvl${String(level).trim()}` : 'lvl-unknown';
    const createdDatePart = formatDatePart(createdAt);
    
    // Create export data with metadata
    const exportData = {
      version: "2.1",
      exportDate: nowIso,
      createdAt: createdAt,
      character: characterData,
      characterInfo: {
        id: character.id,
        name: character.name,
        createdAt: createdAt
      },
      aiGuide: {
        canonicalDataPath: "character",
        keyFields: {
          name: "character.characterInfo.name",
          level: "character.characterInfo.level",
          class: "character.characterInfo.class",
          race: "character.characterInfo.race"
        },
        importHints: [
          "Use root.character as the full canonical sheet payload for this app.",
          "When creating a new character from another person's file, copy root.character directly.",
          "If root.character is missing, treat root.data as fallback payload."
        ],
        codeExample: "const file = JSON.parse(text); const payload = file.character || file.data || file; const name = payload?.characterInfo?.name;"
      }
    };
    
    const blob = new Blob([JSON.stringify(exportData, null, 2)], {type: 'application/json'});
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `${sanitizeFilePart(displayName, 'dnd_character')}_${sanitizeFilePart(levelPart, 'lvl-unknown')}_created-${createdDatePart}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    // Show success message
    const saveStatus = document.getElementById('saveStatus');
    if (saveStatus) {
      saveStatus.textContent = 'Exported!';
      saveStatus.style.color = '#4CAF50';
      setTimeout(() => {
        saveStatus.textContent = '';
      }, 2000);
    }
  } catch (error) {
    console.error('Export error:', error);
    alert('Export failed. Please try again.');
  }
}

function importData(event) {
  const file = event.target.files[0];
  if (!file) return;
  
  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      const importedData = JSON.parse(e.target.result);
      // Support multiple import formats:
      // 1) Current export wrapper: { version, exportDate, character, characterInfo }
      // 2) Raw character payload: { characterInfo, page1, ... }
      // 3) Full character record: { id, name, data }
      const characterData = importedData?.character || importedData?.data || importedData;
      const charName =
        importedData?.characterInfo?.name ||
        importedData?.name ||
        characterData?.characterInfo?.name ||
        'Imported Character';

      if (!characterData || typeof characterData !== 'object') {
        throw new Error('Unsupported character file format');
      }

      const importedCreatedAt =
        importedData?.createdAt ||
        importedData?.characterInfo?.createdAt ||
        new Date().toISOString();
      
      const newChar = {
        id: generateCharacterId(),
        name: charName,
        createdAt: importedCreatedAt,
        data: characterData
      };
      
      let characters = getStoredJSON('dndCharacters', []);
      characters.push(newChar);
      localStorage.setItem('dndCharacters', JSON.stringify(characters));
      
      loadCharacterList();
      loadSelectedCharacter(newChar.id);
      window.setupSkillCalculationFields();
      window.enforceAutoMathNumericInputs();
      
      alert(`Character "${charName}" imported successfully!`);
    } catch (err) {
      alert("Error importing file: " + err.message);
    }
    event.target.value = '';
  };
  reader.readAsText(file);
}

// ========== WEAPONS SYSTEM ==========
function showWeaponsForm() {
  document.getElementById('weaponFormTitle').textContent = 'Add Weapon';
  document.getElementById('weapon_name').value = '';
  document.getElementById('weapon_to_hit').value = '';
  document.getElementById('weapon_damage').value = '';
  document.getElementById('weapon_bonus_damage').value = '';
  document.getElementById('weapon_properties').value = '';
  document.getElementById('weapon_notes').value = '';
  document.getElementById('saveWeaponBtn').textContent = 'Add Weapon';
  document.getElementById('saveWeaponBtn').removeAttribute('data-edit-index');
  showPopup('weaponFormPopup');
}

function editWeapon(index) {
  const weapon = weaponsData[index];
  if (!weapon) return;

  document.getElementById('weaponFormTitle').textContent = 'Edit Weapon';
  document.getElementById('weapon_name').value = weapon.name || '';
  document.getElementById('weapon_to_hit').value = weapon.toHit || '';
  document.getElementById('weapon_damage').value = weapon.damage || '';
  document.getElementById('weapon_bonus_damage').value = weapon.bonusDamage || '';
  document.getElementById('weapon_properties').value = weapon.properties || '';
  document.getElementById('weapon_notes').value = weapon.notes || '';
  document.getElementById('saveWeaponBtn').textContent = 'Update Weapon';
  document.getElementById('saveWeaponBtn').setAttribute('data-edit-index', index);
  showPopup('weaponFormPopup');
}

function saveWeapon() {
  const name = document.getElementById('weapon_name').value.trim();
  const toHit = document.getElementById('weapon_to_hit').value.trim();
  const damage = document.getElementById('weapon_damage').value.trim();
  const bonusDamage = document.getElementById('weapon_bonus_damage').value.trim();
  const properties = document.getElementById('weapon_properties').value.trim();
  const notes = document.getElementById('weapon_notes').value.trim();
  const editIndex = document.getElementById('saveWeaponBtn').getAttribute('data-edit-index');

  if (!name) {
    alert('Please enter a name for the weapon.');
    return;
  }

  const weaponData = {
    name,
    toHit,
    damage,
    bonusDamage,
    notes,
    properties
  };

  if (editIndex !== null && editIndex !== '') {
    weaponsData[parseInt(editIndex, 10)] = weaponData;
  } else {
    weaponsData.push(weaponData);
  }

  updateWeaponsPreview();
  displayWeaponsStats();
  closePopup('weaponFormPopup');
  autosave();
}

function updateWeaponsPreview() {
  const preview = document.getElementById('weapons_preview');
  if (preview) {
    preview.innerHTML = '';
    
    if (weaponsData.length === 0) {
      preview.innerHTML = '<p>No weapons added</p>';
      return;
    }
  }
  
  if (preview) {
    const table = document.createElement('table');
    table.className = 'weapons-preview-table';
    const header = table.createTHead();
    const headerRow = header.insertRow();
    headerRow.innerHTML = '<th>Weapon</th><th>To Hit</th><th>Dmg</th><th>Bonus Dmg</th><th>Properties</th><th>Notes</th>';
    
    const body = table.createTBody();
    weaponsData.forEach((weapon, index) => {
      const row = body.insertRow();
      row.className = 'weapon-row';
      
      // Truncate long notes for display
      const shortNotes = weapon.notes && weapon.notes.length > 50 ? 
        weapon.notes.substring(0, 47) + '...' : 
        (weapon.notes || '-');
      
      row.innerHTML = `
        <td class="weapon-name">${weapon.name || '-'}</td>
        <td class="weapon-tohit">${weapon.toHit || '-'}</td>
        <td class="weapon-damage">${weapon.damage || '-'}</td>
        <td class="weapon-bonus">${weapon.bonusDamage || '-'}</td>
        <td class="weapon-properties">${weapon.properties || '-'}</td>
        <td class="weapon-notes">
          <button class="view-details-btn" onclick="event.stopPropagation(); showWeaponDetails(${index})">
            View Notes
          </button>
        </td>
      `;
    });
    
    preview.appendChild(table);
  }
  
  // Always update the stats page display
  displayWeaponsStats();
  
  // Create mobile cards for very small screens (only if preview exists)
  if (preview) {
    const mobileCards = document.createElement('div');
    mobileCards.className = 'weapons-mobile-cards';
    mobileCards.style.display = 'none';
  
  weaponsData.forEach((weapon, index) => {
    const card = document.createElement('div');
    card.className = 'weapon-card';
    card.innerHTML = `
      <div class="weapon-card-header">
        <div class="weapon-card-name">${weapon.name || 'Unnamed Weapon'}</div>
      </div>
      <div class="weapon-card-stats">
        <div class="weapon-stat">
          <span class="weapon-stat-label">To Hit:</span>
          <span class="weapon-stat-value">${weapon.toHit || '-'}</span>
        </div>
        <div class="weapon-stat">
          <span class="weapon-stat-label">Damage:</span>
          <span class="weapon-stat-value">${weapon.damage || '-'}</span>
        </div>
        <div class="weapon-stat">
          <span class="weapon-stat-label">Bonus:</span>
          <span class="weapon-stat-value">${weapon.bonusDamage || '-'}</span>
        </div>
        <div class="weapon-stat">
          <span class="weapon-stat-label">Properties:</span>
          <span class="weapon-stat-value">${weapon.properties || '-'}</span>
        </div>
      </div>
      <div class="weapon-card-actions">
        <button class="view-details-btn" onclick="showWeaponDetails(${index})">
          View Notes
        </button>
      </div>
    `;
    mobileCards.appendChild(card);
  });
  
  preview.appendChild(mobileCards);
  }
}

// ========== EQUIPMENT SYSTEM ==========
function showEquipmentPopup() {
  const tbody = document.getElementById('equipment_table_popup').querySelector('tbody');
  tbody.innerHTML = '';
  
  equipmentData.forEach((item, index) => {
    const row = tbody.insertRow();
    row.innerHTML = `
      <td><input type="text" value="${item.name || ''}" oninput="equipmentData[${index}].name = this.value"></td>
      <td><input type="text" value="${item.type || ''}" oninput="equipmentData[${index}].type = this.value"></td>
      <td><input type="text" value="${item.bonus || ''}" oninput="equipmentData[${index}].bonus = this.value"></td>
      <td><input type="number" value="${item.weight || 0}" step="0.1" oninput="equipmentData[${index}].weight = parseFloat(this.value) || 0"></td>
      <td><textarea class="table-notes" oninput="equipmentData[${index}].notes = this.value">${item.notes || ''}</textarea></td>
      <td><button onclick="event.stopPropagation(); removeEquipmentItem(${index}); showEquipmentPopup()">Remove</button></td>
    `;
  });
  
  showPopup('equipmentPopup');
}

function addEquipment() {
  if (typeof window.equipmentData === 'undefined') {
    window.equipmentData = [];
  }
  window.equipmentData.push({ name: '', type: '', bonus: '', weight: 0, notes: '' });
  showEquipmentPopup();
}

function updateEquipmentPreviews() {
  // Check if equipmentData exists, if not initialize it
  if (typeof window.equipmentData === 'undefined') {
    window.equipmentData = [];
  }

  // Use the global equipmentData variable
  const equipmentData = window.equipmentData;
  
  // Clear both tables completely before rebuilding
  const popupTbody = document.getElementById('equipment_table_popup').querySelector('tbody');
  const inventoryTbody = document.getElementById('equipment_table_inventory');
  const equipmentStatsPreview = document.getElementById('equipment_stats_preview');
  
  popupTbody.innerHTML = '';
  if (inventoryTbody) {
    const tbody = inventoryTbody.querySelector('tbody');
    if (tbody) {
      tbody.innerHTML = '';
    }
  }
  if (equipmentStatsPreview) {
  equipmentStatsPreview.innerHTML = ''; // Clear the stats page preview
  }
  
  if (equipmentData.length === 0) {
    if (equipmentStatsPreview) {
    equipmentStatsPreview.innerHTML = '<p>No equipment added</p>'; // Update for stats page
    }
    if (inventoryTbody) {
      const tbody = inventoryTbody.querySelector('tbody');
      if (tbody) {
        tbody.innerHTML = '<tr><td colspan="6"><p>No equipment added</p></td></tr>'; // Update for inventory page
      }
    }
    updateEquipmentWeight();
    return;
  }
  
  // Rebuild stats page preview (simpler display)
  if (equipmentStatsPreview) {
  const statsTable = document.createElement('table');
  const statsHeader = statsTable.createTHead();
  const statsHeaderRow = statsHeader.insertRow();
  statsHeaderRow.innerHTML = '<th>Name</th><th>Type</th><th>Bonus</th><th>Weight</th><th>Notes</th>';
  const statsBody = statsTable.createTBody();
  equipmentData.forEach(item => {
    const row = statsBody.insertRow();
    row.className = 'item-row';
    row.innerHTML = `
      <td>${item.name || '-'}</td>
      <td>${item.type || '-'}</td>
      <td>${item.bonus || '-'}</td>
      <td>${item.weight || 0}</td>
      <td>${item.notes || '-'}</td>
    `;
    row.onclick = () => showItemDetails(item, 'equipment');
  });
  equipmentStatsPreview.appendChild(statsTable);
  }
  
  // Rebuild inventory table (with remove button) - only if inventory table exists
  if (inventoryTbody) {
    const tbody = inventoryTbody.querySelector('tbody');
    if (tbody) {
  equipmentData.forEach((item, index) => {
        const row = tbody.insertRow();
    row.className = 'item-row';
    row.innerHTML = `
      <td>${item.name || ''}</td>
      <td>${item.type || ''}</td>
      <td>${item.bonus || ''}</td>
      <td>${item.weight || 0}</td>
      <td class="table-notes">${item.notes || ''}</td>
      <td><button onclick="event.stopPropagation(); removeEquipmentItem(${index}); updateEquipmentPreviews();">Remove</button></td>
    `;
    row.onclick = () => showItemDetails(item, 'equipment');
  });
    }
  }

  updateEquipmentWeight();
}

function removeEquipmentItem(index) {
  if (typeof window.equipmentData === 'undefined') {
    window.equipmentData = [];
  }
  if (index >= 0 && index < window.equipmentData.length) {
    window.equipmentData.splice(index, 1);
    updateEquipmentPreviews();
    autosave();
  }
}

function updateEquipmentWeight() {
  if (typeof window.equipmentData === 'undefined') {
    return;
  }
  
  let totalWeight = window.equipmentData.reduce((sum, item) => sum + (parseFloat(item.weight) || 0), 0);
  const weightElement = document.getElementById('equipment_weight_total');
  if (weightElement) {
    weightElement.textContent = 
    `Total: ${totalWeight.toFixed(1)} lbs / ${(totalWeight * 0.453592).toFixed(1)} kg`;
  }
}

// ========== INVENTORY FUNCTIONS ==========
function showAddItemPopup() {
  document.getElementById('old_item_name').value = '';
  document.getElementById('old_item_description').value = '';
  document.getElementById('old_item_notes').value = '';
  document.getElementById('old_item_weight').value = '';
  
  const containerDropdown = document.getElementById('old_item_container');
  containerDropdown.innerHTML = '<option value="main">Main Inventory</option>';
  
  document.querySelectorAll('#extra_containers .section').forEach(container => {
    const option = document.createElement('option');
    option.value = container.id;
    option.textContent = container.querySelector('h3').textContent;
    containerDropdown.appendChild(option);
  });
  
  showPopup('addItemPopup');
}

function addInventoryItem() {
  const name = document.getElementById('old_item_name').value;
  const description = document.getElementById('old_item_description').value;
  const notes = document.getElementById('old_item_notes').value;
  const weight = parseFloat(document.getElementById('old_item_weight').value) || 0;
  const containerId = document.getElementById('old_item_container').value;

  if (!name) {
    alert("Please enter an item name");
    return;
  }

  const item = {
    name,
    description,
    notes,
    weight
  };

  if (containerId === 'main') {
    const inventoryTable = document.getElementById('inventory_table');
    if (!inventoryTable) return;
    const tbody = inventoryTable.querySelector('tbody');
    if (!tbody) return;
    const row = tbody.insertRow();
    row.className = 'item-row';
    row.innerHTML = `
      <td>${name}</td>
      <td>${description}</td>
      <td class="table-notes">${notes}</td>
      <td>${weight}</td>
      <td>${(weight * 0.453592).toFixed(2)}</td>
      <td><button onclick="event.stopPropagation(); this.closest('tr').remove(); updateWeight(); autosave()">Remove</button></td>
    `;
    row.onclick = () => showItemDetails(item, 'inventory');
    updateWeight();
  } else {
    const container = document.getElementById(containerId);
    if (container) {
      const tbody = container.querySelector('tbody');
      const row = tbody.insertRow();
      row.className = 'item-row';
      row.innerHTML = `
        <td>${name}</td>
        <td>${(weight * 0.453592).toFixed(2)}</td>
        <td><button onclick="event.stopPropagation(); this.closest('tr').remove(); updateContainerWeight('${containerId}'); autosave()">Remove</button></td>
      `;
      row.onclick = () => showItemDetails(item, 'inventory');
      updateContainerWeight(containerId);
    }
  }

  closePopup('addItemPopup');
  autosave();
}

// Show add storage popup
function showAddStoragePopup() {
  document.getElementById('storage_container_name').value = '';
  document.getElementById('storage_container_weight').value = '';
  showPopup('addStoragePopup');
}

// Add storage container from popup
function addStorageContainer() {
  const containerName = document.getElementById('storage_container_name').value.trim();
  const maxWeight = parseFloat(document.getElementById('storage_container_weight').value) || 0;
  
  if (!containerName) {
    alert("Please enter a container name");
    return;
  }
  
  const containerId = 'container_' + Date.now();
  
  // Add to inventoryData for persistence
  if (!inventoryData.storageContainers) {
    inventoryData.storageContainers = [];
  }
  
  const storageData = {
    id: containerId,
    name: containerName,
    maxWeight: maxWeight,
    items: []
  };
  
  inventoryData.storageContainers.push(storageData);
  
  const containerHTML = `
    <div class="section storage-container-section" id="${containerId}">
      <div class="inventory-controls">
        <h3>${containerName}</h3>
        <div class="inventory-settings">
          ${maxWeight > 0 ? `<span>Max Weight: ${maxWeight} lbs</span>` : '<span>Unlimited Weight</span>'}
        </div>
        <button class="delete-container-btn" onclick="confirmContainerDeletion('${containerId}')">Delete Container</button>
      </div>
      
      <div class="inventory-controls">
        <button onclick="showItemForm('${containerId}')">+ Add Item</button>
      </div>
      
      <div class="inventory-list-container" id="${containerId}_items">
        <!-- Items will be populated here -->
      </div>
      <div class="weight-display" id="${containerId}_weight">Total: 0 lbs / 0 kg</div>
    </div>
  `;
  
  document.getElementById('extra_containers').insertAdjacentHTML('beforeend', containerHTML);
  
  // Add to item container dropdown for the add item popup
  const containerDropdown = document.getElementById('item_container');
  if (containerDropdown) {
    const option = document.createElement('option');
    option.value = containerId;
    option.textContent = containerName;
    containerDropdown.appendChild(option);
  }
  
  // Close popup and save
  closePopup('addStoragePopup');
  saveInventory();
  updateWeightDisplay();
  autosave();
}

function confirmContainerDeletion(containerId) {
  const container = document.getElementById(containerId);
  const deleteBtn = container.querySelector('.delete-container-btn');
  
  if (deleteBtn.classList.contains('confirm')) {
    // Check if user typed "delete"
    const userInput = prompt('Type "delete" to confirm deletion of this storage container and all its contents:');
    if (userInput === 'delete') {
      // Remove from inventoryData
      if (inventoryData.storageContainers) {
        inventoryData.storageContainers = inventoryData.storageContainers.filter(s => s.id !== containerId);
      }
      
      // Remove from dropdown
      const containerDropdown = document.getElementById('item_container');
      if (containerDropdown) {
        const option = containerDropdown.querySelector(`option[value="${containerId}"]`);
        if (option) containerDropdown.removeChild(option);
      }
      
      // Remove from DOM
      container.remove();
      
      // Save and update
      saveInventory();
      updateWeightDisplay();
      autosave();
    } else {
      // Reset button if user didn't type "delete"
      deleteBtn.textContent = 'Delete Container';
      deleteBtn.classList.remove('confirm');
    }
  } else {
    deleteBtn.textContent = 'Are you sure?';
    deleteBtn.classList.add('confirm');
    setTimeout(() => {
      if (deleteBtn) {
        deleteBtn.textContent = 'Delete Container';
        deleteBtn.classList.remove('confirm');
      }
    }, 5000);
  }
}

function showAddContainerItemPopup(containerId) {
  document.getElementById('item_container').value = containerId;
  showAddItemPopup();
}

function escapeHtml(value) {
  if (value == null) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ========== POPUP FUNCTIONS ==========
function showPopup(id) {
  const popup = document.getElementById(id);
  const backdrop = document.getElementById('popupBackdrop');
  
  if (!popup) {
    return;
  }
  if (!backdrop) {
    return;
  }
  

  if (id === 'darkModeOnlyPopup') {
    popup.style.top = '0';
    popup.style.left = '0';
    popup.style.width = '100vw';
    popup.style.maxWidth = 'none';
    popup.style.height = '100vh';
    popup.style.maxHeight = 'none';
    popup.style.position = 'fixed';
    popup.style.transform = 'none';
    popup.style.opacity = '0';
  } else {
    // Reset positioning
    popup.style.top = '50%';
    popup.style.left = '50%';
    popup.style.transform = 'translate(-50%, -50%) scale(0.8)';
    popup.style.opacity = '0';
  }
  
  // Mobile adjustments
  if (window.innerWidth <= 768 && id !== 'darkModeOnlyPopup') {
    popup.style.width = '95vw';
    popup.style.maxWidth = '95vw';
    popup.style.maxHeight = '85vh';
    popup.style.top = '50%';
    popup.style.left = '50%';
    popup.style.transform = 'translate(-50%, -50%) scale(0.8)';
    popup.style.position = 'fixed';
  }
  
  // Show elements
  popup.style.display = 'block';
  backdrop.style.display = 'block';
  
  // Force immediate visibility
  popup.style.opacity = '1';
  popup.style.transform = id === 'darkModeOnlyPopup' ? 'none' : 'translate(-50%, -50%) scale(1)';
  popup.style.pointerEvents = 'auto';
  
  // Trigger animations
  requestAnimationFrame(() => {
    popup.classList.add('show');
    backdrop.classList.add('show');
  });
}

function closePopup(id) {
  const popup = document.getElementById(id);
  const backdrop = document.getElementById('popupBackdrop');
  
  // Remove show classes to trigger close animation
  popup.classList.remove('show');
  backdrop.classList.remove('show');
  
  // Hide elements after animation completes
  setTimeout(() => {
    popup.style.display = 'none';
    backdrop.style.display = 'none';
    backdrop.style.zIndex = '';
  }, 300); // Match the CSS transition duration

  if (id === 'darkModeOnlyPopup') {
    document.body.classList.remove('modal-open');
    document.body.classList.remove('dark-mode-only-open');
  }

  if (id === 'notesEditorPopup') {
    document.body.classList.remove('notes-editor-open');
  }
}

function closeAllPopups() {
  const backdrop = document.getElementById('popupBackdrop');
  
  // Remove show classes from all popups
  document.querySelectorAll('.popup').forEach(popup => {
    popup.classList.remove('show');
  });
  backdrop.classList.remove('show');
  
  // Hide elements after animation completes
  setTimeout(() => {
    document.querySelectorAll('.popup').forEach(popup => {
      popup.style.display = 'none';
    });
    backdrop.style.display = 'none';
    backdrop.style.zIndex = '';
  }, 300);

  currentNotesElement = null;
  currentNotesField = null;
  document.body.classList.remove('notes-editor-open');
  document.body.classList.remove('modal-open');
  document.body.classList.remove('dark-mode-only-open');
}

// Initialize backdrop click handler
document.getElementById('popupBackdrop').addEventListener('click', closeAllPopups);

// ========== ENHANCED ANIMATIONS ==========
// Add smooth hover effects for cards and sections
document.addEventListener('DOMContentLoaded', function() {
  // Add hover effects to all sections
  const sections = document.querySelectorAll('.section');
  sections.forEach(section => {
    section.addEventListener('mouseenter', function() {
      this.style.transform = 'translateY(-2px)';
      this.style.boxShadow = '0 4px 16px rgba(0, 0, 0, 0.15)';
    });
    
    section.addEventListener('mouseleave', function() {
      this.style.transform = 'translateY(0)';
      this.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.1)';
    });
  });

  // Add hover effects to character grid items
  const gridItems = document.querySelectorAll('.character-manager-grid > div, .welcome-section');
  gridItems.forEach(item => {
    item.addEventListener('mouseenter', function() {
      this.style.transform = 'translateY(-2px)';
      this.style.boxShadow = '0 4px 16px rgba(0, 0, 0, 0.15)';
    });
    
    item.addEventListener('mouseleave', function() {
      this.style.transform = 'translateY(0)';
      this.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.1)';
    });
  });

  // Add smooth focus effects to all inputs
  const inputs = document.querySelectorAll('input, textarea, select');
  inputs.forEach(input => {
    input.addEventListener('focus', function() {
      this.style.transform = 'translateY(-1px)';
      this.style.borderColor = 'var(--accent)';
      this.style.boxShadow = '0 0 0 2px var(--accent-soft)';
    });
    
    input.addEventListener('blur', function() {
      this.style.transform = 'translateY(0)';
      this.style.borderColor = 'var(--accent-border)';
      this.style.boxShadow = 'none';
    });
  });

  // Add smooth hover effects to buttons
  const buttons = document.querySelectorAll('button');
  buttons.forEach(button => {
    button.addEventListener('mouseenter', function() {
      this.style.transform = 'translateY(-2px)';
      this.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.2)';
    });
    
    button.addEventListener('mouseleave', function() {
      this.style.transform = 'translateY(0)';
      this.style.boxShadow = '0 2px 4px rgba(0, 0, 0, 0.1)';
    });
  });

  // Add smooth hover effects to portrait container
  const portraitContainer = document.querySelector('.portrait-container');
  if (portraitContainer) {
    portraitContainer.addEventListener('mouseenter', function() {
      this.style.transform = 'translateY(-2px)';
      this.style.boxShadow = '0 4px 16px rgba(0, 0, 0, 0.15)';
    });
    
    portraitContainer.addEventListener('mouseleave', function() {
      this.style.transform = 'translateY(0)';
      this.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.1)';
    });
  }

  // Add smooth hover effects to table rows
  const tableRows = document.querySelectorAll('tr');
  tableRows.forEach(row => {
    row.addEventListener('mouseenter', function() {
      this.style.backgroundColor = 'rgba(255, 215, 0, 0.05)';
    });
    
    row.addEventListener('mouseleave', function() {
      this.style.backgroundColor = 'transparent';
    });
  });

  // Add smooth animations for theme toggle
  const themeToggle = document.querySelector('.switch input');
  if (themeToggle) {
    themeToggle.addEventListener('change', function() {
      // Add a subtle animation to the toggle
      const slider = this.nextElementSibling;
      slider.style.transition = 'all 1s ease-in-out';
    });
  }
});

// ========== TAB SYSTEM ==========
function switchTab(button) {
  // Reset notes to folder view whenever leaving or re-entering the notes tab
  if (typeof notesGoBack === 'function') notesGoBack();

  // Remove active classes from all tabs and pages
  document.querySelectorAll('.tab').forEach(tab => tab.classList.remove('active'));
  document.querySelectorAll('.page').forEach(page => {
    page.classList.remove('active');
    page.style.display = 'none';
    page.style.opacity = '0';
    page.style.transform = 'translateY(10px)';
  });

  // Add active class to clicked tab
  button.classList.add('active');

  // Get target page
  const tabId = button.getAttribute('data-tab');
  const targetPage = document.getElementById(tabId);

  if (targetPage) {
    // Set display first, then trigger animation
    targetPage.style.display = 'block';

    // Initialize equipment and weapons display for stats page
    if (tabId === 'page1') {
      displayEquipmentStats();
      displayWeaponsStats();
    }

    // Trigger animation on next frame
    requestAnimationFrame(() => {
      targetPage.classList.add('active');
      // Recalculate textarea/container heights after tab visibility changes.
      refreshAllNoteBoxes();
    });
  }
}

function showSaveToast(message, type = 'success') {
  let toast = document.getElementById('saveToast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'saveToast';
    toast.className = 'save-toast';
    document.body.appendChild(toast);
  }

  toast.textContent = message;
  toast.classList.remove('success', 'error', 'show');
  toast.classList.add(type);

  // Force reflow so repeated saves still animate.
  void toast.offsetWidth;
  toast.classList.add('show');

  clearTimeout(window.saveToastTimeout);
  window.saveToastTimeout = setTimeout(() => {
    toast.classList.remove('show');
  }, 1700);
}

function openSettingsPage() {
  const settingsPage = document.getElementById('settings');
  if (!settingsPage) return;

  document.querySelectorAll('.tab').forEach(tab => tab.classList.remove('active'));
  document.querySelectorAll('.page').forEach(page => {
    page.classList.remove('active');
    page.style.display = 'none';
    page.style.opacity = '0';
    page.style.transform = 'translateY(10px)';
  });

  settingsPage.style.display = 'block';
  requestAnimationFrame(() => {
    settingsPage.classList.add('active');
    settingsPage.style.opacity = '1';
    settingsPage.style.transform = 'translateY(0)';
    if (typeof window.updateAdminPortalVisibility === 'function') {
      window.updateAdminPortalVisibility();
    }
    refreshAllNoteBoxes();
    bgRenderPicker();
  });
}

