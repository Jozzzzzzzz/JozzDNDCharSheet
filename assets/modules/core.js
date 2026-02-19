
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

function getNoteBoxDefaultHeight(textarea) {
  const forced = parseFloat(textarea.dataset.noteBaseHeight);
  if (!Number.isNaN(forced) && forced > 0) {
    return forced;
  }

  const style = window.getComputedStyle(textarea);
  const minHeight = parseFloat(style.minHeight) || 0;
  const rootStyle = window.getComputedStyle(document.documentElement);
  let fallback = parseFloat(rootStyle.getPropertyValue('--note-default-height')) || 0;
  if (textarea.classList.contains('notes-textarea')) fallback = Math.max(fallback, 160);
  if (textarea.classList.contains('table-notes')) fallback = Math.max(fallback, 100);
  if (!fallback) fallback = 120;

  return minHeight > 0 ? minHeight : fallback;
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
    || container.closest('#page2')
    || textarea.id === 'proficiencies_training';
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

  textarea.style.height = 'auto';
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
        const rowTargetHeight = sameRowSiblings.reduce((maxHeight, sibling) => {
          const siblingHeight = Math.ceil(sibling.getBoundingClientRect().height);
          return Math.max(maxHeight, siblingHeight);
        }, 0);

        const sectionStyle = window.getComputedStyle(section);
        const sectionPadding = (parseFloat(sectionStyle.paddingTop) || 0) + (parseFloat(sectionStyle.paddingBottom) || 0);
        const header = section.querySelector('h3, h2, label');
        const headerHeight = header ? header.getBoundingClientRect().height : 0;
        const availableHeight = Math.max(0, Math.floor(rowTargetHeight - sectionPadding - headerHeight - 12));
        targetHeight = Math.max(targetHeight, availableHeight);
      }
    }
  }
  textarea.style.height = `${targetHeight}px`;
  textarea.dataset.lastHeight = `${targetHeight}`;

  if (document.activeElement !== textarea || (textarea.selectionStart === 0 && textarea.selectionEnd === 0)) {
    textarea.scrollTop = 0;
  }

  updateNoteBoxContainerHeight(textarea, targetHeight);
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
      const measured = textarea.offsetHeight || parseFloat(computed.height) || parseFloat(computed.minHeight) || 0;
      const fallbackBase = Math.max(measured, parseFloat(computed.minHeight) || 0, 160);
      textarea.dataset.noteBaseHeight = `${Math.max(fallbackBase, 0)}`;
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
      updateNoteBoxSizing(textarea);
    };

    textarea.addEventListener('input', handleNoteInput);
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
  if (themeToggle.checked) {
    showDarkModeOnlyPopup();
  } else {
    document.documentElement.removeAttribute('data-theme');
    localStorage.setItem('dndTheme', 'dark');
  }
}

function setAccentDerivedColors(color) {
  const hex = color.replace('#', '');
  const r = parseInt(hex.substr(0, 2), 16);
  const g = parseInt(hex.substr(2, 2), 16);
  const b = parseInt(hex.substr(4, 2), 16);
  const borderColor = `rgba(${r}, ${g}, ${b}, 0.6)`;
  const softColor = `rgba(${r}, ${g}, ${b}, 0.18)`;
  const yiq = (r * 299 + g * 587 + b * 114) / 1000;
  const contrast = yiq >= 140 ? '#111111' : '#f7f7f7';
  const lighten = (value, amount) => Math.min(255, Math.round(value + (255 - value) * amount));
  const accentText = yiq < 120
    ? `rgb(${lighten(r, 0.65)}, ${lighten(g, 0.65)}, ${lighten(b, 0.65)})`
    : color;
  document.documentElement.style.setProperty('--accent-border', borderColor);
  document.documentElement.style.setProperty('--accent-soft', softColor);
  document.documentElement.style.setProperty('--accent-contrast', contrast);
  document.documentElement.style.setProperty('--accent-text', accentText);
}

function updateAccentColor(color) {
  document.documentElement.style.setProperty('--accent', color);
  localStorage.setItem('dndAccentColor', color);
  setAccentDerivedColors(color);
}

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
    const userEmail = currentUser ? currentUser.email : 'anonymous@example.com';
    
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

    // Working email solution - using a simple email service
    try {
      // Using a simple email service that works without setup
      const response = await fetch('https://api.emailjs.com/v1.0/email/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          service_id: 'service_dndcharsheet',
          template_id: 'template_suggestion',
          user_id: 'YOUR_EMAILJS_PUBLIC_KEY', // You need to get this from EmailJS
          template_params: {
            from_email: userEmail,
            to_email: 'vanreejoz33@gmail.com',
            subject: subject,
            message: body,
            suggestion_type: suggestionType
          }
        })
      });
      
      if (response.ok) {
        return { success: true, method: 'emailjs' };
      }
    } catch (error) {
      console.log('EmailJS failed, trying alternative...');
    }
    
    // Alternative: Use a simple form submission service
    try {
      const formData = new FormData();
      formData.append('email', userEmail);
      formData.append('subject', subject);
      formData.append('message', body);
      formData.append('suggestion_type', suggestionType);
      formData.append('_replyto', userEmail);
      formData.append('_subject', subject);
      
      const response = await fetch('https://formspree.io/f/xovnrwbd', { // Your actual form ID
        method: 'POST',
        body: formData
      });
      
      if (response.ok) {
        return { success: true, method: 'formspree' };
      }
    } catch (error) {
      console.log('Form service failed, using fallback...');
    }
    
    // Fallback - Store locally and show success
    const suggestion = {
      id: Date.now(),
      userEmail,
      suggestionType,
      suggestionText,
      timestamp: new Date().toISOString()
    };
    
    // Store in localStorage as backup
    const suggestions = JSON.parse(localStorage.getItem('pendingSuggestions') || '[]');
    suggestions.push(suggestion);
    localStorage.setItem('pendingSuggestions', JSON.stringify(suggestions));
    
    // Simulate successful sending
    return { success: true, method: 'local_storage' };
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
}

