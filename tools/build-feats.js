#!/usr/bin/env node
// tools/build-feats.js
// Pulls feats and racial traits from the SAME open-licensed Open5e documents the spell catalogue
// uses (SRD 5.1, SRD 5.2, Adventurer's Guide, Tome of Heroes, ...) and writes a small, flat
// assets/data/feats.json the app loads offline for the Feats / Racial Features rows.
//
// Only documents published under CC-BY or the OGL are listed below. Core-book text that is not
// in an open document (PHB-only feats such as Sharpshooter or War Caster) is NOT here; players add
// those as custom entries.
//
// ★ REFERENCE DATA ONLY (Track C invariant): this is a catalogue people pick FROM. It is never
//   written into a saved character; a chip on a sheet is just a name, looked up here when shown.
//
// Run:  node tools/build-feats.js          (needs internet; writes assets/data/feats.json)

const https = require('https');
const fs = require('fs');
const path = require('path');

const API = 'https://api.open5e.com/v2';
// key = Open5e document key, label = shown in the app, rank = which copy wins when names clash.
const DOCS = [
  { key: 'srd-2024', label: 'SRD 5.2 (2024)', license: 'CC-BY-4.0', rank: 1 },
  { key: 'srd-2014', label: 'SRD 5.1', license: 'CC-BY-4.0', rank: 2 },
  { key: 'a5e-ag', label: "A5e Adventurer's Guide", license: 'CC-BY-4.0 / OGL 1.0a', rank: 3 },
  { key: 'toh', label: 'Tome of Heroes', license: 'OGL 1.0a', rank: 4 },
  // Same spell sources as spells.json; these currently hold no feats/species but are checked anyway.
  { key: 'deepm', label: 'Deep Magic', license: 'OGL 1.0a', rank: 5 },
  { key: 'deepmx', label: 'Deep Magic Extra', license: 'OGL 1.0a', rank: 6 },
  { key: 'wz', label: 'Warlock Zine', license: 'OGL 1.0a', rank: 7 },
  { key: 'kp', label: 'Kobold Press', license: 'OGL 1.0a', rank: 8 },
  { key: 'open5e', label: 'Open5e', license: 'OGL 1.0a', rank: 9 },
];

function get(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'jozz-dnd-sheet/build-feats' } }, res => {
      let body = '';
      res.on('data', d => (body += d));
      res.on('end', () => {
        if (res.statusCode !== 200) return reject(new Error(res.statusCode + ' ' + url));
        try { resolve(JSON.parse(body)); } catch (e) { reject(e); }
      });
    }).on('error', reject);
  });
}

async function all(url) {
  let out = []; let next = url;
  while (next) { const r = await get(next); out = out.concat(r.results || []); next = r.next; }
  return out;
}

const clean = s => String(s || '').replace(/\r/g, '').replace(/[ \t]+\n/g, '\n').trim();

(async () => {
  const feats = []; const traits = [];
  for (const d of DOCS) {
    const f = await all(`${API}/feats/?document__key=${d.key}&limit=100`);
    f.forEach(x => {
      const benefits = (x.benefits || []).map(b => clean(b.desc)).filter(Boolean);
      let text = clean(x.desc);
      if (benefits.length) text += (text ? '\n\n' : '') + benefits.map(b => '• ' + b).join('\n');
      feats.push({ n: x.name, s: d.label, k: x.key, r: d.rank, t: x.type || '', p: clean(x.prerequisite), d: text });
    });
    const sp = await all(`${API}/species/?document__key=${d.key}&limit=100`);
    sp.forEach(x => (x.traits || []).forEach(t => {
      const desc = clean(t.desc); if (!t.name || !desc) return;
      if (/^(size|speed|age|alignment|languages?)$/i.test(t.name) && desc.length < 200) return; // plain stat lines, not features
      traits.push({ n: t.name, r: x.name, s: d.label, k: x.key, rank: d.rank, d: desc });
    }));
    console.log(`${d.key.padEnd(10)} feats ${String(f.length).padStart(3)}   species ${String(sp.length).padStart(3)}`);
  }

  // feats: one entry per name; the best-ranked document wins
  const byName = new Map();
  feats.sort((a, b) => a.r - b.r).forEach(f => { const k = f.n.toLowerCase(); if (!byName.has(k)) byName.set(k, f); });
  const outFeats = [...byName.values()].sort((a, b) => a.n.localeCompare(b.n)).map(({ n, s, k, t, p, d }) => ({ n, s, k, t, p, d }));

  // traits: keep every race's own wording, but drop exact duplicates (same name + same text)
  const seen = new Set(); const outTraits = [];
  traits.sort((a, b) => a.rank - b.rank || a.n.localeCompare(b.n)).forEach(t => {
    const key = t.n.toLowerCase() + '|' + t.d.toLowerCase(); if (seen.has(key)) return; seen.add(key);
    outTraits.push({ n: t.n, r: t.r, s: t.s, k: t.k, d: t.d });
  });

  const out = {
    generated: new Date().toISOString().slice(0, 10),
    credits: 'Feat and trait text from the System Reference Document 5.1 and 5.2 (CC-BY-4.0, Wizards of the Coast), the Open5e A5e Adventurer\'s Guide (CC-BY-4.0 / OGL 1.0a, EN Publishing) and Tome of Heroes (OGL 1.0a, Kobold Press), via the Open5e API.',
    sources: DOCS.map(d => ({ label: d.label, license: d.license })),
    feats: outFeats, traits: outTraits,
  };
  const file = path.join(__dirname, '..', 'assets', 'data', 'feats.json');
  fs.writeFileSync(file, JSON.stringify(out));
  console.log(`wrote ${path.relative(process.cwd(), file)}: ${outFeats.length} feats, ${outTraits.length} traits, ${(fs.statSync(file).size / 1024).toFixed(0)} KB`);
})().catch(e => { console.error(e); process.exit(1); });
