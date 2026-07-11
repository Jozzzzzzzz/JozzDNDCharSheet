// Admin portal — owner-only user management and character import/preview via Firestore

async function sha256Hex(text) {
  const enc = new TextEncoder();
  const data = enc.encode(String(text || ''));
  const buf = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}
window.sha256Hex = sha256Hex;

function isOwnerAdminUser() {
  const email = String(window.currentUser?.email || '').toLowerCase();
  return email === 'vanreejoz33@gmail.com';
}

function switchAdminTab(btn) {
  document.querySelectorAll('.admin-tab').forEach(t => t.classList.remove('active'));
  btn.classList.add('active');
  document.querySelectorAll('.admin-tab-panel').forEach(p => { p.style.display = 'none'; });
  const panel = document.getElementById(btn.dataset.adminTab);
  if (panel) panel.style.display = 'block';
}
window.switchAdminTab = switchAdminTab;

window.updateAdminPortalVisibility = function updateAdminPortalVisibility() {
  const card = document.getElementById('adminPortalCard');
  if (!card) return;
  if (!isOwnerAdminUser()) {
    card.style.display = 'none';
    window.__adminPortalUnlocked = false;
    return;
  }
  card.style.display = 'block';
};

async function getAdminConfigDoc() {
  const db = window.db;
  if (!db) throw new Error('Firestore not ready');
  return db.collection('admin_config').doc('main');
}

function setAdminPortalStatus(message, type) {
  const el = document.getElementById('adminPortalStatus');
  if (!el) return;
  el.textContent = message;
  el.className = `status-message ${type || 'info'}`;
  el.style.display = 'block';
  setTimeout(() => { el.style.display = 'none'; }, 6000);
}

async function unlockAdminPortal() {
  if (!isOwnerAdminUser()) {
    setAdminPortalStatus('Not authorized.', 'error');
    return;
  }
  const pinInput = document.getElementById('adminPortalPin');
  const pin = pinInput ? pinInput.value : '';
  if (!pin || !pin.trim()) {
    setAdminPortalStatus('Enter your PIN.', 'error');
    return;
  }

  try {
    const configRef = await getAdminConfigDoc();
    const snap = await configRef.get();
    const data = snap.exists ? (snap.data() || {}) : {};
    const enteredHash = await sha256Hex(pin.trim());

    if (!data.portalPinHash) {
      const confirmPin = prompt('Admin PIN not set yet. Re-enter PIN to set it now:') || '';
      if (confirmPin.trim() !== pin.trim()) {
        setAdminPortalStatus('PINs did not match. Not set.', 'error');
        return;
      }
      await configRef.set({ portalPinHash: enteredHash, updatedAt: firebase.firestore.FieldValue.serverTimestamp() }, { merge: true });
      setAdminPortalStatus('Admin PIN set. Unlocking...', 'success');
    } else if (String(data.portalPinHash) !== enteredHash) {
      setAdminPortalStatus('Incorrect PIN.', 'error');
      return;
    }

    window.__adminPortalUnlocked = true;
    const locked = document.getElementById('adminLockedView');
    const unlocked = document.getElementById('adminUnlockedView');
    if (locked) locked.style.display = 'none';
    if (unlocked) unlocked.style.display = 'block';
    await Promise.all([adminRefreshUsers(), adminLoadCampaigns()]);
  } catch (e) {
    console.error(e);
    setAdminPortalStatus('Admin portal error. Check console.', 'error');
  }
}

window.unlockAdminPortal = unlockAdminPortal;

window.__adminUsers = [];
window.__adminUsersByUid = {};

function formatTs(ts) {
  try {
    if (!ts) return '';
    const d = typeof ts.toDate === 'function' ? ts.toDate() : new Date(ts);
    if (!d || Number.isNaN(d.getTime())) return '';
    return d.toLocaleString();
  } catch (_) { return ''; }
}

function isActiveNow(ts) {
  try {
    if (!ts) return false;
    const d = typeof ts.toDate === 'function' ? ts.toDate() : new Date(ts);
    return Date.now() - d.getTime() <= 2 * 60 * 1000;
  } catch (_) { return false; }
}

// Short relative time, e.g. "2m ago", "3d ago". Falls back to '' if unknown.
function timeAgo(ts) {
  try {
    if (!ts) return '';
    const d = typeof ts.toDate === 'function' ? ts.toDate() : new Date(ts);
    if (!d || Number.isNaN(d.getTime())) return '';
    const secs = Math.max(0, Math.floor((Date.now() - d.getTime()) / 1000));
    if (secs < 60) return 'just now';
    const mins = Math.floor(secs / 60);
    if (mins < 60) return mins + 'm ago';
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return hrs + 'h ago';
    const days = Math.floor(hrs / 24);
    if (days < 30) return days + 'd ago';
    const months = Math.floor(days / 30);
    if (months < 12) return months + 'mo ago';
    return Math.floor(months / 12) + 'y ago';
  } catch (_) { return ''; }
}

