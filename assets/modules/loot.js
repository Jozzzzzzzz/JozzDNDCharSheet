// ========== LOOT GENERATOR ==========
// Generates treasure piles to a target gold value using the real item catalogue
// (assets/data/items.json, each item carrying a DMG-based `valueGp`). Fills each pile
// with items within ±15% of the running target, then converts the remainder to coins +
// DMG gems / art objects. Composition + theme shape which items are eligible and the
// coin/gem/item balance. Reference/UI only — never writes to a player's saved character.
//
// Depends on globals from inventory.js: itemCatalogue, getEnabledItemSources,
// itemCategory, itemLikelySource, formatGp. Loaded after inventory.js.

const LOOT_TOLERANCE = 0.15; // ±15% window for item matching

// --- DMG treasure: gemstones (PHB/DMG standard values) ---
const LOOT_GEMS = {
  10:   ['azurite', 'banded agate', 'blue quartz', 'eye agate', 'hematite', 'lapis lazuli', 'malachite', 'moss agate', 'obsidian', 'rhodochrosite', 'tiger eye', 'turquoise'],
  50:   ['bloodstone', 'carnelian', 'chalcedony', 'chrysoprase', 'citrine', 'jasper', 'moonstone', 'onyx', 'quartz', 'sardonyx', 'star rose quartz', 'zircon'],
  100:  ['amber', 'amethyst', 'chrysoberyl', 'coral', 'garnet', 'jade', 'jet', 'pearl', 'spinel', 'tourmaline'],
  500:  ['alexandrite', 'aquamarine', 'black pearl', 'blue spinel', 'peridot', 'topaz'],
  1000: ['black opal', 'blue sapphire', 'emerald', 'fire opal', 'opal', 'star ruby', 'star sapphire', 'yellow sapphire'],
  5000: ['black sapphire', 'diamond', 'jacinth', 'ruby'],
};
// --- DMG art objects ---
const LOOT_ART = {
  25:   ['silver ewer', 'carved bone statuette', 'small gold bracelet', 'cloth-of-gold vestments', 'black velvet mask with silver thread', 'copper chalice with silver filigree'],
  250:  ['gold ring set with bloodstones', 'carved ivory statuette', 'large gold bracelet', 'silver necklace with gemstone pendant', 'bronze crown', 'silk robe with gold embroidery'],
  750:  ['silver chalice set with moonstones', 'silver-plated longsword with jet in hilt', 'carved harp of exotic wood with ivory inlay', 'small gold idol', 'gold dragon comb set with red garnets'],
  2500: ['fine gold chain set with a fire opal', 'old masterpiece painting', 'embroidered silk and velvet mantle set with numerous moonstones', 'platinum bracelet set with a sapphire'],
  7500: ['jeweled gold crown', 'jeweled platinum ring', 'small gold statuette set with rubies', 'gold cup set with emeralds'],
};

function lootRand(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function lootRandInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }

// Composition presets: how a pile's value is split and which items qualify. `coinPct`/
// `gemPct` are the share of value that goes to coins / gems+art; the rest goes to items.
// `filter(it)` decides item eligibility.
const LOOT_COMPOSITIONS = {
  balanced:   { label: 'Balanced', coinPct: 0.25, gemPct: 0.10, filter: () => true },
  treasure:   { label: 'Treasure hoard', coinPct: 0.20, gemPct: 0.30, filter: it => it.kind === 'magic' },
  pureItems:  { label: 'Pure items', coinPct: 0.0, gemPct: 0.0, filter: () => true },
  weapons:    { label: 'Weapons & armour', coinPct: 0.15, gemPct: 0.0, filter: it => it.kind === 'weapon' || it.kind === 'armor' || /armor|weapon|sword|axe|shield/i.test(it.type || '') },
  supplies:   { label: 'Supplies', coinPct: 0.20, gemPct: 0.0, filter: it => /potion|scroll|oil|ammunition|wand|ring/i.test(it.type || '') || ['Potion', 'Scroll', 'Wand', 'Ammunition'].includes(itemCategory(it)) },
  magic:      { label: 'Magic-focused', coinPct: 0.10, gemPct: 0.10, filter: it => it.kind === 'magic' },
  coins:      { label: 'Coins & gems only', coinPct: 0.55, gemPct: 0.45, filter: () => false },
};

