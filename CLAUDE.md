# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Working With Jozsua

- The repo owner is **Jozsua** (Jozsua Van Ree, vanreejoz33@gmail.com — also the app's owner/admin email). Address him as **"Jozsua"** in responses.
- **Never `git push` or `firebase deploy` without asking first**, unless he already said "push"/"deploy"/"ship it" in the active request. Committing locally is fine; publishing is the gated step.
- **Pre-push checklist** — when a push is requested or imminent, scan what changed this session and handle these before pushing:
  1. **Version bump?** If any JS/HTML/CSS changed, bump `CHANGELOG_LATEST_VERSION` in `assets/changelog.js`, add a changelog entry (updates/fixes from the session), and bump `scriptVersion` in `index.html`.
  2. **Firestore deploy?** If `firestore.rules` or `firestore.indexes.json` changed, they must be deployed — editing the files alone does nothing. Ask before deploying.
  3. Then commit, and ask before `git push`.

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
| `assets/modules/spells.js` | Spell list, spell slots (with drag-reorder), custom resources, favorites, prepared spells table, spell search, sync panels. Loads spell reference data async from `assets/data/spells.json` via `loadSpellDatabase()` at boot, then enriches from Open5e API in background | ~1440 |
| `assets/modules/dm.js` | DM Portal — password-gated entry, 24h session, portal enter/exit, tab switching, monster browser (Open5e API), encounter builder (themes/shapes/difficulty math, players, drag-reorder, click-to-open creature cards), NPC generator, loot tables, players/pending approval, in-app dialogs (`dmModal`/`dmToast`), `friendlyFirebaseError`. DM data in localStorage `dndDmEncounters`/`dndDmNpcs` | ~2750 |
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

#### Firebase CLI (rules/index deploys)
The Firebase CLI (`firebase-tools`) is installed globally and logged in as the owner account. The repo is linked to the `dndcharproject` project via `.firebaserc`, and `firebase.json` points at `firestore.rules`. This means security rules and indexes are deployed from the command line, **not** by pasting into the Firebase Console.

- **Rules live in `firestore.rules`** at the repo root — this is the source of truth. Edit it, then deploy.
- Deploy rules: `firebase deploy --only firestore:rules` (compiles + checks for errors before publishing).
- Deploy indexes: `firebase deploy --only firestore:indexes`.
- Editing `firestore.rules` in the repo does **nothing** until it's deployed — the live rules are on Google's servers.
- `firebase login` requires the owner's browser/Google auth and can't be automated; the token persists on the machine once done.
- `.gitignore` excludes service-account keys (`*serviceAccount*.json` etc.) and firebase debug logs — never commit those.
- **Deploying is an outward-facing publish step — ask before running `firebase deploy` unless already authorized in the request** (same rule as `git push`).

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
Every spell object is normalised through `normalizeSpellRecord()` on load — all fields are guaranteed to exist as strings/booleans even if missing from saved data. Fields: `name`, `level`, `school`, `castingTime`, `range`, `components`, `duration`, `damage`, `save`, `attack`, `ritual`, `concentration`, `prepared`, `classes`, `sourceBook`, `description`, `wikiLink`, `open5eSlug`.

### Spell database
`assets/data/spells.json` — 1122 unique spells from all Open5e sources (SRD 5.1, Deep Magic, A5e, Tome of Heroes, Deep Magic Extra, Warlock, Kobold Press, Open5e originals). Zero duplicates. All `wikiLink` fields point to `open5e.com/spells/{slug}`. Rebuild with `node tools/build-spells.js && node tools/patch-spell-effects.js`.

`loadSpellDatabase()` in `spells.js`:
1. Loads `spells.json` immediately (fast, works offline)
2. Calls `enrichSpellDatabaseFromOpen5e()` in the background — fetches SRD spells from Open5e API, upgrades descriptions and class lists, adds any new spells not in the local file
3. Upgrades any wikidot.com links in the local file to open5e.com on load

**Never use wikidot.com links anywhere.** All spell links must point to `open5e.com`. The helper `open5eSpellLink(nameOrSlug)` in `spells.js` generates the correct URL. `loadData()` in `core.js` migrates any wikidot links still saved in a user's localStorage spell objects to Open5e on first character load.

### Spell slot drag-reorder
`updateSpellSlots()` renders each slot row with a `⠿` drag handle. HTML5 drag-and-drop reorders `manualSpellSlots` array in place and calls `autosave()`. The order in the array is what gets saved — no extra field needed.

### Prepared spells table
`renderPreparedSpells()` renders a `<table class="prepared-spells-table">` with 5 columns (Name, Cast Time, Range, Effect, View button) and `colspan="5"` on group header rows. The Lvl column was removed — level is already shown in the group header row (e.g. "3rd Level"). Uses `table-layout: fixed` with explicit `<col>` widths. Effect column uses `white-space: normal` to wrap — do not change to `nowrap`. On portrait mobile, Cast Time and Range hide to leave room for Name and Effect.

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
- **`.section:hover` and `.home-card:hover` do NOT use `transform: translateY`** — the lift was removed because it caused jitter whenever any input inside the section was hovered (inputs have their own hover transform). The hover state only adjusts `box-shadow` now. Do not re-add `translateY` to these selectors.
- **`input:hover` has a `translateY(-1px)` lift** — suppressed for `.skill-row input` and `input[readonly]` via an override rule. If you add new read-only or dense-layout inputs that shouldn't lift, add them to that override group.
- **Never use `transition: all` in styles.css** — it causes all elements to animate colour/border/background at different stagger offsets when the accent colour changes, making the UI look broken. Always use explicit per-property transitions: `background-color 0.2s ease, border-color 0.2s ease, color 0.2s ease, box-shadow 0.2s ease, transform 0.3s ...`
- **CSS `url()` inside custom properties doesn't work** — browsers store the string literally and never resolve relative paths. The background image system uses an injected `<style>` tag instead of `--bg-image` on `body::before`. Don't revert this to a CSS variable approach.
- **`html.has-bg-image` not `body.has-bg-image`** — the class must go on `<html>` because the early-boot script in `<head>` runs before `<body>` exists. `document.body` is `null` at that point.
- **Roboto is loaded from Google Fonts** — `index.html` includes a `<link>` to `fonts.googleapis.com`. All other font options are system fonts and work offline. If Roboto is selected and the user is offline, the browser falls back to the system sans-serif gracefully.

## Section Help System

Every `.section` and `.home-card` has a `?` button (`.section-help-btn`) positioned `absolute` at `top:10px; right:10px`. Clicking it opens a `.section-help-panel` overlay that covers the entire section box. The panel uses `position: absolute; top/left/right/bottom: 0` so it floats over the content without pushing it down.

- `toggleHelp(btn)` — defined in `app.js`. Closes any other open panel, then opens the one after `btn`. Both live in `app.js`.
- `closeHelp(panel)` — defined in `app.js`. Called by `onclick="closeHelp(this)"` on every panel for tap-to-close.
- Outside-click listener in `app.js` closes any open panel when clicking elsewhere.
- `.section` and `.home-card` both have `position: relative` so the absolute button and panel are scoped inside them.
- Panel background is `rgba(14, 12, 10, 0.96)` — near-opaque dark, readable over any background image.
- **Adding a help panel to a new section:** add `<button class="section-help-btn" onclick="toggleHelp(this)" title="How this section works">?</button>` as the first child of the `.section`, immediately followed by `<div class="section-help-panel" onclick="closeHelp(this)">...</div>`.
- Help panels exist on all sections of: `pages/stats.html`, `pages/spells.html`, `pages/inventory.html`, `pages/background.html`, `pages/notes.html`, `pages/settings.html`.

## Skills Auto-Math System

Skill rows (`pages/stats.html`) have three interactive elements per row:
1. **Checkbox** (`prof_<skill>`) — proficiency toggle
2. **Total input** (`bonus_<skill>`) — read-only, auto-calculated by `calculateSkillBonus()`. Display order: **left**.
3. **Adj input** (`adj_<skill>`) — manual adjustment (item bonuses, expertise, etc.). Display order: **right**. Created dynamically by `setupSkillCalculationFields()` via `row.appendChild(adjInput)`.

The adj input is inserted by JS, not present in the HTML. It is saved as `page1.skills.adj_<skill>` and loaded back in `loadData()`. If you change the insertion method, verify the load path still finds `#adj_<skill>` correctly.

Ability bonus fields (`str_bonus` etc.) and `prof_bonus` are **read-only** — auto-calculated from scores and level. The `bindAutoMathOverrideInputs()` function still exists but its overrides are intentionally not used (ability score overrides were removed as a design decision — use skill adj inputs instead).

Persisted override flags in `page1.combatStats`: `initiativeOverride`, `passivePerceptionOverride`, `profBonusOverride`, `abilityBonusOverrides` — these survive refresh. The `profBonusOverride` and `abilityBonusOverrides` fields are new (added 2026-06-16); old saves that don't have them default to `false` (all auto), which is correct.

## Rest → Resource Reset

`longRest()` in `health.js` calls `resetSpellSlots('long')` and `resetCustomResources('long')` before `autosave()`. `shortRest()` calls `resetSpellSlots('short')` and `resetCustomResources('short')`. Both use guard checks (`typeof fn === 'function'`) so they degrade gracefully if spells.js isn't loaded. The non-`'all'` code paths in `resetSpellSlots` and `resetCustomResources` never show a confirm dialog — they reset silently based on each slot's `resetType` field.

## Storage Container ID Convention

Container item list elements are created with `id="${storage.id}_items"` (in `loadStorageContainers()`). `displayStorageItems(storageId)` looks up `${storageId}_items`. Weight displays use `${storage.id}_weight`. Do not add a `storage_` prefix — that was a prior bug that has been fixed.

## Known Vestigial Code

- `saveActions()` / `loadActions()` in `actions.js` — write to `dndActions` localStorage key. This is a legacy path; the real save/load goes through `core.js` `page1.actionsData`. The `dndActions` key is harmless but redundant. Do not remove `saveActions()` calls from `actions.js` without also removing the `loadActions()` call in `initializeActions()` — they must stay in sync or actions appear to load from stale data.
- `dndInventory` localStorage key — similarly legacy. Real inventory data is in `page1.inventoryData` inside the character blob.

## DM Portal

A fully separate portal layer that overlays the player UI. Activated from the home page DM card. All DM logic lives in `assets/modules/dm.js`. DM HTML pages are in `pages/dm-*.html`. The DM chrome (banner + tabs) is in `partials/dm-chrome.html`.

### Architecture
- **Two DOM roots:** `#dm-chrome-root` and `#dm-pages-root` sit alongside the player roots in `index.html`. Both are `display:none` until `enterDmPortal()` shows them and hides `#chrome-root`, `#pages`, and `#popups-root`.
- **Exit:** `exitDmPortal()` reverses this — restores `display:''` on player roots, hides DM roots. Session persists so re-entry within 24h is instant.
- **Tab switching:** `switchDmTab(btn)` / `switchDmTabById(id)` — sets `.dm-tab.active` and shows the matching `.dm-page`. Switching to `dm-players` auto-calls `dmLoadPlayers()`.

### Friendly error messages
`friendlyFirebaseError(e)` (in `dm.js`, on `window`) turns raw Firestore/network errors into plain-English strings (index-building, permission-denied, offline, unauthenticated, plus a generic fallback). Used across DM + Admin data-loading paths so portals never show raw error codes. `admin.js` has a thin `adminFriendlyError(e)` wrapper that delegates to it if loaded (dm.js loads before admin.js). When adding new Firestore reads/writes in the portals, surface failures through these, not `e.message`.

### Session (localStorage)
Key: `dndDmSession`. Shape: `{ uid, email, campaignId, campaignName, campaignSetting, enteredAt }`. TTL: 24 hours. Functions: `dmSessionLoad()`, `dmSessionSave(data)`, `dmSessionClear()`, `dmSessionValid()`. **Note:** `campaignId` was added because join-request paths key off the campaign **id** while the roster query keys off campaign **name** — `dmCurrentCampaignId()` reads it. Old sessions without `campaignId` need a re-enter to populate it.

### DM access model (current — password gated)
Access is gated by the **campaign DM control password** (`campaigns/{id}.dmPasswordHash`), NOT an email-approval/request flow.
1. Home card (`#dmPortalCard`, `renderDmCard()`): signed-out → sign-in prompt; signed-in → campaign dropdown + DM password field (`dmEnterWithPassword()`); valid 24h session → "Enter DM Screen" button.
2. `dmEnterWithPassword()` verifies the entered password's SHA-256 against `dmPasswordHash`, saves the session, calls `enterDmPortal()`.
3. `enterDmPortal()` just needs a valid session (no approval check) → shows DM UI, populates banner/dashboard, loads live player count.
4. `renderDmCard()` is called from `showHomePage()` and `updateAuthUI()` in `cloud-skills.js`.

**Removed (2026-06-25 revamp):** the old `dm_requests` flow — `submitDmRequest`, `dmRequestFormHtml`, `getDmRequestStatus`, `isDmApproved`, `DM_APPROVED_EMAILS`, the notification cooldown helpers, and `#dmPendingBanner`. The `dm_requests` Firestore collection + its rule are now unused (left in `firestore.rules` harmlessly; can be removed later).

### DM theming + in-app dialogs (2026-06-25 revamp)
- **The DM portal is now fully accent-themed** — it uses the same `--accent*` / `--panel-bg` / `--card-bg` variables as the character sheet, the same `.tabs` pill style, `.section`-style cards, button language, transitions, and breakpoints. Do NOT reintroduce hardcoded colours in DM CSS. The ONLY deliberate exception is the sticky DM SCREEN banner + Exit button, which keep a warm danger tint via `--dm-danger` (200,70,70) as a "you're in DM mode" cue.
- **`--accent-rgb`** (R,G,B triplet, no `rgba()`) is now set by `setAccentDerivedColors()` (core.js) and the early-boot script (index.html), with a `:root` default. Use `rgba(var(--accent-rgb), <alpha>)` for accent-tinted fills. (Previously referenced in CSS but never set — was silently falling back.)
- **In-app dialogs:** `dmModal(opts)` (promise-based; `{title, message, input, inputType, placeholder, value, confirmText, cancelText, danger}` → resolves the input string / `true` / `null` on cancel) and `dmToast(msg, type)` replace ALL native `prompt/alert/confirm` in the DM side. Themed to the player popup language (`.dm-modal*`, `.dm-toast*`). Use these, not native dialogs, for any new DM interaction.

### DM Pages
Tab order (in `partials/dm-chrome.html`): Home · Lore · Players · Player Spells & Actions · Monsters · Items · Encounters · NPCs · Notes · Settings.

| Page | File | Status | Key IDs |
|---|---|---|---|
| Home | `pages/dm-home.html` | Working | `#dmHomeGreeting`, `#dmHomeCampaignName`, `#dmHomeCampaignSetting` |
| Lore | `pages/dm-lore.html` | **Placeholder** (Coming Soon shell) | — |
| Players | `pages/dm-players.html` | Working | `#dmPlayersList`, `#dmPlayerSheetPanel`, `#dmPlayerSheetBody` (roster reads `campaigns/{id}/members` keyed by charId) |
| Player Spells & Actions | `pages/dm-spells.html` | **Placeholder** (Coming Soon shell) | — |
| Monsters | `pages/dm-monsters.html` | Working | `#dmMonsterSearch`, `#dmMonsterCrFilter`, `#dmMonstersList`, `#dmMonsterDetail` |
| Items | `pages/dm-items.html` | Working | `#dmItemSearch`, `#dmItemRarityFilter`, `#dmItemsList`, `#dmItemDetail` |
| Encounters | `pages/dm-encounters.html` | Working | `#dmCombatantList`, `#dmEncounterName`, `#dmSavedEncounterList`, `#dmGenTheme`/`#dmGenShape`/`#dmGenDifficulty`/`#dmGenCount`, `#dmDifficultyMeter`, `#dmPlayerName`/`#dmPlayerInit` |
| NPCs | `pages/dm-npcs.html` | Working | `#dmNpcName`, `#dmNpcLootResult`, `#dmNpcList` |
| Notes | `pages/dm-notes.html` | **Placeholder** (Coming Soon shell) | — |
| Settings | `pages/dm-settings.html` | Working | `#dmSettingsEmail`, `#dmSettingsCampaign`, `#dmSettingsSessionExpiry` |

**Adding a DM page is a 3-place sync** (all must match or the tab won't load/switch):
1. Create `pages/dm-<name>.html` with `<div class="dm-page" id="dm-<name>" style="display:none;">…</div>`.
2. `index.html` — add it to the `loadText()` array, the destructured variable list, **and** the `dm-pages-root` inject array (order must line up across all three).
3. `partials/dm-chrome.html` — add a `<button class="dm-tab" data-dm-tab="dm-<name>" onclick="switchDmTab(this)">Label</button>`.

`switchDmTab()` is generic — it shows/hides any `.dm-page` by the button's `data-dm-tab` id, so no JS change is needed for a new page unless it has on-open load logic (like Players' `dmLoadPlayers()`). Placeholder pages use the `.dm-coming-soon-list` style.

### DM Data (localStorage)
- `dndDmSession` — active DM session object
- `dndDmEncounters` — saved encounter array `[{ id, name, combatants: [...] }]`
- `dndDmNpcs` — saved NPC array `[{ id, name, race, role, alignment, notes, loot }]`
- DM notification cooldown per email: `dndDmNotifySent_{email_slug}`

### Monsters (Open5e API)
`dmLoadMonsters()` paginates `https://api.open5e.com/v1/monsters/?limit=100&document__slug=wotc-srd`. Results cached in `dmAllMonsters`. `dmFilterMonsters()` filters client-side by name/type and CR. `dmShowMonster(slug)` renders a full stat block with Add to Encounter button.

- **`dmRenderStatBlockHtml(m)`** — the single shared stat-block renderer (meta, AC/HP/speed, six abilities, senses/languages, CR, **Traits / Actions / Reactions / Legendary Actions**). Used by the Monsters tab detail panel AND the click-to-open creature card everywhere else. Pure HTML, no side effects. The title is a hyperlink to `open5e.com/monsters/{slug}` via `dmMonsterLink(m)` (falls back to an Open5e search by name if no slug). **Never hardcode a stat block elsewhere — call this.**
- **`dmOpenCreature(source)`** — reusable scrollable modal showing one creature's full stat block. `source` is either a full stat-block object or a `{ name, slug }` stub (it fetches the block by slug, cache-first). `dmOpenCombatantCreature(id)` opens a live combatant's creature (skips players); `dmOpenSavedCreature(slug, name)` opens one from a saved encounter (re-fetches by slug since saved encounters strip the block). Works from the builder, the initiative order, and saved encounters.

### Encounters
`dmCombatants` — in-memory array. Each combatant now carries: `{ id, name, maxHp, hp, ac, initiative, isMonster, xp }` plus, for generated/added monsters: `slug`, `dex` (real Dex score → initiative), `statBlock` (full Open5e record, for click-to-open), and shape tags `wave` / `role` ('front'|'back'). Player rows carry `isPlayer:true` (unrated, optional HP/AC). Saved to localStorage `dndDmEncounters` via `dmSaveEncounter()`; **`statBlock` is stripped on save** (bulky) and **re-hydrated from `dmAllMonsters` by slug on `dmLoadEncounter(id)`**. All new fields are optional — old saved encounters load fine (missing fields degrade gracefully; a monster with no slug just isn't click-to-open).

- **Adding creatures:** `dmAddMonsterToEncounter(slug)` resolves the full monster (cache→API), stores dex + statBlock, rolls initiative (d20 + real Dex mod). `dmAddCombatant()` = manual unrated combatant. `dmAddPlayer()` = player row (name + total initiative, optional HP/AC).
- **Per-creature overrides:** every row has always-editable Init / AC / HP(cur/max) inputs (`dmSetInit/dmSetAc/dmSetHp/dmSetMaxHp`); ± buttons still damage/heal. Click a monster's name to inline-expand its stat card.
- **Order + drag:** `dmOrderMode` ('init' sorts the list highest-first as turn order and numbers rows; 'manual' keeps array order). `dmSetOrderMode()` toggles. Whole row is draggable (`dmCombatantDrag*`); a guard in `dmCombatantDragStart` skips drags starting on inputs/buttons/links so fields stay editable. Dragging switches to manual mode.
- **Damage/heal:** via `dmModal` (not native `prompt`).

#### Encounter difficulty math (READ BEFORE TOUCHING)
Rating is on **RAW summed monster XP** vs the party's DMG thresholds — **there is no encounter count-multiplier in the rating** (`dmRateEncounter` returns `mult:1`). The count-multiplier used to inflate adjusted XP and make the live meter disagree with the picker (adding weak monsters tipped Medium→Deadly). Do not reintroduce it into rating.
- `dmPartyThresholds()` sums each PC's `[easy,medium,hard,deadly]` XP (DMG p.82, `DM_XP_THRESHOLDS`) across `dmParty`.
- `dmTierTargetXp(tier, th)` = the FLOOR of a tier's band. Base 5e (brutal = deadly×1.5, mythic = deadly×2.5) **× `DM_ENCOUNTER_XP_MULT` (house-rule 1.5×)** applied to every tier. This one function is the single source the build budget, the rating bands, AND the meter readouts all derive from — so the 1.5× scales the whole system together and the label stays honest (pick Medium → beefier fight that still reads Medium). To change the aggression, edit only the constant. `dmTierCeilingXp(tier)` = next tier's floor. A tier's band is `[floor, ceiling)`.
- `dmRateEncounter(xps)` sums raw XP (no count-multiplier — see above), labels by highest band cleared. `dmUpdateDifficultyMeter()` paints the live meter from `dmCombatants`.
- **Generator (`dmGenerateEncounter`) guarantees pick = display:** aims for mid-band, then (1) a **floor guarantee** upgrades the weakest picks to stronger monsters until sum ≥ floor (covers all shapes, incl. the part-built tactical ones), then (2) a **ceiling clamp** drops the smallest (free count) or downgrades the strongest in place (forced count) until sum < ceiling. **No-count generation** picks a sensible creature count from the shape (balanced ≈ party size, swarm ≈ 2×, elite ≈ 0.6×) and sizes each creature to `budget/count` — it does NOT greedily stack to a cap. If the theme pool is too weak to reach the tier, it lands as high as it can and shows an honest "best fit… can't reach X" status note instead of silently under-rating.

#### Themes, shapes (battle types), intros & tips
- **`DM_ENCOUNTER_THEMES`** — 18 themes (humanoid foes, monsters by type, and combos like `casterWarband`/`huntPack`/`bossMinions`). Each filters the pool by creature `type` and/or name keywords. `dmMonstersForTheme(themeKey)`.
- **`DM_ENCOUNTER_SHAPES`** — 11 shapes. Classic (balanced/swarm/elite/bossMinions/solo) + tactical battle types (ambush/gauntlet/vanguard/twinThreat/siege/duel). Some have real builder logic in `dmBuildShapedEncounter`: solo/duel = 1 creature; twinThreat = 2 leaders; vanguard = front(strong)+back(weak) via `dmFillToBudget`; gauntlet = 2–3 waves via `dmFillToBudget`. `dmFillToBudget(sorted, budget, bias)` fills a sub-budget ('strong'|'weak'|'mixed').
- **Flavor is keyed to theme + shape:** `DM_ENCOUNTER_INTROS[theme]` (read-aloud openers) layered with `DM_SHAPE_INTROS[shape]`; `DM_ENCOUNTER_TIPS[shape]` (multi-bullet "how to run it" tactics). **These four maps + the two `<select>`s in `pages/dm-encounters.html` must stay in sync** — every dropdown value needs a theme/shape map entry and matching flavor (a missing theme intro falls back to `random`; a missing shape tip falls back to `balanced`).

**Nothing in the encounter system touches character data** — it only reads/writes `dndDmEncounters` and in-memory `dmCombatants`, never `dndCharacters`/`autosave`/cloud sync.

### NPC Generator
Name pools in `DM_NPC_NAMES` (male/female/surname). Traits in `DM_NPC_TRAITS`. Secrets in `DM_NPC_SECRETS`. Loot in `dmRollLoot()` — three tiers: scraps (35%), low-level gear (35%), gold+gem (30%).

### Players Tab
`dmLoadPlayers()` queries Firestore `collectionGroup('characters')` filtered by `data.characterInfo.campaignId == session.campaignName`. Requires the collectionGroup Firestore rule (owner read). `dmViewPlayerCharacter(uid, charId)` fetches the full doc and renders a read-only stat block panel.

---

## Campaign System

Campaigns are created and managed by the owner (vanreejoz33@gmail.com) via the Admin Portal. Players link their character to a campaign via the Campaign field in Stats → Character Info. DMs gain portal access by being assigned to a campaign.

### Firestore Structure
```
campaigns/{campaignId}
  id: string               — e.g. 'camp_neuertham'
  name: string             — display name, must match player's campaignId field exactly
  setting: string          — e.g. 'Homebrew', 'Forgotten Realms'
  dmEmails: string[]       — emails of assigned DMs (case-insensitive match)
  passwordHash: string     — SHA-256 of DM portal password (set at creation)
  active: boolean          — inactive campaigns hidden from player dropdown
  createdAt: timestamp
```

### Player Side
- `characterInfo.campaignId` — free-text field (will become dropdown in future). Saved via `autosave()`, included in Firestore sync automatically.
- Field ID: `#char_campaign` in `pages/stats.html`, bottom row of Character Info grid spanning full width.
- Cleared in `clearAllFormFields()`, loaded in `loadData()`.
- **Case-sensitive** — must match campaign `name` exactly for the DM's Players tab to find the character.

### Admin Portal — Campaign Manager
In `assets/modules/admin.js`. Loads automatically when admin portal unlocks alongside user list.
- `adminCreateCampaign()` — creates `campaigns/{camp_timestamp}` doc with hashed password
- `adminLoadCampaigns()` — fetches all campaigns ordered by `createdAt desc`, renders list
- `adminEditCampaignDm(campaignId)` — `prompt()` to update `dmEmails` array
- `adminToggleCampaign(campaignId, active)` — flip active flag
- Password is SHA-256 hashed via `sha256Hex()` (same function used for admin PIN)

### DM Portal Auth (resolved 2026-06-25)
DM entry is gated by the per-campaign **DM control password** (`campaigns/{id}.dmPasswordHash`), verified in `dmEnterWithPassword()`. The old `DM_APPROVED_EMAILS` / `isDmApproved()` / `dm_requests` approval flow has been removed. `dmEmails` on a campaign is still used by the Firestore rules' `isCampaignDm()` to let an assigned DM read/update join requests.

### Firestore Rules Required
The full ruleset now lives in `firestore.rules` at the repo root (deployed via `firebase deploy --only firestore:rules`, or pasted into Firebase Console → Firestore → Rules). `firebase.json` points at it. Key rules: collectionGroup `characters` read for owner+signed-in (DM Players tab), `campaigns` read for signed-in / write for owner, and the `joinRequests` subcollection rules below.

### Campaign Join Approval (v1.04+)

Joining a campaign is a **two-gate** flow: password first, then DM approval. The hard constraint driving the design: **only a player can write their own character doc** — a DM cannot flip another player's `campaignId`. So approval is brokered through a request subcollection that each side writes to within its own permissions.

```
campaigns/{id}/joinRequests/{uid}
  uid, charId, charName, campaignId, campaignName
  status: 'pending' | 'approved' | 'denied'
  requestedAt
```

Flow:
1. **Player** enters join password (`verifyCampaignPassword` in `core.js`) → on success **creates** `joinRequests/{their uid}` with `status:'pending'`, locks the campaign picker (`setCampaignFieldLocked`), and starts `startJoinRequestListener()` (onSnapshot on their own request doc). Their `characterInfo.campaignId` stays blank.
2. **DM** (`dmLoadPendingPlayers` in `dm.js`) or **owner** (`adminViewCampaignPlayers` in `admin.js`) sees pending requests → Approve sets `status:'approved'`, Deny sets `status:'denied'`.
3. **Player's listener** fires: `approved` → `applyApprovedCampaign(name)` sets `campaignId` + autosaves (this is what makes them appear on the roster, since the roster query filters on `data.characterInfo.campaignId == campaignName`); `denied` or **doc deleted** → clears `campaignId` back to blank.
4. **Remove** (DM `dmRemovePlayer` / admin `adminRemovePlayer`) = **delete** the request doc. The player's listener sees `!snap.exists` → clears their campaign. Offline players are reconciled on next load: `restoreCampaignField` re-attaches the listener for an already-joined character, so a deleted request clears them immediately on reconnect.

Key globals: `_joinRequestUnsub` (listener handle), `_campaignCache` (holds `{id, name, passwordHash, dmPasswordHash}`), DM session now carries `campaignId` (needed because join-request paths key off campaign **id**, while the roster query keys off campaign **name**). `dmCurrentCampaignId()` reads it.

joinRequests rules (in `firestore.rules`):
```
match /joinRequests/{uid} {
  allow create, delete: if isSignedIn() && request.auth.uid == uid;   // player owns their request
  allow read: if (request.auth.uid == uid) || isOwnerAdmin() || isCampaignDm(campaignId);
  allow update: if isOwnerAdmin() || isCampaignDm(campaignId);        // approve / deny
}
```
`isCampaignDm()` checks the signed-in email against the campaign's `dmEmails` array.

**Gotcha:** approving an *offline* player only flips the request to `approved`; their `campaignId` (and thus roster appearance) updates when they next reconnect and their listener runs. This is inherent to the "player owns their doc" model — do not try to write the player's character doc from the DM/admin side, it will be denied by rules.

---

## Admin Portal

Located in `pages/settings.html` (`#adminPortalCard`, hidden unless owner email). Unlocked via SHA-256 PIN stored in Firestore `admin_config/main.portalPinHash`. All logic in `assets/modules/admin.js`.

### Sections (in order, after unlock)
1. **Campaigns** — create/manage campaigns, assign DMs, activate/deactivate
2. **Users** — select any user, view their characters, Preview (read-only load) or Import (clone) any character

### Key functions
- `unlockAdminPortal()` — verifies PIN, shows `#adminUnlockedView`, loads campaigns + users
- `adminRefreshUsers()` — reads `userProfiles` + `auth_signins` collections, populates `#adminUserSelect`
- `adminSelectUser(uid)` — shows user meta + character list with Preview/Import buttons
- `adminPreviewCharacter(uid, charId)` — clones character into local state, disables all inputs, shows `#adminPreviewBanner`
- `exitAdminPreview()` — restores snapshot, re-enables inputs
- `adminCreateCampaign()` — creates campaign doc
- `adminLoadCampaigns()` — renders campaign list with Edit DM / Activate buttons
- `adminEditCampaignDm(campaignId)` — updates `dmEmails` via prompt
- `adminToggleCampaign(campaignId, active)` — flips active flag

---

## Working Efficiently

`assets/modules/core.js` (~3580 lines) is the largest file — never read it whole. Use `grep` to find the relevant function first, then read only that section. `assets/styles.css` is ~130KB — same rule. `assets/data/spells.json` (1122 spells, sourced from Open5e) is the canonical spell reference database — do not edit it directly, regenerate it with `node tools/build-spells.js && node tools/patch-spell-effects.js`.

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

## Roadmap / Planned Work (designed, not yet built)

These two efforts were designed and approved but not yet implemented (the `bulk-work.md` dev journal that held them was retired at v1.06 — content folded here). Build incrementally; each stage should be a commit + syntax-check + reversible.

### Track B — Access-control + data-ownership redesign
**Problem:** all character data lives under `userData/{uid}` (player-owned); DMs read across ownership via a collectionGroup query, which Firestore rules can't authorize per-campaign. So the current rule is over-permissive: **any signed-in user can read any character** (read-only, low–moderate risk — requires dev tools, no creds exposed, no write).

**Fix (principle):** data flows TO where authorized people already are. Players **publish** a copy of their sheet INTO their campaign; DMs/owner read within their own campaign (a scoped read rules CAN authorize). Target structure:
```
campaigns/{cid}/members/{uid}     — roster + join status (pending/approved)
campaigns/{cid}/sheets/{uid}      — player's CURRENT published sheet (on manual Save)
campaigns/{cid}/sheets/{uid}/versions/{ts}  — immutable history (manual Save only)
```
**Decisions:** versioning = **manual Save only** (Save writes current + an immutable timestamped version); DM **pulls** sheets with a button (not live); history append-only (`update,delete: if false`); owner can edit any campaign. Then tighten the collectionGroup characters read to owner-only.
**Stages:** (1) campaigns subcollection rules + deploy → (2) publish-on-Save → (3) DM "Pull latest sheets" + tighten read rule → (4) version history viewer → (5) campaign request→owner approval → (6) owner edit-anything in Admin.

### Track C — Full Open5e integration (everything + in-app source picker)
**Goal:** use all of Open5e (spells, monsters, magicitems, feats, races, classes, backgrounds, conditions, weapons, armor, sections, documents) with an in-app picker for which publishers/sources to include.

**★ SAFETY INVARIANT:** Open5e is REFERENCE DATA ONLY — the catalogue people pick FROM. It must NEVER write to / migrate / re-fetch a saved character. A character's spells/items are self-contained copies in `data.page3.spellsData` etc. The existing `enrichSpellDatabaseFromOpen5e()` already obeys this (mutates only the in-memory catalogue; falls back to local `spells.json` offline). Keep it: enrich the catalogue, never the saved character. Ignoring the new tools = zero change for any player.

**Architecture:** new `assets/modules/open5e.js` — one cached reference layer all tools draw from. Source picker = `dndOpen5eSources` localStorage pref (a UI pref, NOT character data). Cache in localStorage/IndexedDB (monsters are large → IndexedDB) for speed + offline.
**Stages:** (1) shared cached module (no UI change) → (2) migrate existing monster+spell fetches to it (identical behaviour) → (3) source picker UI → (4) monsters across all sources + cache → (5) add content types one at a time → (6) player spell catalogue honors picker (saved spells untouched).

### Restore points
- Local zip snapshots per release live OUTSIDE the repo in `C:\GitHubNeverDelete\Repos\JozzDNDSheet Backups\` (a sibling of the repo under `Repos\`, so it's never in the git tree), each with a README of what shipped.
- Git tag `pre-open5e-checkpoint` (commit 55e5cb3) marks the pre-Track-C state.

## End-of-Session Changelog Checklist

**IMPORTANT — always do this before the session ends or when the user mentions pushing, deploying, or finishing up.**

When the user says anything like "push", "deploy", "we're done", "wrap up", "commit", or "ship it" — stop and prompt them with the following checklist before they go:

> "Before you push, checklist:
> 1. Run `node tools/update-changelog.js` — it'll ask for version bump, title, and bullet points, then writes `changelog.js` automatically
> 2. Bump `scriptVersion` in `index.html` (I can do this for you — just say the word)
> 3. Commit `assets/changelog.js` and `index.html` alongside your other changes
>
> Want me to draft the changelog bullet points based on what we did this session?"

Also offer to draft the bullet points yourself — you know exactly what changed during the session, so give the user a ready-to-paste list of updates and fixes, grouped correctly, that they can confirm or edit before running the script.

The changelog file is `assets/changelog.js`. Version lives in `CHANGELOG_LATEST_VERSION`. New entries go at the top of the `CHANGELOG` array. The script at `tools/update-changelog.js` handles the write automatically.

### Versioning & backup logic (set 2026-06-26)
- The **repo folder name is just `JozzDNDSheet`** — NO version number in the folder (it never changes). The version number lives ONLY in the app (`CHANGELOG_LATEST_VERSION`).
- **The version ticks up on every What's New / changelog entry** — 1 changelog entry = 1 version bump = 1 backup.
- On each version bump, make a **local-only dated zip** at `C:\GitHubNeverDelete\Repos\JozzDNDSheet Backups\JozzDNDSheet_v<ver>_<YYYY-MM-DD>.zip` (sibling of the repo, never committed) with a README of what shipped. See "Roadmap / Restore points" above. **How to build it:** a protection hook blocks deletes/overwrites on `backup`-named paths, so build the zip in TEMP and `Move-Item` it into the Backups folder (don't `Compress-Archive -Force` directly onto the target).
- **`node tools/update-changelog.js` now does the backup automatically** — after writing the changelog it prompts `Create backup zip now? [Y/n]` (default yes) and builds the dated zip + README itself. The `bumpVersion` helper preserves the zero-padded `MAJOR.MINOR` scheme (`1.06 → 1.07`, not `1.6.x`); `patch`/`minor` both step the padded minor, `major` bumps the first and resets to `00`. Any non-padded version falls back to semver behaviour.

### Character data backup (owner-only)
- `tools/backup-all-chars.js` is a **browser-console** script (NOT run with node — same paste-into-console pattern as `seed-campaign.js`). Run it on the **live site while signed in as the owner**. It defines + auto-runs `backupAllChars()`.
- What it does: reads EVERY user's characters via `db.collectionGroup('characters')` (authorized by the owner read rule in `firestore.rules`), resolves uid → username via `userProfiles`, writes one JSON per character named `username_charname_level_date.json`, packs them into `AllChars_backup_<date>.zip` (JSZip loaded from CDN), and downloads it. You then move/extract the zip into `C:\GitHubNeverDelete\Backup Chars` (browsers can't write to `C:\` directly).
- **Track B dependency:** this relies on the currently over-permissive collectionGroup read. When Track B tightens that read to owner-only, keep `isOwnerAdmin()` in the path or this tool breaks for the owner too.

### Changelog system notes
- `CHANGELOG_LATEST_VERSION` in `changelog.js` is the single source of truth for the current version number
- The hero title in `pages/home.html` has a `<span id="heroVersion">` — populated by `initChangelog()` on page load, always stays in sync with the version constant
- Home page shows last 5 changelog entries by default — "view all" toggle appears only when there are 6+ entries
- `COMING_SOON` array in `changelog.js` must only be declared once — duplicate declarations cause a SyntaxError that crashes the entire page

### Home page grid layout
- `.home-grid` uses `repeat(3, 1fr)` at base — three equal columns on desktop
- Card order (CSS `order`, ~line 3591): `.character-manager-card` (1) → `.dm-portal-card` (2) → `.quick-start-card` (3) → `.suggestion-card` (4) → `.features-card` (5) → `.changelog-card` (6) → `.tips-card` (7)
- **Full-width set** (`grid-column: 1 / -1`, ~line 3577): `.character-manager-card`, `.dm-portal-card`, `.features-card`, `.changelog-card`, `.tips-card`. As of v1.05 the character manager and DM portal are both full-width so the DM portal sits as its own row directly under the char list.
- Only `.quick-start-card` + `.suggestion-card` remain in the 3-col flow (they pair on a row below the DM portal).
- At 1024px: drops to 2 columns, `.suggestion-card` goes `grid-column: 1 / -1` so it sits below the pair
- At 768px: single column, everything stacks in order
- Do not add `grid-template-columns` to `.home-grid` elsewhere — the cascade is intentional and breakpoints are set in three places only: base rule (~line 3509), 1024px media query (~line 3647), 768px media query (~line 4764)
