# D&D Character Sheet — Full To-Do List & Plans
Last updated: 2026-06-17

---

## BUGS / ISSUES

### CRITICAL (Fix These First)

1. **`dndInventory`, `dndActions` are orphaned localStorage keys**
   - `inventory.js` and `actions.js` write to separate keys (`dndInventory`, `dndActions`) that are NOT inside the character blob and NOT synced to cloud. Need to verify if `core.js` loadData covers these or if data is silently lost on cloud restore/export.

2. **Conditions are DOM-only — never saved**
   - `addCondition()` appends raw HTML to `#conditions_container`. No array, no save, no load. Conditions wipe on every refresh or character switch.

3. **Action tracker not persisted**
   - `action_counter`, `bonus_action_counter`, `action_tick`, `bonus_action_tick` are not saved/loaded in the character data cycle. Reset on reload.

4. **Long rest / short rest don't reset spell slots or custom resources**
   - `longRest()` in `health.js` does NOT call `resetSpellSlots('long')` or `resetCustomResources('long')`.
   - `shortRest()` does NOT call `resetSpellSlots('short')` or `resetCustomResources('short')`.
   - Users have to manually reset these after resting.

5. **`displayStorageItems()` container ID mismatch**
   - `loadStorageContainers()` creates elements with id `${storage.id}_items`
   - `displayStorageItems()` looks for `storage_${storageId}_items` (extra `storage_` prefix)
   - Storage container items never render.

6. **`saveSpell()` edit detection is fragile**
   - Detects edit mode by checking if the form title contains "Edit", then finds the spell by its current name in the form.
   - Renaming a spell while editing silently creates a duplicate instead of updating.

7. **`autoMathOverrideState` not persisted**
   - Override flags for initiative, passive perception, spell save DC, spell attack, and ability bonuses reset on every page load.
   - Manual overrides to bonuses are lost on refresh.

---

### MEDIUM PRIORITY

8. **XSS risk — missing `escapeHtml()` in several places**
   - `createEquipmentCard()` — equipment name, type, description inserted as raw HTML
   - `addCondition()` — condition name, turns, effect inserted as raw HTML
   - `showWeaponNotes()` / `showEquipmentNotes()` — content inserted via innerHTML without escaping

9. **`deductCurrency()` only handles GP, SP, CP**
   - Silently does nothing for EP or custom currency names even though the refill popup offers those options.

10. **Potion button uses hardcoded colors**
    - `useHealthPotion()` sets `btn.style.background = '#9C27B0'` and `'#D32F2F'` directly, ignoring the accent color system.

11. **`clearAllSpells()` uses implicit `event` global**
    - Reads `event.target` without it being passed as a parameter. Crashes if called programmatically.

12. **Dual layout save systems conflict**
    - `LayoutManager` (in `inventory.js`, key `dndSheetLayout_final`) and `loadLayout()`/`saveLayout()` in `core.js` are two separate layout persistence systems that likely stomp each other.

13. **`con_modifier` has hardcoded dark background**
    - Inline style `background: #2a2a2a` doesn't respect theme or accent color system.

14. **All `alert()` and `confirm()` calls should be replaced**
    - Breaks on mobile Safari/PWA. Affects: `health.js` (rest, potion), `actions.js` (delete, clear), `inventory.js` (delete, weight warning), `spells.js` (clear all, import count).
    - Use in-UI toasts and inline confirmations instead.

---

### MINOR

15. **Home page tip says "Drag and drop items"** — inventory drag-and-drop doesn't exist yet. Misleading.
16. **`importCommonCantrips()` / `importCommonSpells()`** — stale 5-spell hardcoded lists that predate the full import system. Dead weight, confusing to users.
17. **`minor` and `lesser` healing potions are identical** — both listed as `2d4+2`. Minor Healing Potion is not a standard 5e item.
18. **Settings "Sync Up Now" / "Sync Down Now" buttons have no `onclick`** — rely on event delegation elsewhere. If that wiring breaks, buttons silently do nothing with no feedback.
19. **Skill expertise not supported** — only a binary proficiency checkbox. No half-proficiency (Bard Jack of All Trades) or expertise (double proficiency).

---

## TO-DO LIST (Prioritized)

