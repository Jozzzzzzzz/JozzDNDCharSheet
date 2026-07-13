# D&D Character Sheet — Full To-Do List & Plans
Last updated: 2026-07-11 (post-v1.14)

> **Everything in the old "Bugs/Issues" and "To-Do (Prioritised)" sections has been
> completed** (verified against code at v1.14). The full record is in the UPDATE LOG
> below. Only one item was found to be a non-issue rather than a fix — see #12.

---

## OPEN — genuinely still to do

### Low-risk cleanup (optional)
- [ ] **Remove dead layout code** (was to-do #12, "dual layout systems"). Investigated: NOT a conflict — `core.js loadLayout()` is an empty stub and `LayoutManager` (inventory.js) has `save/load/reset` methods with **no callers and no UI** (their buttons don't exist), and its key `dndSheetLayout_final` is never written. Safe cleanup: delete the stub + the orphaned methods. Not urgent (fully inert).

### Features not yet built (from the ideas list — see below for the rest)
- [ ] **#3 Concentration tracker** — banner "Concentrating on: [spell]" when a concentration spell is cast, one-tap clear. Spells already carry the `concentration` flag, so this is low-effort/high-value. **Top pick.**
- [ ] **#4 Multiclass support** — 2nd class+level, separate hit dice, combined slots. Bigger, data-model work.
- [ ] **#8 Hit-dice pool tracker** — track total hit dice remaining across short rests.
- [ ] **#28 Service worker caching** — `sw.js` is a pass-through stub; cache-first = true offline + faster loads.
- [ ] **#30 Portraits in Firebase Storage** — base64 data URLs are huge and don't cloud-sync; store a URL reference instead.

---

## UPDATE LOG (Already Done)

### v1.14 (2026-07-11) — the big one
- **Skill expertise** — proficiency cycle button (None/Half/Prof/Expertise), `SKILL_PROF_LEVELS` maths, tinted rows. (closed old #19 + idea #9, #16)
- **Conditions picker** — 14 SRD conditions + custom + exhaustion levels + Open5e links; array-model save with back-compat migration. (closed old #2, #8)
- **In-app dialogs** — all native `alert()`/`confirm()` → `appToast`/`appAlert`/`appConfirm`. (closed old #14)
- **Prepared spells first** in Add-from-sheet ("★ Ready" group).
- **Upcast/cantrip-scaling display** on spell cards. (idea #5, #6)
- **Quick-cast** button on prepared spells. (idea #34)
- **Spell search matches effect text**. (idea #17)
- **Class resource templates** (Ki/Sorcery/Bardic…). (idea #10)
- **Potion + con_modifier colours** now themed. (closed old #10, #13)
- **Real 5e healing potions** with legacy migration. (closed old #17)
- **Sync buttons** hardened with inline onclick. (closed old #18)
- **Custom-spell Open5e link** save/load bug fixed (duplicate id).
- **Admin: per-character Export JSON + char-count badge.** (closed old #101, #102; idea #26)
- **Dead-code cleanup** — removed `app.monolith.backup.js`, 6 stray root HTML shims, shadowed suggestion code, `importCommonCantrips/Spells`. (closed old #16)
- **DM encounter generator overhaul** — 18 new themes (37 total), 8 new battle shapes (19 total), 5-6 intros/theme + Reroll Intro, difficulty helper (auto even-spread elites → one smart menu: borrow/troops/change/build), manual Elite ★ toggle per creature.
- **Export schema versioning** — `schemaVersion` in exports + tolerant import. (idea #31)
- Home tip drag-drop wording fixed (old #15); spell counts corrected to 1,100+ (idea #29 partial — 1,122 spells).

### Earlier
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

> ✅ **Shipped:** #1 dice roller · #2 initiative tracker (DM) · #5/#6 upcast+cantrip
> display · #7 temp HP field · #9 expertise · #10 resource templates · #16
> colour-coded skills · #17 spell desc search · #26 admin char count · #27 bulk
> export (console tool) · #31 schema versioning · #34 quick-cast. Removed below.

### Gameplay Features (open)
- **Concentration tracker** — banner "Concentrating on: [spell]" when a concentration spell is cast, one-tap clear (spells already have the `concentration` flag). ← **strong next pick**
- **Multiclass support** — second class + level field, separate hit dice sizes, combined spell slot table.
- **Hit dice pool tracker** — track total hit dice remaining across short rests, not just "spend this rest".

### UI / UX (open)
- **Compact list view for inventory + spells** — toggle between card view and a dense table view.
- **Pinned quick-reference panel** — sticky AC / HP / initiative / passive perception / spell save DC from any page.
- **Keyboard shortcuts** — Ctrl+S save, Escape closes popups, Ctrl+/ opens dice roller.
- **Drag-and-drop reorder for inventory items** and **for actions/features** (spell slots already have it).
- **Per-character accent colour** — each character loads its own accent when selected.
- **Free dark/light toggle** — remove the 60-second joke gate.

### Notes Improvements (open)
- **Markdown rendering** in note card read mode (bold/italic/lists/headers).
- **Note card templates** — NPC / Location / Quest / Item pre-fills.
- **Note card colour tags** — a colour badge per card.
- **Note card image attachments** — drag an image into a card body.

### Admin / Owner Tools (open)
- **Character diff viewer** — what changed between two cloud saves.
- **Push notification to user** — a banner message shown on their next login.

### Tech / Infrastructure (open)
- **Service worker caching** — `sw.js` is a pass-through stub; cache-first = offline + faster. (also open above)
- **`spells.json` expansion** — now 1,122 spells (from Open5e). Could pull more sources via the Open5e picker (see Track C in CLAUDE.md).
- **Portraits in Firebase Storage** — base64 in localStorage is huge and un-synced; store a URL reference. (also open above)
- **Offline indicator** — subtle badge when offline so the user knows sync is paused.
- **PWA install prompt** — prompt to install on mobile.

### New ideas (from v1.14 work)
- **DM: save the upscale as a template** — remember an "elite bandit" build so the same buffed foe can be re-added.
- **DM: encounter → combat log export** — dump the initiative order + HP/AC to the Notes page or clipboard.
- **DM: creatures across all Open5e sources** — the encounter pool is SRD-only; a source picker (Track C) would widen it hugely.
- **Player: condition auto-effects** — e.g. Poisoned auto-flags disadvantage hints on attack rolls (display only, no rules enforcement).
- **Player: "cast from favourites"** — the quick-cast Cast button on the Favourites panel too, not just the prepared table.
- **Concentration ↔ conditions link** — casting a concentration spell auto-adds a clearable "Concentrating" condition card.

---

## NOTES ON DATA SHAPE

### Things that save per-character (inside `dndCharacters[].data`):
- All `page1`–`page6` fields via `core.js` `autosave()`
- `spellsData`, `manualSpellSlots`, `manualSpellSlotsUsed`, `customResources`, `customResourcesUsed`, `favoritesData` — in `page5`
- `noteFolders` — in `page6`
- `weaponsData` — in `page2` or `page4`

- `conditionsData` — saved as `data.conditions` (array with id/link/exhaustionLevel) since v1.14
- `inventoryData` / `actionsData` — persist inside the character blob (`page1.inventoryData` / `page1.actionsData`); the flat `dndInventory` / `dndActions` keys are harmless legacy artifacts
- Skill proficiency levels — `page1.skills.proflvl_<skill>` (with legacy `prof_<skill>` bool migration)

### Resolved (previously "may not save"):
- Conditions ✅ now saved (v1.14). Inventory/actions ✅ save inside the blob. Layout system (`dndSheetLayout_final`) is inert dead code — never written (see OPEN #12 cleanup).

### Cloud sync covers:
- Everything inside `dndCharacters[].data` → `userData/{uid}/characters/{charId}`
- Theme, accent color → `userData/{uid}` meta doc
- Does NOT cover the harmless legacy `dndInventory` / `dndActions` keys (real data is in the blob, which does sync)
