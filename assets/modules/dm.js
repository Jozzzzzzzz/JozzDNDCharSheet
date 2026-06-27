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
    return '🔒 You don\'t have access to this. If you just set up a campaign, make sure the security rules are deployed.';
  }
  if (code === 'unavailable' || low.includes('offline') || low.includes('network')) {
    return '📡 Can\'t reach the cloud right now — check your internet connection and try again.';
  }
  if (code === 'unauthenticated' || low.includes('unauthenticated')) {
    return '👤 You\'re signed out. Sign in again and retry.';
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
        <span class="dm-granted-icon">⚔️</span>
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
}

function switchDmTabById(id) {
  const btn = document.querySelector(`.dm-tab[data-dm-tab="${id}"]`);
  if (btn) switchDmTab(btn);
}

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
  body.innerHTML = `
    <div class="dm-stat-block">
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
      ${m.legendary_actions?.length ? `<div class="dm-sb-divider"></div><h4>Legendary Actions</h4>${m.legendary_actions.map(a => `<div class="dm-sb-trait"><strong>${escapeHtml(a.name)}.</strong> ${escapeHtml(a.desc)}</div>`).join('')}` : ''}
    </div>
    <button class="dm-action-btn" style="margin-top:12px;" onclick="dmAddMonsterToEncounter('${escapeHtml(m.name)}', ${m.hit_points ?? 10}, ${m.armor_class ?? 10})">Add to Encounter</button>
  `;
  detail.style.display = 'block';
  detail.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
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

// ─── Encounters ────────────────────────────────────────────────────────────

let dmCombatants = [];

function dmAddCombatant() {
  const name = (document.getElementById('dmCombatantName')?.value || '').trim();
  const hp = parseInt(document.getElementById('dmCombatantHp')?.value || '0', 10);
  const ac = parseInt(document.getElementById('dmCombatantAc')?.value || '10', 10);
  const count = parseInt(document.getElementById('dmCombatantCount')?.value || '1', 10);
  if (!name || hp < 1) return;

  for (let i = 0; i < Math.max(1, count); i++) {
    const label = count > 1 ? `${name} ${i + 1}` : name;
    dmCombatants.push({ id: Date.now() + i, name: label, maxHp: hp, hp, ac, initiative: 0 });
  }
  document.getElementById('dmCombatantName').value = '';
  document.getElementById('dmCombatantHp').value = '';
  document.getElementById('dmCombatantAc').value = '';
  document.getElementById('dmCombatantCount').value = '1';
  dmRenderCombatants();
}

function dmAddMonsterToEncounter(name, hp, ac) {
  dmCombatants.push({ id: Date.now(), name, maxHp: hp, hp, ac, initiative: 0 });
  dmRenderCombatants();
  switchDmTabById('dm-encounters');
}

function dmRenderCombatants() {
  const list = document.getElementById('dmCombatantList');
  if (!list) return;
  if (!dmCombatants.length) { list.innerHTML = '<p class="dm-empty-state">No combatants yet.</p>'; return; }

  list.innerHTML = dmCombatants.map(c => `
    <div class="dm-combatant-row" id="dmC_${c.id}">
      <div class="dm-combatant-init">
        <label>Init</label>
        <input type="number" value="${c.initiative}" style="width:52px;" onchange="dmSetInit(${c.id}, this.value)">
      </div>
      <div class="dm-combatant-info">
        <span class="dm-combatant-name">${escapeHtml(c.name)}</span>
        <span class="dm-combatant-ac">AC ${c.ac}</span>
      </div>
      <div class="dm-combatant-hp">
        <button class="dm-hp-btn" onclick="dmDamage(${c.id})">−</button>
        <span class="dm-hp-display ${c.hp <= 0 ? 'dm-hp-dead' : c.hp <= c.maxHp * 0.25 ? 'dm-hp-low' : ''}">${c.hp}/${c.maxHp}</span>
        <button class="dm-hp-btn" onclick="dmHeal(${c.id})">+</button>
      </div>
      <button class="dm-icon-btn dm-remove-btn" onclick="dmRemoveCombatant(${c.id})" title="Remove">✕</button>
    </div>
  `).join('');
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
}

