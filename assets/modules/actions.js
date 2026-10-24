// ========== ACTIONS SYSTEM ==========
let actionsData = {
  actions: []
};

// How many old cards the last migration couldn't confidently place (drives the
// "please review" banner). 0 = nothing to review.
let _actionsNeedReview = 0;

// Keyword hints that a card/spell is a BONUS action rather than a full action.
const _BONUS_HINTS = /\bbonus action\b|\boff-?hand\b|two-?weapon|\bcunning action\b/i;

// Decide a card's timing ('action' | 'bonus') from any hint we can find.
// Explicit `timing` wins; then castingTime/uses text; then description keywords.
function inferActionTiming(a) {
  if (a.timing === 'bonus' || a.timing === 'action') return a.timing;
  const hay = `${a.uses || ''} ${a.castingTime || ''} ${a.category || ''} ${a.description || ''}`;
  if (_BONUS_HINTS.test(hay)) return 'bonus';
  return 'action';
}

// Give every saved card a `timing`. Old saves have none — we infer it once and
// count anything we had to guess purely from description keywords so the UI can
// invite the user to double-check. Never drops or reshapes existing fields.
function migrateActionTiming() {
  _actionsNeedReview = 0;
  (actionsData.actions || []).forEach(a => {
    if (a.timing === 'action' || a.timing === 'bonus') return; // already placed
    const inferred = inferActionTiming(a);
    a.timing = inferred;
    // Flag low-confidence guesses: a bonus guess that came only from prose, or a
    // plain custom card with no source, so the user can move it if we're wrong.
    if (inferred === 'bonus' && !/bonus action/i.test(`${a.uses || ''} ${a.castingTime || ''}`)) {
      a._reviewTiming = true;
      _actionsNeedReview++;
    }
  });
}

// Initialize actions
function initializeActions() {
  loadActions();
  migrateActionTiming();
  displayActions();
  updateFavorites();
}

// Which section is currently being worked in ('action' | 'bonus'). Set whenever
// a section's "+ Add" or "From my kit" button is clicked, so the form/kit know
// where a new card belongs.
let _currentActionTiming = 'action';

// Show the custom add-card form. `timing` = 'action' | 'bonus' (which section
// the button lives in). We keep a single form; a Timing dropdown lets the user
// override it.
function showActionForm(timing) {
  _currentActionTiming = (timing === 'bonus' || timing === 'feature') ? timing : 'action';
  const label = _currentActionTiming === 'bonus' ? 'Bonus Action'
              : (_currentActionTiming === 'feature' ? 'Feature' : 'Action');
  document.getElementById('actionFormTitle').textContent = `Add custom ${label}`;
  document.getElementById('action_name').value = '';
  document.getElementById('action_category').value = _currentActionTiming === 'feature' ? 'other' : 'melee';
  document.getElementById('action_damage').value = '';
  document.getElementById('action_range').value = '';
  document.getElementById('action_uses').value = '';
  document.getElementById('action_attack').value = '';
  document.getElementById('action_description').value = '';
  if (document.getElementById('action_link')) document.getElementById('action_link').value = '';
  if (document.getElementById('action_timing')) document.getElementById('action_timing').value = _currentActionTiming;
  const saveBtn = document.getElementById('saveActionBtn');
  saveBtn.textContent = `Add ${label}`;
  saveBtn.setAttribute('data-action-kind', 'action');
  saveBtn.removeAttribute('data-edit-id');
  showPopup('actionFormPopup');
}

// Update action form based on type
function updateActionForm() {
  const categorySelect = document.getElementById('action_category');
  
  // Clear existing options
  categorySelect.innerHTML = '';
  
  const options = [
    { value: 'melee', text: 'Melee' },
    { value: 'ranged', text: 'Ranged' },
    { value: 'spell', text: 'Spell' },
    { value: 'other', text: 'Other' }
  ];
  options.forEach(option => {
    const optionElement = document.createElement('option');
    optionElement.value = option.value;
    optionElement.textContent = option.text;
    categorySelect.appendChild(optionElement);
  });
}

// Save action
function saveAction() {
  const name = document.getElementById('action_name').value.trim();
  const category = document.getElementById('action_category').value;
  const damage = document.getElementById('action_damage').value.trim();
  const range = document.getElementById('action_range').value.trim();
  const uses = document.getElementById('action_uses').value.trim();
  const attack = document.getElementById('action_attack').value.trim();
  const description = document.getElementById('action_description').value.trim();
  const link = (document.getElementById('action_link') ? document.getElementById('action_link').value.trim() : '');
  const timingEl = document.getElementById('action_timing');
  const validTimings = ['action', 'bonus', 'feature'];
  const timing = (timingEl && validTimings.includes(timingEl.value)) ? timingEl.value : (_currentActionTiming || 'action');
  const editId = document.getElementById('saveActionBtn').getAttribute('data-edit-id');

  if (!name) {
    appToast('Please enter a name for the action.', 'error');
    return;
  }

  const actionData = {
    id: editId || Date.now().toString(),
    name: name,
    type: 'action',
    timing: timing,
    category: category,
    damage: damage,
    range: range,
    uses: uses,
    attack: attack,
    description: description,
    link: link,
    favorite: false
  };

  if (editId) {
    // Editing existing action
    const existingAction = actionsData.actions.find(a => a.id === editId);
    if (existingAction) {
      actionData.favorite = existingAction.favorite; // Preserve favorite status
      actionData.source = existingAction.source || 'custom'; // Preserve where it came from
      delete existingAction._reviewTiming; // user has now confirmed placement
      Object.assign(existingAction, actionData);
    }
  } else {
    // Adding new action
    actionsData.actions.push(actionData);
  }

  saveActions();
  displayActions();
  updateFavorites();
  closePopup('actionFormPopup');
  autosave();
}

// Display actions — splits the single list into three timing sections:
// Actions (#actions_list), Bonus Actions (#bonus_actions_list), Features &
// Traits (#features_list). The `type` arg is ignored (kept for old callers).
const _SECTION_EMPTY = {
  action: 'No actions yet. Use “From my kit”, search, or “+ Add” to build your list.',
  bonus: 'No bonus actions yet. Add bonus-action spells, off-hand attacks, or a custom card.',
  feature: 'No features or traits yet. Pull racial traits from your kit, or add your own.'
};

function _renderSection(timing, containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = '';
  const list = (actionsData.actions || []).filter(a => (a.timing || 'action') === timing);
  if (!list.length) {
    container.innerHTML = `<p class="actions-empty">${_SECTION_EMPTY[timing] || 'Nothing here yet.'}</p>`;
    return;
  }
  list.forEach(action => container.appendChild(createActionCard(action, timing)));
}

function displayActions(type) {
  if (typeof renderCompanions === 'function') renderCompanions();
  // Only bail if none of the containers exist (stats page not loaded yet).
  if (!document.getElementById('actions_list') &&
      !document.getElementById('bonus_actions_list') &&
      !document.getElementById('features_list')) return;
  _renderSection('action', 'actions_list');
  _renderSection('bonus', 'bonus_actions_list');
  _renderSection('feature', 'features_list');
  renderActionsReviewBanner();
}

// Show a dismissible banner when migration auto-placed cards it wasn't sure of.
function renderActionsReviewBanner() {
  const el = document.getElementById('actionsReviewBanner');
  if (!el) return;
  const n = (actionsData.actions || []).filter(a => a._reviewTiming).length;
  if (!n) { el.style.display = 'none'; el.innerHTML = ''; return; }
  el.style.display = '';
  el.innerHTML =
    `<span>${n} card${n === 1 ? '' : 's'} ${n === 1 ? 'was' : 'were'} auto-sorted and may belong in a different section. ` +
    `Edit any card to confirm or move it.</span>` +
    `<button class="actions-review-dismiss" onclick="dismissActionsReview()">Got it</button>`;
}

