// ========== HEALTH SYSTEM ==========
function adjustHP(amount) {
  const currHP = document.getElementById('curr_hp');
  const before = parseInt(currHP.value);
  let newTotalHP = before + amount;
  if (isNaN(newTotalHP)) newTotalHP = 0;
  if (amount > 0) newTotalHP = healCap(before || 0, newTotalHP);
  currHP.value = Math.max(0, newTotalHP);
  updateHPDisplay();
  autosave();
}

// Healing fills up to max HP and stops there; it never turns into temp HP. Temp HP already on the
// sheet (current above max) is left alone. Temp HP is set by typing it into the current HP box.
function healCap(before, after) {
  const mx = parseInt((document.getElementById('max_hp') || {}).value, 10) || 0;
  if (mx <= 0) return after;
  return before >= mx ? before : Math.min(after, mx);
}

function updateHPDisplay() {
  const currHP = parseInt(document.getElementById('curr_hp').value) || 0;
  const maxHP = parseInt(document.getElementById('max_hp').value) || 0;
  const tempHPDisplay = document.getElementById('temp_hp_display');
  const tempHPText = document.getElementById('temp_hp_text');
  
  if (currHP > maxHP && maxHP > 0) {
    const tempHP = currHP - maxHP;
    const actualHP = maxHP;
    tempHPText.textContent = `Current HP: ${actualHP} | Temporary HP: ${tempHP}`;
    tempHPDisplay.classList.add('show');
  } else {
    tempHPDisplay.classList.remove('show');
  }
}

// Function to get total HP including temporary HP
function getTotalHP() {
  const currHP = parseInt(document.getElementById('curr_hp').value) || 0;
  const maxHP = parseInt(document.getElementById('max_hp').value) || 0;
  return Math.max(currHP, maxHP);
}

// Function to get actual current HP (capped at max)
function getCurrentHP() {
  const currHP = parseInt(document.getElementById('curr_hp').value) || 0;
  const maxHP = parseInt(document.getElementById('max_hp').value) || 0;
  return Math.min(currHP, maxHP);
}

// Function to get temporary HP
function getTempHP() {
  const currHP = parseInt(document.getElementById('curr_hp').value) || 0;
  const maxHP = parseInt(document.getElementById('max_hp').value) || 0;
  return Math.max(0, currHP - maxHP);
}

function initializeDeathSaves() {
  // Sync visual death save states with hidden checkboxes
  for (let i = 1; i <= 3; i++) {
    const successCheckbox = document.getElementById(`death_save_success_${i}_checkbox`);
    const failureCheckbox = document.getElementById(`death_save_failure_${i}_checkbox`);
    const successVisual = document.getElementById(`death_save_success_${i}`);
    const failureVisual = document.getElementById(`death_save_failure_${i}`);
    
    if (successCheckbox && successVisual) {
      if (successCheckbox.checked) {
        successVisual.classList.add('checked');
      } else {
        successVisual.classList.remove('checked');
      }
    }
    
    if (failureCheckbox && failureVisual) {
      if (failureCheckbox.checked) {
        failureVisual.classList.add('checked');
      } else {
        failureVisual.classList.remove('checked');
      }
    }
  }
}

function toggleDeathSave(type, index) {
  const element = document.getElementById(`death_save_${type}_${index}`);
  const isChecked = element.classList.contains('checked');
  
  // Toggle the visual state
  element.classList.toggle('checked');
  
  // Update the hidden checkbox for data persistence
  const checkbox = document.getElementById(`death_save_${type}_${index}_checkbox`);
  if (checkbox) {
    checkbox.checked = !isChecked;
  }
  
  autosave();
}

function showCustomHPPopup() {
  document.getElementById('custom_hp_amount').value = 1;
  showPopup('customHPPopup');
}

