// Stats page: ability scores, saving throws, skills, proficiency bonus, input helpers

const SKILL_ABILITY_MAP = {
  acrobatics: 'dex',
  animal_handling: 'wis',
  arcana: 'int',
  athletics: 'str',
  deception: 'cha',
  history: 'int',
  insight: 'wis',
  intimidation: 'cha',
  investigation: 'int',
  medicine: 'wis',
  nature: 'int',
  perception: 'wis',
  performance: 'cha',
  persuasion: 'cha',
  religion: 'int',
  sleight_of_hand: 'dex',
  stealth: 'dex',
  survival: 'wis'
};

const SKILL_LIST = Object.keys(SKILL_ABILITY_MAP);
const ABILITY_LIST = ['str', 'dex', 'con', 'int', 'wis', 'cha'];
const autoMathOverrideState = {
  profBonus: false,
  abilityBonus: ABILITY_LIST.reduce((acc, ability) => {
    acc[ability] = false;
    return acc;
  }, {})
};

function formatSignedNumber(value) {
  const n = parseInt(value, 10) || 0;
  return n >= 0 ? `+${n}` : `${n}`;
}

function parseSignedNumber(value) {
  if (value === null || value === undefined) return 0;
  const cleaned = String(value).trim().replace(/[^0-9+-]/g, '');
  return parseInt(cleaned, 10) || 0;
}

function sanitizeDigits(value, maxLength = null) {
  let cleaned = String(value || '').replace(/\D/g, '');
  if (maxLength) cleaned = cleaned.slice(0, maxLength);
  return cleaned;
}

function sanitizeSignedValue(value) {
  const trimmed = String(value || '').trim();
  if (!trimmed) return '+0';
  const sign = trimmed.startsWith('-') ? '-' : '+';
  const digits = trimmed.replace(/\D/g, '');
  const numeric = digits ? parseInt(digits, 10) : 0;
  return sign === '-' ? `-${numeric}` : `+${numeric}`;
}

function getCalculatedAbilityBonus(ability) {
  const scoreInput = document.getElementById(ability);
  if (!scoreInput) return '+0';
  const score = parseInt(scoreInput.value, 10) || 0;
  return formatSignedNumber(Math.floor((score - 10) / 2));
}

function setAbilityBonusOverride(ability, isOverridden) {
  if (!Object.prototype.hasOwnProperty.call(autoMathOverrideState.abilityBonus, ability)) return;
  autoMathOverrideState.abilityBonus[ability] = !!isOverridden;
}

function setProficiencyBonusOverride(isOverridden) {
  autoMathOverrideState.profBonus = !!isOverridden;
}

function syncAutoMathOverridesFromCurrentValues() {
  ABILITY_LIST.forEach(ability => {
    const bonusInput = document.getElementById(`${ability}_bonus`);
    if (!bonusInput) return;
    const rawValue = String(bonusInput.value || '').trim();
    if (!rawValue) {
      setAbilityBonusOverride(ability, false);
      bonusInput.value = getCalculatedAbilityBonus(ability);
      return;
    }
    const current = sanitizeSignedValue(bonusInput.value);
    const calculated = getCalculatedAbilityBonus(ability);
    setAbilityBonusOverride(ability, current !== calculated);
    bonusInput.value = current;
  });

  const profBonusInput = document.getElementById('prof_bonus');
  if (profBonusInput) {
    const rawValue = String(profBonusInput.value || '').trim();
    if (!rawValue) {
      setProficiencyBonusOverride(false);
      profBonusInput.value = calculateProficiencyBonus();
      return;
    }
    const current = sanitizeSignedValue(profBonusInput.value);
    const calculated = calculateProficiencyBonus();
    setProficiencyBonusOverride(current !== calculated);
    profBonusInput.value = current;
  }
}

