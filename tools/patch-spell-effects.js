#!/usr/bin/env node
// tools/patch-spell-effects.js
// Parses Open5e spell descriptions to extract damage, save, and attack fields
// to match the old layout. Never touches existing non-empty values.
// Run: node tools/patch-spell-effects.js

const fs = require('fs');
const path = require('path');

const SPELLS_PATH = path.join(__dirname, '..', 'assets', 'data', 'spells.json');

// Damage type keywords
const DMG_TYPES = [
  'acid','bludgeoning','cold','fire','force','lightning','necrotic',
  'piercing','poison','psychic','radiant','slashing','thunder'
];

// Build a regex that matches dice expressions + damage type
// e.g. "8d6 fire damage", "1d4 + 1 force damage", "1d8 + your spellcasting ability modifier"
const DMG_TYPE_PATTERN = DMG_TYPES.join('|');
const DICE_PATTERN = new RegExp(
  `(\\d+d\\d+(?:\\s*[+\\-]\\s*(?:\\d+|your spellcasting ability modifier|your spellcasting modifier))?)\\s+(${DMG_TYPE_PATTERN})\\s+damage`,
  'i'
);

// Also catch "weapon damage + X damage" patterns
const WEAPON_DMG_PATTERN = new RegExp(
  `weapon damage(?:\\s*\\+\\s*(${DMG_TYPE_PATTERN})\\s+damage)?`,
  'i'
);

// Healing pattern
const HEAL_PATTERN = /regains?\s+(?:a number of\s+)?hit points?\s+equal to\s+([\dd\s+\w]+(?:ability modifier)?)/i;
const HEAL_DICE_PATTERN = /(\d+d\d+(?:\s*\+\s*(?:\d+|your spellcasting ability modifier))?)/i;

// Save pattern
const SAVE_PATTERN = new RegExp(
  `(Strength|Dexterity|Constitution|Intelligence|Wisdom|Charisma)\\s+saving throw`,
  'i'
);

// Attack pattern
const ATTACK_PATTERN = /(ranged spell attack|melee spell attack|ranged weapon attack|melee weapon attack)/i;

function extractDamage(desc) {
  if (!desc) return '';

  // Weapon-based spells
  const weaponMatch = desc.match(WEAPON_DMG_PATTERN);
  if (weaponMatch) {
    const extra = weaponMatch[1];
    return extra ? `Weapon damage + ${extra} damage` : 'Weapon damage';
  }

  // Standard dice damage
  const diceMatch = desc.match(DICE_PATTERN);
  if (diceMatch) {
    const dice = diceMatch[1].trim();
    const type = diceMatch[2].toLowerCase();
    return `${dice} ${type} damage`;
  }

  // Healing spells — only match when dice are adjacent to "regains hit points" or "healing"
  // Use a tighter pattern to avoid false positives like object HP pools
  const healContextPattern = /regains?\s+(?:a number of\s+)?hit points?\s+equal to\s+(\d+d\d+(?:\s*\+\s*(?:\d+|your spellcasting ability modifier))?)/i;
  const healCtxMatch = desc.match(healContextPattern);
  if (healCtxMatch) {
    return `${healCtxMatch[1]} healing`;
  }

  return '';
}

function extractSave(desc) {
  if (!desc) return '';
  const m = desc.match(SAVE_PATTERN);
  if (!m) return '';
  // Capitalise properly
  const ability = m[1].charAt(0).toUpperCase() + m[1].slice(1).toLowerCase();
  return `${ability} save`;
}

function extractAttack(desc) {
  if (!desc) return '';
  const m = desc.match(ATTACK_PATTERN);
  if (!m) return '';
  // Title-case each word
  return m[1].replace(/\b\w/g, c => c.toUpperCase());
}

function main() {
  const spells = JSON.parse(fs.readFileSync(SPELLS_PATH, 'utf8'));

  let patched = 0;
  let skipped = 0;

  const result = spells.map(spell => {
    const desc = spell.description || '';
    let changed = false;

    // Only fill in fields that are currently empty — never overwrite existing data
    if (!spell.damage) {
      const extracted = extractDamage(desc);
      if (extracted) { spell.damage = extracted; changed = true; }
    }

    if (!spell.save) {
      const extracted = extractSave(desc);
      if (extracted) { spell.save = extracted; changed = true; }
    }

    if (!spell.attack) {
      const extracted = extractAttack(desc);
      if (extracted) { spell.attack = extracted; changed = true; }
    }

    if (changed) patched++;
    else skipped++;

    return spell;
  });

  fs.writeFileSync(SPELLS_PATH, JSON.stringify(result, null, 2), 'utf8');

  console.log(`Done. ${patched} spells patched, ${skipped} unchanged.`);

  // Show a sample of what was extracted
  console.log('\nSample extractions:');
  const samples = result.filter(s => s.damage || s.save || s.attack).slice(0, 15);
  samples.forEach(s => {
    console.log(`  ${s.name}: damage="${s.damage}" save="${s.save}" attack="${s.attack}"`);
  });

  // Stats
  const hasDmg = result.filter(s => s.damage).length;
  const hasSave = result.filter(s => s.save).length;
  const hasAtk = result.filter(s => s.attack).length;
  console.log(`\nTotals: damage=${hasDmg} save=${hasSave} attack=${hasAtk}`);
}

main();