function dmClearEncounter() {
  dmCombatants = [];
  dmRenderCombatants();
  const n = document.getElementById('dmEncounterName');
  if (n) n.value = '';
}

function dmSaveEncounter() {
  const name = (document.getElementById('dmEncounterName')?.value || '').trim() || 'Unnamed Encounter';
  if (!dmCombatants.length) return;
  const saved = dmGetSavedEncounters();
  saved.push({ id: Date.now(), name, combatants: JSON.parse(JSON.stringify(dmCombatants)) });
  localStorage.setItem('dndDmEncounters', JSON.stringify(saved));
  dmRenderSavedEncounters();
}

function dmGetSavedEncounters() {
  try { return JSON.parse(localStorage.getItem('dndDmEncounters') || '[]'); } catch { return []; }
}

function dmRenderSavedEncounters() {
  const list = document.getElementById('dmSavedEncounterList');
  if (!list) return;
  const saved = dmGetSavedEncounters();
  if (!saved.length) { list.innerHTML = '<p class="dm-empty-state">No saved encounters.</p>'; return; }
  list.innerHTML = saved.map(e => `
    <div class="dm-saved-encounter-row">
      <span class="dm-saved-encounter-name">${escapeHtml(e.name)}</span>
      <span class="dm-saved-encounter-count">${e.combatants.length} combatants</span>
      <button class="dm-action-btn" onclick="dmLoadEncounter(${e.id})">Load</button>
      <button class="dm-icon-btn dm-remove-btn" onclick="dmDeleteEncounter(${e.id})">✕</button>
    </div>
  `).join('');
}

function dmLoadEncounter(id) {
  const enc = dmGetSavedEncounters().find(e => e.id === id);
  if (!enc) return;
  dmCombatants = enc.combatants.map(c => ({ ...c, hp: c.maxHp }));
  const n = document.getElementById('dmEncounterName');
  if (n) n.value = enc.name;
  dmRenderCombatants();
}

function dmDeleteEncounter(id) {
  const saved = dmGetSavedEncounters().filter(e => e.id !== id);
  localStorage.setItem('dndDmEncounters', JSON.stringify(saved));
  dmRenderSavedEncounters();
}

window.dmAddCombatant = dmAddCombatant;
window.dmAddMonsterToEncounter = dmAddMonsterToEncounter;
window.dmDamage = dmDamage;
window.dmHeal = dmHeal;
window.dmSetInit = dmSetInit;
window.dmRemoveCombatant = dmRemoveCombatant;
window.dmClearEncounter = dmClearEncounter;
window.dmSaveEncounter = dmSaveEncounter;
window.dmLoadEncounter = dmLoadEncounter;
window.dmDeleteEncounter = dmDeleteEncounter;

// ─── NPC Generator ────────────────────────────────────────────────────────

const DM_NPC_NAMES = {
  male: ['Aldric','Bram','Cael','Dorin','Edran','Fyren','Gorath','Hadwin','Ivanos','Jorik','Kael','Lyren','Mordis','Navan','Oswin','Pell','Quarr','Riven','Soren','Tharyn','Ulric','Varen','Westan','Xander','Yoren','Zephyr'],
  female: ['Aela','Bryn','Calla','Dara','Elara','Fyra','Gwyn','Hana','Idris','Jora','Kira','Lyra','Mira','Nyla','Orina','Petra','Quill','Riva','Syla','Thea','Una','Vera','Wren','Xyla','Yara','Zara'],
  surname: ['Ashvale','Blackthorn','Coldwell','Draven','Emberton','Flint','Greymantle','Holloway','Ironwood','Jostle','Keswick','Lanford','Morren','Northgate','Orn','Pinehurst','Quillon','Ravenmoor','Stonefield','Tallow','Underhill','Voss','Whitlock','Xander','Yarrow','Zurn']
};

