# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

A vanilla HTML/CSS/JS D&D 5e character sheet PWA. No build system, no bundler, no package manager. Open `index.html` directly in a browser or serve it with any static file server.

To run locally:
```
python3 -m http.server 8080
# then open http://localhost:8080
```

## Architecture

### Single-Page App with Hash Routing

`index.html` is the shell. It loads `partials/chrome.html` (nav/header) and `partials/popups.html` into fixed DOM roots, then dynamically fetches the active page from `pages/` based on `location.hash`. Each page (`home`, `stats`, `background`, `spells`, `inventory`, `notes`, `settings`) is a separate HTML fragment loaded on demand.

Hash → page mapping is in `resolveRouteToPage()` in `index.html`.

### JS Module Split

All JS lives in `assets/`. Files are loaded **in this exact order** via dynamic `<script>` tags in `index.html`:

| File | Owns | Lines |
|------|------|-------|
| `assets/banner-messages.js` | Static banner message array | small |
| `assets/modules/stats.js` | Ability scores, saving throws, skills, proficiency bonus, numeric input helpers (`calculateAbilityBonus`, `calculateSavingThrow`, `calculateSkillBonus`, `enforceAutoMathNumericInputs`, etc.) | ~290 |
| `assets/modules/cloud-skills.js` | Firebase Auth + Firestore sync (`syncToCloud`, `syncFromCloud`, `scheduleSyncToCloud`, `signInWithGoogle`, `signOut`, `onActiveCharacterChanged`) | ~700 |
| `assets/modules/core.js` | localStorage helpers, note box system, theme/accent, character CRUD (`loadData`, `autosave`, `createNewCharacter`, etc.), popup/tab system, `escapeHtml`, `initializeWebApp`, weapons/equipment system, **notes folder+card system** | ~3600 |
| `assets/modules/layout.js` | Flex-wrap sizing, section resize handles (`makeContainersResizable`, `applyFlexWrapSizing`), `setupAutoResize` | ~241 |
| `assets/modules/characters.js` | Currency system (CP/SP/GP + custom — saved under `page4.currency`), banner wealth messages, suggestion form, autosave scheduling (`scheduleAutosave`, `bindGlobalAutosaveListeners`), deleted-character tracking | ~379 |
| `assets/modules/health.js` | HP display, death saves, potion use, short/long rest | ~292 |
| `assets/modules/actions.js` | Combat actions/reactions tracking | ~270 |
| `assets/modules/inventory.js` | Inventory CRUD, equipment, storage containers, coin tracking, portrait upload/remove, settings dropdown | ~1180 |
| `assets/modules/spells.js` | Spell list, spell slots, custom resources, favorites, sync panels. Loads spell reference data async from `assets/data/spells.json` via `loadSpellDatabase()` at boot | ~635 |
| `assets/modules/admin.js` | Owner-only admin portal: user list, character import/preview via Firestore. Depends on `escapeHtml`, `getStoredJSON`, `loadCharacterList`, `loadData` from `core.js` | ~230 |
| `assets/app.js` | Boot entry point only: `window.initializeApp`, `showWeaponsPopup`, `addWeapon`. Also seeds default bg fields and calls `initNotesPage()` on first boot. | ~135 |

**Each function is defined in exactly one file.** All functions are globals (no ES modules). Do not add duplicate definitions — the last-loaded file wins silently.

`app.monolith.backup.js` is an old pre-refactor backup — ignore it.

### Data Storage

All character data persists in `localStorage`. The app is fully functional offline; Firestore is an optional cloud layer on top.

Firebase config is hardcoded in `cloud-skills.js`. The owner email (`vanreejoz33@gmail.com`) gates certain admin behaviors.

#### localStorage key map (complete)
Flat keys (not per-character):
- `dndCharacters` — array of all character objects (each has `id`, `name`, `createdAt`, `updatedAt`, `data`)
- `dndTheme`, `dndAccentColor`, `dndTextScalePercent` — UI settings
- `dndLastSelectedCharacter`, `dndLastSelectedCharacterAt`, `dndFavoriteCharacters` — character selection state
- `dndDeletedCharacters` — map of `{ [charId]: isoTimestamp }` for sync tombstoning
- `dndDeviceId` — stable per-device ID used for presence tracking

Per-character data is **not** namespaced by character ID in localStorage. All character data lives inside the `data` field of each entry in `dndCharacters`. Always use `getStoredJSON`/`setStoredJSON` helpers for reads/writes.

#### page6 — Notes data shape
Notes are no longer flat textarea fields. `data.page6` contains:
```js
{
  noteFolders: [
    {
      id: string,       // 'nfd_quests' etc. for defaults, 'nf_<timestamp>' for user-created
      title: string,
      isDefault: boolean,   // true = cannot be deleted
      cards: [
        {
          id: string,       // 'nfc_q1' etc. for defaults, 'nc_<timestamp>' for user-created
          title: string,
          body: string,
          isDefault: boolean  // true = cannot be deleted, shown with 'template' badge
        }
      ]
    }
  ]
}
```
- `NOTES_DEFAULT_FOLDERS` (in `core.js`) defines the 10 built-in folders and their one template card each.
- On every `loadData()`, any default folder missing from saved data is appended, and any default folder with 0 cards gets its template card re-injected. This means new default folders added to `NOTES_DEFAULT_FOLDERS` will appear for all existing characters automatically.
- `initNotesPage()` — called from `loadData()`, `clearAllFormFields()`, and `app.js` boot. Seeds defaults if `noteFolders` is empty, resets to folder view, renders.
- `notesGoBack()` — resets to folder view and scrolls to top. Also called by `switchTab()` on every tab change so the user always lands on the folder grid.
- Cloud sync carries `page6.noteFolders` automatically as part of the full character blob — no special handling needed.

