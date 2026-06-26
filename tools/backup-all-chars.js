#!/usr/bin/env node
// tools/backup-all-chars.js
//
// OWNER-ONLY character backup. This is NOT run with node — it's a reference
// for a function you paste into the browser console on the LIVE site while
// signed in as the owner (vanreejoz33@gmail.com). Same pattern as
// seed-campaign.js. The owner's collectionGroup read rule on `characters`
// is what lets it see every user's sheets.
//
// What it does:
//   - reads EVERY user's characters via db.collectionGroup('characters')
//   - reads userProfiles to resolve each owner uid -> username/email
//   - builds one .json per character named:  username_charname_level_date.json
//   - packs them into a single ZIP and downloads it
//   - you then drop / extract that zip into:  C:\GitHubNeverDelete\Backup Chars
//
// Browsers cannot write to C:\ directly, hence the download-then-move step.
// JSZip is loaded from a CDN at call time so nothing has to ship in the app.
//
// ── To use: paste EVERYTHING below into the console on the live site ──

async function backupAllChars() {
  if (typeof db === 'undefined' || !db) {
    alert('Firestore (db) not available — run this on the live site while signed in.');
    return;
  }

  // sanitiseFilePart — mirror of core.js sanitizeFilePart (kept local so this
  // script is self-contained when pasted into the console).
  const clean = (value, fallback = 'unknown') => {
    const c = String(value || '')
      .trim()
      .replace(/[<>:"/\\|?*\x00-\x1F]/g, '')
      .replace(/\s+/g, '_')
      .replace(/\.+$/g, '');
    return c || fallback;
  };
  const dateOnly = (d) => {
    const dt = new Date(d);
    return Number.isNaN(dt.getTime()) ? 'unknown-date' : dt.toISOString().split('T')[0];
  };

  // Load JSZip on demand.
  if (typeof JSZip === 'undefined') {
    await new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';
      s.onload = resolve;
      s.onerror = () => reject(new Error('Could not load JSZip from CDN (are you offline?)'));
      document.head.appendChild(s);
    });
  }

  console.log('[backup] reading user profiles…');
  const nameByUid = {};
  try {
    const profSnap = await db.collection('userProfiles').get();
    profSnap.forEach(doc => {
      const d = doc.data() || {};
      nameByUid[doc.id] = d.nickname || d.email || doc.id;
    });
  } catch (e) {
    console.warn('[backup] could not read userProfiles, will fall back to uid:', e.message);
  }

  console.log('[backup] reading ALL characters (collectionGroup)…');
  const snap = await db.collectionGroup('characters').get();
  if (snap.empty) {
    alert('No characters found (or read denied — are you signed in as the owner?).');
    return;
  }

  const todayPart = dateOnly(new Date().toISOString());
  const zip = new JSZip();
  const usedNames = {};
  let count = 0;
  const index = [];

  snap.forEach(doc => {
    const raw = doc.data() || {};
    const charData = raw.data || raw;            // doc mirrors { ..., data: {...} }
    const info = charData.characterInfo || {};
    const uid = (doc.ref.parent.parent && doc.ref.parent.parent.id) || 'unknown-uid';

    const username = nameByUid[uid] || uid;
    const charName = info.name || raw.name || 'Unnamed';
    const level = info.level ? `lvl${String(info.level).trim()}` : 'lvl-unknown';

    let base = `${clean(username, 'user')}_${clean(charName, 'char')}_${clean(level)}_${todayPart}`;
    // de-dupe identical names (e.g. two "lvl-unknown" on same day)
    if (usedNames[base] != null) {
      usedNames[base] += 1;
      base = `${base}_${usedNames[base]}`;
    } else {
      usedNames[base] = 0;
    }
    const fileName = `${base}.json`;

    const payload = {
      version: '2.1',
      exportDate: new Date().toISOString(),
      owner: { uid, username },
      charId: doc.id,
      character: charData,
      keyFields: {
        name: info.name || '',
        level: info.level || '',
        class: info.class || '',
        race: info.race || ''
      }
    };

    zip.file(fileName, JSON.stringify(payload, null, 2));
    index.push({ uid, username, charId: doc.id, name: charName, level: info.level || '', file: fileName });
    count++;
  });

  // A manifest so you can see what's in the archive at a glance.
  zip.file('_manifest.json', JSON.stringify({
    exportedAt: new Date().toISOString(),
    totalCharacters: count,
    destinationHint: 'C:\\GitHubNeverDelete\\Backup Chars',
    characters: index
  }, null, 2));

  console.log(`[backup] zipping ${count} character(s)…`);
  const blob = await zip.generateAsync({ type: 'blob' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `AllChars_backup_${todayPart}.zip`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  console.log(`[backup] done — ${count} character(s). Move the downloaded zip into:`);
  console.log('         C:\\GitHubNeverDelete\\Backup Chars  (then extract it there)');
  alert(`Backup complete: ${count} character(s) zipped.\n\nMove the downloaded "AllChars_backup_${todayPart}.zip" into:\nC:\\GitHubNeverDelete\\Backup Chars\nand extract it there.`);
}

// Auto-run when pasted. (Comment this out if you only want to define it.)
backupAllChars();
