#!/usr/bin/env node
// tools/build-open5e.js
// Pulls Open5e reference data from their GitHub repo (open5e-api, staging branch)
// and writes one minified JSON file per content type into assets/data/open5e/.
//
// Data is kept in RAW Open5e shape (Django fixtures: { fields, model, pk })
// merged across all sources, with a "_source" tag added to each entry so you
// can tell which book it came from. No field renaming, no normalization —
// future features decide how to shape it.
//
// Run:  node tools/build-open5e.js
//       node tools/build-open5e.js monsters magicitems   (subset by type key)
//
// ★ This is REFERENCE DATA ONLY. It is the catalogue people pick FROM; it must
//   never be written into a saved character/encounter. (CLAUDE.md Track C invariant.)

const https = require('https');
const fs = require('fs');
const path = require('path');

const BASE = 'https://raw.githubusercontent.com/open5e/open5e-api/staging/data/v1';

// All source slugs in the open5e-api staging tree, with a friendly book name.
const SOURCES = [
  { slug: 'wotc-srd', book: 'SRD 5.1' },
  { slug: 'o5e',      book: 'Open5e Originals' },
  { slug: 'a5e',      book: 'Level Up A5e' },
  { slug: 'dmag',     book: 'Deep Magic' },
  { slug: 'dmag-e',   book: 'Deep Magic Extra' },
  { slug: 'toh',      book: 'Tome of Heroes' },
  { slug: 'warlock',  book: 'Warlock' },
  { slug: 'kp',       book: 'Kobold Press' },
  { slug: 'tob',      book: 'Tome of Beasts' },
  { slug: 'tob2',     book: 'Tome of Beasts 2' },
  { slug: 'tob3',     book: 'Tome of Beasts 3' },
  { slug: 'cc',       book: 'Creature Codex' },
  { slug: 'menagerie',book: 'Menagerie' },
  { slug: 'blackflag',book: 'Black Flag' },
  { slug: 'taldorei', book: 'Taldorei' },
  { slug: 'vom',      book: 'Vault of Magic' },
];

// type key (output filename) -> Open5e fixture file name.
// DM-facing content first; players can be added later by extending this map.
const TYPES = {
  monsters:    'Monster.json',
  magicitems:  'MagicItem.json',
  spells:      'Spell.json',
  conditions:  'Condition.json',
  weapons:     'Weapon.json',
  armor:       'Armor.json',
  feats:       'Feat.json',
  races:       'Race.json',
  subraces:    'Subrace.json',
  classes:     'CharClass.json',
  archetypes:  'Archetype.json',
  backgrounds: 'Background.json',
  sections:    'Section.json',
  planes:      'Plane.json',
  documents:   'Document.json',
};

const OUT_DIR = path.join(__dirname, '..', 'assets', 'data', 'open5e');

function fetchRaw(url) {
  return new Promise((resolve, reject) => {
    https.get(url, res => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        return fetchRaw(res.headers.location).then(resolve).catch(reject);
      }
      // Any non-200 (404, 400, etc.) means this source simply doesn't publish
      // this content type — skip it quietly rather than failing the whole build.
      if (res.statusCode !== 200) { res.resume(); resolve(null); return; }
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(new Error(`JSON parse failed for ${url}: ${e.message}`)); }
      });
    }).on('error', reject);
  });
}

async function buildType(typeKey, fixtureFile) {
  const merged = [];
  const perSource = [];
  for (const src of SOURCES) {
    const url = `${BASE}/${src.slug}/${fixtureFile}`;
    let arr;
    try {
      arr = await fetchRaw(url);
    } catch (e) {
      console.warn(`  ! ${src.slug}/${fixtureFile} — ${e.message}`);
      continue;
    }
    if (!arr || !Array.isArray(arr) || arr.length === 0) continue;
    // Keep raw Django shape; tag each entry with its origin.
    for (const entry of arr) {
      entry._source = { slug: src.slug, book: src.book };
      merged.push(entry);
    }
    perSource.push(`${src.slug}:${arr.length}`);
  }
  return { merged, perSource };
}

async function main() {
  const requested = process.argv.slice(2);
  const typeKeys = requested.length
    ? requested.filter(k => TYPES[k] || console.warn(`Unknown type "${k}" — skipping`))
    : Object.keys(TYPES);

  fs.mkdirSync(OUT_DIR, { recursive: true });
  console.log(`Building Open5e data → ${OUT_DIR}\n`);

  const manifest = { builtAt: new Date().toISOString(), source: BASE, types: {} };

  for (const key of typeKeys) {
    const fixtureFile = TYPES[key];
    if (!fixtureFile) continue;
    process.stdout.write(`• ${key} (${fixtureFile})\n`);
    const { merged, perSource } = await buildType(key, fixtureFile);
    const outFile = path.join(OUT_DIR, `${key}.json`);
    fs.writeFileSync(outFile, JSON.stringify(merged)); // minified
    const sizeKb = (fs.statSync(outFile).size / 1024).toFixed(0);
    console.log(`    ${merged.length} entries, ${sizeKb} KB  [${perSource.join(', ') || 'none'}]`);
    manifest.types[key] = { file: `${key}.json`, count: merged.length, sizeKb: Number(sizeKb), sources: perSource };
  }

  fs.writeFileSync(path.join(OUT_DIR, '_manifest.json'), JSON.stringify(manifest, null, 2));
  console.log(`\n✓ Done. Wrote ${typeKeys.length} file(s) + _manifest.json`);
}

main().catch(err => { console.error('\nBuild failed:', err.message); process.exit(1); });