function customAdjustHP(action) {
  const amount = parseInt(document.getElementById('custom_hp_amount').value) || 0;
  if (amount <= 0) {
    appToast('Please enter a valid amount greater than 0', 'error');
    return;
  }
  
  const adjustment = action === 'add' ? amount : -amount;
  adjustHP(adjustment);
  closeCustomHPPopup();
}

function closeCustomHPPopup() {
  closePopup('customHPPopup');
  // Reset the input for next time
  document.getElementById('custom_hp_amount').value = 1;
}

// Short Rest: opens a popup where you choose how many hit dice to spend from the pool.
// Die size comes from the class die selector, the CON modifier from Ability Scores.
let _srState = null;

function _conMod() {
  if (typeof syncConModifier === 'function') syncConModifier();
  return parseInt(document.getElementById('con_modifier')?.value, 10) || 0;
}
const _signed = n => (n >= 0 ? '+' : '−') + Math.abs(n);

function shortRest() {
  const max1 = _hdPool.max == null ? 0 : _hdPool.max;
  const pools = [{ n: 1, size: hitDiePrimarySize(), left: Math.max(0, max1 - _hdPool.used), max: max1, spend: 0 }];
  if (hitDicePool2Active()) pools.push({ n: 2, size: parseInt(document.getElementById('hit_die_size2')?.value, 10) || 6, left: Math.max(0, _hdPool.max2 - _hdPool.used2), max: _hdPool.max2, spend: 0 });
  _srState = { pools, con: _conMod() };
  renderShortRest();
  showPopup('shortRestPopup');
}

function renderShortRest() {
  const body = document.getElementById('shortRestBody'); if (!body || !_srState) return;
  const { pools, con } = _srState;
  const hp = getCurrentHP(), mx = parseInt(document.getElementById('max_hp')?.value, 10) || 0;
  const rows = pools.map((p, i) => {
    const lo = Math.max(1, 1 + con) * p.spend, hi = Math.max(lo, (p.size + con) * p.spend);
    return `<div class="sr-pool"><div class="sr-pool-head"><b>d${p.size}</b> <span>${p.left} of ${p.max} left</span></div>
      <div class="sr-step"><button type="button" onclick="srStep(${i}, -1)" ${p.spend <= 0 ? 'disabled' : ''} aria-label="Spend fewer">−</button><output>${p.spend}</output><button type="button" onclick="srStep(${i}, 1)" ${p.spend >= p.left ? 'disabled' : ''} aria-label="Spend more">+</button></div>
      <div class="sr-preview">${p.spend ? `${p.spend}d${p.size} ${_signed(con)} each = ${lo}–${hi} HP` : (p.left ? 'Tap + to spend hit dice' : 'No hit dice left')}</div></div>`;
  }).join('');
  body.innerHTML = `<p class="sr-hp">HP now <b>${hp}${mx ? ' / ' + mx : ''}</b> · CON ${_signed(con)} (from Ability Scores)</p>${rows}
    <div class="sr-actions"><button type="button" onclick="srFinish()" class="sr-go">${pools.some(p => p.spend) ? 'Roll &amp; rest' : 'Rest without hit dice'}</button><button type="button" onclick="closePopup('shortRestPopup')">Cancel</button></div>`;
}

function srStep(i, d) {
  const p = _srState && _srState.pools[i]; if (!p) return;
  p.spend = Math.max(0, Math.min(p.left, p.spend + d)); renderShortRest();
}

