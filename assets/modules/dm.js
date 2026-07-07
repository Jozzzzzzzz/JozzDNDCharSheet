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
          <button class="dm-action-btn dm-modal-cancel">${escapeHtml(o.cancelText || 'Cancel')}</button>
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

    backdrop.querySelector('.dm-modal-cancel').onclick = () => close(null);
    backdrop.querySelector('.dm-modal-confirm').onclick = () =>
      close(wantsInput ? (input ? input.value : '') : true);
    backdrop.onclick = (e) => { if (e.target === backdrop) close(null); };
    backdrop.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') close(null);
      if (e.key === 'Enter' && wantsInput) { e.preventDefault(); close(input ? input.value : ''); }
    });
  });
}

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

async function dmLoadMonsters() {
  const note = document.getElementById('dmMonstersNote');
  const list = document.getElementById('dmMonstersList');
  if (note) note.textContent = 'Loading from Open5e...';
  if (list) list.innerHTML = '';

  try {
    let results = [];
    let url = 'https://api.open5e.com/v1/monsters/?limit=100&document__slug=wotc-srd';
    while (url) {
      const res = await fetch(url);
      const data = await res.json();
      results = results.concat(data.results || []);
      url = data.next || null;
    }
    dmAllMonsters = results;
    if (note) note.textContent = `Loaded ${results.length} monsters from Open5e SRD.`;
    dmRenderMonsterList(results);
  } catch (e) {
    if (note) note.textContent = 'Failed to load monsters. Check your internet connection.';
    console.error('Monster load failed:', e);
  }
}

function dmFilterMonsters() {
  const q = (document.getElementById('dmMonsterSearch')?.value || '').toLowerCase();
  const cr = document.getElementById('dmMonsterCrFilter')?.value || '';
  let filtered = dmAllMonsters;
  if (q) filtered = filtered.filter(m => m.name.toLowerCase().includes(q) || (m.type || '').toLowerCase().includes(q));
  if (cr !== '') filtered = filtered.filter(m => String(m.challenge_rating) === cr);
  dmRenderMonsterList(filtered);
}

