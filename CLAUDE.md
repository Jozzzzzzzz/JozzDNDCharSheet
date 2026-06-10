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
| `assets/modules/core.js` | localStorage helpers, note box system, theme/accent/font, character CRUD (`loadData`, `autosave`, `createNewCharacter`, etc.), popup/tab system, `escapeHtml`, `initializeWebApp`, weapons/equipment system, **notes folder+card system** | ~3580 |
| `assets/modules/layout.js` | Flex-wrap sizing, section resize handles (`makeContainersResizable`, `applyFlexWrapSizing`), `setupAutoResize` | ~241 |
| `assets/modules/characters.js` | Currency system (CP/SP/GP + custom — saved under `page4.currency`), banner wealth messages, suggestion form, autosave scheduling (`scheduleAutosave`, `bindGlobalAutosaveListeners`), deleted-character tracking | ~379 |
| `assets/modules/health.js` | HP display, death saves, potion use, short/long rest | ~292 |
| `assets/modules/actions.js` | Combat actions/reactions tracking | ~270 |
| `assets/modules/inventory.js` | Inventory CRUD, equipment, storage containers, coin tracking, portrait upload/remove (`removePortrait`), settings dropdown | ~1180 |
| `assets/modules/spells.js` | Spell list, spell slots (with drag-reorder), custom resources, favorites, prepared spells table, spell search, sync panels. Loads spell reference data async from `assets/data/spells.json` via `loadSpellDatabase()` at boot | ~1440 |
| `assets/modules/admin.js` | Owner-only admin portal: user list, character import/preview via Firestore. Depends on `escapeHtml`, `getStoredJSON`, `loadCharacterList`, `loadData` from `core.js` | ~230 |
| `assets/app.js` | Boot entry point: `window.initializeApp`, `showWeaponsPopup`, `addWeapon`, `manualSave`. Also seeds default bg fields and calls `initNotesPage()` on first boot. | ~150 |

**Each function is defined in exactly one file.** All functions are globals (no ES modules). Do not add duplicate definitions — the last-loaded file wins silently.

**Load order matters for overrides** — if two files define the same function name, the later-loaded file wins. Known intentional ownership: `manualSave` lives in `app.js` (loads last), `removePortrait` lives in `inventory.js`.

`app.monolith.backup.js` is an old pre-refactor backup — ignore it.

### Data Storage

All character data persists in `localStorage`. The app is fully functional offline; Firestore is an optional cloud layer on top.

Firebase config is hardcoded in `cloud-skills.js`. The owner email (`vanreejoz33@gmail.com`) gates certain admin behaviors.

#### localStorage key map (complete)
Flat keys (not per-character):
- `dndCharacters` — array of all character objects (each has `id`, `name`, `createdAt`, `updatedAt`, `data`)
- `dndTheme`, `dndAccentColor`, `dndTextScalePercent`, `dndFontFamily` — UI settings
- `dndLastSelectedCharacter`, `dndLastSelectedCharacterAt`, `dndFavoriteCharacters` — character selection state
- `dndDeletedCharacters` — map of `{ [charId]: isoTimestamp }` for sync tombstoning
- `dndDeviceId` — stable per-device ID used for presence tracking
- `dndBgImage` — active background image URL (preset path or data URL or remote URL)
- `dndBgCustoms` — JSON array of user-added custom backgrounds `[{ id, label, url }]`
- `dndLightModeJokeAt` — timestamp of last light mode joke, used for 24h cooldown

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
- Note editor textarea has `spellcheck="true" autocorrect="on" autocapitalize="sentences"` set explicitly — required for consistent behaviour across browsers and mobile PWA mode.

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

Single stylesheet: `assets/styles.css`. Theming uses CSS custom properties set dynamically from localStorage on page load (in `index.html` before paint to avoid flash).

