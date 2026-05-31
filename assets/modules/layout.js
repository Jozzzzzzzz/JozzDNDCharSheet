
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
  const sections = Array.from(container.children).filter(el => el.classList.contains('section'));
  if (sections.length === 0) return 0;

  // Reset to auto so we measure natural content height
  sections.forEach(section => {
    section.style.minHeight = '';
    section.style.height = 'auto';
    const ta = section.querySelector('textarea.basic-textarea');
    if (ta) ta.style.height = 'auto';
  });

  // Measure non-textarea overhead (h2 + padding) while still at natural height
  const overheadMap = new Map();
  sections.forEach(section => {
    const ta = section.querySelector('textarea.basic-textarea');
    if (ta) overheadMap.set(section, section.scrollHeight - ta.scrollHeight);
  });

  const contentHeight = Math.max(...sections.map(s => s.scrollHeight));
  const minHeight = parseInt(container.dataset.minHeight || '0', 10);
  const baseHeight = Math.max(contentHeight, minHeight);
  container.dataset.baseHeight = `${baseHeight}`;

  sections.forEach(section => {
    section.style.minHeight = `${baseHeight}px`;
    section.style.height = `${baseHeight}px`;
    const ta = section.querySelector('textarea.basic-textarea');
    if (ta) {
      const overhead = overheadMap.get(section) || 0;
      ta.style.height = `${baseHeight - overhead}px`;
    }
  });

  return baseHeight;
}

function syncFlexWrapHeights(container) {
  if (!isDesktopLayout()) return;
  const sections = Array.from(container.children).filter(el => el.classList.contains('section'));
  if (sections.length === 0) return;
  const baseHeight = parseInt(container.dataset.baseHeight || '0', 10);
  if (!baseHeight) return;
  sections.forEach(section => {
    section.style.minHeight = `${baseHeight}px`;
    section.style.height = `${baseHeight}px`;
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
  document.querySelectorAll('.flex-wrap').forEach(flexWrap => {
    const directSections = Array.from(flexWrap.children).filter(el => el.classList.contains('section'));
    directSections.forEach(section => {
      const ta = section.querySelector('textarea.basic-textarea');
      if (!ta) return;
      ta.addEventListener('input', function() {
        recalcFlexWrapBase(flexWrap);
        syncFlexWrapHeights(flexWrap);
      });
    });
  });
}

// Enable resizable containers
function makeContainersResizable() {
  document.querySelectorAll('.flex-wrap').forEach(container => {
    recalcFlexWrapBase(container);
    syncFlexWrapHeights(container);
  });

  window.addEventListener('resize', () => {
    if (!isDesktopLayout()) return;
    document.querySelectorAll('.flex-wrap').forEach(container => {
      recalcFlexWrapBase(container);
      syncFlexWrapHeights(container);
    });
  });
}
