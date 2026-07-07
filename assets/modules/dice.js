// ========== FAIR DICE SYSTEM ==========
// A provably-unbiased dice roller + weapon roll helpers + a roll log.
//
// Fairness guarantees (why this is honest):
//  1. Randomness comes from crypto.getRandomValues (CSPRNG), not Math.random.
//  2. Rejection sampling removes modulo bias — every face is EXACTLY equally
//     likely, no matter the die size. (Naive `rand % n` favours low faces.)
//  3. Nothing is fudged or clamped: crits, nat-1s, advantage/disadvantage are
//     all shown exactly as rolled, every individual die visible in the log.
//  4. Crits roll DOUBLE the damage dice (roll them for real) — not total ×2.
//
// No dependency on any character mutation — rolling never writes to the sheet.

// One unbiased integer in [1, sides] via rejection sampling.
function rollDie(sides) {
  sides = Math.max(2, Math.floor(sides) || 6);
  // Largest multiple of `sides` that fits in a byte; reject anything above it so
  // the remaining range maps evenly onto the faces (no leftover = no bias).
  const maxUnbiased = 256 - (256 % sides);
  const buf = new Uint8Array(1);
  let x;
  do {
    (crypto.getRandomValues ? crypto : window.crypto).getRandomValues(buf);
    x = buf[0];
  } while (x >= maxUnbiased);
  return (x % sides) + 1;
}

// Roll `count` dice of `sides`, returning each face + the sum.
function rollDicePool(count, sides) {
  count = Math.max(0, Math.floor(count) || 0);
  const rolls = [];
  for (let i = 0; i < count; i++) rolls.push(rollDie(sides));
  return { rolls, total: rolls.reduce((a, b) => a + b, 0) };
}

// Parse a dice string like "1d8", "2d6", "1d10 + 1d4", "3" (flat) into terms.
// Returns { dice: [{count, sides}], flat } — robust to spaces / '+' joins.
function parseDiceExpr(expr) {
  const out = { dice: [], flat: 0 };
  if (!expr) return out;
  String(expr).toLowerCase().split('+').forEach(part => {
    const p = part.trim();
    if (!p) return;
    const m = p.match(/^(\d*)d(\d+)$/);
    if (m) {
      out.dice.push({ count: parseInt(m[1] || '1', 10), sides: parseInt(m[2], 10) });
    } else if (/^\d+$/.test(p)) {
      out.flat += parseInt(p, 10);
    }
  });
  return out;
}

// Roll a full dice expression, optionally doubling the dice (for crits).
// Returns { terms:[{count,sides,rolls,total}], flat, total, doubled }.
function rollExpr(expr, doubleDice) {
  const parsed = parseDiceExpr(expr);
  const terms = parsed.dice.map(d => {
    const count = doubleDice ? d.count * 2 : d.count;
    const r = rollDicePool(count, d.sides);
    return { count, sides: d.sides, rolls: r.rolls, total: r.total };
  });
  const diceTotal = terms.reduce((a, t) => a + t.total, 0);
  return { terms, flat: parsed.flat, total: diceTotal + parsed.flat, doubled: !!doubleDice };
}

// ---- ability / proficiency helpers (read live from the sheet, never write) ----
function abilityModFromSheet(ability) {
  const el = document.getElementById((ability || 'str').toLowerCase());
  const score = el ? parseInt(el.value, 10) : NaN;
  if (isNaN(score)) return 0;
  return Math.floor((score - 10) / 2);
}
function proficiencyBonusFromSheet() {
  const el = document.getElementById('prof_bonus');
  const v = el ? parseInt(String(el.value).replace('+', ''), 10) : NaN;
  return isNaN(v) ? 2 : v;
}