// Clear the review flags (user acknowledged) and persist.
function dismissActionsReview() {
  (actionsData.actions || []).forEach(a => { delete a._reviewTiming; });
  _actionsNeedReview = 0;
  saveActions();
  autosave();
  renderActionsReviewBanner();
}

// Create action card
// Track which action cards are expanded (survives re-renders within a session).
let _expandedActions = new Set();

function toggleActionExpand(id) {
  if (_expandedActions.has(id)) _expandedActions.delete(id);
  else _expandedActions.add(id);
  displayActions();
  updateFavorites();
}

function createActionCard(action, type) {
  const card = document.createElement('div');
  const esc = window.escapeHtml || ((s) => String(s));
  const expanded = _expandedActions.has(action.id);
  card.className = `action-card ${action.favorite ? 'favorite' : ''} ${expanded ? 'action-card-expanded' : ''}`;
  const srcBadge = action.source && action.source !== 'custom'
    ? `<span class="action-source-badge action-source-${action.source}">${esc(action.source)}</span>` : '';

  // A long description collapses to a clamp with a View more toggle.
  const desc = action.description || '';
  const isLong = desc.length > 120;
  const descBlock = desc
    ? `<div class="action-description ${(isLong && !expanded) ? 'action-desc-clamp' : ''}">${esc(desc)}</div>`
    : '';
  const linkBlock = action.link
    ? `<a class="action-ref-link" href="${esc(action.link)}" target="_blank" rel="noopener">View rules</a>`
    : '';
  const viewMore = (isLong || action.link)
    ? `<button class="action-viewmore-btn" onclick="toggleActionExpand('${action.id}')">${expanded ? 'View less' : 'View more'}</button>`
    : '';

  card.innerHTML = `
    <div class="action-header">
      <h4 class="action-name">${esc(action.name)}</h4>
      <span class="action-type">${esc(action.category)}${srcBadge}</span>
    </div>
    <div class="action-stats">
      ${action.damage ? `<div class="action-stat"><span class="action-stat-label">Damage/Effect:</span><span class="action-stat-value">${esc(action.damage)}</span></div>` : ''}
      ${action.range ? `<div class="action-stat"><span class="action-stat-label">Range/Area:</span><span class="action-stat-value">${esc(action.range)}</span></div>` : ''}
      ${action.uses ? `<div class="action-stat"><span class="action-stat-label">Uses:</span><span class="action-stat-value">${esc(action.uses)}</span></div>` : ''}
      ${action.attack ? `<div class="action-stat"><span class="action-stat-label">Attack/Save:</span><span class="action-stat-value">${esc(action.attack)}</span></div>` : ''}
    </div>
    ${descBlock}
    ${(viewMore || linkBlock) ? `<div class="action-more-row">${viewMore}${(expanded || !isLong) ? linkBlock : ''}</div>` : ''}
    <div class="action-actions">
      <button class="action-btn favorite-btn ${action.favorite ? 'favorited' : ''}" onclick="toggleActionFavorite('${action.id}', '${type}')" title="${action.favorite ? 'Unfavourite' : 'Favourite'}">
        <span class="fav-star">&#9733;</span>
      </button>
      <button class="action-btn edit-btn" onclick="editAction('${action.id}', '${type}')" title="Edit">Edit</button>
      <button class="action-btn delete-btn" onclick="deleteAction('${action.id}', '${type}')" title="Delete">Del</button>
    </div>
  `;
  return card;
}

// Toggle favorite
function toggleActionFavorite(id, type) {
  const action = actionsData.actions.find(a => a.id === id);
  if (action) {
    action.favorite = !action.favorite;
    saveActions();
    displayActions('action');
    updateFavorites();
    autosave();
  }
}

// Edit action
function editAction(id, type) {
  const action = actionsData.actions.find(a => a.id === id);
  if (!action) return;
  const timing = action.timing || 'action';
  _currentActionTiming = timing;
  const label = timing === 'bonus' ? 'Bonus Action' : (timing === 'feature' ? 'Feature' : 'Action');
  document.getElementById('actionFormTitle').textContent = `Edit ${label}`;
  document.getElementById('action_name').value = action.name || '';
  document.getElementById('action_category').value = action.category || 'other';
  document.getElementById('action_damage').value = action.damage || '';
  document.getElementById('action_range').value = action.range || '';
  document.getElementById('action_uses').value = action.uses || '';
  document.getElementById('action_attack').value = action.attack || '';
  document.getElementById('action_description').value = action.description || '';
  if (document.getElementById('action_link')) document.getElementById('action_link').value = action.link || '';
  if (document.getElementById('action_timing')) document.getElementById('action_timing').value = timing;
  const saveBtn = document.getElementById('saveActionBtn');
  saveBtn.textContent = `Update ${label}`;
  saveBtn.setAttribute('data-edit-id', id);
  saveBtn.setAttribute('data-action-kind', 'action');
  showPopup('actionFormPopup');
}

// Delete action
function deleteAction(id, type) {
  appConfirm('Are you sure you want to delete this action?', { confirmText: 'Delete' }).then(ok => {
    if (!ok) return;
    const index = actionsData.actions.findIndex(a => a.id === id);
    if (index > -1) {
      actionsData.actions.splice(index, 1);
      saveActions();
      displayActions();
      updateFavorites();
      autosave();
    }
  });
}

// Clear all actions
function clearAllActions(type) {
  appConfirm('Are you sure you want to clear all actions? This cannot be undone.', { confirmText: 'Clear all' }).then(ok => {
    if (!ok) return;
    actionsData.actions = [];
    saveActions();
    displayActions();
    updateFavorites();
    autosave();
  });
}

// Update favorites display
function updateFavorites() {
  const favoritesActions = actionsData.actions.filter(action => action.favorite);
  
  const actionsContainer = document.getElementById('favorites_actions_list');
  
  actionsContainer.innerHTML = '';
  
  if (favoritesActions.length === 0) {
    actionsContainer.innerHTML = '<p style="text-align: center; color: var(--text); opacity: 0.7;">No favorite actions yet.</p>';
  } else {
    favoritesActions.forEach(action => {
      const actionCard = createActionCard(action, 'action');
      actionsContainer.appendChild(actionCard);
    });
  }
}

// ========== "FROM MY KIT" — timing-aware pull from weapons / spells / items / traits ==========
// Everything here is REFERENCE DATA the player picks FROM. It only ever pushes
// new cards into this character's own actionsData; it never reads or writes
// another character, inventory, or the cloud directly (autosave persists the
// active character only). Spell/item/race catalogues are loaded read-only.

// The picker + search operate on ONE timing at a time ('action'|'bonus'|'feature'),
// set from whichever section opened them.
let _kitTiming = 'action';