function bindAutoMathOverrideInputs() {
  ABILITY_LIST.forEach(ability => {
    const bonusInput = document.getElementById(`${ability}_bonus`);
    if (!bonusInput || bonusInput.dataset.bonusOverrideBound === '1') return;
    bonusInput.dataset.bonusOverrideBound = '1';
    bonusInput.readOnly = false;
    bonusInput.removeAttribute('readonly');
    bonusInput.inputMode = 'numeric';

    bonusInput.addEventListener('input', () => {
      const cleaned = String(bonusInput.value || '').replace(/[^0-9-]/g, '');
      const normalized = cleaned.startsWith('-')
        ? '-' + cleaned.slice(1).replace(/-/g, '')
        : cleaned.replace(/-/g, '');
      bonusInput.value = normalized;
      setAbilityBonusOverride(ability, true);
      calculateSavingThrow(ability);
      updateAllSkillBonuses();
      if (typeof autosave === 'function') autosave();
    });

    bonusInput.addEventListener('blur', () => {
      const trimmed = String(bonusInput.value || '').trim();
      if (!trimmed) {
        setAbilityBonusOverride(ability, false);
        calculateAbilityBonus(ability);
      } else {
        bonusInput.value = sanitizeSignedValue(trimmed);
        setAbilityBonusOverride(ability, bonusInput.value !== getCalculatedAbilityBonus(ability));
        calculateSavingThrow(ability);
        updateAllSkillBonuses();
      }
      if (typeof autosave === 'function') autosave();
    });
  });

  const profBonusInput = document.getElementById('prof_bonus');
  if (profBonusInput && profBonusInput.dataset.profOverrideBound !== '1') {
    profBonusInput.dataset.profOverrideBound = '1';
    profBonusInput.readOnly = false;
    profBonusInput.removeAttribute('readonly');
    profBonusInput.inputMode = 'numeric';

    profBonusInput.addEventListener('input', () => {
      const cleaned = String(profBonusInput.value || '').replace(/[^0-9-]/g, '');
      const normalized = cleaned.startsWith('-')
        ? '-' + cleaned.slice(1).replace(/-/g, '')
        : cleaned.replace(/-/g, '');
      profBonusInput.value = normalized;
      setProficiencyBonusOverride(true);
      ABILITY_LIST.forEach(ability => calculateSavingThrow(ability));
      updateAllSkillBonuses();
      if (typeof autosave === 'function') autosave();
    });

    profBonusInput.addEventListener('blur', () => {
      const trimmed = String(profBonusInput.value || '').trim();
      if (!trimmed) {
        setProficiencyBonusOverride(false);
        updateProficiencyBonus();
      } else {
        profBonusInput.value = sanitizeSignedValue(trimmed);
        setProficiencyBonusOverride(profBonusInput.value !== calculateProficiencyBonus());
        ABILITY_LIST.forEach(ability => calculateSavingThrow(ability));
        updateAllSkillBonuses();
      }
      if (typeof autosave === 'function') autosave();
    });
  }
}

function enforceAutoMathNumericInputs() {
  const unsignedNumericIds = ['str','dex','con','int','wis','cha','char_level','max_hp','curr_hp','hit_dice_spend','ac','initiative','speed'];
  unsignedNumericIds.forEach(id => {
    const input = document.getElementById(id);
    if (!input || input.dataset.numericOnlyBound === '1') return;
    input.dataset.numericOnlyBound = '1';
    input.inputMode = 'numeric';
    input.addEventListener('input', () => {
      const maxLength = input.id === 'char_level' ? 2 : (input.id.length === 3 ? 2 : null);
      const next = sanitizeDigits(input.value, maxLength);
      if (input.value !== next) input.value = next;
    });
  });

  const signedNumericIds = ['con_modifier'];
  signedNumericIds.forEach(id => {
    const input = document.getElementById(id);
    if (!input || input.dataset.signedNumericOnlyBound === '1') return;
    input.dataset.signedNumericOnlyBound = '1';
    input.inputMode = 'numeric';
    input.addEventListener('input', () => {
      const cleaned = String(input.value || '').replace(/[^0-9-]/g, '');
      const normalized = cleaned.startsWith('-')
        ? '-' + cleaned.slice(1).replace(/-/g, '')
        : cleaned.replace(/-/g, '');
      if (input.value !== normalized) input.value = normalized;
    });
  });

  ['str_save','dex_save','con_save','int_save','wis_save','cha_save']
    .forEach(id => {
      const field = document.getElementById(id);
      if (field) field.readOnly = true;
    });

  bindAutoMathOverrideInputs();
}

