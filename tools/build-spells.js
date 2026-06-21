#!/usr/bin/env node
// tools/build-spells.js
// Fetches spell data from Open5e GitHub repo and writes assets/data/spells.json
// Run: node tools/build-spells.js

const https = require('https');
const fs = require('fs');
const path = require('path');

const SOURCES = [
  {
    url: 'https://raw.githubusercontent.com/open5e/open5e-api/staging/data/v1/wotc-srd/Spell.json',
    sourceBook: 'SRD 5.1'
  },
  {
    url: 'https://raw.githubusercontent.com/open5e/open5e-api/staging/data/v1/o5e/Spell.json',
    sourceBook: 'Open5e'
  }
];

const OUT_PATH = path.join(__dirname, '..', 'assets', 'data', 'spells.json');

function fetch(url) {
  return new Promise((resolve, reject) => {
    https.get(url, res => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        return fetch(res.headers.location).then(resolve).catch(reject);
      }
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(new Error(`JSON parse failed for ${url}: ${e.message}`)); }
      });
    }).on('error', reject);
  });
}

function buildComponents(spell) {
  const parts = [];
  if (spell.requires_verbal_components) parts.push('V');
  if (spell.requires_somatic_components) parts.push('S');
  if (spell.requires_material_components) {
    const mat = (spell.material || '').trim();
    parts.push(mat ? `M (${mat})` : 'M');
  }
  return parts.join(', ');
}

function buildDescription(spell) {
  const desc = (spell.desc || '').trim();
  const higher = (spell.higher_level || '').trim();
  if (higher) return `${desc}\n\n**At Higher Levels.** ${higher}`;
  return desc;
}

function mapSpell(spell, sourceBook) {
  const slug = spell.pk || spell.slug || spell.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
  const classes = spell.dnd_class
    ? spell.dnd_class.split(',').map(c => c.trim()).filter(Boolean)
    : [];

  return {
    name: spell.name,
    level: typeof spell.spell_level === 'number' ? spell.spell_level : parseInt(spell.spell_level, 10) || 0,
    school: spell.school || '',
    castingTime: spell.casting_time || '',
    range: spell.range || '',
    components: buildComponents(spell),
    duration: spell.duration || '',
    damage: '',
    save: '',
    attack: '',
    ritual: !!spell.can_be_cast_as_ritual,
    concentration: !!spell.requires_concentration,
    prepared: false,
    classes,
    sourceBook,
    description: buildDescription(spell),
    wikiLink: `https://open5e.com/spells/${slug}`,
    open5eSlug: slug
  };
}

async function main() {
  const seen = new Map(); // name → spell, deduplicate by name (first source wins)

  for (const { url, sourceBook } of SOURCES) {
    console.log(`Fetching ${url} ...`);
    let data;
    try {
      data = await fetch(url);
    } catch (e) {
      console.error(`  FAILED: ${e.message}`);
      continue;
    }

    // Django fixture format: [{pk, model, fields: {...}}]
    const entries = Array.isArray(data) ? data : [];
    console.log(`  Got ${entries.length} entries from ${sourceBook}`);

    for (const entry of entries) {
      if (!entry) continue;
      // Unwrap Django fixture format
      const spell = entry.fields ? { ...entry.fields, pk: entry.pk } : entry;
      if (!spell || !spell.name) continue;
      if (!seen.has(spell.name)) {
        seen.set(spell.name, mapSpell(spell, sourceBook));
      }
    }
  }

  const output = Array.from(seen.values()).sort((a, b) => a.name.localeCompare(b.name));

  fs.writeFileSync(OUT_PATH, JSON.stringify(output, null, 2), 'utf8');
  console.log(`\nWrote ${output.length} spells to ${OUT_PATH}`);

  // Summary by level
  const byLevel = {};
  output.forEach(s => { byLevel[s.level] = (byLevel[s.level] || 0) + 1; });
  Object.keys(byLevel).sort((a,b) => a-b).forEach(l => {
    console.log(`  Level ${l === '0' ? 'Cantrip' : l}: ${byLevel[l]} spells`);
  });
}

main().catch(e => { console.error(e); process.exit(1); });