// The to-hit modifier a weapon should use. Override (if a number) always wins;
// otherwise ability mod + (proficiency if proficient).
// A magic weapon's enhancement bonus (+1..+5), added to BOTH attack and damage
// per 5e rules. Stored as `enhancement`; 0/blank = mundane.
function weaponEnhancement(weapon) {
  const e = parseInt(weapon && weapon.enhancement, 10);
  return isNaN(e) ? 0 : e;
}
function weaponToHitMod(weapon) {
  const enh = weaponEnhancement(weapon);
  if (weapon.toHitOverride !== '' && weapon.toHitOverride != null && !isNaN(parseInt(weapon.toHitOverride, 10))) {
    // An explicit override is the final to-hit; enhancement is assumed baked in.
    return parseInt(weapon.toHitOverride, 10);
  }
  const mod = abilityModFromSheet(weapon.ability || 'str');
  return mod + (weapon.proficient ? proficiencyBonusFromSheet() : 0) + enh;
}
// The flat damage modifier: ability mod + extra damage bonus + enhancement.
function weaponDamageMod(weapon) {
  const mod = abilityModFromSheet(weapon.ability || 'str');
  const extra = parseInt(weapon.damageBonus, 10);
  return mod + (isNaN(extra) ? 0 : extra) + weaponEnhancement(weapon);
}

// ---- weapon rolls ----
// mode: 'normal' | 'adv' | 'dis'. Rolls d20 (twice for adv/dis), applies the
// weapon's to-hit mod, flags nat 20 / nat 1 on the KEPT die.
function rollWeaponToHit(weapon, mode) {
  const mod = weaponToHitMod(weapon);
  const d1 = rollDie(20);
  let kept = d1, other = null;
  if (mode === 'adv' || mode === 'dis') {
    other = rollDie(20);
    kept = (mode === 'adv') ? Math.max(d1, other) : Math.min(d1, other);
  }
  return {
    kind: 'tohit', weapon: weapon.displayName || weapon.name || 'Weapon', mode: mode || 'normal',
    d20: kept, otherD20: other, mod,
    total: kept + mod,
    nat20: kept === 20, nat1: kept === 1
  };
}

// ---- crit rule (sheet-wide setting, stored in localStorage) ----
// The four common D&D conventions. 'double-dice' is official 5e RAW; the rest
// are popular house rules. Chosen once via the Weapons help panel.
const CRIT_MODES = {
  'double-dice': { label: 'Double dice (RAW)', desc: 'Roll twice the weapon dice, add modifiers once.' },
  'max-plus-roll': { label: 'Max + roll (Savage)', desc: 'Max of the normal dice, then roll one more set on top.' },
  'double-total': { label: 'Double total', desc: 'Roll normal damage, then double everything including modifiers.' },
  'max': { label: 'Max damage', desc: 'No roll — maximum possible damage.' }
};
function getCritMode() {
  const m = localStorage.getItem('dndCritMode');
  return CRIT_MODES[m] ? m : 'double-dice';
}
function setCritMode(mode) {
  if (CRIT_MODES[mode]) localStorage.setItem('dndCritMode', mode);
}

// Sync the Weapons help-panel picker to the stored mode + show its description.
function initCritModePicker() {
  const sel = document.getElementById('critModeSelect');
  const mode = getCritMode();
  if (sel) sel.value = mode;
  const note = document.getElementById('critModeNote');
  if (note) note.textContent = CRIT_MODES[mode] ? CRIT_MODES[mode].desc : '';
}
function onCritModeChange(mode) {
  setCritMode(mode);
  const note = document.getElementById('critModeNote');
  if (note) note.textContent = CRIT_MODES[mode] ? CRIT_MODES[mode].desc : '';
}

// Max total of a dice expression's dice (each die shows its max face).
function maxDiceTerms(expr) {
  const parsed = parseDiceExpr(expr);
  const terms = parsed.dice.map(d => ({
    count: d.count, sides: d.sides,
    rolls: Array(d.count).fill(d.sides), total: d.count * d.sides
  }));
  return { terms, flat: parsed.flat, total: terms.reduce((a, t) => a + t.total, 0) + parsed.flat };
}

