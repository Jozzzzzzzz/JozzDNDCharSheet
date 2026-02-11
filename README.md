# Joz Homebrew DND Sheet (Modular)

This folder contains the fully modularized build of your D&D sheet.

## Structure
- `index.html`: App shell + bootstrap loader.
- `assets/styles.css`: Shared styles.
- `assets/modules/core.js`: Core boot, UI, tabs, layout, stats/health/shared logic.
- `assets/modules/actions.js`: Actions & action favorites logic.
- `assets/modules/inventory.js`: Inventory/equipment/storage logic.
- `assets/modules/spells.js`: Spells/cantrips/filters/prepared/favorites logic.
- `assets/modules/cloud-skills.js`: Firebase sync + skills/ability/proficiency calculations.
- `assets/app.monolith.backup.js`: Backup of the original single-file app script.
- `pages/*.html`: Per-tab fragments (`home`, `stats`, `background`, `spells`, `inventory`, `notes`).
- `partials/chrome.html`: Header/top controls/tabs.
- `partials/popups.html`: Shared popup markup.
- `home.html`, `stats.html`, `background.html`, `spells.html`, `inventory.html`, `notes.html`: direct-entry route files that redirect to `index.html#<tab>`.

## Local Run
Use a local web server (not `file://`) because page fragments are loaded via `fetch`.

Examples:
- VS Code Live Server extension
- `python -m http.server 8080`
- `npx serve .`

Open: `http://localhost:8080/index.html`

## Notes
- Existing localStorage/Firebase behavior is preserved.
- Scripts are loaded in deterministic order from `index.html` before `initializeApp()` runs.
- Spells are isolated in `pages/spells.html` with corresponding module logic in `assets/modules/spells.js`.