// Themes bias the item pool by "likely source" + tweak coin/gem balance, layered on top
// of the composition. `source` matches itemLikelySource(); null = no source bias.
const LOOT_THEMES = {
  any:      { label: 'Any', source: null },
  bandit:   { label: 'Bandit stash', source: 'shop', catBias: ['Weapon', 'Armor'], coinBoost: 0.15 },
  wizard:   { label: "Wizard's study", source: null, catBias: ['Scroll', 'Potion', 'Wand', 'Staff', 'Rod', 'Ring'] },
  dragon:   { label: 'Dragon hoard', source: 'dungeon', gemBoost: 0.20, coinBoost: 0.10 },
  merchant: { label: 'Merchant caravan', source: 'shop', catBias: ['Potion', 'Ammunition'], coinBoost: 0.10 },
  temple:   { label: 'Temple / crypt', source: 'dungeon', catBias: ['Wondrous', 'Ring'], gemBoost: 0.10 },
  wild:     { label: 'Wild / druidic', source: 'wild' },
};

// The eligible item pool for a generation, honouring the item source toggle + composition
// filter + theme source/category bias, and only items with a positive valueGp.
function lootItemPool(comp, theme) {
  if (!Array.isArray(itemCatalogue) || !itemCatalogue.length) return [];
  const enabledSources = (typeof getEnabledItemSources === 'function') ? getEnabledItemSources() : null;
  return itemCatalogue.filter(it => {
    if (!it.valueGp || it.valueGp <= 0) return false;
    if (enabledSources && !enabledSources.has(it.source)) return false;
    if (comp.filter && !comp.filter(it)) return false;
    if (theme && theme.source && typeof itemLikelySource === 'function' && itemLikelySource(it) !== theme.source) return false;
    return true;
  });
}

// Pick one item whose value is within ±tolerance of `target` gp. Prefers theme category
// bias. Returns the item or null if nothing fits the window.
function lootPickItemNear(pool, target, theme) {
  const lo = target * (1 - LOOT_TOLERANCE);
  const hi = target * (1 + LOOT_TOLERANCE);
  let candidates = pool.filter(it => it.valueGp >= lo && it.valueGp <= hi);
  if (!candidates.length) return null;
  // Bias toward theme categories if any candidates match.
  if (theme && Array.isArray(theme.catBias)) {
    const biased = candidates.filter(it => theme.catBias.includes(itemCategory(it)));
    if (biased.length) candidates = biased;
  }
  return lootRand(candidates);
}

// Convert a gp amount into a coin breakdown (pp/gp/sp/cp) — DMG-ish, mostly gp with some
// silver/copper for flavour.
function lootCoinsFromGp(gp) {
  // Work in copper to avoid float drift, then roll up into pp/gp/sp/cp with realistic
  // caps (no more than 9 sp / 9 cp of "loose change").
  let cp = Math.round(gp * 100);
  const out = { pp: 0, gp: 0, sp: 0, cp: 0 };
  // A little loose change first (0-9 sp, 0-9 cp).
  out.cp = cp % 10; cp = Math.floor(cp / 10);      // remaining in sp
  out.sp = cp % 10; cp = Math.floor(cp / 10);      // remaining in gp
  // Big hoards keep some in platinum (~25%).
  if (cp >= 1000) { out.pp = Math.floor((cp * 0.25) / 10); cp -= out.pp * 10; }
  out.gp = cp;
  return out;
}

// Turn a gp budget into gems + art objects (DMG values). Returns array of
// { desc, valueGp } and the leftover gp that couldn't be filled by a gem/art piece.
function lootGemsArtFromGp(budget) {
  const out = [];
  let remaining = Math.round(budget);
  const gemVals = Object.keys(LOOT_GEMS).map(Number).sort((a, b) => b - a);
  const artVals = Object.keys(LOOT_ART).map(Number).sort((a, b) => b - a);
  let guard = 0;
  while (remaining >= 10 && guard++ < 40) {
    // Pick the largest denomination that fits (roll gem vs art).
    const useArt = Math.random() < 0.35;
    const vals = useArt ? artVals : gemVals;
    const pick = vals.find(v => v <= remaining);
    if (!pick) break;
    if (useArt) out.push({ desc: lootRand(LOOT_ART[pick]) + ' (art)', valueGp: pick });
    else out.push({ desc: lootRand(LOOT_GEMS[pick]) + ' gem', valueGp: pick });
    remaining -= pick;
  }
  return { pieces: out, leftover: remaining };
}

