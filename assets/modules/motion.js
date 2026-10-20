// ========== MOTION LAYER ==========
// Presentation only. Watches the sheet and adds temporary animation classes / overlay elements.
// It never writes a value, never calls autosave, and never changes layout or colours.
// Safe to remove: the sheet behaves exactly the same without it.
(function () {
  'use strict';

  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));
  const reduce = () => !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const visible = el => !!el && el.offsetParent !== null;

  // recent pointer/touch (a click that may have added something to a list)
  let lastPointerAt = 0;
  ['pointerdown', 'touchstart', 'mousedown'].forEach(t => window.addEventListener(t, () => { lastPointerAt = performance.now(); }, true));
  const pointerRecent = () => performance.now() - lastPointerAt < 900;

  // ---------------------------------------------------------------- page arrival + scroll reveal
  const CARD_SEL = '.section, .home-card, .hero-section, .welcome-section';
  const topLevelCards = page => $$(CARD_SEL, page).filter(el => visible(el) && !(el.parentElement && el.parentElement.closest(CARD_SEL)));
  let io = null;

  function choreograph(page) {
    if (!page || reduce()) return;
    const cards = topLevelCards(page);
    const vh = window.innerHeight || 800;
    const early = [], late = [];
    cards.forEach(el => (el.getBoundingClientRect().top < vh * 0.92 ? early : late).push(el));

    early.slice(0, 12).forEach((el, i) => {
      el.style.setProperty('--mo-i', String(i)); el.classList.remove('mo-enter'); void el.offsetWidth; el.classList.add('mo-enter');
    });
    setTimeout(() => early.forEach(el => { el.classList.remove('mo-enter'); el.style.removeProperty('--mo-i'); }), 1200);

    // everything below the fold waits and glides in as it scrolls into view
    if (io) { io.disconnect(); io = null; }
    if (!late.length || !('IntersectionObserver' in window)) return;
    late.forEach(el => el.classList.add('mo-pending'));
    const reveal = el => {
      if (!el.classList.contains('mo-pending')) return;
      el.classList.add('mo-revealing'); el.classList.remove('mo-pending');
      setTimeout(() => el.classList.remove('mo-revealing'), 760);
    };
    io = new IntersectionObserver(entries => entries.forEach(en => { if (en.isIntersecting) { reveal(en.target); io && io.unobserve(en.target); } }), { rootMargin: '0px 0px -6% 0px', threshold: 0.04 });
    late.forEach(el => io.observe(el));
    setTimeout(() => late.forEach(reveal), 4000); // failsafe: nothing stays hidden
  }

  let lastPageId = null;
  function onRoute(force) {
    const page = $('.page.active');
    if (!page) return;
    if (page.id !== lastPageId || force) {
      const changed = page.id !== lastPageId;
      lastPageId = page.id;
      choreograph(page);
      if (changed && window.scrollY > 60 && !reduce()) window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  function wrapFn(name, after) {
    const f = window[name];
    if (typeof f !== 'function' || f.__mo) return;
    const w = function () { const r = f.apply(this, arguments); try { after && after.apply(this, arguments); } catch (e) { /* cosmetic only */ } return r; };
    w.__mo = true; window[name] = w;
  }

  // ---------------------------------------------------------------- value change feedback
  const quiet = { until: 0 };
  const quietFor = ms => { quiet.until = performance.now() + ms; };
  const last = new Map();
  const WATCH_IDS = ['prof_bonus', 'initiative', 'passive_perception', 'spell_save_dc', 'spell_attack_bonus', 'ac', 'speed', 'max_hp', 'curr_hp', 'con_modifier',
    'str', 'dex', 'con', 'int', 'wis', 'cha', 'str_bonus', 'dex_bonus', 'con_bonus', 'int_bonus', 'wis_bonus', 'cha_bonus',
    'str_save', 'dex_save', 'con_save', 'int_save', 'wis_save', 'cha_save', 'char_level', 'char_level2'];

  function pulse(el, kind) {
    const cls = kind === 'heal' ? 'mo-pulse-heal' : kind === 'harm' ? 'mo-pulse-harm' : 'mo-pulse';
    el.classList.remove('mo-pulse', 'mo-pulse-heal', 'mo-pulse-harm'); void el.offsetWidth; el.classList.add(cls);
    setTimeout(() => el.classList.remove(cls), 780);
  }

  function floatText(el, text, kind) {
    const r = el.getBoundingClientRect(); if (!r.width) return;
    const s = document.createElement('span');
    s.className = 'mo-float mo-float--' + kind; s.textContent = text;
    s.style.left = (r.left + r.width / 2) + 'px'; s.style.top = (r.top - 4) + 'px';
    document.body.appendChild(s); setTimeout(() => s.remove(), 1150);
  }

  const num = v => { const n = parseInt(String(v).replace('+', '').replace('−', '-'), 10); return isNaN(n) ? null : n; };

  function scan() {
    if (reduce() || document.hidden) return;
    const els = WATCH_IDS.map(id => document.getElementById(id)).filter(Boolean).concat($$('input[id^="bonus_"]'));
    const now = performance.now();
    els.forEach(el => {
      const key = el.id; const v = el.value;
      if (!last.has(key)) { last.set(key, v); return; }
      const prev = last.get(key);
      if (v === prev) return;
      last.set(key, v);
      if (now < quiet.until || !visible(el) || document.activeElement === el) return;
      if (key === 'curr_hp') {
        const a = num(prev), b = num(v);
        if (a !== null && b !== null && a !== b) {
          const d = b - a; pulse(el, d > 0 ? 'heal' : 'harm');
          floatText(el, (d > 0 ? '+' : '−') + Math.abs(d), d > 0 ? 'heal' : 'harm');
          return;
        }
      }
      pulse(el);
    });
  }

  // ---------------------------------------------------------------- taps: ripple, pop, haptics
  const RIPPLE_SEL = 'button, .tab, .character-list-item, .feature-badge, .changelog-entry-header';
  const POP_SEL = '.death-save-check, .skill-prof-btn, .spell-slot-dot, .character-favorite-btn, .favorite-star, .switch, .slider';
  const HAPTIC_RE = /adjustHP|customAdjustHP|longRest|shortRest|toggleDeathSave|rollWeapon|rollDie|manualSave|useHealthPotion/;

  function ripple(e) {
    if (reduce()) return;
    const t = e.target && e.target.closest ? e.target.closest(RIPPLE_SEL) : null;
    if (!t || t.disabled) return;
    const r = t.getBoundingClientRect();
    if (r.width < 22 || r.height < 18 || r.width > 900) return;
    const host = document.createElement('div'); host.className = 'mo-ripple-host';
    host.style.cssText = `left:${r.left}px;top:${r.top}px;width:${r.width}px;height:${r.height}px;border-radius:${getComputedStyle(t).borderRadius}`;
    const dot = document.createElement('i');
    dot.style.left = ((e.clientX || r.left + r.width / 2) - r.left) + 'px'; dot.style.top = ((e.clientY || r.top + r.height / 2) - r.top) + 'px';
    dot.style.setProperty('--r', (Math.max(r.width, r.height) * 0.2).toFixed(1));
    host.appendChild(dot); document.body.appendChild(host); setTimeout(() => host.remove(), 680);
  }

  function onClick(e) {
    const tgt = e.target;
    if (!tgt || !tgt.closest) return;
    if (!reduce()) {
      const p = tgt.closest(POP_SEL);
      if (p) { p.classList.remove('mo-pop'); void p.offsetWidth; p.classList.add('mo-pop'); setTimeout(() => p.classList.remove('mo-pop'), 460); }
    }
    const act = tgt.closest('[onclick]');
    if (act && HAPTIC_RE.test(act.getAttribute('onclick') || '') && navigator.vibrate && !reduce()) { try { navigator.vibrate(8); } catch (err) { /* unsupported */ } }
  }

  // ---------------------------------------------------------------- new list items pop in
  const ITEM_SEL = '.item-card, .equipment-card, .action-card, .spell-item, .character-list-item, .weapon-card, .note-card, .note-folder-card, .custom-currency-row, .item-row';
  function watchLists() {
    const root = document.getElementById('pages') || document.body;
    new MutationObserver(muts => {
      if (reduce() || !pointerRecent()) return;           // only after a click/tap, never while typing
      const found = [];
      muts.forEach(m => m.addedNodes.forEach(n => {
        if (n.nodeType !== 1) return;
        if (n.matches && n.matches(ITEM_SEL)) found.push(n);
        else if (n.querySelectorAll) n.querySelectorAll(ITEM_SEL).forEach(x => found.push(x));
      }));
      if (!found.length || found.length > 6) return;       // a big re-render is not "something new"
      found.forEach(el => { el.classList.add('mo-item-in'); setTimeout(() => el.classList.remove('mo-item-in'), 700); });
    }).observe(root, { childList: true, subtree: true });
  }

  // ---------------------------------------------------------------- wiring
  function init() {
    ['switchTab', 'showHomePage', 'openSettingsPage'].forEach(n => wrapFn(n, () => { setTimeout(() => onRoute(false), 60); setTimeout(() => onRoute(false), 360); }));
    ['loadData', 'loadSelectedCharacter', 'clearAllFormFields'].forEach(n => wrapFn(n, () => quietFor(1300)));
    window.addEventListener('hashchange', () => setTimeout(() => onRoute(false), 80));
    window.addEventListener('pointerdown', ripple, true);
    window.addEventListener('click', onClick, true);
    setInterval(scan, 260);
    watchLists();
    quietFor(2500);
    setTimeout(() => onRoute(true), 450);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
  window.motionFX = { choreograph, pulse, floatText, scan };
})();
