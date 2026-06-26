#!/usr/bin/env node
// tools/build-spell-summaries.js
// Adds a short "summary" field to every spell in assets/data/spells.json.
//
// The summary is a MECHANICAL EXTRACT of already-accurate data — it never
// rewrites rules text. It = a cleanly truncated opening sentence + a compact
// tag line built from the existing structured fields (damage/save/range/etc).
// The full official `description` is left untouched; the in-app Open5e link
// remains the source of truth for the complete spell.
//
// Run:  node tools/build-spell-summaries.js
//       node tools/build-spell-summaries.js --sample   (print samples, DON'T write)

const fs = require('fs');
const path = require('path');

const SPELLS_PATH = path.join(__dirname, '..', 'assets', 'data', 'spells.json');
const MAX_PROSE = 320; // cap for the opening-sentence portion — enough to cover how the spell works, not just flavor

// Strip markdown/markup noise the prose might carry, collapse whitespace.
function cleanText(str) {
  return String(str || '')
    .replace(/\r/g, '')
    .replace(/\*\*/g, '')        // bold markers
    .replace(/\s*\n\s*/g, ' ')   // newlines -> space
    .replace(/\s{2,}/g, ' ')
    .trim();
}

// Take whole sentences from the start until we'd exceed MAX_PROSE.
// Never cuts mid-sentence; if even the first sentence is too long, hard-trim
// at a word boundary and add an ellipsis.
// Section headers Open5e embeds inline (e.g. "At Higher Levels.") that should
// never be the tail of a summary — they're headings, not prose.
const TRAILING_HEADERS = /\s*(At Higher Levels\.?|Higher Levels\.?|This spell.{0,4}$)\s*$/i;

