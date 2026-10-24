// ========== FEATS + RACIAL FEATURES (Stats → Proficiencies & Training) ==========
// Two extra rows in the proficiency list. A chip on the sheet is just a NAME (saved in the one text box
// like the other rows). What the name grants is looked up here, never copied into the sheet:
//   1. the player's own custom entries (saved once, reused on every character, synced with the account),
//   2. the bundled catalogue assets/data/feats.json (SRD 5.1/5.2, A5e Adventurer's Guide, Tome of Heroes;
//      built by tools/build-feats.js, works offline). REFERENCE DATA ONLY: it never writes to a character.
// Effects (skill expertise / proficiency) are applied to the Skills rows when a feat is added and handed
// back when it is removed. Ability bumps and notes are only shown, never changed on the sheet.
(function () {
  const FEAT_ROW = 'Feats', RACE_ROW = 'Racial Features';
  const CUSTOM_KEY = 'dndCustomFeats';
  const D = { loaded: false, feats: [], traits: [], featMap: new Map(), traitMap: new Map(), credits: '' };

  const norm = s => String(s || '').toLowerCase().replace(/[’']/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
  const esc = s => (typeof escapeHtml === 'function' ? escapeHtml(String(s == null ? '' : s)) : String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])));
  const kindOf = cat => (cat === FEAT_ROW ? 'feat' : 'trait');
  const isFeatRow = cat => cat === FEAT_ROW || cat === RACE_ROW;
  const skillLabel = s => String(s || '').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  const ABS = ['str', 'dex', 'con', 'int', 'wis', 'cha'];
  const ABNAME = { strength: 'str', dexterity: 'dex', constitution: 'con', intelligence: 'int', wisdom: 'wis', charisma: 'cha' };

  // ---------- catalogue ----------
  async function loadFeatCatalogue() {
    if (D.loaded) return D;
    try {
      const v = window.__SCRIPT_VERSION__ || Date.now();
      const j = await (await fetch('assets/data/feats.json?v=' + v)).json();
      D.feats = j.feats || []; D.traits = j.traits || []; D.credits = j.credits || '';
      D.featMap = new Map(); D.feats.forEach(f => { const k = norm(f.n); if (!D.featMap.has(k)) D.featMap.set(k, f); });
      D.traitMap = new Map(); D.traits.forEach(t => { const k = norm(t.n); if (!D.traitMap.has(k)) D.traitMap.set(k, []); D.traitMap.get(k).push(t); });
      D.loaded = true;
      if (typeof renderProfChips === 'function') renderProfChips();
    } catch (e) { console.warn('[feats] catalogue not loaded (offline and not cached yet?)', e); }
    return D;
  }

  // ---------- the player's own library (account-wide) ----------
  function customList() { try { const a = JSON.parse(localStorage.getItem(CUSTOM_KEY) || '[]'); return Array.isArray(a) ? a : []; } catch (e) { return []; } }
  function saveCustom(list) { try { localStorage.setItem(CUSTOM_KEY, JSON.stringify(list)); } catch (e) { /* storage full: the entry just is not saved */ } if (typeof scheduleSyncToCloud === 'function') { try { scheduleSyncToCloud(); } catch (e) { /* not signed in */ } } }
  // Union by id, newest edit wins. Used when the account's prefs arrive from the cloud.
  function featMergeCustom(json) {
    let cloud = []; try { cloud = JSON.parse(json || '[]'); } catch (e) { return; }
    if (!Array.isArray(cloud) || !cloud.length) return;
    const mine = customList(); const byId = new Map(mine.map(c => [c.id, c]));
    let changed = false;
    cloud.forEach(c => { if (!c || !c.id) return; const m = byId.get(c.id); if (!m || (c.u || 0) > (m.u || 0)) { byId.set(c.id, c); changed = true; } });
    if (changed) { try { localStorage.setItem(CUSTOM_KEY, JSON.stringify([...byId.values()])); } catch (e) { /* ignore */ } if (typeof renderProfChips === 'function') renderProfChips(); }
  }

  // ---------- lookup ----------
  function featLookup(cat, text) {
    const n = norm(text); if (!n) return null; const kind = kindOf(cat);
    const mine = customList().find(c => c.kind === kind && norm(c.name) === n);
    if (mine) return { name: mine.name, source: 'Your custom entry', text: mine.desc || '', custom: true, id: mine.id, effects: mine.effects || [] };
    if (kind === 'feat') {
      const f = D.featMap.get(n); if (!f) return null;
      return { name: f.n, source: f.s, type: f.t, prereq: f.p, text: f.d };
    }
    const list = D.traitMap.get(n); if (!list) return null;
    const race = norm((document.getElementById('char_race') || {}).value);
    const pick = (race && list.find(t => norm(t.r) === race)) || (race && list.find(t => race.includes(norm(t.r)) || norm(t.r).includes(race))) || list[0];
    return { name: pick.n, source: pick.s + ' · ' + pick.r, text: pick.d, also: list.filter(t => t !== pick).map(t => t.r).slice(0, 8) };
  }

  const derivedNotes = text => {
    const out = []; const re = /(?:increase|raise)s?\s+your\s+(strength|dexterity|constitution|intelligence|wisdom|charisma)(?:\s+score)?\s+by\s+(\d)/gi; let m;
    while ((m = re.exec(text || ''))) out.push('+' + m[2] + ' ' + ABNAME[m[1].toLowerCase()].toUpperCase());
    return out;
  };

  // ---------- effects on the sheet ----------
  const store = () => { actionsData.featEffects = actionsData.featEffects || {}; actionsData.featApplied = actionsData.featApplied || {}; return actionsData; };
  const effectText = e => e.t === 'expertise' ? 'Expertise: ' + skillLabel(e.skill) : e.t === 'proficiency' ? 'Proficiency: ' + skillLabel(e.skill) : e.t === 'ability' ? '+' + (e.n || 1) + ' ' + String(e.ab || '').toUpperCase() + ' (noted)' : (e.text || '');
  const validSkill = s => typeof SKILL_LIST !== 'undefined' && SKILL_LIST.includes(s);

  function applyFeatEffects(key, effects) {
    const st = store(); const done = st.featApplied[key] = st.featApplied[key] || [];
    (effects || []).forEach(e => {
      if ((e.t !== 'expertise' && e.t !== 'proficiency') || !validSkill(e.skill)) return;
      const want = e.t === 'expertise' ? 3 : 2; const from = getSkillProfLevel(e.skill);
      if (from >= want || done.some(d => d.skill === e.skill && d.to === want)) return;
      setSkillProfLevel(e.skill, want); if (typeof calculateSkillBonus === 'function') calculateSkillBonus(e.skill);
      done.push({ skill: e.skill, from, to: want });
    });
    if (!done.length) delete st.featApplied[key];
  }
  function revertFeatEffects(key) {
    const st = store(); (st.featApplied[key] || []).slice().reverse().forEach(d => {
      if (validSkill(d.skill) && getSkillProfLevel(d.skill) === d.to) { setSkillProfLevel(d.skill, d.from); if (typeof calculateSkillBonus === 'function') calculateSkillBonus(d.skill); }
    });
    delete st.featApplied[key];
  }
  function currentEffects(key) { return (store().featEffects[key] || []); }
  function setEffects(key, list) { const st = store(); if (list.length) st.featEffects[key] = list; else delete st.featEffects[key]; }

  // hooks called by actions.js when a chip is added / removed in the Feats or Racial Features row
  function featOnAdded(cat, text) {
    if (!isFeatRow(cat)) return; const key = norm(text); const info = featLookup(cat, text);
    if (info && info.custom && info.effects && info.effects.length && !currentEffects(key).length) setEffects(key, info.effects.map(e => ({ ...e })));
    applyFeatEffects(key, currentEffects(key));
  }
  function featOnRemoved(cat, text) {
    if (!isFeatRow(cat)) return; const key = norm(text);
    revertFeatEffects(key); setEffects(key, []);
  }

  // short text for the hover tooltip on a chip
  function featTip(cat, text) {
    const info = featLookup(cat, text); const fx = currentEffects(norm(text)).map(effectText);
    if (!info) return text + ' - click to add notes about it (or add it as a custom entry)';
    const body = String(info.text || '').replace(/[•\n]+/g, ' ').replace(/\s+/g, ' ').trim();
    return info.name + ' (' + info.source + ')' + (body ? ': ' + (body.length > 220 ? body.slice(0, 217) + '...' : body) : '') + (fx.length ? '  Grants: ' + fx.join('; ') : '');
  }

  // suggestions for the + box
  function featDatalistHtml(cat) {
    const seen = new Set(); const opts = [];
    const add = (name, label) => { const k = norm(name); if (!k || seen.has(k)) return; seen.add(k); opts.push(`<option value="${esc(name)}" label="${esc(label)}">`); };
    const kind = kindOf(cat);
    customList().filter(c => c.kind === kind).forEach(c => add(c.name, 'Your custom entry'));
    if (kind === 'feat') D.feats.forEach(f => add(f.n, f.s + (f.t ? ' · ' + f.t : '')));
    else D.traits.forEach(t => add(t.n, t.r + ' · ' + t.s));
    return `<datalist id="prof_feat_list">${opts.join('')}</datalist>`;
  }

  // used by "Try sorting again": does this loose text name a known feat or racial trait?
  function featGuess(t) {
    const n = norm(t); if (!n) return null;
    // only exact names: a heading such as "Racial Features — Kalashtar" is not a feature, so it stays in To sort
    const c = customList().find(x => norm(x.name) === n); if (c) return c.kind === 'feat' ? FEAT_ROW : RACE_ROW;
    if (D.featMap.has(n)) return FEAT_ROW;
    if (D.traitMap.has(n) && !/^(speed|size|age|alignment|languages?)$/.test(n)) return RACE_ROW;
    return null;
  }

  // ---------- floating cards (reuse the app's themed dialog look) ----------
  function openCard(html, onMount) {
    const root = (typeof dmEnsureModalRoot === 'function') ? dmEnsureModalRoot() : document.body;
    const bd = document.createElement('div'); bd.className = 'dm-modal-backdrop';
    bd.innerHTML = `<div class="dm-modal feat-modal" role="dialog" aria-modal="true">${html}</div>`;
    root.appendChild(bd); requestAnimationFrame(() => bd.classList.add('show'));
    const close = () => { bd.classList.remove('show'); setTimeout(() => bd.remove(), 200); };
    bd.addEventListener('click', e => { if (e.target === bd) close(); });
    bd.addEventListener('keydown', e => { if (e.key === 'Escape') close(); });
    if (onMount) onMount(bd, close);
    return { bd, close };
  }
  const sel = (id, opts, cur) => `<select id="${id}">${opts.map(([v, l]) => `<option value="${esc(v)}"${v === cur ? ' selected' : ''}>${esc(l)}</option>`).join('')}</select>`;
  const skillOpts = () => (typeof SKILL_LIST !== 'undefined' ? SKILL_LIST : []).map(s => [s, skillLabel(s)]);
  const fxTypeOpts = [['expertise', 'Skill expertise'], ['proficiency', 'Skill proficiency'], ['ability', 'Ability score bonus (noted)'], ['note', 'Note']];

  // an editable list of effects, used by the custom-entry form and the detail card
  function effectsEditor(host, list, onChange) {
    const draw = () => {
      host.innerHTML = `<div class="feat-fx-list">${list.length ? list.map((e, i) => `<span class="prof-chip"><span>${esc(effectText(e))}</span><button type="button" data-rm="${i}" aria-label="Remove effect">✕</button></span>`).join('') : '<span class="prof-empty">No effects yet.</span>'}</div>
        <div class="feat-fx-add">${sel('fxType', fxTypeOpts, 'expertise')}<span id="fxTargetBox"></span><button type="button" class="settings-action-btn" id="fxAdd">Add effect</button></div>`;
      const target = () => {
        const t = host.querySelector('#fxType').value; const box = host.querySelector('#fxTargetBox');
        box.innerHTML = (t === 'expertise' || t === 'proficiency') ? sel('fxSkill', skillOpts()) : t === 'ability' ? sel('fxAb', ABS.map(a => [a, a.toUpperCase()])) + '<input id="fxNum" type="number" min="1" max="4" value="1" style="width:60px">' : '<input id="fxText" type="text" maxlength="120" placeholder="What it does">';
      };
      host.querySelector('#fxType').onchange = target; target();
      host.querySelectorAll('[data-rm]').forEach(b => b.onclick = () => { list.splice(+b.dataset.rm, 1); onChange(list); draw(); });
      host.querySelector('#fxAdd').onclick = () => {
        const t = host.querySelector('#fxType').value; let e = null;
        if (t === 'expertise' || t === 'proficiency') e = { t, skill: host.querySelector('#fxSkill').value };
        else if (t === 'ability') e = { t, ab: host.querySelector('#fxAb').value, n: Math.max(1, parseInt(host.querySelector('#fxNum').value, 10) || 1) };
        else { const x = host.querySelector('#fxText').value.trim(); if (x) e = { t: 'note', text: x }; }
        if (e) { list.push(e); onChange(list); draw(); }
      };
    };
    draw();
  }

  // click on a chip: what it is, what it grants, and the effects applied to this sheet
  function featShow(cat, text) {
    const info = featLookup(cat, text); const key = norm(text);
    const title = info ? info.name : text;
    const derived = info ? derivedNotes(info.text) : [];
    const body = info ? String(info.text || '') : '';
    const credit = info && !info.custom && /SRD/.test(info.source || '') ? 'Contains material from the System Reference Document (CC-BY-4.0, Wizards of the Coast).' : (info && !info.custom ? 'Open-licensed text via Open5e (' + esc(info.source) + ').' : '');
    openCard(`
      <h3 class="dm-modal-title">${esc(title)}</h3>
      <p class="feat-src">${info ? esc(info.source) + (info.type ? ' · ' + esc(info.type) : '') + (info.prereq ? ' · Requires: ' + esc(info.prereq) : '') : 'Not in the catalogue'}</p>
      <div class="feat-body">${body ? esc(body).replace(/\n/g, '<br>') : '<span class="prof-empty">No description saved for this one. Make it a custom entry to write one.</span>'}</div>
      ${derived.length ? `<p class="feat-src">Noted from the text: ${esc(derived.join(', '))} (not changed on your sheet)</p>` : ''}
      ${info && info.also && info.also.length ? `<p class="feat-src">Also found on: ${esc(info.also.join(', '))}</p>` : ''}
      <h4 class="feat-h">Effects on this sheet</h4><div id="featFx"></div>
      <p class="feat-src">Expertise and proficiency effects mark the skill in the Skills list. Everything else is a note.</p>
      ${credit ? `<p class="feat-credit">${credit}</p>` : ''}
      <div class="dm-modal-actions">${info && info.custom ? '<button class="dm-action-btn" id="featEdit">Edit entry</button>' : (!info ? '<button class="dm-action-btn" id="featMake">Make custom entry</button>' : '')}<button class="dm-action-btn accent-contrast-bg" id="featDone">Close</button></div>`,
    (bd, close) => {
      effectsEditor(bd.querySelector('#featFx'), currentEffects(key).map(e => ({ ...e })), list => {
        revertFeatEffects(key); setEffects(key, list); applyFeatEffects(key, list); if (typeof autosave === 'function') autosave(); if (typeof renderProfChips === 'function') renderProfChips();
      });
      bd.querySelector('#featDone').onclick = close;
      const ed = bd.querySelector('#featEdit'); if (ed) ed.onclick = () => { close(); featNewCustom(cat, info.id); };
      const mk = bd.querySelector('#featMake'); if (mk) mk.onclick = () => { close(); featNewCustom(cat, null, text); };
    });
  }

  // create / edit a custom entry (saved once, reusable on every character)
  function featNewCustom(cat, editId, prefillName) {
    const kind = kindOf(cat); const cur = editId ? customList().find(c => c.id === editId) : null;
    const fx = cur && cur.effects ? cur.effects.map(e => ({ ...e })) : [];
    openCard(`
      <h3 class="dm-modal-title">${cur ? 'Edit' : 'New'} custom ${kind === 'feat' ? 'feat' : 'racial feature'}</h3>
      <p class="feat-src">Saved to your account so you can use it on any character.</p>
      <label class="feat-lbl" for="featName">Name</label><input id="featName" type="text" maxlength="60" value="${esc(cur ? cur.name : (prefillName || ''))}" placeholder="e.g. Sharpshooter">
      <label class="feat-lbl" for="featDesc">What it does</label><textarea id="featDesc" rows="5" maxlength="2000" placeholder="Describe it in your own words">${esc(cur ? cur.desc : '')}</textarea>
      <h4 class="feat-h">Effects (optional)</h4><div id="featNewFx"></div>
      <div class="dm-modal-actions">${cur ? '<button class="dm-action-btn dm-danger-btn" id="featDel">Delete</button>' : ''}<button class="dm-action-btn" id="featCancel">Cancel</button><button class="dm-action-btn accent-contrast-bg" id="featSave">Save${cur ? '' : ' and add'}</button></div>`,
    (bd, close) => {
      effectsEditor(bd.querySelector('#featNewFx'), fx, () => {});
      bd.querySelector('#featCancel').onclick = close;
      bd.querySelector('#featName').focus();
      bd.querySelector('#featSave').onclick = () => {
        const name = bd.querySelector('#featName').value.trim().replace(/[,]/g, ' ');
        if (!name) { if (typeof appToast === 'function') appToast('Give it a name', 'error'); return; }
        const list = customList(); const desc = bd.querySelector('#featDesc').value.trim();
        const dup = list.find(c => c.kind === kind && norm(c.name) === norm(name) && c.id !== (cur && cur.id));
        if (dup) { if (typeof appToast === 'function') appToast('You already have one called "' + dup.name + '"', 'error'); return; }
        if (cur) { Object.assign(cur, { name, desc, effects: fx, u: Date.now() }); }
        else list.push({ id: 'cf_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), kind, name, desc, effects: fx, u: Date.now() });
        saveCustom(list); close();
        if (!cur && typeof profAdd === 'function') profAdd(cat, name); else if (typeof renderProfChips === 'function') renderProfChips();
        if (typeof appToast === 'function') appToast('Saved "' + name + '"', 'success');
      };
      const del = bd.querySelector('#featDel');
      if (del) del.onclick = () => notesHandleDelete('feat_' + cur.id, del, () => { saveCustom(customList().filter(c => c.id !== cur.id)); close(); if (typeof renderProfChips === 'function') renderProfChips(); if (typeof appToast === 'function') appToast('Removed from your library (chips already on sheets stay)', 'success'); });
    });
  }

  Object.assign(window, { loadFeatCatalogue, featLookup, featShow, featTip, featNewCustom, featOnAdded, featOnRemoved, featDatalistHtml, featGuess, featMergeCustom, FEAT_ROW, RACE_ROW });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', loadFeatCatalogue); else loadFeatCatalogue();
})();
