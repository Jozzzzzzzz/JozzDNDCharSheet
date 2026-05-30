// app.js — boot entry point only.
// All domain logic lives in assets/modules/:
//   layout.js      — flex-wrap, note boxes, resize
//   characters.js  — character CRUD, autosave, currency, export/import, banner
//   health.js      — HP, death saves, potion, rest
//   core.js        — shared helpers, init, loadData, popup/tab system
//   cloud-skills.js — Firebase auth, cloud sync, stats math
//   actions.js     — combat actions/reactions
//   inventory.js   — inventory, equipment, containers, conditions
//   spells.js      — spell list, spell slots, custom resources, favorites

// Unique weapon popup helpers (weaponsData is declared in characters.js)
function showWeaponsPopup() {
  const tbody = document.getElementById('weapons_table_popup').querySelector('tbody');
  tbody.innerHTML = '';

  weaponsData.forEach((weapon, index) => {
    const row = tbody.insertRow();
    row.innerHTML = `
      <td><input type="text" value="${weapon.name || ''}" oninput="weaponsData[${index}].name = this.value; autosave()"></td>
      <td><input type="text" value="${weapon.toHit || ''}" oninput="weaponsData[${index}].toHit = this.value; autosave()"></td>
      <td><input type="text" value="${weapon.damage || ''}" oninput="weaponsData[${index}].damage = this.value; autosave()"></td>
      <td><input type="text" value="${weapon.bonusDamage || ''}" oninput="weaponsData[${index}].bonusDamage = this.value; autosave()"></td>
      <td><textarea class="table-notes" oninput="weaponsData[${index}].notes = this.value; autosave()">${weapon.notes || ''}</textarea></td>
      <td><input type="text" value="${weapon.properties || ''}" oninput="weaponsData[${index}].properties = this.value; autosave()"></td>
      <td><button class="weapon-remove-btn" type="button" onclick="weaponsData.splice(${index}, 1); showWeaponsPopup()">Remove</button></td>
    `;
  });

  showPopup('weaponsPopup');
}

function addWeapon() {
  weaponsData.push({ name: '', toHit: '', damage: '', bonusDamage: '', notes: '', properties: '' });
  showWeaponsPopup();
}

// Boot sequence — called by index.html after all modules are loaded
window.initializeApp = function() {
  initializeWebApp();

  loadCharacterList();
  loadThemeSettings();

  updateHPDisplay();
  initializeDeathSaves();
  calculateHitDiceRecovery();
  updatePotionInfo();

  ['str', 'dex', 'con', 'int', 'wis', 'cha'].forEach(ability => {
    calculateAbilityBonus(ability);
    formatBonusInput(ability + '_bonus');
  });

  updateProficiencyBonus();
  enforceAutoMathNumericInputs();
  setupSkillCalculationFields();

  ['str', 'dex', 'con', 'int', 'wis', 'cha'].forEach(ability => {
    calculateSavingThrow(ability);
    formatSaveInput(ability + '_save');
  });

  initializeSuggestionForm();

  const characterInfoSection = document.querySelector('.character-info-section');
  if (characterInfoSection) {
    characterInfoSection.classList.remove('resizable-container');
  }

  initializeActions();
  initializeInventory();

  if (typeof window.equipmentData === 'undefined') {
    window.equipmentData = [];
  }

  const characters = getStoredJSON('dndCharacters', []);
  const recentCharacterId = getRecentSelectedCharacterId(characters);
  currentCharacter = recentCharacterId || null;
  loadCharacterList();

  if (recentCharacterId) {
    loadData();
    setupSkillCalculationFields();
    enforceAutoMathNumericInputs();
    const page1Tab = document.querySelector('.tab[data-tab="page1"]');
    if (page1Tab) page1Tab.click();
  } else {
    showHomePage();
  }

  const portraitUpload = document.getElementById('portraitUpload');
  const portraitPreview = document.getElementById('portraitPreview');
  if (portraitUpload && portraitPreview) {
    portraitUpload.addEventListener('change', handlePortraitUpload);
    portraitPreview.addEventListener('click', function() {
      portraitUpload.click();
    });
  }

  if (weaponsData.length === 0) {
    weaponsData.push({ name: '', toHit: '', damage: '', bonusDamage: '', notes: '', properties: '' });
    updateWeaponsPreview();
  }

  if (equipmentData.length === 0) {
    equipmentData.push({ name: '', type: '', bonus: '', weight: 0, notes: '' });
    updateEquipmentPreviews();
  }

  updateWeight();
  document.querySelectorAll('#extra_containers .section').forEach(container => {
    updateContainerWeight(container.id);
  });

  makeContainersResizable();
  setupNoteBoxHandlers();
  setupNoteBoxObserver();
  setupAutoResize();
  setupMobileTextareaAutoGrow();
  loadLayout();
  bindGlobalAutosaveListeners();
  rollBannerMessage();
  setTimeout(() => {
    applyFlexWrapSizing();
    syncSpellPanels();
  }, 0);
};