function srFinish() {
  if (!_srState) return;
  const { pools, con } = _srState; const rolls = []; let total = 0;
  pools.forEach(p => {
    for (let k = 0; k < p.spend; k++) {
      const r = (typeof rollDie === 'function' ? rollDie(p.size) : Math.floor(Math.random() * p.size) + 1);
      const v = Math.max(1, r + con); total += v; rolls.push(`d${p.size}: ${r}${con ? ' ' + _signed(con) : ''} = ${v}`);
    }
    if (p.n === 1) _hdPool.used += p.spend; else _hdPool.used2 += p.spend;
  });
  const currHP = document.getElementById('curr_hp'); const mx = parseInt(document.getElementById('max_hp')?.value, 10) || 0;
  const before = parseInt(currHP.value, 10) || 0;
  currHP.value = mx > 0 ? Math.min(mx, before + total) : before + total;
  updateHPDisplay(); renderHitDicePool();

  const reset = [];
  if (typeof manualSpellSlots !== 'undefined') manualSpellSlots.forEach(sl => { if (sl.resetType === 'short') reset.push(sl.name); });
  if (typeof customResources !== 'undefined') customResources.forEach(r => { if (r.resetType === 'short') reset.push(r.name); });
  if (typeof resetSpellSlots === 'function') resetSpellSlots('short');
  if (typeof resetCustomResources === 'function') resetCustomResources('short');
  autosave();

  const now = getCurrentHP(), temp = getTempHP();
  const body = document.getElementById('shortRestBody');
  body.innerHTML = `<p class="sr-hp">${rolls.length ? `Healed <b>${total} HP</b>` : 'You rested.'} · HP now <b>${now}${temp ? ' + ' + temp + ' temp' : ''}${mx ? ' / ' + mx : ''}</b></p>
    ${rolls.length ? `<p class="sr-rolls">${rolls.join('<br>')}</p>` : ''}
    ${reset.length ? `<p class="sr-reset">Recharged (tagged Short Rest): ${reset.map(escapeHtml).join(', ')}</p>` : ''}
    <p class="sr-note">Top up anything else that recharges on a short rest (class features, spell slots you track by hand).</p>
    <div class="sr-actions"><button type="button" class="sr-go" onclick="closePopup('shortRestPopup')">Done</button></div>`;
  _srState = null;
}

function calculateHitDiceRecovery() {
  const hitDiceSpend = parseInt(document.getElementById('hit_dice_spend').value) || 0;
  const conMod = parseInt(document.getElementById('con_bonus')?.value || document.getElementById('con_modifier')?.value || 0);
  const hitDieSize = parseInt(document.getElementById('hit_die_size').value) || 8;
  
  const recoveryText = document.getElementById('hit_dice_recovery_text');
  if (!recoveryText) return;
  
  if (hitDiceSpend <= 0) {
    recoveryText.textContent = 'Enter number of Hit Dice to spend';
    return;
  }
  
  // Each die: roll + conMod, minimum 1 per die (5e rule)
  const minPerDie = Math.max(1, 1 + conMod);
  const maxPerDie = hitDieSize + conMod;
  const minRecovery = minPerDie * hitDiceSpend;
  const maxRecovery = Math.max(minRecovery, maxPerDie * hitDiceSpend);

  const conPart = conMod === 0 ? '' : conMod > 0 ? ` + ${conMod} per die` : ` ${conMod} per die`;
  recoveryText.textContent = `Potential Recovery: ${hitDiceSpend}d${hitDieSize}${conPart} = ${minRecovery}–${maxRecovery} HP`;
}

// ========== HIT DICE POOL ==========
// Tracks total hit dice remaining across short rests (5e: you have your level in hit
// dice; a long rest regains up to half your max, rounded down, minimum 1). Data lives in
// page1.health.hitDicePool = { max, used, max2, used2 }. A second pool (max2/used2) is only
// used when a multiclass character's two classes have different hit-die sizes.
// `_hdPoolMaxTouched` tracks whether the user manually edited max, so auto-from-level
// never clobbers a deliberate override.
let _hdPool = { max: null, used: 0, max2: 0, used2: 0, maxTouched: false };

function getHitDicePool() { return _hdPool; }

function setHitDicePool(p) {
  _hdPool = {
    max: (p && typeof p.max === 'number') ? p.max : null,
    used: (p && typeof p.used === 'number') ? Math.max(0, p.used) : 0,
    max2: (p && typeof p.max2 === 'number') ? p.max2 : 0,
    used2: (p && typeof p.used2 === 'number') ? Math.max(0, p.used2) : 0,
    maxTouched: !!(p && p.maxTouched),
  };
}

