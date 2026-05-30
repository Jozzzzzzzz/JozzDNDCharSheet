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

All JS lives in `assets/`. Files are loaded in order via `<script>` tags at the bottom of `index.html`:

- `assets/modules/core.js` — localStorage helpers (`getStoredJSON`, `setStoredJSON`, `safeParseJSON`), spell/favorites data normalization, shared init logic
- `assets/modules/cloud-skills.js` — Firebase Auth + Firestore sync (sign-in, syncToCloud, syncFromCloud); exposes functions on `window`
- `assets/modules/inventory.js` — inventory CRUD, coin tracking
- `assets/modules/spells.js` — spell list management, favorites, spellcasting info
- `assets/modules/actions.js` — combat actions/reactions tracking
- `assets/app.js` — everything else: layout helpers, flex-wrap height sync, character manager (create/load/delete), page routing, banner messages, settings, all remaining page logic

`app.monolith.backup.js` is an old pre-refactor backup — ignore it.

### Data Storage

All character data persists in `localStorage`. Keys follow a per-character pattern (character name as part of key). Firebase Firestore is used only for optional cloud backup — the app is fully functional offline.

Firebase config is hardcoded in `cloud-skills.js`. The owner email (`vanreejoz33@gmail.com`) gates certain admin behaviors.

### Styling

Single stylesheet: `assets/styles.css`. Theming uses CSS custom properties (`--accent`, `--accent-border`, `--accent-soft`, `--accent-contrast`, `--accent-text`, `--text-scale`) set dynamically from localStorage on page load (in `index.html` before paint to avoid flash).

### PWA

`sw.js` is a minimal service worker — it registers but passes all fetches through to the browser. The `.sixth` directory appears to be a PWA/build artifact directory; don't modify it.

## Working Efficiently

`assets/app.js` (8,600 lines) and `assets/modules/core.js` (3,800 lines) are large — never read them whole. Use `grep` to find the relevant function first, then read only that section. `assets/styles.css` is 126KB — same rule.

All functions are globals (no ES modules). To locate any function:
```
grep -rn "function targetName" assets/
```

### Key globals to know
- `currentCharacter` — the active character's ID (string), set in `app.js:530`. Most data reads/writes key off this.
- `loadData()` (`app.js:1728`) — main entry point that reloads all page data for the active character after switching characters.
- `initializeWebApp()` (`app.js:793`) / `window.initializeApp` (`app.js:953`) — top-level boot sequence.

### localStorage key map
Flat keys (not per-character):
- `dndCharacters` — array of all character metadata objects
- `dndTheme`, `dndAccentColor`, `dndTextScalePercent` — UI settings
- `dndLastSelectedCharacter`, `dndLastSelectedCharacterAt`, `dndFavoriteCharacters` — character selection state

Per-character data is stored under flat keys (`dndInventory`, `dndActions`, `dndSpells`, etc.) — the active character is tracked via `currentCharacter` rather than namespaced keys. Always use `getStoredJSON`/`setStoredJSON` helpers for reads/writes.
