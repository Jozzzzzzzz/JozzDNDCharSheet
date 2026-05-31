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

// ========== SPELL SLOTS SYSTEM ==========

function addSpellSlot() {
  const name = document.getElementById('spell_slot_name').value.trim();
  const maxValue = parseInt(document.getElementById('spell_slot_max').value) || 1;
  const resetType = document.getElementById('spell_slot_reset_type').value;

  if (!name) { alert("Please enter a spell slot name"); return; }
  if (manualSpellSlots.find(s => s.name.toLowerCase() === name.toLowerCase())) {
    alert("A spell slot type with this name already exists"); return;
  }

  const slotId = 'spell_' + Date.now();
  manualSpellSlots.push({ id: slotId, name, maxValue, resetType });
  manualSpellSlotsUsed[slotId] = 0;
  updateSpellSlots();
  closePopup('addSpellSlotPopup');
  autosave();
}

function removeSpellSlot(slotId) {
  if (confirm('Are you sure you want to remove this spell slot type?')) {
    manualSpellSlots = manualSpellSlots.filter(s => s.id !== slotId);
    delete manualSpellSlotsUsed[slotId];
    updateSpellSlots();
    autosave();
  }
}

function updateSpellSlots() {
  const container = document.getElementById('spell_slots_container');
  if (!container) return;
  container.innerHTML = '';

  if (manualSpellSlots.length === 0) {
    container.innerHTML = '<p style="text-align: center; color: #666; font-style: italic; margin: 10px 0;">No spell slots yet. Click "Add Spell Slot Type" to get started!</p>';
    return;
  }

  manualSpellSlots.forEach(slot => {
    const slotDiv = document.createElement('div');
    slotDiv.className = 'spell-level-row';
    slotDiv.style.position = 'relative';
    const usedValue = manualSpellSlotsUsed[slot.id] || 0;
    const title = slot.resetType === 'long' ? 'Resets on Long Rest' : slot.resetType === 'short' ? 'Resets on Short Rest' : 'Manual Reset Only';
    slotDiv.innerHTML = `
      <span class="spell-level-label" title="${title}">${slot.name}:</span>
      <input type="number" class="spell-slot-input" min="0" max="15" value="${slot.maxValue}"
             onchange="updateSpellSlotMax('${slot.id}', this.value)">
      <div class="spell-slots-used" id="spell_used_${slot.id}"></div>
      <button onclick="showEditSpellSlotPopup('${slot.id}')"
              style="position: absolute; right: 70px; top: 50%; transform: translateY(-50%);
                     background: #4CAF50; color: white; border: none; border-radius: 3px;
                     padding: 2px 6px; font-size: 10px; cursor: pointer;"
              title="Edit Spell Slot">Edit</button>
      <button onclick="removeSpellSlot('${slot.id}')"
              style="position: absolute; right: -5px; top: 50%; transform: translateY(-50%);
                     background: #ff4444; color: white; border: none; border-radius: 3px;
                     padding: 2px 6px; font-size: 10px; cursor: pointer;"
              title="Remove Spell Slot">Delete</button>
    `;
    container.appendChild(slotDiv);

    const usedContainer = document.getElementById(`spell_used_${slot.id}`);
    usedContainer.innerHTML = '';
    for (let i = 0; i < slot.maxValue; i++) {
      const dot = document.createElement('div');
      dot.className = `spell-slot-dot ${i < usedValue ? 'used' : ''}`;
      dot.onclick = () => toggleSpellSlot(slot.id, i);
      usedContainer.appendChild(dot);
    }
  });
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

function resetSpellSlots(restType = 'all') {
  if (restType === 'all') {
    if (confirm('Are you sure you want to reset all spell slots?')) {
      manualSpellSlots.forEach(slot => { manualSpellSlotsUsed[slot.id] = 0; });
      updateSpellSlots();
      autosave();
    }
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
  if (!name) { alert("Please enter a spell slot name"); return; }
  if (manualSpellSlots.find(s => s.name.toLowerCase() === name.toLowerCase() && s.id !== currentEditingSpellSlotId)) {
    alert("A spell slot type with this name already exists"); return;
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

function showAddCustomResourcePopup() {
  document.getElementById('custom_resource_name').value = '';
  document.getElementById('custom_resource_max').value = '1';
  document.getElementById('custom_resource_reset_type').value = 'long';
  showPopup('addCustomResourcePopup');
}

function addCustomResource() {
  const name = document.getElementById('custom_resource_name').value.trim();
  const maxValue = parseInt(document.getElementById('custom_resource_max').value) || 1;
  const resetType = document.getElementById('custom_resource_reset_type').value;
  if (!name) { alert("Please enter a resource name"); return; }
  if (customResources.find(r => r.name.toLowerCase() === name.toLowerCase())) {
    alert("A resource with this name already exists"); return;
  }
  const resourceId = 'custom_' + Date.now();
  customResources.push({ id: resourceId, name, maxValue, resetType });
  customResourcesUsed[resourceId] = 0;
  updateCustomResources();
  closePopup('addCustomResourcePopup');
  autosave();
}

function removeCustomResource(resourceId) {
  if (confirm('Are you sure you want to remove this custom resource?')) {
    customResources = customResources.filter(r => r.id !== resourceId);
    delete customResourcesUsed[resourceId];
    updateCustomResources();
    autosave();
  }
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
      <div class="spell-slots-used" id="custom_used_${resource.id}"></div>
      <button onclick="removeCustomResource('${resource.id}')"
              style="position: absolute; right: -5px; top: 50%; transform: translateY(-50%);
                     background: #ff4444; color: white; border: none; border-radius: 3px;
                     width: 20px; height: 20px; font-size: 12px; cursor: pointer;"
              title="Remove Resource">×</button>
    `;
    container.appendChild(resourceDiv);
    const usedContainer = document.getElementById(`custom_used_${resource.id}`);
    usedContainer.innerHTML = '';
    for (let i = 0; i < resource.maxValue; i++) {
      const dot = document.createElement('div');
      dot.className = `spell-slot-dot ${i < usedValue ? 'used' : ''}`;
      dot.onclick = () => toggleCustomResource(resource.id, i);
      usedContainer.appendChild(dot);
    }
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

function resetCustomResources(restType = 'all') {
  if (restType === 'all') {
    if (confirm('Are you sure you want to reset all custom resources?')) {
      customResources.forEach(r => { customResourcesUsed[r.id] = 0; });
      updateCustomResources();
      autosave();
    }
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
    populateSpellForm(spell);
  } else {
    // Add new spell
    title.textContent = type === 'cantrip' ? 'Add Cantrip' : 'Add Spell';
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
  document.getElementById('spellWikiLink').value = spell.wikiLink || '';
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
    wikiLink: document.getElementById('spellWikiLink').value
  };
  
  const isCantrip = spell.level === 0;
  const spellArray = isCantrip ? spellsData.cantrips : spellsData.spells;
  
  // Check if editing existing spell
  const formTitle = document.getElementById('spellFormTitle').textContent;
  if (formTitle.includes('Edit')) {
    // Find and update existing spell
    const spellName = document.getElementById('spellName').value;
    const index = spellArray.findIndex(s => s.name === spellName);
    if (index !== -1) {
      spellArray[index] = spell;
    }
  } else {
    // Add new spell
    spellArray.push(spell);
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
  spellInfo.innerHTML = `
    <strong>${spell.name}</strong>
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
  document.getElementById('spellDetailDescription').textContent = spell.description;
  
  // Show/hide wiki link
  const wikiLinkRow = document.getElementById('spellDetailWikiLink');
  const wikiLink = document.getElementById('spellWikiLink');
  
  if (spell.wikiLink) {
    wikiLink.href = spell.wikiLink;
    wikiLinkRow.style.display = 'block';
  } else {
    // Generate wiki link from spell name if not provided
    const generatedLink = `https://dnd5e.wikidot.com/spell:${spell.name.toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]/g, '')}`;
    wikiLink.href = generatedLink;
    wikiLinkRow.style.display = 'block';
  }
  
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
  if (confirm('Are you sure you want to remove this spell?')) {
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
  }
}


function createPreparedSpellItem(spell, actionType, indexToUse) {
  const item = document.createElement('div');
  item.className = 'spell-item';

  if (spell.ritual) item.classList.add('spell-ritual');
  if (spell.concentration) item.classList.add('spell-concentration');
  if (spell.prepared) item.classList.add('spell-prepared');

  const isFav = isFavorited(actionType, spell.name);

  const spellInfo = document.createElement('div');
  spellInfo.innerHTML = `
    <strong>${spell.name}</strong>
    <span style="color: #888; font-size: 0.9em;">
      ${spell.school} � ${spell.castingTime} � ${spell.range}
      ${spell.damage ? ` � ${spell.damage}` : ''}
    </span>
  `;

  const star = document.createElement('span');
  star.className = `favorite-star ${isFav ? 'favorited' : 'not-favorited'}`;
  star.textContent = '?';
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

  Object.keys(grouped)
    .sort((a, b) => parseInt(a, 10) - parseInt(b, 10))
    .forEach(level => {
      const levelEntries = grouped[level];
      const levelSection = document.createElement('div');
      levelSection.className = 'spell-level-section';

      const levelHeader = document.createElement('div');
      levelHeader.className = 'spell-level-header';
      levelHeader.innerHTML = `
        <span>${level === '0' ? 'Cantrips' : `${level}${getOrdinalSuffix(parseInt(level, 10))} Level`}</span>
        <span>(${levelEntries.length} spell${levelEntries.length !== 1 ? 's' : ''})</span>
      `;
      levelSection.appendChild(levelHeader);

      levelEntries.forEach(entry => {
        const spellItem = createPreparedSpellItem(entry.spell, entry.actionType, entry.index);
        levelSection.appendChild(spellItem);
      });

      container.appendChild(levelSection);
    });
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
  
  if (type === 'cantrip') {
    statusFilter = document.getElementById('cantrip_filter').value;
  } else {
    levelFilter = document.getElementById('spell_level_filter').value;
    schoolFilter = document.getElementById('spell_school_filter').value;
    statusFilter = document.getElementById('spell_status_filter').value;
  }
  
  // Filter spells
  let filteredSpells = spells.filter(spell => {
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

// ========== IMPORT COMMON SPELLS ==========
function importCommonCantrips() {
  const commonCantrips = [
    {
      name: "Eldritch Blast",
      level: 0,
      school: "Evocation",
      castingTime: "1 action",
      range: "120 feet",
      components: "V, S",
      duration: "Instantaneous",
      damage: "1d10 force damage",
      save: "",
      attack: "Ranged spell attack",
      ritual: false,
      concentration: false,
      description: "A beam of crackling energy streaks toward a creature within range. Make a ranged spell attack against the target. On a hit, the target takes 1d10 force damage."
    },
    {
      name: "Guidance",
      level: 0,
      school: "Divination",
      castingTime: "1 action",
      range: "Touch",
      components: "V, S",
      duration: "Concentration, up to 1 minute",
      damage: "",
      save: "",
      attack: "",
      ritual: false,
      concentration: true,
      description: "You touch one willing creature. Once before the spell ends, the target can roll a d4 and add the number rolled to one ability check of its choice."
    },
    {
      name: "Light",
      level: 0,
      school: "Evocation",
      castingTime: "1 action",
      range: "Touch",
      components: "V, M (a firefly or phosphorescent moss)",
      duration: "1 hour",
      damage: "",
      save: "",
      attack: "",
      ritual: false,
      concentration: false,
      description: "You touch one object that is no larger than 10 feet in any dimension. Until the spell ends, the object sheds bright light in a 20-foot radius and dim light for an additional 20 feet."
    },
    {
      name: "Minor Illusion",
      level: 0,
      school: "Illusion",
      castingTime: "1 action",
      range: "30 feet",
      components: "S, M (a bit of fleece)",
      duration: "1 minute",
      damage: "",
      save: "Intelligence save",
      attack: "",
      ritual: false,
      concentration: false,
      description: "You create a sound or an image of an object within range that lasts for the duration. The illusion also ends if you dismiss it as an action or cast this spell again."
    },
    {
      name: "Sacred Flame",
      level: 0,
      school: "Evocation",
      castingTime: "1 action",
      range: "60 feet",
      components: "V, S",
      duration: "Instantaneous",
      damage: "1d8 radiant damage",
      save: "Dexterity save",
      attack: "",
      ritual: false,
      concentration: false,
      description: "Flame-like radiance descends on a creature that you can see within range. The target must succeed on a Dexterity saving throw or take 1d8 radiant damage."
    }
  ];
  
  // Add cantrips that don't already exist
  commonCantrips.forEach(cantrip => {
    if (!spellsData.cantrips.find(spell => spell.name === cantrip.name)) {
      spellsData.cantrips.push(cantrip);
    }
  });
  
  renderSpells();
  autosave();
  alert(`Imported ${commonCantrips.length} common cantrips!`);
}

// Import common spells
function importCommonSpells() {
  const commonSpells = [
    {
      name: "Cure Wounds",
      level: 1,
      school: "Evocation",
      castingTime: "1 action",
      range: "Touch",
      components: "V, S",
      duration: "Instantaneous",
      damage: "1d8 + spellcasting ability modifier healing",
      save: "",
      attack: "",
      ritual: false,
      concentration: false,
      description: "A creature you touch regains a number of hit points equal to 1d8 + your spellcasting ability modifier. This spell has no effect on undead or constructs."
    },
    {
      name: "Detect Magic",
      level: 1,
      school: "Divination",
      castingTime: "1 action",
      range: "Self",
      components: "V, S",
      duration: "Concentration, up to 10 minutes",
      damage: "",
      save: "",
      attack: "",
      ritual: true,
      concentration: true,
      description: "For the duration, you sense the presence of magic within 30 feet of you. If you sense magic in this way, you can use your action to see a faint aura around any visible creature or object in the area that bears magic."
    },
    {
      name: "Shield",
      level: 1,
      school: "Abjuration",
      castingTime: "1 reaction, which you take when you are hit by an attack or targeted by the magic missile spell",
      range: "Self",
      components: "V, S",
      duration: "1 round",
      damage: "",
      save: "",
      attack: "",
      ritual: false,
      concentration: false,
      description: "An invisible barrier of magical force appears and protects you. Until the start of your next turn, you have a +5 bonus to AC, including against the triggering attack, and you take no damage from magic missile."
    },
    {
      name: "Sleep",
      level: 1,
      school: "Enchantment",
      castingTime: "1 action",
      range: "90 feet",
      components: "V, S, M (a pinch of fine sand, rose petals, or a cricket)",
      duration: "1 minute",
      damage: "",
      save: "",
      attack: "",
      ritual: false,
      concentration: false,
      description: "This spell sends creatures into a magical slumber. Roll 5d8; the total is how many hit points of creatures this spell can affect. Creatures within 20 feet of a point you choose within range are affected in ascending order of their current hit points."
    },
    {
      name: "Bless",
      level: 1,
      school: "Enchantment",
      castingTime: "1 action",
      range: "30 feet",
      components: "V, S, M (a sprinkling of holy water)",
      duration: "Concentration, up to 1 minute",
      damage: "",
      save: "",
      attack: "",
      ritual: false,
      concentration: true,
      description: "You bless up to three creatures of your choice within range. Whenever a target makes an attack roll or a saving throw before the spell ends, the target can roll a d4 and add the number rolled to the attack roll or saving throw."
    }
  ];
  
  // Add spells that don't already exist
  commonSpells.forEach(spell => {
    if (!spellsData.spells.find(s => s.name === spell.name)) {
      spellsData.spells.push(spell);
    }
  });
  
  renderSpells();
  autosave();
  alert(`Imported ${commonSpells.length} common spells!`);
}

// D&D 5e Classes and their spell lists (Updated 2025)
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
      5: ['Animate Objects', 'Awaken', 'Dominate Person', 'Dream', 'Geas', 'Greater Restoration', 'Hold Monster', 'Legend Lore', 'Mass Cure Wounds', 'Mislead', 'Modify Memory', 'Planar Binding', 'Raise Dead', 'Scrying', 'Seeming', 'Teleportation Circle']
    }
  },
  'Cleric': {
    cantrips: ['Guidance', 'Light', 'Mending', 'Resistance', 'Sacred Flame', 'Spare the Dying', 'Thaumaturgy'],
    spells: {
      1: ['Bane', 'Bless', 'Command', 'Create or Destroy Water', 'Cure Wounds', 'Detect Evil and Good', 'Detect Magic', 'Detect Poison and Disease', 'Guiding Bolt', 'Healing Word', 'Inflict Wounds', 'Protection from Evil and Good', 'Purify Food and Drink', 'Sanctuary', 'Shield of Faith'],
      2: ['Aid', 'Augury', 'Blindness/Deafness', 'Calm Emotions', 'Continual Flame', 'Enhance Ability', 'Find Traps', 'Gentle Repose', 'Hold Person', 'Lesser Restoration', 'Locate Object', 'Prayer of Healing', 'Protection from Poison', 'Silence', 'Spiritual Weapon', 'Warding Bond', 'Zone of Truth'],
      3: ['Animate Dead', 'Beacon of Hope', 'Bestow Curse', 'Clairvoyance', 'Create Food and Water', 'Daylight', 'Dispel Magic', 'Feign Death', 'Glyph of Warding', 'Locate Object', 'Magic Circle', 'Mass Healing Word', 'Meld into Stone', 'Protection from Energy', 'Remove Curse', 'Revivify', 'Sending', 'Speak with Dead', 'Spirit Guardians', 'Tongues', 'Water Walk'],
      4: ['Banishment', 'Control Water', 'Death Ward', 'Divination', 'Freedom of Movement', 'Guardian of Faith', 'Locate Creature', 'Stone Shape'],
      5: ['Commune', 'Contagion', 'Dispel Evil and Good', 'Flame Strike', 'Geas', 'Greater Restoration', 'Hallow', 'Insect Plague', 'Legend Lore', 'Mass Cure Wounds', 'Planar Binding', 'Raise Dead', 'Scrying', 'Tree Stride']
    }
  },
  'Druid': {
    cantrips: ['Druidcraft', 'Guidance', 'Mending', 'Poison Spray', 'Produce Flame', 'Resistance', 'Shillelagh', 'Thorn Whip'],
    spells: {
      1: ['Animal Friendship', 'Charm Person', 'Create or Destroy Water', 'Cure Wounds', 'Detect Magic', 'Detect Poison and Disease', 'Entangle', 'Faerie Fire', 'Fog Cloud', 'Goodberry', 'Healing Word', 'Jump', 'Longstrider', 'Purify Food and Drink', 'Speak with Animals', 'Thunderwave'],
      2: ['Animal Messenger', 'Barkskin', 'Beast Sense', 'Darkvision', 'Enhance Ability', 'Find Traps', 'Flame Blade', 'Flaming Sphere', 'Gust of Wind', 'Heat Metal', 'Hold Person', 'Lesser Restoration', 'Locate Object', 'Moonbeam', 'Pass without Trace', 'Protection from Poison', 'Spike Growth'],
      3: ['Call Lightning', 'Conjure Animals', 'Daylight', 'Dispel Magic', 'Feign Death', 'Flame Arrows', 'Giant Insect', 'Gust of Wind', 'Meld into Stone', 'Plant Growth', 'Protection from Energy', 'Sleet Storm', 'Speak with Plants', 'Water Breathing', 'Water Walk', 'Wind Wall'],
      4: ['Blight', 'Confusion', 'Conjure Minor Elementals', 'Conjure Woodland Beings', 'Control Water', 'Dominate Beast', 'Freedom of Movement', 'Giant Insect', 'Grasping Vine', 'Hallucinatory Terrain', 'Ice Storm', 'Locate Creature', 'Polymorph', 'Stone Shape', 'Stoneskin', 'Wall of Fire'],
      5: ['Antilife Shell', 'Awaken', 'Commune with Nature', 'Conjure Elemental', 'Contagion', 'Geas', 'Greater Restoration', 'Insect Plague', 'Mass Cure Wounds', 'Planar Binding', 'Reincarnate', 'Scrying', 'Tree Stride', 'Wall of Stone']
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
      5: ['Animate Objects', 'Cloudkill', 'Cone of Cold', 'Creation', 'Dominate Person', 'Hold Monster', 'Insect Plague', 'Seeming', 'Telekinesis', 'Teleportation Circle', 'Wall of Stone']
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
      5: ['Animate Objects', 'Bigby\'s Hand', 'Cloudkill', 'Cone of Cold', 'Conjure Elemental', 'Contact Other Plane', 'Creation', 'Dominate Person', 'Dream', 'Geas', 'Hold Monster', 'Legend Lore', 'Mislead', 'Modify Memory', 'Passwall', 'Planar Binding', 'Rary\'s Telepathic Bond', 'Scrying', 'Seeming', 'Telekinesis', 'Teleportation Circle', 'Wall of Force', 'Wall of Stone']
    }
  }
};

// Comprehensive D&D 5e Spell Database (Updated 2025)
const spellDatabase = {
  // Cantrips (Level 0)
  'Acid Splash': {
    level: 0,
    school: 'Conjuration',
    castingTime: '1 action',
    range: '60 feet',
    components: 'V, S',
    duration: 'Instantaneous',
    damage: '1d6 acid damage',
    save: 'Dexterity save',
    attack: '',
    ritual: false,
    concentration: false,
    description: 'You hurl a bubble of acid. Choose one creature within range, or choose two creatures within range that are within 5 feet of each other.',
    wikiLink: 'https://dnd5e.wikidot.com/spell:acid-splash'
  },
  'Blade Ward': {
    level: 0,
    school: 'Abjuration',
    castingTime: '1 action',
    range: 'Self',
    components: 'V, S',
    duration: '1 round',
    damage: '',
    save: '',
    attack: '',
    ritual: false,
    concentration: false,
    description: 'You extend your hand and trace a sigil of warding in the air. Until the end of your next turn, you have resistance against bludgeoning, piercing, and slashing damage dealt by weapon attacks.',
    wikiLink: 'https://dnd5e.wikidot.com/spell:blade-ward'
  },
  'Chill Touch': {
    level: 0,
    school: 'Necromancy',
    castingTime: '1 action',
    range: '120 feet',
    components: 'V, S',
    duration: '1 round',
    damage: '1d8 necrotic damage',
    save: '',
    attack: 'Ranged spell attack',
    ritual: false,
    concentration: false,
    description: 'You create a ghostly, skeletal hand in the space of a creature within range. Make a ranged spell attack against the creature to assail it with the chill of the grave.',
    wikiLink: 'https://dnd5e.wikidot.com/spell:chill-touch'
  },
  'Dancing Lights': {
    level: 0,
    school: 'Evocation',
    castingTime: '1 action',
    range: '120 feet',
    components: 'V, S, M (a bit of phosphorus or wychwood, or a glowworm)',
    duration: 'Concentration, up to 1 minute',
    damage: '',
    save: '',
    attack: '',
    ritual: false,
    concentration: true,
    description: 'You create up to four torch-sized lights within range, making them appear as torches, lanterns, or glowing orbs that hover in the air for the duration.',
    wikiLink: 'https://dnd5e.wikidot.com/spell:dancing-lights'
  },
  'Druidcraft': {
    level: 0,
    school: 'Transmutation',
    castingTime: '1 action',
    range: '30 feet',
    components: 'V, S',
    duration: 'Instantaneous',
    damage: '',
    save: '',
    attack: '',
    ritual: false,
    concentration: false,
    description: 'Whispering to the spirits of nature, you create one of the following effects within range: predict weather, make a flower bloom, create a harmless sensory effect, or light/snuff a small flame.',
    wikiLink: 'https://dnd5e.wikidot.com/spell:druidcraft'
  },
  'Eldritch Blast': {
    level: 0,
    school: 'Evocation',
    castingTime: '1 action',
    range: '120 feet',
    components: 'V, S',
    duration: 'Instantaneous',
    damage: '1d10 force damage',
    save: '',
    attack: 'Ranged spell attack',
    ritual: false,
    concentration: false,
    description: 'A beam of crackling energy streaks toward a creature within range. Make a ranged spell attack against the target.',
    wikiLink: 'https://dnd5e.wikidot.com/spell:eldritch-blast'
  },
  'Fire Bolt': {
    level: 0,
    school: 'Evocation',
    castingTime: '1 action',
    range: '120 feet',
    components: 'V, S',
    duration: 'Instantaneous',
    damage: '1d10 fire damage',
    save: '',
    attack: 'Ranged spell attack',
    ritual: false,
    concentration: false,
    description: 'You hurl a mote of fire at a creature or object within range. Make a ranged spell attack against the target.',
    wikiLink: 'https://dnd5e.wikidot.com/spell:fire-bolt'
  },
  'Friends': {
    level: 0,
    school: 'Enchantment',
    castingTime: '1 action',
    range: 'Self',
    components: 'S, M (a small amount of makeup applied to the face as this spell is cast)',
    duration: 'Concentration, up to 1 minute',
    damage: '',
    save: '',
    attack: '',
    ritual: false,
    concentration: true,
    description: 'For the duration, you have advantage on all Charisma checks directed at one creature of your choice that isn\'t hostile toward you.',
    wikiLink: 'https://dnd5e.wikidot.com/spell:friends'
  },
  'Guidance': {
    level: 0,
    school: 'Divination',
    castingTime: '1 action',
    range: 'Touch',
    components: 'V, S',
    duration: 'Concentration, up to 1 minute',
    damage: '',
    save: '',
    attack: '',
    ritual: false,
    concentration: true,
    description: 'You touch one willing creature. Once before the spell ends, the target can roll a d4 and add the number rolled to one ability check of its choice.',
    wikiLink: 'https://dnd5e.wikidot.com/spell:guidance'
  },
  'Light': {
    level: 0,
    school: 'Evocation',
    castingTime: '1 action',
    range: 'Touch',
    components: 'V, M (a firefly or phosphorescent moss)',
    duration: '1 hour',
    damage: '',
    save: '',
    attack: '',
    ritual: false,
    concentration: false,
    description: 'You touch one object that is no larger than 10 feet in any dimension. Until the spell ends, the object sheds bright light in a 20-foot radius and dim light for an additional 20 feet.',
    wikiLink: 'https://dnd5e.wikidot.com/spell:light'
  },
  'Mage Hand': {
    level: 0,
    school: 'Conjuration',
    castingTime: '1 action',
    range: '30 feet',
    components: 'V, S',
    duration: '1 minute',
    damage: '',
    save: '',
    attack: '',
    ritual: false,
    concentration: false,
    description: 'A spectral, floating hand appears at a point you choose within range. The hand lasts for the duration or until you dismiss it as an action.',
    wikiLink: 'https://dnd5e.wikidot.com/spell:mage-hand'
  },
  'Mending': {
    level: 0,
    school: 'Transmutation',
    castingTime: '1 minute',
    range: 'Touch',
    components: 'V, S, M (two lodestones)',
    duration: 'Instantaneous',
    damage: '',
    save: '',
    attack: '',
    ritual: false,
    concentration: false,
    description: 'This spell repairs a single break or tear in an object you touch, such as a broken chain link, two halves of a broken key, a torn cloak, or a leaking wineskin.',
    wikiLink: 'https://dnd5e.wikidot.com/spell:mending'
  },
  'Message': {
    level: 0,
    school: 'Transmutation',
    castingTime: '1 action',
    range: '120 feet',
    components: 'V, S, M (a short piece of copper wire)',
    duration: '1 round',
    damage: '',
    save: '',
    attack: '',
    ritual: false,
    concentration: false,
    description: 'You point your finger toward a creature within range and whisper a message. The target (and only the target) hears the message and can reply in a whisper that only you can hear.',
    wikiLink: 'https://dnd5e.wikidot.com/spell:message'
  },
  'Minor Illusion': {
    level: 0,
    school: 'Illusion',
    castingTime: '1 action',
    range: '30 feet',
    components: 'S, M (a bit of fleece)',
    duration: '1 minute',
    damage: '',
    save: 'Intelligence save',
    attack: '',
    ritual: false,
    concentration: false,
    description: 'You create a sound or an image of an object within range that lasts for the duration. The illusion also ends if you dismiss it as an action or cast this spell again.',
    wikiLink: 'https://dnd5e.wikidot.com/spell:minor-illusion'
  },
  'Poison Spray': {
    level: 0,
    school: 'Conjuration',
    castingTime: '1 action',
    range: '10 feet',
    components: 'V, S',
    duration: 'Instantaneous',
    damage: '1d12 poison damage',
    save: 'Constitution save',
    attack: '',
    ritual: false,
    concentration: false,
    description: 'You extend your hand toward a creature you can see within range and project a puff of noxious gas from your palm.',
    wikiLink: 'https://dnd5e.wikidot.com/spell:poison-spray'
  },
  'Prestidigitation': {
    level: 0,
    school: 'Transmutation',
    castingTime: '1 action',
    range: '10 feet',
    components: 'V, S',
    duration: 'Up to 1 hour',
    damage: '',
    save: '',
    attack: '',
    ritual: false,
    concentration: false,
    description: 'This spell is a minor magical trick that novice spellcasters use for practice. You create one of several magical effects within range.',
    wikiLink: 'https://dnd5e.wikidot.com/spell:prestidigitation'
  },
  'Produce Flame': {
    level: 0,
    school: 'Conjuration',
    castingTime: '1 action',
    range: 'Self',
    components: 'V, S',
    duration: '10 minutes',
    damage: '1d8 fire damage',
    save: '',
    attack: 'Ranged spell attack',
    ritual: false,
    concentration: false,
    description: 'A flickering flame appears in your hand. The flame remains there for the duration and harms neither you nor your equipment.',
    wikiLink: 'https://dnd5e.wikidot.com/spell:produce-flame'
  },
  'Ray of Frost': {
    level: 0,
    school: 'Evocation',
    castingTime: '1 action',
    range: '60 feet',
    components: 'V, S',
    duration: 'Instantaneous',
    damage: '1d8 cold damage',
    save: '',
    attack: 'Ranged spell attack',
    ritual: false,
    concentration: false,
    description: 'A frigid beam of blue-white light streaks toward a creature within range. Make a ranged spell attack against the target.',
    wikiLink: 'https://dnd5e.wikidot.com/spell:ray-of-frost'
  },
  'Resistance': {
    level: 0,
    school: 'Abjuration',
    castingTime: '1 action',
    range: 'Touch',
    components: 'V, S, M (a miniature cloak)',
    duration: 'Concentration, up to 1 minute',
    damage: '',
    save: '',
    attack: '',
    ritual: false,
    concentration: true,
    description: 'You touch one willing creature. Once before the spell ends, the target can roll a d4 and add the number rolled to one saving throw of its choice.',
    wikiLink: 'https://dnd5e.wikidot.com/spell:resistance'
  },
  'Sacred Flame': {
    level: 0,
    school: 'Evocation',
    castingTime: '1 action',
    range: '60 feet',
    components: 'V, S',
    duration: 'Instantaneous',
    damage: '1d8 radiant damage',
    save: 'Dexterity save',
    attack: '',
    ritual: false,
    concentration: false,
    description: 'Flame-like radiance descends on a creature that you can see within range. The target must succeed on a Dexterity saving throw or take 1d8 radiant damage.',
    wikiLink: 'https://dnd5e.wikidot.com/spell:sacred-flame'
  },
  'Shillelagh': {
    level: 0,
    school: 'Transmutation',
    castingTime: '1 bonus action',
    range: 'Touch',
    components: 'V, S, M (mistletoe, a shamrock leaf, and a club or quarterstaff)',
    duration: '1 minute',
    damage: '',
    save: '',
    attack: '',
    ritual: false,
    concentration: false,
    description: 'The wood of a club or quarterstaff you are holding is imbued with nature\'s power. For the duration, you can use your spellcasting ability instead of Strength for the attack and damage rolls of melee attacks using that weapon.',
    wikiLink: 'https://dnd5e.wikidot.com/spell:shillelagh'
  },
  'Shocking Grasp': {
    level: 0,
    school: 'Evocation',
    castingTime: '1 action',
    range: 'Touch',
    components: 'V, S',
    duration: 'Instantaneous',
    damage: '1d8 lightning damage',
    save: '',
    attack: 'Melee spell attack',
    ritual: false,
    concentration: false,
    description: 'Lightning springs from your hand to deliver a shock to a creature you try to touch. Make a melee spell attack against the target.',
    wikiLink: 'https://dnd5e.wikidot.com/spell:shocking-grasp'
  },
  'Spare the Dying': {
    level: 0,
    school: 'Necromancy',
    castingTime: '1 action',
    range: 'Touch',
    components: 'V, S',
    duration: 'Instantaneous',
    damage: '',
    save: '',
    attack: '',
    ritual: false,
    concentration: false,
    description: 'You touch a living creature that has 0 hit points. The creature becomes stable. This spell has no effect on undead or constructs.',
    wikiLink: 'https://dnd5e.wikidot.com/spell:spare-the-dying'
  },
  'Thaumaturgy': {
    level: 0,
    school: 'Transmutation',
    castingTime: '1 action',
    range: '30 feet',
    components: 'V',
    duration: 'Up to 1 minute',
    damage: '',
    save: '',
    attack: '',
    ritual: false,
    concentration: false,
    description: 'You manifest a minor wonder, a sign of supernatural power, within range. You create one of several magical effects within range.',
    wikiLink: 'https://dnd5e.wikidot.com/spell:thaumaturgy'
  },
  'Thorn Whip': {
    level: 0,
    school: 'Transmutation',
    castingTime: '1 action',
    range: '30 feet',
    components: 'V, S, M (the stem of a plant with thorns)',
    duration: 'Instantaneous',
    damage: '1d6 piercing damage',
    save: '',
    attack: 'Melee spell attack',
    ritual: false,
    concentration: false,
    description: 'You create a long, vine-like whip covered in thorns that lashes out at your command toward a creature in range.',
    wikiLink: 'https://dnd5e.wikidot.com/spell:thorn-whip'
  },
  'True Strike': {
    level: 0,
    school: 'Divination',
    castingTime: '1 action',
    range: '30 feet',
    components: 'S',
    duration: 'Concentration, up to 1 round',
    damage: '',
    save: '',
    attack: '',
    ritual: false,
    concentration: true,
    description: 'You extend your hand and point a finger at a target in range. Your magic grants you a brief insight into the target\'s defenses.',
    wikiLink: 'https://dnd5e.wikidot.com/spell:true-strike'
  },
  'Vicious Mockery': {
    level: 0,
    school: 'Enchantment',
    castingTime: '1 action',
    range: '60 feet',
    components: 'V',
    duration: 'Instantaneous',
    damage: '1d4 psychic damage',
    save: 'Wisdom save',
    attack: '',
    ritual: false,
    concentration: false,
    description: 'You unleash a string of insults laced with subtle enchantments at a creature you can see within range.',
    wikiLink: 'https://dnd5e.wikidot.com/spell:vicious-mockery'
  },
  'Booming Blade': {
    level: 0,
    school: 'Evocation',
    castingTime: '1 action',
    range: 'Self (5-foot radius)',
    components: 'S, M (a melee weapon worth at least 1 sp)',
    duration: '1 round',
    damage: '1d8 thunder damage',
    save: '',
    attack: 'Melee weapon attack',
    ritual: false,
    concentration: false,
    description: 'You brandish the weapon used in the spell\'s casting and make a melee attack with it against one creature within 5 feet of you.',
    wikiLink: 'https://dnd5e.wikidot.com/spell:booming-blade'
  },
  'Green-Flame Blade': {
    level: 0,
    school: 'Evocation',
    castingTime: '1 action',
    range: 'Self (5-foot radius)',
    components: 'S, M (a melee weapon worth at least 1 sp)',
    duration: 'Instantaneous',
    damage: '1d8 fire damage',
    save: '',
    attack: 'Melee weapon attack',
    ritual: false,
    concentration: false,
    description: 'You brandish the weapon used in the spell\'s casting and make a melee attack with it against one creature within 5 feet of you.',
    wikiLink: 'https://dnd5e.wikidot.com/spell:green-flame-blade'
  },
  'Sword Burst': {
    level: 0,
    school: 'Conjuration',
    castingTime: '1 action',
    range: 'Self (5-foot radius)',
    components: 'V',
    duration: 'Instantaneous',
    damage: '1d6 force damage',
    save: 'Dexterity save',
    attack: '',
    ritual: false,
    concentration: false,
    description: 'You create a momentary circle of spectral blades that sweep around you.',
    wikiLink: 'https://dnd5e.wikidot.com/spell:sword-burst'
  },
  'Toll the Dead': {
    level: 0,
    school: 'Necromancy',
    castingTime: '1 action',
    range: '60 feet',
    components: 'V, S',
    duration: 'Instantaneous',
    damage: '1d8 necrotic damage',
    save: 'Wisdom save',
    attack: '',
    ritual: false,
    concentration: false,
    description: 'You point at one creature you can see within range, and the sound of a dolorous bell fills the air around it for a moment.',
    wikiLink: 'https://dnd5e.wikidot.com/spell:toll-the-dead'
  },
  
  // 1st Level Spells
  'Absorb Elements': {
    level: 1,
    school: 'Abjuration',
    castingTime: '1 reaction, which you take when you take acid, cold, fire, lightning, or thunder damage',
    range: 'Self',
    components: 'S',
    duration: '1 round',
    damage: '',
    save: '',
    attack: '',
    ritual: false,
    concentration: false,
    description: 'The spell captures some of the incoming energy, lessening its effect on you and storing it for your next melee attack.',
    wikiLink: 'https://dnd5e.wikidot.com/spell:absorb-elements'
  },
  'Alarm': {
    level: 1,
    school: 'Abjuration',
    castingTime: '1 minute',
    range: '30 feet',
    components: 'V, S, M (a tiny bell and a piece of fine silver wire)',
    duration: '8 hours',
    damage: '',
    save: '',
    attack: '',
    ritual: true,
    concentration: false,
    description: 'You set an alarm against unwanted intrusion. Choose a door, a window, or an area within range that is no larger than a 20-foot cube.',
    wikiLink: 'https://dnd5e.wikidot.com/spell:alarm'
  },
  'Burning Hands': {
    level: 1,
    school: 'Evocation',
    castingTime: '1 action',
    range: 'Self (15-foot cone)',
    components: 'V, S',
    duration: 'Instantaneous',
    damage: '3d6 fire damage',
    save: 'Dexterity save',
    attack: '',
    ritual: false,
    concentration: false,
    description: 'As you hold your hands with thumbs touching and fingers spread, a thin sheet of flames shoots forth from your outstretched fingertips.',
    wikiLink: 'https://dnd5e.wikidot.com/spell:burning-hands'
  },
  'Charm Person': {
    level: 1,
    school: 'Enchantment',
    castingTime: '1 action',
    range: '30 feet',
    components: 'V, S',
    duration: '1 hour',
    damage: '',
    save: 'Wisdom save',
    attack: '',
    ritual: false,
    concentration: false,
    description: 'You attempt to charm a humanoid you can see within range. It must make a Wisdom saving throw, and does so with advantage if you or your companions are fighting it.',
    wikiLink: 'https://dnd5e.wikidot.com/spell:charm-person'
  },
  'Cure Wounds': {
    level: 1,
    school: 'Evocation',
    castingTime: '1 action',
    range: 'Touch',
    components: 'V, S',
    duration: 'Instantaneous',
    damage: '1d8 + spellcasting ability modifier healing',
    save: '',
    attack: '',
    ritual: false,
    concentration: false,
    description: 'A creature you touch regains a number of hit points equal to 1d8 + your spellcasting ability modifier. This spell has no effect on undead or constructs.',
    wikiLink: 'https://dnd5e.wikidot.com/spell:cure-wounds'
  },
  'Detect Magic': {
    level: 1,
    school: 'Divination',
    castingTime: '1 action',
    range: 'Self',
    components: 'V, S',
    duration: 'Concentration, up to 10 minutes',
    damage: '',
    save: '',
    attack: '',
    ritual: true,
    concentration: true,
    description: 'For the duration, you sense the presence of magic within 30 feet of you. If you sense magic in this way, you can use your action to see a faint aura around any visible creature or object in the area that bears magic.',
    wikiLink: 'https://dnd5e.wikidot.com/spell:detect-magic'
  },
  'Disguise Self': {
    level: 1,
    school: 'Illusion',
    castingTime: '1 action',
    range: 'Self',
    components: 'V, S',
    duration: '1 hour',
    damage: '',
    save: '',
    attack: '',
    ritual: false,
    concentration: false,
    description: 'You make yourself—including your clothing, armor, weapons, and other belongings on your person—look different until the spell ends or until you use your action to dismiss it.',
    wikiLink: 'https://dnd5e.wikidot.com/spell:disguise-self'
  },
  'Faerie Fire': {
    level: 1,
    school: 'Evocation',
    castingTime: '1 action',
    range: '60 feet',
    components: 'V',
    duration: 'Concentration, up to 1 minute',
    damage: '',
    save: 'Dexterity save',
    attack: '',
    ritual: false,
    concentration: true,
    description: 'Each object in a 20-foot cube within range is outlined in blue, green, or violet light (your choice). Any creature in the area when the spell is cast is also outlined in light if it fails a Dexterity saving throw.',
    wikiLink: 'https://dnd5e.wikidot.com/spell:faerie-fire'
  },
  'Feather Fall': {
    level: 1,
    school: 'Transmutation',
    castingTime: '1 reaction, which you take when you or a creature within 60 feet of you falls',
    range: '60 feet',
    components: 'V, M (a small feather or piece of down)',
    duration: '1 minute',
    damage: '',
    save: '',
    attack: '',
    ritual: false,
    concentration: false,
    description: 'Choose up to five falling creatures within range. A falling creature\'s rate of descent slows to 60 feet per round until the spell ends.',
    wikiLink: 'https://dnd5e.wikidot.com/spell:feather-fall'
  },
  'Find Familiar': {
    level: 1,
    school: 'Conjuration',
    castingTime: '1 hour',
    range: '10 feet',
    components: 'V, S, M (10 gp worth of charcoal, incense, and herbs that must be consumed by fire in a brass brazier)',
    duration: 'Instantaneous',
    damage: '',
    save: '',
    attack: '',
    ritual: true,
    concentration: false,
    description: 'You gain the service of a familiar, a spirit that takes an animal form you choose: bat, cat, crab, frog (toad), hawk, lizard, octopus, owl, poisonous snake, fish (quipper), rat, raven, sea horse, spider, or weasel.',
    wikiLink: 'https://dnd5e.wikidot.com/spell:find-familiar'
  },
  'Healing Word': {
    level: 1,
    school: 'Evocation',
    castingTime: '1 bonus action',
    range: '60 feet',
    components: 'V',
    duration: 'Instantaneous',
    damage: '1d4 + spellcasting ability modifier healing',
    save: '',
    attack: '',
    ritual: false,
    concentration: false,
    description: 'A creature of your choice that you can see within range regains hit points equal to 1d4 + your spellcasting ability modifier. This spell has no effect on undead or constructs.',
    wikiLink: 'https://dnd5e.wikidot.com/spell:healing-word'
  },
  'Magic Missile': {
    level: 1,
    school: 'Evocation',
    castingTime: '1 action',
    range: '120 feet',
    components: 'V, S',
    duration: 'Instantaneous',
    damage: '1d4 + 1 force damage per missile',
    save: '',
    attack: '',
    ritual: false,
    concentration: false,
    description: 'You create three glowing darts of magical force. Each dart hits a creature of your choice that you can see within range. A dart deals 1d4 + 1 force damage to its target.',
    wikiLink: 'https://dnd5e.wikidot.com/spell:magic-missile'
  },
  'Shield': {
    level: 1,
    school: 'Abjuration',
    castingTime: '1 reaction, which you take when you are hit by an attack or targeted by the magic missile spell',
    range: 'Self',
    components: 'V, S',
    duration: '1 round',
    damage: '',
    save: '',
    attack: '',
    ritual: false,
    concentration: false,
    description: 'An invisible barrier of magical force appears and protects you. Until the start of your next turn, you have a +5 bonus to AC, including against the triggering attack, and you take no damage from magic missile.',
    wikiLink: 'https://dnd5e.wikidot.com/spell:shield'
  },
  'Sleep': {
    level: 1,
    school: 'Enchantment',
    castingTime: '1 action',
    range: '90 feet',
    components: 'V, S, M (a pinch of fine sand, rose petals, or a cricket)',
    duration: '1 minute',
    damage: '',
    save: '',
    attack: '',
    ritual: false,
    concentration: false,
    description: 'This spell sends creatures into a magical slumber. Roll 5d8; the total is how many hit points of creatures this spell can affect. Creatures within 20 feet of a point you choose within range are affected in ascending order of their current hit points.',
    wikiLink: 'https://dnd5e.wikidot.com/spell:sleep'
  },
  'Thunderwave': {
    level: 1,
    school: 'Evocation',
    castingTime: '1 action',
    range: 'Self (15-foot cube)',
    components: 'V, S',
    duration: 'Instantaneous',
    damage: '2d8 thunder damage',
    save: 'Constitution save',
    attack: '',
    ritual: false,
    concentration: false,
    description: 'A wave of thunderous force sweeps out from you. Each creature in a 15-foot cube originating from you must make a Constitution saving throw.',
    wikiLink: 'https://dnd5e.wikidot.com/spell:thunderwave'
  },
  
  // 2nd Level Spells
  'Aid': {
    level: 2,
    school: 'Enchantment',
    castingTime: '1 action',
    range: '30 feet',
    components: 'V, S, M (a tiny strip of white cloth)',
    duration: '8 hours',
    damage: '',
    save: '',
    attack: '',
    ritual: false,
    concentration: false,
    description: 'Your spell bolsters your allies with toughness and resolve. Choose up to three creatures within range. Each target\'s hit point maximum and current hit points increase by 5 for the duration.',
    wikiLink: 'https://dnd5e.wikidot.com/spell:aid'
  },
  'Blur': {
    level: 2,
    school: 'Illusion',
    castingTime: '1 action',
    range: 'Self',
    components: 'V',
    duration: 'Concentration, up to 1 minute',
    damage: '',
    save: '',
    attack: '',
    ritual: false,
    concentration: true,
    description: 'Your body becomes blurred, shifting and wavering to all who can see you. For the duration, any creature has disadvantage on attack rolls against you.',
    wikiLink: 'https://dnd5e.wikidot.com/spell:blur'
  },
  'Darkvision': {
    level: 2,
    school: 'Transmutation',
    castingTime: '1 action',
    range: 'Touch',
    components: 'V, S, M (either a pinch of dried carrot or an agate)',
    duration: '8 hours',
    damage: '',
    save: '',
    attack: '',
    ritual: false,
    concentration: false,
    description: 'You touch a willing creature to grant it the ability to see in the dark. For the duration, that creature has darkvision out to a range of 60 feet.',
    wikiLink: 'https://dnd5e.wikidot.com/spell:darkvision'
  },
  'Enhance Ability': {
    level: 2,
    school: 'Transmutation',
    castingTime: '1 action',
    range: 'Touch',
    components: 'V, S, M (fur or a feather from a beast)',
    duration: 'Concentration, up to 1 hour',
    damage: '',
    save: '',
    attack: '',
    ritual: false,
    concentration: true,
    description: 'You touch a creature and bestow upon it a magical enhancement. Choose one of the following effects; the target gains that effect until the spell ends.',
    wikiLink: 'https://dnd5e.wikidot.com/spell:enhance-ability'
  },
  'Heat Metal': {
    level: 2,
    school: 'Transmutation',
    castingTime: '1 action',
    range: '60 feet',
    components: 'V, S, M (a piece of iron and a flame)',
    duration: 'Concentration, up to 1 minute',
    damage: '2d8 fire damage',
    save: '',
    attack: '',
    ritual: false,
    concentration: true,
    description: 'Choose a manufactured metal object, such as a metal weapon or a suit of heavy or medium metal armor, that you can see within range.',
    wikiLink: 'https://dnd5e.wikidot.com/spell:heat-metal'
  },
  'Hold Person': {
    level: 2,
    school: 'Enchantment',
    castingTime: '1 action',
    range: '60 feet',
    components: 'V, S, M (a small, straight piece of iron)',
    duration: 'Concentration, up to 1 minute',
    damage: '',
    save: 'Wisdom save',
    attack: '',
    ritual: false,
    concentration: true,
    description: 'Choose a humanoid that you can see within range. The target must succeed on a Wisdom saving throw or be paralyzed for the duration.',
    wikiLink: 'https://dnd5e.wikidot.com/spell:hold-person'
  },
  'Invisibility': {
    level: 2,
    school: 'Illusion',
    castingTime: '1 action',
    range: 'Touch',
    components: 'V, S, M (an eyelash encased in gum arabic)',
    duration: 'Concentration, up to 1 hour',
    damage: '',
    save: '',
    attack: '',
    ritual: false,
    concentration: true,
    description: 'A creature you touch becomes invisible until the spell ends. Anything the target is wearing or carrying is invisible as long as it is on the target\'s person.',
    wikiLink: 'https://dnd5e.wikidot.com/spell:invisibility'
  },
  'Lesser Restoration': {
    level: 2,
    school: 'Abjuration',
    castingTime: '1 action',
    range: 'Touch',
    components: 'V, S',
    duration: 'Instantaneous',
    damage: '',
    save: '',
    attack: '',
    ritual: false,
    concentration: false,
    description: 'You touch a creature and can end either one disease or one condition afflicting it. The condition can be blinded, deafened, paralyzed, or poisoned.',
    wikiLink: 'https://dnd5e.wikidot.com/spell:lesser-restoration'
  },
  'Misty Step': {
    level: 2,
    school: 'Conjuration',
    castingTime: '1 bonus action',
    range: 'Self',
    components: 'V',
    duration: 'Instantaneous',
    damage: '',
    save: '',
    attack: '',
    ritual: false,
    concentration: false,
    description: 'Briefly surrounded by silvery mist, you teleport up to 30 feet to an unoccupied space that you can see.',
    wikiLink: 'https://dnd5e.wikidot.com/spell:misty-step'
  },
  'Scorching Ray': {
    level: 2,
    school: 'Evocation',
    castingTime: '1 action',
    range: '120 feet',
    components: 'V, S',
    duration: 'Instantaneous',
    damage: '2d6 fire damage per ray',
    save: '',
    attack: 'Ranged spell attack',
    ritual: false,
    concentration: false,
    description: 'You create three rays of fire and hurl them at targets within range. You can hurl them at one target or several. Make a ranged spell attack for each ray.',
    wikiLink: 'https://dnd5e.wikidot.com/spell:scorching-ray'
  },
  'Suggestion': {
    level: 2,
    school: 'Enchantment',
    castingTime: '1 action',
    range: '30 feet',
    components: 'V, M (a snake\'s tongue and either a bit of honeycomb or a drop of sweet oil)',
    duration: 'Concentration, up to 8 hours',
    damage: '',
    save: 'Wisdom save',
    attack: '',
    ritual: false,
    concentration: true,
    description: 'You suggest a course of activity (limited to a sentence or two) and magically influence a creature you can see within range that can hear and understand you.',
    wikiLink: 'https://dnd5e.wikidot.com/spell:suggestion'
  },
  'Web': {
    level: 2,
    school: 'Conjuration',
    castingTime: '1 action',
    range: '60 feet',
    components: 'V, S, M (a bit of spiderweb)',
    duration: 'Concentration, up to 1 hour',
    damage: '',
    save: 'Dexterity save',
    attack: '',
    ritual: false,
    concentration: true,
    description: 'You conjure a mass of thick, sticky webbing at a point of your choice within range. The webs fill a 20-foot cube from that point for the duration.',
    wikiLink: 'https://dnd5e.wikidot.com/spell:web'
  },
  
  // 3rd Level Spells
  'Counterspell': {
    level: 3,
    school: 'Abjuration',
    castingTime: '1 reaction, which you take when you see a creature within 60 feet of you casting a spell',
    range: '60 feet',
    components: 'S',
    duration: 'Instantaneous',
    damage: '',
    save: '',
    attack: '',
    ritual: false,
    concentration: false,
    description: 'You attempt to interrupt a creature in the process of casting a spell. If the creature is casting a spell of 3rd level or lower, its spell fails and has no effect.',
    wikiLink: 'https://dnd5e.wikidot.com/spell:counterspell'
  },
  'Dispel Magic': {
    level: 3,
    school: 'Abjuration',
    castingTime: '1 action',
    range: '120 feet',
    components: 'V, S',
    duration: 'Instantaneous',
    damage: '',
    save: '',
    attack: '',
    ritual: false,
    concentration: false,
    description: 'Choose any creature, object, or magical effect within range. Any spell of 3rd level or lower on the target ends. For each spell of 4th level or higher on the target, make an ability check using your spellcasting ability.',
    wikiLink: 'https://dnd5e.wikidot.com/spell:dispel-magic'
  },
  'Fireball': {
    level: 3,
    school: 'Evocation',
    castingTime: '1 action',
    range: '150 feet',
    components: 'V, S, M (a tiny ball of bat guano and sulfur)',
    duration: 'Instantaneous',
    damage: '8d6 fire damage',
    save: 'Dexterity save',
    attack: '',
    ritual: false,
    concentration: false,
    description: 'A bright streak flashes from your pointing finger to a point you choose within range and then blossoms with a low roar into an explosion of flame.',
    wikiLink: 'https://dnd5e.wikidot.com/spell:fireball'
  },
  'Fly': {
    level: 3,
    school: 'Transmutation',
    castingTime: '1 action',
    range: 'Touch',
    components: 'V, S, M (a wing feather from any bird)',
    duration: 'Concentration, up to 10 minutes',
    damage: '',
    save: '',
    attack: '',
    ritual: false,
    concentration: true,
    description: 'You touch a willing creature. The target gains a flying speed of 60 feet for the duration. When the spell ends, the target falls if it is still aloft, unless it can stop the fall.',
    wikiLink: 'https://dnd5e.wikidot.com/spell:fly'
  },
  'Haste': {
    level: 3,
    school: 'Transmutation',
    castingTime: '1 action',
    range: '30 feet',
    components: 'V, S, M (a shaving of licorice root)',
    duration: 'Concentration, up to 1 minute',
    damage: '',
    save: '',
    attack: '',
    ritual: false,
    concentration: true,
    description: 'Choose a willing creature that you can see within range. Until the spell ends, the target\'s speed is doubled, it gains a +2 bonus to AC, it has advantage on Dexterity saving throws, and it gains an additional action on each of its turns.',
    wikiLink: 'https://dnd5e.wikidot.com/spell:haste'
  },
  'Lightning Bolt': {
    level: 3,
    school: 'Evocation',
    castingTime: '1 action',
    range: 'Self (100-foot line)',
    components: 'V, S, M (a bit of fur and a rod of amber, crystal, or glass)',
    duration: 'Instantaneous',
    damage: '8d6 lightning damage',
    save: 'Dexterity save',
    attack: '',
    ritual: false,
    concentration: false,
    description: 'A stroke of lightning forming a line 100 feet long and 5 feet wide blasts out from you in a direction you choose.',
    wikiLink: 'https://dnd5e.wikidot.com/spell:lightning-bolt'
  },
  'Revivify': {
    level: 3,
    school: 'Necromancy',
    castingTime: '1 action',
    range: 'Touch',
    components: 'V, S, M (diamonds worth 300 gp, which the spell consumes)',
    duration: 'Instantaneous',
    damage: '',
    save: '',
    attack: '',
    ritual: false,
    concentration: false,
    description: 'You touch a creature that has died within the last minute. That creature returns to life with 1 hit point. This spell can\'t return to life a creature that has died of old age, nor can it restore any missing body parts.',
    wikiLink: 'https://dnd5e.wikidot.com/spell:revivify'
  },
  'Spirit Guardians': {
    level: 3,
    school: 'Conjuration',
    castingTime: '1 action',
    range: 'Self (15-foot radius)',
    components: 'V, S, M (a holy symbol)',
    duration: 'Concentration, up to 10 minutes',
    damage: '3d8 radiant or necrotic damage',
    save: 'Wisdom save',
    attack: '',
    ritual: false,
    concentration: true,
    description: 'You call forth spirits to protect you. They flit around you to a distance of 15 feet for the duration. If you are good or neutral, their spectral form appears angelic or fey (your choice).',
    wikiLink: 'https://dnd5e.wikidot.com/spell:spirit-guardians'
  },
  
  // 4th Level Spells
  'Banishment': {
    level: 4,
    school: 'Abjuration',
    castingTime: '1 action',
    range: '60 feet',
    components: 'V, S, M (an item distasteful to the target)',
    duration: 'Concentration, up to 1 minute',
    damage: '',
    save: 'Charisma save',
    attack: '',
    ritual: false,
    concentration: true,
    description: 'You attempt to send one creature that you can see within range to another plane of existence. The target must succeed on a Charisma saving throw or be banished.',
    wikiLink: 'https://dnd5e.wikidot.com/spell:banishment'
  },
  'Greater Invisibility': {
    level: 4,
    school: 'Illusion',
    castingTime: '1 action',
    range: 'Touch',
    components: 'V, S',
    duration: 'Concentration, up to 1 minute',
    damage: '',
    save: '',
    attack: '',
    ritual: false,
    concentration: true,
    description: 'You or a creature you touch becomes invisible until the spell ends. Anything the target is wearing or carrying is invisible as long as it is on the target\'s person.',
    wikiLink: 'https://dnd5e.wikidot.com/spell:greater-invisibility'
  },
  'Polymorph': {
    level: 4,
    school: 'Transmutation',
    castingTime: '1 action',
    range: '60 feet',
    components: 'V, S, M (a caterpillar cocoon)',
    duration: 'Concentration, up to 1 hour',
    damage: '',
    save: 'Wisdom save',
    attack: '',
    ritual: false,
    concentration: true,
    description: 'This spell transforms a creature that you can see within range into a new form. An unwilling creature must make a Wisdom saving throw to avoid the effect.',
    wikiLink: 'https://dnd5e.wikidot.com/spell:polymorph'
  },
  'Wall of Fire': {
    level: 4,
    school: 'Evocation',
    castingTime: '1 action',
    range: '120 feet',
    components: 'V, S, M (a small piece of phosphorus)',
    duration: 'Concentration, up to 1 minute',
    damage: '5d8 fire damage',
    save: 'Dexterity save',
    attack: '',
    ritual: false,
    concentration: true,
    description: 'You create a wall of fire on a solid surface within range. You can make the wall up to 60 feet long, 20 feet high, and 1 foot thick, or a ringed wall up to 20 feet in diameter, 20 feet high, and 1 foot thick.',
    wikiLink: 'https://dnd5e.wikidot.com/spell:wall-of-fire'
  },
  
  // 5th Level Spells
  'Cone of Cold': {
    level: 5,
    school: 'Evocation',
    castingTime: '1 action',
    range: 'Self (60-foot cone)',
    components: 'V, S, M (a small crystal or glass cone)',
    duration: 'Instantaneous',
    damage: '8d8 cold damage',
    save: 'Constitution save',
    attack: '',
    ritual: false,
    concentration: false,
    description: 'A blast of cold air erupts from your hands. Each creature in a 60-foot cone must make a Constitution saving throw.',
    wikiLink: 'https://dnd5e.wikidot.com/spell:cone-of-cold'
  },
  'Greater Restoration': {
    level: 5,
    school: 'Abjuration',
    castingTime: '1 action',
    range: 'Touch',
    components: 'V, S, M (diamond dust worth at least 100 gp, which the spell consumes)',
    duration: 'Instantaneous',
    damage: '',
    save: '',
    attack: '',
    ritual: false,
    concentration: false,
    description: 'You imbue a creature you touch with positive energy to undo a debilitating effect. You can reduce the target\'s exhaustion level by one, or end one of the following effects on the target.',
    wikiLink: 'https://dnd5e.wikidot.com/spell:greater-restoration'
  },
  'Mass Cure Wounds': {
    level: 5,
    school: 'Evocation',
    castingTime: '1 action',
    range: '60 feet',
    components: 'V, S',
    duration: 'Instantaneous',
    damage: '3d8 + spellcasting ability modifier healing',
    save: '',
    attack: '',
    ritual: false,
    concentration: false,
    description: 'A wave of healing energy washes out from a point of your choice within range. Choose up to six creatures in a 30-foot-radius sphere centered on that point.',
    wikiLink: 'https://dnd5e.wikidot.com/spell:mass-cure-wounds'
  },
  'Raise Dead': {
    level: 5,
    school: 'Necromancy',
    castingTime: '1 hour',
    range: 'Touch',
    components: 'V, S, M (a diamond worth at least 500 gp, which the spell consumes)',
    duration: 'Instantaneous',
    damage: '',
    save: '',
    attack: '',
    ritual: false,
    concentration: false,
    description: 'You return a dead creature you touch to life, provided that it has been dead no longer than 10 days. If the creature\'s soul is both willing and at liberty to rejoin the body, the creature returns to life with 1 hit point.',
    wikiLink: 'https://dnd5e.wikidot.com/spell:raise-dead'
  },
  'Scrying': {
    level: 5,
    school: 'Divination',
    castingTime: '10 minutes',
    range: 'Self',
    components: 'V, S, M (a focus worth at least 1,000 gp, such as a crystal ball, a silver mirror, or a font filled with holy water)',
    duration: 'Concentration, up to 10 minutes',
    damage: '',
    save: 'Wisdom save',
    attack: '',
    ritual: false,
    concentration: true,
    description: 'You can see and hear a particular creature you choose that is on the same plane of existence as you. The target must make a Wisdom saving throw, which is modified by how well you know the target and the sort of physical connection you have to it.',
    wikiLink: 'https://dnd5e.wikidot.com/spell:scrying'
  }
};


// Show import popup
