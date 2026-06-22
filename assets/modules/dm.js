// DM Portal — access request, session management, and portal pages logic

// ─── Approved DMs ──────────────────────────────────────────────────────────
// Add a DM's email here to grant access. No Firestore change needed.
const DM_APPROVED_EMAILS = [
  // 'example@gmail.com',
];

// Emails that should never trigger DM request notifications (owner + test accounts)
const DM_NOTIFICATION_SUPPRESSED = [
  'vanreejoz33@gmail.com',
  'justbetterjozz@gmail.com',
];

// Cooldown: don't re-notify for the same email within 24 hours
const DM_NOTIFY_COOLDOWN_MS = 24 * 60 * 60 * 1000;

function dmShouldNotifyForRequest(email) {
  const key = `dndDmNotifySent_${String(email).toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
  if (DM_NOTIFICATION_SUPPRESSED.includes(String(email || '').toLowerCase())) return false;
  try {
    const last = parseInt(localStorage.getItem(key) || '0', 10);
    if (Date.now() - last < DM_NOTIFY_COOLDOWN_MS) return false;
    localStorage.setItem(key, String(Date.now()));
  } catch { /* ignore */ }
  return true;
}

function isDmApproved(email) {
  return DM_APPROVED_EMAILS.includes(String(email || '').toLowerCase().trim());
}

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

// ─── Auth / Request status ─────────────────────────────────────────────────

async function getDmRequestStatus(uid) {
  const db = window.db;
  if (!db || !uid) return null;
  try {
    const snap = await db.collection('dm_requests').doc(uid).get();
    if (!snap.exists) return null;
    return snap.data() || null;
  } catch (e) {
    console.error('DM request status check failed:', e);
    return null;
  }
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
      <p class="settings-note">Want to run campaigns as a Dungeon Master? Sign in with Google first, then submit a DM access request.</p>
      <button type="button" class="settings-action-btn accent-contrast-bg" onclick="signInWithGoogle()">Sign in with Google</button>
    `;
    return;
  }

  // Local approval check — no Firestore read needed for the gate
  if (isDmApproved(user.email)) {
    const session = dmSessionLoad();
    body.innerHTML = `
      <div class="dm-granted-banner">
        <span class="dm-granted-icon">⚔️</span>
        <div>
          <p class="dm-granted-title">DM Portal Access Granted</p>
          <p class="settings-note">Welcome, ${escapeHtml(user.displayName || user.email)}.</p>
        </div>
      </div>
      <button type="button" class="settings-action-btn dm-enter-btn accent-contrast-bg" onclick="enterDmPortal()">Enter DM Screen →</button>
    `;
    return;
  }

  // Check if they already submitted a request (purely for UX — shows pending state)
  const status = await getDmRequestStatus(user.uid);

  if (status && status.status === 'pending') {
    body.innerHTML = `
      <div class="dm-pending-banner">
        <p class="dm-pending-title">Request Submitted ⏳</p>
        <p class="settings-note">Your DM access request for <strong>${escapeHtml(status.campaignName || 'your campaign')}</strong> is under review. Contact <strong>Jozsua</strong> to follow up.</p>
      </div>
      <button type="button" class="settings-action-btn dm-enter-btn" style="margin-top:10px;opacity:0.7;" onclick="enterDmPortal()">Enter DM Screen (Pending Mode)</button>
    `;
    return;
  }

  body.innerHTML = dmRequestFormHtml(user);
}

function dmRequestFormHtml(user) {
  return `
    <p class="settings-note">Signed in as <strong>${escapeHtml(user.displayName || '')} (${escapeHtml(user.email)})</strong>. Fill in your campaign details to request DM access.</p>
    <div class="dm-request-form">
      <div class="settings-field">
        <label for="dmCampaignName">Campaign Name</label>
        <input type="text" id="dmCampaignName" placeholder="e.g. The Lost Mines of Phandelver" maxlength="100">
      </div>
      <div class="settings-field">
        <label for="dmCampaignSetting">Campaign Setting</label>
        <select id="dmCampaignSetting">
          <option value="">Choose a setting...</option>
          <option value="Forgotten Realms">Forgotten Realms</option>
          <option value="Homebrew">Homebrew World</option>
          <option value="Eberron">Eberron</option>
          <option value="Ravenloft">Ravenloft</option>
          <option value="Wildemount">Wildemount</option>
          <option value="Spelljammer">Spelljammer</option>
          <option value="Other">Other</option>
        </select>
      </div>
      <div class="settings-field">
        <label for="dmPlayerCount">Approx. Player Count</label>
        <input type="number" id="dmPlayerCount" min="1" max="10" placeholder="e.g. 4">
      </div>
      <div class="settings-field">
        <label for="dmNotes">Notes (optional)</label>
        <textarea id="dmNotes" placeholder="Anything about your campaign or group..." rows="3" maxlength="500"></textarea>
      </div>
      <button type="button" class="settings-action-btn accent-contrast-bg" onclick="submitDmRequest()">Submit DM Access Request</button>
      <div id="dmRequestStatus" class="status-message"></div>
    </div>
  `;
}

