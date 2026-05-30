
// Disable source map loading to prevent D&D Beyond errors
if (typeof window !== 'undefined') {
  const originalError = console.error;
  console.error = function(...args) {
    const message = args.join(' ');
    if (!message.includes('source map') && !message.includes('dndbeyond.com')) {
      originalError.apply(console, args);
    }
  };

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
    if (section.classList.contains('character-info-section')) return;

    section.classList.add('resizable-container');

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
          if (!window.activeResizeSection) { window.resizeSyncLoop = null; return; }
          const container = window.activeResizeSection.closest('.flex-wrap');
          if (container) syncFlexWrapHeights(container);
          window.resizeSyncLoop = requestAnimationFrame(loop);
        };
        window.resizeSyncLoop = requestAnimationFrame(loop);
      }
    });
    section.addEventListener('touchstart', () => {
      window.activeResizeSection = section;
      if (!window.resizeSyncLoop) {
        const loop = () => {
          if (!window.activeResizeSection) { window.resizeSyncLoop = null; return; }
          const container = window.activeResizeSection.closest('.flex-wrap');
          if (container) syncFlexWrapHeights(container);
          window.resizeSyncLoop = requestAnimationFrame(loop);
        };
        window.resizeSyncLoop = requestAnimationFrame(loop);
      }
    });
    section.addEventListener('pointerdown', () => {
      window.activeResizeSection = section;
      if (!window.resizeSyncLoop) {
        const loop = () => {
          if (!window.activeResizeSection) { window.resizeSyncLoop = null; return; }
          const container = window.activeResizeSection.closest('.flex-wrap');
          if (container) syncFlexWrapHeights(container);
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
    if (baseHeight) container.style.minHeight = `${baseHeight}px`;
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
