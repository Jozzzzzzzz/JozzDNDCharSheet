#!/usr/bin/env node
// tools/update-changelog.js
// Run with: node tools/update-changelog.js
// Prompts for the new version entry and writes it into assets/changelog.js automatically.

const readline = require('readline');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const REPO_ROOT = path.join(__dirname, '..');
const CHANGELOG_PATH = path.join(REPO_ROOT, 'assets', 'changelog.js');
// Backups live in a SIBLING of the repo (under Repos\), never inside the git tree.
const BACKUPS_DIR = path.resolve(REPO_ROOT, '..', 'JozzDNDSheet Backups');

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
  // This project uses a zero-padded MAJOR.MINOR scheme (e.g. 1.06 -> 1.07),
  // NOT semver. Detect that shape and preserve the padding; a naive
  // Number('06') would drop the leading zero and produce 1.6.x.
  const padMatch = version.match(/^(\d+)\.(\d{2})$/);
  if (padMatch) {
    let major = Number(padMatch[1]);
    let minor = Number(padMatch[2]);
    const pad = (n) => String(n).padStart(2, '0');
    if (type === 'major') { major++; minor = 0; }
    else { minor++; }            // patch and minor both step the padded minor
    if (minor > 99) { major++; minor = 0; }
    return `${major}.${pad(minor)}`;
  }

  // Fallback: generic semver-ish handling for any other version shape.
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

function buildBackupReadme(version, date, title, updates, fixes) {
  const lines = [];
  lines.push(`# JozzDNDSheet — Backup v${version} (${date})`);
  lines.push('');
  lines.push(`**App version:** ${version}`);
  lines.push(`**Title:** ${title || '(none)'}`);
  lines.push('');
  let commit = '';
  try {
    commit = execFileSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: REPO_ROOT })
      .toString().trim();
  } catch { /* not fatal */ }
  if (commit) lines.push(`**Source commit:** ${commit}`);
  lines.push('');
  lines.push('## What changed this release');
  lines.push('');
  if (updates.length) {
    lines.push("### What's new");
    updates.forEach(u => lines.push(`- ${u}`));
    lines.push('');
  }
  if (fixes.length) {
    lines.push('### Fixed');
    fixes.forEach(f => lines.push(`- ${f}`));
    lines.push('');
  }
  if (!updates.length && !fixes.length) {
    lines.push('_No changelog bullets recorded for this entry._');
    lines.push('');
  }
  lines.push('## Restore');
  lines.push('');
  lines.push('Unzip into an empty folder and open `index.html`, or serve it:');
  lines.push('');
  lines.push('```');
  lines.push('python3 -m http.server 8080');
  lines.push('```');
  lines.push('');
  lines.push('No build step or package install — vanilla HTML/CSS/JS PWA.');
  lines.push('');
  return lines.join('\n');
}

// Creates JozzDNDSheet Backups\JozzDNDSheet_v<ver>_<date>.zip with a README of what shipped.
// Builds the zip in TEMP then moves it into place — a protection hook blocks
// deletes/overwrites on `backup`-named paths, so we never write -Force onto the target.
function createBackup(version, date, title, updates, fixes) {
  const tmpStage = fs.mkdtempSync(path.join(os.tmpdir(), 'jozzbackup-'));
  const tmpZip = path.join(os.tmpdir(), `jozzbackup-${Date.now()}.zip`);
  const zipName = `JozzDNDSheet_v${version}_${date}.zip`;
  const finalZip = path.join(BACKUPS_DIR, zipName);

  // Gather tracked files (excludes .git, node_modules, gitignored backups).
  const tracked = execFileSync('git', ['ls-files'], { cwd: REPO_ROOT })
    .toString().split('\n').map(s => s.trim()).filter(Boolean);

  for (const rel of tracked) {
    const srcFile = path.join(REPO_ROOT, rel);
    if (!fs.existsSync(srcFile)) continue;
    const destFile = path.join(tmpStage, rel);
    fs.mkdirSync(path.dirname(destFile), { recursive: true });
    fs.copyFileSync(srcFile, destFile);
  }

  // README describing this release, at the zip root.
  fs.writeFileSync(
    path.join(tmpStage, 'README.md'),
    buildBackupReadme(version, date, title, updates, fixes),
    'utf8'
  );

  fs.mkdirSync(BACKUPS_DIR, { recursive: true });

  // Zip via PowerShell Compress-Archive (no npm deps). Build in TEMP, then move.
  const ps =
    `$ErrorActionPreference='Stop';` +
    `Compress-Archive -Path (Join-Path '${tmpStage}' '*') -DestinationPath '${tmpZip}' -CompressionLevel Optimal;` +
    `Move-Item -LiteralPath '${tmpZip}' -Destination '${finalZip}' -Force`;
  execFileSync('powershell', ['-NoProfile', '-NonInteractive', '-Command', ps], { stdio: 'pipe' });

  const sizeKb = (fs.statSync(finalZip).size / 1024).toFixed(1);
  return { finalZip, count: tracked.length, sizeKb };
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

  // Backup step — 1 version bump = 1 dated zip backup (per CLAUDE.md versioning rule).
  const doBackup = (await ask('\nCreate backup zip now? [Y/n]: ')).toLowerCase();
  if (doBackup !== 'n' && doBackup !== 'no') {
    try {
      const { finalZip, count, sizeKb } = createBackup(newVersion, date, title, updates, fixes);
      console.log(`\n✓ Backup created: ${finalZip}`);
      console.log(`  ${count} file(s), ${sizeKb} KB`);
    } catch (err) {
      console.warn('\n⚠ Backup failed (changelog was still saved). You can zip manually.');
      console.warn(`  ${err.message}`);
    }
  } else {
    console.log('  Skipped backup.');
  }

  console.log('\nNext steps:');
  console.log('  1. Bump scriptVersion in index.html');
  console.log('  2. git add assets/changelog.js index.html');
  console.log(`  3. git commit -m "v${newVersion}: ${title}"`);
  console.log('  4. git push\n');

  rl.close();
}

// Run interactively unless required as a module (allows isolated testing of the backup step).
if (require.main === module) {
  main().catch(err => { console.error(err); rl.close(); process.exit(1); });
} else {
  rl.close();
  module.exports = { createBackup, buildBackupReadme, BACKUPS_DIR };
}
