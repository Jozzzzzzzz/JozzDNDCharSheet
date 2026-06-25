# bulk-work — DM Portal Revamp (Dev Journal & Handover)

> Living notebook for the full DM-side overhaul. Goal: make the DM portal feel
> like the **DM version of the character sheet** — same design language, theming,
> components, transitions, and polish. Owner: Jozsua. Started 2026-06-25.

---

## 0. HOW TO READ THIS FILE
- **Current focus** and **Next actions** are at the very bottom — jump there to see where I am.
- The **Massive Checklist** (section 9) is the source of truth for progress.
- I commit locally in checkpoints. **No push / no deploy** without Jozsua's OK.

---

## 1. PROJECT GOALS
1. Seamless feel between Character Sheet and DM portal — "designed together from the start."
2. Reuse player-side CSS patterns, theming (accent vars), spacing, transitions, components.
3. Standardize layouts, animations, interactions across all DM pages.
4. Unify settings/shared logic; cohesive nav + page transitions.
5. Remove visual inconsistencies; improve responsiveness & usability.
6. Make it feel dynamic/immersive where it fits the existing language.
7. Scan for vulns, dead code, weak architecture, perf, edge cases — document everything.

**Priority order (Jozsua's ruling):** Consistency > polish > maintainability > performance > new features.

**License:** Free to change DM-side structure/data/components if it gets closer to the "DM version of the char sheet" feel. Char sheet is the template; bend DM to match it.

**Placeholders stay placeholders:** Lore, Player Spells & Actions, Notes tabs get styled to match but NOT feature-built this pass. Feature ideas → section 8.

---

## 2. ARCHITECTURE NOTES (as-found)

### DM portal structure
- **Two DOM roots** in `index.html`: `#dm-chrome-root` (banner+tabs from `partials/dm-chrome.html`) and `#dm-pages-root` (all `pages/dm-*.html` concatenated). Both `display:none` until `enterDmPortal()`.
- **Enter/exit:** `enterDmPortal()` hides player roots (`#chrome-root`, `#pages`, `#popups-root`), shows DM roots. `exitDmPortal()` reverses. Session (24h, `dndDmSession`) persists for instant re-entry.
- **Tabs:** `switchDmTab(btn)` / `switchDmTabById(id)` — generic show/hide of `.dm-page` by `data-dm-tab`. Only `dm-players` has on-open load logic (`dmLoadPlayers()`).
- **All DM logic** in `assets/modules/dm.js` (~1077 lines). Loads before `admin.js`.
- **DM pages:** Home, Lore(placeholder), Players, Player Spells & Actions(placeholder), Monsters, Encounters, NPCs, Notes(placeholder), Settings.

### Player-side patterns to MIRROR
- **Accent variable system** (`:root` ~line 169, derived in `setAccentDerivedColors()` core.js ~582):
  `--accent`, `--accent-border` (0.5a), `--accent-soft` (0.14a), `--accent-muted` (desaturated fill), `--accent-contrast` (YIQ b/w), `--accent-text` (lightened for dark bg), `--panel-bg`, `--card-bg`, `--text-light`.
- **Tabs** (`.tabs` / `.tabs button` ~489): accent-themed, sticky, rounded pills, `translateY(-1px)` hover, `.active` uses `--accent-soft` + `--accent-text`.
- **Header buttons** (`.header-bar .header-btn` ~455): `--accent-muted` bg, `--accent-border`, lift on hover.
- **Sections/cards** (`.section` ~828, `.home-card` ~3517): `--panel-bg`/`--card-bg`, `2px solid --accent-border`, rounded, box-shadow hover (NO translateY on section hover — caused jitter, see CLAUDE.md).
- **Transitions:** ALWAYS explicit per-property (`background-color`, `border-color`, `color`, `box-shadow`, `transform`). NEVER `transition: all` (documented gotcha).
- **status-message** (~4257): `.success/.error/.info` variants.
- **settings-action-btn** (~4790): full-width, rounded, bold.

---

## 3. ISSUES FOUND (current state of DM side)

### 🔴 BIG: DM portal ignores the theme system entirely
The whole DM UI is a **hardcoded red/crimson palette** — `#e88`, `rgba(200,60,60,*)`, and a red gradient banner (`linear-gradient(135deg, rgba(120,40,40,.95), rgba(60,20,20,.98))`). The player sheet is fully accent-themed. This is THE reason it feels like a different app. Fix = swap all hardcoded reds for `--accent*` vars.
- Affected: `.dm-screen-banner`, `.dm-screen-title`, `.dm-tab.active`, `.dm-page-header h2`, `.dm-action-btn`, `.dm-quicknav-btn:hover`, `.dm-monster-row:hover`, `.dm-sb-divider`, `.dm-exit-btn`, `.dm-monster-detail`, etc.

### 🟠 `--accent-rgb` referenced but never defined
CSS uses `rgba(var(--accent-rgb, 255,215,0), …)` in ~4 places (player side too), but `setAccentDerivedColors()` never sets `--accent-rgb`. So those always use the fallback. Easy fix: set it in the JS deriver + early-boot script. Unlocks proper accent-tinted translucency everywhere.

### 🟠 DM components reinvent player components
- `.dm-card` ≈ `.section`/`.home-card` but different border width (1px vs 2px), no hover, different radius.
- `.dm-action-btn` ≈ `.settings-action-btn`/tab buttons but different sizing + red.
- `.dm-tabs`/`.dm-tab` ≈ `.tabs`/`.tabs button` but flat underline style + red, not the pill style.
- `.dm-search-bar input`, `.dm-field-row input`, `.dm-add-combatant-row input` each redefine input styling instead of inheriting global input styles.

### 🟡 Interaction inconsistencies (use of native dialogs)
- `dmDamage`/`dmHeal` use `prompt()`. `dmClearAllNpcs` uses `confirm()`. `dmChangeCampaignPassword` uses `prompt()`. `dmApprove/Deny/Remove` use `alert()` on error. Player side uses in-app popups/multi-step confirms. Inconsistent + jarring.

### 🟡 Spacing / layout drift
- `#dm-pages-root` max-width 1200px / padding 20px 16px — player `#pages` differs. Need to verify consistent container feel.
- DM home grid is 2-col; player home grid is 3-col with order rules.

### 🟡 Responsive gaps
- DM has a single `@media (max-width:768px)` block. Player side has 1024 + 768 breakpoints. DM `.dm-encounter-layout` (1fr 320px) and `.dm-npc-layout` (1fr 300px) collapse only at 768 — awkward 800–1024 zone.
- `.dm-add-combatant-row` with fixed-width number inputs may overflow on small screens.

---

## 4. VULNERABILITIES / SECURITY NOTES
- (To verify) Firestore rules already deployed (v1.04). `joinRequests` create/delete gated to own uid; update gated to owner/DM. Looks sound — will re-read `firestore.rules` during the pass.
- `dmViewPlayerCharacter` reads another user's character doc — relies on collectionGroup read rule (owner OR signed-in). NOTE: current rule allows ANY signed-in user to read ANY character via collectionGroup (`allow read: if isOwnerAdmin() || isSignedIn()`). **Potential over-permissive read** — a signed-in non-DM could query characters. Flag for review (section 8 / questions).
- No XSS obvious: all dynamic strings go through `escapeHtml()`. Good. Will spot-check each template literal.
- `prompt()` numeric parsing in dmDamage/dmHeal: `parseInt` NaN guarded by `if(!amt)`. OK.

---

## 5. DECISIONS MADE (+ reasoning)
- **D1:** Make DM theme-aware by reusing `--accent*` vars rather than introducing a separate DM palette. Reason: single source of truth, instant consistency, respects user accent choice. (The red was giving "different app" feel.)
- **D2:** Add `--accent-rgb` to the deriver (fixes a latent bug AND enables accent-tinted fills the DM side needs). Must update BOTH core.js `setAccentDerivedColors` AND the early-boot inline script in index.html (documented dual-source rule).
- **D3:** Keep the DM "red identity" only as a subtle accent (e.g. the ⚔️ DM SCREEN banner can keep a warm/danger tint) IF it still reads as same-family — TBD, will mock and decide. Default: go full accent, drop red. (Question for Jozsua — section 7.)

---

## 6. IMPROVEMENTS COMPLETED
- **Theming foundation:** Added `--accent-rgb` (R,G,B triplet) to `:root` default, `setAccentDerivedColors()` (core.js), and the early-boot inline script (index.html). Fixes a latent bug where `rgba(var(--accent-rgb,...))` always used fallbacks, and enables accent-tinted translucency.
- **Full DM CSS reskin (the big win):** Rewrote the entire DM CSS block (~7464–8023) + entry-state block to use the accent variable system instead of hardcoded red.
  - DM tabs now use the player `.tabs` pill style (accent bg, lift hover, accent-soft active) instead of the flat red underline.
  - `.dm-card` now mirrors `.section` (2px accent border, hover shadow).
  - `.dm-action-btn` mirrors header/tab buttons (accent-muted fill, lift hover). Save = green, danger = warm red tint via `--dm-danger`.
  - Page headers, monster rows, stat blocks, dividers, combatant rows, NPC fields, player cards, quicknav — all accent-themed.
  - **Kept a deliberate DM identity cue:** the sticky "⚔ DM SCREEN" banner + Exit button keep a warm danger gradient (`--dm-danger` = 200,70,70) so DM mode is visually obvious without clashing with the accent. (Implements Q1 default — easy to flip to full-accent if Jozsua prefers.)
  - Consolidated all DM input styling into ONE shared rule with focus states (accent ring) instead of 4 separate redefinitions.
  - Added `.dm-page` fade-in animation on tab switch + monster detail.
  - Added a 1024px breakpoint (was only 768) and fixed add-combatant row overflow on mobile.

---

## 7. QUESTIONS FOR JOZSUA
- **Q1 (DM identity color):** Should the DM portal fully adopt your accent color (seamless, "same app"), or keep a subtle red/danger accent on just the top "DM SCREEN" banner as a visual signal that you're in DM mode? My default: full accent everywhere, with the DM banner differentiated by shape/label rather than a clashing red. Easy to add a red tint back if you want it.
- **Q2 (over-permissive character reads):** Firestore rule currently lets ANY signed-in user read ANY character via collectionGroup. Want me to tighten it so only owner + assigned DMs of the matching campaign can read? (Needs a rules change + redeploy — won't do without your OK.)
- **Q3 (native dialogs):** OK to replace `prompt()`/`alert()`/`confirm()` in DM tools (damage/heal/password/clear) with in-app popups + multi-step confirms like the player side? More cohesive, more work. Default: yes.

---

## 8. IDEAS FOR LATER (not this pass)
- Build out Lore / Player Spells & Actions / Notes placeholder tabs into real features.
- DM Notes could reuse the player folder/card notes system (`NOTES_DEFAULT_FOLDERS` engine).
- Player Spells & Actions: read linked characters' `page3`/`page1.actionsData` live.
- Encounter initiative: auto-sort by initiative, turn tracker, round counter.
- Monster "Add to Encounter" could carry full stat block for reference mid-combat.
- DM dashboard live player count (currently `—`), recent activity.

---

## 9. MASSIVE CHECKLIST
Legend: [ ] todo · [~] in progress · [x] done · [!] blocked/needs Jozsua

### Foundation
- [x] Full audit of DM JS, HTML, CSS
- [x] Full audit of player patterns to mirror
- [x] Scaffold bulk-work
- [x] Add `--accent-rgb` to `setAccentDerivedColors` (core.js)
- [x] Add `--accent-rgb` to early-boot inline script (index.html)
- [x] Add `--accent-rgb` default to `:root`

### Theming (the big consistency win)
- [x] DM screen banner → kept warm danger tint as DM identity cue (Q1 default)
- [x] DM tabs → match player `.tabs` pill style + accent
- [x] DM page headers (`h2`, subtitle) → accent-themed
- [x] `.dm-card` → align with `.section` (2px border, hover shadow)
- [x] `.dm-action-btn` family → accent-themed, consistent sizing
- [x] `.dm-quicknav-btn` hover → accent
- [x] Monster rows / stat block / dividers → accent
- [x] Encounter + NPC + Players components → accent
- [x] Exit button → consistent (white-on-danger, lifts on hover)
- [ ] Coming-soon placeholder pages → already use accent vars (verify in browser)

### Layout & spacing
- [x] Standardize inputs into ONE shared rule with focus states
- [ ] Unify DM page container with player container feel (verify)
- [ ] Standardize card spacing/padding to player rhythm (verify)

### Interactions & motion
- [x] Consistent hover/transition language (no `transition: all`)
- [x] Page/tab switch transition (added `.dm-page` fade-in)
- [ ] Replace prompt/alert/confirm with in-app UI (Q3) — NEXT

### Responsiveness
- [x] Add 1024px breakpoint handling for DM layouts
- [x] Fix add-combatant row overflow on mobile
- [ ] Verify tab bar wrap on mobile (now wraps like player tabs)

### Cleanup / architecture
- [ ] Remove/flag dead code: `dm_requests` flow (`submitDmRequest`, `dmRequestFormHtml`, `getDmRequestStatus`, `isDmApproved`, `DM_APPROVED_EMAILS`, `dmShouldNotifyForRequest`) — superseded by password+approval model
- [ ] Verify `dmPendingBanner` still needed (always hidden now)
- [ ] Confirm `firestore.rules` read scope (Q2)

### Finish
- [ ] Syntax check all changed JS
- [ ] Smoke test (serve, load each DM tab)
- [ ] Draft changelog entry (vague public wording)
- [ ] Update CLAUDE.md if architecture changed
- [ ] Local commit checkpoints
- [ ] STOP — do not push/deploy; hand back to Jozsua

---

## 10. PROGRESS LOG
- **2026-06-25 (start):** Read all DM JS/HTML/CSS + player reference patterns. Identified the hardcoded-red theme as the #1 consistency issue and the missing `--accent-rgb` as a quick enabling fix. Scaffolded this journal. Next: implement theming foundation.

---

## ⭐ CURRENT FOCUS
Theming foundation — add `--accent-rgb`, then convert the DM CSS from hardcoded red to the accent variable system. This is the single biggest "same app" win.

## ▶ NEXT ACTIONS (resume here)
1. Add `--accent-rgb` in `setAccentDerivedColors()` (core.js ~606) + early-boot script (index.html).
2. Rewrite the DM CSS block (styles.css ~7464–8023 + ~3599–3646) to use `--accent*` vars.
3. Work tab-by-tab through HTML to align components.
4. Keep checking items off section 9; log decisions in section 5; surface blockers in section 7.
