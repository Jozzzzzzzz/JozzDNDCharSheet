// ========== SIDE RAIL ==========
// Behaviour of the left navigation rail: collapse/expand (desktop, remembered), the labelled
// overlay on phones, live vitals (a read-only mirror of the sheet's own fields) and
// aria-current on the active tab. It never writes character data and never calls autosave.
(function () {
  'use strict';

  const root = document.documentElement;
  const KEY = 'dndRailCompact';                       // UI preference only (not character data)
  const isPhone = () => !!(window.matchMedia && window.matchMedia('(max-width: 760px)').matches);
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

  // ---- vitals mirror ----
  let lastHp = null;
  function currentRoute() { const p = document.querySelector('.page.active'); return p ? p.id : 'home'; }
  function syncVitals() {
    const box = document.getElementById('grRailVitals'); if (!box) return;
    const route = currentRoute();
    const sheetPage = route !== 'home' && route !== 'settings';
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
    ['input', 'change', 'click'].forEach(t => document.addEventListener(t, () => requestAnimationFrame(() => { syncVitals(); syncAria(); }), true));
    setInterval(() => { syncVitals(); syncAria(); }, 700);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
  window.railUI = { syncVitals, setOpen, applyCompact };
})();