const DM_NPC_TRAITS = ['Speaks in riddles','Constantly chews something','Never makes eye contact','Laughs at inappropriate times','Obsessively tidy','Fidgets with a trinket','Uses archaic phrases','Excessively formal','Paranoid, checks exits','Tells bad jokes','Whispers everything','Extremely blunt'];
const DM_NPC_SECRETS = ['Owes money to a thieves guild','Has a bounty in another city','Is actually a noble in disguise','Witnessed a murder but said nothing','Selling information to both sides','Has a forbidden magical ability'];

function dmRollNpcName() {
  const isFemale = Math.random() > 0.5;
  const pool = isFemale ? DM_NPC_NAMES.female : DM_NPC_NAMES.male;
  const first = pool[Math.floor(Math.random() * pool.length)];
  const last = DM_NPC_NAMES.surname[Math.floor(Math.random() * DM_NPC_NAMES.surname.length)];
  const el = document.getElementById('dmNpcName');
  if (el) el.value = `${first} ${last}`;
}

function dmGenerateNpc() {
  dmRollNpcName();
  const races = ['Human','Human','Human','Elf','Dwarf','Halfling','Gnome','Half-Elf','Tiefling'];
  const roles = ['Commoner','Guard','Merchant','Innkeeper','Bandit','Noble','Mage','Priest'];
  const alignments = ['Lawful Good','Neutral Good','Chaotic Good','Lawful Neutral','True Neutral','Chaotic Neutral','Lawful Evil','Neutral Evil','Chaotic Evil'];

  const raceEl = document.getElementById('dmNpcRace');
  const roleEl = document.getElementById('dmNpcRole');
  const alignEl = document.getElementById('dmNpcAlignment');

  if (raceEl && !raceEl.value) raceEl.value = races[Math.floor(Math.random() * races.length)];
  if (roleEl && !roleEl.value) roleEl.value = roles[Math.floor(Math.random() * roles.length)];
  if (alignEl && !alignEl.value) alignEl.value = alignments[Math.floor(Math.random() * alignments.length)];

  const trait = DM_NPC_TRAITS[Math.floor(Math.random() * DM_NPC_TRAITS.length)];
  const secret = Math.random() > 0.5 ? DM_NPC_SECRETS[Math.floor(Math.random() * DM_NPC_SECRETS.length)] : null;
  const notesEl = document.getElementById('dmNpcNotes');
  if (notesEl) notesEl.value = `Trait: ${trait}` + (secret ? `\nSecret: ${secret}` : '');
}

function dmRollLoot() {
  const roll = Math.random();
  let loot = '';
  if (roll < 0.35) {
    // Scraps
    const gp = Math.floor(Math.random() * 5);
    const sp = Math.floor(Math.random() * 10);
    const cp = Math.floor(Math.random() * 20);
    const scraps = ['a torn piece of cloth','a bone whistle','a bent copper ring','a smudged letter','a half-eaten ration','a small smooth stone','a cracked leather belt','nothing of value'];
    loot = `${gp}gp, ${sp}sp, ${cp}cp · ${scraps[Math.floor(Math.random() * scraps.length)]}`;
  } else if (roll < 0.7) {
    // Low-level loot
    const gp = Math.floor(Math.random() * 20) + 5;
    const items = ['a vial of antitoxin','a potion of healing','a set of thieves tools','a hand-drawn map','a silver locket (worth 5gp)','a pouch of caltrops','a jar of alchemist\'s fire','a bag of 10 candles and flint'];
    loot = `${gp}gp · ${items[Math.floor(Math.random() * items.length)]}`;
  } else {
    // Gold + gem
    const gp = Math.floor(Math.random() * 60) + 20;
    const gems = ['a small amethyst (10gp)','a piece of malachite (5gp)','a star ruby (50gp)','a blue quartz (10gp)','a garnet (25gp)'];
    loot = `${gp}gp · ${gems[Math.floor(Math.random() * gems.length)]}`;
  }
  const el = document.getElementById('dmNpcLootResult');
  if (el) { el.textContent = loot; el.classList.remove('dm-empty-state'); }
}