### Phase 1 — Data Integrity (Do These Now)
- [x] Verify inventory/actions save path — both persist inside character blob via `core.js` `page1.inventoryData` / `page1.actionsData`. `dndInventory`/`dndActions` keys are legacy artifacts, safe to ignore.
- [x] Fix conditions persistence — already implemented in `core.js` (save: line 2911, load: line 3450). Was never broken.
- [x] Fix action tracker persistence — already implemented in `core.js` (save: line 2761, load: line 2965). Was never broken.
- [x] Wire `longRest()` → `resetSpellSlots('long')` + `resetCustomResources('long')` — fixed 2026-06-16
- [x] Wire `shortRest()` → `resetSpellSlots('short')` + `resetCustomResources('short')` — fixed 2026-06-16
- [x] Fix `displayStorageItems()` container ID mismatch — fixed 2026-06-16 (was `storage_${id}_items`, now `${id}_items`)

### Phase 2 — Bug Fixes
- [x] Fix `saveSpell()` edit mode — stores index + type in `form.dataset`, handles renames and level changes correctly (2026-06-16)
- [x] Persist `autoMathOverrideState` with character data — `profBonusOverride` and `abilityBonusOverrides` now saved in `page1.combatStats` and restored on load (2026-06-16)
- [x] Fix `deductCurrency()` to handle EP and custom currency names — EP mapped to `currency_ep`, custom currencies matched by name in DOM rows (2026-06-16)
- [x] Escape HTML in `createEquipmentCard()` and `addCondition()` — `escapeHtml()` applied to all user-supplied fields (2026-06-16)
- [x] Fix `clearAllSpells()` to receive `event` as parameter — updated function signature and both HTML call sites (2026-06-16)
- [ ] Fix potion button colors to use CSS variables

### Phase 3 — Polish & UX
- [ ] Replace all `alert()` / `confirm()` with in-UI toasts and inline multi-step confirmations
- [ ] Remove or update `importCommonCantrips()` / `importCommonSpells()`
- [ ] Resolve dual layout save systems
- [ ] Fix `con_modifier` background to use a CSS variable
- [x] Update home page — hero section rewritten for 1.0 clean slate, version number now dynamic from CHANGELOG_LATEST_VERSION (2026-06-17)
- [ ] Add admin portal character count badge per user in the user list
- [ ] Add admin portal "Export JSON" button per character

---

## UPDATE LOG (Already Done)

- **Admin portal fixed** (2026-06-16) — rewrote to read from `userData/{uid}/characters/` subcollection instead of old flat array
- **Spell slot drag-and-drop** — ghost drag with tilt animation, touch support, placeholder drop indicator
- **Spell effect extraction** — `getSpellEffect()` for the prepared spells table, keyword scan of description as fallback
- **Initiative + passive perception overrides** — auto-calculate from DEX/Perception, manual override with reset button
- **Spell slot edit popup** — can edit name, max, and reset type on existing slots
- **Background system** — presets + custom (file upload + URL), early-boot style injection to prevent flash
- **Notes folder+card system** — 10 default folders, multi-step delete, mobile autocorrect
- **Font selection** — 9 font options, persisted and restored before first paint
- **Encumbrance system** — optional toggle, tier display (Encumbered / Heavily Encumbered / Max), thresholds from STR score
- **Item refill system** — stackable items with qty tracking, purchase history, currency deduction
- **Item move system** — move items between containers via inline dropdown
- **Cloud sync subcollection migration** — migrated from `userData/{uid}.characters` array to per-character subcollection docs
- **1.0 official release** (2026-06-17) — clean slate changelog entry, hero section rewrite, version number dynamic, duplicate COMING_SOON crash fixed
- **Home page layout overhaul** (2026-06-17) — 3-col desktop row (Character Manager, Quick Start, Share Thoughts), full-width features/changelog/tips below. Key Features rebuilt as icon-left cards with real descriptions. Changelog trimmed to 9 bullets. Suggestion card moved up. Tips pushed to bottom.
- **Character background field** — added to character info form
- **Spell slots reset type** — long rest / short rest / manual per slot
- **Custom resources system** — same pattern as spell slots with rest-reset support

---

## IDEAS & EXPLORATION LIST

