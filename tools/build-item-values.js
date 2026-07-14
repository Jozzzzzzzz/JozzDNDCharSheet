#!/usr/bin/env node
/**
 * build-item-values.js
 *
 * Assigns a numeric `valueGp` to every item in assets/data/items.json so the loot
 * generator (and the catalogues) have a gold value to work with. As D&D-true as we can:
 *
 *   1. If the item already carries a real price (value / cost string like "400 gp",
 *      "1 sp", "25 gp"), parse it to gp — that wins.
 *   2. Otherwise assign from rarity using DMG (p.135) + Xanathar's item-pricing bands,
 *      rolled WITHIN the band so same-rarity items vary (seeded by name → stable across
 *      rebuilds). Consumables (potion/scroll/oil/ammunition) are halved (single use).
 *   3. Mundane items with no price and no rarity fall back to a small nominal.
 *
 * Idempotent: re-running reproduces the same values (name-seeded RNG). Run:
 *   node tools/build-item-values.js
 */

const fs = require('fs');
const path = require('path');
const FILE = path.join(__dirname, '..', 'assets', 'data', 'items.json');

// DMG/Xanathar rarity → [min, max] gp band.
const RARITY_BANDS = {
  common:      [50, 100],
  uncommon:    [101, 500],
  rare:        [501, 5000],
  'very rare': [5001, 50000],
  legendary:   [50001, 200000],
  artifact:    [250000, 250000], // "priceless" — a big nominal so it sorts to the top
};

// Coin → gp multipliers for parsing real prices.
const COIN_GP = { cp: 0.01, sp: 0.1, ep: 0.5, gp: 1, pp: 10 };

// Parse a price string ("400 gp", "1 sp", "25 gp", "1,500 gp") → gp number, or null.
function parsePriceGp(str) {
  if (!str) return null;
  const m = String(str).replace(/,/g, '').match(/([\d.]+)\s*(cp|sp|ep|gp|pp)/i);
  if (!m) return null;
  const n = parseFloat(m[1]);
  const mult = COIN_GP[m[2].toLowerCase()];
  if (!Number.isFinite(n) || !mult) return null;
  return Math.round(n * mult * 100) / 100;
}

// Deterministic RNG seeded from a string (mulberry32) so rebuilds are stable.
function seedRng(str) {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  let a = h >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function primaryRarity(it) {
  const r = (it.rarity || '').toLowerCase();
  for (const key of ['artifact', 'legendary', 'very rare', 'rare', 'uncommon', 'common']) {
    if (r.includes(key)) return key;
  }
  return '';
}

function isConsumable(it) {
  const t = (it.type || '').toLowerCase();
  const n = (it.name || '').toLowerCase();
  return /potion|scroll|oil|ammunition|elixir/.test(t) || /potion|scroll|oil of |elixir/.test(n);
}

// Roll a value within a band, biased toward the lower-middle (most items aren't top-end),
// then round to a tidy figure.
function rollInBand([min, max], rng) {
  const r = Math.pow(rng(), 1.6); // skew toward min
  let v = min + (max - min) * r;
  // Round to a sensible step relative to size.
  const step = v < 100 ? 5 : v < 1000 ? 25 : v < 10000 ? 100 : 1000;
  return Math.max(min, Math.round(v / step) * step);
}

const items = JSON.parse(fs.readFileSync(FILE, 'utf8'));
let real = 0, byRarity = 0, nominal = 0;

items.forEach(it => {
  // 1) real price
  const parsed = parsePriceGp(it.value);
  if (parsed != null && parsed > 0) {
    it.valueGp = parsed;
    real++;
    return;
  }
  // 2) rarity band
  let rar = primaryRarity(it);
  // "varies" / "rarity by figurine" etc. — no clean rarity, but it IS a magic item, so
  // treat it as uncommon rather than dumping it to a 5gp nominal.
  const rarRaw = (it.rarity || '').toLowerCase().trim();
  if (!rar && rarRaw && rarRaw !== 'unknown') rar = 'uncommon';
  if (rar && RARITY_BANDS[rar]) {
    const rng = seedRng(it.name + '|' + rar);
    let v = rollInBand(RARITY_BANDS[rar], rng);
    if (isConsumable(it)) v = Math.max(RARITY_BANDS[rar][0] / 2, Math.round((v / 2) / 5) * 5);
    it.valueGp = v;
    byRarity++;
    return;
  }
  // 3) nominal for the rest (mundane, no price, no rarity). Weapons/armor a bit higher.
  it.valueGp = it.kind === 'weapon' || it.kind === 'armor' ? 10 : 5;
  nominal++;
});

fs.writeFileSync(FILE, JSON.stringify(items, null, 2) + '\n');
console.log(`Assigned valueGp to ${items.length} items:`);
console.log(`  ${real} from real prices, ${byRarity} from rarity bands, ${nominal} nominal.`);
// distribution sanity
const buckets = { '<50': 0, '50-500': 0, '500-5k': 0, '5k-50k': 0, '50k+': 0 };
items.forEach(it => {
  const v = it.valueGp;
  if (v < 50) buckets['<50']++; else if (v < 500) buckets['50-500']++;
  else if (v < 5000) buckets['500-5k']++; else if (v < 50000) buckets['5k-50k']++;
  else buckets['50k+']++;
});
console.log('  value distribution:', JSON.stringify(buckets));
