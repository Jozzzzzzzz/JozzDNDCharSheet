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
  initiative: false,
  passivePerception: false,
  spellSaveDC: false,
  spellAttack: false,
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
  const unsignedNumericIds = ['str','dex','con','int','wis','cha','char_level','max_hp','curr_hp','hit_dice_spend','ac','speed'];
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

  const signedNumericIds = ['con_modifier', 'initiative'];
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

// Proficiency levels for skills: 0 none, 1 half (Jack of All Trades),
// 2 proficient, 3 expertise. The proficiency bonus is multiplied accordingly
// (half rounds down, per 5e RAW).
const SKILL_PROF_LEVELS = [
  { level: 0, mult: 0,   glyph: '—', label: '',     title: 'Not proficient' },
  { level: 1, mult: 0.5, glyph: '½', label: 'Half', title: 'Half proficiency (e.g. Jack of All Trades)' },
  { level: 2, mult: 1,   glyph: '●', label: 'Prof', title: 'Proficient' },
  { level: 3, mult: 2,   glyph: '★', label: 'Exp',  title: 'Expertise (double proficiency)' },
];

// The prof_<skill> checkbox stores the level in data-prof-level; .checked mirrors
// "at least proficient" so legacy save/read paths still work.
function getSkillProfLevel(skill) {
  const el = document.getElementById(`prof_${skill}`);
  if (!el) return 0;
  const lvl = parseInt(el.dataset.profLevel, 10);
  if (!isNaN(lvl)) return Math.max(0, Math.min(3, lvl));
  return el.checked ? 2 : 0; // pre-migration fallback
}

function setSkillProfLevel(skill, level) {
  const el = document.getElementById(`prof_${skill}`);
  if (!el) return;
  const lvl = Math.max(0, Math.min(3, level | 0));
  el.dataset.profLevel = String(lvl);
  el.checked = lvl >= 2; // keep legacy boolean save/read in sync
  renderSkillProfButton(skill);
}

function cycleSkillProf(skill) {
  setSkillProfLevel(skill, (getSkillProfLevel(skill) + 1) % 4);
  calculateSkillBonus(skill);
  if (typeof autosave === 'function') autosave();
}

// Paint the cycle button next to a skill row to match its current level, and
// tint the whole row by proficiency level for faster scanning.
function renderSkillProfButton(skill) {
  const btn = document.getElementById(`profbtn_${skill}`);
  if (!btn) return;
  const info = SKILL_PROF_LEVELS[getSkillProfLevel(skill)] || SKILL_PROF_LEVELS[0];
  btn.textContent = info.label ? `${info.glyph} ${info.label}` : info.glyph;
  btn.title = info.title;
  btn.dataset.level = String(info.level);
  const row = btn.closest('.skill-row');
  if (row) row.dataset.profLevel = String(info.level);
}