function calculateSkillBonus(skill) {
  const ability = SKILL_ABILITY_MAP[skill];
  if (!ability) return;

  const totalInput = document.getElementById(`bonus_${skill}`);
  const profCheckbox = document.getElementById(`prof_${skill}`);
  const adjInput = document.getElementById(`adj_${skill}`);
  const abilityBonus = document.getElementById(`${ability}_bonus`);
  const profBonus = document.getElementById('prof_bonus');
  if (!totalInput || !profCheckbox || !abilityBonus || !profBonus) return;

  const abilityMod = parseSignedNumber(abilityBonus.value);
  const profMod = parseSignedNumber(profBonus.value);
  const adjMod = parseSignedNumber(adjInput ? adjInput.value : 0);

  let total = abilityMod + adjMod;
  if (profCheckbox.checked) total += profMod;

  totalInput.value = formatSignedNumber(total);
}

function updateAllSkillBonuses() {
  SKILL_LIST.forEach(skill => calculateSkillBonus(skill));
}

function setupSkillCalculationFields() {
  SKILL_LIST.forEach(skill => {
    const row = document.getElementById(`bonus_${skill}`)?.closest('.skill-row');
    const totalInput = document.getElementById(`bonus_${skill}`);
    const profCheckbox = document.getElementById(`prof_${skill}`);
    if (!row || !totalInput || !profCheckbox) return;

    totalInput.readOnly = true;
    totalInput.classList.add('skill-total-input');
    totalInput.tabIndex = -1;

    let adjInput = document.getElementById(`adj_${skill}`);
    if (!adjInput) {
      adjInput = document.createElement('input');
      adjInput.type = 'text';
      adjInput.id = `adj_${skill}`;
      adjInput.className = 'skill-adjust-input';
      adjInput.placeholder = '+0';
      adjInput.value = '+0';
      row.insertBefore(adjInput, totalInput);
    }

    if (adjInput.dataset.skillAdjustBound !== '1') {
      adjInput.dataset.skillAdjustBound = '1';
      adjInput.addEventListener('input', () => {
        calculateSkillBonus(skill);
        autosave();
      });
      adjInput.addEventListener('blur', () => {
        adjInput.value = sanitizeSignedValue(adjInput.value);
        calculateSkillBonus(skill);
        autosave();
      });
    }

    if (profCheckbox.dataset.skillProfBound !== '1') {
      profCheckbox.dataset.skillProfBound = '1';
      profCheckbox.addEventListener('change', () => {
        calculateSkillBonus(skill);
        autosave();
      });
    }
  });

  if (document.body.dataset.skillAutoMathBound !== '1') {
    document.body.dataset.skillAutoMathBound = '1';
    ['str', 'dex', 'con', 'int', 'wis', 'cha'].forEach(ability => {
      const scoreInput = document.getElementById(ability);
      const bonusInput = document.getElementById(`${ability}_bonus`);
      if (scoreInput) {
        scoreInput.addEventListener('input', () => updateAllSkillBonuses());
        scoreInput.addEventListener('change', () => updateAllSkillBonuses());
      }
      if (bonusInput) {
        bonusInput.addEventListener('input', () => updateAllSkillBonuses());
        bonusInput.addEventListener('change', () => updateAllSkillBonuses());
      }
    });
    const profBonusInput = document.getElementById('prof_bonus');
    if (profBonusInput) {
      profBonusInput.addEventListener('input', () => updateAllSkillBonuses());
      profBonusInput.addEventListener('change', () => updateAllSkillBonuses());
    }
  }

  updateAllSkillBonuses();
}