async function adminRefreshUsers() {
  if (!window.__adminPortalUnlocked) return;
  const db = window.db;
  if (!db) return;
  const grid = document.getElementById('adminUserGrid');
  if (!grid) return;

  const meta = document.getElementById('adminUserMeta');
  if (meta) meta.textContent = 'Loading users…';

  const [profilesSnap, signinsSnap] = await Promise.all([
    db.collection('userProfiles').get(),
    db.collection('auth_signins').get()
  ]);

  const byUid = {};
  profilesSnap.forEach(doc => {
    const data = doc.data() || {};
    byUid[doc.id] = { uid: doc.id, email: data.email || '', nickname: data.nickname || '' };
  });
  signinsSnap.forEach(doc => {
    const data = doc.data() || {};
    const u = byUid[doc.id] || { uid: doc.id, email: data.email || '', nickname: '' };
    u.lastSignInAt = data.lastSignInAt || null;
    u.lastSeenAt = data.lastSeenAt || null;
    u.knownDeviceCount = Number(data.knownDeviceCount) || 0;
    byUid[doc.id] = u;
  });

  const users = Object.values(byUid)
    .filter(u => (u.email || '').trim().length > 0)
    .sort((a, b) => {
      // Active users first, then by email
      const aActive = isActiveNow(a.lastSeenAt) ? 0 : 1;
      const bActive = isActiveNow(b.lastSeenAt) ? 0 : 1;
      if (aActive !== bActive) return aActive - bActive;
      return String(a.email).localeCompare(String(b.email));
    });

  window.__adminUsers = users;
  window.__adminUsersByUid = byUid;

  renderAdminUserGrid(users);

  if (meta) {
    const activeCount = users.filter(u => isActiveNow(u.lastSeenAt)).length;
    meta.textContent = `${users.length} user${users.length === 1 ? '' : 's'}` +
      (activeCount ? ` · ${activeCount} active now` : '');
  }

  // Clear any previously-shown character list
  const out = document.getElementById('adminUserCharacters');
  if (out) out.innerHTML = '';
}

window.adminRefreshUsers = adminRefreshUsers;

// Render the user card grid from a list of user objects.
function renderAdminUserGrid(users) {
  const grid = document.getElementById('adminUserGrid');
  if (!grid) return;
  if (!users.length) {
    grid.innerHTML = '<p class="settings-note">No users found.</p>';
    return;
  }
  grid.innerHTML = users.map(u => {
    const active = isActiveNow(u.lastSeenAt);
    const name = u.nickname || (u.email || '').split('@')[0] || 'User';
    const seen = active ? 'Active now' : (timeAgo(u.lastSeenAt) ? 'Seen ' + timeAgo(u.lastSeenAt) : 'Never seen');
    const devices = u.knownDeviceCount || 0;
    return `
      <button type="button" class="admin-user-card" data-uid="${escapeHtml(u.uid)}" onclick="adminSelectUser('${escapeHtml(u.uid)}')">
        <div class="admin-user-card-top">
          <span class="admin-user-dot ${active ? 'is-active' : ''}" title="${active ? 'Active now' : 'Offline'}"></span>
          <span class="admin-user-name">${escapeHtml(name)}</span>
        </div>
        <span class="admin-user-email">${escapeHtml(u.email || u.uid)}</span>
        <div class="admin-user-card-meta">
          <span class="admin-user-charcount" data-uid="${escapeHtml(u.uid)}">… chars</span>
          <span>${devices} device${devices === 1 ? '' : 's'}</span>
          <span>${escapeHtml(seen)}</span>
        </div>
      </button>`;
  }).join('');
  // Fill in character counts lazily so the grid paints immediately.
  adminFillCharCounts(users);
}

// Populate each card's character-count badge via a lightweight count() aggregate
// query (Firebase 10.7 compat). Runs in parallel; failures degrade to '—'.
// Counts are cached per uid so re-renders (e.g. filtering) don't re-query.
const _adminCharCountCache = {};
async function adminFillCharCounts(users) {
  const db = window.db;
  if (!db || !Array.isArray(users)) return;
  const paint = (uid, text) => {
    const el = document.querySelector(`.admin-user-charcount[data-uid="${cssEscape(uid)}"]`);
    if (el) el.textContent = text;
  };
  await Promise.all(users.map(async (u) => {
    if (_adminCharCountCache[u.uid] !== undefined) { paint(u.uid, _adminCharCountCache[u.uid]); return; }
    try {
      const snap = await db.collection('userData').doc(u.uid).collection('characters').count().get();
      const n = snap.data().count;
      const text = `${n} char${n === 1 ? '' : 's'}`;
      _adminCharCountCache[u.uid] = text;
      paint(u.uid, text);
    } catch (e) {
      paint(u.uid, '— chars');
    }
  }));
}

