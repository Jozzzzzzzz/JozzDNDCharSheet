# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Working With Jozsua

- The repo owner is **Jozsua** (Jozsua Van Ree, vanreejoz33@gmail.com — also the app's owner/admin email). Address him as **"Jozsua"** in responses.
- **NEVER `git push` or `firebase deploy` without Jozsua explicitly saying so in the CURRENT message.** Committing locally is fine and encouraged; **publishing is always gated.**
  - **Push permission does NOT carry over.** A "push"/"deploy"/"ship it" authorises exactly one push, for the work in front of you at that moment. The next feature request is a fresh, un-authorised context — do NOT treat earlier approval (even earlier in the same session) as standing permission. When in doubt, commit and ask.
  - Requests like "do X", "add Y", "keep going", "do the same for Z" are **build-and-commit** requests, **not** push requests. Finish, commit locally, then say it's committed and ask whether to push.
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
| `assets/modules/browser-engine.js` | Shared list-browser engine: `fuzzyScore`/`levenshtein` (typo-tolerant search) + `createListBrowser(config)` (filter/sort/virtualized-scroll/live-count). Used by the item catalogue picker. Loads after core.js. | ~180 |
| `assets/modules/layout.js` | Flex-wrap sizing, section resize handles (`makeContainersResizable`, `applyFlexWrapSizing`), `setupAutoResize` | ~241 |
| `assets/modules/characters.js` | Currency system (CP/SP/GP + custom — saved under `page4.currency`), banner wealth messages, suggestion form, autosave scheduling (`scheduleAutosave`, `bindGlobalAutosaveListeners`), deleted-character tracking | ~379 |
| `assets/modules/health.js` | HP display, death saves, potion use, short/long rest | ~292 |
| `assets/modules/dice.js` | Fair crypto dice roller (`rollDie`, `rollExpr`), weapon to-hit/damage rolls (`rollWeaponToHit`, `rollWeaponDamage`), crit mode picker, roll log (`pushRollLog`, `clearRollLog`) | ~327 |
| `assets/modules/actions.js` | Combat actions/reactions tracking | ~270 |
| `assets/modules/inventory.js` | Inventory CRUD, equipment, storage containers, coin tracking, portrait upload/remove (`removePortrait`), settings dropdown | ~1180 |
| `assets/modules/spells.js` | Spell list, spell slots (with drag-reorder), custom resources, favorites, prepared spells table, spell search, sync panels. Loads spell reference data async from `assets/data/spells.json` via `loadSpellDatabase()` at boot, then enriches from Open5e API in background | ~1440 |
| `assets/modules/dialogs.js` | App-wide dialogs and errors: `dmModal` / `dmToast` (wrapped by `appToast`/`appAlert`/`appConfirm`/`appPrompt` in core.js) and `friendlyFirebaseError`. Moved here from the removed DM portal; the `dm*` names are kept. Loads right after core.js. | ~110 |
| `assets/modules/admin-data.js` | Admin page: overview, all sheets, backup/restore, tools (loads after admin.js) | ~330 |
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
- `dndSpellSources` — JSON array of enabled spell-import source keys (UI pref, NOT character data; defaults to official-only). See "Spell import source picker".

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
userData/{uid}                          — account appearance prefs (theme, accentColor, fontFamily, textScalePercent, bgImage, bgCustoms), lastModified
userData/{uid}/characters/{charId}      — one document per character (mirrors localStorage shape + server updatedAt)
userProfiles/{uid}                      — display name / nickname
auth_signins/{uid}                      — sign-in history and per-device presence
```

**Rules:** the `characters` subcollection requires an explicit `match /characters/{charId}` rule in Firestore security rules — without it subcollection writes are denied even if the parent `userData/{uid}` rule allows writes.

#### Portraits — compressed base64 (v1.16+)
Portraits stay in the character blob as a base64 data URL (`page2.portrait`), NOT Firebase Storage — Storage requires the Blaze billing plan, which the owner declined. Instead `handlePortraitUpload()` (inventory.js) **downscales + JPEG-compresses** the image via a `<canvas>` before saving: `compressPortraitDataUrl()` caps the longest side at `PORTRAIT_MAX_DIM` (512px) and re-encodes at `PORTRAIT_JPEG_QUALITY` (0.82), taking a multi-MB photo down to ~50–150 KB. This keeps the base64-in-sheet approach (syncs with the blob, works offline, no Firebase changes) but small enough to sync cheaply and stay under Firestore's 1 MB doc limit. Fallbacks: if compression fails (exotic format / tainted canvas) or would grow the file, the original data URL is kept — a portrait is never lost. Old base64 portraits load unchanged (save/load are src-agnostic).

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

#### Appearance settings sync (v1.16+)
Account-level UI prefs — **accent colour, theme, font, text scale, background image + custom backgrounds** — sync via the `userData/{uid}` meta doc (NOT character data). `gatherUserPrefs()` (cloud-skills.js) collects them from localStorage on every upload; `applyUserPrefs(meta)` writes them back to localStorage AND applies them live on download (calls `applyFontFamily`/`applyTextScalePercent`/`bgApply`/`bgRenderPicker`, and `loadThemeSettings()` for accent). Key points:
- **Applied live on pull, not just on reload** — the old code wrote theme/accent to localStorage but never repainted, so a pulled-down accent only showed after a manual refresh. `applyUserPrefs` fixes that.
- **Change-guarded** — only repaints when a value actually differs from local, so a device that just set a pref isn't fought by an older cloud value on boot.
- **Gotcha:** a large *custom uploaded* background is a base64 data URL in `bgCustoms`/`bgImage` — it rides in the meta doc and could approach Firestore's 1 MB doc limit. Preset backgrounds are tiny path strings. Low risk, but don't add more heavy blobs to the meta doc.
- Accent also re-renders the Notes folder/card grid (`updateAccentColor` → `renderNoteFolders`/`renderNoteCards`) since those bake some accent styling in at render time.

#### PWA / app icon
`manifest.webmanifest` (linked in `index.html` head) makes the app installable; registered SW gives offline. **Icon is `assets/icon.svg`** (a recreation of the red-D20 + flourish-ring artwork) — works on Android/desktop. **iOS home-screen needs a PNG**: `manifest` + `apple-touch-icon` already reference `assets/icon-192.png` / `assets/icon-512.png`, which don't exist yet — drop them in to use the real artwork (browsers fall back to the SVG cleanly until then). See `assets/ICON-README.txt`. If you add the PNGs, also add them to `PRECACHE_URLS` in `sw.js` and bump `scriptVersion`.

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

`sw.js` is a **cache-first service worker** (was a pass-through stub until v1.16). It's registered from `index.html`'s `bootstrapModularApp()` as `sw.js?v=<scriptVersion>` after boot.
- **Version lockstep:** the SW reads `?v=` from its own registration URL into `CACHE_NAME = jozzdnd-<version>`. Bumping `scriptVersion` in `index.html` creates a fresh cache; the old one is deleted on `activate`. So the `?v=` query-string cache-busting on scripts and the SW cache always agree — **bump `scriptVersion` whenever assets change or users get stale JS**.
- **Precache list** in `sw.js` (`PRECACHE_URLS`) mirrors `index.html`'s `loadText()` + `scriptOrder` lists — 38 files (shell, partials, all pages, all JS modules, styles.css, spells.json). **If you add a page/partial/module to index.html, add it here too**, or it won't be available offline.
- **Network-only** (never cached): all cross-origin requests + anything Firebase/googleapis/gstatic (`isNetworkOnly()`), so live data always hits the network. Only same-origin static GETs are cache-first. Cache key strips the `?v=` query (the cache name already scopes the version).

**Offline indicator + install button** (index.html, `initOfflineIndicator()` / `initInstallPrompt()`): `#offlineIndicator` (a fixed pill) toggles on `navigator.onLine` + online/offline events. `#installAppBtn` appears when the browser fires `beforeinstallprompt` (captured in `_deferredInstallPrompt`); `promptInstallApp()` triggers the native install; hides on `appinstalled`.

The `.sixth` directory appears to be a PWA/build artifact directory; don't modify it.

### Hit dice pool
`page1.health.hitDicePool = { max, used, max2, used2, maxTouched }` (in-memory `_hdPool` in `health.js`). Tracks hit dice remaining across short rests (5e). `max` auto-fills from `getTotalCharacterLevel()` via `syncHitDicePoolToLevel()` (called at end of `loadData()` and from `updateProficiencyBonus()`), unless the user edits Max (`maxTouched` locks auto-sync). `spendHitDie(delta, poolNum)` ± the pool; `shortRest()` deducts the dice it rolled; `longRest()` calls `recoverHitDiceOnLongRest()` (regain floor(max/2), min 1). **Second pool (`max2`/`used2`) only appears for multiclass when the two classes use different hit-die sizes** (`hit_die_size` vs `hit_die_size2` in the multiclass block) — same die size → one combined pool. UI in `pages/stats.html` (`#hd_pool`, `#hd_pool2`). Old saves: no `hitDicePool` → `max` null → auto-derives from level. Safe.

## Spells Page

### Spell data shape
Every spell object is normalised through `normalizeSpellRecord()` on load — all fields are guaranteed to exist as strings/booleans even if missing from saved data. Fields: `name`, `level`, `school`, `castingTime`, `range`, `components`, `duration`, `damage`, `save`, `attack`, `ritual`, `concentration`, `prepared`, `classes`, `sourceBook`, `description`, `wikiLink`, `open5eSlug`.

### Spell database
`assets/data/spells.json` — 1122 unique spells from all Open5e sources (SRD 5.1, Deep Magic, A5e, Tome of Heroes, Deep Magic Extra, Warlock, Kobold Press, Open5e originals). Zero duplicates. Rebuild with `node tools/build-spells.js && node tools/patch-spell-effects.js`.

`loadSpellDatabase()` in `spells.js`:
1. Loads `spells.json` immediately (fast, works offline)
2. Calls `enrichSpellDatabaseFromOpen5e()` in the background — fetches SRD spells from Open5e API, upgrades descriptions and class lists, adds any new spells not in the local file
3. Upgrades any wikidot.com links in the local file to open5e.com on load

**Never use wikidot.com links anywhere.** The helper `open5eSpellLink(nameOrSlug)` in `spells.js` generates an Open5e URL. `loadData()` in `core.js` migrates any wikidot links still saved in a user's localStorage spell objects to Open5e on first character load (it does NOT touch open5e.com or 5esrd.com links).

#### Spell reference links (Open5e source-prefixed keys → 5esrd fallback)
**Open5e URLs require a SOURCE-PREFIXED slug** — `open5e.com/spells/srd-2024_shatter` or `open5e.com/spells/srd_shatter`, NOT the bare `open5e.com/spells/shatter` (a bare slug now **302-redirects to a "choose your source" disambiguation page**, never landing on the spell). The prefix comes from the Open5e **v2 API `key`** field (`{document.key}_{slug}`, e.g. `srd-2024_`, `srd_`, `deepm_`, `deepmx_`, `toh_`, `wz_`, `kp_`, `a5e-ag_`). `wikiLink` in `spells.json` stores the full prefixed URL; `open5eKey` stores the bare key.
- **`tools/fix-spell-keys.js`** resolves every spell to its correct prefixed key: fetches all v2 keys (`api.open5e.com/v2/spells`), maps `open5eSlug` → best key by the spell's `sourceBook` (SRD prefers `srd-2024`, falls back to `srd`; see `SOURCE_PREF`), verifies each rewritten URL returns 200, writes `wikiLink`+`open5eKey`. **5esrd links are left untouched.** Re-run with `node tools/fix-spell-keys.js` (`--dry-run` to preview; cached in `tools/.spell-key-cache.json`, gitignored). Last run: 1051 rewritten to prefixed Open5e keys, 71 kept on 5esrd, 0 unresolved.
- **`open5eSpellLink(slugOrName)`** (spells.js) builds a link for a spell with no stored link. Order: an already-prefixed key (lower-cased) → the catalogue's stored `wikiLink` → a key in `OPEN5E_VERIFIED_SPELL_KEYS` (`srd-2024_<slug>`, checked against the Open5e API) → otherwise a **5esrd search link** (`spellSearchLink`). It never guesses an `srd-2024_` key, because Open5e only holds SRD spells and a guessed key for a PHB-only spell (Witch Bolt, Bigby's Hand, Armor of Agathys...) is a dead page.
- **`repairSpellLink(spell)`** (spells.js) is what `loadData()` (core.js) runs over every saved cantrip/spell: it fixes wikidot links, bare Open5e slugs, upper-case keys (`srd-2024_Hex`) and keys in `OPEN5E_DEAD_SPELL_KEYS` (verified 404 on 2026-10-24). Working links and 5esrd links are left alone. Checked on the real live data (340 saved spells, 2026-10-24): 296 end on a verified Open5e page, 44 on 5esrd, none dead.
- **Do not trust HTTP status for link checks.** open5e.com and 5esrd.com are client-rendered and answer `200` for pages that do not exist. Check Open5e keys with the API (`https://api.open5e.com/v2/spells/<key>/` → 404 if missing) and 5esrd pages by rendering them (a real page has an `h1` with the spell name; a missing one says "not found").

