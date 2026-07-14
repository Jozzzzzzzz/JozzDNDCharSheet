#!/usr/bin/env node
/**
 * build-items.js
 *
 * Flattens the Open5e Django-fixture dumps (assets/data/open5e/{magicitems,weapons,armor}.json)
 * into a single clean catalogue at assets/data/items.json for the inventory "Add from
 * catalogue" picker. Same idea as spells.json: load fast, works offline.
 *
 * Each output item: { name, kind, type, rarity, attunement, weight, value, source, desc, wikiLink }
 *   kind:   'magic' | 'weapon' | 'armor'
 *   source: canonical slug ('wotc-srd', 'a5e', 'toh', 'vom', 'taldorei', …)
 *
 * The fixtures reference sources by a numeric `document` id, not a slug. We recover the
 * id→slug map by matching each document's item-count against the per-source counts in
 * assets/data/open5e/_manifest.json (unambiguous here since counts are distinct).
 *
 * Run: node tools/build-items.js
 */

const fs = require('fs');
const path = require('path');

const O5E = path.join(__dirname, '..', 'assets', 'data', 'open5e');
const OUT = path.join(__dirname, '..', 'assets', 'data', 'items.json');

function readFixture(file) {
  return JSON.parse(fs.readFileSync(path.join(O5E, file), 'utf8'));
}

// Build a document-id → source-slug map for one fixture by matching counts to the manifest.
function docIdToSlug(rows, manifestSources) {
  // count items per numeric document id
  const byId = {};
  rows.forEach(r => {
    const id = r.fields.document;
    byId[id] = (byId[id] || 0) + 1;
  });
  // manifest entries look like "wotc-srd:237"
  const wanted = manifestSources.map(s => {
    const i = s.lastIndexOf(':');
    return { slug: s.slice(0, i), count: parseInt(s.slice(i + 1), 10) };
  });
  const map = {};
  Object.entries(byId).forEach(([id, count]) => {
    const match = wanted.find(w => w.count === count && !Object.values(map).includes(w.slug));
    map[id] = match ? match.slug : ('doc-' + id);
  });
  return map;
}

function slugify(name) {
  return String(name).toLowerCase().replace(/['’]/g, '').replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
}
function open5eItemLink(name) {
  return `https://open5e.com/magicitems/${slugify(name)}`;
}

const manifest = JSON.parse(fs.readFileSync(path.join(O5E, '_manifest.json'), 'utf8'));

const out = [];

// ---- magic items ----
{
  const rows = readFixture('magicitems.json');
  const idMap = docIdToSlug(rows, manifest.types.magicitems.sources);
  rows.forEach(r => {
    const f = r.fields;
    out.push({
      name: f.name || '',
      kind: 'magic',
      type: f.type || 'Wondrous item',
      rarity: (f.rarity || '').toLowerCase(),
      attunement: !!f.requires_attunement && String(f.requires_attunement).trim() !== '',
      weight: 0,
      value: '',
      source: idMap[f.document] || 'unknown',
      desc: f.desc || '',
      wikiLink: open5eItemLink(f.name),
    });
  });
}

// ---- weapons ----
{
  const rows = readFixture('weapons.json');
  const idMap = docIdToSlug(rows, manifest.types.weapons.sources);
  rows.forEach(r => {
    const f = r.fields;
    let props = [];
    try { props = JSON.parse(f.properties_json || '[]'); } catch (e) { props = []; }
    const dmg = [f.damage_dice, f.damage_type].filter(Boolean).join(' ');
    const descBits = [
      f.category ? `${f.category}.` : '',
      dmg ? `Damage: ${dmg}.` : '',
      props.length ? `Properties: ${props.join(', ')}.` : '',
      f.desc || '',
    ].filter(Boolean).join(' ');
    out.push({
      name: f.name || '',
      kind: 'weapon',
      type: f.category || 'Weapon',
      rarity: '',
      attunement: false,
      weight: parseFloat(f.weight) || 0,
      value: f.cost || '',
      source: idMap[f.document] || 'unknown',
      desc: descBits,
      wikiLink: `https://open5e.com/weapons/${slugify(f.name)}`,
    });
  });
}

// ---- armor ----
{
  const rows = readFixture('armor.json');
  const idMap = docIdToSlug(rows, manifest.types.armor.sources);
  rows.forEach(r => {
    const f = r.fields;
    const descBits = [
      f.category ? `${f.category}.` : '',
      f.base_ac != null ? `Base AC: ${f.base_ac}${f.plus_dex_mod ? ' + Dex' + (f.plus_max ? ` (max ${f.plus_max})` : '') : ''}.` : '',
      f.strength_requirement ? `Str requirement: ${f.strength_requirement}.` : '',
      f.stealth_disadvantage ? 'Stealth disadvantage.' : '',
      f.desc || '',
    ].filter(Boolean).join(' ');
    out.push({
      name: f.name || '',
      kind: 'armor',
      type: f.category || 'Armor',
      rarity: '',
      attunement: false,
      weight: parseFloat(f.weight) || 0,
      value: f.cost || '',
      source: idMap[f.document] || 'unknown',
      desc: descBits,
      wikiLink: `https://open5e.com/armor/${slugify(f.name)}`,
    });
  });
}

// De-dupe by name+kind (keep first), sort by name.
const seen = new Set();
const deduped = out.filter(it => {
  const key = it.kind + '|' + it.name.toLowerCase();
  if (seen.has(key)) return false;
  seen.add(key);
  return it.name;
});
deduped.sort((a, b) => a.name.localeCompare(b.name));

fs.writeFileSync(OUT, JSON.stringify(deduped, null, 2) + '\n');

const bySource = {};
const byKind = {};
deduped.forEach(it => { bySource[it.source] = (bySource[it.source] || 0) + 1; byKind[it.kind] = (byKind[it.kind] || 0) + 1; });
console.log(`Wrote ${deduped.length} items to ${OUT}`);
console.log('  by kind:', JSON.stringify(byKind));
console.log('  by source:', JSON.stringify(bySource));
