// ========== SIDE RAIL ==========
// Behaviour of the left navigation rail: collapse/expand (desktop, remembered), the labelled
// overlay on phones, live vitals (a read-only mirror of the sheet's own fields) and
// aria-current on the active tab, plus phone auto-hide, tab swipe, keyboard shortcuts (1-5, H)
// and the smaller banner. It never writes character data and never calls autosave.
(function () {
  'use strict';

  const root = document.documentElement;
  const KEY = 'dndRailCompact';                       // UI preference only (not character data)
  const isPhone = () => !!(window.matchMedia && window.matchMedia('(max-width: 760px), (max-height: 520px)').matches);
  const val = id => { const e = document.getElementById(id); return e ? String(e.value || '').trim() : ''; };
  const num = s => { const n = parseInt(String(s).replace('+', ''), 10); return isNaN(n) ? null : n; };

  let rail, toggle, scrim;

  // ---- collapse (desktop) / overlay (phone) ----
  function readCompact() { try { return localStorage.getItem(KEY) === '1'; } catch (e) { return false; } }
  function writeCompact(on) { try { localStorage.setItem(KEY, on ? '1' : '0'); } catch (e) { /* private mode: fine */ } }
  function applyCompact() { if (readCompact() && !isPhone()) root.dataset.rail = 'compact'; else delete root.dataset.rail; }

  function setOpen(open) {
    if (!rail) return;
    if (open && !isPhone()) return;
    rail.dataset.open = open ? 'true' : 'false';
    if (toggle) toggle.setAttribute('aria-expanded', String(open || (!isPhone() && root.dataset.rail !== 'compact')));
    if (scrim) scrim.hidden = !open;
  }

  function onToggle() {
    if (isPhone()) { setOpen(rail.dataset.open !== 'true'); return; }
    const compact = root.dataset.rail === 'compact';
    writeCompact(!compact); applyCompact();
    toggle.setAttribute('aria-expanded', String(compact));       // was compact -> now expanded
    setTimeout(() => window.dispatchEvent(new Event('resize')), 300);
  }

  const reduced = () => !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const buzz = () => { if (navigator.vibrate && !reduced()) { try { navigator.vibrate(8); } catch (e) { /* unsupported */ } } };
  const $ = id => document.getElementById(id);

  // ---- vitals mirror ----
  let lastHp = null;
  function currentRoute() { const p = document.querySelector('.page.active'); return p ? p.id : 'home'; }
  function syncVitals() {
    const box = document.getElementById('grRailVitals'); if (!box) return;
    const route = currentRoute();
    const sheetPage = route !== 'home' && route !== 'settings' && route !== 'admin';
    const show = sheetPage && !!window.currentCharacter && !!val('char_name');
    box.hidden = !show;
    if (!show) return;

    const cur = num(val('curr_hp')); const max = num(val('max_hp'));
    const hp = document.getElementById('grRvHp'); const txt = document.getElementById('grRvHpText');
    if (hp && txt && cur !== null) {
      const shown = max ? Math.min(cur, max) : cur;
      const temp = max && cur > max ? cur - max : 0;
      const ratio = max ? Math.max(0, Math.min(1, shown / max)) : 1;
      const level = ratio > 0.6 ? 'ok' : ratio > 0.3 ? 'mid' : 'low';
      hp.style.setProperty('--v', Math.round(ratio * 100) + '%');
      if (hp.dataset.level !== level) hp.dataset.level = level;
      const want = (max ? shown + '/' + max : String(shown)) + (temp ? ' +' + temp : '');
      if (txt.textContent !== want) txt.textContent = want;
      if (lastHp !== null && lastHp !== shown) {
        hp.classList.remove('is-heal', 'is-harm'); void hp.offsetWidth; hp.classList.add(shown > lastHp ? 'is-heal' : 'is-harm');
        setTimeout(() => hp.classList.remove('is-heal', 'is-harm'), 800);
      }
      lastHp = shown;
    }
    const ac = val('ac'); const acEl = document.getElementById('grRvAcText'); if (acEl) { const w = ac || '–'; if (acEl.textContent !== w) acEl.textContent = w; }
  }

  // ---- accessibility: aria-current follows the active tab ----
  function syncAria() {
    document.querySelectorAll('.gr-rail .tabs button').forEach(b => {
      if (b.classList.contains('active')) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
    });
  }

  // ---- phones: the rail slides away while you scroll down and returns on scroll up ----
  function initAutoHide() {
    let lastY = window.scrollY, ticking = false;
    const show = () => { if (root.hasAttribute('data-rail-hidden')) root.removeAttribute('data-rail-hidden'); };
    const hide = () => { if (!root.hasAttribute('data-rail-hidden')) root.setAttribute('data-rail-hidden', ''); };
    const typing = () => { const a = document.activeElement; return !!a && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName); };
    function step() {
      ticking = false;
      const y = window.scrollY, dy = y - lastY;
      if (!isPhone() || (rail && rail.dataset.open === 'true') || typing() || y < 80) { show(); lastY = y; return; }
      if (dy > 10) { hide(); lastY = y; } else if (dy < -10) { show(); lastY = y; }
    }
    window.addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(step); } }, { passive: true });
    window.addEventListener('resize', () => { if (!isPhone()) show(); });
    document.addEventListener('focusin', () => { if (typing()) show(); });
  }

  // ---- tab order shared by swipe and the number keys ----
  const TABS = ['page1', 'page2', 'page3', 'page4', 'page6'];
  const sheetReady = () => !!window.currentCharacter && !!document.getElementById('chrome-root') && document.getElementById('chrome-root').offsetParent !== null;
  const overlayOpen = () => !!document.querySelector('.popup.show, .dm-modal-backdrop, .dm-modal, .section-help-panel.open');
  function goTab(id) { const b = document.querySelector('.gr-rail .tabs button[data-tab="' + id + '"]'); if (b && !b.classList.contains('active')) b.click(); }
  function currentTabIndex() { const p = document.querySelector('.page.active'); return p ? TABS.indexOf(p.id) : -1; }

  // ---- swipe left/right between tabs (touch screens) ----
  function initSwipe() {
    if (!(window.matchMedia && window.matchMedia('(pointer: coarse)').matches)) return;
    let x0 = 0, y0 = 0, t0 = 0, ok = false;
    const scrollableX = el => {
      for (let n = el; n && n !== document.body; n = n.parentElement) {
        if (n.scrollWidth > n.clientWidth + 4) { const ox = getComputedStyle(n).overflowX; if (ox === 'auto' || ox === 'scroll') return true; }
      }
      return false;
    };
    document.addEventListener('touchstart', e => {
      ok = false;
      if (e.touches.length !== 1) return;
      const t = e.touches[0], tgt = e.target;
      if (t.clientX < 28 || t.clientX > window.innerWidth - 28) return;                  // leave the screen edges to the browser's back gesture
      if (!tgt.closest || tgt.closest('#grRail, input, textarea, select, [contenteditable], [draggable="true"], .switch, input[type=range], .lb-viewport, table')) return;
      if (scrollableX(tgt) || overlayOpen() || currentTabIndex() < 0 || !sheetReady()) return;
      x0 = t.clientX; y0 = t.clientY; t0 = Date.now(); ok = true;
    }, { passive: true });
    document.addEventListener('touchend', e => {
      if (!ok) return; ok = false;
      const t = e.changedTouches[0], dx = t.clientX - x0, dy = t.clientY - y0;
      if (Date.now() - t0 > 600 || Math.abs(dx) < 80 || Math.abs(dx) < Math.abs(dy) * 2) return;
      const sel = window.getSelection && window.getSelection(); if (sel && String(sel).length) return;
      const i = currentTabIndex(), j = i + (dx < 0 ? 1 : -1);
      if (j >= 0 && j < TABS.length) { buzz(); goTab(TABS[j]); }
    }, { passive: true });
  }

  // ---- desktop keyboard shortcuts: 1-5 = tabs, H = Home ----
  function initKeys() {
    document.addEventListener('keydown', e => {
      if (e.ctrlKey || e.metaKey || e.altKey || e.shiftKey || e.repeat) return;
      const a = document.activeElement;
      if (a && (/^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName) || a.isContentEditable)) return;
      if (overlayOpen() || !document.getElementById('chrome-root') || document.getElementById('chrome-root').offsetParent === null) return;
      if (e.key === 'h' || e.key === 'H') { if (typeof showHomePage === 'function') { e.preventDefault(); showHomePage(); } return; }
      if (e.key >= '1' && e.key <= '5' && window.currentCharacter) { e.preventDefault(); goTab(TABS[parseInt(e.key, 10) - 1]); }
    });
  }

  // ---- rolling banner: shrink to a thin strip (remembered; shrunk by default on phones) ----
  const BKEY = 'dndBannerMin';
  function bannerPref() { try { return localStorage.getItem(BKEY); } catch (e) { return null; } }
  function applyBanner() {
    const pref = bannerPref(); const min = pref === null ? isPhone() : pref === '1';
    if (min) root.dataset.banner = 'min'; else delete root.dataset.banner;
    const b = $('grBannerToggle'); if (b) { b.setAttribute('aria-expanded', String(!min)); b.setAttribute('aria-label', min ? 'Expand banner' : 'Shrink banner'); }
  }
  function initBanner() {
    const b = $('grBannerToggle'); if (!b) return;
    applyBanner();
    b.addEventListener('click', () => { const min = root.dataset.banner === 'min'; try { localStorage.setItem(BKEY, min ? '0' : '1'); } catch (e) { /* private mode: fine */ } applyBanner(); });
    window.addEventListener('resize', applyBanner);
  }

  function init() {
    rail = document.getElementById('grRail'); toggle = document.getElementById('grRailToggle'); scrim = document.getElementById('grRailScrim');
    if (!rail) return;
    applyCompact();
    if (toggle) toggle.setAttribute('aria-expanded', String(!isPhone() && root.dataset.rail !== 'compact'));
    if (toggle) toggle.addEventListener('click', onToggle);
    if (scrim) scrim.addEventListener('click', () => setOpen(false));
    // choosing anything closes the phone overlay
    rail.addEventListener('click', e => { if (rail.dataset.open === 'true' && e.target.closest && e.target.closest('.tabs button, .gr-rail-btn')) setTimeout(() => setOpen(false), 120); });
    document.addEventListener('keydown', e => { if (e.key === 'Escape') setOpen(false); });
    window.addEventListener('resize', () => { applyCompact(); if (!isPhone()) setOpen(false); });
    window.addEventListener('orientationchange', () => setTimeout(() => { applyCompact(); setOpen(false); }, 200));
    const nav = rail.querySelector('.gr-rail-tabs');
    if (nav && 'MutationObserver' in window) new MutationObserver(syncAria).observe(nav, { attributes: true, subtree: true, attributeFilter: ['class'] });
    syncAria(); syncVitals();
    initAutoHide(); initSwipe(); initKeys(); initBanner();
    ['input', 'change', 'click'].forEach(t => document.addEventListener(t, () => requestAnimationFrame(() => { syncVitals(); syncAria(); }), true));
    setInterval(() => { syncVitals(); syncAria(); }, 700);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
  window.railUI = { syncVitals, setOpen, applyCompact };
})();