function dmSaveNpc() {
  const name = (document.getElementById('dmNpcName')?.value || '').trim() || 'Unnamed NPC';
  const race = document.getElementById('dmNpcRace')?.value || '';
  const role = document.getElementById('dmNpcRole')?.value || '';
  const alignment = document.getElementById('dmNpcAlignment')?.value || '';
  const notes = (document.getElementById('dmNpcNotes')?.value || '').trim();
  const loot = document.getElementById('dmNpcLootResult')?.textContent || '';

  const saved = dmGetSavedNpcs();
  saved.push({ id: Date.now(), name, race, role, alignment, notes, loot });
  localStorage.setItem('dndDmNpcs', JSON.stringify(saved));
  dmRenderNpcList();

  // Clear form
  ['dmNpcName','dmNpcNotes'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
  ['dmNpcRace','dmNpcRole','dmNpcAlignment'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
  const lootEl = document.getElementById('dmNpcLootResult');
  if (lootEl) { lootEl.textContent = 'Hit "Roll Loot" to generate a loot drop.'; lootEl.classList.add('dm-empty-state'); }
}

function dmGetSavedNpcs() {
  try { return JSON.parse(localStorage.getItem('dndDmNpcs') || '[]'); } catch { return []; }
}

function dmRenderNpcList() {
  const list = document.getElementById('dmNpcList');
  if (!list) return;
  const npcs = dmGetSavedNpcs();
  if (!npcs.length) { list.innerHTML = '<p class="dm-empty-state">No saved NPCs yet.</p>'; return; }
  list.innerHTML = npcs.map(n => `
    <div class="dm-npc-row">
      <div class="dm-npc-info">
        <span class="dm-npc-name">${escapeHtml(n.name)}</span>
        <span class="dm-npc-meta">${[n.race, n.role, n.alignment].filter(Boolean).join(' · ')}</span>
        ${n.notes ? `<span class="dm-npc-notes">${escapeHtml(n.notes)}</span>` : ''}
        ${n.loot && !n.loot.includes('Roll Loot') ? `<span class="dm-npc-loot">Loot: ${escapeHtml(n.loot)}</span>` : ''}
      </div>
      <button class="dm-icon-btn dm-remove-btn" onclick="dmDeleteNpc(${n.id})" title="Remove">✕</button>
    </div>
  `).join('');
}

function dmDeleteNpc(id) {
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
          <button class="dm-action-btn dm-danger-btn" onclick="dmRemovePlayer('${c.uid}','${escapeHtml(c.name)}',this)">Remove</button>
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
async function dmRemovePlayer(uid, name, btn) {
  // Two-step confirm
  if (!_dmRemoveState[uid]) {
    _dmRemoveState[uid] = true;
    if (btn) { btn.textContent = 'Sure?'; }
    setTimeout(() => { _dmRemoveState[uid] = false; if (btn) btn.textContent = 'Remove'; }, 4000);
    return;
  }
  _dmRemoveState[uid] = false;
  const db = window.db;
  const campaignId = dmCurrentCampaignId();
  if (!db || !campaignId) return;
  if (btn) { btn.disabled = true; btn.textContent = 'Removing…'; }
  try {
    // Delete the member doc — the roster reads members, so the player is gone
    // immediately regardless of whether they're online. Their own app clears its
    // campaign indicator on next load when it sees no member doc.
    await db.collection('campaigns').doc(campaignId)
      .collection('members').doc(uid).delete();
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
          const name = (sp && sp.name ? String(sp.name) : '').trim();
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
      wrap.innerHTML = '<p class="dm-empty-state">Linked characters have no spells recorded yet.</p>';
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
          ${savedAt ? `<p style="opacity:0.5;font-size:0.75em;margin-top:4px;">🕒 ${escapeHtml(savedAt)}</p>` : ''}
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