function openingProse(desc) {
  const text = cleanText(desc);
  if (!text) return '';
  // Split on sentence enders followed by a space + capital/quote/number.
  const sentences = text.split(/(?<=[.!?])\s+(?=[A-Z0-9"'(])/);
  let out = '';
  for (const s of sentences) {
    // Stop before pulling in an "At Higher Levels" section header.
    if (/^(at\s+)?higher levels\.?$/i.test(s.trim())) break;
    if (!out) { out = s; }
    else if ((out + ' ' + s).length <= MAX_PROSE) { out += ' ' + s; }
    else break;
  }
  // Belt-and-suspenders: trim any dangling header fragment off the tail.
  out = out.replace(TRAILING_HEADERS, '').trim();
  if (out.length > MAX_PROSE) {
    const cut = out.slice(0, MAX_PROSE);
    const lastSpace = cut.lastIndexOf(' ');
    out = (lastSpace > 40 ? cut.slice(0, lastSpace) : cut).replace(/[.,;:]?$/, '') + '…';
  }
  return out;
}

// Extract & condense the "At Higher Levels" upcasting text into a short tag.
// Most spells phrase it as: "When you cast this spell using a spell slot of Nth
// level or higher, <EFFECT> for each slot level above Mth." We keep <EFFECT> and
// the "above Mth" anchor, dropping the boilerplate. Falls back to a trimmed copy
// of the raw upcast sentence if it doesn't match the common pattern.
function upcastTag(desc) {
  const text = cleanText(desc);
  const m = text.match(/(?:\*\*)?\s*At Higher Levels\.?\s*(?:\*\*)?\s*(.+)$/i);
  if (!m) return '';
  let up = m[1].trim();

  // Common SRD pattern → keep the effect + the "above Nth" anchor.
  const pat = up.match(/when you cast this spell using a spell slot of [^,]+,\s*(.+?)\s+for each slot level (above \w+)\.?/i);
  if (pat) {
    let effect = pat[1].trim()
      .replace(/^the\s+/i, '')
      .replace(/^you can\s+/i, '')
      .replace(/^you\s+(animate or reassert control over|create|gain|deal)\s+/i, '')
      .replace(/^roll an additional\s+/i, '+')
      .replace(/\s+increases? by\s+/i, ' +')
      .replace(/\bone additional\b/i, '+1')
      .replace(/\btwo additional\b/i, '+2')
      .replace(/\bone more\b/i, '+1')
      .replace(/\ban additional\b/i, '+1')
      .replace(/^target\s+\+/i, '+')
      .trim();
    // Avoid "+ +" stacking if the effect already begins with a + or digit.
    effect = effect.replace(/^\+\s*\+/, '+');
    return `Upcast: ${effect} ${pat[2]}`.replace(/\s{2,}/g, ' ').trim();
  }

  // Non-standard upcasting → short trimmed first clause, or skip if it won't
  // condense to something useful.
  up = up.split(/(?<=[.!?])\s/)[0].replace(/^when you cast this spell[^,]*,\s*/i, '').trim();
  if (!up || up.length > 90) return up ? `Upcast: ${up.slice(0, 78).replace(/\s\S*$/, '')}…` : '';
  return `Upcast: ${up.replace(/\.$/, '')}`;
}

// Normalize a field; treat None/No/empty as absent.
function field(v) {
  const s = String(v == null ? '' : v).trim();
  if (!s || /^(none|no|n\/a)$/i.test(s)) return '';
  return s;
}

// Build the compact mechanic tag line from existing accurate fields.
function mechanicTags(spell) {
  const tags = [];
  const dmg = field(spell.damage);
  const save = field(spell.save);
  const atk = field(spell.attack);
  const range = field(spell.range);
  const dur = field(spell.duration);

  if (dmg) tags.push(dmg);
  if (save) tags.push(save.replace(/\bsaving throw\b/i, 'save'));
  if (atk && !/^no$/i.test(atk)) tags.push(/attack/i.test(atk) ? atk : `${atk} attack`);
  if (range) tags.push(range);
  if (dur && !/^instant/i.test(dur)) tags.push(dur);
  if (spell.concentration === true) tags.push('Concentration');
  if (spell.ritual === true) tags.push('Ritual');

  return tags;
}

function buildSummary(spell) {
  const prose = openingProse(spell.description);
  const tags = mechanicTags(spell);
  const upcast = upcastTag(spell.description);

  let base = '';
  if (prose && tags.length) base = `${prose}  ·  ${tags.join(' · ')}`;
  else if (prose) base = prose;
  else if (tags.length) base = tags.join(' · ');

  // Upcasting goes on its own line so it reads clearly.
  if (upcast) base = base ? `${base}\n${upcast}` : upcast;
  return base;
}

function main() {
  const sampleOnly = process.argv.includes('--sample');
  const spells = JSON.parse(fs.readFileSync(SPELLS_PATH, 'utf8'));

  if (sampleOnly) {
    const picks = ['Fireball', 'Bless', 'Animate Dead', 'Mage Hand', 'Cure Wounds',
      'Counterspell', 'Wish', 'Eldritch Blast', 'Hex', 'Polymorph',
      'Magic Missile', 'Shield', 'Sleep', 'Hunter\'s Mark', 'Spirit Guardians'];
    console.log('=== SAMPLE SUMMARIES (no file written) ===\n');
    picks.forEach(name => {
      const sp = spells.find(s => s.name === name);
      if (!sp) return;
      const sum = buildSummary(sp);
      console.log(`▸ ${name}  [${sp.sourceBook || '?'}]`);
      console.log(`  ${sum}`);
      console.log(`  (summary ${sum.length} chars; full desc ${(sp.description || '').length} chars)\n`);
    });
    // A couple of long/edge ones too
    console.log('--- longest-description spells ---\n');
    spells.slice().sort((a, b) => (b.description || '').length - (a.description || '').length)
      .slice(0, 3).forEach(sp => {
        console.log(`▸ ${sp.name}  [${sp.sourceBook || '?'}]`);
        console.log(`  ${buildSummary(sp)}\n`);
      });
    return;
  }

  let written = 0;
  spells.forEach(sp => { sp.summary = buildSummary(sp); if (sp.summary) written++; });
  fs.writeFileSync(SPELLS_PATH, JSON.stringify(spells)); // keep minified like the rest
  console.log(`✓ Wrote summary for ${written}/${spells.length} spells → assets/data/spells.json`);
}

main();
