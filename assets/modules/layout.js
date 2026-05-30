
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

// NOTE_BOX_SELECTOR, NOTE_BOX_MAX_CHARS, noteBoxPopupState are declared in core.js

function getCharCount(text) {
  return text ? text.length : 0;
}

function getNoteBoxBaselineFromCSS(textarea) {
  const style = window.getComputedStyle(textarea);
  const minHeight = parseFloat(style.minHeight) || 0;
  const rootStyle = window.getComputedStyle(document.documentElement);
  const cssDefault = parseFloat(rootStyle.getPropertyValue('--note-default-height')) || 0;
  let fallback = cssDefault || 120;
  if (textarea.classList.contains('notes-textarea')) fallback = Math.max(fallback, 160);
  if (textarea.classList.contains('table-notes')) fallback = Math.max(fallback, 100);
  return Math.max(minHeight, fallback);
}

function getNoteBoxDefaultHeight(textarea) {
  const baseline = getNoteBoxBaselineFromCSS(textarea);
  const forced = parseFloat(textarea.dataset.noteBaseHeight);
  if (!Number.isNaN(forced) && forced > 0) {
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
  textarea.style.setProperty('height', 'auto', 'important');
  const desired = Math.max(defaultHeight, textarea.scrollHeight + 12);
  textarea.style.setProperty('height', `${desired}px`, 'important');

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