function dmRenderMonsterList(monsters) {
  const list = document.getElementById('dmMonstersList');
  if (!list) return;
  if (!monsters.length) { list.innerHTML = '<p class="dm-empty-state">No monsters match.</p>'; return; }

  list.innerHTML = monsters.map(m => `
    <div class="dm-monster-row" onclick="dmShowMonster('${escapeHtml(m.slug)}')">
      <span class="dm-monster-name">${escapeHtml(m.name)}</span>
      <span class="dm-monster-meta">${escapeHtml(m.type || '')} · CR ${m.challenge_rating ?? '?'} · HP ${m.hit_points ?? '?'} · AC ${m.armor_class ?? '?'}</span>
    </div>
  `).join('');
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
  body.innerHTML = dmRenderStatBlockHtml(m) +
    `<button class="dm-action-btn" style="margin-top:12px;" onclick="dmAddMonsterToEncounter('${escapeHtml(m.slug || '')}')">Add to Encounter</button>`;
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
window.dmFilterMonsters = dmFilterMonsters;
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

async function dmLoadItems(force) {
  if (dmAllItems.length && !force) { dmFilterItems(); return; }
  const note = document.getElementById('dmItemsNote');
  if (note) note.textContent = 'Loading the full item archive from Open5e…';

  try {
    const [magic, weapons, armor] = await Promise.all([
      dmFetchAll('https://api.open5e.com/v1/magicitems/?limit=100'),
      dmFetchAll('https://api.open5e.com/v1/weapons/?limit=100'),
      dmFetchAll('https://api.open5e.com/v1/armor/?limit=100')
    ]);

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
    dmFilterItems();
  } catch (e) {
    if (note) note.textContent = 'Failed to load items. Check your internet connection, then hit Reload.';
    console.error('Item load failed:', e);
  }
}

function dmFilterItems() {
  const q = (document.getElementById('dmItemSearch')?.value || '').toLowerCase();
  const rarity = (document.getElementById('dmItemRarityFilter')?.value || '').toLowerCase();
  const cat = document.getElementById('dmItemTypeFilter')?.value || '';
  let filtered = dmAllItems;
  if (cat) filtered = filtered.filter(it => it.category === cat);
  if (rarity) filtered = filtered.filter(it => (it.rarity || '').toLowerCase() === rarity);
  if (q) filtered = filtered.filter(it =>
    it.name.toLowerCase().includes(q) || (it.type || '').toLowerCase().includes(q));
  dmRenderItemList(filtered);

  const note = document.getElementById('dmItemsNote');
  if (note) note.textContent = dmAllItems.length
    ? `Showing ${filtered.length} of ${dmAllItems.length} items.`
    : '';
}

function dmRenderItemList(items) {
  const list = document.getElementById('dmItemsList');
  if (!list) return;
  if (!items.length) { list.innerHTML = '<p class="dm-empty-state">No items match your filters.</p>'; return; }

  // Map key → index so the row click can find the full record without globals.
  list.innerHTML = items.map((it, i) => `
    <div class="dm-monster-row" onclick="dmShowItem('${escapeHtml(it.key)}')">
      <span class="dm-monster-name">${escapeHtml(it.name)}</span>
      <span class="dm-monster-meta">${escapeHtml(it.category)} · ${escapeHtml(it.type)}${it.rarity && it.rarity !== 'mundane' ? ' · ' + escapeHtml(it.rarity) : ''}${it.attune && it.attune !== 'No' ? ' · attunement' : ''}</span>
    </div>
  `).join('');
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
window.dmFilterItems = dmFilterItems;
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
      <button class="dm-icon-btn dm-remove-btn" onclick="dmRemoveCombatant(${c.id})" title="Remove">✕</button>
      ${expanded && c.statBlock ? `<div class="dm-combatant-card">${dmRenderStatBlockHtml(c.statBlock)}</div>` : ''}
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
  bossMinions:   { label: 'Boss + Minions', types: [], keywords: [] } // special: one strong + several weak
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
  siege:       { label: 'Siege / Horde', desc: 'a relentless horde pressing a position' }
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
    // Tag wave / role foes so the DM can run the tactical shapes at a glance.
    if (p.wave) label += ` [Wave ${p.wave}]`;
    else if (p.role === 'front') label += ' [Front]';
    else if (p.role === 'back') label += ' [Back]';
    const c = {
      id: Date.now() + i, name: label, maxHp: p.hp, hp: p.hp, ac: p.ac,
      initiative: rnd(1, 20) + dmModNum(p.dex), cr: p.cr, xp: p.xp, isMonster: true,
      slug: p.slug || null, dex: (typeof p.dex === 'number') ? p.dex : null,
      statBlock: p.raw || null, wave: p.wave || null, role: p.role || null
    };
    dmCombatants.push(c);
    added.push(c);
  });

  dmRenderCombatants();
  dmUpdateDifficultyMeter();
  const r = dmRateEncounter(dmCombatants.filter(c => c.isMonster && c.xp > 0).map(c => c.xp));

  // Build + show the encounter card.
  dmBuildEncounterCard({ theme: themeKey, shape: effShape, difficulty, rating: r });

  // If the result didn't reach the tier you picked, the monster pool for this
  // theme + creature count simply can't hit that budget — say so plainly instead
  // of silently rating lower.
  const gotTier = DM_DIFFICULTY_TIERS.indexOf(r.cls);
  const wantTier = DM_DIFFICULTY_TIERS.indexOf(difficulty);
  if (gotTier < wantTier) {
    setStatus(`Best fit: ${picks.length} creature${picks.length === 1 ? '' : 's'} rated ${r.label} (${r.adjusted.toLocaleString()} XP). This theme's monsters aren't strong enough to reach ${DM_DIFFICULTY_LABELS[difficulty]} at ${picks.length} creatures — try fewer creatures, a tougher theme, or the “Elite” shape.`, 'error');
  } else {
    setStatus(`Generated ${picks.length} creature${picks.length === 1 ? '' : 's'} — rated ${r.label} (${r.adjusted.toLocaleString()} XP).`, 'success');
  }
  switchDmTabById('dm-encounters');
  // Drop the DM into Build mode so the generated creatures show as the
  // draggable, click-to-expand combatant cards (the list lives in the build view).
  dmSetMode('encounter', 'build');
}

window.dmGenerateEncounter = dmGenerateEncounter;

// ─── Encounter card (intro / tips / initiative / notes) ────────────────────