function setDmStatus(msg, type) {
  const el = document.getElementById('dmRequestStatus');
  if (!el) return;
  el.textContent = msg;
  el.className = `status-message ${type || 'info'}`;
  el.style.display = 'block';
  if (type !== 'error') setTimeout(() => { el.style.display = 'none'; }, 6000);
}

async function submitDmRequest() {
  const user = window.currentUser;
  if (!user) { setDmStatus('Please sign in first.', 'error'); return; }

  const campaignName = (document.getElementById('dmCampaignName')?.value || '').trim();
  const campaignSetting = document.getElementById('dmCampaignSetting')?.value || '';
  const playerCount = parseInt(document.getElementById('dmPlayerCount')?.value || '0', 10);
  const notes = (document.getElementById('dmNotes')?.value || '').trim();

  if (!campaignName) { setDmStatus('Please enter a campaign name.', 'error'); return; }
  if (!campaignSetting) { setDmStatus('Please choose a campaign setting.', 'error'); return; }
  if (!playerCount || playerCount < 1) { setDmStatus('Please enter a player count.', 'error'); return; }

  const db = window.db;
  if (!db) { setDmStatus('Not connected. Try again in a moment.', 'error'); return; }

  try {
    await db.collection('dm_requests').doc(user.uid).set({
      uid: user.uid,
      email: user.email,
      displayName: user.displayName || '',
      campaignName,
      campaignSetting,
      playerCount,
      notes,
      status: 'pending',
      submittedAt: firebase.firestore.FieldValue.serverTimestamp(),
      reviewedAt: null
    });

    if (typeof sendOwnerNotification === 'function' && dmShouldNotifyForRequest(user.email)) {
      const emailBody =
        `New DM Access Request\n` +
        `${'─'.repeat(40)}\n` +
        `Name:     ${user.displayName || '(no display name)'}\n` +
        `Email:    ${user.email}\n` +
        `${'─'.repeat(40)}\n` +
        `Campaign: ${campaignName}\n` +
        `Setting:  ${campaignSetting}\n` +
        `Players:  ${playerCount}\n` +
        `Notes:    ${notes || '(none)'}\n` +
        `${'─'.repeat(40)}\n` +
        `To approve: open assets/modules/dm.js and add\n` +
        `  '${user.email}'\n` +
        `to the DM_APPROVED_EMAILS array, then push.\n` +
        `The user is currently in PENDING mode.`;
      sendOwnerNotification('DM Access Request — ' + (user.displayName || user.email), emailBody, { type: 'dm_request' });
    }

    await renderDmCard();
  } catch (e) {
    console.error('DM request submit failed:', e);
    if (e && e.code === 'permission-denied') {
      setDmStatus('Permission denied — Firestore rules need a dm_requests rule. Check console.', 'error');
    } else {
      setDmStatus('Error: ' + (e?.message || 'unknown'), 'error');
    }
  }
}

window.submitDmRequest = submitDmRequest;

// ─── Portal enter / exit ───────────────────────────────────────────────────