// Roll weapon damage. On a normal hit, straight dice + mod. On a crit, apply the
// player's chosen crit rule. Modifiers are added ONCE except 'double-total',
// which doubles the whole result (the point of that house rule).
function rollWeaponDamage(weapon, crit) {
  // A damage override forces the exact expression (mods assumed baked in). Crit
  // still applies the chosen rule to the override's dice.
  const hasOverride = weapon.damageOverride && String(weapon.damageOverride).trim() !== '';
  const dice = hasOverride ? String(weapon.damageOverride).trim()
             : (weapon.damageDice || weapon.damage || '');
  const mod = hasOverride ? 0 : weaponDamageMod(weapon);
  let terms, flatFromDice, total, critMode = null;

  if (!crit) {
    const rolled = rollExpr(dice, false);
    terms = rolled.terms; flatFromDice = rolled.flat;
    total = rolled.total + mod;
  } else {
    critMode = getCritMode();
    if (critMode === 'double-dice') {
      const r = rollExpr(dice, true);
      terms = r.terms; flatFromDice = r.flat; total = r.total + mod;
    } else if (critMode === 'double-total') {
      const r = rollExpr(dice, false);
      terms = r.terms; flatFromDice = r.flat;
      total = (r.total + mod) * 2;
    } else if (critMode === 'max') {
      const m = maxDiceTerms(dice);
      terms = m.terms; flatFromDice = m.flat; total = m.total + mod;
    } else { // 'max-plus-roll' — max of normal dice + one rolled set
      const maxed = maxDiceTerms(dice);
      const rolled = rollExpr(dice, false);
      // Merge: show maxed dice AND the extra rolled dice as separate terms.
      terms = maxed.terms.concat(rolled.terms);
      flatFromDice = maxed.flat + rolled.flat;
      total = maxed.total + rolled.total + mod;
    }
  }

  return {
    kind: 'damage', weapon: weapon.displayName || weapon.name || 'Weapon', crit: !!crit, critMode,
    terms, flatFromDice, mod,
    damageType: weapon.damageType || '',
    total: Math.max(0, total)
  };
}

// ---- roll log (persisted PER-CHARACTER, grouped by day) ----
// Shape: characterRollLog = { days: { 'YYYY-MM-DD': [entry, ...newest-last] } }
// Each entry stores its dice/total so the Admin logs viewer + export can replay
// it. The on-screen panel shows the most recent rolls (today first). Saved in
// the character blob under data.rollLog, so it syncs to the cloud.
let characterRollLog = { days: {} };
const _ROLL_LOG_DAY_MAX = 300;   // cap per day so it never bloats a sheet
const _ROLL_LOG_PANEL_MAX = 40;  // how many recent rolls the panel shows

function _todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Flattened newest-first view across all days, for the on-screen panel.
function _recentRolls(limit) {
  const days = Object.keys(characterRollLog.days || {}).sort().reverse();
  const out = [];
  for (const day of days) {
    const arr = characterRollLog.days[day] || [];
    for (let i = arr.length - 1; i >= 0; i--) {
      out.push(arr[i]);
      if (out.length >= (limit || _ROLL_LOG_PANEL_MAX)) return out;
    }
  }
  return out;
}

function pushRollLog(entry) {
  entry.ts = Date.now(); // store a number; render derives the time
  const key = _todayKey();
  if (!characterRollLog.days) characterRollLog.days = {};
  if (!characterRollLog.days[key]) characterRollLog.days[key] = [];
  const day = characterRollLog.days[key];
  day.push(entry);
  if (day.length > _ROLL_LOG_DAY_MAX) day.splice(0, day.length - _ROLL_LOG_DAY_MAX);
  renderRollLog();
  if (typeof autosave === 'function') autosave(); // persist to the character
}

