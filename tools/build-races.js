#!/usr/bin/env node
// tools/build-races.js
// Pulls Open5e Race data (SRD + a few open sources) and writes a small, flat
// assets/data/races.json the app can load offline for the Features & Traits
// pull source. Each race's `traits` prose is split into individual named traits
// so the picker can offer them one at a time.
//
// ★ REFERENCE DATA ONLY (Track C invariant) — this is the catalogue people pick
//   FROM; it is never written into a saved character.
//
// Run:  node tools/build-races.js

const https = require('https');
const fs = require('fs');
const path = require('path');

const BASE = 'https://raw.githubusercontent.com/open5e/open5e-api/staging/data/v1';
// SRD first (clean, iconic). Add more source slugs here if we want deeper race
// coverage later — same shape, deduped by lowercase name (first source wins).
const SOURCES = [
  { slug: 'wotc-srd', book: 'SRD 5.1' },
  { slug: 'o5e',      book: 'Open5e Originals' },
];

function get(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (r) => {
      if (r.statusCode !== 200) { resolve(null); return; }
      let d = '';
      r.on('data', (c) => (d += c));
      r.on('end', () => resolve(d));
    }).on('error', reject);
  });
}

// "**_Keen Senses._** You have proficiency…" → { name:'Keen Senses', description:'You have…' }
// Falls back to splitting on bold markers; skips empty chunks.
function parseTraits(raw) {
  if (!raw) return [];
  const out = [];
  // Match a bolded trait label then everything up to the next bolded label.
  const re = /\*\*_?\s*([^*_]+?)[.:]?\s*_?\*\*\s*([\s\S]*?)(?=\*\*_?\s*[^*_]+?[.:]?\s*_?\*\*|$)/g;
  let m;
  while ((m = re.exec(raw)) !== null) {
    const name = (m[1] || '').trim().replace(/[.:]\s*$/, '');
    const description = (m[2] || '').trim().replace(/\s+/g, ' ');
    if (name && description) out.push({ name, description });
  }
  return out;
}

async function build() {
  const seen = new Set();
  const races = [];

  for (const src of SOURCES) {
    const raw = await get(`${BASE}/${src.slug}/Race.json`);
    if (!raw) { console.log(`  (skipped ${src.book} — no Race file)`); continue; }
    let json;
    try { json = JSON.parse(raw); } catch (e) { console.log(`  (parse error ${src.book})`); continue; }

    json.forEach((entry) => {
      const f = entry.fields || {};
      const key = (f.name || '').toLowerCase();
      if (!f.name || seen.has(key)) return;
      seen.add(key);

      // Strip bolded "**_Label._**" prefixes and collapse whitespace.
      const clean = (s) => (s || '').replace(/\*\*_?[^*_]+?_?\*\*/g, '').replace(/\s+/g, ' ').trim();
      const speed = clean(f.speed_desc);
      const vision = clean(f.vision);

      // Open5e breaks Speed and Darkvision out of the `traits` prose into their
      // own fields — fold them back in so they're pullable trait cards too.
      const traits = parseTraits(f.traits);
      if (vision) traits.unshift({ name: 'Darkvision', description: vision });
      if (speed) traits.unshift({ name: 'Speed', description: speed });

      races.push({
        name: f.name,
        source: src.book,
        size: f.size_raw || f.size || '',
        speed,
        vision,
        slug: (f.route || '').replace(/^\/?races?\//, '').replace(/\/$/, '') || key.replace(/\s+/g, '-'),
        traits,
      });
    });
  }

  races.sort((a, b) => a.name.localeCompare(b.name));
  const outPath = path.join(__dirname, '..', 'assets', 'data', 'races.json');
  fs.writeFileSync(outPath, JSON.stringify(races));
  const traitCount = races.reduce((n, r) => n + r.traits.length, 0);
  console.log(`Wrote ${races.length} races (${traitCount} traits) → assets/data/races.json`);
}

build().catch((e) => { console.error(e); process.exit(1); });