// The standard things every 5e character can do, split by when they happen.
const UNIVERSAL_ACTIONS_LINK = 'https://open5e.com/sections/actions-in-combat';
const UNIVERSAL_BY_TIMING = {
  action: [
    { name: 'Unarmed Strike', category: 'melee', damage: '1 + STR (bludgeoning)', range: 'Melee', attack: 'STR attack', description: 'A punch, kick, head-butt or similar. On a hit: 1 + your Strength modifier bludgeoning damage. (You may instead grapple or shove.)' },
    { name: 'Dash', category: 'other', range: 'Self', description: 'Gain extra movement equal to your speed for this turn (after applying any modifiers).' },
    { name: 'Disengage', category: 'other', range: 'Self', description: 'Your movement doesn\'t provoke opportunity attacks for the rest of the turn.' },
    { name: 'Dodge', category: 'other', range: 'Self', description: 'Until your next turn: attacks against you have disadvantage (if you can see the attacker) and you make Dex saves with advantage. Lost if incapacitated or speed 0.' },
    { name: 'Help', category: 'other', range: 'Melee / 5 ft', description: 'Give an ally advantage on their next ability check, or on their next attack against a creature within 5 ft of you (before your next turn).' },
    { name: 'Hide', category: 'other', range: 'Self', attack: 'Dexterity (Stealth)', description: 'Make a Dexterity (Stealth) check to become hidden from creatures that can\'t see you.' },
    { name: 'Ready', category: 'other', range: 'Self', description: 'Choose a trigger and a prepared action (or move). When the trigger occurs, use your reaction to act. Readied spells require concentration.' },
    { name: 'Search', category: 'other', range: 'Self', attack: 'Perception / Investigation', description: 'Devote your attention to finding something — make a Wisdom (Perception) or Intelligence (Investigation) check.' },
    { name: 'Grapple', category: 'melee', range: 'Melee', attack: 'STR (Athletics) vs STR/DEX', description: 'Replaces one attack. Target no more than one size larger. Contested check — on success the target is grappled (speed 0).' },
    { name: 'Shove', category: 'melee', range: 'Melee', attack: 'STR (Athletics) vs STR/DEX', description: 'Replaces one attack. Target no more than one size larger. Contested check — on success, push it 5 ft away or knock it prone.' }
  ],
  bonus: [
    { name: 'Two-Weapon Attack (off-hand)', category: 'melee', range: 'Melee', attack: 'as weapon (no ability mod to damage)', description: 'When you take the Attack action with a light melee weapon in one hand, you can use a bonus action to attack with a different light melee weapon in the other hand. You don\'t add your ability modifier to the off-hand damage unless it\'s negative.' },
    { name: 'Off-Hand / Bonus Action', category: 'other', range: 'Self', description: 'A generic slot for a class/feat bonus action (Second Wind, Cunning Action, Rage, etc.). Edit the description to match your feature.' }
  ],
  feature: []
};

// ---- spell helpers ----
function spellIsActionable(sp) {
  return !!(sp && ((sp.attack && sp.attack.trim()) || (sp.save && sp.save.trim()) || (sp.damage && sp.damage.trim())));
}
function spellOpen5eLink(sp) {
  if (sp && sp.wikiLink) return sp.wikiLink;
  if (typeof open5eSpellLink === 'function') return open5eSpellLink((sp && (sp.open5eSlug || sp.name)) || '');
  return '';
}
// Which section does a spell belong in, by casting time? Actions vs bonus.
// Reactions/rituals/longer casts aren't turn actions → not offered.
function spellTiming(sp) {
  const ct = (sp && (sp.castingTime || sp.casting_time) || '').toLowerCase();
  if (ct.includes('bonus')) return 'bonus';
  if (ct.includes('reaction')) return null;
  if (ct.includes('1 action')) return 'action';
  return null; // minutes/hours/rituals — not an in-combat action
}
function spellToKitAction(sp) {
  const isCantrip = Number(sp.level) === 0;
  const lvl = isCantrip ? 'Cantrip' : `Level ${sp.level}`;
  const atkSave = [sp.attack, sp.save].filter(Boolean).join(' / ');
  return {
    source: 'spell', name: sp.name, category: 'spell',
    damage: sp.damage || '', range: sp.range || '', attack: atkSave,
    uses: lvl, description: sp.summary || sp.description || '', link: spellOpen5eLink(sp),
    _timing: spellTiming(sp),
    // Carried so the "your sheet" search can float prepared-table spells to the top.
    _prepared: !!sp.prepared, _cantrip: isCantrip
  };
}

// ---- item helpers (inventory instant; Open5e magic items lazy on "Show all") ----
let _open5eItems = null; // cached array once loaded; null = not yet fetched
function loadOpen5eItemsOnce() {
  if (_open5eItems !== null) return Promise.resolve(_open5eItems);
  return fetch('assets/data/open5e/magicitems.json')
    .then(r => r.ok ? r.json() : [])
    .then(arr => {
      // Open5e fixture shape: [{ fields:{ name, type, rarity, desc, ... } }]
      _open5eItems = (Array.isArray(arr) ? arr : []).map(e => {
        const f = e.fields || e;
        return { name: f.name || '', rarity: f.rarity || '', itemType: f.type || '', desc: (f.desc || '').replace(/\s+/g, ' ').trim(), slug: (f.slug || (f.name || '').toLowerCase().replace(/\s+/g, '-')) };
      // Drop the generic "Weapon, +1, +2, or +3" reference entry — a weapon's
      // magic bonus is set with the +N field on the weapon itself.
      }).filter(i => i.name && !/^(weapon|ammunition|armou?r|shield),?\s*\+?\d/i.test(i.name));
      return _open5eItems;
    })
    .catch(() => { _open5eItems = []; return _open5eItems; });
}
// Your owned items (from the active character's inventory) as kit candidates.
// inventoryData is an OBJECT with equipment / mainInventory / storageContainers.
// We read them all, de-dupe by name, and never mutate inventory.
function ownedItemsAsKit() {
  const inv = (typeof inventoryData === 'object' && inventoryData) ? inventoryData : {};
  const buckets = [inv.equipment, inv.mainInventory];
  (inv.storageContainers || []).forEach(c => { if (c && Array.isArray(c.items)) buckets.push(c.items); });
  const seen = new Set();
  const out = [];
  buckets.forEach(list => (Array.isArray(list) ? list : []).forEach(it => {
    if (!it || !it.name) return;
    const k = it.name.toLowerCase();
    if (seen.has(k)) return;
    seen.add(k);
    out.push({
      source: 'item', name: it.name, category: 'other', range: '', damage: '', attack: '',
      uses: it.quantity ? `×${it.quantity}` : '', description: it.description || it.notes || '', link: ''
    });
  }));
  return out;
}

// ---- race trait helpers (Features & Traits section) ----
let _raceData = null;
function loadRaceDataOnce() {
  if (_raceData !== null) return Promise.resolve(_raceData);
  return fetch('assets/data/races.json')
    .then(r => r.ok ? r.json() : [])
    .then(arr => { _raceData = Array.isArray(arr) ? arr : []; return _raceData; })
    .catch(() => { _raceData = []; return _raceData; });
}
function traitToKitAction(t, raceName) {
  return {
    source: 'trait', name: t.name, category: 'other', range: '', damage: '', attack: '',
    uses: raceName || '', description: t.description || '', link: ''
  };
}

// Set of "source::name" keys already on the list, for de-dupe / ✓ Added flags.
function _haveKeys() {
  return new Set((actionsData.actions || []).map(a => `${a.source || 'custom'}::${(a.name || '').toLowerCase()}`));
}

// Build the kit for the CURRENT timing from the character's own weapons/spells/
// items/traits + the universal set. Returns grouped candidates flagged _added.
function buildActionKit() {
  const timing = _kitTiming;
  const have = _haveKeys();
  const kit = { universal: [], weapons: [], spells: [], items: [], traits: [] };

  // Universal actions for this timing
  (UNIVERSAL_BY_TIMING[timing] || []).forEach(u => kit.universal.push({ ...u, source: 'universal', uses: u.uses || '', link: UNIVERSAL_ACTIONS_LINK }));

  if (timing === 'action') {
    // Weapons are attack actions
    const weapons = (typeof weaponsData !== 'undefined' && Array.isArray(weaponsData)) ? weaponsData : [];
    weapons.forEach(w => {
      if (!w || !w.name) return;
      const ranged = /(ranged|thrown|ammunition|bow|crossbow|dart|javelin|sling)/i.test(`${w.properties || ''} ${w.name}`);
      const dmg = [w.damage, w.bonusDamage].filter(Boolean).join(' + ');
      kit.weapons.push({
        source: 'weapon', name: w.name, category: ranged ? 'ranged' : 'melee',
        damage: dmg, range: ranged ? 'Ranged' : 'Melee', attack: w.toHit || '',
        uses: '', description: w.properties ? `Properties: ${w.properties}${w.notes ? ' — ' + w.notes : ''}` : (w.notes || ''), link: ''
      });
    });
  }

  if (timing === 'action' || timing === 'bonus') {
    // Your spells that are actionable AND cast at this timing
    const sd = (typeof spellsData !== 'undefined' && spellsData) ? spellsData : null;
    const spellList = sd ? [...(sd.cantrips || []), ...(sd.spells || [])] : [];
    spellList.forEach(sp => {
      if (!spellIsActionable(sp)) return;
      const cand = spellToKitAction(sp);
      if (cand._timing === timing) kit.spells.push(cand);
    });
    // Your owned items (both sections — an item can be used either way)
    ownedItemsAsKit().forEach(it => kit.items.push(it));
  }

  // Race traits only populate once loaded (async); showActionKitPicker triggers it.
  if (timing === 'feature' && _raceData) {
    _raceData.forEach(r => (r.traits || []).forEach(t => kit.traits.push(traitToKitAction(t, r.name))));
  }

  const flag = (a) => ({ ...a, _added: have.has(`${a.source}::${(a.name || '').toLowerCase()}`) });
  Object.keys(kit).forEach(k => { kit[k] = kit[k].map(flag); });
  return kit;
}

