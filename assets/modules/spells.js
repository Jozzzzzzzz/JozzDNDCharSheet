// ========== SPELL SYSTEM ==========

// Spell data storage
let spellsData = {
  cantrips: [],
  spells: []
};

// Favorites storage
let favoritesData = {
  cantrips: [],
  spells: []
};

// Class/level selections for import
let classLevelSelections = [];
let importMode = 'both'; // 'cantrip' | 'spell' | 'both'

// Clear all confirmation tracking
let clearAllConfirmations = {
  cantrip: 0,
  spell: 0
};

// Manual spell slots tracking (similar to custom resources)
let manualSpellSlots = [];
let manualSpellSlotsUsed = {};

// Custom resources tracking
let customResources = [];
let customResourcesUsed = {};

const SPELL_RECORD_FIELD_ORDER = [
  'name',
  'level',
  'school',
  'castingTime',
  'range',
  'components',
  'duration',
  'damage',
  'save',
  'attack',
  'ritual',
  'concentration',
  'prepared',
  'classes',
  'sourceBook',
  'summary',
  'description',
  'wikiLink'
];

function normalizeSpellRecord(spell, fallback = {}) {
  const source = spell && typeof spell === 'object' ? spell : {};
  const base = fallback && typeof fallback === 'object' ? fallback : {};
  const levelValue = Number.parseInt(source.level ?? base.level ?? 0, 10);
  const normalizedLevel = Number.isFinite(levelValue) ? levelValue : 0;
  const mergedClasses = [
    ...(Array.isArray(base.classes) ? base.classes : []),
    ...(Array.isArray(source.classes) ? source.classes : [])
  ];

  const normalized = {
    name: String(source.name ?? base.name ?? ''),
    level: normalizedLevel,
    school: String(source.school ?? base.school ?? ''),
    castingTime: String(source.castingTime ?? base.castingTime ?? ''),
    range: String(source.range ?? base.range ?? ''),
    components: String(source.components ?? base.components ?? ''),
    duration: String(source.duration ?? base.duration ?? ''),
    damage: String(source.damage ?? base.damage ?? ''),
    save: String(source.save ?? base.save ?? ''),
    attack: String(source.attack ?? base.attack ?? ''),
    ritual: Boolean(source.ritual ?? base.ritual ?? false),
    concentration: Boolean(source.concentration ?? base.concentration ?? false),
    prepared: Boolean(source.prepared ?? base.prepared ?? false),
    classes: [...new Set(mergedClasses)],
    sourceBook: String(source.sourceBook ?? base.sourceBook ?? ''),
    summary: String(source.summary ?? base.summary ?? ''),
    description: String(source.description ?? base.description ?? ''),
    wikiLink: String(source.wikiLink ?? base.wikiLink ?? '')
  };

  // Keep key order stable for rendering/export readability.
  return SPELL_RECORD_FIELD_ORDER.reduce((acc, key) => {
    acc[key] = normalized[key];
    return acc;
  }, {});
}

function normalizeSpellsDataContainer(data) {
  const source = data && typeof data === 'object' ? data : {};
  return {
    cantrips: (Array.isArray(source.cantrips) ? source.cantrips : []).map(spell => normalizeSpellRecord(spell)),
    spells: (Array.isArray(source.spells) ? source.spells : []).map(spell => normalizeSpellRecord(spell))
  };
}


// Spell database — loaded from local spells.json then enriched from Open5e API
let spellDatabase = {};

