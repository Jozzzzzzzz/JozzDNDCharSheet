// ========== DATA SAFETY LAYER ==========
// Nothing in here changes how the sheet looks. It makes sure a sheet cannot be lost quietly:
//  - loud warning when this device cannot save (storage full), plus an emergency copy in IndexedDB
//  - damaged stored data is kept as a recovery copy and salvaged instead of replaced by "no sheets"
//  - local version history (restore points), "Recently deleted", and a one-tap backup download
//  - the merge logic cloud-skills.js uses so two devices' different edits both survive
// IndexedDB is used for the bulk (history, trash, sync bases) because its quota is far larger than
// localStorage's ~5 MB. Every function degrades to "do nothing" if IndexedDB is unavailable.
(function () {
  const DB_NAME = 'dndSafety', DB_VER = 1;
  const HISTORY_KEEP = 10, HISTORY_GAP_MS = 10 * 60 * 1000, TRASH_KEEP_MS = 30 * 24 * 3600 * 1000;
  let _dbPromise = null;
  const _mem = { base: new Map(), history: [], trash: [], recovery: [] }; // used only if IndexedDB is unavailable

  function idb() {
    if (_dbPromise) return _dbPromise;
    _dbPromise = new Promise(resolve => {
      try {
        const req = indexedDB.open(DB_NAME, DB_VER);
        req.onupgradeneeded = () => {
          const db = req.result;
          if (!db.objectStoreNames.contains('history')) db.createObjectStore('history', { keyPath: 'id', autoIncrement: true }).createIndex('charId', 'charId');
          if (!db.objectStoreNames.contains('trash')) db.createObjectStore('trash', { keyPath: 'id' });
          if (!db.objectStoreNames.contains('recovery')) db.createObjectStore('recovery', { keyPath: 'id', autoIncrement: true });
          if (!db.objectStoreNames.contains('base')) db.createObjectStore('base', { keyPath: 'id' });
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => resolve(null);
        req.onblocked = () => resolve(null);
      } catch (e) { resolve(null); }
    });
    return _dbPromise;
  }
  async function tx(store, mode, fn) {
    const db = await idb(); if (!db) return undefined;
    return new Promise(resolve => {
      try {
        const t = db.transaction(store, mode); const s = t.objectStore(store);
        let out; const r = fn(s); if (r && 'onsuccess' in r) r.onsuccess = () => { out = r.result; };
        t.oncomplete = () => resolve(out); t.onerror = t.onabort = () => resolve(undefined);
      } catch (e) { resolve(undefined); }
    });
  }
  const put = (store, v) => tx(store, 'readwrite', s => s.put(v));
  const get = (store, k) => tx(store, 'readonly', s => s.get(k));
  const getAll = store => tx(store, 'readonly', s => s.getAll()).then(r => r || []);
  const del = (store, k) => tx(store, 'readwrite', s => s.delete(k));

  // ---------- warnings ----------
  function warn(message, opts = {}) {
    try {
      let bar = document.getElementById('dndSafetyBar');
      if (!bar) {
        bar = document.createElement('div'); bar.id = 'dndSafetyBar'; bar.setAttribute('role', 'alert');
        bar.className = 'safety-bar';
        bar.innerHTML = '<span class="safety-bar-text"></span><button type="button" class="safety-bar-x" aria-label="Dismiss">✕</button>';
        bar.querySelector('button').onclick = () => bar.remove();
        document.body.appendChild(bar);
      }
      bar.querySelector('.safety-bar-text').textContent = message;
      bar.classList.toggle('is-info', !!opts.info);
      clearTimeout(bar._t); if (opts.info) bar._t = setTimeout(() => bar.remove(), 9000);
    } catch (e) { /* page not ready */ }
    console.warn('[safety]', message);
  }

  // ---------- hashing + leaves (used for dirty checks and three-way merge) ----------
  function fnv(s) { let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); } return (h >>> 0).toString(36); }
  function stable(v) {
    if (v === null || typeof v !== 'object') return JSON.stringify(v === undefined ? null : v);
    if (Array.isArray(v)) return '[' + v.map(stable).join(',') + ']';
    return '{' + Object.keys(v).sort().map(k => JSON.stringify(k) + ':' + stable(v[k])).join(',') + '}';
  }
  const short = s => (s.length > 48 ? 'h' + s.length + ':' + fnv(s) : s);
  const isPlain = v => v && typeof v === 'object' && !Array.isArray(v);
  // Map key -> { path, raw, n }; only the sheet itself counts (name + data), never ids, clocks or revisions
  function leaves(char) {
    const out = new Map();
    const walk = (v, path) => {
      if (isPlain(v) && Object.keys(v).length) { Object.keys(v).forEach(k => walk(v[k], path.concat(k))); return; }
      out.set(path.join('\u0001'), { path, raw: v, n: short(stable(v)) });
    };
    walk((char && char.data) || {}, ['data']);
    out.set('name', { path: ['name'], raw: (char && char.name) || '', n: short(stable((char && char.name) || '')) });
    return out;
  }
  function leafNs(char) { const o = {}; leaves(char).forEach((l, k) => { o[k] = l.n; }); return o; }
  function sameNs(a, b) {
    const ka = Object.keys(a || {}), kb = Object.keys(b || {});
    if (ka.length !== kb.length) return false;
    for (const k of ka) if (a[k] !== b[k]) return false; return true;
  }
  function setPath(obj, path, value) {
    let o = obj; for (let i = 0; i < path.length - 1; i++) { if (!isPlain(o[path[i]])) o[path[i]] = {}; o = o[path[i]]; }
    o[path[path.length - 1]] = value;
  }
  const tsMs = c => {
    if (!c) return 0;
    if (c.updatedAt && typeof c.updatedAt.toMillis === 'function') return c.updatedAt.toMillis();
    if (c.updatedAt) return Date.parse(c.updatedAt) || 0;
    return Date.parse(c.createdAt || '') || 0;
  };

  // Three-way merge. base = leaf hashes of the last version both sides agreed on.
  // Field changed on one side only -> that change wins. Changed on both -> cloud's value is kept in the
  // merged sheet and the local value is reported as a conflict (the caller keeps it as a copy).
  function merge3(baseNs, local, cloud) {
    const L = leaves(local), C = leaves(cloud); const keys = new Set([...L.keys(), ...C.keys()]);
    const merged = { id: cloud.id || local.id, createdAt: local.createdAt || cloud.createdAt, data: {}, name: '' };
    const conflicts = [];
    keys.forEach(k => {
      const l = L.get(k), c = C.get(k), b = baseNs ? baseNs[k] : undefined; let pick;
      if ((l && l.n) === (c && c.n)) pick = l || c;
      else if ((l && l.n) === b) pick = c;
      else if ((c && c.n) === b) pick = l;
      else { pick = c; conflicts.push({ key: k, path: (l || c).path, local: l ? l.raw : undefined }); }
      if (pick) setPath(merged, pick.path, pick.raw);
    });
    merged.name = merged.name || local.name || cloud.name || 'Unnamed';
    return { merged, conflicts };
  }

  // ---------- sync base (what the cloud looked like the last time this device agreed with it) ----------
  async function getBase(id) {
    const r = await get('base', id); if (r) return r;
    return _mem.base.get(id) || null;
  }
  async function setBase(id, rev, char) {
    const rec = { id, rev: rev || 0, n: leafNs(char), at: Date.now() };
    _mem.base.set(id, rec); await put('base', rec); return rec;
  }
  async function dropBase(id) { _mem.base.delete(id); await del('base', id); }

  // ---------- history (restore points) ----------
  const _lastSnap = new Map();
  async function snapshot(char, reason, force) {
    if (!char || !char.id) return;
    const prev = _lastSnap.get(char.id);
    if (!force && prev && Date.now() - prev.t < HISTORY_GAP_MS) return;      // cheap check first: this runs on every autosave
    const n = leafNs(char); const h = fnv(JSON.stringify(n));
    if (prev && prev.h === h) return;
    _lastSnap.set(char.id, { h, t: Date.now() });
    const rec = { charId: char.id, ts: Date.now(), reason: reason || 'auto', name: char.name || '', json: JSON.stringify(char) };
    if ((await put('history', rec)) === undefined) { _mem.history.push(rec); if (_mem.history.length > 20) _mem.history.shift(); return; }
    const mine = (await getAll('history')).filter(x => x.charId === char.id).sort((a, b) => b.ts - a.ts);
    for (const old of mine.slice(HISTORY_KEEP)) await del('history', old.id);
  }
  const listHistory = async charId => (await getAll('history')).concat(_mem.history).filter(x => !charId || x.charId === charId).sort((a, b) => b.ts - a.ts);

  // ---------- recently deleted ----------
  async function trashChar(char, reason) {
    if (!char) return;
    const rec = { id: char.id, ts: Date.now(), name: char.name || '', reason: reason || 'deleted', json: JSON.stringify(char) };
    if ((await put('trash', rec)) === undefined) _mem.trash.push(rec);
  }
  async function listTrash() {
    const now = Date.now(); const all = (await getAll('trash')).concat(_mem.trash);
    for (const t of all) if (now - t.ts > TRASH_KEEP_MS) await del('trash', t.id);
    return all.filter(t => now - t.ts <= TRASH_KEEP_MS).sort((a, b) => b.ts - a.ts);
  }
  async function dropTrash(id) { _mem.trash = _mem.trash.filter(t => t.id !== id); await del('trash', id); }

  // ---------- damaged data ----------
  const _seenDamaged = new Set();
  // Pull every complete top-level object out of a JSON array that was cut off or corrupted part-way
  function salvageArray(raw) {
    const out = []; let i = raw.indexOf('['); if (i < 0) return out; i++;
    let depth = 0, start = -1, inStr = false, esc = false;
    for (; i < raw.length; i++) {
      const ch = raw[i];
      if (inStr) { if (esc) esc = false; else if (ch === '\\') esc = true; else if (ch === '"') inStr = false; continue; }
      if (ch === '"') inStr = true;
      else if (ch === '{') { if (depth === 0) start = i; depth++; }
      else if (ch === '}') { depth--; if (depth === 0 && start >= 0) { try { out.push(JSON.parse(raw.slice(start, i + 1))); } catch (e) { /* skip */ } start = -1; } }
    }
    return out;
  }
  function recoverRaw(key, raw) {
    const h = fnv(raw); const salvaged = salvageArray(raw);
    if (!_seenDamaged.has(h)) {
      _seenDamaged.add(h);
      const stamp = new Date().toISOString().replace(/[:.]/g, '-');
      try { localStorage.setItem('dndRecovery_' + key + '_' + stamp, raw); } catch (e) { /* full: IndexedDB below */ }
      put('recovery', { key, ts: Date.now(), raw, salvaged: salvaged.length });
      warn(`Some saved data on this device was damaged. A recovery copy was kept${salvaged.length ? ` and ${salvaged.length} sheet${salvaged.length > 1 ? 's were' : ' was'} salvaged` : ''}. See Settings → Sheet safety.`);
    }
    return salvaged;
  }

  // ---------- safe writes ----------
  function safeSet(key, value, opts = {}) {
    try { localStorage.setItem(key, value); if (window.__dndStorageFull) { window.__dndStorageFull = false; const b = document.getElementById('dndSafetyBar'); if (b) b.remove(); } return true; }
    catch (e) {
      window.__dndStorageFull = true;
      put('recovery', { key: 'emergency_' + key, ts: Date.now(), raw: String(value).slice(0, 12 * 1024 * 1024), salvaged: 0 });
      if (!opts.quiet) warn('⚠ This device is out of storage, so your latest changes are NOT saved here. They are being kept in a temporary copy' + (window.currentUser ? ' and sent to the cloud' : '') + '. Free up space (or export your sheet from Settings) now.');
      return false;
    }
  }

  // ---------- backup download ----------
  function downloadBackup() {
    const chars = (window.getStoredJSON ? window.getStoredJSON('dndCharacters', []) : []);
    const blob = new Blob([JSON.stringify({ app: 'JozzDNDCharSheet', exportedAt: new Date().toISOString(), characters: chars }, null, 1)], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'dnd-all-sheets-' + new Date().toISOString().slice(0, 10) + '.json';
    document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  }

  // ---------- settings panel ----------
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const when = ts => new Date(ts).toLocaleString([], { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  async function renderPanel() {
    const box = document.getElementById('safetyPanel'); if (!box) return;
    let used = 0; try { for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); used += k.length + localStorage.getItem(k).length; } } catch (e) { /* ignore */ }
    const usedKB = Math.round(used * 2 / 1024), pct = Math.min(100, Math.round(usedKB / 5120 * 100));
    const cur = window.currentCharacter;
    const hist = cur ? await listHistory(cur) : []; const trash = await listTrash(); const rec = await getAll('recovery');
    const cloudDel = (typeof window.listCloudDeleted === 'function') ? await window.listCloudDeleted().catch(() => []) : [];
    const localIds = new Set(trash.map(t => t.id)); const cloudOnly = cloudDel.filter(c => !localIds.has(c.id));
    const row = (label, sub, btn) => `<div class="safety-row"><div class="safety-row-main"><b>${esc(label)}</b><span>${esc(sub)}</span></div>${btn}</div>`;
    box.innerHTML = `
      <div class="safety-meter" title="Browser storage used on this device"><i style="width:${pct}%"></i></div>
      <p class="safety-note">This device is using about ${usedKB >= 1024 ? (usedKB / 1024).toFixed(1) + ' MB' : usedKB + ' KB'} of roughly 5 MB of browser storage${pct > 80 ? ' — getting full' : ''}.</p>
      <div class="safety-actions"><button type="button" onclick="dndSafety.downloadBackup()">Download backup of all sheets</button></div>
      <h4>Restore points for this sheet</h4>
      ${hist.length ? hist.map(h => row(h.name || 'Sheet', when(h.ts) + ' · ' + h.reason, `<button type="button" onclick="dndSafety.restoreSnapshot(${h.id})">Restore</button>`)).join('') : '<p class="safety-note">None yet. They are made automatically while you edit, and before anything from another device is merged in.</p>'}
      <h4>Recently deleted (kept 30 days)</h4>
      ${(trash.length + cloudOnly.length) ? trash.map(t => row(t.name || 'Sheet', 'deleted ' + when(t.ts), `<button type="button" onclick="dndSafety.restoreTrash('${esc(t.id)}')">Restore</button>`)).join('') + cloudOnly.map(c => row(c.name || 'Sheet', 'deleted on another device', `<button type="button" onclick="dndSafety.restoreCloudDeleted('${esc(c.id)}')">Restore</button>`)).join('') : '<p class="safety-note">Nothing deleted recently.</p>'}
      ${rec.filter(r => !/^emergency_/.test(r.key)).length || rec.length ? `<h4>Recovered copies</h4>${rec.map(r => row((/^emergency_/.test(r.key) ? 'Emergency copy (storage was full)' : 'Damaged data') + ' · ' + r.key.replace('emergency_', ''), when(r.ts) + (r.salvaged ? ' · ' + r.salvaged + ' sheet(s) salvaged' : ''), `<button type="button" onclick="dndSafety.downloadRecovery(${r.id})">Download</button>`)).join('')}` : ''}`;
  }
  async function restoreSnapshot(id) {
    const rec = await get('history', id) || _mem.history.find(h => h.id === id); if (!rec) return;
    const ok = await (window.appConfirm ? window.appConfirm(`Go back to "${rec.name}" as it was on ${when(rec.ts)}? Your current version is saved as a restore point first.`, { confirmText: 'Restore' }) : Promise.resolve(true));
    if (!ok) return;
    const chars = window.getStoredJSON('dndCharacters', []); const i = chars.findIndex(c => c.id === rec.charId);
    if (i >= 0) await snapshot(chars[i], 'before restore', true);
    const back = JSON.parse(rec.json); back.updatedAt = new Date().toISOString();
    if (i >= 0) chars[i] = back; else chars.push(back);
    safeSet('dndCharacters', JSON.stringify(chars));
    if (window.currentCharacter === back.id && typeof window.loadData === 'function') window.loadData();
    if (window.loadCharacterList) window.loadCharacterList();
    if (typeof window.scheduleSyncToCloud === 'function') window.scheduleSyncToCloud();
    warn('Restored "' + back.name + '".', { info: true }); renderPanel();
  }
  async function restoreTrash(id) {
    const rec = await get('trash', id) || _mem.trash.find(t => t.id === id); if (!rec) return;
    const ch = JSON.parse(rec.json); const chars = window.getStoredJSON('dndCharacters', []);
    if (chars.some(c => c.id === ch.id)) ch.id = ch.id + '_restored';
    ch.updatedAt = new Date().toISOString(); chars.push(ch); safeSet('dndCharacters', JSON.stringify(chars));
    try { const m = window.getStoredJSON('dndDeletedCharacters', {}); delete m[rec.id]; delete m[ch.id]; safeSet('dndDeletedCharacters', JSON.stringify(m)); } catch (e) { /* ignore */ }
    await dropTrash(id); await dropBase(ch.id);
    if (window.loadCharacterList) window.loadCharacterList();
    if (typeof window.cloudUndelete === 'function') await window.cloudUndelete(ch);
    warn('Restored "' + ch.name + '".', { info: true }); renderPanel();
  }
  async function restoreCloudDeleted(id) {
    if (typeof window.cloudFetchDeleted !== 'function') return;
    const ch = await window.cloudFetchDeleted(id); if (!ch) return;
    const chars = window.getStoredJSON('dndCharacters', []); if (chars.some(c => c.id === ch.id)) return;
    ch.updatedAt = new Date().toISOString(); chars.push(ch); safeSet('dndCharacters', JSON.stringify(chars));
    try { const m = window.getStoredJSON('dndDeletedCharacters', {}); delete m[ch.id]; safeSet('dndDeletedCharacters', JSON.stringify(m)); } catch (e) { /* ignore */ }
    await dropBase(ch.id); if (window.loadCharacterList) window.loadCharacterList();
    if (typeof window.cloudUndelete === 'function') await window.cloudUndelete(ch);
    warn('Restored "' + ch.name + '".', { info: true }); renderPanel();
  }
  async function downloadRecovery(id) {
    const r = await get('recovery', id); if (!r) return;
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([r.raw], { type: 'application/json' })); a.download = 'dnd-recovery-' + r.key.replace(/[^a-z0-9]+/gi, '-') + '-' + new Date(r.ts).toISOString().slice(0, 10) + '.json';
    document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  }

  // Settings is opened by its own button (openSettingsPage), not by the URL: fill the panel as soon as it opens
  document.addEventListener('click', e => { if (e.target.closest && e.target.closest('[onclick*="openSettingsPage"]')) { setTimeout(renderPanel, 150); setTimeout(renderPanel, 800); } });
  setInterval(() => { const p = document.getElementById('safetyPanel'); if (p && p.offsetParent && !p.matches(':hover') && !p._busy) renderPanel(); }, 4000);

  window.dndSafety = { idb, warn, leaves, leafNs, sameNs, merge3, tsMs, getBase, setBase, dropBase, snapshot, listHistory, trashChar, listTrash, dropTrash,
    recoverRaw, salvageArray, safeSet, downloadBackup, renderPanel, restoreSnapshot, restoreTrash, restoreCloudDeleted, downloadRecovery, fnv };
})();
