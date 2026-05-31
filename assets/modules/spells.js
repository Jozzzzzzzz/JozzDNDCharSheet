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


// Spell database — loaded async from assets/data/spells.json
let spellDatabase = {};

async function loadSpellDatabase() {
  try {
    const resp = await fetch('assets/data/spells.json');
    const spells = await resp.json();
    spellDatabase = {};
    spells.forEach(spell => {
      if (spell && spell.name) spellDatabase[spell.name] = spell;
    });
    applyClassTagsToSpellCatalogs();
  } catch (err) {
    console.error('Failed to load spell database:', err);
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
  }
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
    .filter(([, spell]) => spell.level === 0 && Array.isArray(spell.classes) && spell.classes.includes(className))
    .map(([name]) => name)
    .sort();
  const fallback = (dndClasses[className]?.cantrips || []).slice();
  return Array.from(new Set([...fromTags, ...fallback])).sort();
}

function getSpellNamesForClassUpToLevel(className, maxLevel) {
  const levelCap = Math.min(parseInt(maxLevel, 10) || 1, 9);
  const fromTags = Object.entries(spellDatabase)
    .filter(([, spell]) =>
      spell.level >= 1
      && spell.level <= levelCap
      && Array.isArray(spell.classes)
      && spell.classes.includes(className))
    .map(([name, spell]) => ({ name, level: spell.level }))
    .sort((a, b) => (a.level - b.level) || a.name.localeCompare(b.name));

  const mergedByName = new Map();
  fromTags.forEach(entry => mergedByName.set(entry.name, { name: entry.name, level: entry.level }));
  for (let i = 1; i <= levelCap; i++) {
    const levelSpells = dndClasses[className]?.spells?.[i] || [];
    levelSpells.forEach(name => {
      if (!mergedByName.has(name)) mergedByName.set(name, { name, level: i });
    });
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


// Show import popup
function showImportPopup(type) {
  if (Object.keys(spellDatabase).length === 0) {
    alert('Spell database is still loading, please try again in a moment.');
    return;
  }
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
  alert(importMode === 'cantrip' 
    ? `Imported ${importedCount} cantrips!`
    : (importMode === 'spell' 
      ? `Imported ${importedCount} spells!`
      : `Imported ${importedCount} spells and cantrips!`));
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
      wikiLink: spellData.wikiLink || `https://dnd5e.wikidot.com/spell:${name.toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]/g, '')}`
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
    wikiLink: `https://dnd5e.wikidot.com/spell:${name.toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]/g, '')}`
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
function clearAllSpells(type) {
  const currentCount = clearAllConfirmations[type];
  const requiredPresses = 3;
  
  // Increment the confirmation count
  clearAllConfirmations[type]++;
  
  if (clearAllConfirmations[type] < requiredPresses) {
    const remaining = requiredPresses - clearAllConfirmations[type];
    const typeName = type === 'cantrip' ? 'Cantrips' : 'Spells';
    
    // Update button text to show progress
    const button = event.target;
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
    alert(`No ${typeName} to clear!`);
    return;
  }
  
  // Final confirmation
  const confirmed = confirm(`Are you sure you want to clear ALL ${spellArray.length} ${typeName}?\n\nThis action cannot be undone!\n\nNote: This will NOT remove spells from your favorites.`);
  
  if (confirmed) {
    // Clear the spells array
    spellArray.length = 0;
    
    // Update the button back to normal
    const button = event.target;
    button.textContent = `Clear All ${typeName.charAt(0).toUpperCase() + typeName.slice(1)}`;
    button.style.backgroundColor = '#ff4444';
    
    // Re-render the spells
    renderSpells();
    autosave();
    
    alert(`All ${typeName} have been cleared!`);
  } else {
    // Reset button if user cancels
    const button = event.target;
    button.textContent = `Clear All ${typeName.charAt(0).toUpperCase() + typeName.slice(1)}`;
    button.style.backgroundColor = '#ff4444';
  }
}