Some Open5e pages still 404 (all A5e `-a5e` slugs, plus a handful of SRD spells like Counterspell/Creation the API returns yet the website 404s). `tools/verify-spell-links.js` repairs those to a verified `5esrd.com/database/spell/{slug}/` page (200), else `5esrd.com/?s={name}` search, tagging `linkSource` (`open5e` | `5esrd` | `5esrd-search`).

- **`linkSource`/`open5eKey` are reference-DB-only** — NOT in `normalizeSpellRecord`'s whitelist, so they never enter saved character data (only `wikiLink` carries into imports).
- **CRITICAL — enrichment must not clobber good links.** `enrichSpellDatabaseFromOpen5e()` uses the **v1 API, which only returns BARE slugs**. It is guarded to skip any `existing.wikiLink` that already points at `5esrd.com` OR is a source-prefixed Open5e key (`/open5e\.com\/spells\/[^\/?#]*_/`). Without that guard it overwrites the fixed prefixed keys with bare ones on **every page load**, silently re-breaking all 1051 links. Keep both guards.
- The spell-details popup labels the link "View on 5esrd" vs "View on Open5e" based on the actual host (`showSpellDetails` in `spells.js`).

#### Spell import source picker
The Import Cantrips / Import Spells popup has a per-source toggle list (`SPELL_SOURCES` in `spells.js`) filtering the import pool by publisher. Default = **official only** (SRD 5.1 + locally-tagged PHB/TCE/SCAG). Saved as the global UI pref `dndSpellSources` (localStorage) — NOT character data. `getEnabledSpellSources()` is defensive: bad/legacy/empty values fall back to official (import is never empty). `spellSourceEnabled(spell)` gates the pool via `canonicalSpellSourceKey()` (maps Open5e slugs like `wotc-srd`/`a5e` to canonical keys); unknown sources are never hidden. The hardcoded `dndClasses` PHB lists only feed the pool when an official source is active (`officialSourcesActive()`). Source toggles use the shared `.switch`/`.slider round` component (not bare checkboxes).

