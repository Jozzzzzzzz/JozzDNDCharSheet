// ============================================================
// CHANGELOG — edit this file at the end of each session
// ============================================================
// LATEST_VERSION must match the most recent entry's version.
// When you bump this, all users will see the "NEW" badge on
// the Home button until they visit the home page.
// ============================================================

const CHANGELOG_LATEST_VERSION = '1.18';

const CHANGELOG = [
  {
    version: '1.18',
    date: '2026-07-14',
    title: 'v1.18 — Smarter Item & Monster Browsing',
    updates: [
      'Item catalogue and the DM monster browser now use a smart, fast search: it\'s typo-tolerant, so "firebal", "gobln" or "holy avngr" still find the right thing',
      'Both browsers now scroll the whole list smoothly, even at thousands of entries, and show a live result count as you search and filter',
      'Hunt by category: filter items by type, rarity and source; filter monsters by CR, creature type and size — and sort the results (name, rarity, or CR up/down)',
      'The DM monster browser now preloads and is cached — it opens instantly, remembers the monster list between visits, and keeps working offline after the first download (hit Refresh to re-pull the latest)',
      'When monsters are downloading, a progress bar now shows how far along the load is (and how many of the total have arrived), so you can see it working and how fast',
    ],
    fixes: [],
  },
  {
    version: '1.17',
    date: '2026-07-14',
    title: 'v1.17 — Searchable Item Catalogue & Inventory Reorder',
    updates: [
      'Add items by searching a built-in catalogue of 1,400+ items — magic items, weapons and armour. Open "Browse item catalogue" from Add Item, search by name, filter by type and rarity, and click one to auto-fill the form (name, type, rarity, attunement, description). Much faster than typing it all out',
      'Item sources are pickable: default to official SRD only, or toggle on third-party books (Level Up A5e, Tome of Heroes, Vault of Magic, Tal\'Dorei). Your choice is remembered',
      'Rarity shows as a coloured badge and items that need attunement are flagged, so you can spot the good loot at a glance',
      'Inventory items can now be dragged to reorder them — within your main inventory or inside any storage container (spell slots already had this; now your gear does too)',
      'The item catalogue is cached for offline use, like your spells',
    ],
    fixes: [],
  },
  {
    version: '1.16',
    date: '2026-07-14',
    title: 'v1.16 — Hit Dice Pool, Offline Mode & Polish',
    updates: [
      'Hit Dice Pool tracker: a proper pool that shows how many hit dice you have left, with Spend / Restore buttons. Max auto-fills from your level (editable), a short rest spends from it, and a long rest regains half — the 5e way. Multiclass characters get a second pool only if their two classes use different die sizes',
      'The app now works offline and is installable: pages and data are cached so it loads fast and keeps working with no connection. An "Install app" button appears where your browser supports it, and an "Offline" badge shows when you lose connection (your changes still save locally)',
      'Note cards can be colour-tagged — pick from 8 colours in the note editor and the card shows a coloured stripe, so you can group quests / NPCs / places at a glance',
      'DM: "Export Log" button on encounters copies the full initiative order with HP and AC to your clipboard, ready to paste into notes, a VTT or Discord',
      'Character portraits are now automatically resized and compressed on upload, so they take far less space, sync reliably, and no longer risk breaking cloud save on large images',
      'Spell links that were dead on Open5e now fall back to a working 5esrd.com page (or a 5esrd search) — 71 spells fixed, including some official ones like Counterspell',
      'The Ritual / Concentration / Prepared checkboxes on the spell form are now smooth toggle switches, matching the rest of the app',
      'Notes: Delete is now its own mode with a dedicated button, separate from Reorder — turn on Delete to remove folders or cards (with the same multi-step confirm), turn on Reorder just to rearrange',
      'Your appearance settings — accent colour, font, text size and background — now sync to your account and apply automatically on any device you sign in on',
    ],
    fixes: [
      'Accent colour now updates the Notes folders instantly instead of only after leaving and reopening the page',
      'All remaining pop-up prompts (nickname, image URL, delete confirmations, DM/admin dialogs) are now in-app dialogs instead of the browser\'s native boxes, so they work properly on mobile and as an installed app',
      'Fixed spell reference links being re-broken on every load — repaired 5esrd links now stick instead of reverting to a dead Open5e page',
      'The spell detail link now correctly reads "View on 5esrd" or "View on Open5e" depending on where it actually points',
      'Removed unused internal layout code that never did anything',
    ],
  },
  {
    version: '1.15',
    date: '2026-07-12',
    title: 'v1.15 — Concentration, Multiclass & Spell Sources',
    updates: [
      'Concentration tracker: cast a concentration spell and a "Concentrating on…" banner appears in your Conditions area. Casting a different concentration spell asks first (since you can only hold one), and one tap clears it. It saves with your character',
      'You can now cast straight from your Favourites — favourited spells get the same one-tap "Cast" button as prepared spells, spending a matching slot and starting concentration where needed',
      'Multiclass support: an optional "+ Add multiclass" button under your Level reveals a second Class / Subclass / Level. Your proficiency bonus then uses your combined total level automatically. Single-class characters are completely unaffected',
      'Spell import now has a source picker: by default you only pull official D&D (SRD 5.1, Player\'s Handbook, Tasha\'s, Sword Coast), and you can flip on third-party books (Deep Magic, Tome of Heroes, Level Up A5e, Kobold Press and more) with smooth toggles. Your choice is remembered',
      'Conditions now show at-a-glance combat hint chips — e.g. Poisoned shows "Attacks & checks: Disadvantage", Prone shows the melee/ranged split — so you can see the key effects without reading the full text',
      'Note cards have templates: pick NPC, Location, Quest or Item when adding a card and it pre-fills a handy structure to fill in (blank cards still available)',
      'Keyboard shortcuts: Ctrl/Cmd+S saves your character, and Escape closes any open pop-up or help panel',
    ],
    fixes: [
      'The spell source options use smooth on/off toggle switches with a clean hover, matching the rest of the app',
      'Clarified that the "Warlock" spell source is Kobold Press\'s Warlock Magazine, not the Warlock class',
      'Removed unused internal layout code that never did anything',
    ],
  },
  {
    version: '1.14',
    date: '2026-07-11',
    title: 'v1.14 — Skill Expertise, Conditions Picker & a Huge DM Upgrade',
    updates: [
      'Skills now support half-proficiency and expertise: click the proficiency button on any skill to cycle None → Half (½) → Proficient (●) → Expertise (★). The total does the maths for you (half rounds down, expertise doubles), and proficient rows are tinted for quick scanning',
      'Conditions are now a proper picker: choose from all 14 official 5e conditions (effect text and an Open5e reference link fill in automatically), or flip the Custom switch to add your own with a link. Exhaustion tracks its 6 levels with − / + buttons right on the card',
      'Prepared spells & cantrips now show first under a "★ Ready" heading when adding actions from your sheet, so the spells you actually have are front and centre',
      'Spell cards now show an "At Higher Levels" / cantrip-scaling box, pulled from the spell text, so you can see how a spell grows when upcast',
      'Quick-cast: prepared spells now have a "Cast" button that spends a matching spell slot in one tap (upcasts to the next available slot if needed)',
      'Spell search now matches effect text, not just names — search "charmed" or "fire" to find every spell that does it',
      'Custom resources have one-tap templates: Ki, Sorcery Points, Bardic Inspiration, Rage, Channel Divinity and more',
      'DM encounter generator: 18 new foe themes including a dedicated Bandit Gang / Hideout, Pure Humans, Cultists, Mercenaries, Pirates, Demons vs Devils, Celestials, Swarms, Lycanthropes and an "Any Non-Humanoid" option',
      'DM encounter generator: 8 new battle types — Gang / Rabble, Protect the VIP, Artillery Battery, Pincer, Escalating Waves, Skirmishers, Lone Hunter and Standoff — each with tactics and read-aloud intros',
      'DM encounters now have 5–6 read-aloud intros per theme and a "Reroll Intro" button to spin up a fresh opener',
      'DM difficulty helper: if your chosen foes are too weak for the difficulty, it now promotes a few of them to elites (★) automatically, and offers to borrow a tougher creature, add more troops, change theme, or build your own — all from one menu',
      'DMs can now toggle any creature to "Elite" (★) from the combatant list to instantly buff its HP, AC and damage',
      'All pop-up messages and confirmations are now in-app toasts and dialogs instead of the browser\'s native boxes, so they work properly on mobile and as an installed app',
      'Owner tools: per-character "Export JSON" button and a character-count badge on each user in the admin portal',
    ],
    fixes: [
      'Fixed custom spells losing their Open5e link — the link field in the spell form now saves and loads correctly',
      'The healing potion list now uses the correct 5e potions (Healing 2d4+2, Greater 4d4+4, Superior 8d4+8, Supreme 10d4+20); the old duplicate "Minor" entry is gone and existing characters carry over cleanly',
      'Conditions now save reliably with a stable id (the old version could remove the wrong condition), and keep their link and exhaustion level',
      'The "Add Condition" button no longer overlaps the section help (?) icon',
      'Potion and CON-modifier colours now follow your chosen theme instead of being hard-coded',
      'Sync Up / Sync Down buttons are more robust and can\'t silently stop working',
      'Corrected the spell count shown around the app (the database is now 1,100+ spells)',
      'Updated the inventory tip that mentioned drag-and-drop that didn\'t exist',
    ],
  },
  {
    version: '1.13',
    date: '2026-07-08',
    title: 'v1.13 — Cleaner Look & Weapon Ability Choice',
    updates: [
      'Weapons can now roll off any ability — Strength, Dexterity, Constitution, Intelligence, Wisdom or Charisma — so things like a Warlock\'s Charisma pact weapon work properly',
      'The roll log is now tucked behind a small "View roll log" button so it stays out of the way; your rolls are still saved to your sheet',
      'Removed emojis across the whole sheet for a cleaner, more grown-up look — buttons now use short text labels (Hit / Dmg / Adv / Dis / Crit, Edit / Del)',
      'Favourites use a star that turns gold when starred; green ticks are kept where a checkmark is genuinely useful',
    ],
    fixes: [
      'Toggle controls no longer use hover-breaking tickboxes',
    ],
  },
  {
    version: '1.12',
    date: '2026-07-07',
    title: 'v1.12 — Polish & Help',
    updates: [
      'Tickboxes in the Add-from-sheet pickers and the weapon form are now clean on/off toggle switches (matching the rest of the app) instead of checkboxes that looked broken on hover — includes the "Search everything in D&D 5e" toggle and the weapon Proficient toggle',
      'Expanded the in-section help (the ? button, top-right) for Actions and Weapons to fully explain the new sections, "Add from sheet" search, custom cards, magic bonus, overrides, the fair dice roller and the roll log',
    ],
    fixes: [
      'Fixed the "Search everything" and weapon Proficient tickboxes jumping/breaking when you hovered them',
    ],
  },
  {
    version: '1.11',
    date: '2026-07-07',
    title: 'v1.11 — Actions Overhaul, Fair Dice & Weapon Rolls',
    updates: [
      'Actions are now split into three clear sections — Actions, Bonus Actions, and Features & Traits — each with its own list',
      'New "Add from sheet" picker on every section: search your own weapons, spells, items and racial traits, or flip a toggle to search everything in D&D 5e. Spells route to the right section automatically by casting time',
      'Pull racial traits (Darkvision, Fey Ancestry, Breath Weapon and more) straight into your Features & Traits from the built-in race library',
      '"Add custom" lets you write any action, bonus action or feature by hand — with an optional reference link that shows a "View rules" button on the card',
      'Weapons got a full rebuild: add any D&D 5e weapon from the catalogue with its dice pre-filled, or build a custom one with dropdowns for damage dice, type, attack ability and category',
      'Add a magic bonus (+1 to +5) to any weapon — it applies to both attack and damage, and shows on the card (e.g. "Longsword +2")',
      'Fair dice roller on every weapon: roll To Hit (with Advantage/Disadvantage) and Damage (with Crit) — every die is shown, natural 20s and 1s are highlighted, and the rolls use true cryptographic randomness so every result is perfectly fair',
      'Pick your table\'s critical hit rule (in the Weapons help panel): Double dice (official), Max + roll (Savage), Double total, or Max damage',
      'Full homebrew control on weapons — custom dice expressions, damage override, to-hit override, proficiency toggle and extra damage bonus',
      'Your rolls are now saved to a Roll Log on your sheet, grouped by day',
      'Owner Admin Portal now has a Logs tab — browse roll logs by campaign and character, with a compressed export',
      'Exports are now a readable text character sheet you can open and read anywhere — with the importable data tucked at the bottom so it still re-imports perfectly',
    ],
    fixes: [
      'Popups no longer scroll the page behind them or jump to the top — the background stays put while you scroll inside a popup',
      'Importing a blank or corrupted file now warns you before creating an empty character',
      'Old character exports and saves keep working unchanged — nothing needs re-doing',
    ],
  },
  {
    version: '1.10',
    date: '2026-07-02',
    title: 'v1.10 — DM Encounter Overhaul',
    updates: [
      'Every creature in an encounter is now a card you can open — click it for the full stat block (traits, actions, reactions, legendary actions) with a link straight to its Open5e page. Works from the builder, the initiative order, and saved encounters',
      'Initiative is now rolled properly as d20 + the creature\'s real Dexterity, and you can override any creature\'s Initiative, HP and AC right on its row',
      'Add your players into the encounter (name + their initiative total) — the list sorts into a clear turn order, and player rows stand out from monsters',
      'Drag any combatant row to reorder it, or toggle between initiative order and your own manual order',
      'Loads of new encounter variety: 7 new monster themes (Aberrations, Dragons, Giants, Fey, Constructs, Oozes & Vermin, Elementals) plus combo packs, and new battle types — Ambush, Gauntlet (waves), Vanguard + Archers, Twin Threat, Siege and Rival Duel',
      'Each generated encounter now comes with a proper "how to run it" tactics writeup for that battle type, plus a layered read-aloud intro',
      'Encounters now run 50% beefier than the standard baseline for a tougher fight, while still showing the correct difficulty label',
      'Refreshed the DM header — tabs are now grouped with icons and the pages have a cleaner, more consistent look',
    ],
    fixes: [
      'The generated difficulty now always matches what you picked — pick Medium and it reads Medium, never a tier higher or lower',
      'Leaving the creature count blank no longer floods the encounter with monsters — it now picks a sensible number for the chosen battle type',
      'Cleaned up the party setup (players/level) and the add-player row so the text fits and reads clearly',
    ],
  },
  {
    version: '1.09',
    date: '2026-06-28',
    title: 'v1.09 — Per-Character Campaigns & DM Item Library',
    updates: [
      'Joining a campaign is now per-character — each of your characters joins independently, right from the Stats → Character Info section',
      'New DM Items tab: browse the full Open5e magic item library, search by name and filter by rarity, and add items straight to an NPC\'s loot',
      'DM Player Spells view now shows each player\'s currently prepared spells (updates as players change their preparation — just hit Refresh)',
    ],
    fixes: [
      'Fixed campaign membership so switching between your characters no longer carries the campaign link across all of them',
      'Removed players now clear correctly across every DM and Admin view',
      'Tidied the Ability Scores layout so the stat and bonus columns line up cleanly',
    ],
  },
  {
    version: '1.08',
    date: '2026-06-27',
    title: 'v1.08 — Simpler Campaigns & Cleaner Admin',
    updates: [
      'Joining a campaign is now done from Settings → Campaign Access — enter the campaign password and you are in, no waiting for approval',
      'Joining a campaign no longer changes anything about your sheet — it simply gives your DM view-only access to help them plan around your character',
      'Your Stats page now shows a small "In campaign" badge only when you are actually in one',
      'DMs viewing a player sheet now see when it was last saved, so they know the info is up to date',
      'The Admin user list is now a tidy card grid with search, an active-now indicator, device counts and last-seen times',
    ],
    fixes: [
      'Removing a player from a campaign now works instantly, even if that player is offline at the time',
      'Tidied up old behind-the-scenes code left over from the previous campaign system',
    ],
  },
  {
    version: '1.07',
    date: '2026-06-27',
    title: 'v1.07 — All Spells & Smart Summaries',
    updates: [
      'Importing spells now includes every spell from all supported rulebooks — Deep Magic, Tome of Heroes, A5e, Warlock, Kobold Press and more — not just the SRD',
      'Each spell now shows which book it comes from with a small source badge',
      'Spell details now open with a short, easy-to-read summary of how the spell works instead of a wall of text',
      'Upcasting ("at higher levels") info is kept and shown on its own clear line in the summary',
      'Every spell links straight to its full entry on Open5e for the complete rules text',
    ],
    fixes: [
      'Spell data now refreshes properly after an update instead of loading an old cached copy',
    ],
  },
  {
    version: '1.06',
    date: '2026-06-26',
    title: 'v1.06 — DM Portal Revamp',
    updates: [
      'The DM Portal now fully matches your character sheet — same theme, colours, and styling everywhere, so it feels like one app',
      'It follows your chosen accent colour throughout',
      'New "Player Spells & Actions" view shows every player\'s spells in one table, highlighting any overlaps',
      'Smoother in-app pop-ups and messages across the DM tools',
      'Owners can now drop into any campaign to view or manage it',
    ],
    fixes: [
      'Tidied the DM Portal under the hood for a cleaner, more reliable experience',
    ],
  },
  {
    version: '1.05',
    date: '2026-06-24',
    title: 'v1.05 — DM Portal Polish',
    updates: [
      'The Dungeon Master Portal now sits right under your character list on the home page',
      'New sections are taking shape in the DM Portal — more coming soon',
      'Clearer, friendlier messages throughout the DM and Admin areas',
    ],
    fixes: [
      'Player lists in the DM and Admin areas now load reliably',
    ],
  },
  {
    version: '1.04',
    date: '2026-06-23',
    title: 'v1.04 — Campaign Join Approval',
    updates: [
      'Joining a campaign now requires DM approval: enter the join password to send a request, then the DM (or owner) approves it before you are linked',
      'While waiting, your campaign picker locks and shows a "Pending DM approval" status; once approved it switches to "Joined"',
      'DM portal Players tab now has a "Pending Players" panel with Approve / Deny buttons for each request',
      'DMs and the owner can now Remove a player from a campaign — this clears the player\'s campaign field and lets them request to re-join',
      'Admin portal campaign view mirrors all of this: pending list with Approve/Deny and a Remove button per linked player',
      'Once joined, the player\'s campaign field is locked so they cannot silently change or leave it',
    ],
    fixes: [
      'A player removed while offline is reconciled automatically the next time they open their sheet',
    ],
  },
  {
    version: '1.03',
    date: '2026-06-22',
    title: 'v1.03 — Two-Password Campaigns',
    updates: [
      'Campaigns now have two separate passwords: a DM control password (DM enters to take control of the campaign) and a player join password (players enter to join from their character sheet)',
      'DM portal entry redesigned — pick your campaign from a dropdown and enter the DM control password to take control. No more access-request approval step',
      'Admin portal campaign manager now has separate "DM Password" and "Player Password" buttons, and the create form takes both passwords',
      'DMs can still change the player join password from the DM portal Settings tab',
    ],
    fixes: [
      'Campaigns now reliably appear in the player join dropdown — removed the Firestore sort that silently required a missing index',
    ],
  },
  {
    version: '1.02',
    date: '2026-06-22',
    title: 'v1.02 — Admin & Campaign Update',
    updates: [
      'DM portal Settings tab now has a Campaign Password section — DMs can change the player join password for their campaign directly from the portal',
      'Admin portal campaign manager now supports changing campaign join passwords alongside existing DM assignment and activate/deactivate controls',
    ],
    fixes: [
      'Admin preview mode no longer disables Export, Import, and Save buttons — those remain usable while previewing a character',
      'Autosave now exits early during admin preview so viewing another player\'s sheet cannot overwrite your own data',
      'Campaign dropdown now loads correctly on sign-in even when Firebase wasn\'t fully ready on first page load',
    ],
  },
  {
    version: '1.01',
    date: '2026-06-21',
    title: 'v1.01 — Mini Patch',
    updates: [
      'DM Portal foundation added — request access from the home page, DM screen with its own nav, tabs, and session management',
      'Background text fields now expand after 800 characters instead of 450',
    ],
    fixes: [
      'Autosave no longer creates a ghost blank character if triggered before any character is selected',
      'Cloud merge now correctly keeps local data when timestamps are equal — cloud only wins if strictly newer',
      'Snapshot echo suppression window extended from 10s to 30s to cover slow networks',
      'Cloud sync now refuses to write an empty character list to localStorage — prevents data wipe on bad sync response',
      'Sign-in notification spam fixed for test accounts',
    ],
  },
  {
    version: '1.0',
    date: '2026-06-17',
    title: 'JozzDNDSheet 1.0 — Official Release',
    release: true,
    subtitle: 'This is the clean slate. Started somewhere around August 2025 as a personal side project with no real plan, just a need for a character sheet that actually worked the way I wanted it to. A lot of sessions later, here we are. The sheet is in a state I am genuinely happy with. It does what it needs to do, it looks good doing it, and it holds up in a real session at the table. That is version 1.0. Everything from here gets logged properly so there is a real record of what changes and why.',
    updates: [
      'What\'s New system added — version history on the home page, NEW badge pulses until you visit',
      'Help tooltips on every section — tap ? for a walkthrough, tap anywhere to close',
      'Spell slots can now be drag-reordered and edited — rename, change max uses, set rest reset type',
      'Long rest and short rest now properly reset spell slots and custom resources',
      'Notes rebuilt from scratch — folder and card system with 10 built-in folders for Quests, NPCs, Lore, Locations and more',
      'Cloud sync now per-character — faster, safer, live updates from other devices within seconds',
      'Background images, font selection, encumbrance, item refill system and portrait upload all added',
      'Favourite characters, manual save, Google sign-in with device tracking',
      'Spell slot custom resources — Ki points, Sorcery Points, anything with its own rest reset',
    ],
    fixes: [
      'Long and short rest were not resetting slots or resources at all',
      'Spell edit was creating duplicates when a spell was renamed mid-edit',
      'Storage container items were showing in the wrong containers',
      'Character data was being wiped on load in certain conditions',
    ],
  },
];