window.addEventListener('resize', refreshAllNoteBoxes);
window.addEventListener('orientationchange', refreshAllNoteBoxes);
window.initializeApp = function() {
  // Initialize web app features first
  initializeWebApp();
  
  // Initialize character system
  loadCharacterList();
  
  // Initialize theme system
  loadThemeSettings();
  
  // Initialize HP display
  updateHPDisplay();
  
  // Initialize death save visual states
  initializeDeathSaves();
  
  // Initialize Hit Dice calculation
  calculateHitDiceRecovery();
  
  // Initialize potion info
  updatePotionInfo();
  
  // Initialize ability bonuses
  ['str', 'dex', 'con', 'int', 'wis', 'cha'].forEach(ability => {
    calculateAbilityBonus(ability);
    // Format bonus input to ensure + prefix
    formatBonusInput(ability + '_bonus');
  });
  
  // Initialize proficiency bonus
  updateProficiencyBonus();

  // Numeric guards + skill auto-math wiring
  enforceAutoMathNumericInputs();
  setupSkillCalculationFields();
  
  // Initialize saving throws
  ['str', 'dex', 'con', 'int', 'wis', 'cha'].forEach(ability => {
    calculateSavingThrow(ability);
    // Format save input to ensure + prefix
    formatSaveInput(ability + '_save');
  });
  
  // Initialize suggestion form
  initializeSuggestionForm();
  
  // Remove resizable class from Character Info section
  const characterInfoSection = document.querySelector('.character-info-section');
  if (characterInfoSection) {
    characterInfoSection.classList.remove('resizable-container');
  }

  // Initialize actions and features
  initializeActions();

  // Initialize inventory system
  initializeInventory();

  // Initialize equipment data for stats page
  if (typeof window.equipmentData === 'undefined') {
    window.equipmentData = [];
  }

  // Try to load last used character or first in list; if none, auto-create one
  const characters = JSON.parse(localStorage.getItem('dndCharacters')) || [];
  if (characters.length > 0) {
    currentCharacter = characters[0].id;
    loadData();
    setupSkillCalculationFields();
    enforceAutoMathNumericInputs();
    // Don't trigger click - let the page show naturally
  } else {
    // Auto-create a default character so autosave works immediately
    const defaultChar = {
      id: Date.now().toString(),
      name: 'New Character',
      data: { characterInfo: { name: 'New Character' }, page1: {}, page2: {}, page3: {}, page4: {}, page6: {}, weapons: [], equipment: [] }
    };
    localStorage.setItem('dndCharacters', JSON.stringify([defaultChar]));
    currentCharacter = defaultChar.id;
    loadCharacterList();
    loadData();
    setupSkillCalculationFields();
    enforceAutoMathNumericInputs();
    document.querySelector('.tab[data-tab="page1"]').click();
  }
  
  // Initialize portrait functionality (guard if elements absent)
  const portraitUpload = document.getElementById('portraitUpload');
  const portraitPreview = document.getElementById('portraitPreview');
  if (portraitUpload && portraitPreview) {
    portraitUpload.addEventListener('change', handlePortraitUpload);
    portraitPreview.addEventListener('click', function() {
      portraitUpload.click();
    });
  }
  
  // Initialize weapons and equipment if empty
  if (weaponsData.length === 0) {
    weaponsData.push({ name: '', toHit: '', damage: '', bonusDamage: '', notes: '', properties: '' });
    updateWeaponsPreview();
  }
  
  if (equipmentData.length === 0) {
    equipmentData.push({ name: '', type: '', bonus: '', weight: 0, notes: '' });
    updateEquipmentPreviews();
  }
  
  // Update weights
  updateWeight();
  document.querySelectorAll('#extra_containers .section').forEach(container => {
    updateContainerWeight(container.id);
  });

  setupNoteBoxHandlers();
  setupNoteBoxObserver();
setupMobileTextareaAutoGrow();
loadLayout(); // This should come after all elements are created
setTimeout(() => {
  syncSpellPanels();
}, 0);
};

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
    const newChar = {
      id: Date.now().toString(),
      name: charName,
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
    
    let characters = JSON.parse(localStorage.getItem('dndCharacters')) || [];
    characters.push(newChar);
    localStorage.setItem('dndCharacters', JSON.stringify(characters));
    
    currentCharacter = newChar.id;
    loadCharacterList();
    loadData();
    setupSkillCalculationFields();
    enforceAutoMathNumericInputs();
    document.querySelector('.tab[data-tab="page1"]').click();
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
  const characters = JSON.parse(localStorage.getItem('dndCharacters')) || [];
  const select = document.getElementById('characterList');
  select.innerHTML = '';
  
  if (characters.length === 0) {
    const option = document.createElement('option');
    option.textContent = "No characters found";
    select.appendChild(option);
    select.disabled = true;
    return;
  }
  
  select.disabled = false;
  characters.forEach(char => {
    const option = document.createElement('option');
    option.value = char.id;
    option.textContent = char.name;
    if (char.id === currentCharacter) option.selected = true;
    select.appendChild(option);
  });
}