// Clear only TODAY's rolls from the on-sheet log (history for other days kept).
function clearRollLog() {
  const key = _todayKey();
  if (characterRollLog.days && characterRollLog.days[key]) delete characterRollLog.days[key];
  renderRollLog();
  if (typeof autosave === 'function') autosave();
}

// Open the roll log in its popup (kept hidden until asked for).
function showRollLogPopup() {
  renderRollLog();
  if (typeof showPopup === 'function') showPopup('rollLogPopup');
}

// Human-readable dice breakdown, e.g. "2d6 [4, 5] + 3".
function _describeDamageTerms(entry) {
  const parts = entry.terms.map(t => `${t.count}d${t.sides} [${t.rolls.join(', ')}]`);
  const bits = [];
  if (parts.length) bits.push(parts.join(' + '));
  if (entry.flatFromDice) bits.push(String(entry.flatFromDice));
  if (entry.mod) bits.push((entry.mod >= 0 ? '+' : '') + entry.mod);
  return bits.join(' ');
}

function renderRollLog() {
  const el = document.getElementById('weaponRollLog');
  if (!el) return;
  const rolls = _recentRolls(_ROLL_LOG_PANEL_MAX);
  if (!rolls.length) {
    el.innerHTML = '<p class="roll-log-empty">No rolls yet. Use a weapon’s Hit / Dmg buttons to roll — every die is shown here and saved to your sheet.</p>';
    return;
  }
  const esc = window.escapeHtml || ((s) => String(s));
  el.innerHTML = rolls.map(e => {
    const time = new Date(e.ts || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    if (e.kind === 'tohit') {
      const modeTag = e.mode === 'adv' ? '<span class="roll-tag roll-adv">ADV</span>'
                    : e.mode === 'dis' ? '<span class="roll-tag roll-dis">DIS</span>' : '';
      const critClass = e.nat20 ? ' roll-nat20' : (e.nat1 ? ' roll-nat1' : '');
      const critLabel = e.nat20 ? ' <span class="roll-crit-label">CRIT!</span>' : (e.nat1 ? ' <span class="roll-nat1-label">nat 1</span>' : '');
      return `
        <div class="roll-log-row${critClass}">
          <div class="roll-log-main">
            <span class="roll-log-weapon">${esc(e.weapon)}</span> ${modeTag}
            <span class="roll-log-type">to hit</span>
            <span class="roll-log-total">${e.total}</span>${critLabel}
          </div>
          <div class="roll-log-detail">d20: ${e.d20}${e.otherD20 != null ? ` , ${e.otherD20}` : ''} ${(e.mod >= 0 ? '+' : '') + e.mod} • ${time}</div>
        </div>`;
    }
    const critRule = (e.crit && e.critMode && CRIT_MODES[e.critMode]) ? ` (${CRIT_MODES[e.critMode].label})` : '';
    return `
      <div class="roll-log-row${e.crit ? ' roll-crit-dmg' : ''}">
        <div class="roll-log-main">
          <span class="roll-log-weapon">${esc(e.weapon)}</span>
          <span class="roll-log-type">${e.crit ? 'CRIT damage' + esc(critRule) : 'damage'}${e.damageType ? ' · ' + esc(e.damageType) : ''}</span>
          <span class="roll-log-total">${e.total}</span>
        </div>
        <div class="roll-log-detail">${esc(_describeDamageTerms(e))} • ${time}</div>
      </div>`;
  }).join('');
}

// ---- public actions wired to weapon buttons (by index into weaponsData) ----
function rollWeaponAttack(index, mode) {
  const w = (typeof weaponsData !== 'undefined' && weaponsData[index]) ? weaponsData[index] : null;
  if (!w) return;
  const res = rollWeaponToHit(w, mode);
  pushRollLog(res);
}

function rollWeaponDmg(index, crit) {
  const w = (typeof weaponsData !== 'undefined' && weaponsData[index]) ? weaponsData[index] : null;
  if (!w) return;
  const res = rollWeaponDamage(w, crit);
  pushRollLog(res);
}
