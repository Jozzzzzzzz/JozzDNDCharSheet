// DM campaigns. Any user can keep their own campaigns (name, setting, notes, a hand-entered player list).
// There is no password and no link to anyone's character sheet: the DM types in what they want to track.
// Local first (localStorage), mirrored to campaigns/{id} on the user's account when signed in so a new device
// gets them back and the owner-admin can see them. Other users cannot read them (see firestore.rules).

(function () {
  const KEY = 'dndDmCampaigns';
  const ACTIVE_KEY = 'dndDmActiveCampaign';
  const DELETED_KEY = 'dndDmCampaignsDeleted';   // { id: iso } so a deleted campaign is not pulled back from the cloud
  const PUSH_DELAY = 1500;
  const pushTimers = {};

  const esc = s => (typeof escapeHtml === 'function' ? escapeHtml(String(s == null ? '' : s)) : String(s == null ? '' : s));
  const nowIso = () => new Date().toISOString();
  const newId = pre => pre + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

  function readJson(key, fallback) {
    try { const v = JSON.parse(localStorage.getItem(key) || 'null'); return v == null ? fallback : v; } catch (_) { return fallback; }
  }
  function writeJson(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); return true; }
    catch (_) {
      if (window.dndSafety && dndSafety.warn) dndSafety.warn('Your campaigns could not be saved on this device (storage is full).');
      return false;
    }
  }

  function dmcList() { const l = readJson(KEY, []); return Array.isArray(l) ? l : []; }
  function dmcSaveList(list) { writeJson(KEY, list); }
  function dmcActive() {
    const list = dmcList(); if (!list.length) return null;
    let id = ''; try { id = localStorage.getItem(ACTIVE_KEY) || ''; } catch (_) {}
    return list.find(c => c.id === id) || list[0];
  }
  function dmcSetActive(id) {
    try { localStorage.setItem(ACTIVE_KEY, id || ''); } catch (_) {}
    dmcRender();
  }

  // ---- cloud mirror (best effort; never blocks the DM) ----
  function dmcCloudReady() { return !!(window.db && window.currentUser); }

  function dmcPushNow(c) {
    if (!dmcCloudReady() || !c) return Promise.resolve();
    const u = window.currentUser;
    return window.db.collection('campaigns').doc(c.id).set({
      id: c.id, name: c.name || '', setting: c.setting || '', notes: c.notes || '',
      players: c.players || [],
      ownerUid: u.uid, ownerName: u.displayName || '', ownerEmail: u.email || '',
      createdAt: c.createdAt || nowIso(), updatedAt: c.updatedAt || nowIso()
    }).catch(e => console.warn('[dm] campaign cloud save failed:', e && e.message));
  }
  function dmcSchedulePush(c) {
    if (!c) return;
    clearTimeout(pushTimers[c.id]);
    pushTimers[c.id] = setTimeout(() => dmcPushNow(dmcList().find(x => x.id === c.id)), PUSH_DELAY);
  }

  // Bring this device and the account in line. Newest edit wins per campaign; nothing is deleted by a pull.
  async function dmcSyncFromCloud() {
    if (!dmcCloudReady()) return;
    const uid = window.currentUser.uid;
    try {
      const deleted = readJson(DELETED_KEY, {});
      for (const id of Object.keys(deleted)) {            // finish deletes that were made offline
        try { await window.db.collection('campaigns').doc(id).delete(); delete deleted[id]; } catch (_) {}
      }
      writeJson(DELETED_KEY, deleted);
      const snap = await window.db.collection('campaigns').where('ownerUid', '==', uid).get();
      const local = dmcList(); let changed = false;
      const cloudIds = new Set();
      snap.forEach(doc => {
        const c = doc.data() || {}; cloudIds.add(doc.id);
        if (deleted[doc.id]) return;
        const mine = local.find(x => x.id === doc.id);
        const cloudNewer = !mine || String(c.updatedAt || '') > String(mine.updatedAt || '');
        if (!mine) { local.push({ id: doc.id, name: c.name || '', setting: c.setting || '', notes: c.notes || '', players: c.players || [], createdAt: c.createdAt || nowIso(), updatedAt: c.updatedAt || nowIso() }); changed = true; }
        else if (cloudNewer) { Object.assign(mine, { name: c.name || '', setting: c.setting || '', notes: c.notes || '', players: c.players || [], updatedAt: c.updatedAt }); changed = true; }
      });
      if (changed) dmcSaveList(local);
      for (const c of local) {                              // local-only or newer-here campaigns go up
        const cloud = snap.docs.find(d => d.id === c.id);
        if (!cloud || String(c.updatedAt || '') > String((cloud.data() || {}).updatedAt || '')) await dmcPushNow(c);
      }
      dmcRender();
    } catch (e) { console.warn('[dm] campaign sync failed:', e && e.message); }
  }

  // ---- campaigns ----
  async function dmcNewCampaign() {
    const name = await dmModal({ title: 'New campaign', message: 'Give it a name. You can change it later.', input: true, placeholder: 'Campaign name', confirmText: 'Create' });
    if (name === null) return;
    const clean = String(name).trim().slice(0, 80);
    if (!clean) { dmToast('A campaign needs a name.', 'error'); return; }
    const c = { id: newId('camp_'), name: clean, setting: '', notes: '', players: [], createdAt: nowIso(), updatedAt: nowIso() };
    const list = dmcList(); list.push(c); dmcSaveList(list);
    try { localStorage.setItem(ACTIVE_KEY, c.id); } catch (_) {}
    dmcPushNow(c); dmcRender();
  }

  function dmcTouch(c) { c.updatedAt = nowIso(); }

  function dmcEditCampaign(field, value) {
    if (!['name', 'setting', 'notes'].includes(field)) return;
    const list = dmcList(); const c = list.find(x => x.id === (dmcActive() || {}).id); if (!c) return;
    c[field] = String(value).slice(0, field === 'notes' ? 20000 : 80); dmcTouch(c); dmcSaveList(list); dmcSchedulePush(c);
    if (field === 'name') { dmcRenderBanner(); const o = document.querySelector('#dmcSelect option[value="' + c.id + '"]'); if (o) o.textContent = c.name || 'Untitled'; }
  }

  async function dmcDeleteCampaign() {
    const c = dmcActive(); if (!c) return;
    const ok = await dmModal({ title: 'Delete "' + (c.name || 'this campaign') + '"?', message: 'Its player list and notes are removed from this device and your account. Your players\' own character sheets are not touched.', confirmText: 'Delete', danger: true });
    if (!ok) return;
    const list = dmcList().filter(x => x.id !== c.id); dmcSaveList(list);
    const deleted = readJson(DELETED_KEY, {}); deleted[c.id] = nowIso(); writeJson(DELETED_KEY, deleted);
    if (dmcCloudReady()) window.db.collection('campaigns').doc(c.id).delete().then(() => { const d = readJson(DELETED_KEY, {}); delete d[c.id]; writeJson(DELETED_KEY, d); }).catch(() => {});
    try { localStorage.setItem(ACTIVE_KEY, (list[0] || {}).id || ''); } catch (_) {}
    dmcRender(); dmToast('Campaign deleted.', 'success');
  }

  // ---- players (typed in by the DM, never read from anyone's sheet) ----
  const PLAYER_FIELDS = ['name', 'player', 'cls', 'level', 'ac', 'hp', 'pp', 'dc', 'notes'];

  function dmcAddPlayer() {
    const list = dmcList(); const c = list.find(x => x.id === (dmcActive() || {}).id);
    if (!c) { dmToast('Make a campaign first.', 'info'); return; }
    c.players = c.players || []; c.players.push({ id: newId('pl_'), name: '', player: '', cls: '', level: '', ac: '', hp: '', pp: '', dc: '', notes: '' });
    dmcTouch(c); dmcSaveList(list); dmcSchedulePush(c); dmcRenderPlayers();
    const rows = document.querySelectorAll('#dmcPlayersBody .dmc-player [data-f="name"]'); if (rows.length) rows[rows.length - 1].focus();
  }

  function dmcEditPlayer(pid, field, value) {
    if (!PLAYER_FIELDS.includes(field)) return;
    const list = dmcList(); const c = list.find(x => x.id === (dmcActive() || {}).id); if (!c) return;
    const p = (c.players || []).find(x => x.id === pid); if (!p) return;
    p[field] = String(value).slice(0, field === 'notes' ? 5000 : 80); dmcTouch(c); dmcSaveList(list); dmcSchedulePush(c);
    dmcRenderCount();
  }

  async function dmcRemovePlayer(pid) {
    const list = dmcList(); const c = list.find(x => x.id === (dmcActive() || {}).id); if (!c) return;
    const p = (c.players || []).find(x => x.id === pid); if (!p) return;
    const ok = await dmModal({ title: 'Remove ' + (p.name || 'this player') + '?', message: 'Removes them from this campaign\'s list only.', confirmText: 'Remove', danger: true });
    if (!ok) return;
    c.players = c.players.filter(x => x.id !== pid); dmcTouch(c); dmcSaveList(list); dmcSchedulePush(c); dmcRenderPlayers();
  }

  // Fill the encounter builder's party from this list (grouped by level). One-way, and only on request.
  function dmcSendToParty() {
    const c = dmcActive(); const withLevel = ((c && c.players) || []).filter(p => Number(p.level) > 0);
    if (!withLevel.length) { dmToast('Give your players levels first.', 'info'); return; }
    const byLevel = {}; withLevel.forEach(p => { const l = Math.min(20, Math.max(1, Math.round(Number(p.level)))); byLevel[l] = (byLevel[l] || 0) + 1; });
    dmParty = Object.keys(byLevel).map(l => ({ level: Number(l), count: byLevel[l] }));
    if (typeof dmRenderPartyRows === 'function') dmRenderPartyRows();
    if (typeof dmUpdateDifficultyMeter === 'function') dmUpdateDifficultyMeter();
    dmToast('Encounter party set from "' + (c.name || 'your campaign') + '".', 'success');
  }

  // ---- rendering ----
  function dmcRenderBanner() {
    const c = dmcActive(); const el = document.getElementById('dmScreenCampaignLabel');
    if (el) el.textContent = c ? (c.name || 'Untitled') : '';
  }
  function dmcRenderCount() {
    const c = dmcActive(); const el = document.getElementById('dmHomeCampaignPlayers');
    if (el) el.textContent = c ? String((c.players || []).length) : '—';
  }

  function dmcRenderHome() {
    const body = document.getElementById('dmcHomeBody'); if (!body) return;
    const list = dmcList(); const c = dmcActive();
    if (!list.length) {
      body.innerHTML = '<p class="dm-note">No campaigns yet. A campaign holds a name, your notes and a list of your players. Nothing connects to anyone\'s character sheet.</p>' +
        '<button class="dm-action-btn" onclick="dmcNewCampaign()">+ New campaign</button>';
      return;
    }
    body.innerHTML =
      '<div class="dmc-row"><select id="dmcSelect" onchange="dmSetActiveCampaign(this.value)" aria-label="Campaign">' +
      list.map(x => '<option value="' + esc(x.id) + '"' + (x.id === c.id ? ' selected' : '') + '>' + esc(x.name || 'Untitled') + '</option>').join('') +
      '</select><button class="dm-action-btn" onclick="dmcNewCampaign()">+ New</button></div>' +
      '<div class="dmc-grid"><label>Name<input type="text" maxlength="80" value="' + esc(c.name) + '" oninput="dmcEditCampaign(\'name\',this.value)"></label>' +
      '<label>Setting<input type="text" maxlength="80" placeholder="e.g. Homebrew" value="' + esc(c.setting) + '" oninput="dmcEditCampaign(\'setting\',this.value)"></label></div>' +
      '<label class="dmc-wide">Campaign notes<textarea rows="4" placeholder="Anything you want to remember" oninput="dmcEditCampaign(\'notes\',this.value)">' + esc(c.notes) + '</textarea></label>' +
      '<div class="dmc-row"><button class="dm-action-btn dm-danger-btn" onclick="dmcDeleteCampaign()">Delete this campaign</button></div>';
  }

  function dmcRenderPlayers() {
    const body = document.getElementById('dmcPlayersBody'); if (!body) return;
    const c = dmcActive();
    const sub = document.getElementById('dmPlayersSubtitle'); if (sub) sub.textContent = c ? (c.name || 'Untitled') : 'No campaign yet';
    if (!c) { body.innerHTML = '<p class="dm-empty-state">Make a campaign on the DM Home page first.</p>'; return; }
    const players = c.players || [];
    const inp = (p, f, label, ph, w) => '<label class="dmc-f' + (w ? ' ' + w : '') + '">' + label + '<input type="text" data-f="' + f + '" maxlength="80" placeholder="' + (ph || '') + '" value="' + esc(p[f]) + '" oninput="dmcEditPlayer(\'' + p.id + '\',\'' + f + '\',this.value)"></label>';
    body.innerHTML = (players.length ? players.map(p =>
      '<div class="dmc-player">' +
      '<div class="dmc-grid">' + inp(p, 'name', 'Character', 'Name', 'dmc-grow') + inp(p, 'player', 'Player', 'Who plays them', 'dmc-grow') + inp(p, 'cls', 'Class', 'Wizard 3', 'dmc-grow') + '</div>' +
      '<div class="dmc-grid dmc-nums">' + inp(p, 'level', 'Level') + inp(p, 'ac', 'AC') + inp(p, 'hp', 'HP') + inp(p, 'pp', 'Passive Perc.') + inp(p, 'dc', 'Spell DC') + '</div>' +
      '<label class="dmc-wide">Notes<textarea rows="2" placeholder="Bonds, secrets, items, anything" oninput="dmcEditPlayer(\'' + p.id + '\',\'notes\',this.value)">' + esc(p.notes) + '</textarea></label>' +
      '<div class="dmc-row"><button class="dm-action-btn dm-danger-btn" onclick="dmcRemovePlayer(\'' + p.id + '\')">Remove</button></div></div>'
    ).join('') : '<p class="dm-empty-state">No players yet. Add one and fill in what you want to track.</p>');
    dmcRenderCount();
  }

  function dmcRender() { dmcRenderBanner(); dmcRenderHome(); dmcRenderPlayers(); dmcRenderCount(); }

  function dmcOnEnter() { dmcRender(); dmcSyncFromCloud(); }

  Object.assign(window, {
    dmcList, dmcActive, dmSetActiveCampaign: dmcSetActive, dmcNewCampaign, dmcEditCampaign, dmcDeleteCampaign,
    dmcAddPlayer, dmcEditPlayer, dmcRemovePlayer, dmcSendToParty, dmcRender, dmcRenderPlayers, dmcOnEnter, dmcSyncFromCloud
  });
})();