// Convert a spell name to an Open5e URL slug
function spellNameToOpen5eSlug(name) {
  return name.toLowerCase().replace(/['’]/g, '').replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
}

// Generate an Open5e web link for a spell.
// Open5e URLs require a SOURCE-PREFIXED slug (e.g. srd-2024_shatter). A bare slug
// (open5e.com/spells/shatter) now 302-redirects to a "choose your source" page
// instead of the spell, so we always emit the current SRD (srd-2024_) prefix as
// the sensible default. If the caller passes an already-prefixed key
// (contains "_"), it's used verbatim. tools/fix-spell-keys.js sets the exact
// per-source key on every catalogue spell; this helper is the runtime fallback
// for user-added spells / spells with no stored wikiLink.
const OPEN5E_DEFAULT_SPELL_PREFIX = 'srd-2024';
function open5eSpellLink(slugOrName) {
  let slug = slugOrName.includes(' ') ? spellNameToOpen5eSlug(slugOrName) : slugOrName;
  // Already a full source-prefixed key — use as-is.
  if (!slug.includes('_')) slug = `${OPEN5E_DEFAULT_SPELL_PREFIX}_${slug}`;
  return `https://open5e.com/spells/${slug}`;
}

async function loadSpellDatabase() {
  // Step 1: load local spells.json as the base (fast, works offline)
  try {
    // Cache-bust the data file the same way scripts are, so updated spell data
    // (e.g. new summaries) isn't served stale from the browser cache.
    const dataVersion = (typeof window !== 'undefined' && window.__SCRIPT_VERSION__) || Date.now();
    const resp = await fetch(`assets/data/spells.json?v=${dataVersion}`);
    const spells = await resp.json();
    spellDatabase = {};
    spells.forEach(spell => {
      if (spell && spell.name) {
        // Upgrade any wikidot links to Open5e on load
        if (spell.wikiLink && spell.wikiLink.includes('wikidot.com')) {
          spell.wikiLink = open5eSpellLink(spell.name);
        }
        if (!spell.wikiLink) {
          spell.wikiLink = open5eSpellLink(spell.name);
        }
        spellDatabase[spell.name] = spell;
      }
    });
    applyClassTagsToSpellCatalogs();
  } catch (err) {
    console.error('Failed to load local spell database:', err);
  }

  // Step 2: enrich from Open5e in the background — adds slugs, better descriptions, class lists
  enrichSpellDatabaseFromOpen5e();
}

async function enrichSpellDatabaseFromOpen5e() {
  try {
    let url = 'https://api.open5e.com/v1/spells/?limit=100&document__slug=wotc-srd';
    while (url) {
      const resp = await fetch(url);
      if (!resp.ok) break;
      const data = await resp.json();
      (data.results || []).forEach(s => {
        if (!s || !s.name) return;
        const existing = spellDatabase[s.name];
        const link = `https://open5e.com/spells/${s.slug}`;
        if (existing) {
          // Enrich existing entry — preserve user-facing fields, upgrade description.
          // Do NOT clobber a good link:
          //  - 5esrd repairs (spells Open5e 404s, fixed by tools/verify-spell-links.js).
          //  - source-prefixed Open5e keys (e.g. srd_shatter / srd-2024_shatter, fixed by
          //    tools/fix-spell-keys.js). The v1 API only returns BARE slugs (shatter), and
          //    open5e.com/spells/<bare> now 302-redirects instead of landing on the spell,
          //    so overwriting a prefixed key with the bare one re-breaks the link.
          const repairedTo5esrd = existing.wikiLink && /5esrd\.com/i.test(existing.wikiLink);
          const hasPrefixedKey = existing.wikiLink && /open5e\.com\/spells\/[^\/?#]*_/.test(existing.wikiLink);
          if (!repairedTo5esrd && !hasPrefixedKey) existing.wikiLink = link;
          existing.open5eSlug = s.slug;
          if (s.desc && s.desc.length > (existing.description || '').length) {
            existing.description = s.desc;
          }
          if (s.dnd_class) {
            const classes = s.dnd_class.split(',').map(c => c.trim()).filter(Boolean);
            if (classes.length > 0) existing.classes = classes;
          }
        } else {
          // New spell from Open5e not in local JSON — add it
          spellDatabase[s.name] = {
            name: s.name,
            level: typeof s.level_int === 'number' ? s.level_int : parseInt(s.level, 10) || 0,
            school: s.school || '',
            castingTime: s.casting_time || '',
            range: s.range || '',
            components: s.components || '',
            duration: s.duration || '',
            damage: '',
            save: '',
            attack: '',
            ritual: s.ritual === 'yes' || s.ritual === true,
            concentration: s.concentration === 'yes' || s.concentration === true,
            prepared: false,
            classes: s.dnd_class ? s.dnd_class.split(',').map(c => c.trim()).filter(Boolean) : [],
            sourceBook: s.document__slug || 'SRD',
            description: s.desc || '',
            wikiLink: link,
            open5eSlug: s.slug
          };
        }
      });
      url = data.next || null;
    }
    applyClassTagsToSpellCatalogs();
  } catch (err) {
    // Open5e unavailable — local JSON is still the fallback, no user impact
    console.warn('Open5e enrichment unavailable (offline?):', err.message);
  }
}

const dndClasses = {
  'Artificer': {
    cantrips: ['Acid Splash', 'Dancing Lights', 'Fire Bolt', 'Guidance', 'Light', 'Mage Hand', 'Mending', 'Message', 'Minor Illusion', 'Poison Spray', 'Prestidigitation', 'Ray of Frost', 'Resistance', 'Shocking Grasp', 'Spare the Dying', 'Thorn Whip'],
    spells: {
      1: ['Absorb Elements', 'Alarm', 'Cure Wounds', 'Detect Magic', 'Disguise Self', 'Expeditious Retreat', 'Faerie Fire', 'False Life', 'Feather Fall', 'Grease', 'Identify', 'Jump', 'Longstrider', 'Purify Food and Drink', 'Sanctuary', 'Snare', 'Tasha\'s Caustic Brew'],
      2: ['Aid', 'Alter Self', 'Arcane Lock', 'Blur', 'Continual Flame', 'Darkvision', 'Enhance Ability', 'Enlarge/Reduce', 'Heat Metal', 'Invisibility', 'Lesser Restoration', 'Levitate', 'Magic Mouth', 'Magic Weapon', 'Protection from Poison', 'Pyrotechnics', 'Rope Trick', 'See Invisibility', 'Skywrite', 'Spider Climb', 'Suggestion', 'Web'],
      3: ['Blink', 'Catnap', 'Counterspell', 'Create Food and Water', 'Dispel Magic', 'Elemental Weapon', 'Flame Arrows', 'Fly', 'Glyph of Warding', 'Haste', 'Intellect Fortress', 'Protection from Energy', 'Revivify', 'Tiny Servant', 'Water Breathing', 'Water Walk'],
      4: ['Arcane Eye', 'Elemental Bane', 'Fabricate', 'Freedom of Movement', 'Leomund\'s Secret Chest', 'Mordenkainen\'s Faithful Hound', 'Mordenkainen\'s Private Sanctum', 'Otiluke\'s Resilient Sphere', 'Stone Shape', 'Stoneskin', 'Wall of Fire'],
      5: ['Animate Objects', 'Bigby\'s Hand', 'Creation', 'Greater Restoration', 'Skill Empowerment', 'Transmute Rock', 'Wall of Stone']
    }
  },
  'Bard': {
    cantrips: ['Blade Ward', 'Dancing Lights', 'Friends', 'Light', 'Mage Hand', 'Mending', 'Message', 'Minor Illusion', 'Prestidigitation', 'True Strike', 'Vicious Mockery'],
    spells: {
      1: ['Animal Friendship', 'Bane', 'Charm Person', 'Comprehend Languages', 'Cure Wounds', 'Detect Magic', 'Disguise Self', 'Faerie Fire', 'Feather Fall', 'Healing Word', 'Heroism', 'Identify', 'Illusory Script', 'Longstrider', 'Silent Image', 'Sleep', 'Speak with Animals', 'Tasha\'s Hideous Laughter', 'Thunderwave', 'Unseen Servant'],
      2: ['Animal Messenger', 'Blindness/Deafness', 'Calm Emotions', 'Cloud of Daggers', 'Crown of Madness', 'Detect Thoughts', 'Enhance Ability', 'Enthrall', 'Heat Metal', 'Hold Person', 'Invisibility', 'Knock', 'Lesser Restoration', 'Locate Object', 'Magic Mouth', 'Phantasmal Force', 'Shatter', 'Silence', 'Suggestion', 'Zone of Truth'],
      3: ['Bestow Curse', 'Clairvoyance', 'Dispel Magic', 'Fear', 'Feign Death', 'Glyph of Warding', 'Hypnotic Pattern', 'Leomund\'s Tiny Hut', 'Major Image', 'Nondetection', 'Plant Growth', 'Sending', 'Speak with Dead', 'Speak with Plants', 'Stinking Cloud', 'Tongues'],
      4: ['Compulsion', 'Confusion', 'Dimension Door', 'Freedom of Movement', 'Greater Invisibility', 'Hallucinatory Terrain', 'Locate Creature', 'Polymorph'],
      5: ['Animate Objects', 'Awaken', 'Dominate Person', 'Dream', 'Geas', 'Greater Restoration', 'Hold Monster', 'Legend Lore', 'Mass Cure Wounds', 'Mislead', 'Modify Memory', 'Planar Binding', 'Raise Dead', 'Scrying', 'Seeming', 'Teleportation Circle'],
      6: ['Eyebite', 'Find the Path', 'Guards and Wards', 'Heroes\' Feast', 'Mass Suggestion', 'Otto\'s Irresistible Dance', 'Programmed Illusion', 'True Seeing'],
      7: ['Etherealness', 'Forcecage', 'Mirage Arcane', 'Mordenkainen\'s Magnificent Mansion', 'Mordenkainen\'s Sword', 'Project Image', 'Regenerate', 'Resurrection', 'Symbol', 'Teleport'],
      8: ['Dominate Monster', 'Feeblemind', 'Glibness', 'Mind Blank', 'Power Word Stun'],
      9: ['Foresight', 'Power Word Kill', 'Psychic Scream', 'True Polymorph']
    }
  },
  'Cleric': {
    cantrips: ['Guidance', 'Light', 'Mending', 'Resistance', 'Sacred Flame', 'Spare the Dying', 'Thaumaturgy'],
    spells: {
      1: ['Bane', 'Bless', 'Command', 'Create or Destroy Water', 'Cure Wounds', 'Detect Evil and Good', 'Detect Magic', 'Detect Poison and Disease', 'Guiding Bolt', 'Healing Word', 'Inflict Wounds', 'Protection from Evil and Good', 'Purify Food and Drink', 'Sanctuary', 'Shield of Faith'],
      2: ['Aid', 'Augury', 'Blindness/Deafness', 'Calm Emotions', 'Continual Flame', 'Enhance Ability', 'Find Traps', 'Gentle Repose', 'Hold Person', 'Lesser Restoration', 'Locate Object', 'Prayer of Healing', 'Protection from Poison', 'Silence', 'Spiritual Weapon', 'Warding Bond', 'Zone of Truth'],
      3: ['Animate Dead', 'Beacon of Hope', 'Bestow Curse', 'Clairvoyance', 'Create Food and Water', 'Daylight', 'Dispel Magic', 'Feign Death', 'Glyph of Warding', 'Locate Object', 'Magic Circle', 'Mass Healing Word', 'Meld into Stone', 'Protection from Energy', 'Remove Curse', 'Revivify', 'Sending', 'Speak with Dead', 'Spirit Guardians', 'Tongues', 'Water Walk'],
      4: ['Banishment', 'Control Water', 'Death Ward', 'Divination', 'Freedom of Movement', 'Guardian of Faith', 'Locate Creature', 'Stone Shape'],
      5: ['Commune', 'Contagion', 'Dispel Evil and Good', 'Flame Strike', 'Geas', 'Greater Restoration', 'Hallow', 'Insect Plague', 'Legend Lore', 'Mass Cure Wounds', 'Planar Binding', 'Raise Dead', 'Scrying', 'Tree Stride'],
      6: ['Blade Barrier', 'Create Undead', 'Find the Path', 'Forbiddance', 'Harm', 'Heal', 'Heroes\' Feast', 'Planar Ally', 'True Seeing', 'Word of Recall'],
      7: ['Conjure Celestial', 'Divine Word', 'Etherealness', 'Fire Storm', 'Plane Shift', 'Regenerate', 'Resurrection', 'Symbol'],
      8: ['Antimagic Field', 'Control Weather', 'Earthquake', 'Holy Aura'],
      9: ['Astral Projection', 'Gate', 'Mass Heal', 'True Resurrection']
    }
  },
  'Druid': {
    cantrips: ['Druidcraft', 'Guidance', 'Mending', 'Poison Spray', 'Produce Flame', 'Resistance', 'Shillelagh', 'Thorn Whip'],
    spells: {
      1: ['Animal Friendship', 'Charm Person', 'Create or Destroy Water', 'Cure Wounds', 'Detect Magic', 'Detect Poison and Disease', 'Entangle', 'Faerie Fire', 'Fog Cloud', 'Goodberry', 'Healing Word', 'Jump', 'Longstrider', 'Purify Food and Drink', 'Speak with Animals', 'Thunderwave'],
      2: ['Animal Messenger', 'Barkskin', 'Beast Sense', 'Darkvision', 'Enhance Ability', 'Find Traps', 'Flame Blade', 'Flaming Sphere', 'Gust of Wind', 'Heat Metal', 'Hold Person', 'Lesser Restoration', 'Locate Object', 'Moonbeam', 'Pass without Trace', 'Protection from Poison', 'Spike Growth'],
      3: ['Call Lightning', 'Conjure Animals', 'Daylight', 'Dispel Magic', 'Feign Death', 'Flame Arrows', 'Giant Insect', 'Gust of Wind', 'Meld into Stone', 'Plant Growth', 'Protection from Energy', 'Sleet Storm', 'Speak with Plants', 'Water Breathing', 'Water Walk', 'Wind Wall'],
      4: ['Blight', 'Confusion', 'Conjure Minor Elementals', 'Conjure Woodland Beings', 'Control Water', 'Dominate Beast', 'Freedom of Movement', 'Giant Insect', 'Grasping Vine', 'Hallucinatory Terrain', 'Ice Storm', 'Locate Creature', 'Polymorph', 'Stone Shape', 'Stoneskin', 'Wall of Fire'],
      5: ['Antilife Shell', 'Awaken', 'Commune with Nature', 'Conjure Elemental', 'Contagion', 'Geas', 'Greater Restoration', 'Insect Plague', 'Mass Cure Wounds', 'Planar Binding', 'Reincarnate', 'Scrying', 'Tree Stride', 'Wall of Stone'],
      6: ['Conjure Fey', 'Find the Path', 'Heal', 'Heroes\' Feast', 'Move Earth', 'Sunbeam', 'Transport via Plants', 'True Seeing', 'Wall of Thorns', 'Wind Walk'],
      7: ['Fire Storm', 'Mirage Arcane', 'Plane Shift', 'Regenerate', 'Reverse Gravity'],
      8: ['Animal Shapes', 'Antipathy/Sympathy', 'Control Weather', 'Earthquake', 'Feeblemind', 'Sunburst', 'Tsunami'],
      9: ['Foresight', 'Shapechange', 'Storm of Vengeance', 'True Resurrection']
    }
  },
  'Paladin': {
    cantrips: [],
    spells: {
      1: ['Bless', 'Command', 'Compelled Duel', 'Cure Wounds', 'Detect Evil and Good', 'Detect Magic', 'Detect Poison and Disease', 'Divine Favor', 'Heroism', 'Protection from Evil and Good', 'Purify Food and Drink', 'Searing Smite', 'Shield of Faith', 'Thunderous Smite', 'Wrathful Smite'],
      2: ['Aid', 'Branding Smite', 'Find Steed', 'Lesser Restoration', 'Locate Object', 'Magic Weapon', 'Protection from Poison', 'Zone of Truth'],
      3: ['Aura of Vitality', 'Blinding Smite', 'Create Food and Water', 'Crusader\'s Mantle', 'Daylight', 'Dispel Magic', 'Elemental Weapon', 'Magic Circle', 'Remove Curse', 'Revivify'],
      4: ['Aura of Life', 'Aura of Purity', 'Banishment', 'Death Ward', 'Locate Creature', 'Staggering Smite'],
      5: ['Banishing Smite', 'Circle of Power', 'Destructive Wave', 'Dispel Evil and Good', 'Geas', 'Raise Dead']
    }
  },
  'Ranger': {
    cantrips: [],
    spells: {
      1: ['Alarm', 'Animal Friendship', 'Cure Wounds', 'Detect Magic', 'Detect Poison and Disease', 'Ensnaring Strike', 'Fog Cloud', 'Goodberry', 'Hail of Thorns', 'Hunter\'s Mark', 'Jump', 'Longstrider', 'Speak with Animals'],
      2: ['Animal Messenger', 'Barkskin', 'Beast Sense', 'Cordon of Arrows', 'Darkvision', 'Find Traps', 'Lesser Restoration', 'Locate Object', 'Pass without Trace', 'Protection from Poison', 'Silence', 'Spike Growth'],
      3: ['Conjure Animals', 'Conjure Barrage', 'Daylight', 'Lightning Arrow', 'Locate Creature', 'Nondetection', 'Plant Growth', 'Protection from Energy', 'Speak with Plants', 'Water Breathing', 'Water Walk', 'Wind Wall'],
      4: ['Conjure Woodland Beings', 'Freedom of Movement', 'Grasping Vine', 'Locate Creature', 'Stoneskin'],
      5: ['Commune with Nature', 'Conjure Volley', 'Greater Restoration', 'Swift Quiver', 'Tree Stride']
    }
  },
  'Sorcerer': {
    cantrips: ['Acid Splash', 'Blade Ward', 'Chill Touch', 'Dancing Lights', 'Fire Bolt', 'Friends', 'Light', 'Mage Hand', 'Mending', 'Message', 'Minor Illusion', 'Poison Spray', 'Prestidigitation', 'Ray of Frost', 'Shocking Grasp', 'True Strike'],
    spells: {
      1: ['Burning Hands', 'Charm Person', 'Chromatic Orb', 'Color Spray', 'Comprehend Languages', 'Detect Magic', 'Disguise Self', 'Expeditious Retreat', 'False Life', 'Feather Fall', 'Fog Cloud', 'Jump', 'Mage Armor', 'Magic Missile', 'Ray of Sickness', 'Shield', 'Silent Image', 'Sleep', 'Thunderwave', 'Witch Bolt'],
      2: ['Alter Self', 'Blindness/Deafness', 'Blur', 'Cloud of Daggers', 'Crown of Madness', 'Darkness', 'Darkvision', 'Detect Thoughts', 'Enhance Ability', 'Enlarge/Reduce', 'Gust of Wind', 'Hold Person', 'Invisibility', 'Knock', 'Levitate', 'Mirror Image', 'Misty Step', 'Phantasmal Force', 'Scorching Ray', 'See Invisibility', 'Shatter', 'Spider Climb', 'Suggestion', 'Web'],
      3: ['Blink', 'Counterspell', 'Daylight', 'Fear', 'Fireball', 'Fly', 'Gaseous Form', 'Haste', 'Hypnotic Pattern', 'Lightning Bolt', 'Major Image', 'Protection from Energy', 'Sleet Storm', 'Slow', 'Stinking Cloud', 'Tongues', 'Water Breathing', 'Water Walk'],
      4: ['Banishment', 'Blight', 'Confusion', 'Dimension Door', 'Dominate Beast', 'Greater Invisibility', 'Ice Storm', 'Polymorph', 'Stoneskin', 'Wall of Fire'],
      5: ['Animate Objects', 'Cloudkill', 'Cone of Cold', 'Creation', 'Dominate Person', 'Hold Monster', 'Insect Plague', 'Seeming', 'Telekinesis', 'Teleportation Circle', 'Wall of Stone'],
      6: ['Arcane Gate', 'Chain Lightning', 'Circle of Death', 'Disintegrate', 'Eyebite', 'Globe of Invulnerability', 'Mass Suggestion', 'Move Earth', 'Otiluke\'s Freezing Sphere', 'Sunbeam', 'True Seeing'],
      7: ['Delayed Blast Fireball', 'Etherealness', 'Finger of Death', 'Fire Storm', 'Plane Shift', 'Prismatic Spray', 'Reverse Gravity', 'Teleport'],
      8: ['Dominate Monster', 'Earthquake', 'Incendiary Cloud', 'Power Word Stun', 'Sunburst'],
      9: ['Gate', 'Meteor Swarm', 'Power Word Kill', 'Time Stop', 'True Polymorph', 'Wish']
    }
  },
  'Warlock': {
    cantrips: ['Blade Ward', 'Chill Touch', 'Eldritch Blast', 'Friends', 'Mage Hand', 'Minor Illusion', 'Poison Spray', 'Prestidigitation', 'True Strike'],
    spells: {
      1: ['Armor of Agathys', 'Arms of Hadar', 'Charm Person', 'Comprehend Languages', 'Expeditious Retreat', 'Hellish Rebuke', 'Hex', 'Illusory Script', 'Protection from Evil and Good', 'Unseen Servant', 'Witch Bolt'],
      2: ['Cloud of Daggers', 'Crown of Madness', 'Darkness', 'Enthrall', 'Hold Person', 'Invisibility', 'Misty Step', 'Ray of Enfeeblement', 'Shatter', 'Spider Climb', 'Suggestion'],
      3: ['Counterspell', 'Dispel Magic', 'Fear', 'Fly', 'Gaseous Form', 'Hunger of Hadar', 'Hypnotic Pattern', 'Magic Circle', 'Major Image', 'Remove Curse', 'Tongues', 'Vampiric Touch'],
      4: ['Banishment', 'Blight', 'Dimension Door', 'Hallucinatory Terrain', 'Locate Creature'],
      5: ['Contact Other Plane', 'Dream', 'Hold Monster', 'Scrying']
    }
  },
  'Wizard': {
    cantrips: ['Acid Splash', 'Blade Ward', 'Chill Touch', 'Dancing Lights', 'Fire Bolt', 'Friends', 'Light', 'Mage Hand', 'Mending', 'Message', 'Minor Illusion', 'Poison Spray', 'Prestidigitation', 'Ray of Frost', 'Shocking Grasp', 'True Strike'],
    spells: {
      1: ['Alarm', 'Burning Hands', 'Charm Person', 'Chromatic Orb', 'Color Spray', 'Comprehend Languages', 'Detect Magic', 'Disguise Self', 'Expeditious Retreat', 'False Life', 'Feather Fall', 'Find Familiar', 'Fog Cloud', 'Grease', 'Identify', 'Illusory Script', 'Jump', 'Longstrider', 'Mage Armor', 'Magic Missile', 'Protection from Evil and Good', 'Ray of Sickness', 'Shield', 'Silent Image', 'Sleep', 'Tasha\'s Hideous Laughter', 'Tenser\'s Floating Disk', 'Thunderwave', 'Unseen Servant', 'Witch Bolt'],
      2: ['Alter Self', 'Arcane Lock', 'Blindness/Deafness', 'Blur', 'Cloud of Daggers', 'Continual Flame', 'Crown of Madness', 'Darkness', 'Darkvision', 'Detect Thoughts', 'Enhance Ability', 'Enlarge/Reduce', 'Flaming Sphere', 'Gentle Repose', 'Gust of Wind', 'Hold Person', 'Invisibility', 'Knock', 'Levitate', 'Locate Object', 'Magic Mouth', 'Magic Weapon', 'Melf\'s Acid Arrow', 'Mirror Image', 'Misty Step', 'Nystul\'s Magic Aura', 'Phantasmal Force', 'Pyrotechnics', 'Ray of Enfeeblement', 'Rope Trick', 'Scorching Ray', 'See Invisibility', 'Shatter', 'Spider Climb', 'Suggestion', 'Web'],
      3: ['Animate Dead', 'Bestow Curse', 'Blink', 'Clairvoyance', 'Counterspell', 'Daylight', 'Dispel Magic', 'Fear', 'Feign Death', 'Fireball', 'Fly', 'Gaseous Form', 'Glyph of Warding', 'Haste', 'Hypnotic Pattern', 'Leomund\'s Tiny Hut', 'Lightning Bolt', 'Magic Circle', 'Major Image', 'Nondetection', 'Phantom Steed', 'Protection from Energy', 'Remove Curse', 'Sending', 'Sleet Storm', 'Slow', 'Speak with Dead', 'Stinking Cloud', 'Tongues', 'Vampiric Touch', 'Water Breathing'],
      4: ['Arcane Eye', 'Banishment', 'Blight', 'Confusion', 'Conjure Minor Elementals', 'Control Water', 'Dimension Door', 'Evard\'s Black Tentacles', 'Fabricate', 'Fire Shield', 'Greater Invisibility', 'Hallucinatory Terrain', 'Ice Storm', 'Leomund\'s Secret Chest', 'Locate Creature', 'Mordenkainen\'s Faithful Hound', 'Mordenkainen\'s Private Sanctum', 'Otiluke\'s Resilient Sphere', 'Phantasmal Killer', 'Polymorph', 'Stone Shape', 'Stoneskin', 'Wall of Fire'],
      5: ['Animate Objects', 'Bigby\'s Hand', 'Cloudkill', 'Cone of Cold', 'Conjure Elemental', 'Contact Other Plane', 'Creation', 'Dominate Person', 'Dream', 'Geas', 'Hold Monster', 'Legend Lore', 'Mislead', 'Modify Memory', 'Passwall', 'Planar Binding', 'Rary\'s Telepathic Bond', 'Scrying', 'Seeming', 'Telekinesis', 'Teleportation Circle', 'Wall of Force', 'Wall of Stone'],
      6: ['Arcane Gate', 'Chain Lightning', 'Circle of Death', 'Contingency', 'Create Undead', 'Disintegrate', 'Drawmij\'s Instant Summons', 'Eyebite', 'Flesh to Stone', 'Globe of Invulnerability', 'Guards and Wards', 'Magic Jar', 'Mass Suggestion', 'Move Earth', 'Otiluke\'s Freezing Sphere', 'Otto\'s Irresistible Dance', 'Programmed Illusion', 'Sunbeam', 'True Seeing', 'Wall of Ice'],
      7: ['Delayed Blast Fireball', 'Etherealness', 'Finger of Death', 'Forcecage', 'Mirage Arcane', 'Mordenkainen\'s Magnificent Mansion', 'Mordenkainen\'s Sword', 'Plane Shift', 'Prismatic Spray', 'Project Image', 'Reverse Gravity', 'Sequester', 'Simulacrum', 'Symbol', 'Teleport'],
      8: ['Antimagic Field', 'Antipathy/Sympathy', 'Clone', 'Demiplane', 'Dominate Monster', 'Feeblemind', 'Incendiary Cloud', 'Maze', 'Mind Blank', 'Power Word Stun', 'Sunburst', 'Telepathy'],
      9: ['Astral Projection', 'Foresight', 'Gate', 'Imprisonment', 'Meteor Swarm', 'Power Word Kill', 'Prismatic Wall', 'Shapechange', 'Time Stop', 'True Polymorph', 'Weird', 'Wish']
    }
  },
  // Third-party classes — spell lists come entirely from spellDatabase classes field
  'Anti-Paladin':  { cantrips: [], spells: {} },
  'Herald':        { cantrips: [], spells: {} },
  'Ritual Caster': { cantrips: [], spells: {} }
};

function normalizeSpellName(name) {
  return String(name || '').trim();
}

// Best-effort source-book hints. Explicit `sourceBook` on a spell record always wins.
const SPELL_SOURCE_BOOK_OVERRIDES = {
  "Dream of the Blue Veil": "TCE",
  "Intellect Fortress": "TCE",
  "Spirit Shroud": "TCE",
  "Summon Celestial": "TCE",
  "Summon Beast": "TCE",
  "Summon Fey": "TCE",
  "Summon Elemental": "TCE",
  "Summon Shadowspawn": "TCE",
  "Summon Undead": "TCE",
  "Summon Aberration": "TCE",
  "Summon Fiend": "TCE",
  "Summon Construct": "TCE",
  "Mind Sliver": "TCE",
  "Tasha's Caustic Brew": "TCE",
  "Tasha's Mind Whip": "TCE",
  "Tasha's Otherworldly Guise": "TCE",
  "Blade of Disaster": "TCE",
  "Booming Blade": "SCAG/TCE",
  "Green-Flame Blade": "SCAG/TCE",
  "Lightning Lure": "SCAG/TCE",
  "Sword Burst": "SCAG/TCE"
};

function inferSourceBookForSpell(name) {
  const normalized = normalizeSpellName(name);
  return SPELL_SOURCE_BOOK_OVERRIDES[normalized] || 'PHB';
}

function buildSpellClassTagMap() {
  const tagMap = {};

  const addTag = (spellName, className) => {
    const normalized = normalizeSpellName(spellName);
    if (!normalized) return;
    if (!tagMap[normalized]) tagMap[normalized] = new Set();
    tagMap[normalized].add(className);
  };

  Object.entries(dndClasses).forEach(([className, classData]) => {
    (classData.cantrips || []).forEach(spellName => addTag(spellName, className));
    Object.values(classData.spells || {}).forEach(levelSpells => {
      (levelSpells || []).forEach(spellName => addTag(spellName, className));
    });
  });

  const output = {};
  Object.entries(tagMap).forEach(([spellName, classSet]) => {
    output[spellName] = Array.from(classSet).sort();
  });
  return output;
}

const spellClassTagMap = buildSpellClassTagMap();

function getClassTagsForSpellName(spellName) {
  return spellClassTagMap[normalizeSpellName(spellName)] || [];
}

function getCantripNamesForClass(className) {
  const fromTags = Object.entries(spellDatabase)
    .filter(([, spell]) => spell.level === 0 && Array.isArray(spell.classes) && spell.classes.includes(className)
      && spellSourceEnabled(spell))
    .map(([name]) => name)
    .sort();
  // The hardcoded dndClasses lists are core WotC (PHB) content — always allowed, but only
  // when at least one official source is enabled (unticking all official hides them too).
  const fallback = officialSourcesActive() ? (dndClasses[className]?.cantrips || []).slice() : [];
  return Array.from(new Set([...fromTags, ...fallback])).sort();
}

// True when any official (WotC) source is currently enabled — gates the hardcoded PHB
// fallback lists so unticking all official books also removes core spells from the pool.
function officialSourcesActive() {
  const enabled = _enabledSpellSourcesCache || getEnabledSpellSources();
  return officialSpellSourceKeys().some(k => enabled.has(k));
}

function getSpellNamesForClassUpToLevel(className, maxLevel) {
  const levelCap = Math.min(parseInt(maxLevel, 10) || 1, 9);
  const fromTags = Object.entries(spellDatabase)
    .filter(([, spell]) =>
      spell.level >= 1
      && spell.level <= levelCap
      && Array.isArray(spell.classes)
      && spell.classes.includes(className)
      && spellSourceEnabled(spell))
    .map(([name, spell]) => ({ name, level: spell.level }))
    .sort((a, b) => (a.level - b.level) || a.name.localeCompare(b.name));

  const mergedByName = new Map();
  fromTags.forEach(entry => mergedByName.set(entry.name, { name: entry.name, level: entry.level }));
  // Hardcoded dndClasses spell lists are core WotC (PHB) — included only when an official
  // source is enabled, so unticking all official books removes them from the pool too.
  if (officialSourcesActive()) {
    for (let i = 1; i <= levelCap; i++) {
      const levelSpells = dndClasses[className]?.spells?.[i] || [];
      levelSpells.forEach(name => {
        if (!mergedByName.has(name)) mergedByName.set(name, { name, level: i });
      });
    }
  }
  return Array.from(mergedByName.values())
    .sort((a, b) => (a.level - b.level) || a.name.localeCompare(b.name));
}

// Comprehensive D&D 5e Spell Database (Updated 2025)

function applyClassTagsToSpellCatalogs() {
  Object.entries(spellDatabase).forEach(([name, spell]) => {
    if (!Array.isArray(spell.classes) || spell.classes.length === 0) {
      const classes = getClassTagsForSpellName(name);
      if (classes.length > 0) spell.classes = classes;
    }
    if (!spell.sourceBook) {
      spell.sourceBook = inferSourceBookForSpell(name);
    }
  });
}

function backfillClassTagsOnKnownSpells() {
  [spellsData.cantrips, spellsData.spells].forEach(list => {
    if (!Array.isArray(list)) return;
    list.forEach(spell => {
      if (!spell || !spell.name) return;
      if (!Array.isArray(spell.classes) || spell.classes.length === 0) {
        spell.classes = getClassTagsForSpellName(spell.name);
      }
      if (!spell.sourceBook) {
        spell.sourceBook = inferSourceBookForSpell(spell.name);
      }
    });
  });
}


// ========== SPELL SOURCE PICKER ==========
// The import pool can be filtered by publishing source. "Official" = core WotC D&D
// (SRD 5.1 plus the locally-tagged PHB/Tasha's/Sword Coast spells); the rest are
// third-party books from Open5e. The chosen set is a GLOBAL UI preference (localStorage),
// not character data — it only affects what the import popup offers, never saved spells.
const SPELL_SOURCES = [
  { key: 'SRD 5.1',        label: 'SRD 5.1', official: true,  aliases: ['wotc-srd', 'SRD', 'srd'] },
  { key: 'PHB',            label: "Player's Handbook", official: true },
  { key: 'TCE',            label: "Tasha's Cauldron", official: true },
  { key: 'SCAG/TCE',       label: 'Sword Coast', official: true },
  { key: 'Deep Magic',     label: 'Deep Magic', official: false, aliases: ['deep-magic'] },
  { key: 'Deep Magic Extra', label: 'Deep Magic Extra', official: false },
  { key: 'Tome of Heroes', label: 'Tome of Heroes', official: false, aliases: ['tome-of-heroes'] },
  { key: 'A5e',            label: 'Level Up (A5e)', official: false, aliases: ['a5e'] },
  { key: 'Warlock',        label: 'Kobold: Warlock Mag.', official: false, aliases: ['warlock'] },
  { key: 'Kobold Press',   label: 'Kobold Press', official: false, aliases: ['kobold-press'] },
  { key: 'Open5e',         label: 'Open5e', official: false, aliases: ['open5e'] },
];

// Map any raw sourceBook value (canonical key or an Open5e slug/alias) to its canonical
// SPELL_SOURCES key, or '' if unrecognised.
function canonicalSpellSourceKey(raw) {
  if (!raw) return '';
  const v = String(raw).trim();
  for (const s of SPELL_SOURCES) {
    if (s.key === v) return s.key;
    if (Array.isArray(s.aliases) && s.aliases.includes(v)) return s.key;
  }
  return '';
}

const SPELL_SOURCES_PREF_KEY = 'dndSpellSources';

// The set of official source keys — the default enabled set.
function officialSpellSourceKeys() {
  return SPELL_SOURCES.filter(s => s.official).map(s => s.key);
}

// Load the enabled-source set from localStorage. Defaults to official-only. Unknown/legacy
// keys are ignored; an empty saved set falls back to official so import is never empty.
function getEnabledSpellSources() {
  let saved = null;
  try { saved = JSON.parse(localStorage.getItem(SPELL_SOURCES_PREF_KEY) || 'null'); } catch (e) { saved = null; }
  const valid = new Set(SPELL_SOURCES.map(s => s.key));
  if (Array.isArray(saved)) {
    const filtered = saved.filter(k => valid.has(k));
    if (filtered.length) return new Set(filtered);
  }
  return new Set(officialSpellSourceKeys());
}

function setEnabledSpellSources(keysSet) {
  try { localStorage.setItem(SPELL_SOURCES_PREF_KEY, JSON.stringify(Array.from(keysSet))); } catch (e) {}
}

// True if a spell (by its sourceBook) is allowed by the current enabled-source set.
// Spells with an unrecognised/blank source are treated as official so nothing that was
// always available silently disappears.
function spellSourceEnabled(spell) {
  const enabled = _enabledSpellSourcesCache || getEnabledSpellSources();
  const canonical = canonicalSpellSourceKey(spell && spell.sourceBook);
  if (!canonical) return true; // blank/unknown source → don't hide it
  return enabled.has(canonical);
}

// Cache of the enabled set for the duration of a preview/import pass, refreshed whenever
// checkboxes change, so the pool functions don't re-read localStorage per spell.
let _enabledSpellSourcesCache = null;
function refreshEnabledSpellSourcesCache() {
  _enabledSpellSourcesCache = getEnabledSpellSources();
}

// Render the source checkboxes into the import popup from the saved preference.
function renderSpellSourceCheckboxes() {
  const container = document.getElementById('spellSourcesContainer');
  if (!container) return;
  const enabled = getEnabledSpellSources();
  container.innerHTML = SPELL_SOURCES.map(s => `
    <div class="spell-source-item${s.official ? ' official' : ''}">
      <span class="spell-source-label">${s.label}</span>
      <label class="switch">
        <input type="checkbox" value="${s.key}" ${enabled.has(s.key) ? 'checked' : ''} onchange="onSpellSourceToggle()">
        <span class="slider round"></span>
      </label>
    </div>
  `).join('');
}

// Read the checkboxes → save → refresh cache → re-preview.
function onSpellSourceToggle() {
  const boxes = document.querySelectorAll('#spellSourcesContainer input[type="checkbox"]');
  const set = new Set();
  boxes.forEach(b => { if (b.checked) set.add(b.value); });
  // Never allow a fully-empty set — fall back to official so import isn't dead.
  if (set.size === 0) {
    officialSpellSourceKeys().forEach(k => set.add(k));
  }
  setEnabledSpellSources(set);
  refreshEnabledSpellSourcesCache();
  renderSpellSourceCheckboxes();
  updateImportPreview();
}

// Quick presets: 'official' = WotC only, 'all' = every source.
function setSpellSourcesPreset(which) {
  const set = new Set(which === 'all' ? SPELL_SOURCES.map(s => s.key) : officialSpellSourceKeys());
  setEnabledSpellSources(set);
  refreshEnabledSpellSourcesCache();
  renderSpellSourceCheckboxes();
  updateImportPreview();
}

// Show import popup
function showImportPopup(type) {
  if (Object.keys(spellDatabase).length === 0) {
    appToast('Spell database is still loading, please try again in a moment.', 'info');
    return;
  }
  refreshEnabledSpellSourcesCache();
  renderSpellSourceCheckboxes();
  const popup = document.getElementById('importSpellsPopup');
  const title = document.getElementById('importSpellsTitle');
  
  title.textContent = type === 'cantrip' ? 'Import Cantrips' : 'Import Spells';
  importMode = (type === 'cantrip') ? 'cantrip' : (type === 'spell' ? 'spell' : 'both');
  
  // Reset class selections
  classLevelSelections = [];
  document.getElementById('classLevelContainer').innerHTML = '';
  document.getElementById('importPreview').innerHTML = '';
  
  // Add first class selection
  addClassLevel();

  showPopup('importSpellsPopup');
}

// Add class/level selection row
function addClassLevel() {
  const container = document.getElementById('classLevelContainer');
  const rowId = 'classLevel_' + Date.now();
  
  const row = document.createElement('div');
  row.className = 'class-level-row';
  row.id = rowId;
  
  row.innerHTML = `
    <select onchange="updateImportPreview()">
      <option value="">Select Class</option>
      ${Object.keys(dndClasses).map(cls => `<option value="${cls}">${cls}</option>`).join('')}
    </select>
    <input type="number" min="1" max="20" value="1" onchange="updateImportPreview()" placeholder="Level">
    <button class="remove-class-btn" onclick="removeClassLevel('${rowId}')">Remove</button>
  `;
  
  container.appendChild(row);
  updateImportPreview();
}

// Remove class/level selection row
function removeClassLevel(rowId) {
  document.getElementById(rowId).remove();
  updateImportPreview();
}

// Update import preview
function updateImportPreview() {
  const preview = document.getElementById('importPreview');
  const rows = document.querySelectorAll('.class-level-row');
  
  let spellsToImport = [];
  let cantripsToImport = [];
  
  rows.forEach(row => {
    const classSelect = row.querySelector('select');
    const levelInput = row.querySelector('input');
    
    if (classSelect.value && levelInput.value) {
      const className = classSelect.value;
      const level = parseInt(levelInput.value);
      
      // Add cantrips (if allowed by mode)
      if (importMode !== 'spell') {
        getCantripNamesForClass(className).forEach(cantrip => {
          if (!cantripsToImport.find(c => c.name === cantrip)) {
            cantripsToImport.push({ name: cantrip, class: className });
          }
        });
      }
      
      // Add spells up to the selected level (if allowed by mode)
      if (importMode !== 'cantrip') {
        getSpellNamesForClassUpToLevel(className, level).forEach(spell => {
          if (!spellsToImport.find(s => s.name === spell.name)) {
            spellsToImport.push({ name: spell.name, level: spell.level, class: className });
          }
        });
      }
    }
  });
  
  // Display preview
  let previewHTML = '';
  if (cantripsToImport.length > 0) {
    previewHTML += '<strong>Cantrips:</strong><br>';
    cantripsToImport.forEach(cantrip => {
      previewHTML += `• ${cantrip.name} (${cantrip.class})<br>`;
    });
    previewHTML += '<br>';
  }
  
  if (spellsToImport.length > 0) {
    previewHTML += '<strong>Spells:</strong><br>';
    spellsToImport.forEach(spell => {
      previewHTML += `• ${spell.name} (Level ${spell.level}, ${spell.class})<br>`;
    });
  }
  
  if (previewHTML === '') {
    previewHTML = 'Select classes and levels to see spells to import.';
  }
  
  preview.innerHTML = previewHTML;
}

// Execute import
function executeImport() {
  const rows = document.querySelectorAll('.class-level-row');
  let importedCount = 0;
  
  rows.forEach(row => {
    const classSelect = row.querySelector('select');
    const levelInput = row.querySelector('input');
    
    if (classSelect.value && levelInput.value) {
      const className = classSelect.value;
      const level = parseInt(levelInput.value);
      
      // Import cantrips (only if mode allows)
      if (importMode !== 'spell') {
        getCantripNamesForClass(className).forEach(cantripName => {
          if (!spellsData.cantrips.find(c => c.name === cantripName)) {
            // Create cantrip from database or use default
            const cantrip = createSpellFromName(cantripName, 0);
            if (cantrip) {
              spellsData.cantrips.push(cantrip);
              importedCount++;
            }
          }
        });
      }
      
      // Import spells up to selected level (support up to 9th level) if mode allows
      if (importMode !== 'cantrip') {
        getSpellNamesForClassUpToLevel(className, level).forEach(spellEntry => {
          const spellName = spellEntry.name;
          if (!spellsData.spells.find(s => s.name === spellName)) {
            const spell = createSpellFromName(spellName, spellEntry.level);
            if (spell) {
              spellsData.spells.push(spell);
              importedCount++;
            }
          }
        });
      }
    }
  });
  
  // Reset filters to show newly imported content
  const cantripFilter = document.getElementById('cantrip_filter');
  if (cantripFilter) cantripFilter.value = 'all';
  const levelFilter = document.getElementById('spell_level_filter');
  if (levelFilter) levelFilter.value = 'all';
  const schoolFilter = document.getElementById('spell_school_filter');
  if (schoolFilter) schoolFilter.value = 'all';
  const statusFilter = document.getElementById('spell_status_filter');
  if (statusFilter) statusFilter.value = 'all';

  renderSpells();
  autosave();
  closePopup('importSpellsPopup');
  appToast(importMode === 'cantrip'
    ? `Imported ${importedCount} cantrips!`
    : (importMode === 'spell'
      ? `Imported ${importedCount} spells!`
      : `Imported ${importedCount} spells and cantrips!`), 'success');
}

// Create spell from name using comprehensive database
function createSpellFromName(name, level) {
  // Check if we have detailed data in our database
  if (spellDatabase[name]) {
    const spellData = spellDatabase[name];
    const resolvedLevel = Number.isFinite(parseInt(spellData.level, 10)) ? parseInt(spellData.level, 10) : level;
    return normalizeSpellRecord({
      name: name,
      level: resolvedLevel,
      school: spellData.school || 'Evocation',
      castingTime: spellData.castingTime || '1 action',
      range: spellData.range || '60 feet',
      components: spellData.components || 'V, S',
      duration: spellData.duration || 'Instantaneous',
      damage: spellData.damage || (resolvedLevel === 0 ? '1d10 damage' : ''),
      save: spellData.save || '',
      attack: spellData.attack || (resolvedLevel === 0 ? 'Ranged spell attack' : ''),
      ritual: !!spellData.ritual,
      concentration: !!spellData.concentration,
      classes: Array.isArray(spellData.classes) && spellData.classes.length > 0
        ? [...spellData.classes]
        : getClassTagsForSpellName(name),
      sourceBook: spellData.sourceBook || inferSourceBookForSpell(name),
      prepared: false,
      description: spellData.description || `${name} - Official D&D 5e spell.`,
      wikiLink: spellData.wikiLink || open5eSpellLink(name)
    });
  }
  
  // Fallback for spells not in our database
  return normalizeSpellRecord({
    name: name,
    level: level,
    school: 'Evocation', // Default school
    castingTime: '1 action',
    range: '60 feet',
    components: 'V, S',
    duration: 'Instantaneous',
    damage: level === 0 ? '1d10 damage' : `${level}d6 damage`,
    save: '',
    attack: level === 0 ? 'Ranged spell attack' : '',
    ritual: false,
    concentration: false,
    classes: getClassTagsForSpellName(name),
    sourceBook: inferSourceBookForSpell(name),
    prepared: false,
    description: `${name} - Official D&D 5e spell. Full description available in Player's Handbook.`,
    wikiLink: open5eSpellLink(name)
  });
}

// Toggle favorite status
function toggleFavorite(type, index) {
  const spell = type === 'cantrip' ? spellsData.cantrips[index] : spellsData.spells[index];
  if (!spell) return;
  
  const favorites = type === 'cantrip' ? favoritesData.cantrips : favoritesData.spells;
  const existingIndex = favorites.findIndex(f => f.name === spell.name);
  
  if (existingIndex !== -1) {
    favorites.splice(existingIndex, 1);
  } else {
    favorites.push(spell);
  }
  
  renderSpells(); // live update both lists and favorites section
  autosave();
}

// Name-based favorite toggle to avoid index mismatches from filtering/grouping
function toggleFavoriteByName(type, name) {
  const list = type === 'cantrip' ? spellsData.cantrips : spellsData.spells;
  const idx = list.findIndex(s => s.name === name);
  if (idx === -1) return;
  toggleFavorite(type, idx);
}

// Check if spell is favorited
function isFavorited(type, spellName) {
  const favorites = type === 'cantrip' ? favoritesData.cantrips : favoritesData.spells;
  return favorites.some(f => f.name === spellName);
}

// Clear all spells with 3-press confirmation
function clearAllSpells(type, event) {
  const currentCount = clearAllConfirmations[type];
  const requiredPresses = 3;

  // Increment the confirmation count
  clearAllConfirmations[type]++;

  if (clearAllConfirmations[type] < requiredPresses) {
    const remaining = requiredPresses - clearAllConfirmations[type];
    const typeName = type === 'cantrip' ? 'Cantrips' : 'Spells';

    // Update button text to show progress
    const button = (event && event.target) || document.querySelector(`.clear-all-btn[onclick*="${type}"]`);
    const originalText = button.textContent;
    button.textContent = `Clear All ${typeName} (${remaining} more clicks)`;
    button.style.backgroundColor = '#ff6666';
    
    // Reset button after 3 seconds if not completed
    setTimeout(() => {
      if (clearAllConfirmations[type] < requiredPresses) {
        clearAllConfirmations[type] = 0;
        button.textContent = originalText;
        button.style.backgroundColor = '#ff4444';
      }
    }, 3000);
    
    return;
  }
  
  // Reset confirmation count
  clearAllConfirmations[type] = 0;
  
  // Get the spell array
  const spellArray = type === 'cantrip' ? spellsData.cantrips : spellsData.spells;
  const typeName = type === 'cantrip' ? 'cantrips' : 'spells';
  
  if (spellArray.length === 0) {
    appToast(`No ${typeName} to clear!`, 'info');
    return;
  }

  // Capture the button now — `event` is not valid inside the async callback.
  const button = event && event.target;
  const resetButtonLabel = () => {
    if (!button) return;
    button.textContent = `Clear All ${typeName.charAt(0).toUpperCase() + typeName.slice(1)}`;
    button.style.backgroundColor = '#ff4444';
  };

  appConfirm(
    `Are you sure you want to clear ALL ${spellArray.length} ${typeName}?\nThis action cannot be undone!\nNote: this will NOT remove spells from your favorites.`,
    { confirmText: 'Clear all' }
  ).then(confirmed => {
    if (confirmed) {
      spellArray.length = 0;
      resetButtonLabel();
      renderSpells();
      autosave();
      appToast(`All ${typeName} have been cleared!`, 'success');
    } else {
      resetButtonLabel();
    }
  });
}

// ========== SPELL SLOTS SYSTEM ==========

function addSpellSlot() {
  const name = document.getElementById('spell_slot_name').value.trim();
  const maxValue = parseInt(document.getElementById('spell_slot_max').value) || 1;
  const resetType = document.getElementById('spell_slot_reset_type').value;

  if (!name) { appToast('Please enter a spell slot name', 'error'); return; }
  if (manualSpellSlots.find(s => s.name.toLowerCase() === name.toLowerCase())) {
    appToast('A spell slot type with this name already exists', 'error'); return;
  }

  const slotId = 'spell_' + Date.now();
  manualSpellSlots.push({ id: slotId, name, maxValue, resetType });
  manualSpellSlotsUsed[slotId] = 0;
  updateSpellSlots();
  closePopup('addSpellSlotPopup');
  autosave();
}

function removeSpellSlot(slotId) {
  appConfirm('Are you sure you want to remove this spell slot type?', { confirmText: 'Remove' }).then(ok => {
    if (!ok) return;
    manualSpellSlots = manualSpellSlots.filter(s => s.id !== slotId);
    delete manualSpellSlotsUsed[slotId];
    updateSpellSlots();
    autosave();
  });
}

// Ghost drag state for spell slots
let _ssDragGhost = null, _ssDragSrc = null, _ssDragPlaceholder = null;
let _ssDragOffX = 0, _ssDragOffY = 0, _ssDragLastX = 0, _ssDragTilt = 0;

function updateSpellSlots() {
  const container = document.getElementById('spell_slots_container');
  if (!container) return;
  container.innerHTML = '';

  if (manualSpellSlots.length === 0) {
    container.innerHTML = '<p style="text-align: center; color: #666; font-style: italic; margin: 10px 0;">No spell slots yet. Click "Add Spell Slot Type" to get started!</p>';
    return;
  }

  manualSpellSlots.forEach((slot) => {
    const slotDiv = document.createElement('div');
    slotDiv.className = 'spell-level-row';
    slotDiv.dataset.slotId = slot.id;

    const usedValue = manualSpellSlotsUsed[slot.id] || 0;
    const title = slot.resetType === 'long' ? 'Resets on Long Rest' : slot.resetType === 'short' ? 'Resets on Short Rest' : 'Manual Reset Only';

    slotDiv.innerHTML = `
      <span class="spell-slot-drag-handle" title="Drag to reorder">⠿</span>
      <span class="spell-level-label" title="${title}">${slot.name}</span>
      <div class="spell-stepper-controls">
        <button class="spell-stepper-btn" onclick="stepSpellSlot('${slot.id}', -1)" title="Restore slot">−</button>
        <span class="spell-available-count" id="spell_used_${slot.id}">${usedValue} / ${slot.maxValue}</span>
        <button class="spell-stepper-btn" onclick="stepSpellSlot('${slot.id}', 1)" title="Spend slot">+</button>
      </div>
      <div class="spell-slot-row-actions">
        <button class="spell-slot-edit-btn" onclick="showEditSpellSlotPopup('${slot.id}')" title="Edit">Edit</button>
        <button class="spell-slot-delete-btn" onclick="removeSpellSlot('${slot.id}')" title="Remove">✕</button>
      </div>
    `;

    const handle = slotDiv.querySelector('.spell-slot-drag-handle');
    handle.addEventListener('mousedown', spellSlotDragStart);
    handle.addEventListener('touchstart', spellSlotDragStart, { passive: false });

    container.appendChild(slotDiv);
  });
}

function spellSlotDragStart(e) {
  const handle = e.currentTarget;
  const row = handle.closest('.spell-level-row');
  const container = document.getElementById('spell_slots_container');
  if (!row || !container) return;
  e.preventDefault();

  const clientX = e.touches ? e.touches[0].clientX : e.clientX;
  const clientY = e.touches ? e.touches[0].clientY : e.clientY;
  const rect = row.getBoundingClientRect();

  _ssDragOffX = clientX - rect.left;
  _ssDragOffY = clientY - rect.top;
  _ssDragLastX = clientX;
  _ssDragTilt = 0;
  _ssDragSrc = row;

  // Ghost
  _ssDragGhost = row.cloneNode(true);
  _ssDragGhost.className = 'spell-level-row spell-slot-drag-ghost';
  _ssDragGhost.style.cssText = `
    position:fixed; z-index:9999; pointer-events:none;
    width:${rect.width}px; left:${rect.left}px; top:${rect.top}px;
    opacity:0.88; box-shadow:0 8px 32px rgba(0,0,0,0.45);
    border-radius:8px; background:var(--card-bg);
    border:1px solid var(--accent-border);
  `;
  document.body.appendChild(_ssDragGhost);

  // Placeholder
  _ssDragPlaceholder = document.createElement('div');
  _ssDragPlaceholder.className = 'spell-slot-drag-placeholder';
  _ssDragPlaceholder.style.height = rect.height + 'px';
  container.insertBefore(_ssDragPlaceholder, row);
  row.style.display = 'none';

  document.addEventListener('mousemove', spellSlotDragMove);
  document.addEventListener('touchmove', spellSlotDragMove, { passive: false });
  document.addEventListener('mouseup', spellSlotDragEnd);
  document.addEventListener('touchend', spellSlotDragEnd);
}

function spellSlotDragMove(e) {
  if (!_ssDragGhost) return;
  e.preventDefault();
  const clientX = e.touches ? e.touches[0].clientX : e.clientX;
  const clientY = e.touches ? e.touches[0].clientY : e.clientY;
  const dx = clientX - _ssDragLastX;
  _ssDragLastX = clientX;
  _ssDragTilt = Math.max(-10, Math.min(10, _ssDragTilt * 0.85 + dx * 0.3));
  _ssDragGhost.style.left = (clientX - _ssDragOffX) + 'px';
  _ssDragGhost.style.top = (clientY - _ssDragOffY) + 'px';
  _ssDragGhost.style.transform = `rotate(${_ssDragTilt}deg) scale(1.03)`;

  const container = document.getElementById('spell_slots_container');
  if (!container) return;
  const rows = [...container.children].filter(c => c !== _ssDragSrc && !c.classList.contains('spell-slot-drag-ghost') && !c.classList.contains('spell-slot-drag-placeholder'));
  let inserted = false;
  for (const r of rows) {
    const rr = r.getBoundingClientRect();
    if (clientY < rr.top + rr.height / 2) {
      container.insertBefore(_ssDragPlaceholder, r);
      inserted = true;
      break;
    }
  }
  if (!inserted) container.appendChild(_ssDragPlaceholder);
}

function spellSlotDragEnd() {
  document.removeEventListener('mousemove', spellSlotDragMove);
  document.removeEventListener('touchmove', spellSlotDragMove);
  document.removeEventListener('mouseup', spellSlotDragEnd);
  document.removeEventListener('touchend', spellSlotDragEnd);

  if (!_ssDragGhost || !_ssDragSrc || !_ssDragPlaceholder) return;

  const container = document.getElementById('spell_slots_container');
  const allChildren = [...container.children];
  const phPos = allChildren.indexOf(_ssDragPlaceholder);
  const srcId = _ssDragSrc.dataset.slotId;
  const srcIndex = manualSpellSlots.findIndex(s => s.id === srcId);
  const dest = allChildren.slice(0, phPos).filter(c => c !== _ssDragSrc && !c.classList.contains('spell-slot-drag-ghost') && !c.classList.contains('spell-slot-drag-placeholder')).length;

  document.body.removeChild(_ssDragGhost);
  _ssDragPlaceholder.remove();
  _ssDragSrc.style.display = '';
  _ssDragGhost = null; _ssDragSrc = null; _ssDragPlaceholder = null;

  if (srcIndex !== -1) {
    const moved = manualSpellSlots.splice(srcIndex, 1)[0];
    manualSpellSlots.splice(Math.max(0, Math.min(dest, manualSpellSlots.length)), 0, moved);
    updateSpellSlots();
    autosave();
  }
}

function updateSpellSlotMax(slotId, newMax) {
  const slot = manualSpellSlots.find(s => s.id === slotId);
  if (slot) {
    slot.maxValue = parseInt(newMax) || 1;
    if (manualSpellSlotsUsed[slotId] > slot.maxValue) manualSpellSlotsUsed[slotId] = slot.maxValue;
    updateSpellSlots();
    autosave();
  }
}

function toggleSpellSlot(slotId, index) {
  const usedValue = manualSpellSlotsUsed[slotId] || 0;
  manualSpellSlotsUsed[slotId] = index < usedValue ? index : index + 1;
  updateSpellSlots();
  autosave();
}

function stepSpellSlot(slotId, delta) {
  const slot = manualSpellSlots.find(s => s.id === slotId);
  if (!slot) return;
  const current = manualSpellSlotsUsed[slotId] || 0;
  manualSpellSlotsUsed[slotId] = Math.max(0, Math.min(slot.maxValue, current + delta));
  const el = document.getElementById(`spell_used_${slotId}`);
  if (el) el.textContent = `${manualSpellSlotsUsed[slotId]} / ${slot.maxValue}`;
  autosave();
}

function resetSpellSlots(restType = 'all') {
  if (restType === 'all') {
    appConfirm('Are you sure you want to reset all spell slots?', { confirmText: 'Reset' }).then(ok => {
      if (!ok) return;
      manualSpellSlots.forEach(slot => { manualSpellSlotsUsed[slot.id] = 0; });
      updateSpellSlots();
      autosave();
    });
  } else {
    manualSpellSlots.forEach(slot => {
      if (slot.resetType === restType || (restType === 'long' && slot.resetType === 'short')) {
        manualSpellSlotsUsed[slot.id] = 0;
      }
    });
    updateSpellSlots();
    autosave();
  }
}

let currentEditingSpellSlotId = null;

function showEditSpellSlotPopup(slotId) {
  const slot = manualSpellSlots.find(s => s.id === slotId);
  if (!slot) return;
  currentEditingSpellSlotId = slotId;
  document.getElementById('edit_spell_slot_name').value = slot.name;
  document.getElementById('edit_spell_slot_max').value = slot.maxValue;
  document.getElementById('edit_spell_slot_reset_type').value = slot.resetType;
  showPopup('editSpellSlotPopup');
}

function saveSpellSlotEdit() {
  if (!currentEditingSpellSlotId) return;
  const name = document.getElementById('edit_spell_slot_name').value.trim();
  const maxValue = parseInt(document.getElementById('edit_spell_slot_max').value) || 1;
  const resetType = document.getElementById('edit_spell_slot_reset_type').value;
  if (!name) { appToast('Please enter a spell slot name', 'error'); return; }
  if (manualSpellSlots.find(s => s.name.toLowerCase() === name.toLowerCase() && s.id !== currentEditingSpellSlotId)) {
    appToast('A spell slot type with this name already exists', 'error'); return;
  }
  const slot = manualSpellSlots.find(s => s.id === currentEditingSpellSlotId);
  if (slot) {
    slot.name = name;
    slot.maxValue = maxValue;
    slot.resetType = resetType;
    if (manualSpellSlotsUsed[currentEditingSpellSlotId] > maxValue) {
      manualSpellSlotsUsed[currentEditingSpellSlotId] = maxValue;
    }
    updateSpellSlots();
    autosave();
  }
  closePopup('editSpellSlotPopup');
  currentEditingSpellSlotId = null;
}

// ========== CUSTOM RESOURCES SYSTEM ==========

// Common class resource presets (#10). max is a sensible starting value the user
// can adjust; reset follows 5e recovery. Clicking one pre-fills the form.
const RESOURCE_TEMPLATES = [
  { name: 'Ki Points',            max: 5,  reset: 'short' },
  { name: 'Sorcery Points',       max: 5,  reset: 'long'  },
  { name: 'Bardic Inspiration',   max: 3,  reset: 'short' },
  { name: 'Channel Divinity',     max: 1,  reset: 'short' },
  { name: 'Rage',                 max: 3,  reset: 'long'  },
  { name: 'Wild Shape',           max: 2,  reset: 'short' },
  { name: 'Superiority Dice',     max: 4,  reset: 'short' },
  { name: 'Lay on Hands',         max: 5,  reset: 'long'  },
  { name: 'Sneak Attack',         max: 1,  reset: 'manual'},
  { name: 'Second Wind',          max: 1,  reset: 'short' },
  { name: 'Action Surge',         max: 1,  reset: 'short' },
  { name: 'Indomitable',          max: 1,  reset: 'long'  },
];

function renderResourceTemplates() {
  const row = document.getElementById('resourceTemplateRow');
  if (!row) return;
  row.innerHTML = RESOURCE_TEMPLATES.map((t, i) =>
    `<button type="button" class="resource-template-btn" onclick="fillResourceTemplate(${i})">${escapeHtml(t.name)}</button>`
  ).join('');
}

function fillResourceTemplate(i) {
  const t = RESOURCE_TEMPLATES[i];
  if (!t) return;
  document.getElementById('custom_resource_name').value = t.name;
  document.getElementById('custom_resource_max').value = String(t.max);
  document.getElementById('custom_resource_reset_type').value = t.reset;
}

function showAddCustomResourcePopup() {
  document.getElementById('custom_resource_name').value = '';
  document.getElementById('custom_resource_max').value = '1';
  document.getElementById('custom_resource_reset_type').value = 'long';
  renderResourceTemplates();
  showPopup('addCustomResourcePopup');
}

function addCustomResource() {
  const name = document.getElementById('custom_resource_name').value.trim();
  const maxValue = parseInt(document.getElementById('custom_resource_max').value) || 1;
  const resetType = document.getElementById('custom_resource_reset_type').value;
  if (!name) { appToast('Please enter a resource name', 'error'); return; }
  if (customResources.find(r => r.name.toLowerCase() === name.toLowerCase())) {
    appToast('A resource with this name already exists', 'error'); return;
  }
  const resourceId = 'custom_' + Date.now();
  customResources.push({ id: resourceId, name, maxValue, resetType });
  customResourcesUsed[resourceId] = 0;
  updateCustomResources();
  closePopup('addCustomResourcePopup');
  autosave();
}

function removeCustomResource(resourceId) {
  appConfirm('Are you sure you want to remove this custom resource?', { confirmText: 'Remove' }).then(ok => {
    if (!ok) return;
    customResources = customResources.filter(r => r.id !== resourceId);
    delete customResourcesUsed[resourceId];
    updateCustomResources();
    autosave();
  });
}

function updateCustomResources() {
  const container = document.getElementById('custom_resources_container');
  if (!container) return;
  container.innerHTML = '';
  if (customResources.length === 0) {
    container.innerHTML = '<p style="text-align: center; color: #666; font-style: italic; margin: 10px 0;">No custom resources yet. Click "Add Custom Resource" to get started!</p>';
    return;
  }
  customResources.forEach(resource => {
    const resourceDiv = document.createElement('div');
    resourceDiv.className = 'spell-level-row';
    resourceDiv.style.position = 'relative';
    const usedValue = customResourcesUsed[resource.id] || 0;
    const title = resource.resetType === 'long' ? 'Resets on Long Rest' : resource.resetType === 'short' ? 'Resets on Short Rest' : 'Manual Reset Only';
    resourceDiv.innerHTML = `
      <span class="spell-level-label" title="${title}">${resource.name}:</span>
      <input type="number" class="spell-slot-input" min="0" max="15" value="${resource.maxValue}"
             onchange="updateCustomResourceMax('${resource.id}', this.value)">
      <div class="spell-stepper-controls">
        <button class="spell-stepper-btn" onclick="stepCustomResource('${resource.id}', -1)" title="Restore">−</button>
        <span class="spell-available-count" id="custom_used_${resource.id}">${usedValue} / ${resource.maxValue}</span>
        <button class="spell-stepper-btn" onclick="stepCustomResource('${resource.id}', 1)" title="Spend">+</button>
      </div>
      <button class="spell-slot-delete-btn" onclick="removeCustomResource('${resource.id}')" title="Remove Resource">✕</button>
    `;
    container.appendChild(resourceDiv);
  });
}

function updateCustomResourceMax(resourceId, newMax) {
  const resource = customResources.find(r => r.id === resourceId);
  if (resource) {
    resource.maxValue = parseInt(newMax) || 1;
    if (customResourcesUsed[resourceId] > resource.maxValue) customResourcesUsed[resourceId] = resource.maxValue;
    updateCustomResources();
    autosave();
  }
}

function toggleCustomResource(resourceId, index) {
  const usedValue = customResourcesUsed[resourceId] || 0;
  customResourcesUsed[resourceId] = index < usedValue ? index : index + 1;
  updateCustomResources();
  autosave();
}

function stepCustomResource(resourceId, delta) {
  const resource = customResources.find(r => r.id === resourceId);
  if (!resource) return;
  const current = customResourcesUsed[resourceId] || 0;
  customResourcesUsed[resourceId] = Math.max(0, Math.min(resource.maxValue, current + delta));
  const el = document.getElementById(`custom_used_${resourceId}`);
  if (el) el.textContent = `${customResourcesUsed[resourceId]} / ${resource.maxValue}`;
  autosave();
}

function resetCustomResources(restType = 'all') {
  if (restType === 'all') {
    appConfirm('Are you sure you want to reset all custom resources?', { confirmText: 'Reset' }).then(ok => {
      if (!ok) return;
      customResources.forEach(r => { customResourcesUsed[r.id] = 0; });
      updateCustomResources();
      autosave();
    });
  } else {
    customResources.forEach(r => {
      if (r.resetType === restType || (restType === 'long' && r.resetType === 'short')) {
        customResourcesUsed[r.id] = 0;
      }
    });
    updateCustomResources();
    autosave();
  }
}


// ========== SPELL SYSTEM INIT + UI FUNCTIONS ==========
function initializeSpellSystem() {
  // Data will be populated by loadData() from the main character store
  updateSpellSlots();
  updateCustomResources();
  renderSpells();
}

// ========== MANUAL SPELL SLOTS SYSTEM ==========

// Show add spell slot popup
function showAddSpellSlotPopup() {
  document.getElementById('spell_slot_name').value = '';
  document.getElementById('spell_slot_max').value = '1';
  document.getElementById('spell_slot_reset_type').value = 'long';
  showPopup('addSpellSlotPopup');
}

function showSpellForm(type, spellIndex = null) {
  const popup = document.getElementById('spellFormPopup');
  const title = document.getElementById('spellFormTitle');
  const form = document.getElementById('spellForm');
  
  if (spellIndex !== null) {
    // Edit existing spell
    const spell = type === 'cantrip' ? spellsData.cantrips[spellIndex] : spellsData.spells[spellIndex];
    title.textContent = 'Edit Spell';
    form.dataset.editIndex = spellIndex;
    form.dataset.editType = type;
    populateSpellForm(spell);
  } else {
    // Add new spell
    title.textContent = type === 'cantrip' ? 'Add Cantrip' : 'Add Spell';
    delete form.dataset.editIndex;
    delete form.dataset.editType;
    form.reset();
    document.getElementById('spellLevel').value = type === 'cantrip' ? '0' : '1';
  }

  showPopup('spellFormPopup');
}

// Populate spell form for editing
function populateSpellForm(spell) {
  document.getElementById('spellName').value = spell.name || '';
  document.getElementById('spellLevel').value = spell.level || '0';
  document.getElementById('spellSchool').value = spell.school || '';
  document.getElementById('spellCastingTime').value = spell.castingTime || '';
  document.getElementById('spellRange').value = spell.range || '';
  document.getElementById('spellComponents').value = spell.components || '';
  document.getElementById('spellDuration').value = spell.duration || '';
  document.getElementById('spellDamage').value = spell.damage || '';
  document.getElementById('spellSave').value = spell.save || '';
  document.getElementById('spellAttack').value = spell.attack || '';
  document.getElementById('spellRitual').checked = spell.ritual || false;
  document.getElementById('spellConcentration').checked = spell.concentration || false;
  document.getElementById('spellPrepared').checked = spell.prepared || false;
  document.getElementById('spellDescription').value = spell.description || '';
  document.getElementById('spellFormWikiLink').value = spell.wikiLink || '';
}

// Save spell
function saveSpell(event) {
  event.preventDefault();
  
  const spell = {
    name: document.getElementById('spellName').value,
    level: parseInt(document.getElementById('spellLevel').value),
    school: document.getElementById('spellSchool').value,
    castingTime: document.getElementById('spellCastingTime').value,
    range: document.getElementById('spellRange').value,
    components: document.getElementById('spellComponents').value,
    duration: document.getElementById('spellDuration').value,
    damage: document.getElementById('spellDamage').value,
    save: document.getElementById('spellSave').value,
    attack: document.getElementById('spellAttack').value,
    ritual: document.getElementById('spellRitual').checked,
    concentration: document.getElementById('spellConcentration').checked,
    prepared: document.getElementById('spellPrepared').checked,
    description: document.getElementById('spellDescription').value,
    wikiLink: document.getElementById('spellFormWikiLink').value
  };
  
  const isCantrip = spell.level === 0;
  const form = document.getElementById('spellForm');
  const editIndex = form.dataset.editIndex !== undefined ? parseInt(form.dataset.editIndex, 10) : null;
  const editType = form.dataset.editType || null;

  if (editIndex !== null && editType !== null) {
    // Edit existing spell — use stored index, handles renames correctly
    const sourceArray = editType === 'cantrip' ? spellsData.cantrips : spellsData.spells;
    if (editIndex >= 0 && editIndex < sourceArray.length) {
      // If level changed between cantrip (0) and spell (1+), move between arrays
      if ((editType === 'cantrip') === isCantrip) {
        sourceArray[editIndex] = spell;
      } else {
        sourceArray.splice(editIndex, 1);
        (isCantrip ? spellsData.cantrips : spellsData.spells).push(spell);
      }
    }
    delete form.dataset.editIndex;
    delete form.dataset.editType;
  } else {
    // Add new spell
    (isCantrip ? spellsData.cantrips : spellsData.spells).push(spell);
  }
  
  renderSpells();
  closePopup('spellFormPopup');
  autosave();
}

// Render spells
function renderSpells() {
  // Render using current filter selections so the dropdowns act as live filters
  filterSpells('cantrip');
  filterSpells('spell');
  renderPreparedSpells();
  renderFavorites();
  syncSpellPanels();
}

function syncSpellPanels() {
  const cantripList = document.getElementById('cantrips_list');
  const spellList = document.getElementById('spells_list');
  if (!cantripList || !spellList) return;
  const cantripSection = cantripList.closest('.section');
  const spellSection = spellList.closest('.section');
  if (!cantripSection || !spellSection) return;

  const base = Math.max(cantripSection.scrollHeight, spellSection.scrollHeight);
  const prevBase = parseInt(cantripSection.dataset.baseHeight || '0', 10);
  const nextBase = Math.max(base, prevBase);
  cantripSection.dataset.baseHeight = `${nextBase}`;
  spellSection.dataset.baseHeight = `${nextBase}`;
  cantripSection.style.minHeight = `${nextBase}px`;
  spellSection.style.minHeight = `${nextBase}px`;
}

// Render individual spell list
function renderSpellList(type, spells) {
  const container = document.getElementById(`${type}_list`);
  if (!container) return;
  
  container.innerHTML = '';
  
  if (spells.length === 0) {
    container.innerHTML = '<p style="text-align: center; color: #666; padding: 20px;">No spells added yet. Click the + button to add your first spell!</p>';
    return;
  }
  
  // Group spells by level
  const groupedSpells = {};
  spells.forEach(spell => {
    const level = spell.level;
    if (!groupedSpells[level]) {
      groupedSpells[level] = [];
    }
    groupedSpells[level].push(spell);
  });
  
  // Render each level group
  Object.keys(groupedSpells).sort((a, b) => parseInt(a) - parseInt(b)).forEach(level => {
    const levelSpells = groupedSpells[level];
    const levelSection = document.createElement('div');
    levelSection.className = 'spell-level-section';
    
    const levelHeader = document.createElement('div');
    levelHeader.className = 'spell-level-header';
    levelHeader.innerHTML = `
      <span>${level === '0' ? 'Cantrips' : `${level}${getOrdinalSuffix(parseInt(level))} Level`}</span>
      <span>(${levelSpells.length} spell${levelSpells.length !== 1 ? 's' : ''})</span>
    `;
    levelSection.appendChild(levelHeader);
    
    levelSpells.forEach((spell, index) => {
      const spellItem = createSpellItem(spell, type, index);
      levelSection.appendChild(spellItem);
    });
    
    container.appendChild(levelSection);
  });
}

// Create spell item element
function createSpellItem(spell, type, index) {
  const item = document.createElement('div');
  item.className = 'spell-item';
  
  // Add special classes for spell properties
  if (spell.ritual) item.classList.add('spell-ritual');
  if (spell.concentration) item.classList.add('spell-concentration');
  if (spell.prepared) item.classList.add('spell-prepared');
  
  // Normalize type used by action handlers
  const actionType = (type === 'spells') ? 'spell' : (type === 'cantrips' ? 'cantrip' : type);
  
  // Ensure we act on the correct spell in the master list, not the filtered/group index
  const masterArray = actionType === 'cantrip' ? spellsData.cantrips : spellsData.spells;
  let indexToUse = masterArray.findIndex(s => s.name === spell.name);
  if (indexToUse === -1) {
    // Fallback to provided index if not found; guards against temporary mismatch during import
    indexToUse = index;
  }
  const isFav = isFavorited(actionType, spell.name);
  
  const spellInfo = document.createElement('div');
  const sourceBadge = spell.sourceBook
    ? `<span class="spell-source-badge" title="From ${escapeHtml(spell.sourceBook)}">${escapeHtml(spell.sourceBook)}</span>`
    : '';
  spellInfo.innerHTML = `
    <strong>${spell.name}</strong>${sourceBadge}
    <span style="color: #888; font-size: 0.9em;">
      ${spell.school} • ${spell.castingTime} • ${spell.range}
      ${spell.damage ? ` • ${spell.damage}` : ''}
    </span>
  `;
  // Build favorite star with a safe event handler
  const star = document.createElement('span');
  star.className = `favorite-star ${isFav ? 'favorited' : 'not-favorited'}`;
  star.textContent = '★';
  star.title = isFav ? 'Remove from favorites' : 'Add to favorites';
  star.style.marginRight = '6px';
  star.addEventListener('click', function(e) {
    e.stopPropagation();
    toggleFavoriteByName(actionType, spell.name);
  });
  // Prepend star to info
  spellInfo.prepend(star);

  const actions = document.createElement('div');
  actions.className = 'spell-item-actions';
  actions.innerHTML = `
    <button class="spell-item-btn" onclick="showSpellDetails('${actionType}', ${indexToUse})">View</button>
    <button class="spell-item-btn" onclick="showSpellForm('${actionType}', ${indexToUse})">Edit</button>
    <button class="spell-item-btn" onclick="toggleSpellPrepared('${actionType}', ${indexToUse})">
      ${spell.prepared ? 'Unprepare' : 'Prepare'}
    </button>
    <button class="spell-item-btn" onclick="removeSpell('${actionType}', ${indexToUse})">Remove</button>
  `;
  
  item.appendChild(spellInfo);
  item.appendChild(actions);
  
  return item;
}

// Pull the upcast ("At Higher Levels") text, or a cantrip's level-scaling text,
// out of a spell's description/summary. Returns '' if none found.
function extractSpellScaling(spell) {
  if (!spell) return '';
  const text = `${spell.summary || ''}\n${spell.description || ''}`;

  // Explicit "At Higher Levels." section (levelled spells + some cantrips).
  const hl = text.match(/at higher levels\.?\**\s*[:\-]?\s*([\s\S]*?)(?:\n\s*\n|$)/i);
  if (hl && hl[1] && hl[1].trim()) return hl[1].replace(/\s+/g, ' ').trim();

  // Cantrip scaling phrasing: "...when you reach 5th level ... 11th level ... 17th level..."
  if (Number(spell.level) === 0) {
    const scale = text.match(/([^.]*\b(?:when you reach|the spell'?s damage increases)[^.]*\b(?:5th|11th|17th|higher)\b[^.]*\.)/i);
    if (scale && scale[1]) return scale[1].replace(/\s+/g, ' ').trim();
  }
  return '';
}

// Show spell details
function showSpellDetails(type, index) {
  const spell = type === 'cantrip' ? spellsData.cantrips[index] : spellsData.spells[index];
  if (!spell) return;
  
  document.getElementById('spellDetailName').textContent = spell.name;
  document.getElementById('spellDetailLevel').textContent = spell.level === 0 ? 'Cantrip' : `${spell.level}${getOrdinalSuffix(spell.level)} Level`;
  document.getElementById('spellDetailSchool').textContent = spell.school;
  document.getElementById('spellDetailCastingTime').textContent = spell.castingTime;
  document.getElementById('spellDetailRange').textContent = spell.range;
  document.getElementById('spellDetailComponents').textContent = spell.components;
  document.getElementById('spellDetailDuration').textContent = spell.duration;
  document.getElementById('spellDetailDamage').textContent = spell.damage || 'None';
  document.getElementById('spellDetailSave').textContent = spell.save || 'None';
  document.getElementById('spellDetailAttack').textContent = spell.attack || 'None';
  document.getElementById('spellDetailRitual').textContent = spell.ritual ? 'Yes' : 'No';
  document.getElementById('spellDetailConcentration').textContent = spell.concentration ? 'Yes' : 'No';

  // Show the short accurate summary as the in-app text. The full official
  // description is intentionally NOT shown here (it's long) — the Open5e link
  // below is the source of truth for the complete spell text.
  const summaryEl = document.getElementById('spellDetailSummary');
  const descEl = document.getElementById('spellDetailDescription');
  const hasSummary = spell.summary && spell.summary.trim();
  if (summaryEl) {
    if (hasSummary) {
      // Summary may carry an "Upcast:" line after a newline — render it as its
      // own styled line rather than collapsing the break.
      const [mainText, ...rest] = spell.summary.split('\n');
      const upcastText = rest.join(' ').trim();
      summaryEl.innerHTML = '';
      const mainSpan = document.createElement('div');
      mainSpan.textContent = mainText;
      summaryEl.appendChild(mainSpan);
      if (upcastText) {
        const upSpan = document.createElement('div');
        upSpan.className = 'spell-summary-upcast';
        upSpan.textContent = upcastText;
        summaryEl.appendChild(upSpan);
      }
      summaryEl.style.display = 'block';
    } else {
      summaryEl.textContent = '';
      summaryEl.style.display = 'none';
    }
  }
  if (descEl) {
    // Fall back to the full description only if a spell somehow has no summary.
    if (hasSummary) {
      descEl.style.display = 'none';
      descEl.textContent = '';
    } else {
      descEl.textContent = spell.description || '';
      descEl.style.display = spell.description ? 'block' : 'none';
    }
  }

  // Source book
  const sourceBookEl = document.getElementById('spellDetailSourceBook');
  if (sourceBookEl) sourceBookEl.textContent = spell.sourceBook || '';

  // Upcast / cantrip scaling — pulled from the description text (#5/#6).
  const upBlock = document.getElementById('spellDetailUpcast');
  const upLabel = document.getElementById('spellDetailUpcastLabel');
  const upText = document.getElementById('spellDetailUpcastText');
  if (upBlock && upText) {
    const scaling = extractSpellScaling(spell);
    if (scaling) {
      if (upLabel) upLabel.textContent = Number(spell.level) === 0 ? 'Cantrip Scaling' : 'At Higher Levels';
      upText.textContent = scaling;
      upBlock.style.display = 'block';
    } else {
      upBlock.style.display = 'none';
    }
  }

  // Reference link — always show. Label reflects the actual host, since dead Open5e
  // pages are repaired to 5esrd.com (see tools/verify-spell-links.js).
  const wikiLinkRow = document.getElementById('spellDetailWikiLink');
  const wikiLink = document.getElementById('spellWikiLink');
  const link = spell.wikiLink || open5eSpellLink(spell.name);
  wikiLink.href = link;
  wikiLink.textContent = /5esrd\.com/i.test(link) ? 'View on 5esrd' : 'View on Open5e';
  wikiLinkRow.style.display = 'block';
  
  showPopup('spellDetailsPopup');
}

// Toggle spell prepared status
function toggleSpellPrepared(type, index) {
  const spell = type === 'cantrip' ? spellsData.cantrips[index] : spellsData.spells[index];
  if (spell) {
    spell.prepared = !spell.prepared;
    renderSpells(); // live update
    autosave();
  }
}

// Remove spell
function removeSpell(type, index) {
  appConfirm('Are you sure you want to remove this spell?', { confirmText: 'Remove' }).then(ok => {
    if (!ok) return;
    if (type === 'cantrip') {
      const removed = spellsData.cantrips.splice(index, 1)[0];
      if (removed) {
        // Also remove from favorites by name
        favoritesData.cantrips = favoritesData.cantrips.filter(f => f.name !== removed.name);
      }
    } else {
      const removed = spellsData.spells.splice(index, 1)[0];
      if (removed) {
        favoritesData.spells = favoritesData.spells.filter(f => f.name !== removed.name);
      }
    }
    renderSpells();
    autosave();
  });
}


function createPreparedSpellItem(spell, actionType, indexToUse) {
  const item = document.createElement('div');
  item.className = 'spell-item';

  if (spell.ritual) item.classList.add('spell-ritual');
  if (spell.concentration) item.classList.add('spell-concentration');
  if (spell.prepared) item.classList.add('spell-prepared');

  const isFav = isFavorited(actionType, spell.name);

  const spellInfo = document.createElement('div');
  const sourceBadge = spell.sourceBook
    ? `<span class="spell-source-badge" title="From ${escapeHtml(spell.sourceBook)}">${escapeHtml(spell.sourceBook)}</span>`
    : '';
  spellInfo.innerHTML = `
    <strong>${spell.name}</strong>${sourceBadge}
    <span style="color: #888; font-size: 0.9em;">
      ${spell.school} • ${spell.castingTime} • ${spell.range}
      ${spell.damage ? ` • ${spell.damage}` : ''}
    </span>
  `;

  const star = document.createElement('span');
  star.className = `favorite-star ${isFav ? 'favorited' : 'not-favorited'}`;
  star.textContent = '★';
  star.title = isFav ? 'Remove from favorites' : 'Add to favorites';
  star.style.marginRight = '6px';
  star.addEventListener('click', function(e) {
    e.stopPropagation();
    toggleFavoriteByName(actionType, spell.name);
  });
  spellInfo.prepend(star);

  const actions = document.createElement('div');
  actions.className = 'spell-item-actions';
  actions.innerHTML = `
    <button class="spell-item-btn" onclick="showSpellDetails('${actionType}', ${indexToUse})">View</button>
    <button class="spell-item-btn" onclick="showSpellForm('${actionType}', ${indexToUse})">Edit</button>
    <button class="spell-item-btn" onclick="toggleSpellPrepared('${actionType}', ${indexToUse})">
      ${spell.prepared ? 'Unprepare' : 'Prepare'}
    </button>
    <button class="spell-item-btn" onclick="removeSpell('${actionType}', ${indexToUse})">Remove</button>
  `;

  item.appendChild(spellInfo);
  item.appendChild(actions);
  return item;
}

function getSpellEffect(spell) {
  if (spell.damage && spell.damage.trim()) return spell.damage.trim();

  // Build a short label from available fields when there's no damage value.
  const desc = (spell.description || '').toLowerCase();
  const save = (spell.save || '').trim();
  const school = (spell.school || '').trim();

  // Save-based effects
  if (save) {
    const saveMap = {
      'strength': 'STR save', 'dexterity': 'DEX save', 'constitution': 'CON save',
      'intelligence': 'INT save', 'wisdom': 'WIS save', 'charisma': 'CHA save'
    };
    for (const [key, label] of Object.entries(saveMap)) {
      if (save.toLowerCase().includes(key)) return label;
    }
    return save.replace(/\s*save\s*/i, '').trim() + ' save';
  }

  // Description keyword scan — ordered by specificity
  const keywords = [
    [/\bheal\w*\b|\bregain\b.*\bhit point/,       'Healing'],
    [/\bcharm\w*\b/,                               'Charmed'],
    [/\bfear\w*\b|\bfrightened\b/,                 'Frightened'],
    [/\brestrain\w*\b/,                            'Restrained'],
    [/\bparalyz\w*\b/,                             'Paralyzed'],
    [/\bsleep\b|\bunconsci\w*\b/,                  'Unconscious'],
    [/\bblind\w*\b/,                               'Blinded'],
    [/\bdeafen\w*\b/,                              'Deafened'],
    [/\bstun\w*\b/,                                'Stunned'],
    [/\bpush\w*\b|\bknock\w*\b.*\bback\b/,         'Pushed'],
    [/\bprone\b/,                                  'Knocked prone'],
    [/\bslow\w*\b|\bspeed.*reduced\b/,             'Slowed'],
    [/\binvisib\w*\b/,                             'Invisible'],
    [/\bsummon\w*\b|\bconjur\w*\b/,               'Summon'],
    [/\bteleport\w*\b/,                            'Teleport'],
    [/\bshield\w*\b|\bprotect\w*\b|\bward\w*\b/,  'Protection'],
    [/\bresist\w*\b/,                              'Resistance'],
    [/\badvantage\b/,                              'Advantage'],
    [/\bdisadvantage\b/,                           'Disadvantage'],
    [/\bdetect\w*\b/,                              'Detection'],
    [/\billusion\w*\b|\bdisguise\w*\b/,            'Illusion'],
    [/\bcontrol\w*\b|\bcommand\w*\b/,              'Control'],
    [/\bcreate\w*\b|\bspawn\w*\b/,                 'Create'],
    [/\bcommunicat\w*\b|\bmessage\b/,              'Communication'],
    [/\blight\b|\billuminat\w*\b/,                 'Light'],
    [/\bdarkness\b/,                               'Darkness'],
    [/\bsilence\b/,                                'Silence'],
  ];
  for (const [pattern, label] of keywords) {
    if (pattern.test(desc)) return label;
  }

  // Fall back to school
  return school || '—';
}

// Parse the level a slot represents from its name ("1st Level" -> 1, "Pact
// Magic (5th)" -> 5). Returns 0 if no number is found (unlevelled resource).
function slotLevelFromName(name) {
  const m = String(name || '').match(/(\d+)/);
  return m ? parseInt(m[1], 10) : 0;
}

// #34: spend one spell slot of the given level from the prepared table. Prefers
// an exact-level slot with availability; otherwise upcasts using the lowest
// available higher-level slot. Toasts the outcome; never touches spell data.
// Produce a safe single-quoted JS string literal for embedding in an inline onclick
// attribute. Escapes backslashes, single quotes, and the HTML/JS-breaking chars so a
// spell name with apostrophes or quotes (e.g. "Melf's Acid Arrow") can't break out.
function jsStr(s) {
  return "'" + String(s == null ? '' : s)
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/"/g, '&quot;')
    .replace(/\r?\n/g, ' ')
    .replace(/</g, '\\x3C') + "'";
}

// NOTE: The one-tap "Cast" buttons (prepared table + favourites) were removed
// (v1.20) — they caused mobile layout drama and the flow needs a rethink. Slot
// spending is done manually via the +/− steppers in the Spell Slots panel.
// `castWithConcentration` (inventory.js) is still used by the concentration
// tracker directly.

// True when a spell object requires concentration. Handles the normalized boolean
// as well as older string forms ("yes"/"concentration").
function spellNeedsConcentration(spell) {
  if (!spell) return false;
  const c = spell.concentration;
  if (c === true) return true;
  if (typeof c === 'string') return /^(yes|true|1|concentration)$/i.test(c.trim());
  return false;
}

function renderPreparedSpells() {
  const container = document.getElementById('prepared_spells_list');
  if (!container) return;

  container.innerHTML = '';

  const preparedCantrips = spellsData.cantrips
    .map((spell, index) => ({ spell, actionType: 'cantrip', index }))
    .filter(entry => entry.spell.prepared);

  const preparedSpells = spellsData.spells
    .map((spell, index) => ({ spell, actionType: 'spell', index }))
    .filter(entry => entry.spell.prepared);

  const preparedAll = [...preparedCantrips, ...preparedSpells];

  if (preparedAll.length === 0) {
    container.innerHTML = '<p style="text-align: center; color: #666; padding: 20px; font-style: italic;">No prepared spells yet. Mark spells as prepared to list them here.</p>';
    return;
  }

  const grouped = {};
  preparedAll.forEach(entry => {
    const level = entry.spell.level || 0;
    if (!grouped[level]) grouped[level] = [];
    grouped[level].push(entry);
  });

  const table = document.createElement('table');
  table.className = 'prepared-spells-table';

  const colgroup = document.createElement('colgroup');
  colgroup.innerHTML = `
    <col class="pcol-name">
    <col class="pcol-cast">
    <col class="pcol-range">
    <col class="pcol-damage">
    <col class="pcol-actions">
  `;
  table.appendChild(colgroup);

  const thead = document.createElement('thead');
  thead.innerHTML = `<tr>
    <th>Name</th>
    <th>Cast Time</th>
    <th>Range</th>
    <th>Effect</th>
    <th></th>
  </tr>`;
  table.appendChild(thead);

  const tbody = document.createElement('tbody');

  Object.keys(grouped)
    .sort((a, b) => parseInt(a, 10) - parseInt(b, 10))
    .forEach(level => {
      const levelEntries = grouped[level];
      const levelLabel = level === '0' ? 'Cantrips' : `${level}${getOrdinalSuffix(parseInt(level, 10))} Level`;

      const groupRow = document.createElement('tr');
      groupRow.className = 'prepared-spells-group-row';
      groupRow.innerHTML = `<td colspan="5">${levelLabel} <span class="prepared-spells-count">(${levelEntries.length})</span></td>`;
      tbody.appendChild(groupRow);

      levelEntries.forEach(entry => {
        const { spell, actionType, index } = entry;
        const effectText = getSpellEffect(spell);
        const damageDisplay = effectText && effectText !== '—' ? effectText : '<span class="prep-na">—</span>';

        const tr = document.createElement('tr');
        tr.className = 'prepared-spells-row';
        tr.innerHTML = `
          <td class="prep-name">${spell.name}</td>
          <td class="prep-cast">${spell.castingTime || '—'}</td>
          <td class="prep-range">${spell.range || '—'}</td>
          <td class="prep-damage">${damageDisplay}</td>
          <td class="prep-actions">
            <button class="spell-item-btn" onclick="showSpellDetails('${actionType}', ${index})">View</button>
          </td>
        `;
        tbody.appendChild(tr);
      });
    });

  table.appendChild(tbody);
  container.appendChild(table);
}
// Render favorites
function renderFavorites() {
  // Use actual container IDs in the DOM
  renderFavoritesList('favorites_cantrips_list', favoritesData.cantrips);
  renderFavoritesList('favorites_spells_list', favoritesData.spells);
}

// Render favorites list
function renderFavoritesList(containerId, favorites) {
  const container = document.getElementById(containerId);
  if (!container) return;
  
  container.innerHTML = '';
  
  if (favorites.length === 0) {
    container.innerHTML = '<p style="text-align: center; color: #666; padding: 20px; font-style: italic;">No favorites yet. Click the star (★) next to any spell to add it to favorites!</p>';
    return;
  }
  
  // Group favorites by level
  const groupedFavorites = {};
  favorites.forEach(spell => {
    const level = spell.level;
    if (!groupedFavorites[level]) {
      groupedFavorites[level] = [];
    }
    groupedFavorites[level].push(spell);
  });
  
  // Render each level group
  Object.keys(groupedFavorites).sort((a, b) => parseInt(a) - parseInt(b)).forEach(level => {
    const levelSpells = groupedFavorites[level];
    const levelSection = document.createElement('div');
    levelSection.className = 'spell-level-section';
    
    const levelHeader = document.createElement('div');
    levelHeader.className = 'spell-level-header';
    levelHeader.innerHTML = `
      <span>${level === '0' ? 'Cantrips' : `${level}${getOrdinalSuffix(parseInt(level))} Level`}</span>
      <span>(${levelSpells.length} spell${levelSpells.length !== 1 ? 's' : ''})</span>
    `;
    levelSection.appendChild(levelHeader);
    
    levelSpells.forEach((spell, index) => {
      // Find the original index in the main spell list
      const originalIndex = containerId.includes('cantrips') ? 
        spellsData.cantrips.findIndex(s => s.name === spell.name) :
        spellsData.spells.findIndex(s => s.name === spell.name);
      
      const spellItem = createSpellItem(spell, containerId.includes('cantrips') ? 'cantrip' : 'spell', originalIndex);
      levelSection.appendChild(spellItem);
    });
    
    container.appendChild(levelSection);
  });
}

// Filter spells
function filterSpells(type) {
  // Map type to list container keys used in DOM ids
  const listKey = type === 'cantrip' ? 'cantrips' : 'spells';
  const spells = type === 'cantrip' ? spellsData.cantrips : spellsData.spells;
  const container = document.getElementById(`${listKey}_list`);
  if (!container) return;
  
  // Get filter values
  let levelFilter = 'all';
  let schoolFilter = 'all';
  let statusFilter = 'all';
  let searchTerm = '';

  if (type === 'cantrip') {
    statusFilter = document.getElementById('cantrip_filter').value;
    searchTerm = (document.getElementById('cantrip_search')?.value || '').toLowerCase().trim();
  } else {
    levelFilter = document.getElementById('spell_level_filter').value;
    schoolFilter = document.getElementById('spell_school_filter').value;
    statusFilter = document.getElementById('spell_status_filter').value;
    searchTerm = (document.getElementById('spell_search')?.value || '').toLowerCase().trim();
  }

  // Filter spells
  let filteredSpells = spells.filter(spell => {
    // Search filter — matches name, description, school and damage/effect text so
    // you can find e.g. "charmed" or "fire" not just spell names.
    if (searchTerm) {
      const haystack = [spell.name, spell.description, spell.school, spell.damage, spell.save]
        .filter(Boolean).join(' ').toLowerCase();
      if (!haystack.includes(searchTerm)) return false;
    }

    // Level filter
    if (levelFilter !== 'all' && spell.level.toString() !== levelFilter) {
      return false;
    }

    // School filter
    if (schoolFilter !== 'all' && spell.school !== schoolFilter) {
      return false;
    }

    // Status filter
    if (statusFilter !== 'all') {
      if (statusFilter === 'prepared' && !spell.prepared) return false;
      if (statusFilter === 'known' && spell.prepared) return false;
      if (statusFilter === 'ritual' && !spell.ritual) return false;
      if (statusFilter === 'favorites' && !isFavorited(type, spell.name)) return false;
    }

    return true;
  });
  
  // Render filtered spells
  renderSpellList(listKey, filteredSpells);
}

// Utility function for ordinal suffixes
function getOrdinalSuffix(num) {
  const j = num % 10;
  const k = num % 100;
  if (j === 1 && k !== 11) return 'st';
  if (j === 2 && k !== 12) return 'nd';
  if (j === 3 && k !== 13) return 'rd';
  return 'th';
}

