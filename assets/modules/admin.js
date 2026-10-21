// Admin portal — owner-only user management and character import/preview via Firestore

// SHA-256 of a UTF-8 string, as hex. Uses the browser's crypto when it exists. That is only on secure (https)
// pages, so plain-http staging on the LAN falls back to this small pure-JS version (same output).
function sha256Fallback(bytes) {
  const K = [0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2];
  const H = [0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19];
  const len = bytes.length, bitLen = len * 8;
  const padded = new Uint8Array(((len + 9 + 63) >> 6) << 6);
  padded.set(bytes); padded[len] = 0x80;
  const dv = new DataView(padded.buffer);
  dv.setUint32(padded.length - 8, Math.floor(bitLen / 0x100000000)); dv.setUint32(padded.length - 4, bitLen >>> 0);
  const w = new Uint32Array(64), rotr = (x, n) => (x >>> n) | (x << (32 - n));
  for (let off = 0; off < padded.length; off += 64) {
    for (let i = 0; i < 16; i++) w[i] = dv.getUint32(off + i * 4);
    for (let i = 16; i < 64; i++) {
      const s0 = rotr(w[i-15], 7) ^ rotr(w[i-15], 18) ^ (w[i-15] >>> 3), s1 = rotr(w[i-2], 17) ^ rotr(w[i-2], 19) ^ (w[i-2] >>> 10);
      w[i] = (w[i-16] + s0 + w[i-7] + s1) >>> 0;
    }
    let [a, b, c, d, e, f, g, h] = H;
    for (let i = 0; i < 64; i++) {
      const t1 = (h + (rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25)) + ((e & f) ^ (~e & g)) + K[i] + w[i]) >>> 0;
      const t2 = ((rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22)) + ((a & b) ^ (a & c) ^ (b & c))) >>> 0;
      h = g; g = f; f = e; e = (d + t1) >>> 0; d = c; c = b; b = a; a = (t1 + t2) >>> 0;
    }
    H[0] = (H[0] + a) >>> 0; H[1] = (H[1] + b) >>> 0; H[2] = (H[2] + c) >>> 0; H[3] = (H[3] + d) >>> 0;
    H[4] = (H[4] + e) >>> 0; H[5] = (H[5] + f) >>> 0; H[6] = (H[6] + g) >>> 0; H[7] = (H[7] + h) >>> 0;
  }
  return H.map(x => x.toString(16).padStart(8, '0')).join('');
}

async function sha256Hex(text) {
  const data = new TextEncoder().encode(String(text || ''));
  if (window.crypto && window.crypto.subtle) {
    const buf = await window.crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
  }
  return sha256Fallback(data);
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
  if (typeof adminTabShown === 'function') adminTabShown(btn.dataset.adminTab);
}
window.switchAdminTab = switchAdminTab;

window.updateAdminPortalVisibility = function updateAdminPortalVisibility() {
  const railBtn = document.getElementById('grAdminBtn');
  if (railBtn) railBtn.hidden = !isOwnerAdminUser();
  if (!isOwnerAdminUser()) window.__adminPortalUnlocked = false;
};

