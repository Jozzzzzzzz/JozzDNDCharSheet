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
    alert('Please enter a name for the action.');
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
    `<span>⚠️ ${n} card${n === 1 ? '' : 's'} ${n === 1 ? 'was' : 'were'} auto-sorted and may belong in a different section. ` +
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
    ? `<a class="action-ref-link" href="${esc(action.link)}" target="_blank" rel="noopener">View rules ↗</a>`
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
      <button class="action-btn favorite-btn ${action.favorite ? 'favorited' : ''}" onclick="toggleActionFavorite('${action.id}', '${type}')" title="Favourite">
        ${action.favorite ? '❤️' : '🤍'}
      </button>
      <button class="action-btn edit-btn" onclick="editAction('${action.id}', '${type}')" title="Edit">✏️</button>
      <button class="action-btn delete-btn" onclick="deleteAction('${action.id}', '${type}')" title="Delete">🗑️</button>
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
  if (confirm('Are you sure you want to delete this action?')) {
    const index = actionsData.actions.findIndex(a => a.id === id);
    if (index > -1) {
      actionsData.actions.splice(index, 1);
      saveActions();
      displayActions();
      updateFavorites();
      autosave();
    }
  }
}

// Clear all actions
function clearAllActions(type) {
  if (confirm('Are you sure you want to clear all actions? This cannot be undone.')) {
    actionsData.actions = [];
    saveActions();
    displayActions();
    updateFavorites();
    autosave();
  }
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
  const lvl = Number(sp.level) === 0 ? 'Cantrip' : `Level ${sp.level}`;
  const atkSave = [sp.attack, sp.save].filter(Boolean).join(' / ');
  return {
    source: 'spell', name: sp.name, category: 'spell',
    damage: sp.damage || '', range: sp.range || '', attack: atkSave,
    uses: lvl, description: sp.summary || sp.description || '', link: spellOpen5eLink(sp),
    _timing: spellTiming(sp)
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
      : `Searching ${scope}. ${_kitShowAll ? 'All spells, cantrips &amp; Open5e items, any timing.' : 'Your weapons, spells, items &amp; the default actions — flip the toggle to search everything.'}`;
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

  matches = matches.sort((a, b) => a.name.localeCompare(b.name)).slice(0, 50);
  _actionKitSearchCache = matches;

  if (!matches.length) { out.innerHTML = `<p class="kit-empty">No matches for “${escapeHtml(query)}”${!_kitShowAll ? ' on your sheet — flip the toggle to search everything.' : '.'}</p>`; return; }

  out.innerHTML = matches.map((c, idx) => {
    const added = have.has(`${c.source}::${c.name.toLowerCase()}`);
    const meta = [c.uses, c.damage, c.range].filter(Boolean).join(' · ');
    const link = c.link;
    return `
      <div class="kit-row ${added ? 'kit-row-added' : ''}">
        <div class="kit-row-info">
          <span class="kit-row-name">${escapeHtml(c.name)}${link ? ` <a class="kit-row-link" href="${escapeHtml(link)}" target="_blank" rel="noopener" title="View on Open5e">↗</a>` : ''}<span class="kit-src-tag kit-src-${c.source}">${escapeHtml(c.source)}</span></span>
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

