// ========== GRIMOIRE UI LAYER ==========
// Presentation only. Reads the sheet's existing fields to show live vitals in the top bar,
// moves the navigation highlight, and adds entrance/feedback animation. It never writes
// character data and never calls autosave. Safe to remove: the sheet works without it.
(function () {
  'use strict';

  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));
  const reduceMotion = () => window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const ROUTE_BY_PAGE = { home: 'home', settings: 'settings', page1: 'stats', page2: 'background', page3: 'spells', page4: 'inventory', page6: 'notes' };

  // ---- the old accent/background switching is retired: the grimoire palette is fixed ----
  function lockTheme() {
    try {
      const s = document.getElementById('bg-pseudo-style'); if (s) s.remove();
      document.documentElement.classList.remove('has-bg-image');
      document.documentElement.removeAttribute('data-theme');
    } catch (e) { /* cosmetic only */ }
  }

  // ---- route + page entrance ----
  function currentRoute() {
    const p = $('.page.active') || $$('.page').find(el => el.style.display === 'block');
    return (p && ROUTE_BY_PAGE[p.id]) || document.body.dataset.route || 'home';
  }

  function animateEntrance(pageEl) {
    if (!pageEl || reduceMotion()) return;
    const cards = $$('.section, .home-card, .gr-card, .gr-rise-in', pageEl).filter(el => el.offsetParent !== null).slice(0, 14);
    cards.forEach((el, i) => { el.style.setProperty('--i', String(i)); el.classList.remove('gr-rise'); void el.offsetWidth; el.classList.add('gr-rise'); });
    setTimeout(() => cards.forEach(el => { el.classList.remove('gr-rise'); el.style.removeProperty('--i'); }), 900);
  }

  let lastRoute = null;
  function onRoute() {
    const route = currentRoute();
    document.body.dataset.route = route;
    placeNavIndicator();
    if (route !== lastRoute) {
      lastRoute = route;
      const page = $('.page.active') || $$('.page').find(el => el.style.display === 'block');
      animateEntrance(page);
    }
    syncVitals();
  }

  // ---- sliding navigation highlight ----
  function placeNavIndicator() {
    const nav = $('.gr-nav'); const ind = $('.gr-nav-ind');
    if (!nav || !ind) return;
    const active = $('.gr-nav .tab.active');
    if (!active) { nav.classList.remove('has-active'); return; }
    const nr = nav.getBoundingClientRect(); const ar = active.getBoundingClientRect();
    if (!ar.width) return;
    ind.style.setProperty('--x', (ar.left - nr.left) + 'px');
    ind.style.setProperty('--y', (ar.top - nr.top) + 'px');
    ind.style.setProperty('--w', ar.width + 'px');
    ind.style.setProperty('--h', ar.height + 'px');
    nav.classList.add('has-active');
  }

  // ---- live identity + vitals (read-only view of the sheet's own fields) ----
  const val = id => { const e = document.getElementById(id); return e ? String(e.value || '').trim() : ''; };
  const num = s => { const n = parseInt(String(s).replace('+', ''), 10); return isNaN(n) ? null : n; };
  const setText = (id, text) => { const e = document.getElementById(id); if (e && e.textContent !== text) e.textContent = text; return e; };

  let lastHp = null; let hpAnimUntil = 0;
  function animateNumber(el, from, to, ms) {
    if (!el || reduceMotion() || from === to) { if (el) el.textContent = String(to); return; }
    const t0 = performance.now();
    const step = now => {
      const k = Math.min(1, (now - t0) / ms); const e = 1 - Math.pow(1 - k, 3);
      el.textContent = String(Math.round(from + (to - from) * e));
      if (k < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  function syncVitals() {
    const route = document.body.dataset.route || 'home';
    const name = val('char_name');
    const loaded = !!window.currentCharacter || !!name;
    const vitals = document.getElementById('grVitals');

    if (route === 'home') { setText('grIdentName', 'Grimoire'); setText('grIdentSub', 'Choose a character to begin'); }
    else if (route === 'settings') { setText('grIdentName', 'Settings'); setText('grIdentSub', 'Account, sync and backups'); }
    else if (loaded && name) {
      setText('grIdentName', name);
      const parts = [val('char_race'), val('char_class') + (val('char_level') ? ' ' + val('char_level') : '')].filter(Boolean);
      const l2 = val('char_level2'); const c2 = val('char_class2');
      if (c2 && l2) parts[1] = (parts[1] || '') + ' / ' + c2 + ' ' + l2;
      setText('grIdentSub', parts.join(' · ') || 'Character sheet');
    } else { setText('grIdentName', 'Grimoire'); setText('grIdentSub', 'No character loaded'); }

    const showVitals = loaded && !!name && route !== 'home' && route !== 'settings';
    if (vitals) vitals.hidden = !showVitals;
    if (!showVitals) return;

    // hit points: temp HP is stored as "current above max"
    const cur = num(val('curr_hp')); const max = num(val('max_hp'));
    const hpEl = document.getElementById('grVitalHp');
    if (hpEl && cur !== null) {
      const shown = max ? Math.min(cur, max) : cur;
      const temp = max && cur > max ? cur - max : 0;
      const ratio = max ? Math.max(0, Math.min(1, shown / max)) : 1;
      const level = ratio > 0.6 ? 'ok' : ratio > 0.3 ? 'mid' : 'low';
      hpEl.style.setProperty('--v', Math.round(ratio * 100) + '%');
      if (hpEl.dataset.level !== level) hpEl.dataset.level = level;
      const txt = document.getElementById('grHpText');
      const want = max ? shown + '/' + max : String(shown);
      if (txt) {
        if (lastHp !== null && lastHp !== shown) {
          hpAnimUntil = performance.now() + 470;
          animateNumber(txt, lastHp, shown, 420);
          setTimeout(() => { txt.textContent = max ? (num(val('curr_hp')) !== null ? Math.min(num(val('curr_hp')), max) + '/' + max : want) : want; }, 480);
          hpEl.classList.remove('is-heal', 'is-harm'); void hpEl.offsetWidth; hpEl.classList.add(shown > lastHp ? 'is-heal' : 'is-harm');
          setTimeout(() => hpEl.classList.remove('is-heal', 'is-harm'), 800);
        } else if (performance.now() > hpAnimUntil && txt.textContent !== want) {
          txt.textContent = want;
        }
      }
      lastHp = shown;
      const tEl = document.getElementById('grHpTemp'); if (tEl) { tEl.hidden = !temp; tEl.textContent = temp ? '+' + temp : ''; }
    }
    const ac = val('ac'); setText('grAcText', ac || '–');
    const init = val('initiative'); setText('grInitText', init ? (num(init) >= 0 && init[0] !== '+' ? '+' + init : init) : '–');
  }

  // ---- cloud sync pill ----
  function syncStatus() {
    const el = document.getElementById('grSync'); if (!el) return;
    const online = navigator.onLine !== false; const signed = !!window.currentUser;
    const state = !online ? 'offline' : (signed ? 'ok' : 'local');
    if (el.dataset.state !== state) {
      el.dataset.state = state;
      el.title = state === 'ok' ? 'Synced to your account' : state === 'offline' ? 'Offline: changes saved on this device' : 'Saved on this device (sign in to sync)';
      const use = el.querySelector('use'); if (use) use.setAttribute('href', 'assets/icons.svg#' + (state === 'offline' ? 'i-cloud-off' : 'i-cloud'));
    }
  }

  // ---- wiring ----
  let raf = 0;
  function schedule() { if (raf) return; raf = requestAnimationFrame(() => { raf = 0; syncVitals(); syncStatus(); }); }

  function wrapRouteFn(name) {
    const f = window[name];
    if (typeof f !== 'function' || f.__gr) return;
    const w = function () { const r = f.apply(this, arguments); setTimeout(onRoute, 40); setTimeout(onRoute, 340); return r; };
    w.__gr = true; window[name] = w;
  }

  function init() {
    lockTheme();
    ['switchTab', 'showHomePage', 'openSettingsPage', 'loadSelectedCharacter'].forEach(wrapRouteFn);
    document.addEventListener('input', schedule, true);
    document.addEventListener('change', schedule, true);
    document.addEventListener('click', () => setTimeout(schedule, 60), true);
    window.addEventListener('hashchange', () => setTimeout(onRoute, 60));
    window.addEventListener('resize', placeNavIndicator);
    window.addEventListener('online', syncStatus); window.addEventListener('offline', syncStatus);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(placeNavIndicator);
    setInterval(() => { syncVitals(); syncStatus(); placeNavIndicator(); }, 900);
    setTimeout(onRoute, 120); setTimeout(onRoute, 700); setTimeout(lockTheme, 1500);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
  window.grimoireUI = { onRoute, syncVitals, placeNavIndicator, animateEntrance, animateNumber };
})();