// Primary pool die size follows the main class die-size dropdown; the secondary pool
// die size comes from the multiclass second class (only when it differs).
function hitDiePrimarySize() {
  return parseInt(document.getElementById('hit_die_size')?.value, 10) || 8;
}

// Auto-populate max from total character level the first time (or whenever the user
// hasn't manually overridden it). Keeps single-class simple; multiclass splits into a
// second pool only if the two class die sizes differ.
function syncHitDicePoolToLevel() {
  const totalLevel = (typeof getTotalCharacterLevel === 'function') ? getTotalCharacterLevel() : (parseInt(document.getElementById('char_level')?.value, 10) || 1);

  // Determine if a second, differently-sized pool applies.
  const mcBlock = document.getElementById('multiclass_block');
  const multiclassOn = mcBlock && mcBlock.style.display !== 'none';
  const l1 = parseInt(document.getElementById('char_level')?.value, 10) || 0;
  const l2 = parseInt(document.getElementById('char_level2')?.value, 10) || 0;

  const die1 = hitDiePrimarySize();
  const die2 = parseInt(document.getElementById('hit_die_size2')?.value, 10) || die1;
  const differentDice = multiclassOn && l2 > 0 && die2 !== die1;

  if (!_hdPool.maxTouched) {
    if (differentDice) {
      // Two differently-sized pools: split by class level.
      _hdPool.max = l1 || totalLevel;
      _hdPool.max2 = l2;
    } else {
      // Single combined pool (same die size, or single-class).
      _hdPool.max = totalLevel;
      _hdPool.max2 = 0;
    }
  }
  clampHitDicePool();
  renderHitDicePool();
}

function clampHitDicePool() {
  const max = _hdPool.max == null ? 0 : _hdPool.max;
  if (_hdPool.used > max) _hdPool.used = max;
  if (_hdPool.used < 0) _hdPool.used = 0;
  if (_hdPool.used2 > _hdPool.max2) _hdPool.used2 = _hdPool.max2;
  if (_hdPool.used2 < 0) _hdPool.used2 = 0;
}

// Should a distinct second pool be shown? Only when multiclass is on, a 2nd level exists,
// and there's a real second-pool count to track.
function hitDicePool2Active() {
  const mcBlock = document.getElementById('multiclass_block');
  const multiclassOn = mcBlock && mcBlock.style.display !== 'none';
  return !!(multiclassOn && _hdPool.max2 > 0);
}

function renderHitDicePool() {
  const max = _hdPool.max == null ? 0 : _hdPool.max;
  const remaining = Math.max(0, max - _hdPool.used);
  const remEl = document.getElementById('hd_pool_remaining');
  const maxDisp = document.getElementById('hd_pool_max_display');
  const maxInput = document.getElementById('hd_pool_max');
  const dieLabel = document.getElementById('hd_pool_die_label');
  if (remEl) remEl.textContent = remaining;
  if (maxDisp) maxDisp.textContent = max;
  if (maxInput && document.activeElement !== maxInput) maxInput.value = max;
  if (dieLabel) dieLabel.textContent = 'd' + hitDiePrimarySize();
  if (typeof syncConModifier === 'function') syncConModifier();

  const pool2 = document.getElementById('hd_pool2');
  if (pool2) {
    if (hitDicePool2Active()) {
      pool2.style.display = '';
      const rem2 = Math.max(0, _hdPool.max2 - _hdPool.used2);
      const r2 = document.getElementById('hd_pool2_remaining');
      const m2 = document.getElementById('hd_pool2_max_display');
      const mi2 = document.getElementById('hd_pool2_max');
      const dl2 = document.getElementById('hd_pool2_die_label');
      if (r2) r2.textContent = rem2;
      if (m2) m2.textContent = _hdPool.max2;
      if (mi2 && document.activeElement !== mi2) mi2.value = _hdPool.max2;
      // Second-class die size: read from a mapping if we track it, else show a generic label.
      if (dl2) dl2.textContent = 'd' + (parseInt(document.getElementById('hit_die_size2')?.value, 10) || 6);
    } else {
      pool2.style.display = 'none';
    }
  }
}