// Minimal CSS.escape fallback for attribute selectors (uids are safe already).
function cssEscape(s) {
  return (window.CSS && CSS.escape) ? CSS.escape(s) : String(s).replace(/["\\]/g, '\\$&');
}

// Live filter the grid by name/email substring.
function adminFilterUsers(query) {
  const users = window.__adminUsers || [];
  const q = (query || '').trim().toLowerCase();
  if (!q) { renderAdminUserGrid(users); return; }
  const filtered = users.filter(u =>
    String(u.email || '').toLowerCase().includes(q) ||
    String(u.nickname || '').toLowerCase().includes(q));
  renderAdminUserGrid(filtered);
}

window.adminFilterUsers = adminFilterUsers;

async function adminLoadUserChars(uid) {
  const db = window.db;
  if (!db) throw new Error('Firestore not ready');
  const snap = await db.collection('userData').doc(uid).collection('characters').get();
  const chars = [];
  snap.forEach(doc => chars.push({ id: doc.id, ...doc.data() }));
  // Sort by name for consistent display
  chars.sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));
  return chars;
}

async function adminSelectUser(uid) {
  const out = document.getElementById('adminUserCharacters');
  if (out) out.innerHTML = '';
  if (!uid) return;

  // Highlight the selected card
  document.querySelectorAll('.admin-user-card').forEach(c =>
    c.classList.toggle('is-selected', c.dataset.uid === uid));

  const user = window.__adminUsersByUid[uid] || { uid };
  const active = isActiveNow(user.lastSeenAt);

  const db = window.db;
  if (!db || !out) return;

  out.innerHTML = '<p class="settings-note">Loading characters…</p>';

  try {
    const chars = await adminLoadUserChars(uid);

    // Header for the selected user, shown above their characters.
    const header = `
      <div class="admin-user-detail-header">
        <h4>${escapeHtml(user.nickname || (user.email || '').split('@')[0] || 'User')}</h4>
        <div class="admin-user-detail-chips">
          <span class="admin-chip ${active ? 'is-active' : ''}">${active ? 'Active now' : 'Offline'}</span>
          <span class="admin-chip">${escapeHtml(user.email || uid)}</span>
          <span class="admin-chip">${user.knownDeviceCount || 0} device${(user.knownDeviceCount || 0) === 1 ? '' : 's'}</span>
          <span class="admin-chip">Last sign-in: ${escapeHtml(formatTs(user.lastSignInAt) || '—')}</span>
          <span class="admin-chip">${chars.length} character${chars.length === 1 ? '' : 's'}</span>
        </div>
      </div>`;

    if (!chars.length) {
      out.innerHTML = header + '<p class="settings-note">No characters found for this user.</p>';
      return;
    }
    out.innerHTML = header;

    const container = document.createElement('div');
    chars.forEach(c => {
      const info = c?.data?.characterInfo || {};
      const name = info.name || c.name || 'Unnamed';
      const race = info.race || '';
      const klass = info.class || '';
      const subclass = info.subclass || '';
      const level = info.level || '';
      const charId = c.id;

      const line = document.createElement('div');
      line.className = 'settings-text-preview-row';
      line.innerHTML = `<span class="settings-preview-tag">${escapeHtml(name)}</span>
        <span class="settings-note">${escapeHtml([race, klass, subclass, level ? ('Lv ' + level) : ''].filter(Boolean).join(' | '))}</span>`;

      const previewBtn = document.createElement('button');
      previewBtn.type = 'button';
      previewBtn.className = 'settings-action-btn accent-contrast-bg';
      previewBtn.style.maxWidth = '200px';
      previewBtn.textContent = 'Preview (Read Only)';
      previewBtn.onclick = () => adminPreviewCharacter(uid, charId);

      const importBtn = document.createElement('button');
      importBtn.type = 'button';
      importBtn.className = 'settings-action-btn accent-contrast-bg';
      importBtn.style.maxWidth = '200px';
      importBtn.textContent = 'Import Copy';
      importBtn.onclick = () => adminImportCharacter(uid, charId);

      const exportBtn = document.createElement('button');
      exportBtn.type = 'button';
      exportBtn.className = 'settings-action-btn';
      exportBtn.style.maxWidth = '200px';
      exportBtn.textContent = 'Export JSON';
      // Capture this character object directly — already loaded, no re-fetch.
      exportBtn.onclick = () => adminExportCharacter(c, user.email || uid);

      const btnRow = document.createElement('div');
      btnRow.className = 'settings-text-preview-row';
      btnRow.appendChild(previewBtn);
      btnRow.appendChild(importBtn);
      btnRow.appendChild(exportBtn);

      const block = document.createElement('div');
      block.className = 'settings-text-preview';
      block.appendChild(line);
      block.appendChild(btnRow);

      container.appendChild(block);
    });
    out.appendChild(container);
  } catch (e) {
    console.error(e);
    out.innerHTML = '<p class="settings-note">Cannot read user data. Check Firestore rules allow admin read on <code>userData/{userId}/characters</code>.</p>';
  }
}

window.adminSelectUser = adminSelectUser;