#### CSS custom property reference
| Variable | Purpose |
|----------|---------|
| `--accent` | Raw accent colour chosen by user |
| `--accent-muted` | Desaturated (35% toward grey) + 55% opacity version — used for button fills so colours aren't overpowering |
| `--accent-border` | 50% opacity accent — used for borders and header dividers |
| `--accent-soft` | 14% opacity accent — used for active tab highlight and hover states |
| `--accent-contrast` | Black or white depending on YIQ brightness — readable text on raw accent |
| `--accent-text` | Lightened accent for dark backgrounds, or raw accent if bright enough |
| `--dark-bg` | Page body background (`#0e0c0a` dark / `#e8e4dc` light) |
| `--panel-bg` | Semi-transparent panel/card background |
| `--card-bg` | Slightly more opaque card background |
| `--bg-image` | CSS custom property holding the background image `url()` — set via injected `<style id="bg-pseudo-style">` not directly, because browsers don't resolve relative URLs inside CSS variables |
| `--text-scale` | Global text scale multiplier |
| `--font-family` | Active font stack — set by `applyFontFamily()` in `core.js`, restored before first paint in `index.html` inline script |

All accent variables are computed in `setAccentDerivedColors()` in `core.js` and also in the early-boot inline script in `index.html` (to avoid flash). **Both places must be kept in sync.**

When adding a new font option: update `FONT_OPTIONS` in `core.js`, the `fontMap` object in the `index.html` early-boot script, and the `<select>` in `pages/settings.html`. All three must stay in sync or the font won't restore correctly on reload.

#### Background image system
Background is applied via a `<style id="bg-pseudo-style">` tag injected into `<head>` — **not** via a CSS variable on `body::before` — because browsers refuse to resolve relative `url()` paths inside CSS custom properties.

- `body::before` is the fixed full-screen image layer (blurred, darkened). It defaults to `opacity: 0`.
- `html.has-bg-image` class enables it (`opacity: 1`). Class lives on `<html>` not `<body>` so it can be set before `<body>` is parsed.
- `bgApply(url)` in `core.js` — sets or clears the style tag + class + localStorage.
- `loadBgSetting()` — called at boot from `loadThemeSettings()` to restore saved background.
- Early-boot script in `index.html` also restores the style tag before first paint.

#### Background presets
Preset images live in `assets/backgrounds/`. Add a new preset by dropping an image there and adding one line to `BG_PRESETS` in `core.js`:
```js
{ id: 'bg-<slug>', label: '<Display Name>', url: 'assets/backgrounds/<filename>' },
```
Current presets: Forest, Dark Forest Path, Elven City, Medieval Town, Tavern, Dungeon Hall, Sewers, Ruined Gates, Lost Temple.

#### Custom backgrounds (player-added)
Stored as a JSON array under `dndBgCustoms` in localStorage. Each entry: `{ id, label, url }`. URL is either a base64 data URL (file upload) or a remote URL (URL input). Functions: `bgAddCustom`, `bgDeleteCustom`, `bgGetCustoms`, `bgSaveCustoms`. The picker renders a separate "Custom Backgrounds" section below presets with a ✕ delete button on each.

#### Light mode joke
`toggleTheme()` intercepts the first attempt to enable light mode and shows a popup joke instead. Timestamp stored in `dndLightModeJokeAt`. A second attempt within 60 seconds actually enables light mode. After 24 hours the joke resets.

### PWA

`sw.js` is a minimal service worker — it registers but passes all fetches through to the browser. The `.sixth` directory appears to be a PWA/build artifact directory; don't modify it.

## Spells Page

### Spell data shape
Every spell object is normalised through `normalizeSpellRecord()` on load — all fields are guaranteed to exist as strings/booleans even if missing from saved data. Fields: `name`, `level`, `school`, `castingTime`, `range`, `components`, `duration`, `damage`, `save`, `attack`, `ritual`, `concentration`, `prepared`, `classes`, `sourceBook`, `description`, `wikiLink`.

### Spell slot drag-reorder
`updateSpellSlots()` renders each slot row with a `⠿` drag handle. HTML5 drag-and-drop reorders `manualSpellSlots` array in place and calls `autosave()`. The order in the array is what gets saved — no extra field needed.

