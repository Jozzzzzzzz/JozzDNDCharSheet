#!/usr/bin/env node
// tools/update-changelog.js
// Run with: node tools/update-changelog.js
// Prompts for the new version entry and writes it into assets/changelog.js automatically.

const readline = require('readline');
const fs = require('fs');
const path = require('path');

const CHANGELOG_PATH = path.join(__dirname, '..', 'assets', 'changelog.js');

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

function ask(question) {
  return new Promise(resolve => rl.question(question, answer => resolve(answer.trim())));
}

function askMultiline(prompt) {
  return new Promise(resolve => {
    console.log(prompt);
    console.log('  Enter each item on its own line. Empty line when done.');
    const items = [];
    const ask = () => {
      rl.question('  > ', line => {
        line = line.trim();
        if (!line) return resolve(items);
        items.push(line);
        ask();
      });
    };
    ask();
  });
}

function readCurrentChangelog() {
  const src = fs.readFileSync(CHANGELOG_PATH, 'utf8');
  const versionMatch = src.match(/const CHANGELOG_LATEST_VERSION = '([^']+)'/);
  const currentVersion = versionMatch ? versionMatch[1] : '?';
  return { src, currentVersion };
}

function bumpVersion(version, type) {
  const parts = version.split('.').map(Number);
  if (type === 'major') { parts[0]++; parts[1] = 0; parts[2] = (parts[2] !== undefined ? 0 : undefined); }
  else if (type === 'minor') { parts[1]++; if (parts[2] !== undefined) parts[2] = 0; }
  else { if (parts[2] !== undefined) parts[2]++; else parts.push(1); }
  return parts.filter(p => p !== undefined).join('.');
}

function formatEntry(version, date, title, updates, fixes) {
  const updatesJs = updates.length
    ? `    updates: [\n${updates.map(u => `      '${u.replace(/'/g, "\\'")}',`).join('\n')}\n    ],`
    : '    updates: [],';
  const fixesJs = fixes.length
    ? `    fixes: [\n${fixes.map(f => `      '${f.replace(/'/g, "\\'")}',`).join('\n')}\n    ],`
    : '    fixes: [],';
  return `  {\n    version: '${version}',\n    date: '${date}',\n    title: '${title.replace(/'/g, "\\'")}',\n${updatesJs}\n${fixesJs}\n  }`;
}

async function main() {
  console.log('\n=== Changelog Updater ===\n');

  const { src, currentVersion } = readCurrentChangelog();
  console.log(`Current version: v${currentVersion}`);

  const bumpType = await ask('\nBump type? [patch / minor / major / custom]: ');
  let newVersion;
  if (['patch', 'minor', 'major'].includes(bumpType)) {
    newVersion = bumpVersion(currentVersion, bumpType);
  } else {
    newVersion = await ask('Enter version number (e.g. 0.4): ');
  }
  console.log(`New version: v${newVersion}`);

  const today = new Date().toISOString().split('T')[0];
  const date = await ask(`Date [${today}]: `) || today;
  const title = await ask('Entry title (e.g. "Dice Roller & Polish"): ');

  const updates = await askMultiline("\nWhat's new:");
  const fixes = await askMultiline('\nFixed:');

  const newEntry = formatEntry(newVersion, date, title, updates, fixes);

  // Replace LATEST_VERSION
  let newSrc = src.replace(
    /const CHANGELOG_LATEST_VERSION = '[^']+'/,
    `const CHANGELOG_LATEST_VERSION = '${newVersion}'`
  );

  // Insert new entry at top of CHANGELOG array
  newSrc = newSrc.replace(
    /const CHANGELOG = \[\n/,
    `const CHANGELOG = [\n${newEntry},\n`
  );

  fs.writeFileSync(CHANGELOG_PATH, newSrc, 'utf8');

  console.log(`\n✓ changelog.js updated — v${currentVersion} → v${newVersion}`);
  console.log(`  Title: ${title}`);
  console.log(`  ${updates.length} update(s), ${fixes.length} fix(es)`);
  console.log('\nNext steps:');
  console.log('  1. Bump scriptVersion in index.html');
  console.log('  2. git add assets/changelog.js index.html');
  console.log(`  3. git commit -m "v${newVersion}: ${title}"`);
  console.log('  4. git push\n');

  rl.close();
}

main().catch(err => { console.error(err); rl.close(); process.exit(1); });
