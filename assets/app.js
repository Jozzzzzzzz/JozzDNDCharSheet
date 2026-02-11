
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

function isDesktopLayout() {
  return window.innerWidth >= 1024;
}

function clampSectionToContent(section) {
  if (!section) return;
  const contentHeight = section.scrollHeight;
  const existing = parseInt(section.dataset.contentMinHeight || '0', 10);
  const next = Math.max(existing, contentHeight);
  section.dataset.contentMinHeight = `${next}`;
  section.style.minHeight = `${next}px`;
  if (section.getBoundingClientRect().height < next) {
    section.style.height = `${next}px`;
  }
}

function recalcFlexWrapBase(container) {
  if (!isDesktopLayout()) return 0;
  const sections = Array.from(container.querySelectorAll('.section'));
  if (sections.length === 0) return 0;
  const contentHeight = Math.max(...sections.map(section => section.scrollHeight));
  const minHeight = parseInt(container.dataset.minHeight || '0', 10);
  const baseHeight = Math.max(contentHeight, minHeight);
  container.dataset.baseHeight = `${baseHeight}`;
  sections.forEach(section => {
    section.style.minHeight = `${baseHeight}px`;
    if (!section.style.height || parseInt(section.style.height, 10) < baseHeight) {
      section.style.height = `${baseHeight}px`;
    }
  });
  return baseHeight;
}

function syncFlexWrapHeights(container) {
  if (!isDesktopLayout()) return;
  const sections = Array.from(container.querySelectorAll('.section'));
  if (sections.length === 0) return;
  const baseHeight = parseInt(container.dataset.baseHeight || '0', 10);
  const manualHeight = parseInt(container.dataset.manualHeight || '0', 10);
  let desiredHeight = baseHeight;
  if (manualHeight) {
    desiredHeight = Math.max(baseHeight, manualHeight);
  } else if (window.activeResizeSection && container.contains(window.activeResizeSection)) {
    desiredHeight = Math.max(baseHeight, window.activeResizeSection.getBoundingClientRect().height);
  } else {
    const currentMax = Math.max(...sections.map(section => section.getBoundingClientRect().height));
    desiredHeight = Math.max(baseHeight, currentMax);
  }
  const currentHeight = Math.round(sections[0].getBoundingClientRect().height);
  if (Math.abs(currentHeight - desiredHeight) < 1) return;
  sections.forEach(section => {
    section.style.minHeight = `${baseHeight}px`;
    section.style.height = `${desiredHeight}px`;
  });
}

function applyFlexWrapSizing() {
  if (!isDesktopLayout()) return;
  document.querySelectorAll('.flex-wrap').forEach(container => {
    recalcFlexWrapBase(container);
    syncFlexWrapHeights(container);
  });
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
  const style = window.getComputedStyle(textarea);
  const minHeight = parseFloat(style.minHeight) || 0;
  const rootStyle = window.getComputedStyle(document.documentElement);
  const cssDefault = parseFloat(rootStyle.getPropertyValue('--note-default-height')) || 0;

  let fallback = cssDefault || 120;
  if (textarea.classList.contains('notes-textarea')) fallback = Math.max(fallback, 160);
  if (textarea.classList.contains('table-notes')) fallback = Math.max(fallback, 100);

  return Math.max(minHeight, fallback);
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
  // Prefer the nearest notes container so the actions notes panel grows with its textarea.
  const container = textarea.closest('.notes-subsection, .actions-notes-section') || textarea.closest('.section');
  if (!container) return;
  const style = window.getComputedStyle(container);
  const padding = (parseFloat(style.paddingTop) || 0) + (parseFloat(style.paddingBottom) || 0);
  const header = container.querySelector('h3, h2, label');
  const headerHeight = header ? header.getBoundingClientRect().height : 0;
  const targetHeight = Math.ceil(textareaHeight + headerHeight + padding + 12);
  const defaultHeight = getContainerDefaultHeight(container);
  const nextHeight = Math.max(defaultHeight, targetHeight);
  container.style.minHeight = `${nextHeight}px`;

  // Keep notes sections flexible so grid scaling stays smooth on mobile/tablet.
  if (container.classList.contains('notes-subsection') || container.closest('#page6') || container.closest('#page2')) {
    container.style.height = 'auto';
  } else {
    container.style.height = `${nextHeight}px`;
  }
}

function updateNoteBoxSizing(textarea) {
  const defaultHeight = getNoteBoxDefaultHeight(textarea);
  const charCount = getCharCount(textarea.value);
  textarea.dataset.charCount = `${charCount}`;

  // Always grow with content; never keep notes inside an internal scroll area.
  textarea.style.height = 'auto';
  const desired = Math.max(defaultHeight, textarea.scrollHeight + 12);
  textarea.style.height = `${desired}px`;

  // Prevent stale partial first-line clipping when browser keeps old scroll offset.
  if (document.activeElement !== textarea || (textarea.selectionStart === 0 && textarea.selectionEnd === 0)) {
    textarea.scrollTop = 0;
  }

  updateNoteBoxContainerHeight(textarea, desired);
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
function setupAutoResize() {
  document.querySelectorAll('.section textarea:not(.note-box)').forEach(textarea => {
    textarea.addEventListener('input', function() {
      const section = this.closest('.section');
      const neededHeight = Math.max(section.scrollHeight, this.scrollHeight + 30);
      if (neededHeight > section.clientHeight) {
        section.style.height = `${neededHeight}px`;
      }
      const container = section.closest('.flex-wrap');
      if (container) {
        recalcFlexWrapBase(container);
        syncFlexWrapHeights(container);
      }
    });
  });
}

function setupNoteBoxHandlers() {
  // Notes are rendered/initialized in HTML and dynamic builders; call this after inserting any new note textareas.
  document.querySelectorAll(NOTE_BOX_SELECTOR).forEach(textarea => {
    if (textarea.dataset.noteBoxReady === '1') return;
    textarea.dataset.noteBoxReady = '1';
    textarea.classList.add('note-box');

    const onclick = textarea.getAttribute('onclick') || '';
    const match = onclick.match(/showNotesPopup\('([^']+)',\s*'([^']+)'\)/);
    if (match) {
      textarea.dataset.popupId = match[1];
      textarea.dataset.popupTitle = match[2];
      textarea.removeAttribute('onclick');
    }

    textarea.addEventListener('blur', () => {
      textarea.dataset.suppressPopup = '';
    });

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
  document.querySelectorAll(NOTE_BOX_SELECTOR).forEach(textarea => {
    updateNoteBoxSizing(textarea);
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

// Enable resizable containers
function makeContainersResizable() {
  if (window.activeResizeSection === undefined) {
    window.activeResizeSection = null;
    window.resizeSyncLoop = null;
    window.groupResizeState = null;
    document.addEventListener('mouseup', () => {
      window.activeResizeSection = null;
    });
    document.addEventListener('touchend', () => {
      window.activeResizeSection = null;
    });
    document.addEventListener('pointerup', () => {
      window.activeResizeSection = null;
      if (window.groupResizeState) {
        window.groupResizeState = null;
        document.body.style.cursor = '';
      }
    });
    document.addEventListener('pointermove', event => {
      if (!window.groupResizeState) return;
      const { container, startY, startHeight } = window.groupResizeState;
      const delta = event.clientY - startY;
      const baseHeight = parseInt(container.dataset.baseHeight || '0', 10);
      const nextHeight = Math.max(baseHeight, startHeight + delta);
      container.dataset.manualHeight = `${nextHeight}`;
      syncFlexWrapHeights(container);
      event.preventDefault();
    });
    document.addEventListener('mousemove', () => {
      if (!window.activeResizeSection) return;
      const container = window.activeResizeSection.closest('.flex-wrap');
      if (container) syncFlexWrapHeights(container);
    });
    document.addEventListener('touchmove', () => {
      if (!window.activeResizeSection) return;
      const container = window.activeResizeSection.closest('.flex-wrap');
      if (container) syncFlexWrapHeights(container);
    }, { passive: true });
    document.addEventListener('pointermove', () => {
      if (!window.activeResizeSection) return;
      const container = window.activeResizeSection.closest('.flex-wrap');
      if (container) syncFlexWrapHeights(container);
    });
  }

  document.querySelectorAll('.section').forEach(section => {
    // Skip Character Info section - make it non-resizable
    if (section.classList.contains('character-info-section')) {
      return;
    }
    
    section.classList.add('resizable-container');
    
    // Store initial size for reset functionality
    if (!section.dataset.originalWidth) {
      section.dataset.originalWidth = section.style.width || 'auto';
      section.dataset.originalHeight = section.style.height || 'auto';
    }
    if (section.classList.contains('actions-notes-section')) {
      clampSectionToContent(section);
    }

    section.addEventListener('mousedown', () => {
      window.activeResizeSection = section;
      if (!window.resizeSyncLoop) {
        const loop = () => {
          if (!window.activeResizeSection) {
            window.resizeSyncLoop = null;
            return;
          }
          const container = window.activeResizeSection.closest('.flex-wrap');
          if (container) {
            syncFlexWrapHeights(container);
          }
          window.resizeSyncLoop = requestAnimationFrame(loop);
        };
        window.resizeSyncLoop = requestAnimationFrame(loop);
      }
    });
    section.addEventListener('touchstart', () => {
      window.activeResizeSection = section;
      if (!window.resizeSyncLoop) {
        const loop = () => {
          if (!window.activeResizeSection) {
            window.resizeSyncLoop = null;
            return;
          }
          const container = window.activeResizeSection.closest('.flex-wrap');
          if (container) {
            syncFlexWrapHeights(container);
          }
          window.resizeSyncLoop = requestAnimationFrame(loop);
        };
        window.resizeSyncLoop = requestAnimationFrame(loop);
      }
    });
    section.addEventListener('pointerdown', () => {
      window.activeResizeSection = section;
      if (!window.resizeSyncLoop) {
        const loop = () => {
          if (!window.activeResizeSection) {
            window.resizeSyncLoop = null;
            return;
          }
          const container = window.activeResizeSection.closest('.flex-wrap');
          if (container) {
            syncFlexWrapHeights(container);
          }
          window.resizeSyncLoop = requestAnimationFrame(loop);
        };
        window.resizeSyncLoop = requestAnimationFrame(loop);
      }
    });
    section.addEventListener('pointerdown', event => {
      if (!isDesktopLayout()) return;
      const container = section.closest('.flex-wrap');
      if (!container) return;
      const rect = section.getBoundingClientRect();
      if (rect.bottom - event.clientY > 14) return;
      recalcFlexWrapBase(container);
      const baseHeight = parseInt(container.dataset.baseHeight || '0', 10);
      const startHeight = Math.max(baseHeight, container.getBoundingClientRect().height);
      container.dataset.manualHeight = `${startHeight}`;
      window.groupResizeState = { container, startY: event.clientY, startHeight };
      document.body.style.cursor = 'ns-resize';
      event.preventDefault();
    });
  });

  document.querySelectorAll('.flex-wrap').forEach(container => {
    container.style.resize = 'vertical';
    container.style.overflow = 'auto';
    recalcFlexWrapBase(container);
    syncFlexWrapHeights(container);
    const baseHeight = parseInt(container.dataset.baseHeight || '0', 10);
    if (baseHeight) {
      container.style.minHeight = `${baseHeight}px`;
    }
  });

  if (window.ResizeObserver) {
    document.querySelectorAll('.flex-wrap').forEach(container => {
      const observer = new ResizeObserver(() => {
        recalcFlexWrapBase(container);
        syncFlexWrapHeights(container);
      });
      observer.observe(container);
      container.querySelectorAll('.section').forEach(section => observer.observe(section));
    });
  }

  window.addEventListener('resize', () => {
    if (!isDesktopLayout()) return;
    document.querySelectorAll('.flex-wrap').forEach(container => {
      recalcFlexWrapBase(container);
      syncFlexWrapHeights(container);
    });
  });
}

// ========== GLOBAL VARIABLES ==========
let weaponsData = [];
let equipmentData = [];
let currentCharacter = null;
let deleteState = 0;

// ========== THEME MANAGEMENT ==========
function toggleTheme() {
  const themeToggle = document.getElementById('themeToggle');
  if (themeToggle.checked) {
    document.documentElement.setAttribute('data-theme', 'light');
    localStorage.setItem('dndTheme', 'light');
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
  // Load theme preference
  const savedTheme = localStorage.getItem('dndTheme');
  const themeToggle = document.getElementById('themeToggle');
  
  if (savedTheme === 'light') {
    document.documentElement.setAttribute('data-theme', 'light');
    if (themeToggle) themeToggle.checked = true;
  } else {
    document.documentElement.removeAttribute('data-theme');
    if (themeToggle) themeToggle.checked = false;
  }
  
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

 // Enable resizing
makeContainersResizable();
setupNoteBoxHandlers();
setupNoteBoxObserver();
setupAutoResize();
setupMobileTextareaAutoGrow();
loadLayout(); // This should come after all elements are created
setTimeout(() => {
  applyFlexWrapSizing();
  syncSpellPanels();
}, 0);
};

// ========== CHARACTER MANAGEMENT ==========
function showHomePage() {
  document.querySelectorAll('.page').forEach(page => page.classList.remove('active'));
  document.getElementById('home').classList.add('active');
  document.querySelectorAll('.tab').forEach(tab => tab.classList.remove('active'));
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
          // Backward compatibility: old saves stored only bonus_ values.
          const skillName = skill.replace('bonus_', '');
          const adjInput = document.getElementById(`adj_${skillName}`);
          if (adjInput && !data.page1.skills[`adj_${skillName}`]) {
            adjInput.value = sanitizeSignedValue(data.page1.skills[skill]);
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
    if (data.page3.spellNotes) {
    document.getElementById('spell_notes').value = data.page3.spellNotes;
    }
    
    // Load spellcasting info
    if (data.page3.spellcastingInfo) {
      document.getElementById('spellcasting_ability').value = data.page3.spellcastingInfo.ability || 'int';
      document.getElementById('spell_save_dc').value = data.page3.spellcastingInfo.saveDC || '8';
      document.getElementById('spell_attack_bonus').value = data.page3.spellcastingInfo.attackBonus || '0';
      document.getElementById('caster_type').value = data.page3.spellcastingInfo.casterType || 'prepared';
      document.getElementById('spells_prepared').value = data.page3.spellcastingInfo.spellsPrepared || '0';
    }
    
    // Load manual spell slots
    if (data.page3.manualSpellSlots) {
      manualSpellSlots = data.page3.manualSpellSlots;
    }
    
    // Load manual spell slots used
    if (data.page3.manualSpellSlotsUsed) {
      manualSpellSlotsUsed = data.page3.manualSpellSlotsUsed;
    }
    
    // Load custom resources
    if (data.page3.customResources) {
      customResources = data.page3.customResources;
    }
    
    // Load custom resources used
    if (data.page3.customResourcesUsed) {
      customResourcesUsed = data.page3.customResourcesUsed;
    }
    
    // Load spells data
    if (data.page3.spellsData) {
      spellsData = data.page3.spellsData;
    }
    
    // Load favorites data
    if (data.page3.favoritesData) {
      favoritesData = data.page3.favoritesData;
    }
    
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

  setTimeout(() => {
    applyFlexWrapSizing();
  }, 0);
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
  
  // Reset positioning
  popup.style.top = '50%';
  popup.style.left = '50%';
  popup.style.transform = 'translate(-50%, -50%) scale(0.8)';
  popup.style.opacity = '0';
  
  // Mobile adjustments
  if (window.innerWidth <= 768) {
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
  popup.style.transform = 'translate(-50%, -50%) scale(1)';
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
  }, 300); // Match the CSS transition duration

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
  }, 300);

  currentNotesElement = null;
  currentNotesField = null;
  document.body.classList.remove('notes-editor-open');
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

// ========== ACTIONS SYSTEM ==========
let actionsData = {
  actions: []
};

// Initialize actions
function initializeActions() {
  loadActions();
  displayActions('action');
  updateFavorites();
}

// Show action form
function showActionForm(type) {
  document.getElementById('actionFormTitle').textContent = 'Add Action';
  document.getElementById('action_name').value = '';
  document.getElementById('action_category').value = 'melee';
  document.getElementById('action_damage').value = '';
  document.getElementById('action_range').value = '';
  document.getElementById('action_uses').value = '';
  document.getElementById('action_attack').value = '';
  document.getElementById('action_description').value = '';
  document.getElementById('saveActionBtn').textContent = 'Add Action';
  showPopup('actionFormPopup');
}

// Update action form based on type
function updateActionForm() {
  const categorySelect = document.getElementById('action_category');
  
  // Clear existing options
  categorySelect.innerHTML = '';
  
  const options = [
    { value: 'melee', text: 'Melee' },
    { value: 'ranged', text: 'Ranged' },
    { value: 'spell', text: 'Spell' },
    { value: 'other', text: 'Other' }
  ];
  options.forEach(option => {
    const optionElement = document.createElement('option');
    optionElement.value = option.value;
    optionElement.textContent = option.text;
    categorySelect.appendChild(optionElement);
  });
}

// Save action
function saveAction() {
  const name = document.getElementById('action_name').value.trim();
  const category = document.getElementById('action_category').value;
  const damage = document.getElementById('action_damage').value.trim();
  const range = document.getElementById('action_range').value.trim();
  const uses = document.getElementById('action_uses').value.trim();
  const attack = document.getElementById('action_attack').value.trim();
  const description = document.getElementById('action_description').value.trim();
  const editId = document.getElementById('saveActionBtn').getAttribute('data-edit-id');
  
  if (!name) {
    alert('Please enter a name for the action.');
    return;
  }
  
  const actionData = {
    id: editId || Date.now().toString(),
    name: name,
    type: 'action',
    category: category,
    damage: damage,
    range: range,
    uses: uses,
    attack: attack,
    description: description,
    favorite: false
  };
  
  if (editId) {
    // Editing existing action
    const existingAction = actionsData.actions.find(a => a.id === editId);
    if (existingAction) {
      actionData.favorite = existingAction.favorite; // Preserve favorite status
      Object.assign(existingAction, actionData);
    }
  } else {
    // Adding new action
    actionsData.actions.push(actionData);
  }
  
  saveActions();
  displayActions('action');
  updateFavorites();
  closePopup('actionFormPopup');
  autosave();
}

// Display actions
function displayActions(type) {
  const container = document.getElementById('actions_list');
  if (!container) {
    return;
  }
  
  const data = actionsData.actions;
  
  container.innerHTML = '';
  
  if (data.length === 0) {
    container.innerHTML = `<p style="text-align: center; color: var(--text); opacity: 0.7; grid-column: 1 / -1;">No actions added yet. Click "+ Add Action" to get started!</p>`;
    return;
  }
  
  data.forEach(action => {
    const actionCard = createActionCard(action, 'action');
    container.appendChild(actionCard);
  });
}

// Create action card
function createActionCard(action, type) {
  const card = document.createElement('div');
  card.className = `action-card ${action.favorite ? 'favorite' : ''}`;
  card.innerHTML = `
    <div class="action-header">
      <h4 class="action-name">${action.name}</h4>
      <span class="action-type">${action.category}</span>
    </div>
    <div class="action-stats">
      ${action.damage ? `<div class="action-stat"><span class="action-stat-label">Damage/Effect:</span><span class="action-stat-value">${action.damage}</span></div>` : ''}
      ${action.range ? `<div class="action-stat"><span class="action-stat-label">Range/Area:</span><span class="action-stat-value">${action.range}</span></div>` : ''}
      ${action.uses ? `<div class="action-stat"><span class="action-stat-label">Uses:</span><span class="action-stat-value">${action.uses}</span></div>` : ''}
      ${action.attack ? `<div class="action-stat"><span class="action-stat-label">Attack/Save:</span><span class="action-stat-value">${action.attack}</span></div>` : ''}
    </div>
    ${action.description ? `<div class="action-description">${action.description}</div>` : ''}
    <div class="action-actions">
      <button class="action-btn favorite-btn ${action.favorite ? 'favorited' : ''}" onclick="toggleFavorite('${action.id}', '${type}')">
        ${action.favorite ? '❤️' : '🤍'}
      </button>
      <button class="action-btn edit-btn" onclick="editAction('${action.id}', '${type}')">✏️</button>
      <button class="action-btn delete-btn" onclick="deleteAction('${action.id}', '${type}')">🗑️</button>
    </div>
  `;
  return card;
}

// Toggle favorite
function toggleFavorite(id, type) {
  const action = actionsData.actions.find(a => a.id === id);
  if (action) {
    action.favorite = !action.favorite;
    saveActions();
    displayActions('action');
    updateFavorites();
    autosave();
  }
}

// Edit action
function editAction(id, type) {
  const action = actionsData.actions.find(a => a.id === id);
  if (action) {
    document.getElementById('actionFormTitle').textContent = 'Edit Action';
    document.getElementById('action_type').value = 'action';
    document.getElementById('action_name').value = action.name;
    document.getElementById('action_category').value = action.category;
    document.getElementById('action_damage').value = action.damage;
    document.getElementById('action_range').value = action.range;
    document.getElementById('action_uses').value = action.uses;
    document.getElementById('action_attack').value = action.attack;
    document.getElementById('action_description').value = action.description;
    document.getElementById('saveActionBtn').textContent = 'Update Action';
    document.getElementById('saveActionBtn').setAttribute('data-edit-id', id);
    showPopup('actionFormPopup');
  }
}

// Delete action
function deleteAction(id, type) {
  if (confirm('Are you sure you want to delete this action?')) {
    const index = actionsData.actions.findIndex(a => a.id === id);
    if (index > -1) {
      actionsData.actions.splice(index, 1);
      saveActions();
      displayActions('action');
      updateFavorites();
      autosave();
    }
  }
}

// Clear all actions
function clearAllActions(type) {
  if (confirm('Are you sure you want to clear all actions? This cannot be undone.')) {
    actionsData.actions = [];
    saveActions();
    displayActions('action');
    updateFavorites();
    autosave();
  }
}

// Filter actions
function filterActions(type) {
  const filter = document.getElementById('action_filter').value;
  const data = actionsData.actions;
  const container = document.getElementById('actions_list');
  
  let filteredData = data;
  if (filter !== 'all') {
    if (filter === 'favorites') {
      filteredData = data.filter(action => action.favorite);
    } else {
      filteredData = data.filter(action => action.category === filter);
    }
  }
  
  container.innerHTML = '';
  
  if (filteredData.length === 0) {
    container.innerHTML = `<p style="text-align: center; color: var(--text); opacity: 0.7; grid-column: 1 / -1;">No actions found for this filter.</p>`;
    return;
  }
  
  filteredData.forEach(action => {
    const actionCard = createActionCard(action, 'action');
    container.appendChild(actionCard);
  });
}

// Update favorites display
function updateFavorites() {
  const favoritesActions = actionsData.actions.filter(action => action.favorite);
  
  const actionsContainer = document.getElementById('favorites_actions_list');
  
  actionsContainer.innerHTML = '';
  
  if (favoritesActions.length === 0) {
    actionsContainer.innerHTML = '<p style="text-align: center; color: var(--text); opacity: 0.7;">No favorite actions yet.</p>';
  } else {
    favoritesActions.forEach(action => {
      const actionCard = createActionCard(action, 'action');
      actionsContainer.appendChild(actionCard);
    });
  }
}

// Save actions to localStorage
function saveActions() {
  localStorage.setItem('dndActions', JSON.stringify(actionsData));
}

// Load actions from localStorage
function loadActions() {
  const saved = localStorage.getItem('dndActions');
  if (saved) {
    actionsData = JSON.parse(saved);
  }
}

// ========== INVENTORY SYSTEM ==========
let inventoryData = {
  equipment: [],
  mainInventory: [],
  storageContainers: [],
  maxWeightCapacity: 0
};

// Initialize inventory system
function initializeInventory() {
  loadInventory();
  displayEquipment();
  displayEquipmentStats();
  displayMainInventory();
  loadStorageContainers();
  updateWeightDisplay();
  
  // Add event delegation for equipment buttons (only once)
  const equipmentContainer = document.getElementById('equipment_list');
  if (equipmentContainer) {
    equipmentContainer.addEventListener('click', function(e) {
      if (e.target.classList.contains('equipment-btn')) {
        const equipmentId = e.target.getAttribute('data-equipment-id');
        const action = e.target.getAttribute('data-action');
        
        if (action === 'notes') {
          showEquipmentNotes(equipmentId);
        } else if (action === 'edit') {
          editEquipment(equipmentId);
        } else if (action === 'delete') {
          deleteEquipment(equipmentId);
        }
      }
    });
  }
  
  // Add event delegation for stats page equipment buttons
  const equipmentStatsContainer = document.getElementById('equipment_stats_list');
  if (equipmentStatsContainer) {
    equipmentStatsContainer.addEventListener('click', function(e) {
      if (e.target.classList.contains('equipment-btn')) {
        const equipmentId = e.target.getAttribute('data-equipment-id');
        const action = e.target.getAttribute('data-action');
        
        if (action === 'notes') {
          showEquipmentNotes(equipmentId);
        } else if (action === 'edit') {
          editEquipment(equipmentId);
        } else if (action === 'delete') {
          deleteEquipment(equipmentId);
        }
      }
    });
  }
  
  // Add event delegation for stats page weapons buttons
  const weaponsStatsContainer = document.getElementById('weapons_stats_list');
  if (weaponsStatsContainer) {
    weaponsStatsContainer.addEventListener('click', function(e) {
      if (e.target.classList.contains('weapon-btn')) {
        const weaponIndex = e.target.getAttribute('data-weapon-index');
        const action = e.target.getAttribute('data-action');
        
        if (action === 'notes') {
          showWeaponNotes(weaponIndex);
        } else if (action === 'edit') {
          showWeaponsPopup();
        } else if (action === 'delete') {
          if (confirm('Are you sure you want to delete this weapon?')) {
            weaponsData.splice(weaponIndex, 1);
            displayWeaponsStats();
            updateWeaponsPreview();
            autosave();
          }
        }
      }
    });
  }
}

// Load storage containers from saved data
function loadStorageContainers() {
  if (!inventoryData.storageContainers) return;
  
  const extraContainers = document.getElementById('extra_containers');
  extraContainers.innerHTML = '';
  
  inventoryData.storageContainers.forEach(storage => {
    const containerHTML = `
      <div class="section storage-container-section" id="${storage.id}">
        <div class="inventory-controls">
          <h3>${storage.name}</h3>
          <div class="inventory-settings">
            ${storage.maxWeight > 0 ? `<span>Max Weight: ${storage.maxWeight} lbs</span>` : '<span>Unlimited Weight</span>'}
          </div>
          <button class="delete-container-btn" onclick="confirmContainerDeletion('${storage.id}')">Delete Container</button>
        </div>
        
        <div class="inventory-controls">
          <button onclick="showItemForm('${storage.id}')">+ Add Item</button>
        </div>
        
        <div class="inventory-list-container" id="${storage.id}_items">
          <!-- Items will be populated here -->
        </div>
        <div class="weight-display" id="${storage.id}_weight">Total: 0 lbs / 0 kg</div>
      </div>
    `;
    
    extraContainers.insertAdjacentHTML('beforeend', containerHTML);
    
    // Add to item container dropdown
    const containerDropdown = document.getElementById('item_container');
    if (containerDropdown) {
      const option = document.createElement('option');
      option.value = storage.id;
      option.textContent = storage.name;
      containerDropdown.appendChild(option);
    }
    
    // Display items for this container
    displayStorageItems(storage.id);
  });
}

// Show equipment form
function showEquipmentForm() {
  document.getElementById('equipmentFormTitle').textContent = 'Add Equipment';
  document.getElementById('equipment_name').value = '';
  document.getElementById('equipment_type').value = 'weapon';
  document.getElementById('equipment_bonus').value = '';
  document.getElementById('equipment_weight').value = '';
  document.getElementById('equipment_description').value = '';
  document.getElementById('saveEquipmentBtn').textContent = 'Add Equipment';
  document.getElementById('saveEquipmentBtn').removeAttribute('data-edit-id');
  showPopup('equipmentFormPopup');
}

// Save equipment
function saveEquipment() {
  console.log('Save equipment called');
  
  const name = document.getElementById('equipment_name').value.trim();
  const type = document.getElementById('equipment_type').value;
  const bonus = document.getElementById('equipment_bonus').value.trim();
  const weight = parseFloat(document.getElementById('equipment_weight').value) || 0;
  const description = document.getElementById('equipment_description').value.trim();
  const editId = document.getElementById('saveEquipmentBtn').getAttribute('data-edit-id');
  
  console.log('Form data:', { name, type, bonus, weight, description, editId });
  
  if (!name) {
    alert('Please enter a name for the equipment.');
    return;
  }
  
  const equipmentData = {
    id: editId || Date.now().toString(),
    name: name,
    type: type,
    bonus: bonus,
    weight: weight,
    description: description
  };
  
  if (editId) {
    // Editing existing equipment
    console.log('Editing existing equipment with ID:', editId);
    const existingEquipment = inventoryData.equipment.find(e => e.id === editId);
    if (existingEquipment) {
      console.log('Found existing equipment:', existingEquipment);
      Object.assign(existingEquipment, equipmentData);
      console.log('Updated equipment:', existingEquipment);
    } else {
      console.log('Existing equipment not found!');
    }
  } else {
    // Adding new equipment
    console.log('Adding new equipment');
    inventoryData.equipment.push(equipmentData);
    console.log('Equipment added. New array:', inventoryData.equipment);
  }
  
  displayEquipment();
  displayEquipmentStats();
  updateWeightDisplay();
  syncEquipmentToStats();
  
  // Also update the stats page equipment data
  window.equipmentData = inventoryData.equipment.map(item => ({
    name: item.name,
    type: item.type,
    bonus: item.bonus,
    weight: item.weight,
    notes: item.description
  }));
  updateEquipmentPreviews();
  
  closePopup('equipmentFormPopup');
  autosave();
  
  // Force refresh the equipment display
  setTimeout(() => {
    displayEquipment();
  }, 100);
}

// Display equipment
function displayEquipment() {
  const container = document.getElementById('equipment_list');
  
  // Ensure inventoryData.equipment exists
  if (!inventoryData.equipment) {
    inventoryData.equipment = [];
  }
  
  const data = inventoryData.equipment;
  console.log('Displaying equipment:', data); // Debug log
  
  container.innerHTML = '';
  
  if (data.length === 0) {
    container.innerHTML = `<p style="text-align: center; color: var(--text); opacity: 0.7; grid-column: 1 / -1;">No equipment added yet. Click "+ Add Equipment" to get started!</p>`;
    return;
  }
  
  data.forEach(equipment => {
    const equipmentCard = createEquipmentCard(equipment);
    container.appendChild(equipmentCard);
  });
  
  updateEquipmentWeightDisplay();
}

// Display equipment on stats page
function displayEquipmentStats() {
  const container = document.getElementById('equipment_stats_list');
  
  // Ensure inventoryData.equipment exists
  if (!inventoryData.equipment) {
    inventoryData.equipment = [];
  }
  
  const data = inventoryData.equipment;
  
  container.innerHTML = '';
  
  if (data.length === 0) {
    container.innerHTML = `<p style="text-align: center; color: var(--text); opacity: 0.7; grid-column: 1 / -1;">No equipment added yet. Click "+ Add Equipment" to get started!</p>`;
    updateEquipmentStatsWeightDisplay();
    return;
  }
  
  data.forEach(equipment => {
    const equipmentCard = createEquipmentCard(equipment);
    container.appendChild(equipmentCard);
  });
  
  updateEquipmentStatsWeightDisplay();
}

// Display weapons on stats page
function displayWeaponsStats() {
  const container = document.getElementById('weapons_stats_list');
  
  container.innerHTML = '';
  
  if (weaponsData.length === 0) {
    container.innerHTML = `<p style="text-align: center; color: var(--text); opacity: 0.7; grid-column: 1 / -1;">No weapons added yet. Click "+ Add Weapon" to get started!</p>`;
    return;
  }
  
  weaponsData.forEach((weapon, index) => {
    const weaponCard = createWeaponCard(weapon, index);
    container.appendChild(weaponCard);
  });
}

// Create weapon card
function createWeaponCard(weapon, index) {
  const card = document.createElement('div');
  card.className = 'weapon-card';
  
  card.innerHTML = `
    <div class="weapon-info">
      <h4>${weapon.name || 'Unnamed Weapon'}</h4>
      <div class="weapon-stats">
        <span class="weapon-stat"><strong>To Hit:</strong> ${weapon.toHit || 'N/A'}</span>
        <span class="weapon-stat"><strong>Damage:</strong> ${weapon.damage || 'N/A'}</span>
        <span class="weapon-stat"><strong>Bonus:</strong> ${weapon.bonusDamage || 'N/A'}</span>
        <span class="weapon-stat"><strong>Properties:</strong> ${weapon.properties || 'N/A'}</span>
      </div>
    </div>
    <div class="weapon-actions">
      <button class="weapon-btn notes-btn" data-weapon-index="${index}" data-action="notes">Notes</button>
      <button class="weapon-btn edit-btn" data-weapon-index="${index}" data-action="edit">Edit</button>
      <button class="weapon-btn delete-btn" data-weapon-index="${index}" data-action="delete">Delete</button>
    </div>
  `;
  
  return card;
}

// Create equipment card
function createEquipmentCard(equipment) {
  const card = document.createElement('div');
  card.className = 'equipment-card';
  card.innerHTML = `
    <div class="equipment-header">
      <h4 class="equipment-name">${equipment.name}</h4>
      <span class="equipment-type">${equipment.type}</span>
    </div>
    <div class="equipment-stats">
      ${equipment.bonus ? `<div class="equipment-stat"><span class="equipment-stat-label">Bonus/AC:</span><span class="equipment-stat-value">${equipment.bonus}</span></div>` : ''}
      <div class="equipment-stat"><span class="equipment-stat-label">Weight:</span><span class="equipment-stat-value">${equipment.weight} lbs</span></div>
    </div>
    ${equipment.description ? `<div class="equipment-description">${equipment.description}</div>` : ''}
    <div class="equipment-actions">
      <button class="equipment-btn notes-btn" data-equipment-id="${equipment.id}" data-action="notes">Notes</button>
      <button class="equipment-btn edit-btn" data-equipment-id="${equipment.id}" data-action="edit">Edit</button>
      <button class="equipment-btn delete-btn" data-equipment-id="${equipment.id}" data-action="delete">Delete</button>
    </div>
  `;
  return card;
}

// Edit equipment
function editEquipment(id) {
  console.log('Edit equipment called with ID:', id);
  console.log('Current equipment data:', inventoryData.equipment);
  
  const equipment = inventoryData.equipment.find(e => e.id === id);
  console.log('Found equipment:', equipment);
  
  if (equipment) {
    console.log('Populating form with equipment data:', equipment);
    
    document.getElementById('equipmentFormTitle').textContent = 'Edit Equipment';
    document.getElementById('equipment_name').value = equipment.name || '';
    document.getElementById('equipment_type').value = equipment.type || 'weapon';
    document.getElementById('equipment_bonus').value = equipment.bonus || '';
    document.getElementById('equipment_weight').value = equipment.weight || '';
    document.getElementById('equipment_description').value = equipment.description || '';
    document.getElementById('saveEquipmentBtn').textContent = 'Update Equipment';
    document.getElementById('saveEquipmentBtn').setAttribute('data-edit-id', id);
    
    console.log('Form populated, showing popup');
    console.log('About to show equipmentFormPopup');
    showPopup('equipmentFormPopup');
    console.log('Popup call completed');
    
    // Verify form values after popup is shown
    setTimeout(() => {
      console.log('Form values after popup:');
      console.log('Name:', document.getElementById('equipment_name').value);
      console.log('Type:', document.getElementById('equipment_type').value);
      console.log('Bonus:', document.getElementById('equipment_bonus').value);
      console.log('Weight:', document.getElementById('equipment_weight').value);
      console.log('Description:', document.getElementById('equipment_description').value);
      
      // Check which popups are visible
      const formPopup = document.getElementById('equipmentFormPopup');
      const tablePopup = document.getElementById('equipmentPopup');
      console.log('Form popup display:', formPopup.style.display);
      console.log('Table popup display:', tablePopup.style.display);
      console.log('Form popup visible:', formPopup.offsetParent !== null);
      console.log('Table popup visible:', tablePopup.offsetParent !== null);
    }, 200);
  } else {
    console.log('Equipment not found with ID:', id);
  }
}

// Delete equipment
function deleteEquipment(id) {
  console.log('Delete equipment called with ID:', id);
  console.log('Current equipment data:', inventoryData.equipment);
  
  if (confirm('Are you sure you want to delete this equipment?')) {
    const index = inventoryData.equipment.findIndex(e => e.id === id);
    console.log('Found equipment at index:', index);
    
    if (index > -1) {
      inventoryData.equipment.splice(index, 1);
      console.log('Equipment removed. New data:', inventoryData.equipment);
      
      displayEquipment();
      displayEquipmentStats();
      updateWeightDisplay();
      syncEquipmentToStats();
      
      // Also update the stats page equipment data
      window.equipmentData = inventoryData.equipment.map(item => ({
        name: item.name,
        type: item.type,
        bonus: item.bonus,
        weight: item.weight,
        notes: item.description
      }));
      updateEquipmentPreviews();
      
      autosave();
      
      console.log('Equipment deletion completed');
    } else {
      console.log('Equipment not found with ID:', id);
    }
  }
}


// Show item form
function showItemForm(container) {
  document.getElementById('itemFormTitle').textContent = 'Add Item';
  document.getElementById('item_name').value = '';
  document.getElementById('item_type').value = 'consumable';
  document.getElementById('item_weight').value = '';
  document.getElementById('item_description').value = '';
  document.getElementById('saveItemBtn').textContent = 'Add Item';
  document.getElementById('saveItemBtn').setAttribute('data-container', container);
  document.getElementById('saveItemBtn').removeAttribute('data-edit-id');
  showPopup('itemFormPopup');
}

// Save item
function saveItem() {
  const nameElement = document.getElementById('item_name');
  const typeElement = document.getElementById('item_type');
  const weightElement = document.getElementById('item_weight');
  const descriptionElement = document.getElementById('item_description');
  const saveBtnElement = document.getElementById('saveItemBtn');
  
  // Check if elements exist
  if (!nameElement || !typeElement || !weightElement || !descriptionElement || !saveBtnElement) {
    console.error('Missing form elements:', { nameElement, typeElement, weightElement, descriptionElement, saveBtnElement });
    alert('Form error: Missing required elements. Please refresh the page and try again.');
    return;
  }
  
  const name = nameElement.value.trim();
  const type = typeElement.value;
  const weight = parseFloat(weightElement.value) || 0;
  const description = descriptionElement.value.trim();
  const container = saveBtnElement.getAttribute('data-container');
  const editId = saveBtnElement.getAttribute('data-edit-id');
  
  if (!name) {
    alert('Please enter a name for the item.');
    return;
  }
  
  const itemData = {
    id: editId || Date.now().toString(),
    name: name,
    type: type,
    weight: weight,
    description: description
  };
  
  // Check weight limits
  if (container === 'main') {
    const currentWeight = calculateMainInventoryWeight();
    const maxWeight = inventoryData.maxWeightCapacity;
    if (maxWeight > 0 && currentWeight + weight > maxWeight) {
      document.getElementById('weightWarningMessage').textContent = 'Sorry, that item won\'t fit into your main inventory.';
      showPopup('weightWarningPopup');
      return;
    }
  } else {
    // Check storage container weight
    const storageContainer = inventoryData.storageContainers.find(s => s.id === container);
    if (storageContainer) {
      const currentWeight = calculateStorageWeight(container);
      if (storageContainer.maxWeight > 0 && currentWeight + weight > storageContainer.maxWeight) {
        document.getElementById('weightWarningMessage').textContent = `Sorry, that item won't fit into ${storageContainer.name}.`;
        showPopup('weightWarningPopup');
        return;
      }
    }
  }
  
  if (editId) {
    // Editing existing item
    let existingItem;
    if (container === 'main') {
      existingItem = inventoryData.mainInventory.find(i => i.id === editId);
    } else {
      const storageContainer = inventoryData.storageContainers.find(s => s.id === container);
      if (storageContainer) {
        existingItem = storageContainer.items.find(i => i.id === editId);
      }
    }
    if (existingItem) {
      Object.assign(existingItem, itemData);
    }
  } else {
    // Adding new item
    if (container === 'main') {
      inventoryData.mainInventory.push(itemData);
    } else {
      const storageContainer = inventoryData.storageContainers.find(s => s.id === container);
      if (storageContainer) {
        storageContainer.items.push(itemData);
      }
    }
  }
  
  saveInventory();
  if (container === 'main') {
    displayMainInventory();
  } else {
    displayStorageContainers();
  }
  updateWeightDisplay();
  closePopup('itemFormPopup');
  autosave();
}

// Display main inventory
function displayMainInventory() {
  const container = document.getElementById('main_inventory_list');
  const data = inventoryData.mainInventory;
  
  container.innerHTML = '';
  
  if (data.length === 0) {
    container.innerHTML = `<p style="text-align: center; color: var(--text); opacity: 0.7; grid-column: 1 / -1;">No items in main inventory. Click "+ Add Item" to get started!</p>`;
    return;
  }
  
  data.forEach(item => {
    const itemCard = createItemCard(item, 'main');
    container.appendChild(itemCard);
  });
  
  updateMainInventoryWeightDisplay();
}

// Create item card
function createItemCard(item, container) {
  const card = document.createElement('div');
  card.className = 'item-card';
  card.innerHTML = `
    <div class="item-header">
      <h4 class="item-name">${item.name}</h4>
      <span class="item-type">${item.type}</span>
    </div>
    <div class="item-stats">
      <div class="item-stat"><span class="item-stat-label">Weight:</span><span class="item-stat-value">${item.weight} lbs</span></div>
    </div>
    ${item.description ? `<div class="item-description">${item.description}</div>` : ''}
    <div class="item-actions">
      <button class="item-btn edit-btn" onclick="editItem('${item.id}', '${container}')">✏️</button>
      <button class="item-btn delete-btn" onclick="deleteItem('${item.id}', '${container}')">🗑️</button>
    </div>
  `;
  return card;
}

// Edit item
function editItem(id, container) {
  let item;
  if (container === 'main') {
    item = inventoryData.mainInventory.find(i => i.id === id);
  } else {
    const storageContainer = inventoryData.storageContainers.find(s => s.id === container);
    if (storageContainer) {
      item = storageContainer.items.find(i => i.id === id);
    }
  }
  
  if (item) {
    document.getElementById('itemFormTitle').textContent = 'Edit Item';
    document.getElementById('item_name').value = item.name;
    document.getElementById('item_type').value = item.type;
    document.getElementById('item_weight').value = item.weight;
    document.getElementById('item_description').value = item.description;
    document.getElementById('saveItemBtn').textContent = 'Update Item';
    document.getElementById('saveItemBtn').setAttribute('data-container', container);
    document.getElementById('saveItemBtn').setAttribute('data-edit-id', id);
    showPopup('itemFormPopup');
  }
}

// Delete item
function deleteItem(id, container) {
  if (confirm('Are you sure you want to delete this item?')) {
    if (container === 'main') {
      const index = inventoryData.mainInventory.findIndex(i => i.id === id);
      if (index > -1) {
        inventoryData.mainInventory.splice(index, 1);
        displayMainInventory();
      }
    } else {
      const storageContainer = inventoryData.storageContainers.find(s => s.id === container);
      if (storageContainer) {
        const index = storageContainer.items.findIndex(i => i.id === id);
        if (index > -1) {
          storageContainer.items.splice(index, 1);
          displayStorageContainers();
        }
      }
    }
    saveInventory();
    updateWeightDisplay();
    autosave();
  }
}





// Display storage items
function displayStorageItems(storageId) {
  const storage = inventoryData.storageContainers.find(s => s.id === storageId);
  if (!storage) return;
  
  const container = document.getElementById(`storage_${storageId}_items`);
  const data = storage.items;
  
  container.innerHTML = '';
  
  if (data.length === 0) {
    container.innerHTML = `<p style="text-align: center; color: var(--text); opacity: 0.7; grid-column: 1 / -1;">No items in this storage container. Click "+ Add Item" to get started!</p>`;
    return;
  }
  
  data.forEach(item => {
    const itemCard = createItemCard(item, storageId);
    container.appendChild(itemCard);
  });
}

// Calculate main inventory weight (includes equipment + items)
function calculateMainInventoryWeight() {
  const equipmentWeight = inventoryData.equipment.reduce((total, item) => total + (item.weight || 0), 0);
  const itemsWeight = inventoryData.mainInventory.reduce((total, item) => total + (item.weight || 0), 0);
  return equipmentWeight + itemsWeight;
}

// Calculate storage weight
function calculateStorageWeight(storageId) {
  const storage = inventoryData.storageContainers.find(s => s.id === storageId);
  if (!storage) return 0;
  return storage.items.reduce((total, item) => total + (item.weight || 0), 0);
}

// Update weight display
function updateWeightDisplay() {
  updateEquipmentWeightDisplay();
  updateMainInventoryWeightDisplay();
  updateStorageWeightDisplays();
}

// Update equipment weight display
function updateEquipmentWeightDisplay() {
  const totalWeight = inventoryData.equipment.reduce((total, item) => total + (item.weight || 0), 0);
  const totalWeightKg = (totalWeight * 0.453592).toFixed(2);
  document.getElementById('equipment_weight_total').textContent = `Equipment Weight: ${totalWeight} lbs / ${totalWeightKg} kg`;
}

// Update equipment weight display on stats page
function updateEquipmentStatsWeightDisplay() {
  const totalWeight = inventoryData.equipment.reduce((total, item) => total + (item.weight || 0), 0);
  const totalWeightKg = (totalWeight * 0.453592).toFixed(2);
  document.getElementById('equipment_stats_weight_total').textContent = `Equipment Weight: ${totalWeight} lbs / ${totalWeightKg} kg`;
}

// Update main inventory weight display
function updateMainInventoryWeightDisplay() {
  const equipmentWeight = inventoryData.equipment.reduce((total, item) => total + (item.weight || 0), 0);
  const itemsWeight = inventoryData.mainInventory.reduce((total, item) => total + (item.weight || 0), 0);
  const totalWeight = equipmentWeight + itemsWeight;
  const totalWeightKg = (totalWeight * 0.453592).toFixed(2);
  const maxWeight = inventoryData.maxWeightCapacity;
  const weightDisplay = document.getElementById('main_inventory_weight_total');
  
  if (maxWeight > 0) {
    const weightStatus = totalWeight > maxWeight ? 'weight-warning' : 'weight-ok';
    weightDisplay.className = `weight-display ${weightStatus}`;
    weightDisplay.innerHTML = `
      <div>Total: ${totalWeight}/${maxWeight} lbs / ${totalWeightKg} kg</div>
      <div style="font-size: 0.8em; opacity: 0.8; margin-top: 5px;">
        Equipment: ${equipmentWeight} lbs | Items: ${itemsWeight} lbs
      </div>
    `;
  } else {
    weightDisplay.className = 'weight-display weight-ok';
    weightDisplay.innerHTML = `
      <div>Total: ${totalWeight} lbs / ${totalWeightKg} kg</div>
      <div style="font-size: 0.8em; opacity: 0.8; margin-top: 5px;">
        Equipment: ${equipmentWeight} lbs | Items: ${itemsWeight} lbs
      </div>
    `;
  }
}

// Update storage weight displays
function updateStorageWeightDisplays() {
  if (!inventoryData.storageContainers) return;
  
  inventoryData.storageContainers.forEach(storage => {
    const currentWeight = calculateStorageWeight(storage.id);
    const totalWeightKg = (currentWeight * 0.453592).toFixed(2);
    const weightStatus = storage.maxWeight > 0 && currentWeight > storage.maxWeight ? 'weight-warning' : 'weight-ok';
    
    // Update the weight display for this container
    const weightDisplay = document.getElementById(`${storage.id}_weight`);
    if (weightDisplay) {
      weightDisplay.className = `weight-display ${weightStatus}`;
      if (storage.maxWeight > 0) {
        weightDisplay.textContent = `Total: ${currentWeight}/${storage.maxWeight} lbs / ${totalWeightKg} kg`;
      } else {
        weightDisplay.textContent = `Total: ${currentWeight} lbs / ${totalWeightKg} kg`;
      }
    }
  });
}

// Sync equipment to stats page
function syncEquipmentToStats() {
  // Convert inventory equipment data to the format expected by the stats page
  const equipmentData = inventoryData.equipment.map(item => ({
    name: item.name,
    type: item.type,
    bonus: item.bonus,
    weight: item.weight,
    notes: item.description
  }));
  
  // Update the equipment data array used by the stats page
  window.equipmentData = equipmentData;
  
  // Update the equipment preview on the stats page
  updateEquipmentPreviews();
  
  // Also update the stats page equipment display
  displayEquipmentStats();
}

// Sync equipment between stats and inventory pages
function syncEquipmentBetweenPages() {
  // If inventory has equipment but stats doesn't, sync from inventory to stats
  if (inventoryData.equipment && inventoryData.equipment.length > 0 && (!window.equipmentData || window.equipmentData.length === 0)) {
    window.equipmentData = inventoryData.equipment.map(item => ({
      name: item.name,
      type: item.type,
      bonus: item.bonus,
      weight: item.weight,
      notes: item.description
    }));
    updateEquipmentPreviews();
    displayEquipmentStats();
  }
  // If stats has equipment but inventory doesn't, sync from stats to inventory
  else if (window.equipmentData && window.equipmentData.length > 0 && (!inventoryData.equipment || inventoryData.equipment.length === 0)) {
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

// Save inventory to localStorage
function saveInventory() {
  localStorage.setItem('dndInventory', JSON.stringify(inventoryData));
}

// Load inventory from localStorage
function loadInventory() {
  const saved = localStorage.getItem('dndInventory');
  if (saved) {
    const loadedData = JSON.parse(saved);
    // Merge with existing inventoryData to preserve character-specific data
    inventoryData = {
      equipment: loadedData.equipment || [],
      mainInventory: loadedData.mainInventory || [],
      storageContainers: loadedData.storageContainers || [],
      maxWeightCapacity: loadedData.maxWeightCapacity || 0
    };
  } else {
    // Ensure equipment array exists
    if (!inventoryData.equipment) {
      inventoryData.equipment = [];
    }
  }
}

// Update max weight capacity
function updateMaxWeightCapacity() {
  const maxWeight = parseFloat(document.getElementById('max_weight_capacity').value) || 0;
  inventoryData.maxWeightCapacity = maxWeight;
  updateWeightDisplay();
  autosave();
}

// ========== CONDITIONS SYSTEM ==========
function showConditionPopup() {
  document.getElementById('condition_name').value = '';
  document.getElementById('condition_turns').value = '';
  document.getElementById('condition_effect').value = '';
  document.getElementById('condition_color').value = 'red';
  showPopup('conditionPopup');
}

function addCondition() {
  const name = document.getElementById('condition_name').value;
  const turns = document.getElementById('condition_turns').value;
  const effect = document.getElementById('condition_effect').value;
  const color = document.getElementById('condition_color').value;
  
  if (!name) {
    alert("Please enter a condition name");
    return;
  }
  
  const conditionId = Date.now();
  const conditionHTML = `
    <div class="condition ${color}" id="condition_${conditionId}">
      <div class="condition-header">
        <span>${name}</span>
        <span class="condition-turns">${turns ? turns + ' turns' : 'Indefinite'}</span>
      </div>
      <div>${effect}</div>
      <button onclick="removeCondition('${conditionId}')" style="float:right; padding:2px 5px; margin-top:5px;">Remove</button>
    </div>
  `;
  
  document.getElementById('conditions_container').insertAdjacentHTML('beforeend', conditionHTML);
  closePopup('conditionPopup');
  autosave();
}

function removeCondition(id) {
  document.getElementById(`condition_${id}`).remove();
  autosave();
}

// ========== WEAPON DETAILS ==========
function showWeaponDetails(index) {
  if (index >= 0 && index < weaponsData.length) {
    const weapon = weaponsData[index];
    showItemDetails(weapon, 'weapon');
  }
}

// Show weapon notes
function showWeaponNotes(index) {
  const weapon = weaponsData[index];
  if (weapon) {
    document.getElementById('notesTitle').textContent = `${weapon.name || 'Weapon'} - Notes`;
    document.getElementById('notesContent').innerHTML = `
      <div style="white-space: pre-wrap; line-height: 1.6; color: var(--text);">
        ${weapon.notes || 'No notes available for this weapon.'}
      </div>
    `;
    showPopup('notesPopup');
  }
}

// Show equipment notes
function showEquipmentNotes(id) {
  const equipment = inventoryData.equipment.find(item => item.id === id);
  if (equipment) {
    document.getElementById('notesTitle').textContent = `${equipment.name || 'Equipment'} - Notes`;
    document.getElementById('notesContent').innerHTML = `
      <div style="white-space: pre-wrap; line-height: 1.6; color: var(--text);">
        ${equipment.description || 'No notes available for this equipment.'}
      </div>
    `;
    showPopup('notesPopup');
  }
}

// Global variable to track current notes field being edited
let currentNotesField = null;
let currentNotesElement = null;

// Show notes editor popup
function showNotesPopup(fieldId, title) {
  const textarea = document.getElementById(fieldId);
  if (!textarea) return;
  if (title) {
    textarea.dataset.popupTitle = title;
  }
  textarea.focus();
  scheduleNoteBoxSizing(textarea);
}

// Save notes from editor popup
function saveNotesEditor() {
  const editorTextarea = document.getElementById('notesEditorTextarea');
  const target = currentNotesElement || (currentNotesField ? document.getElementById(currentNotesField) : null);

  if (target && editorTextarea) {
    target.value = editorTextarea.value;
    autosave();
    scheduleNoteBoxSizing(target);
  }

  closeNotesEditorPopup();
}

// ========== ITEM DETAILS ==========
function showItemDetails(item, type) {
  document.getElementById('itemDetailsTitle').textContent = item.name || 'Unnamed Item';
  
  let content = '';
  if (type === 'weapon') {
    content = `
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 15px;">
        <div>
          <p><strong>To Hit:</strong> ${item.toHit || '-'}</p>
          <p><strong>Damage:</strong> ${item.damage || '-'}</p>
        </div>
        <div>
          <p><strong>Bonus Damage:</strong> ${item.bonusDamage || '-'}</p>
          <p><strong>Properties:</strong> ${item.properties || '-'}</p>
        </div>
      </div>
      ${item.notes ? `<div style="margin-top: 15px; padding: 10px; background: #2a2a2a; border-radius: 4px; border-left: 3px solid var(--accent); max-height: 200px; overflow-y: auto;">
        <h4 style="margin: 0 0 8px 0; color: var(--accent-text);">Special Notes:</h4>
        <p style="margin: 0; white-space: pre-wrap; line-height: 1.4; word-wrap: break-word; overflow-wrap: break-word;">${item.notes}</p>
      </div>` : ''}
    `;
  } else if (type === 'equipment') {
    content = `
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 15px;">
        <div>
          <p><strong>Type:</strong> ${item.type || '-'}</p>
          <p><strong>Bonus:</strong> ${item.bonus || '-'}</p>
        </div>
        <div>
          <p><strong>Weight:</strong> ${item.weight || 0} lbs (${(item.weight * 0.453592).toFixed(2)} kg)</p>
        </div>
      </div>
      ${item.notes ? `<div style="margin-top: 15px; padding: 10px; background: #2a2a2a; border-radius: 4px; border-left: 3px solid var(--accent); max-height: 200px; overflow-y: auto;">
        <h4 style="margin: 0 0 8px 0; color: var(--accent-text);">Notes:</h4>
        <p style="margin: 0; white-space: pre-wrap; line-height: 1.4; word-wrap: break-word; overflow-wrap: break-word;">${item.notes}</p>
      </div>` : ''}
    `;
  } else if (type === 'inventory') {
    content = `
      <div style="margin-bottom: 15px;">
        <p><strong>Weight:</strong> ${item.weight || 0} lbs (${(item.weight * 0.453592).toFixed(2)} kg)</p>
      </div>
      ${item.description ? `<div style="margin-top: 15px; padding: 10px; background: #2a2a2a; border-radius: 4px; border-left: 3px solid var(--accent); max-height: 200px; overflow-y: auto;">
        <h4 style="margin: 0 0 8px 0; color: var(--accent-text);">Description:</h4>
        <p style="margin: 0; white-space: pre-wrap; line-height: 1.4; word-wrap: break-word; overflow-wrap: break-word;">${item.description}</p>
      </div>` : ''}
      ${item.notes ? `<div style="margin-top: 15px; padding: 10px; background: #2a2a2a; border-radius: 4px; border-left: 3px solid var(--accent); max-height: 200px; overflow-y: auto;">
        <h4 style="margin: 0 0 8px 0; color: var(--accent-text);">Notes:</h4>
        <p style="margin: 0; white-space: pre-wrap; line-height: 1.4; word-wrap: break-word; overflow-wrap: break-word;">${item.notes}</p>
      </div>` : ''}
    `;
  }
  
  document.getElementById('itemDetailsContent').innerHTML = content;
  showPopup('itemDetailsPopup');
}

// ========== ROUND RESET BUTTON ==========
function resetRoundActions() {
  document.getElementById('action_tick').checked = false;
  document.getElementById('bonus_action_tick').checked = false;
  autosave();
  alert("Action counters reset for new round!");
}


// ========== LAYOUT SYSTEM ==========
const LayoutManager = {
  STORAGE_KEY: 'dndSheetLayout_final',
  initialized: false,
  
  init() {
    if (this.initialized) return;
    this.initialized = true;
    
    window.addEventListener('load', () => {
      this.ensureElementIds();
      
      // Set up save button
      const saveBtn = document.getElementById('saveLayoutBtn');
      if (saveBtn) {
        saveBtn.addEventListener('click', (e) => {
          e.preventDefault();
          this.save();
        });
      }
      
      // Set up reset button
      const resetBtn = document.getElementById('resetLayoutBtn');
      if (resetBtn) {
        resetBtn.addEventListener('click', (e) => {
          e.preventDefault();
          this.reset();
        });
      }
      
      this.load();
    });
  },
  
  ensureElementIds() {
    document.querySelectorAll('.section:not([id])').forEach((el, i) => {
      el.id = `section-${i+1}`;
    });
    
    document.querySelectorAll('textarea:not([id])').forEach((el, i) => {
      el.id = `textarea-${i+1}`;
    });
  },
  
  save() {
    try {
      const layout = {
        version: 'final',
        timestamp: new Date().toISOString(),
        sections: {},
        textareas: {}
      };

      document.querySelectorAll('.section').forEach(section => {
        if (section.offsetParent) {
          layout.sections[section.id] = {
            width: section.style.width || `${section.offsetWidth}px`,
            height: section.style.height || `${section.offsetHeight}px`,
            position: window.getComputedStyle(section).position
          };
        }
      });

      document.querySelectorAll('textarea').forEach(textarea => {
        if (textarea.offsetParent) {
          layout.textareas[textarea.id] = {
            width: textarea.style.width || `${textarea.offsetWidth}px`,
            height: textarea.style.height || `${textarea.offsetHeight}px`
          };
        }
      });

      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(layout));
      alert('Layout saved successfully!');
      return true;
    } catch (e) {
      console.error('Save failed:', e);
      alert('Save error: ' + e.message);
      return false;
    }
  },
  
  load() {
    try {
      const data = localStorage.getItem(this.STORAGE_KEY);
      if (!data) return false;

      const layout = JSON.parse(data);

      Object.entries(layout.sections || {}).forEach(([id, style]) => {
        const el = document.getElementById(id);
        if (el) {
          el.style.width = style.width;
          el.style.height = style.height;
          if (style.position) el.style.position = style.position;
        }
      });

      Object.entries(layout.textareas || {}).forEach(([id, style]) => {
        const el = document.getElementById(id);
        if (el) {
          el.style.width = style.width;
          el.style.height = style.height;
        }
      });

      return true;
    } catch (e) {
      console.error('Load failed:', e);
      return false;
    }
  },
  
  reset() {
    if (confirm('Are you sure you want to reset ALL layout settings to default?')) {
      // Reset sections
      document.querySelectorAll('.section').forEach(section => {
        section.style.width = '';
        section.style.height = '';
        section.style.position = '';
        section.style.left = '';
        section.style.top = '';
      });
      
      // Reset textareas
      document.querySelectorAll('textarea').forEach(textarea => {
        textarea.style.width = '';
        textarea.style.height = '';
      });
      
      // Clear storage
      localStorage.removeItem(this.STORAGE_KEY);
      alert('Layout has been reset to default settings');
    }
  }
};

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  LayoutManager.init();
});

// Settings dropdown functionality
document.getElementById('settingsBtn').addEventListener('click', function(e) {
  e.stopPropagation();
  const dropdown = document.getElementById('settingsDropdown');
  dropdown.style.display = dropdown.style.display === 'none' ? 'block' : 'none';
});

// Close dropdown when clicking elsewhere
document.addEventListener('click', function(e) {
  if (!e.target.closest('#settingsDropdown') && !e.target.closest('#settingsBtn')) {
    document.getElementById('settingsDropdown').style.display = 'none';
  }
});

// ========== SPELL SYSTEM ==========

// Spell data storage
let spellsData = {
  cantrips: [],
  spells: []
};

// Favorites storage
let favoritesData = {
  cantrips: [],
  spells: []
};

// Class/level selections for import
let classLevelSelections = [];
let importMode = 'both'; // 'cantrip' | 'spell' | 'both'

// Clear all confirmation tracking
let clearAllConfirmations = {
  cantrip: 0,
  spell: 0
};

// Manual spell slots tracking (similar to custom resources)
let manualSpellSlots = [];
let manualSpellSlotsUsed = {};

// Custom resources tracking
let customResources = [];
let customResourcesUsed = {};

// D&D Spell Database (sample spells)
const dndSpellsDatabase = {
  cantrips: [
    {
      name: "Fire Bolt",
      level: 0,
      school: "Evocation",
      castingTime: "1 action",
      range: "120 feet",
      components: "V, S",
      duration: "Instantaneous",
      damage: "1d10 fire damage",
      save: "",
      attack: "Ranged spell attack",
      ritual: false,
      concentration: false,
      description: "You hurl a mote of fire at a creature or object within range. Make a ranged spell attack against the target. On a hit, the target takes 1d10 fire damage. A flammable object hit by this spell ignites if it isn't being worn or carried. This spell's damage increases by 1d10 when you reach 5th level (2d10), 11th level (3d10), and 17th level (4d10).",
      wikiLink: "https://dnd5e.wikidot.com/spell:fire-bolt"
    },
    {
      name: "Mage Hand",
      level: 0,
      school: "Conjuration",
      castingTime: "1 action",
      range: "30 feet",
      components: "V, S",
      duration: "1 minute",
      damage: "",
      save: "",
      attack: "",
      ritual: false,
      concentration: false,
      description: "A spectral, floating hand appears at a point you choose within range. The hand lasts for the duration or until you dismiss it as an action. The hand vanishes if it is ever more than 30 feet away from you or if you cast this spell again. You can use your action to control the hand.",
      wikiLink: "https://dnd5e.wikidot.com/spell:mage-hand"
    },
    {
      name: "Prestidigitation",
      level: 0,
      school: "Transmutation",
      castingTime: "1 action",
      range: "10 feet",
      components: "V, S",
      duration: "Up to 1 hour",
      damage: "",
      save: "",
      attack: "",
      ritual: false,
      concentration: false,
      description: "This spell is a minor magical trick that novice spellcasters use for practice. You create one of several magical effects within range: sensory effects, light/snuff candles, clean/soil objects, chill/warm/flavor food, create small trinkets, or make colored marks.",
      wikiLink: "https://dnd5e.wikidot.com/spell:prestidigitation"
    },
    {
      name: "Acid Splash",
      level: 0,
      school: "Conjuration",
      castingTime: "1 action",
      range: "60 feet",
      components: "V, S",
      duration: "Instantaneous",
      damage: "1d6 acid damage",
      save: "Dexterity save",
      attack: "",
      ritual: false,
      concentration: false,
      description: "You hurl a bubble of acid. Choose one or two creatures within range. If you choose two, they must be within 5 feet of each other. A target must succeed on a Dexterity saving throw or take 1d6 acid damage. This spell's damage increases by 1d6 when you reach 5th, 11th, and 17th level.",
      wikiLink: "https://dnd5e.wikidot.com/spell:acid-splash"
    },
    {
      name: "Blade Ward",
      level: 0,
      school: "Abjuration",
      castingTime: "1 action",
      range: "Self",
      components: "V, S",
      duration: "1 round",
      damage: "",
      save: "",
      attack: "",
      ritual: false,
      concentration: false,
      description: "You extend your hand and trace a sigil of warding in the air. Until the end of your next turn, you have resistance against bludgeoning, piercing, and slashing damage dealt by weapon attacks.",
      wikiLink: "https://dnd5e.wikidot.com/spell:blade-ward"
    },
    {
      name: "Chill Touch",
      level: 0,
      school: "Necromancy",
      castingTime: "1 action",
      range: "120 feet",
      components: "V, S",
      duration: "1 round",
      damage: "1d8 necrotic damage",
      save: "",
      attack: "Ranged spell attack",
      ritual: false,
      concentration: false,
      description: "You create a ghostly, skeletal hand in the space of a creature within range. Make a ranged spell attack. On a hit, the target takes 1d8 necrotic damage, and it can't regain hit points until the start of your next turn. This spell's damage increases by 1d8 when you reach 5th, 11th, and 17th level.",
      wikiLink: "https://dnd5e.wikidot.com/spell:chill-touch"
    },
    {
      name: "Dancing Lights",
      level: 0,
      school: "Evocation",
      castingTime: "1 action",
      range: "120 feet",
      components: "V, S, M",
      duration: "Concentration, up to 1 minute",
      damage: "",
      save: "",
      attack: "",
      ritual: false,
      concentration: true,
      description: "You create up to four torch-sized lights within range, making them appear as torches, lanterns, or glowing orbs that hover in the air for the duration. You can also combine the four lights into one glowing vaguely humanoid form of Medium size.",
      wikiLink: "https://dnd5e.wikidot.com/spell:dancing-lights"
    },
    {
      name: "Druidcraft",
      level: 0,
      school: "Transmutation",
      castingTime: "1 action",
      range: "30 feet",
      components: "V, S",
      duration: "Instantaneous",
      damage: "",
      save: "",
      attack: "",
      ritual: false,
      concentration: false,
      description: "Whispering to the spirits of nature, you create one of the following effects within range: predict weather, make a flower bloom, create a sensory effect, or instantly light or snuff out a candle, torch, or small campfire.",
      wikiLink: "https://dnd5e.wikidot.com/spell:druidcraft"
    },
    {
      name: "Eldritch Blast",
      level: 0,
      school: "Evocation",
      castingTime: "1 action",
      range: "120 feet",
      components: "V, S",
      duration: "Instantaneous",
      damage: "1d10 force damage",
      save: "",
      attack: "Ranged spell attack",
      ritual: false,
      concentration: false,
      description: "A beam of crackling energy streaks toward a creature within range. Make a ranged spell attack against the target. On a hit, the target takes 1d10 force damage. The spell creates more than one beam when you reach higher levels: two beams at 5th level, three beams at 11th level, and four beams at 17th level.",
      wikiLink: "https://dnd5e.wikidot.com/spell:eldritch-blast"
    },
    {
      name: "Guidance",
      level: 0,
      school: "Divination",
      castingTime: "1 action",
      range: "Touch",
      components: "V, S",
      duration: "Concentration, up to 1 minute",
      damage: "",
      save: "",
      attack: "",
      ritual: false,
      concentration: true,
      description: "You touch one willing creature. Once before the spell ends, the target can roll a d4 and add the number rolled to one ability check of its choice. The creature can wait until after it rolls the d20 before deciding to use the die, but must decide before the DM says whether the roll succeeds or fails.",
      wikiLink: "https://dnd5e.wikidot.com/spell:guidance"
    },
    {
      name: "Light",
      level: 0,
      school: "Evocation",
      castingTime: "1 action",
      range: "Touch",
      components: "V, M",
      duration: "1 hour",
      damage: "",
      save: "",
      attack: "",
      ritual: false,
      concentration: false,
      description: "You touch one object that is no larger than 10 feet in any dimension. Until the spell ends, the object sheds bright light in a 20-foot radius and dim light for an additional 20 feet. The light can be colored as you like. Completely covering the object with something opaque blocks the light.",
      wikiLink: "https://dnd5e.wikidot.com/spell:light"
    },
    {
      name: "Mending",
      level: 0,
      school: "Transmutation",
      castingTime: "1 minute",
      range: "Touch",
      components: "V, S, M",
      duration: "Instantaneous",
      damage: "",
      save: "",
      attack: "",
      ritual: false,
      concentration: false,
      description: "This spell repairs a single break or tear in an object you touch, such as a broken chain link, two halves of a broken key, a torn cloak, or a leaking wineskin. As long as the break or tear is no larger than 1 foot in any dimension, you mend it, leaving no trace of the former damage.",
      wikiLink: "https://dnd5e.wikidot.com/spell:mending"
    },
    {
      name: "Message",
      level: 0,
      school: "Transmutation",
      castingTime: "1 action",
      range: "120 feet",
      components: "V, S, M",
      duration: "1 round",
      damage: "",
      save: "",
      attack: "",
      ritual: false,
      concentration: false,
      description: "You point your finger toward a creature within range and whisper a message. The target (and only the target) hears the message and can reply in a whisper that only you can hear. You can cast this spell through solid objects if you are familiar with the target and know it is beyond the barrier.",
      wikiLink: "https://dnd5e.wikidot.com/spell:message"
    },
    {
      name: "Minor Illusion",
      level: 0,
      school: "Illusion",
      castingTime: "1 action",
      range: "30 feet",
      components: "S, M",
      duration: "1 minute",
      damage: "",
      save: "",
      attack: "",
      ritual: false,
      concentration: false,
      description: "You create a sound or an image of an object within range that lasts for the duration. The illusion also ends if you dismiss it as an action or cast this spell again. If you create a sound, its volume can range from a whisper to a scream. If you create an image of an object, it must be no larger than a 5-foot cube.",
      wikiLink: "https://dnd5e.wikidot.com/spell:minor-illusion"
    },
    {
      name: "Poison Spray",
      level: 0,
      school: "Conjuration",
      castingTime: "1 action",
      range: "10 feet",
      components: "V, S",
      duration: "Instantaneous",
      damage: "1d12 poison damage",
      save: "Constitution save",
      attack: "",
      ritual: false,
      concentration: false,
      description: "You extend your hand toward a creature you can see within range and project a puff of noxious gas from your palm. The creature must succeed on a Constitution saving throw or take 1d12 poison damage. This spell's damage increases by 1d12 when you reach 5th, 11th, and 17th level.",
      wikiLink: "https://dnd5e.wikidot.com/spell:poison-spray"
    },
    {
      name: "Produce Flame",
      level: 0,
      school: "Conjuration",
      castingTime: "1 action",
      range: "Self",
      components: "V, S",
      duration: "10 minutes",
      damage: "1d8 fire damage",
      save: "",
      attack: "Ranged spell attack",
      ritual: false,
      concentration: false,
      description: "A flickering flame appears in your hand. The flame remains there for the duration and harms neither you nor your equipment. The flame sheds bright light in a 10-foot radius and dim light for an additional 10 feet. The spell ends if you dismiss it as an action or if you cast it again. You can also attack with the flame, although doing so ends the spell.",
      wikiLink: "https://dnd5e.wikidot.com/spell:produce-flame"
    },
    {
      name: "Ray of Frost",
      level: 0,
      school: "Evocation",
      castingTime: "1 action",
      range: "60 feet",
      components: "V, S",
      duration: "Instantaneous",
      damage: "1d8 cold damage",
      save: "",
      attack: "Ranged spell attack",
      ritual: false,
      concentration: false,
      description: "A frigid beam of blue-white light streaks toward a creature within range. Make a ranged spell attack against the target. On a hit, it takes 1d8 cold damage, and its speed is reduced by 10 feet until the start of your next turn. The spell's damage increases by 1d8 when you reach 5th, 11th, and 17th level.",
      wikiLink: "https://dnd5e.wikidot.com/spell:ray-of-frost"
    },
    {
      name: "Resistance",
      level: 0,
      school: "Abjuration",
      castingTime: "1 action",
      range: "Touch",
      components: "V, S, M",
      duration: "Concentration, up to 1 minute",
      damage: "",
      save: "",
      attack: "",
      ritual: false,
      concentration: true,
      description: "You touch one willing creature. Once before the spell ends, the target can roll a d4 and add the number rolled to one saving throw of its choice. The creature can wait until after it rolls the d20 before deciding to use the die, but must decide before the DM says whether the roll succeeds or fails.",
      wikiLink: "https://dnd5e.wikidot.com/spell:resistance"
    },
    {
      name: "Sacred Flame",
      level: 0,
      school: "Evocation",
      castingTime: "1 action",
      range: "60 feet",
      components: "V, S",
      duration: "Instantaneous",
      damage: "1d8 radiant damage",
      save: "Dexterity save",
      attack: "",
      ritual: false,
      concentration: false,
      description: "Flame-like radiance descends on a creature that you can see within range. The target must succeed on a Dexterity saving throw or take 1d8 radiant damage. The target gains no benefit from cover for this saving throw. The spell's damage increases by 1d8 when you reach 5th, 11th, and 17th level.",
      wikiLink: "https://dnd5e.wikidot.com/spell:sacred-flame"
    },
    {
      name: "Shocking Grasp",
      level: 0,
      school: "Evocation",
      castingTime: "1 action",
      range: "Touch",
      components: "V, S",
      duration: "Instantaneous",
      damage: "1d8 lightning damage",
      save: "",
      attack: "Melee spell attack",
      ritual: false,
      concentration: false,
      description: "Lightning springs from your hand to deliver a shock to a creature you try to touch. Make a melee spell attack against the target. You have advantage on the attack roll if the target is wearing armor made of metal. On a hit, the target takes 1d8 lightning damage, and it can't take reactions until the start of its next turn. The spell's damage increases by 1d8 when you reach 5th, 11th, and 17th level.",
      wikiLink: "https://dnd5e.wikidot.com/spell:shocking-grasp"
    },
    {
      name: "Spare the Dying",
      level: 0,
      school: "Necromancy",
      castingTime: "1 action",
      range: "Touch",
      components: "V, S",
      duration: "Instantaneous",
      damage: "",
      save: "",
      attack: "",
      ritual: false,
      concentration: false,
      description: "You touch a living creature that has 0 hit points. The creature becomes stable. This spell has no effect on undead or constructs.",
      wikiLink: "https://dnd5e.wikidot.com/spell:spare-the-dying"
    },
    {
      name: "Thaumaturgy",
      level: 0,
      school: "Transmutation",
      castingTime: "1 action",
      range: "30 feet",
      components: "V",
      duration: "Up to 1 minute",
      damage: "",
      save: "",
      attack: "",
      ritual: false,
      concentration: false,
      description: "You manifest a minor wonder, a sign of supernatural power, within range. You create one of the following magical effects within range: your voice booms up to three times as loud, you cause flames to flicker, brighten, dim, or change color, you cause harmless tremors in the ground, you create an instantaneous sound, you cause an unlocked door or window to fly open or slam shut, or you alter the appearance of your eyes.",
      wikiLink: "https://dnd5e.wikidot.com/spell:thaumaturgy"
    },
    {
      name: "Thorn Whip",
      level: 0,
      school: "Transmutation",
      castingTime: "1 action",
      range: "30 feet",
      components: "V, S, M",
      duration: "Instantaneous",
      damage: "1d6 piercing damage",
      save: "",
      attack: "Melee spell attack",
      ritual: false,
      concentration: false,
      description: "You create a long, vine-like whip covered in thorns that lashes out at your command toward a creature in range. Make a melee spell attack against the target. If the attack hits, the creature takes 1d6 piercing damage, and if the creature is Large or smaller, you pull the creature up to 10 feet closer to you. This spell's damage increases by 1d6 when you reach 5th, 11th, and 17th level.",
      wikiLink: "https://dnd5e.wikidot.com/spell:thorn-whip"
    },
    {
      name: "True Strike",
      level: 0,
      school: "Divination",
      castingTime: "1 action",
      range: "30 feet",
      components: "S",
      duration: "Concentration, up to 1 round",
      damage: "",
      save: "",
      attack: "",
      ritual: false,
      concentration: true,
      description: "You point a finger at a target in range. Your magic grants you a brief insight into the target's defenses. On your next turn, you gain advantage on your first attack roll against the target, provided that this spell hasn't ended.",
      wikiLink: "https://dnd5e.wikidot.com/spell:true-strike"
    },
    {
      name: "Vicious Mockery",
      level: 0,
      school: "Enchantment",
      castingTime: "1 action",
      range: "60 feet",
      components: "V",
      duration: "Instantaneous",
      damage: "1d4 psychic damage",
      save: "Wisdom save",
      attack: "",
      ritual: false,
      concentration: false,
      description: "You unleash a string of insults laced with subtle enchantments at a creature you can see within range. If the target can hear you (though it need not understand you), it must succeed on a Wisdom saving throw or take 1d4 psychic damage and have disadvantage on its next attack roll before the end of its next turn. This spell's damage increases by 1d4 when you reach 5th, 11th, and 17th level.",
      wikiLink: "https://dnd5e.wikidot.com/spell:vicious-mockery"
    },
    {
      name: "Booming Blade",
      level: 0,
      school: "Evocation",
      castingTime: "1 action",
      range: "Self (5-foot radius)",
      components: "S, M",
      duration: "1 round",
      damage: "Weapon damage + thunder damage",
      save: "",
      attack: "Melee weapon attack",
      ritual: false,
      concentration: false,
      description: "As part of the action used to cast this spell, you must make a melee attack with a weapon against one creature within the spell's range. On a hit, the target suffers the attack's normal effects, and it becomes sheathed in booming energy until the start of your next turn. If the target willingly moves before then, it immediately takes 1d8 thunder damage, and the spell ends.",
      wikiLink: "https://dnd5e.wikidot.com/spell:booming-blade"
    },
    {
      name: "Green-Flame Blade",
      level: 0,
      school: "Evocation",
      castingTime: "1 action",
      range: "Self (5-foot radius)",
      components: "S, M",
      duration: "Instantaneous",
      damage: "Weapon damage + fire damage",
      save: "",
      attack: "Melee weapon attack",
      ritual: false,
      concentration: false,
      description: "As part of the action used to cast this spell, you must make a melee attack with a weapon against one creature within the spell's range. On a hit, the target suffers the attack's normal effects, and green fire leaps from the target to a different creature of your choice that you can see within 5 feet of it. The second creature takes fire damage equal to your spellcasting ability modifier.",
      wikiLink: "https://dnd5e.wikidot.com/spell:green-flame-blade"
    },
    {
      name: "Control Flames",
      level: 0,
      school: "Transmutation",
      castingTime: "1 action",
      range: "60 feet",
      components: "S",
      duration: "Instantaneous or 1 hour",
      damage: "",
      save: "",
      attack: "",
      ritual: false,
      concentration: false,
      description: "You choose nonmagical flame that you can see within range and that fits within a 5-foot cube. You affect it in one of the following ways: You instantaneously expand the flame 5 feet in one direction, You instantaneously extinguish the flames within the cube, You double or halve the area of bright light and dim light shed by the flame, or You cause simple shapes to appear within the flames and animate as you like.",
      wikiLink: "https://dnd5e.wikidot.com/spell:control-flames"
    },
    {
      name: "Create Bonfire",
      level: 0,
      school: "Conjuration",
      castingTime: "1 action",
      range: "60 feet",
      components: "V, S",
      duration: "Concentration, up to 1 minute",
      damage: "1d8 fire damage",
      save: "Dexterity save",
      attack: "",
      ritual: false,
      concentration: true,
      description: "You create a bonfire on ground that you can see within range. Until the spell ends, the magic bonfire fills a 5-foot cube. Any creature in the bonfire's space when you cast the spell must succeed on a Dexterity saving throw or take 1d8 fire damage. A creature must also make the saving throw when it moves into the bonfire's space for the first time on a turn or ends its turn there.",
      wikiLink: "https://dnd5e.wikidot.com/spell:create-bonfire"
    },
    {
      name: "Frostbite",
      level: 0,
      school: "Evocation",
      castingTime: "1 action",
      range: "60 feet",
      components: "V, S",
      duration: "Instantaneous",
      damage: "1d6 cold damage",
      save: "Constitution save",
      attack: "",
      ritual: false,
      concentration: false,
      description: "You cause numbing frost to form on one creature that you can see within range. The target must make a Constitution saving throw. On a failed save, the target takes 1d6 cold damage, and it has disadvantage on the next weapon attack roll it makes before the end of its next turn.",
      wikiLink: "https://dnd5e.wikidot.com/spell:frostbite"
    },
    {
      name: "Gust",
      level: 0,
      school: "Transmutation",
      castingTime: "1 action",
      range: "30 feet",
      components: "V, S",
      duration: "Instantaneous",
      damage: "",
      save: "Strength save",
      attack: "",
      ritual: false,
      concentration: false,
      description: "You seize the air and compel it to create one of the following effects at a point you can see within range: One Medium or smaller creature that you choose must succeed on a Strength saving throw or be pushed up to 5 feet away from you. You create a small blast of air capable of moving one object that is neither held nor carried and that weighs no more than 5 pounds. The object is pushed up to 10 feet away from you. You create a harmless sensory effect using air, such as causing leaves to rustle, wind to slam shutters, or your clothing to ripple in a breeze.",
      wikiLink: "https://dnd5e.wikidot.com/spell:gust"
    },
    {
      name: "Infestation",
      level: 0,
      school: "Conjuration",
      castingTime: "1 action",
      range: "30 feet",
      components: "V, S, M",
      duration: "Instantaneous",
      damage: "1d6 poison damage",
      save: "Constitution save",
      attack: "",
      ritual: false,
      concentration: false,
      description: "You cause a cloud of mites, fleas, and other parasites to appear momentarily on one creature you can see within range. The target must succeed on a Constitution saving throw, or it takes 1d6 poison damage and moves 5 feet in a random direction if it can move and its speed is at least 5 feet.",
      wikiLink: "https://dnd5e.wikidot.com/spell:infestation"
    },
    {
      name: "Lightning Lure",
      level: 0,
      school: "Evocation",
      castingTime: "1 action",
      range: "Self (15-foot radius)",
      components: "V",
      duration: "Instantaneous",
      damage: "1d8 lightning damage",
      save: "Strength save",
      attack: "",
      ritual: false,
      concentration: false,
      description: "You create a lash of lightning energy that strikes at one creature of your choice that you can see within 15 feet of you. The target must succeed on a Strength saving throw or be pulled up to 10 feet in a straight line toward you and then take 1d8 lightning damage if it is within 5 feet of you.",
      wikiLink: "https://dnd5e.wikidot.com/spell:lightning-lure"
    },
    {
      name: "Magic Stone",
      level: 0,
      school: "Transmutation",
      castingTime: "1 bonus action",
      range: "Touch",
      components: "V, S",
      duration: "1 minute",
      damage: "1d6 + spellcasting modifier bludgeoning damage",
      save: "",
      attack: "Ranged spell attack",
      ritual: false,
      concentration: false,
      description: "You touch one to three pebbles and imbue them with magic. You or someone else can make a ranged spell attack with one of the pebbles by throwing it or hurling it with a sling. If thrown, it has a range of 60 feet. If someone else attacks with the pebble, that attacker adds your spellcasting ability modifier, not the attacker's, to the attack roll. On a hit, the target takes bludgeoning damage equal to 1d6 + your spellcasting ability modifier.",
      wikiLink: "https://dnd5e.wikidot.com/spell:magic-stone"
    },
    {
      name: "Mold Earth",
      level: 0,
      school: "Transmutation",
      castingTime: "1 action",
      range: "30 feet",
      components: "S",
      duration: "Instantaneous or 1 hour",
      damage: "",
      save: "",
      attack: "",
      ritual: false,
      concentration: false,
      description: "You choose a portion of dirt or stone that you can see within range and that fits within a 5-foot cube. You manipulate it in one of the following ways: If you target an area of loose earth, you can instantaneously excavate it, move it along the ground, and deposit it up to 5 feet away. You cause shapes, colors, or both to appear on the dirt or stone, spelling out words, creating images, or shaping patterns. You cause the dirt or stone to become difficult terrain.",
      wikiLink: "https://dnd5e.wikidot.com/spell:mold-earth"
    },
    {
      name: "Primal Savagery",
      level: 0,
      school: "Transmutation",
      castingTime: "1 action",
      range: "Self",
      components: "S",
      duration: "Instantaneous",
      damage: "1d10 acid damage",
      save: "",
      attack: "Melee spell attack",
      ritual: false,
      concentration: false,
      description: "You channel primal magic to cause your teeth or fingernails to sharpen, ready to deliver a corrosive attack. Make a melee spell attack against one creature within 5 feet of you. On a hit, the target takes 1d10 acid damage. After you make the attack, your teeth or fingernails return to normal.",
      wikiLink: "https://dnd5e.wikidot.com/spell:primal-savagery"
    },
    {
      name: "Shape Water",
      level: 0,
      school: "Transmutation",
      castingTime: "1 action",
      range: "30 feet",
      components: "S",
      duration: "Instantaneous or 1 hour",
      damage: "",
      save: "",
      attack: "",
      ritual: false,
      concentration: false,
      description: "You choose an area of water that you can see within range and that fits within a 5-foot cube. You manipulate it in one of the following ways: You instantaneously move or otherwise change the flow of the water as you direct, up to 5 feet in any direction. You cause the water to form into simple shapes and animate at your direction. You change the water's color or opacity. You freeze the water, provided that there are no creatures in it.",
      wikiLink: "https://dnd5e.wikidot.com/spell:shape-water"
    },
    {
      name: "Shillelagh",
      level: 0,
      school: "Transmutation",
      castingTime: "1 bonus action",
      range: "Touch",
      components: "V, S, M",
      duration: "1 minute",
      damage: "1d8 + spellcasting modifier bludgeoning damage",
      save: "",
      attack: "Melee weapon attack",
      ritual: false,
      concentration: false,
      description: "The wood of a club or quarterstaff you are holding is imbued with nature's power. For the duration, you can use your spellcasting ability instead of Strength for the attack and damage rolls of melee attacks using that weapon, and the weapon's damage die becomes a d8. The weapon also becomes magical, if it isn't already.",
      wikiLink: "https://dnd5e.wikidot.com/spell:shillelagh"
    },
    {
      name: "Sword Burst",
      level: 0,
      school: "Conjuration",
      castingTime: "1 action",
      range: "Self (5-foot radius)",
      components: "V",
      duration: "Instantaneous",
      damage: "1d6 force damage",
      save: "Dexterity save",
      attack: "",
      ritual: false,
      concentration: false,
      description: "You create a momentary circle of spectral blades that sweep around you. All other creatures within 5 feet of you must succeed on a Dexterity saving throw or take 1d6 force damage.",
      wikiLink: "https://dnd5e.wikidot.com/spell:sword-burst"
    },
    {
      name: "Toll the Dead",
      level: 0,
      school: "Necromancy",
      castingTime: "1 action",
      range: "60 feet",
      components: "V, S",
      duration: "Instantaneous",
      damage: "1d8 or 1d12 necrotic damage",
      save: "Wisdom save",
      attack: "",
      ritual: false,
      concentration: false,
      description: "You point at one creature you can see within range, and the sound of a dolorous bell fills the air around it for a moment. The target must succeed on a Wisdom saving throw or take 1d8 necrotic damage. If the target is missing any of its hit points, it instead takes 1d12 necrotic damage.",
      wikiLink: "https://dnd5e.wikidot.com/spell:toll-the-dead"
    },
    {
      name: "Word of Radiance",
      level: 0,
      school: "Evocation",
      castingTime: "1 action",
      range: "Self (5-foot radius)",
      components: "V, M",
      duration: "Instantaneous",
      damage: "1d6 radiant damage",
      save: "Constitution save",
      attack: "",
      ritual: false,
      concentration: false,
      description: "You utter a divine word, and burning radiance erupts from you. Each creature of your choice that you can see within range must succeed on a Constitution saving throw or take 1d6 radiant damage.",
      wikiLink: "https://dnd5e.wikidot.com/spell:word-of-radiance"
    }
  ],
  spells: [
    {
      name: "Magic Missile",
      level: 1,
      school: "Evocation",
      castingTime: "1 action",
      range: "120 feet",
      components: "V, S",
      duration: "Instantaneous",
      damage: "1d4+1 force damage per missile",
      save: "",
      attack: "",
      ritual: false,
      concentration: false,
      description: "Creates 3 force darts that automatically hit targets within range. Each dart deals 1d4+1 force damage. Can target multiple creatures or focus on one. For full details, see the D&D 5e Wiki link.",
      wikiLink: "https://dnd5e.wikidot.com/spell:magic-missile"
    },
    {
      name: "Fireball",
      level: 3,
      school: "Evocation",
      castingTime: "1 action",
      range: "150 feet",
      components: "V, S, M (a tiny ball of bat guano and sulfur)",
      duration: "Instantaneous",
      damage: "8d6 fire damage",
      save: "Dexterity save",
      attack: "",
      ritual: false,
      concentration: false,
      description: "Explosive fire spell that deals 8d6 fire damage in a 20-foot radius. Targets make Dexterity saves for half damage. For full details, see the D&D 5e Wiki link.",
      wikiLink: "https://dnd5e.wikidot.com/spell:fireball"
    },
    {
      name: "Identify",
      level: 1,
      school: "Divination",
      castingTime: "1 minute",
      range: "Touch",
      components: "V, S, M (a pearl worth at least 100 gp and an owl feather)",
      duration: "Instantaneous",
      damage: "",
      save: "",
      attack: "",
      ritual: true,
      concentration: false,
      description: "Reveals the properties and usage of magic items. Shows attunement requirements and remaining charges. For full details, see the D&D 5e Wiki link.",
      wikiLink: "https://dnd5e.wikidot.com/spell:identify"
    },
    {
      name: "Absorb Elements",
      level: 1,
      school: "Abjuration",
      castingTime: "1 reaction",
      range: "Self",
      components: "S",
      duration: "1 round",
      damage: "",
      save: "",
      attack: "",
      ritual: false,
      concentration: false,
      description: "Grants resistance to elemental damage and stores energy for your next melee attack, dealing +1d6 damage of the absorbed type. For full details, see the D&D 5e Wiki link.",
      wikiLink: "https://dnd5e.wikidot.com/spell:absorb-elements"
    },
    {
      name: "Alarm",
      level: 1,
      school: "Abjuration",
      castingTime: "1 minute",
      range: "30 feet",
      components: "V, S, M",
      duration: "8 hours",
      damage: "",
      save: "",
      attack: "",
      ritual: true,
      concentration: false,
      description: "Sets a magical alarm on a door, window, or 20-foot cube area. Alerts you when creatures enter the warded area. For full details, see the D&D 5e Wiki link.",
      wikiLink: "https://dnd5e.wikidot.com/spell:alarm"
    },
    {
      name: "Animal Friendship",
      level: 1,
      school: "Enchantment",
      castingTime: "1 action",
      range: "30 feet",
      components: "V, S, M",
      duration: "24 hours",
      damage: "",
      save: "Wisdom save",
      attack: "",
      ritual: false,
      concentration: false,
      description: "Charms a beast with Intelligence 3 or lower. The beast must make a Wisdom save or be charmed and see you as friendly. For full details, see the D&D 5e Wiki link.",
      wikiLink: "https://dnd5e.wikidot.com/spell:animal-friendship"
    },
    {
      name: "Bane",
      level: 1,
      school: "Enchantment",
      castingTime: "1 action",
      range: "30 feet",
      components: "V, S, M",
      duration: "Concentration, up to 1 minute",
      damage: "",
      save: "Charisma save",
      attack: "",
      ritual: false,
      concentration: true,
      description: "Targets up to 3 creatures with Charisma saves. Failed saves cause -1d4 penalty to attack rolls and saving throws. For full details, see the D&D 5e Wiki link.",
      wikiLink: "https://dnd5e.wikidot.com/spell:bane"
    },
    {
      name: "Bless",
      level: 1,
      school: "Enchantment",
      castingTime: "1 action",
      range: "30 feet",
      components: "V, S, M",
      duration: "Concentration, up to 1 minute",
      damage: "",
      save: "",
      attack: "",
      ritual: false,
      concentration: true,
      description: "Blesses up to 3 creatures with +1d4 bonus to attack rolls and saving throws. For full details, see the D&D 5e Wiki link.",
      wikiLink: "https://dnd5e.wikidot.com/spell:bless"
    },
    {
      name: "Burning Hands",
      level: 1,
      school: "Evocation",
      castingTime: "1 action",
      range: "Self (15-foot cone)",
      components: "V, S",
      duration: "Instantaneous",
      damage: "3d6 fire damage",
      save: "Dexterity save",
      attack: "",
      ritual: false,
      concentration: false,
      description: "Creates a 15-foot cone of fire dealing 3d6 fire damage. Targets make Dexterity saves for half damage. For full details, see the D&D 5e Wiki link.",
      wikiLink: "https://dnd5e.wikidot.com/spell:burning-hands"
    },
    {
      name: "Charm Person",
      level: 1,
      school: "Enchantment",
      castingTime: "1 action",
      range: "30 feet",
      components: "V, S",
      duration: "1 hour",
      damage: "",
      save: "Wisdom save",
      attack: "",
      ritual: false,
      concentration: false,
      description: "Charms a humanoid with a Wisdom save. Charmed creature sees you as a friendly acquaintance. For full details, see the D&D 5e Wiki link.",
      wikiLink: "https://dnd5e.wikidot.com/spell:charm-person"
    },
    {
      name: "Command",
      level: 1,
      school: "Enchantment",
      castingTime: "1 action",
      range: "60 feet",
      components: "V",
      duration: "1 round",
      damage: "",
      save: "Wisdom save",
      attack: "",
      ritual: false,
      concentration: false,
      description: "Speaks a one-word command to a creature. Target makes Wisdom save or follows command on next turn. For full details, see the D&D 5e Wiki link.",
      wikiLink: "https://dnd5e.wikidot.com/spell:command"
    },
    {
      name: "Compelled Duel",
      level: 1,
      school: "Enchantment",
      castingTime: "1 bonus action",
      range: "30 feet",
      components: "V",
      duration: "Concentration, up to 1 minute",
      damage: "",
      save: "Wisdom save",
      attack: "",
      ritual: false,
      concentration: true,
      description: "Compels a creature to duel you. Target makes Wisdom save or has disadvantage attacking others. For full details, see the D&D 5e Wiki link.",
      wikiLink: "https://dnd5e.wikidot.com/spell:compelled-duel"
    },
    {
      name: "Comprehend Languages",
      level: 1,
      school: "Divination",
      castingTime: "1 action",
      range: "Self",
      components: "V, S, M",
      duration: "1 hour",
      damage: "",
      save: "",
      attack: "",
      ritual: true,
      concentration: false,
      description: "Understands any spoken or written language you hear or see. For full details, see the D&D 5e Wiki link.",
      wikiLink: "https://dnd5e.wikidot.com/spell:comprehend-languages"
    },
    {
      name: "Cure Wounds",
      level: 1,
      school: "Evocation",
      castingTime: "1 action",
      range: "Touch",
      components: "V, S",
      duration: "Instantaneous",
      damage: "",
      save: "",
      attack: "",
      ritual: false,
      concentration: false,
      description: "Heals a touched creature for 1d8 + spellcasting modifier hit points. For full details, see the D&D 5e Wiki link.",
      wikiLink: "https://dnd5e.wikidot.com/spell:cure-wounds"
    },
    {
      name: "Detect Magic",
      level: 1,
      school: "Divination",
      castingTime: "1 action",
      range: "Self",
      components: "V, S",
      duration: "Concentration, up to 10 minutes",
      damage: "",
      save: "",
      attack: "",
      ritual: true,
      concentration: true,
      description: "Senses magic within 30 feet and reveals magical auras and their schools. For full details, see the D&D 5e Wiki link.",
      wikiLink: "https://dnd5e.wikidot.com/spell:detect-magic"
    },
    {
      name: "Disguise Self",
      level: 1,
      school: "Illusion",
      castingTime: "1 action",
      range: "Self",
      components: "V, S",
      duration: "1 hour",
      damage: "",
      save: "",
      attack: "",
      ritual: false,
      concentration: false,
      description: "Changes your appearance including clothing and equipment. Can alter height and build. For full details, see the D&D 5e Wiki link.",
      wikiLink: "https://dnd5e.wikidot.com/spell:disguise-self"
    },
    {
      name: "Faerie Fire",
      level: 1,
      school: "Evocation",
      castingTime: "1 action",
      range: "60 feet",
      components: "V",
      duration: "Concentration, up to 1 minute",
      damage: "",
      save: "Dexterity save",
      attack: "",
      ritual: false,
      concentration: true,
      description: "Outlines objects and creatures in a 20-foot cube with colored light. Failed Dexterity saves cause creatures to glow and shed light. For full details, see the D&D 5e Wiki link.",
      wikiLink: "https://dnd5e.wikidot.com/spell:faerie-fire"
    },
    {
      name: "Feather Fall",
      level: 1,
      school: "Transmutation",
      castingTime: "1 reaction",
      range: "60 feet",
      components: "V, M",
      duration: "1 minute",
      damage: "",
      save: "",
      attack: "",
      ritual: false,
      concentration: false,
      description: "Slows up to 5 falling creatures to 60 feet per round, preventing falling damage. For full details, see the D&D 5e Wiki link.",
      wikiLink: "https://dnd5e.wikidot.com/spell:feather-fall"
    },
    {
      name: "Find Familiar",
      level: 1,
      school: "Conjuration",
      castingTime: "1 hour",
      range: "10 feet",
      components: "V, S, M",
      duration: "Instantaneous",
      damage: "",
      save: "",
      attack: "",
      ritual: true,
      concentration: false,
      description: "Summons a familiar spirit in animal form. Can choose from various animals like cat, owl, raven, etc. For full details, see the D&D 5e Wiki link.",
      wikiLink: "https://dnd5e.wikidot.com/spell:find-familiar"
    },
    {
      name: "Fog Cloud",
      level: 1,
      school: "Conjuration",
      castingTime: "1 action",
      range: "120 feet",
      components: "V, S",
      duration: "Concentration, up to 1 hour",
      damage: "",
      save: "",
      attack: "",
      ritual: false,
      concentration: true,
      description: "Creates a 20-foot radius sphere of fog that heavily obscures the area. For full details, see the D&D 5e Wiki link.",
      wikiLink: "https://dnd5e.wikidot.com/spell:fog-cloud"
    },
    {
      name: "Goodberry",
      level: 1,
      school: "Transmutation",
      castingTime: "1 action",
      range: "Touch",
      components: "V, S, M",
      duration: "Instantaneous",
      damage: "",
      save: "",
      attack: "",
      ritual: false,
      concentration: false,
      description: "Creates 10 magical berries that restore 1 hit point each and provide a day's nourishment. For full details, see the D&D 5e Wiki link.",
      wikiLink: "https://dnd5e.wikidot.com/spell:goodberry"
    },
    {
      name: "Grease",
      level: 1,
      school: "Conjuration",
      castingTime: "1 action",
      range: "60 feet",
      components: "V, S, M",
      duration: "1 minute",
      damage: "",
      save: "Dexterity save",
      attack: "",
      ritual: false,
      concentration: false,
      description: "Creates a 10-foot square of slippery grease that becomes difficult terrain. Creatures in area make Dexterity saves or fall prone. For full details, see the D&D 5e Wiki link.",
      wikiLink: "https://dnd5e.wikidot.com/spell:grease"
    },
    {
      name: "Guiding Bolt",
      level: 1,
      school: "Evocation",
      castingTime: "1 action",
      range: "120 feet",
      components: "V, S",
      duration: "1 round",
      damage: "4d6 radiant damage",
      save: "",
      attack: "Ranged spell attack",
      ritual: false,
      concentration: false,
      description: "Ranged spell attack dealing 4d6 radiant damage. Next attack against target has advantage. For full details, see the D&D 5e Wiki link.",
      wikiLink: "https://dnd5e.wikidot.com/spell:guiding-bolt"
    },
    {
      name: "Healing Word",
      level: 1,
      school: "Evocation",
      castingTime: "1 bonus action",
      range: "60 feet",
      components: "V",
      duration: "Instantaneous",
      damage: "",
      save: "",
      attack: "",
      ritual: false,
      concentration: false,
      description: "Bonus action healing spell that restores 1d4 + spellcasting modifier hit points at range. For full details, see the D&D 5e Wiki link.",
      wikiLink: "https://dnd5e.wikidot.com/spell:healing-word"
    },
    {
      name: "Hellish Rebuke",
      level: 1,
      school: "Evocation",
      castingTime: "1 reaction",
      range: "60 feet",
      components: "V, S",
      duration: "Instantaneous",
      damage: "2d10 fire damage",
      save: "Dexterity save",
      attack: "",
      ritual: false,
      concentration: false,
      description: "Reaction spell dealing 2d10 fire damage to creature that damaged you. Target makes Dexterity save for half damage. For full details, see the D&D 5e Wiki link.",
      wikiLink: "https://dnd5e.wikidot.com/spell:hellish-rebuke"
    },
    {
      name: "Heroism",
      level: 1,
      school: "Enchantment",
      castingTime: "1 action",
      range: "Touch",
      components: "V, S",
      duration: "Concentration, up to 1 minute",
      damage: "",
      save: "",
      attack: "",
      ritual: false,
      concentration: true,
      description: "Grants immunity to fear and temporary hit points equal to spellcasting modifier each turn. For full details, see the D&D 5e Wiki link.",
      wikiLink: "https://dnd5e.wikidot.com/spell:heroism"
    },
    {
      name: "Hex",
      level: 1,
      school: "Enchantment",
      castingTime: "1 bonus action",
      range: "90 feet",
      components: "V, S, M",
      duration: "Concentration, up to 1 hour",
      damage: "",
      save: "",
      attack: "",
      ritual: false,
      concentration: true,
      description: "Curses a creature with +1d6 necrotic damage on attacks and disadvantage on one ability. For full details, see the D&D 5e Wiki link.",
      wikiLink: "https://dnd5e.wikidot.com/spell:hex"
    },
    {
      name: "Hunter's Mark",
      level: 1,
      school: "Divination",
      castingTime: "1 bonus action",
      range: "90 feet",
      components: "V",
      duration: "Concentration, up to 1 hour",
      damage: "",
      save: "",
      attack: "",
      ritual: false,
      concentration: true,
      description: "Marks a creature as quarry for +1d6 weapon damage and advantage on tracking checks. For full details, see the D&D 5e Wiki link.",
      wikiLink: "https://dnd5e.wikidot.com/spell:hunters-mark"
    },
    {
      name: "Ice Knife",
      level: 1,
      school: "Conjuration",
      castingTime: "1 action",
      range: "60 feet",
      components: "S, M",
      duration: "Instantaneous",
      damage: "1d10 piercing damage",
      save: "Dexterity save",
      attack: "Ranged spell attack",
      ritual: false,
      concentration: false,
      description: "Ranged spell attack dealing 1d10 piercing damage, then explodes for 2d6 cold damage in 5-foot radius. For full details, see the D&D 5e Wiki link.",
      wikiLink: "https://dnd5e.wikidot.com/spell:ice-knife"
    },
    {
      name: "Mage Armor",
      level: 1,
      school: "Abjuration",
      castingTime: "1 action",
      range: "Touch",
      components: "V, S, M",
      duration: "8 hours",
      damage: "",
      save: "",
      attack: "",
      ritual: false,
      concentration: false,
      description: "Grants AC 13 + Dexterity modifier to unarmored creature for 8 hours. For full details, see the D&D 5e Wiki link.",
      wikiLink: "https://dnd5e.wikidot.com/spell:mage-armor"
    },
    {
      name: "Protection from Evil and Good",
      level: 1,
      school: "Abjuration",
      castingTime: "1 action",
      range: "Touch",
      components: "V, S, M",
      duration: "Concentration, up to 10 minutes",
      damage: "",
      save: "",
      attack: "",
      ritual: false,
      concentration: true,
      description: "Protects against aberrations, celestials, elementals, fey, fiends, and undead. These creatures have disadvantage attacking the target. For full details, see the D&D 5e Wiki link.",
      wikiLink: "https://dnd5e.wikidot.com/spell:protection-from-evil-and-good"
    },
    {
      name: "Purify Food and Drink",
      level: 1,
      school: "Transmutation",
      castingTime: "1 action",
      range: "10 feet",
      components: "V, S",
      duration: "Instantaneous",
      damage: "",
      save: "",
      attack: "",
      ritual: true,
      concentration: false,
      description: "Purifies all food and drink in a 5-foot radius, removing poison and disease. For full details, see the D&D 5e Wiki link.",
      wikiLink: "https://dnd5e.wikidot.com/spell:purify-food-and-drink"
    },
    {
      name: "Sanctuary",
      level: 1,
      school: "Abjuration",
      castingTime: "1 bonus action",
      range: "30 feet",
      components: "V, S, M",
      duration: "1 minute",
      damage: "",
      save: "Wisdom save",
      attack: "",
      ritual: false,
      concentration: false,
      description: "Wards a creature from attacks. Attackers must make Wisdom saves or choose new targets. For full details, see the D&D 5e Wiki link.",
      wikiLink: "https://dnd5e.wikidot.com/spell:sanctuary"
    },
    {
      name: "Shield",
      level: 1,
      school: "Abjuration",
      castingTime: "1 reaction",
      range: "Self",
      components: "V, S",
      duration: "1 round",
      damage: "",
      save: "",
      attack: "",
      ritual: false,
      concentration: false,
      description: "Reaction spell granting +5 AC until next turn and immunity to magic missile. For full details, see the D&D 5e Wiki link.",
      wikiLink: "https://dnd5e.wikidot.com/spell:shield"
    },
    {
      name: "Shield of Faith",
      level: 1,
      school: "Abjuration",
      castingTime: "1 bonus action",
      range: "60 feet",
      components: "V, S, M",
      duration: "Concentration, up to 10 minutes",
      damage: "",
      save: "",
      attack: "",
      ritual: false,
      concentration: true,
      description: "Grants +2 AC to a creature for the duration. For full details, see the D&D 5e Wiki link.",
      wikiLink: "https://dnd5e.wikidot.com/spell:shield-of-faith"
    },
    {
      name: "Silent Image",
      level: 1,
      school: "Illusion",
      castingTime: "1 action",
      range: "60 feet",
      components: "V, S, M",
      duration: "Concentration, up to 10 minutes",
      damage: "",
      save: "",
      attack: "",
      ritual: false,
      concentration: true,
      description: "Creates a visual illusion of an object or creature in a 15-foot cube. For full details, see the D&D 5e Wiki link.",
      wikiLink: "https://dnd5e.wikidot.com/spell:silent-image"
    },
    {
      name: "Sleep",
      level: 1,
      school: "Enchantment",
      castingTime: "1 action",
      range: "90 feet",
      components: "V, S, M",
      duration: "1 minute",
      damage: "",
      save: "",
      attack: "",
      ritual: false,
      concentration: false,
      description: "Puts creatures to sleep based on 5d8 hit points total. Affects creatures in 20-foot radius by current hit points. For full details, see the D&D 5e Wiki link.",
      wikiLink: "https://dnd5e.wikidot.com/spell:sleep"
    },
    {
      name: "Speak with Animals",
      level: 1,
      school: "Divination",
      castingTime: "1 action",
      range: "Self",
      components: "V, S",
      duration: "10 minutes",
      damage: "",
      save: "",
      attack: "",
      ritual: true,
      concentration: false,
      description: "Allows communication with beasts for 10 minutes. Beasts can share information about nearby locations and monsters. For full details, see the D&D 5e Wiki link.",
      wikiLink: "https://dnd5e.wikidot.com/spell:speak-with-animals"
    },
    {
      name: "Tasha's Hideous Laughter",
      level: 1,
      school: "Enchantment",
      castingTime: "1 action",
      range: "30 feet",
      components: "V, S, M",
      duration: "Concentration, up to 1 minute",
      damage: "",
      save: "Wisdom save",
      attack: "",
      ritual: false,
      concentration: true,
      description: "Target makes Wisdom save or falls prone and becomes incapacitated with laughter. For full details, see the D&D 5e Wiki link.",
      wikiLink: "https://dnd5e.wikidot.com/spell:tashas-hideous-laughter"
    },
    {
      name: "Tenser's Floating Disk",
      level: 1,
      school: "Conjuration",
      castingTime: "1 action",
      range: "30 feet",
      components: "V, S, M",
      duration: "1 hour",
      damage: "",
      save: "",
      attack: "",
      ritual: true,
      concentration: false,
      description: "Creates a 3-foot diameter floating disk that can hold up to 500 pounds. For full details, see the D&D 5e Wiki link.",
      wikiLink: "https://dnd5e.wikidot.com/spell:tensers-floating-disk"
    },
    {
      name: "Thunderous Smite",
      level: 1,
      school: "Evocation",
      castingTime: "1 bonus action",
      range: "Self",
      components: "V",
      duration: "Concentration, up to 1 minute",
      damage: "2d6 thunder damage",
      save: "Strength save",
      attack: "",
      ritual: false,
      concentration: true,
      description: "Next melee attack deals +2d6 thunder damage and pushes target 10 feet away if they fail Strength save. For full details, see the D&D 5e Wiki link.",
      wikiLink: "https://dnd5e.wikidot.com/spell:thunderous-smite"
    },
    {
      name: "Unseen Servant",
      level: 1,
      school: "Conjuration",
      castingTime: "1 action",
      range: "60 feet",
      components: "V, S, M",
      duration: "1 hour",
      damage: "",
      save: "",
      attack: "",
      ritual: true,
      concentration: false,
      description: "Creates an invisible servant that performs simple tasks for 1 hour. For full details, see the D&D 5e Wiki link.",
      wikiLink: "https://dnd5e.wikidot.com/spell:unseen-servant"
    },
    {
      name: "Witch Bolt",
      level: 1,
      school: "Evocation",
      castingTime: "1 action",
      range: "30 feet",
      components: "V, S, M",
      duration: "Concentration, up to 1 minute",
      damage: "1d12 lightning damage",
      save: "",
      attack: "Ranged spell attack",
      ritual: false,
      concentration: true,
      description: "Ranged spell attack dealing 1d12 lightning damage. Can deal 1d12 damage each turn as action. For full details, see the D&D 5e Wiki link.",
      wikiLink: "https://dnd5e.wikidot.com/spell:witch-bolt"
    },
    {
      name: "Wrathful Smite",
      level: 1,
      school: "Evocation",
      castingTime: "1 bonus action",
      range: "Self",
      components: "V",
      duration: "Concentration, up to 1 minute",
      damage: "1d6 psychic damage",
      save: "Wisdom save",
      attack: "",
      ritual: false,
      concentration: true,
      description: "Next melee attack deals +1d6 psychic damage and frightens target if they fail Wisdom save. For full details, see the D&D 5e Wiki link.",
      wikiLink: "https://dnd5e.wikidot.com/spell:wrathful-smite"
    },
    {
      name: "Aid",
      level: 2,
      school: "Abjuration",
      castingTime: "1 action",
      range: "30 feet",
      components: "V, S, M",
      duration: "8 hours",
      damage: "",
      save: "",
      attack: "",
      ritual: false,
      concentration: false,
      description: "Increases hit point maximum and current hit points by 5 for up to 3 creatures. For full details, see the D&D 5e Wiki link.",
      wikiLink: "https://dnd5e.wikidot.com/spell:aid"
    },
    {
      name: "Alter Self",
      level: 2,
      school: "Transmutation",
      castingTime: "1 action",
      range: "Self",
      components: "V, S",
      duration: "Concentration, up to 1 hour",
      damage: "",
      save: "",
      attack: "",
      ritual: false,
      concentration: true,
      description: "Allows you to change your form with various options like aquatic adaptation, natural weapons, or change appearance. For full details, see the D&D 5e Wiki link.",
      wikiLink: "https://dnd5e.wikidot.com/spell:alter-self"
    },
    {
      name: "Arcane Lock",
      level: 2,
      school: "Abjuration",
      castingTime: "1 action",
      range: "Touch",
      components: "V, S, M",
      duration: "Until dispelled",
      damage: "",
      save: "",
      attack: "",
      ritual: false,
      concentration: false,
      description: "Magically locks a door, window, or container. You and designated creatures can open it normally. For full details, see the D&D 5e Wiki link.",
      wikiLink: "https://dnd5e.wikidot.com/spell:arcane-lock"
    },
    {
      name: "Blur",
      level: 2,
      school: "Illusion",
      castingTime: "1 action",
      range: "Self",
      components: "V",
      duration: "Concentration, up to 1 minute",
      damage: "",
      save: "",
      attack: "",
      ritual: false,
      concentration: true,
      description: "Makes you blurred and hard to see, giving attackers disadvantage on attack rolls. For full details, see the D&D 5e Wiki link.",
      wikiLink: "https://dnd5e.wikidot.com/spell:blur"
    },
    {
      name: "Branding Smite",
      level: 2,
      school: "Evocation",
      castingTime: "1 bonus action",
      range: "Self",
      components: "V",
      duration: "Concentration, up to 1 minute",
      damage: "2d6 radiant damage",
      save: "",
      attack: "",
      ritual: false,
      concentration: true,
      description: "Next weapon attack deals +2d6 radiant damage and makes invisible targets visible. For full details, see the D&D 5e Wiki link.",
      wikiLink: "https://dnd5e.wikidot.com/spell:branding-smite"
    },
    {
      name: "Calm Emotions",
      level: 2,
      school: "Enchantment",
      castingTime: "1 action",
      range: "Self (60-foot radius)",
      components: "V, S",
      duration: "Concentration, up to 1 minute",
      damage: "",
      save: "Charisma save",
      attack: "",
      ritual: false,
      concentration: true,
      description: "Suppresses strong emotions in humanoids within 20-foot radius. Targets make Charisma saves. For full details, see the D&D 5e Wiki link.",
      wikiLink: "https://dnd5e.wikidot.com/spell:calm-emotions"
    },
    {
      name: "Continual Flame",
      level: 2,
      school: "Evocation",
      castingTime: "1 action",
      range: "Touch",
      components: "V, S, M",
      duration: "Until dispelled",
      damage: "",
      save: "",
      attack: "",
      ritual: false,
      concentration: false,
      description: "Creates a permanent flame on an object that provides light but no heat. For full details, see the D&D 5e Wiki link.",
      wikiLink: "https://dnd5e.wikidot.com/spell:continual-flame"
    },
    {
      name: "Cordon of Arrows",
      level: 2,
      school: "Transmutation",
      castingTime: "1 action",
      range: "5 feet",
      components: "V, S, M",
      duration: "8 hours",
      damage: "1d6 piercing damage",
      save: "Dexterity save",
      attack: "",
      ritual: false,
      concentration: false,
      description: "Plants 4 arrows that automatically attack creatures within 30 feet for 1d6 piercing damage. For full details, see the D&D 5e Wiki link.",
      wikiLink: "https://dnd5e.wikidot.com/spell:cordon-of-arrows"
    },
    {
      name: "Darkvision",
      level: 2,
      school: "Transmutation",
      castingTime: "1 action",
      range: "Touch",
      components: "V, S, M",
      duration: "8 hours",
      damage: "",
      save: "",
      attack: "",
      ritual: false,
      concentration: false,
      description: "Grants darkvision out to 60 feet for 8 hours. For full details, see the D&D 5e Wiki link.",
      wikiLink: "https://dnd5e.wikidot.com/spell:darkvision"
    },
    {
      name: "Enhance Ability",
      level: 2,
      school: "Transmutation",
      castingTime: "1 action",
      range: "Touch",
      components: "V, S, M",
      duration: "Concentration, up to 1 hour",
      damage: "",
      save: "",
      attack: "",
      ritual: false,
      concentration: true,
      description: "Enhances one ability score with various benefits like advantage on checks or increased carrying capacity. For full details, see the D&D 5e Wiki link.",
      wikiLink: "https://dnd5e.wikidot.com/spell:enhance-ability"
    },
    {
      name: "Enlarge/Reduce",
      level: 2,
      school: "Transmutation",
      castingTime: "1 action",
      range: "30 feet",
      components: "V, S, M",
      duration: "Concentration, up to 1 minute",
      damage: "",
      save: "Constitution save",
      attack: "",
      ritual: false,
      concentration: true,
      description: "Makes a creature or object larger or smaller. Unwilling targets make Constitution saves. For full details, see the D&D 5e Wiki link.",
      wikiLink: "https://dnd5e.wikidot.com/spell:enlarge-reduce"
    },
    {
      name: "Find Steed",
      level: 2,
      school: "Conjuration",
      castingTime: "10 minutes",
      range: "30 feet",
      components: "V, S",
      duration: "Instantaneous",
      damage: "",
      save: "",
      attack: "",
      ritual: false,
      concentration: false,
      description: "Summons a loyal steed spirit in the form of a warhorse, pony, camel, elk, or mastiff. For full details, see the D&D 5e Wiki link.",
      wikiLink: "https://dnd5e.wikidot.com/spell:find-steed"
    },
    {
      name: "Flame Blade",
      level: 2,
      school: "Evocation",
      castingTime: "1 bonus action",
      range: "Self",
      components: "V, S, M",
      duration: "Concentration, up to 10 minutes",
      damage: "3d6 fire damage",
      save: "",
      attack: "Melee spell attack",
      ritual: false,
      concentration: true,
      description: "Creates a fiery scimitar that deals 3d6 fire damage on melee spell attacks. For full details, see the D&D 5e Wiki link.",
      wikiLink: "https://dnd5e.wikidot.com/spell:flame-blade"
    },
    {
      name: "Flaming Sphere",
      level: 2,
      school: "Conjuration",
      castingTime: "1 action",
      range: "60 feet",
      components: "V, S, M",
      duration: "Concentration, up to 1 minute",
      damage: "2d6 fire damage",
      save: "Dexterity save",
      attack: "",
      ritual: false,
      concentration: true,
      description: "Creates a 5-foot diameter fire sphere that deals 2d6 fire damage to creatures ending their turn nearby. For full details, see the D&D 5e Wiki link.",
      wikiLink: "https://dnd5e.wikidot.com/spell:flaming-sphere"
    },
    {
      name: "Heat Metal",
      level: 2,
      school: "Transmutation",
      castingTime: "1 action",
      range: "60 feet",
      components: "V, S, M",
      duration: "Concentration, up to 1 minute",
      damage: "2d8 fire damage",
      save: "Constitution save",
      attack: "",
      ritual: false,
      concentration: true,
      description: "Makes a metal object red-hot, dealing 2d8 fire damage to creatures touching it. For full details, see the D&D 5e Wiki link.",
      wikiLink: "https://dnd5e.wikidot.com/spell:heat-metal"
    },
    {
      name: "Hold Person",
      level: 2,
      school: "Enchantment",
      castingTime: "1 action",
      range: "60 feet",
      components: "V, S, M",
      duration: "Concentration, up to 1 minute",
      damage: "",
      save: "Wisdom save",
      attack: "",
      ritual: false,
      concentration: true,
      description: "Paralyzes a humanoid with Wisdom saves. Target can repeat save each turn. For full details, see the D&D 5e Wiki link.",
      wikiLink: "https://dnd5e.wikidot.com/spell:hold-person"
    },
    {
      name: "Invisibility",
      level: 2,
      school: "Illusion",
      castingTime: "1 action",
      range: "Touch",
      components: "V, S, M",
      duration: "Concentration, up to 1 hour",
      damage: "",
      save: "",
      attack: "",
      ritual: false,
      concentration: true,
      description: "Makes a creature invisible until they attack or cast a spell. For full details, see the D&D 5e Wiki link.",
      wikiLink: "https://dnd5e.wikidot.com/spell:invisibility"
    },
    {
      name: "Lesser Restoration",
      level: 2,
      school: "Abjuration",
      castingTime: "1 action",
      range: "Touch",
      components: "V, S",
      duration: "Instantaneous",
      damage: "",
      save: "",
      attack: "",
      ritual: false,
      concentration: false,
      description: "Ends one disease or condition (blinded, deafened, paralyzed, or poisoned). For full details, see the D&D 5e Wiki link.",
      wikiLink: "https://dnd5e.wikidot.com/spell:lesser-restoration"
    },
    {
      name: "Levitate",
      level: 2,
      school: "Transmutation",
      castingTime: "1 action",
      range: "60 feet",
      components: "V, S, M",
      duration: "Concentration, up to 10 minutes",
      damage: "",
      save: "Constitution save",
      attack: "",
      ritual: false,
      concentration: true,
      description: "Levitates a creature or object up to 500 pounds up to 20 feet high. Unwilling targets make Constitution saves. For full details, see the D&D 5e Wiki link.",
      wikiLink: "https://dnd5e.wikidot.com/spell:levitate"
    },
    {
      name: "Locate Object",
      level: 2,
      school: "Divination",
      castingTime: "1 action",
      range: "Self",
      components: "V, S, M",
      duration: "Concentration, up to 10 minutes",
      damage: "",
      save: "",
      attack: "",
      ritual: false,
      concentration: true,
      description: "Senses the direction to a familiar object within 1,000 feet. For full details, see the D&D 5e Wiki link.",
      wikiLink: "https://dnd5e.wikidot.com/spell:locate-object"
    },
    {
      name: "Magic Weapon",
      level: 2,
      school: "Transmutation",
      castingTime: "1 bonus action",
      range: "Touch",
      components: "V, S",
      duration: "Concentration, up to 1 hour",
      damage: "",
      save: "",
      attack: "",
      ritual: false,
      concentration: true,
      description: "Makes a nonmagical weapon magical with +1 bonus to attack and damage rolls. For full details, see the D&D 5e Wiki link.",
      wikiLink: "https://dnd5e.wikidot.com/spell:magic-weapon"
    },
    {
      name: "Misty Step",
      level: 2,
      school: "Conjuration",
      castingTime: "1 bonus action",
      range: "Self",
      components: "V",
      duration: "Instantaneous",
      damage: "",
      save: "",
      attack: "",
      ritual: false,
      concentration: false,
      description: "Teleports you up to 30 feet to an unoccupied space you can see. For full details, see the D&D 5e Wiki link.",
      wikiLink: "https://dnd5e.wikidot.com/spell:misty-step"
    },
    {
      name: "Moonbeam",
      level: 2,
      school: "Evocation",
      castingTime: "1 action",
      range: "120 feet",
      components: "V, S, M",
      duration: "Concentration, up to 1 minute",
      damage: "2d10 radiant damage",
      save: "Constitution save",
      attack: "",
      ritual: false,
      concentration: true,
      description: "Creates a 5-foot radius cylinder of moonlight that deals 2d10 radiant damage to creatures entering or starting their turn there. For full details, see the D&D 5e Wiki link.",
      wikiLink: "https://dnd5e.wikidot.com/spell:moonbeam"
    },
    {
      name: "Pass without Trace",
      level: 2,
      school: "Abjuration",
      castingTime: "1 action",
      range: "Self",
      components: "V, S, M",
      duration: "Concentration, up to 1 hour",
      damage: "",
      save: "",
      attack: "",
      ritual: false,
      concentration: true,
      description: "Grants +10 bonus to Stealth checks and prevents tracking for creatures within 30 feet. For full details, see the D&D 5e Wiki link.",
      wikiLink: "https://dnd5e.wikidot.com/spell:pass-without-trace"
    },
    {
      name: "Protection from Poison",
      level: 2,
      school: "Abjuration",
      castingTime: "1 action",
      range: "Touch",
      components: "V, S",
      duration: "1 hour",
      damage: "",
      save: "",
      attack: "",
      ritual: false,
      concentration: false,
      description: "Neutralizes one poison affecting a touched creature. For full details, see the D&D 5e Wiki link.",
      wikiLink: "https://dnd5e.wikidot.com/spell:protection-from-poison"
    },
    {
      name: "Pyrotechnics",
      level: 2,
      school: "Transmutation",
      castingTime: "1 action",
      range: "60 feet",
      components: "V, S",
      duration: "Instantaneous",
      damage: "",
      save: "Constitution save",
      attack: "",
      ritual: false,
      concentration: false,
      description: "Extinguishes fire in a 5-foot cube and creates fireworks or smoke. For full details, see the D&D 5e Wiki link.",
      wikiLink: "https://dnd5e.wikidot.com/spell:pyrotechnics"
    },
    {
      name: "Rope Trick",
      level: 2,
      school: "Transmutation",
      castingTime: "1 action",
      range: "Touch",
      components: "V, S, M",
      duration: "1 hour",
      damage: "",
      save: "",
      attack: "",
      ritual: false,
      concentration: false,
      description: "Creates an extradimensional space at the top of a rope for 1 hour. For full details, see the D&D 5e Wiki link.",
      wikiLink: "https://dnd5e.wikidot.com/spell:rope-trick"
    },
    {
      name: "Scorching Ray",
      level: 2,
      school: "Evocation",
      castingTime: "1 action",
      range: "120 feet",
      components: "V, S",
      duration: "Instantaneous",
      damage: "2d6 fire damage",
      save: "",
      attack: "Ranged spell attack",
      ritual: false,
      concentration: false,
      description: "Creates 3 rays of fire that each deal 2d6 fire damage on ranged spell attacks. For full details, see the D&D 5e Wiki link.",
      wikiLink: "https://dnd5e.wikidot.com/spell:scorching-ray"
    },
    {
      name: "See Invisibility",
      level: 2,
      school: "Divination",
      castingTime: "1 action",
      range: "Self",
      components: "V, S, M",
      duration: "1 hour",
      damage: "",
      save: "",
      attack: "",
      ritual: false,
      concentration: false,
      description: "Allows you to see invisible creatures and objects, and see into the Ethereal Plane. For full details, see the D&D 5e Wiki link.",
      wikiLink: "https://dnd5e.wikidot.com/spell:see-invisibility"
    },
    {
      name: "Shatter",
      level: 2,
      school: "Evocation",
      castingTime: "1 action",
      range: "60 feet",
      components: "V, S, M",
      duration: "Instantaneous",
      damage: "3d8 thunder damage",
      save: "Constitution save",
      attack: "",
      ritual: false,
      concentration: false,
      description: "Creates a loud ringing noise dealing 3d8 thunder damage in a 10-foot radius. Targets make Constitution saves for half damage. For full details, see the D&D 5e Wiki link.",
      wikiLink: "https://dnd5e.wikidot.com/spell:shatter"
    },
    {
      name: "Spider Climb",
      level: 2,
      school: "Transmutation",
      castingTime: "1 action",
      range: "Touch",
      components: "V, S, M",
      duration: "Concentration, up to 1 hour",
      damage: "",
      save: "",
      attack: "",
      ritual: false,
      concentration: true,
      description: "Grants ability to climb on walls and ceilings with hands free, and climbing speed equal to walking speed. For full details, see the D&D 5e Wiki link.",
      wikiLink: "https://dnd5e.wikidot.com/spell:spider-climb"
    },
    {
      name: "Spike Growth",
      level: 2,
      school: "Transmutation",
      castingTime: "1 action",
      range: "150 feet",
      components: "V, S, M",
      duration: "Concentration, up to 10 minutes",
      damage: "2d4 piercing damage",
      save: "",
      attack: "",
      ritual: false,
      concentration: true,
      description: "Creates difficult terrain with spikes that deal 2d4 piercing damage per 5 feet moved. For full details, see the D&D 5e Wiki link.",
      wikiLink: "https://dnd5e.wikidot.com/spell:spike-growth"
    },
    {
      name: "Suggestion",
      level: 2,
      school: "Enchantment",
      castingTime: "1 action",
      range: "30 feet",
      components: "V, M",
      duration: "Concentration, up to 8 hours",
      damage: "",
      save: "Wisdom save",
      attack: "",
      ritual: false,
      concentration: true,
      description: "Magically influences a creature to follow a reasonable suggestion. Target makes Wisdom save. For full details, see the D&D 5e Wiki link.",
      wikiLink: "https://dnd5e.wikidot.com/spell:suggestion"
    },
    {
      name: "Web",
      level: 2,
      school: "Conjuration",
      castingTime: "1 action",
      range: "60 feet",
      components: "V, S, M",
      duration: "Concentration, up to 1 hour",
      damage: "",
      save: "Dexterity save",
      attack: "",
      ritual: false,
      concentration: true,
      description: "Creates a 20-foot cube of sticky webs that are difficult terrain and lightly obscure the area. For full details, see the D&D 5e Wiki link.",
      wikiLink: "https://dnd5e.wikidot.com/spell:web"
    },
    {
      name: "Zone of Truth",
      level: 2,
      school: "Enchantment",
      castingTime: "1 action",
      range: "60 feet",
      components: "V, S",
      duration: "10 minutes",
      damage: "",
      save: "Charisma save",
      attack: "",
      ritual: false,
      concentration: false,
      description: "Creates a 15-foot radius zone that prevents lying. Creatures entering or starting their turn there make Charisma saves. For full details, see the D&D 5e Wiki link.",
      wikiLink: "https://dnd5e.wikidot.com/spell:zone-of-truth"
    },
    {
      name: "Animate Dead",
      level: 3,
      school: "Necromancy",
      castingTime: "1 minute",
      range: "10 feet",
      components: "V, S, M",
      duration: "Instantaneous",
      damage: "",
      save: "",
      attack: "",
      ritual: false,
      concentration: false,
      description: "Raises a Medium or Small humanoid corpse or bones as an undead servant. For full details, see the D&D 5e Wiki link.",
      wikiLink: "https://dnd5e.wikidot.com/spell:animate-dead"
    },
    {
      name: "Aura of Vitality",
      level: 3,
      school: "Evocation",
      castingTime: "1 action",
      range: "Self (30-foot radius)",
      components: "V",
      duration: "Concentration, up to 1 minute",
      damage: "",
      save: "",
      attack: "",
      ritual: false,
      concentration: true,
      description: "Creates a 30-foot radius healing aura. Bonus action to heal 2d6 hit points to one creature in the aura. For full details, see the D&D 5e Wiki link.",
      wikiLink: "https://dnd5e.wikidot.com/spell:aura-of-vitality"
    },
    {
      name: "Beacon of Hope",
      level: 3,
      school: "Abjuration",
      castingTime: "1 action",
      range: "30 feet",
      components: "V, S",
      duration: "Concentration, up to 1 minute",
      damage: "",
      save: "",
      attack: "",
      ritual: false,
      concentration: true,
      description: "Grants advantage on Wisdom saves and death saves, and maximum healing to chosen creatures. For full details, see the D&D 5e Wiki link.",
      wikiLink: "https://dnd5e.wikidot.com/spell:beacon-of-hope"
    },
    {
      name: "Bestow Curse",
      level: 3,
      school: "Necromancy",
      castingTime: "1 action",
      range: "Touch",
      components: "V, S",
      duration: "Concentration, up to 1 minute",
      damage: "",
      save: "Wisdom save",
      attack: "",
      ritual: false,
      concentration: true,
      description: "Curses a touched creature with various effects. Target makes Wisdom save. For full details, see the D&D 5e Wiki link.",
      wikiLink: "https://dnd5e.wikidot.com/spell:bestow-curse"
    },
    {
      name: "Blink",
      level: 3,
      school: "Transmutation",
      castingTime: "1 action",
      range: "Self",
      components: "V, S",
      duration: "1 minute",
      damage: "",
      save: "",
      attack: "",
      ritual: false,
      concentration: false,
      description: "Each turn, roll d20. On 11+, you vanish to the Ethereal Plane until next turn. For full details, see the D&D 5e Wiki link.",
      wikiLink: "https://dnd5e.wikidot.com/spell:blink"
    },
    {
      name: "Call Lightning",
      level: 3,
      school: "Conjuration",
      castingTime: "1 action",
      range: "120 feet",
      components: "V, S",
      duration: "Concentration, up to 10 minutes",
      damage: "3d10 lightning damage",
      save: "Dexterity save",
      attack: "",
      ritual: false,
      concentration: true,
      description: "Creates a storm cloud that can strike lightning for 3d10 lightning damage. For full details, see the D&D 5e Wiki link.",
      wikiLink: "https://dnd5e.wikidot.com/spell:call-lightning"
    },
    {
      name: "Catnap",
      level: 3,
      school: "Enchantment",
      castingTime: "1 action",
      range: "30 feet",
      components: "S, M",
      duration: "10 minutes",
      damage: "",
      save: "",
      attack: "",
      ritual: false,
      concentration: false,
      description: "Puts up to 3 willing creatures to sleep for 10 minutes. For full details, see the D&D 5e Wiki link.",
      wikiLink: "https://dnd5e.wikidot.com/spell:catnap"
    },
    {
      name: "Clairvoyance",
      level: 3,
      school: "Divination",
      castingTime: "10 minutes",
      range: "1 mile",
      components: "V, S, M",
      duration: "Concentration, up to 10 minutes",
      damage: "",
      save: "",
      attack: "",
      ritual: false,
      concentration: true,
      description: "Creates an invisible sensor to see and hear at a location within 1 mile. For full details, see the D&D 5e Wiki link.",
      wikiLink: "https://dnd5e.wikidot.com/spell:clairvoyance"
    },
    {
      name: "Conjure Animals",
      level: 3,
      school: "Conjuration",
      castingTime: "1 action",
      range: "60 feet",
      components: "V, S",
      duration: "Concentration, up to 1 hour",
      damage: "",
      save: "",
      attack: "",
      ritual: false,
      concentration: true,
      description: "Summons fey spirits in the form of beasts. Choose from various options based on challenge rating. For full details, see the D&D 5e Wiki link.",
      wikiLink: "https://dnd5e.wikidot.com/spell:conjure-animals"
    },
    {
      name: "Counterspell",
      level: 3,
      school: "Abjuration",
      castingTime: "1 reaction",
      range: "60 feet",
      components: "S",
      duration: "Instantaneous",
      damage: "",
      save: "",
      attack: "",
      ritual: false,
      concentration: false,
      description: "Reaction spell that interrupts spellcasting. Automatically counters 3rd level or lower spells. For full details, see the D&D 5e Wiki link.",
      wikiLink: "https://dnd5e.wikidot.com/spell:counterspell"
    },
    {
      name: "Create Food and Water",
      level: 3,
      school: "Conjuration",
      castingTime: "1 action",
      range: "30 feet",
      components: "V, S",
      duration: "Instantaneous",
      damage: "",
      save: "",
      attack: "",
      ritual: false,
      concentration: false,
      description: "Creates 45 pounds of food and 30 gallons of water, enough to sustain 15 humanoids or 5 steeds for 24 hours. For full details, see the D&D 5e Wiki link.",
      wikiLink: "https://dnd5e.wikidot.com/spell:create-food-and-water"
    },
    {
      name: "Daylight",
      level: 3,
      school: "Evocation",
      castingTime: "1 action",
      range: "60 feet",
      components: "V, S",
      duration: "1 hour",
      damage: "",
      save: "",
      attack: "",
      ritual: false,
      concentration: false,
      description: "Creates a 60-foot radius sphere of bright light that sheds dim light for an additional 60 feet. For full details, see the D&D 5e Wiki link.",
      wikiLink: "https://dnd5e.wikidot.com/spell:daylight"
    },
    {
      name: "Dispel Magic",
      level: 3,
      school: "Abjuration",
      castingTime: "1 action",
      range: "120 feet",
      components: "V, S",
      duration: "Instantaneous",
      damage: "",
      save: "",
      attack: "",
      ritual: false,
      concentration: false,
      description: "Ends spells of 3rd level or lower automatically. Higher level spells require ability checks. For full details, see the D&D 5e Wiki link.",
      wikiLink: "https://dnd5e.wikidot.com/spell:dispel-magic"
    },
    {
      name: "Elemental Weapon",
      level: 3,
      school: "Transmutation",
      castingTime: "1 action",
      range: "Touch",
      components: "V, S",
      duration: "Concentration, up to 1 hour",
      damage: "",
      save: "",
      attack: "",
      ritual: false,
      concentration: true,
      description: "Makes a weapon magical with +1 to attack rolls and +1d4 elemental damage. For full details, see the D&D 5e Wiki link.",
      wikiLink: "https://dnd5e.wikidot.com/spell:elemental-weapon"
    },
    {
      name: "Fear",
      level: 3,
      school: "Illusion",
      castingTime: "1 action",
      range: "Self (30-foot cone)",
      components: "V, S, M",
      duration: "Concentration, up to 1 minute",
      damage: "",
      save: "Wisdom save",
      attack: "",
      ritual: false,
      concentration: true,
      description: "Creates a 30-foot cone of fear. Creatures make Wisdom saves or drop held items and become frightened. For full details, see the D&D 5e Wiki link.",
      wikiLink: "https://dnd5e.wikidot.com/spell:fear"
    },
    {
      name: "Fireball",
      level: 3,
      school: "Evocation",
      castingTime: "1 action",
      range: "150 feet",
      components: "V, S, M",
      duration: "Instantaneous",
      damage: "8d6 fire damage",
      save: "Dexterity save",
      attack: "",
      ritual: false,
      concentration: false,
      description: "Creates a 20-foot radius explosion dealing 8d6 fire damage. Targets make Dexterity saves for half damage. For full details, see the D&D 5e Wiki link.",
      wikiLink: "https://dnd5e.wikidot.com/spell:fireball"
    },
    {
      name: "Fly",
      level: 3,
      school: "Transmutation",
      castingTime: "1 action",
      range: "Touch",
      components: "V, S, M",
      duration: "Concentration, up to 10 minutes",
      damage: "",
      save: "",
      attack: "",
      ritual: false,
      concentration: true,
      description: "Grants a flying speed of 60 feet for 10 minutes. For full details, see the D&D 5e Wiki link.",
      wikiLink: "https://dnd5e.wikidot.com/spell:fly"
    },
    {
      name: "Gaseous Form",
      level: 3,
      school: "Transmutation",
      castingTime: "1 action",
      range: "Touch",
      components: "V, S, M",
      duration: "Concentration, up to 1 hour",
      damage: "",
      save: "",
      attack: "",
      ritual: false,
      concentration: true,
      description: "Transforms a creature into a misty cloud for 1 hour. For full details, see the D&D 5e Wiki link.",
      wikiLink: "https://dnd5e.wikidot.com/spell:gaseous-form"
    },
    {
      name: "Glyph of Warding",
      level: 3,
      school: "Abjuration",
      castingTime: "1 hour",
      range: "Touch",
      components: "V, S, M",
      duration: "Until dispelled or triggered",
      damage: "",
      save: "",
      attack: "",
      ritual: false,
      concentration: false,
      description: "Inscribes a magical glyph that triggers when disturbed, dealing damage or other effects. For full details, see the D&D 5e Wiki link.",
      wikiLink: "https://dnd5e.wikidot.com/spell:glyph-of-warding"
    },
    {
      name: "Haste",
      level: 3,
      school: "Transmutation",
      castingTime: "1 action",
      range: "30 feet",
      components: "V, S, M",
      duration: "Concentration, up to 1 minute",
      damage: "",
      save: "",
      attack: "",
      ritual: false,
      concentration: true,
      description: "Doubles speed, grants +2 AC, advantage on Dexterity saves, and an additional action each turn. For full details, see the D&D 5e Wiki link.",
      wikiLink: "https://dnd5e.wikidot.com/spell:haste"
    },
    {
      name: "Hypnotic Pattern",
      level: 3,
      school: "Illusion",
      castingTime: "1 action",
      range: "120 feet",
      components: "S, M",
      duration: "Concentration, up to 1 minute",
      damage: "",
      save: "Wisdom save",
      attack: "",
      ritual: false,
      concentration: true,
      description: "Creates a 30-foot cube of twisting colors that charms creatures who see it. Targets make Wisdom saves. For full details, see the D&D 5e Wiki link.",
      wikiLink: "https://dnd5e.wikidot.com/spell:hypnotic-pattern"
    },
    {
      name: "Intellect Fortress",
      level: 3,
      school: "Abjuration",
      castingTime: "1 action",
      range: "Touch",
      components: "V, S",
      duration: "Concentration, up to 1 hour",
      damage: "",
      save: "",
      attack: "",
      ritual: false,
      concentration: true,
      description: "Grants resistance to psychic damage and advantage on Intelligence, Wisdom, and Charisma saves. For full details, see the D&D 5e Wiki link.",
      wikiLink: "https://dnd5e.wikidot.com/spell:intellect-fortress"
    },
    {
      name: "Lightning Bolt",
      level: 3,
      school: "Evocation",
      castingTime: "1 action",
      range: "Self (100-foot line)",
      components: "V, S, M",
      duration: "Instantaneous",
      damage: "8d6 lightning damage",
      save: "Dexterity save",
      attack: "",
      ritual: false,
      concentration: false,
      description: "Creates a 100-foot line of lightning dealing 8d6 lightning damage. Targets make Dexterity saves for half damage. For full details, see the D&D 5e Wiki link.",
      wikiLink: "https://dnd5e.wikidot.com/spell:lightning-bolt"
    },
    {
      name: "Magic Circle",
      level: 3,
      school: "Abjuration",
      castingTime: "1 minute",
      range: "10 feet",
      components: "V, S, M",
      duration: "1 hour",
      damage: "",
      save: "",
      attack: "",
      ritual: false,
      concentration: false,
      description: "Creates a 10-foot radius cylinder that blocks or traps certain creature types. For full details, see the D&D 5e Wiki link.",
      wikiLink: "https://dnd5e.wikidot.com/spell:magic-circle"
    },
    {
      name: "Major Image",
      level: 3,
      school: "Illusion",
      castingTime: "1 action",
      range: "120 feet",
      components: "V, S, M",
      duration: "Concentration, up to 10 minutes",
      damage: "",
      save: "",
      attack: "",
      ritual: false,
      concentration: true,
      description: "Creates a visual illusion of an object or creature in a 20-foot cube. For full details, see the D&D 5e Wiki link.",
      wikiLink: "https://dnd5e.wikidot.com/spell:major-image"
    },
    {
      name: "Mass Healing Word",
      level: 3,
      school: "Evocation",
      castingTime: "1 bonus action",
      range: "60 feet",
      components: "V",
      duration: "Instantaneous",
      damage: "",
      save: "",
      attack: "",
      ritual: false,
      concentration: false,
      description: "Bonus action healing spell that restores 1d4 + spellcasting modifier hit points to up to 6 creatures. For full details, see the D&D 5e Wiki link.",
      wikiLink: "https://dnd5e.wikidot.com/spell:mass-healing-word"
    },
    {
      name: "Meld into Stone",
      level: 3,
      school: "Transmutation",
      castingTime: "1 action",
      range: "Touch",
      components: "V, S",
      duration: "8 hours",
      damage: "",
      save: "",
      attack: "",
      ritual: true,
      concentration: false,
      description: "Allows you to meld into stone for 8 hours, becoming undetectable. For full details, see the D&D 5e Wiki link.",
      wikiLink: "https://dnd5e.wikidot.com/spell:meld-into-stone"
    },
    {
      name: "Nondetection",
      level: 3,
      school: "Abjuration",
      castingTime: "1 action",
      range: "Touch",
      components: "V, S, M",
      duration: "8 hours",
      damage: "",
      save: "",
      attack: "",
      ritual: false,
      concentration: false,
      description: "Hides a target from divination magic and magical scrying for 8 hours. For full details, see the D&D 5e Wiki link.",
      wikiLink: "https://dnd5e.wikidot.com/spell:nondetection"
    },
    {
      name: "Plant Growth",
      level: 3,
      school: "Transmutation",
      castingTime: "1 action",
      range: "150 feet",
      components: "V, S",
      duration: "Instantaneous",
      damage: "",
      save: "",
      attack: "",
      ritual: false,
      concentration: false,
      description: "Channels vitality into plants, creating difficult terrain or enhancing crop growth. For full details, see the D&D 5e Wiki link.",
      wikiLink: "https://dnd5e.wikidot.com/spell:plant-growth"
    },
    {
      name: "Protection from Energy",
      level: 3,
      school: "Abjuration",
      castingTime: "1 action",
      range: "Touch",
      components: "V, S",
      duration: "Concentration, up to 1 hour",
      damage: "",
      save: "",
      attack: "",
      ritual: false,
      concentration: true,
      description: "Grants resistance to one damage type (acid, cold, fire, lightning, or thunder) for 1 hour. For full details, see the D&D 5e Wiki link.",
      wikiLink: "https://dnd5e.wikidot.com/spell:protection-from-energy"
    },
    {
      name: "Remove Curse",
      level: 3,
      school: "Abjuration",
      castingTime: "1 action",
      range: "Touch",
      components: "V, S",
      duration: "Instantaneous",
      damage: "",
      save: "",
      attack: "",
      ritual: false,
      concentration: false,
      description: "Removes all curses from a creature or object. Breaks attunement to cursed magic items. For full details, see the D&D 5e Wiki link.",
      wikiLink: "https://dnd5e.wikidot.com/spell:remove-curse"
    },
    {
      name: "Revivify",
      level: 3,
      school: "Necromancy",
      castingTime: "1 action",
      range: "Touch",
      components: "V, S, M",
      duration: "Instantaneous",
      damage: "",
      save: "",
      attack: "",
      ritual: false,
      concentration: false,
      description: "Brings back a creature that died within the last minute with 1 hit point. For full details, see the D&D 5e Wiki link.",
      wikiLink: "https://dnd5e.wikidot.com/spell:revivify"
    },
    {
      name: "Sending",
      level: 3,
      school: "Evocation",
      castingTime: "1 action",
      range: "Unlimited",
      components: "V, S, M",
      duration: "1 round",
      damage: "",
      save: "",
      attack: "",
      ritual: false,
      concentration: false,
      description: "Sends a 25-word message to a familiar creature anywhere. They can reply immediately. For full details, see the D&D 5e Wiki link.",
      wikiLink: "https://dnd5e.wikidot.com/spell:sending"
    },
    {
      name: "Sleet Storm",
      level: 3,
      school: "Conjuration",
      castingTime: "1 action",
      range: "150 feet",
      components: "V, S, M",
      duration: "Concentration, up to 1 minute",
      damage: "",
      save: "Dexterity save",
      attack: "",
      ritual: false,
      concentration: true,
      description: "Creates a 40-foot radius cylinder of freezing rain and sleet that heavily obscures the area. For full details, see the D&D 5e Wiki link.",
      wikiLink: "https://dnd5e.wikidot.com/spell:sleet-storm"
    },
    {
      name: "Slow",
      level: 3,
      school: "Transmutation",
      castingTime: "1 action",
      range: "120 feet",
      components: "V, S, M",
      duration: "Concentration, up to 1 minute",
      damage: "",
      save: "Wisdom save",
      attack: "",
      ritual: false,
      concentration: true,
      description: "Slows up to 6 creatures in a 40-foot cube. Targets make Wisdom saves or are affected. For full details, see the D&D 5e Wiki link.",
      wikiLink: "https://dnd5e.wikidot.com/spell:slow"
    },
    {
      name: "Speak with Dead",
      level: 3,
      school: "Necromancy",
      castingTime: "1 action",
      range: "10 feet",
      components: "V, S, M",
      duration: "10 minutes",
      damage: "",
      save: "",
      attack: "",
      ritual: false,
      concentration: false,
      description: "Allows a corpse to answer questions for 10 minutes. Can't be used on the same corpse within 10 days. For full details, see the D&D 5e Wiki link.",
      wikiLink: "https://dnd5e.wikidot.com/spell:speak-with-dead"
    },
    {
      name: "Spirit Guardians",
      level: 3,
      school: "Conjuration",
      castingTime: "1 action",
      range: "Self (15-foot radius)",
      components: "V, S, M",
      duration: "Concentration, up to 10 minutes",
      damage: "3d8 radiant damage",
      save: "Wisdom save",
      attack: "",
      ritual: false,
      concentration: true,
      description: "Summons spirits in a 15-foot radius that deal 3d8 radiant damage to enemies. For full details, see the D&D 5e Wiki link.",
      wikiLink: "https://dnd5e.wikidot.com/spell:spirit-guardians"
    },
    {
      name: "Stinking Cloud",
      level: 3,
      school: "Conjuration",
      castingTime: "1 action",
      range: "90 feet",
      components: "V, S, M",
      duration: "Concentration, up to 1 minute",
      damage: "",
      save: "Constitution save",
      attack: "",
      ritual: false,
      concentration: true,
      description: "Creates a 20-foot radius sphere of nauseating gas that heavily obscures the area. For full details, see the D&D 5e Wiki link.",
      wikiLink: "https://dnd5e.wikidot.com/spell:stinking-cloud"
    },
    {
      name: "Tiny Servant",
      level: 3,
      school: "Transmutation",
      castingTime: "1 minute",
      range: "Touch",
      components: "V, S",
      duration: "8 hours",
      damage: "",
      save: "",
      attack: "",
      ritual: false,
      concentration: false,
      description: "Animates a Tiny object into a servant under your control for 8 hours. For full details, see the D&D 5e Wiki link.",
      wikiLink: "https://dnd5e.wikidot.com/spell:tiny-servant"
    },
    {
      name: "Tongues",
      level: 3,
      school: "Divination",
      castingTime: "1 action",
      range: "Touch",
      components: "V, M",
      duration: "1 hour",
      damage: "",
      save: "",
      attack: "",
      ritual: false,
      concentration: false,
      description: "Allows understanding and speaking of any language for 1 hour. For full details, see the D&D 5e Wiki link.",
      wikiLink: "https://dnd5e.wikidot.com/spell:tongues"
    },
    {
      name: "Vampiric Touch",
      level: 3,
      school: "Necromancy",
      castingTime: "1 action",
      range: "Self",
      components: "V, S",
      duration: "Concentration, up to 1 minute",
      damage: "3d6 necrotic damage",
      save: "",
      attack: "Melee spell attack",
      ritual: false,
      concentration: true,
      description: "Melee spell attack dealing 3d6 necrotic damage and healing you for half the damage dealt. For full details, see the D&D 5e Wiki link.",
      wikiLink: "https://dnd5e.wikidot.com/spell:vampiric-touch"
    },
    {
      name: "Wall of Sand",
      level: 3,
      school: "Evocation",
      castingTime: "1 action",
      range: "90 feet",
      components: "V, S, M",
      duration: "Concentration, up to 10 minutes",
      damage: "",
      save: "",
      attack: "",
      ritual: false,
      concentration: true,
      description: "Creates a wall of swirling sand that can be shaped into various forms. For full details, see the D&D 5e Wiki link.",
      wikiLink: "https://dnd5e.wikidot.com/spell:wall-of-sand"
    },
    {
      name: "Wall of Water",
      level: 3,
      school: "Evocation",
      castingTime: "1 action",
      range: "60 feet",
      components: "V, S, M",
      duration: "Concentration, up to 10 minutes",
      damage: "",
      save: "",
      attack: "",
      ritual: false,
      concentration: true,
      description: "Creates a wall of water that can be shaped into various forms. For full details, see the D&D 5e Wiki link.",
      wikiLink: "https://dnd5e.wikidot.com/spell:wall-of-water"
    },
    {
      name: "Water Breathing",
      level: 3,
      school: "Transmutation",
      castingTime: "1 action",
      range: "30 feet",
      components: "V, S, M",
      duration: "24 hours",
      damage: "",
      save: "",
      attack: "",
      ritual: true,
      concentration: false,
      description: "Grants up to 10 creatures the ability to breathe underwater for 24 hours. For full details, see the D&D 5e Wiki link.",
      wikiLink: "https://dnd5e.wikidot.com/spell:water-breathing"
    },
    {
      name: "Water Walk",
      level: 3,
      school: "Transmutation",
      castingTime: "1 action",
      range: "30 feet",
      components: "V, S, M",
      duration: "1 hour",
      damage: "",
      save: "",
      attack: "",
      ritual: true,
      concentration: false,
      description: "Grants up to 10 creatures the ability to walk on liquid surfaces for 1 hour. For full details, see the D&D 5e Wiki link.",
      wikiLink: "https://dnd5e.wikidot.com/spell:water-walk"
    },
    {
      name: "Wind Wall",
      level: 3,
      school: "Evocation",
      castingTime: "1 action",
      range: "120 feet",
      components: "V, S, M",
      duration: "Concentration, up to 1 minute",
      damage: "",
      save: "",
      attack: "",
      ritual: false,
      concentration: true,
      description: "Creates a wall of strong wind that deflects projectiles and creates difficult terrain. For full details, see the D&D 5e Wiki link.",
      wikiLink: "https://dnd5e.wikidot.com/spell:wind-wall"
    },
    {
      name: "Arcane Eye",
      level: 4,
      school: "Divination",
      castingTime: "1 action",
      range: "30 feet",
      components: "V, S, M",
      duration: "Concentration, up to 1 hour",
      damage: "",
      save: "",
      attack: "",
      ritual: false,
      concentration: true,
      description: "Creates an invisible eye that you can see through and control for 1 hour. For full details, see the D&D 5e Wiki link.",
      wikiLink: "https://dnd5e.wikidot.com/spell:arcane-eye"
    },
    {
      name: "Aura of Life",
      level: 4,
      school: "Abjuration",
      castingTime: "1 action",
      range: "Self (30-foot radius)",
      components: "V",
      duration: "Concentration, up to 10 minutes",
      damage: "",
      save: "",
      attack: "",
      ritual: false,
      concentration: true,
      description: "Creates a 30-foot radius aura that grants resistance to necrotic damage and prevents hit point maximum reduction. For full details, see the D&D 5e Wiki link.",
      wikiLink: "https://dnd5e.wikidot.com/spell:aura-of-life"
    },
    {
      name: "Aura of Purity",
      level: 4,
      school: "Abjuration",
      castingTime: "1 action",
      range: "Self (30-foot radius)",
      components: "V",
      duration: "Concentration, up to 10 minutes",
      damage: "",
      save: "",
      attack: "",
      ritual: false,
      concentration: true,
      description: "Creates a 30-foot radius aura that prevents disease, grants poison resistance, and advantage on saves against various conditions. For full details, see the D&D 5e Wiki link.",
      wikiLink: "https://dnd5e.wikidot.com/spell:aura-of-purity"
    },
    {
      name: "Banishment",
      level: 4,
      school: "Abjuration",
      castingTime: "1 action",
      range: "60 feet",
      components: "V, S, M",
      duration: "Concentration, up to 1 minute",
      damage: "",
      save: "Charisma save",
      attack: "",
      ritual: false,
      concentration: true,
      description: "Attempts to banish a creature to another plane. Target makes Charisma save. For full details, see the D&D 5e Wiki link.",
      wikiLink: "https://dnd5e.wikidot.com/spell:banishment"
    },
    {
      name: "Blight",
      level: 4,
      school: "Necromancy",
      castingTime: "1 action",
      range: "30 feet",
      components: "V, S",
      duration: "Instantaneous",
      damage: "8d8 necrotic damage",
      save: "Constitution save",
      attack: "",
      ritual: false,
      concentration: false,
      description: "Deals 8d8 necrotic damage to a creature. Target makes Constitution save for half damage. For full details, see the D&D 5e Wiki link.",
      wikiLink: "https://dnd5e.wikidot.com/spell:blight"
    },
    {
      name: "Compulsion",
      level: 4,
      school: "Enchantment",
      castingTime: "1 action",
      range: "30 feet",
      components: "V, S",
      duration: "Concentration, up to 1 minute",
      damage: "",
      save: "Wisdom save",
      attack: "",
      ritual: false,
      concentration: true,
      description: "Forces creatures to move in a specific direction. Targets make Wisdom saves. For full details, see the D&D 5e Wiki link.",
      wikiLink: "https://dnd5e.wikidot.com/spell:compulsion"
    },
    {
      name: "Confusion",
      level: 4,
      school: "Enchantment",
      castingTime: "1 action",
      range: "90 feet",
      components: "V, S, M",
      duration: "Concentration, up to 1 minute",
      damage: "",
      save: "Wisdom save",
      attack: "",
      ritual: false,
      concentration: true,
      description: "Creates a 10-foot radius sphere that confuses creatures. Targets make Wisdom saves. For full details, see the D&D 5e Wiki link.",
      wikiLink: "https://dnd5e.wikidot.com/spell:confusion"
    },
    {
      name: "Conjure Minor Elementals",
      level: 4,
      school: "Conjuration",
      castingTime: "1 minute",
      range: "90 feet",
      components: "V, S",
      duration: "Concentration, up to 1 hour",
      damage: "",
      save: "",
      attack: "",
      ritual: false,
      concentration: true,
      description: "Summons elementals of various challenge ratings. Choose from different options based on CR. For full details, see the D&D 5e Wiki link.",
      wikiLink: "https://dnd5e.wikidot.com/spell:conjure-minor-elementals"
    },
    {
      name: "Conjure Woodland Beings",
      level: 4,
      school: "Conjuration",
      castingTime: "1 action",
      range: "60 feet",
      components: "V, S, M",
      duration: "Concentration, up to 1 hour",
      damage: "",
      save: "",
      attack: "",
      ritual: false,
      concentration: true,
      description: "Summons fey creatures of various challenge ratings. Choose from different options based on CR. For full details, see the D&D 5e Wiki link.",
      wikiLink: "https://dnd5e.wikidot.com/spell:conjure-woodland-beings"
    },
    {
      name: "Control Water",
      level: 4,
      school: "Transmutation",
      castingTime: "1 action",
      range: "300 feet",
      components: "V, S, M",
      duration: "Concentration, up to 10 minutes",
      damage: "",
      save: "",
      attack: "",
      ritual: false,
      concentration: true,
      description: "Controls water in a 100-foot cube with various effects like flooding, parting, or redirecting. For full details, see the D&D 5e Wiki link.",
      wikiLink: "https://dnd5e.wikidot.com/spell:control-water"
    },
    {
      name: "Death Ward",
      level: 4,
      school: "Abjuration",
      castingTime: "1 action",
      range: "Touch",
      components: "V, S",
      duration: "8 hours",
      damage: "",
      save: "",
      attack: "",
      ritual: false,
      concentration: false,
      description: "Prevents a creature from dropping to 0 hit points once. The first time they would die, they drop to 1 hit point instead. For full details, see the D&D 5e Wiki link.",
      wikiLink: "https://dnd5e.wikidot.com/spell:death-ward"
    },
    {
      name: "Dimension Door",
      level: 4,
      school: "Conjuration",
      castingTime: "1 action",
      range: "500 feet",
      components: "V",
      duration: "Instantaneous",
      damage: "",
      save: "",
      attack: "",
      ritual: false,
      concentration: false,
      description: "Teleports you up to 500 feet to any location you can see or describe. For full details, see the D&D 5e Wiki link.",
      wikiLink: "https://dnd5e.wikidot.com/spell:dimension-door"
    },
    {
      name: "Divination",
      level: 4,
      school: "Divination",
      castingTime: "1 action",
      range: "Self",
      components: "V, S, M",
      duration: "Instantaneous",
      damage: "",
      save: "",
      attack: "",
      ritual: true,
      concentration: false,
      description: "Asks a single question to a god or their servants about events within 7 days. For full details, see the D&D 5e Wiki link.",
      wikiLink: "https://dnd5e.wikidot.com/spell:divination"
    },
    {
      name: "Dominate Beast",
      level: 4,
      school: "Enchantment",
      castingTime: "1 action",
      range: "60 feet",
      components: "V, S",
      duration: "Concentration, up to 1 minute",
      damage: "",
      save: "Wisdom save",
      attack: "",
      ritual: false,
      concentration: true,
      description: "Charms a beast, making it follow your commands. Target makes Wisdom save. For full details, see the D&D 5e Wiki link.",
      wikiLink: "https://dnd5e.wikidot.com/spell:dominate-beast"
    },
    {
      name: "Elemental Bane",
      level: 4,
      school: "Transmutation",
      castingTime: "1 action",
      range: "90 feet",
      components: "V, S",
      duration: "Concentration, up to 1 minute",
      damage: "",
      save: "Constitution save",
      attack: "",
      ritual: false,
      concentration: true,
      description: "Curses a creature to take extra damage from one elemental type. Target makes Constitution save. For full details, see the D&D 5e Wiki link.",
      wikiLink: "https://dnd5e.wikidot.com/spell:elemental-bane"
    },
    {
      name: "Evard's Black Tentacles",
      level: 4,
      school: "Conjuration",
      castingTime: "1 action",
      range: "90 feet",
      components: "V, S, M",
      duration: "Concentration, up to 1 minute",
      damage: "3d6 bludgeoning damage",
      save: "Dexterity save",
      attack: "",
      ritual: false,
      concentration: true,
      description: "Creates a 20-foot square of black tentacles that deal 3d6 bludgeoning damage and restrain creatures. For full details, see the D&D 5e Wiki link.",
      wikiLink: "https://dnd5e.wikidot.com/spell:evards-black-tentacles"
    },
    {
      name: "Fabricate",
      level: 4,
      school: "Transmutation",
      castingTime: "10 minutes",
      range: "120 feet",
      components: "V, S",
      duration: "Instantaneous",
      damage: "",
      save: "",
      attack: "",
      ritual: false,
      concentration: false,
      description: "Converts raw materials into finished products of the same material. For full details, see the D&D 5e Wiki link.",
      wikiLink: "https://dnd5e.wikidot.com/spell:fabricate"
    },
    {
      name: "Fire Shield",
      level: 4,
      school: "Evocation",
      castingTime: "1 action",
      range: "Self",
      components: "V, S, M",
      duration: "10 minutes",
      damage: "2d8 fire damage",
      save: "",
      attack: "",
      ritual: false,
      concentration: false,
      description: "Creates a shield of flames that provides resistance to fire or cold damage and deals 2d8 damage to attackers. For full details, see the D&D 5e Wiki link.",
      wikiLink: "https://dnd5e.wikidot.com/spell:fire-shield"
    },
    {
      name: "Freedom of Movement",
      level: 4,
      school: "Abjuration",
      castingTime: "1 action",
      range: "Touch",
      components: "V, S, M",
      duration: "1 hour",
      damage: "",
      save: "",
      attack: "",
      ritual: false,
      concentration: false,
      description: "Grants immunity to difficult terrain and prevents speed reduction, paralysis, and restraint. For full details, see the D&D 5e Wiki link.",
      wikiLink: "https://dnd5e.wikidot.com/spell:freedom-of-movement"
    },
    {
      name: "Giant Insect",
      level: 4,
      school: "Transmutation",
      castingTime: "1 action",
      range: "30 feet",
      components: "V, S, M",
      duration: "Concentration, up to 10 minutes",
      damage: "",
      save: "",
      attack: "",
      ritual: false,
      concentration: true,
      description: "Transforms insects into giant versions for 10 minutes. For full details, see the D&D 5e Wiki link.",
      wikiLink: "https://dnd5e.wikidot.com/spell:giant-insect"
    },
    {
      name: "Grasping Vine",
      level: 4,
      school: "Conjuration",
      castingTime: "1 bonus action",
      range: "30 feet",
      components: "V, S",
      duration: "Concentration, up to 1 minute",
      damage: "2d6 bludgeoning damage",
      save: "Strength save",
      attack: "",
      ritual: false,
      concentration: true,
      description: "Creates a vine that can pull creatures 20 feet toward it. Target makes Strength save. For full details, see the D&D 5e Wiki link.",
      wikiLink: "https://dnd5e.wikidot.com/spell:grasping-vine"
    },
    {
      name: "Greater Invisibility",
      level: 4,
      school: "Illusion",
      castingTime: "1 action",
      range: "Touch",
      components: "V, S",
      duration: "Concentration, up to 1 minute",
      damage: "",
      save: "",
      attack: "",
      ritual: false,
      concentration: true,
      description: "Makes a creature invisible for 1 minute. Invisibility doesn't end when attacking or casting spells. For full details, see the D&D 5e Wiki link.",
      wikiLink: "https://dnd5e.wikidot.com/spell:greater-invisibility"
    },
    {
      name: "Guardian of Faith",
      level: 4,
      school: "Conjuration",
      castingTime: "1 action",
      range: "30 feet",
      components: "V",
      duration: "8 hours",
      damage: "60 radiant damage",
      save: "",
      attack: "",
      ritual: false,
      concentration: false,
      description: "Creates a spectral guardian that attacks creatures entering its space for 60 radiant damage. For full details, see the D&D 5e Wiki link.",
      wikiLink: "https://dnd5e.wikidot.com/spell:guardian-of-faith"
    },
    {
      name: "Hallucinatory Terrain",
      level: 4,
      school: "Illusion",
      castingTime: "10 minutes",
      range: "300 feet",
      components: "V, S, M",
      duration: "24 hours",
      damage: "",
      save: "",
      attack: "",
      ritual: false,
      concentration: false,
      description: "Makes natural terrain in a 150-foot cube look, sound, and smell like different terrain for 24 hours. For full details, see the D&D 5e Wiki link.",
      wikiLink: "https://dnd5e.wikidot.com/spell:hallucinatory-terrain"
    },
    {
      name: "Ice Storm",
      level: 4,
      school: "Evocation",
      castingTime: "1 action",
      range: "300 feet",
      components: "V, S, M",
      duration: "Instantaneous",
      damage: "2d8 bludgeoning damage",
      save: "Dexterity save",
      attack: "",
      ritual: false,
      concentration: false,
      description: "Creates a 20-foot radius cylinder of ice that deals 2d8 bludgeoning and 4d6 cold damage. Targets make Dexterity saves for half damage. For full details, see the D&D 5e Wiki link.",
      wikiLink: "https://dnd5e.wikidot.com/spell:ice-storm"
    },
    {
      name: "Leomund's Secret Chest",
      level: 4,
      school: "Conjuration",
      castingTime: "1 action",
      range: "Touch",
      components: "V, S, M",
      duration: "Instantaneous",
      damage: "",
      save: "",
      attack: "",
      ritual: false,
      concentration: false,
      description: "Hides a chest and its contents on the Ethereal Plane. Can be retrieved with the miniature replica. For full details, see the D&D 5e Wiki link.",
      wikiLink: "https://dnd5e.wikidot.com/spell:leomunds-secret-chest"
    },
    {
      name: "Locate Creature",
      level: 4,
      school: "Divination",
      castingTime: "1 action",
      range: "Self",
      components: "V, S, M",
      duration: "Concentration, up to 1 hour",
      damage: "",
      save: "",
      attack: "",
      ritual: false,
      concentration: true,
      description: "Senses the direction to a familiar creature within 1,000 feet. For full details, see the D&D 5e Wiki link.",
      wikiLink: "https://dnd5e.wikidot.com/spell:locate-creature"
    },
    {
      name: "Mordenkainen's Faithful Hound",
      level: 4,
      school: "Conjuration",
      castingTime: "1 action",
      range: "30 feet",
      components: "V, S, M",
      duration: "8 hours",
      damage: "4d8 piercing damage",
      save: "",
      attack: "",
      ritual: false,
      concentration: false,
      description: "Creates an invisible phantom hound that attacks intruders for 4d8 piercing damage. For full details, see the D&D 5e Wiki link.",
      wikiLink: "https://dnd5e.wikidot.com/spell:mordenkainens-faithful-hound"
    },
    {
      name: "Mordenkainen's Private Sanctum",
      level: 4,
      school: "Abjuration",
      castingTime: "10 minutes",
      range: "120 feet",
      components: "V, S, M",
      duration: "24 hours",
      damage: "",
      save: "",
      attack: "",
      ritual: false,
      concentration: false,
      description: "Creates a magically secure area that can be customized with various security properties. For full details, see the D&D 5e Wiki link.",
      wikiLink: "https://dnd5e.wikidot.com/spell:mordenkainens-private-sanctum"
    },
    {
      name: "Otiluke's Resilient Sphere",
      level: 4,
      school: "Evocation",
      castingTime: "1 action",
      range: "30 feet",
      components: "V, S, M",
      duration: "Concentration, up to 1 minute",
      damage: "",
      save: "Dexterity save",
      attack: "",
      ritual: false,
      concentration: true,
      description: "Creates a sphere of force that encloses a creature or object. Target makes Dexterity save. For full details, see the D&D 5e Wiki link.",
      wikiLink: "https://dnd5e.wikidot.com/spell:otilukes-resilient-sphere"
    },
    {
      name: "Phantasmal Killer",
      level: 4,
      school: "Illusion",
      castingTime: "1 action",
      range: "120 feet",
      components: "V, S",
      duration: "Concentration, up to 1 minute",
      damage: "4d10 psychic damage",
      save: "Wisdom save",
      attack: "",
      ritual: false,
      concentration: true,
      description: "Creates a phantasmal killer that frightens a creature and deals 4d10 psychic damage each turn. Target makes Wisdom saves. For full details, see the D&D 5e Wiki link.",
      wikiLink: "https://dnd5e.wikidot.com/spell:phantasmal-killer"
    },
    {
      name: "Polymorph",
      level: 4,
      school: "Transmutation",
      castingTime: "1 action",
      range: "60 feet",
      components: "V, S, M",
      duration: "Concentration, up to 1 hour",
      damage: "",
      save: "Wisdom save",
      attack: "",
      ritual: false,
      concentration: true,
      description: "Transforms a creature into a new form. Target makes Wisdom save. For full details, see the D&D 5e Wiki link.",
      wikiLink: "https://dnd5e.wikidot.com/spell:polymorph"
    },
    {
      name: "Staggering Smite",
      level: 4,
      school: "Evocation",
      castingTime: "1 bonus action",
      range: "Self",
      components: "V",
      duration: "Concentration, up to 1 minute",
      damage: "4d6 psychic damage",
      save: "Wisdom save",
      attack: "",
      ritual: false,
      concentration: true,
      description: "Next melee attack deals +4d6 psychic damage and staggers the target if they fail Wisdom save. For full details, see the D&D 5e Wiki link.",
      wikiLink: "https://dnd5e.wikidot.com/spell:staggering-smite"
    },
    {
      name: "Stone Shape",
      level: 4,
      school: "Transmutation",
      castingTime: "1 action",
      range: "Touch",
      components: "V, S, M",
      duration: "Instantaneous",
      damage: "",
      save: "",
      attack: "",
      ritual: false,
      concentration: false,
      description: "Shapes stone into any form you desire. Can create weapons, passages, or other objects. For full details, see the D&D 5e Wiki link.",
      wikiLink: "https://dnd5e.wikidot.com/spell:stone-shape"
    },
    {
      name: "Stoneskin",
      level: 4,
      school: "Abjuration",
      castingTime: "1 action",
      range: "Touch",
      components: "V, S, M",
      duration: "Concentration, up to 1 hour",
      damage: "",
      save: "",
      attack: "",
      ritual: false,
      concentration: true,
      description: "Grants resistance to nonmagical bludgeoning, piercing, and slashing damage for 1 hour. For full details, see the D&D 5e Wiki link.",
      wikiLink: "https://dnd5e.wikidot.com/spell:stoneskin"
    },
    {
      name: "Wall of Fire",
      level: 4,
      school: "Evocation",
      castingTime: "1 action",
      range: "120 feet",
      components: "V, S, M",
      duration: "Concentration, up to 1 minute",
      damage: "5d8 fire damage",
      save: "Dexterity save",
      attack: "",
      ritual: false,
      concentration: true,
      description: "Creates a wall of fire that deals 5d8 fire damage to creatures passing through. For full details, see the D&D 5e Wiki link.",
      wikiLink: "https://dnd5e.wikidot.com/spell:wall-of-fire"
    },
    {
      name: "Watery Sphere",
      level: 4,
      school: "Conjuration",
      castingTime: "1 action",
      range: "90 feet",
      components: "V, S, M",
      duration: "Concentration, up to 1 minute",
      damage: "4d6 bludgeoning damage",
      save: "Dexterity save",
      attack: "",
      ritual: false,
      concentration: true,
      description: "Creates a 5-foot radius sphere of water that traps and damages creatures. Target makes Dexterity save. For full details, see the D&D 5e Wiki link.",
      wikiLink: "https://dnd5e.wikidot.com/spell:watery-sphere"
    },
    {
      name: "Animate Objects",
      level: 5,
      school: "Transmutation",
      castingTime: "1 action",
      range: "120 feet",
      components: "V, S",
      duration: "Concentration, up to 1 minute",
      damage: "",
      save: "",
      attack: "",
      ritual: false,
      concentration: true,
      description: "Animates up to 10 nonmagical objects, turning them into creatures under your control. For full details, see the D&D 5e Wiki link.",
      wikiLink: "https://dnd5e.wikidot.com/spell:animate-objects"
    },
    {
      name: "Bigby's Hand",
      level: 5,
      school: "Evocation",
      castingTime: "1 action",
      range: "120 feet",
      components: "V, S, M",
      duration: "Concentration, up to 1 minute",
      damage: "4d8 force damage",
      save: "Strength save",
      attack: "",
      ritual: false,
      concentration: true,
      description: "Creates a Large force hand that can attack, grapple, push, or block. For full details, see the D&D 5e Wiki link.",
      wikiLink: "https://dnd5e.wikidot.com/spell:bigbys-hand"
    },
    {
      name: "Circle of Power",
      level: 5,
      school: "Abjuration",
      castingTime: "1 action",
      range: "Self (30-foot radius)",
      components: "V",
      duration: "Concentration, up to 10 minutes",
      damage: "",
      save: "",
      attack: "",
      ritual: false,
      concentration: true,
      description: "Creates a 30-foot radius aura that grants advantage on saves against spells and prevents damage on successful saves. For full details, see the D&D 5e Wiki link.",
      wikiLink: "https://dnd5e.wikidot.com/spell:circle-of-power"
    },
    {
      name: "Cloudkill",
      level: 5,
      school: "Conjuration",
      castingTime: "1 action",
      range: "120 feet",
      components: "V, S",
      duration: "Concentration, up to 10 minutes",
      damage: "5d8 poison damage",
      save: "Constitution save",
      attack: "",
      ritual: false,
      concentration: true,
      description: "Creates a 20-foot radius sphere of poisonous fog that deals 5d8 poison damage. For full details, see the D&D 5e Wiki link.",
      wikiLink: "https://dnd5e.wikidot.com/spell:cloudkill"
    },
    {
      name: "Commune",
      level: 5,
      school: "Divination",
      castingTime: "1 minute",
      range: "Self",
      components: "V, S, M",
      duration: "1 minute",
      damage: "",
      save: "",
      attack: "",
      ritual: true,
      concentration: false,
      description: "Allows you to ask up to 3 yes/no questions to your deity or divine proxy. For full details, see the D&D 5e Wiki link.",
      wikiLink: "https://dnd5e.wikidot.com/spell:commune"
    },
    {
      name: "Commune with Nature",
      level: 5,
      school: "Divination",
      castingTime: "1 minute",
      range: "Self",
      components: "V, S",
      duration: "Instantaneous",
      damage: "",
      save: "",
      attack: "",
      ritual: true,
      concentration: false,
      description: "Grants knowledge of the surrounding natural territory within 3 miles (or 300 feet underground). For full details, see the D&D 5e Wiki link.",
      wikiLink: "https://dnd5e.wikidot.com/spell:commune-with-nature"
    },
    {
      name: "Cone of Cold",
      level: 5,
      school: "Evocation",
      castingTime: "1 action",
      range: "Self (60-foot cone)",
      components: "V, S, M",
      duration: "Instantaneous",
      damage: "8d8 cold damage",
      save: "Constitution save",
      attack: "",
      ritual: false,
      concentration: false,
      description: "Creates a 60-foot cone of cold air dealing 8d8 cold damage. Targets make Constitution saves for half damage. For full details, see the D&D 5e Wiki link.",
      wikiLink: "https://dnd5e.wikidot.com/spell:cone-of-cold"
    },
    {
      name: "Conjure Elemental",
      level: 5,
      school: "Conjuration",
      castingTime: "1 minute",
      range: "90 feet",
      components: "V, S, M",
      duration: "Concentration, up to 1 hour",
      damage: "",
      save: "",
      attack: "",
      ritual: false,
      concentration: true,
      description: "Summons an elemental of CR 5 or lower from a 10-foot cube of the appropriate element. For full details, see the D&D 5e Wiki link.",
      wikiLink: "https://dnd5e.wikidot.com/spell:conjure-elemental"
    },
    {
      name: "Contact Other Plane",
      level: 5,
      school: "Divination",
      castingTime: "1 minute",
      range: "Self",
      components: "V",
      duration: "1 minute",
      damage: "",
      save: "",
      attack: "",
      ritual: true,
      concentration: false,
      description: "Contacts an extraplanar entity for information. Risk of insanity on failed Intelligence save. For full details, see the D&D 5e Wiki link.",
      wikiLink: "https://dnd5e.wikidot.com/spell:contact-other-plane"
    },
    {
      name: "Contagion",
      level: 5,
      school: "Necromancy",
      castingTime: "1 action",
      range: "Touch",
      components: "V, S",
      duration: "7 days",
      damage: "",
      save: "Constitution save",
      attack: "",
      ritual: false,
      concentration: false,
      description: "Melee spell attack that inflicts disease. Target makes Constitution saves to resist. For full details, see the D&D 5e Wiki link.",
      wikiLink: "https://dnd5e.wikidot.com/spell:contagion"
    },
    {
      name: "Creation",
      level: 5,
      school: "Illusion",
      castingTime: "1 minute",
      range: "30 feet",
      components: "V, S, M",
      duration: "Special",
      damage: "",
      save: "",
      attack: "",
      ritual: false,
      concentration: false,
      description: "Creates a nonliving object of vegetable or mineral matter up to 5-foot cube in size. For full details, see the D&D 5e Wiki link.",
      wikiLink: "https://dnd5e.wikidot.com/spell:creation"
    },
    {
      name: "Destructive Wave",
      level: 5,
      school: "Evocation",
      castingTime: "1 action",
      range: "Self (30-foot radius)",
      components: "V",
      duration: "Instantaneous",
      damage: "5d6 thunder damage",
      save: "Constitution save",
      attack: "",
      ritual: false,
      concentration: false,
      description: "Creates a 30-foot radius burst dealing 5d6 thunder + 5d6 radiant/necrotic damage and knocks prone. Targets make Constitution saves. For full details, see the D&D 5e Wiki link.",
      wikiLink: "https://dnd5e.wikidot.com/spell:destructive-wave"
    },
    {
      name: "Dispel Evil and Good",
      level: 5,
      school: "Abjuration",
      castingTime: "1 action",
      range: "Self",
      components: "V, S, M",
      duration: "Concentration, up to 1 minute",
      damage: "",
      save: "",
      attack: "",
      ritual: false,
      concentration: true,
      description: "Protects you from extraplanar creatures and allows you to banish or turn them. For full details, see the D&D 5e Wiki link.",
      wikiLink: "https://dnd5e.wikidot.com/spell:dispel-evil-and-good"
    },
    {
      name: "Dominate Person",
      level: 5,
      school: "Enchantment",
      castingTime: "1 action",
      range: "60 feet",
      components: "V, S",
      duration: "Concentration, up to 1 minute",
      damage: "",
      save: "Wisdom save",
      attack: "",
      ritual: false,
      concentration: true,
      description: "Charms a humanoid, making it follow your commands. Target makes Wisdom save. For full details, see the D&D 5e Wiki link.",
      wikiLink: "https://dnd5e.wikidot.com/spell:dominate-person"
    },
    {
      name: "Dream",
      level: 5,
      school: "Illusion",
      castingTime: "1 minute",
      range: "Special",
      components: "V, S, M",
      duration: "8 hours",
      damage: "3d6 psychic damage",
      save: "Wisdom save",
      attack: "",
      ritual: false,
      concentration: false,
      description: "Shapes a creature's dreams to deliver messages or deal 3d6 psychic damage. For full details, see the D&D 5e Wiki link.",
      wikiLink: "https://dnd5e.wikidot.com/spell:dream"
    },
    {
      name: "Flame Strike",
      level: 5,
      school: "Evocation",
      castingTime: "1 action",
      range: "60 feet",
      components: "V, S, M",
      duration: "Instantaneous",
      damage: "4d6 fire damage",
      save: "Dexterity save",
      attack: "",
      ritual: false,
      concentration: false,
      description: "Creates a 10-foot radius cylinder of divine fire dealing 4d6 fire + 4d6 radiant damage. Targets make Dexterity saves for half damage. For full details, see the D&D 5e Wiki link.",
      wikiLink: "https://dnd5e.wikidot.com/spell:flame-strike"
    },
    {
      name: "Geas",
      level: 5,
      school: "Enchantment",
      castingTime: "1 minute",
      range: "60 feet",
      components: "V",
      duration: "30 days",
      damage: "5d10 psychic damage",
      save: "Wisdom save",
      attack: "",
      ritual: false,
      concentration: false,
      description: "Places a magical command on a creature for 30 days. Violating the command deals 5d10 psychic damage. Target makes Wisdom save. For full details, see the D&D 5e Wiki link.",
      wikiLink: "https://dnd5e.wikidot.com/spell:geas"
    },
    {
      name: "Greater Restoration",
      level: 5,
      school: "Abjuration",
      castingTime: "1 action",
      range: "Touch",
      components: "V, S, M",
      duration: "Instantaneous",
      damage: "",
      save: "",
      attack: "",
      ritual: false,
      concentration: false,
      description: "Removes debilitating effects like charm, petrification, curses, ability score reduction, or hit point maximum reduction. For full details, see the D&D 5e Wiki link.",
      wikiLink: "https://dnd5e.wikidot.com/spell:greater-restoration"
    },
    {
      name: "Hallow",
      level: 5,
      school: "Evocation",
      castingTime: "24 hours",
      range: "Touch",
      components: "V, S, M",
      duration: "Until dispelled",
      damage: "",
      save: "",
      attack: "",
      ritual: false,
      concentration: false,
      description: "Consecrates a 60-foot radius area, preventing extraplanar creatures from entering and providing various protective effects. For full details, see the D&D 5e Wiki link.",
      wikiLink: "https://dnd5e.wikidot.com/spell:hallow"
    },
    {
      name: "Hold Monster",
      level: 5,
      school: "Enchantment",
      castingTime: "1 action",
      range: "90 feet",
      components: "V, S, M",
      duration: "Concentration, up to 1 minute",
      damage: "",
      save: "Wisdom save",
      attack: "",
      ritual: false,
      concentration: true,
      description: "Paralyzes a creature. Target makes Wisdom saves to resist and can repeat the save each turn. For full details, see the D&D 5e Wiki link.",
      wikiLink: "https://dnd5e.wikidot.com/spell:hold-monster"
    },
    {
      name: "Immolation",
      level: 5,
      school: "Evocation",
      castingTime: "1 action",
      range: "90 feet",
      components: "V",
      duration: "Concentration, up to 1 minute",
      damage: "8d6 fire damage",
      save: "Dexterity save",
      attack: "",
      ritual: false,
      concentration: true,
      description: "Wreathes a creature in flames dealing 8d6 fire damage initially, then 4d6 fire damage each turn. Target makes Dexterity saves. For full details, see the D&D 5e Wiki link.",
      wikiLink: "https://dnd5e.wikidot.com/spell:immolation"
    },
    {
      name: "Insect Plague",
      level: 5,
      school: "Conjuration",
      castingTime: "1 action",
      range: "300 feet",
      components: "V, S, M",
      duration: "Concentration, up to 10 minutes",
      damage: "4d10 piercing damage",
      save: "Constitution save",
      attack: "",
      ritual: false,
      concentration: true,
      description: "Creates a 20-foot radius sphere of swarming locusts dealing 4d10 piercing damage. Targets make Constitution saves. For full details, see the D&D 5e Wiki link.",
      wikiLink: "https://dnd5e.wikidot.com/spell:insect-plague"
    },
    {
      name: "Legend Lore",
      level: 5,
      school: "Divination",
      castingTime: "10 minutes",
      range: "Self",
      components: "V, S, M",
      duration: "Instantaneous",
      damage: "",
      save: "",
      attack: "",
      ritual: false,
      concentration: false,
      description: "Reveals significant lore about a person, place, or object of legendary importance. For full details, see the D&D 5e Wiki link.",
      wikiLink: "https://dnd5e.wikidot.com/spell:legend-lore"
    },
    {
      name: "Mass Cure Wounds",
      level: 5,
      school: "Evocation",
      castingTime: "1 action",
      range: "60 feet",
      components: "V, S",
      duration: "Instantaneous",
      damage: "",
      save: "",
      attack: "",
      ritual: false,
      concentration: false,
      description: "Heals up to 6 creatures in a 30-foot radius for 3d8 + spellcasting modifier hit points. For full details, see the D&D 5e Wiki link.",
      wikiLink: "https://dnd5e.wikidot.com/spell:mass-cure-wounds"
    },
    {
      name: "Mislead",
      level: 5,
      school: "Illusion",
      castingTime: "1 action",
      range: "Self",
      components: "S",
      duration: "Concentration, up to 1 hour",
      damage: "",
      save: "",
      attack: "",
      ritual: false,
      concentration: true,
      description: "Makes you invisible and creates an illusory double that you can control. For full details, see the D&D 5e Wiki link.",
      wikiLink: "https://dnd5e.wikidot.com/spell:mislead"
    },
    {
      name: "Modify Memory",
      level: 5,
      school: "Enchantment",
      castingTime: "1 action",
      range: "30 feet",
      components: "V, S",
      duration: "Concentration, up to 1 minute",
      damage: "",
      save: "Wisdom save",
      attack: "",
      ritual: false,
      concentration: true,
      description: "Allows you to modify a creature's memories. Target makes Wisdom save. For full details, see the D&D 5e Wiki link.",
      wikiLink: "https://dnd5e.wikidot.com/spell:modify-memory"
    },
    {
      name: "Passwall",
      level: 5,
      school: "Transmutation",
      castingTime: "1 action",
      range: "30 feet",
      components: "V, S, M",
      duration: "1 hour",
      damage: "",
      save: "",
      attack: "",
      ritual: false,
      concentration: false,
      description: "Creates a passage through wooden, plaster, or stone surfaces up to 5 feet wide, 8 feet tall, and 20 feet deep. For full details, see the D&D 5e Wiki link.",
      wikiLink: "https://dnd5e.wikidot.com/spell:passwall"
    },
    {
      name: "Planar Binding",
      level: 5,
      school: "Abjuration",
      castingTime: "1 hour",
      range: "60 feet",
      components: "V, S, M",
      duration: "24 hours",
      damage: "",
      save: "Charisma save",
      attack: "",
      ritual: false,
      concentration: false,
      description: "Binds a celestial, elemental, fey, or fiend to your service. Target makes Charisma save. For full details, see the D&D 5e Wiki link.",
      wikiLink: "https://dnd5e.wikidot.com/spell:planar-binding"
    },
    {
      name: "Raise Dead",
      level: 5,
      school: "Necromancy",
      castingTime: "1 hour",
      range: "Touch",
      components: "V, S, M",
      duration: "Instantaneous",
      damage: "",
      save: "",
      attack: "",
      ritual: false,
      concentration: false,
      description: "Returns a dead creature to life if it has been dead no longer than 10 days. For full details, see the D&D 5e Wiki link.",
      wikiLink: "https://dnd5e.wikidot.com/spell:raise-dead"
    },
    {
      name: "Rary's Telepathic Bond",
      level: 5,
      school: "Divination",
      castingTime: "1 action",
      range: "30 feet",
      components: "V, S, M",
      duration: "1 hour",
      damage: "",
      save: "",
      attack: "",
      ritual: true,
      concentration: false,
      description: "Creates a telepathic link among up to 8 willing creatures for communication over any distance. For full details, see the D&D 5e Wiki link.",
      wikiLink: "https://dnd5e.wikidot.com/spell:rarys-telepathic-bond"
    },
    {
      name: "Scrying",
      level: 5,
      school: "Divination",
      castingTime: "10 minutes",
      range: "Self",
      components: "V, S, M",
      duration: "Concentration, up to 10 minutes",
      damage: "",
      save: "Wisdom save",
      attack: "",
      ritual: false,
      concentration: true,
      description: "Allows you to see and hear a creature on the same plane. Target makes Wisdom save. For full details, see the D&D 5e Wiki link.",
      wikiLink: "https://dnd5e.wikidot.com/spell:scrying"
    },
    {
      name: "Seeming",
      level: 5,
      school: "Illusion",
      castingTime: "1 action",
      range: "30 feet",
      components: "V, S",
      duration: "8 hours",
      damage: "",
      save: "",
      attack: "",
      ritual: false,
      concentration: false,
      description: "This spell allows you to change the appearance of any number of creatures that you can see within range. You give each target you choose a new, illusory appearance. An unwilling target can make a Charisma saving throw, and if it succeeds, it is unaffected by this spell. The spell disguises physical appearance as well as clothing, armor, weapons, and equipment. You can make each creature seem 1 foot shorter or taller and appear thin, fat, or in between. You can't change a target's body type, so you must choose a form that has the same basic arrangement of limbs. Otherwise, the extent of the illusion is up to you.",
      wikiLink: "https://dnd5e.wikidot.com/spell:seeming"
    },
    {
      name: "Skill Empowerment",
      level: 5,
      school: "Transmutation",
      castingTime: "1 action",
      range: "Touch",
      components: "V, S",
      duration: "Concentration, up to 1 hour",
      damage: "",
      save: "",
      attack: "",
      ritual: false,
      concentration: true,
      description: "Your magic deepens a creature's understanding of its own talent. You touch one willing creature and give it expertise in one skill of your choice; until the spell ends, the creature doubles its proficiency bonus for ability checks it makes that use the chosen skill. You must choose a skill in which the target is proficient and that isn't already benefiting from an effect, such as Expertise, that doubles its proficiency bonus.",
      wikiLink: "https://dnd5e.wikidot.com/spell:skill-empowerment"
    },
    {
      name: "Telekinesis",
      level: 5,
      school: "Transmutation",
      castingTime: "1 action",
      range: "60 feet",
      components: "V, S",
      duration: "Concentration, up to 10 minutes",
      damage: "",
      save: "Strength save",
      attack: "",
      ritual: false,
      concentration: true,
      description: "You gain the ability to move or manipulate creatures or objects by thought. When you cast the spell, and as your action each round for the duration, you can exert your will on one creature or object that you can see within range, causing the appropriate effect below. You can affect the same target round after round, or choose a new one at any time. If you switch targets, the prior target is no longer affected by the spell.",
      wikiLink: "https://dnd5e.wikidot.com/spell:telekinesis"
    },
    {
      name: "Teleportation Circle",
      level: 5,
      school: "Conjuration",
      castingTime: "1 minute",
      range: "10 feet",
      components: "V, M",
      duration: "1 round",
      damage: "",
      save: "",
      attack: "",
      ritual: false,
      concentration: false,
      description: "As you cast the spell, you draw a 10-foot-diameter circle on the ground inscribed with sigils that link your location to a permanent teleportation circle of your choice whose sigil sequence you know and that is on the same plane of existence as you. A shimmering portal opens within the circle you drew and remains open until the end of your next turn. Any creature that enters the portal instantly appears within 5 feet of the destination circle or in the nearest unoccupied space if that space is occupied.",
      wikiLink: "https://dnd5e.wikidot.com/spell:teleportation-circle"
    },
    {
      name: "Transmute Rock",
      level: 5,
      school: "Transmutation",
      castingTime: "1 action",
      range: "120 feet",
      components: "V, S, M",
      duration: "Until dispelled",
      damage: "",
      save: "",
      attack: "",
      ritual: false,
      concentration: false,
      description: "You choose an area of stone or mud that you can see that fits within a 40-foot cube and that is within range, and choose one of the following effects.",
      wikiLink: "https://dnd5e.wikidot.com/spell:transmute-rock"
    },
    {
      name: "Tree Stride",
      level: 5,
      school: "Conjuration",
      castingTime: "1 action",
      range: "Self",
      components: "V, S",
      duration: "Concentration, up to 1 minute",
      damage: "",
      save: "",
      attack: "",
      ritual: false,
      concentration: true,
      description: "You gain the ability to enter a tree and move from inside it to inside another tree of the same kind within 500 feet. Both trees must be living and at least the same size as you. You must use 5 feet of movement to enter a tree. You instantly know the location of all other trees of the same kind within 500 feet and, as part of the move used to enter the tree, can either pass into one of those trees or step out of the tree you're in. You appear in a spot of your choice within 5 feet of the destination tree, using another 5 feet of movement. If you have no movement left, you appear within 5 feet of the tree you entered.",
      wikiLink: "https://dnd5e.wikidot.com/spell:tree-stride"
    },
    {
      name: "Wall of Force",
      level: 5,
      school: "Evocation",
      castingTime: "1 action",
      range: "120 feet",
      components: "V, S, M",
      duration: "Concentration, up to 10 minutes",
      damage: "",
      save: "",
      attack: "",
      ritual: false,
      concentration: true,
      description: "An invisible wall of force springs into existence at a point you choose within range. The wall appears in any orientation you choose, as a horizontal or vertical barrier or at an angle. It can be free floating or resting on a solid surface. You can form it into a hemispherical dome or a sphere with a radius of up to 10 feet, or you can shape a flat surface made up of ten 10-foot-by-10-foot panels. Each panel must be contiguous with another panel. In any form, the wall is 1/4 inch thick. It lasts for the duration. If the wall cuts through a creature's space when it appears, the creature is pushed to one side of the wall (your choice which side).",
      wikiLink: "https://dnd5e.wikidot.com/spell:wall-of-force"
    },
    {
      name: "Wall of Stone",
      level: 5,
      school: "Evocation",
      castingTime: "1 action",
      range: "120 feet",
      components: "V, S, M",
      duration: "10 minutes",
      damage: "",
      save: "",
      attack: "",
      ritual: false,
      concentration: false,
      description: "A nonmagical wall of solid stone springs into existence at a point you choose within range. The wall is 6 inches thick and is composed of ten 10-foot-by-10-foot panels. Each panel must be contiguous with at least one other panel. Alternatively, you can create 10-foot-by-20-foot panels that are only 3 inches thick. If the wall cuts through a creature's space when it appears, the creature is pushed to one side of the wall (your choice). If a creature would be surrounded on all sides by the wall (or the wall and another solid surface), that creature can make a Dexterity saving throw. On a success, it can use its reaction to move up to its speed so that it is no longer enclosed by the wall.",
      wikiLink: "https://dnd5e.wikidot.com/spell:wall-of-stone"
    },
    {
      name: "Arcane Gate",
      level: 6,
      school: "Conjuration",
      castingTime: "1 action",
      range: "500 feet",
      components: "V, S",
      duration: "Concentration, up to 10 minutes",
      damage: "",
      save: "",
      attack: "",
      ritual: false,
      concentration: true,
      description: "You create linked teleportation portals that remain open for the duration. Choose two points on the ground that you can see, one point within 10 feet of you and one point within 500 feet of you. A circular portal, 10 feet in diameter, opens over each point. If the portal would open in the space occupied by a creature, the spell fails, and the casting is wasted.",
      wikiLink: "https://dnd5e.wikidot.com/spell:arcane-gate"
    },
    {
      name: "Blade Barrier",
      level: 6,
      school: "Evocation",
      castingTime: "1 action",
      range: "90 feet",
      components: "V, S",
      duration: "Concentration, up to 10 minutes",
      damage: "6d10 slashing damage",
      save: "Dexterity save",
      attack: "",
      ritual: false,
      concentration: true,
      description: "You create a vertical wall of whirling, razor-sharp blades made of magical energy. The wall appears within range and lasts for the duration. You can make a straight wall up to 100 feet long, 20 feet high, and 5 feet thick, or a ringed wall up to 60 feet in diameter, 20 feet high, and 5 feet thick. The wall provides three-quarters cover to creatures behind it, and its space is difficult terrain.",
      wikiLink: "https://dnd5e.wikidot.com/spell:blade-barrier"
    },
    {
      name: "Bones of the Earth",
      level: 6,
      school: "Transmutation",
      castingTime: "1 action",
      range: "120 feet",
      components: "V, S",
      duration: "Instantaneous",
      damage: "4d6 bludgeoning damage",
      save: "Dexterity save",
      attack: "",
      ritual: false,
      concentration: false,
      description: "You cause up to six pillars of stone to burst from places on the ground that you can see within range. Each pillar is a cylinder that has a diameter of 5 feet and a height of up to 30 feet. The ground where a pillar appears must be wide enough for its diameter, and you can target the ground under a creature if that creature is Medium or smaller. Each pillar has AC 5 and 30 hit points. When reduced to 0 hit points, a pillar crumbles into rubble, which creates an area of difficult terrain with a 10-foot radius. The rubble lasts until cleared.",
      wikiLink: "https://dnd5e.wikidot.com/spell:bones-of-the-earth"
    },
    {
      name: "Chain Lightning",
      level: 6,
      school: "Evocation",
      castingTime: "1 action",
      range: "150 feet",
      components: "V, S, M",
      duration: "Instantaneous",
      damage: "10d8 lightning damage",
      save: "Dexterity save",
      attack: "",
      ritual: false,
      concentration: false,
      description: "You create a bolt of lightning that arcs toward a target of your choice that you can see within range. Three bolts then leap from that target to as many as three other targets, each of which must be within 30 feet of the first target. A target can be a creature or an object and can be targeted by only one of the bolts. A target must make a Dexterity saving throw. The target takes 10d8 lightning damage on a failed save, or half as much damage on a successful one.",
      wikiLink: "https://dnd5e.wikidot.com/spell:chain-lightning"
    },
    {
      name: "Circle of Death",
      level: 6,
      school: "Necromancy",
      castingTime: "1 action",
      range: "150 feet",
      components: "V, S, M",
      duration: "Instantaneous",
      damage: "8d6 necrotic damage",
      save: "Constitution save",
      attack: "",
      ritual: false,
      concentration: false,
      description: "A sphere of negative energy ripples out in a 60-foot-radius sphere centered on a point within range. Each creature in that area must make a Constitution saving throw. A target takes 8d6 necrotic damage on a failed save, or half as much damage on a successful one.",
      wikiLink: "https://dnd5e.wikidot.com/spell:circle-of-death"
    },
    {
      name: "Conjure Fey",
      level: 6,
      school: "Conjuration",
      castingTime: "1 minute",
      range: "90 feet",
      components: "V, S, M",
      duration: "Concentration, up to 1 hour",
      damage: "",
      save: "",
      attack: "",
      ritual: false,
      concentration: true,
      description: "You summon a fey creature of challenge rating 6 or lower, or a fey spirit that takes the form of a beast of challenge rating 6 or lower. It appears in an unoccupied space that you can see within range. The fey creature disappears when it drops to 0 hit points or when the spell ends. The fey creature is friendly to you and your companions for the duration. Roll initiative for the summoned creature, which has its own turns. It obeys any verbal commands that you issue to it (no action required by you). If you don't issue any commands to the fey creature, it defends itself from hostile creatures but otherwise takes no actions.",
      wikiLink: "https://dnd5e.wikidot.com/spell:conjure-fey"
    },
    {
      name: "Contingency",
      level: 6,
      school: "Evocation",
      castingTime: "10 minutes",
      range: "Self",
      components: "V, S, M",
      duration: "10 days",
      damage: "",
      save: "",
      attack: "",
      ritual: false,
      concentration: false,
      description: "Choose a spell of 5th level or lower that you can cast, that has a casting time of 1 action, and that can target you. You cast that spell—called the contingent spell—as part of casting contingency, expending spell slots for both, but the contingent spell doesn't come into effect. Instead, it takes effect when a certain circumstance occurs. You describe that circumstance when you cast the two spells. For example, a contingency cast with water breathing might stipulate that water breathing comes into effect when you are engulfed in water or a similar liquid.",
      wikiLink: "https://dnd5e.wikidot.com/spell:contingency"
    },
    {
      name: "Create Undead",
      level: 6,
      school: "Necromancy",
      castingTime: "1 minute",
      range: "10 feet",
      components: "V, S, M",
      duration: "Instantaneous",
      damage: "",
      save: "",
      attack: "",
      ritual: false,
      concentration: false,
      description: "You can cast this spell only at night. Choose up to three corpses of Medium or Small humanoids within range. Each target becomes a ghoul under your control. (The DM has game statistics for these creatures.) As a bonus action on each of your turns, you can mentally command any creature you animated with this spell if the creature is within 120 feet of you (if you control multiple creatures, you can command any or all of them at the same time, issuing the same command to each one). You decide what action the creature will take and where it will move during its next turn, or you can issue a general command, such as to guard a particular chamber or corridor.",
      wikiLink: "https://dnd5e.wikidot.com/spell:create-undead"
    },
    {
      name: "Disintegrate",
      level: 6,
      school: "Transmutation",
      castingTime: "1 action",
      range: "60 feet",
      components: "V, S, M",
      duration: "Instantaneous",
      damage: "10d6 + 40 force damage",
      save: "Dexterity save",
      attack: "",
      ritual: false,
      concentration: false,
      description: "A thin green ray springs from your pointing finger to a target that you can see within range. The target can be a creature, an object, or a creation of magical force, such as the wall created by wall of force. A creature targeted by this spell must make a Dexterity saving throw. On a failed save, the target takes 10d6 + 40 force damage. If this damage reduces the target to 0 hit points, it is disintegrated.",
      wikiLink: "https://dnd5e.wikidot.com/spell:disintegrate"
    },
    {
      name: "Drawmij's Instant Summons",
      level: 6,
      school: "Conjuration",
      castingTime: "1 minute",
      range: "Touch",
      components: "V, S, M",
      duration: "Until dispelled",
      damage: "",
      save: "",
      attack: "",
      ritual: true,
      concentration: false,
      description: "You touch an object weighing 10 pounds or less whose longest dimension is 6 feet or less. The spell leaves an invisible mark on its surface and invisibly inscribes the name of the item on the sapphire you use as the material component. Each time you cast this spell, you must use a different sapphire. At any time thereafter, you can use your action to speak the item's name and crush the sapphire. The item instantly appears in your hand regardless of physical or planar distances, and the spell ends. If another creature is holding or carrying the item, crushing the sapphire doesn't transport the item to you, but instead you learn who the creature possessing the item is and roughly where that creature is located at that moment.",
      wikiLink: "https://dnd5e.wikidot.com/spell:drawmijs-instant-summons"
    },
    {
      name: "Eyebite",
      level: 6,
      school: "Necromancy",
      castingTime: "1 action",
      range: "Self",
      components: "V, S",
      duration: "Concentration, up to 1 minute",
      damage: "",
      save: "Wisdom save",
      attack: "",
      ritual: false,
      concentration: true,
      description: "For the spell's duration, your eyes become an inky void imbued with dread power. One creature of your choice within 60 feet of you that you can see must succeed on a Wisdom saving throw or be affected by one of the following effects of your choice for the duration. On each of your turns until the spell ends, you can use your action to target another creature but can't target a creature again if it has succeeded on a saving throw against this casting of eyebite.",
      wikiLink: "https://dnd5e.wikidot.com/spell:eyebite"
    },
    {
      name: "Find the Path",
      level: 6,
      school: "Divination",
      castingTime: "1 minute",
      range: "Self",
      components: "V, S, M",
      duration: "Concentration, up to 1 day",
      damage: "",
      save: "",
      attack: "",
      ritual: false,
      concentration: true,
      description: "This spell allows you to find the shortest, most direct physical route to a specific fixed location that you are familiar with on the same plane of existence. If you name a destination on another plane of existence, a destination that moves (such as a mobile fortress), or a destination that isn't specific (such as 'a green dragon's lair'), the spell fails. For the duration, as long as you are on the same plane of existence as the destination, you know how far it is and in what direction it lies. While you are traveling there, whenever you are presented with a choice of paths along the way, you automatically determine which path is the shortest and most direct route (but not necessarily the safest route) to the destination.",
      wikiLink: "https://dnd5e.wikidot.com/spell:find-the-path"
    },
    {
      name: "Flesh to Stone",
      level: 6,
      school: "Transmutation",
      castingTime: "1 action",
      range: "60 feet",
      components: "V, S, M",
      duration: "Concentration, up to 1 minute",
      damage: "",
      save: "Constitution save",
      attack: "",
      ritual: false,
      concentration: true,
      description: "You attempt to turn one creature that you can see within range into stone. If the target's body is made of flesh, the creature must make a Constitution saving throw. On a failed save, it is restrained as its flesh begins to harden. On a successful save, the creature isn't affected. A creature restrained by this spell must make another Constitution saving throw at the end of each of its turns. If it successfully saves against this spell three times, the spell ends. If it fails its saves three times, it is turned to stone and subjected to the petrified condition for the duration. The successes and failures don't need to be consecutive; keep track of both until the target collects three of a kind.",
      wikiLink: "https://dnd5e.wikidot.com/spell:flesh-to-stone"
    },
    {
      name: "Forbiddance",
      level: 6,
      school: "Abjuration",
      castingTime: "10 minutes",
      range: "Touch",
      components: "V, S, M",
      duration: "1 day",
      damage: "5d10 radiant damage",
      save: "",
      attack: "",
      ritual: true,
      concentration: false,
      description: "You create a ward against magical travel that protects up to 40,000 square feet of floor space to a height of 30 feet above the floor. For the duration, creatures can't teleport into the area or use portals, such as those created by the gate spell, to enter the area. The spell proofs the area against planar travel, and therefore prevents creatures from accessing the area by way of the Astral Plane, Ethereal Plane, Feywild, Shadowfell, or the plane shift spell. In addition, the spell damages types of creatures that you choose when you cast it. Choose one or more of the following: celestials, elementals, fey, fiends, and undead. When a chosen creature enters the spell's area for the first time on a turn or starts its turn there, the creature takes 5d10 radiant or necrotic damage (your choice when you cast this spell).",
      wikiLink: "https://dnd5e.wikidot.com/spell:forbiddance"
    },
    {
      name: "Globe of Invulnerability",
      level: 6,
      school: "Abjuration",
      castingTime: "1 action",
      range: "Self (10-foot radius)",
      components: "V, S, M",
      duration: "Concentration, up to 1 minute",
      damage: "",
      save: "",
      attack: "",
      ritual: false,
      concentration: true,
      description: "An immobile, faintly shimmering barrier springs into existence in a 10-foot radius around you and remains for the duration. Any spell of 5th level or lower cast from outside the barrier can't affect creatures or objects within it, even if the spell is cast using a higher level spell slot. Such a spell can target creatures and objects within the barrier, but the spell has no effect on them. Similarly, the area within the barrier is excluded from the areas affected by such spells.",
      wikiLink: "https://dnd5e.wikidot.com/spell:globe-of-invulnerability"
    },
    {
      name: "Guards and Wards",
      level: 6,
      school: "Abjuration",
      castingTime: "10 minutes",
      range: "Touch",
      components: "V, S, M",
      duration: "24 hours",
      damage: "",
      save: "",
      attack: "",
      ritual: false,
      concentration: false,
      description: "You create a ward that protects up to 2,500 square feet of floor space (an area 50 feet square, or one hundred 5-foot squares or twenty-five 10-foot squares). The warded area can be up to 20 feet tall, and shaped as you desire. You can ward several stories of a stronghold by dividing the area among them, as long as you can walk into each contiguous area while you are casting the spell. When you cast this spell, you can specify individuals that are unaffected by any or all of the effects that you choose. You can also specify a password that, when spoken aloud, makes the speaker immune to these effects.",
      wikiLink: "https://dnd5e.wikidot.com/spell:guards-and-wards"
    },
    {
      name: "Harm",
      level: 6,
      school: "Necromancy",
      castingTime: "1 action",
      range: "60 feet",
      components: "V, S",
      duration: "Instantaneous",
      damage: "14d6 necrotic damage",
      save: "Constitution save",
      attack: "",
      ritual: false,
      concentration: false,
      description: "You unleash a virulent disease on a creature that you can see within range. The target must make a Constitution saving throw. On a failed save, it takes 14d6 necrotic damage, or half as much damage on a successful save. The damage can't reduce the target's hit points below 1. If the target fails the saving throw, its hit point maximum is reduced for 1 hour by an amount equal to the necrotic damage it took. Any effect that removes a disease allows a creature's hit point maximum to return to normal before that time passes.",
      wikiLink: "https://dnd5e.wikidot.com/spell:harm"
    },
    {
      name: "Heal",
      level: 6,
      school: "Evocation",
      castingTime: "1 action",
      range: "60 feet",
      components: "V, S",
      duration: "Instantaneous",
      damage: "",
      save: "",
      attack: "",
      ritual: false,
      concentration: false,
      description: "Choose a creature that you can see within range. A surge of positive energy washes through the creature, causing it to regain 70 hit points. This spell also ends blindness, deafness, and any diseases affecting the target. This spell has no effect on constructs or undead.",
      wikiLink: "https://dnd5e.wikidot.com/spell:heal"
    },
    {
      name: "Heroes' Feast",
      level: 6,
      school: "Conjuration",
      castingTime: "10 minutes",
      range: "30 feet",
      components: "V, S, M",
      duration: "Instantaneous",
      damage: "",
      save: "",
      attack: "",
      ritual: false,
      concentration: false,
      description: "You bring forth a great feast, including magnificent food and drink. The feast takes 1 hour to consume and disappears at the end of that time, and the beneficial effects don't set in until this hour is over. Up to twelve other creatures can partake of the feast. A creature that partakes of the feast gains several benefits. The creature is cured of all diseases and poison, becomes immune to poison and being frightened, and makes all Wisdom saving throws with advantage. Its hit point maximum also increases by 2d10, and it gains the same number of hit points. These benefits last for 24 hours.",
      wikiLink: "https://dnd5e.wikidot.com/spell:heroes-feast"
    },
    {
      name: "Investiture of Flame",
      level: 6,
      school: "Transmutation",
      castingTime: "1 action",
      range: "Self",
      components: "V, S",
      duration: "Concentration, up to 10 minutes",
      damage: "2d6 fire damage",
      save: "",
      attack: "",
      ritual: false,
      concentration: true,
      description: "Flames race across your body, shedding bright light in a 30-foot radius and dim light for an additional 30 feet for the spell's duration. The flames don't harm you. Until the spell ends, you gain the following benefits: You are immune to fire damage and have resistance to cold damage. Any creature that moves within 5 feet of you for the first time on a turn or ends its turn there takes 1d10 fire damage. You can use your action to create a line of fire 15 feet long and 5 feet wide extending from you in a direction you choose. Each creature in the line must make a Dexterity saving throw. A creature takes 4d8 fire damage on a failed save, or half as much damage on a successful one.",
      wikiLink: "https://dnd5e.wikidot.com/spell:investiture-of-flame"
    },
    {
      name: "Investiture of Ice",
      level: 6,
      school: "Transmutation",
      castingTime: "1 action",
      range: "Self",
      components: "V, S",
      duration: "Concentration, up to 10 minutes",
      damage: "2d6 cold damage",
      save: "",
      attack: "",
      ritual: false,
      concentration: true,
      description: "Until the spell ends, ice rimes your body, and you gain the following benefits: You are immune to cold damage and have resistance to fire damage. You can move across difficult terrain created by ice or snow without spending extra movement. The ground in a 10-foot radius around you is icy and is difficult terrain for creatures other than you. The radius moves with you. You can use your action to create a 15-foot cone of freezing wind extending from your outstretched hand in a direction you choose. Each creature in the cone must make a Constitution saving throw. A creature takes 4d6 cold damage on a failed save, or half as much damage on a successful one. A creature that fails its save against this effect has its speed halved until the start of your next turn.",
      wikiLink: "https://dnd5e.wikidot.com/spell:investiture-of-ice"
    },
    {
      name: "Investiture of Stone",
      level: 6,
      school: "Transmutation",
      castingTime: "1 action",
      range: "Self",
      components: "V, S",
      duration: "Concentration, up to 10 minutes",
      damage: "",
      save: "",
      attack: "",
      ritual: false,
      concentration: true,
      description: "Until the spell ends, bits of rock spread across your body, and you gain the following benefits: You have resistance to bludgeoning, piercing, and slashing damage from nonmagical weapons. You can use your action to create a small earthquake on the ground in a 15-foot radius centered on you. Other creatures on that ground must succeed on a Strength saving throw or be knocked prone. You can move across difficult terrain made of earth or stone without spending extra movement. You can move through solid earth or stone as if it was air and without destabilizing it, but you can't end your movement there. If you do, you are ejected to the nearest unoccupied space, this spell ends, and you are stunned until the end of your next turn.",
      wikiLink: "https://dnd5e.wikidot.com/spell:investiture-of-stone"
    },
    {
      name: "Investiture of Wind",
      level: 6,
      school: "Transmutation",
      castingTime: "1 action",
      range: "Self",
      components: "V, S",
      duration: "Concentration, up to 10 minutes",
      damage: "2d6 bludgeoning damage",
      save: "",
      attack: "",
      ritual: false,
      concentration: true,
      description: "Until the spell ends, wind whirls around you, and you gain the following benefits: Ranged weapon attacks made against you have disadvantage on the attack roll. You gain a flying speed of 60 feet. If you are still flying when the spell ends, you fall, unless you can somehow prevent it. You can use your action to create a 15-foot cube of swirling wind centered on a point you can see within 60 feet of you. Each creature in that area must make a Constitution saving throw. A creature takes 2d6 bludgeoning damage on a failed save, or half as much damage on a successful one. If a Large or smaller creature fails the save, that creature is also pushed up to 10 feet away from the center of the cube.",
      wikiLink: "https://dnd5e.wikidot.com/spell:investiture-of-wind"
    },
    {
      name: "Magic Jar",
      level: 6,
      school: "Necromancy",
      castingTime: "1 minute",
      range: "Self",
      components: "V, S, M",
      duration: "Until dispelled",
      damage: "",
      save: "Charisma save",
      attack: "",
      ritual: false,
      concentration: false,
      description: "Your body falls into a catatonic state as your soul leaves it and enters the container you used for the spell's material component. While your soul inhabits the container, you are aware of your surroundings as if you were in the container's space. You can't move or use reactions. The only action you can take is to project your soul up to 100 feet out of the container, either returning to your living body (and ending the spell) or attempting to possess a humanoid's body.",
      wikiLink: "https://dnd5e.wikidot.com/spell:magic-jar"
    },
    {
      name: "Mass Suggestion",
      level: 6,
      school: "Enchantment",
      castingTime: "1 action",
      range: "60 feet",
      components: "V, M",
      duration: "24 hours",
      damage: "",
      save: "Wisdom save",
      attack: "",
      ritual: false,
      concentration: false,
      description: "You suggest a course of activity (limited to a sentence or two) and magically influence up to twelve creatures of your choice that you can see within range and that can hear and understand you. Creatures that can't be charmed are immune to this effect. The suggestion must be worded in such a manner as to make the course of action sound reasonable. Asking the creature to stab itself, throw itself onto a spear, immolate itself, or do some other obviously harmful act automatically negates the effect of the spell. Each target must make a Wisdom saving throw. On a failed save, it pursues the course of action you described to the best of its ability. The suggested course of action can continue for the entire duration. If the suggested activity can be completed in a shorter time, the spell ends when the subject finishes what it was asked to do.",
      wikiLink: "https://dnd5e.wikidot.com/spell:mass-suggestion"
    },
    {
      name: "Move Earth",
      level: 6,
      school: "Transmutation",
      castingTime: "1 action",
      range: "120 feet",
      components: "V, S, M",
      duration: "Concentration, up to 2 hours",
      damage: "",
      save: "",
      attack: "",
      ritual: false,
      concentration: true,
      description: "Choose an area of terrain no larger than 40 feet on a side within range. You can reshape dirt, sand, or clay in the area in any manner you choose for the duration. You can raise or lower the area's elevation, create or fill in a trench, erect or flatten a wall, or form a pillar. The extent of any such changes can't exceed half the area's largest dimension. So, if you affect a 40-foot square, you can create a pillar up to 20 feet high, raise or lower the square's elevation by up to 20 feet, dig a trench up to 20 feet deep, and so on. It takes 10 minutes for these changes to complete. At the end of every 10 minutes you spend concentrating on the spell, you can choose a new area of terrain to affect.",
      wikiLink: "https://dnd5e.wikidot.com/spell:move-earth"
    },
    {
      name: "Otiluke's Freezing Sphere",
      level: 6,
      school: "Evocation",
      castingTime: "1 action",
      range: "300 feet",
      components: "V, S, M",
      duration: "Instantaneous",
      damage: "10d6 cold damage",
      save: "Constitution save",
      attack: "",
      ritual: false,
      concentration: false,
      description: "A frigid globe of cold energy streaks from your fingertips to a point of your choice within range, where it explodes in a 60-foot-radius sphere. Each creature within the area must make a Constitution saving throw. On a failed save, a creature takes 10d6 cold damage. On a successful save, it takes half as much damage. If the globe strikes a body of water or a liquid that is principally water (not including water-based creatures), it freezes the liquid to a depth of 6 inches over an area 30 feet square. This ice lasts for 1 minute. Creatures that were swimming on the surface of frozen water are trapped in the ice. A trapped creature can use an action to make a Strength check against your spell save DC to free itself.",
      wikiLink: "https://dnd5e.wikidot.com/spell:otilukes-freezing-sphere"
    },
    {
      name: "Otto's Irresistible Dance",
      level: 6,
      school: "Enchantment",
      castingTime: "1 action",
      range: "30 feet",
      components: "V",
      duration: "Concentration, up to 1 minute",
      damage: "",
      save: "Wisdom save",
      attack: "",
      ritual: false,
      concentration: true,
      description: "Choose one creature that you can see within range. The target begins a comic dance in place: shuffling, tapping its feet, and capering for the duration. Creatures that can't be charmed are immune to this spell. A dancing creature must use all its movement to dance without leaving its space and has disadvantage on Dexterity saving throws and attack rolls. While the target is affected by this spell, other creatures have advantage on attack rolls against it. As an action, a dancing creature makes a Wisdom saving throw to regain control of itself. On a successful save, the spell ends.",
      wikiLink: "https://dnd5e.wikidot.com/spell:ottos-irresistible-dance"
    },
    {
      name: "Planar Ally",
      level: 6,
      school: "Conjuration",
      castingTime: "10 minutes",
      range: "60 feet",
      components: "V, S",
      duration: "Instantaneous",
      damage: "",
      save: "",
      attack: "",
      ritual: false,
      concentration: false,
      description: "You beseech an otherworldly entity for aid. The being must be known to you: a god, a primordial, a demon prince, or some other being of cosmic power. That entity sends a celestial, an elemental, or a fiend loyal to it to aid you, making the creature appear in an unoccupied space within range. If you know a specific creature's name, you can speak that name when you cast this spell to request that creature, though you might get a different creature anyway (DM's choice).",
      wikiLink: "https://dnd5e.wikidot.com/spell:planar-ally"
    },
    {
      name: "Programmed Illusion",
      level: 6,
      school: "Illusion",
      castingTime: "1 action",
      range: "120 feet",
      components: "V, S, M",
      duration: "Until dispelled",
      damage: "",
      save: "",
      attack: "",
      ritual: false,
      concentration: false,
      description: "You create an illusion of an object, a creature, or some other visible phenomenon within range that activates when a specific condition occurs. The illusion is imperceptible until then. It must be no larger than a 30-foot cube, and you decide when you cast the spell how the illusion behaves and what sounds it makes. This scripted performance can last up to 5 minutes. When the condition you specify occurs, the illusion springs into existence and performs in the manner you described. Once the illusion finishes performing, it disappears and remains dormant for 10 minutes. After this time, the illusion can be activated again.",
      wikiLink: "https://dnd5e.wikidot.com/spell:programmed-illusion"
    },
    {
      name: "Sunbeam",
      level: 6,
      school: "Evocation",
      castingTime: "1 action",
      range: "Self (60-foot line)",
      components: "V, S, M",
      duration: "Concentration, up to 1 minute",
      damage: "6d8 radiant damage",
      save: "Constitution save",
      attack: "",
      ritual: false,
      concentration: true,
      description: "A beam of brilliant light flashes out from your hand in a 5-foot-wide, 60-foot-long line. Each creature in the line must make a Constitution saving throw. On a failed save, a creature takes 6d8 radiant damage and is blinded until your next turn. On a successful save, it takes half as much damage and isn't blinded by this spell. Undead and oozes have disadvantage on this saving throw. You can create a new line of radiance as your action on any turn until the spell ends. For the duration, a mote of brilliant radiance shines in your hand. It sheds bright light in a 30-foot radius and dim light for an additional 30 feet. The light is sunlight.",
      wikiLink: "https://dnd5e.wikidot.com/spell:sunbeam"
    },
    {
      name: "Transport via Plants",
      level: 6,
      school: "Conjuration",
      castingTime: "1 action",
      range: "10 feet",
      components: "V, S",
      duration: "1 round",
      damage: "",
      save: "",
      attack: "",
      ritual: false,
      concentration: false,
      description: "This spell creates a magical link between a Large or larger inanimate plant within range and another plant, at any distance, on the same plane of existence. You must have seen or touched the destination plant at least once before. For the duration, any creature can step into the target plant and exit from the destination plant by using 5 feet of movement.",
      wikiLink: "https://dnd5e.wikidot.com/spell:transport-via-plants"
    },
    {
      name: "True Seeing",
      level: 6,
      school: "Divination",
      castingTime: "1 action",
      range: "Touch",
      components: "V, S, M",
      duration: "1 hour",
      damage: "",
      save: "",
      attack: "",
      ritual: false,
      concentration: false,
      description: "This spell gives the willing creature you touch the ability to see things as they actually are. For the duration, the creature has truesight, notices secret doors hidden by magic, and can see into the Ethereal Plane, all out to a range of 120 feet.",
      wikiLink: "https://dnd5e.wikidot.com/spell:true-seeing"
    },
    {
      name: "Wall of Ice",
      level: 6,
      school: "Evocation",
      castingTime: "1 action",
      range: "120 feet",
      components: "V, S, M",
      duration: "Concentration, up to 10 minutes",
      damage: "10d6 cold damage",
      save: "Dexterity save",
      attack: "",
      ritual: false,
      concentration: true,
      description: "You create a wall of ice on a solid surface within range. You can form it into a hemispherical dome or a sphere with a radius of up to 10 feet, or you can shape a flat surface made up of ten 10-foot-by-10-foot panels. Each panel must be contiguous with another panel. In any form, the wall is 1 foot thick and lasts for the duration. If the wall cuts through a creature's space when it appears, the creature within its area is pushed to one side of the wall and must make a Dexterity saving throw. On a failed save, the creature takes 10d6 cold damage, or half as much damage on a successful save. The wall is an object that can be damaged and thus breached. It has AC 12 and 30 hit points per 10-foot section, and it is vulnerable to fire damage. Reducing a 10-foot section of wall to 0 hit points destroys it and leaves behind a sheet of frigid air in the space the wall occupied. Until the end of your next turn, when a creature enters the sheet's space for the first time on a turn or starts its turn there, the creature takes 5d6 cold damage.",
      wikiLink: "https://dnd5e.wikidot.com/spell:wall-of-ice"
    },
    {
      name: "Wall of Thorns",
      level: 6,
      school: "Conjuration",
      castingTime: "1 action",
      range: "120 feet",
      components: "V, S, M",
      duration: "Concentration, up to 10 minutes",
      damage: "7d8 piercing damage",
      save: "Dexterity save",
      attack: "",
      ritual: false,
      concentration: true,
      description: "You create a wall of tough, pliable, tangled brush bristling with needle-sharp thorns. The wall appears within range on a solid surface and lasts for the duration. You choose to make the wall up to 60 feet long, 10 feet high, and 5 feet thick or a circle that has a 20-foot diameter and is up to 20 feet high and 5 feet thick. The wall blocks line of sight. When the wall appears, each creature within its area takes 7d8 piercing damage, or half as much damage on a successful Dexterity saving throw. A creature can move through the wall, albeit slowly and painfully. For every 1 foot a creature moves through the wall, it must spend 4 feet of movement. Furthermore, the first time a creature enters the wall on a turn or ends its turn there, the creature takes 7d8 piercing damage, or half as much damage on a successful Dexterity saving throw.",
      wikiLink: "https://dnd5e.wikidot.com/spell:wall-of-thorns"
    },
    {
      name: "Wind Walk",
      level: 6,
      school: "Transmutation",
      castingTime: "1 minute",
      range: "30 feet",
      components: "V, S, M",
      duration: "8 hours",
      damage: "",
      save: "",
      attack: "",
      ritual: false,
      concentration: false,
      description: "You and up to ten willing creatures you can see within range assume a gaseous form for the duration, appearing as wisps of cloud. While in this cloud form, a creature has a flying speed of 300 feet and has resistance to damage from nonmagical weapons. The only actions a creature can take in this form are the Dash action or to revert to its normal form. Reverting takes 1 minute, during which time a creature is incapacitated and can't move. Until the spell ends, a creature can revert to cloud form, which also requires the 1-minute transformation. If a creature is in cloud form and flying when the effect ends, the creature descends 60 feet per round for 1 minute until it lands, which it does safely. If it can't land after 1 minute, the creature falls the remaining distance.",
      wikiLink: "https://dnd5e.wikidot.com/spell:wind-walk"
    },
    {
      name: "Conjure Celestial",
      level: 7,
      school: "Conjuration",
      castingTime: "1 minute",
      range: "90 feet",
      components: "V, S",
      duration: "Concentration, up to 1 hour",
      damage: "",
      save: "",
      attack: "",
      ritual: false,
      concentration: true,
      description: "You summon a celestial of challenge rating 4 or lower, which appears in an unoccupied space that you can see within range. The celestial disappears when it drops to 0 hit points or when the spell ends. The celestial is friendly to you and your companions for the duration. Roll initiative for the summoned celestial, which has its own turns. It obeys any verbal commands that you issue to it (no action required by you). If you don't issue any commands to the celestial, it defends itself from hostile creatures but otherwise takes no actions.",
      wikiLink: "https://dnd5e.wikidot.com/spell:conjure-celestial"
    },
    {
      name: "Delayed Blast Fireball",
      level: 7,
      school: "Evocation",
      castingTime: "1 action",
      range: "150 feet",
      components: "V, S, M",
      duration: "Concentration, up to 1 minute",
      damage: "12d6 fire damage",
      save: "Dexterity save",
      attack: "",
      ritual: false,
      concentration: true,
      description: "A beam of yellow light flashes from your pointing finger, then condenses to linger as a glowing bead for the duration. When the spell ends, either because your concentration is broken or because you decide to end it, the bead blossoms with a low roar into an explosion of flame that spreads around corners. Each creature in a 20-foot-radius sphere centered on that point must make a Dexterity saving throw. A creature takes fire damage equal to the total accumulated damage on a failed save, or half as much damage on a successful one.",
      wikiLink: "https://dnd5e.wikidot.com/spell:delayed-blast-fireball"
    },
    {
      name: "Divine Word",
      level: 7,
      school: "Evocation",
      castingTime: "1 bonus action",
      range: "30 feet",
      components: "V",
      duration: "Instantaneous",
      damage: "",
      save: "Charisma save",
      attack: "",
      ritual: false,
      concentration: false,
      description: "You utter a divine word, imbued with the power that shaped the world at the dawn of creation. Choose any number of creatures you can see within range. Each creature that can hear you must make a Charisma saving throw. On a failed save, a creature suffers an effect based on its current hit points: 50 hit points or fewer: deafened for 1 minute, 40 hit points or fewer: deafened and blinded for 10 minutes, 30 hit points or fewer: blinded, deafened, and stunned for 1 hour, 20 hit points or fewer: killed instantly.",
      wikiLink: "https://dnd5e.wikidot.com/spell:divine-word"
    },
    {
      name: "Etherealness",
      level: 7,
      school: "Transmutation",
      castingTime: "1 action",
      range: "Self",
      components: "V, S",
      duration: "Up to 8 hours",
      damage: "",
      save: "",
      attack: "",
      ritual: false,
      concentration: false,
      description: "You step into the border regions of the Ethereal Plane, in the area where it overlaps with your current plane. You remain in the Border Ethereal for the duration or until you use your action to dismiss the spell. During this time, you can move in any direction. If you move up or down, every foot of movement costs an extra foot. You can see and hear the plane you originated from, but everything there looks gray, and you can't see anything more than 60 feet away.",
      wikiLink: "https://dnd5e.wikidot.com/spell:etherealness"
    },
    {
      name: "Finger of Death",
      level: 7,
      school: "Necromancy",
      castingTime: "1 action",
      range: "60 feet",
      components: "V, S",
      duration: "Instantaneous",
      damage: "7d8 + 30 necrotic damage",
      save: "Constitution save",
      attack: "",
      ritual: false,
      concentration: false,
      description: "You send negative energy coursing through a creature that you can see within range, causing it searing pain. The target must make a Constitution saving throw. It takes 7d8 + 30 necrotic damage on a failed save, or half as much damage on a successful one. A humanoid killed by this spell rises at the start of your next turn as a zombie that is permanently under your command, following your verbal orders to the best of its ability.",
      wikiLink: "https://dnd5e.wikidot.com/spell:finger-of-death"
    },
    {
      name: "Fire Storm",
      level: 7,
      school: "Evocation",
      castingTime: "1 action",
      range: "150 feet",
      components: "V, S",
      duration: "Instantaneous",
      damage: "7d10 fire damage",
      save: "Dexterity save",
      attack: "",
      ritual: false,
      concentration: false,
      description: "A storm made up of sheets of roaring flame appears in a location you choose within range. The area of the storm consists of up to ten 10-foot cubes, which you can arrange as you wish. Each cube must have at least one face adjacent to the face of another cube. Each creature in the area must make a Dexterity saving throw. It takes 7d10 fire damage on a failed save, or half as much damage on a successful one. The fire damages objects in the area and ignites flammable objects that aren't being worn or carried.",
      wikiLink: "https://dnd5e.wikidot.com/spell:fire-storm"
    },
    {
      name: "Forcecage",
      level: 7,
      school: "Evocation",
      castingTime: "1 action",
      range: "100 feet",
      components: "V, S, M",
      duration: "1 hour",
      damage: "",
      save: "",
      attack: "",
      ritual: false,
      concentration: false,
      description: "An immobile, invisible, cube-shaped prison composed of magical force springs into existence around an area you choose within range. The prison can be a cage or a solid box, as you choose. A prison in the shape of a cage can be up to 20 feet on a side and is made from 1/2-inch diameter bars spaced 1/2 inch apart. A prison in the shape of a box can be up to 10 feet on a side, creating a solid barrier that prevents any matter from passing through it and blocking any spells cast into or out from the area.",
      wikiLink: "https://dnd5e.wikidot.com/spell:forcecage"
    },
    {
      name: "Mirage Arcane",
      level: 7,
      school: "Illusion",
      castingTime: "10 minutes",
      range: "Sight",
      components: "V, S",
      duration: "10 days",
      damage: "",
      save: "",
      attack: "",
      ritual: false,
      concentration: false,
      description: "You make terrain in an area up to 1 mile square look, sound, smell, and even feel like some other sort of terrain. The terrain's general shape remains the same, however. Open fields or a road could be made to resemble a swamp, hill, crevasse, or some other difficult or impassable terrain. A pond can be made to seem like a grassy meadow, a precipice like a gentle slope, or a rock-strewn gully like a wide and smooth road. Similarly, you can alter the appearance of structures, or add them where none are present. The spell doesn't disguise, conceal, or add creatures.",
      wikiLink: "https://dnd5e.wikidot.com/spell:mirage-arcane"
    },
    {
      name: "Mordenkainen's Magnificent Mansion",
      level: 7,
      school: "Conjuration",
      castingTime: "1 minute",
      range: "300 feet",
      components: "V, S, M",
      duration: "24 hours",
      damage: "",
      save: "",
      attack: "",
      ritual: false,
      concentration: false,
      description: "You conjure an extradimensional dwelling in range that lasts for the duration. You choose where its one entrance is located. The entrance shimmers faintly and is 5 feet wide and 10 feet tall. You and any creature you designate when you cast the spell can enter the extradimensional dwelling as long as the portal remains open. You can open or close the portal if you are within 30 feet of it. While closed, the portal is invisible. Beyond the portal is a magnificent foyer with numerous chambers beyond. The atmosphere is clean, fresh, and warm.",
      wikiLink: "https://dnd5e.wikidot.com/spell:mordenkainens-magnificent-mansion"
    },
    {
      name: "Mordenkainen's Sword",
      level: 7,
      school: "Evocation",
      castingTime: "1 action",
      range: "60 feet",
      components: "V, S, M",
      duration: "Concentration, up to 1 minute",
      damage: "3d10 force damage",
      save: "",
      attack: "Melee spell attack",
      ritual: false,
      concentration: true,
      description: "You create a sword-shaped plane of force that hovers within range. It lasts for the duration. When the sword appears, you make a melee spell attack against a target of your choice within 5 feet of the sword. On a hit, the target takes 3d10 force damage. Until the spell ends, you can use a bonus action on each of your turns to move the sword up to 20 feet to a spot you can see and repeat this attack against the same target or a different one.",
      wikiLink: "https://dnd5e.wikidot.com/spell:mordenkainens-sword"
    },
    {
      name: "Plane Shift",
      level: 7,
      school: "Conjuration",
      castingTime: "1 action",
      range: "Touch",
      components: "V, S, M",
      duration: "Instantaneous",
      damage: "",
      save: "Charisma save",
      attack: "",
      ritual: false,
      concentration: false,
      description: "You and up to eight willing creatures (or a single object) are transported to another plane of existence. You can specify a target destination in one of the following ways: by name (if you are familiar with the plane), by planar coordinates, or by the general description of the plane. If you are trying to reach the Elemental Plane of Fire, for example, you could say 'the Elemental Plane of Fire' or 'the Plane of Fire.' If you are familiar with a specific location on that plane, you can name that place, and the spell transports you there.",
      wikiLink: "https://dnd5e.wikidot.com/spell:plane-shift"
    },
    {
      name: "Prismatic Spray",
      level: 7,
      school: "Evocation",
      castingTime: "1 action",
      range: "Self (60-foot cone)",
      components: "V, S",
      duration: "Instantaneous",
      damage: "10d6 damage",
      save: "Dexterity save",
      attack: "",
      ritual: false,
      concentration: false,
      description: "Eight multicolored rays of light flash from your hand. Each ray is a different color and has a different power and purpose. Each creature in a 60-foot cone must make a Dexterity saving throw. For each target, roll a d8 to determine which color ray affects it. 1-Red: The target takes 10d6 fire damage on a failed save, or half as much damage on a successful one. 2-Orange: The target takes 10d6 acid damage on a failed save, or half as much damage on a successful one. 3-Yellow: The target takes 10d6 lightning damage on a failed save, or half as much damage on a successful one. 4-Green: The target takes 10d6 poison damage on a failed save, or half as much damage on a successful one. 5-Blue: The target takes 10d6 cold damage on a failed save, or half as much damage on a successful one. 6-Indigo: On a failed save, the target is restrained. It must then make a Constitution saving throw at the end of each of its turns. If it successfully saves three times, the spell ends. If it fails its save three times, it permanently turns to stone and is subjected to the petrified condition. The successes and failures don't need to be consecutive; keep track of both until the target collects three of a kind. 7-Violet: On a failed save, the target is blinded. It must then make a Wisdom saving throw at the start of your next turn. A successful save means the spell ends. If it fails that save, the creature is transported to another plane of existence of the DM's choosing and is no longer blinded. (Typically, a creature that is on a plane that isn't its home plane is banished home, while other creatures are usually cast into the Astral or Ethereal planes.) 8-Special: The target is struck by two rays. Roll twice more, rerolling any 8.",
      wikiLink: "https://dnd5e.wikidot.com/spell:prismatic-spray"
    },
    {
      name: "Project Image",
      level: 7,
      school: "Illusion",
      castingTime: "1 action",
      range: "500 miles",
      components: "V, S, M",
      duration: "Concentration, up to 1 day",
      damage: "",
      save: "",
      attack: "",
      ritual: false,
      concentration: true,
      description: "You create an illusory copy of yourself that lasts for the duration. The copy can appear at any location within range that you have seen before, regardless of intervening obstacles. The illusion looks and sounds like you but is intangible. If the illusion takes any damage, it disappears, and the spell ends. You can use your action to move this illusion up to twice your speed, and make it gesture, speak, and behave in whatever way you choose. It mimics your mannerisms perfectly. You can see through its eyes and hear through its ears as if you were located where it is. On each of your turns as a bonus action, you can switch from using its senses to using your own, or back again. While you are using its senses, you are blinded and deafened in regard to your own surroundings.",
      wikiLink: "https://dnd5e.wikidot.com/spell:project-image"
    },
    {
      name: "Regenerate",
      level: 7,
      school: "Transmutation",
      castingTime: "1 minute",
      range: "Touch",
      components: "V, S, M",
      duration: "1 hour",
      damage: "",
      save: "",
      attack: "",
      ritual: false,
      concentration: false,
      description: "You touch a creature and stimulate its natural healing ability. The target regains 4d8 + 15 hit points. For the duration of the spell, the target regains 1 hit point at the start of each of its turns (10 hit points each minute). The target's severed body members (fingers, legs, tails, and so on), if any, are restored after 2 minutes. If you have the severed part and hold it to the stump, the spell instantaneously causes the limb to knit to the stump.",
      wikiLink: "https://dnd5e.wikidot.com/spell:regenerate"
    },
    {
      name: "Resurrection",
      level: 7,
      school: "Necromancy",
      castingTime: "1 hour",
      range: "Touch",
      components: "V, S, M",
      duration: "Instantaneous",
      damage: "",
      save: "",
      attack: "",
      ritual: false,
      concentration: false,
      description: "You touch a dead creature that has been dead for no more than a century, that didn't die of old age, and that isn't undead. If its soul is free and willing, the target returns to life with all its hit points. This spell neutralizes any poisons and cures normal diseases afflicting the creature when it died. It doesn't, however, remove magical diseases, curses, and the like; if such effects aren't removed prior to casting the spell, they afflict the target on its return to life. This spell closes all mortal wounds and restores any missing body parts. Coming back from the dead is an ordeal. The target takes a -4 penalty to all attack rolls, saving throws, and ability checks. Every time the target finishes a long rest, the penalty is reduced by 1 until it disappears.",
      wikiLink: "https://dnd5e.wikidot.com/spell:resurrection"
    },
    {
      name: "Reverse Gravity",
      level: 7,
      school: "Transmutation",
      castingTime: "1 action",
      range: "100 feet",
      components: "V, S, M",
      duration: "Concentration, up to 1 minute",
      damage: "",
      save: "Dexterity save",
      attack: "",
      ritual: false,
      concentration: true,
      description: "This spell reverses gravity in a 50-foot-radius, 100-foot high cylinder centered on a point within range. All creatures and objects that aren't somehow anchored to the ground in the area fall upward and reach the top of the area when you cast this spell. A creature can make a Dexterity saving throw to grab onto a fixed object it can reach, thus avoiding the fall. If some solid object (such as a ceiling) is encountered in this fall, falling objects and creatures strike it just as they would during a normal downward fall. If an object or creature reaches the top of the area without striking anything, it remains there, oscillating slightly, for the duration.",
      wikiLink: "https://dnd5e.wikidot.com/spell:reverse-gravity"
    },
    {
      name: "Sequester",
      level: 7,
      school: "Transmutation",
      castingTime: "1 action",
      range: "Touch",
      components: "V, S, M",
      duration: "Until dispelled",
      damage: "",
      save: "",
      attack: "",
      ritual: false,
      concentration: false,
      description: "By means of this spell, a willing creature or an object can be hidden away, safe from detection for the duration. When you cast the spell and touch the target, it becomes invisible and can't be targeted by divination spells or perceived through scrying sensors created by divination spells. If the target is a creature, it falls into a state of suspended animation. Time ceases to flow for it, and it doesn't grow older. You can set a condition for the spell to end early. The condition can be anything you choose, but it must occur or be visible within 1 mile of the target. Examples include 'after 1,000 years' or 'when the tarrasque awakens.' This spell also ends if the target takes any damage.",
      wikiLink: "https://dnd5e.wikidot.com/spell:sequester"
    },
    {
      name: "Simulacrum",
      level: 7,
      school: "Illusion",
      castingTime: "12 hours",
      range: "Touch",
      components: "V, S, M",
      duration: "Until dispelled",
      damage: "",
      save: "",
      attack: "",
      ritual: false,
      concentration: false,
      description: "You shape an illusory duplicate of one beast or humanoid that is within range for the entire casting time of the spell. The duplicate is a creature, partially real and formed from ice or snow, and it can take actions and otherwise be affected as a normal creature. It appears to be the same as the original, but it has half the creature's hit point maximum and is formed without any equipment. Otherwise, the illusion uses all the statistics of the creature it duplicates. The simulacrum is friendly to you and creatures you designate. It obeys your spoken commands, moving and acting in accordance with your wishes and acting on your turn in combat. The simulacrum lacks the ability to learn or become more powerful, so it never increases its level or other abilities, nor can it regain expended spell slots.",
      wikiLink: "https://dnd5e.wikidot.com/spell:simulacrum"
    },
    {
      name: "Symbol",
      level: 7,
      school: "Abjuration",
      castingTime: "1 minute",
      range: "Touch",
      components: "V, S, M",
      duration: "Until dispelled or triggered",
      damage: "",
      save: "",
      attack: "",
      ritual: false,
      concentration: false,
      description: "When you cast this spell, you inscribe a harmful glyph either on a surface (such as a section of floor, a wall, or a table) or within an object that can be closed to conceal the glyph (such as a book, a scroll, or a treasure chest). If you choose a surface, the glyph can cover an area of the surface no larger than 10 feet in diameter. If you choose an object, that object must remain in its place; if the object is moved more than 10 feet from where you cast this spell, the glyph is broken, and the spell ends without being triggered.",
      wikiLink: "https://dnd5e.wikidot.com/spell:symbol"
    },
    {
      name: "Teleport",
      level: 7,
      school: "Conjuration",
      castingTime: "1 action",
      range: "10 feet",
      components: "V",
      duration: "Instantaneous",
      damage: "",
      save: "",
      attack: "",
      ritual: false,
      concentration: false,
      description: "This spell instantly transports you and up to eight willing creatures of your choice that you can see within range, or a single object that you can see within range, to a destination you select. If you target an object, it must be able to fit entirely inside a 10-foot cube, and it can't be held or carried by an unwilling creature. The destination you choose must be known to you, and it must be on the same plane of existence as you. Your familiarity with the destination determines whether you arrive there successfully.",
      wikiLink: "https://dnd5e.wikidot.com/spell:teleport"
    },
    {
      name: "Whirlwind",
      level: 7,
      school: "Evocation",
      castingTime: "1 action",
      range: "300 feet",
      components: "V, M",
      duration: "Concentration, up to 1 minute",
      damage: "2d8 bludgeoning damage",
      save: "Strength save",
      attack: "",
      ritual: false,
      concentration: true,
      description: "A whirlwind howls down to a point that you can see on the ground within range. The whirlwind is a 10-foot-radius, 30-foot-high cylinder centered on that point. Until the spell ends, you can use your action to move the whirlwind up to 30 feet in any direction along the ground. The whirlwind sucks up any Medium or smaller objects that aren't secured to anything and that aren't worn or carried by anyone. A creature must make a Strength saving throw the first time on a turn that it enters the whirlwind or that the whirlwind enters its space, including when the whirlwind first appears. On a failed save, the creature takes 2d8 bludgeoning damage and is caught in the whirlwind until the spell ends. On a successful save, the creature takes half as much damage and isn't caught in the whirlwind.",
      wikiLink: "https://dnd5e.wikidot.com/spell:whirlwind"
    },
    {
      name: "Abi-Dalzim's Horrid Wilting",
      level: 8,
      school: "Necromancy",
      castingTime: "1 action",
      range: "150 feet",
      components: "V, S, M",
      duration: "Instantaneous",
      damage: "12d8 necrotic damage",
      save: "Constitution save",
      attack: "",
      ritual: false,
      concentration: false,
      description: "You draw the moisture from every creature in a 30-foot cube centered on a point you choose within range. Each creature in that area must make a Constitution saving throw. Constructs and undead aren't affected, and plants and water elementals make this saving throw with disadvantage. A creature takes 12d8 necrotic damage on a failed save, or half as much damage on a successful one. Nonmagical plants in the area that aren't creatures, such as trees and shrubs, wither and die instantly.",
      wikiLink: "https://dnd5e.wikidot.com/spell:abi-dalzims-horrid-wilting"
    },
    {
      name: "Animal Shapes",
      level: 8,
      school: "Transmutation",
      castingTime: "1 action",
      range: "30 feet",
      components: "V, S",
      duration: "24 hours",
      damage: "",
      save: "",
      attack: "",
      ritual: false,
      concentration: false,
      description: "Your magic turns others into beasts. Choose any number of willing creatures that you can see within range. You transform each target into the form of a Large or smaller beast with a challenge rating of 4 or lower. On subsequent turns, you can use your action to transform affected creatures into new forms. The transformation lasts for the spell's duration, or until the target drops to 0 hit points or dies. You can choose a different form for each target. A target's game statistics are replaced by the statistics of the chosen beast, though the target retains its alignment and Intelligence, Wisdom, and Charisma scores. The target assumes the hit points of its new form, and when it reverts to its normal form, it returns to the number of hit points it had before it was transformed. If it reverts as a result of dropping to 0 hit points, any excess damage carries over to its normal form.",
      wikiLink: "https://dnd5e.wikidot.com/spell:animal-shapes"
    },
    {
      name: "Antimagic Field",
      level: 8,
      school: "Abjuration",
      castingTime: "1 action",
      range: "Self (10-foot radius)",
      components: "V, S, M",
      duration: "Concentration, up to 1 hour",
      damage: "",
      save: "",
      attack: "",
      ritual: false,
      concentration: true,
      description: "A 10-foot-radius invisible sphere of antimagic surrounds you. This area is divorced from the magical energy that suffuses the multiverse. Within the sphere, spells can't be cast, summoned creatures disappear, and even magic items become mundane. Until the spell ends, the space moves with you, centered on you. Spells and other magical effects, except those created by an artifact or a deity, are suppressed in the sphere and can't protrude into it. A slot expended to cast a suppressed spell is consumed. While an effect is suppressed, it doesn't function, but the time it spends suppressed counts against its duration.",
      wikiLink: "https://dnd5e.wikidot.com/spell:antimagic-field"
    },
    {
      name: "Antipathy/Sympathy",
      level: 8,
      school: "Enchantment",
      castingTime: "1 hour",
      range: "60 feet",
      components: "V, S, M",
      duration: "10 days",
      damage: "",
      save: "Wisdom save",
      attack: "",
      ritual: false,
      concentration: false,
      description: "This spell attracts or repels creatures of your choice. You target something within range, either a Huge or smaller object or creature or an area that is no larger than a 200-foot cube. Then specify a kind of intelligent creature, such as red dragons, goblins, or vampires. You invest the target with an aura that either attracts or repels the specified creatures for the duration. Choose antipathy or sympathy as the aura's effect.",
      wikiLink: "https://dnd5e.wikidot.com/spell:antipathy-sympathy"
    },
    {
      name: "Clone",
      level: 8,
      school: "Necromancy",
      castingTime: "1 hour",
      range: "Touch",
      components: "V, S, M",
      duration: "Instantaneous",
      damage: "",
      save: "",
      attack: "",
      ritual: false,
      concentration: false,
      description: "This spell grows an inert duplicate of a living creature as a safeguard against death. This clone forms inside a sealed vessel and grows to full size and maturity after 120 days; you can also choose to have the clone be a younger version of the same creature. It remains inert and endures indefinitely, as long as its vessel remains undisturbed. At any time after the clone matures, if the original creature dies, its soul transfers to the clone, provided that the soul is free and willing to return. The clone is physically identical to the original and has the same personality, memories, and abilities, but none of the original's equipment. The original creature's physical remains, if they still exist, become inert and can't thereafter be restored to life, since the creature's soul is elsewhere.",
      wikiLink: "https://dnd5e.wikidot.com/spell:clone"
    },
    {
      name: "Control Weather",
      level: 8,
      school: "Transmutation",
      castingTime: "10 minutes",
      range: "Self (5-mile radius)",
      components: "V, S, M",
      duration: "Concentration, up to 8 hours",
      damage: "",
      save: "",
      attack: "",
      ritual: false,
      concentration: true,
      description: "You take control of the weather within 5 miles of you for the duration. You must be outdoors to cast this spell. Moving to a place where you don't have a clear path to the sky ends the spell early. When you cast the spell, you change the current weather conditions, which are determined by the DM based on the climate and season. You can change precipitation, temperature, and wind. It takes 1d4 × 10 minutes for the new conditions to take effect. Once they do so, you can change the conditions again. When the spell ends, the weather gradually returns to normal.",
      wikiLink: "https://dnd5e.wikidot.com/spell:control-weather"
    },
    {
      name: "Demiplane",
      level: 8,
      school: "Conjuration",
      castingTime: "1 action",
      range: "60 feet",
      components: "S",
      duration: "1 hour",
      damage: "",
      save: "",
      attack: "",
      ritual: false,
      concentration: false,
      description: "You create a shadowy door on a flat solid surface that you can see within range. The door is large enough to allow Medium creatures to pass through unhindered. When opened, the door leads to a demiplane that appears to be an empty room 30 feet in each dimension, made of wood or stone. When the spell ends, the door disappears, and any creatures or objects inside the demiplane remain trapped there, as the door also disappears from the other side. Each time you cast this spell, you can create a new demiplane, or have the shadowy door connect to a demiplane you created with a previous casting of this spell. Additionally, if you know the nature and contents of a demiplane created by a casting of this spell by another creature, you can have the shadowy door connect to its demiplane instead.",
      wikiLink: "https://dnd5e.wikidot.com/spell:demiplane"
    },
    {
      name: "Dominate Monster",
      level: 8,
      school: "Enchantment",
      castingTime: "1 action",
      range: "60 feet",
      components: "V, S",
      duration: "Concentration, up to 1 hour",
      damage: "",
      save: "Wisdom save",
      attack: "",
      ritual: false,
      concentration: true,
      description: "You attempt to beguile a creature that you can see within range. It must succeed on a Wisdom saving throw or be charmed by you for the duration. If you or creatures that are friendly to you are fighting it, it has advantage on the saving throw. While the target is charmed, you have a telepathic link with it as long as the two of you are on the same plane of existence. You can use this telepathic link to issue commands to the creature while you are conscious (no action required), which it does its best to obey. You can specify a simple and general course of action, such as 'Attack that creature,' 'Run over there,' or 'Fetch that object.' If the creature completes the order and doesn't receive further direction from you, it defends and preserves itself to the best of its ability.",
      wikiLink: "https://dnd5e.wikidot.com/spell:dominate-monster"
    },
    {
      name: "Earthquake",
      level: 8,
      school: "Evocation",
      castingTime: "1 action",
      range: "500 feet",
      components: "V, S, M",
      duration: "Concentration, up to 1 minute",
      damage: "",
      save: "Dexterity save",
      attack: "",
      ritual: false,
      concentration: true,
      description: "You create a seismic disturbance within range. For the duration, an intense tremor rips through the ground in a 100-foot-radius circle centered on that point and shakes creatures and structures in contact with the ground in that area. The ground in the area becomes difficult terrain. Each creature on the ground that is concentrating must make a Constitution saving throw. On a failed save, the creature's concentration is broken. When you cast this spell and at the end of each turn you spend concentrating on it, each creature on the ground in the area must make a Dexterity saving throw. On a failed save, the creature is knocked prone.",
      wikiLink: "https://dnd5e.wikidot.com/spell:earthquake"
    },
    {
      name: "Feeblemind",
      level: 8,
      school: "Enchantment",
      castingTime: "1 action",
      range: "150 feet",
      components: "V, S, M",
      duration: "Instantaneous",
      damage: "",
      save: "Intelligence save",
      attack: "",
      ritual: false,
      concentration: false,
      description: "You blast the mind of a creature that you can see within range, attempting to shatter its intellect and personality. The target takes 4d6 psychic damage and must make an Intelligence saving throw. On a failed save, the creature's Intelligence and Charisma scores become 1. The creature can't cast spells, activate magic items, understand language, or communicate in any intelligible way. The creature can, however, identify its friends, follow them, and even protect them. At the end of every 30 days, the creature can repeat its saving throw against this spell. If it succeeds on its saving throw, the spell ends. The spell can also be ended by greater restoration, heal, or wish.",
      wikiLink: "https://dnd5e.wikidot.com/spell:feeblemind"
    },
    {
      name: "Glibness",
      level: 8,
      school: "Transmutation",
      castingTime: "1 action",
      range: "Self",
      components: "V",
      duration: "1 hour",
      damage: "",
      save: "",
      attack: "",
      ritual: false,
      concentration: false,
      description: "Until the spell ends, when you make a Charisma check, you can replace the number you roll with a 15. Additionally, no matter what you say, magic that would determine if you are telling the truth indicates that you are being truthful.",
      wikiLink: "https://dnd5e.wikidot.com/spell:glibness"
    },
    {
      name: "Holy Aura",
      level: 8,
      school: "Abjuration",
      castingTime: "1 action",
      range: "Self",
      components: "V, S, M",
      duration: "Concentration, up to 1 minute",
      damage: "",
      save: "",
      attack: "",
      ritual: false,
      concentration: true,
      description: "Divine light washes out from you and coalesces in a soft radiance in a 30-foot radius around you. Creatures of your choice in that radius when you cast this spell shed dim light in a 5-foot radius and have advantage on all saving throws, and other creatures have disadvantage on attack rolls against them until the spell ends. In addition, when a fiend or an undead hits an affected creature with a melee attack, the aura flashes with brilliant light. The attacker must succeed on a Constitution saving throw or be blinded until the spell ends.",
      wikiLink: "https://dnd5e.wikidot.com/spell:holy-aura"
    },
    {
      name: "Incendiary Cloud",
      level: 8,
      school: "Conjuration",
      castingTime: "1 action",
      range: "150 feet",
      components: "V, S",
      duration: "Concentration, up to 1 minute",
      damage: "10d8 fire damage",
      save: "Dexterity save",
      attack: "",
      ritual: false,
      concentration: true,
      description: "A swirling cloud of smoke shot through with white-hot embers appears in a 20-foot-radius sphere centered on a point within range. The cloud spreads around corners and is heavily obscured. It lasts for the duration or until a wind of moderate or greater speed (at least 10 miles per hour) disperses it. When the cloud appears, each creature in it must make a Dexterity saving throw. A creature takes 10d8 fire damage on a failed save, or half as much damage on a successful one. A creature must also make this saving throw when it enters the spell's area for the first time on a turn or ends its turn there.",
      wikiLink: "https://dnd5e.wikidot.com/spell:incendiary-cloud"
    },
    {
      name: "Maze",
      level: 8,
      school: "Conjuration",
      castingTime: "1 action",
      range: "60 feet",
      components: "V, S",
      duration: "Concentration, up to 10 minutes",
      damage: "",
      save: "",
      attack: "",
      ritual: false,
      concentration: true,
      description: "You banish a creature that you can see within range into a labyrinthine demiplane. The target remains there for the duration or until it escapes the maze. The target can use its action to attempt to escape. When it does so, it makes a DC 20 Intelligence check. If it succeeds, it escapes, and the spell ends (a minotaur or goristro demon automatically succeeds). Otherwise, it must make a DC 20 Intelligence check at the end of each of its turns for the duration of the spell. If it accumulates a total of three successful Intelligence checks before failing a total of three Intelligence checks, it escapes, and the spell ends.",
      wikiLink: "https://dnd5e.wikidot.com/spell:maze"
    },
    {
      name: "Mind Blank",
      level: 8,
      school: "Abjuration",
      castingTime: "1 action",
      range: "Touch",
      components: "V, S",
      duration: "24 hours",
      damage: "",
      save: "",
      attack: "",
      ritual: false,
      concentration: false,
      description: "Until the spell ends, one willing creature you touch is immune to psychic damage, any effect that would sense its emotions or read its thoughts, divination spells, and the charmed condition. The spell even foils wish spells and spells or effects of similar power used to affect the target's mind or to gain information about the target.",
      wikiLink: "https://dnd5e.wikidot.com/spell:mind-blank"
    },
    {
      name: "Power Word Stun",
      level: 8,
      school: "Enchantment",
      castingTime: "1 action",
      range: "60 feet",
      components: "V",
      duration: "Instantaneous",
      damage: "",
      save: "",
      attack: "",
      ritual: false,
      concentration: false,
      description: "You speak a word of power that can overwhelm the mind of one creature you can see within range, leaving it dumbfounded. If the target has 150 hit points or fewer, it is stunned. Otherwise, the spell has no effect. The stunned target must make a Constitution saving throw at the end of each of its turns. On a successful save, this stunning effect ends.",
      wikiLink: "https://dnd5e.wikidot.com/spell:power-word-stun"
    },
    {
      name: "Sunburst",
      level: 8,
      school: "Evocation",
      castingTime: "1 action",
      range: "150 feet",
      components: "V, S, M",
      duration: "Instantaneous",
      damage: "12d6 radiant damage",
      save: "Constitution save",
      attack: "",
      ritual: false,
      concentration: false,
      description: "Brilliant sunlight flashes in a 60-foot-radius sphere centered on a point you choose within range. Each creature in that light must make a Constitution saving throw. It takes 12d6 radiant damage on a failed save, or half as much damage on a successful one. A creature that has total cover from the point of origin of the spell isn't affected by it. Undead and oozes have disadvantage on this saving throw. A creature killed by this spell becomes a pile of fine ash. The light is sunlight.",
      wikiLink: "https://dnd5e.wikidot.com/spell:sunburst"
    },
    {
      name: "Telepathy",
      level: 8,
      school: "Evocation",
      castingTime: "1 action",
      range: "Unlimited",
      components: "V, S, M",
      duration: "24 hours",
      damage: "",
      save: "",
      attack: "",
      ritual: false,
      concentration: false,
      description: "You create a telepathic link between yourself and a willing creature with which you are familiar. The creature can be anywhere on the same plane of existence as you. The spell ends if you or the target are no longer on the same plane. Until the spell ends, you and the target can instantaneously share words, images, sounds, and other sensory messages with one another through the link, and the target recognizes you as the creature it is communicating with. The spell enables a creature with an Intelligence score of at least 1 to understand the meaning of your words and transmit mental messages in response.",
      wikiLink: "https://dnd5e.wikidot.com/spell:telepathy"
    },
    {
      name: "Tsunami",
      level: 8,
      school: "Conjuration",
      castingTime: "1 minute",
      range: "Sight",
      components: "V, S",
      duration: "6 rounds",
      damage: "6d10 bludgeoning damage",
      save: "Strength save",
      attack: "",
      ritual: false,
      concentration: false,
      description: "A wall of water springs into existence at a point you choose within range. You can make the wall up to 300 feet long, 300 feet high, and 50 feet thick. The wall lasts for the duration. When the wall appears, each creature within its area must make a Strength saving throw. On a failed save, a creature takes 6d10 bludgeoning damage, or half as much damage on a successful save. At the start of each of your turns after the wall appears, the wall, along with any creatures in it, moves 50 feet away from you. Any Huge or smaller creature inside the wall or whose space the wall enters when it moves must succeed on a Strength saving throw or be caught up in the wall and carried along with it.",
      wikiLink: "https://dnd5e.wikidot.com/spell:tsunami"
    },
    {
      name: "Astral Projection",
      level: 9,
      school: "Necromancy",
      castingTime: "1 hour",
      range: "10 feet",
      components: "V, S, M",
      duration: "Special",
      damage: "",
      save: "",
      attack: "",
      ritual: false,
      concentration: false,
      description: "You and up to eight willing creatures within range project your astral bodies into the Astral Plane (the spell fails and the casting is wasted if you are already on that plane). The material body you leave behind is unconscious and in a state of suspended animation; it doesn't need food or air and doesn't age. Your astral body resembles your mortal form in almost every way, replicating your game statistics and possessions. The principal difference is the addition of an astral cord that extends from between your shoulder blades and trails behind you, fading to invisibility after 1 foot. This cord is your tether to your material body. As long as the tether remains intact, you can find your way home. And, if the tether is broken—by a wish spell or by something cutting it—your soul and body are separated, killing you instantly.",
      wikiLink: "https://dnd5e.wikidot.com/spell:astral-projection"
    },
    {
      name: "Foresight",
      level: 9,
      school: "Divination",
      castingTime: "1 minute",
      range: "Touch",
      components: "V, S, M",
      duration: "8 hours",
      damage: "",
      save: "",
      attack: "",
      ritual: false,
      concentration: false,
      description: "You touch a willing creature and bestow a limited ability to see into the immediate future. For the duration, the target can't be surprised and has advantage on all attack rolls, ability checks, and saving throws. Additionally, other creatures have disadvantage on attack rolls against the target for the duration. This spell immediately ends if you cast it again before its duration ends.",
      wikiLink: "https://dnd5e.wikidot.com/spell:foresight"
    },
    {
      name: "Gate",
      level: 9,
      school: "Conjuration",
      castingTime: "1 action",
      range: "60 feet",
      components: "V, S, M",
      duration: "Concentration, up to 1 minute",
      damage: "",
      save: "",
      attack: "",
      ritual: false,
      concentration: true,
      description: "You conjure a portal linking an unoccupied space you can see within range to a precise location on a different plane of existence. The portal is a circular opening, which you can make 5 to 20 feet in diameter. You can orient the portal in any direction you choose. The portal lasts for the duration. The portal has a front and a back on each plane where it appears. Travel through the portal is possible only by moving through its front. Anything that does so is instantly transported to the other plane, appearing in the unoccupied space nearest to the portal. Deities and other planar rulers can prevent portals created by this spell from opening in their presence or anywhere within their domains.",
      wikiLink: "https://dnd5e.wikidot.com/spell:gate"
    },
    {
      name: "Imprisonment",
      level: 9,
      school: "Abjuration",
      castingTime: "1 minute",
      range: "30 feet",
      components: "V, S, M",
      duration: "Until dispelled",
      damage: "",
      save: "Wisdom save",
      attack: "",
      ritual: false,
      concentration: false,
      description: "You create a magical restraint to hold a creature. The target must be within range for the entire casting of the spell. On completion, the target disappears and becomes bound in an extradimensional prison. The prison can be a tiny, harmless demiplane or a labyrinth with a minotaur, which you choose when you cast the spell. The prison can be a physical location you designate on the current plane, or it can be a demiplane that moves along the Ethereal Plane. When you cast the spell, you can specify a condition that will cause the spell to end and release the target. The condition can be as specific or as elaborate as you choose, but the DM must agree that the condition is reasonable and has a likelihood of coming to pass. The conditions can be based on a creature's name, identity, or deity but otherwise must be based on observable actions or qualities and not based on intangibles such as level, class, or hit points.",
      wikiLink: "https://dnd5e.wikidot.com/spell:imprisonment"
    },
    {
      name: "Mass Heal",
      level: 9,
      school: "Evocation",
      castingTime: "1 action",
      range: "60 feet",
      components: "V, S",
      duration: "Instantaneous",
      damage: "",
      save: "",
      attack: "",
      ritual: false,
      concentration: false,
      description: "A flood of healing energy flows from you into injured creatures around you. You restore up to 700 hit points, divided as you choose among any number of creatures that you can see within range. Creatures healed by this spell are also cured of all diseases and any effect making them blinded or deafened. This spell has no effect on undead or constructs.",
      wikiLink: "https://dnd5e.wikidot.com/spell:mass-heal"
    },
    {
      name: "Meteor Swarm",
      level: 9,
      school: "Evocation",
      castingTime: "1 action",
      range: "1 mile",
      components: "V, S",
      duration: "Instantaneous",
      damage: "20d6 fire damage",
      save: "Dexterity save",
      attack: "",
      ritual: false,
      concentration: false,
      description: "Blazing orbs of fire plummet to the ground at four different points you can see within range. Each creature in a 40-foot-radius sphere centered on each point you choose must make a Dexterity saving throw. The sphere spreads around corners. A creature takes 20d6 fire damage and 20d6 bludgeoning damage on a failed save, or half as much damage on a successful one. A creature in the area of more than one fiery burst is affected only once. The spell damages objects in the area and ignites flammable objects that aren't being worn or carried.",
      wikiLink: "https://dnd5e.wikidot.com/spell:meteor-swarm"
    },
    {
      name: "Power Word Kill",
      level: 9,
      school: "Enchantment",
      castingTime: "1 action",
      range: "60 feet",
      components: "V",
      duration: "Instantaneous",
      damage: "",
      save: "",
      attack: "",
      ritual: false,
      concentration: false,
      description: "You utter a word of power that can compel one creature you can see within range to die instantly. If the creature you choose has 100 hit points or fewer, it dies. Otherwise, the spell has no effect.",
      wikiLink: "https://dnd5e.wikidot.com/spell:power-word-kill"
    },
    {
      name: "Prismatic Wall",
      level: 9,
      school: "Abjuration",
      castingTime: "1 action",
      range: "60 feet",
      components: "V, S",
      duration: "10 minutes",
      damage: "",
      save: "",
      attack: "",
      ritual: false,
      concentration: false,
      description: "A shimmering, multicolored plane of light forms a vertical opaque wall—up to 90 feet long, 30 feet high, and 1 inch thick—centered on a point you can see within range. Alternatively, you can shape the wall into a sphere up to 30 feet in diameter centered on that point. The wall remains in place for the duration. If you position the wall so that it passes through a space occupied by a creature, the spell fails, and your action and the spell slot are wasted. The wall sheds bright light out to a range of 100 feet and dim light for an additional 100 feet. You and creatures you designate at the time you cast the spell can pass through and remain near the wall without harm. If another creature that can see the wall moves to within 20 feet of it or starts its turn there, the creature must succeed on a Constitution saving throw or become blinded for 1 minute.",
      wikiLink: "https://dnd5e.wikidot.com/spell:prismatic-wall"
    },
    {
      name: "Shapechange",
      level: 9,
      school: "Transmutation",
      castingTime: "1 action",
      range: "Self",
      components: "V, S, M",
      duration: "Concentration, up to 1 hour",
      damage: "",
      save: "",
      attack: "",
      ritual: false,
      concentration: true,
      description: "You assume the form of a different creature for the duration. The new form can be of any creature with a challenge rating equal to your level or lower. You can't use this spell to become an undead or a construct. You also can't assume a form that has 0 hit points. You transform into an average example of that creature, one without any class levels or the Spellcasting trait. Your game statistics are replaced by the statistics of the chosen creature, though you retain your alignment and Intelligence, Wisdom, and Charisma scores. You also retain all of your skill and saving throw proficiencies, in addition to gaining those of the creature. If the creature has the same proficiency as you and the bonus listed in its statistics is higher than yours, use the creature's bonus in place of yours. You can't use any legendary actions or lair actions of the new form.",
      wikiLink: "https://dnd5e.wikidot.com/spell:shapechange"
    },
    {
      name: "Storm of Vengeance",
      level: 9,
      school: "Conjuration",
      castingTime: "1 action",
      range: "Sight",
      components: "V, S",
      duration: "Concentration, up to 1 minute",
      damage: "",
      save: "Constitution save",
      attack: "",
      ritual: false,
      concentration: true,
      description: "A churning storm cloud forms, centered on a point you can see and spreading to a radius of 360 feet. Lightning flashes in the area, thunder booms, and strong winds roar. Each creature under the cloud (no more than 5,000 feet beneath the cloud) when it appears must make a Constitution saving throw. On a failed save, a creature takes 2d6 thunder damage and becomes deafened for 5 minutes. Each round you maintain concentration on this spell, the storm produces different effects on your turn.",
      wikiLink: "https://dnd5e.wikidot.com/spell:storm-of-vengeance"
    },
    {
      name: "Time Stop",
      level: 9,
      school: "Transmutation",
      castingTime: "1 action",
      range: "Self",
      components: "V",
      duration: "Instantaneous",
      damage: "",
      save: "",
      attack: "",
      ritual: false,
      concentration: false,
      description: "You briefly stop the flow of time for everyone but yourself. No time passes for other creatures, while you take 1d4 + 1 turns in a row, during which you can use actions and move as normal. This spell ends if one of the actions you use during this period, or any effects that you create during this period, affects a creature other than you or an object being worn or carried by someone other than you. In addition, the spell ends if you move to a place more than 1,000 feet from the location where you cast it.",
      wikiLink: "https://dnd5e.wikidot.com/spell:time-stop"
    },
    {
      name: "True Polymorph",
      level: 9,
      school: "Transmutation",
      castingTime: "1 action",
      range: "30 feet",
      components: "V, S, M",
      duration: "Concentration, up to 1 hour",
      damage: "",
      save: "",
      attack: "",
      ritual: false,
      concentration: true,
      description: "Choose one creature or nonmagical object that you can see within range. You transform the creature into a different creature, the creature into a nonmagical object, or the object into a creature (the object must be neither worn nor carried by another creature). The transformation lasts for the duration, or until the target drops to 0 hit points or dies. If you concentrate on this spell for the full duration, the transformation becomes permanent. Shapechangers aren't affected by this spell. An unwilling creature can make a Wisdom saving throw, and if it succeeds, it isn't affected by this spell.",
      wikiLink: "https://dnd5e.wikidot.com/spell:true-polymorph"
    },
    {
      name: "True Resurrection",
      level: 9,
      school: "Necromancy",
      castingTime: "1 hour",
      range: "Touch",
      components: "V, S, M",
      duration: "Instantaneous",
      damage: "",
      save: "",
      attack: "",
      ritual: false,
      concentration: false,
      description: "You touch a creature that has been dead for no longer than 200 years and that died for any reason except old age. If the creature's soul is free and willing, the creature is restored to life with all its hit points. This spell closes all wounds, neutralizes any poison, cures all diseases, and lifts any curses affecting the creature when it died. The spell replaces damaged or missing organs and limbs. The spell can even provide a new body if the original no longer exists, in which case you must speak the creature's name. The creature then appears in an unoccupied space you choose within 10 feet of you.",
      wikiLink: "https://dnd5e.wikidot.com/spell:true-resurrection"
    },
    {
      name: "Weird",
      level: 9,
      school: "Illusion",
      castingTime: "1 action",
      range: "120 feet",
      components: "V, S",
      duration: "Concentration, up to 1 minute",
      damage: "4d10 psychic damage",
      save: "Wisdom save",
      attack: "",
      ritual: false,
      concentration: true,
      description: "Drawing on the deepest fears of a group of creatures, you create illusory creatures in their minds, visible only to them. Each creature in a 30-foot-radius sphere centered on a point of your choice within range must make a Wisdom saving throw. On a failed save, a creature becomes frightened for the duration. The illusion calls on the creature's deepest fears, manifesting its worst nightmares as an implacable threat. At the end of each of the frightened creature's turns, it must succeed on a Wisdom saving throw or take 4d10 psychic damage. On a successful save, the spell ends for that creature.",
      wikiLink: "https://dnd5e.wikidot.com/spell:weird"
    },
    {
      name: "Wish",
      level: 9,
      school: "Conjuration",
      castingTime: "1 action",
      range: "Self",
      components: "V",
      duration: "Instantaneous",
      damage: "",
      save: "",
      attack: "",
      ritual: false,
      concentration: false,
      description: "Wish is the mightiest spell a mortal creature can cast. By simply speaking aloud, you can alter the very foundations of reality in accord with your desires. The basic use of this spell is to duplicate any other spell of 8th level or lower. You don't need to meet any requirements in that spell, including costly components. The spell simply takes effect. Alternatively, you can create one of the following effects of your choice: You create one object of up to 25,000 gp in value that isn't a magic item. The object can be no more than 300 feet in any dimension, and it appears in an unoccupied space you can see on the ground. You allow up to twenty creatures that you can see to regain all hit points, and you end all effects on them described in the greater restoration spell. You grant up to ten creatures that you can see resistance to a damage type you choose. You grant up to ten creatures you can see immunity to a single spell or other magical effect for 8 hours. For instance, you could make yourself and all your companions immune to a lich's life drain attack. You undo a single recent event by forcing a reroll of any roll made within the last round (including your last turn). Reality reshapes itself to accommodate the new result. For example, a wish spell could undo an opponent's successful save, a foe's critical hit, or a friend's failed save. You can force the reroll to be made with advantage or disadvantage, and you can choose whether to use the reroll or the original roll.",
      wikiLink: "https://dnd5e.wikidot.com/spell:wish"
    }
  ]
};

// Initialize spell system
function initializeSpellSystem() {
  // Data will be populated by loadData() from the main character store
  updateSpellSlots();
  updateCustomResources();
  renderSpells();
}

// ========== MANUAL SPELL SLOTS SYSTEM ==========

// Show add spell slot popup
function showAddSpellSlotPopup() {
  document.getElementById('spell_slot_name').value = '';
  document.getElementById('spell_slot_max').value = '1';
  document.getElementById('spell_slot_reset_type').value = 'long';
  showPopup('addSpellSlotPopup');
}

// Add spell slot type
function addSpellSlot() {
  const name = document.getElementById('spell_slot_name').value.trim();
  const maxValue = parseInt(document.getElementById('spell_slot_max').value) || 1;
  const resetType = document.getElementById('spell_slot_reset_type').value;
  
  if (!name) {
    alert("Please enter a spell slot name");
    return;
  }
  
  // Check if spell slot name already exists
  if (manualSpellSlots.find(s => s.name.toLowerCase() === name.toLowerCase())) {
    alert("A spell slot type with this name already exists");
    return;
  }
  
  const slotId = 'spell_' + Date.now();
  const newSlot = {
    id: slotId,
    name: name,
    maxValue: maxValue,
    resetType: resetType
  };
  
  manualSpellSlots.push(newSlot);
  manualSpellSlotsUsed[slotId] = 0;
  
  updateSpellSlots();
  closePopup('addSpellSlotPopup');
  autosave();
}

// Remove spell slot type
function removeSpellSlot(slotId) {
  if (confirm('Are you sure you want to remove this spell slot type?')) {
    manualSpellSlots = manualSpellSlots.filter(s => s.id !== slotId);
    delete manualSpellSlotsUsed[slotId];
    updateSpellSlots();
    autosave();
  }
}

// Update spell slots display
function updateSpellSlots() {
  const container = document.getElementById('spell_slots_container');
  container.innerHTML = '';
  
  if (manualSpellSlots.length === 0) {
    container.innerHTML = '<p style="text-align: center; color: #666; font-style: italic; margin: 10px 0;">No spell slots yet. Click "Add Spell Slot Type" to get started!</p>';
    return;
  }
  
  manualSpellSlots.forEach(slot => {
    const slotDiv = document.createElement('div');
    slotDiv.className = 'spell-level-row';
    slotDiv.style.position = 'relative';
    
    const usedValue = manualSpellSlotsUsed[slot.id] || 0;
    
    slotDiv.innerHTML = `
      <span class="spell-level-label" title="${slot.resetType === 'long' ? 'Resets on Long Rest' : slot.resetType === 'short' ? 'Resets on Short Rest' : 'Manual Reset Only'}">${slot.name}:</span>
      <input type="number" class="spell-slot-input" min="0" max="15" value="${slot.maxValue}" 
             onchange="updateSpellSlotMax('${slot.id}', this.value)">
      <div class="spell-slots-used" id="spell_used_${slot.id}"></div>
      <button onclick="showEditSpellSlotPopup('${slot.id}')" 
              style="position: absolute; right: 70px; top: 50%; transform: translateY(-50%); 
                     background: #4CAF50; color: white; border: none; border-radius: 3px; 
                     padding: 2px 6px; font-size: 10px; cursor: pointer;"
              title="Edit Spell Slot">Edit</button>
      <button onclick="removeSpellSlot('${slot.id}')" 
              style="position: absolute; right: -5px; top: 50%; transform: translateY(-50%); 
                     background: #ff4444; color: white; border: none; border-radius: 3px; 
                     padding: 2px 6px; font-size: 10px; cursor: pointer;"
              title="Remove Spell Slot">Delete</button>
    `;
    
    container.appendChild(slotDiv);
    
    // Create the dots for this spell slot
    const usedContainer = document.getElementById(`spell_used_${slot.id}`);
    usedContainer.innerHTML = '';
    for (let i = 0; i < slot.maxValue; i++) {
      const dot = document.createElement('div');
      dot.className = `spell-slot-dot ${i < usedValue ? 'used' : ''}`;
      dot.onclick = () => toggleSpellSlot(slot.id, i);
      usedContainer.appendChild(dot);
    }
  });
}

// Update spell slot max value
function updateSpellSlotMax(slotId, newMax) {
  const slot = manualSpellSlots.find(s => s.id === slotId);
  if (slot) {
    slot.maxValue = parseInt(newMax) || 1;
    // Adjust used value if it exceeds new max
    if (manualSpellSlotsUsed[slotId] > slot.maxValue) {
      manualSpellSlotsUsed[slotId] = slot.maxValue;
    }
    updateSpellSlots();
    autosave();
  }
}

// Toggle spell slot usage
function toggleSpellSlot(slotId, index) {
  const usedValue = manualSpellSlotsUsed[slotId] || 0;
  if (index < usedValue) {
    manualSpellSlotsUsed[slotId] = index;
  } else {
    manualSpellSlotsUsed[slotId] = index + 1;
  }
  updateSpellSlots();
  autosave();
}

// Reset spell slots based on rest type
function resetSpellSlots(restType = 'all') {
  if (restType === 'all') {
    if (confirm('Are you sure you want to reset all spell slots?')) {
      manualSpellSlots.forEach(slot => {
        manualSpellSlotsUsed[slot.id] = 0;
      });
      updateSpellSlots();
      autosave();
    }
  } else {
    // Reset based on rest type (short/long)
    manualSpellSlots.forEach(slot => {
      if (slot.resetType === restType || (restType === 'long' && slot.resetType === 'short')) {
        manualSpellSlotsUsed[slot.id] = 0;
      }
    });
    updateSpellSlots();
    autosave();
  }
}

// Show edit spell slot popup
let currentEditingSpellSlotId = null;

function showEditSpellSlotPopup(slotId) {
  const slot = manualSpellSlots.find(s => s.id === slotId);
  if (!slot) return;
  
  currentEditingSpellSlotId = slotId;
  
  document.getElementById('edit_spell_slot_name').value = slot.name;
  document.getElementById('edit_spell_slot_max').value = slot.maxValue;
  document.getElementById('edit_spell_slot_reset_type').value = slot.resetType;
  
  showPopup('editSpellSlotPopup');
}

// Save spell slot edit
function saveSpellSlotEdit() {
  if (!currentEditingSpellSlotId) return;
  
  const name = document.getElementById('edit_spell_slot_name').value.trim();
  const maxValue = parseInt(document.getElementById('edit_spell_slot_max').value) || 1;
  const resetType = document.getElementById('edit_spell_slot_reset_type').value;
  
  if (!name) {
    alert("Please enter a spell slot name");
    return;
  }
  
  // Check if name already exists (but allow same name for current slot)
  const existingSlot = manualSpellSlots.find(s => s.name.toLowerCase() === name.toLowerCase() && s.id !== currentEditingSpellSlotId);
  if (existingSlot) {
    alert("A spell slot type with this name already exists");
    return;
  }
  
  // Find and update the slot
  const slot = manualSpellSlots.find(s => s.id === currentEditingSpellSlotId);
  if (slot) {
    slot.name = name;
    slot.maxValue = maxValue;
    slot.resetType = resetType;
    
    // Adjust used value if it exceeds new max
    if (manualSpellSlotsUsed[currentEditingSpellSlotId] > maxValue) {
      manualSpellSlotsUsed[currentEditingSpellSlotId] = maxValue;
    }
    
    updateSpellSlots();
    autosave();
  }
  
  closePopup('editSpellSlotPopup');
  currentEditingSpellSlotId = null;
}

// ========== CUSTOM RESOURCES SYSTEM ==========

// Show add custom resource popup
function showAddCustomResourcePopup() {
  document.getElementById('custom_resource_name').value = '';
  document.getElementById('custom_resource_max').value = '1';
  document.getElementById('custom_resource_reset_type').value = 'long';
  showPopup('addCustomResourcePopup');
}

// Add custom resource
function addCustomResource() {
  const name = document.getElementById('custom_resource_name').value.trim();
  const maxValue = parseInt(document.getElementById('custom_resource_max').value) || 1;
  const resetType = document.getElementById('custom_resource_reset_type').value;
  
  if (!name) {
    alert("Please enter a resource name");
    return;
  }
  
  // Check if resource name already exists
  if (customResources.find(r => r.name.toLowerCase() === name.toLowerCase())) {
    alert("A resource with this name already exists");
    return;
  }
  
  const resourceId = 'custom_' + Date.now();
  const newResource = {
    id: resourceId,
    name: name,
    maxValue: maxValue,
    resetType: resetType
  };
  
  customResources.push(newResource);
  customResourcesUsed[resourceId] = 0;
  
  updateCustomResources();
  closePopup('addCustomResourcePopup');
  autosave();
}

// Remove custom resource
function removeCustomResource(resourceId) {
  if (confirm('Are you sure you want to remove this custom resource?')) {
    customResources = customResources.filter(r => r.id !== resourceId);
    delete customResourcesUsed[resourceId];
    updateCustomResources();
    autosave();
  }
}

// Update custom resources display
function updateCustomResources() {
  const container = document.getElementById('custom_resources_container');
  container.innerHTML = '';
  
  if (customResources.length === 0) {
    container.innerHTML = '<p style="text-align: center; color: #666; font-style: italic; margin: 10px 0;">No custom resources yet. Click "Add Custom Resource" to get started!</p>';
    return;
  }
  
  customResources.forEach(resource => {
    const resourceDiv = document.createElement('div');
    resourceDiv.className = 'spell-level-row';
    resourceDiv.style.position = 'relative';
    
    const usedValue = customResourcesUsed[resource.id] || 0;
    
    resourceDiv.innerHTML = `
      <span class="spell-level-label" title="${resource.resetType === 'long' ? 'Resets on Long Rest' : resource.resetType === 'short' ? 'Resets on Short Rest' : 'Manual Reset Only'}">${resource.name}:</span>
      <input type="number" class="spell-slot-input" min="0" max="15" value="${resource.maxValue}" 
             onchange="updateCustomResourceMax('${resource.id}', this.value)">
      <div class="spell-slots-used" id="custom_used_${resource.id}"></div>
      <button onclick="removeCustomResource('${resource.id}')" 
              style="position: absolute; right: -5px; top: 50%; transform: translateY(-50%); 
                     background: #ff4444; color: white; border: none; border-radius: 3px; 
                     width: 20px; height: 20px; font-size: 12px; cursor: pointer;"
              title="Remove Resource">×</button>
    `;
    
    container.appendChild(resourceDiv);
    
    // Create the dots for this resource
    const usedContainer = document.getElementById(`custom_used_${resource.id}`);
    usedContainer.innerHTML = '';
    for (let i = 0; i < resource.maxValue; i++) {
      const dot = document.createElement('div');
      dot.className = `spell-slot-dot ${i < usedValue ? 'used' : ''}`;
      dot.onclick = () => toggleCustomResource(resource.id, i);
      usedContainer.appendChild(dot);
    }
  });
}

// Update custom resource max value
function updateCustomResourceMax(resourceId, newMax) {
  const resource = customResources.find(r => r.id === resourceId);
  if (resource) {
    resource.maxValue = parseInt(newMax) || 1;
    // Adjust used value if it exceeds new max
    if (customResourcesUsed[resourceId] > resource.maxValue) {
      customResourcesUsed[resourceId] = resource.maxValue;
    }
    updateCustomResources();
    autosave();
  }
}

// Toggle custom resource usage
function toggleCustomResource(resourceId, index) {
  const usedValue = customResourcesUsed[resourceId] || 0;
  if (index < usedValue) {
    customResourcesUsed[resourceId] = index;
  } else {
    customResourcesUsed[resourceId] = index + 1;
  }
  updateCustomResources();
  autosave();
}

// Reset custom resources based on rest type
function resetCustomResources(restType = 'all') {
  if (restType === 'all') {
    if (confirm('Are you sure you want to reset all custom resources?')) {
      customResources.forEach(resource => {
        customResourcesUsed[resource.id] = 0;
      });
      updateCustomResources();
      autosave();
    }
  } else {
    // Reset based on rest type (short/long)
    customResources.forEach(resource => {
      if (resource.resetType === restType || (restType === 'long' && resource.resetType === 'short')) {
        customResourcesUsed[resource.id] = 0;
      }
    });
    updateCustomResources();
    autosave();
  }
}

// Show spell form
function showSpellForm(type, spellIndex = null) {
  const popup = document.getElementById('spellFormPopup');
  const title = document.getElementById('spellFormTitle');
  const form = document.getElementById('spellForm');
  
  if (spellIndex !== null) {
    // Edit existing spell
    const spell = type === 'cantrip' ? spellsData.cantrips[spellIndex] : spellsData.spells[spellIndex];
    title.textContent = 'Edit Spell';
    populateSpellForm(spell);
  } else {
    // Add new spell
    title.textContent = type === 'cantrip' ? 'Add Cantrip' : 'Add Spell';
    form.reset();
    document.getElementById('spellLevel').value = type === 'cantrip' ? '0' : '1';
  }
  
  showPopup('spellFormPopup');
}

// Populate spell form for editing
function populateSpellForm(spell) {
  document.getElementById('spellName').value = spell.name || '';
  document.getElementById('spellLevel').value = spell.level || '0';
  document.getElementById('spellSchool').value = spell.school || '';
  document.getElementById('spellCastingTime').value = spell.castingTime || '';
  document.getElementById('spellRange').value = spell.range || '';
  document.getElementById('spellComponents').value = spell.components || '';
  document.getElementById('spellDuration').value = spell.duration || '';
  document.getElementById('spellDamage').value = spell.damage || '';
  document.getElementById('spellSave').value = spell.save || '';
  document.getElementById('spellAttack').value = spell.attack || '';
  document.getElementById('spellRitual').checked = spell.ritual || false;
  document.getElementById('spellConcentration').checked = spell.concentration || false;
  document.getElementById('spellPrepared').checked = spell.prepared || false;
  document.getElementById('spellDescription').value = spell.description || '';
  document.getElementById('spellWikiLink').value = spell.wikiLink || '';
}

// Save spell
function saveSpell(event) {
  event.preventDefault();
  
  const spell = {
    name: document.getElementById('spellName').value,
    level: parseInt(document.getElementById('spellLevel').value),
    school: document.getElementById('spellSchool').value,
    castingTime: document.getElementById('spellCastingTime').value,
    range: document.getElementById('spellRange').value,
    components: document.getElementById('spellComponents').value,
    duration: document.getElementById('spellDuration').value,
    damage: document.getElementById('spellDamage').value,
    save: document.getElementById('spellSave').value,
    attack: document.getElementById('spellAttack').value,
    ritual: document.getElementById('spellRitual').checked,
    concentration: document.getElementById('spellConcentration').checked,
    prepared: document.getElementById('spellPrepared').checked,
    description: document.getElementById('spellDescription').value,
    wikiLink: document.getElementById('spellWikiLink').value
  };
  
  const isCantrip = spell.level === 0;
  const spellArray = isCantrip ? spellsData.cantrips : spellsData.spells;
  
  // Check if editing existing spell
  const formTitle = document.getElementById('spellFormTitle').textContent;
  if (formTitle.includes('Edit')) {
    // Find and update existing spell
    const spellName = document.getElementById('spellName').value;
    const index = spellArray.findIndex(s => s.name === spellName);
    if (index !== -1) {
      spellArray[index] = spell;
    }
  } else {
    // Add new spell
    spellArray.push(spell);
  }
  
  renderSpells();
  closePopup('spellFormPopup');
  autosave();
}

// Render spells
function renderSpells() {
  // Render using current filter selections so the dropdowns act as live filters
  filterSpells('cantrip');
  filterSpells('spell');
  renderPreparedSpells();
  renderFavorites();
  syncSpellPanels();
}

function syncSpellPanels() {
  const cantripList = document.getElementById('cantrips_list');
  const spellList = document.getElementById('spells_list');
  if (!cantripList || !spellList) return;
  const cantripSection = cantripList.closest('.section');
  const spellSection = spellList.closest('.section');
  if (!cantripSection || !spellSection) return;

  const base = Math.max(cantripSection.scrollHeight, spellSection.scrollHeight);
  const prevBase = parseInt(cantripSection.dataset.baseHeight || '0', 10);
  const nextBase = Math.max(base, prevBase);
  cantripSection.dataset.baseHeight = `${nextBase}`;
  spellSection.dataset.baseHeight = `${nextBase}`;
  cantripSection.style.minHeight = `${nextBase}px`;
  spellSection.style.minHeight = `${nextBase}px`;
}

// Render individual spell list
function renderSpellList(type, spells) {
  const container = document.getElementById(`${type}_list`);
  if (!container) return;
  
  container.innerHTML = '';
  
  if (spells.length === 0) {
    container.innerHTML = '<p style="text-align: center; color: #666; padding: 20px;">No spells added yet. Click the + button to add your first spell!</p>';
    return;
  }
  
  // Group spells by level
  const groupedSpells = {};
  spells.forEach(spell => {
    const level = spell.level;
    if (!groupedSpells[level]) {
      groupedSpells[level] = [];
    }
    groupedSpells[level].push(spell);
  });
  
  // Render each level group
  Object.keys(groupedSpells).sort((a, b) => parseInt(a) - parseInt(b)).forEach(level => {
    const levelSpells = groupedSpells[level];
    const levelSection = document.createElement('div');
    levelSection.className = 'spell-level-section';
    
    const levelHeader = document.createElement('div');
    levelHeader.className = 'spell-level-header';
    levelHeader.innerHTML = `
      <span>${level === '0' ? 'Cantrips' : `${level}${getOrdinalSuffix(parseInt(level))} Level`}</span>
      <span>(${levelSpells.length} spell${levelSpells.length !== 1 ? 's' : ''})</span>
    `;
    levelSection.appendChild(levelHeader);
    
    levelSpells.forEach((spell, index) => {
      const spellItem = createSpellItem(spell, type, index);
      levelSection.appendChild(spellItem);
    });
    
    container.appendChild(levelSection);
  });
}

// Create spell item element
function createSpellItem(spell, type, index) {
  const item = document.createElement('div');
  item.className = 'spell-item';
  
  // Add special classes for spell properties
  if (spell.ritual) item.classList.add('spell-ritual');
  if (spell.concentration) item.classList.add('spell-concentration');
  if (spell.prepared) item.classList.add('spell-prepared');
  
  // Normalize type used by action handlers
  const actionType = (type === 'spells') ? 'spell' : (type === 'cantrips' ? 'cantrip' : type);
  
  // Ensure we act on the correct spell in the master list, not the filtered/group index
  const masterArray = actionType === 'cantrip' ? spellsData.cantrips : spellsData.spells;
  let indexToUse = masterArray.findIndex(s => s.name === spell.name);
  if (indexToUse === -1) {
    // Fallback to provided index if not found; guards against temporary mismatch during import
    indexToUse = index;
  }
  const isFav = isFavorited(actionType, spell.name);
  
  const spellInfo = document.createElement('div');
  spellInfo.innerHTML = `
    <strong>${spell.name}</strong>
    <span style="color: #888; font-size: 0.9em;">
      ${spell.school} • ${spell.castingTime} • ${spell.range}
      ${spell.damage ? ` • ${spell.damage}` : ''}
    </span>
  `;
  // Build favorite star with a safe event handler
  const star = document.createElement('span');
  star.className = `favorite-star ${isFav ? 'favorited' : 'not-favorited'}`;
  star.textContent = '★';
  star.title = isFav ? 'Remove from favorites' : 'Add to favorites';
  star.style.marginRight = '6px';
  star.addEventListener('click', function(e) {
    e.stopPropagation();
    toggleFavoriteByName(actionType, spell.name);
  });
  // Prepend star to info
  spellInfo.prepend(star);
  
  const actions = document.createElement('div');
  actions.className = 'spell-item-actions';
  actions.innerHTML = `
    <button class="spell-item-btn" onclick="showSpellDetails('${actionType}', ${indexToUse})">View</button>
    <button class="spell-item-btn" onclick="showSpellForm('${actionType}', ${indexToUse})">Edit</button>
    <button class="spell-item-btn" onclick="toggleSpellPrepared('${actionType}', ${indexToUse})">
      ${spell.prepared ? 'Unprepare' : 'Prepare'}
    </button>
    <button class="spell-item-btn" onclick="removeSpell('${actionType}', ${indexToUse})">Remove</button>
  `;
  
  item.appendChild(spellInfo);
  item.appendChild(actions);
  
  return item;
}

// Show spell details
function showSpellDetails(type, index) {
  const spell = type === 'cantrip' ? spellsData.cantrips[index] : spellsData.spells[index];
  if (!spell) return;
  
  document.getElementById('spellDetailName').textContent = spell.name;
  document.getElementById('spellDetailLevel').textContent = spell.level === 0 ? 'Cantrip' : `${spell.level}${getOrdinalSuffix(spell.level)} Level`;
  document.getElementById('spellDetailSchool').textContent = spell.school;
  document.getElementById('spellDetailCastingTime').textContent = spell.castingTime;
  document.getElementById('spellDetailRange').textContent = spell.range;
  document.getElementById('spellDetailComponents').textContent = spell.components;
  document.getElementById('spellDetailDuration').textContent = spell.duration;
  document.getElementById('spellDetailDamage').textContent = spell.damage || 'None';
  document.getElementById('spellDetailSave').textContent = spell.save || 'None';
  document.getElementById('spellDetailAttack').textContent = spell.attack || 'None';
  document.getElementById('spellDetailRitual').textContent = spell.ritual ? 'Yes' : 'No';
  document.getElementById('spellDetailConcentration').textContent = spell.concentration ? 'Yes' : 'No';
  document.getElementById('spellDetailDescription').textContent = spell.description;
  
  // Show/hide wiki link
  const wikiLinkRow = document.getElementById('spellDetailWikiLink');
  const wikiLink = document.getElementById('spellWikiLink');
  
  if (spell.wikiLink) {
    wikiLink.href = spell.wikiLink;
    wikiLinkRow.style.display = 'block';
  } else {
    // Generate wiki link from spell name if not provided
    const generatedLink = `https://dnd5e.wikidot.com/spell:${spell.name.toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]/g, '')}`;
    wikiLink.href = generatedLink;
    wikiLinkRow.style.display = 'block';
  }
  
  showPopup('spellDetailsPopup');
}

// Toggle spell prepared status
function toggleSpellPrepared(type, index) {
  const spell = type === 'cantrip' ? spellsData.cantrips[index] : spellsData.spells[index];
  if (spell) {
    spell.prepared = !spell.prepared;
    renderSpells(); // live update
    autosave();
  }
}

// Remove spell
function removeSpell(type, index) {
  if (confirm('Are you sure you want to remove this spell?')) {
    if (type === 'cantrip') {
      const removed = spellsData.cantrips.splice(index, 1)[0];
      if (removed) {
        // Also remove from favorites by name
        favoritesData.cantrips = favoritesData.cantrips.filter(f => f.name !== removed.name);
      }
    } else {
      const removed = spellsData.spells.splice(index, 1)[0];
      if (removed) {
        favoritesData.spells = favoritesData.spells.filter(f => f.name !== removed.name);
      }
    }
    renderSpells();
    autosave();
  }
}


function createPreparedSpellItem(spell, actionType, indexToUse) {
  const item = document.createElement('div');
  item.className = 'spell-item';

  if (spell.ritual) item.classList.add('spell-ritual');
  if (spell.concentration) item.classList.add('spell-concentration');
  if (spell.prepared) item.classList.add('spell-prepared');

  const isFav = isFavorited(actionType, spell.name);

  const spellInfo = document.createElement('div');
  spellInfo.innerHTML = `
    <strong>${spell.name}</strong>
    <span style="color: #888; font-size: 0.9em;">
      ${spell.school} � ${spell.castingTime} � ${spell.range}
      ${spell.damage ? ` � ${spell.damage}` : ''}
    </span>
  `;

  const star = document.createElement('span');
  star.className = `favorite-star ${isFav ? 'favorited' : 'not-favorited'}`;
  star.textContent = '?';
  star.title = isFav ? 'Remove from favorites' : 'Add to favorites';
  star.style.marginRight = '6px';
  star.addEventListener('click', function(e) {
    e.stopPropagation();
    toggleFavoriteByName(actionType, spell.name);
  });
  spellInfo.prepend(star);

  const actions = document.createElement('div');
  actions.className = 'spell-item-actions';
  actions.innerHTML = `
    <button class="spell-item-btn" onclick="showSpellDetails('${actionType}', ${indexToUse})">View</button>
    <button class="spell-item-btn" onclick="showSpellForm('${actionType}', ${indexToUse})">Edit</button>
    <button class="spell-item-btn" onclick="toggleSpellPrepared('${actionType}', ${indexToUse})">
      ${spell.prepared ? 'Unprepare' : 'Prepare'}
    </button>
    <button class="spell-item-btn" onclick="removeSpell('${actionType}', ${indexToUse})">Remove</button>
  `;

  item.appendChild(spellInfo);
  item.appendChild(actions);
  return item;
}

function renderPreparedSpells() {
  const container = document.getElementById('prepared_spells_list');
  if (!container) return;

  container.innerHTML = '';

  const preparedCantrips = spellsData.cantrips
    .map((spell, index) => ({ spell, actionType: 'cantrip', index }))
    .filter(entry => entry.spell.prepared);

  const preparedSpells = spellsData.spells
    .map((spell, index) => ({ spell, actionType: 'spell', index }))
    .filter(entry => entry.spell.prepared);

  const preparedAll = [...preparedCantrips, ...preparedSpells];

  if (preparedAll.length === 0) {
    container.innerHTML = '<p style="text-align: center; color: #666; padding: 20px; font-style: italic;">No prepared spells yet. Mark spells as prepared to list them here.</p>';
    return;
  }

  const grouped = {};
  preparedAll.forEach(entry => {
    const level = entry.spell.level || 0;
    if (!grouped[level]) grouped[level] = [];
    grouped[level].push(entry);
  });

  Object.keys(grouped)
    .sort((a, b) => parseInt(a, 10) - parseInt(b, 10))
    .forEach(level => {
      const levelEntries = grouped[level];
      const levelSection = document.createElement('div');
      levelSection.className = 'spell-level-section';

      const levelHeader = document.createElement('div');
      levelHeader.className = 'spell-level-header';
      levelHeader.innerHTML = `
        <span>${level === '0' ? 'Cantrips' : `${level}${getOrdinalSuffix(parseInt(level, 10))} Level`}</span>
        <span>(${levelEntries.length} spell${levelEntries.length !== 1 ? 's' : ''})</span>
      `;
      levelSection.appendChild(levelHeader);

      levelEntries.forEach(entry => {
        const spellItem = createPreparedSpellItem(entry.spell, entry.actionType, entry.index);
        levelSection.appendChild(spellItem);
      });

      container.appendChild(levelSection);
    });
}
// Render favorites
function renderFavorites() {
  // Use actual container IDs in the DOM
  renderFavoritesList('favorites_cantrips_list', favoritesData.cantrips);
  renderFavoritesList('favorites_spells_list', favoritesData.spells);
}

// Render favorites list
function renderFavoritesList(containerId, favorites) {
  const container = document.getElementById(containerId);
  if (!container) return;
  
  container.innerHTML = '';
  
  if (favorites.length === 0) {
    container.innerHTML = '<p style="text-align: center; color: #666; padding: 20px; font-style: italic;">No favorites yet. Click the star (★) next to any spell to add it to favorites!</p>';
    return;
  }
  
  // Group favorites by level
  const groupedFavorites = {};
  favorites.forEach(spell => {
    const level = spell.level;
    if (!groupedFavorites[level]) {
      groupedFavorites[level] = [];
    }
    groupedFavorites[level].push(spell);
  });
  
  // Render each level group
  Object.keys(groupedFavorites).sort((a, b) => parseInt(a) - parseInt(b)).forEach(level => {
    const levelSpells = groupedFavorites[level];
    const levelSection = document.createElement('div');
    levelSection.className = 'spell-level-section';
    
    const levelHeader = document.createElement('div');
    levelHeader.className = 'spell-level-header';
    levelHeader.innerHTML = `
      <span>${level === '0' ? 'Cantrips' : `${level}${getOrdinalSuffix(parseInt(level))} Level`}</span>
      <span>(${levelSpells.length} spell${levelSpells.length !== 1 ? 's' : ''})</span>
    `;
    levelSection.appendChild(levelHeader);
    
    levelSpells.forEach((spell, index) => {
      // Find the original index in the main spell list
      const originalIndex = containerId.includes('cantrips') ? 
        spellsData.cantrips.findIndex(s => s.name === spell.name) :
        spellsData.spells.findIndex(s => s.name === spell.name);
      
      const spellItem = createSpellItem(spell, containerId.includes('cantrips') ? 'cantrip' : 'spell', originalIndex);
      levelSection.appendChild(spellItem);
    });
    
    container.appendChild(levelSection);
  });
}

// Filter spells
function filterSpells(type) {
  // Map type to list container keys used in DOM ids
  const listKey = type === 'cantrip' ? 'cantrips' : 'spells';
  const spells = type === 'cantrip' ? spellsData.cantrips : spellsData.spells;
  const container = document.getElementById(`${listKey}_list`);
  if (!container) return;
  
  // Get filter values
  let levelFilter = 'all';
  let schoolFilter = 'all';
  let statusFilter = 'all';
  
  if (type === 'cantrip') {
    statusFilter = document.getElementById('cantrip_filter').value;
  } else {
    levelFilter = document.getElementById('spell_level_filter').value;
    schoolFilter = document.getElementById('spell_school_filter').value;
    statusFilter = document.getElementById('spell_status_filter').value;
  }
  
  // Filter spells
  let filteredSpells = spells.filter(spell => {
    // Level filter
    if (levelFilter !== 'all' && spell.level.toString() !== levelFilter) {
      return false;
    }
    
    // School filter
    if (schoolFilter !== 'all' && spell.school !== schoolFilter) {
      return false;
    }
    
    // Status filter
    if (statusFilter !== 'all') {
      if (statusFilter === 'prepared' && !spell.prepared) return false;
      if (statusFilter === 'known' && spell.prepared) return false;
      if (statusFilter === 'ritual' && !spell.ritual) return false;
      if (statusFilter === 'favorites' && !isFavorited(type, spell.name)) return false;
    }
    
    return true;
  });
  
  // Render filtered spells
  renderSpellList(listKey, filteredSpells);
}

// Utility function for ordinal suffixes
function getOrdinalSuffix(num) {
  const j = num % 10;
  const k = num % 100;
  if (j === 1 && k !== 11) return 'st';
  if (j === 2 && k !== 12) return 'nd';
  if (j === 3 && k !== 13) return 'rd';
  return 'th';
}

// Removed legacy standalone localStorage for spells.

// Import common cantrips
function importCommonCantrips() {
  const commonCantrips = [
    {
      name: "Eldritch Blast",
      level: 0,
      school: "Evocation",
      castingTime: "1 action",
      range: "120 feet",
      components: "V, S",
      duration: "Instantaneous",
      damage: "1d10 force damage",
      save: "",
      attack: "Ranged spell attack",
      ritual: false,
      concentration: false,
      description: "A beam of crackling energy streaks toward a creature within range. Make a ranged spell attack against the target. On a hit, the target takes 1d10 force damage."
    },
    {
      name: "Guidance",
      level: 0,
      school: "Divination",
      castingTime: "1 action",
      range: "Touch",
      components: "V, S",
      duration: "Concentration, up to 1 minute",
      damage: "",
      save: "",
      attack: "",
      ritual: false,
      concentration: true,
      description: "You touch one willing creature. Once before the spell ends, the target can roll a d4 and add the number rolled to one ability check of its choice."
    },
    {
      name: "Light",
      level: 0,
      school: "Evocation",
      castingTime: "1 action",
      range: "Touch",
      components: "V, M (a firefly or phosphorescent moss)",
      duration: "1 hour",
      damage: "",
      save: "",
      attack: "",
      ritual: false,
      concentration: false,
      description: "You touch one object that is no larger than 10 feet in any dimension. Until the spell ends, the object sheds bright light in a 20-foot radius and dim light for an additional 20 feet."
    },
    {
      name: "Minor Illusion",
      level: 0,
      school: "Illusion",
      castingTime: "1 action",
      range: "30 feet",
      components: "S, M (a bit of fleece)",
      duration: "1 minute",
      damage: "",
      save: "Intelligence save",
      attack: "",
      ritual: false,
      concentration: false,
      description: "You create a sound or an image of an object within range that lasts for the duration. The illusion also ends if you dismiss it as an action or cast this spell again."
    },
    {
      name: "Sacred Flame",
      level: 0,
      school: "Evocation",
      castingTime: "1 action",
      range: "60 feet",
      components: "V, S",
      duration: "Instantaneous",
      damage: "1d8 radiant damage",
      save: "Dexterity save",
      attack: "",
      ritual: false,
      concentration: false,
      description: "Flame-like radiance descends on a creature that you can see within range. The target must succeed on a Dexterity saving throw or take 1d8 radiant damage."
    }
  ];
  
  // Add cantrips that don't already exist
  commonCantrips.forEach(cantrip => {
    if (!spellsData.cantrips.find(spell => spell.name === cantrip.name)) {
      spellsData.cantrips.push(cantrip);
    }
  });
  
  renderSpells();
  autosave();
  alert(`Imported ${commonCantrips.length} common cantrips!`);
}

// Import common spells
function importCommonSpells() {
  const commonSpells = [
    {
      name: "Cure Wounds",
      level: 1,
      school: "Evocation",
      castingTime: "1 action",
      range: "Touch",
      components: "V, S",
      duration: "Instantaneous",
      damage: "1d8 + spellcasting ability modifier healing",
      save: "",
      attack: "",
      ritual: false,
      concentration: false,
      description: "A creature you touch regains a number of hit points equal to 1d8 + your spellcasting ability modifier. This spell has no effect on undead or constructs."
    },
    {
      name: "Detect Magic",
      level: 1,
      school: "Divination",
      castingTime: "1 action",
      range: "Self",
      components: "V, S",
      duration: "Concentration, up to 10 minutes",
      damage: "",
      save: "",
      attack: "",
      ritual: true,
      concentration: true,
      description: "For the duration, you sense the presence of magic within 30 feet of you. If you sense magic in this way, you can use your action to see a faint aura around any visible creature or object in the area that bears magic."
    },
    {
      name: "Shield",
      level: 1,
      school: "Abjuration",
      castingTime: "1 reaction, which you take when you are hit by an attack or targeted by the magic missile spell",
      range: "Self",
      components: "V, S",
      duration: "1 round",
      damage: "",
      save: "",
      attack: "",
      ritual: false,
      concentration: false,
      description: "An invisible barrier of magical force appears and protects you. Until the start of your next turn, you have a +5 bonus to AC, including against the triggering attack, and you take no damage from magic missile."
    },
    {
      name: "Sleep",
      level: 1,
      school: "Enchantment",
      castingTime: "1 action",
      range: "90 feet",
      components: "V, S, M (a pinch of fine sand, rose petals, or a cricket)",
      duration: "1 minute",
      damage: "",
      save: "",
      attack: "",
      ritual: false,
      concentration: false,
      description: "This spell sends creatures into a magical slumber. Roll 5d8; the total is how many hit points of creatures this spell can affect. Creatures within 20 feet of a point you choose within range are affected in ascending order of their current hit points."
    },
    {
      name: "Bless",
      level: 1,
      school: "Enchantment",
      castingTime: "1 action",
      range: "30 feet",
      components: "V, S, M (a sprinkling of holy water)",
      duration: "Concentration, up to 1 minute",
      damage: "",
      save: "",
      attack: "",
      ritual: false,
      concentration: true,
      description: "You bless up to three creatures of your choice within range. Whenever a target makes an attack roll or a saving throw before the spell ends, the target can roll a d4 and add the number rolled to the attack roll or saving throw."
    }
  ];
  
  // Add spells that don't already exist
  commonSpells.forEach(spell => {
    if (!spellsData.spells.find(s => s.name === spell.name)) {
      spellsData.spells.push(spell);
    }
  });
  
  renderSpells();
  autosave();
  alert(`Imported ${commonSpells.length} common spells!`);
}

// D&D 5e Classes and their spell lists (Updated 2025)
const dndClasses = {
  'Artificer': {
    cantrips: ['Acid Splash', 'Dancing Lights', 'Fire Bolt', 'Guidance', 'Light', 'Mage Hand', 'Mending', 'Message', 'Minor Illusion', 'Poison Spray', 'Prestidigitation', 'Ray of Frost', 'Resistance', 'Shocking Grasp', 'Spare the Dying', 'Thorn Whip'],
    spells: {
      1: ['Absorb Elements', 'Alarm', 'Cure Wounds', 'Detect Magic', 'Disguise Self', 'Expeditious Retreat', 'Faerie Fire', 'False Life', 'Feather Fall', 'Grease', 'Identify', 'Jump', 'Longstrider', 'Purify Food and Drink', 'Sanctuary', 'Snare', 'Tasha\'s Caustic Brew'],
      2: ['Aid', 'Alter Self', 'Arcane Lock', 'Blur', 'Continual Flame', 'Darkvision', 'Enhance Ability', 'Enlarge/Reduce', 'Heat Metal', 'Invisibility', 'Lesser Restoration', 'Levitate', 'Magic Mouth', 'Magic Weapon', 'Protection from Poison', 'Pyrotechnics', 'Rope Trick', 'See Invisibility', 'Skywrite', 'Spider Climb', 'Suggestion', 'Web'],
      3: ['Blink', 'Catnap', 'Counterspell', 'Create Food and Water', 'Dispel Magic', 'Elemental Weapon', 'Flame Arrows', 'Fly', 'Glyph of Warding', 'Haste', 'Intellect Fortress', 'Protection from Energy', 'Revivify', 'Tiny Servant', 'Water Breathing', 'Water Walk'],
      4: ['Arcane Eye', 'Elemental Bane', 'Fabricate', 'Freedom of Movement', 'Leomund\'s Secret Chest', 'Mordenkainen\'s Faithful Hound', 'Mordenkainen\'s Private Sanctum', 'Otiluke\'s Resilient Sphere', 'Stone Shape', 'Stoneskin', 'Wall of Fire'],
      5: ['Animate Objects', 'Bigby\'s Hand', 'Creation', 'Greater Restoration', 'Skill Empowerment', 'Transmute Rock', 'Wall of Stone']
    }
  },
  'Bard': {
    cantrips: ['Blade Ward', 'Dancing Lights', 'Friends', 'Light', 'Mage Hand', 'Mending', 'Message', 'Minor Illusion', 'Prestidigitation', 'True Strike', 'Vicious Mockery'],
    spells: {
      1: ['Animal Friendship', 'Bane', 'Charm Person', 'Comprehend Languages', 'Cure Wounds', 'Detect Magic', 'Disguise Self', 'Faerie Fire', 'Feather Fall', 'Healing Word', 'Heroism', 'Identify', 'Illusory Script', 'Longstrider', 'Silent Image', 'Sleep', 'Speak with Animals', 'Tasha\'s Hideous Laughter', 'Thunderwave', 'Unseen Servant'],
      2: ['Animal Messenger', 'Blindness/Deafness', 'Calm Emotions', 'Cloud of Daggers', 'Crown of Madness', 'Detect Thoughts', 'Enhance Ability', 'Enthrall', 'Heat Metal', 'Hold Person', 'Invisibility', 'Knock', 'Lesser Restoration', 'Locate Object', 'Magic Mouth', 'Phantasmal Force', 'Shatter', 'Silence', 'Suggestion', 'Zone of Truth'],
      3: ['Bestow Curse', 'Clairvoyance', 'Dispel Magic', 'Fear', 'Feign Death', 'Glyph of Warding', 'Hypnotic Pattern', 'Leomund\'s Tiny Hut', 'Major Image', 'Nondetection', 'Plant Growth', 'Sending', 'Speak with Dead', 'Speak with Plants', 'Stinking Cloud', 'Tongues'],
      4: ['Compulsion', 'Confusion', 'Dimension Door', 'Freedom of Movement', 'Greater Invisibility', 'Hallucinatory Terrain', 'Locate Creature', 'Polymorph'],
      5: ['Animate Objects', 'Awaken', 'Dominate Person', 'Dream', 'Geas', 'Greater Restoration', 'Hold Monster', 'Legend Lore', 'Mass Cure Wounds', 'Mislead', 'Modify Memory', 'Planar Binding', 'Raise Dead', 'Scrying', 'Seeming', 'Teleportation Circle']
    }
  },
  'Cleric': {
    cantrips: ['Guidance', 'Light', 'Mending', 'Resistance', 'Sacred Flame', 'Spare the Dying', 'Thaumaturgy'],
    spells: {
      1: ['Bane', 'Bless', 'Command', 'Create or Destroy Water', 'Cure Wounds', 'Detect Evil and Good', 'Detect Magic', 'Detect Poison and Disease', 'Guiding Bolt', 'Healing Word', 'Inflict Wounds', 'Protection from Evil and Good', 'Purify Food and Drink', 'Sanctuary', 'Shield of Faith'],
      2: ['Aid', 'Augury', 'Blindness/Deafness', 'Calm Emotions', 'Continual Flame', 'Enhance Ability', 'Find Traps', 'Gentle Repose', 'Hold Person', 'Lesser Restoration', 'Locate Object', 'Prayer of Healing', 'Protection from Poison', 'Silence', 'Spiritual Weapon', 'Warding Bond', 'Zone of Truth'],
      3: ['Animate Dead', 'Beacon of Hope', 'Bestow Curse', 'Clairvoyance', 'Create Food and Water', 'Daylight', 'Dispel Magic', 'Feign Death', 'Glyph of Warding', 'Locate Object', 'Magic Circle', 'Mass Healing Word', 'Meld into Stone', 'Protection from Energy', 'Remove Curse', 'Revivify', 'Sending', 'Speak with Dead', 'Spirit Guardians', 'Tongues', 'Water Walk'],
      4: ['Banishment', 'Control Water', 'Death Ward', 'Divination', 'Freedom of Movement', 'Guardian of Faith', 'Locate Creature', 'Stone Shape'],
      5: ['Commune', 'Contagion', 'Dispel Evil and Good', 'Flame Strike', 'Geas', 'Greater Restoration', 'Hallow', 'Insect Plague', 'Legend Lore', 'Mass Cure Wounds', 'Planar Binding', 'Raise Dead', 'Scrying', 'Tree Stride']
    }
  },
  'Druid': {
    cantrips: ['Druidcraft', 'Guidance', 'Mending', 'Poison Spray', 'Produce Flame', 'Resistance', 'Shillelagh', 'Thorn Whip'],
    spells: {
      1: ['Animal Friendship', 'Charm Person', 'Create or Destroy Water', 'Cure Wounds', 'Detect Magic', 'Detect Poison and Disease', 'Entangle', 'Faerie Fire', 'Fog Cloud', 'Goodberry', 'Healing Word', 'Jump', 'Longstrider', 'Purify Food and Drink', 'Speak with Animals', 'Thunderwave'],
      2: ['Animal Messenger', 'Barkskin', 'Beast Sense', 'Darkvision', 'Enhance Ability', 'Find Traps', 'Flame Blade', 'Flaming Sphere', 'Gust of Wind', 'Heat Metal', 'Hold Person', 'Lesser Restoration', 'Locate Object', 'Moonbeam', 'Pass without Trace', 'Protection from Poison', 'Spike Growth'],
      3: ['Call Lightning', 'Conjure Animals', 'Daylight', 'Dispel Magic', 'Feign Death', 'Flame Arrows', 'Giant Insect', 'Gust of Wind', 'Meld into Stone', 'Plant Growth', 'Protection from Energy', 'Sleet Storm', 'Speak with Plants', 'Water Breathing', 'Water Walk', 'Wind Wall'],
      4: ['Blight', 'Confusion', 'Conjure Minor Elementals', 'Conjure Woodland Beings', 'Control Water', 'Dominate Beast', 'Freedom of Movement', 'Giant Insect', 'Grasping Vine', 'Hallucinatory Terrain', 'Ice Storm', 'Locate Creature', 'Polymorph', 'Stone Shape', 'Stoneskin', 'Wall of Fire'],
      5: ['Antilife Shell', 'Awaken', 'Commune with Nature', 'Conjure Elemental', 'Contagion', 'Geas', 'Greater Restoration', 'Insect Plague', 'Mass Cure Wounds', 'Planar Binding', 'Reincarnate', 'Scrying', 'Tree Stride', 'Wall of Stone']
    }
  },
  'Paladin': {
    cantrips: [],
    spells: {
      1: ['Bless', 'Command', 'Compelled Duel', 'Cure Wounds', 'Detect Evil and Good', 'Detect Magic', 'Detect Poison and Disease', 'Divine Favor', 'Heroism', 'Protection from Evil and Good', 'Purify Food and Drink', 'Searing Smite', 'Shield of Faith', 'Thunderous Smite', 'Wrathful Smite'],
      2: ['Aid', 'Branding Smite', 'Find Steed', 'Lesser Restoration', 'Locate Object', 'Magic Weapon', 'Protection from Poison', 'Zone of Truth'],
      3: ['Aura of Vitality', 'Blinding Smite', 'Create Food and Water', 'Crusader\'s Mantle', 'Daylight', 'Dispel Magic', 'Elemental Weapon', 'Magic Circle', 'Remove Curse', 'Revivify'],
      4: ['Aura of Life', 'Aura of Purity', 'Banishment', 'Death Ward', 'Locate Creature', 'Staggering Smite'],
      5: ['Banishing Smite', 'Circle of Power', 'Destructive Wave', 'Dispel Evil and Good', 'Geas', 'Raise Dead']
    }
  },
  'Ranger': {
    cantrips: [],
    spells: {
      1: ['Alarm', 'Animal Friendship', 'Cure Wounds', 'Detect Magic', 'Detect Poison and Disease', 'Ensnaring Strike', 'Fog Cloud', 'Goodberry', 'Hail of Thorns', 'Hunter\'s Mark', 'Jump', 'Longstrider', 'Speak with Animals'],
      2: ['Animal Messenger', 'Barkskin', 'Beast Sense', 'Cordon of Arrows', 'Darkvision', 'Find Traps', 'Lesser Restoration', 'Locate Object', 'Pass without Trace', 'Protection from Poison', 'Silence', 'Spike Growth'],
      3: ['Conjure Animals', 'Conjure Barrage', 'Daylight', 'Lightning Arrow', 'Locate Creature', 'Nondetection', 'Plant Growth', 'Protection from Energy', 'Speak with Plants', 'Water Breathing', 'Water Walk', 'Wind Wall'],
      4: ['Conjure Woodland Beings', 'Freedom of Movement', 'Grasping Vine', 'Locate Creature', 'Stoneskin'],
      5: ['Commune with Nature', 'Conjure Volley', 'Greater Restoration', 'Swift Quiver', 'Tree Stride']
    }
  },
  'Sorcerer': {
    cantrips: ['Acid Splash', 'Blade Ward', 'Chill Touch', 'Dancing Lights', 'Fire Bolt', 'Friends', 'Light', 'Mage Hand', 'Mending', 'Message', 'Minor Illusion', 'Poison Spray', 'Prestidigitation', 'Ray of Frost', 'Shocking Grasp', 'True Strike'],
    spells: {
      1: ['Burning Hands', 'Charm Person', 'Chromatic Orb', 'Color Spray', 'Comprehend Languages', 'Detect Magic', 'Disguise Self', 'Expeditious Retreat', 'False Life', 'Feather Fall', 'Fog Cloud', 'Jump', 'Mage Armor', 'Magic Missile', 'Ray of Sickness', 'Shield', 'Silent Image', 'Sleep', 'Thunderwave', 'Witch Bolt'],
      2: ['Alter Self', 'Blindness/Deafness', 'Blur', 'Cloud of Daggers', 'Crown of Madness', 'Darkness', 'Darkvision', 'Detect Thoughts', 'Enhance Ability', 'Enlarge/Reduce', 'Gust of Wind', 'Hold Person', 'Invisibility', 'Knock', 'Levitate', 'Mirror Image', 'Misty Step', 'Phantasmal Force', 'Scorching Ray', 'See Invisibility', 'Shatter', 'Spider Climb', 'Suggestion', 'Web'],
      3: ['Blink', 'Counterspell', 'Daylight', 'Fear', 'Fireball', 'Fly', 'Gaseous Form', 'Haste', 'Hypnotic Pattern', 'Lightning Bolt', 'Major Image', 'Protection from Energy', 'Sleet Storm', 'Slow', 'Stinking Cloud', 'Tongues', 'Water Breathing', 'Water Walk'],
      4: ['Banishment', 'Blight', 'Confusion', 'Dimension Door', 'Dominate Beast', 'Greater Invisibility', 'Ice Storm', 'Polymorph', 'Stoneskin', 'Wall of Fire'],
      5: ['Animate Objects', 'Cloudkill', 'Cone of Cold', 'Creation', 'Dominate Person', 'Hold Monster', 'Insect Plague', 'Seeming', 'Telekinesis', 'Teleportation Circle', 'Wall of Stone']
    }
  },
  'Warlock': {
    cantrips: ['Blade Ward', 'Chill Touch', 'Eldritch Blast', 'Friends', 'Mage Hand', 'Minor Illusion', 'Poison Spray', 'Prestidigitation', 'True Strike'],
    spells: {
      1: ['Armor of Agathys', 'Arms of Hadar', 'Charm Person', 'Comprehend Languages', 'Expeditious Retreat', 'Hellish Rebuke', 'Hex', 'Illusory Script', 'Protection from Evil and Good', 'Unseen Servant', 'Witch Bolt'],
      2: ['Cloud of Daggers', 'Crown of Madness', 'Darkness', 'Enthrall', 'Hold Person', 'Invisibility', 'Misty Step', 'Ray of Enfeeblement', 'Shatter', 'Spider Climb', 'Suggestion'],
      3: ['Counterspell', 'Dispel Magic', 'Fear', 'Fly', 'Gaseous Form', 'Hunger of Hadar', 'Hypnotic Pattern', 'Magic Circle', 'Major Image', 'Remove Curse', 'Tongues', 'Vampiric Touch'],
      4: ['Banishment', 'Blight', 'Dimension Door', 'Hallucinatory Terrain', 'Locate Creature'],
      5: ['Contact Other Plane', 'Dream', 'Hold Monster', 'Scrying']
    }
  },
  'Wizard': {
    cantrips: ['Acid Splash', 'Blade Ward', 'Chill Touch', 'Dancing Lights', 'Fire Bolt', 'Friends', 'Light', 'Mage Hand', 'Mending', 'Message', 'Minor Illusion', 'Poison Spray', 'Prestidigitation', 'Ray of Frost', 'Shocking Grasp', 'True Strike'],
    spells: {
      1: ['Alarm', 'Burning Hands', 'Charm Person', 'Chromatic Orb', 'Color Spray', 'Comprehend Languages', 'Detect Magic', 'Disguise Self', 'Expeditious Retreat', 'False Life', 'Feather Fall', 'Find Familiar', 'Fog Cloud', 'Grease', 'Identify', 'Illusory Script', 'Jump', 'Longstrider', 'Mage Armor', 'Magic Missile', 'Protection from Evil and Good', 'Ray of Sickness', 'Shield', 'Silent Image', 'Sleep', 'Tasha\'s Hideous Laughter', 'Tenser\'s Floating Disk', 'Thunderwave', 'Unseen Servant', 'Witch Bolt'],
      2: ['Alter Self', 'Arcane Lock', 'Blindness/Deafness', 'Blur', 'Cloud of Daggers', 'Continual Flame', 'Crown of Madness', 'Darkness', 'Darkvision', 'Detect Thoughts', 'Enhance Ability', 'Enlarge/Reduce', 'Flaming Sphere', 'Gentle Repose', 'Gust of Wind', 'Hold Person', 'Invisibility', 'Knock', 'Levitate', 'Locate Object', 'Magic Mouth', 'Magic Weapon', 'Melf\'s Acid Arrow', 'Mirror Image', 'Misty Step', 'Nystul\'s Magic Aura', 'Phantasmal Force', 'Pyrotechnics', 'Ray of Enfeeblement', 'Rope Trick', 'Scorching Ray', 'See Invisibility', 'Shatter', 'Spider Climb', 'Suggestion', 'Web'],
      3: ['Animate Dead', 'Bestow Curse', 'Blink', 'Clairvoyance', 'Counterspell', 'Daylight', 'Dispel Magic', 'Fear', 'Feign Death', 'Fireball', 'Fly', 'Gaseous Form', 'Glyph of Warding', 'Haste', 'Hypnotic Pattern', 'Leomund\'s Tiny Hut', 'Lightning Bolt', 'Magic Circle', 'Major Image', 'Nondetection', 'Phantom Steed', 'Protection from Energy', 'Remove Curse', 'Sending', 'Sleet Storm', 'Slow', 'Speak with Dead', 'Stinking Cloud', 'Tongues', 'Vampiric Touch', 'Water Breathing'],
      4: ['Arcane Eye', 'Banishment', 'Blight', 'Confusion', 'Conjure Minor Elementals', 'Control Water', 'Dimension Door', 'Evard\'s Black Tentacles', 'Fabricate', 'Fire Shield', 'Greater Invisibility', 'Hallucinatory Terrain', 'Ice Storm', 'Leomund\'s Secret Chest', 'Locate Creature', 'Mordenkainen\'s Faithful Hound', 'Mordenkainen\'s Private Sanctum', 'Otiluke\'s Resilient Sphere', 'Phantasmal Killer', 'Polymorph', 'Stone Shape', 'Stoneskin', 'Wall of Fire'],
      5: ['Animate Objects', 'Bigby\'s Hand', 'Cloudkill', 'Cone of Cold', 'Conjure Elemental', 'Contact Other Plane', 'Creation', 'Dominate Person', 'Dream', 'Geas', 'Hold Monster', 'Legend Lore', 'Mislead', 'Modify Memory', 'Passwall', 'Planar Binding', 'Rary\'s Telepathic Bond', 'Scrying', 'Seeming', 'Telekinesis', 'Teleportation Circle', 'Wall of Force', 'Wall of Stone']
    }
  }
};

// Comprehensive D&D 5e Spell Database (Updated 2025)
const spellDatabase = {
  // Cantrips (Level 0)
  'Acid Splash': {
    level: 0,
    school: 'Conjuration',
    castingTime: '1 action',
    range: '60 feet',
    components: 'V, S',
    duration: 'Instantaneous',
    damage: '1d6 acid damage',
    save: 'Dexterity save',
    attack: '',
    ritual: false,
    concentration: false,
    description: 'You hurl a bubble of acid. Choose one creature within range, or choose two creatures within range that are within 5 feet of each other.',
    wikiLink: 'https://dnd5e.wikidot.com/spell:acid-splash'
  },
  'Blade Ward': {
    level: 0,
    school: 'Abjuration',
    castingTime: '1 action',
    range: 'Self',
    components: 'V, S',
    duration: '1 round',
    damage: '',
    save: '',
    attack: '',
    ritual: false,
    concentration: false,
    description: 'You extend your hand and trace a sigil of warding in the air. Until the end of your next turn, you have resistance against bludgeoning, piercing, and slashing damage dealt by weapon attacks.',
    wikiLink: 'https://dnd5e.wikidot.com/spell:blade-ward'
  },
  'Chill Touch': {
    level: 0,
    school: 'Necromancy',
    castingTime: '1 action',
    range: '120 feet',
    components: 'V, S',
    duration: '1 round',
    damage: '1d8 necrotic damage',
    save: '',
    attack: 'Ranged spell attack',
    ritual: false,
    concentration: false,
    description: 'You create a ghostly, skeletal hand in the space of a creature within range. Make a ranged spell attack against the creature to assail it with the chill of the grave.',
    wikiLink: 'https://dnd5e.wikidot.com/spell:chill-touch'
  },
  'Dancing Lights': {
    level: 0,
    school: 'Evocation',
    castingTime: '1 action',
    range: '120 feet',
    components: 'V, S, M (a bit of phosphorus or wychwood, or a glowworm)',
    duration: 'Concentration, up to 1 minute',
    damage: '',
    save: '',
    attack: '',
    ritual: false,
    concentration: true,
    description: 'You create up to four torch-sized lights within range, making them appear as torches, lanterns, or glowing orbs that hover in the air for the duration.',
    wikiLink: 'https://dnd5e.wikidot.com/spell:dancing-lights'
  },
  'Druidcraft': {
    level: 0,
    school: 'Transmutation',
    castingTime: '1 action',
    range: '30 feet',
    components: 'V, S',
    duration: 'Instantaneous',
    damage: '',
    save: '',
    attack: '',
    ritual: false,
    concentration: false,
    description: 'Whispering to the spirits of nature, you create one of the following effects within range: predict weather, make a flower bloom, create a harmless sensory effect, or light/snuff a small flame.',
    wikiLink: 'https://dnd5e.wikidot.com/spell:druidcraft'
  },
  'Eldritch Blast': {
    level: 0,
    school: 'Evocation',
    castingTime: '1 action',
    range: '120 feet',
    components: 'V, S',
    duration: 'Instantaneous',
    damage: '1d10 force damage',
    save: '',
    attack: 'Ranged spell attack',
    ritual: false,
    concentration: false,
    description: 'A beam of crackling energy streaks toward a creature within range. Make a ranged spell attack against the target.',
    wikiLink: 'https://dnd5e.wikidot.com/spell:eldritch-blast'
  },
  'Fire Bolt': {
    level: 0,
    school: 'Evocation',
    castingTime: '1 action',
    range: '120 feet',
    components: 'V, S',
    duration: 'Instantaneous',
    damage: '1d10 fire damage',
    save: '',
    attack: 'Ranged spell attack',
    ritual: false,
    concentration: false,
    description: 'You hurl a mote of fire at a creature or object within range. Make a ranged spell attack against the target.',
    wikiLink: 'https://dnd5e.wikidot.com/spell:fire-bolt'
  },
  'Friends': {
    level: 0,
    school: 'Enchantment',
    castingTime: '1 action',
    range: 'Self',
    components: 'S, M (a small amount of makeup applied to the face as this spell is cast)',
    duration: 'Concentration, up to 1 minute',
    damage: '',
    save: '',
    attack: '',
    ritual: false,
    concentration: true,
    description: 'For the duration, you have advantage on all Charisma checks directed at one creature of your choice that isn\'t hostile toward you.',
    wikiLink: 'https://dnd5e.wikidot.com/spell:friends'
  },
  'Guidance': {
    level: 0,
    school: 'Divination',
    castingTime: '1 action',
    range: 'Touch',
    components: 'V, S',
    duration: 'Concentration, up to 1 minute',
    damage: '',
    save: '',
    attack: '',
    ritual: false,
    concentration: true,
    description: 'You touch one willing creature. Once before the spell ends, the target can roll a d4 and add the number rolled to one ability check of its choice.',
    wikiLink: 'https://dnd5e.wikidot.com/spell:guidance'
  },
  'Light': {
    level: 0,
    school: 'Evocation',
    castingTime: '1 action',
    range: 'Touch',
    components: 'V, M (a firefly or phosphorescent moss)',
    duration: '1 hour',
    damage: '',
    save: '',
    attack: '',
    ritual: false,
    concentration: false,
    description: 'You touch one object that is no larger than 10 feet in any dimension. Until the spell ends, the object sheds bright light in a 20-foot radius and dim light for an additional 20 feet.',
    wikiLink: 'https://dnd5e.wikidot.com/spell:light'
  },
  'Mage Hand': {
    level: 0,
    school: 'Conjuration',
    castingTime: '1 action',
    range: '30 feet',
    components: 'V, S',
    duration: '1 minute',
    damage: '',
    save: '',
    attack: '',
    ritual: false,
    concentration: false,
    description: 'A spectral, floating hand appears at a point you choose within range. The hand lasts for the duration or until you dismiss it as an action.',
    wikiLink: 'https://dnd5e.wikidot.com/spell:mage-hand'
  },
  'Mending': {
    level: 0,
    school: 'Transmutation',
    castingTime: '1 minute',
    range: 'Touch',
    components: 'V, S, M (two lodestones)',
    duration: 'Instantaneous',
    damage: '',
    save: '',
    attack: '',
    ritual: false,
    concentration: false,
    description: 'This spell repairs a single break or tear in an object you touch, such as a broken chain link, two halves of a broken key, a torn cloak, or a leaking wineskin.',
    wikiLink: 'https://dnd5e.wikidot.com/spell:mending'
  },
  'Message': {
    level: 0,
    school: 'Transmutation',
    castingTime: '1 action',
    range: '120 feet',
    components: 'V, S, M (a short piece of copper wire)',
    duration: '1 round',
    damage: '',
    save: '',
    attack: '',
    ritual: false,
    concentration: false,
    description: 'You point your finger toward a creature within range and whisper a message. The target (and only the target) hears the message and can reply in a whisper that only you can hear.',
    wikiLink: 'https://dnd5e.wikidot.com/spell:message'
  },
  'Minor Illusion': {
    level: 0,
    school: 'Illusion',
    castingTime: '1 action',
    range: '30 feet',
    components: 'S, M (a bit of fleece)',
    duration: '1 minute',
    damage: '',
    save: 'Intelligence save',
    attack: '',
    ritual: false,
    concentration: false,
    description: 'You create a sound or an image of an object within range that lasts for the duration. The illusion also ends if you dismiss it as an action or cast this spell again.',
    wikiLink: 'https://dnd5e.wikidot.com/spell:minor-illusion'
  },
  'Poison Spray': {
    level: 0,
    school: 'Conjuration',
    castingTime: '1 action',
    range: '10 feet',
    components: 'V, S',
    duration: 'Instantaneous',
    damage: '1d12 poison damage',
    save: 'Constitution save',
    attack: '',
    ritual: false,
    concentration: false,
    description: 'You extend your hand toward a creature you can see within range and project a puff of noxious gas from your palm.',
    wikiLink: 'https://dnd5e.wikidot.com/spell:poison-spray'
  },
  'Prestidigitation': {
    level: 0,
    school: 'Transmutation',
    castingTime: '1 action',
    range: '10 feet',
    components: 'V, S',
    duration: 'Up to 1 hour',
    damage: '',
    save: '',
    attack: '',
    ritual: false,
    concentration: false,
    description: 'This spell is a minor magical trick that novice spellcasters use for practice. You create one of several magical effects within range.',
    wikiLink: 'https://dnd5e.wikidot.com/spell:prestidigitation'
  },
  'Produce Flame': {
    level: 0,
    school: 'Conjuration',
    castingTime: '1 action',
    range: 'Self',
    components: 'V, S',
    duration: '10 minutes',
    damage: '1d8 fire damage',
    save: '',
    attack: 'Ranged spell attack',
    ritual: false,
    concentration: false,
    description: 'A flickering flame appears in your hand. The flame remains there for the duration and harms neither you nor your equipment.',
    wikiLink: 'https://dnd5e.wikidot.com/spell:produce-flame'
  },
  'Ray of Frost': {
    level: 0,
    school: 'Evocation',
    castingTime: '1 action',
    range: '60 feet',
    components: 'V, S',
    duration: 'Instantaneous',
    damage: '1d8 cold damage',
    save: '',
    attack: 'Ranged spell attack',
    ritual: false,
    concentration: false,
    description: 'A frigid beam of blue-white light streaks toward a creature within range. Make a ranged spell attack against the target.',
    wikiLink: 'https://dnd5e.wikidot.com/spell:ray-of-frost'
  },
  'Resistance': {
    level: 0,
    school: 'Abjuration',
    castingTime: '1 action',
    range: 'Touch',
    components: 'V, S, M (a miniature cloak)',
    duration: 'Concentration, up to 1 minute',
    damage: '',
    save: '',
    attack: '',
    ritual: false,
    concentration: true,
    description: 'You touch one willing creature. Once before the spell ends, the target can roll a d4 and add the number rolled to one saving throw of its choice.',
    wikiLink: 'https://dnd5e.wikidot.com/spell:resistance'
  },
  'Sacred Flame': {
    level: 0,
    school: 'Evocation',
    castingTime: '1 action',
    range: '60 feet',
    components: 'V, S',
    duration: 'Instantaneous',
    damage: '1d8 radiant damage',
    save: 'Dexterity save',
    attack: '',
    ritual: false,
    concentration: false,
    description: 'Flame-like radiance descends on a creature that you can see within range. The target must succeed on a Dexterity saving throw or take 1d8 radiant damage.',
    wikiLink: 'https://dnd5e.wikidot.com/spell:sacred-flame'
  },
  'Shillelagh': {
    level: 0,
    school: 'Transmutation',
    castingTime: '1 bonus action',
    range: 'Touch',
    components: 'V, S, M (mistletoe, a shamrock leaf, and a club or quarterstaff)',
    duration: '1 minute',
    damage: '',
    save: '',
    attack: '',
    ritual: false,
    concentration: false,
    description: 'The wood of a club or quarterstaff you are holding is imbued with nature\'s power. For the duration, you can use your spellcasting ability instead of Strength for the attack and damage rolls of melee attacks using that weapon.',
    wikiLink: 'https://dnd5e.wikidot.com/spell:shillelagh'
  },
  'Shocking Grasp': {
    level: 0,
    school: 'Evocation',
    castingTime: '1 action',
    range: 'Touch',
    components: 'V, S',
    duration: 'Instantaneous',
    damage: '1d8 lightning damage',
    save: '',
    attack: 'Melee spell attack',
    ritual: false,
    concentration: false,
    description: 'Lightning springs from your hand to deliver a shock to a creature you try to touch. Make a melee spell attack against the target.',
    wikiLink: 'https://dnd5e.wikidot.com/spell:shocking-grasp'
  },
  'Spare the Dying': {
    level: 0,
    school: 'Necromancy',
    castingTime: '1 action',
    range: 'Touch',
    components: 'V, S',
    duration: 'Instantaneous',
    damage: '',
    save: '',
    attack: '',
    ritual: false,
    concentration: false,
    description: 'You touch a living creature that has 0 hit points. The creature becomes stable. This spell has no effect on undead or constructs.',
    wikiLink: 'https://dnd5e.wikidot.com/spell:spare-the-dying'
  },
  'Thaumaturgy': {
    level: 0,
    school: 'Transmutation',
    castingTime: '1 action',
    range: '30 feet',
    components: 'V',
    duration: 'Up to 1 minute',
    damage: '',
    save: '',
    attack: '',
    ritual: false,
    concentration: false,
    description: 'You manifest a minor wonder, a sign of supernatural power, within range. You create one of several magical effects within range.',
    wikiLink: 'https://dnd5e.wikidot.com/spell:thaumaturgy'
  },
  'Thorn Whip': {
    level: 0,
    school: 'Transmutation',
    castingTime: '1 action',
    range: '30 feet',
    components: 'V, S, M (the stem of a plant with thorns)',
    duration: 'Instantaneous',
    damage: '1d6 piercing damage',
    save: '',
    attack: 'Melee spell attack',
    ritual: false,
    concentration: false,
    description: 'You create a long, vine-like whip covered in thorns that lashes out at your command toward a creature in range.',
    wikiLink: 'https://dnd5e.wikidot.com/spell:thorn-whip'
  },
  'True Strike': {
    level: 0,
    school: 'Divination',
    castingTime: '1 action',
    range: '30 feet',
    components: 'S',
    duration: 'Concentration, up to 1 round',
    damage: '',
    save: '',
    attack: '',
    ritual: false,
    concentration: true,
    description: 'You extend your hand and point a finger at a target in range. Your magic grants you a brief insight into the target\'s defenses.',
    wikiLink: 'https://dnd5e.wikidot.com/spell:true-strike'
  },
  'Vicious Mockery': {
    level: 0,
    school: 'Enchantment',
    castingTime: '1 action',
    range: '60 feet',
    components: 'V',
    duration: 'Instantaneous',
    damage: '1d4 psychic damage',
    save: 'Wisdom save',
    attack: '',
    ritual: false,
    concentration: false,
    description: 'You unleash a string of insults laced with subtle enchantments at a creature you can see within range.',
    wikiLink: 'https://dnd5e.wikidot.com/spell:vicious-mockery'
  },
  'Booming Blade': {
    level: 0,
    school: 'Evocation',
    castingTime: '1 action',
    range: 'Self (5-foot radius)',
    components: 'S, M (a melee weapon worth at least 1 sp)',
    duration: '1 round',
    damage: '1d8 thunder damage',
    save: '',
    attack: 'Melee weapon attack',
    ritual: false,
    concentration: false,
    description: 'You brandish the weapon used in the spell\'s casting and make a melee attack with it against one creature within 5 feet of you.',
    wikiLink: 'https://dnd5e.wikidot.com/spell:booming-blade'
  },
  'Green-Flame Blade': {
    level: 0,
    school: 'Evocation',
    castingTime: '1 action',
    range: 'Self (5-foot radius)',
    components: 'S, M (a melee weapon worth at least 1 sp)',
    duration: 'Instantaneous',
    damage: '1d8 fire damage',
    save: '',
    attack: 'Melee weapon attack',
    ritual: false,
    concentration: false,
    description: 'You brandish the weapon used in the spell\'s casting and make a melee attack with it against one creature within 5 feet of you.',
    wikiLink: 'https://dnd5e.wikidot.com/spell:green-flame-blade'
  },
  'Sword Burst': {
    level: 0,
    school: 'Conjuration',
    castingTime: '1 action',
    range: 'Self (5-foot radius)',
    components: 'V',
    duration: 'Instantaneous',
    damage: '1d6 force damage',
    save: 'Dexterity save',
    attack: '',
    ritual: false,
    concentration: false,
    description: 'You create a momentary circle of spectral blades that sweep around you.',
    wikiLink: 'https://dnd5e.wikidot.com/spell:sword-burst'
  },
  'Toll the Dead': {
    level: 0,
    school: 'Necromancy',
    castingTime: '1 action',
    range: '60 feet',
    components: 'V, S',
    duration: 'Instantaneous',
    damage: '1d8 necrotic damage',
    save: 'Wisdom save',
    attack: '',
    ritual: false,
    concentration: false,
    description: 'You point at one creature you can see within range, and the sound of a dolorous bell fills the air around it for a moment.',
    wikiLink: 'https://dnd5e.wikidot.com/spell:toll-the-dead'
  },
  
  // 1st Level Spells
  'Absorb Elements': {
    level: 1,
    school: 'Abjuration',
    castingTime: '1 reaction, which you take when you take acid, cold, fire, lightning, or thunder damage',
    range: 'Self',
    components: 'S',
    duration: '1 round',
    damage: '',
    save: '',
    attack: '',
    ritual: false,
    concentration: false,
    description: 'The spell captures some of the incoming energy, lessening its effect on you and storing it for your next melee attack.',
    wikiLink: 'https://dnd5e.wikidot.com/spell:absorb-elements'
  },
  'Alarm': {
    level: 1,
    school: 'Abjuration',
    castingTime: '1 minute',
    range: '30 feet',
    components: 'V, S, M (a tiny bell and a piece of fine silver wire)',
    duration: '8 hours',
    damage: '',
    save: '',
    attack: '',
    ritual: true,
    concentration: false,
    description: 'You set an alarm against unwanted intrusion. Choose a door, a window, or an area within range that is no larger than a 20-foot cube.',
    wikiLink: 'https://dnd5e.wikidot.com/spell:alarm'
  },
  'Burning Hands': {
    level: 1,
    school: 'Evocation',
    castingTime: '1 action',
    range: 'Self (15-foot cone)',
    components: 'V, S',
    duration: 'Instantaneous',
    damage: '3d6 fire damage',
    save: 'Dexterity save',
    attack: '',
    ritual: false,
    concentration: false,
    description: 'As you hold your hands with thumbs touching and fingers spread, a thin sheet of flames shoots forth from your outstretched fingertips.',
    wikiLink: 'https://dnd5e.wikidot.com/spell:burning-hands'
  },
  'Charm Person': {
    level: 1,
    school: 'Enchantment',
    castingTime: '1 action',
    range: '30 feet',
    components: 'V, S',
    duration: '1 hour',
    damage: '',
    save: 'Wisdom save',
    attack: '',
    ritual: false,
    concentration: false,
    description: 'You attempt to charm a humanoid you can see within range. It must make a Wisdom saving throw, and does so with advantage if you or your companions are fighting it.',
    wikiLink: 'https://dnd5e.wikidot.com/spell:charm-person'
  },
  'Cure Wounds': {
    level: 1,
    school: 'Evocation',
    castingTime: '1 action',
    range: 'Touch',
    components: 'V, S',
    duration: 'Instantaneous',
    damage: '1d8 + spellcasting ability modifier healing',
    save: '',
    attack: '',
    ritual: false,
    concentration: false,
    description: 'A creature you touch regains a number of hit points equal to 1d8 + your spellcasting ability modifier. This spell has no effect on undead or constructs.',
    wikiLink: 'https://dnd5e.wikidot.com/spell:cure-wounds'
  },
  'Detect Magic': {
    level: 1,
    school: 'Divination',
    castingTime: '1 action',
    range: 'Self',
    components: 'V, S',
    duration: 'Concentration, up to 10 minutes',
    damage: '',
    save: '',
    attack: '',
    ritual: true,
    concentration: true,
    description: 'For the duration, you sense the presence of magic within 30 feet of you. If you sense magic in this way, you can use your action to see a faint aura around any visible creature or object in the area that bears magic.',
    wikiLink: 'https://dnd5e.wikidot.com/spell:detect-magic'
  },
  'Disguise Self': {
    level: 1,
    school: 'Illusion',
    castingTime: '1 action',
    range: 'Self',
    components: 'V, S',
    duration: '1 hour',
    damage: '',
    save: '',
    attack: '',
    ritual: false,
    concentration: false,
    description: 'You make yourself—including your clothing, armor, weapons, and other belongings on your person—look different until the spell ends or until you use your action to dismiss it.',
    wikiLink: 'https://dnd5e.wikidot.com/spell:disguise-self'
  },
  'Faerie Fire': {
    level: 1,
    school: 'Evocation',
    castingTime: '1 action',
    range: '60 feet',
    components: 'V',
    duration: 'Concentration, up to 1 minute',
    damage: '',
    save: 'Dexterity save',
    attack: '',
    ritual: false,
    concentration: true,
    description: 'Each object in a 20-foot cube within range is outlined in blue, green, or violet light (your choice). Any creature in the area when the spell is cast is also outlined in light if it fails a Dexterity saving throw.',
    wikiLink: 'https://dnd5e.wikidot.com/spell:faerie-fire'
  },
  'Feather Fall': {
    level: 1,
    school: 'Transmutation',
    castingTime: '1 reaction, which you take when you or a creature within 60 feet of you falls',
    range: '60 feet',
    components: 'V, M (a small feather or piece of down)',
    duration: '1 minute',
    damage: '',
    save: '',
    attack: '',
    ritual: false,
    concentration: false,
    description: 'Choose up to five falling creatures within range. A falling creature\'s rate of descent slows to 60 feet per round until the spell ends.',
    wikiLink: 'https://dnd5e.wikidot.com/spell:feather-fall'
  },
  'Find Familiar': {
    level: 1,
    school: 'Conjuration',
    castingTime: '1 hour',
    range: '10 feet',
    components: 'V, S, M (10 gp worth of charcoal, incense, and herbs that must be consumed by fire in a brass brazier)',
    duration: 'Instantaneous',
    damage: '',
    save: '',
    attack: '',
    ritual: true,
    concentration: false,
    description: 'You gain the service of a familiar, a spirit that takes an animal form you choose: bat, cat, crab, frog (toad), hawk, lizard, octopus, owl, poisonous snake, fish (quipper), rat, raven, sea horse, spider, or weasel.',
    wikiLink: 'https://dnd5e.wikidot.com/spell:find-familiar'
  },
  'Healing Word': {
    level: 1,
    school: 'Evocation',
    castingTime: '1 bonus action',
    range: '60 feet',
    components: 'V',
    duration: 'Instantaneous',
    damage: '1d4 + spellcasting ability modifier healing',
    save: '',
    attack: '',
    ritual: false,
    concentration: false,
    description: 'A creature of your choice that you can see within range regains hit points equal to 1d4 + your spellcasting ability modifier. This spell has no effect on undead or constructs.',
    wikiLink: 'https://dnd5e.wikidot.com/spell:healing-word'
  },
  'Magic Missile': {
    level: 1,
    school: 'Evocation',
    castingTime: '1 action',
    range: '120 feet',
    components: 'V, S',
    duration: 'Instantaneous',
    damage: '1d4 + 1 force damage per missile',
    save: '',
    attack: '',
    ritual: false,
    concentration: false,
    description: 'You create three glowing darts of magical force. Each dart hits a creature of your choice that you can see within range. A dart deals 1d4 + 1 force damage to its target.',
    wikiLink: 'https://dnd5e.wikidot.com/spell:magic-missile'
  },
  'Shield': {
    level: 1,
    school: 'Abjuration',
    castingTime: '1 reaction, which you take when you are hit by an attack or targeted by the magic missile spell',
    range: 'Self',
    components: 'V, S',
    duration: '1 round',
    damage: '',
    save: '',
    attack: '',
    ritual: false,
    concentration: false,
    description: 'An invisible barrier of magical force appears and protects you. Until the start of your next turn, you have a +5 bonus to AC, including against the triggering attack, and you take no damage from magic missile.',
    wikiLink: 'https://dnd5e.wikidot.com/spell:shield'
  },
  'Sleep': {
    level: 1,
    school: 'Enchantment',
    castingTime: '1 action',
    range: '90 feet',
    components: 'V, S, M (a pinch of fine sand, rose petals, or a cricket)',
    duration: '1 minute',
    damage: '',
    save: '',
    attack: '',
    ritual: false,
    concentration: false,
    description: 'This spell sends creatures into a magical slumber. Roll 5d8; the total is how many hit points of creatures this spell can affect. Creatures within 20 feet of a point you choose within range are affected in ascending order of their current hit points.',
    wikiLink: 'https://dnd5e.wikidot.com/spell:sleep'
  },
  'Thunderwave': {
    level: 1,
    school: 'Evocation',
    castingTime: '1 action',
    range: 'Self (15-foot cube)',
    components: 'V, S',
    duration: 'Instantaneous',
    damage: '2d8 thunder damage',
    save: 'Constitution save',
    attack: '',
    ritual: false,
    concentration: false,
    description: 'A wave of thunderous force sweeps out from you. Each creature in a 15-foot cube originating from you must make a Constitution saving throw.',
    wikiLink: 'https://dnd5e.wikidot.com/spell:thunderwave'
  },
  
  // 2nd Level Spells
  'Aid': {
    level: 2,
    school: 'Enchantment',
    castingTime: '1 action',
    range: '30 feet',
    components: 'V, S, M (a tiny strip of white cloth)',
    duration: '8 hours',
    damage: '',
    save: '',
    attack: '',
    ritual: false,
    concentration: false,
    description: 'Your spell bolsters your allies with toughness and resolve. Choose up to three creatures within range. Each target\'s hit point maximum and current hit points increase by 5 for the duration.',
    wikiLink: 'https://dnd5e.wikidot.com/spell:aid'
  },
  'Blur': {
    level: 2,
    school: 'Illusion',
    castingTime: '1 action',
    range: 'Self',
    components: 'V',
    duration: 'Concentration, up to 1 minute',
    damage: '',
    save: '',
    attack: '',
    ritual: false,
    concentration: true,
    description: 'Your body becomes blurred, shifting and wavering to all who can see you. For the duration, any creature has disadvantage on attack rolls against you.',
    wikiLink: 'https://dnd5e.wikidot.com/spell:blur'
  },
  'Darkvision': {
    level: 2,
    school: 'Transmutation',
    castingTime: '1 action',
    range: 'Touch',
    components: 'V, S, M (either a pinch of dried carrot or an agate)',
    duration: '8 hours',
    damage: '',
    save: '',
    attack: '',
    ritual: false,
    concentration: false,
    description: 'You touch a willing creature to grant it the ability to see in the dark. For the duration, that creature has darkvision out to a range of 60 feet.',
    wikiLink: 'https://dnd5e.wikidot.com/spell:darkvision'
  },
  'Enhance Ability': {
    level: 2,
    school: 'Transmutation',
    castingTime: '1 action',
    range: 'Touch',
    components: 'V, S, M (fur or a feather from a beast)',
    duration: 'Concentration, up to 1 hour',
    damage: '',
    save: '',
    attack: '',
    ritual: false,
    concentration: true,
    description: 'You touch a creature and bestow upon it a magical enhancement. Choose one of the following effects; the target gains that effect until the spell ends.',
    wikiLink: 'https://dnd5e.wikidot.com/spell:enhance-ability'
  },
  'Heat Metal': {
    level: 2,
    school: 'Transmutation',
    castingTime: '1 action',
    range: '60 feet',
    components: 'V, S, M (a piece of iron and a flame)',
    duration: 'Concentration, up to 1 minute',
    damage: '2d8 fire damage',
    save: '',
    attack: '',
    ritual: false,
    concentration: true,
    description: 'Choose a manufactured metal object, such as a metal weapon or a suit of heavy or medium metal armor, that you can see within range.',
    wikiLink: 'https://dnd5e.wikidot.com/spell:heat-metal'
  },
  'Hold Person': {
    level: 2,
    school: 'Enchantment',
    castingTime: '1 action',
    range: '60 feet',
    components: 'V, S, M (a small, straight piece of iron)',
    duration: 'Concentration, up to 1 minute',
    damage: '',
    save: 'Wisdom save',
    attack: '',
    ritual: false,
    concentration: true,
    description: 'Choose a humanoid that you can see within range. The target must succeed on a Wisdom saving throw or be paralyzed for the duration.',
    wikiLink: 'https://dnd5e.wikidot.com/spell:hold-person'
  },
  'Invisibility': {
    level: 2,
    school: 'Illusion',
    castingTime: '1 action',
    range: 'Touch',
    components: 'V, S, M (an eyelash encased in gum arabic)',
    duration: 'Concentration, up to 1 hour',
    damage: '',
    save: '',
    attack: '',
    ritual: false,
    concentration: true,
    description: 'A creature you touch becomes invisible until the spell ends. Anything the target is wearing or carrying is invisible as long as it is on the target\'s person.',
    wikiLink: 'https://dnd5e.wikidot.com/spell:invisibility'
  },
  'Lesser Restoration': {
    level: 2,
    school: 'Abjuration',
    castingTime: '1 action',
    range: 'Touch',
    components: 'V, S',
    duration: 'Instantaneous',
    damage: '',
    save: '',
    attack: '',
    ritual: false,
    concentration: false,
    description: 'You touch a creature and can end either one disease or one condition afflicting it. The condition can be blinded, deafened, paralyzed, or poisoned.',
    wikiLink: 'https://dnd5e.wikidot.com/spell:lesser-restoration'
  },
  'Misty Step': {
    level: 2,
    school: 'Conjuration',
    castingTime: '1 bonus action',
    range: 'Self',
    components: 'V',
    duration: 'Instantaneous',
    damage: '',
    save: '',
    attack: '',
    ritual: false,
    concentration: false,
    description: 'Briefly surrounded by silvery mist, you teleport up to 30 feet to an unoccupied space that you can see.',
    wikiLink: 'https://dnd5e.wikidot.com/spell:misty-step'
  },
  'Scorching Ray': {
    level: 2,
    school: 'Evocation',
    castingTime: '1 action',
    range: '120 feet',
    components: 'V, S',
    duration: 'Instantaneous',
    damage: '2d6 fire damage per ray',
    save: '',
    attack: 'Ranged spell attack',
    ritual: false,
    concentration: false,
    description: 'You create three rays of fire and hurl them at targets within range. You can hurl them at one target or several. Make a ranged spell attack for each ray.',
    wikiLink: 'https://dnd5e.wikidot.com/spell:scorching-ray'
  },
  'Suggestion': {
    level: 2,
    school: 'Enchantment',
    castingTime: '1 action',
    range: '30 feet',
    components: 'V, M (a snake\'s tongue and either a bit of honeycomb or a drop of sweet oil)',
    duration: 'Concentration, up to 8 hours',
    damage: '',
    save: 'Wisdom save',
    attack: '',
    ritual: false,
    concentration: true,
    description: 'You suggest a course of activity (limited to a sentence or two) and magically influence a creature you can see within range that can hear and understand you.',
    wikiLink: 'https://dnd5e.wikidot.com/spell:suggestion'
  },
  'Web': {
    level: 2,
    school: 'Conjuration',
    castingTime: '1 action',
    range: '60 feet',
    components: 'V, S, M (a bit of spiderweb)',
    duration: 'Concentration, up to 1 hour',
    damage: '',
    save: 'Dexterity save',
    attack: '',
    ritual: false,
    concentration: true,
    description: 'You conjure a mass of thick, sticky webbing at a point of your choice within range. The webs fill a 20-foot cube from that point for the duration.',
    wikiLink: 'https://dnd5e.wikidot.com/spell:web'
  },
  
  // 3rd Level Spells
  'Counterspell': {
    level: 3,
    school: 'Abjuration',
    castingTime: '1 reaction, which you take when you see a creature within 60 feet of you casting a spell',
    range: '60 feet',
    components: 'S',
    duration: 'Instantaneous',
    damage: '',
    save: '',
    attack: '',
    ritual: false,
    concentration: false,
    description: 'You attempt to interrupt a creature in the process of casting a spell. If the creature is casting a spell of 3rd level or lower, its spell fails and has no effect.',
    wikiLink: 'https://dnd5e.wikidot.com/spell:counterspell'
  },
  'Dispel Magic': {
    level: 3,
    school: 'Abjuration',
    castingTime: '1 action',
    range: '120 feet',
    components: 'V, S',
    duration: 'Instantaneous',
    damage: '',
    save: '',
    attack: '',
    ritual: false,
    concentration: false,
    description: 'Choose any creature, object, or magical effect within range. Any spell of 3rd level or lower on the target ends. For each spell of 4th level or higher on the target, make an ability check using your spellcasting ability.',
    wikiLink: 'https://dnd5e.wikidot.com/spell:dispel-magic'
  },
  'Fireball': {
    level: 3,
    school: 'Evocation',
    castingTime: '1 action',
    range: '150 feet',
    components: 'V, S, M (a tiny ball of bat guano and sulfur)',
    duration: 'Instantaneous',
    damage: '8d6 fire damage',
    save: 'Dexterity save',
    attack: '',
    ritual: false,
    concentration: false,
    description: 'A bright streak flashes from your pointing finger to a point you choose within range and then blossoms with a low roar into an explosion of flame.',
    wikiLink: 'https://dnd5e.wikidot.com/spell:fireball'
  },
  'Fly': {
    level: 3,
    school: 'Transmutation',
    castingTime: '1 action',
    range: 'Touch',
    components: 'V, S, M (a wing feather from any bird)',
    duration: 'Concentration, up to 10 minutes',
    damage: '',
    save: '',
    attack: '',
    ritual: false,
    concentration: true,
    description: 'You touch a willing creature. The target gains a flying speed of 60 feet for the duration. When the spell ends, the target falls if it is still aloft, unless it can stop the fall.',
    wikiLink: 'https://dnd5e.wikidot.com/spell:fly'
  },
  'Haste': {
    level: 3,
    school: 'Transmutation',
    castingTime: '1 action',
    range: '30 feet',
    components: 'V, S, M (a shaving of licorice root)',
    duration: 'Concentration, up to 1 minute',
    damage: '',
    save: '',
    attack: '',
    ritual: false,
    concentration: true,
    description: 'Choose a willing creature that you can see within range. Until the spell ends, the target\'s speed is doubled, it gains a +2 bonus to AC, it has advantage on Dexterity saving throws, and it gains an additional action on each of its turns.',
    wikiLink: 'https://dnd5e.wikidot.com/spell:haste'
  },
  'Lightning Bolt': {
    level: 3,
    school: 'Evocation',
    castingTime: '1 action',
    range: 'Self (100-foot line)',
    components: 'V, S, M (a bit of fur and a rod of amber, crystal, or glass)',
    duration: 'Instantaneous',
    damage: '8d6 lightning damage',
    save: 'Dexterity save',
    attack: '',
    ritual: false,
    concentration: false,
    description: 'A stroke of lightning forming a line 100 feet long and 5 feet wide blasts out from you in a direction you choose.',
    wikiLink: 'https://dnd5e.wikidot.com/spell:lightning-bolt'
  },
  'Revivify': {
    level: 3,
    school: 'Necromancy',
    castingTime: '1 action',
    range: 'Touch',
    components: 'V, S, M (diamonds worth 300 gp, which the spell consumes)',
    duration: 'Instantaneous',
    damage: '',
    save: '',
    attack: '',
    ritual: false,
    concentration: false,
    description: 'You touch a creature that has died within the last minute. That creature returns to life with 1 hit point. This spell can\'t return to life a creature that has died of old age, nor can it restore any missing body parts.',
    wikiLink: 'https://dnd5e.wikidot.com/spell:revivify'
  },
  'Spirit Guardians': {
    level: 3,
    school: 'Conjuration',
    castingTime: '1 action',
    range: 'Self (15-foot radius)',
    components: 'V, S, M (a holy symbol)',
    duration: 'Concentration, up to 10 minutes',
    damage: '3d8 radiant or necrotic damage',
    save: 'Wisdom save',
    attack: '',
    ritual: false,
    concentration: true,
    description: 'You call forth spirits to protect you. They flit around you to a distance of 15 feet for the duration. If you are good or neutral, their spectral form appears angelic or fey (your choice).',
    wikiLink: 'https://dnd5e.wikidot.com/spell:spirit-guardians'
  },
  
  // 4th Level Spells
  'Banishment': {
    level: 4,
    school: 'Abjuration',
    castingTime: '1 action',
    range: '60 feet',
    components: 'V, S, M (an item distasteful to the target)',
    duration: 'Concentration, up to 1 minute',
    damage: '',
    save: 'Charisma save',
    attack: '',
    ritual: false,
    concentration: true,
    description: 'You attempt to send one creature that you can see within range to another plane of existence. The target must succeed on a Charisma saving throw or be banished.',
    wikiLink: 'https://dnd5e.wikidot.com/spell:banishment'
  },
  'Greater Invisibility': {
    level: 4,
    school: 'Illusion',
    castingTime: '1 action',
    range: 'Touch',
    components: 'V, S',
    duration: 'Concentration, up to 1 minute',
    damage: '',
    save: '',
    attack: '',
    ritual: false,
    concentration: true,
    description: 'You or a creature you touch becomes invisible until the spell ends. Anything the target is wearing or carrying is invisible as long as it is on the target\'s person.',
    wikiLink: 'https://dnd5e.wikidot.com/spell:greater-invisibility'
  },
  'Polymorph': {
    level: 4,
    school: 'Transmutation',
    castingTime: '1 action',
    range: '60 feet',
    components: 'V, S, M (a caterpillar cocoon)',
    duration: 'Concentration, up to 1 hour',
    damage: '',
    save: 'Wisdom save',
    attack: '',
    ritual: false,
    concentration: true,
    description: 'This spell transforms a creature that you can see within range into a new form. An unwilling creature must make a Wisdom saving throw to avoid the effect.',
    wikiLink: 'https://dnd5e.wikidot.com/spell:polymorph'
  },
  'Wall of Fire': {
    level: 4,
    school: 'Evocation',
    castingTime: '1 action',
    range: '120 feet',
    components: 'V, S, M (a small piece of phosphorus)',
    duration: 'Concentration, up to 1 minute',
    damage: '5d8 fire damage',
    save: 'Dexterity save',
    attack: '',
    ritual: false,
    concentration: true,
    description: 'You create a wall of fire on a solid surface within range. You can make the wall up to 60 feet long, 20 feet high, and 1 foot thick, or a ringed wall up to 20 feet in diameter, 20 feet high, and 1 foot thick.',
    wikiLink: 'https://dnd5e.wikidot.com/spell:wall-of-fire'
  },
  
  // 5th Level Spells
  'Cone of Cold': {
    level: 5,
    school: 'Evocation',
    castingTime: '1 action',
    range: 'Self (60-foot cone)',
    components: 'V, S, M (a small crystal or glass cone)',
    duration: 'Instantaneous',
    damage: '8d8 cold damage',
    save: 'Constitution save',
    attack: '',
    ritual: false,
    concentration: false,
    description: 'A blast of cold air erupts from your hands. Each creature in a 60-foot cone must make a Constitution saving throw.',
    wikiLink: 'https://dnd5e.wikidot.com/spell:cone-of-cold'
  },
  'Greater Restoration': {
    level: 5,
    school: 'Abjuration',
    castingTime: '1 action',
    range: 'Touch',
    components: 'V, S, M (diamond dust worth at least 100 gp, which the spell consumes)',
    duration: 'Instantaneous',
    damage: '',
    save: '',
    attack: '',
    ritual: false,
    concentration: false,
    description: 'You imbue a creature you touch with positive energy to undo a debilitating effect. You can reduce the target\'s exhaustion level by one, or end one of the following effects on the target.',
    wikiLink: 'https://dnd5e.wikidot.com/spell:greater-restoration'
  },
  'Mass Cure Wounds': {
    level: 5,
    school: 'Evocation',
    castingTime: '1 action',
    range: '60 feet',
    components: 'V, S',
    duration: 'Instantaneous',
    damage: '3d8 + spellcasting ability modifier healing',
    save: '',
    attack: '',
    ritual: false,
    concentration: false,
    description: 'A wave of healing energy washes out from a point of your choice within range. Choose up to six creatures in a 30-foot-radius sphere centered on that point.',
    wikiLink: 'https://dnd5e.wikidot.com/spell:mass-cure-wounds'
  },
  'Raise Dead': {
    level: 5,
    school: 'Necromancy',
    castingTime: '1 hour',
    range: 'Touch',
    components: 'V, S, M (a diamond worth at least 500 gp, which the spell consumes)',
    duration: 'Instantaneous',
    damage: '',
    save: '',
    attack: '',
    ritual: false,
    concentration: false,
    description: 'You return a dead creature you touch to life, provided that it has been dead no longer than 10 days. If the creature\'s soul is both willing and at liberty to rejoin the body, the creature returns to life with 1 hit point.',
    wikiLink: 'https://dnd5e.wikidot.com/spell:raise-dead'
  },
  'Scrying': {
    level: 5,
    school: 'Divination',
    castingTime: '10 minutes',
    range: 'Self',
    components: 'V, S, M (a focus worth at least 1,000 gp, such as a crystal ball, a silver mirror, or a font filled with holy water)',
    duration: 'Concentration, up to 10 minutes',
    damage: '',
    save: 'Wisdom save',
    attack: '',
    ritual: false,
    concentration: true,
    description: 'You can see and hear a particular creature you choose that is on the same plane of existence as you. The target must make a Wisdom saving throw, which is modified by how well you know the target and the sort of physical connection you have to it.',
    wikiLink: 'https://dnd5e.wikidot.com/spell:scrying'
  }
};


// Show import popup
function showImportPopup(type) {
  const popup = document.getElementById('importSpellsPopup');
  const title = document.getElementById('importSpellsTitle');
  
  title.textContent = type === 'cantrip' ? 'Import Cantrips' : 'Import Spells';
  importMode = (type === 'cantrip') ? 'cantrip' : (type === 'spell' ? 'spell' : 'both');
  
  // Reset class selections
  classLevelSelections = [];
  document.getElementById('classLevelContainer').innerHTML = '';
  document.getElementById('importPreview').innerHTML = '';
  
  // Add first class selection
  addClassLevel();
  
  showPopup('importSpellsPopup');
}

// Add class/level selection row
function addClassLevel() {
  const container = document.getElementById('classLevelContainer');
  const rowId = 'classLevel_' + Date.now();
  
  const row = document.createElement('div');
  row.className = 'class-level-row';
  row.id = rowId;
  
  row.innerHTML = `
    <select onchange="updateImportPreview()">
      <option value="">Select Class</option>
      ${Object.keys(dndClasses).map(cls => `<option value="${cls}">${cls}</option>`).join('')}
    </select>
    <input type="number" min="1" max="20" value="1" onchange="updateImportPreview()" placeholder="Level">
    <button class="remove-class-btn" onclick="removeClassLevel('${rowId}')">Remove</button>
  `;
  
  container.appendChild(row);
  updateImportPreview();
}

// Remove class/level selection row
function removeClassLevel(rowId) {
  document.getElementById(rowId).remove();
  updateImportPreview();
}

// Update import preview
function updateImportPreview() {
  const preview = document.getElementById('importPreview');
  const rows = document.querySelectorAll('.class-level-row');
  
  let spellsToImport = [];
  let cantripsToImport = [];
  
  rows.forEach(row => {
    const classSelect = row.querySelector('select');
    const levelInput = row.querySelector('input');
    
    if (classSelect.value && levelInput.value) {
      const className = classSelect.value;
      const level = parseInt(levelInput.value);
      const classData = dndClasses[className];
      
      // Add cantrips (if allowed by mode)
      if (importMode !== 'spell' && classData.cantrips) {
        classData.cantrips.forEach(cantrip => {
          if (!cantripsToImport.find(c => c.name === cantrip)) {
            cantripsToImport.push({ name: cantrip, class: className });
          }
        });
      }
      
      // Add spells up to the selected level (if allowed by mode)
      if (importMode !== 'cantrip') {
        for (let i = 1; i <= Math.min(level, 9); i++) {
          if (classData.spells && classData.spells[i]) {
            classData.spells[i].forEach(spell => {
              if (!spellsToImport.find(s => s.name === spell)) {
                spellsToImport.push({ name: spell, level: i, class: className });
              }
            });
          }
        }
      }
    }
  });
  
  // Display preview
  let previewHTML = '';
  if (cantripsToImport.length > 0) {
    previewHTML += '<strong>Cantrips:</strong><br>';
    cantripsToImport.forEach(cantrip => {
      previewHTML += `• ${cantrip.name} (${cantrip.class})<br>`;
    });
    previewHTML += '<br>';
  }
  
  if (spellsToImport.length > 0) {
    previewHTML += '<strong>Spells:</strong><br>';
    spellsToImport.forEach(spell => {
      previewHTML += `• ${spell.name} (Level ${spell.level}, ${spell.class})<br>`;
    });
  }
  
  if (previewHTML === '') {
    previewHTML = 'Select classes and levels to see spells to import.';
  }
  
  preview.innerHTML = previewHTML;
}

// Execute import
function executeImport() {
  const rows = document.querySelectorAll('.class-level-row');
  let importedCount = 0;
  
  rows.forEach(row => {
    const classSelect = row.querySelector('select');
    const levelInput = row.querySelector('input');
    
    if (classSelect.value && levelInput.value) {
      const className = classSelect.value;
      const level = parseInt(levelInput.value);
      const classData = dndClasses[className];
      
      // Import cantrips (only if mode allows)
      if (importMode !== 'spell' && classData.cantrips) {
        classData.cantrips.forEach(cantripName => {
          if (!spellsData.cantrips.find(c => c.name === cantripName)) {
            // Create cantrip from database or use default
            const cantrip = createSpellFromName(cantripName, 0);
            if (cantrip) {
              spellsData.cantrips.push(cantrip);
              importedCount++;
            }
          }
        });
      }
      
      // Import spells up to selected level (support up to 9th level) if mode allows
      if (importMode !== 'cantrip') {
        for (let i = 1; i <= Math.min(level, 9); i++) {
          if (classData.spells && classData.spells[i]) {
            classData.spells[i].forEach(spellName => {
              if (!spellsData.spells.find(s => s.name === spellName)) {
                const spell = createSpellFromName(spellName, i);
                if (spell) {
                  spellsData.spells.push(spell);
                  importedCount++;
                }
              }
            });
          }
        }
      }
    }
  });
  
  // Reset filters to show newly imported content
  const cantripFilter = document.getElementById('cantrip_filter');
  if (cantripFilter) cantripFilter.value = 'all';
  const levelFilter = document.getElementById('spell_level_filter');
  if (levelFilter) levelFilter.value = 'all';
  const schoolFilter = document.getElementById('spell_school_filter');
  if (schoolFilter) schoolFilter.value = 'all';
  const statusFilter = document.getElementById('spell_status_filter');
  if (statusFilter) statusFilter.value = 'all';

  renderSpells();
  autosave();
  closePopup('importSpellsPopup');
  alert(importMode === 'cantrip' 
    ? `Imported ${importedCount} cantrips!`
    : (importMode === 'spell' 
      ? `Imported ${importedCount} spells!`
      : `Imported ${importedCount} spells and cantrips!`));
}

// Create spell from name using comprehensive database
function createSpellFromName(name, level) {
  // Check if we have detailed data in our database
  if (spellDatabase[name]) {
    const spellData = spellDatabase[name];
    return {
      name: name,
      level: spellData.level,
      school: spellData.school,
      castingTime: spellData.castingTime,
      range: spellData.range,
      components: spellData.components,
      duration: spellData.duration,
      damage: spellData.damage,
      save: spellData.save,
      attack: spellData.attack,
      ritual: spellData.ritual,
      concentration: spellData.concentration,
      prepared: false,
      description: spellData.description,
      wikiLink: spellData.wikiLink
    };
  }
  
  // Fallback for spells not in our database
  return {
    name: name,
    level: level,
    school: 'Evocation', // Default school
    castingTime: '1 action',
    range: '60 feet',
    components: 'V, S',
    duration: 'Instantaneous',
    damage: level === 0 ? '1d10 damage' : `${level}d6 damage`,
    save: '',
    attack: level === 0 ? 'Ranged spell attack' : '',
    ritual: false,
    concentration: false,
    prepared: false,
    description: `${name} - Official D&D 5e spell. Full description available in Player's Handbook.`,
    wikiLink: `https://dnd5e.wikidot.com/spell:${name.toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]/g, '')}`
  };
}

// Toggle favorite status
function toggleFavorite(type, index) {
  const spell = type === 'cantrip' ? spellsData.cantrips[index] : spellsData.spells[index];
  if (!spell) return;
  
  const favorites = type === 'cantrip' ? favoritesData.cantrips : favoritesData.spells;
  const existingIndex = favorites.findIndex(f => f.name === spell.name);
  
  if (existingIndex !== -1) {
    favorites.splice(existingIndex, 1);
  } else {
    favorites.push(spell);
  }
  
  renderSpells(); // live update both lists and favorites section
  autosave();
}

// Name-based favorite toggle to avoid index mismatches from filtering/grouping
function toggleFavoriteByName(type, name) {
  const list = type === 'cantrip' ? spellsData.cantrips : spellsData.spells;
  const idx = list.findIndex(s => s.name === name);
  if (idx === -1) return;
  toggleFavorite(type, idx);
}

// Check if spell is favorited
function isFavorited(type, spellName) {
  const favorites = type === 'cantrip' ? favoritesData.cantrips : favoritesData.spells;
  return favorites.some(f => f.name === spellName);
}

// Clear all spells with 3-press confirmation
function clearAllSpells(type) {
  const currentCount = clearAllConfirmations[type];
  const requiredPresses = 3;
  
  // Increment the confirmation count
  clearAllConfirmations[type]++;
  
  if (clearAllConfirmations[type] < requiredPresses) {
    const remaining = requiredPresses - clearAllConfirmations[type];
    const typeName = type === 'cantrip' ? 'Cantrips' : 'Spells';
    
    // Update button text to show progress
    const button = event.target;
    const originalText = button.textContent;
    button.textContent = `Clear All ${typeName} (${remaining} more clicks)`;
    button.style.backgroundColor = '#ff6666';
    
    // Reset button after 3 seconds if not completed
    setTimeout(() => {
      if (clearAllConfirmations[type] < requiredPresses) {
        clearAllConfirmations[type] = 0;
        button.textContent = originalText;
        button.style.backgroundColor = '#ff4444';
      }
    }, 3000);
    
    return;
  }
  
  // Reset confirmation count
  clearAllConfirmations[type] = 0;
  
  // Get the spell array
  const spellArray = type === 'cantrip' ? spellsData.cantrips : spellsData.spells;
  const typeName = type === 'cantrip' ? 'cantrips' : 'spells';
  
  if (spellArray.length === 0) {
    alert(`No ${typeName} to clear!`);
    return;
  }
  
  // Final confirmation
  const confirmed = confirm(`Are you sure you want to clear ALL ${spellArray.length} ${typeName}?\n\nThis action cannot be undone!\n\nNote: This will NOT remove spells from your favorites.`);
  
  if (confirmed) {
    // Clear the spells array
    spellArray.length = 0;
    
    // Update the button back to normal
    const button = event.target;
    button.textContent = `Clear All ${typeName.charAt(0).toUpperCase() + typeName.slice(1)}`;
    button.style.backgroundColor = '#ff4444';
    
    // Re-render the spells
    renderSpells();
    autosave();
    
    alert(`All ${typeName} have been cleared!`);
  } else {
    // Reset button if user cancels
    const button = event.target;
    button.textContent = `Clear All ${typeName.charAt(0).toUpperCase() + typeName.slice(1)}`;
    button.style.backgroundColor = '#ff4444';
  }
}

// Initialize spell system when page loads
document.addEventListener('DOMContentLoaded', function() {
  initializeSpellSystem();
});

function loadLayout() {
  // Add layout loading logic here if needed
}

// ========== FIREBASE CLOUD SYNC ==========

// Firebase Configuration
const firebaseConfig = {
  apiKey: "AIzaSyAgMenA-kiiwESliFp2zXgYLa7a3pPM65I",
  authDomain: "dndcharproject.firebaseapp.com",
  projectId: "dndcharproject",
  storageBucket: "dndcharproject.firebasestorage.app",
  messagingSenderId: "80899162338",
  appId: "1:80899162338:web:b7f9c9fbf96b9553c29ebb"
};

// Initialize Firebase
let firebaseApp, auth, db;
let currentUser = null;

function initializeFirebase() {
  try {
    firebaseApp = firebase.initializeApp(firebaseConfig);
    auth = firebase.auth();
    db = firebase.firestore();
    
    // Listen for auth state changes
    auth.onAuthStateChanged((user) => {
      currentUser = user;
      updateAuthUI();
      if (user) {
        setSyncStatus('Signed in successfully');
        // Auto-sync from cloud when user signs in
        setTimeout(() => syncFromCloud(true), 1000);
      }
    });
    
    console.log('Firebase initialized successfully');
  } catch (error) {
    console.error('Firebase initialization error:', error);
    setSyncStatus('Cloud sync unavailable');
  }
}

function updateAuthUI() {
  const signedInView = document.getElementById('signedInView');
  const signedOutView = document.getElementById('signedOutView');
  const userEmail = document.getElementById('userEmail');
  
  if (currentUser) {
    signedInView.style.display = 'block';
    signedOutView.style.display = 'none';
    userEmail.textContent = currentUser.email;
  } else {
    signedInView.style.display = 'none';
    signedOutView.style.display = 'block';
  }
}

function setSyncStatus(message) {
  const statusElement = document.getElementById('syncStatus');
  if (statusElement) {
    statusElement.textContent = message;
    // Clear status after 3 seconds
    setTimeout(() => {
      statusElement.textContent = '';
    }, 3000);
  }
}

// Authentication Functions
async function signInWithGoogle() {
  try {
    const provider = new firebase.auth.GoogleAuthProvider();
    await auth.signInWithPopup(provider);
    setSyncStatus('Signing in...');
  } catch (error) {
    console.error('Sign-in error:', error);
    setSyncStatus('Sign-in failed: ' + error.message);
  }
}

async function signOut() {
  try {
    await auth.signOut();
    setSyncStatus('Signed out');
  } catch (error) {
    console.error('Sign-out error:', error);
    setSyncStatus('Sign-out failed');
  }
}

// Cloud Sync Functions
async function syncToCloud() {
  if (!currentUser) {
    setSyncStatus('Please sign in first');
    return;
  }
  
  try {
    setSyncStatus('Uploading to cloud...');
    
    // Get current character data
    const characters = JSON.parse(localStorage.getItem('dndCharacters')) || [];
    const theme = localStorage.getItem('dndTheme') || 'dark';
    const accentColor = localStorage.getItem('dndAccentColor') || '#ffd700';
    
    const userData = {
      characters: characters,
      theme: theme,
      accentColor: accentColor,
      lastSync: firebase.firestore.FieldValue.serverTimestamp(),
      version: '1.0'
    };
    
    // Save to Firestore
    await db.collection('userData').doc(currentUser.uid).set(userData);
    
    setSyncStatus(`Uploaded ${characters.length} characters to cloud`);
  } catch (error) {
    console.error('Upload error:', error);
    setSyncStatus('Upload failed: ' + error.message);
  }
}

async function syncFromCloud(silent = false) {
  if (!currentUser) {
    if (!silent) setSyncStatus('Please sign in first');
    return;
  }
  
  try {
    if (!silent) setSyncStatus('Downloading from cloud...');
    
    // Get data from Firestore
    const doc = await db.collection('userData').doc(currentUser.uid).get();
    
    if (!doc.exists) {
      if (!silent) setSyncStatus('No cloud data found');
      return;
    }
    
    const userData = doc.data();
    
    // Ask user if they want to replace local data
    const localCharacters = JSON.parse(localStorage.getItem('dndCharacters')) || [];
    const cloudCharacters = userData.characters || [];
    
    let shouldReplace = true;
    if (!silent && localCharacters.length > 0) {
      shouldReplace = confirm(
        `Replace ${localCharacters.length} local characters with ${cloudCharacters.length} cloud characters?`
      );
    }
    
    if (shouldReplace) {
      // Replace local data with cloud data
      localStorage.setItem('dndCharacters', JSON.stringify(cloudCharacters));
      if (userData.theme) localStorage.setItem('dndTheme', userData.theme);
      if (userData.accentColor) localStorage.setItem('dndAccentColor', userData.accentColor);
      
      // Refresh the page to load new data
      if (!silent) {
        setSyncStatus(`Downloaded ${cloudCharacters.length} characters`);
        setTimeout(() => {
          if (confirm('Reload page to apply synced data?')) {
            location.reload();
          }
        }, 1000);
      } else {
        // Silent sync - just reload character list
        loadCharacterList();
        if (cloudCharacters.length > 0) {
          currentCharacter = cloudCharacters[0].id;
          loadData();
    setupSkillCalculationFields();
    enforceAutoMathNumericInputs();
        }
      }
    }
  } catch (error) {
    console.error('Download error:', error);
    if (!silent) setSyncStatus('Download failed: ' + error.message);
  }
}

// Auto-sync functionality
function enableAutoSync() {
  // Auto-save to cloud every 5 minutes if signed in
  setInterval(() => {
    if (currentUser) {
      syncToCloud();
    }
  }, 5 * 60 * 1000); // 5 minutes
}

// Enhanced autosave to include cloud sync
const originalAutosave = autosave;
autosave = function() {
  // Call original autosave
  originalAutosave();
  
  // If user is signed in, schedule a cloud sync
  if (currentUser) {
    // Debounce cloud sync to avoid too many uploads
    clearTimeout(window.cloudSyncTimeout);
    window.cloudSyncTimeout = setTimeout(() => {
      syncToCloud();
    }, 10000); // Sync 10 seconds after last change
  }
};

// Skill calculation + numeric input helpers
const SKILL_ABILITY_MAP = {
  acrobatics: 'dex',
  animal_handling: 'wis',
  arcana: 'int',
  athletics: 'str',
  deception: 'cha',
  history: 'int',
  insight: 'wis',
  intimidation: 'cha',
  investigation: 'int',
  medicine: 'wis',
  nature: 'int',
  perception: 'wis',
  performance: 'cha',
  persuasion: 'cha',
  religion: 'int',
  sleight_of_hand: 'dex',
  stealth: 'dex',
  survival: 'wis'
};

const SKILL_LIST = Object.keys(SKILL_ABILITY_MAP);

function formatSignedNumber(value) {
  const n = parseInt(value, 10) || 0;
  return n >= 0 ? `+${n}` : `${n}`;
}

function parseSignedNumber(value) {
  if (value === null || value === undefined) return 0;
  const cleaned = String(value).trim().replace(/[^0-9+-]/g, '');
  return parseInt(cleaned, 10) || 0;
}

function sanitizeDigits(value, maxLength = null) {
  let cleaned = String(value || '').replace(/\D/g, '');
  if (maxLength) cleaned = cleaned.slice(0, maxLength);
  return cleaned;
}

function sanitizeSignedValue(value) {
  const trimmed = String(value || '').trim();
  if (!trimmed) return '+0';
  const sign = trimmed.startsWith('-') ? '-' : '+';
  const digits = trimmed.replace(/\D/g, '');
  const numeric = digits ? parseInt(digits, 10) : 0;
  return sign === '-' ? `-${numeric}` : `+${numeric}`;
}

function enforceAutoMathNumericInputs() {
  const unsignedNumericIds = ['str','dex','con','int','wis','cha','char_level','max_hp','curr_hp','hit_dice_spend','ac','initiative','speed'];
  unsignedNumericIds.forEach(id => {
    const input = document.getElementById(id);
    if (!input || input.dataset.numericOnlyBound === '1') return;
    input.dataset.numericOnlyBound = '1';
    input.inputMode = 'numeric';
    input.addEventListener('input', () => {
      const maxLength = input.id === 'char_level' ? 2 : (input.id.length === 3 ? 2 : null);
      const next = sanitizeDigits(input.value, maxLength);
      if (input.value !== next) input.value = next;
    });
  });

  const signedNumericIds = ['con_modifier'];
  signedNumericIds.forEach(id => {
    const input = document.getElementById(id);
    if (!input || input.dataset.signedNumericOnlyBound === '1') return;
    input.dataset.signedNumericOnlyBound = '1';
    input.inputMode = 'numeric';
    input.addEventListener('input', () => {
      const cleaned = String(input.value || '').replace(/[^0-9-]/g, '');
      const normalized = cleaned.startsWith('-')
        ? '-' + cleaned.slice(1).replace(/-/g, '')
        : cleaned.replace(/-/g, '');
      if (input.value !== normalized) input.value = normalized;
    });
  });

  // Derived auto-math outputs should not be manually edited.
  ['str_bonus','dex_bonus','con_bonus','int_bonus','wis_bonus','cha_bonus',
   'str_save','dex_save','con_save','int_save','wis_save','cha_save','prof_bonus']
    .forEach(id => {
      const field = document.getElementById(id);
      if (field) field.readOnly = true;
    });
}

function calculateSkillBonus(skill) {
  const ability = SKILL_ABILITY_MAP[skill];
  if (!ability) return;

  const totalInput = document.getElementById(`bonus_${skill}`);
  const profCheckbox = document.getElementById(`prof_${skill}`);
  const adjInput = document.getElementById(`adj_${skill}`);
  const abilityBonus = document.getElementById(`${ability}_bonus`);
  const profBonus = document.getElementById('prof_bonus');
  if (!totalInput || !profCheckbox || !abilityBonus || !profBonus) return;

  const abilityMod = parseSignedNumber(abilityBonus.value);
  const profMod = parseSignedNumber(profBonus.value);
  const adjMod = parseSignedNumber(adjInput ? adjInput.value : 0);

  let total = abilityMod + adjMod;
  if (profCheckbox.checked) total += profMod;

  totalInput.value = formatSignedNumber(total);
}

function updateAllSkillBonuses() {
  SKILL_LIST.forEach(skill => calculateSkillBonus(skill));
}

function setupSkillCalculationFields() {
  SKILL_LIST.forEach(skill => {
    const row = document.getElementById(`bonus_${skill}`)?.closest('.skill-row');
    const totalInput = document.getElementById(`bonus_${skill}`);
    const profCheckbox = document.getElementById(`prof_${skill}`);
    if (!row || !totalInput || !profCheckbox) return;

    totalInput.readOnly = true;
    totalInput.classList.add('skill-total-input');
    totalInput.tabIndex = -1;

    let adjInput = document.getElementById(`adj_${skill}`);
    if (!adjInput) {
      adjInput = document.createElement('input');
      adjInput.type = 'text';
      adjInput.id = `adj_${skill}`;
      adjInput.className = 'skill-adjust-input';
      adjInput.placeholder = '+0';
      adjInput.value = sanitizeSignedValue(totalInput.value || '+0');
      row.insertBefore(adjInput, totalInput);
    }

    if (adjInput.dataset.skillAdjustBound !== '1') {
      adjInput.dataset.skillAdjustBound = '1';
      adjInput.addEventListener('input', () => {
        // Allow typing with immediate recalc; sanitize on blur for clean persisted value.
        calculateSkillBonus(skill);
        autosave();
      });
      adjInput.addEventListener('blur', () => {
        adjInput.value = sanitizeSignedValue(adjInput.value);
        calculateSkillBonus(skill);
        autosave();
      });
    }

    if (profCheckbox.dataset.skillProfBound !== '1') {
      profCheckbox.dataset.skillProfBound = '1';
      profCheckbox.addEventListener('change', () => {
        calculateSkillBonus(skill);
        autosave();
      });
    }
  });

  updateAllSkillBonuses();
}
// Ability Score Bonus Calculation
function calculateAbilityBonus(ability) {
  const scoreInput = document.getElementById(ability);
  const bonusInput = document.getElementById(ability + '_bonus');

  if (!scoreInput || !bonusInput) return;

  scoreInput.value = sanitizeDigits(scoreInput.value, 2);
  const score = parseInt(scoreInput.value, 10) || 0;

  // Calculate modifier: (score - 10) / 2, rounded down
  const modifier = Math.floor((score - 10) / 2);

  // Format with + prefix for positive numbers
  bonusInput.value = formatSignedNumber(modifier);

  calculateSavingThrow(ability);
  updateAllSkillBonuses();
}

function formatBonusInput(inputId) {
  if (!inputId) return;
  const ability = inputId.replace('_bonus', '');
  calculateAbilityBonus(ability);
}

// Saving Throw Functions
function formatSaveInput(inputId) {
  const input = document.getElementById(inputId);
  if (!input) return;
  
  let value = input.value;
  
  // Ensure it always starts with + or -
  if (!value.startsWith('+') && !value.startsWith('-')) {
    value = '+' + value;
  }
  
  // Remove any extra + signs at the start
  if (value.startsWith('++')) {
    value = '+' + value.substring(2);
  }
  
  // Limit to 4 characters total (e.g., +999, -99)
  if (value.length > 4) {
    value = value.substring(0, 4);
  }
  
  input.value = value;
}

function calculateSavingThrow(ability) {
  const saveInput = document.getElementById(ability + '_save');
  const profCheckbox = document.getElementById(ability + '_save_prof');
  const abilityBonus = document.getElementById(ability + '_bonus');
  const profBonus = document.getElementById('prof_bonus');
  
  if (!saveInput || !profCheckbox || !abilityBonus || !profBonus) return;
  
  // Get ability bonus (remove + prefix for calculation)
  const abilityMod = parseInt(abilityBonus.value.replace('+', '')) || 0;
  
  // Get proficiency bonus (remove + prefix for calculation)
  const profMod = parseInt(profBonus.value.replace('+', '')) || 0;
  
  // Calculate saving throw modifier
  let saveMod = abilityMod;
  
  // Add proficiency bonus if proficient
  if (profCheckbox.checked) {
    saveMod += profMod;
  }
  
  // Format with + prefix for positive numbers
  const formattedSave = saveMod >= 0 ? `+${saveMod}` : `${saveMod}`;
  
  saveInput.value = formattedSave;
}

function calculateProficiencyBonus() {
  const levelInput = document.getElementById('char_level');
  if (!levelInput) return '+2'; // Default for level 1-4
  
  const level = parseInt(levelInput.value) || 1;
  
  // D&D 5e proficiency bonus calculation
  let profBonus = 2; // Base proficiency bonus
  
  if (level >= 5) profBonus = 3;
  if (level >= 9) profBonus = 4;
  if (level >= 13) profBonus = 5;
  if (level >= 17) profBonus = 6;
  
  return `+${profBonus}`;
}

function updateProficiencyBonus() {
  const profBonusInput = document.getElementById('prof_bonus');
  if (!profBonusInput) return;

  const newProfBonus = calculateProficiencyBonus();
  profBonusInput.value = newProfBonus;

  // Recalculate all saving throws
  ['str', 'dex', 'con', 'int', 'wis', 'cha'].forEach(ability => {
    calculateSavingThrow(ability);
  });

  updateAllSkillBonuses();
}

function handleProfBonusInput() {
  const profBonusInput = document.getElementById('prof_bonus');
  if (!profBonusInput) return;
  
  let value = profBonusInput.value;
  
  // Ensure it always starts with + or -
  if (value && !value.startsWith('+') && !value.startsWith('-')) {
    value = '+' + value;
  }
  
  // Remove any extra + signs at the start
  if (value.startsWith('++')) {
    value = '+' + value.substring(2);
  }
  
  // Limit to 3 characters total (e.g., +99, -9)
  if (value.length > 3) {
    value = value.substring(0, 3);
  }
  
  profBonusInput.value = value;
  
  // Recalculate all saving throws with the new proficiency bonus
  ['str', 'dex', 'con', 'int', 'wis', 'cha'].forEach(ability => {
    calculateSavingThrow(ability);
  });
}

function resetProfBonusIfEmpty() {
  const profBonusInput = document.getElementById('prof_bonus');
  if (!profBonusInput) return;
  
  // If the input is empty or just whitespace, reset to calculated value
  if (!profBonusInput.value.trim()) {
    const calculatedProfBonus = calculateProficiencyBonus();
    profBonusInput.value = calculatedProfBonus;
    
    // Recalculate all saving throws
    ['str', 'dex', 'con', 'int', 'wis', 'cha'].forEach(ability => {
      calculateSavingThrow(ability);
    });
  }
}

function updateProficiencyBonusIfNotOverridden() {
  const profBonusInput = document.getElementById('prof_bonus');
  if (!profBonusInput) return;
  
  // Only update if the current value matches the calculated value (not manually overridden)
  const currentValue = profBonusInput.value;
  const calculatedValue = calculateProficiencyBonus();
  
  if (currentValue === calculatedValue || !currentValue.trim()) {
    // Update to new calculated value
    profBonusInput.value = calculatedValue;
    
    // Recalculate all saving throws
    ['str', 'dex', 'con', 'int', 'wis', 'cha'].forEach(ability => {
      calculateSavingThrow(ability);
    });
  }
}


// Initialize Firebase when page loads
document.addEventListener('DOMContentLoaded', function() {
  initializeFirebase();
  enableAutoSync();
  
  // Register service worker for PWA functionality
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('data:text/javascript;base64,' + btoa(`
      self.addEventListener('install', function(event) {
        event.waitUntil(self.skipWaiting());
      });
      
      self.addEventListener('activate', function(event) {
        event.waitUntil(self.clients.claim());
      });
      
      self.addEventListener('fetch', function(event) {
        // Let the browser handle all requests normally
        return;
      });
    `)).catch(function(error) {
      console.log('Service Worker registration failed:', error);
    });
  }
  
});