// Spend (delta=1) or restore (delta=-1) a hit die from pool 1 or 2.
function spendHitDie(delta, poolNum) {
  if (poolNum === 2) {
    const next = _hdPool.used2 + delta;
    if (next < 0 || next > _hdPool.max2) return;
    _hdPool.used2 = next;
  } else {
    const max = _hdPool.max == null ? 0 : _hdPool.max;
    const next = _hdPool.used + delta;
    if (next < 0 || next > max) return;
    _hdPool.used = next;
  }
  renderHitDicePool();
  autosave();
}

function onHitDicePoolMaxInput() {
  const maxInput = document.getElementById('hd_pool_max');
  const mi2 = document.getElementById('hd_pool2_max');
  if (maxInput) _hdPool.max = Math.max(0, parseInt(maxInput.value, 10) || 0);
  if (mi2) _hdPool.max2 = Math.max(0, parseInt(mi2.value, 10) || 0);
  _hdPool.maxTouched = true; // user override — stop auto-syncing from level
  clampHitDicePool();
  renderHitDicePool();
  autosave();
}

// Long rest: regain up to half your maximum hit dice (rounded down, min 1), 5e rule.
// Applied per pool. Returns the total regained for the toast.
function recoverHitDiceOnLongRest() {
  let regained = 0;
  const max1 = _hdPool.max == null ? 0 : _hdPool.max;
  if (max1 > 0 && _hdPool.used > 0) {
    const before = _hdPool.used;
    _hdPool.used = 0;                       // a long rest is a full refresh: every hit die comes back
    regained += before - _hdPool.used;
  }
  if (_hdPool.max2 > 0 && _hdPool.used2 > 0) {
    const before2 = _hdPool.used2;
    _hdPool.used2 = 0;
    regained += before2 - _hdPool.used2;
  }
  renderHitDicePool();
  return regained;
}


// Health Potion System
function updatePotionInfo() {
  const potionType = document.getElementById('potion_type').value;
  const potionInfo = document.getElementById('potion_info_text');
  
  // Standard 5e healing potions (DMG). 'minor'/'lesser' are legacy keys from old
  // saves — they map to the basic Healing Potion so those characters still work.
  const potionData = {
    minor: { dice: '2d4', bonus: 2, min: 4, max: 10 },
    lesser: { dice: '2d4', bonus: 2, min: 4, max: 10 },
    healing: { dice: '2d4', bonus: 2, min: 4, max: 10 },
    greater: { dice: '4d4', bonus: 4, min: 8, max: 20 },
    superior: { dice: '8d4', bonus: 8, min: 16, max: 40 },
    supreme: { dice: '10d4', bonus: 20, min: 30, max: 60 }
  };

  const data = potionData[potionType] || potionData.healing;
  potionInfo.textContent = `Heals: ${data.dice}+${data.bonus} = ${data.min}-${data.max} HP`;
}

let potionConfirmCount = 0;

