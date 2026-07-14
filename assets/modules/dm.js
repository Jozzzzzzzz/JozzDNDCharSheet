// DM Portal — access request, session management, and portal pages logic

// ─── Friendly error/status messages ────────────────────────────────────────
// Turns raw Firestore/network errors into plain-English explanations so the
// DM and Admin portals never show cryptic red error text. Shared via window.
function friendlyFirebaseError(e) {
  const code = (e && e.code) ? String(e.code) : '';
  const msg = (e && e.message) ? String(e.message) : String(e || '');
  const low = (code + ' ' + msg).toLowerCase();

  if (low.includes('index') && (low.includes('not ready') || low.includes('building'))) {
    return '⏳ Setting things up — the database is finishing a one-time setup for this view. Try again in a few minutes (this only happens once).';
  }
  if (low.includes('requires') && low.includes('index')) {
    return '⏳ This view needs a quick one-time database setup. It usually finishes within a few minutes — try again shortly.';
  }
  if (code === 'permission-denied' || low.includes('permission')) {
    return 'You don\'t have access to this. If you just set up a campaign, make sure the security rules are deployed.';
  }
  if (code === 'unavailable' || low.includes('offline') || low.includes('network')) {
    return 'Can\'t reach the cloud right now — check your internet connection and try again.';
  }
  if (code === 'unauthenticated' || low.includes('unauthenticated')) {
    return 'You\'re signed out. Sign in again and retry.';
  }
  // Fallback — still readable, no raw stack
  return 'Something went wrong loading this. Try again in a moment.';
}
window.friendlyFirebaseError = friendlyFirebaseError;

// ─── In-app modal + toast (replaces native prompt/alert/confirm) ────────────
// Themed to match the player popup language. Promise-based so call sites read
// like `const v = await dmModal({...})`. Resolves null on cancel.
function dmEnsureModalRoot() {
  let root = document.getElementById('dmModalRoot');
  if (root) return root;
  root = document.createElement('div');
  root.id = 'dmModalRoot';
  document.body.appendChild(root);
  return root;
}

function dmModal(opts) {
  // opts: { title, message, input (bool), placeholder, value, confirmText,
  //         cancelText, danger (bool), inputType }
  const o = opts || {};
  return new Promise(resolve => {
    const root = dmEnsureModalRoot();
    const backdrop = document.createElement('div');
    backdrop.className = 'dm-modal-backdrop';

    const wantsInput = !!o.input;
    backdrop.innerHTML = `
      <div class="dm-modal" role="dialog" aria-modal="true">
        ${o.title ? `<h3 class="dm-modal-title">${escapeHtml(o.title)}</h3>` : ''}
        ${o.message ? `<p class="dm-modal-message">${escapeHtml(o.message)}</p>` : ''}
        ${wantsInput ? `<input class="dm-modal-input" type="${escapeHtml(o.inputType || 'text')}" placeholder="${escapeHtml(o.placeholder || '')}" value="${escapeHtml(o.value || '')}">` : ''}
        <div class="dm-modal-actions">
          ${o.cancelText === null ? '' : `<button class="dm-action-btn dm-modal-cancel">${escapeHtml(o.cancelText || 'Cancel')}</button>`}
          <button class="dm-action-btn ${o.danger ? 'dm-danger-btn' : 'accent-contrast-bg'} dm-modal-confirm">${escapeHtml(o.confirmText || 'OK')}</button>
        </div>
      </div>
    `;
    root.appendChild(backdrop);
    requestAnimationFrame(() => backdrop.classList.add('show'));

    const input = backdrop.querySelector('.dm-modal-input');
    if (input) { input.focus(); input.select(); }

    const close = (result) => {
      backdrop.classList.remove('show');
      setTimeout(() => backdrop.remove(), 200);
      resolve(result);
    };

    const cancelBtn = backdrop.querySelector('.dm-modal-cancel');
    if (cancelBtn) cancelBtn.onclick = () => close(null);
    backdrop.querySelector('.dm-modal-confirm').onclick = () =>
      close(wantsInput ? (input ? input.value : '') : true);
    backdrop.onclick = (e) => { if (e.target === backdrop) close(null); };
    backdrop.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') close(null);
      if (e.key === 'Enter' && wantsInput) { e.preventDefault(); close(input ? input.value : ''); }
    });
  });
}

// Multi-choice modal: like dmModal but with a vertical stack of N option buttons.
// choices: [{ label, value, hint?, primary?, danger? }]. Resolves the chosen
// value, or null if dismissed (backdrop / Escape / the optional Cancel).
function dmChoiceModal(opts, choices) {
  const o = opts || {};
  const list = Array.isArray(choices) ? choices : [];
  return new Promise(resolve => {
    const root = dmEnsureModalRoot();
    const backdrop = document.createElement('div');
    backdrop.className = 'dm-modal-backdrop';
    backdrop.innerHTML = `
      <div class="dm-modal dm-choice-modal" role="dialog" aria-modal="true">
        ${o.title ? `<h3 class="dm-modal-title">${escapeHtml(o.title)}</h3>` : ''}
        ${o.message ? `<p class="dm-modal-message">${escapeHtml(o.message)}</p>` : ''}
        <div class="dm-choice-list">
          ${list.map((c, i) => `
            <button class="dm-choice-btn ${c.primary ? 'dm-choice-primary' : ''} ${c.danger ? 'dm-danger-btn' : ''}" data-idx="${i}">
              <span class="dm-choice-label">${escapeHtml(c.label)}</span>
              ${c.hint ? `<span class="dm-choice-hint">${escapeHtml(c.hint)}</span>` : ''}
            </button>`).join('')}
        </div>
        ${o.cancelText === null ? '' : `<button class="dm-action-btn dm-modal-cancel" style="margin-top:8px;">${escapeHtml(o.cancelText || 'Cancel')}</button>`}
      </div>`;
    root.appendChild(backdrop);
    requestAnimationFrame(() => backdrop.classList.add('show'));

    const close = (result) => {
      backdrop.classList.remove('show');
      setTimeout(() => backdrop.remove(), 200);
      resolve(result);
    };
    backdrop.querySelectorAll('.dm-choice-btn').forEach(btn => {
      btn.onclick = () => close(list[parseInt(btn.dataset.idx, 10)].value);
    });
    const cancelBtn = backdrop.querySelector('.dm-modal-cancel');
    if (cancelBtn) cancelBtn.onclick = () => close(null);
    backdrop.onclick = (e) => { if (e.target === backdrop) close(null); };
    backdrop.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(null); });
  });
}
window.dmChoiceModal = dmChoiceModal;

function dmToast(message, type) {
  const root = dmEnsureModalRoot();
  const t = document.createElement('div');
  t.className = `dm-toast dm-toast-${type || 'info'}`;
  t.textContent = message;
  root.appendChild(t);
  requestAnimationFrame(() => t.classList.add('show'));
  setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 300); }, 3200);
}

window.dmModal = dmModal;
window.dmToast = dmToast;

// ─── Session ───────────────────────────────────────────────────────────────

const DM_SESSION_KEY = 'dndDmSession';
const DM_SESSION_TTL = 24 * 60 * 60 * 1000; // 24 hours

function dmSessionLoad() {
  try { return JSON.parse(localStorage.getItem(DM_SESSION_KEY) || 'null'); } catch { return null; }
}

function dmSessionSave(data) {
  localStorage.setItem(DM_SESSION_KEY, JSON.stringify({ ...data, enteredAt: Date.now() }));
}

function dmSessionClear() {
  localStorage.removeItem(DM_SESSION_KEY);
}

function dmSessionValid() {
  const s = dmSessionLoad();
  if (!s || !s.enteredAt) return false;
  return (Date.now() - s.enteredAt) < DM_SESSION_TTL;
}

// ─── Home card render ──────────────────────────────────────────────────────

async function renderDmCard() {
  const card = document.getElementById('dmPortalCard');
  if (!card) return;
  const body = document.getElementById('dmCardBody');
  if (!body) return;

  // If we have a valid session and user still matches, show Enter button immediately
  const session = dmSessionLoad();
  const user = window.currentUser;

  if (dmSessionValid() && session && user && session.uid === user.uid) {
    body.innerHTML = `
      <div class="dm-granted-banner">
        <span class="dm-granted-icon">DM</span>
        <div>
          <p class="dm-granted-title">DM Portal — Session Active</p>
          <p class="settings-note">Campaign: <strong>${escapeHtml(session.campaignName || '—')}</strong></p>
        </div>
      </div>
      <button type="button" class="settings-action-btn dm-enter-btn accent-contrast-bg" onclick="enterDmPortal()">Enter DM Screen →</button>
    `;
    return;
  }

  if (!user) {
    body.innerHTML = `
      <p class="settings-note">Want to run a campaign as a Dungeon Master? Sign in with Google first, then enter your campaign's DM control password.</p>
      <button type="button" class="settings-action-btn accent-contrast-bg" onclick="signInWithGoogle()">Sign in with Google</button>
    `;
    return;
  }

  // Signed in — show campaign picker + DM password gate
  body.innerHTML = `
    <p class="settings-note">Signed in as <strong>${escapeHtml(user.displayName || user.email)}</strong>. Choose a campaign and enter its DM control password to take control.</p>
    <div class="dm-request-form">
      <div class="settings-field">
        <label for="dmEnterCampaignSelect">Campaign</label>
        <select id="dmEnterCampaignSelect" style="width:100%;box-sizing:border-box;">
          <option value="">Loading campaigns…</option>
        </select>
      </div>
      <div class="settings-field">
        <label for="dmEnterPassword">DM Control Password</label>
        <input type="password" id="dmEnterPassword" placeholder="DM password for this campaign" maxlength="60" style="width:100%;box-sizing:border-box;">
      </div>
      <button type="button" class="settings-action-btn dm-enter-btn accent-contrast-bg" onclick="dmEnterWithPassword()">Take Control →</button>
      <div id="dmEnterStatus" class="status-message"></div>
    </div>
  `;
  populateDmCampaignSelect();
}

async function populateDmCampaignSelect() {
  const select = document.getElementById('dmEnterCampaignSelect');
  if (!select) return;
  const db = window.db;
  if (!db) { select.innerHTML = '<option value="">Connecting…</option>'; return; }
  try {
    const snap = await db.collection('campaigns').where('active', '==', true).get();
    const campaigns = [];
    snap.forEach(doc => { const c = doc.data(); campaigns.push({ id: doc.id, name: c.name, setting: c.setting || '' }); });
    campaigns.sort((a, b) => a.name.localeCompare(b.name));
    if (!campaigns.length) {
      select.innerHTML = '<option value="">No active campaigns</option>';
      return;
    }
    select.innerHTML = '<option value="">Choose a campaign…</option>' +
      campaigns.map(c => `<option value="${escapeHtml(c.id)}" data-setting="${escapeHtml(c.setting)}">${escapeHtml(c.name)}</option>`).join('');
  } catch (e) {
    select.innerHTML = '<option value="">Load failed</option>';
    console.warn('DM campaign list load failed:', e.message);
  }
}

async function dmEnterWithPassword() {
  const user = window.currentUser;
  if (!user) return;
  const select = document.getElementById('dmEnterCampaignSelect');
  const pwInput = document.getElementById('dmEnterPassword');
  const statusEl = document.getElementById('dmEnterStatus');
  const setStatus = (msg, type) => {
    if (!statusEl) return;
    statusEl.textContent = msg;
    statusEl.className = `status-message ${type || 'info'}`;
    statusEl.style.display = 'block';
  };

  const campaignId = select?.value;
  const password = pwInput?.value || '';
  if (!campaignId) { setStatus('Choose a campaign first.', 'error'); return; }

  const db = window.db;
  if (!db) { setStatus('Not connected. Try again in a moment.', 'error'); return; }

  try {
    const doc = await db.collection('campaigns').doc(campaignId).get();
    if (!doc.exists) { setStatus('Campaign not found.', 'error'); return; }
    const c = doc.data();
    const dmHash = c.dmPasswordHash || '';

    if (!dmHash) {
      setStatus('This campaign has no DM password set. Ask the owner to set one in the Admin Portal.', 'error');
      return;
    }
    const enteredHash = typeof window.sha256Hex === 'function' ? await window.sha256Hex(password) : '';
    if (enteredHash !== dmHash) {
      setStatus('Incorrect DM password.', 'error');
      return;
    }

    // Verified — save session and enter
    dmSessionSave({ uid: user.uid, email: user.email, campaignId, campaignName: c.name, campaignSetting: c.setting || '' });
    enterDmPortal();
  } catch (e) {
    setStatus('Error: ' + (e?.message || 'unknown'), 'error');
  }
}

// Owner override — enter any campaign's DM portal without the DM password.
// Gated to the owner email; used from the Admin Portal campaign list.
// mode: 'view' (read-only, default) or 'edit' (full control).
async function dmEnterAsOwner(campaignId, mode) {
  const user = window.currentUser;
  if (!user) { dmToast('Sign in first.', 'error'); return; }
  const ownerEmail = (typeof OWNER_EMAIL === 'string' && OWNER_EMAIL) || 'vanreejoz33@gmail.com';
  if (String(user.email || '').toLowerCase() !== ownerEmail.toLowerCase()) {
    dmToast('Owner only.', 'error');
    return;
  }
  const db = window.db;
  if (!db) { dmToast('Not connected.', 'error'); return; }
  try {
    const doc = await db.collection('campaigns').doc(campaignId).get();
    if (!doc.exists) { dmToast('Campaign not found.', 'error'); return; }
    const c = doc.data();
    const viewOnly = mode !== 'edit';
    dmSessionSave({ uid: user.uid, email: user.email, campaignId, campaignName: c.name, campaignSetting: c.setting || '', ownerOverride: true, viewOnly });
    enterDmPortal();
  } catch (e) {
    dmToast(friendlyFirebaseError(e), 'error');
  }
}
window.dmEnterAsOwner = dmEnterAsOwner;

window.populateDmCampaignSelect = populateDmCampaignSelect;
window.dmEnterWithPassword = dmEnterWithPassword;

// ─── Portal enter / exit ───────────────────────────────────────────────────

async function enterDmPortal() {
  const user = window.currentUser;
  if (!user) return;

  // Entry requires a valid session — created by dmEnterWithPassword() after the
  // DM password is verified. Without one, send the user back to the gate.
  if (!dmSessionValid()) {
    dmToast('Enter your campaign DM password first.', 'info');
    if (typeof renderDmCard === 'function') renderDmCard();
    return;
  }

  const session = dmSessionLoad();

  // Hide player UI
  document.getElementById('chrome-root').style.display = 'none';
  document.getElementById('pages').style.display = 'none';
  document.getElementById('popups-root').style.display = 'none';

  // Show DM UI
  document.getElementById('dm-chrome-root').style.display = 'block';
  document.getElementById('dm-pages-root').style.display = 'block';
  document.getElementById('dmPortalChrome').style.display = 'block';

  // View-only mode (owner "Enter as DM") — disable interactive controls + flag the banner
  const chrome = document.getElementById('dmPortalChrome');
  const pagesRoot = document.getElementById('dm-pages-root');
  const viewOnly = !!session?.viewOnly;
  if (chrome) chrome.classList.toggle('dm-view-only', viewOnly);
  if (pagesRoot) pagesRoot.classList.toggle('dm-view-only', viewOnly);

  // Populate banner — flag owner override mode (view vs edit) so it's obvious
  const label = document.getElementById('dmScreenCampaignLabel');
  if (label) {
    let suffix = '';
    if (viewOnly) suffix = '  ·  VIEW ONLY';
    else if (session?.ownerOverride) suffix = '  ·  OWNER EDIT';
    label.textContent = (session?.campaignName || '') + suffix;
  }

  // Populate settings tab info
  const settingsEmail = document.getElementById('dmSettingsEmail');
  if (settingsEmail) settingsEmail.textContent = user.email;
  const settingsCampaign = document.getElementById('dmSettingsCampaign');
  if (settingsCampaign) settingsCampaign.textContent = session?.campaignName || '—';
  const sessionExpiry = document.getElementById('dmSettingsSessionExpiry');
  if (sessionExpiry) {
    const remaining = Math.max(0, Math.round((DM_SESSION_TTL - (Date.now() - session.enteredAt)) / 3600000));
    sessionExpiry.textContent = `Active — expires in ~${remaining}h`;
  }

  // Populate home dashboard
  const homeCampaign = document.getElementById('dmHomeCampaignName');
  if (homeCampaign) homeCampaign.textContent = session?.campaignName || '—';
  const homeSetting = document.getElementById('dmHomeCampaignSetting');
  if (homeSetting) homeSetting.textContent = session?.campaignSetting || '—';
  const greeting = document.getElementById('dmHomeGreeting');
  if (greeting) greeting.textContent = `Welcome back, ${user.displayName || user.email}.`;

  // Live player count for the dashboard
  dmLoadHomePlayerCount();

  // Load saved encounters + NPCs
  dmRenderSavedEncounters();
  dmRenderNpcList();

  // Show home tab
  switchDmTabById('dm-home');

  window.__dmPortalActive = true;
}

window.enterDmPortal = enterDmPortal;

function exitDmPortal() {
  // Show player UI
  document.getElementById('chrome-root').style.display = '';
  document.getElementById('pages').style.display = '';
  document.getElementById('popups-root').style.display = '';

  // Hide DM UI
  document.getElementById('dm-chrome-root').style.display = 'none';
  document.getElementById('dm-pages-root').style.display = 'none';
  document.getElementById('dmPortalChrome').style.display = 'none';

  // Clear view-only state so a later real DM entry isn't stuck read-only
  document.getElementById('dmPortalChrome')?.classList.remove('dm-view-only');
  document.getElementById('dm-pages-root')?.classList.remove('dm-view-only');

  window.__dmPortalActive = false;
  // Session persists — re-entry within 24h skips the approval check
}

window.exitDmPortal = exitDmPortal;

// ─── Tab switching ─────────────────────────────────────────────────────────

function switchDmTab(btn) {
  const target = btn.dataset.dmTab;
  document.querySelectorAll('.dm-tab').forEach(t => t.classList.remove('active'));
  btn.classList.add('active');
  document.querySelectorAll('.dm-page').forEach(p => { p.style.display = 'none'; });
  const page = document.getElementById(target);
  if (page) page.style.display = 'block';

  // Auto-load players when switching to that tab
  if (target === 'dm-players') {
    const session = dmSessionLoad();
    const subtitle = document.getElementById('dmPlayersSubtitle');
    if (subtitle && session?.campaignName) subtitle.textContent = `Campaign: ${session.campaignName}`;
    dmLoadPlayers();
  }
  // Auto-load the spell overview when switching to that tab
  if (target === 'dm-spells' && typeof dmLoadPlayerSpells === 'function') {
    dmLoadPlayerSpells();
  }
  // Render the encounter party panel + difficulty meter + saved list on open
  if (target === 'dm-encounters') {
    if (typeof dmRenderPartyRows === 'function') dmRenderPartyRows();
    if (typeof dmUpdateDifficultyMeter === 'function') dmUpdateDifficultyMeter();
    if (typeof dmRenderSavedEncounters === 'function') dmRenderSavedEncounters();
  }
  // Auto-load the item archive on first open
  if (target === 'dm-items' && typeof dmLoadItems === 'function') {
    dmLoadItems();
  }
  // Auto-load (cache-first) the monster browser on open
  if (target === 'dm-monsters' && typeof dmLoadMonsters === 'function') {
    dmLoadMonsters();
  }
}

function switchDmTabById(id) {
  const btn = document.querySelector(`.dm-tab[data-dm-tab="${id}"]`);
  if (btn) switchDmTab(btn);
}

// Generic Build | Generate (or any) mode toggle within a tool.
// Markup: a .dm-mode-toggle with buttons [data-mode], and views with
// [data-mode-view] — all scoped by a shared data-mode-group="<tool>".
function dmSetMode(tool, mode) {
  document.querySelectorAll(`[data-mode-group="${tool}"] .dm-mode-btn`).forEach(b => {
    b.classList.toggle('active', b.dataset.mode === mode);
  });
  document.querySelectorAll(`[data-mode-group="${tool}"] [data-mode-view]`).forEach(v => {
    v.style.display = v.dataset.modeView === mode ? '' : 'none';
  });
}
window.dmSetMode = dmSetMode;

window.switchDmTab = switchDmTab;
window.switchDmTabById = switchDmTabById;

// ─── Monsters (Open5e API) ─────────────────────────────────────────────────

let dmAllMonsters = [];

const DM_MONSTER_CACHE_KEY = 'dndDmMonsterCache';
const DM_MONSTER_CACHE_TTL = 30 * 24 * 60 * 60 * 1000; // 30 days

// --- Saved / favourite creatures (pinned to the top of the browser) ---
const DM_SAVED_MONSTERS_KEY = 'dndDmSavedMonsters';
let _dmSavedMonsterSlugs = null;

function dmGetSavedMonsterSet() {
  if (_dmSavedMonsterSlugs) return _dmSavedMonsterSlugs;
  let arr = [];
  try { arr = JSON.parse(localStorage.getItem(DM_SAVED_MONSTERS_KEY) || '[]'); } catch (e) { arr = []; }
  _dmSavedMonsterSlugs = new Set(Array.isArray(arr) ? arr : []);
  return _dmSavedMonsterSlugs;
}
function dmIsMonsterSaved(slug) {
  return !!slug && dmGetSavedMonsterSet().has(slug);
}
function dmToggleSavedMonster(slug, ev) {
  if (ev) { ev.stopPropagation(); }
  if (!slug) return;
  const set = dmGetSavedMonsterSet();
  if (set.has(slug)) set.delete(slug); else set.add(slug);
  try { localStorage.setItem(DM_SAVED_MONSTERS_KEY, JSON.stringify(Array.from(set))); } catch (e) {}
  if (_dmMonsterBrowser) _dmMonsterBrowser.refresh(); // re-sort so saved float to top
}
function dmRefreshDetailSaveBtn(slug) {
  const btn = document.getElementById('dmDetailSaveBtn');
  if (btn) btn.textContent = dmIsMonsterSaved(slug) ? '★ Saved' : '☆ Save creature';
}

// Load monsters. Order: (1) in-memory, (2) bundled local file assets/data/monsters.json
// (instant, offline — no network needed at all), (3) localStorage cache, and only on an
// explicit `force` (Refresh button) do we hit the Open5e API for the latest.
async function dmLoadMonsters(force) {
  const note = document.getElementById('dmMonstersNote');

  // Already loaded this session → just (re)build the browser.
  if (!force && dmAllMonsters.length) { dmInitMonsterBrowser(); return; }

  let servedLocal = false;

  // 1) Bundled local file — the default, instant path.
  if (!force) {
    try {
      const v = (typeof window !== 'undefined' && window.__SCRIPT_VERSION__) || Date.now();
      const resp = await fetch(`assets/data/monsters.json?v=${v}`);
      if (resp.ok) {
        const arr = await resp.json();
        if (Array.isArray(arr) && arr.length) {
          dmAllMonsters = arr;
          servedLocal = true;
          if (note) note.textContent = `${arr.length} monsters ready.`;
          dmInitMonsterBrowser();
          return; // local file is authoritative for the default view — no network
        }
      }
    } catch (e) { /* fall through to cache/API */ }
  }

  // 2) localStorage cache (e.g. a previous API refresh) if the local file was unavailable.
  if (!force && !servedLocal) {
    try {
      const raw = localStorage.getItem(DM_MONSTER_CACHE_KEY);
      if (raw) {
        const cache = JSON.parse(raw);
        if (cache && Array.isArray(cache.monsters) && cache.monsters.length) {
          dmAllMonsters = cache.monsters;
          if (note) note.textContent = `${cache.monsters.length} monsters ready (cached).`;
          dmInitMonsterBrowser();
          return;
        }
      }
    } catch (e) { /* ignore bad cache */ }
  }

  const servedFromCache = servedLocal;
  // 3) Fetch from API (only on Refresh, or if no local/cache). Shows a progress bar driven by the
  // Open5e `count` (total) vs how many we've pulled, so the user sees real load speed.
  if (note) note.textContent = servedFromCache ? 'Refreshing monsters from Open5e…' : 'Loading monsters from Open5e…';
  dmSetMonsterProgress(null, true); // indeterminate pulse until the first response gives a total
  const startedAt = Date.now();
  try {
    let results = [];
    let total = 0;
    let url = 'https://api.open5e.com/v1/monsters/?limit=100&document__slug=wotc-srd';
    while (url) {
      const res = await fetch(url);
      const data = await res.json();
      if (!total && typeof data.count === 'number') total = data.count;
      results = results.concat(data.results || []);
      const pct = total ? Math.min(100, Math.round((results.length / total) * 100)) : null;
      dmSetMonsterProgress(pct, true);
      if (note) note.textContent = `Loading monsters from Open5e… ${results.length}${total ? ' / ' + total : ''}`;
      url = data.next || null;
    }
    if (results.length) {
      dmAllMonsters = results;
      try { localStorage.setItem(DM_MONSTER_CACHE_KEY, JSON.stringify({ monsters: results, savedAt: Date.now() })); } catch (e) { /* quota */ }
      const secs = ((Date.now() - startedAt) / 1000).toFixed(1);
      dmSetMonsterProgress(100, true);
      if (note) note.textContent = `${results.length} monsters ready (loaded in ${secs}s).`;
      dmInitMonsterBrowser();
      setTimeout(() => dmSetMonsterProgress(0, false), 600); // hide the bar shortly after
    } else if (!servedFromCache && note) {
      note.textContent = 'No monsters returned. Try again later.';
      dmSetMonsterProgress(0, false);
    } else {
      dmSetMonsterProgress(0, false);
    }
  } catch (e) {
    console.error('Monster load failed:', e);
    if (!servedFromCache && note) note.textContent = 'Offline and no cached monsters yet. Connect once to download them.';
    dmSetMonsterProgress(0, false);
  }
}

// Drive the monster-load progress bar. pct: 0-100, or null for an indeterminate pulse
// (when total isn't known yet). show=false hides it.
function dmSetMonsterProgress(pct, show) {
  const wrap = document.getElementById('dmMonsterProgress');
  const bar = document.getElementById('dmMonsterProgressBar');
  if (!wrap || !bar) return;
  wrap.style.display = show ? 'block' : 'none';
  if (pct === null) {
    wrap.classList.add('indeterminate');
    bar.style.width = '35%';
  } else {
    wrap.classList.remove('indeterminate');
    bar.style.width = Math.max(0, Math.min(100, pct)) + '%';
  }
}