function calculateSkillBonus(skill) {
  const ability = SKILL_ABILITY_MAP[skill];
  if (!ability) return;

  const totalInput = document.getElementById(`bonus_${skill}`);
  const adjInput = document.getElementById(`adj_${skill}`);
  const abilityBonus = document.getElementById(`${ability}_bonus`);
  const profBonus = document.getElementById('prof_bonus');
  if (!totalInput || !abilityBonus || !profBonus) return;

  const abilityMod = parseSignedNumber(abilityBonus.value);
  const profMod = parseSignedNumber(profBonus.value);
  const adjMod = parseSignedNumber(adjInput ? adjInput.value : 0);

  const mult = (SKILL_PROF_LEVELS[getSkillProfLevel(skill)] || SKILL_PROF_LEVELS[0]).mult;
  const total = abilityMod + adjMod + Math.floor(profMod * mult);

  totalInput.value = formatSignedNumber(total);
  if (skill === 'perception') updatePassivePerception();
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
      row.appendChild(adjInput);
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

    // Replace the raw proficiency checkbox with a cycle button (none/half/prof/
    // expertise). The checkbox element stays in the DOM (hidden) so its ID and
    // the legacy .checked save/read path keep working; the button drives it.
    if (profCheckbox.dataset.skillProfBound !== '1') {
      profCheckbox.dataset.skillProfBound = '1';
      profCheckbox.classList.add('skill-prof-checkbox-hidden');
      // Seed the level from any existing checked state (pre-migration saves).
      if (profCheckbox.dataset.profLevel === undefined) {
        profCheckbox.dataset.profLevel = profCheckbox.checked ? '2' : '0';
      }
      let btn = document.getElementById(`profbtn_${skill}`);
      if (!btn) {
        btn = document.createElement('button');
        btn.type = 'button';
        btn.id = `profbtn_${skill}`;
        btn.className = 'skill-prof-btn';
        btn.addEventListener('click', () => cycleSkillProf(skill));
        profCheckbox.insertAdjacentElement('afterend', btn);
      }
      renderSkillProfButton(skill);
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
  if (ability === 'dex') updateInitiative();
  if (ability === 'con') syncConModifier();
  if (ability === 'int' || ability === 'wis' || ability === 'cha') updateSpellcastingStats();
  // Any ability can be a weapon's attack stat (e.g. a Warlock's CHA pact weapon),
  // so refresh the weapon cards' auto to-hit/damage whenever any score changes.
  if (typeof refreshWeaponDisplayFields === 'function') {
    refreshWeaponDisplayFields();
    if (typeof displayWeaponsStats === 'function') displayWeaponsStats();
  }
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
  updateAllDerivedStats();
}

function handleProfBonusInput() {
  const profBonusInput = document.getElementById('prof_bonus');
  if (!profBonusInput) return;

  profBonusInput.value = sanitizeSignedValue(profBonusInput.value);
  setProficiencyBonusOverride(profBonusInput.value !== calculateProficiencyBonus());

  ABILITY_LIST.forEach(ability => calculateSavingThrow(ability));
  updateAllSkillBonuses();
  updateSpellcastingStats();
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

// ── Initiative (auto = DEX mod, overridable) ──────────────────────────────
function updateInitiative() {
  const input = document.getElementById('initiative');
  if (!input) return;
  if (autoMathOverrideState.initiative) return;
  const dexBonus = document.getElementById('dex_bonus');
  const val = parseSignedNumber(dexBonus ? dexBonus.value : '0');
  input.value = formatSignedNumber(val);
}

function handleInitiativeInput() {
  const input = document.getElementById('initiative');
  if (!input) return;
  const dexBonus = document.getElementById('dex_bonus');
  const auto = formatSignedNumber(parseSignedNumber(dexBonus ? dexBonus.value : '0'));
  autoMathOverrideState.initiative = input.value.trim() !== '' && input.value !== auto;
}

// ── Passive Perception (auto = 10 + bonus_perception, overridable) ───────
function updatePassivePerception() {
  const ppInput = document.getElementById('passive_perception');
  if (!ppInput || autoMathOverrideState.passivePerception) return;
  const percBonus = document.getElementById('bonus_perception');
  const bonus = parseSignedNumber(percBonus ? percBonus.value : '0');
  ppInput.value = 10 + bonus;
}

function handlePassivePerceptionInput() {
  const ppInput = document.getElementById('passive_perception');
  if (!ppInput) return;
  const percBonus = document.getElementById('bonus_perception');
  const auto = 10 + parseSignedNumber(percBonus ? percBonus.value : '0');
  const isOverride = ppInput.value.trim() !== '' && parseInt(ppInput.value) !== auto;
  autoMathOverrideState.passivePerception = isOverride;
  const resetBtn = document.getElementById('passive_perception_reset');
  if (resetBtn) resetBtn.style.display = isOverride ? 'inline-block' : 'none';
}

function resetPassivePerception() {
  autoMathOverrideState.passivePerception = false;
  const resetBtn = document.getElementById('passive_perception_reset');
  if (resetBtn) resetBtn.style.display = 'none';
  updatePassivePerception();
  if (typeof autosave === 'function') autosave();
}

// ── CON modifier sync (auto from con_bonus, read-only in hit dice panel) ─
function syncConModifier() {
  const conMod = document.getElementById('con_modifier');
  if (!conMod) return;
  const conBonus = document.getElementById('con_bonus');
  conMod.value = parseSignedNumber(conBonus ? conBonus.value : '0');
}

// ── Spell Save DC and Spell Attack Bonus (auto, overridable) ─────────────
function getSpellcastingMod() {
  const ability = document.getElementById('spellcasting_ability');
  const abilityKey = ability ? ability.value : 'int';
  const bonusEl = document.getElementById(`${abilityKey}_bonus`);
  return parseSignedNumber(bonusEl ? bonusEl.value : '0');
}

function updateSpellcastingStats() {
  const profBonus = parseSignedNumber((document.getElementById('prof_bonus') || {}).value || '0');
  const spellMod = getSpellcastingMod();

  const dcInput = document.getElementById('spell_save_dc');
  if (dcInput && !autoMathOverrideState.spellSaveDC) {
    dcInput.value = 8 + profBonus + spellMod;
  }

  const atkInput = document.getElementById('spell_attack_bonus');
  if (atkInput && !autoMathOverrideState.spellAttack) {
    atkInput.value = profBonus + spellMod;
  }
}

function handleSpellSaveDCInput() {
  const dcInput = document.getElementById('spell_save_dc');
  if (!dcInput) return;
  const profBonus = parseSignedNumber((document.getElementById('prof_bonus') || {}).value || '0');
  const auto = 8 + profBonus + getSpellcastingMod();
  autoMathOverrideState.spellSaveDC = dcInput.value.trim() !== '' && parseInt(dcInput.value) !== auto;
}

function handleSpellAttackInput() {
  const atkInput = document.getElementById('spell_attack_bonus');
  if (!atkInput) return;
  const profBonus = parseSignedNumber((document.getElementById('prof_bonus') || {}).value || '0');
  const auto = profBonus + getSpellcastingMod();
  autoMathOverrideState.spellAttack = atkInput.value.trim() !== '' && parseInt(atkInput.value) !== auto;
}

// ── Run all derived stats ─────────────────────────────────────────────────
function updateAllDerivedStats() {
  updateInitiative();
  updatePassivePerception();
  syncConModifier();
  updateSpellcastingStats();
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
  updateProficiencyBonusIfNotOverridden,
  updateInitiative,
  handleInitiativeInput,
  updatePassivePerception,
  handlePassivePerceptionInput,
  resetPassivePerception,
  syncConModifier,
  updateSpellcastingStats,
  handleSpellSaveDCInput,
  handleSpellAttackInput,
  updateAllDerivedStats
});