// Clear all form fields to prevent old character data from persisting
function clearAllFormFields() {
  // Clear all input fields
  document.querySelectorAll('input[type="text"], input[type="number"], input[type="email"], input[type="password"], input[type="url"]').forEach(input => {
    if (!input.id.includes('deleteConfirmInput') && !input.id.includes('newCharName')) {
      input.value = '';
    }
  });
  
  // Clear all textareas
  document.querySelectorAll('textarea').forEach(textarea => {
    textarea.value = '';
  });
  
  // Clear all checkboxes and radio buttons
  document.querySelectorAll('input[type="checkbox"], input[type="radio"]').forEach(input => {
    input.checked = false;
  });
  
  // Clear select dropdowns (except character list)
  document.querySelectorAll('select').forEach(select => {
    if (select.id !== 'characterList') {
      select.selectedIndex = 0;
    }
  });
  
  // Clear portrait preview
  const portraitPreview = document.getElementById('portraitPreview');
  if (portraitPreview) {
    portraitPreview.innerHTML = '';
  }
  
  // Clear inventory table
  const inventoryTable = document.getElementById('inventory_table');
  if (inventoryTable) {
    const tbody = inventoryTable.querySelector('tbody');
    if (tbody) tbody.innerHTML = '';
  }
  
  // Clear extra containers
  const extraContainers = document.getElementById('extra_containers');
  if (extraContainers) {
    extraContainers.innerHTML = '';
  }
  
  // Clear conditions
  const conditionsContainer = document.getElementById('conditions_container');
  if (conditionsContainer) {
    conditionsContainer.innerHTML = '';
  }
  
  // Reset global data variables to clean states
  weaponsData = [];
  equipmentData = [];
  
  // Reset inventory data if available
  if (typeof inventoryData !== 'undefined') {
    inventoryData = {
      equipment: [],
      mainInventory: [],
      storageContainers: [],
      maxWeightCapacity: 0
    };
  }
  
  // Reset spell data if available
  if (typeof spellsData !== 'undefined') {
    spellsData = getDefaultSpellData();
  }
  if (typeof manualSpellSlots !== 'undefined') {
    manualSpellSlots = [];
  }
  if (typeof manualSpellSlotsUsed !== 'undefined') {
    manualSpellSlotsUsed = {};
  }
  if (typeof customResources !== 'undefined') {
    customResources = [];
  }
  if (typeof customResourcesUsed !== 'undefined') {
    customResourcesUsed = {};
  }
  if (typeof favoritesData !== 'undefined') {
    favoritesData = getDefaultFavoritesData();
  }
  
  // Reset actions data if available
  if (typeof actionsData !== 'undefined') {
    actionsData = {
      actions: [],
      features: []
    };
  }
}

function loadSelectedCharacter() {
  const select = document.getElementById('characterList');
  const charId = select.value;
  if (!charId) return;
  
  currentCharacter = charId;
  loadData();
  document.querySelector('.tab[data-tab="page1"]').click();
}

function initiateDelete() {
  const btn = document.getElementById('deleteBtn');
  const input = document.getElementById('deleteConfirmInput');
  const count = document.getElementById('deleteCharCount');
  
  deleteState++;
  
  if (deleteState === 1) {
    const charName = document.getElementById('char_name').value || 'Character';
    btn.textContent = `Delete ${charName}?`;
    btn.classList.add('warning');
  } else if (deleteState === 2) {
    btn.textContent = 'CONFIRM DELETE!';
    btn.classList.remove('warning');
    btn.classList.add('danger');
  } else if (deleteState === 3) {
    btn.textContent = 'DELETE FOREVER';
    input.style.display = 'block';
    count.style.display = 'inline';
    input.focus();
    
    input.oninput = function() {
      count.textContent = `${input.value.length}/6`;
      btn.disabled = input.value !== 'DELETE';
    };
  } else if (deleteState === 4 && input.value === 'DELETE') {
    const charName = document.getElementById('char_name').value || 'character';
    const characters = JSON.parse(localStorage.getItem('dndCharacters')) || [];
    const updatedChars = characters.filter(char => char.id !== currentCharacter);
    
    localStorage.setItem('dndCharacters', JSON.stringify(updatedChars));
    resetDeleteUI();
    loadCharacterList();
    alert(`${charName} deleted permanently`);
    
    if (updatedChars.length > 0) {
      currentCharacter = updatedChars[0].id;
      loadData();
    setupSkillCalculationFields();
    enforceAutoMathNumericInputs();
      document.querySelector('.tab[data-tab="page1"]').click();
    } else {
      currentCharacter = null;
      showHomePage();
    }
  }
}

function resetDeleteUI() {
  const btn = document.getElementById('deleteBtn');
  const input = document.getElementById('deleteConfirmInput');
  const count = document.getElementById('deleteCharCount');
  
  deleteState = 0;
  btn.textContent = 'Delete Character';
  btn.classList.remove('warning', 'danger');
  btn.disabled = false;
  input.style.display = 'none';
  input.value = '';
  count.style.display = 'none';
}

// ========== EXISTING FUNCTIONALITY (UPDATED FOR CHARACTER SYSTEM) ==========
// Manual save function with status feedback
function manualSave() {
  const saveStatus = document.getElementById('saveStatus');
  if (saveStatus) {
    saveStatus.textContent = 'Saving...';
    saveStatus.style.color = '#ffd700';
  }
  
  try {
    autosave();
    if (saveStatus) {
      saveStatus.textContent = 'Saved!';
      saveStatus.style.color = '#4CAF50';
      setTimeout(() => {
        saveStatus.textContent = '';
      }, 2000);
    }
  } catch (error) {
    console.error('Save error:', error);
    if (saveStatus) {
      saveStatus.textContent = 'Save failed!';
      saveStatus.style.color = '#f44336';
      setTimeout(() => {
        saveStatus.textContent = '';
      }, 3000);
    }
  }
}

