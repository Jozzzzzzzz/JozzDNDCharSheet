#!/usr/bin/env node
/**
 * verify-spell-links.js
 *
 * Verifies every spell's wikiLink in assets/data/spells.json and repairs dead ones.
 *
 * Strategy (per spell):
 *   1. Check the existing Open5e link (open5e.com/spells/{slug}). If it returns 200, keep it.
 *   2. If it's dead (404/410/…), try 5esrd.com in this order, using the FIRST that returns 200:
 *        a. https://www.5esrd.com/database/spell/{slug}/        (direct page)
 *        b. https://www.5esrd.com/database/spell/{name-slug}/   (slug derived from the name)
 *        c. https://www.5esrd.com/?s={name}                     (site search — always resolves)
 *      Only (a)/(b) are "verified" 200s; (c) is the guaranteed-live fallback.
 *   3. Record the resolved link back onto spell.wikiLink and tag spell.linkSource
 *      ('open5e' | '5esrd' | '5esrd-search').
 *
 * Notes:
 *   - 5esrd blocks the default Node user-agent, so a browser UA is sent.
 *   - Results are cached in tools/.link-cache.json so re-runs skip already-checked URLs
 *     (delete that file to force a full re-check). The cache is NOT committed.
 *   - Network-bound and polite: limited concurrency, HEAD-style GET with tiny range.
 *
 * Usage:
 *   node tools/verify-spell-links.js            # verify + patch spells.json
 *   node tools/verify-spell-links.js --dry-run  # report only, don't write spells.json
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

const SPELLS_PATH = path.join(__dirname, '..', 'assets', 'data', 'spells.json');
const CACHE_PATH = path.join(__dirname, '.link-cache.json');
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36';
const CONCURRENCY = 8;
const DRY_RUN = process.argv.includes('--dry-run');

// ---- URL helpers ----
function nameToSlug(name) {
  return String(name).toLowerCase()
    .replace(/['’]/g, '')      // drop apostrophes: Melf's -> melfs
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '');
}
function open5eUrl(slug) { return `https://open5e.com/spells/${slug}`; }
function fesrdDirectUrl(slug) { return `https://www.5esrd.com/database/spell/${slug}/`; }
function fesrdSearchUrl(name) { return `https://www.5esrd.com/?s=${encodeURIComponent(name)}`; }

// Pull the slug out of an existing open5e wikiLink, else derive from name.
function open5eSlugFromLink(spell) {
  const m = (spell.wikiLink || '').match(/open5e\.com\/spells\/([^/?#]+)/i);
  if (m) return m[1];
  if (spell.open5eSlug) return spell.open5eSlug;
  return nameToSlug(spell.name);
}

// ---- HTTP with cache ----
let cache = {};
try { cache = JSON.parse(fs.readFileSync(CACHE_PATH, 'utf8')); } catch (e) { cache = {}; }

function httpStatus(url) {
  if (Object.prototype.hasOwnProperty.call(cache, url)) {
    return Promise.resolve(cache[url]);
  }
  return new Promise(resolve => {
    let settled = false;
    const done = (code) => {
      if (settled) return;
      settled = true;
      cache[url] = code;
      resolve(code);
    };
    const req = https.get(url, {
      headers: { 'User-Agent': UA, 'Range': 'bytes=0-0', 'Accept': 'text/html' },
      timeout: 20000,
    }, res => {
      // Follow one redirect level manually if needed
      if ([301, 302, 307, 308].includes(res.statusCode) && res.headers.location) {
        res.resume();
        const next = res.headers.location.startsWith('http')
          ? res.headers.location
          : new URL(res.headers.location, url).href;
        httpStatus(next).then(done);
        return;
      }
      res.resume(); // drain
      done(res.statusCode);
    });
    req.on('timeout', () => { req.destroy(); done(0); });
    req.on('error', () => done(0));
  });
}

function ok(code) { return code >= 200 && code < 400; }

// ---- resolve one spell ----
async function resolveSpell(spell) {
  const open5eSlug = open5eSlugFromLink(spell);
  const open5e = open5eUrl(open5eSlug);

  const c1 = await httpStatus(open5e);
  if (ok(c1)) {
    return { link: open5e, source: 'open5e', changed: spell.wikiLink !== open5e };
  }

  // Open5e dead — try 5esrd direct (slug from open5e slug, then from name)
  const candidates = Array.from(new Set([open5eSlug, nameToSlug(spell.name)]));
  for (const slug of candidates) {
    const url = fesrdDirectUrl(slug);
    const code = await httpStatus(url);
    if (ok(code)) {
      return { link: url, source: '5esrd', changed: true };
    }
  }

  // Last resort — 5esrd search (always resolves)
  const search = fesrdSearchUrl(spell.name);
  return { link: search, source: '5esrd-search', changed: true };
}

// ---- concurrency runner ----
async function runPool(items, worker, onProgress) {
  let i = 0, active = 0, doneCount = 0;
  return new Promise(resolve => {
    const next = () => {
      if (i >= items.length && active === 0) return resolve();
      while (active < CONCURRENCY && i < items.length) {
        const idx = i++; active++;
        worker(items[idx], idx).then(() => {
          active--; doneCount++;
          if (onProgress) onProgress(doneCount, items.length);
          next();
        });
      }
    };
    next();
  });
}

(async () => {
  const spells = JSON.parse(fs.readFileSync(SPELLS_PATH, 'utf8'));
  console.log(`Verifying ${spells.length} spell links (Open5e → 5esrd fallback)…`);
  if (DRY_RUN) console.log('(dry run — spells.json will NOT be written)');

  const stats = { open5e: 0, '5esrd': 0, '5esrd-search': 0, changed: 0 };
  const repaired = [];
  let lastPct = -1;

  await runPool(spells, async (spell) => {
    const res = await resolveSpell(spell);
    stats[res.source]++;
    if (res.changed) {
      stats.changed++;
      if (res.source !== 'open5e') {
        repaired.push({ name: spell.name, source: res.source, link: res.link });
      }
      spell.wikiLink = res.link;
    }
    spell.linkSource = res.source;
  }, (d, t) => {
    const pct = Math.floor((d / t) * 100);
    if (pct !== lastPct && pct % 5 === 0) { lastPct = pct; process.stdout.write(`\r  ${pct}% (${d}/${t})   `); }
  });

  // Persist cache for resumable re-runs
  try { fs.writeFileSync(CACHE_PATH, JSON.stringify(cache)); } catch (e) {}

  console.log('\n\nSummary:');
  console.log(`  Open5e (kept):        ${stats.open5e}`);
  console.log(`  5esrd direct page:    ${stats['5esrd']}`);
  console.log(`  5esrd search fallback:${stats['5esrd-search']}`);
  console.log(`  Links changed:        ${stats.changed}`);

  if (repaired.length) {
    console.log('\nRepaired (Open5e was dead):');
    repaired.slice(0, 60).forEach(r => console.log(`  [${r.source}] ${r.name} → ${r.link}`));
    if (repaired.length > 60) console.log(`  …and ${repaired.length - 60} more`);
  }

  if (!DRY_RUN) {
    fs.writeFileSync(SPELLS_PATH, JSON.stringify(spells, null, 2) + '\n');
    console.log(`\nWrote ${SPELLS_PATH}`);
  }
})();