## Inventory

### Item catalogue (searchable Add from catalogue, v1.17+)
`assets/data/items.json` (1,474 items: magic items + weapons + armor) is the item reference DB — the inventory equivalent of `spells.json`. **Regenerate, don't hand-edit:** `node tools/build-items.js` flattens the Open5e Django-fixture dumps in `assets/data/open5e/{magicitems,weapons,armor}.json` (it recovers each source's numeric `document` id → slug by matching per-source counts in `_manifest.json`). Each item: `{ name, kind (magic|weapon|armor), type, rarity, attunement, weight, value, source, desc, wikiLink }`.
- **Reference-only** (Track C safety invariant): the catalogue NEVER writes to a saved character. Picking an item just pre-fills the Add Item form with a self-contained copy (`pickCatalogueItem` → `showItemForm` + fills fields). Loaded async via `loadItemCatalogue()` in `initializeInventory()`; cached in the SW precache for offline.
- **Picker UI** (`itemCataloguePopup`, opened by `showItemCataloguePicker()` from the Add Item form's "Browse item catalogue" button): live search + kind/rarity filters + a per-source toggle list. `renderItemCatalogueResults()` filters (capped at 200 rows) and shows rarity badges + attunement flags.
- **Source picker:** `ITEM_SOURCES` in `inventory.js`, saved as the global UI pref `dndItemSources` (localStorage, NOT character data). Default = official only (`wotc-srd`). `getEnabledItemSources()` is defensive (bad/empty → official). Same pattern as `dndSpellSources`.

### Shared list-browser engine (v1.18+)
`assets/modules/browser-engine.js` powers the item catalogue picker — build new large-list browsers through it, don't hand-roll filtering.
- **`fuzzyScore(query, text)`** — typo-tolerant relevance score (prefix > substring > acronym > subsequence > bounded-Levenshtein word match), −1 = no match. `"firebal"→Fireball`, `"gobln"→Goblin` still hit.
- **`createListBrowser(config)`** — wires a search box + filter dropdowns/toggles + sort `<select>` + live count to a **virtualized** scroll list (only visible rows are in the DOM → smooth at ~2,800 rows). config: `{ data(), root, searchInput, countEl, sortEl, searchFields(item), filters:[{el, match(item,value)}], sorts:{key:cmp}, rowHeight, rowClass, renderRow(item), onRowClick(item), emptyText }`. Returns `{ refresh, getFiltered }` — call `refresh()` after the data loads or a non-`<select>` filter (like the item source toggles) changes.
- **Virtualization contract:** `root` must be a `.lb-list` inside a scrolling `.lb-viewport` (fixed max-height, `overflow-y:auto`). The engine sizes a spacer to `count × rowHeight` and absolutely-positions visible rows by index. `.lb-list` CSS force-overrides any per-list `max-height`/`overflow` so there's no double scrollbar. When adding a browser, set an accurate `rowHeight`.
- Item picker: `initItemBrowser()`/`_itemBrowser` (inventory.js).

### Item gold values (v1.20+)
**Every item in `items.json` has a numeric `valueGp`** — assigned by `node tools/build-item-values.js`: real prices parsed first (`"400 gp"`→400), else rolled within DMG rarity bands (common 50–100 … legendary 50k–200k, artifact=priceless nominal 250k), consumables halved, name-seeded RNG so rebuilds are stable. Shown as a price badge in the item picker (`formatGp` in inventory.js) and fills the Add Item value on pick.

### Inventory drag-reorder (v1.17+)
Item cards (`createItemCard`) are `draggable`; whole-card HTML5 drag reorders items **within their own list** — main inventory or one storage container (`itemListFor(container)` resolves which array). Handlers `itemDragStart/Over/Drop/End`; a guard in `itemDragStart` skips drags starting on a button/select so those stay usable; cross-container drops are rejected (reorder only, not move — moving still uses the Move-to dropdown). Reorders the array in place → `saveInventory()` + `autosave()`. Relies on `item.id` (every saved item already has one), so old inventories work untouched.

### Spell slot drag-reorder
`updateSpellSlots()` renders each slot row with a `⠿` drag handle. HTML5 drag-and-drop reorders `manualSpellSlots` array in place and calls `autosave()`. The order in the array is what gets saved — no extra field needed.

### Prepared spells table
`renderPreparedSpells()` renders a `<table class="prepared-spells-table">` with 5 columns (Name, Cast Time, Range, Effect, View button) and `colspan="5"` on group header rows. The Lvl column was removed — level is already shown in the group header row (e.g. "3rd Level"). Uses `table-layout: fixed` with explicit `<col>` widths. Effect column uses `white-space: normal` to wrap — do not change to `nowrap`. On portrait mobile, Cast Time and Range hide to leave room for Name and Effect.

### Spell search
`filterSpells('cantrip')` reads `#cantrip_search` and `filterSpells('spell')` reads `#spell_search`. Both inputs use `oninput` so filtering is live. Search stacks with the existing dropdown filters.

### Concentration tracker
`window.concentrationData = { spellName, castAt } | null`, saved as `data.concentration` (alongside `data.conditions`, NOT under a page). Functions in `inventory.js`: `startConcentration`, `castWithConcentration` (confirms the swap when already concentrating on a different spell — 5e one-at-a-time rule), `clearConcentration`, `renderConcentration`. The banner (`#concentration_banner` in `pages/stats.html`) sits in the Conditions section and is hidden when not concentrating. `spellNeedsConcentration(spell)` handles boolean and legacy string forms. Old saves with no `data.concentration` load as `null` (not concentrating) — safe.

### Cast buttons — REMOVED (v1.20)
The one-tap **Cast** buttons on the prepared-spells table and Favourites cards were removed — they caused mobile layout drama (Cast/View overlap + clipping in the narrow actions cell) and the flow needs a rethink before re-adding. `castPreparedSpell`/`castCantripSpell` and the `.spell-cast-btn` CSS are gone; slots are spent manually via the +/− steppers in the Spell Slots panel. `castWithConcentration` (inventory.js) still exists and is used directly by the concentration tracker. `jsStr()` in `spells.js` (safe inline-onclick escaping) is retained for other buttons.

## Multiclass

Opt-in second class. A "+ Add multiclass" button under the Level field (`pages/stats.html`) calls `toggleMulticlass(on, save)` (`stats.js`) which shows/hides `#multiclass_block` (a second Class/Subclass/Level: `#char_class2`/`#char_subclass2`/`#char_level2`). Saved as `characterInfo.class2`/`subclass2`/`level2`. **Proficiency bonus uses total level** — `getTotalCharacterLevel()` (`stats.js`) sums `char_level` + `char_level2` and `calculateProficiencyBonus()` keys off it. Spell slots stay manual (no multiclass caster-table math). Old-data safe: no `class2` → block collapsed, prof bonus = single-class level. Load path null-checks each field and calls `toggleMulticlass(!!(class2||subclass2||level2), false)`; `clearAllFormFields()` clears all three + collapses. `char_level2` is in the unsigned-numeric maxlength-2 list in `enforceAutoMathNumericInputs`.

## App-wide dialogs

`appToast` / `appAlert` / `appConfirm` / `appPrompt` (all in `core.js`, on `window`) are thin wrappers over `dmToast`/`dmModal` (now in `dialogs.js`) that render into a floating root and work everywhere (mobile Safari / installed PWA), each with a native fallback if dialogs.js hasn't loaded. **Use these, never native `alert`/`confirm`/`prompt`** — natives break in PWA mode. `appPrompt(message, {title, placeholder, value, inputType, confirmText, cancelText})` resolves the entered string or `null` on cancel (matches native `prompt` cancel semantics, so blank-to-clear flows still work). The only remaining native calls in the codebase are the intentional fallback branches inside these four wrappers.

## Known Gotchas

- **`updateWeaponsPreview()` and `updateEquipmentPreviews()` must NOT call `autosave()`** — these are pure render functions called during `clearAllFormFields()` inside `loadData()`. Calling autosave there writes empty characterInfo to localStorage and destroys saved data. Callers that need to persist after rendering (e.g. `saveWeaponFromForm`, `removeEquipmentItem`) call `autosave()` explicitly after.
- **All pages are in the DOM simultaneously** — `index.html` loads all page HTML at boot and hides/shows via CSS `display`. So `document.getElementById('char_name')` always resolves even when the stats page is not visible.
- **`autosave()` uses `val(id) !== null` not `val(id)` to decide whether to save or preserve** — empty string `""` is a valid save (user cleared the field); `null` means the element isn't in the DOM (page not loaded yet). Don't change this to a falsy check.
- **Script version cache-busting** — `index.html` has a `scriptVersion` constant appended as `?v=` to all script URLs. Bump it whenever JS files change so browsers don't serve stale cached scripts.
- **Notes page is JS-rendered** — `pages/notes.html` contains only the shell markup (toolbar, grid containers, popups). All folder and card elements are built by `renderNoteFolders()` / `renderNoteCards()` in `core.js`. Do not add static note content to the HTML.
- **Notes `isDefault` must be preserved through save/load** — both folder and card objects carry `isDefault: boolean`. The autosave block and the load block both map this flag explicitly. If you add new fields to the notes data shape, update both the save block (`page6 = { noteFolders: ... }`) and the load block in `loadData()`.
- **Notes delete is multi-step** — uses `notesHandleDelete(id, btn, onConfirm)` with state tracked in `notesDeleteState`. Pattern: Delete → Sure? → Wait 3s… → Confirm. Do not replace with `confirm()` dialogs.
- **Notes Reorder and Delete are separate modes** (v1.16+). Four state flags: `notesReorderMode`/`notesDeleteMode` (folders) + `notesCardReorderMode`/`notesCardDeleteMode` (cards). Each has a toolbar toggle (`toggleNotesReorderMode`/`toggleNotesDeleteMode`/`toggleNotesCardReorderMode`/`toggleNotesCardDeleteMode`); turning one on turns its sibling off (mutually exclusive). `syncNotesModeButtons()` reflects all four on their buttons. Reorder mode shows arrows + drag handle (no delete); Delete mode shows the multi-step delete button (default/template items show a locked label instead). All four flags are reset in `openFolderView`, `notesGoBack`, `initNotesPage`, and `clearAllFormFields` — keep them in sync if you add another reset point.
- **Note card colour tags** (v1.16+) — `card.color` (key into `NOTE_TAG_COLORS`, default `'none'`). Picked in the editor via `renderNoteColorPicker`/`setNoteCardColor`; tagged cards get a coloured left bar (`.has-color-tag` + `--note-tag-color` inline var). Saved/loaded in the page6 card map (`color: c.color || 'none'`), backward-compatible.
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

**Saving throws can be typed over** (`handleSaveInput`/`handleSaveChange`, flag `autoMathOverrideState.saveBonus[ability]`, saved as `combatStats.saveBonusOverrides`); clearing the box and leaving it returns it to automatic. The same goes for initiative, passive Perception, spell save DC and spell attack (`resetAutoMathIfBlank`). Weapons read the modifier box (`abilityModFromSheet` in `dice.js`), so an overridden modifier carries into to-hit and damage. Healing (`adjustHP`, potions, via `healCap` in `health.js`) stops at max HP; temp HP is typed into the current HP box.

Persisted override flags in `page1.combatStats`: `initiativeOverride`, `passivePerceptionOverride`, `profBonusOverride`, `abilityBonusOverrides` — these survive refresh. The `profBonusOverride` and `abilityBonusOverrides` fields are new (added 2026-06-16); old saves that don't have them default to `false` (all auto), which is correct.

## Rest → Resource Reset

`longRest()` in `health.js` calls `resetSpellSlots('long')` and `resetCustomResources('long')` before `autosave()`. `shortRest()` calls `resetSpellSlots('short')` and `resetCustomResources('short')`. Both use guard checks (`typeof fn === 'function'`) so they degrade gracefully if spells.js isn't loaded. The non-`'all'` code paths in `resetSpellSlots` and `resetCustomResources` never show a confirm dialog — they reset silently based on each slot's `resetType` field.

## Storage Container ID Convention

Container item list elements are created with `id="${storage.id}_items"` (in `loadStorageContainers()`). `displayStorageItems(storageId)` looks up `${storageId}_items`. Weight displays use `${storage.id}_weight`. Do not add a `storage_` prefix — that was a prior bug that has been fixed.

## Known Vestigial Code

- `saveActions()` / `loadActions()` in `actions.js` — write to `dndActions` localStorage key. This is a legacy path; the real save/load goes through `core.js` `page1.actionsData`. The `dndActions` key is harmless but redundant. Do not remove `saveActions()` calls from `actions.js` without also removing the `loadActions()` call in `initializeActions()` — they must stay in sync or actions appear to load from stale data.
- `dndInventory` localStorage key — similarly legacy. Real inventory data is in `page1.inventoryData` inside the character blob.

## DM tool — removed

The DM portal (campaigns, players, monsters, items, encounters, NPCs, loot) was removed in 2026-10 because it was not used. It is archived in Seafile (`Github/Jozz dnd campaign builder/Jozz_DnD_Campaign_Builder_2026-10-24.zip`: the removed files, tests, CSS and a full snapshot of the app before removal) and in git at the tag `pre-dm-removal`. Dialogs and `friendlyFirebaseError` moved to `assets/modules/dialogs.js`. Old `campaigns/*`, `members`, `joinRequests` and `dm_requests` data may remain in Firestore; the Admin page backs it up and Tools → "Old campaign data" scans and deletes it. The hidden `#char_campaign` input stays only so a campaign name saved on an old sheet is not erased.

---

### Firestore rules
The ruleset lives in `firestore.rules` (deploy with `firebase deploy --only firestore:rules`; ask first). Summary: a user reads/writes only their own `userData/{uid}` and sheets; nobody else can read or list them (no DM link). `userProfiles`: single `get` for signed-in users, `list` owner-admin only. `campaigns`: owner-admin read/delete only (leftovers from the removed DM tool; nobody can write). `admin_config`: owner-admin only. Collection-group `characters` read: owner-admin only. Doc writes are capped at 60 fields. `members`, `joinRequests` and `dm_requests`: owner-admin read/delete only. Tested with `/root/work/tests/rules_test.py` against the staging emulator.

---

## Admin Portal

Its own page (`pages/admin.html`, route `#admin`, opened by the owner-only **Admin** rail button via `openAdminPage()`). Owner email only; PIN-locked (`admin_config/main.portalPinHash`, set on first unlock; `sha256Hex` falls back to pure JS on plain-http pages where `crypto.subtle` is missing). Code: `assets/modules/admin.js` (unlock, users, preview/import/export, roll logs) and `assets/modules/admin-data.js` (data cache, overview, sheets, backup, restore, tools). Tabs:
1. **Overview** — tiles (users, sheets, deleted, last backup), "Needs attention" list (stale/no backup, sheets near the 1 MB limit, conflict copies, restorable deletes, old password data), recent activity.
2. **Users** — search, per-user detail, preview/import/export each sheet, "Download all of this user's sheets".
3. **Sheets** — every sheet on every account (`collectionGroup('characters')`) with size, owner, flags; search/filter/sort; Preview, Export, and **Restore** for deleted sheets (the only write admin makes to a user's sheet: flips `deleted`/`deletedAt`/`rev`/`updatedAt`).
4. **Backup** — "Download full backup" (`dnd-admin-backup` JSON: users, sheets, any old campaign docs; never the PIN; remembers last backup time in `dndAdminLastBackup`), one-user backup, and a viewer for a saved backup file with "Import copy" (local device only).
5. **Logs** — roll logs by user then character.
6. **Tools** — system info + copy diagnostics, refresh, lock now, scan/delete old data from the removed DM tool (`campaigns`, `members`, `joinRequests`, `dm_requests`), change PIN.
Reads cost one Firestore read per sheet each time the data loads; it is cached until Refresh. Tested by `/root/work/tests/t_admin.js` (staging owner account) and `rules_test.py`.

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
- Card order (CSS `order`, ~line 3591): `.character-manager-card` (1) → `.quick-start-card` (3) → `.suggestion-card` (4) → `.features-card` (5) → `.changelog-card` (6) → `.tips-card` (7)
- **Full-width set** (`grid-column: 1 / -1`, ~line 3577): `.character-manager-card`, `.features-card`, `.changelog-card`, `.tips-card`. As of v1.05 the character manager and DM portal are both full-width so the DM portal sits as its own row directly under the char list.
- Only `.quick-start-card` + `.suggestion-card` remain in the 3-col flow (they pair on a row below the DM portal).
- At 1024px: drops to 2 columns, `.suggestion-card` goes `grid-column: 1 / -1` so it sits below the pair
- At 768px: single column, everything stacks in order
- Do not add `grid-template-columns` to `.home-grid` elsewhere — the cascade is intentional and breakpoints are set in three places only: base rule (~line 3509), 1024px media query (~line 3647), 768px media query (~line 4764)