// Open the picker for a given section timing.
function showActionKitPicker(timing) {
  _kitTiming = (timing === 'bonus' || timing === 'feature') ? timing : 'action';
  _currentActionTiming = _kitTiming;
  const titleEl = document.getElementById('actionKitTitle');
  if (titleEl) titleEl.textContent = _kitTiming === 'bonus' ? 'Add bonus actions from sheet' : (_kitTiming === 'feature' ? 'Add features & traits from sheet' : 'Add actions from sheet');
  const search = document.getElementById('actionKitSearch');
  if (search) search.value = '';
  _kitShowAll = false;
  const allToggle = document.getElementById('actionKitShowAll');
  if (allToggle) allToggle.checked = false;
  // Kick off async catalogue loads this section needs, then (re)render.
  const after = () => { renderActionKit(); renderActionKitSearch(''); };
  if (_kitTiming === 'feature') { loadRaceDataOnce().then(after); }
  else { after(); }
  showPopup('actionKitPopup');
}

// "Show all" toggles the search scope between this-timing-only and everything
// (for homebrew / grabbing an off-timing spell on purpose).
let _kitShowAll = false;
function toggleActionKitShowAll() {
  const el = document.getElementById('actionKitShowAll');
  _kitShowAll = !!(el && el.checked);
  // Flipping to "everything" may need catalogues that aren't loaded yet.
  if (_kitShowAll) {
    if (_kitTiming === 'feature') { loadRaceDataOnce().then(() => onActionKitSearch()); return; }
    if (_open5eItems === null) { loadOpen5eItemsOnce().then(() => onActionKitSearch()); }
  }
  onActionKitSearch();
}

// ── Search the full local catalogue for this section (offline). ──
// action/bonus → spells (routed by casting time unless Show all); also owned +
// Open5e items. feature → race traits. Results add as normal cards.
let _actionKitSearchCache = [];

// The pool of things ON YOUR SHEET for this section (weapons/spells/items for
// action & bonus, race traits already-relevant for features, + the universal/
// default actions). This is what the search looks at when the toggle is OFF.
function mySheetCandidates(timing) {
  const kit = buildActionKit(); // already timing-scoped to _kitTiming
  const pool = [];
  Object.keys(kit).forEach(k => (kit[k] || []).forEach(c => pool.push(c)));
  return pool;
}

function renderActionKitSearch(query) {
  const out = document.getElementById('actionKitSearchResults');
  if (!out) return;
  const q = (query || '').trim().toLowerCase();
  const timing = _kitTiming;

  if (!q) {
    const scope = _kitShowAll ? 'everything in D&amp;D 5e' : 'your sheet';
    const hint = timing === 'feature'
      ? (_kitShowAll ? 'Search all racial traits (Darkvision, Fey Ancestry, Breath Weapon…).' : 'Search your race’s traits — flip the toggle to browse every racial trait.')
      : `Searching ${scope}. ${_kitShowAll ? 'All spells, cantrips &amp; Open5e items, any timing.' : 'Your weapons, spells, items &amp; the default actions — your prepared spells &amp; cantrips show first. Flip the toggle to search everything.'}`;
    out.innerHTML = `<p class="kit-empty">${hint}</p>`;
    _actionKitSearchCache = [];
    return;
  }

  const have = _haveKeys();
  let matches = [];
  const nameHit = (n) => (n || '').toLowerCase().includes(q);

  if (!_kitShowAll) {
    // ── My sheet only ── search the current section's own candidates.
    mySheetCandidates(timing).forEach(c => {
      if (nameHit(c.name) || (c.description || '').toLowerCase().includes(q) || (c.uses || '').toLowerCase().includes(q)) {
        matches.push(c);
      }
    });
  } else if (timing === 'feature') {
    // ── Everything: all racial traits from every race in the catalogue.
    (_raceData || []).forEach(r => (r.traits || []).forEach(t => {
      if (nameHit(t.name) || (t.description || '').toLowerCase().includes(q) || (r.name || '').toLowerCase().includes(q)) {
        matches.push(traitToKitAction(t, r.name));
      }
    }));
  } else {
    // ── Everything: full spell catalogue (all timings) + Open5e magic items.
    const db = (typeof spellDatabase !== 'undefined' && spellDatabase) ? spellDatabase : {};
    Object.values(db).forEach(sp => {
      if (!sp || !sp.name) return;
      const hit = nameHit(sp.name) || (sp.school || '').toLowerCase().includes(q) ||
                  (sp.damage || '').toLowerCase().includes(q) || (sp.classes || []).join(' ').toLowerCase().includes(q);
      if (hit) matches.push(spellToKitAction(sp));
    });
    if (_open5eItems) {
      _open5eItems.forEach(it => {
        if (nameHit(it.name)) matches.push({
          source: 'item', name: it.name, category: 'other', range: '', damage: '', attack: '',
          uses: [it.rarity, it.itemType].filter(Boolean).join(' · '), description: it.desc || '',
          link: `https://open5e.com/magic-items/${it.slug}`
        });
      });
    } else if (_open5eItems === null) {
      loadOpen5eItemsOnce().then(() => onActionKitSearch()); // lazy load, then re-render
    }
  }

  // On the "your sheet" view, prepared-table spells are what the player actually
  // has ready — float them (stable) to the top so they show first, then the rest.
  const isReady = (c) => !_kitShowAll && c && c.source === 'spell' && c._prepared;
  matches = matches.sort((a, b) => {
    const ra = isReady(a) ? 0 : 1, rb = isReady(b) ? 0 : 1;
    if (ra !== rb) return ra - rb;              // ready group first
    return a.name.localeCompare(b.name);        // then alphabetical within group
  }).slice(0, 50);
  _actionKitSearchCache = matches;

  if (!matches.length) { out.innerHTML = `<p class="kit-empty">No matches for “${escapeHtml(query)}”${!_kitShowAll ? ' on your sheet — flip the toggle to search everything.' : '.'}</p>`; return; }

  const readyCount = matches.filter(isReady).length;
  const hasGroups = readyCount > 0 && readyCount < matches.length;

  out.innerHTML = matches.map((c, idx) => {
    const added = have.has(`${c.source}::${c.name.toLowerCase()}`);
    const meta = [c.uses, c.damage, c.range].filter(Boolean).join(' · ');
    const link = c.link;
    const ready = isReady(c);
    // Matches are sorted ready-first, so a header goes wherever the ready state
    // changes from the previous row (i.e. the first row of each group).
    let header = '';
    if (hasGroups && (idx === 0 || isReady(matches[idx - 1]) !== ready)) {
      header = ready
        ? '<div class="kit-group-header">★ Ready — prepared &amp; cantrips</div>'
        : '<div class="kit-group-header">Other spells on your sheet</div>';
    }
    const readyTag = ready ? `<span class="kit-ready-tag">${c._cantrip ? 'Cantrip' : 'Prepared'}</span>` : '';
    return `${header}
      <div class="kit-row ${added ? 'kit-row-added' : ''} ${ready ? 'kit-row-ready' : ''}">
        <div class="kit-row-info">
          <span class="kit-row-name">${escapeHtml(c.name)}${readyTag}${link ? ` <a class="kit-row-link" href="${escapeHtml(link)}" target="_blank" rel="noopener" title="View on Open5e">link</a>` : ''}<span class="kit-src-tag kit-src-${c.source}">${escapeHtml(c.source)}</span></span>
          <span class="kit-row-meta">${escapeHtml(meta)}</span>
        </div>
        ${added ? '<span class="kit-added-tag">✓ Added</span>'
                : `<button class="kit-add-btn" onclick="addKitSearchResult(${idx})">+ Add</button>`}
      </div>`;
  }).join('');
}

