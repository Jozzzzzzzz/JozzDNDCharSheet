#!/usr/bin/env node
/**
 * build-monsters.js
 *
 * Flattens the Open5e monster fixture (assets/data/open5e/monsters.json, Django-dump
 * shape with `_json` string fields + numeric `document` ids) into an API-shaped array at
 * assets/data/monsters.json, so the DM monster browser can load it locally — instant,
 * offline, no API round-trip.
 *
 * Output objects match what the runtime (dmRenderStatBlockHtml + the browser filters)
 * already expects from the Open5e API: `slug`, `challenge_rating`, `speed` (object),
 * `environments` (array), `actions`/`legendary_actions`/etc. (parsed arrays), ability
 * scores, saves, senses, languages, and the six computed helpers' inputs.
 *
 * The default document (wotc-srd) monsters are kept first; others follow. Run:
 *   node tools/build-monsters.js
 */

const fs = require('fs');
const path = require('path');

const O5E = path.join(__dirname, '..', 'assets', 'data', 'open5e');
const OUT = path.join(__dirname, '..', 'assets', 'data', 'monsters.json');

const manifest = JSON.parse(fs.readFileSync(path.join(O5E, '_manifest.json'), 'utf8'));
const rows = JSON.parse(fs.readFileSync(path.join(O5E, 'monsters.json'), 'utf8'));

// Recover document-id → source-slug by matching per-source counts in the manifest.
function docIdToSlug() {
  const byId = {};
  rows.forEach(r => { const id = r.fields.document; byId[id] = (byId[id] || 0) + 1; });
  const wanted = manifest.types.monsters.sources.map(s => {
    const i = s.lastIndexOf(':'); return { slug: s.slice(0, i), count: parseInt(s.slice(i + 1), 10) };
  });
  const map = {};
  Object.entries(byId).forEach(([id, count]) => {
    const m = wanted.find(w => w.count === count && !Object.values(map).includes(w.slug));
    map[id] = m ? m.slug : ('doc-' + id);
  });
  return map;
}
const idMap = docIdToSlug();

function parseJson(str, fallback) {
  if (str == null || str === '') return fallback;
  if (typeof str !== 'string') return str;
  try { return JSON.parse(str); } catch (e) { return fallback; }
}

// Speed: fixture stores speed_json like {"walk":30,"fly":60} — pass through as object.
function speedObj(f) {
  const s = parseJson(f.speed_json, null);
  if (s && typeof s === 'object') return s;
  return {};
}

const out = rows.map(r => {
  const f = r.fields;
  const speed = speedObj(f);
  return {
    slug: r.pk,
    name: f.name,
    size: f.size || '',
    type: f.type || '',
    subtype: f.subtype || '',
    alignment: f.alignment || '',
    armor_class: f.armor_class ?? null,
    armor_desc: f.armor_desc || '',
    hit_points: f.hit_points ?? null,
    hit_dice: f.hit_dice || '',
    speed,
    challenge_rating: f.cr != null ? String(f.cr) : (f.challenge_rating != null ? String(f.challenge_rating) : ''),
    // ability scores + saves
    strength: f.strength, dexterity: f.dexterity, constitution: f.constitution,
    intelligence: f.intelligence, wisdom: f.wisdom, charisma: f.charisma,
    strength_save: f.strength_save, dexterity_save: f.dexterity_save, constitution_save: f.constitution_save,
    intelligence_save: f.intelligence_save, wisdom_save: f.wisdom_save, charisma_save: f.charisma_save,
    perception: f.perception ?? null,
    senses: f.senses || '',
    languages: f.languages || '',
    damage_vulnerabilities: f.damage_vulnerabilities || '',
    damage_resistances: f.damage_resistances || '',
    damage_immunities: f.damage_immunities || '',
    condition_immunities: f.condition_immunities || '',
    // parsed action blocks (arrays) — the stat block renderer reads these
    special_abilities: parseJson(f.special_abilities_json, []),
    actions: parseJson(f.actions_json, []),
    bonus_actions: parseJson(f.bonus_actions_json, []),
    reactions: parseJson(f.reactions_json, []),
    legendary_actions: parseJson(f.legendary_actions_json, []),
    legendary_desc: f.legendary_desc || '',
    skills: parseJson(f.skills_json, {}),
    environments: parseJson(f.environments_json, []),
    group: f.group || null,
    desc: f.desc || '',
    document__slug: idMap[f.document] || 'unknown',
    document__title: idMap[f.document] || '',
  };
}).filter(m => m.name && m.slug);

// De-dupe by slug (fixture can carry cross-source dupes); keep first.
const seen = new Set();
let deduped = out.filter(m => { if (seen.has(m.slug)) return false; seen.add(m.slug); return true; });

// Bundle SRD-only by default to keep the file lean (~670 KB / 322 monsters — the same set
// the API returned). The full fixture has ~2,800 across many sources (7.5 MB) which is too
// heavy to ship for boot; pass --all to include everything if ever wanted.
if (!process.argv.includes('--all')) {
  deduped = deduped.filter(m => m.document__slug === 'wotc-srd');
}

deduped.sort((a, b) => a.name.localeCompare(b.name));

fs.writeFileSync(OUT, JSON.stringify(deduped) + '\n'); // compact (large file)

const bySrc = {};
deduped.forEach(m => { bySrc[m.document__slug] = (bySrc[m.document__slug] || 0) + 1; });
const kb = Math.round(fs.statSync(OUT).size / 1024);
console.log(`Wrote ${deduped.length} monsters to ${OUT} (${kb} KB)`);
console.log('  by source:', JSON.stringify(bySrc));
