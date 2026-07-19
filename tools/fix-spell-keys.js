#!/usr/bin/env node
/**
 * fix-spell-keys.js
 *
 * Repairs every spell's Open5e wikiLink in assets/data/spells.json.
 *
 * WHY: Open5e migrated to source-prefixed slugs. The old bare-name links
 *   (open5e.com/spells/shatter) now 302-redirect and don't land on the spell.
 *   The correct URL uses the v2 API "key" which carries the source prefix:
 *     open5e.com/spells/srd_shatter       (SRD 5.1)
 *     open5e.com/spells/srd-2024_shatter  (SRD 2024)
 *     open5e.com/spells/deepm_...         (Deep Magic), etc.
 *
 * STRATEGY (per spell):
 *   1. Look up the spell's bare slug (open5eSlug / derived from name) in the
 *      full v2 key map fetched from api.open5e.com/v2/spells.
 *   2. Among the matching keys, pick the best source by the spell's own
 *      sourceBook (SRD prefers srd-2024, falls back to srd), then any match.
 *   3. Verify the resulting open5e.com/spells/{key} returns 200. If it does,
 *      rewrite spell.wikiLink and store spell.open5eKey. If no prefixed key
 *      verifies, fall back to the existing verify-spell-links behaviour is
 *      left untouched (5esrd links are preserved).
 *
 * Notes:
 *   - 5esrd links already in spells.json are LEFT ALONE (those were repaired
 *     by verify-spell-links.js for spells Open5e genuinely 404s).
 *   - Results cached in tools/.spell-key-cache.json (gitignored); delete to
 *     force a full re-verify.
 *
 * Usage:
 *   node tools/fix-spell-keys.js            # fetch keys, repair, write spells.json
 *   node tools/fix-spell-keys.js --dry-run  # report only
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

const SPELLS_PATH = path.join(__dirname, '..', 'assets', 'data', 'spells.json');
const CACHE_PATH = path.join(__dirname, '.spell-key-cache.json');
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36';
const CONCURRENCY = 8;
const DRY_RUN = process.argv.includes('--dry-run');

// sourceBook (in spells.json) -> ordered list of preferred v2 document prefixes.
const SOURCE_PREF = {
  'SRD 5.1':          ['srd-2024', 'srd', 'open5e'],
  'Open5e':           ['open5e', 'srd-2024', 'srd'],
  'Deep Magic':       ['deepm', 'deepmx'],
  'Deep Magic Extra': ['deepmx', 'deepm'],
  'Warlock':          ['wz'],
  'A5e':              ['a5e-ag'],
  'Kobold Press':     ['kp'],
  'Tome of Heroes':   ['toh'],
};
// Global fallback order when sourceBook has no match — official first.
const FALLBACK_PREF = ['srd-2024', 'srd', 'open5e', 'deepm', 'deepmx', 'toh', 'wz', 'kp', 'a5e-ag', 'spells-that-dont-suck'];

function nameToSlug(name) {
  return String(name).toLowerCase()
    .replace(/['’]/g, '')
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '');
}

function getJson(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': UA } }, r => {
      let d = '';
      r.on('data', c => d += c);
      r.on('end', () => { try { resolve(JSON.parse(d)); } catch (e) { reject(e); } });
    }).on('error', reject);
  });
}

// GET status only (tiny range) — used to verify a spell page is live.
function urlStatus(url) {
  return new Promise(resolve => {
    const req = https.get(url, { headers: { 'User-Agent': UA, Range: 'bytes=0-0' } }, r => {
      r.resume();
      resolve(r.statusCode);
    });
    req.on('error', () => resolve(0));
    req.setTimeout(15000, () => { req.destroy(); resolve(0); });
  });
}

async function fetchAllV2Keys() {
  const bySlug = {}; // slug -> { prefix -> key }
  let url = 'https://api.open5e.com/v2/spells/?limit=500';
  let pages = 0;
  while (url && pages < 20) {
    const d = await getJson(url);
    for (const r of (d.results || [])) {
      const key = r.key || '';
      if (!key.includes('_')) continue;
      const idx = key.indexOf('_');
      const prefix = key.slice(0, idx);
      const slug = key.slice(idx + 1);
      (bySlug[slug] = bySlug[slug] || {})[prefix] = key;
    }
    url = d.next;
    pages++;
  }
  return bySlug;
}

// Pick the best prefixed key for a spell given the slug->keys map.
function pickKey(slug, sourceBook, bySlug) {
  const opts = bySlug[slug];
  if (!opts) return null;
  const pref = (SOURCE_PREF[sourceBook] || []).concat(FALLBACK_PREF);
  for (const p of pref) {
    if (opts[p]) return opts[p];
  }
  // Nothing in the preference list — take any available key deterministically.
  const keys = Object.keys(opts).sort();
  return keys.length ? opts[keys[0]] : null;
}

async function run() {
  const spells = JSON.parse(fs.readFileSync(SPELLS_PATH, 'utf8'));
  const cache = fs.existsSync(CACHE_PATH) ? JSON.parse(fs.readFileSync(CACHE_PATH, 'utf8')) : {};

  console.log(`Loaded ${spells.length} spells. Fetching Open5e v2 keys…`);
  const bySlug = await fetchAllV2Keys();
  console.log(`Indexed ${Object.keys(bySlug).length} distinct spell slugs from Open5e v2.`);

  let fixed = 0, alreadyOk = 0, kept5esrd = 0, noMatch = 0, verifyFail = 0;
  const unresolved = [];

  // Build the work list first, then verify with limited concurrency.
  const tasks = spells.map(sp => async () => {
    const link = sp.wikiLink || '';
    // Leave deliberate 5esrd repairs alone.
    if (/5esrd/.test(link)) { kept5esrd++; return; }

    const slug = sp.open5eSlug || nameToSlug(sp.name);
    const key = pickKey(slug, sp.sourceBook, bySlug);
    if (!key) { noMatch++; unresolved.push(sp.name + ' (no v2 key for slug ' + slug + ')'); return; }

    const target = `https://open5e.com/spells/${key}`;
    if (link === target) { alreadyOk++; sp.open5eKey = key; return; }

    // Verify the prefixed URL actually resolves (cache statuses).
    let status = cache[target];
    if (status === undefined) {
      status = await urlStatus(target);
      cache[target] = status;
    }
    if (status >= 200 && status < 300) {
      sp.wikiLink = target;
      sp.open5eKey = key;
      fixed++;
    } else {
      verifyFail++;
      unresolved.push(sp.name + ' -> ' + key + ' returned ' + status);
    }
  });

  // Simple concurrency pool.
  let i = 0;
  async function worker() {
    while (i < tasks.length) {
      const idx = i++;
      await tasks[idx]();
      if (idx % 100 === 0) process.stdout.write('.');
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  process.stdout.write('\n');

  fs.writeFileSync(CACHE_PATH, JSON.stringify(cache));

  console.log('\n--- Results ---');
  console.log('fixed (rewritten):', fixed);
  console.log('already correct:  ', alreadyOk);
  console.log('kept 5esrd:       ', kept5esrd);
  console.log('no v2 match:      ', noMatch);
  console.log('verify failed:    ', verifyFail);
  if (unresolved.length) {
    console.log('\nUnresolved (' + unresolved.length + '):');
    unresolved.slice(0, 40).forEach(u => console.log('  ' + u));
    if (unresolved.length > 40) console.log('  …and ' + (unresolved.length - 40) + ' more');
  }

  if (DRY_RUN) {
    console.log('\n[dry-run] spells.json NOT written.');
  } else {
    fs.writeFileSync(SPELLS_PATH, JSON.stringify(spells, null, 2));
    console.log('\nWrote ' + SPELLS_PATH);
  }
}

run().catch(e => { console.error(e); process.exit(1); });
