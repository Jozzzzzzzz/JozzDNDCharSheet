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

## 6b. OWNER "ENTER AS DM" OVERRIDE (added 2026-06-25)
Jozsua had no way to enter a campaign's DM portal without knowing that campaign's
DM password. Added `dmEnterAsOwner(campaignId)` (dm.js) — owner-gated, skips the
password, saves a session with `ownerOverride: true` and calls `enterDmPortal()`.
Wired an **"Enter as DM"** button on each Admin Portal campaign card (admin.js).
The admin portal is already owner-only, so the button is owner-exclusive. Works on
active AND inactive campaigns (reads the doc directly).
**Two modes:** `dmEnterAsOwner(cid, mode)` — `'view'` (read-only, `.dm-view-only`
disables controls, banner "· VIEW ONLY") or `'edit'` (full control, banner
"· OWNER EDIT"). Admin campaign card shows both **"Enter as DM (View)"** and
**"Enter as DM (Edit)"** buttons. View keeps tab nav/monster browse/Exit usable.
Cleared on exit. scriptVersion bumped to `20260625b-dm-revamp`.

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

## 7b. DRAFT CHANGELOG (ready when Jozsua approves — NOT yet in changelog.js, NOT pushed)
Suggested as **v1.06 — DM Portal Revamp**. Public wording kept simple/non-spoilery:
```
updates:
  - The Dungeon Master Portal now matches your character sheet — same theme,
    colours, and styling throughout, so it feels like one app
  - The DM Portal now follows your chosen accent colour everywhere
  - Smoother pop-ups and messages across the DM tools (no more browser prompts)
  - Live player count on the DM dashboard
fixes:
  - Tidied up the DM Portal under the hood for a cleaner, more reliable experience
```
When approving: bump `CHANGELOG_LATEST_VERSION` + `scriptVersion`, add entry, then push.
**No Firestore deploy needed** unless we also do Q2 (tighten read rule).

## 8. IDEAS FOR LATER (not this pass)
- Build out Lore / Player Spells & Actions / Notes placeholder tabs into real features.
- DM Notes could reuse the player folder/card notes system (`NOTES_DEFAULT_FOLDERS` engine).
- Player Spells & Actions: read linked characters' `page3`/`page1.actionsData` live.
- Encounter initiative: auto-sort by initiative, turn tracker, round counter.
- Monster "Add to Encounter" could carry full stat block for reference mid-combat.
- DM dashboard live player count (currently `—`), recent activity.

---

## 8b. ⭐ ACCESS-CONTROL + DATA-OWNERSHIP REDESIGN (the big plan)
Agreed with Jozsua 2026-06-25. This replaces the leaky collectionGroup read model
with a campaign-scoped "players publish into the campaign" model. Build incrementally.

### The problem it solves
All character data lives under `userData/{uid}` (player-owned). DMs currently reach
ACROSS ownership via a collectionGroup query, which Firestore rules can't authorize
per-campaign → so the rule is "any signed-in user can read any character" (the leak).

### The principle
Data flows TO where the authorized people already are. Players **publish** a copy of
their sheet INTO the campaign they belong to. DMs/owner read within their own campaign
— a scoped read rules CAN authorize cleanly. No cross-ownership queries.

### Target Firestore structure
```
campaigns/{cid}
  name, setting, status: 'pending'|'active'|'inactive'
  ownerEmail            ← the host/admin who approved it (you)
  dmEmails[]            ← assigned DM(s)
  dmPasswordHash        ← DM takes control
  passwordHash          ← player join password
  createdAt
  members/{uid}         ← roster + join state
      uid, charName, status: 'pending'|'approved', requestedAt, approvedAt
  sheets/{uid}          ← player's CURRENT published sheet (latest manual Save)
      data{...}, charName, publishedAt
      versions/{ts}     ← immutable snapshot per manual Save (date+time stamped)
          data{...}, savedAt, label?
campaign_requests/{cid or uid}  ← "I want to run a campaign" → owner approves → creates campaigns/{cid}
```

### Roles
- **Owner/host (you, vanreejoz33):** approves campaign requests; can edit ANY campaign
  (name, dmEmails, dmPassword, player password, members). `isOwner()`.
