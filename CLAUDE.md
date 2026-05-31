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
| `assets/modules/cloud-skills.js` | Firebase Auth + Firestore sync only (`syncToCloud`, `syncFromCloud`, `signInWithGoogle`, `signOut`) | ~570 |
| `assets/modules/core.js` | localStorage helpers, note box system, theme/accent, character CRUD (`loadData`, `autosave`, `createNewCharacter`, etc.), popup/tab system, `escapeHtml`, `initializeWebApp`, weapons/equipment system | ~2860 |
| `assets/modules/layout.js` | Flex-wrap sizing, section resize handles (`makeContainersResizable`, `applyFlexWrapSizing`), `setupAutoResize` | ~241 |
| `assets/modules/characters.js` | Currency system (CP/SP/GP + custom — saved under `page4.currency`), banner wealth messages, suggestion form, autosave scheduling, cloud sync helpers, deleted-character tracking | ~389 |
| `assets/modules/health.js` | HP display, death saves, potion use, short/long rest | ~292 |
| `assets/modules/actions.js` | Combat actions/reactions tracking | ~270 |
| `assets/modules/inventory.js` | Inventory CRUD, equipment, storage containers, coin tracking, portrait upload/remove, settings dropdown | ~1180 |
| `assets/modules/spells.js` | Spell list, spell slots, custom resources, favorites, sync panels. Loads spell reference data async from `assets/data/spells.json` via `loadSpellDatabase()` at boot | ~635 |
| `assets/modules/admin.js` | Owner-only admin portal: user list, character import/preview via Firestore. Depends on `escapeHtml`, `getStoredJSON`, `loadCharacterList`, `loadData` from `core.js` | ~230 |
| `assets/app.js` | Boot entry point only: `window.initializeApp`, `showWeaponsPopup`, `addWeapon` | ~129 |

**Each function is defined in exactly one file.** All functions are globals (no ES modules). Do not add duplicate definitions — the last-loaded file wins silently.

`app.monolith.backup.js` is an old pre-refactor backup — ignore it.

### Data Storage

All character data persists in `localStorage`. Keys follow a per-character pattern (character name as part of key). Firebase Firestore is used only for optional cloud backup — the app is fully functional offline.

Firebase config is hardcoded in `cloud-skills.js`. The owner email (`vanreejoz33@gmail.com`) gates certain admin behaviors.

### Styling

Single stylesheet: `assets/styles.css`. Theming uses CSS custom properties (`--accent`, `--accent-border`, `--accent-soft`, `--accent-contrast`, `--accent-text`, `--text-scale`) set dynamically from localStorage on page load (in `index.html` before paint to avoid flash).

### PWA

`sw.js` is a minimal service worker — it registers but passes all fetches through to the browser. The `.sixth` directory appears to be a PWA/build artifact directory; don't modify it.

## Working Efficiently

`assets/modules/core.js` (~3514 lines) is the largest file — never read it whole. Use `grep` to find the relevant function first, then read only that section. `assets/styles.css` is 126KB — same rule. `assets/data/spells.json` (482 spells, 365KB) is the canonical spell reference database — edit it directly to add or fix spells, no JS changes needed.

To locate any function:
```
grep -rn "function targetName" assets/
```

### Key globals to know
- `currentCharacter` — the active character's ID (string). Most data reads/writes key off this.
- `loadData()` — in `core.js`. Main entry point that reloads all page data after switching characters.
- `window.initializeApp` — defined in `app.js`. Called by `index.html` after all modules load. Single definition only.
- `initializeWebApp()` — in `core.js`. Called by `initializeApp` to set up web features.

### localStorage key map
Flat keys (not per-character):
- `dndCharacters` — array of all character metadata objects
- `dndTheme`, `dndAccentColor`, `dndTextScalePercent` — UI settings
- `dndLastSelectedCharacter`, `dndLastSelectedCharacterAt`, `dndFavoriteCharacters` — character selection state

Per-character data is stored under flat keys (`dndInventory`, `dndActions`, `dndSpells`, etc.) — the active character is tracked via `currentCharacter` rather than namespaced keys. Always use `getStoredJSON`/`setStoredJSON` helpers for reads/writes.