function onActionKitSearch() {
  const el = document.getElementById('actionKitSearch');
  renderActionKitSearch(el ? el.value : '');
}

function addKitSearchResult(idx) {
  const c = _actionKitSearchCache[idx];
  if (!c) return;
  addKitAction(c);
  onActionKitSearch(); // refresh ✓ Added
}

// Cached grouped kit so onclick can reference candidates by group+index.
let _actionKitCache = { universal: [], weapons: [], spells: [], items: [], traits: [] };
function renderActionKit() {
  const kit = buildActionKit();
  _actionKitCache = kit;
  const groupDefs = {
    action:  [ ['universal','Universal Actions'], ['weapons','Weapons'], ['spells','Attack / Save Spells'], ['items','Your Items'] ],
    bonus:   [ ['universal','Bonus-Action Basics'], ['spells','Bonus-Action Spells'], ['items','Your Items'] ],
    feature: [ ['traits','Racial Traits'] ]
  }[_kitTiming];

  const section = ([key, label]) => {
    const list = kit[key] || [];
    const rows = list.length ? list.map((a, idx) => `
      <div class="kit-row ${a._added ? 'kit-row-added' : ''}">
        <div class="kit-row-info">
          <span class="kit-row-name">${escapeHtml(a.name)}</span>
          <span class="kit-row-meta">${escapeHtml([a.uses, a.damage, a.range].filter(Boolean).join(' · '))}</span>
        </div>
        ${a._added ? '<span class="kit-added-tag">✓ Added</span>'
                   : `<button class="kit-add-btn" onclick="addKitActionByRef('${key}', ${idx})">+ Add</button>`}
      </div>`).join('')
      : `<p class="kit-empty">Nothing here yet.</p>`;
    const addable = list.filter(a => !a._added).length;
    return `
      <div class="kit-group">
        <div class="kit-group-head">
          <h4>${escapeHtml(label)}</h4>
          ${addable > 1 ? `<button class="kit-add-all" onclick="addAllKitActions('${key}')">+ Add all ${addable}</button>` : ''}
        </div>
        ${rows}
      </div>`;
  };
  const body = document.getElementById('actionKitBody');
  if (body) body.innerHTML = groupDefs.map(section).join('');
}

function addKitActionByRef(groupKey, idx) {
  const candidate = (_actionKitCache[groupKey] || [])[idx];
  if (candidate) addKitAction(candidate);
}

// Add one kit candidate as a normal card, at the CURRENT section timing.
// Deduped by source+name so re-adds are no-ops.
function addKitAction(candidate) {
  if (!candidate || !candidate.name) return;
  const key = `${candidate.source || 'custom'}::${candidate.name.toLowerCase()}`;
  const exists = (actionsData.actions || []).some(a => `${a.source || 'custom'}::${(a.name || '').toLowerCase()}` === key);
  if (exists) return;
  // A candidate may carry its own _timing (a spell); otherwise use the section.
  const timing = candidate._timing || _kitTiming || 'action';
  actionsData.actions.push({
    id: Date.now().toString() + Math.floor(Math.random() * 1000),
    name: candidate.name,
    type: 'action',
    timing: timing,
    category: candidate.category || 'other',
    damage: candidate.damage || '',
    range: candidate.range || '',
    uses: candidate.uses || '',
    attack: candidate.attack || '',
    description: candidate.description || '',
    link: candidate.link || '',
    source: candidate.source || 'custom',
    favorite: false
  });
  saveActions();
  displayActions();
  updateFavorites();
  renderActionKit();
  autosave();
}

function addAllKitActions(groupKey) {
  (_actionKitCache[groupKey] || []).filter(a => !a._added).forEach(addKitAction);
}

// Save actions to localStorage
function saveActions() {
  localStorage.setItem('dndActions', JSON.stringify(actionsData));
}

// Load actions from localStorage
function loadActions() {
  actionsData = window.getStoredJSON ? window.getStoredJSON('dndActions', actionsData) : (JSON.parse(localStorage.getItem('dndActions') || 'null') || actionsData);
}


// ========== PINNED RESOURCES (mirror of the Spells page rows marked with a star) ==========
// Slots / resources tagged "show in Actions" appear here as tappable pips. They read and write the
// SAME used-counts as the Spells page, so the two places can never disagree; rests reset them as usual.
function renderActionResources() {
  const box = document.getElementById('action_resources');
  if (!box) return;
  const items = [];
  if (typeof manualSpellSlots !== 'undefined') manualSpellSlots.filter(x => x.showInActions).forEach(x => items.push({ kind: 'slot', id: x.id, name: x.name, max: x.maxValue, used: (manualSpellSlotsUsed || {})[x.id] || 0 }));
  if (typeof customResources !== 'undefined') customResources.filter(x => x.showInActions).forEach(x => items.push({ kind: 'resource', id: x.id, name: x.name, max: x.maxValue, used: (customResourcesUsed || {})[x.id] || 0 }));
  if (!items.length) { box.hidden = true; box.innerHTML = ''; return; }
  box.hidden = false;
  box.innerHTML = items.map(it => {
    const max = Math.max(0, Math.min(it.max || 0, 30)), avail = Math.max(0, max - Math.min(it.used, max));
    const pips = Array.from({ length: max }, (_, i) =>
      `<button type="button" class="ar-pip ${i < avail ? 'is-full' : 'is-spent'}" onclick="actionResPip('${it.kind}','${it.id}',${i})" aria-label="${escapeHtml(it.name)} ${i < avail ? 'available' : 'spent'}"></button>`).join('');
    return `<div class="ar-item"><span class="ar-name">${escapeHtml(it.name)}</span><span class="ar-pips">${pips}</span><span class="ar-count">${avail}/${max}</span></div>`;
  }).join('');
}

// Tap an available pip to spend one; tap a spent pip to get one back.
function actionResPip(kind, id, index) {
  const isSlot = kind === 'slot';
  const item = (isSlot ? manualSpellSlots : customResources).find(x => x.id === id);
  if (!item) return;
  const used = isSlot ? manualSpellSlotsUsed : customResourcesUsed;
  const cur = Math.min(used[id] || 0, item.maxValue), avail = item.maxValue - cur;
  used[id] = index < avail ? Math.min(item.maxValue, cur + 1) : Math.max(0, cur - 1);
  if (isSlot) updateSpellSlots(); else updateCustomResources();
  autosave();
}


// ========== COMPANIONS & SUMMONS (saved inside actionsData.companions) ==========
const COMP_ABILS = ['str', 'dex', 'con', 'int', 'wis', 'cha'];
const _compMod = score => { const m = Math.floor(((parseInt(score, 10) || 10) - 10) / 2); return (m >= 0 ? '+' : '\u2212') + Math.abs(m); };
const _compFind = id => (actionsData.companions || []).find(c => c.id === id);