function calculateAbilityBonus(ability) {
  const scoreInput = document.getElementById(ability);
  const bonusInput = document.getElementById(ability + '_bonus');

  if (!scoreInput || !bonusInput) return;

  scoreInput.value = sanitizeDigits(scoreInput.value, 2);
  const score = parseInt(scoreInput.value, 10) || 0;
  const modifier = Math.floor((score - 10) / 2);

  if (!autoMathOverrideState.abilityBonus[ability]) {
    bonusInput.value = formatSignedNumber(modifier);
  }

  calculateSavingThrow(ability);
  updateAllSkillBonuses();
}

function formatBonusInput(inputId) {
  if (!inputId) return;
  const ability = inputId.replace('_bonus', '');
  calculateAbilityBonus(ability);
}

function formatSaveInput(inputId) {
  const input = document.getElementById(inputId);
  if (!input) return;

  let value = input.value;
  if (!value.startsWith('+') && !value.startsWith('-')) value = '+' + value;
  if (value.startsWith('++')) value = '+' + value.substring(2);
  if (value.length > 4) value = value.substring(0, 4);
  input.value = value;
}

function calculateSavingThrow(ability) {
  const saveInput = document.getElementById(ability + '_save');
  const profCheckbox = document.getElementById(ability + '_save_prof');
  const abilityBonus = document.getElementById(ability + '_bonus');
  const profBonus = document.getElementById('prof_bonus');

  if (!saveInput || !profCheckbox || !abilityBonus || !profBonus) return;

  const abilityMod = parseInt(abilityBonus.value.replace('+', '')) || 0;
  const profMod = parseInt(profBonus.value.replace('+', '')) || 0;
  let saveMod = abilityMod;
  if (profCheckbox.checked) saveMod += profMod;
  saveInput.value = saveMod >= 0 ? `+${saveMod}` : `${saveMod}`;
}

function calculateProficiencyBonus() {
  const levelInput = document.getElementById('char_level');
  if (!levelInput) return '+2';

  const level = parseInt(levelInput.value) || 1;
  let profBonus = 2;
  if (level >= 5) profBonus = 3;
  if (level >= 9) profBonus = 4;
  if (level >= 13) profBonus = 5;
  if (level >= 17) profBonus = 6;
  return `+${profBonus}`;
}

function updateProficiencyBonus() {
  const profBonusInput = document.getElementById('prof_bonus');
  if (!profBonusInput) return;

  const newProfBonus = calculateProficiencyBonus();
  if (!autoMathOverrideState.profBonus) {
    profBonusInput.value = newProfBonus;
  }

  ABILITY_LIST.forEach(ability => calculateSavingThrow(ability));
  updateAllSkillBonuses();
}

function handleProfBonusInput() {
  const profBonusInput = document.getElementById('prof_bonus');
  if (!profBonusInput) return;

  profBonusInput.value = sanitizeSignedValue(profBonusInput.value);
  setProficiencyBonusOverride(profBonusInput.value !== calculateProficiencyBonus());

  ABILITY_LIST.forEach(ability => calculateSavingThrow(ability));
  updateAllSkillBonuses();
}

function resetProfBonusIfEmpty() {
  const profBonusInput = document.getElementById('prof_bonus');
  if (!profBonusInput) return;
  if (!profBonusInput.value.trim()) {
    setProficiencyBonusOverride(false);
    updateProficiencyBonus();
  }
}

function updateProficiencyBonusIfNotOverridden() {
  const profBonusInput = document.getElementById('prof_bonus');
  if (!profBonusInput) return;
  if (!autoMathOverrideState.profBonus || !profBonusInput.value.trim()) {
    setProficiencyBonusOverride(false);
    updateProficiencyBonus();
  }
}

Object.assign(window, {
  formatSignedNumber,
  parseSignedNumber,
  sanitizeDigits,
  sanitizeSignedValue,
  enforceAutoMathNumericInputs,
  calculateSkillBonus,
  updateAllSkillBonuses,
  setupSkillCalculationFields,
  calculateAbilityBonus,
  formatBonusInput,
  formatSaveInput,
  calculateSavingThrow,
  calculateProficiencyBonus,
  updateProficiencyBonus,
  handleProfBonusInput,
  resetProfBonusIfEmpty,
  updateProficiencyBonusIfNotOverridden
});