// Owner-only: download one character as a clean .json backup. Takes the already
// loaded character object (no re-fetch) plus the owning user's email for the name.
function adminExportCharacter(charObj, ownerEmail) {
  try {
    if (!charObj) return;
    const info = charObj?.data?.characterInfo || {};
    const name = info.name || charObj.name || 'Unnamed';
    const level = info.level ? `lvl-${info.level}` : 'lvl-unknown';
    const owner = (ownerEmail || 'unknown').split('@')[0];
    const slug = (s) => String(s || '').replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '').toLowerCase() || 'x';
    const date = new Date().toISOString().slice(0, 10);

    const blob = new Blob([JSON.stringify(charObj, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${slug(owner)}_${slug(name)}_${slug(level)}_${date}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    if (typeof appToast === 'function') appToast(`Exported "${name}"`, 'success');
  } catch (e) {
    console.error('Admin export failed:', e);
    if (typeof appToast === 'function') appToast('Export failed: ' + e.message, 'error');
  }
}
window.adminExportCharacter = adminExportCharacter;

async function adminImportCharacter(uid, charId) {
  const db = window.db;
  if (!db) return;
  const doc = await db.collection('userData').doc(uid).collection('characters').doc(charId).get();
  if (!doc.exists) return;
  const src = { id: doc.id, ...doc.data() };
  if (!src) return;

  const users = window.__adminUsersByUid || {};
  const sourceEmail = users[uid]?.email || uid;
  const clone = JSON.parse(JSON.stringify(src));
  const originalId = clone.id || 'unknown';
  clone.id = `adminimp_${uid}_${originalId}_${Date.now()}`;
  clone.name = `[Imported: ${sourceEmail}] ${clone.name || clone?.data?.characterInfo?.name || 'Unnamed'}`.slice(0, 90);
  clone.adminImportedFrom = { uid, email: sourceEmail, at: new Date().toISOString() };

  const local = getStoredJSON('dndCharacters', []);
  local.push(clone);
  setStoredJSON('dndCharacters', local);
  loadCharacterList();
  setSyncStatus?.('Imported character copy');
}

window.adminImportCharacter = adminImportCharacter;

let adminPreviewSnapshot = null;

async function adminPreviewCharacter(uid, charId) {
  const db = window.db;
  if (!db) return;
  const doc = await db.collection('userData').doc(uid).collection('characters').doc(charId).get();
  if (!doc.exists) return;
  const src = { id: doc.id, ...doc.data() };
  if (!src) return;

  if (!adminPreviewSnapshot) {
    adminPreviewSnapshot = {
      characters: getStoredJSON('dndCharacters', []),
      currentCharacter: currentCharacter
    };
  }

  const users = window.__adminUsersByUid || {};
  const sourceEmail = users[uid]?.email || uid;
  const clone = JSON.parse(JSON.stringify(src));
  const originalId = clone.id || 'unknown';
  clone.id = `adminprev_${uid}_${originalId}_${Date.now()}`;
  clone.name = `[Admin Preview: ${sourceEmail}] ${clone.name || clone?.data?.characterInfo?.name || 'Unnamed'}`.slice(0, 90);
  clone.adminPreviewFrom = { uid, email: sourceEmail, at: new Date().toISOString() };

  const local = [clone];
  setStoredJSON('dndCharacters', local);
  currentCharacter = clone.id;
  rememberSelectedCharacter(currentCharacter);
  loadCharacterList();
  loadData();

  window.__adminPreviewActive = true;
  const banner = document.getElementById('adminPreviewBanner');
  const bannerText = document.getElementById('adminPreviewBannerText');
  if (banner) banner.style.display = 'flex';
  if (bannerText) bannerText.textContent = `ADMIN PREVIEW - ${sourceEmail}`;
  disableEditingForAdminPreview(true);
}

window.adminPreviewCharacter = adminPreviewCharacter;

// IDs of buttons that should remain clickable during admin preview
const ADMIN_PREVIEW_ALLOWED = new Set([
  'exportBtn', 'importBtn', 'manualSaveBtn'
]);

// CSS classes of buttons to keep enabled (export, import, save, backup tools)
const ADMIN_PREVIEW_ALLOWED_CLASSES = ['settings-import-label', 'import-label'];

function disableEditingForAdminPreview(on) {
  const root = document.getElementById('pages');
  if (!root) return;
  root.querySelectorAll('input, textarea, select, button, label').forEach(el => {
    if (el.closest('#adminPreviewBanner')) return;
    if (el.closest('.tabs') || el.closest('.header-bar')) return;
    if (el.id === 'adminPortalPin') return;
    // Allow export/import/save buttons to remain usable
    if (ADMIN_PREVIEW_ALLOWED.has(el.id)) return;
    if (ADMIN_PREVIEW_ALLOWED_CLASSES.some(c => el.classList.contains(c))) return;
    // Keep export, import, save buttons in settings enabled
    const txt = el.textContent?.trim();
    if (txt === 'Export Character' || txt === 'Import Character' || txt === 'Save Data') return;

    if (on) {
      el.dataset.prevDisabled = el.disabled ? '1' : '0';
      el.disabled = true;
    } else {
      const prev = el.dataset.prevDisabled;
      if (prev === '0') el.disabled = false;
      delete el.dataset.prevDisabled;
    }
  });
}

function exitAdminPreview() {
  if (!adminPreviewSnapshot) return;
  window.__adminPreviewActive = false;
  disableEditingForAdminPreview(false);
  const banner = document.getElementById('adminPreviewBanner');
  if (banner) banner.style.display = 'none';

  setStoredJSON('dndCharacters', adminPreviewSnapshot.characters || []);
  currentCharacter = adminPreviewSnapshot.currentCharacter || null;
  adminPreviewSnapshot = null;
  loadCharacterList();
  if (currentCharacter) loadData();
}

window.exitAdminPreview = exitAdminPreview;

// ─── Campaign Manager ──────────────────────────────────────────────────────

function setAdminCampaignStatus(msg, type) {
  const el = document.getElementById('adminCampaignStatus');
  if (!el) return;
  el.textContent = msg;
  el.className = `status-message ${type || 'info'}`;
  el.style.display = 'block';
  if (type !== 'error') setTimeout(() => { el.style.display = 'none'; }, 5000);
}

async function adminCreateCampaign() {
  const db = window.db;
  if (!db) { setAdminCampaignStatus('Not connected.', 'error'); return; }

  const name = (document.getElementById('adminCampaignName')?.value || '').trim();
  const setting = (document.getElementById('adminCampaignSetting')?.value || '').trim();
  const dmEmail = (document.getElementById('adminCampaignDmEmail')?.value || '').trim().toLowerCase();
  const dmPassword = (document.getElementById('adminCampaignDmPassword')?.value || '').trim();
  const password = (document.getElementById('adminCampaignPassword')?.value || '').trim();

  if (!name) { setAdminCampaignStatus('Campaign name is required.', 'error'); return; }

  const passwordHash = password ? await sha256Hex(password) : '';
  const dmPasswordHash = dmPassword ? await sha256Hex(dmPassword) : '';
  const id = 'camp_' + Date.now();

  try {
    await db.collection('campaigns').doc(id).set({
      id,
      name,
      setting: setting || '',
      dmEmails: dmEmail ? [dmEmail] : [],
      passwordHash,
      dmPasswordHash,
      active: true,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    setAdminCampaignStatus(`Campaign "${name}" created.`, 'success');
    document.getElementById('adminCampaignName').value = '';
    document.getElementById('adminCampaignSetting').value = '';
    document.getElementById('adminCampaignDmEmail').value = '';
    document.getElementById('adminCampaignDmPassword').value = '';
    document.getElementById('adminCampaignPassword').value = '';
    await adminLoadCampaigns();
  } catch (e) {
    console.error('adminCreateCampaign failed:', e);
    setAdminCampaignStatus('Error: ' + (e.message || 'unknown'), 'error');
  }
}

async function adminLoadCampaigns() {
  const db = window.db;
  const list = document.getElementById('adminCampaignList');
  if (!db || !list) return;

  list.innerHTML = '<p class="settings-note">Loading campaigns...</p>';

  try {
    const snap = await db.collection('campaigns').orderBy('createdAt', 'desc').get();
    if (snap.empty) { list.innerHTML = '<p class="settings-note">No campaigns yet. Create one above.</p>'; return; }

    // For each campaign, count linked characters via collectionGroup
    const campaigns = [];
    snap.forEach(doc => campaigns.push({ id: doc.id, ...doc.data() }));

    // Player counts from the members subcollection (reflects removals), in parallel
    const playerCounts = await Promise.all(campaigns.map(async c => {
      try {
        const memSnap = await db.collection('campaigns').doc(c.id).collection('members').get();
        return memSnap.size;
      } catch (_) { return '?'; }
    }));

    list.innerHTML = '';
    campaigns.forEach((c, i) => {
      const playerCount = playerCounts[i];
      const dmList = (c.dmEmails || []).length
        ? (c.dmEmails || []).map(email =>
            `<span class="admin-dm-tag">${escapeHtml(email)}</span>`).join('')
        : '<span class="settings-note">No DM assigned</span>';

      const div = document.createElement('div');
      div.className = 'admin-campaign-card';
      div.innerHTML = `
        <div class="admin-campaign-card-header">
          <div>
            <span class="admin-campaign-name">${escapeHtml(c.name)}</span>
            <span class="admin-campaign-badge ${c.active ? 'badge-active' : 'badge-inactive'}">${c.active ? 'Active' : 'Inactive'}</span>
          </div>
          <div class="admin-campaign-actions">
            <button class="settings-action-btn accent-contrast-bg" onclick="dmEnterAsOwner('${c.id}', 'view')">Enter as DM (View)</button>
            <button class="settings-action-btn accent-contrast-bg" onclick="dmEnterAsOwner('${c.id}', 'edit')">Enter as DM (Edit)</button>
            <button class="settings-action-btn accent-contrast-bg" onclick="adminViewCampaignPlayers('${c.id}', '${escapeHtml(c.name)}')">View Players</button>
            <button class="settings-action-btn accent-contrast-bg" onclick="adminEditCampaignDm('${c.id}')">Edit DM</button>
            <button class="settings-action-btn accent-contrast-bg" onclick="adminChangeCampaignPassword('${c.id}', 'dm')">DM Password</button>
            <button class="settings-action-btn accent-contrast-bg" onclick="adminChangeCampaignPassword('${c.id}', 'player')">Player Password</button>
            <button class="settings-action-btn accent-contrast-bg" onclick="adminToggleCampaign('${c.id}', ${!c.active})">${c.active ? 'Deactivate' : 'Activate'}</button>
            <button class="settings-action-btn admin-delete-btn" id="adminDelBtn_${c.id}" onclick="adminDeleteCampaignStep('${c.id}', '${escapeHtml(c.name)}', this)">Delete</button>
          </div>
        </div>
        <div class="admin-campaign-card-body">
          <div class="admin-campaign-detail-row"><span class="admin-detail-label">Setting</span><span>${escapeHtml(c.setting || '—')}</span></div>
          <div class="admin-campaign-detail-row"><span class="admin-detail-label">DMs</span><div class="admin-dm-list">${dmList}</div></div>
          <div class="admin-campaign-detail-row"><span class="admin-detail-label">Linked Players</span><span>${playerCount} character${playerCount === 1 ? '' : 's'}</span></div>
          <div class="admin-campaign-detail-row"><span class="admin-detail-label">DM Password</span><span>${c.dmPasswordHash ? '••••••••• (set)' : 'Not set'}</span></div>
          <div class="admin-campaign-detail-row"><span class="admin-detail-label">Player Password</span><span>${c.passwordHash ? '••••••••• (set)' : 'Not set'}</span></div>
        </div>
        <div id="adminCampaignPlayers_${c.id}" class="admin-campaign-players" style="display:none;"></div>
      `;
      list.appendChild(div);
    });
  } catch (e) {
    console.error('adminLoadCampaigns failed:', e);
    list.innerHTML = `<p class="settings-note">Error: ${escapeHtml(e.message)}</p>`;
  }
}

async function adminViewCampaignPlayers(campaignId, campaignName) {
  const db = window.db;
  const panel = document.getElementById(`adminCampaignPlayers_${campaignId}`);
  if (!panel) return;

  if (panel.style.display === 'block') { panel.style.display = 'none'; return; }

  panel.style.display = 'block';
  panel.innerHTML = '<p class="settings-note">Loading...</p>';

  try {
    // Roster source of truth: campaigns/{id}/members (matches the DM portal).
    const snap = await db.collection('campaigns').doc(campaignId).collection('members').get();
    const rows = [];
    snap.forEach(doc => {
      const m = doc.data() || {};
      const charId = m.charId || doc.id;
      rows.push(`
        <div class="admin-campaign-player-row">
          <span class="admin-campaign-player-name">${escapeHtml(m.charName || 'Unnamed')}</span>
          <span class="settings-note">${escapeHtml([m.race, m.class, m.level ? 'Lv ' + m.level : ''].filter(Boolean).join(' · '))}</span>
          <button class="settings-action-btn admin-delete-btn" onclick="adminRemovePlayer('${campaignId}','${charId}','${escapeHtml(campaignName)}')">Remove</button>
        </div>
      `);
    });

    const rosterHtml = rows.length
      ? `<h5 class="settings-note" style="margin:10px 0 6px;">Players (${rows.length})</h5>${rows.join('')}`
      : '<p class="settings-note">No players have joined yet.</p>';

    panel.innerHTML = `<div class="admin-campaign-players-list">${rosterHtml}</div>`;
  } catch (e) {
    panel.innerHTML = `<p class="settings-note">${escapeHtml(adminFriendlyError(e))}</p>`;
  }
}

// Plain-English error helper (reuses the DM portal's if loaded)
function adminFriendlyError(e) {
  if (typeof window.friendlyFirebaseError === 'function') return window.friendlyFirebaseError(e);
  return (e && e.message) ? e.message : 'Something went wrong. Try again.';
}

async function adminRemovePlayer(campaignId, charId, campaignName) {
  const ok = (typeof appConfirm === 'function')
    ? await appConfirm('Remove this character from the campaign? Their campaign indicator clears and they can re-join with the password.', { confirmText: 'Remove' })
    : confirm('Remove this character from the campaign? Their campaign indicator clears and they can re-join with the password.');
  if (!ok) return;
  const db = window.db;
  if (!db || !charId) return;
  try {
    // Delete the member doc (keyed by charId) — the roster reads members, so the
    // character is removed instantly even while offline.
    await db.collection('campaigns').doc(campaignId)
      .collection('members').doc(charId).delete();
    setAdminCampaignStatus('Player removed.', 'success');
    setTimeout(() => adminViewCampaignPlayers(campaignId, campaignName), 100);
  } catch (e) {
    setAdminCampaignStatus(adminFriendlyError(e), 'error');
  }
}

window.adminRemovePlayer = adminRemovePlayer;

async function adminChangeCampaignPassword(campaignId, which) {
  const isDm = which === 'dm';
  const label = isDm ? 'DM control password (DM uses to take control)' : 'player join password (players enter to join)';
  const field = isDm ? 'dmPasswordHash' : 'passwordHash';
  const password = prompt(`Enter new ${label} for this campaign:\n(Leave blank to remove it)`);
  if (password === null) return; // cancelled
  const db = window.db;
  if (!db) return;
  try {
    const hash = password.trim() ? await sha256Hex(password.trim()) : '';
    await db.collection('campaigns').doc(campaignId).update({ [field]: hash });
    await adminLoadCampaigns();
    setAdminCampaignStatus(`${isDm ? 'DM' : 'Player'} password ${hash ? 'updated' : 'removed'}.`, 'success');
  } catch (e) {
    setAdminCampaignStatus('Error: ' + e.message, 'error');
  }
}

async function adminEditCampaignDm(campaignId) {
  const db = window.db;
  if (!db) return;
  const email = prompt('Enter DM email (leave blank to clear):');
  if (email === null) return; // cancelled
  const clean = email.trim().toLowerCase();
  try {
    await db.collection('campaigns').doc(campaignId).update({
      dmEmails: clean ? [clean] : []
    });
    setAdminCampaignStatus('DM updated.', 'success');
    await adminLoadCampaigns();
  } catch (e) {
    setAdminCampaignStatus('Error: ' + e.message, 'error');
  }
}

async function adminToggleCampaign(campaignId, active) {
  const db = window.db;
  if (!db) return;
  try {
    await db.collection('campaigns').doc(campaignId).update({ active });
    await adminLoadCampaigns();
  } catch (e) {
    setAdminCampaignStatus('Error: ' + e.message, 'error');
  }
}

const _adminDeleteState = {};

function adminDeleteCampaignStep(campaignId, campaignName, btn) {
  const state = _adminDeleteState[campaignId] || { step: 0 };

  if (state.step === 0) {
    state.step = 1;
    btn.textContent = 'Sure?';
    btn.style.background = 'rgba(200,100,40,0.3)';
    btn.style.borderColor = 'rgba(200,100,40,0.6)';
    state.timer = setTimeout(() => {
      _adminDeleteState[campaignId] = { step: 0 };
      btn.textContent = 'Delete';
      btn.style.background = '';
      btn.style.borderColor = '';
    }, 4000);

  } else if (state.step === 1) {
    clearTimeout(state.timer);
    state.step = 2;
    btn.textContent = 'Deleting...';
    btn.disabled = true;
    _adminDeleteState[campaignId] = state;

    window.db.collection('campaigns').doc(campaignId).delete().then(() => {
      setAdminCampaignStatus(`"${campaignName}" deleted.`, 'success');
      adminLoadCampaigns();
    }).catch(e => {
      setAdminCampaignStatus('Delete failed: ' + e.message, 'error');
      btn.textContent = 'Delete';
      btn.disabled = false;
      _adminDeleteState[campaignId] = { step: 0 };
    });
  }

  _adminDeleteState[campaignId] = state;
}

window.adminDeleteCampaignStep = adminDeleteCampaignStep;
window.adminCreateCampaign = adminCreateCampaign;
window.adminLoadCampaigns = adminLoadCampaigns;
window.adminEditCampaignDm = adminEditCampaignDm;
window.adminToggleCampaign = adminToggleCampaign;
window.adminViewCampaignPlayers = adminViewCampaignPlayers;
window.adminChangeCampaignPassword = adminChangeCampaignPassword;

// ========== ADMIN → LOGS (Campaigns → Characters → roll logs) ==========
// Owner-only. Reads live from Firestore: campaign members give {uid, charId},
// then userData/{uid}/characters/{charId}.data.rollLog holds the day-grouped
// rolls. Foundation for more log types later.

let _adminLogsCampaigns = [];   // cached campaign list for the dropdown
let _adminLogsCurrentChar = null; // { uid, charId, name, rollLog } last opened

async function adminInitLogs(force) {
  const sel = document.getElementById('adminLogsCampaign');
  const chars = document.getElementById('adminLogsCharacters');
  const detail = document.getElementById('adminLogsDetail');
  if (!sel) return;
  if (chars) chars.innerHTML = '';
  if (detail) detail.innerHTML = '';
  if (_adminLogsCampaigns.length && !force) return; // already loaded

  const db = window.db;
  if (!db) return;
  sel.innerHTML = '<option value="">Loading campaigns…</option>';
  try {
    const snap = await db.collection('campaigns').orderBy('createdAt', 'desc').get();
    _adminLogsCampaigns = [];
    snap.forEach(doc => _adminLogsCampaigns.push({ id: doc.id, ...doc.data() }));
    sel.innerHTML = '<option value="">— pick a campaign —</option>' +
      _adminLogsCampaigns.map(c => `<option value="${escapeHtml(c.id)}">${escapeHtml(c.name)}</option>`).join('');
  } catch (e) {
    sel.innerHTML = '<option value="">Error loading</option>';
    if (chars) chars.innerHTML = `<p class="settings-note">${escapeHtml(adminFriendlyError(e))}</p>`;
  }
}

async function adminLogsSelectCampaign(campaignId) {
  const chars = document.getElementById('adminLogsCharacters');
  const detail = document.getElementById('adminLogsDetail');
  if (detail) detail.innerHTML = '';
  if (!chars) return;
  if (!campaignId) { chars.innerHTML = ''; return; }
  const db = window.db;
  if (!db) return;
  chars.innerHTML = '<p class="settings-note">Loading characters…</p>';
  try {
    const snap = await db.collection('campaigns').doc(campaignId).collection('members').get();
    const members = [];
    snap.forEach(doc => { const m = doc.data() || {}; members.push({ uid: m.uid || doc.id, charId: m.charId || '', name: m.charName || 'Unnamed', meta: [m.race, m.class, m.level ? 'Lv ' + m.level : ''].filter(Boolean).join(' · ') }); });
    if (!members.length) { chars.innerHTML = '<p class="settings-note">No characters in this campaign yet.</p>'; return; }
    chars.innerHTML = members.map(m => `
      <button type="button" class="admin-user-card" onclick="adminViewCharLogs('${escapeHtml(m.uid)}','${escapeHtml(m.charId)}','${escapeHtml(m.name)}')">
        <span class="settings-preview-tag">${escapeHtml(m.name)}</span>
        <span class="settings-note">${escapeHtml(m.meta)}</span>
      </button>`).join('');
  } catch (e) {
    chars.innerHTML = `<p class="settings-note">${escapeHtml(adminFriendlyError(e))}</p>`;
  }
}

async function adminViewCharLogs(uid, charId, name) {
  const detail = document.getElementById('adminLogsDetail');
  if (!detail) return;
  const db = window.db;
  if (!db || !uid || !charId) { detail.innerHTML = '<p class="settings-note">Missing character reference.</p>'; return; }
  detail.innerHTML = '<p class="settings-note">Loading logs…</p>';
  try {
    const doc = await db.collection('userData').doc(uid).collection('characters').doc(charId).get();
    const data = (doc.exists ? (doc.data() || {}) : {}).data || {};
    const rollLog = (data.rollLog && data.rollLog.days) ? data.rollLog : { days: {} };
    _adminLogsCurrentChar = { uid, charId, name, rollLog };
    detail.innerHTML = adminRenderRollLog(name, rollLog);
  } catch (e) {
    detail.innerHTML = `<p class="settings-note">${escapeHtml(adminFriendlyError(e))}</p>`;
  }
}

function adminRenderRollLog(name, rollLog) {
  const days = Object.keys(rollLog.days || {}).sort().reverse();
  const totalRolls = days.reduce((n, d) => n + (rollLog.days[d] || []).length, 0);
  const header = `
    <div class="admin-user-detail-header">
      <h4>${escapeHtml(name)} — Roll Log</h4>
      <div class="admin-user-detail-chips">
        <span class="admin-chip">${days.length} day${days.length === 1 ? '' : 's'}</span>
        <span class="admin-chip">${totalRolls} roll${totalRolls === 1 ? '' : 's'}</span>
        <button class="settings-action-btn accent-contrast-bg" style="max-width:220px" onclick="adminExportCharLog()">Export (compressed)</button>
      </div>
    </div>`;
  if (!totalRolls) return header + '<p class="settings-note">No rolls recorded for this character yet.</p>';
  const body = days.map(day => {
    const rows = (rollLog.days[day] || []).slice().reverse().map(e => {
      const time = new Date(e.ts || 0).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const detail = e.kind === 'tohit'
        ? `to hit ${e.total >= 0 ? '' : ''}${e.total} (d20 ${e.d20}${e.otherD20 != null ? ', ' + e.otherD20 : ''}${e.mode && e.mode !== 'normal' ? ' ' + e.mode : ''})${e.nat20 ? ' CRIT' : ''}${e.nat1 ? ' nat1' : ''}`
        : `${e.crit ? 'CRIT ' : ''}damage ${e.total}${e.damageType ? ' ' + escapeHtml(e.damageType) : ''}`;
      return `<div class="admin-log-row"><span class="admin-log-weapon">${escapeHtml(e.weapon || 'Weapon')}</span><span class="admin-log-detail">${detail}</span><span class="admin-log-time">${time}</span></div>`;
    }).join('');
    return `<div class="admin-log-day"><h5>${escapeHtml(day)}</h5>${rows}</div>`;
  }).join('');
  return header + `<div class="admin-log-list">${body}</div>`;
}

// Compress a string with the browser's gzip stream; falls back to plain text.
async function adminGzip(str) {
  if (typeof CompressionStream === 'undefined') return null;
  const stream = new Blob([str]).stream().pipeThrough(new CompressionStream('gzip'));
  return await new Response(stream).blob();
}

async function adminExportCharLog() {
  if (!_adminLogsCurrentChar) return;
  const { name, uid, charId, rollLog } = _adminLogsCurrentChar;
  const payload = JSON.stringify({ type: 'rollLog', version: 1, character: name, uid, charId, exportedAt: new Date().toISOString(), rollLog });
  const safe = String(name || 'character').replace(/[^a-z0-9]+/gi, '_').toLowerCase();
  const date = new Date().toISOString().slice(0, 10);
  const gz = await adminGzip(payload);
  const blob = gz || new Blob([payload], { type: 'application/json' });
  const ext = gz ? 'json.gz' : 'json';
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `rolllog_${safe}_${date}.${ext}`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

window.adminInitLogs = adminInitLogs;
window.adminLogsSelectCampaign = adminLogsSelectCampaign;
window.adminViewCharLogs = adminViewCharLogs;
window.adminExportCharLog = adminExportCharLog;