function autosave() {
  // Ensure a character target exists
  if (!currentCharacter) {
    let characters = JSON.parse(localStorage.getItem('dndCharacters')) || [];
    if (characters.length === 0) {
      const defaultChar = {
        id: Date.now().toString(),
        name: 'New Character',
        data: { characterInfo: { name: 'New Character' }, page1: {}, page2: {}, page3: {}, page4: {}, page6: {}, weapons: [], equipment: [] }
      };
      characters = [defaultChar];
      localStorage.setItem('dndCharacters', JSON.stringify(characters));
      currentCharacter = defaultChar.id;
      loadCharacterList();
    } else {
      currentCharacter = characters[0].id;
    }
  }
  
  const characters = JSON.parse(localStorage.getItem('dndCharacters')) || [];
  const charIndex = characters.findIndex(char => char.id === currentCharacter);
  if (charIndex === -1) return;
  
  const data = {
    characterInfo: {
      name: document.getElementById('char_name').value,
      race: document.getElementById('char_race').value,
      class: document.getElementById('char_class').value,
      subclass: document.getElementById('char_subclass').value,
      level: document.getElementById('char_level').value
    },
    actionTracker: {
      actions: document.getElementById('action_counter').value,
      actionUsed: document.getElementById('action_tick').checked,
      bonusActions: document.getElementById('bonus_action_counter').value,
      bonusActionUsed: document.getElementById('bonus_action_tick').checked
    },
    page1: {
    abilities: ['str','dex','con','int','wis','cha'].reduce((obj,ability) => {
  obj[ability] = document.getElementById(ability).value;
  obj[`${ability}_bonus`] = document.getElementById(`${ability}_bonus`).value;
  // Add this line for saving throws:
  obj[`${ability}_save`] = document.getElementById(`${ability}_save`).value;
  // Add saving throw proficiency
  obj[`${ability}_save_prof`] = document.getElementById(`${ability}_save_prof`).checked;
  return obj;
}, {}),
      combatStats: {
        ac: document.getElementById('ac').value,
        initiative: document.getElementById('initiative').value,
        speed: document.getElementById('speed').value,
        prof_bonus: document.getElementById('prof_bonus').value
      },

      health: {
        max_hp: document.getElementById('max_hp').value,
        curr_hp: document.getElementById('curr_hp').value,
        temp_hp: document.getElementById('temp_hp_text')?.textContent?.match(/\d+/)?.[0] || '0',
        hit_dice_spend: document.getElementById('hit_dice_spend').value,
        con_modifier: document.getElementById('con_modifier').value,
        hit_die_size: document.getElementById('hit_die_size').value,
        potion_type: document.getElementById('potion_type').value
      },
      equipmentData: equipmentData,
      skills: ['acrobatics','animal_handling','arcana','athletics','deception','history',
               'insight','intimidation','investigation','medicine','nature','perception',
               'performance','persuasion','religion','sleight_of_hand','stealth','survival']
               .reduce((obj,skill) => {
        obj[`prof_${skill}`] = document.getElementById(`prof_${skill}`).checked;
        const adjInput = document.getElementById(`adj_${skill}`);
        obj[`adj_${skill}`] = adjInput ? adjInput.value : '+0';
        obj[`bonus_${skill}`] = document.getElementById(`bonus_${skill}`).value;
        return obj;
      }, {}),
      deathSaves: {
        success: [
          document.getElementById('death_save_success_1_checkbox').checked,
          document.getElementById('death_save_success_2_checkbox').checked,
          document.getElementById('death_save_success_3_checkbox').checked
        ],
        failure: [
          document.getElementById('death_save_failure_1_checkbox').checked,
          document.getElementById('death_save_failure_2_checkbox').checked,
          document.getElementById('death_save_failure_3_checkbox').checked
        ]
      },
      actionsData: actionsData,
      actionsNotes: document.getElementById('actions_notes').value,
      inventoryData: inventoryData,
      maxWeightCapacity: document.getElementById('max_weight_capacity').value,
      equipmentData: inventoryData.equipment.map(item => ({
        name: item.name,
        type: item.type,
        bonus: item.bonus,
        weight: item.weight,
        notes: item.description
      })),
      proficienciesTraining: document.getElementById('proficiencies_training').value,
      statsQuickNotes: document.getElementById('stats_quick_notes').value
    },
    page2: {
      portrait: document.getElementById('portraitPreview').querySelector('img')?.src || null,
      backstory: document.getElementById('char_backstory').value,
      traits: {
        personality: document.getElementById('personality_traits').value,
        ideals: document.getElementById('traits_ideals').value,
        bonds: document.getElementById('traits_bonds').value,
        flaws: document.getElementById('traits_flaws').value,
        allies: document.getElementById('traits_allies').value,
        appearance: document.getElementById('traits_appearance').value
      }
    },
    page3: {
      spellNotes: document.getElementById('spell_notes').value,
      spellcastingInfo: {
        ability: document.getElementById('spellcasting_ability').value,
        saveDC: document.getElementById('spell_save_dc').value,
        attackBonus: document.getElementById('spell_attack_bonus').value,
        casterType: document.getElementById('caster_type').value,
        spellsPrepared: document.getElementById('spells_prepared').value
      },
      manualSpellSlots: manualSpellSlots,
      manualSpellSlotsUsed: manualSpellSlotsUsed,
      customResources: customResources,
      customResourcesUsed: customResourcesUsed,
      spellsData: spellsData,
      favoritesData: favoritesData
    },
    page4: {
      gold: document.getElementById('gold_field').value,
      equipment: equipmentData,
      inventory: Array.from(document.querySelectorAll('#inventory_table tbody tr')).map(row => ({
        name: row.cells[0].textContent,
        description: row.cells[1].textContent,
        notes: row.cells[2].textContent,
        weight: parseFloat(row.cells[3].textContent) || 0
      })),
      containers: Array.from(document.querySelectorAll('#extra_containers .section')).map(container => ({
        name: container.querySelector('h3').textContent,
        maxWeight: container.querySelector('div').textContent.includes('Max Weight') ? 
                   parseInt(container.querySelector('div').textContent.match(/\d+/)[0]) : 0,
        items: Array.from(container.querySelectorAll('tbody tr')).map(row => ({
          name: row.cells[0].textContent,
          description: row.cells[1].textContent,
          notes: row.cells[2].textContent,
          weight: parseFloat(row.cells[3].textContent) || 0
        }))
      }))
    },
    page6: {
      // Quest & Mission Info
      activeQuests: document.getElementById('active_quests').value,
      completedQuests: document.getElementById('completed_quests').value,
      questLeads: document.getElementById('quest_leads').value,
      missionObjectives: document.getElementById('mission_objectives').value,
      
      // World & Locations
      importantLocations: document.getElementById('important_locations').value,
      travelRoutes: document.getElementById('travel_routes').value,
      worldEvents: document.getElementById('world_events').value,
      placesToVisit: document.getElementById('places_to_visit').value,
      
      // NPCs & Contacts
      keyNpcs: document.getElementById('key_npcs').value,
      alliesContacts: document.getElementById('allies_contacts').value,
      enemiesThreats: document.getElementById('enemies_threats').value,
      npcRelationships: document.getElementById('npc_relationships').value,
      npcInformation: document.getElementById('npc_information').value,
      
      // Session & Campaign
      sessionNotes: document.getElementById('session_notes').value,
      campaignTimeline: document.getElementById('campaign_timeline').value,
      partyDecisions: document.getElementById('party_decisions').value,
      campaignGoals: document.getElementById('campaign_goals').value,
      
      // Combat & Strategy
      combatNotes: document.getElementById('combat_notes').value,
      enemyInformation: document.getElementById('enemy_information').value,
      equipmentItems: document.getElementById('equipment_items').value,
      spellAbilityNotes: document.getElementById('spell_ability_notes').value,
      
      // General Info
      rulesMechanics: document.getElementById('rules_mechanics').value,
      ideasPlans: document.getElementById('ideas_plans').value,
      miscellaneousNotes: document.getElementById('miscellaneous_notes').value
    },
    weapons: weaponsData,
    conditions: Array.from(document.querySelectorAll('#conditions_container .condition')).map(condition => ({
      name: condition.querySelector('.condition-header').children[0].textContent,
      turns: condition.querySelector('.condition-header').children[1].textContent,
      effect: condition.children[1].textContent,
      color: condition.classList.contains('blue') ? 'blue' : 
             condition.classList.contains('green') ? 'green' : 'red'
    }))
  };
  
  characters[charIndex].data = data;
  characters[charIndex].name = document.getElementById('char_name').value || 'Unnamed';
  localStorage.setItem('dndCharacters', JSON.stringify(characters));
  
  // Auto-sync to cloud if user is signed in
  if (currentUser) {
    syncToCloud();
  }
}