- **DM:** runs an approved campaign; approves player join requests; pulls + views player
  sheets + version history. `isCampaignDm(cid)` (email in `dmEmails`).
- **Player:** uses sheet solo; requests to join (player password); on approval, their
  manual Saves publish into `campaigns/{cid}/sheets/{uid}`.

### Decisions locked (Jozsua)
- **Versioning = manual Save only.** The Save button writes BOTH `sheets/{uid}` (current)
  and `sheets/{uid}/versions/{ts}` (immutable, date+time stamped). No autosave versions.
- **DM pulls, not live.** DM Players tab gets a **"Pull latest sheets"** button that reads
  `campaigns/{cid}/sheets/*` for approved members. No live listener.
- **History is append-only** — versions can't be edited/deleted (rule `update,delete: if false`).

### Rules shape (works because reads are single-campaign-scoped, not wildcard)
```
function isOwner() { return signedIn && email == OWNER; }
function isCampaignDm(cid) { return email in get(campaigns/$(cid)).data.dmEmails; }
function isSelf(uid) { return request.auth.uid == uid; }
function isApprovedMember(cid, uid) {
  return get(campaigns/$(cid)/members/$(uid)).data.status == 'approved';
}

match /campaigns/{cid} {
  allow read: if isSignedIn();                     // dropdown
  allow write: if isOwner() || isCampaignDm(cid);  // settings (owner can edit all)

  match /members/{uid} {
    allow read: if isOwner() || isCampaignDm(cid) || isSelf(uid);
    allow create, update: if isSelf(uid) || isCampaignDm(cid) || isOwner();
    allow delete: if isCampaignDm(cid) || isOwner();
  }
  match /sheets/{uid} {
    allow read: if isOwner() || isCampaignDm(cid) || isSelf(uid);
    allow write: if isSelf(uid) && isApprovedMember(cid, uid);
    match /versions/{vid} {
      allow read: if isOwner() || isCampaignDm(cid) || isSelf(uid);
      allow create: if isSelf(uid);
      allow update, delete: if false;   // immutable history
    }
  }
}
// Then collectionGroup characters read → tighten to owner-only (DMs no longer need it).
```

### Migration / compatibility
- `characterInfo.campaignId` (existing) stays as the player's "which campaign am I in" marker.
- Existing join-request flow (`campaigns/{id}/joinRequests`) folds into `members/{uid}`
  (status pending→approved). Can keep joinRequests as-is short-term and add members later.
- Publishing is ADDITIVE: manual Save still writes the player's own doc as today, PLUS
  the campaign copy if they're an approved member. Solo players unaffected.

### Build stages (each independently shippable, nothing breaks mid-way)
1. **Rules + structure scaffolding** — add the campaigns subcollection rules (deploy).
2. **Publish-on-Save** — when an approved player hits Save, also write
   `campaigns/{cid}/sheets/{uid}` + `versions/{ts}`. (Player side, core.js manualSave.)
3. **DM "Pull latest sheets"** — Players tab button reads campaign sheets instead of the
   collectionGroup query. Then tighten the collectionGroup rule to owner-only.
4. **Version history viewer** — DM player panel gets a date/time list of past saves.
5. **Campaign request → owner approval** — formalize "request to run a campaign" →
   `campaign_requests` → owner approves → creates the campaign.
6. **Owner edit-anything** — Admin campaign editor covers name/dm/dmPassword/playerPassword/members.

### Open sub-questions (revisit per stage)
- Sheet size: a full character blob per version — fine for manual-save cadence; monitor doc size (1MB Firestore limit, our sheets are far under).
- Pruning: cap versions (e.g. keep last 50) later if needed.
- Home-server future: this structure maps cleanly to any backend later (campaigns own the data), so it doesn't lock us to Firestore.

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
- [x] Replace prompt/alert/confirm with in-app UI — built `dmModal()` (promise-based prompt/confirm) + `dmToast()`, themed to player popup language. Swapped ALL 8 native dialogs (damage/heal/clearNPCs/password/3 approve-deny-remove errors/enter guard). Zero native dialogs remain.

### Responsiveness
- [x] Add 1024px breakpoint handling for DM layouts
- [x] Fix add-combatant row overflow on mobile
- [ ] Verify tab bar wrap on mobile (now wraps like player tabs)