// Owner-only Admin page (its own page, like Settings). The rail button calls this.
window.openAdminPage = function openAdminPage() {
  if (!isOwnerAdminUser()) { if (typeof appToast === 'function') appToast('Admin is for the owner account only.'); return; }
  const page = document.getElementById('admin');
  if (!page) return;
  document.querySelectorAll('.tab').forEach(tab => tab.classList.remove('active'));
  document.querySelectorAll('.page').forEach(pg => {
    pg.classList.remove('active');
    pg.style.display = 'none';
    pg.style.opacity = '0';
    pg.style.transform = 'translateY(10px)';
  });
  page.style.display = 'block';
  requestAnimationFrame(() => {
    page.classList.add('active');
    page.style.opacity = '1';
    page.style.transform = 'translateY(0)';
    window.scrollTo({ top: 0 });
  });
};
window.openAdminPortal = window.openAdminPage;

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
      const confirmPin = (await appPrompt('Admin PIN not set yet. Re-enter PIN to set it now:', { title: 'Set Admin PIN', inputType: 'password', confirmText: 'Set PIN' })) || '';
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
    // Each section reports its own load problem; one failing never blocks the rest.
    await adminOnUnlock();
  } catch (e) {
    console.error('[admin] unlock failed:', e);
    setAdminPortalStatus('Admin portal error: ' + adminFriendlyError(e) + ' [' + ((e && (e.code || e.message)) || 'unknown') + ']', 'error');
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
    byUid[doc.id] = { uid: doc.id, email: data.email || '', nickname: data.nickname || '', createdAt: data.createdAt || null };
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
        <div class="adm-row">
          <button type="button" class="settings-action-btn accent-contrast-bg" onclick="adminDownloadBackup('${escapeHtml(uid)}')">Download all of this user's sheets</button>
          <button type="button" class="settings-action-btn" onclick="navigator.clipboard && navigator.clipboard.writeText('${escapeHtml(user.email || uid)}')">Copy email</button>
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
      line.innerHTML = `<span class="settings-preview-tag">${escapeHtml(name)}${c.deleted ? ' (deleted)' : ''}</span>
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
  const users = window.__adminUsersByUid || {};
  adminImportCharObject({ id: doc.id, ...doc.data() }, uid, users[uid]?.email || uid);
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

// ─── Campaigns (everything users keep on their DM pages) ────────────────────
// Users create campaigns themselves on the DM screen (name, setting, notes, a typed player list).
// This tab is the owner's overview: see, read and delete them. Users cannot see each other's.

function setAdminCampaignStatus(msg, type) {
  const el = document.getElementById('adminCampaignStatus');
  if (!el) return;
  el.textContent = msg;
  el.className = `status-message ${type || 'info'}`;
  el.style.display = 'block';
  if (type !== 'error') setTimeout(() => { el.style.display = 'none'; }, 5000);
}

function adminFriendlyError(e) {
  if (typeof window.friendlyFirebaseError === 'function') return window.friendlyFirebaseError(e);
  return (e && e.message) ? e.message : 'Something went wrong. Try again.';
}

window._adminCampaigns = {};

async function adminLoadCampaigns() {
  const db = window.db;
  const list = document.getElementById('adminCampaignList');
  if (!db || !list) return;
  list.innerHTML = '<p class="settings-note">Loading campaigns...</p>';
  try {
    const snap = await db.collection('campaigns').get();
    _adminCampaigns = {};
    const rows = [];
    snap.forEach(doc => { const c = { id: doc.id, ...doc.data() }; _adminCampaigns[doc.id] = c; rows.push(c); });
    if (!rows.length) { list.innerHTML = '<p class="settings-note">No campaigns yet. They appear here when a user makes one on their DM screen.</p>'; return; }
    rows.sort((x, y) => String(y.updatedAt || '').localeCompare(String(x.updatedAt || '')));
    const meta = document.getElementById('adminCampaignMeta');
    if (meta) meta.textContent = `${rows.length} campaign${rows.length === 1 ? '' : 's'}`;
    list.innerHTML = '';
    rows.forEach(c => {
      const legacy = !c.ownerUid;
      const hasOld = !!(c.passwordHash || c.dmPasswordHash || (c.dmEmails && c.dmEmails.length));
      const owner = legacy ? 'Old campaign (made before this change)' : (c.ownerName || c.ownerEmail || c.ownerUid);
      const when = c.updatedAt ? new Date(c.updatedAt).toLocaleString() : '';
      const players = Array.isArray(c.players) ? c.players.length : 0;
      const div = document.createElement('div');
      div.className = 'admin-campaign-card';
      div.innerHTML = `
        <div class="admin-campaign-card-header">
          <div>
            <span class="admin-campaign-name">${escapeHtml(c.name || 'Untitled')}</span>
            ${legacy ? '<span class="admin-campaign-badge badge-inactive">Old</span>' : ''}
          </div>
          <div class="admin-campaign-actions">
            ${legacy ? '' : `<button class="settings-action-btn accent-contrast-bg" onclick="adminToggleCampaignView('${escapeHtml(c.id)}')">View</button>`}
            ${hasOld ? `<button class="settings-action-btn accent-contrast-bg" onclick="adminCleanCampaign('${escapeHtml(c.id)}')">Remove old passwords</button>` : ''}
            <button class="settings-action-btn admin-delete-btn" onclick="adminDeleteCampaign('${escapeHtml(c.id)}')">Delete</button>
          </div>
        </div>
        <div class="admin-campaign-card-body">
          <div class="admin-campaign-detail-row"><span class="admin-detail-label">Owner</span><span>${escapeHtml(owner)}${!legacy && c.ownerEmail && c.ownerName ? ' · ' + escapeHtml(c.ownerEmail) : ''}</span></div>
          <div class="admin-campaign-detail-row"><span class="admin-detail-label">Setting</span><span>${escapeHtml(c.setting || '—')}</span></div>
          ${legacy ? '' : `<div class="admin-campaign-detail-row"><span class="admin-detail-label">Players</span><span>${players} listed</span></div>`}
          ${when ? `<div class="admin-campaign-detail-row"><span class="admin-detail-label">Updated</span><span>${escapeHtml(when)}</span></div>` : ''}
          ${hasOld ? '<div class="admin-campaign-detail-row"><span class="admin-detail-label">Old fields</span><span>Still holds a password hash or DM email from the old link system.</span></div>' : ''}
        </div>
        <div id="adminCampaignPlayers_${escapeHtml(c.id)}" class="admin-campaign-players" style="display:none;"></div>`;
      list.appendChild(div);
    });
  } catch (e) {
    console.error('adminLoadCampaigns failed:', e);
    list.innerHTML = `<p class="settings-note">${escapeHtml(adminFriendlyError(e))}</p>`;
  }
}

function adminToggleCampaignView(id) {
  const panel = document.getElementById('adminCampaignPlayers_' + id);
  const c = _adminCampaigns[id];
  if (!panel || !c) return;
  if (panel.style.display !== 'none') { panel.style.display = 'none'; return; }
  const players = Array.isArray(c.players) ? c.players : [];
  const line = p => [p.name || 'Unnamed', p.player ? '(' + p.player + ')' : '', p.cls, p.level ? 'Lv ' + p.level : '', p.ac ? 'AC ' + p.ac : '', p.hp ? 'HP ' + p.hp : ''].filter(Boolean).join(' · ');
  panel.innerHTML =
    (c.notes ? `<p class="settings-note"><strong>Notes:</strong> ${escapeHtml(c.notes).replace(/\n/g, '<br>')}</p>` : '') +
    (players.length
      ? '<div class="admin-campaign-players-list">' + players.map(p => `<div class="admin-campaign-player-row"><span class="admin-campaign-player-name">${escapeHtml(line(p))}</span>${p.notes ? `<span class="settings-note">${escapeHtml(p.notes)}</span>` : ''}</div>`).join('') + '</div>'
      : '<p class="settings-note">No players listed.</p>');
  panel.style.display = 'block';
}

async function adminCleanCampaign(id) {
  const db = window.db; if (!db) return;
  const FV = firebase.firestore.FieldValue;
  try {
    await db.collection('campaigns').doc(id).update({ passwordHash: FV.delete(), dmPasswordHash: FV.delete(), dmEmails: FV.delete(), active: FV.delete() });
    setAdminCampaignStatus('Old password fields removed.', 'success');
    adminLoadCampaigns();
  } catch (e) { setAdminCampaignStatus(adminFriendlyError(e), 'error'); }
}

async function adminDeleteCampaign(id) {
  const db = window.db; const c = _adminCampaigns[id]; if (!db || !c) return;
  const ok = await appConfirm(`Delete "${c.name || 'this campaign'}"${c.ownerName ? ' (' + c.ownerName + ')' : ''}? Their copy on their own device can put it back the next time they open the DM screen, so this is mostly for old or abandoned ones.`, { title: 'Delete campaign', confirmText: 'Delete' });
  if (!ok) return;
  try { await db.collection('campaigns').doc(id).delete(); setAdminCampaignStatus('Campaign deleted.', 'success'); adminLoadCampaigns(); }
  catch (e) { setAdminCampaignStatus(adminFriendlyError(e), 'error'); }
}

window.adminLoadCampaigns = adminLoadCampaigns;
window.adminToggleCampaignView = adminToggleCampaignView;
window.adminCleanCampaign = adminCleanCampaign;
window.adminDeleteCampaign = adminDeleteCampaign;

// ========== ADMIN → LOGS (Users → Characters → roll logs) ==========
// Owner-only. Reads live from Firestore: userData/{uid}/characters/{charId}.data.rollLog holds the
// day-grouped rolls. Foundation for more log types later.

let _adminLogsCurrentChar = null; // { uid, charId, name, rollLog } last opened

async function adminInitLogs(force) {
  const sel = document.getElementById('adminLogsUser');
  const chars = document.getElementById('adminLogsCharacters');
  const detail = document.getElementById('adminLogsDetail');
  if (!sel) return;
  if (chars) chars.innerHTML = '';
  if (detail) detail.innerHTML = '';
  if (!(window.__adminUsers || []).length || force) { try { await adminRefreshUsers(); } catch (_) {} }
  const users = window.__adminUsers || [];
  sel.innerHTML = '<option value="">— pick a user —</option>' +
    users.map(u => `<option value="${escapeHtml(u.uid)}">${escapeHtml(u.nickname || u.email)}${u.nickname && u.email ? ' · ' + escapeHtml(u.email) : ''}</option>`).join('');
}

async function adminLogsSelectUser(uid) {
  const chars = document.getElementById('adminLogsCharacters');
  const detail = document.getElementById('adminLogsDetail');
  if (detail) detail.innerHTML = '';
  if (!chars) return;
  if (!uid) { chars.innerHTML = ''; return; }
  chars.innerHTML = '<p class="settings-note">Loading characters…</p>';
  try {
    const list = (await adminLoadUserChars(uid)).filter(c => !c.deleted);
    if (!list.length) { chars.innerHTML = '<p class="settings-note">This user has no characters.</p>'; return; }
    chars.innerHTML = list.map(c => {
      const info = (c.data && c.data.characterInfo) || {};
      const meta = [info.race, info.class, info.level ? 'Lv ' + info.level : ''].filter(Boolean).join(' · ');
      return `<button type="button" class="admin-user-card" onclick="adminViewCharLogs('${escapeHtml(uid)}','${escapeHtml(c.id)}','${escapeHtml(c.name || 'Unnamed')}')">
        <span class="settings-preview-tag">${escapeHtml(c.name || 'Unnamed')}</span>
        <span class="settings-note">${escapeHtml(meta)}</span>
      </button>`;
    }).join('');
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
window.adminLogsSelectUser = adminLogsSelectUser;
window.adminViewCharLogs = adminViewCharLogs;
window.adminExportCharLog = adminExportCharLog;