function renderCompanions() {
  const list = document.getElementById('companions_list');
  if (!list) return;
  const comps = actionsData.companions || [];
  if (!comps.length) { list.innerHTML = '<p class="companions-empty">No companions or summons yet.</p>'; return; }
  list.innerHTML = comps.map(c => {
    const a = c.abilities || {};
    const pct = c.maxHp > 0 ? Math.max(0, Math.min(100, Math.round(c.hp / c.maxHp * 100))) : 100;
    const abil = COMP_ABILS.map(k => `<label class="comp-abil"><span>${k.toUpperCase()}</span><input type="number" value="${parseInt(a[k], 10) || 10}" data-id="${c.id}" data-ab="${k}" oninput="companionAbility(this)" aria-label="${k.toUpperCase()}"><b id="cm_${c.id}_${k}">${_compMod(a[k])}</b></label>`).join('');
    return `<div class="comp-card${c.hp <= 0 && c.maxHp > 0 ? ' is-down' : ''}" id="comp_${c.id}">
      <div class="comp-head">
        <input class="comp-name" type="text" value="${escapeHtml(c.name || '')}" placeholder="Name" oninput="companionSet('${c.id}','name',this.value)" aria-label="Companion name">
        <input class="comp-kind" type="text" value="${escapeHtml(c.kind || '')}" placeholder="Type (familiar, mount, summon...)" oninput="companionSet('${c.id}','kind',this.value)" aria-label="Companion type">
        <button type="button" class="comp-remove" onclick="removeCompanion('${c.id}')" title="Remove" aria-label="Remove companion">\u2715</button>
      </div>
      <div class="comp-vitals">
        <div class="comp-hp">
          <button type="button" onclick="companionHp('${c.id}',-1)" aria-label="Lose 1 HP">\u2212</button>
          <label>HP <input type="number" min="0" value="${c.hp || 0}" id="ch_${c.id}" oninput="companionSet('${c.id}','hp',this.value)"> / <input type="number" min="0" value="${c.maxHp || 0}" oninput="companionSet('${c.id}','maxHp',this.value)" aria-label="Max HP"></label>
          <button type="button" onclick="companionHp('${c.id}',1)" aria-label="Gain 1 HP">+</button>
        </div>
        <label class="comp-small">AC <input type="number" value="${c.ac ?? 10}" oninput="companionSet('${c.id}','ac',this.value)"></label>
        <label class="comp-small">Speed <input type="text" value="${escapeHtml(c.speed || '')}" oninput="companionSet('${c.id}','speed',this.value)"></label>
      </div>
      <div class="comp-bar"><i id="cb_${c.id}" style="width:${pct}%"></i></div>
      <div class="comp-abils">${abil}</div>
      <textarea class="comp-notes" rows="2" placeholder="Attacks, abilities, notes..." oninput="companionSet('${c.id}','notes',this.value)">${escapeHtml(c.notes || '')}</textarea>
    </div>`;
  }).join('');
}

function addCompanion() {
  if (!Array.isArray(actionsData.companions)) actionsData.companions = [];
  const id = 'c' + Date.now();
  actionsData.companions.push({ id, name: '', kind: '', hp: 0, maxHp: 0, ac: 10, speed: '30 ft', abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 }, notes: '' });
  renderCompanions(); autosave();
  const n = document.querySelector('#comp_' + id + ' .comp-name'); if (n) n.focus();
}

function companionSet(id, field, value) {
  const c = _compFind(id); if (!c) return;
  if (field === 'hp' || field === 'maxHp' || field === 'ac') c[field] = Math.max(0, parseInt(value, 10) || 0); else c[field] = value;
  if (field === 'hp' || field === 'maxHp') _compPaintHp(c);
  autosave();
}

function companionAbility(el) {
  const c = _compFind(el.dataset.id); if (!c) return;
  if (!c.abilities) c.abilities = {};
  c.abilities[el.dataset.ab] = parseInt(el.value, 10) || 10;
  const m = document.getElementById('cm_' + c.id + '_' + el.dataset.ab); if (m) m.textContent = _compMod(c.abilities[el.dataset.ab]);
  autosave();
}

function companionHp(id, delta) {
  const c = _compFind(id); if (!c) return;
  c.hp = Math.max(0, Math.min(c.maxHp > 0 ? c.maxHp : Infinity, (c.hp || 0) + delta));
  const inp = document.getElementById('ch_' + id); if (inp) inp.value = c.hp;
  _compPaintHp(c); autosave();
}

function _compPaintHp(c) {
  const bar = document.getElementById('cb_' + c.id); if (bar) bar.style.width = (c.maxHp > 0 ? Math.max(0, Math.min(100, Math.round(c.hp / c.maxHp * 100))) : 100) + '%';
  const card = document.getElementById('comp_' + c.id); if (card) card.classList.toggle('is-down', c.maxHp > 0 && c.hp <= 0);
}

function removeCompanion(id) {
  const c = _compFind(id); if (!c) return;
  appConfirm('Remove ' + (c.name || 'this companion') + '?', { confirmText: 'Remove' }).then(ok => {
    if (!ok) return;
    actionsData.companions = actionsData.companions.filter(x => x.id !== id);
    renderCompanions(); autosave();
  });
}


// ========== PROFICIENCIES & TRAINING: one simple list, a row per thing ==========
// The saved value is still the one text box (#proficiencies_training), so saving and old sheets are
// unchanged. A line "Armor: Light armor, Shields" becomes the Armor row; any other line shows under
// "Other". Rows you add yourself are remembered in actionsData.profRows (just their titles). Skills and
// Saving Throws are read from the proficiency ticks higher up the sheet, which stay the one source of truth.
const PROF_DEFAULT = ['Armor', 'Weapons', 'Tools', 'Languages', 'Feats', 'Racial Features'];
const PROF_SUGGEST = ['Vehicles', 'Instruments', 'Senses', 'Resistances', 'Expertise'];
const _profAlias = { armour: 'Armor', armors: 'Armor', armours: 'Armor', weapon: 'Weapons', tool: 'Tools', language: 'Languages', feat: 'Feats', 'racial feature': 'Racial Features', 'racial traits': 'Racial Features', 'racial trait': 'Racial Features', racial: 'Racial Features', 'race features': 'Racial Features', 'species traits': 'Racial Features' };
let _profLast = null, _profSig = '', _profOpen = null, _profAdding = false;

const _profRows = () => (actionsData.profRows = Array.isArray(actionsData.profRows) ? actionsData.profRows : []);
const _profKnown = () => [...new Set([...PROF_DEFAULT, ..._profRows()])];
const _profCustomRows = () => _profRows().filter(r => !PROF_DEFAULT.includes(r));
function _profName(w) {
  w = w.trim().toLowerCase();
  return _profKnown().find(k => k.toLowerCase() === w) || (_profAlias[w] && _profKnown().includes(_profAlias[w]) ? _profAlias[w] : null);
}
function _profSplit(ln) {
  const m = ln.match(/^\s*([^:–]{1,30}?)\s*[:–]\s*(.*)$/) || ln.match(/^\s*([A-Za-z]+)\s+-\s+(.*)$/);
  const cat = m ? _profName(m[1]) : null;
  return cat ? { cat, label: m[1], body: m[2] } : { cat: null, label: '', body: ln };
}

function _profParse() {
  const ta = document.getElementById('proficiencies_training');
  const lines = (ta ? ta.value : '').split('\n');
  const chips = [];
  lines.forEach((ln, li) => {
    const sp = _profSplit(ln); if (!sp.cat) return;
    sp.body.split(',').map(x => x.trim()).filter(Boolean).forEach((t, ci) => chips.push({ cat: sp.cat, line: li, idx: ci, text: t }));
  });
  return { lines, chips };
}