### Prepared spells table
`renderPreparedSpells()` renders a `<table class="prepared-spells-table">` with 6 columns (Name, Lvl, Cast Time, Range, Damage, View button) and `colspan="6"` on group header rows. Uses `table-layout: fixed` with explicit `<col>` widths. Damage column uses `white-space: normal` to wrap — do not change to `nowrap`.

### Spell search
`filterSpells('cantrip')` reads `#cantrip_search` and `filterSpells('spell')` reads `#spell_search`. Both inputs use `oninput` so filtering is live. Search stacks with the existing dropdown filters.

## Known Gotchas

- **`updateWeaponsPreview()` and `updateEquipmentPreviews()` must NOT call `autosave()`** — these are pure render functions called during `clearAllFormFields()` inside `loadData()`. Calling autosave there writes empty characterInfo to localStorage and destroys saved data. Callers that need to persist after rendering (e.g. `saveWeaponFromForm`, `removeEquipmentItem`) call `autosave()` explicitly after.
- **All pages are in the DOM simultaneously** — `index.html` loads all page HTML at boot and hides/shows via CSS `display`. So `document.getElementById('char_name')` always resolves even when the stats page is not visible.
- **`autosave()` uses `val(id) !== null` not `val(id)` to decide whether to save or preserve** — empty string `""` is a valid save (user cleared the field); `null` means the element isn't in the DOM (page not loaded yet). Don't change this to a falsy check.
- **Script version cache-busting** — `index.html` has a `scriptVersion` constant appended as `?v=` to all script URLs. Bump it whenever JS files change so browsers don't serve stale cached scripts.
- **Notes page is JS-rendered** — `pages/notes.html` contains only the shell markup (toolbar, grid containers, popups). All folder and card elements are built by `renderNoteFolders()` / `renderNoteCards()` in `core.js`. Do not add static note content to the HTML.
- **Notes `isDefault` must be preserved through save/load** — both folder and card objects carry `isDefault: boolean`. The autosave block and the load block both map this flag explicitly. If you add new fields to the notes data shape, update both the save block (`page6 = { noteFolders: ... }`) and the load block in `loadData()`.
- **Notes delete is multi-step** — uses `notesHandleDelete(id, btn, onConfirm)` with state tracked in `notesDeleteState`. Pattern: Delete → Sure? → Wait 3s… → Confirm. Do not replace with `confirm()` dialogs.
- **Never use `transition: all` in styles.css** — it causes all elements to animate colour/border/background at different stagger offsets when the accent colour changes, making the UI look broken. Always use explicit per-property transitions: `background-color 0.2s ease, border-color 0.2s ease, color 0.2s ease, box-shadow 0.2s ease, transform 0.3s ...`
- **CSS `url()` inside custom properties doesn't work** — browsers store the string literally and never resolve relative paths. The background image system uses an injected `<style>` tag instead of `--bg-image` on `body::before`. Don't revert this to a CSS variable approach.
- **`html.has-bg-image` not `body.has-bg-image`** — the class must go on `<html>` because the early-boot script in `<head>` runs before `<body>` exists. `document.body` is `null` at that point.
- **Roboto is loaded from Google Fonts** — `index.html` includes a `<link>` to `fonts.googleapis.com`. All other font options are system fonts and work offline. If Roboto is selected and the user is offline, the browser falls back to the system sans-serif gracefully.

## Working Efficiently

`assets/modules/core.js` (~3580 lines) is the largest file — never read it whole. Use `grep` to find the relevant function first, then read only that section. `assets/styles.css` is ~130KB — same rule. `assets/data/spells.json` (482 spells, 365KB) is the canonical spell reference database — edit it directly to add or fix spells, no JS changes needed.

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
- `FONT_OPTIONS` — array in `core.js` defining available font choices. Must stay in sync with the `fontMap` in `index.html` early-boot script and the `<select>` in `pages/settings.html`.
- `manualSpellSlots` — array of spell slot objects; order in the array is the display order. Drag-reorder mutates this array directly.