// Intro openers keyed by theme — read-aloud-style "how it started".
const DM_ENCOUNTER_INTROS = {
  random:     ['As the party rounds a bend, the threat is suddenly upon them.','A noise — too late. They are not alone.','The air shifts, and danger steps into the open.'],
  bandits:    ['"That\'s far enough." Figures rise from cover, weapons drawn, blocking the road.','A whistle cuts the air — the ambush is sprung, blades flashing from the treeline.','"Coin or blood, travellers. Your choice." The cutthroats close in.'],
  goblinoids: ['Crude horns blare from the rocks above as the warband charges down.','Yellow eyes blink awake in the dark, and the chittering begins.','A rain of crude arrows announces the raiders before they even appear.'],
  beasts:     ['A low growl rolls through the brush — then the pack breaks cover, hungry.','The ground trembles. Whatever lives here has found the intruders.','Snapping branches, then teeth — the wild does not welcome trespassers.'],
  undead:     ['The cold deepens. Dead hands claw up through the earth.','A dirge of moans echoes as the restless dead shamble into the light.','The grave does not hold here. Something is rising.'],
  fiends:     ['The stench of brimstone arrives first, then the laughter from below.','Reality buckles as the fiends tear their way into the world.','Shadows lengthen, sprout claws, and lunge.'],
  casters:    ['A cold voice speaks a word of power, and the air ignites with magic.','Robed figures look up from their ritual — the intrusion will be punished.','"You should not have come." Arcane light gathers around their hands.'],
  fighters:   ['Steel rings against steel as the warriors form a line and advance.','"Hold the line!" The brutes lower their shoulders and charge.','Veterans, scarred and ready, move to cut off every escape.'],
  aberrations:['The angles of the room feel wrong, and then something that should not exist unfolds into view.','A pressure builds behind the eyes — whispers, promises, and then the horror reveals itself.','Reality thins like wet paper, and what waits on the other side reaches through.'],
  dragons:    ['A shadow swallows the sun; leathery wings beat once, and the reptilian eyes fix upon the party.','The heat arrives before the roar — scales the colour of old coins glinting in the dark.','"Little thieves." The voice is vast, amused, and utterly without mercy.'],
  giants:     ['The ground quakes with each footfall long before the giant crests the ridge.','A boulder arcs out of the sky — the first warning that something enormous has noticed them.','It has to stoop to see them, and it does not like what it sees.'],
  fey:        ['Laughter rings from nowhere and everywhere; the woodland has decided the party are trespassers.','Flowers turn to watch. A voice, sweet and cruel, offers a bargain no one asked for.','The path loops back on itself, and the fair folk step out of the crooked light.'],
  constructs: ['Stone grinds on stone as the sentinels wake, eyes lighting with cold purpose.','No breath, no fear — just the relentless clank of things built only to end intruders.','The guardians were told to let no one pass. They have never once failed.'],
  oozesVermin:['The floor glistens — and then flows, reaching hungrily toward the nearest boot.','A dry rustle becomes a tide of skittering legs pouring from every crack.','Something drips from the ceiling, hisses where it lands, and begins to spread.'],
  elementals: ['The air itself turns hostile — flame, frost, or howling wind given furious shape.','Raw elemental force tears loose from the world and rounds on the intruders.','The ground, the fire, the very wind rise up as one and attack.'],
  casterWarband:['A robed figure lifts a hand and the rabble at its back howls forward on command.','"Protect the ritual!" — and the warband throws itself between you and its master.','Spellfire gathers behind a wall of expendable bodies.'],
  huntPack:   ['They\'ve been tracking the party for miles. Now the circle closes and the hunt begins.','Low shapes fan out through the grass — this pack has done this many times before.','A single yip, answered from all sides. The ambush was set hours ago.'],
  bossMinions:['The lackeys part, and their master steps forward with a terrible smile.','"Kill them," the leader says, almost bored, as the minions surge ahead.','A commanding presence raises one hand — and the swarm obeys.']
};

// Shape-specific "how it starts" openers — layered on top of the theme intro.
const DM_SHAPE_INTROS = {
  ambush:     ['No warning — the first the party knows of it is the strike from concealment.','Every escape route is already covered before a single blade is drawn.'],
  gauntlet:   ['This is only the first wave. More are already moving up behind.','The foes come in relays, each rush buying time for the next to form.'],
  vanguard:   ['A wall of shields locks together while shapes behind it raise bows and staves.','The front rank braces to hold you in place — the danger is what stands behind them.'],
  twinThreat: ['Two of them, moving in practised concert — this is a partnership, not a mob.','They split to flank, each a threat in its own right, deadlier together.'],
  siege:      ['The horde does not stop coming. Hold the line or be overrun.','Wave upon wave, they press forward heedless of the fallen.'],
  duel:       ['One steps forward and points a blade: "You. Only you."','A rival singles out the party\'s champion — this is personal.']
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
    '• Decide in advance what happens if the party gangs up — the rival flees, calls reinforcements, or fights to a dramatic loss.'
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

    <label class="dm-enc-card-label">Intro — how it starts <span>(read aloud, editable)</span></label>
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