// Generate ONE pile to a target gp value. Returns { targetGp, items, gemsArt, coins,
// totalGp }.
function lootGeneratePile(targetGp, comp, theme) {
  const pool = lootItemPool(comp, theme);

  // Apply theme boosts on top of the composition's coin/gem shares.
  let coinPct = comp.coinPct + (theme && theme.coinBoost || 0);
  let gemPct = comp.gemPct + (theme && theme.gemBoost || 0);
  coinPct = Math.min(0.9, coinPct);
  gemPct = Math.min(0.9 - coinPct, gemPct);
  const itemPct = Math.max(0, 1 - coinPct - gemPct);

  const items = [];
  let itemBudget = targetGp * itemPct;
  let spentOnItems = 0;

  // Fill items within ±15% until the item budget is (nearly) used or we run dry.
  let guard = 0;
  while (itemBudget >= 10 && pool.length && guard++ < 25) {
    // Aim each pick at a fraction of the remaining item budget so we get a few items,
    // not one giant one (unless pure-items with a big target).
    const aim = comp === LOOT_COMPOSITIONS.pureItems
      ? itemBudget                       // pure items: try to match the whole remaining
      : Math.max(10, itemBudget * (0.4 + Math.random() * 0.5));
    const it = lootPickItemNear(pool, aim, theme);
    if (!it) {
      // No item in the window at this aim — try aiming at the whole remaining budget once.
      const it2 = lootPickItemNear(pool, itemBudget, theme);
      if (!it2) break;
      items.push(it2); spentOnItems += it2.valueGp; itemBudget -= it2.valueGp;
      continue;
    }
    items.push(it); spentOnItems += it.valueGp; itemBudget -= it.valueGp;
  }

  // Whatever we couldn't spend on items rolls back into coins/gems.
  const leftoverToSplit = Math.max(0, targetGp - spentOnItems);
  const gemBudget = leftoverToSplit * (gemPct / Math.max(0.0001, coinPct + gemPct) || 0);
  const { pieces: gemsArt, leftover: gemLeftover } = gemPct > 0 ? lootGemsArtFromGp(gemBudget) : { pieces: [], leftover: gemBudget };
  const coinGp = leftoverToSplit - (gemBudget - gemLeftover);
  const coins = lootCoinsFromGp(Math.max(0, coinGp));

  const coinTotal = (coins.pp || 0) * 10 + (coins.gp || 0) + (coins.sp || 0) * 0.1 + (coins.cp || 0) * 0.01;
  const gemTotal = gemsArt.reduce((s, g) => s + g.valueGp, 0);
  const totalGp = Math.round((spentOnItems + gemTotal + coinTotal) * 100) / 100;

  // Total weight of the physical loot (items carry weight; coins ~0.02 lb each in 5e).
  const coinCount = (coins.pp || 0) + (coins.gp || 0) + (coins.sp || 0) + (coins.cp || 0);
  const itemWeight = items.reduce((s, it) => s + (Number(it.weight) || 0), 0);
  const weightLb = Math.round((itemWeight + coinCount * 0.02) * 10) / 10;

  // Guarantee a pile is never completely empty: if no items, no gems and no coins landed
  // (tiny target with a filter that matched nothing), drop in the cheapest eligible item,
  // or a handful of coins as a last resort.
  if (!items.length && !gemsArt.length && coinTotal < 0.01) {
    const cheapest = pool.slice().sort((a, b) => a.valueGp - b.valueGp)[0];
    if (cheapest) { items.push(cheapest); }
    else { coins.gp = Math.max(1, Math.round(targetGp)); }
  }

  return { targetGp, items, gemsArt, coins, totalGp, weightLb };
}

// Generate N piles for a grand total. Splits the total across piles with a little
// variance so they're not identical. Returns an array of piles.
function lootGenerate(totalGp, pileCount, compKey, themeKey) {
  const comp = LOOT_COMPOSITIONS[compKey] || LOOT_COMPOSITIONS.balanced;
  const theme = LOOT_THEMES[themeKey] || LOOT_THEMES.any;
  const n = Math.max(1, Math.min(50, parseInt(pileCount, 10) || 1));
  const total = Math.max(0, Number(totalGp) || 0);

  // Split with ±20% variance, then normalise so the sum matches the requested total.
  const weights = Array.from({ length: n }, () => 0.8 + Math.random() * 0.4);
  const wsum = weights.reduce((a, b) => a + b, 0);
  const targets = weights.map(w => (w / wsum) * total);

  return targets.map(t => lootGeneratePile(t, comp, theme));
}

// Human-readable coin string, e.g. "3 pp, 240 gp, 5 sp".
function lootCoinString(coins) {
  const parts = [];
  if (coins.pp) parts.push(`${coins.pp} pp`);
  if (coins.gp) parts.push(`${coins.gp.toLocaleString('en-US')} gp`);
  if (coins.sp) parts.push(`${coins.sp} sp`);
  if (coins.cp) parts.push(`${coins.cp} cp`);
  return parts.join(', ') || '—';
}

window.lootGenerate = lootGenerate;
window.lootCoinString = lootCoinString;
window.LOOT_COMPOSITIONS = LOOT_COMPOSITIONS;
window.LOOT_THEMES = LOOT_THEMES;