async function enterDmPortal() {
  const user = window.currentUser;
  if (!user) return;

  // If no valid session, check they at least submitted a request (pending or approved)
  if (!dmSessionValid()) {
    const status = await getDmRequestStatus(user.uid).catch(() => null);
    const hasPendingOrApproved = isDmApproved(user.email) || (status && (status.status === 'pending' || status.status === 'approved'));
    if (!hasPendingOrApproved) {
      alert('Please submit a DM access request first.');
      return;
    }
    dmSessionSave({ uid: user.uid, email: user.email, campaignName: status?.campaignName || '', campaignSetting: status?.campaignSetting || '' });
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

  // Show pending banner if email not yet in approved list
  const pendingBanner = document.getElementById('dmPendingBanner');
  if (pendingBanner) pendingBanner.style.display = isDmApproved(user.email) ? 'none' : 'block';

  // Populate banner
  const label = document.getElementById('dmScreenCampaignLabel');
  if (label) label.textContent = session?.campaignName || '';

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

function dmDamage(id) {
  const amt = parseInt(prompt('Damage amount:') || '0', 10);
  if (!amt) return;
  const c = dmCombatants.find(x => x.id === id);
  if (c) { c.hp = Math.max(0, c.hp - amt); dmRenderCombatants(); }
}

function dmHeal(id) {
  const amt = parseInt(prompt('Heal amount:') || '0', 10);
  if (!amt) return;
  const c = dmCombatants.find(x => x.id === id);
  if (c) { c.hp = Math.min(c.maxHp, c.hp + amt); dmRenderCombatants(); }
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

function dmClearAllNpcs() {
  if (!confirm('Clear all saved NPCs?')) return;
  localStorage.removeItem('dndDmNpcs');
  dmRenderNpcList();
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

  list.innerHTML = '<p class="dm-empty-state">Loading players...</p>';

  try {
    // Query all characters subcollection docs where campaignId matches
    const snap = await db.collectionGroup('characters')
      .where('data.characterInfo.campaignId', '==', campaignName)
      .get();

    if (snap.empty) {
      list.innerHTML = `<p class="dm-empty-state">No characters linked to "<strong>${escapeHtml(campaignName)}</strong>" yet. Players need to enter this exact campaign name in their Character Info → Campaign field.</p>`;
      return;
    }

    const cards = [];
    snap.forEach(doc => {
      const d = doc.data() || {};
      const info = d?.data?.characterInfo || {};
      cards.push({
        uid: doc.ref.parent.parent.id,
        charId: doc.id,
        name: info.name || 'Unnamed',
        race: info.race || '',
        cls: info.class || '',
        subclass: info.subclass || '',
        level: info.level || '',
        campaign: info.campaignId || '',
        updatedAt: d.updatedAt || null
      });
    });

    cards.sort((a, b) => a.name.localeCompare(b.name));

    list.innerHTML = cards.map(c => `
      <div class="dm-player-card">
        <div class="dm-player-info">
          <span class="dm-player-name">${escapeHtml(c.name)}</span>
          <span class="dm-player-meta">${[c.race, c.cls, c.subclass, c.level ? 'Lv ' + c.level : ''].filter(Boolean).join(' · ')}</span>
        </div>
        <button class="dm-action-btn" onclick="dmViewPlayerCharacter('${c.uid}','${c.charId}')">View Sheet</button>
      </div>
    `).join('');

  } catch (e) {
    console.error('dmLoadPlayers failed:', e);
    if (e.code === 'permission-denied') {
      list.innerHTML = '<p class="dm-empty-state">Permission denied — Firestore rules need a collectionGroup rule for <code>characters</code>. See CLAUDE.md.</p>';
    } else {
      list.innerHTML = `<p class="dm-empty-state">Error: ${escapeHtml(e.message)}</p>`;
    }
  }
}

async function dmViewPlayerCharacter(uid, charId) {
  const db = window.db;
  if (!db) return;
  try {
    const doc = await db.collection('userData').doc(uid).collection('characters').doc(charId).get();
    if (!doc.exists) return;
    const d = doc.data() || {};
    const info = d?.data?.characterInfo || {};
    const p1 = d?.data?.page1 || {};

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

  const statusEl = document.getElementById('dmCampaignPasswordStatus');
  const setStatus = (msg, ok) => {
    if (!statusEl) return;
    statusEl.textContent = msg;
    statusEl.style.color = ok ? '#6e6' : '#e66';
  };

  const newPw = prompt(`New player join password for "${session.campaignName}":\n(Leave blank to remove password)`);
  if (newPw === null) return; // cancelled

  try {
    const snap = await db.collection('campaigns').where('name', '==', session.campaignName).limit(1).get();
    if (snap.empty) { setStatus('Campaign not found.', false); return; }
    const docRef = snap.docs[0].ref;
    if (newPw.trim() === '') {
      await docRef.update({ passwordHash: '' });
      setStatus('Password removed.', true);
    } else {
      const hash = await sha256Hex(newPw.trim());
      await docRef.update({ passwordHash: hash });
      setStatus('Password updated.', true);
    }
    setTimeout(() => { if (statusEl) statusEl.textContent = ''; }, 3000);
  } catch (e) {
    setStatus('Error: ' + e.message, false);
  }
}
window.dmChangeCampaignPassword = dmChangeCampaignPassword;

// ─── Auth hook ─────────────────────────────────────────────────────────────

window.renderDmCard = renderDmCard;

window.onDmAuthStateChanged = async function() {
  await renderDmCard();
};