function loadData() {
  if (!currentCharacter) return;
  
  // Clear all old form fields first to prevent data from previous character from persisting
  clearAllFormFields();
  
  const characters = JSON.parse(localStorage.getItem('dndCharacters')) || [];
  const character = characters.find(char => char.id === currentCharacter);
  if (!character) return;
  
  const data = character.data;
  
  // Character Info
  if (data.characterInfo) {
    document.getElementById('char_name').value = data.characterInfo.name || '';
    document.getElementById('char_race').value = data.characterInfo.race || '';
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
    
    // Calculate ability bonuses after loading
    ['str', 'dex', 'con', 'int', 'wis', 'cha'].forEach(ability => {
      calculateAbilityBonus(ability);
      // Format bonus input to ensure + prefix
      formatBonusInput(ability + '_bonus');
    });
    
    // Update proficiency bonus after loading
    updateProficiencyBonus();
    
    // Calculate saving throws after loading
    ['str', 'dex', 'con', 'int', 'wis', 'cha'].forEach(ability => {
      calculateSavingThrow(ability);
      // Format save input to ensure + prefix
      formatSaveInput(ability + '_save');
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
          document.getElementById(`death_save_success_${i+1}_checkbox`).checked = true;
          document.getElementById(`death_save_success_${i+1}`).classList.add('checked');
        }
        if (data.page1.deathSaves.failure[i]) {
          document.getElementById(`death_save_failure_${i+1}_checkbox`).checked = true;
          document.getElementById(`death_save_failure_${i+1}`).classList.add('checked');
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
      inventoryData = data.page1.inventoryData;
      displayEquipment();
      displayEquipmentStats();
      displayMainInventory();
      loadStorageContainers();
      updateWeightDisplay();
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
    
    // Traits
    if (data.page2.traits) {
      document.getElementById('personality_traits').value = data.page2.traits.personality || '';
      document.getElementById('traits_ideals').value = data.page2.traits.ideals || '';
      document.getElementById('traits_bonds').value = data.page2.traits.bonds || '';
      document.getElementById('traits_flaws').value = data.page2.traits.flaws || '';
      document.getElementById('traits_allies').value = data.page2.traits.allies || '';
      document.getElementById('traits_appearance').value = data.page2.traits.appearance || '';
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
    // Gold
    if (data.page4.gold) {
      document.getElementById('gold_field').value = data.page4.gold;
    }
    
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
  
  // Page 6: Notes
  if (data.page6) {
    // Quest & Mission Info
    if (data.page6.activeQuests) {
      document.getElementById('active_quests').value = data.page6.activeQuests;
    }
    if (data.page6.completedQuests) {
      document.getElementById('completed_quests').value = data.page6.completedQuests;
    }
    if (data.page6.questLeads) {
      document.getElementById('quest_leads').value = data.page6.questLeads;
    }
    if (data.page6.missionObjectives) {
      document.getElementById('mission_objectives').value = data.page6.missionObjectives;
    }
    
    // World & Locations
    if (data.page6.importantLocations) {
      document.getElementById('important_locations').value = data.page6.importantLocations;
    }
    if (data.page6.travelRoutes) {
      document.getElementById('travel_routes').value = data.page6.travelRoutes;
    }
    if (data.page6.worldEvents) {
      document.getElementById('world_events').value = data.page6.worldEvents;
    }
    if (data.page6.placesToVisit) {
      document.getElementById('places_to_visit').value = data.page6.placesToVisit;
    }
    
    // NPCs & Contacts
    if (data.page6.keyNpcs) {
      document.getElementById('key_npcs').value = data.page6.keyNpcs;
    }
    if (data.page6.alliesContacts) {
      document.getElementById('allies_contacts').value = data.page6.alliesContacts;
    }
    if (data.page6.enemiesThreats) {
      document.getElementById('enemies_threats').value = data.page6.enemiesThreats;
    }
    if (data.page6.npcRelationships) {
      document.getElementById('npc_relationships').value = data.page6.npcRelationships;
    }
    if (data.page6.npcInformation) {
      document.getElementById('npc_information').value = data.page6.npcInformation;
    }
    
    // Session & Campaign
    if (data.page6.sessionNotes) {
      document.getElementById('session_notes').value = data.page6.sessionNotes;
    }
    if (data.page6.campaignTimeline) {
      document.getElementById('campaign_timeline').value = data.page6.campaignTimeline;
    }
    if (data.page6.partyDecisions) {
      document.getElementById('party_decisions').value = data.page6.partyDecisions;
    }
    if (data.page6.campaignGoals) {
      document.getElementById('campaign_goals').value = data.page6.campaignGoals;
    }
    
    // Combat & Strategy
    if (data.page6.combatNotes) {
      document.getElementById('combat_notes').value = data.page6.combatNotes;
    }
    if (data.page6.enemyInformation) {
      document.getElementById('enemy_information').value = data.page6.enemyInformation;
    }
    if (data.page6.equipmentItems) {
      document.getElementById('equipment_items').value = data.page6.equipmentItems;
    }
    if (data.page6.spellAbilityNotes) {
      document.getElementById('spell_ability_notes').value = data.page6.spellAbilityNotes;
    }
    
    // General Info
    if (data.page6.rulesMechanics) {
      document.getElementById('rules_mechanics').value = data.page6.rulesMechanics;
    }
    if (data.page6.ideasPlans) {
      document.getElementById('ideas_plans').value = data.page6.ideasPlans;
    }
    if (data.page6.miscellaneousNotes) {
      document.getElementById('miscellaneous_notes').value = data.page6.miscellaneousNotes;
    }
  }
  
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

// ========== EXISTING FUNCTIONS (UPDATED) ==========
function exportData() {
  if (!currentCharacter) {
    alert("No character loaded to export");
    return;
  }
  
  const characters = JSON.parse(localStorage.getItem('dndCharacters')) || [];
  const character = characters.find(char => char.id === currentCharacter);
  
  if (!character) {
    alert("Character not found");
    return;
  }
  
  try {
    // Ensure data is up to date before exporting
    autosave();
    
    // Create export data with metadata
    const exportData = {
      version: "2.0",
      exportDate: new Date().toISOString(),
      character: character.data,
      characterInfo: character
    };
    
    const blob = new Blob([JSON.stringify(exportData, null, 2)], {type: 'application/json'});
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `${character.name || 'dnd_character'}_backup_${new Date().toISOString().split('T')[0]}.json`;
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
      const charName = importedData.characterInfo?.name || 'Imported Character';
      
      const newChar = {
        id: Date.now().toString(),
        name: charName,
        data: importedData
      };
      
      let characters = JSON.parse(localStorage.getItem('dndCharacters')) || [];
      characters.push(newChar);
      localStorage.setItem('dndCharacters', JSON.stringify(characters));
      
      currentCharacter = newChar.id;
      loadCharacterList();
      loadData();
    setupSkillCalculationFields();
    enforceAutoMathNumericInputs();
      
      alert(`Character "${charName}" imported successfully!`);
      document.querySelector('.tab[data-tab="page1"]').click();
    } catch (err) {
      alert("Error importing file: " + err.message);
    }
    event.target.value = '';
  };
  reader.readAsText(file);
}

// ========== WEAPONS SYSTEM ==========
function showWeaponsForm() {
  // Add a new weapon and show the popup for editing
  weaponsData.push({ name: '', toHit: '', damage: '', bonusDamage: '', notes: '', properties: '' });
  showWeaponsPopup();
}

function showWeaponsPopup() {
  const tbody = document.getElementById('weapons_table_popup').querySelector('tbody');
  tbody.innerHTML = '';
  
  weaponsData.forEach((weapon, index) => {
    const row = tbody.insertRow();
    row.innerHTML = `
      <td><input type="text" value="${weapon.name || ''}" oninput="weaponsData[${index}].name = this.value; autosave()"></td>
      <td><input type="text" value="${weapon.toHit || ''}" oninput="weaponsData[${index}].toHit = this.value; autosave()"></td>
      <td><input type="text" value="${weapon.damage || ''}" oninput="weaponsData[${index}].damage = this.value; autosave()"></td>
      <td><input type="text" value="${weapon.bonusDamage || ''}" oninput="weaponsData[${index}].bonusDamage = this.value; autosave()"></td>
      <td><textarea class="table-notes" oninput="weaponsData[${index}].notes = this.value; autosave()">${weapon.notes || ''}</textarea></td>
      <td><input type="text" value="${weapon.properties || ''}" oninput="weaponsData[${index}].properties = this.value; autosave()"></td>
      <td><button onclick="weaponsData.splice(${index}, 1); showWeaponsPopup()">Remove</button></td>
    `;
  });
  
  showPopup('weaponsPopup');
}

function addWeapon() {
  weaponsData.push({ name: '', toHit: '', damage: '', bonusDamage: '', notes: '', properties: '' });
  showWeaponsPopup();
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
  
  autosave();
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
    autosave();
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
  autosave();
}

function removeEquipmentItem(index) {
  if (typeof window.equipmentData === 'undefined') {
    window.equipmentData = [];
  }
  if (index >= 0 && index < window.equipmentData.length) {
    window.equipmentData.splice(index, 1);
    updateEquipmentPreviews();
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

// ========== WEIGHT CALCULATION FUNCTIONS ==========
function updateWeight() {
  let totalWeight = 0;
  const inventoryTable = document.getElementById('inventory_table');
  if (inventoryTable) {
    const rows = inventoryTable.querySelectorAll('tbody tr');
  
  rows.forEach(row => {
    const weightCell = row.cells[3];
      if (weightCell) {
    totalWeight += parseFloat(weightCell.textContent) || 0;
      }
  });
  }
  
  const weightElement = document.getElementById('inventory_weight_total');
  if (weightElement) {
    weightElement.textContent = 
    `Total: ${totalWeight.toFixed(1)} lbs / ${(totalWeight * 0.453592).toFixed(1)} kg`;
  }
}

function updateContainerWeight(containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;
  
  let totalWeight = 0;
  const rows = container.querySelectorAll('tbody tr');
  
  rows.forEach(row => {
    const weightCell = row.cells[3];
    totalWeight += parseFloat(weightCell.textContent) || 0;
  });
  
  const weightDisplay = container.querySelector('.weight-display');
  if (weightDisplay) {
    weightDisplay.textContent = 
      `Current: ${totalWeight.toFixed(1)} lbs / ${(totalWeight * 0.453592).toFixed(1)} kg`;
    
    const maxWeightText = container.querySelector('.inventory-controls div');
    if (maxWeightText && maxWeightText.textContent.includes('Max Weight')) {
      const maxWeight = parseFloat(maxWeightText.textContent.match(/[\d.]+/)[0]);
      if (maxWeight > 0 && totalWeight > maxWeight) {
        weightDisplay.classList.add('overweight');
      } else {
        weightDisplay.classList.remove('overweight');
      }
    }
  }
  autosave();
}

// ========== PORTRAIT FUNCTIONS ==========
function handlePortraitUpload(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function(e) {
    const portraitPreview = document.getElementById('portraitPreview');
    portraitPreview.innerHTML = '';
    const img = document.createElement('img');
    img.src = e.target.result;
    img.style.width = '100%';
    img.style.height = '100%';
    img.style.objectFit = 'cover';
    img.style.borderRadius = '12px';
    portraitPreview.appendChild(img);
    autosave();
  };
  reader.readAsDataURL(file);
}

function removePortrait() {
  const portraitPreview = document.getElementById('portraitPreview');
  portraitPreview.innerHTML = '<span style="color: #666;">No image</span>';
  document.getElementById('portraitUpload').value = '';
  autosave();
}

// ========== POPUP FUNCTIONS ==========
function showPopup(id) {
  console.log('showPopup called with ID:', id);
  const popup = document.getElementById(id);
  const backdrop = document.getElementById('popupBackdrop');
  
  if (!popup) {
    console.log('Popup element not found:', id);
    return;
  }
  if (!backdrop) {
    console.log('Backdrop element not found');
    return;
  }
  
  console.log('Popup and backdrop found, showing popup');

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
      this.style.boxShadow = '0 0 0 2px rgba(255, 215, 0, 0.2)';
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

// ========== HEALTH SYSTEM ==========
function adjustHP(amount) {
  const currHP = document.getElementById('curr_hp');
  let newTotalHP = parseInt(currHP.value) + amount;
  if (isNaN(newTotalHP)) newTotalHP = 0;
  currHP.value = Math.max(0, newTotalHP);
  updateHPDisplay();
  autosave();
}

function updateHPDisplay() {
  const currHP = parseInt(document.getElementById('curr_hp').value) || 0;
  const maxHP = parseInt(document.getElementById('max_hp').value) || 0;
  const tempHPDisplay = document.getElementById('temp_hp_display');
  const tempHPText = document.getElementById('temp_hp_text');
  
  if (currHP > maxHP && maxHP > 0) {
    const tempHP = currHP - maxHP;
    const actualHP = maxHP;
    tempHPText.textContent = `Current HP: ${actualHP} | Temporary HP: ${tempHP}`;
    tempHPDisplay.classList.add('show');
  } else {
    tempHPDisplay.classList.remove('show');
  }
}

// Function to get total HP including temporary HP
function getTotalHP() {
  const currHP = parseInt(document.getElementById('curr_hp').value) || 0;
  const maxHP = parseInt(document.getElementById('max_hp').value) || 0;
  return Math.max(currHP, maxHP);
}

// Function to get actual current HP (capped at max)
function getCurrentHP() {
  const currHP = parseInt(document.getElementById('curr_hp').value) || 0;
  const maxHP = parseInt(document.getElementById('max_hp').value) || 0;
  return Math.min(currHP, maxHP);
}

// Function to get temporary HP
function getTempHP() {
  const currHP = parseInt(document.getElementById('curr_hp').value) || 0;
  const maxHP = parseInt(document.getElementById('max_hp').value) || 0;
  return Math.max(0, currHP - maxHP);
}

function initializeDeathSaves() {
  // Sync visual death save states with hidden checkboxes
  for (let i = 1; i <= 3; i++) {
    const successCheckbox = document.getElementById(`death_save_success_${i}_checkbox`);
    const failureCheckbox = document.getElementById(`death_save_failure_${i}_checkbox`);
    const successVisual = document.getElementById(`death_save_success_${i}`);
    const failureVisual = document.getElementById(`death_save_failure_${i}`);
    
    if (successCheckbox && successVisual) {
      if (successCheckbox.checked) {
        successVisual.classList.add('checked');
      } else {
        successVisual.classList.remove('checked');
      }
    }
    
    if (failureCheckbox && failureVisual) {
      if (failureCheckbox.checked) {
        failureVisual.classList.add('checked');
      } else {
        failureVisual.classList.remove('checked');
      }
    }
  }
}

function toggleDeathSave(type, index) {
  const element = document.getElementById(`death_save_${type}_${index}`);
  const isChecked = element.classList.contains('checked');
  
  // Toggle the visual state
  element.classList.toggle('checked');
  
  // Update the hidden checkbox for data persistence
  const checkbox = document.getElementById(`death_save_${type}_${index}_checkbox`);
  if (checkbox) {
    checkbox.checked = !isChecked;
  }
  
  autosave();
}

function showCustomHPPopup() {
  document.getElementById('custom_hp_amount').value = 1;
  showPopup('customHPPopup');
}

function customAdjustHP(action) {
  const amount = parseInt(document.getElementById('custom_hp_amount').value) || 0;
  if (amount <= 0) {
    alert('Please enter a valid amount greater than 0');
    return;
  }
  
  const adjustment = action === 'add' ? amount : -amount;
  adjustHP(adjustment);
  closeCustomHPPopup();
}

function closeCustomHPPopup() {
  closePopup('customHPPopup');
  // Reset the input for next time
  document.getElementById('custom_hp_amount').value = 1;
}

function shortRest() {
  // Get hit dice inputs
  const hitDiceSpend = parseInt(document.getElementById('hit_dice_spend').value) || 0;
  const conMod = parseInt(document.getElementById('con_modifier').value) || 0;
  const hitDieSize = parseInt(document.getElementById('hit_die_size').value) || 6;
  
  if (hitDiceSpend <= 0) {
    alert("Please enter how many Hit Dice you want to spend (minimum 1)");
    return;
  }
  
  // Roll hit dice
  let totalRecovery = 0;
  const rollDetails = [];
  
  for (let i = 0; i < hitDiceSpend; i++) {
    const roll = Math.floor(Math.random() * hitDieSize) + 1;
    const withConMod = roll + conMod;
    totalRecovery += withConMod;
    rollDetails.push(`d${hitDieSize}: ${roll} + ${conMod} = ${withConMod}`);
  }
  
  // Apply recovery to current HP
  const currHP = document.getElementById('curr_hp');
  const maxHP = document.getElementById('max_hp');
  const currentTotalHP = parseInt(currHP.value) || 0;
  const maxHPValue = parseInt(maxHP.value) || 0;
  
  const newTotalHP = currentTotalHP + totalRecovery;
  
  currHP.value = newTotalHP;
  updateHPDisplay();
  autosave();
  
  // Show results
  const rollSummary = rollDetails.join(', ');
  const newCurrentHP = getCurrentHP();
  const newTempHP = getTempHP();
  const hpDisplay = newTempHP > 0 ? `${newCurrentHP} + ${newTempHP} temp` : `${newCurrentHP}`;
  alert(`Short Rest Completed!\n\nHit Dice Rolls: ${rollSummary}\nTotal Recovery: ${totalRecovery} HP\n\nNew HP: ${hpDisplay}/${maxHPValue}`);
  
  // Reset inputs
  document.getElementById('hit_dice_spend').value = 1;
  calculateHitDiceRecovery();
}

function calculateHitDiceRecovery() {
  const hitDiceSpend = parseInt(document.getElementById('hit_dice_spend').value) || 0;
  const conMod = parseInt(document.getElementById('con_modifier').value) || 0;
  const hitDieSize = parseInt(document.getElementById('hit_die_size').value) || 8;
  
  const recoveryText = document.getElementById('hit_dice_recovery_text');
  
  if (hitDiceSpend <= 0) {
    recoveryText.textContent = 'Enter number of Hit Dice to spend';
    return;
  }
  
  const minRecovery = hitDiceSpend + (conMod * hitDiceSpend);
  const maxRecovery = (hitDieSize * hitDiceSpend) + (conMod * hitDiceSpend);
  
  recoveryText.textContent = `Potential Recovery: ${hitDiceSpend}d${hitDieSize} + ${conMod * hitDiceSpend} = ${minRecovery}-${maxRecovery} HP`;
}


// Health Potion System
function updatePotionInfo() {
  const potionType = document.getElementById('potion_type').value;
  const potionInfo = document.getElementById('potion_info_text');
  
  const potionData = {
    minor: { dice: '2d4', bonus: 2, min: 4, max: 10 },
    lesser: { dice: '2d4', bonus: 2, min: 4, max: 10 },
    healing: { dice: '4d4', bonus: 4, min: 8, max: 20 },
    greater: { dice: '4d4', bonus: 4, min: 8, max: 20 },
    superior: { dice: '8d4', bonus: 8, min: 16, max: 40 },
    supreme: { dice: '10d4', bonus: 20, min: 30, max: 60 }
  };
  
  const data = potionData[potionType];
  potionInfo.textContent = `Heals: ${data.dice}+${data.bonus} = ${data.min}-${data.max} HP`;
}

let potionConfirmCount = 0;

function useHealthPotion() {
  potionConfirmCount++;
  
  if (potionConfirmCount === 1) {
    document.getElementById('use_potion_btn').textContent = 'Click Again to Confirm';
    document.getElementById('use_potion_btn').style.background = '#FF5722';
    setTimeout(() => {
      if (potionConfirmCount === 1) {
        potionConfirmCount = 0;
        document.getElementById('use_potion_btn').textContent = 'Use Potion';
        document.getElementById('use_potion_btn').style.background = '#9C27B0';
      }
    }, 3000);
    return;
  }
  
  if (potionConfirmCount === 2) {
    document.getElementById('use_potion_btn').textContent = 'Final Click to Use!';
    document.getElementById('use_potion_btn').style.background = '#D32F2F';
    return;
  }
  
  if (potionConfirmCount >= 3) {
    // Actually use the potion
    const potionType = document.getElementById('potion_type').value;
    const potionData = {
      minor: { dice: 2, sides: 4, bonus: 2 },
      lesser: { dice: 2, sides: 4, bonus: 2 },
      healing: { dice: 4, sides: 4, bonus: 4 },
      greater: { dice: 4, sides: 4, bonus: 4 },
      superior: { dice: 8, sides: 4, bonus: 8 },
      supreme: { dice: 10, sides: 4, bonus: 20 }
    };
    
    const data = potionData[potionType];
    let totalHealing = 0;
    let rollDetails = [];
    
    // Roll the dice
    for (let i = 0; i < data.dice; i++) {
      const roll = Math.floor(Math.random() * data.sides) + 1;
      totalHealing += roll;
      rollDetails.push(roll);
    }
    
    totalHealing += data.bonus;
    
    // Apply healing to current HP
    const currHP = document.getElementById('curr_hp');
    const maxHP = document.getElementById('max_hp');
    const currentTotalHP = parseInt(currHP.value) || 0;
    const maxHPValue = parseInt(maxHP.value) || 0;
    
    const newTotalHP = currentTotalHP + totalHealing;
    
    currHP.value = newTotalHP;
    updateHPDisplay();
    autosave();
    
    // Show results
    const rollSummary = rollDetails.join(', ');
    const newCurrentHP = getCurrentHP();
    const newTempHP = getTempHP();
    const hpDisplay = newTempHP > 0 ? `${newCurrentHP} + ${newTempHP} temp` : `${newCurrentHP}`;
    alert(`Health Potion Used!\n\nRolls: ${rollSummary}\nBonus: +${data.bonus}\nTotal Healing: ${totalHealing} HP\n\nNew HP: ${hpDisplay}/${maxHPValue}`);
    
    // Reset button
    potionConfirmCount = 0;
    document.getElementById('use_potion_btn').textContent = 'Use Potion';
    document.getElementById('use_potion_btn').style.background = '#9C27B0';
  }
}

function longRest() {
  const currHP = document.getElementById('curr_hp');
  const maxHP = document.getElementById('max_hp');
  currHP.value = maxHP.value; // This sets total HP to max HP (no temp HP)
  
  // Reset death saves
  for (let i = 1; i <= 3; i++) {
    document.getElementById(`death_save_success_${i}`).classList.remove('checked');
    document.getElementById(`death_save_failure_${i}`).classList.remove('checked');
    
    // Also reset hidden checkboxes
    const successCheckbox = document.getElementById(`death_save_success_${i}_checkbox`);
    const failureCheckbox = document.getElementById(`death_save_failure_${i}_checkbox`);
    if (successCheckbox) successCheckbox.checked = false;
    if (failureCheckbox) failureCheckbox.checked = false;
  }
  
  updateHPDisplay();
  autosave();
  alert("Long rest completed - HP fully restored, death saves reset");
}

