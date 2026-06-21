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
| `assets/modules/spells.js` | Spell list, spell slots (with drag-reorder), custom resources, favorites, prepared spells table, spell search, sync panels. Loads spell reference data async from `assets/data/spells.json` via `loadSpellDatabase()` at boot, then enriches from Open5e API in background | ~1440 |
| `assets/modules/dm.js` | DM Portal — access request flow, session management (24h localStorage session), portal enter/exit, tab switching, monster browser (Open5e API), encounter builder, NPC generator, loot tables. All DM data saved to localStorage under `dndDmEncounters` and `dndDmNpcs` | ~500 |
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

### Session (localStorage)
Key: `dndDmSession`. Shape: `{ uid, email, campaignName, campaignSetting, enteredAt }`. TTL: 24 hours. Functions: `dmSessionLoad()`, `dmSessionSave(data)`, `dmSessionClear()`, `dmSessionValid()`.

On `enterDmPortal()`:
1. If no valid session → verify approval (Firestore `campaigns` where `dmEmails` contains user email) → save session
2. Show DM UI, populate banner + dashboard from session
3. Show pending banner (`#dmPendingBanner`) if email not yet in any campaign's `dmEmails`

### DM Approval Flow
- **Old (deprecated):** `DM_APPROVED_EMAILS` hardcoded array in `dm.js` — still present as fallback but being phased out
- **New (active):** Firestore `campaigns/{id}.dmEmails` — you add a DM's email via Admin Portal → Campaigns → Edit DM
- `isDmApproved(email)` checks the hardcoded array (legacy). Replace with Firestore check once campaign auth is fully wired.
- `DM_NOTIFICATION_SUPPRESSED` and `DM_NOTIFY_COOLDOWN_MS` prevent spam notifications for owner/test accounts

### DM Request Flow (home page card)
1. Player-facing card on home page (`#dmPortalCard`) — visible to all
2. States: not signed in → sign in prompt | signed in + no request → request form | pending → waiting message + dimmed Enter button | approved → Enter DM Screen button
3. Submit writes to Firestore `dm_requests/{uid}` → sends Formspree notification to owner with exact approval instructions
4. `renderDmCard()` is called from `showHomePage()` and `updateAuthUI()` in `cloud-skills.js`

### DM Pages
| Page | File | Status | Key IDs |
|---|---|---|---|
| Home | `pages/dm-home.html` | Working | `#dmHomeGreeting`, `#dmHomeCampaignName`, `#dmHomeCampaignSetting` |
| Players | `pages/dm-players.html` | Working | `#dmPlayersList`, `#dmPlayerSheetPanel`, `#dmPlayerSheetBody` |
| Monsters | `pages/dm-monsters.html` | Working | `#dmMonsterSearch`, `#dmMonsterCrFilter`, `#dmMonstersList`, `#dmMonsterDetail` |
| Encounters | `pages/dm-encounters.html` | Working | `#dmCombatantList`, `#dmEncounterName`, `#dmSavedEncounterList` |
| NPCs | `pages/dm-npcs.html` | Working | `#dmNpcName`, `#dmNpcLootResult`, `#dmNpcList` |
| Settings | `pages/dm-settings.html` | Working | `#dmSettingsEmail`, `#dmSettingsCampaign`, `#dmSettingsSessionExpiry` |

### DM Data (localStorage)
- `dndDmSession` — active DM session object
- `dndDmEncounters` — saved encounter array `[{ id, name, combatants: [...] }]`
- `dndDmNpcs` — saved NPC array `[{ id, name, race, role, alignment, notes, loot }]`
- DM notification cooldown per email: `dndDmNotifySent_{email_slug}`

### Monsters (Open5e API)
`dmLoadMonsters()` paginates `https://api.open5e.com/v1/monsters/?limit=100&document__slug=wotc-srd`. Results cached in `dmAllMonsters`. `dmFilterMonsters()` filters client-side by name/type and CR. `dmShowMonster(slug)` renders a full stat block with Add to Encounter button.

### Encounters
`dmCombatants` — in-memory array of `{ id, name, maxHp, hp, ac, initiative }`. Saved to localStorage via `dmSaveEncounter()`. `dmLoadEncounter(id)` restores combatants to full HP. Damage/heal via `prompt()`.

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

### DM Portal Auth (transition in progress)
Currently: `DM_APPROVED_EMAILS` hardcoded array gates `enterDmPortal()`.
Target: check Firestore `campaigns` where `dmEmails` contains user's email — no code deploy needed to approve DMs.
**TODO:** Replace `isDmApproved()` with a Firestore `campaigns` query in `enterDmPortal()`.

### Firestore Rules Required
```
// CollectionGroup — owner reads all characters for Players tab
match /{path=**}/characters/{charId} {
  allow read: if isOwnerAdmin();
}
// Campaigns — signed-in users read (player dropdown), owner writes
match /campaigns/{campaignId} {
  allow read: if isSignedIn();
  allow write: if isOwnerAdmin();
}
```

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

### Changelog system notes
- `CHANGELOG_LATEST_VERSION` in `changelog.js` is the single source of truth for the current version number
- The hero title in `pages/home.html` has a `<span id="heroVersion">` — populated by `initChangelog()` on page load, always stays in sync with the version constant
- Home page shows last 5 changelog entries by default — "view all" toggle appears only when there are 6+ entries
- `COMING_SOON` array in `changelog.js` must only be declared once — duplicate declarations cause a SyntaxError that crashes the entire page

### Home page grid layout
- `.home-grid` uses `repeat(3, 1fr)` at base — three equal columns on desktop
- Row 1: `.character-manager-card` (order 1) + `.quick-start-card` (order 2) + `.suggestion-card` (order 3)
- Row 2+: `.features-card`, `.changelog-card`, `.tips-card` — all `grid-column: 1 / -1` (full width)
- At 1024px: drops to 2 columns, `.suggestion-card` goes `grid-column: 1 / -1` so it sits below the pair
- At 768px: single column, everything stacks in order
- Do not add `grid-template-columns` to `.home-grid` elsewhere — the cascade is intentional and breakpoints are set in three places only: base rule (~line 3509), 1024px media query (~line 3595), 768px media query (~line 4764)