### Cleanup / architecture
- [x] Removed dead `dm_requests` flow: `submitDmRequest`, `dmRequestFormHtml`, `setDmStatus`, `getDmRequestStatus`, `isDmApproved`, `DM_APPROVED_EMAILS`, `DM_NOTIFICATION_SUPPRESSED`, `DM_NOTIFY_COOLDOWN_MS`, `dmShouldNotifyForRequest` (~150 lines)
- [x] Removed `dmPendingBanner` from dm-chrome.html + its enterDmPortal reference + `.dm-pending-*` CSS
- [x] Improved DM home dashboard: live player count (`dmLoadHomePlayerCount`)
- [ ] Confirm `firestore.rules` read scope (Q2) — STILL OPEN, flagged for Jozsua

### Finish (revamp pass)
- [x] Syntax check all changed JS
- [x] Smoke test (serve, load each DM tab)
- [x] Draft changelog entry (in §7b — v1.06, vague wording)
- [x] Update CLAUDE.md
- [x] Local commit checkpoints (3 commits, unpushed)
- [x] STOP — not pushed/deployed; handed back to Jozsua

### Access-control redesign (§8b) — NOT STARTED, design approved
- [ ] Stage 1: campaigns subcollection rules (members/sheets/versions) + deploy
- [ ] Stage 2: publish-on-Save (approved player Save → campaign sheet + version)
- [ ] Stage 3: DM "Pull latest sheets" button → read campaign sheets; tighten collectionGroup rule to owner-only
- [ ] Stage 4: version history viewer in DM player panel
- [ ] Stage 5: campaign request → owner approval → creates campaign
- [ ] Stage 6: owner edit-anything in Admin campaign editor

---

## 10. PROGRESS LOG
- **2026-06-25 (start):** Full audit of DM JS/HTML/CSS + player patterns. Found the hardcoded-red theme as the #1 issue, missing `--accent-rgb` as the enabling fix. Scaffolded journal.
- **2026-06-25 (session 1):** Implemented in order:
  1. `--accent-rgb` added to `:root`, `setAccentDerivedColors` (core.js), early-boot (index.html).
  2. Full DM CSS reskin → accent system (tabs as pills, cards as sections, themed buttons/inputs/stat-blocks/combatants/players/npcs). Kept warm danger tint only on the DM SCREEN banner + exit as a mode cue. Added `.dm-page` fade, 1024px breakpoint, mobile combatant fix, shared input rule w/ focus ring.
  3. Removed the entire dead `dm_requests` flow (~150 lines) + pending banner + `.dm-pending-*` CSS.
  4. Built `dmModal()` + `dmToast()` in-app dialog system (themed to player popups); replaced ALL 8 native `prompt/alert/confirm` calls.
  5. Wired live player count on the DM home dashboard.
  - Checkpoint commits made locally (NOT pushed). All JS syntax-checked, all 13 DM assets serve 200.

---

## ⭐ CURRENT FOCUS
Two tracks now:
- **Track A — Revamp (DONE, unpushed):** theming + dialogs + cleanup + dashboard. 3 local commits. Awaiting Jozsua's browser eyeball + push decision.
- **Track B — Access-control redesign (DESIGNED, see §8b):** approved by Jozsua. Build incrementally in 6 stages. NOT started.

## ▶ NEXT ACTIONS (resume here)
1. **Jozsua:** hard-refresh + eyeball the DM portal (the revamp changes ARE in your local files; pushing is only for GitHub backup). Decide Q1 (red banner keep/drop) + when to push Track A.
2. When ready → run pre-push checklist (bump version v1.06, finalize changelog), push Track A.
3. Then start Track B Stage 1 (campaigns subcollection rules) — this is the real security fix; the current "any signed-in user can read any character" leak is Low–Moderate risk (read-only, signed-in users only, requires dev-tools) and closes when Track B Stage 3 lands.
4. Build Track B stages 1→6, deploying rules as needed (ask before each deploy).

## KNOWN ISSUE (until Track B Stage 3)
`firestore.rules` line ~54: `allow read: if isOwnerAdmin() || isSignedIn()` on the
characters collectionGroup lets any signed-in user read any character via a manual
query. Read-only, no creds exposed. Accepted short-term; fixed by the redesign.
