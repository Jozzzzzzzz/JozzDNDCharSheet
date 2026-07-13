// ========== HEALTH SYSTEM ==========
function adjustHP(amount) {
  const currHP = document.getElementById('curr_hp');
  let newTotalHP = parseInt(currHP.value) + amount;
  if (isNaN(newTotalHP)) newTotalHP = 0;
  currHP.value = Math.max(0, newTotalHP);
  updateHPDisplay();
  autosave();
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

function shortRest() {
  // Get hit dice inputs
  const hitDiceSpend = parseInt(document.getElementById('hit_dice_spend').value) || 0;
  const conMod = parseInt(document.getElementById('con_bonus')?.value || document.getElementById('con_modifier')?.value || 0);
  const hitDieSize = parseInt(document.getElementById('hit_die_size').value) || 6;
  
  if (hitDiceSpend <= 0) {
    appToast('Please enter how many Hit Dice you want to spend (minimum 1)', 'error');
    return;
  }
  
  // Roll hit dice
  let totalRecovery = 0;
  const rollDetails = [];
  
  for (let i = 0; i < hitDiceSpend; i++) {
    const roll = Math.floor(Math.random() * hitDieSize) + 1;
    const withConMod = Math.max(1, roll + conMod);
    totalRecovery += withConMod;
    const conPart = conMod === 0 ? '' : conMod > 0 ? ` + ${conMod}` : ` ${conMod}`;
    rollDetails.push(`d${hitDieSize}: ${roll}${conPart} = ${withConMod}`);
  }
  
  // Apply recovery to current HP
  const currHP = document.getElementById('curr_hp');
  const maxHP = document.getElementById('max_hp');
  const currentTotalHP = parseInt(currHP.value) || 0;
  const maxHPValue = parseInt(maxHP.value) || 0;
  
  const newTotalHP = currentTotalHP + totalRecovery;
  
  currHP.value = newTotalHP;
  updateHPDisplay();

  // Deduct the spent dice from the pool (clamped to what's available).
  if (_hdPool.max != null) {
    const avail = Math.max(0, _hdPool.max - _hdPool.used);
    _hdPool.used += Math.min(hitDiceSpend, avail);
    renderHitDicePool();
  }

  // Reset spell slots and custom resources marked for short rest
  if (typeof resetSpellSlots === 'function') resetSpellSlots('short');
  if (typeof resetCustomResources === 'function') resetCustomResources('short');

  autosave();

  // Show results
  const rollSummary = rollDetails.join(', ');
  const newCurrentHP = getCurrentHP();
  const newTempHP = getTempHP();
  const hpDisplay = newTempHP > 0 ? `${newCurrentHP} + ${newTempHP} temp` : `${newCurrentHP}`;
  appAlert(`Hit Dice Rolls: ${rollSummary}\nTotal Recovery: ${totalRecovery} HP\nNew HP: ${hpDisplay}/${maxHPValue}`, 'Short Rest Completed!');
  
  // Reset inputs
  document.getElementById('hit_dice_spend').value = 1;
  calculateHitDiceRecovery();
}

function calculateHitDiceRecovery() {
  const hitDiceSpend = parseInt(document.getElementById('hit_dice_spend').value) || 0;
  const conMod = parseInt(document.getElementById('con_bonus')?.value || document.getElementById('con_modifier')?.value || 0);
  const hitDieSize = parseInt(document.getElementById('hit_die_size').value) || 8;
  
  const recoveryText = document.getElementById('hit_dice_recovery_text');
  
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
    const regain = Math.max(1, Math.floor(max1 / 2));
    const before = _hdPool.used;
    _hdPool.used = Math.max(0, _hdPool.used - regain);
    regained += before - _hdPool.used;
  }
  if (_hdPool.max2 > 0 && _hdPool.used2 > 0) {
    const regain2 = Math.max(1, Math.floor(_hdPool.max2 / 2));
    const before2 = _hdPool.used2;
    _hdPool.used2 = Math.max(0, _hdPool.used2 - regain2);
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
    
    const newTotalHP = currentTotalHP + totalHealing;
    
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