#### Firestore structure
```
userData/{uid}                          — user prefs: theme, accentColor, lastModified
userData/{uid}/characters/{charId}      — one document per character (mirrors localStorage shape + server updatedAt)
userProfiles/{uid}                      — display name / nickname
auth_signins/{uid}                      — sign-in history and per-device presence
```

**Rules:** the `characters` subcollection requires an explicit `match /characters/{charId}` rule in Firestore security rules — without it subcollection writes are denied even if the parent `userData/{uid}` rule allows writes.

#### Cloud sync flow
1. **Edit → save:** every field change debounces through `scheduleAutosave()` (400 ms) → `autosave()` writes localStorage + stamps `updatedAt` → `scheduleSyncToCloud()` (2 s debounce) → writes **only** the active character's Firestore doc.
2. **Boot → pull:** `syncFromCloud(true)` runs 1 s after sign-in. Reads all docs from the `characters` subcollection, merges with local by `updatedAt` (newer wins per character), then restores the last-selected character.
3. **Live updates:** `onSnapshot` watches the active character's doc only (`startActiveCharacterListener`). Echoes from our own saves are suppressed for 10 s after `lastOwnSaveAt`; only genuine remote changes reload the sheet.
4. **Character switch:** `loadSelectedCharacter()` calls `onActiveCharacterChanged(charId)` which restarts the listener on the new character.
5. **Migration:** `migrateOldFormatIfNeeded()` runs at boot — if the old single-doc `userData/{uid}.characters` array exists it fans it out into subcollection docs and removes the array.

#### Key sync globals
- `lastOwnSaveAt` — `Date.now()` timestamp of last write we initiated; used to suppress snapshot echoes
- `activeCharacterUnsubscribe` — cleanup handle for the active onSnapshot listener
- `cloudSyncTimer` — debounce handle for `scheduleSyncToCloud`

### Styling

Single stylesheet: `assets/styles.css`. Theming uses CSS custom properties (`--accent`, `--accent-border`, `--accent-soft`, `--accent-contrast`, `--accent-text`, `--text-scale`) set dynamically from localStorage on page load (in `index.html` before paint to avoid flash).

### PWA

`sw.js` is a minimal service worker — it registers but passes all fetches through to the browser. The `.sixth` directory appears to be a PWA/build artifact directory; don't modify it.

## Known Gotchas

- **`updateWeaponsPreview()` and `updateEquipmentPreviews()` must NOT call `autosave()`** — these are pure render functions called during `clearAllFormFields()` inside `loadData()`. Calling autosave there writes empty characterInfo to localStorage and destroys saved data. Callers that need to persist after rendering (e.g. `saveWeaponFromForm`, `removeEquipmentItem`) call `autosave()` explicitly after.
- **All pages are in the DOM simultaneously** — `index.html` loads all page HTML at boot and hides/shows via CSS `display`. So `document.getElementById('char_name')` always resolves even when the stats page is not visible.
- **`autosave()` uses `val(id) !== null` not `val(id)` to decide whether to save or preserve** — empty string `""` is a valid save (user cleared the field); `null` means the element isn't in the DOM (page not loaded yet). Don't change this to a falsy check.
- **Script version cache-busting** — `index.html` has a `scriptVersion` constant appended as `?v=` to all script URLs. Bump it whenever JS files change so browsers don't serve stale cached scripts.
- **Notes page is JS-rendered** — `pages/notes.html` contains only the shell markup (toolbar, grid containers, popups). All folder and card elements are built by `renderNoteFolders()` / `renderNoteCards()` in `core.js`. Do not add static note content to the HTML.
- **Notes `isDefault` must be preserved through save/load** — both folder and card objects carry `isDefault: boolean`. The autosave block and the load block both map this flag explicitly. If you add new fields to the notes data shape, update both the save block (`page6 = { noteFolders: ... }`) and the load block in `loadData()`.
- **Notes delete is multi-step** — uses `notesHandleDelete(id, btn, onConfirm)` with state tracked in `notesDeleteState`. Pattern: Delete → Sure? → Wait 3s… → Confirm. Do not replace with `confirm()` dialogs.

## Working Efficiently

`assets/modules/core.js` (~3125 lines) is the largest file — never read it whole. Use `grep` to find the relevant function first, then read only that section. `assets/styles.css` is 126KB — same rule. `assets/data/spells.json` (482 spells, 365KB) is the canonical spell reference database — edit it directly to add or fix spells, no JS changes needed.

To locate any function:
```
grep -rn "function targetName" assets/
```

### Key globals to know
- `currentCharacter` — the active character's ID (string). Most data reads/writes key off this.
- `loadData()` — in `core.js`. Main entry point that reloads all page data after switching characters.
- `window.initializeApp` — defined in `app.js`. Called by `index.html` after all modules load. Single definition only.
- `initializeWebApp()` — in `core.js`. Called by `initializeApp` to set up web features.
- `noteFolders` — global array of folder objects for the notes page. Source of truth for all notes UI. Modified in place; always call `autosave()` after mutating.
- `NOTES_DEFAULT_FOLDERS` — constant array defining the 10 built-in folders and their template cards. Edit this to change default content; changes propagate to all existing characters on next load (missing folders are appended, empty default folders get their card re-injected).
- `notesHandleDelete(id, btn, onConfirm)` — shared multi-step delete handler for both folders and cards. Manages state in `notesDeleteState[id]`.

