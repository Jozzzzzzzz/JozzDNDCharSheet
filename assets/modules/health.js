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
    alert('Please enter a valid amount greater than 0');
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
  const conMod = parseInt(document.getElementById('con_modifier').value) || 0;
  const hitDieSize = parseInt(document.getElementById('hit_die_size').value) || 6;
  
  if (hitDiceSpend <= 0) {
    alert("Please enter how many Hit Dice you want to spend (minimum 1)");
    return;
  }
  
  // Roll hit dice
  let totalRecovery = 0;
  const rollDetails = [];
  
  for (let i = 0; i < hitDiceSpend; i++) {
    const roll = Math.floor(Math.random() * hitDieSize) + 1;
    const withConMod = roll + conMod;
    totalRecovery += withConMod;
    rollDetails.push(`d${hitDieSize}: ${roll} + ${conMod} = ${withConMod}`);
  }
  
  // Apply recovery to current HP
  const currHP = document.getElementById('curr_hp');
  const maxHP = document.getElementById('max_hp');
  const currentTotalHP = parseInt(currHP.value) || 0;
  const maxHPValue = parseInt(maxHP.value) || 0;
  
  const newTotalHP = currentTotalHP + totalRecovery;
  
  currHP.value = newTotalHP;
  updateHPDisplay();
  autosave();
  
  // Show results
  const rollSummary = rollDetails.join(', ');
  const newCurrentHP = getCurrentHP();
  const newTempHP = getTempHP();
  const hpDisplay = newTempHP > 0 ? `${newCurrentHP} + ${newTempHP} temp` : `${newCurrentHP}`;
  alert(`Short Rest Completed!\n\nHit Dice Rolls: ${rollSummary}\nTotal Recovery: ${totalRecovery} HP\n\nNew HP: ${hpDisplay}/${maxHPValue}`);
  
  // Reset inputs
  document.getElementById('hit_dice_spend').value = 1;
  calculateHitDiceRecovery();
}

function calculateHitDiceRecovery() {
  const hitDiceSpend = parseInt(document.getElementById('hit_dice_spend').value) || 0;
  const conMod = parseInt(document.getElementById('con_modifier').value) || 0;
  const hitDieSize = parseInt(document.getElementById('hit_die_size').value) || 8;
  
  const recoveryText = document.getElementById('hit_dice_recovery_text');
  
  if (hitDiceSpend <= 0) {
    recoveryText.textContent = 'Enter number of Hit Dice to spend';
    return;
  }
  
  const minRecovery = hitDiceSpend + (conMod * hitDiceSpend);
  const maxRecovery = (hitDieSize * hitDiceSpend) + (conMod * hitDiceSpend);
  
  recoveryText.textContent = `Potential Recovery: ${hitDiceSpend}d${hitDieSize} + ${conMod * hitDiceSpend} = ${minRecovery}-${maxRecovery} HP`;
}


// Health Potion System
function updatePotionInfo() {
  const potionType = document.getElementById('potion_type').value;
  const potionInfo = document.getElementById('potion_info_text');
  
  const potionData = {
    minor: { dice: '2d4', bonus: 2, min: 4, max: 10 },
    lesser: { dice: '2d4', bonus: 2, min: 4, max: 10 },
    healing: { dice: '4d4', bonus: 4, min: 8, max: 20 },
    greater: { dice: '4d4', bonus: 4, min: 8, max: 20 },
    superior: { dice: '8d4', bonus: 8, min: 16, max: 40 },
    supreme: { dice: '10d4', bonus: 20, min: 30, max: 60 }
  };
  
  const data = potionData[potionType];
  potionInfo.textContent = `Heals: ${data.dice}+${data.bonus} = ${data.min}-${data.max} HP`;
}

let potionConfirmCount = 0;

function useHealthPotion() {
  potionConfirmCount++;
  
  if (potionConfirmCount === 1) {
    document.getElementById('use_potion_btn').textContent = 'Click Again to Confirm';
    document.getElementById('use_potion_btn').style.background = '#FF5722';
    setTimeout(() => {
      if (potionConfirmCount === 1) {
        potionConfirmCount = 0;
        document.getElementById('use_potion_btn').textContent = 'Use Potion';
        document.getElementById('use_potion_btn').style.background = '#9C27B0';
      }
    }, 3000);
    return;
  }
  
  if (potionConfirmCount === 2) {
    document.getElementById('use_potion_btn').textContent = 'Final Click to Use!';
    document.getElementById('use_potion_btn').style.background = '#D32F2F';
    return;
  }
  
  if (potionConfirmCount >= 3) {
    // Actually use the potion
    const potionType = document.getElementById('potion_type').value;
    const potionData = {
      minor: { dice: 2, sides: 4, bonus: 2 },
      lesser: { dice: 2, sides: 4, bonus: 2 },
      healing: { dice: 4, sides: 4, bonus: 4 },
      greater: { dice: 4, sides: 4, bonus: 4 },
      superior: { dice: 8, sides: 4, bonus: 8 },
      supreme: { dice: 10, sides: 4, bonus: 20 }
    };
    
    const data = potionData[potionType];
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
    alert(`Health Potion Used!\n\nRolls: ${rollSummary}\nBonus: +${data.bonus}\nTotal Healing: ${totalHealing} HP\n\nNew HP: ${hpDisplay}/${maxHPValue}`);
    
    // Reset button
    potionConfirmCount = 0;
    document.getElementById('use_potion_btn').textContent = 'Use Potion';
    document.getElementById('use_potion_btn').style.background = '#9C27B0';
  }
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
  autosave();
  alert("Long rest completed - HP fully restored, death saves reset");
}