function _profWrite(lines) {
  const ta = document.getElementById('proficiencies_training'); if (!ta) return;
  ta.value = lines.join('\n').replace(/^\n+|\n+$/g, '');
  ta.dispatchEvent(new Event('input', { bubbles: true }));
  renderProfChips();
}

function profAdd(cat, text) {
  text = (text || '').trim().replace(/[,]/g, ' '); if (!text) return;
  const { lines } = _profParse();
  const at = lines.findIndex(ln => _profSplit(ln).cat === cat);
  if (at >= 0) lines[at] = lines[at].replace(/[\s,]*$/, '') + (/[:–]\s*$/.test(lines[at]) ? ' ' : ', ') + text; else lines.push(cat + ': ' + text);
  _profWrite(lines);
  if (typeof featOnAdded === 'function') featOnAdded(cat, text);
  autosave();
}

function profRemove(line, idx) {
  const { lines } = _profParse();
  const ln = lines[line]; if (ln === undefined) return;
  const sp = _profSplit(ln); const parts = sp.body.split(',').map(x => x.trim()).filter(Boolean);
  if (typeof featOnRemoved === 'function' && parts[idx] !== undefined) featOnRemoved(sp.cat, parts[idx]);
  parts.splice(idx, 1);
  if (!parts.length) lines.splice(line, 1); else lines[line] = (sp.cat ? sp.label + ': ' : '') + parts.join(', ');
  _profWrite(lines);
  autosave();
}

function profOpen(cat) { _profOpen = cat; _profAdding = false; renderProfChips(); }
function profClose() { _profOpen = null; _profAdding = false; renderProfChips(); }

function profNewRow(title) {
  title = (title || '').trim().replace(/[:,]/g, ' ').replace(/\s+/g, ' ').slice(0, 30);
  if (!title) return profClose();
  const exist = _profKnown().find(k => k.toLowerCase() === title.toLowerCase());
  if (!exist) _profRows().push(title);
  if (document.activeElement && document.activeElement.tagName === 'INPUT') document.activeElement.value = ''; // don't carry the title into the new row's box
  _profAdding = false; _profOpen = exist || title; renderProfChips(); autosave();
}

function profDeleteRow(title) {
  const { lines, chips } = _profParse(); const n = chips.filter(c => c.cat === title).length;
  const go = ok => {
    if (!ok) return;
    _profWrite(lines.filter(ln => _profSplit(ln).cat !== title));
    actionsData.profRows = _profRows().filter(r => r !== title); renderProfChips(); autosave();
  };
  if (!n) return go(true);
  appConfirm('Remove the "' + title + '" row and its ' + n + ' item' + (n > 1 ? 's' : '') + '?', { confirmText: 'Remove' }).then(go);
}