### Gameplay Features
1. **Dice roller** — inline roller; click a damage value like "2d6+3" and it rolls, shows result in a toast or floating panel
2. **Initiative tracker** — combat order list, enter enemy names and their initiatives for a fight
3. **Concentration tracker** — when a concentration spell is active, show a prominent banner "Concentrating on: [spell]" clearable with one tap
4. **Multiclass support** — second class + level field, separate hit dice sizes, combined spell slot table
5. **Spell upcast notes** — per-spell field for "at higher levels" text (e.g. "+1d6 per slot level above 2nd")
6. **Cantrip scaling display** — auto-show damage dice at character levels 5 / 11 / 17
7. **Temp HP as a first-class field** — separate `temp_hp` input instead of the current curr_hp > max_hp trick
8. **Hit dice pool tracker** — track total hit dice remaining across short rests, not just "spend this rest"
9. **Expertise toggle on skills** — half-proficiency and double proficiency (expertise) alongside the current binary checkbox
10. **Sorcery points / Ki / other class resources** — pre-built custom resource templates for common classes

### UI / UX
11. **Compact list view for inventory + spells** — toggle between current card view and a dense table row view for power users
12. **Pinned quick-reference panel** — floating/sticky toggle showing AC, HP, initiative, passive perception, spell save DC at a glance from any page
13. **Keyboard shortcuts** — Ctrl+S manual save, Escape closes any popup, Ctrl+/ opens dice roller
14. **Drag-and-drop reorder for inventory items** — currently only spell slots have this
15. **Drag-and-drop reorder for actions/features** — same gap
16. **Color-coded skill rows** — highlight proficient skills in accent color for faster scanning
17. **Spell search across description text** — find "all spells that cause charmed" not just by name
18. **Per-character accent color** — each character loads its own accent color when selected (useful across different campaigns)
19. **Dark/light mode per user preference** — remove the 60-second joke gate, just let the user toggle freely

### Notes Improvements
20. **Markdown rendering** — render bold, italic, bullet lists, headers in note card read mode
21. **Note card templates** — NPC, Location, Quest, Item pre-filled templates beyond the current generic one
22. **Note card color tags** — color badge per card for visual organization
23. **Note card image attachments** — drag an image into a note card body

### Admin / Owner Tools
24. **Admin: character diff viewer** — show what changed between two cloud saves of a character
25. **Admin: push notification to user** — write a message that appears as a banner on the user's next login
26. **Admin: character count visible in user list** — see at a glance without clicking each user
27. **Admin: bulk export all characters** — download everything from all users as a single JSON backup file

### Tech / Infrastructure
28. **Service worker caching** — `sw.js` is currently a pass-through stub. Cache-first for assets = fully offline + faster on slow connections
29. **`spells.json` expansion** — currently 482 spells. Missing content from Xanathar's, Tasha's, Fizban's, Spelljammer, etc.
30. **Character portraits in Firebase Storage** — base64 data URLs in localStorage are huge and never cloud-synced. Store in Firebase Storage with a URL reference instead
31. **Export schema versioning** — add a `schemaVersion` field to exported JSON so future format changes don't silently break old imports
32. **Offline indicator** — subtle badge when the user is offline so they know sync is paused
33. **PWA install prompt** — prompt the user to install the PWA on mobile if they haven't already
34. **Spell slot quick-use from prepared spells table** — a "Cast" button in the prepared spells table that spends a slot of the appropriate level in one tap

---

## NOTES ON DATA SHAPE

### Things that save per-character (inside `dndCharacters[].data`):
- All `page1`–`page6` fields via `core.js` `autosave()`
- `spellsData`, `manualSpellSlots`, `manualSpellSlotsUsed`, `customResources`, `customResourcesUsed`, `favoritesData` — in `page5`
- `noteFolders` — in `page6`
- `weaponsData` — in `page2` or `page4`

### Things that may NOT save per-character (needs verification):
- `inventoryData` — written to `dndInventory` key directly in `inventory.js`
- `actionsData` — written to `dndActions` key directly in `actions.js`
- Conditions DOM content — never saved at all
- Layout (`dndSheetLayout_final`) — not per-character, shared across all characters

### Cloud sync covers:
- Everything inside `dndCharacters[].data` → `userData/{uid}/characters/{charId}`
- Theme, accent color → `userData/{uid}` meta doc
- Does NOT cover: `dndInventory`, `dndActions`, `dndSheetLayout_final`, `dndInventory` (if separate)