// Numeric CR for sorting/labels ("1/8" style comes through as 0.125 already).
function dmMonsterCrNum(m) {
  const v = parseFloat(m && m.challenge_rating);
  return Number.isFinite(v) ? v : -1;
}
function dmMonsterHpNum(m) {
  const v = parseInt(m && m.hit_points, 10);
  return Number.isFinite(v) ? v : -1;
}

// Does a monster have a given movement type? Reads the Open5e `speed` object
// (e.g. { walk:30, fly:60, swim:40 }); falls back to scanning any speed text.
function dmMonsterHasMove(m, kind) {
  const sp = m && m.speed;
  if (sp && typeof sp === 'object') {
    if (kind === 'ground') return (sp.walk || 0) > 0;
    return (sp[kind] || 0) > 0;
  }
  const txt = (m && (m.speed_json || m.speed_desc || '')) + '';
  return new RegExp(kind === 'ground' ? 'walk|\\d+\\s*ft' : kind, 'i').test(txt);
}

function dmMonsterIsLegendary(m) {
  if (!m) return false;
  const la = m.legendary_actions || m.legendary_actions_json;
  if (Array.isArray(la)) return la.length > 0;
  if (typeof la === 'string') return la.trim() !== '' && la.trim() !== '[]';
  return !!(m.legendary_desc && String(m.legendary_desc).trim());
}

// Coarse alignment bucket for filtering.
function dmMonsterAlignmentBucket(m) {
  const a = (m && m.alignment || '').toLowerCase();
  if (!a || /unaligned|any alignment/.test(a)) return 'unaligned';
  const out = [];
  if (/good/.test(a)) out.push('good');
  if (/evil/.test(a)) out.push('evil');
  if (/lawful/.test(a)) out.push('lawful');
  if (/chaotic/.test(a)) out.push('chaotic');
  if (!out.length && /neutral/.test(a)) out.push('neutral');
  return out;
}

let _dmMonsterBrowser = null;

// Build (or refresh) the virtualized monster browser over dmAllMonsters. Idempotent —
// safe to call every time monsters load or the tab opens.
function dmInitMonsterBrowser() {
  const root = document.getElementById('dmMonstersList');
  const search = document.getElementById('dmMonsterSearch');
  if (!root || !search) return;

  // Populate type + size dropdowns from the data (once per dataset).
  const typeSel = document.getElementById('dmMonsterTypeFilter');
  const sizeSel = document.getElementById('dmMonsterSizeFilter');
  if (typeSel && typeSel.options.length <= 1) {
    const types = Array.from(new Set(dmAllMonsters.map(m => (m.type || '').trim()).filter(Boolean))).sort();
    typeSel.innerHTML = '<option value="">All types</option>' + types.map(t => `<option value="${escapeHtml(t)}">${escapeHtml(t[0].toUpperCase() + t.slice(1))}</option>`).join('');
  }
  if (sizeSel && sizeSel.options.length <= 1) {
    const sizes = Array.from(new Set(dmAllMonsters.map(m => (m.size || '').trim()).filter(Boolean)));
    const order = ['Tiny', 'Small', 'Medium', 'Large', 'Huge', 'Gargantuan'];
    sizes.sort((a, b) => order.indexOf(a) - order.indexOf(b));
    sizeSel.innerHTML = '<option value="">All sizes</option>' + sizes.map(s => `<option value="${escapeHtml(s)}">${escapeHtml(s)}</option>`).join('');
  }
  // Environment/habitat options, gathered from the data (each monster has an array).
  const envSel = document.getElementById('dmMonsterEnvFilter');
  if (envSel && envSel.options.length <= 1) {
    const envs = new Set();
    dmAllMonsters.forEach(m => (Array.isArray(m.environments) ? m.environments : []).forEach(e => { if (e) envs.add(String(e).trim()); }));
    const sorted = Array.from(envs).sort();
    envSel.innerHTML = '<option value="">Any habitat</option>' + sorted.map(e => `<option value="${escapeHtml(e)}">${escapeHtml(e)}</option>`).join('');
  }

  if (_dmMonsterBrowser) { _dmMonsterBrowser.refresh(); return; }

  _dmMonsterBrowser = createListBrowser({
    data: () => dmAllMonsters,
    root,
    searchInput: search,
    countEl: document.getElementById('dmMonsterCount'),
    sortEl: document.getElementById('dmMonsterSort'),
    searchFields: m => `${m.name} ${m.type || ''} ${m.size || ''}`,
    filters: [
      { el: document.getElementById('dmMonsterCrFilter'), match: (m, v) => v === '' || String(m.challenge_rating) === v || (v === '21' && dmMonsterCrNum(m) >= 21) },
      { el: document.getElementById('dmMonsterTypeFilter'), match: (m, v) => v === '' || (m.type || '').toLowerCase() === v.toLowerCase() },
      { el: document.getElementById('dmMonsterSizeFilter'), match: (m, v) => v === '' || (m.size || '').toLowerCase() === v.toLowerCase() },
      { el: document.getElementById('dmMonsterAlignFilter'), match: (m, v) => v === '' || dmMonsterAlignmentBucket(m).includes(v) },
      { el: document.getElementById('dmMonsterMoveFilter'), match: (m, v) => v === '' || dmMonsterHasMove(m, v) },
      { el: document.getElementById('dmMonsterLegendaryFilter'), match: (m, v) => v === '' || (v === 'yes' ? dmMonsterIsLegendary(m) : !dmMonsterIsLegendary(m)) },
      { el: document.getElementById('dmMonsterEnvFilter'), match: (m, v) => v === '' || (Array.isArray(m.environments) && m.environments.includes(v)) },
    ],
    // Saved creatures always float to the top, then the chosen sort applies within groups.
    sorts: (() => {
      const savedFirst = (base) => (a, b) => {
        const sa = dmIsMonsterSaved(a.slug) ? 0 : 1;
        const sb = dmIsMonsterSaved(b.slug) ? 0 : 1;
        return (sa - sb) || base(a, b);
      };
      const byName = (a, b) => (a.name || '').localeCompare(b.name || '');
      return {
        name: savedFirst(byName),
        crAsc: savedFirst((a, b) => dmMonsterCrNum(a) - dmMonsterCrNum(b) || byName(a, b)),
        crDesc: savedFirst((a, b) => dmMonsterCrNum(b) - dmMonsterCrNum(a) || byName(a, b)),
        hpAsc: savedFirst((a, b) => dmMonsterHpNum(a) - dmMonsterHpNum(b) || byName(a, b)),
        hpDesc: savedFirst((a, b) => dmMonsterHpNum(b) - dmMonsterHpNum(a) || byName(a, b)),
      };
    })(),
    rowHeight: 52,
    rowClass: 'dm-monster-row',
    emptyText: 'No monsters match. Try a different search or filters.',
    renderRow: m => {
      const saved = dmIsMonsterSaved(m.slug);
      return `
      <button type="button" class="dm-save-star${saved ? ' saved' : ''}" title="${saved ? 'Remove from saved' : 'Save creature'}" onclick="dmToggleSavedMonster('${escapeHtml(m.slug || '')}', event)">${saved ? '★' : '☆'}</button>
      <span class="dm-monster-name">${escapeHtml(m.name)}</span>
      <span class="dm-monster-meta">${escapeHtml(m.type || '')} · CR ${m.challenge_rating ?? '?'} · HP ${m.hit_points ?? '?'} · AC ${m.armor_class ?? '?'}</span>`;
    },
    onRowClick: m => dmShowMonster(m.slug),
  });
  _dmMonsterBrowser.refresh();
}