// ---- automatic sorting of older free text ----
// Walks the old text once: headings ("Armor" / "Tools:"), "Row: a, b" lines, bullets under a heading and
// plain items it recognises by keyword go into rows. Everything else is kept word for word as loose
// lines, which show in the "To sort" box. The original text is kept so it can be undone.
const _PG_LANG = /^(common|dwarvish|elvish|giant|gnomish|goblin|halfling|orc|abyssal|celestial|draconic|deep speech|infernal|primordial|sylvan|undercommon|thieves'? cant|druidic|sign language)\b|language|tongue/i;
const _PG_WEAPON = /\bweapons?\b|\b(longswords?|shortswords?|rapiers?|daggers?|crossbows?|longbows?|shortbows?|handaxes?|greataxes?|battleaxes?|maces?|quarterstaff|quarterstaves|spears?|clubs?|slings?|darts?|scimitars?|warhammers?|whips?|tridents?|flails?|halberds?|glaives?|pikes?|lances?|mauls?|morningstars?|blowguns?|nets?|greatswords?|javelins?)\b/i;
function _profGuess(t) {
  const x = t.replace(/^all\s+/i, '');
  const own = _profRows().find(r => new RegExp('\\b' + r.toLowerCase().replace(/s$/, '') + 's?\\b', 'i').test(t));
  if (own) return own;
  if (/\b(armou?r|shields?)\b/i.test(x)) return 'Armor';
  if (_PG_WEAPON.test(x)) return 'Weapons';
  if (_PG_LANG.test(x)) return 'Languages';
  if (/\btools?\b|\bkits?\b|supplies|instruments?|vehicles?|gaming set|playing cards|\blute\b|\bflute\b/i.test(x)) return 'Tools';
  if (typeof featGuess === 'function') return featGuess(t);
  return null;
}

function profAutoSort(text) {
  const bucket = {}; const loose = []; let cur = null;
  const put = (cat, items) => { items.map(i => i.replace(/^[\s*\u2022\-]+|[\s.;]+$/g, '').trim()).filter(Boolean).forEach(i => { (bucket[cat] = bucket[cat] || []); if (!bucket[cat].some(e => e.toLowerCase() === i.toLowerCase())) bucket[cat].push(i); }); };
  (text || '').split('\n').forEach(raw => {
    const ln = raw.replace(/\s+$/, '');
    if (!ln.trim()) { if (loose.length && loose[loose.length - 1] !== '') loose.push(''); return; }
    const head = ln.match(/^\s*[#*\u2022\-]*\s*([A-Za-z' ]{3,20}?)\s*:?\s*$/);
    if (head && _profName(head[1])) { cur = _profName(head[1]); return; }
    const lab = ln.match(/^\s*([^:]{1,30}?)\s*:\s*(.*)$/);
    if (lab && _profName(lab[1])) { cur = _profName(lab[1]); put(cur, lab[2].split(/[,;]/)); return; }
    const bullet = ln.match(/^\s*[*\u2022\-\u2013]\s+(.*)$/);
    if (bullet) {
      const b = bullet[1].trim();
      if (cur && b.length <= 40) { put(cur, [b]); return; }
      const g = b.length <= 40 ? _profGuess(b) : null;
      if (g) { put(g, [b]); return; }
      loose.push(ln); return;
    }
    // sentence style: "All Armor, Shields. Languages: Common."
    const segs = ln.split(/\.\s+(?=[A-Z])/);
    let allPlaced = true; const placed = [];
    segs.forEach(seg => {
      const m = seg.match(/^\s*([^:]{1,30}?)\s*:\s*(.*)$/); const c = m && _profName(m[1]);
      if (c) { placed.push([c, m[2].split(/[,;]/)]); return; }
      const items = seg.split(/[,;]/).map(x => x.trim()).filter(Boolean);
      if (items.length && items.every(i => i.length <= 40 && (_profGuess(i) || (cur && _profGuess(i) === cur)))) items.forEach(i => placed.push([_profGuess(i), [i]]));
      else allPlaced = false;
    });
    if (allPlaced && placed.length) { placed.forEach(([c, it]) => put(c, it)); cur = null; return; }
    cur = null; loose.push(ln);
  });
  while (loose.length && loose[loose.length - 1] === '') loose.pop();
  while (loose.length && loose[0] === '') loose.shift();
  const order = _profKnown();
  const out = order.filter(c => bucket[c] && bucket[c].length).map(c => c + ': ' + bucket[c].join(', '));
  return out.concat(loose.length && out.length ? [''] : [], loose).join('\n');
}

function profSortNow(first) {
  const ta = document.getElementById('proficiencies_training'); if (!ta) return;
  const before = ta.value; const after = profAutoSort(before);
  actionsData.profSorted = true;
  if (after === before.trim()) return autosave();
  if (first) actionsData.profOriginal = before;
  ta.value = after; ta.dispatchEvent(new Event('input', { bubbles: true })); autosave();
}

function profUndoSort() {
  const ta = document.getElementById('proficiencies_training'); if (!ta || actionsData.profOriginal == null) return;
  ta.value = actionsData.profOriginal; delete actionsData.profOriginal; actionsData.profSorted = true;
  ta.dispatchEvent(new Event('input', { bubbles: true })); renderProfChips(); autosave();
}

function profLooseSet(value, el) {
  const ta = document.getElementById('proficiencies_training'); if (!ta) return;
  const keep = ta.value.split('\n').filter(ln => _profSplit(ln).cat);
  ta.value = keep.concat(keep.length && value.trim() ? [''] : [], value.split('\n')).join('\n').replace(/\s+$/, '');
  _profLast = ta.value; _profSig = _profSignature();
  ta.dispatchEvent(new Event('input', { bubbles: true }));
  if (el) { el.style.height = 'auto'; el.style.height = Math.min(el.scrollHeight + 2, 400) + 'px'; }
}

function _profSheetLists() {
  const skills = [...document.querySelectorAll('input[type="checkbox"][id^="prof_"]')].filter(cb => cb.checked).map(cb => {
    const lb = document.querySelector('label[for="' + cb.id + '"]'); return lb ? lb.textContent.replace(/\s*\(.*\)\s*$/, '').trim() : cb.id.slice(5).replace(/_/g, ' ');
  });
  const saves = ['str', 'dex', 'con', 'int', 'wis', 'cha'].filter(a => { const cb = document.getElementById(a + '_save_prof'); return cb && cb.checked; }).map(a => a.toUpperCase());
  return { skills, saves };
}

function _profSignature() {
  const ta = document.getElementById('proficiencies_training'); const { skills, saves } = _profSheetLists();
  return JSON.stringify([ta ? ta.value : '', skills, saves, _profRows()]);
}

function renderProfChips() {
  const box = document.getElementById('prof_chips'); const ta = document.getElementById('proficiencies_training');
  if (!box || !ta) return;
  if (!actionsData.profSorted && ta.value.trim()) profSortNow(true);
  _profLast = ta.value; _profSig = _profSignature();
  const { chips, lines } = _profParse(); const { skills, saves } = _profSheetLists();
  const looseText = lines.filter(ln => !_profSplit(ln).cat).join('\n').replace(/^\n+|\n+$/g, '');
  const typed = document.activeElement && document.activeElement.closest && document.activeElement.closest('#prof_chips') && document.activeElement.tagName === 'INPUT' ? document.activeElement.value : '';
  const chip = c => {
    if (c.cat === 'Feats' || c.cat === 'Racial Features') {
      const jc = JSON.stringify(c.cat).replace(/"/g, '&quot;'), jt = JSON.stringify(c.text).replace(/"/g, '&quot;');
      const tip = typeof featTip === 'function' ? featTip(c.cat, c.text) : c.text;
      return `<span class="prof-chip prof-chip-info" tabindex="0" role="button" title="${escapeHtml(tip)}" onclick="featShow(${jc},${jt})" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();featShow(${jc},${jt})}">${escapeHtml(c.text)}<button type="button" onclick="event.stopPropagation(); profRemove(${c.line},${c.idx})" aria-label="Remove ${escapeHtml(c.text)}">✕</button></span>`;
    }
    return `<span class="prof-chip">${escapeHtml(c.text)}<button type="button" onclick="profRemove(${c.line},${c.idx})" aria-label="Remove ${escapeHtml(c.text)}">✕</button></span>`;
  };
  const row = (cat, custom) => {
    const mine = chips.filter(c => c.cat === cat); const safe = escapeHtml(cat).replace(/'/g, '&#39;'); const isFeat = cat === 'Feats' || cat === 'Racial Features';
    const adder = _profOpen === cat
      ? `<form class="prof-inline" onsubmit="event.preventDefault(); const v = this.elements.t.value; this.elements.t.value = ''; profAdd('${safe}', v);"><input name="t" id="prof_input" type="text" maxlength="60" autocomplete="off" placeholder="Type, then Enter"${isFeat ? ' list="prof_feat_list"' : ''} onkeydown="if(event.key==='Escape') profClose()" onblur="setTimeout(()=>{ if(_profOpen && !document.activeElement.closest('.prof-inline')) profClose(); }, 150)">${isFeat && typeof featDatalistHtml === 'function' ? featDatalistHtml(cat) : ''}${isFeat ? `<button type="button" class="prof-linkbtn" onmousedown="event.preventDefault()" onclick="featNewCustom('${safe}')">+ Custom</button>` : ''}</form>`
      : `<button type="button" class="prof-plus" onclick="profOpen('${safe}')" aria-label="Add to ${escapeHtml(cat)}">+</button>`;
    return `<div class="prof-row"><div class="prof-label">${escapeHtml(cat)}${custom ? `<button type="button" class="prof-del" onclick="profDeleteRow('${safe}')" aria-label="Remove ${escapeHtml(cat)} row" title="Remove this row">✕</button>` : ''}</div><div class="prof-items">${mine.map(chip).join('')}${adder}</div></div>`;
  };
  const ro = (title, list, none) => `<div class="prof-row prof-row-sheet"><div class="prof-label">${title}</div><div class="prof-items">${list.length ? list.map(t => `<span class="prof-chip prof-chip-ro">${escapeHtml(t)}</span>`).join('') : `<span class="prof-empty">${none}</span>`}</div></div>`;
  const toSort = looseText ? `<div class="prof-row prof-row-sort"><div class="prof-label">To sort</div><div class="prof-items prof-sortbox"><textarea id="prof_loose" rows="3" oninput="profLooseSet(this.value, this)" aria-label="Text not placed in a row yet">${escapeHtml(looseText)}</textarea><p class="prof-note">Anything that did not fit a row yet. Edit it freely, or use the + on a row above to add it there and delete it here. <button type="button" class="prof-linkbtn" onclick="profSortNow(false)">Try sorting again</button></p></div></div>` : '';
  const undo = actionsData.profOriginal != null ? `<p class="prof-note prof-undo">Your old text was sorted into rows automatically. <button type="button" class="prof-linkbtn" onclick="profUndoSort()">Undo auto-sort</button></p>` : '';
  box.innerHTML = `<div class="prof-rows">${PROF_DEFAULT.map(c => row(c, false)).join('')}${ro('Skills', skills, 'Tick skills above and they show here')}${ro('Saving Throws', saves, 'Tick saves above and they show here')}${_profCustomRows().map(c => row(c, true)).join('')}${toSort}</div>${undo}
    ${_profAdding
      ? `<form class="prof-newrow" onsubmit="event.preventDefault(); profNewRow(this.elements.t.value);"><input name="t" id="prof_input" list="prof_suggest" type="text" maxlength="30" autocomplete="off" placeholder="Row name, e.g. Vehicles"><datalist id="prof_suggest">${PROF_SUGGEST.filter(x => !_profKnown().includes(x)).map(x => `<option value="${x}">`).join('')}</datalist><button type="submit">Add row</button><button type="button" onclick="profClose()">Cancel</button></form>`
      : `<button type="button" class="prof-addrow" onclick="_profAdding = true; _profOpen = null; renderProfChips();">+ Add a row</button>`}`;
  const lz = document.getElementById('prof_loose'); if (lz) lz.style.height = Math.min(Math.max(lz.scrollHeight + 2, 64), 400) + 'px';
  const inp = document.getElementById('prof_input');
  if (inp) { inp.value = typed; inp.focus(); inp.setSelectionRange(typed.length, typed.length); }
}

// the text box or the skill/save ticks change by loading a character, ticking a box, or editing a chip: keep the rows in step
setInterval(() => {
  const ta = document.getElementById('proficiencies_training');
  if (!ta || document.activeElement === ta) return;
  const a = document.activeElement;
  if (a && a.closest && a.closest('#prof_chips') && (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA')) return; // never rebuild under the cursor
  if (_profLast === null || _profSignature() !== _profSig) renderProfChips();
}, 500);
