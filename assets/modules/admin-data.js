// Admin page: overview, all sheets, backup, restore and tools. Owner-only (the rules enforce it too).
// Loads after admin.js, which owns unlock, users, campaigns, preview/import/export and roll logs.
// Reads are cached in memory for the visit; "Refresh" re-reads. Admin never edits a user's sheet content:
// the only write to a user's sheet is "Restore" (flips the deleted flag back).

(function () {
  const BIG_KB = 800;                       // the sync code warns at 800 KB and refuses at 1000 KB
  const BACKUP_KEY = 'dndAdminLastBackup';
  const BACKUP_STALE_DAYS = 7;
  const appVer = () => (typeof CHANGELOG_LATEST_VERSION !== 'undefined' ? CHANGELOG_LATEST_VERSION : '');
  const AD = window.__adminData = { sheets: [], loadedAt: 0, legacy: null, sheetFilter: 'all', sheetSort: 'updated', sheetQuery: '', backupView: null };

  const esc = s => (typeof escapeHtml === 'function' ? escapeHtml(String(s == null ? '' : s)) : String(s == null ? '' : s));
  const $ = id => document.getElementById(id);
  const kb = n => n >= 1048576 ? (n / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(n / 1024)) + ' KB';
  const ago = ms => {
    if (!ms) return 'never';
    const s = Math.max(0, (Date.now() - ms) / 1000);
    if (s < 90) return 'just now'; if (s < 5400) return Math.round(s / 60) + ' min ago';
    if (s < 129600) return Math.round(s / 3600) + ' h ago'; return Math.round(s / 86400) + ' days ago';
  };
  function tsMs(v) {
    try {
      if (!v) return 0; if (typeof v.toMillis === 'function') return v.toMillis();
      if (typeof v.toDate === 'function') return v.toDate().getTime();
      if (typeof v === 'number') return v; const t = Date.parse(v); return Number.isNaN(t) ? 0 : t;
    } catch (_) { return 0; }
  }
  const jsonSafe = (_k, v) => (v && typeof v === 'object' && typeof v.toDate === 'function') ? { __timestamp: v.toDate().toISOString() } : v;
  const userOf = uid => (window.__adminUsersByUid || {})[uid] || { uid };
  const userLabel = uid => { const u = userOf(uid); return u.nickname || u.email || uid; };
  const toast = (m, t) => { if (typeof appToast === 'function') appToast(m, t || 'info'); };
  const err = e => (typeof adminFriendlyError === 'function' ? adminFriendlyError(e) : (e && e.message) || 'Something went wrong') + ' [' + ((e && (e.code || e.message)) || 'unknown') + ']';
  const lastBackupMs = () => { try { return Number(localStorage.getItem(BACKUP_KEY)) || 0; } catch (_) { return 0; } };

  // ---------- data ----------
  async function adminLoadSheets() {
    const db = window.db; if (!db) throw new Error('Firestore not ready');
    const snap = await db.collectionGroup('characters').get();
    const out = [];
    snap.forEach(doc => {
      const d = doc.data() || {}; const parent = doc.ref.parent && doc.ref.parent.parent;
      const uid = parent ? parent.id : '';
      const info = (d.data && d.data.characterInfo) || {};
      let size = 0; try { size = JSON.stringify(d, jsonSafe).length; } catch (_) {}
      const name = d.name || info.name || 'Unnamed';
      out.push({
        uid, id: doc.id, name, race: info.race || '', cls: info.class || '', level: info.level || '', size,
        updatedMs: tsMs(d.updatedAt), rev: d.rev || 0, deleted: !!d.deleted, deletedMs: tsMs(d.deletedAt),
        conflict: /\(conflict/i.test(name), raw: { id: doc.id, ...d }
      });
    });
    AD.sheets = out; AD.loadedAt = Date.now();
    return out;
  }

  async function adminOnUnlock() {
    const res = await Promise.allSettled([adminRefreshUsers(), adminLoadCampaigns(), adminLoadSheets()]);
    const names = ['Users', 'Campaigns', 'Sheets']; const problems = [];
    res.forEach((r, i) => { if (r.status === 'rejected') { console.error('[admin] ' + names[i] + ' failed:', r.reason); problems.push(names[i] + ': ' + err(r.reason)); } });
    AD.loadProblems = problems;
    adminRenderOverview();
    adminTabShown('adminTabOverview');
  }

  async function adminRefreshAll() {
    const box = $('admOverview'); if (box) box.setAttribute('aria-busy', 'true');
    AD.legacy = null;
    await adminOnUnlock();
    if (box) box.removeAttribute('aria-busy');
    toast('Admin data refreshed');
  }

  // ---------- overview ----------
  function adminRenderOverview() {
    const el = $('admOverview'); if (!el) return;
    const users = window.__adminUsers || []; const sheets = AD.sheets;
    const live = sheets.filter(s => !s.deleted), deleted = sheets.filter(s => s.deleted);
    const conflicts = live.filter(s => s.conflict), big = sheets.filter(s => s.size >= BIG_KB * 1024);
    const camps = Object.values(window._adminCampaigns || {});
    const active = users.filter(u => typeof isActiveNow === 'function' && isActiveNow(u.lastSeenAt)).length;
    const totalBytes = sheets.reduce((n, s) => n + s.size, 0);
    const week = Date.now() - 7 * 864e5; const newUsers = users.filter(u => tsMs(u.createdAt) > week).length;
    const tile = (n, label, sub, go) => `<button type="button" class="adm-tile"${go ? ` onclick="adminGoTab('${go}')"` : ''}><span class="adm-num">${esc(n)}</span><span class="adm-lbl">${esc(label)}</span>${sub ? `<span class="adm-sub">${esc(sub)}</span>` : ''}</button>`;
    const warn = [];
    (AD.loadProblems || []).forEach(p => warn.push({ lvl: 'bad', t: 'Could not load: ' + p }));
    const bMs = lastBackupMs();
    if (!bMs) warn.push({ lvl: 'warn', t: 'No backup has been downloaded from this browser yet.', go: 'adminTabBackup', b: 'Back up now' });
    else if (Date.now() - bMs > BACKUP_STALE_DAYS * 864e5) warn.push({ lvl: 'warn', t: `Last backup was ${ago(bMs)}.`, go: 'adminTabBackup', b: 'Back up now' });
    if (big.length) warn.push({ lvl: 'bad', t: `${big.length} sheet${big.length === 1 ? ' is' : 's are'} near or over the size limit: ${big.slice(0, 3).map(s => s.name).join(', ')}.`, go: 'adminTabSheets', b: 'See sheets', filter: 'big' });
    if (conflicts.length) warn.push({ lvl: 'warn', t: `${conflicts.length} conflict cop${conflicts.length === 1 ? 'y' : 'ies'} waiting for a player to sort out.`, go: 'adminTabSheets', b: 'See sheets', filter: 'conflict' });
    if (deleted.length) warn.push({ lvl: 'info', t: `${deleted.length} deleted sheet${deleted.length === 1 ? '' : 's'} can still be restored.`, go: 'adminTabSheets', b: 'See sheets', filter: 'deleted' });
    if (camps.length) warn.push({ lvl: 'warn', t: `${camps.length} old campaign doc${camps.length === 1 ? '' : 's'} left from the removed DM tool (some hold password hashes). Back up, then clean up.`, go: 'adminTabTools', b: 'Clean up' });
    const recent = users.slice().sort((a, b) => tsMs(b.lastSeenAt) - tsMs(a.lastSeenAt)).slice(0, 8);
    el.innerHTML =
      `<div class="adm-tiles">${tile(users.length, 'Users', `${active} active now${newUsers ? ' · ' + newUsers + ' new this week' : ''}`, 'adminTabUsers')}` +
      tile(live.length, 'Sheets', `${kb(totalBytes)} stored`, 'adminTabSheets') +
      tile(deleted.length, 'Deleted sheets', 'restorable', 'adminTabSheets') +
      tile(ago(bMs), 'Last backup', bMs ? new Date(bMs).toLocaleString() : 'none yet', 'adminTabBackup') + '</div>' +
      `<h4 class="adm-h">Needs attention</h4>` +
      (warn.length ? '<ul class="adm-warn">' + warn.map(w => `<li class="adm-lv-${w.lvl}"><span>${esc(w.t)}</span>${w.go ? `<button type="button" class="settings-action-btn" onclick="adminGoTab('${w.go}'${w.filter ? `,'${w.filter}'` : ''})">${esc(w.b)}</button>` : ''}</li>`).join('') + '</ul>' : '<p class="settings-note">Nothing needs attention.</p>') +
      `<h4 class="adm-h">Recent activity</h4>` +
      (recent.length ? '<div class="adm-table-wrap"><table class="adm-table"><thead><tr><th>User</th><th>Email</th><th>Last seen</th><th>Devices</th><th>Sheets</th></tr></thead><tbody>' +
        recent.map(u => `<tr><td>${esc(u.nickname || (u.email || '').split('@')[0] || 'User')}</td><td>${esc(u.email || u.uid)}</td><td>${esc(tsMs(u.lastSeenAt) ? ago(tsMs(u.lastSeenAt)) : 'never')}</td><td>${u.knownDeviceCount || 0}</td><td>${live.filter(s => s.uid === u.uid).length}</td></tr>`).join('') + '</tbody></table></div>' : '<p class="settings-note">No users yet.</p>') +
      `<div class="adm-row"><button type="button" class="settings-action-btn accent-contrast-bg" onclick="adminDownloadBackup()">Download full backup</button><button type="button" class="settings-action-btn" onclick="adminRefreshAll()">Refresh</button></div>` +
      `<p class="settings-note">Loaded ${esc(new Date(AD.loadedAt || Date.now()).toLocaleTimeString())}. Reading every sheet counts as one read per sheet on the Firebase free plan, so press Refresh when you need fresh numbers, not constantly.</p>`;
  }

  function adminGoTab(id, filter) {
    const btn = document.querySelector(`.admin-tab[data-admin-tab="${id}"]`); if (!btn) return;
    if (filter) AD.sheetFilter = filter;
    switchAdminTab(btn); window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // ---------- sheets ----------
  function sheetFlags(s) {
    return [s.deleted ? '<span class="adm-flag adm-flag-bad">deleted</span>' : '', s.conflict ? '<span class="adm-flag adm-flag-warn">conflict copy</span>' : '',
      s.size >= BIG_KB * 1024 ? '<span class="adm-flag adm-flag-bad">near size limit</span>' : (s.size >= 500 * 1024 ? '<span class="adm-flag adm-flag-warn">large</span>' : '')].join('');
  }
  function adminRenderSheets() {
    const body = $('admSheetsBody'); if (!body) return;
    const f = $('admSheetFilter'); if (f) f.value = AD.sheetFilter;
    const q = AD.sheetQuery.trim().toLowerCase();
    let rows = AD.sheets.filter(s => {
      if (AD.sheetFilter === 'live' && s.deleted) return false; if (AD.sheetFilter === 'deleted' && !s.deleted) return false;
      if (AD.sheetFilter === 'conflict' && !s.conflict) return false; if (AD.sheetFilter === 'big' && s.size < 500 * 1024) return false;
      if (!q) return true; return (s.name + ' ' + userLabel(s.uid) + ' ' + (userOf(s.uid).email || '') + ' ' + s.cls + ' ' + s.race).toLowerCase().includes(q);
    });
    const sorts = { updated: (a, b) => b.updatedMs - a.updatedMs, name: (a, b) => a.name.localeCompare(b.name), size: (a, b) => b.size - a.size, owner: (a, b) => userLabel(a.uid).localeCompare(userLabel(b.uid)) };
    rows.sort(sorts[AD.sheetSort] || sorts.updated);
    const meta = $('admSheetsMeta'); if (meta) meta.textContent = `${rows.length} of ${AD.sheets.length} sheet${AD.sheets.length === 1 ? '' : 's'}`;
    if (!rows.length) { body.innerHTML = '<p class="settings-note">No sheets match.</p>'; return; }
    body.innerHTML = '<div class="adm-table-wrap"><table class="adm-table"><thead><tr><th>Sheet</th><th>Owner</th><th>Class</th><th>Size</th><th>Updated</th><th></th></tr></thead><tbody>' + rows.map(s =>
      `<tr data-uid="${esc(s.uid)}" data-id="${esc(s.id)}"><td><strong>${esc(s.name)}</strong> ${sheetFlags(s)}</td><td>${esc(userLabel(s.uid))}</td><td>${esc([s.cls, s.level ? 'Lv ' + s.level : ''].filter(Boolean).join(' '))}</td><td>${kb(s.size)}</td><td>${esc(s.updatedMs ? ago(s.updatedMs) : '')}</td>` +
      `<td class="adm-actions"><button type="button" class="settings-action-btn" data-act="preview">Preview</button><button type="button" class="settings-action-btn" data-act="export">Export</button>${s.deleted ? '<button type="button" class="settings-action-btn accent-contrast-bg" data-act="restore">Restore</button>' : ''}</td></tr>`).join('') + '</tbody></table></div>';
  }
  function sheetFromRow(btn) { const tr = btn.closest('tr'); return tr && AD.sheets.find(s => s.uid === tr.dataset.uid && s.id === tr.dataset.id); }
  async function adminRestoreSheet(uid, id) {
    const s = AD.sheets.find(x => x.uid === uid && x.id === id); if (!s) return;
    const ok = await appConfirm(`Restore "${s.name}" for ${userLabel(uid)}? It comes back on their account and reappears on their devices the next time they open the app.`, { title: 'Restore sheet', confirmText: 'Restore', danger: false });
    if (!ok) return;
    try {
      const FV = firebase.firestore.FieldValue;
      await window.db.collection('userData').doc(uid).collection('characters').doc(id).update({ deleted: false, deletedAt: null, rev: FV.increment(1), updatedAt: FV.serverTimestamp() });
      toast(`Restored "${s.name}"`, 'success'); await adminLoadSheets(); adminRenderSheets(); adminRenderOverview();
    } catch (e) { toast('Restore failed: ' + err(e), 'error'); }
  }

  // ---------- backup ----------
  function adminBuildBackup(uid) {
    const users = (window.__adminUsers || []).filter(u => !uid || u.uid === uid).map(u => ({ uid: u.uid, email: u.email, nickname: u.nickname, lastSignInAt: tsMs(u.lastSignInAt) || null, lastSeenAt: tsMs(u.lastSeenAt) || null, devices: u.knownDeviceCount || 0 }));
    const sheets = AD.sheets.filter(s => !uid || s.uid === uid).map(s => ({ uid: s.uid, ...s.raw }));
    const campaigns = Object.values(window._adminCampaigns || {}).filter(c => !uid || c.ownerUid === uid);
    return { format: 'dnd-admin-backup', version: 1, exportedAt: new Date().toISOString(), appVersion: appVer(), scope: uid ? 'user:' + uid : 'everything', users, sheets, campaigns };
  }
  function download(name, text) {
    const url = URL.createObjectURL(new Blob([text], { type: 'application/json' })); const a = document.createElement('a');
    a.href = url; a.download = name; document.body.appendChild(a); a.click(); document.body.removeChild(a); setTimeout(() => URL.revokeObjectURL(url), 2000);
  }
  async function adminDownloadBackup(uid) {
    try {
      if (!AD.sheets.length || Date.now() - AD.loadedAt > 60000) await adminLoadSheets();   // back up fresh data, not a stale view
      const b = adminBuildBackup(uid);
      const slug = uid ? (userOf(uid).email || uid).split('@')[0].replace(/[^a-z0-9]+/gi, '-').toLowerCase() : 'all';
      download(`dnd-backup-${slug}-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(b, jsonSafe));
      if (!uid) { try { localStorage.setItem(BACKUP_KEY, String(Date.now())); } catch (_) {} }
      toast(`Backup downloaded: ${b.sheets.length} sheets, ${b.users.length} users, ${b.campaigns.length} campaigns`, 'success');
      adminRenderBackup(); adminRenderOverview();
    } catch (e) { toast('Backup failed: ' + err(e), 'error'); }
  }
  function adminRenderBackup() {
    const el = $('admBackupInfo'); if (!el) return;
    const bMs = lastBackupMs();
    el.innerHTML = `<p class="settings-note">Last full backup from this browser: <strong>${esc(bMs ? new Date(bMs).toLocaleString() + ' (' + ago(bMs) + ')' : 'none yet')}</strong>. The file holds every user's sheets, profiles, sign-in info and campaigns. It does not include the admin PIN. Keep it somewhere private (Seafile Dnd library is a good place).</p>`;
    const sel = $('admBackupUser'); if (sel && sel.options.length <= 1) sel.innerHTML = '<option value="">Pick a user…</option>' + (window.__adminUsers || []).map(u => `<option value="${esc(u.uid)}">${esc(u.nickname || u.email)}${u.nickname && u.email ? ' · ' + esc(u.email) : ''}</option>`).join('');
  }
  function adminBackupUserDownload() { const v = ($('admBackupUser') || {}).value; if (!v) { toast('Pick a user first.'); return; } adminDownloadBackup(v); }

  // look inside a backup file and import single sheets as local copies (never touches the cloud)
  function adminBackupChosen(input) {
    const file = input.files && input.files[0]; if (!file) return; const out = $('admBackupView');
    const fr = new FileReader();
    fr.onload = () => {
      try {
        const b = JSON.parse(fr.result);
        if (b.format !== 'dnd-admin-backup' || !Array.isArray(b.sheets)) throw new Error('That is not an admin backup file.');
        AD.backupView = b;
        out.innerHTML = `<p class="settings-note">Backup from <strong>${esc(new Date(b.exportedAt).toLocaleString())}</strong> (${esc(b.scope)}): ${b.sheets.length} sheets, ${(b.users || []).length} users, ${(b.campaigns || []).length} campaigns. "Import copy" adds a sheet to THIS device only. It does not touch anyone's account.</p>` +
          '<div class="adm-table-wrap"><table class="adm-table"><thead><tr><th>Sheet</th><th>Owner</th><th>Saved</th><th></th></tr></thead><tbody>' + b.sheets.map((s, i) => {
            const u = (b.users || []).find(x => x.uid === s.uid) || {}; const nm = s.name || (s.data && s.data.characterInfo && s.data.characterInfo.name) || 'Unnamed';
            return `<tr data-i="${i}"><td><strong>${esc(nm)}</strong>${s.deleted ? ' <span class="adm-flag adm-flag-bad">deleted</span>' : ''}</td><td>${esc(u.nickname || u.email || s.uid)}</td><td>${esc(s.updatedAt && s.updatedAt.__timestamp ? new Date(s.updatedAt.__timestamp).toLocaleString() : '')}</td><td class="adm-actions"><button type="button" class="settings-action-btn" data-act="import">Import copy</button></td></tr>`;
          }).join('') + '</tbody></table></div>';
      } catch (e) { out.innerHTML = `<p class="settings-note">${esc(e.message || 'Could not read that file.')}</p>`; }
      input.value = '';
    };
    fr.readAsText(file);
  }
  // one definition for turning a stored sheet into a local, clearly-labelled copy (also used by admin.js)
  function adminImportCharObject(src, uid, email) {
    const clone = JSON.parse(JSON.stringify(src, jsonSafe));
    const timeFix = v => (v && typeof v === 'object' && v.__timestamp) ? v.__timestamp : v;
    ['updatedAt', 'createdAt', 'deletedAt'].forEach(k => { if (clone[k]) clone[k] = timeFix(clone[k]); });
    const originalId = clone.id || 'unknown';
    clone.id = `adminimp_${uid || 'u'}_${originalId}_${Date.now()}`;
    clone.name = `[Imported: ${email || uid || 'backup'}] ${clone.name || (clone.data && clone.data.characterInfo && clone.data.characterInfo.name) || 'Unnamed'}`.slice(0, 90);
    clone.adminImportedFrom = { uid, email, at: new Date().toISOString() };
    delete clone.uid; delete clone.deleted; delete clone.deletedAt; delete clone.rev;
    const local = getStoredJSON('dndCharacters', []); local.push(clone); setStoredJSON('dndCharacters', local);
    if (typeof loadCharacterList === 'function') loadCharacterList();
    if (typeof setSyncStatus === 'function') setSyncStatus('Imported character copy');
    return clone;
  }

  // ---------- tools ----------
  async function adminScanLegacy() {
    const db = window.db; const out = $('admLegacy'); if (out) out.innerHTML = '<p class="settings-note">Scanning…</p>';
    try {
      const [dmr, mem, jr] = await Promise.all([db.collection('dm_requests').get(), db.collectionGroup('members').get(), db.collectionGroup('joinRequests').get()]);
      const camps = Object.values(window._adminCampaigns || {});
      AD.legacy = { dmr, mem, jr, camps: camps.map(c => c.id) };
      adminRenderLegacy();
    } catch (e) { if (out) out.innerHTML = `<p class="settings-note">Scan failed: ${esc(err(e))}</p>`; }
  }
  function adminRenderLegacy() {
    const out = $('admLegacy'); const L = AD.legacy; if (!out || !L) return;
    const total = L.dmr.size + L.mem.size + L.jr.size + L.camps.length;
    out.innerHTML = `<ul class="adm-warn"><li class="adm-lv-info"><span>${L.mem.size} campaign member records, ${L.jr.size} join requests, ${L.dmr.size} DM requests</span></li><li class="adm-lv-info"><span>${L.camps.length} old campaign doc${L.camps.length === 1 ? '' : 's'} (the removed DM tool)</span></li></ul>` +
      (total ? '<div class="adm-row"><button type="button" class="settings-action-btn admin-delete-btn" onclick="adminCleanLegacy()">Delete the old link data</button></div>' : '<p class="settings-note">Nothing old left. All clean.</p>');
  }
  async function adminCleanLegacy() {
    const L = AD.legacy; if (!L) return; const db = window.db;
    const ok = await appConfirm('Delete the old campaign data (campaigns, members, join requests, DM requests)? Player sheets are not touched. Take a backup first. This cannot be undone.', { title: 'Clean up old data', confirmText: 'Delete', danger: true });
    if (!ok) return;
    try {
      const docs = [...L.dmr.docs, ...L.mem.docs, ...L.jr.docs];
      for (let i = 0; i < docs.length; i += 400) { const batch = db.batch(); docs.slice(i, i + 400).forEach(d => batch.delete(d.ref)); await batch.commit(); }
      for (let i = 0; i < L.camps.length; i += 400) { const batch = db.batch(); L.camps.slice(i, i + 400).forEach(id => batch.delete(db.collection('campaigns').doc(id))); await batch.commit(); }
      toast('Old campaign data removed', 'success'); await adminLoadCampaigns(); await adminScanLegacy(); adminRenderOverview();
    } catch (e) { toast('Clean up failed: ' + err(e), 'error'); }
  }

  async function adminChangePin() {
    const old = ($('admPinOld') || {}).value || '', n1 = ($('admPinNew') || {}).value || '', n2 = ($('admPinNew2') || {}).value || ''; const st = $('admPinStatus');
    const say = (m, bad) => { if (st) { st.textContent = m; st.className = 'status-message ' + (bad ? 'error' : 'success'); st.style.display = 'block'; } };
    if (!old.trim() || !n1.trim()) return say('Fill in the current PIN and the new one.', true);
    if (n1.trim().length < 4) return say('Use at least 4 characters.', true);
    if (n1.trim() !== n2.trim()) return say('The new PINs do not match.', true);
    try {
      const ref = await getAdminConfigDoc(); const snap = await ref.get(); const data = snap.exists ? snap.data() || {} : {};
      if (String(data.portalPinHash || '') !== await sha256Hex(old.trim())) return say('The current PIN is wrong.', true);
      await ref.set({ portalPinHash: await sha256Hex(n1.trim()), updatedAt: firebase.firestore.FieldValue.serverTimestamp() }, { merge: true });
      ['admPinOld', 'admPinNew', 'admPinNew2'].forEach(i => { const e = $(i); if (e) e.value = ''; }); say('PIN changed.');
    } catch (e) { say('Could not change the PIN: ' + err(e), true); }
  }

  function adminLockPortal() {
    window.__adminPortalUnlocked = false; AD.sheets = []; AD.legacy = null; AD.backupView = null; AD.loadedAt = 0;
    window.__adminUsers = []; window.__adminUsersByUid = {}; window._adminCampaigns = {};
    const pin = $('adminPortalPin'); if (pin) pin.value = '';
    const l = $('adminLockedView'), u = $('adminUnlockedView'); if (l) l.style.display = ''; if (u) u.style.display = 'none';
    window.scrollTo({ top: 0 });
  }

  function adminRenderTools() {
    const info = $('admSystem'); if (!info) return; const u = window.currentUser || {};
    const rows = [['Signed in as', u.email || '—'], ['Project', (window.DND_STAGING ? 'STAGING (local emulators, no real data)' : 'dndcharproject (live)')], ['App version', appVer() || '—'],
      ['Users / sheets / campaigns', `${(window.__adminUsers || []).length} / ${AD.sheets.length} / ${Object.keys(window._adminCampaigns || {}).length}`], ['Loaded', AD.loadedAt ? new Date(AD.loadedAt).toLocaleString() : '—']];
    info.innerHTML = '<div class="adm-table-wrap"><table class="adm-table adm-kv"><tbody>' + rows.map(r => `<tr><th>${esc(r[0])}</th><td>${esc(r[1])}</td></tr>`).join('') + '</tbody></table></div>';
  }
  async function adminCopyDiagnostics() {
    const u = window.currentUser || {};
    const txt = JSON.stringify({ at: new Date().toISOString(), app: appVer(), staging: !!window.DND_STAGING, admin: u.email || '', users: (window.__adminUsers || []).length, sheets: AD.sheets.length, deleted: AD.sheets.filter(s => s.deleted).length, big: AD.sheets.filter(s => s.size >= BIG_KB * 1024).length, campaigns: Object.keys(window._adminCampaigns || {}).length, ua: navigator.userAgent }, null, 2);
    try { await navigator.clipboard.writeText(txt); toast('Diagnostics copied'); } catch (_) { await appAlert(txt, { title: 'Diagnostics' }); }
  }

  // ---------- tabs ----------
  function adminTabShown(id) {
    if (id === 'adminTabOverview') adminRenderOverview();
    else if (id === 'adminTabSheets') adminRenderSheets();
    else if (id === 'adminTabBackup') adminRenderBackup();
    else if (id === 'adminTabTools') { adminRenderTools(); if (!AD.legacy) { const o = $('admLegacy'); if (o && !o.innerHTML.trim()) o.innerHTML = '<p class="settings-note">Press “Scan” to look for old data.</p>'; } else adminRenderLegacy(); }
    else if (id === 'adminTabLogs' && typeof adminInitLogs === 'function') adminInitLogs();
  }

  // delegated clicks for the sheet and backup tables (ids never go through inline onclick)
  document.addEventListener('click', e => {
    const b = e.target.closest && e.target.closest('#admSheetsBody [data-act], #admBackupView [data-act]'); if (!b) return;
    const act = b.dataset.act;
    if (b.closest('#admSheetsBody')) {
      const s = sheetFromRow(b); if (!s) return;
      if (act === 'preview') adminPreviewCharacter(s.uid, s.id);
      else if (act === 'export') adminExportCharacter(s.raw, userOf(s.uid).email || s.uid);
      else if (act === 'restore') adminRestoreSheet(s.uid, s.id);
    } else if (act === 'import') {
      const i = Number(b.closest('tr').dataset.i); const sh = AD.backupView && AD.backupView.sheets[i]; if (!sh) return;
      const u = (AD.backupView.users || []).find(x => x.uid === sh.uid) || {}; adminImportCharObject(sh, sh.uid, u.email); toast('Imported a copy to this device', 'success');
    }
  });
  document.addEventListener('input', e => { if (e.target && e.target.id === 'admSheetSearch') { AD.sheetQuery = e.target.value; adminRenderSheets(); } });
  document.addEventListener('change', e => {
    if (e.target && e.target.id === 'admSheetFilter') { AD.sheetFilter = e.target.value; adminRenderSheets(); }
    if (e.target && e.target.id === 'admSheetSort') { AD.sheetSort = e.target.value; adminRenderSheets(); }
  });

  Object.assign(window, { adminLoadSheets, adminOnUnlock, adminRefreshAll, adminRenderOverview, adminGoTab, adminRestoreSheet, adminBuildBackup, adminDownloadBackup, adminBackupUserDownload,
    adminBackupChosen, adminImportCharObject, adminScanLegacy, adminCleanLegacy, adminChangePin, adminLockPortal, adminCopyDiagnostics, adminTabShown, adminRenderSheets });
})();