function useHealthPotion() {
  potionConfirmCount++;
  
  if (potionConfirmCount === 1) {
    setPotionBtnState('warn', 'Click Again to Confirm');
    setTimeout(() => {
      if (potionConfirmCount === 1) {
        potionConfirmCount = 0;
        setPotionBtnState('', 'Use Potion');
      }
    }, 3000);
    return;
  }

  if (potionConfirmCount === 2) {
    setPotionBtnState('danger', 'Final Click to Use!');
    return;
  }
  
  if (potionConfirmCount >= 3) {
    // Actually use the potion
    const potionType = document.getElementById('potion_type').value;
    // Standard 5e potions. Legacy 'minor'/'lesser' keys fall back to Healing.
    const potionData = {
      minor: { dice: 2, sides: 4, bonus: 2 },
      lesser: { dice: 2, sides: 4, bonus: 2 },
      healing: { dice: 2, sides: 4, bonus: 2 },
      greater: { dice: 4, sides: 4, bonus: 4 },
      superior: { dice: 8, sides: 4, bonus: 8 },
      supreme: { dice: 10, sides: 4, bonus: 20 }
    };

    const data = potionData[potionType] || potionData.healing;
    let totalHealing = 0;
    let rollDetails = [];
    
    // Roll the dice
    for (let i = 0; i < data.dice; i++) {
      const roll = Math.floor(Math.random() * data.sides) + 1;
      totalHealing += roll;
      rollDetails.push(roll);
    }
    
    totalHealing += data.bonus;
    
    // Apply healing to current HP
    const currHP = document.getElementById('curr_hp');
    const maxHP = document.getElementById('max_hp');
    const currentTotalHP = parseInt(currHP.value) || 0;
    const maxHPValue = parseInt(maxHP.value) || 0;
    
    const newTotalHP = healCap(currentTotalHP, currentTotalHP + totalHealing);
    
    currHP.value = newTotalHP;
    updateHPDisplay();
    autosave();
    
    // Show results
    const rollSummary = rollDetails.join(', ');
    const newCurrentHP = getCurrentHP();
    const newTempHP = getTempHP();
    const hpDisplay = newTempHP > 0 ? `${newCurrentHP} + ${newTempHP} temp` : `${newCurrentHP}`;
    appAlert(`Rolls: ${rollSummary}\nBonus: +${data.bonus}\nTotal Healing: ${totalHealing} HP\nNew HP: ${hpDisplay}/${maxHPValue}`, 'Health Potion Used!');
    
    // Reset button
    potionConfirmCount = 0;
    setPotionBtnState('', 'Use Potion');
  }
}

// Set the Use Potion button's confirm state via themed CSS classes (no hardcoded
// colors). state: '' (idle/accent) | 'warn' | 'danger'.
function setPotionBtnState(state, label) {
  const btn = document.getElementById('use_potion_btn');
  if (!btn) return;
  btn.classList.remove('potion-btn-warn', 'potion-btn-danger');
  if (state === 'warn') btn.classList.add('potion-btn-warn');
  else if (state === 'danger') btn.classList.add('potion-btn-danger');
  if (label != null) btn.textContent = label;
}

function longRest() {
  const currHP = document.getElementById('curr_hp');
  const maxHP = document.getElementById('max_hp');
  currHP.value = maxHP.value; // This sets total HP to max HP (no temp HP)
  
  // Reset death saves
  for (let i = 1; i <= 3; i++) {
    document.getElementById(`death_save_success_${i}`).classList.remove('checked');
    document.getElementById(`death_save_failure_${i}`).classList.remove('checked');
    
    // Also reset hidden checkboxes
    const successCheckbox = document.getElementById(`death_save_success_${i}_checkbox`);
    const failureCheckbox = document.getElementById(`death_save_failure_${i}_checkbox`);
    if (successCheckbox) successCheckbox.checked = false;
    if (failureCheckbox) failureCheckbox.checked = false;
  }
  
  updateHPDisplay();

  // Reset spell slots and custom resources marked for long rest
  if (typeof resetSpellSlots === 'function') resetSpellSlots('long');
  if (typeof resetCustomResources === 'function') resetCustomResources('long');

  // Regain up to half your max hit dice (5e rule).
  const hdRegained = (typeof recoverHitDiceOnLongRest === 'function') ? recoverHitDiceOnLongRest() : 0;

  autosave();
  const hdPart = hdRegained > 0 ? `, ${hdRegained} hit ${hdRegained === 1 ? 'die' : 'dice'} regained` : '';
  appToast(`Long rest completed — HP restored, death saves reset, spell slots restored${hdPart}`, 'success');
}