const COMING_SOON = [
  'Dice roller — click any damage value like "2d6+3" to roll it instantly',
  'Concentration tracker — prominent banner when a concentration spell is active',
  'Markdown rendering in note cards — bold, italic, bullet lists',
  'Drag-and-drop reorder for inventory items and actions',
  'Temp HP as a proper separate field',
  'Hit dice pool tracker across short rests',
  'Expertise toggle on skills (half-proficiency and double proficiency)',
  'Per-character accent colour',
  'Spell slot quick-cast button from the Prepared Spells table',
  'Offline indicator when sync is paused',
];

// ============================================================

const CHANGELOG_SEEN_KEY = 'dndChangelogSeen';

function getChangelogSeenVersion() {
  return localStorage.getItem(CHANGELOG_SEEN_KEY) || '';
}

function markChangelogSeen() {
  localStorage.setItem(CHANGELOG_SEEN_KEY, CHANGELOG_LATEST_VERSION);
  const badge = document.getElementById('homeNewBadge');
  if (badge) badge.style.display = 'none';
}

function hasUnseenChangelog() {
  return getChangelogSeenVersion() !== CHANGELOG_LATEST_VERSION;
}

const CHANGELOG_VISIBLE_LIMIT = 5;
let changelogShowAll = false;

function renderChangelogEntries() {
  const container = document.getElementById('changelogContent');
  if (!container) return;

  const entries = changelogShowAll ? CHANGELOG : CHANGELOG.slice(0, CHANGELOG_VISIBLE_LIMIT);
  const hasMore = CHANGELOG.length > CHANGELOG_VISIBLE_LIMIT;

  container.innerHTML = entries.map((entry, i) => `
    <div class="changelog-entry ${i === 0 ? 'changelog-entry-latest' : ''} ${entry.release ? 'changelog-entry-release' : ''}">
      <div class="changelog-entry-header" onclick="this.parentElement.classList.toggle('changelog-entry-open')">
        <span class="changelog-version">v${entry.version}</span>
        ${entry.release ? '<span class="changelog-release-badge">RELEASE</span>' : ''}
        <span class="changelog-title">${entry.title}</span>
        <span class="changelog-date">${entry.date}</span>
        <span class="changelog-chevron">▸</span>
      </div>
      <div class="changelog-entry-body">
        ${entry.subtitle ? `<p class="changelog-subtitle">${entry.subtitle}</p>` : ''}
        ${entry.updates.length ? `
          <p class="changelog-section-label">What\'s new</p>
          <ul>${entry.updates.map(u => `<li>${u}</li>`).join('')}</ul>
        ` : ''}
        ${entry.fixes.length ? `
          <p class="changelog-section-label">Fixed</p>
          <ul>${entry.fixes.map(f => `<li>${f}</li>`).join('')}</ul>
        ` : ''}
      </div>
    </div>
  `).join('');

  // Auto-open the latest entry
  const first = container.querySelector('.changelog-entry-latest');
  if (first) first.classList.add('changelog-entry-open');

  // Show/hide the view-all toggle
  const toggle = document.getElementById('changelogViewAllBtn');
  if (toggle) {
    if (hasMore) {
      toggle.style.display = 'block';
      toggle.textContent = changelogShowAll
        ? `Show recent only (last ${CHANGELOG_VISIBLE_LIMIT})`
        : `View all updates from launch ↓ (${CHANGELOG.length - CHANGELOG_VISIBLE_LIMIT} more)`;
    } else {
      toggle.style.display = 'none';
    }
  }
}

function toggleChangelogViewAll() {
  changelogShowAll = !changelogShowAll;
  renderChangelogEntries();
}

function renderChangelog() {
  renderChangelogEntries();

  const comingContainer = document.getElementById('changelogComingSoon');
  if (comingContainer) {
    comingContainer.innerHTML = `<ul>${COMING_SOON.map(c => `<li>${c}</li>`).join('')}</ul>`;
  }
}

function scrollToChangelog() {
  const card = document.querySelector('.changelog-card');
  if (card) card.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function initChangelog() {
  renderChangelog();
  const heroVersion = document.getElementById('heroVersion');
  if (heroVersion) heroVersion.textContent = 'v' + CHANGELOG_LATEST_VERSION;
  const badge = document.getElementById('homeNewBadge');
  const unseen = hasUnseenChangelog();
  if (badge) badge.style.display = unseen ? 'inline-block' : 'none';

  // Show/hide the jump link in the card header
  const jumpLink = document.getElementById('changelogJumpLink');
  if (jumpLink) jumpLink.style.display = 'inline-block';

  // Auto-scroll to changelog card if there are unseen changes
  if (unseen) {
    setTimeout(scrollToChangelog, 350);
  }
}
