// Admin portal — owner-only user management and character import/preview via Firestore

async function sha256Hex(text) {
  const enc = new TextEncoder();
  const data = enc.encode(String(text || ''));
  const buf = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

function isOwnerAdminUser() {
  const email = String(window.currentUser?.email || '').toLowerCase();
  return email === 'vanreejoz33@gmail.com';
}

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
    await adminRefreshUsers();
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

async function adminRefreshUsers() {
  if (!window.__adminPortalUnlocked) return;
  const db = window.db;
  if (!db) return;
  const select = document.getElementById('adminUserSelect');
  if (!select) return;

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
    .sort((a, b) => String(a.email).localeCompare(String(b.email)));

  window.__adminUsers = users;
  window.__adminUsersByUid = byUid;

  select.innerHTML = '<option value="">Select a user...</option>';
  users.forEach(u => {
    const label = `${u.nickname ? u.nickname + ' - ' : ''}${u.email}`;
    const opt = document.createElement('option');
    opt.value = u.uid;
    opt.textContent = label;
    select.appendChild(opt);
  });

  const meta = document.getElementById('adminUserMeta');
  if (meta) meta.textContent = `Loaded ${users.length} users.`;
}

window.adminRefreshUsers = adminRefreshUsers;

async function adminSelectUser(uid) {
  const meta = document.getElementById('adminUserMeta');
  const out = document.getElementById('adminUserCharacters');
  if (out) out.innerHTML = '';
  if (!uid) {
    if (meta) meta.textContent = '';
    return;
  }

  const user = window.__adminUsersByUid[uid] || { uid };
  const active = isActiveNow(user.lastSeenAt) ? 'Active now' : 'Not active';
  if (meta) {
    meta.textContent = `${user.email || uid} | ${user.nickname || 'no nickname'} | Devices: ${user.knownDeviceCount || 0} | Last sign-in: ${formatTs(user.lastSignInAt)} | ${active}`;
  }

  const db = window.db;
  if (!db || !out) return;

  try {
    const doc = await db.collection('userData').doc(uid).get();
    if (!doc.exists) {
      out.innerHTML = '<p class="settings-note">No cloud data for this user yet.</p>';
      return;
    }
    const data = doc.data() || {};
    const chars = Array.isArray(data.characters) ? data.characters : [];
    if (!chars.length) {
      out.innerHTML = '<p class="settings-note">No characters found for this user.</p>';
      return;
    }

    const rows = chars.map((c, idx) => {
      const info = c?.data?.characterInfo || {};
      const name = info.name || c.name || 'Unnamed';
      const race = info.race || '';
      const klass = info.class || '';
      const subclass = info.subclass || '';
      const level = info.level || '';
      return { idx, name, race, klass, subclass, level };
    });

    const container = document.createElement('div');
    rows.forEach(r => {
      const line = document.createElement('div');
      line.className = 'settings-text-preview-row';
      line.innerHTML = `<span class="settings-preview-tag">${escapeHtml(r.name)}</span>
        <span class="settings-note">${escapeHtml([r.race, r.klass, r.subclass, r.level ? ('Lv ' + r.level) : ''].filter(Boolean).join(' | '))}</span>`;

      const previewBtn = document.createElement('button');
      previewBtn.type = 'button';
      previewBtn.className = 'settings-action-btn accent-contrast-bg';
      previewBtn.style.maxWidth = '200px';
      previewBtn.textContent = 'Preview (Read Only)';
      previewBtn.onclick = () => adminPreviewCharacter(uid, r.idx);

      const importBtn = document.createElement('button');
      importBtn.type = 'button';
      importBtn.className = 'settings-action-btn accent-contrast-bg';
      importBtn.style.maxWidth = '200px';
      importBtn.textContent = 'Import Copy';
      importBtn.onclick = () => adminImportCharacter(uid, r.idx);

      const btnRow = document.createElement('div');
      btnRow.className = 'settings-text-preview-row';
      btnRow.appendChild(previewBtn);
      btnRow.appendChild(importBtn);

      const block = document.createElement('div');
      block.className = 'settings-text-preview';
      block.appendChild(line);
      block.appendChild(btnRow);

      container.appendChild(block);
    });
    out.appendChild(container);
  } catch (e) {
    console.error(e);
    out.innerHTML = '<p class="settings-note">Cannot read user data. If you want admin import/preview, update Firestore rules to allow admin read on `userData/{userId}`.</p>';
  }
}

window.adminSelectUser = adminSelectUser;

async function adminImportCharacter(uid, charIndex) {
  const db = window.db;
  if (!db) return;
  const doc = await db.collection('userData').doc(uid).get();
  const data = doc.data() || {};
  const chars = Array.isArray(data.characters) ? data.characters : [];
  const src = chars[charIndex];
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

async function adminPreviewCharacter(uid, charIndex) {
  const db = window.db;
  if (!db) return;
  const doc = await db.collection('userData').doc(uid).get();
  const data = doc.data() || {};
  const chars = Array.isArray(data.characters) ? data.characters : [];
  const src = chars[charIndex];
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

function disableEditingForAdminPreview(on) {
  const root = document.getElementById('pages');
  if (!root) return;
  root.querySelectorAll('input, textarea, select, button').forEach(el => {
    if (el.closest('#adminPreviewBanner')) return;
    if (el.closest('.tabs') || el.closest('.header-bar')) return;
    if (el.id === 'adminPortalPin') return;
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
