// ============================================================
// CHANGELOG — edit this file at the end of each session
// ============================================================
// LATEST_VERSION must match the most recent entry's version.
// When you bump this, all users will see the "NEW" badge on
// the Home button until they visit the home page.
// ============================================================

const CHANGELOG_LATEST_VERSION = '1.02';

const CHANGELOG = [
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
