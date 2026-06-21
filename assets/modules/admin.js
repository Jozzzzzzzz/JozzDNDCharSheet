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
    const chars = await adminLoadUserChars(uid);
    if (!chars.length) {
      out.innerHTML = '<p class="settings-note">No characters found for this user.</p>';
      return;
    }

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
    out.innerHTML = '<p class="settings-note">Cannot read user data. Check Firestore rules allow admin read on <code>userData/{userId}/characters</code>.</p>';
  }
}

window.adminSelectUser = adminSelectUser;

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
  const password = (document.getElementById('adminCampaignPassword')?.value || '').trim();

  if (!name) { setAdminCampaignStatus('Campaign name is required.', 'error'); return; }

  const passwordHash = password ? await sha256Hex(password) : '';
  const id = 'camp_' + Date.now();

  try {
    await db.collection('campaigns').doc(id).set({
      id,
      name,
      setting: setting || '',
      dmEmails: dmEmail ? [dmEmail] : [],
      passwordHash,
      active: true,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    setAdminCampaignStatus(`Campaign "${name}" created.`, 'success');
    document.getElementById('adminCampaignName').value = '';
    document.getElementById('adminCampaignSetting').value = '';
    document.getElementById('adminCampaignDmEmail').value = '';
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

    // Fetch player counts in parallel
    const playerCounts = await Promise.all(campaigns.map(async c => {
      try {
        const charSnap = await db.collectionGroup('characters')
          .where('data.characterInfo.campaignId', '==', c.name)
          .get();
        return charSnap.size;
      } catch (_) { return '?'; }
    }));

    // Fetch DM requests for assigned DMs
    const dmRequestSnaps = await Promise.all(campaigns.map(async c => {
      if (!c.dmEmails || !c.dmEmails.length) return [];
      try {
        const reqSnap = await db.collection('dm_requests')
          .where('email', 'in', c.dmEmails)
          .get();
        const reqs = [];
        reqSnap.forEach(d => reqs.push(d.data()));
        return reqs;
      } catch (_) { return []; }
    }));

    list.innerHTML = '';
    campaigns.forEach((c, i) => {
      const playerCount = playerCounts[i];
      const dmReqs = dmRequestSnaps[i] || [];
      const dmList = (c.dmEmails || []).length
        ? (c.dmEmails || []).map(email => {
            const req = dmReqs.find(r => r.email === email);
            const status = req ? req.status : 'not requested';
            return `<span class="admin-dm-tag">${escapeHtml(email)} <em>(${status})</em></span>`;
          }).join('')
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
            <button class="settings-action-btn accent-contrast-bg" onclick="adminViewCampaignPlayers('${c.id}', '${escapeHtml(c.name)}')">View Players</button>
            <button class="settings-action-btn accent-contrast-bg" onclick="adminEditCampaignDm('${c.id}')">Edit DM</button>
            <button class="settings-action-btn accent-contrast-bg" onclick="adminChangeCampaignPassword('${c.id}')">Change Password</button>
            <button class="settings-action-btn accent-contrast-bg" onclick="adminToggleCampaign('${c.id}', ${!c.active})">${c.active ? 'Deactivate' : 'Activate'}</button>
          </div>
        </div>
        <div class="admin-campaign-card-body">
          <div class="admin-campaign-detail-row"><span class="admin-detail-label">Setting</span><span>${escapeHtml(c.setting || '—')}</span></div>
          <div class="admin-campaign-detail-row"><span class="admin-detail-label">DMs</span><div class="admin-dm-list">${dmList}</div></div>
          <div class="admin-campaign-detail-row"><span class="admin-detail-label">Linked Players</span><span>${playerCount} character${playerCount === 1 ? '' : 's'}</span></div>
          <div class="admin-campaign-detail-row"><span class="admin-detail-label">Password</span><span>${c.passwordHash ? '••••••••• (set)' : 'Not set'}</span></div>
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
    const snap = await db.collectionGroup('characters')
      .where('data.characterInfo.campaignId', '==', campaignName)
      .get();

    if (snap.empty) {
      panel.innerHTML = '<p class="settings-note">No characters linked to this campaign yet.</p>';
      return;
    }

    const rows = [];
    snap.forEach(doc => {
      const d = doc.data() || {};
      const info = d?.data?.characterInfo || {};
      rows.push(`
        <div class="admin-campaign-player-row">
          <span class="admin-campaign-player-name">${escapeHtml(info.name || 'Unnamed')}</span>
          <span class="settings-note">${escapeHtml([info.race, info.class, info.subclass, info.level ? 'Lv ' + info.level : ''].filter(Boolean).join(' · '))}</span>
        </div>
      `);
    });

    panel.innerHTML = `<div class="admin-campaign-players-list">${rows.join('')}</div>`;
  } catch (e) {
    panel.innerHTML = `<p class="settings-note">Error: ${escapeHtml(e.message)}</p>`;
  }
}

async function adminChangeCampaignPassword(campaignId) {
  const password = prompt('Enter new DM portal password for this campaign:');
  if (!password || !password.trim()) return;
  const db = window.db;
  if (!db) return;
  try {
    const hash = await sha256Hex(password.trim());
    await db.collection('campaigns').doc(campaignId).update({ passwordHash: hash });
    setAdminCampaignStatus('Password updated.', 'success');
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

window.adminCreateCampaign = adminCreateCampaign;
window.adminLoadCampaigns = adminLoadCampaigns;
window.adminEditCampaignDm = adminEditCampaignDm;
window.adminToggleCampaign = adminToggleCampaign;
window.adminViewCampaignPlayers = adminViewCampaignPlayers;
window.adminChangeCampaignPassword = adminChangeCampaignPassword;
