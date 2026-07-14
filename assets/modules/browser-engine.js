// ========== SHARED LIST BROWSER ENGINE ==========
// A reusable browser for large catalogues (items, monsters): typo-tolerant fuzzy search,
// category filter chips, sort, a live result count, and a virtualized scroll list so even
// ~2,800 rows stay smooth. Both the item picker (inventory.js) and the DM monster browser
// (dm.js) drive their UI through createListBrowser(config).
//
// No dependencies, all globals (matches the rest of the app). Pure UI over an in-memory
// array — never touches saved character data.

// --- fuzzy matching ---------------------------------------------------------------

// Subsequence + typo-tolerant score of `query` against `text`. Returns a number where
// higher = better, or -1 for no match. Rewards: exact substring, word-start hits,
// contiguous runs. Tolerates small misspellings via a light Levenshtein fallback on
// individual words so "firebal"→"fireball", "gobln"→"goblin" still match.
function fuzzyScore(query, text) {
  if (!query) return 0;
  query = query.toLowerCase();
  text = (text || '').toLowerCase();
  if (!text) return -1;

  // Fast paths.
  const idx = text.indexOf(query);
  if (idx === 0) return 1000;              // prefix — best
  if (idx > 0) return 700 - Math.min(idx, 200); // substring — strong, earlier is better

  // Word-start acronym / token match (e.g. "gc" → "Giant Crab").
  const words = text.split(/[^a-z0-9]+/).filter(Boolean);
  const starts = words.map(w => w[0]).join('');
  if (starts.includes(query)) return 500;

  // Subsequence match (all chars appear in order).
  let ti = 0, hits = 0, runBonus = 0, lastHit = -2;
  for (let qi = 0; qi < query.length; qi++) {
    const c = query[qi];
    let found = -1;
    for (let k = ti; k < text.length; k++) { if (text[k] === c) { found = k; break; } }
    if (found === -1) { hits = -1; break; }
    if (found === lastHit + 1) runBonus += 5;
    lastHit = found; ti = found + 1; hits++;
  }
  if (hits === query.length) return 300 + runBonus - (text.length - query.length) * 0.1;

  // Typo tolerance: allow up to `tol` edits on the best-matching single word.
  const tol = query.length <= 4 ? 1 : 2;
  let best = -1;
  for (const w of words) {
    if (Math.abs(w.length - query.length) > tol) continue;
    const d = levenshtein(query, w);
    if (d <= tol) best = Math.max(best, 200 - d * 40);
  }
  return best;
}

// Small bounded Levenshtein (cheap; words are short).
function levenshtein(a, b) {
  const m = a.length, n = b.length;
  if (!m) return n; if (!n) return m;
  let prev = new Array(n + 1);
  for (let j = 0; j <= n; j++) prev[j] = j;
  for (let i = 1; i <= m; i++) {
    let cur = [i];
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
    }
    prev = cur;
  }
  return prev[n];
}

// --- the browser ------------------------------------------------------------------
//
// config = {
//   data: () => Array,                     // the full list (called each render)
//   root: HTMLElement,                     // where to render (list rows go here)
//   searchInput: HTMLInputElement,         // the search box
//   countEl, sortEl,                       // optional: result-count + sort <select>
//   searchFields: (item) => string,        // text used for fuzzy search
//   filters: [{ el, match(item, value) }], // dropdowns/chips; value read from el.value or el.dataset
//   sorts: { key: (a,b) => number },       // named comparators; sortEl.value picks one
//   rowHeight: number,                     // px, for virtualization
//   renderRow: (item) => htmlString,       // one row's inner HTML
//   onRowClick: (item) => void,            // click handler (row carries data-idx)
//   rowClass: string,                      // class for each row element
// }
function createListBrowser(config) {
  const state = { filtered: [], scrollBound: false };

  function currentFilters() {
    return (config.filters || []).map(f => ({
      match: f.match,
      value: f.el ? (f.el.value !== undefined ? f.el.value : f.el.dataset.value) : '',
    }));
  }

  function compute() {
    const all = config.data() || [];
    const q = (config.searchInput?.value || '').trim();
    const filters = currentFilters();

    let rows = all.filter(item => filters.every(f => f.match(item, f.value)));

    if (q) {
      rows = rows
        .map(item => ({ item, score: fuzzyScore(q, config.searchFields(item)) }))
        .filter(r => r.score >= 0)
        .sort((a, b) => b.score - a.score)
        .map(r => r.item);
    } else if (config.sorts && config.sortEl && config.sorts[config.sortEl.value]) {
      rows = rows.slice().sort(config.sorts[config.sortEl.value]);
    }

    state.filtered = rows;
    if (config.countEl) {
      config.countEl.textContent = `${rows.length} result${rows.length === 1 ? '' : 's'}`;
    }
    renderWindow();
  }

  // Virtualized render: only build the rows visible in the scroll viewport (+buffer).
  function renderWindow() {
    const root = config.root;
    if (!root) return;
    const rows = state.filtered;
    const rowH = config.rowHeight || 56;
    const total = rows.length;

    if (total === 0) {
      root.innerHTML = `<p class="lb-empty">${config.emptyText || 'No results. Try a different search or filters.'}</p>`;
      root.style.height = '';
      return;
    }

    const viewport = root.parentElement || root;
    const scrollTop = viewport.scrollTop || 0;
    const viewH = viewport.clientHeight || 400;
    const buffer = 6;
    const first = Math.max(0, Math.floor(scrollTop / rowH) - buffer);
    const visible = Math.ceil(viewH / rowH) + buffer * 2;
    const last = Math.min(total, first + visible);

    // A spacer sizes the scroll area; rows are absolutely positioned by index.
    let html = `<div class="lb-spacer" style="height:${total * rowH}px;position:relative;">`;
    for (let i = first; i < last; i++) {
      const item = rows[i];
      html += `<div class="${config.rowClass || 'lb-row'}" data-idx="${i}" style="position:absolute;top:${i * rowH}px;left:0;right:0;height:${rowH}px;">${config.renderRow(item)}</div>`;
    }
    html += '</div>';
    root.innerHTML = html;

    if (!state.scrollBound && viewport) {
      viewport.addEventListener('scroll', () => renderWindow(), { passive: true });
      state.scrollBound = true;
    }
  }

  // Wire events.
  if (config.searchInput) config.searchInput.addEventListener('input', compute);
  if (config.sortEl) config.sortEl.addEventListener('change', compute);
  (config.filters || []).forEach(f => { if (f.el && f.el.addEventListener) f.el.addEventListener('change', compute); });

  // Click delegation on the root → resolve the row's item and fire onRowClick.
  if (config.root && config.onRowClick) {
    config.root.addEventListener('click', e => {
      const row = e.target.closest('[data-idx]');
      if (!row) return;
      const item = state.filtered[parseInt(row.dataset.idx, 10)];
      if (item) config.onRowClick(item);
    });
  }

  // Recompute, then re-render once more after layout settles — covers the case where the
  // container had 0 height at first paint (e.g. a popup animating in) so the initial
  // viewport underfilled.
  function refresh() {
    compute();
    requestAnimationFrame(() => renderWindow());
  }

  return {
    refresh,                      // recompute + re-render (call after data loads / filter chip changes)
    getFiltered: () => state.filtered,
  };
}