async function dmShowMonster(slug) {
  const detail = document.getElementById('dmMonsterDetail');
  const name = document.getElementById('dmMonsterDetailName');
  const body = document.getElementById('dmMonsterDetailBody');
  if (!detail || !body) return;

  const cached = dmAllMonsters.find(m => m.slug === slug);
  const m = cached || await fetch(`https://api.open5e.com/v1/monsters/${slug}/`).then(r => r.json()).catch(() => null);
  if (!m) return;

  if (name) name.textContent = m.name;
  // Cache the full record so the Add-to-Encounter path can carry the whole
  // stat block into the combatant (for the click-to-expand card + Dex init).
  if (m.slug && !dmAllMonsters.find(x => x.slug === m.slug)) dmAllMonsters.push(m);
  const savedNow = dmIsMonsterSaved(m.slug);
  body.innerHTML = dmRenderStatBlockHtml(m) +
    `<div style="margin-top:12px; display:flex; gap:8px; flex-wrap:wrap;">
       <button class="dm-action-btn" onclick="dmAddMonsterToEncounter('${escapeHtml(m.slug || '')}')">Add to Encounter</button>
       <button class="dm-action-btn" id="dmDetailSaveBtn" onclick="dmToggleSavedMonster('${escapeHtml(m.slug || '')}'); dmRefreshDetailSaveBtn('${escapeHtml(m.slug || '')}');">${savedNow ? '★ Saved' : '☆ Save creature'}</button>
     </div>`;
  detail.style.display = 'block';
  detail.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

// Shared stat-block renderer — used by the Monsters tab detail panel and the
// click-to-expand card on each encounter combatant. Pure HTML, no side effects.
// Open5e monster reference page for a slug (falls back to a name search).
function dmMonsterLink(m) {
  if (m && m.slug) return `https://open5e.com/monsters/${m.slug}`;
  const q = encodeURIComponent((m && m.name) || '');
  return `https://open5e.com/monsters?search=${q}`;
}

function dmRenderStatBlockHtml(m) {
  return `
    <div class="dm-stat-block">
      <div class="dm-sb-title">
        <a href="${dmMonsterLink(m)}" target="_blank" rel="noopener" class="dm-sb-link" title="Open ${escapeHtml(m.name || 'this creature')} on Open5e ↗">${escapeHtml(m.name || 'Creature')} ↗</a>
      </div>
      <div class="dm-sb-meta">${escapeHtml(m.size || '')} ${escapeHtml(m.type || '')}${m.subtype ? ` (${escapeHtml(m.subtype)})` : ''}, ${escapeHtml(m.alignment || '')}</div>
      <div class="dm-sb-divider"></div>
      <div class="dm-sb-row"><strong>Armor Class</strong> ${m.armor_class ?? '?'}</div>
      <div class="dm-sb-row"><strong>Hit Points</strong> ${m.hit_points ?? '?'} (${escapeHtml(m.hit_dice || '?')})</div>
      <div class="dm-sb-row"><strong>Speed</strong> ${escapeHtml(m.speed ? Object.entries(m.speed).map(([k,v]) => `${k} ${v}`).join(', ') : (m.walk_speed ? m.walk_speed + 'ft.' : '?'))}</div>
      <div class="dm-sb-divider"></div>
      <div class="dm-sb-abilities">
        ${['strength','dexterity','constitution','intelligence','wisdom','charisma'].map(ab => `
          <div class="dm-sb-ability">
            <div class="dm-sb-ab-name">${ab.slice(0,3).toUpperCase()}</div>
            <div class="dm-sb-ab-score">${m[ab] ?? '?'} (${dmMod(m[ab])})</div>
          </div>
        `).join('')}
      </div>
      <div class="dm-sb-divider"></div>
      ${m.senses ? `<div class="dm-sb-row"><strong>Senses</strong> ${escapeHtml(m.senses)}</div>` : ''}
      ${m.languages ? `<div class="dm-sb-row"><strong>Languages</strong> ${escapeHtml(m.languages)}</div>` : ''}
      <div class="dm-sb-row"><strong>Challenge</strong> ${m.challenge_rating ?? '?'} (${dmCrToXp(m.challenge_rating)} XP)</div>
      ${m.special_abilities?.length ? `<div class="dm-sb-divider"></div><h4>Traits</h4>${m.special_abilities.map(a => `<div class="dm-sb-trait"><strong>${escapeHtml(a.name)}.</strong> ${escapeHtml(a.desc)}</div>`).join('')}` : ''}
      ${m.actions?.length ? `<div class="dm-sb-divider"></div><h4>Actions</h4>${m.actions.map(a => `<div class="dm-sb-trait"><strong>${escapeHtml(a.name)}.</strong> ${escapeHtml(a.desc)}</div>`).join('')}` : ''}
      ${m.reactions?.length ? `<div class="dm-sb-divider"></div><h4>Reactions</h4>${m.reactions.map(a => `<div class="dm-sb-trait"><strong>${escapeHtml(a.name)}.</strong> ${escapeHtml(a.desc)}</div>`).join('')}` : ''}
      ${m.legendary_actions?.length ? `<div class="dm-sb-divider"></div><h4>Legendary Actions</h4>${m.legendary_actions.map(a => `<div class="dm-sb-trait"><strong>${escapeHtml(a.name)}.</strong> ${escapeHtml(a.desc)}</div>`).join('')}` : ''}
    </div>`;
}

// ─── Reusable creature modal ───────────────────────────────────────────────
// Opens a scrollable stat-block popup for one creature. Works from anywhere:
// the builder, the initiative order, or a saved encounter. Accepts either a
// full stat-block object or a { name, slug } stub (it fetches the block by slug).
async function dmOpenCreature(source) {
  let m = source;
  // If we only have a slug (saved encounters strip the stat block), resolve it.
  const hasBlock = m && (m.actions || m.special_abilities || m.armor_class != null);
  if (!hasBlock) {
    const slug = m && m.slug;
    if (slug) {
      const cached = dmAllMonsters.find(x => x.slug === slug);
      m = cached || await fetch(`https://api.open5e.com/v1/monsters/${slug}/`).then(r => r.json()).catch(() => null) || m;
      if (m && m.slug && !dmAllMonsters.find(x => x.slug === m.slug)) dmAllMonsters.push(m);
    }
  }
  if (!m) { dmToast('No stat block available for this creature.', 'error'); return; }

  const root = dmEnsureModalRoot();
  const backdrop = document.createElement('div');
  backdrop.className = 'dm-modal-backdrop';
  backdrop.innerHTML = `
    <div class="dm-modal dm-creature-modal" role="dialog" aria-modal="true">
      <button class="dm-icon-btn dm-creature-close" title="Close">✕</button>
      <div class="dm-creature-modal-body">${dmRenderStatBlockHtml(m)}</div>
    </div>`;
  root.appendChild(backdrop);
  requestAnimationFrame(() => backdrop.classList.add('show'));

  const close = () => { backdrop.classList.remove('show'); setTimeout(() => backdrop.remove(), 200); };
  backdrop.querySelector('.dm-creature-close').onclick = close;
  backdrop.onclick = (e) => { if (e.target === backdrop) close(); };
  document.addEventListener('keydown', function esc(e) {
    if (e.key === 'Escape') { close(); document.removeEventListener('keydown', esc); }
  });
}

// Open a creature by combatant id — resolves the stat block from live state.
function dmOpenCombatantCreature(id) {
  // Look across the live list and any sorted view; ids are stable.
  const c = dmCombatants.find(x => x.id === id);
  if (!c) return;
  if (c.isPlayer) { dmToast('Players use their own character sheet.', 'info'); return; }
  dmOpenCreature(c.statBlock || { name: c.name, slug: c.slug });
}

// Open a creature from a saved encounter's combatant (by slug/name).
function dmOpenSavedCreature(slug, name) {
  if (!slug) { dmToast('This creature has no linked stat block.', 'info'); return; }
  dmOpenCreature({ slug, name });
}

window.dmOpenCreature = dmOpenCreature;
window.dmOpenCombatantCreature = dmOpenCombatantCreature;
window.dmOpenSavedCreature = dmOpenSavedCreature;

// Numeric ability modifier (null-safe → 0).
function dmModNum(score) {
  if (score == null || isNaN(score)) return 0;
  return Math.floor((score - 10) / 2);
}

function dmMod(score) {
  if (score == null) return '+0';
  const mod = Math.floor((score - 10) / 2);
  return (mod >= 0 ? '+' : '') + mod;
}

function dmCrToXp(cr) {
  const table = { '0':10,'0.125':25,'0.25':50,'0.5':100,'1':200,'2':450,'3':700,'4':1100,'5':1800,'6':2300,'7':2900,'8':3900,'9':5000,'10':5900,'11':7200,'12':8400,'13':10000,'14':11500,'15':13000,'16':15000,'17':18000,'18':20000,'19':22000,'20':25000 };
  return table[String(cr)] || '—';
}

window.dmLoadMonsters = dmLoadMonsters;
window.dmInitMonsterBrowser = dmInitMonsterBrowser;
window.dmSetMonsterProgress = dmSetMonsterProgress;
window.dmToggleSavedMonster = dmToggleSavedMonster;
window.dmRefreshDetailSaveBtn = dmRefreshDetailSaveBtn;
window.dmShowMonster = dmShowMonster;

// ─── Items (Open5e magic items — reference only) ───────────────────────────
// SAFETY: this is REFERENCE DATA the DM browses. It never writes to or mutates
// any player's saved character. "Add to NPC loot" only appends to the DM's own
// NPC loot text field.
// One unified archive of every item: magic items + mundane weapons + armor.
// Each entry is normalised to: { key, name, category, type, rarity, attune,
//   source, desc, extra } so one list/detail view handles all three sources.
let dmAllItems = [];

async function dmFetchAll(baseUrl) {
  let results = [];
  let url = baseUrl;
  while (url) {
    const res = await fetch(url);
    const data = await res.json();
    results = results.concat(data.results || []);
    url = data.next || null;
  }
  return results;
}

const DM_ITEM_CACHE_KEY = 'dndDmItemCache';
const DM_ITEM_CACHE_TTL = 30 * 24 * 60 * 60 * 1000; // 30 days

// Drive the DM item-archive progress bar (mirrors dmSetMonsterProgress).
function dmSetItemProgress(pct, show) {
  const wrap = document.getElementById('dmItemProgress');
  const bar = document.getElementById('dmItemProgressBar');
  if (!wrap || !bar) return;
  wrap.style.display = show ? 'block' : 'none';
  if (pct === null) { wrap.classList.add('indeterminate'); bar.style.width = '35%'; }
  else { wrap.classList.remove('indeterminate'); bar.style.width = Math.max(0, Math.min(100, pct)) + '%'; }
}

async function dmLoadItems(force) {
  if (dmAllItems.length && !force) { dmInitItemBrowser(); return; }
  const note = document.getElementById('dmItemsNote');

  // Cache-first (instant, offline) unless forcing a reload.
  if (!force) {
    try {
      const raw = localStorage.getItem(DM_ITEM_CACHE_KEY);
      if (raw) {
        const cache = JSON.parse(raw);
        if (cache && Array.isArray(cache.items) && cache.items.length) {
          dmAllItems = cache.items;
          if (note) note.textContent = `${cache.items.length} items ready (cached).`;
          dmInitItemBrowser();
          if (cache.savedAt && (Date.now() - cache.savedAt) < DM_ITEM_CACHE_TTL) return;
        }
      }
    } catch (e) { /* ignore bad cache */ }
  }

  if (note) note.textContent = dmAllItems.length ? 'Refreshing the item archive…' : 'Loading the full item archive from Open5e…';
  dmSetItemProgress(null, true);

  try {
    const [magic, weapons, armor] = await Promise.all([
      dmFetchAll('https://api.open5e.com/v1/magicitems/?limit=100'),
      dmFetchAll('https://api.open5e.com/v1/weapons/?limit=100'),
      dmFetchAll('https://api.open5e.com/v1/armor/?limit=100')
    ]);
    dmSetItemProgress(80, true);

    const norm = [];
    magic.forEach(m => norm.push({
      key: 'magic:' + m.slug, name: m.name, category: 'Magic Item',
      type: m.type || 'Wondrous Item', rarity: m.rarity || 'unknown',
      attune: m.requires_attunement ? (typeof m.requires_attunement === 'string' && m.requires_attunement.trim() ? m.requires_attunement : 'Yes') : 'No',
      source: m.document__title || '', desc: m.desc || '', extra: []
    }));
    weapons.forEach(w => norm.push({
      key: 'weapon:' + (w.slug || w.name), name: w.name, category: 'Weapon',
      type: w.category || 'Weapon', rarity: 'mundane', attune: 'No',
      source: w.document__title || '', desc: (Array.isArray(w.properties) ? 'Properties: ' + w.properties.join(', ') : ''),
      extra: [['Damage', `${w.damage_dice || '—'} ${w.damage_type || ''}`.trim()], ['Cost', w.cost || '—'], ['Weight', w.weight || '—']]
    }));
    armor.forEach(a => norm.push({
      key: 'armor:' + (a.slug || a.name), name: a.name, category: 'Armor',
      type: a.category || 'Armor', rarity: 'mundane', attune: 'No',
      source: a.document__title || '', desc: a.stealth_disadvantage ? 'Imposes disadvantage on Stealth checks.' : '',
      extra: [['Armor Class', a.ac_string || a.base_ac || '—'], ['Strength Req', a.strength_requirement || '—'], ['Cost', a.cost || '—'], ['Weight', a.weight || '—']]
    }));

    norm.sort((a, b) => a.name.localeCompare(b.name));
    dmAllItems = norm;
    try { localStorage.setItem(DM_ITEM_CACHE_KEY, JSON.stringify({ items: norm, savedAt: Date.now() })); } catch (e) { /* quota */ }
    dmSetItemProgress(100, true);
    if (note) note.textContent = `${norm.length} items ready.`;
    dmInitItemBrowser();
    setTimeout(() => dmSetItemProgress(0, false), 500);
  } catch (e) {
    if (!dmAllItems.length && note) note.textContent = 'Failed to load items. Check your internet connection, then hit Reload.';
    console.error('Item load failed:', e);
    dmSetItemProgress(0, false);
  }
}

// Rarity order for DM item sort (mundane sits below common).
const DM_ITEM_RARITY_ORDER = { mundane: 0, unknown: 0, common: 1, uncommon: 2, rare: 3, 'very rare': 4, legendary: 5, artifact: 6 };
let _dmItemBrowser = null;

// Build (or refresh) the virtualized DM item browser over dmAllItems.
function dmInitItemBrowser() {
  const root = document.getElementById('dmItemsList');
  const search = document.getElementById('dmItemSearch');
  if (!root || !search) return;
  if (_dmItemBrowser) { _dmItemBrowser.refresh(); return; }

  const rk = it => (it.rarity || '').toLowerCase();
  _dmItemBrowser = createListBrowser({
    data: () => dmAllItems,
    root,
    searchInput: search,
    countEl: document.getElementById('dmItemCount'),
    sortEl: document.getElementById('dmItemSort'),
    searchFields: it => `${it.name} ${it.type || ''} ${it.category || ''} ${it.desc || ''}`,
    filters: [
      { el: document.getElementById('dmItemTypeFilter'), match: (it, v) => v === '' || it.category === v },
      { el: document.getElementById('dmItemRarityFilter'), match: (it, v) => v === '' || rk(it) === v },
      { el: document.getElementById('dmItemAttuneFilter'), match: (it, v) => v === '' || (v === 'yes' ? (it.attune && it.attune !== 'No') : (!it.attune || it.attune === 'No')) },
    ],
    sorts: {
      name: (a, b) => a.name.localeCompare(b.name),
      rarity: (a, b) => ((DM_ITEM_RARITY_ORDER[rk(a)] || 0) - (DM_ITEM_RARITY_ORDER[rk(b)] || 0)) || a.name.localeCompare(b.name),
      rarityDesc: (a, b) => ((DM_ITEM_RARITY_ORDER[rk(b)] || 0) - (DM_ITEM_RARITY_ORDER[rk(a)] || 0)) || a.name.localeCompare(b.name),
    },
    rowHeight: 52,
    rowClass: 'dm-monster-row',
    emptyText: 'No items match. Try a different search or filters.',
    renderRow: it => `
      <span class="dm-monster-name">${escapeHtml(it.name)}</span>
      <span class="dm-monster-meta">${escapeHtml(it.category)} · ${escapeHtml(it.type)}${it.rarity && it.rarity !== 'mundane' ? ' · ' + escapeHtml(it.rarity) : ''}${it.attune && it.attune !== 'No' ? ' · attunement' : ''}</span>`,
    onRowClick: it => dmShowItem(it.key),
  });
  _dmItemBrowser.refresh();
}

function dmShowItem(key) {
  const detail = document.getElementById('dmItemDetail');
  const name = document.getElementById('dmItemDetailName');
  const body = document.getElementById('dmItemDetailBody');
  if (!detail || !body) return;

  const it = dmAllItems.find(x => x.key === key);
  if (!it) return;

  if (name) name.textContent = it.name;
  const extraRows = (it.extra || [])
    .filter(([, v]) => v && v !== '—')
    .map(([k, v]) => `<div class="dm-sb-row"><strong>${escapeHtml(k)}</strong> ${escapeHtml(String(v))}</div>`)
    .join('');
  body.innerHTML = `
    <div class="dm-stat-block">
      <div class="dm-sb-meta">${escapeHtml(it.category)} — ${escapeHtml(it.type)}${it.rarity && it.rarity !== 'mundane' ? ', ' + escapeHtml(it.rarity) : ''}</div>
      <div class="dm-sb-divider"></div>
      ${it.attune && it.attune !== 'No' ? `<div class="dm-sb-row"><strong>Requires Attunement</strong> ${escapeHtml(it.attune)}</div>` : ''}
      ${extraRows}
      ${it.source ? `<div class="dm-sb-row"><strong>Source</strong> ${escapeHtml(it.source)}</div>` : ''}
      ${it.desc ? `<div class="dm-sb-divider"></div><div class="dm-sb-desc">${dmItemDescHtml(it.desc)}</div>` : ''}
    </div>
    <button class="dm-action-btn" style="margin-top:12px;" onclick="dmAddItemToNpcLoot('${escapeHtml(it.name)}')">Add to NPC Loot</button>
  `;
  detail.style.display = 'block';
  detail.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

// Render multi-paragraph item descriptions safely (escape, then keep breaks).
function dmItemDescHtml(desc) {
  return String(desc).split(/\n+/).map(p => `<p>${escapeHtml(p)}</p>`).join('');
}

// Append the item name to the NPC generator's loot field (DM's own data only).
function dmAddItemToNpcLoot(itemName) {
  const el = document.getElementById('dmNpcLootResult');
  if (!el) { dmToast('Open the NPCs tab first.', 'error'); return; }
  const existing = (el.textContent || '').trim();
  const isPlaceholder = el.classList.contains('dm-empty-state') || !existing;
  el.textContent = isPlaceholder ? itemName : `${existing} · ${itemName}`;
  el.classList.remove('dm-empty-state');
  dmToast(`Added "${itemName}" to NPC loot.`, 'success');
}

window.dmLoadItems = dmLoadItems;
window.dmInitItemBrowser = dmInitItemBrowser;
window.dmShowItem = dmShowItem;
window.dmAddItemToNpcLoot = dmAddItemToNpcLoot;

// ─── Encounters ────────────────────────────────────────────────────────────

let dmCombatants = [];

// ─── Encounter math (DMG 5e) ───────────────────────────────────────────────

// Per-character XP thresholds by level: [easy, medium, hard, deadly] (DMG p.82).
const DM_XP_THRESHOLDS = {
  1:[25,50,75,100], 2:[50,100,150,200], 3:[75,150,225,400], 4:[125,250,375,500],
  5:[250,500,750,1100], 6:[300,600,900,1400], 7:[350,750,1100,1700], 8:[450,900,1400,2100],
  9:[550,1100,1600,2400], 10:[600,1200,1900,2800], 11:[800,1600,2400,3600], 12:[1000,2000,3000,4500],
  13:[1100,2200,3400,5100], 14:[1250,2500,3800,5700], 15:[1400,2800,4300,6400], 16:[1600,3200,4800,7200],
  17:[2000,3900,5900,8800], 18:[2100,4200,6300,9500], 19:[2400,4900,7300,10900], 20:[2800,5700,8500,12700]
};

// Encounter multiplier by number of monsters (DMG p.82). Party-size note: this
// is the "average party of 3-5" column; we shift it for very small/large parties.
function dmEncounterMultiplier(monsterCount, partySize) {
  let idx;
  if (monsterCount <= 1) idx = 0;
  else if (monsterCount === 2) idx = 1;
  else if (monsterCount <= 6) idx = 2;
  else if (monsterCount <= 10) idx = 3;
  else if (monsterCount <= 14) idx = 4;
  else idx = 5;
  // Shift one step harder for small parties (<3), one step easier for large (>5).
  if (partySize < 3) idx = Math.min(idx + 1, 5);
  else if (partySize > 5) idx = Math.max(idx - 1, 0);
  return [1, 1.5, 2, 2.5, 3, 4][idx];
}

// Party state: array of { level, count }. Default a typical level-3 party of 4.
let dmParty = [{ level: 3, count: 4 }];

function dmPartySize() {
  return dmParty.reduce((n, r) => n + (Number(r.count) || 0), 0);
}

// Sum the party's XP thresholds → { easy, medium, hard, deadly }.
function dmPartyThresholds() {
  const t = { easy: 0, medium: 0, hard: 0, deadly: 0 };
  dmParty.forEach(({ level, count }) => {
    const row = DM_XP_THRESHOLDS[Math.max(1, Math.min(20, Number(level) || 1))];
    const c = Number(count) || 0;
    t.easy += row[0] * c; t.medium += row[1] * c; t.hard += row[2] * c; t.deadly += row[3] * c;
  });
  return t;
}

// 7-tier difficulty. Brutal/Mythic push beyond the DMG ceiling for grand battles.
// Returns the FLOOR adjusted-XP for a tier given the party thresholds.
const DM_DIFFICULTY_TIERS = ['trivial','easy','medium','hard','deadly','brutal','mythic'];
const DM_DIFFICULTY_LABELS = { trivial:'Trivial', easy:'Easy', medium:'Medium', hard:'Hard', deadly:'Deadly', brutal:'Brutal', mythic:'Mythic' };

// House-rule aggression multiplier. Applied to EVERY tier target, which is the
// single source the build budget, the rating bands, AND the readouts all derive
// from — so the whole system scales together. Encounters run 50% beefier than
// the DMG baseline, and the difficulty label stays honest (pick Medium → get a
// harder-than-vanilla fight that still reads "Medium", never a tier off).
const DM_ENCOUNTER_XP_MULT = 1.5;

function dmTierTargetXp(tier, th) {
  th = th || dmPartyThresholds();
  let base;
  switch (tier) {
    case 'trivial': base = Math.round(th.easy * 0.5); break;
    case 'easy':    base = th.easy; break;
    case 'medium':  base = th.medium; break;
    case 'hard':    base = th.hard; break;
    case 'deadly':  base = th.deadly; break;
    case 'brutal':  base = Math.round(th.deadly * 1.5); break;
    case 'mythic':  base = Math.round(th.deadly * 2.5); break;
    default:        base = th.medium; break;
  }
  return Math.round(base * DM_ENCOUNTER_XP_MULT);
}

// Ceiling (exclusive) of a tier's band = the next tier's floor. The top tier
// (mythic) has no ceiling. Used to keep a generated encounter inside its band.
function dmTierCeilingXp(tier, th) {
  th = th || dmPartyThresholds();
  const i = DM_DIFFICULTY_TIERS.indexOf(tier);
  const next = DM_DIFFICULTY_TIERS[i + 1];
  return next ? dmTierTargetXp(next, th) : Infinity;
}

// Given a set of monster XP values, return total XP + difficulty label.
// NOTE: we rate on RAW summed XP (no encounter count-multiplier). The multiplier
// made the live meter disagree with the picker — adding more weak monsters could
// tip a "Medium" build into Deadly purely from the count bump. Rating raw XP
// against the thresholds keeps pick = display exactly. `adjusted` == `rawXp`.
function dmRateEncounter(monsterXps) {
  const rawXp = monsterXps.reduce((a, b) => a + (Number(b) || 0), 0);
  const adjusted = rawXp;
  const th = dmPartyThresholds();

  let cls = 'trivial';
  if (adjusted >= dmTierTargetXp('mythic', th)) cls = 'mythic';
  else if (adjusted >= dmTierTargetXp('brutal', th)) cls = 'brutal';
  else if (adjusted >= dmTierTargetXp('deadly', th)) cls = 'deadly';
  else if (adjusted >= dmTierTargetXp('hard', th)) cls = 'hard';
  else if (adjusted >= dmTierTargetXp('medium', th)) cls = 'medium';
  else if (adjusted >= dmTierTargetXp('easy', th)) cls = 'easy';
  return { rawXp, adjusted, mult: 1, label: DM_DIFFICULTY_LABELS[cls], cls, thresholds: th };
}

// ─── Live difficulty meter ─────────────────────────────────────────────────

function dmRenderPartyRows() {
  const wrap = document.getElementById('dmPartyRows');
  if (!wrap) return;
  const totalPlayers = dmParty.reduce((n, r) => n + (Number(r.count) || 0), 0);
  wrap.innerHTML = dmParty.map((r, i) => `
    <div class="dm-party-row">
      <div class="dm-party-field">
        <label>Players</label>
        <input type="number" min="1" max="12" value="${r.count}" title="How many players at this level"
          onchange="dmUpdateParty(${i}, 'count', this.value)">
      </div>
      <span class="dm-party-at">at level</span>
      <div class="dm-party-field">
        <label>Level</label>
        <input type="number" min="1" max="20" value="${r.level}" title="Their character level"
          onchange="dmUpdateParty(${i}, 'level', this.value)">
      </div>
      ${dmParty.length > 1 ? `<button class="dm-icon-btn dm-remove-btn dm-party-remove" onclick="dmRemovePartyRow(${i})" title="Remove this group">✕</button>` : ''}
    </div>
  `).join('') +
  `<div class="dm-party-total">${totalPlayers} player${totalPlayers === 1 ? '' : 's'} total</div>`;
}

function dmUpdateParty(i, field, value) {
  if (!dmParty[i]) return;
  const num = Math.max(1, parseInt(value, 10) || 1);
  dmParty[i][field] = field === 'level' ? Math.min(20, num) : num;
  dmRenderPartyRows();
  dmUpdateDifficultyMeter();
}

function dmAddPartyRow() {
  dmParty.push({ level: 3, count: 1 });
  dmRenderPartyRows();
  dmUpdateDifficultyMeter();
}

function dmRemovePartyRow(i) {
  dmParty.splice(i, 1);
  if (!dmParty.length) dmParty.push({ level: 3, count: 4 });
  dmRenderPartyRows();
  dmUpdateDifficultyMeter();
}

// Rate the CURRENT combatant list and paint the meter.
function dmUpdateDifficultyMeter() {
  const el = document.getElementById('dmDifficultyMeter');
  if (!el) return;
  const xps = dmCombatants.filter(c => c.isMonster !== false && Number(c.xp) > 0).map(c => c.xp);
  const th = dmPartyThresholds();

  if (!xps.length) {
    el.className = 'dm-difficulty-meter';
    el.innerHTML = `<span class="dm-diff-label">Add rated monsters to see difficulty</span>
      <span class="dm-diff-budget">Party budget — Easy ${dmTierTargetXp('easy', th)} · Med ${dmTierTargetXp('medium', th)} · Hard ${dmTierTargetXp('hard', th)} · Deadly ${dmTierTargetXp('deadly', th)} XP</span>`;
    return;
  }
  const r = dmRateEncounter(xps);
  el.className = `dm-difficulty-meter diff-${r.cls}`;
  el.innerHTML = `
    <span class="dm-diff-label">${r.label}</span>
    <span class="dm-diff-xp">${r.adjusted.toLocaleString()} XP <span class="dm-diff-mult">(${xps.length} monster${xps.length === 1 ? '' : 's'})</span></span>
    <span class="dm-diff-budget">Thresholds — Easy ${dmTierTargetXp('easy', th)} · Med ${dmTierTargetXp('medium', th)} · Hard ${dmTierTargetXp('hard', th)} · Deadly ${dmTierTargetXp('deadly', th)}</span>`;
}

function dmAddCombatant() {
  const name = (document.getElementById('dmCombatantName')?.value || '').trim();
  const hp = parseInt(document.getElementById('dmCombatantHp')?.value || '0', 10);
  const ac = parseInt(document.getElementById('dmCombatantAc')?.value || '10', 10);
  const count = parseInt(document.getElementById('dmCombatantCount')?.value || '1', 10);
  if (!name || hp < 1) return;

  for (let i = 0; i < Math.max(1, count); i++) {
    const label = count > 1 ? `${name} ${i + 1}` : name;
    // Manually-added combatants are unrated (players/custom) — excluded from XP math.
    dmCombatants.push({ id: Date.now() + i, name: label, maxHp: hp, hp, ac, initiative: 0, isMonster: false, xp: 0 });
  }
  document.getElementById('dmCombatantName').value = '';
  document.getElementById('dmCombatantHp').value = '';
  document.getElementById('dmCombatantAc').value = '';
  document.getElementById('dmCombatantCount').value = '1';
  dmRenderCombatants();
  dmUpdateDifficultyMeter();
}

// Add a player to the encounter: name + their total (already-rolled) initiative.
// Players are unrated (no XP), optional HP/AC, and flagged for distinct styling.
function dmAddPlayer() {
  const name = (document.getElementById('dmPlayerName')?.value || '').trim();
  if (!name) return;
  const init = parseInt(document.getElementById('dmPlayerInit')?.value || '0', 10) || 0;
  const hpRaw = document.getElementById('dmPlayerHp')?.value;
  const acRaw = document.getElementById('dmPlayerAc')?.value;
  const hp = parseInt(hpRaw, 10);
  const ac = parseInt(acRaw, 10);
  const hasHp = !isNaN(hp) && hp > 0;
  dmCombatants.push({
    id: Date.now(), name, initiative: init,
    maxHp: hasHp ? hp : 0, hp: hasHp ? hp : 0,
    ac: !isNaN(ac) ? ac : null,
    isMonster: false, isPlayer: true, xp: 0
  });
  document.getElementById('dmPlayerName').value = '';
  document.getElementById('dmPlayerInit').value = '';
  if (document.getElementById('dmPlayerHp')) document.getElementById('dmPlayerHp').value = '';
  if (document.getElementById('dmPlayerAc')) document.getElementById('dmPlayerAc').value = '';
  dmRenderCombatants();
  dmUpdateDifficultyMeter();
}

async function dmAddMonsterToEncounter(slug) {
  // Resolve the full monster record (cache first, then API) so the combatant
  // carries its Dex (for real initiative) and stat block (for the card).
  let m = dmAllMonsters.find(x => x.slug === slug);
  if (!m && slug) m = await fetch(`https://api.open5e.com/v1/monsters/${slug}/`).then(r => r.json()).catch(() => null);
  if (!m) { dmToast('Could not load that monster.', 'error'); return; }
  if (m.slug && !dmAllMonsters.find(x => x.slug === m.slug)) dmAllMonsters.push(m);

  const cr = m.challenge_rating ?? null;
  const hp = m.hit_points ?? 10;
  const ac = m.armor_class ?? 10;
  const dex = (typeof m.dexterity === 'number') ? m.dexterity : null;
  const xp = (cr !== undefined && cr !== null) ? (parseInt(String(dmCrToXp(cr)).replace(/[^0-9]/g, ''), 10) || 0) : 0;
  const init = rnd(1, 20) + dmModNum(dex);
  dmCombatants.push({
    id: Date.now(), name: m.name, maxHp: hp, hp, ac, initiative: init,
    cr, xp, isMonster: true, slug: m.slug || null, dex, statBlock: m
  });
  dmRenderCombatants();
  dmUpdateDifficultyMeter();
  switchDmTabById('dm-encounters');
}

// Order mode: 'init' sorts the list by initiative (turn order); 'manual' keeps
// the array order so drag-reorder sticks. Drag in init mode flips to manual.
let dmOrderMode = 'init';

function dmSetOrderMode(mode) {
  dmOrderMode = (mode === 'manual') ? 'manual' : 'init';
  dmRenderCombatants();
}

// Export the current encounter as a plain-text combat log (initiative order + HP/AC),
// copied to the clipboard so a DM can paste it into notes, a VTT, or Discord.
function dmExportCombatLog() {
  if (!dmCombatants.length) { dmToast('No combatants to export.', 'error'); return; }

  const name = (document.getElementById('dmEncounterName')?.value || '').trim();
  const rows = dmCombatants.slice().sort((a, b) => (b.initiative || 0) - (a.initiative || 0));

  const lines = [];
  lines.push(name ? `Combat Log — ${name}` : 'Combat Log');
  lines.push(new Date().toLocaleString());
  lines.push('');
  lines.push('Init | Name                     | HP        | AC');
  lines.push('-----+--------------------------+-----------+----');
  rows.forEach(c => {
    const init = String(c.initiative ?? 0).padStart(4, ' ');
    const nm = String(c.name || '?').slice(0, 24).padEnd(24, ' ');
    const hp = (c.hp != null || c.maxHp != null)
      ? `${c.hp ?? '?'}/${c.maxHp ?? '?'}`.padEnd(9, ' ')
      : '—        ';
    const ac = c.ac != null && c.ac !== '' ? String(c.ac) : '—';
    lines.push(` ${init} | ${nm} | ${hp} | ${ac}`);
  });
  lines.push('');
  lines.push(`${rows.length} combatant${rows.length === 1 ? '' : 's'}.`);
  const text = lines.join('\n');

  const done = () => dmToast('Combat log copied to clipboard.', 'success');
  const fail = () => {
    // Fallback: show it in a modal so the DM can copy manually.
    if (typeof dmModal === 'function') {
      dmModal({ title: 'Combat Log', message: text, confirmText: 'Close', cancelText: 'Close' });
    } else {
      dmToast('Could not copy — clipboard blocked.', 'error');
    }
  };

  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(done).catch(fail);
  } else {
    fail();
  }
}

function dmRenderCombatants() {
  const list = document.getElementById('dmCombatantList');
  if (!list) return;
  if (!dmCombatants.length) { list.innerHTML = '<p class="dm-empty-state">No combatants yet. Add players, generate monsters, or add them from the Monsters tab.</p>'; return; }

  // In init mode we render a sorted view but never mutate the array; in manual
  // mode we render the array as-is so drag order is the source of truth.
  const rows = dmOrderMode === 'init'
    ? dmCombatants.slice().sort((a, b) => (b.initiative || 0) - (a.initiative || 0))
    : dmCombatants;

  const header = `
    <div class="dm-combatant-order-bar">
      <span class="dm-order-label">Order</span>
      <div class="dm-order-toggle">
        <button class="dm-order-btn ${dmOrderMode === 'init' ? 'active' : ''}" onclick="dmSetOrderMode('init')" title="Sort by initiative (turn order)">Initiative</button>
        <button class="dm-order-btn ${dmOrderMode === 'manual' ? 'active' : ''}" onclick="dmSetOrderMode('manual')" title="Keep your arranged order — drag to reorder">Manual</button>
      </div>
      <span class="dm-order-hint">${dmOrderMode === 'manual' ? 'Drag rows by the ⠿ handle to reorder.' : 'Highest initiative first.'}</span>
    </div>`;

  list.innerHTML = header + rows.map((c, idx) => {
    const isPlayer = !!c.isPlayer;
    const hasHp = Number(c.maxHp) > 0;
    const hpCls = !hasHp ? '' : (c.hp <= 0 ? 'dm-hp-dead' : c.hp <= c.maxHp * 0.25 ? 'dm-hp-low' : '');
    const canExpand = !!c.statBlock;
    const expanded = dmExpandedCombatants.has(c.id);
    const turnNo = dmOrderMode === 'init' ? `<span class="dm-turn-no" title="Turn order">${idx + 1}</span>` : '';
    return `
    <div class="dm-combatant-row ${expanded ? 'dm-combatant-expanded' : ''} ${isPlayer ? 'dm-combatant-player' : ''}"
         id="dmC_${c.id}" draggable="true"
         ondragstart="dmCombatantDragStart(event, ${c.id})"
         ondragend="dmCombatantDragEnd(event)"
         ondragover="dmCombatantDragOver(event, ${c.id})"
         ondrop="dmCombatantDrop(event, ${c.id})">
      <span class="dm-drag-handle" title="Drag anywhere on this row to reorder">⠿</span>
      ${turnNo}
      <div class="dm-combatant-init">
        <label>Init</label>
        <input type="number" value="${c.initiative}" style="width:52px;" onchange="dmSetInit(${c.id}, this.value)" title="Initiative — override anytime">
      </div>
      <div class="dm-combatant-info">
        <span class="dm-combatant-name ${canExpand ? 'dm-combatant-clickable' : ''}"
              ${canExpand ? `onclick="dmToggleCombatantCard(${c.id})" title="Click for stat block"` : ''}>
          ${canExpand ? (expanded ? '▾ ' : '▸ ') : ''}${escapeHtml(c.name)}
          ${isPlayer ? '<span class="dm-player-badge">PLAYER</span>' : ''}
        </span>
      </div>
      ${(isPlayer && c.ac == null) ? '' : `
      <span class="dm-combatant-ac">
        <label>AC</label>
        <input type="number" value="${c.ac ?? ''}" min="0" max="99" style="width:46px;" placeholder="—" onchange="dmSetAc(${c.id}, this.value)" title="Armor Class — override anytime">
      </span>`}
      ${hasHp ? `
      <div class="dm-combatant-hp">
        <button class="dm-hp-btn" onclick="dmDamage(${c.id})" title="Damage">−</button>
        <span class="dm-combatant-hp-edit ${hpCls}">
          <input type="number" value="${c.hp}" min="0" max="9999" style="width:48px;" onchange="dmSetHp(${c.id}, this.value)" title="Current HP — override anytime">
          <span class="dm-hp-sep">/</span>
          <input type="number" value="${c.maxHp}" min="1" max="9999" style="width:48px;" onchange="dmSetMaxHp(${c.id}, this.value)" title="Max HP — override anytime">
        </span>
        <button class="dm-hp-btn" onclick="dmHeal(${c.id})" title="Heal">+</button>
      </div>` : (isPlayer ? `<div class="dm-combatant-hp dm-player-nohp"><button class="dm-hp-btn" onclick="dmAddPlayerHp(${c.id})" title="Track HP for this player">+ HP</button></div>` : '')}
      ${isPlayer ? '' : `<button class="dm-icon-btn dm-elite-btn ${c._elite ? 'is-elite' : ''}" onclick="dmToggleElite(${c.id})" title="${c._elite ? 'Revert from elite' : 'Make elite (buff HP/AC/damage ×3)'}">★</button>`}
      <button class="dm-icon-btn dm-remove-btn" onclick="dmRemoveCombatant(${c.id})" title="Remove">✕</button>
      ${expanded && c.statBlock ? `<div class="dm-combatant-card">${c._upscaled ? `<div class="dm-upscale-banner">${c._elite ? '★ Elite' : '⇧ Upscaled'} ×${c._upscaled.toFixed(2)} — the stat block below is the BASE creature. This one uses AC ${c.ac} / HP ${c.maxHp}, and roll its damage ×${(c._dmgMult || c._upscaled).toFixed(2)} (base was AC ${c._origAc} / HP ${c._origHp}).</div>` : ''}${dmRenderStatBlockHtml(c.statBlock)}</div>` : ''}
    </div>`;
  }).join('');
}

// ─── Drag-reorder for combatant rows ───────────────────────────────────────
let dmDragId = null;

function dmCombatantDragStart(e, id) {
  // The whole row is draggable, but don't hijack drags that start on an
  // interactive element — let inputs/buttons/links behave normally (text
  // selection, clicks). Drag works from any non-interactive part of the row.
  if (e.target.closest('input, button, select, a, textarea')) {
    e.preventDefault();
    return;
  }
  dmDragId = id;
  e.dataTransfer.effectAllowed = 'move';
  // Some browsers need data set for drag to fire.
  try { e.dataTransfer.setData('text/plain', String(id)); } catch (_) {}
  const row = document.getElementById(`dmC_${id}`);
  if (row) row.classList.add('dm-dragging');
}

function dmCombatantDragOver(e, id) {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
}

function dmCombatantDrop(e, targetId) {
  e.preventDefault();
  if (dmDragId == null || dmDragId === targetId) return;
  const from = dmCombatants.findIndex(c => c.id === dmDragId);
  const to = dmCombatants.findIndex(c => c.id === targetId);
  if (from < 0 || to < 0) return;
  const [moved] = dmCombatants.splice(from, 1);
  dmCombatants.splice(to, 0, moved);
  // Reordering implies the DM wants a hand-arranged order.
  dmOrderMode = 'manual';
  dmDragId = null;
  dmRenderCombatants();
}

function dmCombatantDragEnd(e) {
  dmDragId = null;
  document.querySelectorAll('.dm-combatant-row.dm-dragging').forEach(el => el.classList.remove('dm-dragging'));
}

// Let a player row start tracking HP on demand.
async function dmAddPlayerHp(id) {
  const c = dmCombatants.find(x => x.id === id);
  if (!c) return;
  const val = await dmModal({ title: `Track HP for ${c.name}`, input: true, inputType: 'number', placeholder: 'Max HP', confirmText: 'Set' });
  const hp = parseInt(val || '0', 10);
  if (!hp || hp < 1) return;
  c.maxHp = hp; c.hp = hp;
  dmRenderCombatants();
}

// Tracks which combatant rows have their stat card expanded.
let dmExpandedCombatants = new Set();

function dmToggleCombatantCard(id) {
  if (dmExpandedCombatants.has(id)) dmExpandedCombatants.delete(id);
  else dmExpandedCombatants.add(id);
  dmRenderCombatants();
}

function dmSetAc(id, val) {
  const c = dmCombatants.find(x => x.id === id);
  if (!c) return;
  const n = parseInt(val, 10);
  c.ac = (val === '' || isNaN(n)) ? null : Math.max(0, n);
}

function dmSetHp(id, val) {
  const c = dmCombatants.find(x => x.id === id);
  if (!c) return;
  c.hp = Math.max(0, Math.min(c.maxHp, parseInt(val, 10) || 0));
  dmRenderCombatants();
}

function dmSetMaxHp(id, val) {
  const c = dmCombatants.find(x => x.id === id);
  if (!c) return;
  c.maxHp = Math.max(1, parseInt(val, 10) || 1);
  if (c.hp > c.maxHp) c.hp = c.maxHp;
  dmRenderCombatants();
}

async function dmDamage(id) {
  const c = dmCombatants.find(x => x.id === id);
  if (!c) return;
  const val = await dmModal({ title: `Damage ${c.name}`, input: true, inputType: 'number', placeholder: 'Amount', confirmText: 'Apply', danger: true });
  const amt = parseInt(val || '0', 10);
  if (!amt) return;
  c.hp = Math.max(0, c.hp - amt);
  dmRenderCombatants();
}

async function dmHeal(id) {
  const c = dmCombatants.find(x => x.id === id);
  if (!c) return;
  const val = await dmModal({ title: `Heal ${c.name}`, input: true, inputType: 'number', placeholder: 'Amount', confirmText: 'Apply' });
  const amt = parseInt(val || '0', 10);
  if (!amt) return;
  c.hp = Math.min(c.maxHp, c.hp + amt);
  dmRenderCombatants();
}

function dmSetInit(id, val) {
  const c = dmCombatants.find(x => x.id === id);
  if (c) c.initiative = parseInt(val, 10) || 0;
}

function dmRemoveCombatant(id) {
  dmCombatants = dmCombatants.filter(c => c.id !== id);
  dmRenderCombatants();
  dmUpdateDifficultyMeter();
}

// Manual per-creature elite toggle (from the combatant list). ON = buff ×3
// (HP/AC/damage, name gets "[Elite ★⇧]"); OFF = revert to the stored base stats.
function dmToggleElite(id) {
  const c = dmCombatants.find(x => x.id === id);
  if (!c || c.isPlayer) return;
  if (c._elite || c._upscaled) {
    // Revert to base stats saved when it was buffed.
    if (c._origHp != null) { c.maxHp = c._origHp; c.hp = Math.min(c.hp, c._origHp); }
    if (c._origAc != null) c.ac = c._origAc;
    if (c._baseXp != null) c.xp = c._baseXp;
    c.name = dmNameStem(c.name);
    delete c._elite; delete c._upscaled; delete c._dmgMult;
    delete c._origHp; delete c._origAc; delete c._baseXp;
  } else {
    c._baseXp = c.xp; // remember for a clean revert
    dmApplyBuff(c, DM_ELITE_MAX_FACTOR, true);
  }
  dmRenderCombatants();
  dmUpdateDifficultyMeter();
}
window.dmToggleElite = dmToggleElite;

function dmClearEncounter() {
  dmCombatants = [];
  dmRenderCombatants();
  dmUpdateDifficultyMeter();
  const n = document.getElementById('dmEncounterName');
  if (n) n.value = '';
}

// Save the current encounter (combatants + card) to the Saved tab.
function dmSaveEncounter() {
  if (!dmCombatants.length) { dmToast('Nothing to save yet.', 'error'); return; }
  const typed = (document.getElementById('dmEncounterName')?.value || '').trim();
  const card = dmCurrentEncounterCard;
  const name = typed || (card && card.intro ? card.intro.slice(0, 48) : '') || 'Unnamed Encounter';
  const saved = dmGetSavedEncounters();
  saved.unshift({
    id: Date.now(),
    name,
    savedAt: new Date().toISOString(),
    // Drop the bulky statBlock on save (it's re-hydrated from slug on load);
    // keep slug + dex so initiative + the stat card still work after reload.
    combatants: JSON.parse(JSON.stringify(dmCombatants.map(c => ({ ...c, statBlock: undefined })))),
    card: card ? JSON.parse(JSON.stringify({
      intro: card.intro || '', tips: card.tips || '', notes: card.notes || '',
      shapeDesc: card.shapeDesc || '', difficulty: card.difficulty || '',
      rating: card.rating ? { label: card.rating.label, cls: card.rating.cls, adjusted: card.rating.adjusted } : null
    })) : null
  });
  localStorage.setItem('dndDmEncounters', JSON.stringify(saved));
  dmRenderSavedEncounters();
  dmToast(`Saved "${name}".`, 'success');
}

// Save straight from the encounter card button.
function dmSaveCurrentEncounter() { dmSaveEncounter(); }

function dmGetSavedEncounters() {
  try { return JSON.parse(localStorage.getItem('dndDmEncounters') || '[]'); } catch { return []; }
}

function dmRenderSavedEncounters() {
  const list = document.getElementById('dmSavedEncounterList');
  if (!list) return;
  const saved = dmGetSavedEncounters();
  if (!saved.length) { list.innerHTML = '<p class="dm-empty-state">No saved encounters yet. Generate one you like and hit “Save Encounter”.</p>'; return; }

  list.innerHTML = saved.map(e => {
    const r = e.card && e.card.rating;
    const when = (() => { try { return new Date(e.savedAt).toLocaleDateString(); } catch (_) { return ''; } })();
    return `
    <div class="dm-saved-enc" id="dmSavedEnc_${e.id}">
      <div class="dm-saved-enc-head" onclick="dmToggleSavedEnc(${e.id})">
        <div class="dm-saved-enc-title">
          <span class="dm-saved-encounter-name">${escapeHtml(e.name)}</span>
          <span class="dm-saved-encounter-count">${e.combatants.length} combatant${e.combatants.length === 1 ? '' : 's'}${when ? ' · ' + when : ''}</span>
        </div>
        ${r ? `<span class="dm-difficulty-pill diff-${r.cls || 'medium'}">${escapeHtml(r.label || '')}</span>` : ''}
      </div>
      <div class="dm-saved-enc-body" data-saved-body="${e.id}" style="display:none;">
        ${e.card && e.card.intro ? `<p class="dm-saved-enc-intro">${escapeHtml(e.card.intro)}</p>` : ''}
        ${e.card && e.card.tips ? `<p class="dm-note"><strong>How to run:</strong> ${escapeHtml(e.card.tips)}</p>` : ''}
        <ul class="dm-saved-enc-list">
          ${e.combatants.filter(c => c.isMonster !== false).map(c => {
            const openable = !!c.slug;
            return `<li class="${openable ? 'dm-init-openable' : ''}" ${openable ? `onclick="dmOpenSavedCreature('${escapeHtml(c.slug)}', '${escapeHtml(c.name).replace(/'/g, "\\'")}')" title="Open ${escapeHtml(c.name)} stat block"` : ''}>${escapeHtml(c.name)}${openable ? ' <span class="dm-init-open-hint">▸ stats</span>' : ''} <span class="dm-init-ac">AC ${c.ac} · ${c.maxHp} HP</span></li>`;
          }).join('')}
        </ul>
        <label class="dm-enc-card-label">Notes</label>
        <textarea class="dm-enc-card-text" rows="3" placeholder="Notes for this encounter..." oninput="dmUpdateSavedNotes(${e.id}, this.value)">${escapeHtml(e.card && e.card.notes ? e.card.notes : '')}</textarea>
        <div class="dm-name-row" style="margin-top:10px;">
          <button class="dm-action-btn dm-save-btn" onclick="dmLoadEncounter(${e.id})">Load into Builder</button>
          <button class="dm-action-btn dm-remove-btn" onclick="dmDeleteEncounter(${e.id})">Delete</button>
        </div>
      </div>
    </div>`;
  }).join('');
}

function dmToggleSavedEnc(id) {
  const body = document.querySelector(`[data-saved-body="${id}"]`);
  if (body) body.style.display = body.style.display === 'none' ? 'block' : 'none';
}

// Persist edited notes on a saved encounter.
function dmUpdateSavedNotes(id, value) {
  const saved = dmGetSavedEncounters();
  const enc = saved.find(e => e.id === id);
  if (!enc) return;
  if (!enc.card) enc.card = { intro: '', tips: '', notes: '', rating: null };
  enc.card.notes = value;
  localStorage.setItem('dndDmEncounters', JSON.stringify(saved));
}

function dmLoadEncounter(id) {
  const enc = dmGetSavedEncounters().find(e => e.id === id);
  if (!enc) return;
  dmExpandedCombatants = new Set();
  dmCombatants = enc.combatants.map(c => {
    // Re-hydrate the stat block from cache by slug (it's stripped on save).
    const sb = c.slug ? dmAllMonsters.find(m => m.slug === c.slug) : null;
    return { ...c, hp: c.maxHp, statBlock: sb || c.statBlock || null };
  });
  const n = document.getElementById('dmEncounterName');
  if (n) n.value = enc.name;
  // Restore the card too, if it was saved.
  if (enc.card) {
    dmCurrentEncounterCard = { ...enc.card, keepNotes: true };
    dmRenderEncounterCard();
  }
  dmRenderCombatants();
  dmUpdateDifficultyMeter();
  dmSetMode('encounter', 'build');
  dmToast(`Loaded "${enc.name}" into the builder.`, 'success');
}

function dmDeleteEncounter(id) {
  const saved = dmGetSavedEncounters().filter(e => e.id !== id);
  localStorage.setItem('dndDmEncounters', JSON.stringify(saved));
  dmRenderSavedEncounters();
}

window.dmAddCombatant = dmAddCombatant;
window.dmAddPlayer = dmAddPlayer;
window.dmAddPlayerHp = dmAddPlayerHp;
window.dmSetOrderMode = dmSetOrderMode;
window.dmCombatantDragStart = dmCombatantDragStart;
window.dmCombatantDragOver = dmCombatantDragOver;
window.dmCombatantDrop = dmCombatantDrop;
window.dmCombatantDragEnd = dmCombatantDragEnd;
window.dmAddMonsterToEncounter = dmAddMonsterToEncounter;
window.dmDamage = dmDamage;
window.dmHeal = dmHeal;
window.dmSetInit = dmSetInit;
window.dmSetAc = dmSetAc;
window.dmSetHp = dmSetHp;
window.dmSetMaxHp = dmSetMaxHp;
window.dmToggleCombatantCard = dmToggleCombatantCard;
window.dmRemoveCombatant = dmRemoveCombatant;
window.dmClearEncounter = dmClearEncounter;
window.dmSaveEncounter = dmSaveEncounter;
window.dmSaveCurrentEncounter = dmSaveCurrentEncounter;
window.dmLoadEncounter = dmLoadEncounter;
window.dmDeleteEncounter = dmDeleteEncounter;
window.dmToggleSavedEnc = dmToggleSavedEnc;
window.dmUpdateSavedNotes = dmUpdateSavedNotes;
window.dmUpdateParty = dmUpdateParty;
window.dmAddPartyRow = dmAddPartyRow;
window.dmRemovePartyRow = dmRemovePartyRow;

// ─── Themed encounter generator (Open5e) ───────────────────────────────────

// Theme → how to match a monster. `types` matches the creature's `type`;
// `keywords` matches the name. A monster qualifies if it hits either.
const DM_ENCOUNTER_THEMES = {
  random:        { label: 'Random / Any', types: [], keywords: [] },
  bandits:       { label: 'Bandits & Cutthroats', types: ['humanoid'], keywords: ['bandit','thug','cutthroat','scout','spy','assassin','knight','guard','berserker','tribal','gladiator'] },
  beasts:        { label: 'Beasts & Wildlife', types: ['beast','monstrosity'], keywords: ['wolf','bear','boar','spider','rat','snake','lion','tiger','ape','crocodile','eagle','hawk'] },
  undead:        { label: 'Undead', types: ['undead'], keywords: ['zombie','skeleton','ghoul','ghost','wraith','wight','vampire','lich','specter','shadow','mummy'] },
  fiends:        { label: 'Fiends & Demons', types: ['fiend'], keywords: ['demon','devil','imp','quasit','hell','dretch','succubus','incubus'] },
  goblinoids:    { label: 'Goblinoids', types: ['humanoid'], keywords: ['goblin','hobgoblin','bugbear','orc','kobold','gnoll'] },
  casters:       { label: 'Spellcasters', types: [], keywords: ['mage','cult','priest','acolyte','warlock','wizard','sorcerer','druid','adept','necromancer','witch'] },
  fighters:      { label: 'Warriors & Brutes', types: [], keywords: ['knight','veteran','gladiator','berserker','guard','warrior','champion','soldier','captain','thug'] },
  aberrations:   { label: 'Aberrations', types: ['aberration'], keywords: ['aboleth','beholder','mind flayer','illithid','otyugh','gibbering','chuul','cloaker','slaad','nothic','flumph','grell'] },
  dragons:       { label: 'Dragons & Kin', types: ['dragon'], keywords: ['dragon','wyvern','drake','kobold','dragonborn','pseudodragon','wyrmling'] },
  giants:        { label: 'Giants', types: ['giant'], keywords: ['giant','ogre','troll','ettin','cyclops','oni','goliath'] },
  fey:           { label: 'Fey & Woodland', types: ['fey','plant'], keywords: ['dryad','satyr','pixie','sprite','hag','blink dog','treant','awakened','sylph','pooka','redcap','quickling'] },
  constructs:    { label: 'Constructs', types: ['construct'], keywords: ['golem','animated','construct','homunculus','scarecrow','shield guardian','helmed','clockwork'] },
  oozesVermin:   { label: 'Oozes & Vermin', types: ['ooze'], keywords: ['ooze','slime','jelly','pudding','cube','swarm','rat','spider','centipede','scorpion','wasp','insect','beetle'] },
  elementals:    { label: 'Elementals', types: ['elemental'], keywords: ['elemental','mephit','genie','djinn','efreeti','salamander','azer','gargoyle','magmin','water','fire','air','earth','invisible stalker'] },
  casterWarband: { label: 'Caster + Warband (combo)', types: [], keywords: ['mage','cult','priest','acolyte','warlock','necromancer','goblin','hobgoblin','bandit','skeleton','zombie','guard','thug','cultist'] },
  huntPack:      { label: 'Hunting Pack (combo)', types: ['beast','monstrosity'], keywords: ['wolf','worg','hyena','jackal','panther','raptor','hunter','pack','dire','sabre'] },
  bossMinions:   { label: 'Boss + Minions', types: [], keywords: [] }, // special: one strong + several weak

  // ── Human & faction groups (keyword-only so they DON'T pull in goblins/orcs,
  //    which share the 'humanoid' type). "Pure humans" = named human NPC roles. ──
  humansCommon:  { label: 'Pure Humans (townsfolk & thugs)', types: [], keywords: ['commoner','guard','bandit','thug','scout','tribal warrior','cultist','acolyte','noble','archer','spy','berserker'] },
  mercenaries:   { label: 'Mercenary Company', types: [], keywords: ['veteran','knight','gladiator','captain','guard','archer','berserker','soldier','swashbuckler','champion','scout','thug','bandit captain','warlord'] },
  cultists:      { label: 'Cult of Fanatics', types: [], keywords: ['cultist','cult fanatic','fanatic','priest','acolyte','dark','initiate','warlock','necromancer','mage','deathlock'] },
  assassinsSpies:{ label: 'Assassins & Spies', types: [], keywords: ['assassin','spy','scout','mage','thug','bandit captain','master thief','archer','swashbuckler','bandit'] },
  nobleCourt:    { label: 'Noble Court & Guards', types: [], keywords: ['noble','knight','guard','mage','captain','veteran','champion','squire','archer','priest','commoner'] },
  pirates:       { label: 'Pirates & Raiders', types: [], keywords: ['bandit','thug','pirate','captain','veteran','scout','berserker','swashbuckler','reaver','archer','bandit captain'] },
  tribalWarband: { label: 'Tribal Warband', types: [], keywords: ['tribal','berserker','warrior','shaman','druid','scout','chief','hunter','totem','commoner','archer'] },
  banditGang:    { label: 'Bandit Gang / Hideout', types: [], keywords: ['bandit','thug','scout','spy','bandit captain','berserker','archer','cutthroat','veteran','guard','commoner','mage'] },

  // ── Broad type buckets ──
  nonHumanoid:   { label: 'Any Non-Humanoid', types: [], keywords: [] }, // special: excludes 'humanoid'
  monstrosities: { label: 'Monstrosities', types: ['monstrosity'], keywords: ['chimera','manticore','griffon','hydra','basilisk','cockatrice','owlbear','displacer','bulette','roper','harpy','minotaur','yeti'] },
  plants:        { label: 'Plants & Fungi', types: ['plant'], keywords: ['shrieker','violet fungus','shambling','myconid','treant','awakened','vine','twig','needle','gas spore','quickling'] },
  swarms:        { label: 'Swarms', types: [], keywords: ['swarm'] },
  celestials:    { label: 'Celestials', types: ['celestial'], keywords: ['angel','deva','planetar','solar','pegasus','unicorn','couatl','ki-rin','empyrean'] },
  lycanthropes:  { label: 'Lycanthropes / Shapechangers', types: [], keywords: ['were','werewolf','wererat','werebear','weretiger','wereboar','shapechanger','doppelganger','lycanthrope'] },

  // ── Split fiends by law/chaos ──
  demons:        { label: 'Demons (chaotic)', types: [], keywords: ['demon','dretch','quasit','vrock','hezrou','glabrezu','balor','marilith','manes','shadow demon','barlgura'] },
  devils:        { label: 'Devils (lawful)', types: [], keywords: ['devil','imp','lemure','bearded devil','barbed devil','chain devil','bone devil','horned devil','erinyes','pit fiend','ice devil','spined devil'] },

  // ── More combos ──
  mixedWarband:  { label: 'Mixed Warband (combo)', types: [], keywords: ['goblin','hobgoblin','orc','bandit','wolf','worg','ogre','bugbear','kobold','guard','thug'] },
  undeadHorde:   { label: 'Undead Horde (combo)', types: ['undead'], keywords: ['zombie','skeleton','ghoul','ghast','wight','shadow','specter','crawling'] },
  beastHandlers: { label: 'Beasts + Handlers (combo)', types: [], keywords: ['wolf','worg','mastiff','bear','boar','goblin','hobgoblin','scout','druid','beastmaster','handler','tribal','hunter'] }
};

let dmMonsterPool = []; // cached, normalised: { name, type, cr, xp, hp, ac }

async function dmEnsureMonsterPool() {
  if (dmMonsterPool.length) return dmMonsterPool;
  // Reuse the Monsters tab cache if it was already loaded.
  if (Array.isArray(dmAllMonsters) && dmAllMonsters.length) {
    dmMonsterPool = dmAllMonsters.map(dmNormaliseMonster).filter(Boolean);
    return dmMonsterPool;
  }
  let results = [];
  let url = 'https://api.open5e.com/v1/monsters/?limit=100&document__slug=wotc-srd';
  while (url) {
    const res = await fetch(url);
    const data = await res.json();
    results = results.concat(data.results || []);
    url = data.next || null;
  }
  dmAllMonsters = results; // share with Monsters tab
  dmMonsterPool = results.map(dmNormaliseMonster).filter(Boolean);
  return dmMonsterPool;
}

function dmNormaliseMonster(m) {
  if (!m || !m.name) return null;
  const xp = parseInt(String(dmCrToXp(m.challenge_rating)).replace(/[^0-9]/g, ''), 10) || 0;
  if (!xp) return null; // skip CR-0/unscored, they break budgeting
  return {
    name: m.name, type: (m.type || '').toLowerCase(), cr: m.challenge_rating,
    xp, hp: m.hit_points ?? 10, ac: m.armor_class ?? 10,
    dex: (typeof m.dexterity === 'number') ? m.dexterity : null,
    slug: m.slug || null, raw: m   // raw = full Open5e record for the click-to-expand card
  };
}

function dmMonstersForTheme(themeKey) {
  const theme = DM_ENCOUNTER_THEMES[themeKey] || DM_ENCOUNTER_THEMES.random;
  // Special: "Any Non-Humanoid" = everything whose type isn't humanoid.
  if (themeKey === 'nonHumanoid') {
    return dmMonsterPool.filter(m => m.type && m.type !== 'humanoid');
  }
  if (!theme.types.length && !theme.keywords.length) return dmMonsterPool.slice();
  return dmMonsterPool.filter(m => {
    const byType = theme.types.includes(m.type);
    const byName = theme.keywords.some(k => m.name.toLowerCase().includes(k));
    return byType || byName;
  });
}

// Encounter shapes decide HOW the budget splits across creatures.
//   target = desired number of creatures (0 = generator's choice / budget-led)
//   strong = fraction of the RAW budget the biggest creature(s) should eat
const DM_ENCOUNTER_SHAPES = {
  balanced:    { label: 'Balanced mix', desc: 'a varied spread of foes' },
  swarm:       { label: 'Swarm (many weak)', desc: 'a horde of weaker creatures' },
  elite:       { label: 'Elite (few strong)', desc: 'a handful of dangerous foes' },
  bossMinions: { label: 'Boss + Minions', desc: 'one leader and its lackeys' },
  solo:        { label: 'Solo (one big)', desc: 'a single mighty creature' },
  ambush:      { label: 'Ambush (surprise)', desc: 'attackers who strike from hiding' },
  gauntlet:    { label: 'Gauntlet (waves)', desc: 'foes arriving in successive waves' },
  vanguard:    { label: 'Vanguard + Archers', desc: 'a front line shielding ranged attackers' },
  twinThreat:  { label: 'Twin Threat (duo)', desc: 'two dangerous leaders fighting as a pair' },
  duel:        { label: 'Rival Duel', desc: 'a single rival matched to a champion PC' },
  siege:       { label: 'Siege / Horde', desc: 'a relentless horde pressing a position' },
  // ── New shapes ──
  gang:        { label: 'Gang / Rabble (many weak)', desc: 'a large crowd of weak, varied foes' },
  bodyguards:  { label: 'Protect the VIP', desc: 'a fragile high-value target ringed by tough guards' },
  artillery:   { label: 'Artillery Battery', desc: 'ranged attackers behind a thin screen' },
  pincer:      { label: 'Pincer (two fronts)', desc: 'two groups striking from opposite sides' },
  escalating:  { label: 'Escalating Waves', desc: 'waves that grow stronger, the leader arriving last' },
  skirmishers: { label: 'Skirmishers (fast & fragile)', desc: 'quick, lightly-armoured hit-and-run foes' },
  loneHunter:  { label: 'Lone Hunter + Lures', desc: 'one predator using weak creatures as bait' },
  standoff:    { label: 'Standoff (tense trigger)', desc: 'both sides already in position — the first move sets it off' }
};

// Fill a sub-budget with monsters, biased 'strong' | 'weak' | 'mixed'. Used by
// the multi-part shapes (vanguard front/back, gauntlet waves). Always reaches
// the sub-budget as closely as the pool allows.
function dmFillToBudget(sorted, budget, bias) {
  if (!sorted.length || budget <= 0) return [];
  const lo = sorted[0].xp;
  const band = () => {
    let fit = sorted.filter(m => m.xp <= budget * 1.2);
    if (!fit.length) fit = [sorted[0]];
    if (bias === 'strong') return fit.slice(Math.floor(fit.length / 2));
    if (bias === 'weak') return fit.slice(0, Math.max(1, Math.ceil(fit.length / 2)));
    return fit;
  };
  const picks = [];
  let guard = 0;
  while (guard++ < 60 && picks.reduce((s, p) => s + p.xp, 0) < budget) {
    const remaining = budget - picks.reduce((s, p) => s + p.xp, 0);
    if (remaining <= lo * 0.5 && picks.length) break;
    picks.push(dmPick(band()));
  }
  return picks.length ? picks : [sorted[0]];
}

// Generic shaped builder. `shape` tunes creature size/count; `countTarget` (if >0)
// pushes toward that many creatures.
function dmBuildShapedEncounter(pool, targetAdjXp, partySize, shape, countTarget) {
  if (!pool.length || targetAdjXp <= 0) return [];
  const sorted = pool.slice().sort((a, b) => a.xp - b.xp);
  const lo = sorted[0].xp;

  const nearest = (val, list) => list.reduce((a, b) => Math.abs(b.xp - val) < Math.abs(a.xp - val) ? b : a, list[0]);

  // Solo / Duel: one creature as close to the budget as possible.
  if (shape === 'solo' || shape === 'duel') {
    return [nearest(targetAdjXp, sorted)];
  }
  // Boss + minions handled by its own helper.
  if (shape === 'bossMinions') return dmBuildBossEncounter(pool, targetAdjXp, partySize);

  // Twin Threat: two roughly-equal strong leaders splitting the budget, nothing
  // else. Each takes ~half the budget; picks the two nearest (allowing a repeat).
  if (shape === 'twinThreat') {
    const half = targetAdjXp / 2;
    const a = nearest(half, sorted);
    // Second one fills whatever remains so the pair lands on-budget.
    const b = nearest(targetAdjXp - a.xp, sorted);
    return [a, b];
  }

  // Vanguard + Archers: a front line (~55% budget on stronger, tanky-leaning
  // monsters) plus a backline of weaker ranged-flavoured attackers (~45%). Tags
  // help the card describe positioning; the XP still sums to target below.
  if (shape === 'vanguard') {
    const front = dmFillToBudget(sorted, Math.round(targetAdjXp * 0.55), 'strong');
    const back  = dmFillToBudget(sorted, targetAdjXp - front.reduce((s, p) => s + p.xp, 0), 'weak');
    return front.map(p => ({ ...p, role: 'front' })).concat(back.map(p => ({ ...p, role: 'back' })));
  }

  // Gauntlet: split into 2-3 waves, each a fraction of the budget. Flatten to a
  // single pick list (with wave tags) — total still equals the budget.
  if (shape === 'gauntlet') {
    const waveCount = targetAdjXp > 4000 ? 3 : 2;
    const per = targetAdjXp / waveCount;
    let out = [];
    for (let w = 0; w < waveCount; w++) {
      const wave = dmFillToBudget(sorted, Math.round(per), 'mixed');
      out = out.concat(wave.map(p => ({ ...p, wave: w + 1 })));
    }
    return out;
  }

  // Gang / Rabble: a LOT of weak, varied bodies. Force a high count (~party×3)
  // of the cheapest half of the pool, so a bandit hideout reads as bandits &
  // thugs, not two veterans. Floor-guarantee below tops it up if under budget.
  if (shape === 'gang') {
    const cheap = sorted.slice(0, Math.max(1, Math.ceil(sorted.length * 0.55)));
    const want = Math.max(6, Math.round(partySize * 3));
    const per = targetAdjXp / want;
    const out = [];
    for (let i = 0; i < want; i++) {
      let cand = cheap.filter(m => m.xp <= per * 1.6);
      if (!cand.length) cand = [cheap[0]];
      out.push(dmPick(cand)); // random within the cheap band → variety
    }
    return out;
  }

  // Protect the VIP: one fragile-but-valuable target (lower XP, tagged 'vip')
  // plus a ring of tougher guards taking the bulk of the budget.
  if (shape === 'bodyguards') {
    const vipBudget = Math.round(targetAdjXp * 0.28);
    const vip = nearest(vipBudget, sorted);
    const guards = dmFillToBudget(sorted, targetAdjXp - vip.xp, 'strong');
    return [{ ...vip, role: 'vip' }].concat(guards.map(p => ({ ...p, role: 'guard' })));
  }

  // Artillery Battery: mostly ranged/caster back-liners (~70% budget on the
  // stronger half) with a thin screen up front (~30% weak). Inverse of vanguard.
  if (shape === 'artillery') {
    const back  = dmFillToBudget(sorted, Math.round(targetAdjXp * 0.70), 'strong');
    const front = dmFillToBudget(sorted, targetAdjXp - back.reduce((s, p) => s + p.xp, 0), 'weak');
    return back.map(p => ({ ...p, role: 'artillery' })).concat(front.map(p => ({ ...p, role: 'screen' })));
  }

  // Pincer: two roughly-equal groups, tagged flank A / flank B, meant to be
  // placed on opposite sides of the party.
  if (shape === 'pincer') {
    const a = dmFillToBudget(sorted, Math.round(targetAdjXp * 0.5), 'mixed');
    const b = dmFillToBudget(sorted, targetAdjXp - a.reduce((s, p) => s + p.xp, 0), 'mixed');
    return a.map(p => ({ ...p, flank: 'A' })).concat(b.map(p => ({ ...p, flank: 'B' })));
  }

  // Escalating Waves: like gauntlet but each wave is STRONGER than the last, the
  // final wave carrying the leader. Budget split rising 20% / 35% / 45%.
  if (shape === 'escalating') {
    const three = targetAdjXp > 3000;
    const splits = three ? [0.20, 0.35, 0.45] : [0.35, 0.65];
    const biases = three ? ['weak', 'mixed', 'strong'] : ['weak', 'strong'];
    let out = [], spent = 0;
    splits.forEach((frac, i) => {
      const budget = (i === splits.length - 1) ? (targetAdjXp - spent) : Math.round(targetAdjXp * frac);
      const wave = dmFillToBudget(sorted, budget, biases[i]);
      spent += wave.reduce((s, p) => s + p.xp, 0);
      out = out.concat(wave.map(p => ({ ...p, wave: i + 1 })));
    });
    return out;
  }

  // Skirmishers: many fast, fragile foes. Filter the pool toward low-HP/high-Dex
  // creatures, then fill with a weak bias and a higher-than-normal count.
  if (shape === 'skirmishers') {
    const nimble = sorted.filter(m => (m.hp || 999) <= 40 && (m.dex == null || m.dex >= 12));
    const usePool = nimble.length >= 3 ? nimble.slice().sort((a, b) => a.xp - b.xp) : sorted;
    const want = Math.max(4, Math.round(partySize * 1.5));
    const per = targetAdjXp / want;
    const out = [];
    for (let i = 0; i < want; i++) {
      let cand = usePool.filter(m => m.xp <= per * 1.5);
      if (!cand.length) cand = [usePool[0]];
      out.push(dmPick(cand));
    }
    return out.map(p => ({ ...p, role: 'skirmisher' }));
  }

  // Lone Hunter + Lures: one strong predator (tagged 'hunter') plus 1-2 weak
  // creatures used as bait (tagged 'lure'). Like a boss but the lures are cheap.
  if (shape === 'loneHunter') {
    const hunter = nearest(Math.round(targetAdjXp * 0.78), sorted);
    const lures = dmFillToBudget(sorted, Math.max(lo, targetAdjXp - hunter.xp), 'weak').slice(0, 2);
    return [{ ...hunter, role: 'hunter' }].concat(lures.map(p => ({ ...p, role: 'lure' })));
  }

  // Standoff: composition is a balanced mix; the flavor (already in position,
  // first move triggers it) lives in the intro/tips. Fall through to balanced.
  // (no early return — handled by the budget-led path below with balanced counts)

  // EXACT COUNT requested: always produce N creatures, but they MUST sum to the
  // tier target. We seed N around the per-creature share, then upgrade/downgrade
  // individual creatures until the total lands in the band — count stays fixed.
  if (countTarget > 0) {
    const n = Math.min(30, countTarget);
    const perCreature = targetAdjXp / n; // raw budget == target (no multiplier)
    const sumXp = (ps) => ps.reduce((s, p) => s + p.xp, 0);
    const nearestTo = (val, list) => list.reduce((a, b) => Math.abs(b.xp - val) < Math.abs(a.xp - val) ? b : a, list[0]);

    // Seed: each creature near the per-creature share (with a little variety).
    const picks = [];
    for (let i = 0; i < n; i++) {
      let candidates = sorted.filter(m => m.xp <= perCreature * 1.6);
      if (!candidates.length) candidates = [sorted[0]];
      if (shape === 'elite') candidates = candidates.slice(Math.floor(candidates.length / 2));
      else if (shape === 'swarm') candidates = candidates.slice(0, Math.max(1, Math.ceil(candidates.length / 2)));
      const best = nearestTo(perCreature, candidates);
      picks.push(Math.random() < 0.5 ? best : dmPick(candidates));
    }

    // Correct UP to the target: while under the floor, take the weakest pick and
    // bump it to the strongest monster that still keeps us at/under the target
    // (or the next step up if none fits). This closes big gaps fast and lands
    // near the floor. The generator then clamps the ceiling. Count never changes.
    const maxXp = sorted[sorted.length - 1].xp;
    let guard = 0;
    while (guard++ < 800 && sumXp(picks) < targetAdjXp) {
      // weakest pick with room to grow
      let wi = -1, wxp = Infinity;
      picks.forEach((p, i) => { if (p.xp < maxXp && p.xp < wxp) { wxp = p.xp; wi = i; } });
      if (wi < 0) break; // everything already at the pool's strongest
      const gap = targetAdjXp - sumXp(picks);
      const room = picks[wi].xp + gap; // most this pick could become without overshooting
      const stronger = sorted.filter(m => m.xp > picks[wi].xp);
      if (!stronger.length) break;
      const fit = stronger.filter(m => m.xp <= room);
      picks[wi] = fit.length ? fit[fit.length - 1] : stronger[0];
    }
    return picks;
  }

  // BUDGET-LED (no forced count): aim for a SENSIBLE number of creatures instead
  // of greedily stacking whatever fits — otherwise a good pool gets filled with a
  // pile of weak monsters up to the cap. We pick a target count from the shape
  // (roughly party-sized), size each creature to budget/count, then let the
  // floor-guarantee below fine-tune. Rating is RAW summed XP (no multiplier), so
  // target IS the raw budget.
  const sumXp = (ps) => ps.reduce((s, p) => s + p.xp, 0);
  const nearestTo = (val, list) => list.reduce((a, b) => Math.abs(b.xp - val) < Math.abs(a.xp - val) ? b : a, list[0]);

  // Desired creature count by shape (a natural spread, not a hard cap).
  let wantCount;
  if (shape === 'swarm' || shape === 'siege') wantCount = Math.max(6, Math.round(partySize * 2));
  else if (shape === 'elite' || shape === 'ambush') wantCount = Math.max(2, Math.round(partySize * 0.6));
  else wantCount = Math.max(2, partySize); // balanced ≈ one foe per PC
  // Don't ask for more creatures than the budget can afford at the cheapest tier,
  // nor fewer than the strongest monster allows.
  wantCount = Math.max(1, Math.min(wantCount, Math.max(1, Math.round(targetAdjXp / Math.max(lo, 1)))));

  const perCreature = targetAdjXp / wantCount;
  const picks = [];
  for (let i = 0; i < wantCount; i++) {
    // candidates near the per-creature share, biased by shape
    let cand = sorted.filter(m => m.xp <= perCreature * 1.5);
    if (!cand.length) cand = [sorted[0]];
    if (shape === 'elite' || shape === 'ambush') cand = cand.slice(Math.floor(cand.length / 2));
    else if (shape === 'swarm' || shape === 'siege') cand = cand.slice(0, Math.max(1, Math.ceil(cand.length / 2)));
    const best = nearestTo(perCreature, cand);
    picks.push(Math.random() < 0.45 ? dmPick(cand) : best);
  }

  // GUARANTEE THE FLOOR: if the fill loop stopped short of the target (the pool
  // is too weak to reach it with this many creatures, or the count cap bit),
  // upgrade the weakest picks to stronger monsters until we reach the target —
  // exactly like the forced-count path. This is what makes "pick Deadly" build
  // a Deadly-worth pool even from a low-CR theme. Bounded by pool strength.
  const maxXp = sorted[sorted.length - 1].xp;
  guard = 0;
  while (guard++ < 800 && sumXp(picks) < targetAdjXp) {
    // weakest pick that can still grow
    let wi = -1, wxp = Infinity;
    picks.forEach((p, i) => { if (p.xp < maxXp && p.xp < wxp) { wxp = p.xp; wi = i; } });
    if (wi < 0) {
      // Every pick is already the strongest monster available. If we're STILL
      // under target, add another strongest monster (count grows past the cap —
      // hitting the tier matters more than the cap).
      if (picks.length && picks[0].xp >= maxXp && sumXp(picks) < targetAdjXp) {
        picks.push(sorted[sorted.length - 1]);
        continue;
      }
      break;
    }
    const gap = targetAdjXp - sumXp(picks);
    const room = picks[wi].xp + gap; // most this pick can become without overshooting
    const stronger = sorted.filter(m => m.xp > picks[wi].xp);
    const fit = stronger.filter(m => m.xp <= room);
    picks[wi] = fit.length ? fit[fit.length - 1] : stronger[0];
  }
  return picks;
}

// Boss + minions: one high-CR monster, then several low-CR of the same theme.
function dmBuildBossEncounter(pool, targetAdjXp, partySize) {
  if (!pool.length) return [];
  const sorted = pool.slice().sort((a, b) => b.xp - a.xp);
  const rawBudget = targetAdjXp; // raw target (no count-multiplier)
  const bossTarget = rawBudget * 0.55;
  const boss = sorted.find(m => m.xp <= bossTarget * 1.3) || sorted[sorted.length - 1];
  const picks = [boss];
  const minionPool = pool.filter(m => m.xp <= boss.xp / 4 && m.xp > 0);
  const fillPool = minionPool.length ? minionPool : pool.filter(m => m.xp < boss.xp);
  let guard = 0;
  while (guard++ < 30 && fillPool.length) {
    const rawUsed = picks.reduce((s, p) => s + p.xp, 0);
    if (rawUsed >= targetAdjXp * 0.95) break;
    picks.push(dmPick(fillPool));
    if (picks.length >= 14) break;
  }
  return picks;
}

async function dmGenerateEncounter() {
  const status = document.getElementById('dmGenStatus');
  const setStatus = (msg, type) => { if (status) { status.textContent = msg; status.className = `dm-note ${type || ''}`; } };

  const themeKey = document.getElementById('dmGenTheme')?.value || 'random';
  const difficulty = document.getElementById('dmGenDifficulty')?.value || 'medium';
  const shape = document.getElementById('dmGenShape')?.value || 'balanced';
  const countTarget = parseInt(document.getElementById('dmGenCount')?.value, 10) || 0;
  const autoScale = document.getElementById('dmGenAutoScale')?.checked;
  const replace = document.getElementById('dmGenReplace')?.checked;

  if (!dmPartySize()) { setStatus('Set your party first.', 'error'); return; }

  setStatus('Loading monsters from Open5e…');
  let pool;
  try {
    await dmEnsureMonsterPool();
    pool = dmMonstersForTheme(themeKey);
  } catch (e) {
    setStatus('Could not load monsters. Check your connection.', 'error');
    return;
  }
  if (!pool.length) { setStatus('No monsters match that theme. Try Random.', 'error'); return; }

  const th = dmPartyThresholds();
  const partySize = dmPartySize();

  // The chosen tier defines a band: [floor, ceiling). We AIM for the middle of
  // the band so the builder's natural over/undershoot stays inside it — then we
  // hard-clamp below to guarantee the result rates as the tier you picked.
  const floor = dmTierTargetXp(difficulty, th);
  const ceiling = dmTierCeilingXp(difficulty, th);
  let targetAdjXp = isFinite(ceiling) ? Math.round((floor + ceiling) / 2) : Math.round(floor * 1.25);
  // Auto-scale: nudge the budget up for bigger parties (beyond the threshold math).
  if (autoScale && partySize > 4) targetAdjXp = Math.round(targetAdjXp * (1 + (partySize - 4) * 0.12));
  // Never aim past the band ceiling — keep a small margin under it.
  if (isFinite(ceiling)) targetAdjXp = Math.min(targetAdjXp, Math.round(ceiling * 0.95));

  // Shape comes from the picker, but Boss/Solo themes imply their shape.
  const effShape = (themeKey === 'bossMinions') ? 'bossMinions' : shape;
  let picks = dmBuildShapedEncounter(pool, targetAdjXp, partySize, effShape, countTarget);

  if (!picks.length) { setStatus('Could not fit that budget — try another theme, shape, or difficulty.', 'error'); return; }

  const sumOf = (ps) => ps.reduce((s, p) => s + p.xp, 0);
  const poolSorted = pool.slice().sort((a, b) => a.xp - b.xp);
  const poolMax = poolSorted[poolSorted.length - 1].xp;

  // FLOOR GUARANTEE (all shapes): if the build came in under the tier floor,
  // upgrade the weakest picks to stronger monsters until it reaches the band.
  // This covers the tactical shapes (twin/vanguard/gauntlet) that build in parts.
  {
    let guard = 0;
    while (guard++ < 800 && sumOf(picks) < floor) {
      let wi = -1, wxp = Infinity;
      picks.forEach((p, i) => { if (p.xp < poolMax && p.xp < wxp) { wxp = p.xp; wi = i; } });
      if (wi < 0) {
        if (picks.length && sumOf(picks) < floor) { picks.push(poolSorted[poolSorted.length - 1]); continue; }
        break;
      }
      const gap = floor - sumOf(picks);
      const room = picks[wi].xp + gap;
      const stronger = poolSorted.filter(m => m.xp > picks[wi].xp);
      const fit = stronger.filter(m => m.xp <= room);
      picks[wi] = fit.length ? fit[fit.length - 1] : stronger[0];
    }
  }

  // Hard-clamp into the band so the result rates EXACTLY the tier picked —
  // never higher, never lower.
  if (isFinite(ceiling) && picks.length) {
    const minXp = poolSorted[0].xp;
    let guard = 0;
    if (countTarget > 0) {
      // Forced count: keep N creatures — DOWNGRADE the strongest to a weaker
      // monster until the total drops below the ceiling.
      while (guard++ < 400 && sumOf(picks) >= ceiling) {
        let si = -1, sxp = -Infinity;
        picks.forEach((p, i) => { if (p.xp > minXp && p.xp > sxp) { sxp = p.xp; si = i; } });
        if (si < 0) break; // all already at pool minimum — can't go lower
        const weaker = poolSorted.filter(m => m.xp < picks[si].xp);
        if (!weaker.length) break;
        picks[si] = weaker[weaker.length - 1];
      }
    } else {
      // Free count: drop the smallest monster until back under the ceiling.
      while (picks.length > 1 && sumOf(picks) >= ceiling && guard++ < 60) {
        const minIdx = picks.reduce((mi, p, i, a) => p.xp < a[mi].xp ? i : mi, 0);
        picks.splice(minIdx, 1);
      }
    }
  }

  if (replace) dmCombatants = [];
  const totals = {};
  picks.forEach(p => { totals[p.name] = (totals[p.name] || 0) + 1; });
  const seen = {};
  const added = [];
  picks.forEach((p, i) => {
    seen[p.name] = (seen[p.name] || 0) + 1;
    let label = totals[p.name] > 1 ? `${p.name} ${seen[p.name]}` : p.name;
    // Tag wave / role / flank foes so the DM can run the tactical shapes at a glance.
    const ROLE_TAGS = {
      front: 'Front', back: 'Back', vip: 'VIP', guard: 'Guard',
      artillery: 'Artillery', screen: 'Screen', hunter: 'Hunter',
      lure: 'Lure', skirmisher: 'Skirmisher'
    };
    if (p.wave) label += ` [Wave ${p.wave}]`;
    else if (p.flank) label += ` [Flank ${p.flank}]`;
    else if (p.role && ROLE_TAGS[p.role]) label += ` [${ROLE_TAGS[p.role]}]`;
    const c = {
      id: Date.now() + i, name: label, maxHp: p.hp, hp: p.hp, ac: p.ac,
      initiative: rnd(1, 20) + dmModNum(p.dex), cr: p.cr, xp: p.xp, isMonster: true,
      slug: p.slug || null, dex: (typeof p.dex === 'number') ? p.dex : null,
      statBlock: p.raw || null, wave: p.wave || null, role: p.role || null, flank: p.flank || null
    };
    dmCombatants.push(c);
    added.push(c);
  });

  dmRenderCombatants();
  dmUpdateDifficultyMeter();
  const r = dmRateEncounter(dmCombatants.filter(c => c.isMonster && c.xp > 0).map(c => c.xp));

  // Build + show the encounter card.
  dmBuildEncounterCard({ theme: themeKey, shape: effShape, difficulty, rating: r });

  // If the result didn't reach the tier you picked, the pool is too weak at this
  // count. Offer to upscale (buff ≤3× + add bodies to a sane cap). If even that
  // can't reach it, present a helper menu of things that WOULD work.
  const gotTier = DM_DIFFICULTY_TIERS.indexOf(r.cls);
  const wantTier = DM_DIFFICULTY_TIERS.indexOf(difficulty);
  if (gotTier < wantTier) {
    // Under the chosen difficulty → run the escalation path (elites → ask troops
    // → change-theme? → final menu). Handles its own popups + status.
    await dmResolveUnderTarget({ themeKey, effShape, difficulty, picks, poolMax, partySize, setStatus });
  } else {
    setStatus(`Generated ${picks.length} creature${picks.length === 1 ? '' : 's'} — rated ${r.label} (${r.adjusted.toLocaleString()} XP).`, 'success');
  }
  switchDmTabById('dm-encounters');
  // Drop the DM into Build mode so the generated creatures show as the
  // draggable, click-to-expand combatant cards (the list lives in the build view).
  dmSetMode('encounter', 'build');
}

window.dmGenerateEncounter = dmGenerateEncounter;

// Human-readable theme label for messages.
function themeLabel(themeKey) {
  const t = DM_ENCOUNTER_THEMES[themeKey];
  return t ? t.label : 'chosen';
}

// Shared tuning for the "make it reach the difficulty" system.
const DM_ELITE_MAX_FACTOR = 3;   // an elite can be buffed at most ×3
const DM_ELITE_ROSTER_FRAC = 1/3; // at most 1/3 of the roster may be elites
const DM_MAX_CREATURES = 20;      // never pile bodies past this total

const dmSumMonsterXp = () => dmCombatants.filter(c => c.isMonster && c.xp > 0).reduce((s, c) => s + c.xp, 0);
const dmMonsterCount = () => dmCombatants.filter(c => c.isMonster && c.xp > 0).length;
const dmNameStem = (nm) => nm.replace(/\s*\[Elite ★⇧\]\s*$/,'').replace(/\s*\d+\s*⇧?\s*$/,'').replace(/\s*⇧\s*$/,'').trim();

// Buff one combatant ×f (HP/AC/damage + tags). elite → "[Elite ★⇧]", else "⇧".
function dmApplyBuff(c, f, elite) {
  if (c._baseXp == null) c._baseXp = c.xp; // remember pre-buff XP for clean revert
  c.xp = Math.round(c.xp * f);
  c._origHp = c.maxHp; c._origAc = c.ac;
  c.maxHp = Math.max(1, Math.round((c.maxHp || 1) * f));
  c.hp = c.maxHp;
  c.ac = (c.ac || 10) + Math.min(4, Math.floor((f - 1) / 0.5));
  c._upscaled = f;
  c._dmgMult = f;
  c._elite = !!elite;
  if (elite) { if (!/Elite ★⇧/.test(c.name)) c.name += ' [Elite ★⇧]'; }
  else if (!/⇧/.test(c.name)) c.name += ' ⇧';
}

// STEP 1 — ELITES FIRST. Promote creatures to elites (each ×≤3) to close the gap,
// but never let elites exceed 1/3 of the roster. Returns { reached, eliteCount,
// eliteCap (true if the 1/3 cap stopped us), finalXp, targetXp }.
function dmUpscaleEncounterToTier(tier) {
  const targetXp = dmTierTargetXp(tier);
  let currentXp = dmSumMonsterXp();
  const total = dmMonsterCount();
  if (!total || targetXp <= currentXp) {
    return { reached: currentXp >= targetXp, eliteCount: 0, eliteCap: false, finalXp: currentXp, targetXp, count: total };
  }

  const maxElites = Math.max(1, Math.floor(total * DM_ELITE_ROSTER_FRAC));
  const gap = targetXp - currentXp;

  // Pick the biggest un-buffed creatures as elite candidates (elites = the meanest).
  const cands = dmCombatants
    .filter(c => c.isMonster && c.xp > 0 && !c._upscaled)
    .sort((a, b) => b.xp - a.xp);
  if (!cands.length) {
    return { reached: false, eliteCount: 0, eliteCap: true, finalXp: currentXp, targetXp, count: total };
  }

  // Work out how MANY elites we need, adding one at a time, but buff them EVENLY:
  // find the smallest k (≤maxElites) whose top-k creatures, all buffed to the same
  // factor f (≤3×), close the gap. This gives a believable spread of leaders
  // instead of one lopsided super-elite.
  let chosen = [], eliteFactor = 1, eliteCap = false;
  for (let k = 1; k <= maxElites; k++) {
    const top = cands.slice(0, k);
    const topXp = top.reduce((s, c) => s + c.xp, 0);
    const fNeeded = (topXp + gap) / Math.max(1, topXp); // even factor across these k
    if (fNeeded <= DM_ELITE_MAX_FACTOR) { chosen = top; eliteFactor = fNeeded; break; }
    // Not enough with k; if this is the last allowed k, use it at the ×3 cap.
    if (k === maxElites || k === cands.length) { chosen = top; eliteFactor = DM_ELITE_MAX_FACTOR; eliteCap = true; }
  }

  chosen.forEach(c => dmApplyBuff(c, eliteFactor, true));
  currentXp = dmSumMonsterXp();

  dmRenderCombatants();
  dmUpdateDifficultyMeter();
  return {
    reached: currentXp >= targetXp * 0.98,
    eliteCount: chosen.length, eliteFactor, eliteCap, finalXp: currentXp, targetXp, count: dmMonsterCount()
  };
}

// STEP 2 — ADD TROOPS. Clone the cheapest existing foes (more bodies) up to the
// creature cap. Returns { reached, added, finalXp, targetXp, count }.
function dmAddTroopsToTier(tier) {
  const targetXp = dmTierTargetXp(tier);
  let currentXp = dmSumMonsterXp();
  let added = 0, guard = 0;
  while (currentXp < targetXp && guard++ < 60) {
    if (dmMonsterCount() >= DM_MAX_CREATURES) break;
    const base = dmCombatants.filter(c => c.isMonster && c.xp > 0).sort((a, b) => a.xp - b.xp)[0];
    if (!base) break;
    const stem = dmNameStem(base.name);
    const n = dmCombatants.filter(c => c.isMonster && dmNameStem(c.name) === stem).length + 1;
    const clone = { ...base, id: Date.now() + guard, hp: base.maxHp,
      initiative: rnd(1, 20) + dmModNum(base.dex),
      name: `${stem} ${n}${base._upscaled ? (base._elite ? ' [Elite ★⇧]' : ' ⇧') : ''}` };
    dmCombatants.push(clone);
    currentXp += clone.xp; added++;
  }
  dmRenderCombatants();
  dmUpdateDifficultyMeter();
  return { reached: currentXp >= targetXp * 0.98, added, finalXp: currentXp, targetXp, count: dmMonsterCount() };
}

// STEP (offer) — BORROW A TOUGHER CREATURE. Pull the single strongest creature
// that fits the remaining gap from a thematically-related tougher pool, add it as
// a distinct "borrowed" anchor. Async (may fetch the theme pool). Returns the
// borrowed creature's name, or null if none suitable / offline.
async function dmBorrowToughCreature(themeKey, tier) {
  const targetXp = dmTierTargetXp(tier);
  const gap = Math.max(0, targetXp - dmSumMonsterXp());
  if (gap <= 0) return null;

  // Where each theme borrows its muscle from (fallback: giants, then dragons).
  const borrowFrom = {
    bandits:'fighters', banditGang:'fighters', humansCommon:'fighters', mercenaries:'giants',
    cultists:'fiends', assassinsSpies:'fighters', nobleCourt:'giants', pirates:'giants',
    tribalWarband:'giants', goblinoids:'giants', beasts:'monstrosities', huntPack:'monstrosities',
    beastHandlers:'monstrosities', undead:'fiends', undeadHorde:'fiends', constructs:'giants',
    fey:'fiends', plants:'monstrosities', oozesVermin:'aberrations', swarms:'monstrosities',
    fighters:'giants', casters:'fiends', casterWarband:'fiends'
  };
  const sourceKey = borrowFrom[themeKey] || 'giants';

  let pool;
  try { await dmEnsureMonsterPool(); pool = dmMonstersForTheme(sourceKey); }
  catch (e) { return null; }
  if (!pool || !pool.length) return null;

  // Strongest creature that isn't wildly over the gap (allow up to 1.5× gap so a
  // single anchor can carry most of it); else the biggest available.
  const sorted = pool.slice().sort((a, b) => a.xp - b.xp);
  const fit = sorted.filter(m => m.xp <= gap * 1.5);
  const chosen = (fit.length ? fit[fit.length - 1] : sorted[sorted.length - 1]);
  if (!chosen) return null;

  dmCombatants.push({
    id: Date.now(), name: `${chosen.name} [Borrowed ⚔]`, maxHp: chosen.hp, hp: chosen.hp,
    ac: chosen.ac, initiative: rnd(1, 20) + dmModNum(chosen.dex), cr: chosen.cr, xp: chosen.xp,
    isMonster: true, slug: chosen.slug || null, dex: (typeof chosen.dex === 'number') ? chosen.dex : null,
    statBlock: chosen.raw || null, _borrowed: true, _borrowedFrom: DM_ENCOUNTER_THEMES[sourceKey]?.label || sourceKey
  });
  dmRenderCombatants();
  dmUpdateDifficultyMeter();
  return chosen.name;
}

// Themes with genuinely high-CR pools, used to suggest a stronger alternative.
const DM_STRONG_THEMES = ['giants','dragons','fiends','devils','demons','aberrations','undead','celestials','elementals'];

// Re-rate the live combatants and refresh the encounter card. Returns the rating.
function dmReRateAndCard(themeKey, effShape, difficulty) {
  const rating = dmRateEncounter(dmCombatants.filter(c => c.isMonster && c.xp > 0).map(c => c.xp));
  dmBuildEncounterCard({ theme: themeKey, shape: effShape, difficulty, rating });
  return rating;
}

// FLAT "one smart menu" path (v2). Philosophy: do the free win automatically
// (elites-first, evenly spread), then — only if still short — show ONE menu with
// every remaining lever and what each achieves. The menu RE-OPENS after each
// action so the DM can stack fixes (borrow, then troops…) until happy. No chain
// of yes/no gates; the quick generator stays quick.
async function dmResolveUnderTarget(ctx) {
  const { themeKey, effShape, difficulty, poolMax, partySize, setStatus } = ctx;
  const label = DM_DIFFICULTY_LABELS[difficulty];
  const reRate = () => dmReRateAndCard(themeKey, effShape, difficulty);

  // ── Automatic: elites first (evenly spread, ≤3×, ≤1/3 of roster). ──
  const el = dmUpscaleEncounterToTier(difficulty);
  let r = reRate();
  if (el.reached) {
    setStatus(`Promoted ${el.eliteCount} to elite${el.eliteCount === 1 ? '' : 's'} (★, ×${el.eliteFactor.toFixed(1)}) — now ${r.label} (${r.adjusted.toLocaleString()} XP) at ${el.count} creatures.`, 'success');
    return;
  }

  // ── Still short → ONE menu, re-opened until the DM is satisfied. ──
  while (true) {
    const targetXp = dmTierTargetXp(difficulty);
    const shortBy = Math.max(0, targetXp - r.adjusted);
    const atCap = dmMonsterCount() >= DM_MAX_CREATURES;

    const choices = [];
    choices.push({ label: `Keep it as ${r.label}`, hint: `${r.adjusted.toLocaleString()} XP — accept this as the fight`, value: 'accept', primary: true });
    choices.push({ label: 'Borrow a tougher creature', hint: `add one strong anchor from a related theme (best single jump toward ${label})`, value: 'borrow' });
    if (!atCap) choices.push({ label: 'Add more troops', hint: `clone the weakest foes toward ${label} (up to ${DM_MAX_CREATURES})`, value: 'troops' });
    choices.push({ label: 'Change theme / battle type', hint: `pick a tougher pool and regenerate ${label} from scratch`, value: 'change' });
    choices.push({ label: 'Build my own instead →', hint: 'open the builder with these foes as a starting point', value: 'build' });

    const pick = await dmChoiceModal({
      title: `${label} needs more — ${themeLabel(themeKey)} reaches ${r.label}`,
      message: `Even with ${el.eliteCount} elite${el.eliteCount === 1 ? '' : 's'} (★), this group is ${shortBy.toLocaleString()} XP short of ${label} (${r.adjusted.toLocaleString()} / ${targetXp.toLocaleString()}). Stack any of these until it's where you want it:`,
      cancelText: 'Close'
    }, choices);

    if (pick === 'borrow') {
      const before = r.adjusted;
      const name = await dmBorrowToughCreature(themeKey, difficulty);
      r = reRate();
      if (!name) { setStatus(`Couldn't borrow a creature (offline?). Still ${r.label}.`, 'error'); }
      else {
        const over = r.adjusted > dmTierCeilingXp(difficulty) ? ` (nudged past ${label} into ${r.label})` : '';
        setStatus(`Added ${name} (borrowed ⚔) — now ${r.label} (${r.adjusted.toLocaleString()} XP)${over}.`, 'success');
      }
      if (r.adjusted >= dmTierTargetXp(difficulty)) return; // reached — done
      continue; // re-open menu to stack more
    }
    if (pick === 'troops') {
      const tr = dmAddTroopsToTier(difficulty);
      r = reRate();
      setStatus(`Added ${tr.added} more — now ${r.label} (${r.adjusted.toLocaleString()} XP) at ${tr.count} creatures.`, tr.reached ? 'success' : 'info');
      if (tr.reached) return;
      continue;
    }
    if (pick === 'change') {
      const themeSel = document.getElementById('dmGenTheme');
      if (themeSel && !DM_STRONG_THEMES.includes(themeKey)) themeSel.value = DM_STRONG_THEMES[0];
      dmSetMode('encounter', 'generate');
      setStatus(`Pick a theme/battle type and press Generate to try ${label} again.`, 'info');
      return;
    }
    if (pick === 'build') {
      dmSetMode('encounter', 'build');
      setStatus('Opened the builder — tweak or add to these foes to design your own.', 'info');
      return;
    }
    // accept / close
    setStatus(`Kept as ${r.label} (${r.adjusted.toLocaleString()} XP) — the best this group can do at a sensible size.`, 'info');
    return;
  }
}

// ─── Encounter card (intro / tips / initiative / notes) ────────────────────

// Intro openers keyed by theme — read-aloud-style "how it started".
const DM_ENCOUNTER_INTROS = {
  random:     ['As the party rounds a bend, the threat is suddenly upon them.','A noise — too late. They are not alone.','The air shifts, and danger steps into the open.','Something was waiting here, and now it moves.','The quiet breaks all at once, and there is no time to think.','One heartbeat the road is empty; the next, it is not.'],
  bandits:    ['"That\'s far enough." Figures rise from cover, weapons drawn, blocking the road.','A whistle cuts the air — the ambush is sprung, blades flashing from the treeline.','"Coin or blood, travellers. Your choice." The cutthroats close in.','A rope snaps taut across the path, and laughter drifts from the rocks above.','"Well, well. Look what wandered into our stretch of road."','They step from the shadows on every side — no demands this time, just knives.'],
  goblinoids: ['Crude horns blare from the rocks above as the warband charges down.','Yellow eyes blink awake in the dark, and the chittering begins.','A rain of crude arrows announces the raiders before they even appear.','Shrieking and cackling, the pack pours out of every crevice at once.','Something small and vicious hurls a rock, and the warcry goes up.','The stench hits first; then the horde boils up out of the tunnels.'],
  beasts:     ['A low growl rolls through the brush — then the pack breaks cover, hungry.','The ground trembles. Whatever lives here has found the intruders.','Snapping branches, then teeth — the wild does not welcome trespassers.','Eyes glint at the edge of the firelight, circling, patient, closing.','A shriek from the canopy, and the predators drop into the open.','The herd was never the danger. What hunts the herd is.'],
  undead:     ['The cold deepens. Dead hands claw up through the earth.','A dirge of moans echoes as the restless dead shamble into the light.','The grave does not hold here. Something is rising.','The corpses you passed a moment ago are no longer where you left them.','A wet, dragging sound in the dark — and then many more, answering.','The dead do not charge. They simply come, and they do not stop.'],
  fiends:     ['The stench of brimstone arrives first, then the laughter from below.','Reality buckles as the fiends tear their way into the world.','Shadows lengthen, sprout claws, and lunge.','The temperature drops, the light curdles, and something grins in the dark.','A seam opens in the air itself, and the abyss leans through.','"Fresh souls," a voice purrs, delighted, from everywhere at once.'],
  casters:    ['A cold voice speaks a word of power, and the air ignites with magic.','Robed figures look up from their ritual — the intrusion will be punished.','"You should not have come." Arcane light gathers around their hands.','Runes flare to life underfoot as the spellcasters turn as one.','The air tastes of ozone; someone, somewhere, has begun to chant.','"Kill the interruption," one says calmly, and the spells begin to fly.'],
  fighters:   ['Steel rings against steel as the warriors form a line and advance.','"Hold the line!" The brutes lower their shoulders and charge.','Veterans, scarred and ready, move to cut off every escape.','Shields lock with a single practised crash, and the advance begins.','No taunts, no threats — just disciplined killers closing the distance.','"On my mark," the captain says, and the line surges forward.'],
  aberrations:['The angles of the room feel wrong, and then something that should not exist unfolds into view.','A pressure builds behind the eyes — whispers, promises, and then the horror reveals itself.','Reality thins like wet paper, and what waits on the other side reaches through.','Your own thoughts feel watched a moment before the thing shows itself.','Colours you cannot name bloom in the dark, and then it is upon you.','The walls seem to breathe, and something that is mostly eyes turns to look.'],
  dragons:    ['A shadow swallows the sun; leathery wings beat once, and the reptilian eyes fix upon the party.','The heat arrives before the roar — scales the colour of old coins glinting in the dark.','"Little thieves." The voice is vast, amused, and utterly without mercy.','The hoard shifts, and what you took for treasure opens one enormous eye.','A wind of sulphur and gold-dust rolls down the cavern before the wings do.','It does not rush. Why would it? It has all the time in the world, and you do not.'],
  giants:     ['The ground quakes with each footfall long before the giant crests the ridge.','A boulder arcs out of the sky — the first warning that something enormous has noticed them.','It has to stoop to see them, and it does not like what it sees.','A shadow falls across the whole party at once, and it is not a cloud.','"Little things," it rumbles, reaching down almost curiously.','The trees part like grass, and the giant simply steps into view.'],
  fey:        ['Laughter rings from nowhere and everywhere; the woodland has decided the party are trespassers.','Flowers turn to watch. A voice, sweet and cruel, offers a bargain no one asked for.','The path loops back on itself, and the fair folk step out of the crooked light.','Music you cannot place makes your feet slow — and then they are all around you.','"You broke the rules of this place," a child\'s voice giggles. "Now you play our game."','The mushrooms glow brighter, the shadows lengthen wrong, and the hunt begins.'],
  constructs: ['Stone grinds on stone as the sentinels wake, eyes lighting with cold purpose.','No breath, no fear — just the relentless clank of things built only to end intruders.','The guardians were told to let no one pass. They have never once failed.','Gears whir to life in the dark, and a dozen glass eyes swivel toward you.','A voice from centuries ago intones a challenge, and the statues step down.','It does not negotiate. It was not built to. It advances.'],
  oozesVermin:['The floor glistens — and then flows, reaching hungrily toward the nearest boot.','A dry rustle becomes a tide of skittering legs pouring from every crack.','Something drips from the ceiling, hisses where it lands, and begins to spread.','The walls are moving. On closer look, the walls are covered in them.','A soft, wet sound — and the puddle you stepped over is now behind you, following.','They come without malice or plan, only endless, mindless hunger.'],
  elementals: ['The air itself turns hostile — flame, frost, or howling wind given furious shape.','Raw elemental force tears loose from the world and rounds on the intruders.','The ground, the fire, the very wind rise up as one and attack.','A gout of flame gathers into a shape with burning eyes and reaching arms.','The river rears up, the stones grind together, and the storm takes form.','Something summoned and something furious — it does not know why it hates you, only that it does.'],
  casterWarband:['A robed figure lifts a hand and the rabble at its back howls forward on command.','"Protect the ritual!" — and the warband throws itself between you and its master.','Spellfire gathers behind a wall of expendable bodies.','The leader stays back, calm and deadly, as the thugs surge to buy time.','"Hold them off the circle!" someone screams, and the mob obeys.','Muscle in front, magic behind — a wall of blades and a storm of spells.'],
  huntPack:   ['They\'ve been tracking the party for miles. Now the circle closes and the hunt begins.','Low shapes fan out through the grass — this pack has done this many times before.','A single yip, answered from all sides. The ambush was set hours ago.','No growls, no warning — a good pack doesn\'t warn its prey.','They move like one animal with many bodies, cutting off every retreat.','The alpha waits. The others test you first.'],
  bossMinions:['The lackeys part, and their master steps forward with a terrible smile.','"Kill them," the leader says, almost bored, as the minions surge ahead.','A commanding presence raises one hand — and the swarm obeys.','The minions die first, gladly, to buy their master a better opening.','"You," the leader says, ignoring the rabble entirely. "I\'ve been expecting you."','A whip-crack of command, and the underlings hurl themselves forward.'],

  humansCommon: ['A ragged crowd blocks the way, clutching whatever passes for a weapon.','"We don\'t want trouble — but we\'ll make some if we have to." Hard eyes, harder hands.','Ordinary folk, desperate and armed, close ranks against the strangers.','Pitchforks and old swords level at the party — frightened, but committed.','"You\'re not welcome here." The villagers have clearly done this before.','A mob, half courage and half terror, surges forward all at once.'],
  mercenaries: ['A disciplined line forms up, shields set and blades ready — these are professionals.','"Nothing personal. We\'re paid to stop you here." The company advances as one.','Scarred veterans fan out with the ease of soldiers who have done this a hundred times.','Crossbows level from cover while the front rank braces — a paid ambush, well set.','"Contract\'s a contract." No malice, no mercy, just business.','They move on hand-signals, not shouts. This is a trained outfit, not a mob.'],
  cultists:    ['Hooded figures look up from their profane work, eyes bright with zeal.','"The Master will feast on your souls!" The fanatics rush in, unafraid to die.','A droning chant swells as the faithful turn, knives glinting.','Candlelight glints off a hundred wet blades and a hundred fervent smiles.','"You are the sacrifice we were promised!" They advance, delighted.','The ritual doesn\'t stop — some keep chanting even as the rest attack.'],
  assassinsSpies:['A whisper of movement — and the killers are already among you, blades out.','No warning, no demand: just professionals here to make you disappear.','Shadows detach from the walls, each holding a very sharp answer.','Someone paid well for this. The first you know of it is the blade at your back.','They don\'t announce themselves. They simply begin.','A glint on a rooftop, a footstep behind — the trap was set before you arrived.'],
  nobleCourt:  ['"How dare you." Retainers step forward, steel drawn to defend their lord.','A gilded voice gives a cold command, and the household guard advances.','Knights and courtiers close ranks around their noble, weapons flashing.','"Deal with them," the noble sighs, waving a ringed hand, and the guards obey.','Polished armour, perfect discipline — and a lord who expects to win.','The court parts, and the household knights move to make an example of you.'],
  pirates:     ['"Heave to, or we\'ll gut ya where ya stand!" The reavers swarm forward, cutlasses high.','A ragged crew spills into view, laughing, drunk on violence.','"Anythin\' ya carry is ours now." The raiders close in from every side.','Boarding hooks bite home, and the deck fills with howling cutthroats.','"Dead men, walk the plank. Live men, hand over the loot. Simple, aye?"','A cannon\'s echo still hangs in the air as the crew rushes the rail.'],
  tribalWarband:['War-paint and bared teeth — the warband erupts from the treeline with a howl.','Drums, then screams: the tribe has decided the strangers will not leave.','A shaman raises a bone staff and the warriors charge as one.','Horns of bone and hide sound from three sides at once — you are surrounded.','They know this ground. You do not. The ambush is already closing.','A single warcry is answered by dozens, and the trees come alive with foes.'],
  nonHumanoid: ['Whatever this is, it never was a person — and it is coming fast.','No words, no parley: only the hungry logic of a thing that is not human.','The wilderness has teeth here, and they have found the party.','There will be no talking your way out of this one.','It regards you the way you\'d regard a meal, and then it moves.','Nothing about it thinks the way you do — which makes it worse.'],
  monstrosities:['A shape that should not be sculpts itself out of the shadows and lunges.','Nature never made this — but here it is, and it is hungry.','Too many limbs, too many teeth: the monstrosity is upon them.','It shouldn\'t be able to move like that. It does anyway.','Part this, part that, all wrong — and all of it aimed at you.','The thing unfolds to its full size, and the full size is a problem.'],
  plants:      ['The undergrowth shifts of its own accord — and reaches.','A sickly-sweet reek, and then the vines are moving toward warm flesh.','What looked like a thicket unfolds into something that means them harm.','Spores drift on the air; a heartbeat later, the whole glade is hostile.','Roots erupt underfoot and the treeline leans in with a groan of old wood.','The flowers were pretty right up until they opened toothed mouths.'],
  swarms:      ['The ground seethes and rises — a single mass of countless tiny bodies.','A dry, rushing hiss becomes a tide pouring toward the party.','It is not one thing. It is thousands, and they are all hungry.','The buzzing becomes a roar, and the cloud descends.','You can\'t fight it back — for every one you crush, ten pour over the top.','The walls, the floor, the ceiling — all of it moving, all of it coming.'],
  celestials:  ['Light gathers into a stern and radiant form; judgement has arrived.','"Turn back, or be judged." The celestial\'s voice brooks no argument.','Wings of light unfurl — beautiful, terrible, and entirely unmoved.','A chorus with no singers swells, and the shining ones descend.','"You have strayed from the path." There is no anger in it, which is worse.','Radiance floods the space, and something perfect and merciless steps forward.'],
  lycanthropes:['A snarl, a shudder of changing flesh — the beast beneath the skin is loose.','What wore a human face a moment ago now bares fangs and lunges.','Fur, claws, and hunger: the curse has taken them, and now it hunts.','Bones crack and reshape, clothing tears, and the thing that stands up is not a person.','The moonlight does its work, and the villagers stop being villagers.','A howl rises far too close, and the shape sprinting at you is changing as it comes.'],
  demons:      ['Chaos given flesh boils into the world, shrieking with mindless hate.','The demons come without plan or mercy — only the joy of ruin.','Reality curdles, and the abyss spits its horrors into the light.','No strategy, no restraint — just a tide of gibbering, gleeful violence.','They tear at each other in their hurry to reach you first.','The air fills with shrieks and the wet sound of something being born wrong.'],
  devils:      ['Cold, precise, and utterly without pity, the devils advance in perfect order.','"Your soul is already forfeit." The devils close the trap with cruel patience.','No wasted motion, no mercy — the fiends of law have come to collect.','Every move is calculated; they have read the contract, and you are in breach.','"There is nothing personal in this," one says, smiling. "Only terms."','They fan out with terrible discipline, cutting off escape before the first blow.'],
  mixedWarband:['A ragtag host of beasts and brutes surges forward under a single cruel banner.','Snarls and warcries mix as the mismatched warband charges together.','Whatever holds this pack together, it points them all at the party.','Man and monster fight side by side here, and neither seems to mind.','A whip-crack of command, and a dozen different kinds of teeth come at you.','Chaos, but pointed chaos — someone has welded this mob into a weapon.'],
  undeadHorde: ['They come in their dozens, a shambling tide of the hungry dead.','The horde does not tire, does not fear, and does not stop.','Wave upon wave of dead flesh presses forward, blotting out the ground.','You cannot kill them fast enough — the dead keep arriving from the dark.','A moaning wall of corpses closes in, too many to count, too many to fight.','Every body that falls is simply climbed over by the next.'],
  beastHandlers:['Handlers loose their beasts with a shout — the animals hit the line first.','Growling hounds strain forward while their masters ready blade and bow.','A whistle, and the pack is unleashed ahead of its keepers.','"Sic \'em!" The beasts break first; the handlers follow to finish the job.','Snarling animals fan out on their leashes — then the leashes drop.','The keepers hang back, calm and cruel, letting the fangs do the opening work.']
};

// Shape-specific "how it starts" openers — layered on top of the theme intro.
const DM_SHAPE_INTROS = {
  ambush:     ['No warning — the first the party knows of it is the strike from concealment.','Every escape route is already covered before a single blade is drawn.','They let the party walk right into the middle before springing it.','The trap closes with practised timing — this was planned.'],
  gauntlet:   ['This is only the first wave. More are already moving up behind.','The foes come in relays, each rush buying time for the next to form.','Clear the first group and the next is already on you.','There is no single line to break — just wave after wave.'],
  vanguard:   ['A wall of shields locks together while shapes behind it raise bows and staves.','The front rank braces to hold you in place — the danger is what stands behind them.','The line holds you; the killers behind it take their time.','Get past the shields, or be picked apart from range.'],
  twinThreat: ['Two of them, moving in practised concert — this is a partnership, not a mob.','They split to flank, each a threat in its own right, deadlier together.','One draws your eye while the other gets into position.','A matched pair, and they clearly know how the other fights.'],
  siege:      ['The horde does not stop coming. Hold the line or be overrun.','Wave upon wave, they press forward heedless of the fallen.','Sheer numbers, and every one of them wants past you.','There is no flank to turn — only the front, and it is endless.'],
  duel:       ['One steps forward and points a blade: "You. Only you."','A rival singles out the party\'s champion — this is personal.','The rest hold back; this one wants a fair fight, or claims to.','"Just you and me. The others can watch."'],
  gang:       ['A whole crowd of them boils out at once — not skilled, but there are so many.','"Get \'em, lads!" and the rabble surges forward in a shouting mass.','More keep spilling from the doorways than you can possibly count.'],
  bodyguards: ['A ring of hard-eyed guards closes around someone they clearly value.','"Protect them — with your lives!" The bodyguards set themselves between you and their charge.','Whoever is at the centre matters; the wall of muscle around them says so.'],
  artillery:  ['A thin line braces up front while, behind it, the real danger takes aim.','"Screen them!" — and volley after volley arcs over the front rank.','The front is just bait; the killing comes from the ranks behind.'],
  pincer:     ['A shape at your front — and then footsteps behind. You are caught between two groups.','They hit from both sides at once; there was never a safe direction.','Half of them charge; the other half were already behind you.'],
  escalating: ['A weak first rush — a test. Something worse is coming behind it.','Each wave hits harder than the last, and the leader has not shown yet.','They send the expendable ones first. Save your strength; you will need it.'],
  skirmishers:['Quick shapes dart in, strike, and are gone before you can answer.','No line, no wall — just fast attackers flitting in and out of reach.','They will not stand and fight. They will bleed you a cut at a time.'],
  loneHunter: ['Something weak stumbles into view — and something far worse is using it as bait.','The little ones are a distraction. The real hunter is already circling.','A lure staggers forward; the predator waits for you to commit.'],
  standoff:   ['Everyone is already in position. Nobody has moved. The first one who does starts it.','Weapons are drawn on both sides — a single wrong breath will set it off.','A frozen moment, eye to eye — and then someone flinches.']
};

const DM_ENCOUNTER_TIPS = {
  balanced:
    'BALANCED MIX — a varied spread of foes.\n' +
    '• Opening: lead with ranged attackers and skirmishers to soften the party while your heavy hitters close the distance.\n' +
    '• Targeting: have foes gang the softest reachable PC (backline casters, low-AC bodies) rather than the tank the party wants them to hit.\n' +
    '• Terrain: use difficult ground, chokepoints and cover so the party can\'t line up a single clean volley on everyone.\n' +
    '• Morale: when about half the group is down, weaker foes should waver — flee, surrender, or fight defensively — unless something compels them.',
  swarm:
    'SWARM — many weak foes.\n' +
    '• Their strength is action economy: lots of bodies = lots of attacks. Spread out so the party can\'t hit clumps with area spells.\n' +
    '• Group identical creatures onto one initiative count and roll their attacks together to keep the turn fast.\n' +
    '• Use them to grapple, flank and block movement — pin the martials so your nastier foes get free shots.\n' +
    '• Expect a fireball to erase a chunk; that\'s fine, it\'s the trade. Keep a second line back out of the first blast.',
  elite:
    'ELITE — a few strong foes.\n' +
    '• Focus-fire is the party\'s win condition — don\'t bunch up. Split the threats across the battlefield so they can only kill one at a time.\n' +
    '• Give each elite a distinct job: one controls, one strikes, one flanks. Make them feel individually dangerous.\n' +
    '• Use reactions, mobility and cover to avoid being pinned. An elite that stands still and trades blows dies fast.\n' +
    '• Consider staggering when they engage so the party can\'t alpha-strike all of them in round one.',
  bossMinions:
    'BOSS + MINIONS — one leader and its lackeys.\n' +
    '• The boss should act first (set the tone) and, if it has the option, again near the end of the round — lean on lair/legendary-style beats even if improvised.\n' +
    '• Minions exist to screen: they body-block lanes to the boss, soak reactions, and set up flanks. Spend them freely.\n' +
    '• Have the boss target whoever threatens it most (the focus-firing rogue, the control caster) rather than the nearest body.\n' +
    '• Morale hook: if the boss falls, the minions likely break and flee. If a key minion falls, the boss may enrage.',
  solo:
    'SOLO — a single mighty creature.\n' +
    '• The danger is being stun-locked or focus-fired. Give it extra actions in spirit — legendary actions, a big recharge attack, or a second turn low in the initiative.\n' +
    '• Use the terrain and its own mobility so the party can\'t simply dogpile in melee — force them to spread out.\n' +
    '• Add a soft "phase" at ~50% HP: new tactic, an area effect, or a desperate escalation, so the fight has a turning point.\n' +
    '• Legendary resistance (or an improvised save-shrug once or twice) stops a single lucky save from ending it early.',
  ambush:
    'AMBUSH — attackers strike from hiding.\n' +
    '• Run a surprise round: hidden foes act, the party can\'t (roll their Stealth vs the party\'s passive Perception to confirm who\'s surprised).\n' +
    '• Attacks from hiding have advantage and often trigger Sneak Attack — open with the biggest hits while the party is flat-footed.\n' +
    '• Attackers should be positioned to cut off escape and hit the backline first; this shape leans on fewer, harder-hitting foes.\n' +
    '• After the surprise round it\'s a normal fight — the ambushers have spent their edge, so they may reposition or retreat to reset.',
  gauntlet:
    'GAUNTLET — foes arrive in successive waves.\n' +
    '• The creatures are split into waves (see the initiative list tags). Bring wave 2 in a round or two after wave 1, wave 3 after that.\n' +
    '• This taxes resources: the party can\'t safely blow everything on the first group. Reward pacing and punish over-nova.\n' +
    '• Later waves should hit where the party is weakest — flank the casters, arrive from a fresh direction, cut off the exit.\n' +
    '• Give a visible tell before each wave (horns, footsteps, a door bursting) so it feels earned, not random.',
  vanguard:
    'VANGUARD + ARCHERS — a front line shielding ranged attackers.\n' +
    '• Front-line foes (tagged "front") hold the choke and body-block; the backline (tagged "back") plinks from range behind them.\n' +
    '• The archers/casters are the real threat — the party has to break through or go around the wall to reach them.\n' +
    '• Front-liners should use Ready actions, grapples and shove to keep the party stuck in the kill zone.\n' +
    '• If the front collapses, the backline retreats and keeps firing rather than standing to trade in melee.',
  twinThreat:
    'TWIN THREAT — two dangerous leaders fighting as a pair.\n' +
    '• Play them as a team: they split to flank, cover each other, and never both get caught in one area effect.\n' +
    '• One should control/disable while the other strikes — a lockdown-and-execute pairing is far scarier than two bruisers.\n' +
    '• If the party focuses one, the other punishes them for the tunnel vision (free flanks, opportunity hits, a rescue).\n' +
    '• Losing one raises the stakes: the survivor gets reckless or vengeful — a good moment for a damage or defence spike.',
  siege:
    'SIEGE / HORDE — a relentless horde pressing a position.\n' +
    '• This is attrition. Foes keep coming; the party should feel the pressure of a line that might break.\n' +
    '• Give them an objective beyond "kill everything" — hold a door, protect an NPC, survive N rounds — so retreat and positioning matter.\n' +
    '• Feed the horde in from the edges each round rather than all at once; a chokepoint turns the fight from lethal to heroic.\n' +
    '• Reward clever crowd-control (walls, grease, entangles) — it\'s the intended answer to being outnumbered.',
  duel:
    'RIVAL DUEL — a single rival matched to a champion.\n' +
    '• Best when one PC has a personal stake — let the rival call them out and duel one-on-one while the rest deal with the scene.\n' +
    '• Match the rival\'s power to a single strong PC, not the whole party — otherwise it\'s just a solo boss.\n' +
    '• Give the rival a signature move and some banter; make it a character beat, not a stat check.\n' +
    '• Decide in advance what happens if the party gangs up — the rival flees, calls reinforcements, or fights to a dramatic loss.',

  gang:
    'GANG / RABBLE — lots of weak, varied foes.\n' +
    '• Perfect for a bandit hideout, thieves\' den, or riot: many low-CR humans (bandits, thugs, scouts) rather than a couple of elites.\n' +
    '• Individually harmless — dangerous through numbers and action economy. They win by dogpiling and flanking.\n' +
    '• Have them break and flee once ~half are down, or when a leader falls; a rabble\'s morale is brittle.\n' +
    '• Use the terrain of the hideout: choke points, thrown furniture, alarm whistles calling more from the next room.',

  bodyguards:
    'PROTECT THE VIP — a fragile target ringed by guards.\n' +
    '• The VIP is the objective, not the wall — a noble, hostage, spellcaster, or ritualist the guards die to shield.\n' +
    '• Guards interpose, grapple, and body-block; play them as genuinely trying to keep the party off their charge.\n' +
    '• Decide the VIP\'s goal: flee, finish a ritual, or parley. The clock (how many rounds until they escape/succeed) makes it tense.\n' +
    '• Reward clever play — a PC who breaks through to the VIP should be able to end the fight fast.',

  artillery:
    'ARTILLERY BATTERY — ranged threat behind a screen.\n' +
    '• The back rank (archers, mages) does the real damage; the thin front line only exists to slow the party down.\n' +
    '• Put the artillery on high ground or behind cover so closing the distance actually matters.\n' +
    '• Punish clumping — area attacks and volleys should make the party spread out and rush the line.\n' +
    '• If the screen falls fast, have the artillery reposition or drop bows for blades rather than stand and die.',

  pincer:
    'PINCER — two groups, opposite sides.\n' +
    '• Place Flank A and Flank B on opposite edges so the party is caught in the middle from round one.\n' +
    '• The threat is the crossfire and the split attention — no safe direction to retreat toward.\n' +
    '• Let smart PCs collapse one flank before the other arrives; stagger the two groups\' arrival by a round if it\'s too brutal.\n' +
    '• Great with a doorway, bridge, or corridor the party thought was safe behind them.',

  escalating:
    'ESCALATING WAVES — each wave hits harder.\n' +
    '• Wave 1 is a soft test (throwaway minions); the last wave carries the leader/elite. Tension builds instead of front-loading.\n' +
    '• Let the party feel like they\'re winning early — then raise the stakes as the stronger waves arrive.\n' +
    '• Trigger later waves on a timer, a alarm, or the previous wave dropping — reward speed with breathing room.\n' +
    '• Watch resource drain: players who blow everything on wave 1 should feel that mistake by wave 3.',

  skirmishers:
    'SKIRMISHERS — fast, fragile, hit-and-run.\n' +
    '• Low HP, high mobility: they dart in, strike, and disengage before the party can pin them down.\n' +
    '• Use hit-and-run every round — never let them stand still to be focused. Ranged pokes and ambush strikes.\n' +
    '• They punish slow, heavily-armoured parties and open terrain. Corner them and they crumble.\n' +
    '• Great as scouts, raiders, or assassins softening the party before a bigger fight.',

  loneHunter:
    'LONE HUNTER + LURES — a predator using bait.\n' +
    '• One strong creature is the real threat; the 1-2 weak "lures" exist to draw the party out of position.\n' +
    '• Play the hunter patiently: let the lures engage, then strike the isolated or wounded PC.\n' +
    '• Terrain is its ally — ambush from cover, retreat, circle back. It fights smart, not head-on.\n' +
    '• If the lures die early, the hunter should still get one good ambush before committing.',

  standoff:
    'STANDOFF — both sides already in position.\n' +
    '• Nobody has swung yet. Open with tension and roleplay: demands, threats, a countdown — the first hostile act starts initiative.\n' +
    '• Reward a party that talks or defuses; let them gain surprise, a better position, or avoid the fight entirely.\n' +
    '• When it breaks, everyone is already in range — no approach round, straight into the action.\n' +
    '• Decide each side\'s trigger and goal in advance so you can play the tension honestly.'
};

let dmCurrentEncounterCard = null; // { intro, tips, notes, ... }

function dmRollInitiativeFor(combatants) {
  // d20 + the creature's real Dex modifier when known; fall back to a rough
  // AC-derived mod for legacy/manual rows that have no Dex score.
  combatants.forEach(c => {
    if (c.isMonster === false) return; // leave manual/player rows alone
    const mod = (typeof c.dex === 'number')
      ? dmModNum(c.dex)
      : Math.max(-1, Math.min(5, Math.round(((c.ac || 12) - 12) / 2)));
    c.initiative = rnd(1, 20) + mod;
  });
}

function dmBuildEncounterCard(meta) {
  const monsters = dmCombatants.filter(c => c.isMonster && c.xp > 0);
  if (!monsters.length) { dmCurrentEncounterCard = null; dmRenderEncounterCard(); return; }

  dmRollInitiativeFor(dmCombatants);

  const introPool = DM_ENCOUNTER_INTROS[meta.theme] || DM_ENCOUNTER_INTROS.random;
  const shapeDesc = (DM_ENCOUNTER_SHAPES[meta.shape] || DM_ENCOUNTER_SHAPES.balanced).desc;
  // Layer a shape-specific opener onto the theme intro when one exists.
  const shapeIntros = DM_SHAPE_INTROS[meta.shape];
  const intro = shapeIntros
    ? `${dmPick(introPool)} ${dmPick(shapeIntros)}`
    : dmPick(introPool);

  dmCurrentEncounterCard = {
    intro,
    tips: DM_ENCOUNTER_TIPS[meta.shape] || DM_ENCOUNTER_TIPS.balanced,
    shapeDesc,
    rating: meta.rating,
    difficulty: meta.difficulty,
    theme: meta.theme,   // kept so Reroll Intro can redraw from the right pools
    shape: meta.shape,
    notes: dmCurrentEncounterCard && dmCurrentEncounterCard.keepNotes ? dmCurrentEncounterCard.notes : ''
  };
  dmRenderCombatants();
  dmRenderEncounterCard();
}

// Re-roll just the initiative.
function dmRerollInitiative() {
  dmRollInitiativeFor(dmCombatants);
  dmRenderCombatants();
  dmRenderEncounterCard(); // refresh the card's init list (edits are already in state)
  dmToast('Initiative rerolled.', 'success');
}

// Re-roll just the read-aloud intro, drawing a fresh line from the theme (and
// shape) pools. Overwrites any manual edit to the intro field only.
function dmRerollIntro() {
  if (!dmCurrentEncounterCard) return;
  const introPool = DM_ENCOUNTER_INTROS[dmCurrentEncounterCard.theme] || DM_ENCOUNTER_INTROS.random;
  const shapeIntros = DM_SHAPE_INTROS[dmCurrentEncounterCard.shape];
  dmCurrentEncounterCard.intro = shapeIntros
    ? `${dmPick(introPool)} ${dmPick(shapeIntros)}`
    : dmPick(introPool);
  dmRenderEncounterCard();
  dmToast('New intro rolled.', 'success');
}

// Persist the editable intro/tips/notes from the card back into state.
function dmCardEdit(field, value) {
  if (!dmCurrentEncounterCard) return;
  dmCurrentEncounterCard[field] = value;
  if (field === 'notes') dmCurrentEncounterCard.keepNotes = true;
}

function dmCloseEncounterCard() {
  dmCurrentEncounterCard = null;
  dmRenderEncounterCard();
}

function dmRenderEncounterCard() {
  const el = document.getElementById('dmEncounterCard');
  if (!el) return;
  const card = dmCurrentEncounterCard;
  if (!card) { el.style.display = 'none'; el.innerHTML = ''; return; }

  // Full turn order: every combatant (players + monsters), highest init first.
  const ordered = dmCombatants.slice().sort((a, b) => (b.initiative || 0) - (a.initiative || 0));
  const order = ordered.map(c => {
    const meta = c.isPlayer
      ? `${c.ac != null ? `AC ${c.ac}` : ''}${(c.ac != null && Number(c.maxHp) > 0) ? ' · ' : ''}${Number(c.maxHp) > 0 ? `${c.hp} HP` : ''}`.trim()
      : `AC ${c.ac} · ${c.hp} HP`;
    // Monsters open their full stat block; players don't (they have sheets).
    const openable = !c.isPlayer && (c.statBlock || c.slug);
    return `<li class="${c.isPlayer ? 'dm-init-player' : ''} ${openable ? 'dm-init-openable' : ''}" ${openable ? `onclick="dmOpenCombatantCreature(${c.id})" title="Open ${escapeHtml(c.name)} stat block"` : ''}><span class="dm-init-num">${c.initiative}</span> ${escapeHtml(c.name)}${openable ? ' <span class="dm-init-open-hint">▸ stats</span>' : ''}${c.isPlayer ? ' <span class="dm-player-badge">PLAYER</span>' : ''}${meta ? ` <span class="dm-init-ac">${meta}</span>` : ''}</li>`;
  }).join('');

  const r = card.rating || {};
  el.style.display = 'block';
  el.innerHTML = `
    <div class="dm-enc-card-head">
      <h3>Encounter Card</h3>
      <div class="dm-name-row">
        <span class="dm-difficulty-pill diff-${r.cls || 'medium'}">${escapeHtml(r.label || '')}</span>
        <button class="dm-icon-btn" onclick="dmCloseEncounterCard()" title="Dismiss">✕</button>
      </div>
    </div>
    <p class="dm-note">${escapeHtml(card.shapeDesc || '')} · ${r.adjusted ? r.adjusted.toLocaleString() + ' XP' : ''}</p>

    <div class="dm-card-header" style="border:none;padding:0 0 4px;">
      <label class="dm-enc-card-label" style="margin:0;">Intro — how it starts <span>(read aloud, editable)</span></label>
      <button class="dm-action-btn dm-reroll-btn" onclick="dmRerollIntro()" title="Roll a fresh opener">↻ Reroll Intro</button>
    </div>
    <textarea class="dm-enc-card-text" rows="2" oninput="dmCardEdit('intro', this.value)">${escapeHtml(card.intro || '')}</textarea>

    <label class="dm-enc-card-label">How to run it <span>(tactics for this battle type)</span></label>
    <textarea class="dm-enc-card-text dm-enc-card-tips" rows="9" oninput="dmCardEdit('tips', this.value)">${escapeHtml(card.tips || '')}</textarea>

    <div class="dm-enc-card-init">
      <div class="dm-card-header" style="border:none;padding:0 0 6px;">
        <h4>Initiative order</h4>
        <button class="dm-action-btn dm-reroll-btn" onclick="dmRerollInitiative()">Reroll Init</button>
      </div>
      <ol class="dm-init-list">${order}</ol>
    </div>

    <label class="dm-enc-card-label">DM notes</label>
    <textarea class="dm-enc-card-text" rows="3" placeholder="Terrain, twists, reinforcements, loot on the bodies..." oninput="dmCardEdit('notes', this.value)">${escapeHtml(card.notes || '')}</textarea>

    <div class="dm-name-row" style="margin-top:12px;">
      <button class="dm-action-btn dm-save-btn" onclick="dmSaveCurrentEncounter()">Save Encounter</button>
      <span class="dm-note" style="margin:0;">Saves to the Saved tab with notes &amp; combatants.</span>
    </div>
  `;
}

window.dmRerollInitiative = dmRerollInitiative;
window.dmCardEdit = dmCardEdit;
window.dmCloseEncounterCard = dmCloseEncounterCard;

// ─── NPC Generator ────────────────────────────────────────────────────────

// Generic fallback name pools (used for races without a dedicated pool).
const DM_NPC_NAMES = {
  male: ['Aldric','Bram','Cael','Dorin','Edran','Fyren','Gorath','Hadwin','Ivanos','Jorik','Kael','Lyren','Mordis','Navan','Oswin','Pell','Quarr','Riven','Soren','Tharyn','Ulric','Varen','Westan','Xander','Yoren','Zephyr'],
  female: ['Aela','Bryn','Calla','Dara','Elara','Fyra','Gwyn','Hana','Idris','Jora','Kira','Lyra','Mira','Nyla','Orina','Petra','Quill','Riva','Syla','Thea','Una','Vera','Wren','Xyla','Yara','Zara'],
  surname: ['Ashvale','Blackthorn','Coldwell','Draven','Emberton','Flint','Greymantle','Holloway','Ironwood','Jostle','Keswick','Lanford','Morren','Northgate','Orn','Pinehurst','Quillon','Ravenmoor','Stonefield','Tallow','Underhill','Voss','Whitlock','Yarrow','Zurn']
};

// Race-flavoured first names (surnames fall back to the generic pool, except
// where a race-specific surname style reads better).
const DM_NPC_RACE_NAMES = {
  Human:      { male: ['Aldric','Garrett','Tomas','Roderick','Bran','Cedric','Hallan','Joss'], female: ['Mira','Elsa','Rowena','Katra','Lena','Sable','Daria','Wren'], surname: ['Ashvale','Coldwell','Hartley','Marsh','Thorne','Greaves','Holloway','Pike'] },
  Elf:        { male: ['Aelar','Carric','Eluvian','Faelar','Heian','Laucian','Thamior','Varis'], female: ['Aerin','Caelynn','Felosial','Ielenia','Lia','Naivara','Quelenna','Silaqui'], surname: ['Moonwhisper','Starfall','Nightbreeze','Silverfrond','Dawnhorn','Amastacia','Galanodel'] },
  Dwarf:      { male: ['Adrik','Baern','Dolgrin','Gardain','Harbek','Morgran','Thoradin','Ulfgar'], female: ['Amber','Bardryn','Diesa','Gunnloda','Hlin','Kristryd','Sannl','Torbera'], surname: ['Stoneforge','Ironfist','Battlehammer','Deepdelver','Goldvein','Anvilmar','Coppercrag'] },
  Halfling:   { male: ['Alton','Cade','Eldon','Garret','Lyle','Milo','Roscoe','Wellby'], female: ['Andry','Bree','Cora','Lavinia','Merla','Nedda','Portia','Seraphina'], surname: ['Goodbarrel','Greenbottle','Tealeaf','Thorngage','Underbough','Brushgather','Highhill'] },
  Gnome:      { male: ['Boddynock','Dimble','Fonkin','Gerbo','Namfoodle','Roondar','Wrenn','Zook'], female: ['Bimpnottin','Caramip','Duvamil','Ellyjobell','Loopmottin','Nyx','Roywyn','Shamil'], surname: ['Beren','Daergel','Folkor','Garrick','Nackle','Scheppen','Turen'] },
  'Half-Elf': { male: ['Aramil','Berris','Corvus','Drannor','Enna','Galinndan','Riardon','Soveliss'], female: ['Adrie','Birel','Dara','Enna','Mialee','Shava','Thia','Valna'], surname: ['Brightwood','Halfmoon','Greywood','Meliamne','Naïlo','Siannodel','Xiloscient'] },
  'Half-Orc': { male: ['Dench','Feng','Gell','Henk','Holg','Krusk','Ront','Thokk'], female: ['Baggi','Emen','Engong','Myev','Neega','Ovak','Shautha','Vola'], surname: ['Skullsplitter','Ironhide','Bloodtusk','Grimjaw','Bonecrush','Ragefang'] },
  Tiefling:   { male: ['Akmenos','Damakos','Iados','Kairon','Leucis','Mordai','Skamos','Therai'], female: ['Akta','Bryseis','Damaia','Kallista','Lerissa','Nemeia','Orianna','Rieta'], surname: ['Voss','Nightshade','Ashborn','Hellmane','Duskwalker','Crimsonveil'] },
  Dragonborn: { male: ['Arjhan','Balasar','Donaar','Ghesh','Kriv','Medrash','Pandjed','Torinn'], female: ['Akra','Biri','Daar','Harann','Kava','Mishann','Nala','Sora'], surname: ['Clethtinthiallor','Daardendrian','Kepeshkmolik','Myastan','Shestendeliath','Verthisathurgiesh'] }
};

// Appearance details (race-flavoured where it helps; generic pool always added).
const DM_NPC_APPEARANCE = {
  generic: ['a weathered face and tired eyes','a crooked nose, broken long ago','a quick, darting gaze','a slow, deliberate way of moving','an old scar across one cheek','calloused hands and dirt under the nails','unusually fine, clean clothes','a limp favouring the left leg','a booming laugh that turns heads','a soft voice you have to lean in to hear'],
  Elf: ['silver hair bound in intricate braids','eyes that seem to catch every light','an ageless, unreadable expression'],
  Dwarf: ['a magnificent braided beard threaded with rings','soot-stained hands from the forge','a stocky frame and an immovable stance'],
  Halfling: ['bare, oversized feet and a easy grin','a cheerful round face','pockets that always seem to be full'],
  Tiefling: ['curling horns filed to blunt points','eyes like banked coals','a tail that flicks when they are nervous'],
  Dragonborn: ['gleaming scales the colour of old copper','a low rumble behind every word','no nose to speak of, just scaled slits']
};

// Personality keyed loosely by alignment lean (good / neutral / evil / any).
const DM_NPC_PERSONALITY = {
  good: ['genuinely kind, even to strangers','quick to help, slow to judge','fiercely loyal to friends','tries to see the best in everyone','carries themselves with quiet honour'],
  neutral: ['practical above all else','keeps their head down and minds their business','loyal mainly to themselves','cautious, weighs every option','easygoing until pushed'],
  evil: ['cold and calculating','charming in a way that never reaches the eyes','quick to anger, slow to forgive','sees people as means to an end','smiles most when they want something'],
  any: ['talks far too much','painfully shy with strangers','proud to the point of stubbornness','endlessly curious','nervous, fidgets constantly','blunt to the point of rudeness']
};

// Mannerisms / quirks (flavour, role-agnostic).
const DM_NPC_QUIRK = ['constantly chews on a sprig of herb','never quite finishes a sentence','refers to themselves in the third person','collects small, useless trinkets','flinches at loud noises','always seems to be eating','taps a rhythm when thinking','speaks in old proverbs','will not shake hands','keeps glancing at the door'];

// Motivation keyed by role.
const DM_NPC_MOTIVATION = {
  Commoner: ['wants nothing more than a quiet, safe life','is saving every coin to escape this town','dreams of adventure but never leaves'],
  Guard: ['takes the job far too seriously','is just counting days to retirement','secretly hates the people they protect'],
  Merchant: ['will haggle over a single copper','is one bad deal from ruin','smuggles a little something on the side'],
  Innkeeper: ['hears everything and forgets nothing','wants the inn to outlive them','feeds the hungry for free, quietly'],
  Bandit: ['robs to feed a family back home','is in it purely for the thrill','wants out but owes the wrong people'],
  Cultist: ['truly believes the world must end','was lied to and is in too deep','serves out of fear, not faith'],
  Noble: ['schemes for a higher title','is bored and looking for amusement','genuinely cares for their people'],
  Mage: ['hunts a piece of forbidden knowledge','fears their own growing power','wants recognition above all'],
  Priest: ['serves their god without question','has begun to doubt everything','uses the faith for personal gain'],
  Spy: ['serves a master no one suspects','plays every side against the others','wants to defect but cannot'],
  Assassin: ['kills only for the right price','is hunting one specific target','wants to leave the life behind'],
  Gladiator: ['fights for freedom, one bout at a time','craves the roar of the crowd','owes their life to the arena master'],
  any: ['is chasing a debt long overdue','protects a secret worth killing for','is looking for someone who vanished']
};

// Occupation — the concrete "what they actually do day to day", keyed by role.
const DM_NPC_OCCUPATION = {
  Commoner: ['tends a small farm outside the walls','sweeps the streets before dawn','works the docks hauling cargo','begs at the temple steps','runs errands for anyone who pays'],
  Guard: ['mans the east gate every night shift','patrols the market district','guards the lord\'s private quarters','runs the holding cells under the barracks','trains green recruits at the yard'],
  Merchant: ['sells silks and spices from a corner stall','runs a caravan between three cities','deals in rare books and curios','fences "found" goods out the back','owns half the shops on the main street'],
  Innkeeper: ['runs the busiest tavern in town','keeps a quiet roadside inn for travellers','brews their own ale in the cellar','rents rooms by the week to dock workers','serves the best stew this side of the river'],
  Bandit: ['ambushes wagons on the forest road','runs a protection racket in the slums','scouts targets from inside the city','leads a small crew of cutthroats','poses as a beggar to case marks'],
  Cultist: ['recruits the desperate in back alleys','keeps the shrine hidden beneath a shop','copies forbidden texts by candlelight','prepares the next moonless-night rite','poses as a humble street preacher'],
  Noble: ['holds court in a marbled manor','manages estates they have never visited','hosts lavish parties to buy loyalty','sits on the city council','funds an expedition for personal glory'],
  Mage: ['runs a cramped magic-item shop','researches in a tower full of smoke','tutors rich children in cantrips','sells potions of dubious quality','consults for the city watch on strange cases'],
  Priest: ['leads dawn services at the temple','tends the sick in the poor quarter','keeps the records of births and deaths','blesses ships before they sail','collects tithes a little too eagerly'],
  Spy: ['poses as a humble clerk','works as a courier to move messages','tends bar to overhear the right people','sells flowers near the palace gates','keeps books for a merchant house'],
  Assassin: ['fronts as a quiet locksmith','works as a travelling physician','runs a knife-sharpening cart','poses as a temple acolyte','takes contracts through a dead drop'],
  Gladiator: ['fights in the pits three nights a week','trains other fighters between bouts','works as a hired bodyguard by day','bounces at a rough tavern','tours arena to arena for coin'],
  any: ['takes whatever work the day offers','runs a small trade no one notices','keeps to themselves and asks no questions']
};

// Plot — their current situation / personal storyline (a sentence or two).
const DM_NPC_PLOT = {
  good: ['is quietly protecting someone the law would punish','is trying to undo a wrong from their past','has uncovered corruption and does not know who to trust','is gathering allies for a cause bigger than themselves'],
  neutral: ['is caught between two powerful people and playing both','owes a favour that is about to come due','is trying to leave their old life behind','has stumbled onto something valuable and dangerous'],
  evil: ['is slowly maneuvering a rival toward ruin','is hiding a body and the questions that come with it','is building toward something the town will not survive','has a hostage no one knows about yet'],
  any: ['lost someone recently and has not been the same','is searching for a person who does not want to be found','is sitting on a secret that could topple a powerful name','recently came into money no one can explain']
};

// Quest hooks — a job/lead the party could take ON (optional, on demand).
const DM_NPC_HOOK = ['needs the party to recover a stolen heirloom, no questions asked','is offering coin to escort them safely out of the city','begs for help finding a missing family member','will pay to have a rival quietly dealt with','hires the party to investigate strange noises beneath their cellar','wants an item retrieved from a place no sane person goes','offers a map in exchange for clearing a nearby ruin','seeks bodyguards for a journey they refuse to explain','knows a secret they\'ll trade for a dangerous favour','warns the party of a threat only they seem to see'];

function dmPick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function dmCap(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }

function dmAlignmentLean(alignment) {
  const a = (alignment || '').toLowerCase();
  if (a.includes('good')) return 'good';
  if (a.includes('evil')) return 'evil';
  if (a) return 'neutral';
  return null;
}

function dmRollNpcName(race) {
  const r = race || document.getElementById('dmNpcRace')?.value || '';
  const racePool = DM_NPC_RACE_NAMES[r];
  const isFemale = Math.random() > 0.5;
  const firstPool = racePool ? (isFemale ? racePool.female : racePool.male) : (isFemale ? DM_NPC_NAMES.female : DM_NPC_NAMES.male);
  const surnamePool = racePool ? racePool.surname : DM_NPC_NAMES.surname;
  const el = document.getElementById('dmNpcName');
  if (el) el.value = `${dmPick(firstPool)} ${dmPick(surnamePool)}`;
}

// Read the current race/role/alignment context from the form.
function dmNpcContext() {
  const race = document.getElementById('dmNpcRace')?.value || '';
  const role = document.getElementById('dmNpcRole')?.value || '';
  const alignment = document.getElementById('dmNpcAlignment')?.value || '';
  return { race, role, alignment, lean: dmAlignmentLean(alignment) || 'any' };
}

// Generate a single detail string for a given field, flavoured by context.
function dmGenNpcField(field, ctx) {
  ctx = ctx || dmNpcContext();
  switch (field) {
    case 'appearance': {
      const pool = (DM_NPC_APPEARANCE[ctx.race] || []).concat(DM_NPC_APPEARANCE.generic);
      return dmCap(`has ${dmPick(pool)}.`);
    }
    case 'personality': {
      const pool = (DM_NPC_PERSONALITY[ctx.lean] || []).concat(DM_NPC_PERSONALITY.any);
      return `${dmCap(dmPick(pool))}; ${dmPick(DM_NPC_QUIRK)}.`;
    }
    case 'occupation': {
      const pool = DM_NPC_OCCUPATION[ctx.role] || DM_NPC_OCCUPATION.any;
      return dmCap(`${dmPick(pool)}.`);
    }
    case 'plot': {
      const pool = (DM_NPC_PLOT[ctx.lean] || []).concat(DM_NPC_PLOT.any);
      return dmCap(`${dmPick(pool)}.`);
    }
    case 'hook':
      return dmCap(`${dmPick(DM_NPC_HOOK)}.`);
    default:
      return '';
  }
}

const DM_NPC_FIELD_IDS = {
  appearance: 'dmNpcAppearance',
  personality: 'dmNpcPersonality',
  occupation: 'dmNpcOccupation',
  plot: 'dmNpcPlot',
  hook: 'dmNpcHook'
};

// Reroll a single field in place (used by each line's reroll button).
function dmRerollField(field) {
  const id = DM_NPC_FIELD_IDS[field];
  const el = id && document.getElementById(id);
  if (el) el.value = dmGenNpcField(field);
}

// Generate: keep whatever the DM has set, fill the blanks. Hook stays optional —
// only filled if the field is already empty AND it rolls in (~50%).
function dmGenerateNpc() {
  const races = ['Human','Human','Human','Elf','Dwarf','Halfling','Gnome','Half-Elf','Half-Orc','Tiefling','Dragonborn'];
  const roles = ['Commoner','Guard','Merchant','Innkeeper','Bandit','Cultist','Noble','Mage','Priest','Spy'];
  const alignments = ['Lawful Good','Neutral Good','Chaotic Good','Lawful Neutral','True Neutral','Chaotic Neutral','Lawful Evil','Neutral Evil','Chaotic Evil'];

  const raceEl = document.getElementById('dmNpcRace');
  const roleEl = document.getElementById('dmNpcRole');
  const alignEl = document.getElementById('dmNpcAlignment');
  const nameEl = document.getElementById('dmNpcName');

  // LOCK what the DM has chosen; fill only the blanks.
  if (raceEl && !raceEl.value) raceEl.value = dmPick(races);
  if (roleEl && !roleEl.value) roleEl.value = dmPick(roles);
  if (alignEl && !alignEl.value) alignEl.value = dmPick(alignments);

  const ctx = dmNpcContext();
  if (nameEl && !nameEl.value.trim()) dmRollNpcName(ctx.race);

  // Wealth: fill if blank (or left on Random), biased by role. A locked choice stays.
  const wealthEl = document.getElementById('dmNpcWealth');
  if (wealthEl && (!wealthEl.value || wealthEl.value === 'Random')) {
    const weights = DM_WEALTH_BIAS[ctx.role] || DM_WEALTH_BIAS.any;
    wealthEl.value = DM_WEALTH_TIERS[dmWeightedTier(weights)];
  }

  // Fill each detail field only if it's currently empty (don't clobber edits).
  ['appearance','personality','occupation','plot'].forEach(field => {
    const el = document.getElementById(DM_NPC_FIELD_IDS[field]);
    if (el && !el.value.trim()) el.value = dmGenNpcField(field, ctx);
  });
  // Quest hook is optional: fill only if empty and it rolls in.
  const hookEl = document.getElementById(DM_NPC_FIELD_IDS.hook);
  if (hookEl && !hookEl.value.trim() && Math.random() < 0.5) {
    hookEl.value = dmGenNpcField('hook', ctx);
  }
}

// Reroll All: clear every field and build a completely fresh NPC.
function dmRerollNpc() {
  dmCancelEditNpc(); // drop any in-progress edit
  ['dmNpcName','dmNpcNotes','dmNpcAppearance','dmNpcPersonality','dmNpcOccupation','dmNpcPlot','dmNpcHook']
    .forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
  ['dmNpcRace','dmNpcRole','dmNpcAlignment']
    .forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
  const wealthEl = document.getElementById('dmNpcWealth');
  if (wealthEl) wealthEl.value = 'Random';
  dmGenerateNpc();
}

// ─── Wealth → Loot ─────────────────────────────────────────────────────────
// Wealth tiers, poorest to richest. Each defines the coin ranges and item pool
// a Roll Loot draws from, so a Noble drops more than a Beggar.
const DM_WEALTH_TIERS = ['Destitute','Poor','Modest','Comfortable','Wealthy'];

const DM_LOOT_BY_WEALTH = {
  Destitute: {
    coins: () => `${rnd(0,8)}cp`,
    items: ['a torn piece of cloth','a bone whistle','a half-eaten ration','a small smooth stone','a frayed bit of rope','nothing of value']
  },
  Poor: {
    coins: () => `${rnd(0,6)}sp, ${rnd(0,15)}cp`,
    items: ['a bent copper ring','a smudged letter','a cracked leather belt','a worn wooden charm','a chipped clay pipe','a single worn boot']
  },
  Modest: {
    coins: () => `${rnd(2,12)}gp, ${rnd(0,9)}sp`,
    items: ['a vial of antitoxin','a set of thieves\' tools','a hand-drawn map','a pouch of caltrops','a bag of 10 candles and flint','a decent hunting knife','a flask of cheap wine']
  },
  Comfortable: {
    coins: () => `${rnd(15,45)}gp`,
    items: ['a potion of healing','a silver locket (worth 25gp)','a jar of alchemist\'s fire','a small amethyst (10gp)','a fine cloak with a silver clasp','a sealed letter bearing a wax crest','a vial of perfume worth 15gp']
  },
  Wealthy: {
    coins: () => `${rnd(60,180)}gp, ${rnd(5,20)}pp`,
    items: ['a star ruby (50gp)','a gold signet ring (worth 75gp)','a potion of greater healing','an ornate jewelled dagger (100gp)','a deed to a small property','a set of fine silverware','a pearl necklace (worth 120gp)']
  }
};

// How Random wealth leans for each role (weights over the 5 tiers, poor→rich).
const DM_WEALTH_BIAS = {
  Commoner:  [2,4,3,1,0], Guard:    [0,3,4,2,0], Merchant: [0,1,3,4,2],
  Innkeeper: [0,2,4,3,1], Bandit:   [1,3,3,2,1], Cultist:  [1,3,3,2,0],
  Noble:     [0,0,1,3,5], Mage:     [0,1,3,3,2], Priest:   [0,2,4,2,1],
  Spy:       [0,2,3,3,1], Assassin: [0,1,2,3,2], Gladiator:[0,2,3,3,1],
  any:       [1,2,3,2,1]
};

function rnd(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }

// Pick a tier index from a weight array.
function dmWeightedTier(weights) {
  const total = weights.reduce((a, b) => a + b, 0) || 1;
  let r = Math.random() * total;
  for (let i = 0; i < weights.length; i++) { r -= weights[i]; if (r < 0) return i; }
  return weights.length - 1;
}

// Resolve the wealth tier to use for loot: explicit dropdown choice, else
// random biased by the NPC's role.
function dmResolveWealth() {
  const chosen = document.getElementById('dmNpcWealth')?.value || '';
  if (chosen && chosen !== 'Random' && DM_LOOT_BY_WEALTH[chosen]) return chosen;
  const role = document.getElementById('dmNpcRole')?.value || '';
  const weights = DM_WEALTH_BIAS[role] || DM_WEALTH_BIAS.any;
  return DM_WEALTH_TIERS[dmWeightedTier(weights)];
}

function dmRollLoot() {
  const tier = dmResolveWealth();
  const table = DM_LOOT_BY_WEALTH[tier] || DM_LOOT_BY_WEALTH.Modest;
  const coins = table.coins();
  const item = dmPick(table.items);
  const loot = `[${tier}] ${coins} · ${item}`;
  const el = document.getElementById('dmNpcLootResult');
  if (el) { el.textContent = loot; el.classList.remove('dm-empty-state'); }
}

// Read every NPC field from the form into a plain object.
function dmReadNpcForm() {
  const v = id => (document.getElementById(id)?.value || '').trim();
  const loot = document.getElementById('dmNpcLootResult')?.textContent || '';
  return {
    name: v('dmNpcName') || 'Unnamed NPC',
    race: v('dmNpcRace'),
    role: v('dmNpcRole'),
    alignment: v('dmNpcAlignment'),
    wealth: v('dmNpcWealth'),
    appearance: v('dmNpcAppearance'),
    personality: v('dmNpcPersonality'),
    occupation: v('dmNpcOccupation'),
    plot: v('dmNpcPlot'),
    hook: v('dmNpcHook'),
    notes: v('dmNpcNotes'),
    loot: loot.includes('Roll Loot') ? '' : loot
  };
}

let _dmEditingNpcId = null;

function dmSaveNpc() {
  const data = dmReadNpcForm();
  const saved = dmGetSavedNpcs();

  if (_dmEditingNpcId != null) {
    // Update the NPC we're editing, in place.
    const idx = saved.findIndex(n => n.id === _dmEditingNpcId);
    if (idx !== -1) saved[idx] = { ...saved[idx], ...data };
    dmToast('NPC updated.', 'success');
  } else {
    saved.push({ id: Date.now(), ...data });
    dmToast('NPC saved.', 'success');
  }
  localStorage.setItem('dndDmNpcs', JSON.stringify(saved));
  dmRenderNpcList();
  dmResetNpcForm();
}

// Load a saved NPC back into the form for editing.
function dmEditNpc(id) {
  const npc = dmGetSavedNpcs().find(n => n.id === id);
  if (!npc) return;
  _dmEditingNpcId = id;
  const set = (elId, val) => { const el = document.getElementById(elId); if (el) el.value = val || ''; };
  set('dmNpcName', npc.name === 'Unnamed NPC' ? '' : npc.name);
  set('dmNpcRace', npc.race); set('dmNpcRole', npc.role); set('dmNpcAlignment', npc.alignment);
  set('dmNpcWealth', npc.wealth || 'Random');
  set('dmNpcAppearance', npc.appearance); set('dmNpcPersonality', npc.personality);
  set('dmNpcOccupation', npc.occupation); set('dmNpcPlot', npc.plot);
  set('dmNpcHook', npc.hook); set('dmNpcNotes', npc.notes);

  const lootEl = document.getElementById('dmNpcLootResult');
  if (lootEl) {
    if (npc.loot) { lootEl.textContent = npc.loot; lootEl.classList.remove('dm-empty-state'); }
    else { lootEl.textContent = 'Hit "Roll Loot" to generate a loot drop.'; lootEl.classList.add('dm-empty-state'); }
  }

  const title = document.getElementById('dmNpcFormTitle');
  if (title) title.textContent = 'Edit NPC';
  const saveBtn = document.getElementById('dmNpcSaveBtn');
  if (saveBtn) saveBtn.textContent = 'Update NPC';
  const cancelBtn = document.getElementById('dmNpcCancelBtn');
  if (cancelBtn) cancelBtn.style.display = '';

  document.getElementById('dmNpcName')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function dmCancelEditNpc() {
  if (_dmEditingNpcId == null) return;
  dmResetNpcForm();
}

// Clear the form and reset edit state + button labels.
function dmResetNpcForm() {
  _dmEditingNpcId = null;
  ['dmNpcName','dmNpcNotes','dmNpcAppearance','dmNpcPersonality','dmNpcOccupation','dmNpcPlot','dmNpcHook']
    .forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
  ['dmNpcRace','dmNpcRole','dmNpcAlignment']
    .forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
  const wealthEl = document.getElementById('dmNpcWealth');
  if (wealthEl) wealthEl.value = 'Random';
  const lootEl = document.getElementById('dmNpcLootResult');
  if (lootEl) { lootEl.textContent = 'Hit "Roll Loot" to generate a loot drop.'; lootEl.classList.add('dm-empty-state'); }
  const title = document.getElementById('dmNpcFormTitle');
  if (title) title.textContent = 'Build an NPC';
  const saveBtn = document.getElementById('dmNpcSaveBtn');
  if (saveBtn) saveBtn.textContent = 'Save NPC';
  const cancelBtn = document.getElementById('dmNpcCancelBtn');
  if (cancelBtn) cancelBtn.style.display = 'none';
}

function dmGetSavedNpcs() {
  try { return JSON.parse(localStorage.getItem('dndDmNpcs') || '[]'); } catch { return []; }
}

function dmRenderNpcList() {
  const list = document.getElementById('dmNpcList');
  if (!list) return;
  const npcs = dmGetSavedNpcs();
  if (!npcs.length) { list.innerHTML = '<p class="dm-empty-state">No saved NPCs yet.</p>'; return; }
  const detail = (label, val) => val ? `<span class="dm-npc-notes"><strong>${label}:</strong> ${escapeHtml(val)}</span>` : '';
  list.innerHTML = npcs.map(n => `
    <div class="dm-npc-row">
      <div class="dm-npc-info">
        <span class="dm-npc-name">${escapeHtml(n.name)}</span>
        <span class="dm-npc-meta">${[n.race, n.role, n.alignment, (n.wealth && n.wealth !== 'Random') ? n.wealth : ''].filter(Boolean).join(' · ')}</span>
        ${detail('Appearance', n.appearance)}
        ${detail('Personality', n.personality)}
        ${detail('Occupation', n.occupation)}
        ${detail('Plot', n.plot)}
        ${detail('Hook', n.hook)}
        ${detail('Notes', n.notes)}
        ${n.loot ? `<span class="dm-npc-loot">Loot: ${escapeHtml(n.loot)}</span>` : ''}
      </div>
      <div class="dm-npc-actions">
        <button class="dm-icon-btn" onclick="dmEditNpc(${n.id})" title="Edit">Edit</button>
        <button class="dm-icon-btn dm-remove-btn" onclick="dmDeleteNpc(${n.id})" title="Remove">✕</button>
      </div>
    </div>
  `).join('');
}

function dmDeleteNpc(id) {
  if (_dmEditingNpcId === id) dmResetNpcForm();
  const saved = dmGetSavedNpcs().filter(n => n.id !== id);
  localStorage.setItem('dndDmNpcs', JSON.stringify(saved));
  dmRenderNpcList();
}

async function dmClearAllNpcs() {
  const ok = await dmModal({ title: 'Clear all NPCs?', message: 'This removes every saved NPC for good.', confirmText: 'Clear all', danger: true });
  if (!ok) return;
  localStorage.removeItem('dndDmNpcs');
  dmRenderNpcList();
  dmToast('All NPCs cleared.', 'success');
}

async function dmLoadHomePlayerCount() {
  const el = document.getElementById('dmHomeCampaignPlayers');
  if (!el) return;
  const db = window.db;
  if (!db || !dmCurrentCampaignId()) { el.textContent = '—'; return; }
  el.textContent = '…';
  try {
    const members = await dmFetchMembers();
    el.textContent = String(members.length);
  } catch (e) {
    el.textContent = '—';
    console.warn('home player count failed:', e.message);
  }
}

async function dmLoadPlayers() {
  const list = document.getElementById('dmPlayersList');
  if (!list) return;

  const session = dmSessionLoad();
  const campaignName = session?.campaignName || '';
  if (!campaignName) {
    list.innerHTML = '<p class="dm-empty-state">No campaign name in your session. Exit and re-enter the DM portal to refresh.</p>';
    return;
  }

  const db = window.db;
  if (!db) {
    list.innerHTML = '<p class="dm-empty-state">Not connected to cloud.</p>';
    return;
  }

  const campaignId = dmCurrentCampaignId();
  if (!campaignId) {
    list.innerHTML = '<p class="dm-empty-state">No campaign id in your session. Exit and re-enter the DM portal to refresh.</p>';
    return;
  }

  list.innerHTML = '<p class="dm-empty-state">Loading players...</p>';

  try {
    // Roster source of truth: campaigns/{id}/members (a scoped, authorized read).
    // Each member doc is a player's grant of view access. Removing a player =
    // deleting their member doc, which works instantly even if they're offline.
    const snap = await db.collection('campaigns').doc(campaignId).collection('members').get();

    if (snap.empty) {
      list.innerHTML = `<p class="dm-empty-state">No players have joined "<strong>${escapeHtml(campaignName)}</strong>" yet. Players join from Settings → Campaign Access using the campaign password.</p>`;
      return;
    }

    const cards = [];
    snap.forEach(doc => {
      const m = doc.data() || {};
      cards.push({
        uid: m.uid || doc.id,
        charId: m.charId || '',
        name: m.charName || 'Unnamed',
        race: m.race || '',
        cls: m.class || '',
        level: m.level || ''
      });
    });

    cards.sort((a, b) => a.name.localeCompare(b.name));

    list.innerHTML = cards.map(c => `
      <div class="dm-player-card">
        <div class="dm-player-info">
          <span class="dm-player-name">${escapeHtml(c.name)}</span>
          <span class="dm-player-meta">${[c.race, c.cls, c.level ? 'Lv ' + c.level : ''].filter(Boolean).join(' · ')}</span>
        </div>
        <div class="dm-player-actions">
          ${c.charId ? `<button class="dm-action-btn" onclick="dmViewPlayerCharacter('${c.uid}','${c.charId}')">View Sheet</button>` : ''}
          <button class="dm-action-btn dm-danger-btn" onclick="dmRemovePlayer('${c.charId}','${escapeHtml(c.name)}',this)">Remove</button>
        </div>
      </div>
    `).join('');

  } catch (e) {
    console.error('dmLoadPlayers failed:', e);
    list.innerHTML = `<p class="dm-empty-state">${escapeHtml(friendlyFirebaseError(e))}</p>`;
  }
}

// ─── Campaign membership (roster + remove) ─────────────────────────────────

function dmCurrentCampaignId() {
  return dmSessionLoad()?.campaignId || '';
}

// Fetch the current campaign roster from the members subcollection (the source
// of truth that reflects removals). Returns [{ uid, charId, charName, race,
// class, level }]. Empty array if no campaign / not connected.
async function dmFetchMembers() {
  const db = window.db;
  const campaignId = dmCurrentCampaignId();
  if (!db || !campaignId) return [];
  const snap = await db.collection('campaigns').doc(campaignId).collection('members').get();
  const members = [];
  snap.forEach(doc => {
    const m = doc.data() || {};
    members.push({
      uid: m.uid || doc.id,
      charId: m.charId || '',
      charName: m.charName || 'Unnamed',
      race: m.race || '',
      class: m.class || '',
      level: m.level || ''
    });
  });
  return members;
}

const _dmRemoveState = {};
async function dmRemovePlayer(charId, name, btn) {
  if (!charId) return;
  // Two-step confirm
  if (!_dmRemoveState[charId]) {
    _dmRemoveState[charId] = true;
    if (btn) { btn.textContent = 'Sure?'; }
    setTimeout(() => { _dmRemoveState[charId] = false; if (btn) btn.textContent = 'Remove'; }, 4000);
    return;
  }
  _dmRemoveState[charId] = false;
  const db = window.db;
  const campaignId = dmCurrentCampaignId();
  if (!db || !campaignId) return;
  if (btn) { btn.disabled = true; btn.textContent = 'Removing…'; }
  try {
    // Delete the member doc (keyed by charId) — the roster reads members, so the
    // character is gone immediately regardless of whether the player is online.
    // Their app clears its campaign indicator on next load when it sees no doc.
    await db.collection('campaigns').doc(campaignId)
      .collection('members').doc(charId).delete();
    dmToast(name + ' removed.', 'success');
    dmLoadPlayers();
  } catch (e) {
    if (btn) { btn.disabled = false; btn.textContent = 'Remove'; }
    dmToast(friendlyFirebaseError(e), 'error');
  }
}

window.dmRemovePlayer = dmRemovePlayer;

// ─── Player Spells overview (matrix table with overlap highlighting) ────────
async function dmLoadPlayerSpells() {
  const wrap = document.getElementById('dmSpellsTableWrap');
  const legend = document.getElementById('dmSpellsLegend');
  if (!wrap) return;

  const db = window.db;
  const campaignName = dmSessionLoad()?.campaignName || '';
  if (!db || !dmCurrentCampaignId()) { wrap.innerHTML = '<p class="dm-empty-state">No campaign in session.</p>'; return; }

  wrap.innerHTML = '<p class="dm-empty-state">Loading player spells…</p>';

  try {
    // Roster from members (reflects removals), then pull each player's live sheet.
    const members = (await dmFetchMembers()).filter(m => m.charId);

    if (!members.length) {
      wrap.innerHTML = `<p class="dm-empty-state">No players have joined "<strong>${escapeHtml(campaignName)}</strong>" yet.</p>`;
      if (legend) legend.style.display = 'none';
      return;
    }

    const docs = await Promise.all(members.map(m =>
      db.collection('userData').doc(m.uid).collection('characters').doc(m.charId).get()
        .catch(() => null)));

    // Build: players[], and a map of spellName -> { level, byPlayer:Set }
    const players = [];
    const spellMap = new Map(); // key: lowercased name

    docs.forEach(doc => {
      if (!doc || !doc.exists) return;
      const d = doc.data() || {};
      const info = d?.data?.characterInfo || {};
      const sd = d?.data?.page3?.spellsData || {};
      const pName = info.name || 'Unnamed';
      const pIdx = players.length;
      players.push({ name: pName, cls: info.class || '' });

      const ingest = (arr, isCantrip) => {
        (Array.isArray(arr) ? arr : []).forEach(sp => {
          // Only PREPARED spells — matches the player's own Prepared Spells table
          // (spells.js filters on spell.prepared). This reflects the player's
          // current preparation each time the DM (re)loads this view.
          if (!sp || !sp.prepared) return;
          const name = (sp.name ? String(sp.name) : '').trim();
          if (!name) return;
          const key = name.toLowerCase();
          // Level: cantrips = 0; otherwise use record level (number-ish) or 0
          let lvl = isCantrip ? 0 : parseInt(sp.level, 10);
          if (isNaN(lvl)) lvl = isCantrip ? 0 : 1;
          if (!spellMap.has(key)) spellMap.set(key, { name, level: lvl, byPlayer: new Set() });
          spellMap.get(key).byPlayer.add(pIdx);
        });
      };
      ingest(sd.cantrips, true);
      ingest(sd.spells, false);
    });

    if (!players.length) {
      wrap.innerHTML = '<p class="dm-empty-state">Could not load any player sheets.</p>';
      if (legend) legend.style.display = 'none';
      return;
    }

    if (!spellMap.size) {
      wrap.innerHTML = '<p class="dm-empty-state">No prepared spells across linked characters yet. Players control which spells are prepared on their own sheet.</p>';
      if (legend) legend.style.display = 'none';
      return;
    }

    // Group spells by level, sort within level by name
    const byLevel = {};
    spellMap.forEach(rec => { (byLevel[rec.level] = byLevel[rec.level] || []).push(rec); });
    Object.values(byLevel).forEach(list => list.sort((a, b) => a.name.localeCompare(b.name)));
    const levels = Object.keys(byLevel).map(Number).sort((a, b) => a - b);

    const lvlLabel = (l) => l === 0 ? 'Cantrips' : `Level ${l}`;
    const colCount = players.length + 1;

    let html = '<table class="dm-spells-table"><thead><tr>'
      + '<th class="dm-spells-name-col">Spell</th>'
      + players.map(p => `<th title="${escapeHtml(p.cls)}">${escapeHtml(p.name)}</th>`).join('')
      + '</tr></thead><tbody>';

    levels.forEach(l => {
      html += `<tr class="dm-spells-group"><td colspan="${colCount}">${lvlLabel(l)}</td></tr>`;
      byLevel[l].forEach(rec => {
        const count = rec.byPlayer.size;
        const overlapClass = count >= 3 ? 'dm-overlap-3' : (count === 2 ? 'dm-overlap-2' : '');
        html += `<tr class="${overlapClass}">`;
        html += `<td class="dm-spells-name-col">${escapeHtml(rec.name)}${count > 1 ? ` <span class="dm-spells-count">×${count}</span>` : ''}</td>`;
        players.forEach((p, i) => {
          html += `<td class="dm-spells-cell">${rec.byPlayer.has(i) ? '<span class="dm-spells-yes">●</span>' : ''}</td>`;
        });
        html += '</tr>';
      });
    });

    html += '</tbody></table>';
    wrap.innerHTML = html;
    if (legend) legend.style.display = 'flex';

  } catch (e) {
    console.error('dmLoadPlayerSpells failed:', e);
    wrap.innerHTML = `<p class="dm-empty-state">${escapeHtml(friendlyFirebaseError(e))}</p>`;
    if (legend) legend.style.display = 'none';
  }
}
window.dmLoadPlayerSpells = dmLoadPlayerSpells;

async function dmViewPlayerCharacter(uid, charId) {
  const db = window.db;
  if (!db) return;
  try {
    const doc = await db.collection('userData').doc(uid).collection('characters').doc(charId).get();
    if (!doc.exists) return;
    const d = doc.data() || {};
    const info = d?.data?.characterInfo || {};
    const p1 = d?.data?.page1 || {};
    const savedAt = (() => {
      const ts = d.updatedAt;
      if (!ts) return '';
      try {
        const dt = (typeof ts.toDate === 'function') ? ts.toDate() : new Date(ts);
        return 'Last saved ' + dt.toLocaleString();
      } catch (_) { return ''; }
    })();

    // Build a read-only summary popup
    const panel = document.getElementById('dmPlayerSheetPanel');
    const body = document.getElementById('dmPlayerSheetBody');
    if (!panel || !body) return;

    const abilities = ['str','dex','con','int','wis','cha'];
    const abilityRows = abilities.map(ab => {
      const score = p1.abilities?.[ab] || '—';
      const bonus = p1.abilities?.[`${ab}_bonus`] || '—';
      return `<div class="dm-sb-ability"><div class="dm-sb-ab-name">${ab.toUpperCase()}</div><div class="dm-sb-ab-score">${score}<br><span style="font-size:0.8em;opacity:0.6;">${bonus}</span></div></div>`;
    }).join('');

    body.innerHTML = `
      <div class="dm-player-sheet">
        <div class="dm-player-sheet-header">
          <h3>${escapeHtml(info.name || 'Unnamed')}</h3>
          <p>${[info.race, info.class, info.subclass, info.level ? 'Level ' + info.level : ''].filter(Boolean).join(' · ')}</p>
          <p style="opacity:0.45;font-size:0.8em;">${escapeHtml(info.background || '')}</p>
          ${savedAt ? `<p style="opacity:0.5;font-size:0.75em;margin-top:4px;">${escapeHtml(savedAt)}</p>` : ''}
        </div>
        <div class="dm-sb-abilities" style="margin:14px 0;">${abilityRows}</div>
        <div class="dm-player-sheet-stats">
          <div class="dm-stat-row"><span class="dm-stat-label">AC</span><span class="dm-stat-value">${p1.combatStats?.ac || '—'}</span></div>
          <div class="dm-stat-row"><span class="dm-stat-label">HP</span><span class="dm-stat-value">${p1.health?.currentHp || '—'} / ${p1.health?.maxHp || '—'}</span></div>
          <div class="dm-stat-row"><span class="dm-stat-label">Speed</span><span class="dm-stat-value">${p1.combatStats?.speed || '—'}</span></div>
          <div class="dm-stat-row"><span class="dm-stat-label">Initiative</span><span class="dm-stat-value">${p1.combatStats?.initiative || '—'}</span></div>
          <div class="dm-stat-row"><span class="dm-stat-label">Passive Perception</span><span class="dm-stat-value">${p1.combatStats?.passive_perception || '—'}</span></div>
          <div class="dm-stat-row"><span class="dm-stat-label">Prof Bonus</span><span class="dm-stat-value">${p1.combatStats?.prof_bonus || '—'}</span></div>
        </div>
      </div>
    `;
    panel.style.display = 'block';
    panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  } catch (e) {
    console.error('dmViewPlayerCharacter failed:', e);
  }
}

window.dmViewPlayerCharacter = dmViewPlayerCharacter;

window.dmRollNpcName = dmRollNpcName;
window.dmGenerateNpc = dmGenerateNpc;
window.dmRerollNpc = dmRerollNpc;
window.dmRerollField = dmRerollField;
window.dmEditNpc = dmEditNpc;
window.dmCancelEditNpc = dmCancelEditNpc;
window.dmRollLoot = dmRollLoot;
window.dmSaveNpc = dmSaveNpc;
window.dmDeleteNpc = dmDeleteNpc;
window.dmClearAllNpcs = dmClearAllNpcs;
window.dmLoadPlayers = dmLoadPlayers;

async function dmChangeCampaignPassword() {
  const session = dmSessionLoad();
  if (!session?.campaignName) return;
  const db = window.db;
  if (!db) return;

  const newPw = await dmModal({
    title: 'Player Join Password',
    message: `Set a new join password for "${session.campaignName}". Leave blank to remove it.`,
    input: true,
    inputType: 'password',
    placeholder: 'New join password',
    confirmText: 'Save'
  });
  if (newPw === null) return; // cancelled

  try {
    const snap = await db.collection('campaigns').where('name', '==', session.campaignName).limit(1).get();
    if (snap.empty) { dmToast('Campaign not found.', 'error'); return; }
    const docRef = snap.docs[0].ref;
    if (newPw.trim() === '') {
      await docRef.update({ passwordHash: '' });
      dmToast('Join password removed.', 'success');
    } else {
      const hash = await sha256Hex(newPw.trim());
      await docRef.update({ passwordHash: hash });
      dmToast('Join password updated.', 'success');
    }
  } catch (e) {
    dmToast(friendlyFirebaseError(e), 'error');
  }
}
window.dmChangeCampaignPassword = dmChangeCampaignPassword;

// ─── Auth hook ─────────────────────────────────────────────────────────────

window.renderDmCard = renderDmCard;

window.onDmAuthStateChanged = async function() {
  await renderDmCard();
};
