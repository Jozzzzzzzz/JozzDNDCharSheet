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

// D&D Spell Database (sample spells)
const dndSpellsDatabase = {
  cantrips: [
    {
      name: "Fire Bolt",
      level: 0,
      school: "Evocation",
      castingTime: "1 action",
      range: "120 feet",
      components: "V, S",
      duration: "Instantaneous",
      damage: "1d10 fire damage",
      save: "",
      attack: "Ranged spell attack",
      ritual: false,
      concentration: false,
      description: "You hurl a mote of fire at a creature or object within range. Make a ranged spell attack against the target. On a hit, the target takes 1d10 fire damage. A flammable object hit by this spell ignites if it isn't being worn or carried. This spell's damage increases by 1d10 when you reach 5th level (2d10), 11th level (3d10), and 17th level (4d10).",
      wikiLink: "https://dnd5e.wikidot.com/spell:fire-bolt"
    },
    {
      name: "Mage Hand",
      level: 0,
      school: "Conjuration",
      castingTime: "1 action",
      range: "30 feet",
      components: "V, S",
      duration: "1 minute",
      damage: "",
      save: "",
      attack: "",
      ritual: false,
      concentration: false,
      description: "A spectral, floating hand appears at a point you choose within range. The hand lasts for the duration or until you dismiss it as an action. The hand vanishes if it is ever more than 30 feet away from you or if you cast this spell again. You can use your action to control the hand.",
      wikiLink: "https://dnd5e.wikidot.com/spell:mage-hand"
    },
    {
      name: "Prestidigitation",
      level: 0,
      school: "Transmutation",
      castingTime: "1 action",
      range: "10 feet",
      components: "V, S",
      duration: "Up to 1 hour",
      damage: "",
      save: "",
      attack: "",
      ritual: false,
      concentration: false,
      description: "This spell is a minor magical trick that novice spellcasters use for practice. You create one of several magical effects within range: sensory effects, light/snuff candles, clean/soil objects, chill/warm/flavor food, create small trinkets, or make colored marks.",
      wikiLink: "https://dnd5e.wikidot.com/spell:prestidigitation"
    },
    {
      name: "Acid Splash",
      level: 0,
      school: "Conjuration",
      castingTime: "1 action",
      range: "60 feet",
      components: "V, S",
      duration: "Instantaneous",
      damage: "1d6 acid damage",
      save: "Dexterity save",
      attack: "",
      ritual: false,
      concentration: false,
      description: "You hurl a bubble of acid. Choose one or two creatures within range. If you choose two, they must be within 5 feet of each other. A target must succeed on a Dexterity saving throw or take 1d6 acid damage. This spell's damage increases by 1d6 when you reach 5th, 11th, and 17th level.",
      wikiLink: "https://dnd5e.wikidot.com/spell:acid-splash"
    },
    {
      name: "Blade Ward",
      level: 0,
      school: "Abjuration",
      castingTime: "1 action",
      range: "Self",
      components: "V, S",
      duration: "1 round",
      damage: "",
      save: "",
      attack: "",
      ritual: false,
      concentration: false,
      description: "You extend your hand and trace a sigil of warding in the air. Until the end of your next turn, you have resistance against bludgeoning, piercing, and slashing damage dealt by weapon attacks.",
      wikiLink: "https://dnd5e.wikidot.com/spell:blade-ward"
    },
    {
      name: "Chill Touch",
      level: 0,
      school: "Necromancy",
      castingTime: "1 action",
      range: "120 feet",
      components: "V, S",
      duration: "1 round",
      damage: "1d8 necrotic damage",
      save: "",
      attack: "Ranged spell attack",
      ritual: false,
      concentration: false,
      description: "You create a ghostly, skeletal hand in the space of a creature within range. Make a ranged spell attack. On a hit, the target takes 1d8 necrotic damage, and it can't regain hit points until the start of your next turn. This spell's damage increases by 1d8 when you reach 5th, 11th, and 17th level.",
      wikiLink: "https://dnd5e.wikidot.com/spell:chill-touch"
    },
    {
      name: "Dancing Lights",
      level: 0,
      school: "Evocation",
      castingTime: "1 action",
      range: "120 feet",
      components: "V, S, M",
      duration: "Concentration, up to 1 minute",
      damage: "",
      save: "",
      attack: "",
      ritual: false,
      concentration: true,
      description: "You create up to four torch-sized lights within range, making them appear as torches, lanterns, or glowing orbs that hover in the air for the duration. You can also combine the four lights into one glowing vaguely humanoid form of Medium size.",
      wikiLink: "https://dnd5e.wikidot.com/spell:dancing-lights"
    },
    {
      name: "Druidcraft",
      level: 0,
      school: "Transmutation",
      castingTime: "1 action",
      range: "30 feet",
      components: "V, S",
      duration: "Instantaneous",
      damage: "",
      save: "",
      attack: "",
      ritual: false,
      concentration: false,
      description: "Whispering to the spirits of nature, you create one of the following effects within range: predict weather, make a flower bloom, create a sensory effect, or instantly light or snuff out a candle, torch, or small campfire.",
      wikiLink: "https://dnd5e.wikidot.com/spell:druidcraft"
    },
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
      description: "A beam of crackling energy streaks toward a creature within range. Make a ranged spell attack against the target. On a hit, the target takes 1d10 force damage. The spell creates more than one beam when you reach higher levels: two beams at 5th level, three beams at 11th level, and four beams at 17th level.",
      wikiLink: "https://dnd5e.wikidot.com/spell:eldritch-blast"
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
      description: "You touch one willing creature. Once before the spell ends, the target can roll a d4 and add the number rolled to one ability check of its choice. The creature can wait until after it rolls the d20 before deciding to use the die, but must decide before the DM says whether the roll succeeds or fails.",
      wikiLink: "https://dnd5e.wikidot.com/spell:guidance"
    },
    {
      name: "Light",
      level: 0,
      school: "Evocation",
      castingTime: "1 action",
      range: "Touch",
      components: "V, M",
      duration: "1 hour",
      damage: "",
      save: "",
      attack: "",
      ritual: false,
      concentration: false,
      description: "You touch one object that is no larger than 10 feet in any dimension. Until the spell ends, the object sheds bright light in a 20-foot radius and dim light for an additional 20 feet. The light can be colored as you like. Completely covering the object with something opaque blocks the light.",
      wikiLink: "https://dnd5e.wikidot.com/spell:light"
    },
    {
      name: "Mending",
      level: 0,
      school: "Transmutation",
      castingTime: "1 minute",
      range: "Touch",
      components: "V, S, M",
      duration: "Instantaneous",
      damage: "",
      save: "",
      attack: "",
      ritual: false,
      concentration: false,
      description: "This spell repairs a single break or tear in an object you touch, such as a broken chain link, two halves of a broken key, a torn cloak, or a leaking wineskin. As long as the break or tear is no larger than 1 foot in any dimension, you mend it, leaving no trace of the former damage.",
      wikiLink: "https://dnd5e.wikidot.com/spell:mending"
    },
    {
      name: "Message",
      level: 0,
      school: "Transmutation",
      castingTime: "1 action",
      range: "120 feet",
      components: "V, S, M",
      duration: "1 round",
      damage: "",
      save: "",
      attack: "",
      ritual: false,
      concentration: false,
      description: "You point your finger toward a creature within range and whisper a message. The target (and only the target) hears the message and can reply in a whisper that only you can hear. You can cast this spell through solid objects if you are familiar with the target and know it is beyond the barrier.",
      wikiLink: "https://dnd5e.wikidot.com/spell:message"
    },
    {
      name: "Minor Illusion",
      level: 0,
      school: "Illusion",
      castingTime: "1 action",
      range: "30 feet",
      components: "S, M",
      duration: "1 minute",
      damage: "",
      save: "",
      attack: "",
      ritual: false,
      concentration: false,
      description: "You create a sound or an image of an object within range that lasts for the duration. The illusion also ends if you dismiss it as an action or cast this spell again. If you create a sound, its volume can range from a whisper to a scream. If you create an image of an object, it must be no larger than a 5-foot cube.",
      wikiLink: "https://dnd5e.wikidot.com/spell:minor-illusion"
    },
    {
      name: "Poison Spray",
      level: 0,
      school: "Conjuration",
      castingTime: "1 action",
      range: "10 feet",
      components: "V, S",
      duration: "Instantaneous",
      damage: "1d12 poison damage",
      save: "Constitution save",
      attack: "",
      ritual: false,
      concentration: false,
      description: "You extend your hand toward a creature you can see within range and project a puff of noxious gas from your palm. The creature must succeed on a Constitution saving throw or take 1d12 poison damage. This spell's damage increases by 1d12 when you reach 5th, 11th, and 17th level.",
      wikiLink: "https://dnd5e.wikidot.com/spell:poison-spray"
    },
    {
      name: "Produce Flame",
      level: 0,
      school: "Conjuration",
      castingTime: "1 action",
      range: "Self",
      components: "V, S",
      duration: "10 minutes",
      damage: "1d8 fire damage",
      save: "",
      attack: "Ranged spell attack",
      ritual: false,
      concentration: false,
      description: "A flickering flame appears in your hand. The flame remains there for the duration and harms neither you nor your equipment. The flame sheds bright light in a 10-foot radius and dim light for an additional 10 feet. The spell ends if you dismiss it as an action or if you cast it again. You can also attack with the flame, although doing so ends the spell.",
      wikiLink: "https://dnd5e.wikidot.com/spell:produce-flame"
    },
    {
      name: "Ray of Frost",
      level: 0,
      school: "Evocation",
      castingTime: "1 action",
      range: "60 feet",
      components: "V, S",
      duration: "Instantaneous",
      damage: "1d8 cold damage",
      save: "",
      attack: "Ranged spell attack",
      ritual: false,
      concentration: false,
      description: "A frigid beam of blue-white light streaks toward a creature within range. Make a ranged spell attack against the target. On a hit, it takes 1d8 cold damage, and its speed is reduced by 10 feet until the start of your next turn. The spell's damage increases by 1d8 when you reach 5th, 11th, and 17th level.",
      wikiLink: "https://dnd5e.wikidot.com/spell:ray-of-frost"
    },
    {
      name: "Resistance",
      level: 0,
      school: "Abjuration",
      castingTime: "1 action",
      range: "Touch",
      components: "V, S, M",
      duration: "Concentration, up to 1 minute",
      damage: "",
      save: "",
      attack: "",
      ritual: false,
      concentration: true,
      description: "You touch one willing creature. Once before the spell ends, the target can roll a d4 and add the number rolled to one saving throw of its choice. The creature can wait until after it rolls the d20 before deciding to use the die, but must decide before the DM says whether the roll succeeds or fails.",
      wikiLink: "https://dnd5e.wikidot.com/spell:resistance"
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
      description: "Flame-like radiance descends on a creature that you can see within range. The target must succeed on a Dexterity saving throw or take 1d8 radiant damage. The target gains no benefit from cover for this saving throw. The spell's damage increases by 1d8 when you reach 5th, 11th, and 17th level.",
      wikiLink: "https://dnd5e.wikidot.com/spell:sacred-flame"
    },
    {
      name: "Shocking Grasp",
      level: 0,
      school: "Evocation",
      castingTime: "1 action",
      range: "Touch",
      components: "V, S",
      duration: "Instantaneous",
      damage: "1d8 lightning damage",
      save: "",
      attack: "Melee spell attack",
      ritual: false,
      concentration: false,
      description: "Lightning springs from your hand to deliver a shock to a creature you try to touch. Make a melee spell attack against the target. You have advantage on the attack roll if the target is wearing armor made of metal. On a hit, the target takes 1d8 lightning damage, and it can't take reactions until the start of its next turn. The spell's damage increases by 1d8 when you reach 5th, 11th, and 17th level.",
      wikiLink: "https://dnd5e.wikidot.com/spell:shocking-grasp"
    },
    {
      name: "Spare the Dying",
      level: 0,
      school: "Necromancy",
      castingTime: "1 action",
      range: "Touch",
      components: "V, S",
      duration: "Instantaneous",
      damage: "",
      save: "",
      attack: "",
      ritual: false,
      concentration: false,
      description: "You touch a living creature that has 0 hit points. The creature becomes stable. This spell has no effect on undead or constructs.",
      wikiLink: "https://dnd5e.wikidot.com/spell:spare-the-dying"
    },
    {
      name: "Thaumaturgy",
      level: 0,
      school: "Transmutation",
      castingTime: "1 action",
      range: "30 feet",
      components: "V",
      duration: "Up to 1 minute",
      damage: "",
      save: "",
      attack: "",
      ritual: false,
      concentration: false,
      description: "You manifest a minor wonder, a sign of supernatural power, within range. You create one of the following magical effects within range: your voice booms up to three times as loud, you cause flames to flicker, brighten, dim, or change color, you cause harmless tremors in the ground, you create an instantaneous sound, you cause an unlocked door or window to fly open or slam shut, or you alter the appearance of your eyes.",
      wikiLink: "https://dnd5e.wikidot.com/spell:thaumaturgy"
    },
    {
      name: "Thorn Whip",
      level: 0,
      school: "Transmutation",
      castingTime: "1 action",
      range: "30 feet",
      components: "V, S, M",
      duration: "Instantaneous",
      damage: "1d6 piercing damage",
      save: "",
      attack: "Melee spell attack",
      ritual: false,
      concentration: false,
      description: "You create a long, vine-like whip covered in thorns that lashes out at your command toward a creature in range. Make a melee spell attack against the target. If the attack hits, the creature takes 1d6 piercing damage, and if the creature is Large or smaller, you pull the creature up to 10 feet closer to you. This spell's damage increases by 1d6 when you reach 5th, 11th, and 17th level.",
      wikiLink: "https://dnd5e.wikidot.com/spell:thorn-whip"
    },
    {
      name: "True Strike",
      level: 0,
      school: "Divination",
      castingTime: "1 action",
      range: "30 feet",
      components: "S",
      duration: "Concentration, up to 1 round",
      damage: "",
      save: "",
      attack: "",
      ritual: false,
      concentration: true,
      description: "You point a finger at a target in range. Your magic grants you a brief insight into the target's defenses. On your next turn, you gain advantage on your first attack roll against the target, provided that this spell hasn't ended.",
      wikiLink: "https://dnd5e.wikidot.com/spell:true-strike"
    },
    {
      name: "Vicious Mockery",
      level: 0,
      school: "Enchantment",
      castingTime: "1 action",
      range: "60 feet",
      components: "V",
      duration: "Instantaneous",
      damage: "1d4 psychic damage",
      save: "Wisdom save",
      attack: "",
      ritual: false,
      concentration: false,
      description: "You unleash a string of insults laced with subtle enchantments at a creature you can see within range. If the target can hear you (though it need not understand you), it must succeed on a Wisdom saving throw or take 1d4 psychic damage and have disadvantage on its next attack roll before the end of its next turn. This spell's damage increases by 1d4 when you reach 5th, 11th, and 17th level.",
      wikiLink: "https://dnd5e.wikidot.com/spell:vicious-mockery"
    },
    {
      name: "Booming Blade",
      level: 0,
      school: "Evocation",
      castingTime: "1 action",
      range: "Self (5-foot radius)",
      components: "S, M",
      duration: "1 round",
      damage: "Weapon damage + thunder damage",
      save: "",
      attack: "Melee weapon attack",
      ritual: false,
      concentration: false,
      description: "As part of the action used to cast this spell, you must make a melee attack with a weapon against one creature within the spell's range. On a hit, the target suffers the attack's normal effects, and it becomes sheathed in booming energy until the start of your next turn. If the target willingly moves before then, it immediately takes 1d8 thunder damage, and the spell ends.",
      wikiLink: "https://dnd5e.wikidot.com/spell:booming-blade"
    },
    {
      name: "Green-Flame Blade",
      level: 0,
      school: "Evocation",
      castingTime: "1 action",
      range: "Self (5-foot radius)",
      components: "S, M",
      duration: "Instantaneous",
      damage: "Weapon damage + fire damage",
      save: "",
      attack: "Melee weapon attack",
      ritual: false,
      concentration: false,
      description: "As part of the action used to cast this spell, you must make a melee attack with a weapon against one creature within the spell's range. On a hit, the target suffers the attack's normal effects, and green fire leaps from the target to a different creature of your choice that you can see within 5 feet of it. The second creature takes fire damage equal to your spellcasting ability modifier.",
      wikiLink: "https://dnd5e.wikidot.com/spell:green-flame-blade"
    },
    {
      name: "Control Flames",
      level: 0,
      school: "Transmutation",
      castingTime: "1 action",
      range: "60 feet",
      components: "S",
      duration: "Instantaneous or 1 hour",
      damage: "",
      save: "",
      attack: "",
      ritual: false,
      concentration: false,
      description: "You choose nonmagical flame that you can see within range and that fits within a 5-foot cube. You affect it in one of the following ways: You instantaneously expand the flame 5 feet in one direction, You instantaneously extinguish the flames within the cube, You double or halve the area of bright light and dim light shed by the flame, or You cause simple shapes to appear within the flames and animate as you like.",
      wikiLink: "https://dnd5e.wikidot.com/spell:control-flames"
    },
    {
      name: "Create Bonfire",
      level: 0,
      school: "Conjuration",
      castingTime: "1 action",
      range: "60 feet",
      components: "V, S",
      duration: "Concentration, up to 1 minute",
      damage: "1d8 fire damage",
      save: "Dexterity save",
      attack: "",
      ritual: false,
      concentration: true,
      description: "You create a bonfire on ground that you can see within range. Until the spell ends, the magic bonfire fills a 5-foot cube. Any creature in the bonfire's space when you cast the spell must succeed on a Dexterity saving throw or take 1d8 fire damage. A creature must also make the saving throw when it moves into the bonfire's space for the first time on a turn or ends its turn there.",
      wikiLink: "https://dnd5e.wikidot.com/spell:create-bonfire"
    },
    {
      name: "Frostbite",
      level: 0,
      school: "Evocation",
      castingTime: "1 action",
      range: "60 feet",
      components: "V, S",
      duration: "Instantaneous",
      damage: "1d6 cold damage",
      save: "Constitution save",
      attack: "",
      ritual: false,
      concentration: false,
      description: "You cause numbing frost to form on one creature that you can see within range. The target must make a Constitution saving throw. On a failed save, the target takes 1d6 cold damage, and it has disadvantage on the next weapon attack roll it makes before the end of its next turn.",
      wikiLink: "https://dnd5e.wikidot.com/spell:frostbite"
    },
    {
      name: "Gust",
      level: 0,
      school: "Transmutation",
      castingTime: "1 action",
      range: "30 feet",
      components: "V, S",
      duration: "Instantaneous",
      damage: "",
      save: "Strength save",
      attack: "",
      ritual: false,
      concentration: false,
      description: "You seize the air and compel it to create one of the following effects at a point you can see within range: One Medium or smaller creature that you choose must succeed on a Strength saving throw or be pushed up to 5 feet away from you. You create a small blast of air capable of moving one object that is neither held nor carried and that weighs no more than 5 pounds. The object is pushed up to 10 feet away from you. You create a harmless sensory effect using air, such as causing leaves to rustle, wind to slam shutters, or your clothing to ripple in a breeze.",
      wikiLink: "https://dnd5e.wikidot.com/spell:gust"
    },
    {
      name: "Infestation",
      level: 0,
      school: "Conjuration",
      castingTime: "1 action",
      range: "30 feet",
      components: "V, S, M",
      duration: "Instantaneous",
      damage: "1d6 poison damage",
      save: "Constitution save",
      attack: "",
      ritual: false,
      concentration: false,
      description: "You cause a cloud of mites, fleas, and other parasites to appear momentarily on one creature you can see within range. The target must succeed on a Constitution saving throw, or it takes 1d6 poison damage and moves 5 feet in a random direction if it can move and its speed is at least 5 feet.",
      wikiLink: "https://dnd5e.wikidot.com/spell:infestation"
    },
    {
      name: "Lightning Lure",
      level: 0,
      school: "Evocation",
      castingTime: "1 action",
      range: "Self (15-foot radius)",
      components: "V",
      duration: "Instantaneous",
      damage: "1d8 lightning damage",
      save: "Strength save",
      attack: "",
      ritual: false,
      concentration: false,
      description: "You create a lash of lightning energy that strikes at one creature of your choice that you can see within 15 feet of you. The target must succeed on a Strength saving throw or be pulled up to 10 feet in a straight line toward you and then take 1d8 lightning damage if it is within 5 feet of you.",
      wikiLink: "https://dnd5e.wikidot.com/spell:lightning-lure"
    },
    {
      name: "Magic Stone",
      level: 0,
      school: "Transmutation",
      castingTime: "1 bonus action",
      range: "Touch",
      components: "V, S",
      duration: "1 minute",
      damage: "1d6 + spellcasting modifier bludgeoning damage",
      save: "",
      attack: "Ranged spell attack",
      ritual: false,
      concentration: false,
      description: "You touch one to three pebbles and imbue them with magic. You or someone else can make a ranged spell attack with one of the pebbles by throwing it or hurling it with a sling. If thrown, it has a range of 60 feet. If someone else attacks with the pebble, that attacker adds your spellcasting ability modifier, not the attacker's, to the attack roll. On a hit, the target takes bludgeoning damage equal to 1d6 + your spellcasting ability modifier.",
      wikiLink: "https://dnd5e.wikidot.com/spell:magic-stone"
    },
    {
      name: "Mold Earth",
      level: 0,
      school: "Transmutation",
      castingTime: "1 action",
      range: "30 feet",
      components: "S",
      duration: "Instantaneous or 1 hour",
      damage: "",
      save: "",
      attack: "",
      ritual: false,
      concentration: false,
      description: "You choose a portion of dirt or stone that you can see within range and that fits within a 5-foot cube. You manipulate it in one of the following ways: If you target an area of loose earth, you can instantaneously excavate it, move it along the ground, and deposit it up to 5 feet away. You cause shapes, colors, or both to appear on the dirt or stone, spelling out words, creating images, or shaping patterns. You cause the dirt or stone to become difficult terrain.",
      wikiLink: "https://dnd5e.wikidot.com/spell:mold-earth"
    },
    {
      name: "Primal Savagery",
      level: 0,
      school: "Transmutation",
      castingTime: "1 action",
      range: "Self",
      components: "S",
      duration: "Instantaneous",
      damage: "1d10 acid damage",
      save: "",
      attack: "Melee spell attack",
      ritual: false,
      concentration: false,
      description: "You channel primal magic to cause your teeth or fingernails to sharpen, ready to deliver a corrosive attack. Make a melee spell attack against one creature within 5 feet of you. On a hit, the target takes 1d10 acid damage. After you make the attack, your teeth or fingernails return to normal.",
      wikiLink: "https://dnd5e.wikidot.com/spell:primal-savagery"
    },
    {
      name: "Shape Water",
      level: 0,
      school: "Transmutation",
      castingTime: "1 action",
      range: "30 feet",
      components: "S",
      duration: "Instantaneous or 1 hour",
      damage: "",
      save: "",
      attack: "",
      ritual: false,
      concentration: false,
      description: "You choose an area of water that you can see within range and that fits within a 5-foot cube. You manipulate it in one of the following ways: You instantaneously move or otherwise change the flow of the water as you direct, up to 5 feet in any direction. You cause the water to form into simple shapes and animate at your direction. You change the water's color or opacity. You freeze the water, provided that there are no creatures in it.",
      wikiLink: "https://dnd5e.wikidot.com/spell:shape-water"
    },
    {
      name: "Shillelagh",
      level: 0,
      school: "Transmutation",
      castingTime: "1 bonus action",
      range: "Touch",
      components: "V, S, M",
      duration: "1 minute",
      damage: "1d8 + spellcasting modifier bludgeoning damage",
      save: "",
      attack: "Melee weapon attack",
      ritual: false,
      concentration: false,
      description: "The wood of a club or quarterstaff you are holding is imbued with nature's power. For the duration, you can use your spellcasting ability instead of Strength for the attack and damage rolls of melee attacks using that weapon, and the weapon's damage die becomes a d8. The weapon also becomes magical, if it isn't already.",
      wikiLink: "https://dnd5e.wikidot.com/spell:shillelagh"
    },
    {
      name: "Sword Burst",
      level: 0,
      school: "Conjuration",
      castingTime: "1 action",
      range: "Self (5-foot radius)",
      components: "V",
      duration: "Instantaneous",
      damage: "1d6 force damage",
      save: "Dexterity save",
      attack: "",
      ritual: false,
      concentration: false,
      description: "You create a momentary circle of spectral blades that sweep around you. All other creatures within 5 feet of you must succeed on a Dexterity saving throw or take 1d6 force damage.",
      wikiLink: "https://dnd5e.wikidot.com/spell:sword-burst"
    },
    {
      name: "Toll the Dead",
      level: 0,
      school: "Necromancy",
      castingTime: "1 action",
      range: "60 feet",
      components: "V, S",
      duration: "Instantaneous",
      damage: "1d8 or 1d12 necrotic damage",
      save: "Wisdom save",
      attack: "",
      ritual: false,
      concentration: false,
      description: "You point at one creature you can see within range, and the sound of a dolorous bell fills the air around it for a moment. The target must succeed on a Wisdom saving throw or take 1d8 necrotic damage. If the target is missing any of its hit points, it instead takes 1d12 necrotic damage.",
      wikiLink: "https://dnd5e.wikidot.com/spell:toll-the-dead"
    },
    {
      name: "Word of Radiance",
      level: 0,
      school: "Evocation",
      castingTime: "1 action",
      range: "Self (5-foot radius)",
      components: "V, M",
      duration: "Instantaneous",
      damage: "1d6 radiant damage",
      save: "Constitution save",
      attack: "",
      ritual: false,
      concentration: false,
      description: "You utter a divine word, and burning radiance erupts from you. Each creature of your choice that you can see within range must succeed on a Constitution saving throw or take 1d6 radiant damage.",
      wikiLink: "https://dnd5e.wikidot.com/spell:word-of-radiance"
    }
  ],
  spells: [
    {
      name: "Magic Missile",
      level: 1,
      school: "Evocation",
      castingTime: "1 action",
      range: "120 feet",
      components: "V, S",
      duration: "Instantaneous",
      damage: "1d4+1 force damage per missile",
      save: "",
      attack: "",
      ritual: false,
      concentration: false,
      description: "Creates 3 force darts that automatically hit targets within range. Each dart deals 1d4+1 force damage. Can target multiple creatures or focus on one. For full details, see the D&D 5e Wiki link.",
      wikiLink: "https://dnd5e.wikidot.com/spell:magic-missile"
    },
    {
      name: "Fireball",
      level: 3,
      school: "Evocation",
      castingTime: "1 action",
      range: "150 feet",
      components: "V, S, M (a tiny ball of bat guano and sulfur)",
      duration: "Instantaneous",
      damage: "8d6 fire damage",
      save: "Dexterity save",
      attack: "",
      ritual: false,
      concentration: false,
      description: "Explosive fire spell that deals 8d6 fire damage in a 20-foot radius. Targets make Dexterity saves for half damage. For full details, see the D&D 5e Wiki link.",
      wikiLink: "https://dnd5e.wikidot.com/spell:fireball"
    },
    {
      name: "Identify",
      level: 1,
      school: "Divination",
      castingTime: "1 minute",
      range: "Touch",
      components: "V, S, M (a pearl worth at least 100 gp and an owl feather)",
      duration: "Instantaneous",
      damage: "",
      save: "",
      attack: "",
      ritual: true,
      concentration: false,
      description: "Reveals the properties and usage of magic items. Shows attunement requirements and remaining charges. For full details, see the D&D 5e Wiki link.",
      wikiLink: "https://dnd5e.wikidot.com/spell:identify"
    },
    {
      name: "Absorb Elements",
      level: 1,
      school: "Abjuration",
      castingTime: "1 reaction",
      range: "Self",
      components: "S",
      duration: "1 round",
      damage: "",
      save: "",
      attack: "",
      ritual: false,
      concentration: false,
      description: "Grants resistance to elemental damage and stores energy for your next melee attack, dealing +1d6 damage of the absorbed type. For full details, see the D&D 5e Wiki link.",
      wikiLink: "https://dnd5e.wikidot.com/spell:absorb-elements"
    },
    {
      name: "Alarm",
      level: 1,
      school: "Abjuration",
      castingTime: "1 minute",
      range: "30 feet",
      components: "V, S, M",
      duration: "8 hours",
      damage: "",
      save: "",
      attack: "",
      ritual: true,
      concentration: false,
      description: "Sets a magical alarm on a door, window, or 20-foot cube area. Alerts you when creatures enter the warded area. For full details, see the D&D 5e Wiki link.",
      wikiLink: "https://dnd5e.wikidot.com/spell:alarm"
    },
    {
      name: "Animal Friendship",
      level: 1,
      school: "Enchantment",
      castingTime: "1 action",
      range: "30 feet",
      components: "V, S, M",
      duration: "24 hours",
      damage: "",
      save: "Wisdom save",
      attack: "",
      ritual: false,
      concentration: false,
      description: "Charms a beast with Intelligence 3 or lower. The beast must make a Wisdom save or be charmed and see you as friendly. For full details, see the D&D 5e Wiki link.",
      wikiLink: "https://dnd5e.wikidot.com/spell:animal-friendship"
    },
    {
      name: "Bane",
      level: 1,
      school: "Enchantment",
      castingTime: "1 action",
      range: "30 feet",
      components: "V, S, M",
      duration: "Concentration, up to 1 minute",
      damage: "",
      save: "Charisma save",
      attack: "",
      ritual: false,
      concentration: true,
      description: "Targets up to 3 creatures with Charisma saves. Failed saves cause -1d4 penalty to attack rolls and saving throws. For full details, see the D&D 5e Wiki link.",
      wikiLink: "https://dnd5e.wikidot.com/spell:bane"
    },
    {
      name: "Bless",
      level: 1,
      school: "Enchantment",
      castingTime: "1 action",
      range: "30 feet",
      components: "V, S, M",
      duration: "Concentration, up to 1 minute",
      damage: "",
      save: "",
      attack: "",
      ritual: false,
      concentration: true,
      description: "Blesses up to 3 creatures with +1d4 bonus to attack rolls and saving throws. For full details, see the D&D 5e Wiki link.",
      wikiLink: "https://dnd5e.wikidot.com/spell:bless"
    },
    {
      name: "Burning Hands",
      level: 1,
      school: "Evocation",
      castingTime: "1 action",
      range: "Self (15-foot cone)",
      components: "V, S",
      duration: "Instantaneous",
      damage: "3d6 fire damage",
      save: "Dexterity save",
      attack: "",
      ritual: false,
      concentration: false,
      description: "Creates a 15-foot cone of fire dealing 3d6 fire damage. Targets make Dexterity saves for half damage. For full details, see the D&D 5e Wiki link.",
      wikiLink: "https://dnd5e.wikidot.com/spell:burning-hands"
    },
    {
      name: "Charm Person",
      level: 1,
      school: "Enchantment",
      castingTime: "1 action",
      range: "30 feet",
      components: "V, S",
      duration: "1 hour",
      damage: "",
      save: "Wisdom save",
      attack: "",
      ritual: false,
      concentration: false,
      description: "Charms a humanoid with a Wisdom save. Charmed creature sees you as a friendly acquaintance. For full details, see the D&D 5e Wiki link.",
      wikiLink: "https://dnd5e.wikidot.com/spell:charm-person"
    },
    {
      name: "Command",
      level: 1,
      school: "Enchantment",
      castingTime: "1 action",
      range: "60 feet",
      components: "V",
      duration: "1 round",
      damage: "",
      save: "Wisdom save",
      attack: "",
      ritual: false,
      concentration: false,
      description: "Speaks a one-word command to a creature. Target makes Wisdom save or follows command on next turn. For full details, see the D&D 5e Wiki link.",
      wikiLink: "https://dnd5e.wikidot.com/spell:command"
    },
    {
      name: "Compelled Duel",
      level: 1,
      school: "Enchantment",
      castingTime: "1 bonus action",
      range: "30 feet",
      components: "V",
      duration: "Concentration, up to 1 minute",
      damage: "",
      save: "Wisdom save",
      attack: "",
      ritual: false,
      concentration: true,
      description: "Compels a creature to duel you. Target makes Wisdom save or has disadvantage attacking others. For full details, see the D&D 5e Wiki link.",
      wikiLink: "https://dnd5e.wikidot.com/spell:compelled-duel"
    },
    {
      name: "Comprehend Languages",
      level: 1,
      school: "Divination",
      castingTime: "1 action",
      range: "Self",
      components: "V, S, M",
      duration: "1 hour",
      damage: "",
      save: "",
      attack: "",
      ritual: true,
      concentration: false,
      description: "Understands any spoken or written language you hear or see. For full details, see the D&D 5e Wiki link.",
      wikiLink: "https://dnd5e.wikidot.com/spell:comprehend-languages"
    },
    {
      name: "Cure Wounds",
      level: 1,
      school: "Evocation",
      castingTime: "1 action",
      range: "Touch",
      components: "V, S",
      duration: "Instantaneous",
      damage: "",
      save: "",
      attack: "",
      ritual: false,
      concentration: false,
      description: "Heals a touched creature for 1d8 + spellcasting modifier hit points. For full details, see the D&D 5e Wiki link.",
      wikiLink: "https://dnd5e.wikidot.com/spell:cure-wounds"
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
      description: "Senses magic within 30 feet and reveals magical auras and their schools. For full details, see the D&D 5e Wiki link.",
      wikiLink: "https://dnd5e.wikidot.com/spell:detect-magic"
    },
    {
      name: "Disguise Self",
      level: 1,
      school: "Illusion",
      castingTime: "1 action",
      range: "Self",
      components: "V, S",
      duration: "1 hour",
      damage: "",
      save: "",
      attack: "",
      ritual: false,
      concentration: false,
      description: "Changes your appearance including clothing and equipment. Can alter height and build. For full details, see the D&D 5e Wiki link.",
      wikiLink: "https://dnd5e.wikidot.com/spell:disguise-self"
    },
    {
      name: "Faerie Fire",
      level: 1,
      school: "Evocation",
      castingTime: "1 action",
      range: "60 feet",
      components: "V",
      duration: "Concentration, up to 1 minute",
      damage: "",
      save: "Dexterity save",
      attack: "",
      ritual: false,
      concentration: true,
      description: "Outlines objects and creatures in a 20-foot cube with colored light. Failed Dexterity saves cause creatures to glow and shed light. For full details, see the D&D 5e Wiki link.",
      wikiLink: "https://dnd5e.wikidot.com/spell:faerie-fire"
    },
    {
      name: "Feather Fall",
      level: 1,
      school: "Transmutation",
      castingTime: "1 reaction",
      range: "60 feet",
      components: "V, M",
      duration: "1 minute",
      damage: "",
      save: "",
      attack: "",
      ritual: false,
      concentration: false,
      description: "Slows up to 5 falling creatures to 60 feet per round, preventing falling damage. For full details, see the D&D 5e Wiki link.",
      wikiLink: "https://dnd5e.wikidot.com/spell:feather-fall"
    },
    {
      name: "Find Familiar",
      level: 1,
      school: "Conjuration",
      castingTime: "1 hour",
      range: "10 feet",
      components: "V, S, M",
      duration: "Instantaneous",
      damage: "",
      save: "",
      attack: "",
      ritual: true,
      concentration: false,
      description: "Summons a familiar spirit in animal form. Can choose from various animals like cat, owl, raven, etc. For full details, see the D&D 5e Wiki link.",
      wikiLink: "https://dnd5e.wikidot.com/spell:find-familiar"
    },
    {
      name: "Fog Cloud",
      level: 1,
      school: "Conjuration",
      castingTime: "1 action",
      range: "120 feet",
      components: "V, S",
      duration: "Concentration, up to 1 hour",
      damage: "",
      save: "",
      attack: "",
      ritual: false,
      concentration: true,
      description: "Creates a 20-foot radius sphere of fog that heavily obscures the area. For full details, see the D&D 5e Wiki link.",
      wikiLink: "https://dnd5e.wikidot.com/spell:fog-cloud"
    },
    {
      name: "Goodberry",
      level: 1,
      school: "Transmutation",
      castingTime: "1 action",
      range: "Touch",
      components: "V, S, M",
      duration: "Instantaneous",
      damage: "",
      save: "",
      attack: "",
      ritual: false,
      concentration: false,
      description: "Creates 10 magical berries that restore 1 hit point each and provide a day's nourishment. For full details, see the D&D 5e Wiki link.",
      wikiLink: "https://dnd5e.wikidot.com/spell:goodberry"
    },
    {
      name: "Grease",
      level: 1,
      school: "Conjuration",
      castingTime: "1 action",
      range: "60 feet",
      components: "V, S, M",
      duration: "1 minute",
      damage: "",
      save: "Dexterity save",
      attack: "",
      ritual: false,
      concentration: false,
      description: "Creates a 10-foot square of slippery grease that becomes difficult terrain. Creatures in area make Dexterity saves or fall prone. For full details, see the D&D 5e Wiki link.",
      wikiLink: "https://dnd5e.wikidot.com/spell:grease"
    },
    {
      name: "Guiding Bolt",
      level: 1,
      school: "Evocation",
      castingTime: "1 action",
      range: "120 feet",
      components: "V, S",
      duration: "1 round",
      damage: "4d6 radiant damage",
      save: "",
      attack: "Ranged spell attack",
      ritual: false,
      concentration: false,
      description: "Ranged spell attack dealing 4d6 radiant damage. Next attack against target has advantage. For full details, see the D&D 5e Wiki link.",
      wikiLink: "https://dnd5e.wikidot.com/spell:guiding-bolt"
    },
    {
      name: "Healing Word",
      level: 1,
      school: "Evocation",
      castingTime: "1 bonus action",
      range: "60 feet",
      components: "V",
      duration: "Instantaneous",
      damage: "",
      save: "",
      attack: "",
      ritual: false,
      concentration: false,
      description: "Bonus action healing spell that restores 1d4 + spellcasting modifier hit points at range. For full details, see the D&D 5e Wiki link.",
      wikiLink: "https://dnd5e.wikidot.com/spell:healing-word"
    },
    {
      name: "Hellish Rebuke",
      level: 1,
      school: "Evocation",
      castingTime: "1 reaction",
      range: "60 feet",
      components: "V, S",
      duration: "Instantaneous",
      damage: "2d10 fire damage",
      save: "Dexterity save",
      attack: "",
      ritual: false,
      concentration: false,
      description: "Reaction spell dealing 2d10 fire damage to creature that damaged you. Target makes Dexterity save for half damage. For full details, see the D&D 5e Wiki link.",
      wikiLink: "https://dnd5e.wikidot.com/spell:hellish-rebuke"
    },
    {
      name: "Heroism",
      level: 1,
      school: "Enchantment",
      castingTime: "1 action",
      range: "Touch",
      components: "V, S",
      duration: "Concentration, up to 1 minute",
      damage: "",
      save: "",
      attack: "",
      ritual: false,
      concentration: true,
      description: "Grants immunity to fear and temporary hit points equal to spellcasting modifier each turn. For full details, see the D&D 5e Wiki link.",
      wikiLink: "https://dnd5e.wikidot.com/spell:heroism"
    },
    {
      name: "Hex",
      level: 1,
      school: "Enchantment",
      castingTime: "1 bonus action",
      range: "90 feet",
      components: "V, S, M",
      duration: "Concentration, up to 1 hour",
      damage: "",
      save: "",
      attack: "",
      ritual: false,
      concentration: true,
      description: "Curses a creature with +1d6 necrotic damage on attacks and disadvantage on one ability. For full details, see the D&D 5e Wiki link.",
      wikiLink: "https://dnd5e.wikidot.com/spell:hex"
    },
    {
      name: "Hunter's Mark",
      level: 1,
      school: "Divination",
      castingTime: "1 bonus action",
      range: "90 feet",
      components: "V",
      duration: "Concentration, up to 1 hour",
      damage: "",
      save: "",
      attack: "",
      ritual: false,
      concentration: true,
      description: "Marks a creature as quarry for +1d6 weapon damage and advantage on tracking checks. For full details, see the D&D 5e Wiki link.",
      wikiLink: "https://dnd5e.wikidot.com/spell:hunters-mark"
    },
    {
      name: "Ice Knife",
      level: 1,
      school: "Conjuration",
      castingTime: "1 action",
      range: "60 feet",
      components: "S, M",
      duration: "Instantaneous",
      damage: "1d10 piercing damage",
      save: "Dexterity save",
      attack: "Ranged spell attack",
      ritual: false,
      concentration: false,
      description: "Ranged spell attack dealing 1d10 piercing damage, then explodes for 2d6 cold damage in 5-foot radius. For full details, see the D&D 5e Wiki link.",
      wikiLink: "https://dnd5e.wikidot.com/spell:ice-knife"
    },
    {
      name: "Mage Armor",
      level: 1,
      school: "Abjuration",
      castingTime: "1 action",
      range: "Touch",
      components: "V, S, M",
      duration: "8 hours",
      damage: "",
      save: "",
      attack: "",
      ritual: false,
      concentration: false,
      description: "Grants AC 13 + Dexterity modifier to unarmored creature for 8 hours. For full details, see the D&D 5e Wiki link.",
      wikiLink: "https://dnd5e.wikidot.com/spell:mage-armor"
    },
    {
      name: "Protection from Evil and Good",
      level: 1,
      school: "Abjuration",
      castingTime: "1 action",
      range: "Touch",
      components: "V, S, M",
      duration: "Concentration, up to 10 minutes",
      damage: "",
      save: "",
      attack: "",
      ritual: false,
      concentration: true,
      description: "Protects against aberrations, celestials, elementals, fey, fiends, and undead. These creatures have disadvantage attacking the target. For full details, see the D&D 5e Wiki link.",
      wikiLink: "https://dnd5e.wikidot.com/spell:protection-from-evil-and-good"
    },
    {
      name: "Purify Food and Drink",
      level: 1,
      school: "Transmutation",
      castingTime: "1 action",
      range: "10 feet",
      components: "V, S",
      duration: "Instantaneous",
      damage: "",
      save: "",
      attack: "",
      ritual: true,
      concentration: false,
      description: "Purifies all food and drink in a 5-foot radius, removing poison and disease. For full details, see the D&D 5e Wiki link.",
      wikiLink: "https://dnd5e.wikidot.com/spell:purify-food-and-drink"
    },
    {
      name: "Sanctuary",
      level: 1,
      school: "Abjuration",
      castingTime: "1 bonus action",
      range: "30 feet",
      components: "V, S, M",
      duration: "1 minute",
      damage: "",
      save: "Wisdom save",
      attack: "",
      ritual: false,
      concentration: false,
      description: "Wards a creature from attacks. Attackers must make Wisdom saves or choose new targets. For full details, see the D&D 5e Wiki link.",
      wikiLink: "https://dnd5e.wikidot.com/spell:sanctuary"
    },
    {
      name: "Shield",
      level: 1,
      school: "Abjuration",
      castingTime: "1 reaction",
      range: "Self",
      components: "V, S",
      duration: "1 round",
      damage: "",
      save: "",
      attack: "",
      ritual: false,
      concentration: false,
      description: "Reaction spell granting +5 AC until next turn and immunity to magic missile. For full details, see the D&D 5e Wiki link.",
      wikiLink: "https://dnd5e.wikidot.com/spell:shield"
    },
    {
      name: "Shield of Faith",
      level: 1,
      school: "Abjuration",
      castingTime: "1 bonus action",
      range: "60 feet",
      components: "V, S, M",
      duration: "Concentration, up to 10 minutes",
      damage: "",
      save: "",
      attack: "",
      ritual: false,
      concentration: true,
      description: "Grants +2 AC to a creature for the duration. For full details, see the D&D 5e Wiki link.",
      wikiLink: "https://dnd5e.wikidot.com/spell:shield-of-faith"
    },
    {
      name: "Silent Image",
      level: 1,
      school: "Illusion",
      castingTime: "1 action",
      range: "60 feet",
      components: "V, S, M",
      duration: "Concentration, up to 10 minutes",
      damage: "",
      save: "",
      attack: "",
      ritual: false,
      concentration: true,
      description: "Creates a visual illusion of an object or creature in a 15-foot cube. For full details, see the D&D 5e Wiki link.",
      wikiLink: "https://dnd5e.wikidot.com/spell:silent-image"
    },
    {
      name: "Sleep",
      level: 1,
      school: "Enchantment",
      castingTime: "1 action",
      range: "90 feet",
      components: "V, S, M",
      duration: "1 minute",
      damage: "",
      save: "",
      attack: "",
      ritual: false,
      concentration: false,
      description: "Puts creatures to sleep based on 5d8 hit points total. Affects creatures in 20-foot radius by current hit points. For full details, see the D&D 5e Wiki link.",
      wikiLink: "https://dnd5e.wikidot.com/spell:sleep"
    },
    {
      name: "Speak with Animals",
      level: 1,
      school: "Divination",
      castingTime: "1 action",
      range: "Self",
      components: "V, S",
      duration: "10 minutes",
      damage: "",
      save: "",
      attack: "",
      ritual: true,
      concentration: false,
      description: "Allows communication with beasts for 10 minutes. Beasts can share information about nearby locations and monsters. For full details, see the D&D 5e Wiki link.",
      wikiLink: "https://dnd5e.wikidot.com/spell:speak-with-animals"
    },
    {
      name: "Tasha's Hideous Laughter",
      level: 1,
      school: "Enchantment",
      castingTime: "1 action",
      range: "30 feet",
      components: "V, S, M",
      duration: "Concentration, up to 1 minute",
      damage: "",
      save: "Wisdom save",
      attack: "",
      ritual: false,
      concentration: true,
      description: "Target makes Wisdom save or falls prone and becomes incapacitated with laughter. For full details, see the D&D 5e Wiki link.",
      wikiLink: "https://dnd5e.wikidot.com/spell:tashas-hideous-laughter"
    },
    {
      name: "Tenser's Floating Disk",
      level: 1,
      school: "Conjuration",
      castingTime: "1 action",
      range: "30 feet",
      components: "V, S, M",
      duration: "1 hour",
      damage: "",
      save: "",
      attack: "",
      ritual: true,
      concentration: false,
      description: "Creates a 3-foot diameter floating disk that can hold up to 500 pounds. For full details, see the D&D 5e Wiki link.",
      wikiLink: "https://dnd5e.wikidot.com/spell:tensers-floating-disk"
    },
    {
      name: "Thunderous Smite",
      level: 1,
      school: "Evocation",
      castingTime: "1 bonus action",
      range: "Self",
      components: "V",
      duration: "Concentration, up to 1 minute",
      damage: "2d6 thunder damage",
      save: "Strength save",
      attack: "",
      ritual: false,
      concentration: true,
      description: "Next melee attack deals +2d6 thunder damage and pushes target 10 feet away if they fail Strength save. For full details, see the D&D 5e Wiki link.",
      wikiLink: "https://dnd5e.wikidot.com/spell:thunderous-smite"
    },
    {
      name: "Unseen Servant",
      level: 1,
      school: "Conjuration",
      castingTime: "1 action",
      range: "60 feet",
      components: "V, S, M",
      duration: "1 hour",
      damage: "",
      save: "",
      attack: "",
      ritual: true,
      concentration: false,
      description: "Creates an invisible servant that performs simple tasks for 1 hour. For full details, see the D&D 5e Wiki link.",
      wikiLink: "https://dnd5e.wikidot.com/spell:unseen-servant"
    },
    {
      name: "Witch Bolt",
      level: 1,
      school: "Evocation",
      castingTime: "1 action",
      range: "30 feet",
      components: "V, S, M",
      duration: "Concentration, up to 1 minute",
      damage: "1d12 lightning damage",
      save: "",
      attack: "Ranged spell attack",
      ritual: false,
      concentration: true,
      description: "Ranged spell attack dealing 1d12 lightning damage. Can deal 1d12 damage each turn as action. For full details, see the D&D 5e Wiki link.",
      wikiLink: "https://dnd5e.wikidot.com/spell:witch-bolt"
    },
    {
      name: "Wrathful Smite",
      level: 1,
      school: "Evocation",
      castingTime: "1 bonus action",
      range: "Self",
      components: "V",
      duration: "Concentration, up to 1 minute",
      damage: "1d6 psychic damage",
      save: "Wisdom save",
      attack: "",
      ritual: false,
      concentration: true,
      description: "Next melee attack deals +1d6 psychic damage and frightens target if they fail Wisdom save. For full details, see the D&D 5e Wiki link.",
      wikiLink: "https://dnd5e.wikidot.com/spell:wrathful-smite"
    },
    {
      name: "Aid",
      level: 2,
      school: "Abjuration",
      castingTime: "1 action",
      range: "30 feet",
      components: "V, S, M",
      duration: "8 hours",
      damage: "",
      save: "",
      attack: "",
      ritual: false,
      concentration: false,
      description: "Increases hit point maximum and current hit points by 5 for up to 3 creatures. For full details, see the D&D 5e Wiki link.",
      wikiLink: "https://dnd5e.wikidot.com/spell:aid"
    },
    {
      name: "Alter Self",
      level: 2,
      school: "Transmutation",
      castingTime: "1 action",
      range: "Self",
      components: "V, S",
      duration: "Concentration, up to 1 hour",
      damage: "",
      save: "",
      attack: "",
      ritual: false,
      concentration: true,
      description: "Allows you to change your form with various options like aquatic adaptation, natural weapons, or change appearance. For full details, see the D&D 5e Wiki link.",
      wikiLink: "https://dnd5e.wikidot.com/spell:alter-self"
    },
    {
      name: "Arcane Lock",
      level: 2,
      school: "Abjuration",
      castingTime: "1 action",
      range: "Touch",
      components: "V, S, M",
      duration: "Until dispelled",
      damage: "",
      save: "",
      attack: "",
      ritual: false,
      concentration: false,
      description: "Magically locks a door, window, or container. You and designated creatures can open it normally. For full details, see the D&D 5e Wiki link.",
      wikiLink: "https://dnd5e.wikidot.com/spell:arcane-lock"
    },
    {
      name: "Blur",
      level: 2,
      school: "Illusion",
      castingTime: "1 action",
      range: "Self",
      components: "V",
      duration: "Concentration, up to 1 minute",
      damage: "",
      save: "",
      attack: "",
      ritual: false,
      concentration: true,
      description: "Makes you blurred and hard to see, giving attackers disadvantage on attack rolls. For full details, see the D&D 5e Wiki link.",
      wikiLink: "https://dnd5e.wikidot.com/spell:blur"
    },
    {
      name: "Branding Smite",
      level: 2,
      school: "Evocation",
      castingTime: "1 bonus action",
      range: "Self",
      components: "V",
      duration: "Concentration, up to 1 minute",
      damage: "2d6 radiant damage",
      save: "",
      attack: "",
      ritual: false,
      concentration: true,
      description: "Next weapon attack deals +2d6 radiant damage and makes invisible targets visible. For full details, see the D&D 5e Wiki link.",
      wikiLink: "https://dnd5e.wikidot.com/spell:branding-smite"
    },
    {
      name: "Calm Emotions",
      level: 2,
      school: "Enchantment",
      castingTime: "1 action",
      range: "Self (60-foot radius)",
      components: "V, S",
      duration: "Concentration, up to 1 minute",
      damage: "",
      save: "Charisma save",
      attack: "",
      ritual: false,
      concentration: true,
      description: "Suppresses strong emotions in humanoids within 20-foot radius. Targets make Charisma saves. For full details, see the D&D 5e Wiki link.",
      wikiLink: "https://dnd5e.wikidot.com/spell:calm-emotions"
    },
    {
      name: "Continual Flame",
      level: 2,
      school: "Evocation",
      castingTime: "1 action",
      range: "Touch",
      components: "V, S, M",
      duration: "Until dispelled",
      damage: "",
      save: "",
      attack: "",
      ritual: false,
      concentration: false,
      description: "Creates a permanent flame on an object that provides light but no heat. For full details, see the D&D 5e Wiki link.",
      wikiLink: "https://dnd5e.wikidot.com/spell:continual-flame"
    },
    {
      name: "Cordon of Arrows",
      level: 2,
      school: "Transmutation",
      castingTime: "1 action",
      range: "5 feet",
      components: "V, S, M",
      duration: "8 hours",
      damage: "1d6 piercing damage",
      save: "Dexterity save",
      attack: "",
      ritual: false,
      concentration: false,
      description: "Plants 4 arrows that automatically attack creatures within 30 feet for 1d6 piercing damage. For full details, see the D&D 5e Wiki link.",
      wikiLink: "https://dnd5e.wikidot.com/spell:cordon-of-arrows"
    },
    {
      name: "Darkvision",
      level: 2,
      school: "Transmutation",
      castingTime: "1 action",
      range: "Touch",
      components: "V, S, M",
      duration: "8 hours",
      damage: "",
      save: "",
      attack: "",
      ritual: false,
      concentration: false,
      description: "Grants darkvision out to 60 feet for 8 hours. For full details, see the D&D 5e Wiki link.",
      wikiLink: "https://dnd5e.wikidot.com/spell:darkvision"
    },
    {
      name: "Enhance Ability",
      level: 2,
      school: "Transmutation",
      castingTime: "1 action",
      range: "Touch",
      components: "V, S, M",
      duration: "Concentration, up to 1 hour",
      damage: "",
      save: "",
      attack: "",
      ritual: false,
      concentration: true,
      description: "Enhances one ability score with various benefits like advantage on checks or increased carrying capacity. For full details, see the D&D 5e Wiki link.",
      wikiLink: "https://dnd5e.wikidot.com/spell:enhance-ability"
    },
    {
      name: "Enlarge/Reduce",
      level: 2,
      school: "Transmutation",
      castingTime: "1 action",
      range: "30 feet",
      components: "V, S, M",
      duration: "Concentration, up to 1 minute",
      damage: "",
      save: "Constitution save",
      attack: "",
      ritual: false,
      concentration: true,
      description: "Makes a creature or object larger or smaller. Unwilling targets make Constitution saves. For full details, see the D&D 5e Wiki link.",
      wikiLink: "https://dnd5e.wikidot.com/spell:enlarge-reduce"
    },
    {
      name: "Find Steed",
      level: 2,
      school: "Conjuration",
      castingTime: "10 minutes",
      range: "30 feet",
      components: "V, S",
      duration: "Instantaneous",
      damage: "",
      save: "",
      attack: "",
      ritual: false,
      concentration: false,
      description: "Summons a loyal steed spirit in the form of a warhorse, pony, camel, elk, or mastiff. For full details, see the D&D 5e Wiki link.",
      wikiLink: "https://dnd5e.wikidot.com/spell:find-steed"
    },
    {
      name: "Flame Blade",
      level: 2,
      school: "Evocation",
      castingTime: "1 bonus action",
      range: "Self",
      components: "V, S, M",
      duration: "Concentration, up to 10 minutes",
      damage: "3d6 fire damage",
      save: "",
      attack: "Melee spell attack",
      ritual: false,
      concentration: true,
      description: "Creates a fiery scimitar that deals 3d6 fire damage on melee spell attacks. For full details, see the D&D 5e Wiki link.",
      wikiLink: "https://dnd5e.wikidot.com/spell:flame-blade"
    },
    {
      name: "Flaming Sphere",
      level: 2,
      school: "Conjuration",
      castingTime: "1 action",
      range: "60 feet",
      components: "V, S, M",
      duration: "Concentration, up to 1 minute",
      damage: "2d6 fire damage",
      save: "Dexterity save",
      attack: "",
      ritual: false,
      concentration: true,
      description: "Creates a 5-foot diameter fire sphere that deals 2d6 fire damage to creatures ending their turn nearby. For full details, see the D&D 5e Wiki link.",
      wikiLink: "https://dnd5e.wikidot.com/spell:flaming-sphere"
    },
    {
      name: "Heat Metal",
      level: 2,
      school: "Transmutation",
      castingTime: "1 action",
      range: "60 feet",
      components: "V, S, M",
      duration: "Concentration, up to 1 minute",
      damage: "2d8 fire damage",
      save: "Constitution save",
      attack: "",
      ritual: false,
      concentration: true,
      description: "Makes a metal object red-hot, dealing 2d8 fire damage to creatures touching it. For full details, see the D&D 5e Wiki link.",
      wikiLink: "https://dnd5e.wikidot.com/spell:heat-metal"
    },
    {
      name: "Hold Person",
      level: 2,
      school: "Enchantment",
      castingTime: "1 action",
      range: "60 feet",
      components: "V, S, M",
      duration: "Concentration, up to 1 minute",
      damage: "",
      save: "Wisdom save",
      attack: "",
      ritual: false,
      concentration: true,
      description: "Paralyzes a humanoid with Wisdom saves. Target can repeat save each turn. For full details, see the D&D 5e Wiki link.",
      wikiLink: "https://dnd5e.wikidot.com/spell:hold-person"
    },
    {
      name: "Invisibility",
      level: 2,
      school: "Illusion",
      castingTime: "1 action",
      range: "Touch",
      components: "V, S, M",
      duration: "Concentration, up to 1 hour",
      damage: "",
      save: "",
      attack: "",
      ritual: false,
      concentration: true,
      description: "Makes a creature invisible until they attack or cast a spell. For full details, see the D&D 5e Wiki link.",
      wikiLink: "https://dnd5e.wikidot.com/spell:invisibility"
    },
    {
      name: "Lesser Restoration",
      level: 2,
      school: "Abjuration",
      castingTime: "1 action",
      range: "Touch",
      components: "V, S",
      duration: "Instantaneous",
      damage: "",
      save: "",
      attack: "",
      ritual: false,
      concentration: false,
      description: "Ends one disease or condition (blinded, deafened, paralyzed, or poisoned). For full details, see the D&D 5e Wiki link.",
      wikiLink: "https://dnd5e.wikidot.com/spell:lesser-restoration"
    },
    {
      name: "Levitate",
      level: 2,
      school: "Transmutation",
      castingTime: "1 action",
      range: "60 feet",
      components: "V, S, M",
      duration: "Concentration, up to 10 minutes",
      damage: "",
      save: "Constitution save",
      attack: "",
      ritual: false,
      concentration: true,
      description: "Levitates a creature or object up to 500 pounds up to 20 feet high. Unwilling targets make Constitution saves. For full details, see the D&D 5e Wiki link.",
      wikiLink: "https://dnd5e.wikidot.com/spell:levitate"
    },
    {
      name: "Locate Object",
      level: 2,
      school: "Divination",
      castingTime: "1 action",
      range: "Self",
      components: "V, S, M",
      duration: "Concentration, up to 10 minutes",
      damage: "",
      save: "",
      attack: "",
      ritual: false,
      concentration: true,
      description: "Senses the direction to a familiar object within 1,000 feet. For full details, see the D&D 5e Wiki link.",
      wikiLink: "https://dnd5e.wikidot.com/spell:locate-object"
    },
    {
      name: "Magic Weapon",
      level: 2,
      school: "Transmutation",
      castingTime: "1 bonus action",
      range: "Touch",
      components: "V, S",
      duration: "Concentration, up to 1 hour",
      damage: "",
      save: "",
      attack: "",
      ritual: false,
      concentration: true,
      description: "Makes a nonmagical weapon magical with +1 bonus to attack and damage rolls. For full details, see the D&D 5e Wiki link.",
      wikiLink: "https://dnd5e.wikidot.com/spell:magic-weapon"
    },
    {
      name: "Misty Step",
      level: 2,
      school: "Conjuration",
      castingTime: "1 bonus action",
      range: "Self",
      components: "V",
      duration: "Instantaneous",
      damage: "",
      save: "",
      attack: "",
      ritual: false,
      concentration: false,
      description: "Teleports you up to 30 feet to an unoccupied space you can see. For full details, see the D&D 5e Wiki link.",
      wikiLink: "https://dnd5e.wikidot.com/spell:misty-step"
    },
    {
      name: "Moonbeam",
      level: 2,
      school: "Evocation",
      castingTime: "1 action",
      range: "120 feet",
      components: "V, S, M",
      duration: "Concentration, up to 1 minute",
      damage: "2d10 radiant damage",
      save: "Constitution save",
      attack: "",
      ritual: false,
      concentration: true,
      description: "Creates a 5-foot radius cylinder of moonlight that deals 2d10 radiant damage to creatures entering or starting their turn there. For full details, see the D&D 5e Wiki link.",
      wikiLink: "https://dnd5e.wikidot.com/spell:moonbeam"
    },
    {
      name: "Pass without Trace",
      level: 2,
      school: "Abjuration",
      castingTime: "1 action",
      range: "Self",
      components: "V, S, M",
      duration: "Concentration, up to 1 hour",
      damage: "",
      save: "",
      attack: "",
      ritual: false,
      concentration: true,
      description: "Grants +10 bonus to Stealth checks and prevents tracking for creatures within 30 feet. For full details, see the D&D 5e Wiki link.",
      wikiLink: "https://dnd5e.wikidot.com/spell:pass-without-trace"
    },
    {
      name: "Protection from Poison",
      level: 2,
      school: "Abjuration",
      castingTime: "1 action",
      range: "Touch",
      components: "V, S",
      duration: "1 hour",
      damage: "",
      save: "",
      attack: "",
      ritual: false,
      concentration: false,
      description: "Neutralizes one poison affecting a touched creature. For full details, see the D&D 5e Wiki link.",
      wikiLink: "https://dnd5e.wikidot.com/spell:protection-from-poison"
    },
    {
      name: "Pyrotechnics",
      level: 2,
      school: "Transmutation",
      castingTime: "1 action",
      range: "60 feet",
      components: "V, S",
      duration: "Instantaneous",
      damage: "",
      save: "Constitution save",
      attack: "",
      ritual: false,
      concentration: false,
      description: "Extinguishes fire in a 5-foot cube and creates fireworks or smoke. For full details, see the D&D 5e Wiki link.",
      wikiLink: "https://dnd5e.wikidot.com/spell:pyrotechnics"
    },
    {
      name: "Rope Trick",
      level: 2,
      school: "Transmutation",
      castingTime: "1 action",
      range: "Touch",
      components: "V, S, M",
      duration: "1 hour",
      damage: "",
      save: "",
      attack: "",
      ritual: false,
      concentration: false,
      description: "Creates an extradimensional space at the top of a rope for 1 hour. For full details, see the D&D 5e Wiki link.",
      wikiLink: "https://dnd5e.wikidot.com/spell:rope-trick"
    },
    {
      name: "Scorching Ray",
      level: 2,
      school: "Evocation",
      castingTime: "1 action",
      range: "120 feet",
      components: "V, S",
      duration: "Instantaneous",
      damage: "2d6 fire damage",
      save: "",
      attack: "Ranged spell attack",
      ritual: false,
      concentration: false,
      description: "Creates 3 rays of fire that each deal 2d6 fire damage on ranged spell attacks. For full details, see the D&D 5e Wiki link.",
      wikiLink: "https://dnd5e.wikidot.com/spell:scorching-ray"
    },
    {
      name: "See Invisibility",
      level: 2,
      school: "Divination",
      castingTime: "1 action",
      range: "Self",
      components: "V, S, M",
      duration: "1 hour",
      damage: "",
      save: "",
      attack: "",
      ritual: false,
      concentration: false,
      description: "Allows you to see invisible creatures and objects, and see into the Ethereal Plane. For full details, see the D&D 5e Wiki link.",
      wikiLink: "https://dnd5e.wikidot.com/spell:see-invisibility"
    },
    {
      name: "Shatter",
      level: 2,
      school: "Evocation",
      castingTime: "1 action",
      range: "60 feet",
      components: "V, S, M",
      duration: "Instantaneous",
      damage: "3d8 thunder damage",
      save: "Constitution save",
      attack: "",
      ritual: false,
      concentration: false,
      description: "Creates a loud ringing noise dealing 3d8 thunder damage in a 10-foot radius. Targets make Constitution saves for half damage. For full details, see the D&D 5e Wiki link.",
      wikiLink: "https://dnd5e.wikidot.com/spell:shatter"
    },
    {
      name: "Spider Climb",
      level: 2,
      school: "Transmutation",
      castingTime: "1 action",
      range: "Touch",
      components: "V, S, M",
      duration: "Concentration, up to 1 hour",
      damage: "",
      save: "",
      attack: "",
      ritual: false,
      concentration: true,
      description: "Grants ability to climb on walls and ceilings with hands free, and climbing speed equal to walking speed. For full details, see the D&D 5e Wiki link.",
      wikiLink: "https://dnd5e.wikidot.com/spell:spider-climb"
    },
    {
      name: "Spike Growth",
      level: 2,
      school: "Transmutation",
      castingTime: "1 action",
      range: "150 feet",
      components: "V, S, M",
      duration: "Concentration, up to 10 minutes",
      damage: "2d4 piercing damage",
      save: "",
      attack: "",
      ritual: false,
      concentration: true,
      description: "Creates difficult terrain with spikes that deal 2d4 piercing damage per 5 feet moved. For full details, see the D&D 5e Wiki link.",
      wikiLink: "https://dnd5e.wikidot.com/spell:spike-growth"
    },
    {
      name: "Suggestion",
      level: 2,
      school: "Enchantment",
      castingTime: "1 action",
      range: "30 feet",
      components: "V, M",
      duration: "Concentration, up to 8 hours",
      damage: "",
      save: "Wisdom save",
      attack: "",
      ritual: false,
      concentration: true,
      description: "Magically influences a creature to follow a reasonable suggestion. Target makes Wisdom save. For full details, see the D&D 5e Wiki link.",
      wikiLink: "https://dnd5e.wikidot.com/spell:suggestion"
    },
    {
      name: "Web",
      level: 2,
      school: "Conjuration",
      castingTime: "1 action",
      range: "60 feet",
      components: "V, S, M",
      duration: "Concentration, up to 1 hour",
      damage: "",
      save: "Dexterity save",
      attack: "",
      ritual: false,
      concentration: true,
      description: "Creates a 20-foot cube of sticky webs that are difficult terrain and lightly obscure the area. For full details, see the D&D 5e Wiki link.",
      wikiLink: "https://dnd5e.wikidot.com/spell:web"
    },
    {
      name: "Zone of Truth",
      level: 2,
      school: "Enchantment",
      castingTime: "1 action",
      range: "60 feet",
      components: "V, S",
      duration: "10 minutes",
      damage: "",
      save: "Charisma save",
      attack: "",
      ritual: false,
      concentration: false,
      description: "Creates a 15-foot radius zone that prevents lying. Creatures entering or starting their turn there make Charisma saves. For full details, see the D&D 5e Wiki link.",
      wikiLink: "https://dnd5e.wikidot.com/spell:zone-of-truth"
    },
    {
      name: "Animate Dead",
      level: 3,
      school: "Necromancy",
      castingTime: "1 minute",
      range: "10 feet",
      components: "V, S, M",
      duration: "Instantaneous",
      damage: "",
      save: "",
      attack: "",
      ritual: false,
      concentration: false,
      description: "Raises a Medium or Small humanoid corpse or bones as an undead servant. For full details, see the D&D 5e Wiki link.",
      wikiLink: "https://dnd5e.wikidot.com/spell:animate-dead"
    },
    {
      name: "Aura of Vitality",
      level: 3,
      school: "Evocation",
      castingTime: "1 action",
      range: "Self (30-foot radius)",
      components: "V",
      duration: "Concentration, up to 1 minute",
      damage: "",
      save: "",
      attack: "",
      ritual: false,
      concentration: true,
      description: "Creates a 30-foot radius healing aura. Bonus action to heal 2d6 hit points to one creature in the aura. For full details, see the D&D 5e Wiki link.",
      wikiLink: "https://dnd5e.wikidot.com/spell:aura-of-vitality"
    },
    {
      name: "Beacon of Hope",
      level: 3,
      school: "Abjuration",
      castingTime: "1 action",
      range: "30 feet",
      components: "V, S",
      duration: "Concentration, up to 1 minute",
      damage: "",
      save: "",
      attack: "",
      ritual: false,
      concentration: true,
      description: "Grants advantage on Wisdom saves and death saves, and maximum healing to chosen creatures. For full details, see the D&D 5e Wiki link.",
      wikiLink: "https://dnd5e.wikidot.com/spell:beacon-of-hope"
    },
    {
      name: "Bestow Curse",
      level: 3,
      school: "Necromancy",
      castingTime: "1 action",
      range: "Touch",
      components: "V, S",
      duration: "Concentration, up to 1 minute",
      damage: "",
      save: "Wisdom save",
      attack: "",
      ritual: false,
      concentration: true,
      description: "Curses a touched creature with various effects. Target makes Wisdom save. For full details, see the D&D 5e Wiki link.",
      wikiLink: "https://dnd5e.wikidot.com/spell:bestow-curse"
    },
    {
      name: "Blink",
      level: 3,
      school: "Transmutation",
      castingTime: "1 action",
      range: "Self",
      components: "V, S",
      duration: "1 minute",
      damage: "",
      save: "",
      attack: "",
      ritual: false,
      concentration: false,
      description: "Each turn, roll d20. On 11+, you vanish to the Ethereal Plane until next turn. For full details, see the D&D 5e Wiki link.",
      wikiLink: "https://dnd5e.wikidot.com/spell:blink"
    },
    {
      name: "Call Lightning",
      level: 3,
      school: "Conjuration",
      castingTime: "1 action",
      range: "120 feet",
      components: "V, S",
      duration: "Concentration, up to 10 minutes",
      damage: "3d10 lightning damage",
      save: "Dexterity save",
      attack: "",
      ritual: false,
      concentration: true,
      description: "Creates a storm cloud that can strike lightning for 3d10 lightning damage. For full details, see the D&D 5e Wiki link.",
      wikiLink: "https://dnd5e.wikidot.com/spell:call-lightning"
    },
    {
      name: "Catnap",
      level: 3,
      school: "Enchantment",
      castingTime: "1 action",
      range: "30 feet",
      components: "S, M",
      duration: "10 minutes",
      damage: "",
      save: "",
      attack: "",
      ritual: false,
      concentration: false,
      description: "Puts up to 3 willing creatures to sleep for 10 minutes. For full details, see the D&D 5e Wiki link.",
      wikiLink: "https://dnd5e.wikidot.com/spell:catnap"
    },
    {
      name: "Clairvoyance",
      level: 3,
      school: "Divination",
      castingTime: "10 minutes",
      range: "1 mile",
      components: "V, S, M",
      duration: "Concentration, up to 10 minutes",
      damage: "",
      save: "",
      attack: "",
      ritual: false,
      concentration: true,
      description: "Creates an invisible sensor to see and hear at a location within 1 mile. For full details, see the D&D 5e Wiki link.",
      wikiLink: "https://dnd5e.wikidot.com/spell:clairvoyance"
    },
    {
      name: "Conjure Animals",
      level: 3,
      school: "Conjuration",
      castingTime: "1 action",
      range: "60 feet",
      components: "V, S",
      duration: "Concentration, up to 1 hour",
      damage: "",
      save: "",
      attack: "",
      ritual: false,
      concentration: true,
      description: "Summons fey spirits in the form of beasts. Choose from various options based on challenge rating. For full details, see the D&D 5e Wiki link.",
      wikiLink: "https://dnd5e.wikidot.com/spell:conjure-animals"
    },
    {
      name: "Counterspell",
      level: 3,
      school: "Abjuration",
      castingTime: "1 reaction",
      range: "60 feet",
      components: "S",
      duration: "Instantaneous",
      damage: "",
      save: "",
      attack: "",
      ritual: false,
      concentration: false,
      description: "Reaction spell that interrupts spellcasting. Automatically counters 3rd level or lower spells. For full details, see the D&D 5e Wiki link.",
      wikiLink: "https://dnd5e.wikidot.com/spell:counterspell"
    },
    {
      name: "Create Food and Water",
      level: 3,
      school: "Conjuration",
      castingTime: "1 action",
      range: "30 feet",
      components: "V, S",
      duration: "Instantaneous",
      damage: "",
      save: "",
      attack: "",
      ritual: false,
      concentration: false,
      description: "Creates 45 pounds of food and 30 gallons of water, enough to sustain 15 humanoids or 5 steeds for 24 hours. For full details, see the D&D 5e Wiki link.",
      wikiLink: "https://dnd5e.wikidot.com/spell:create-food-and-water"
    },
    {
      name: "Daylight",
      level: 3,
      school: "Evocation",
      castingTime: "1 action",
      range: "60 feet",
      components: "V, S",
      duration: "1 hour",
      damage: "",
      save: "",
      attack: "",
      ritual: false,
      concentration: false,
      description: "Creates a 60-foot radius sphere of bright light that sheds dim light for an additional 60 feet. For full details, see the D&D 5e Wiki link.",
      wikiLink: "https://dnd5e.wikidot.com/spell:daylight"
    },
    {
      name: "Dispel Magic",
      level: 3,
      school: "Abjuration",
      castingTime: "1 action",
      range: "120 feet",
      components: "V, S",
      duration: "Instantaneous",
      damage: "",
      save: "",
      attack: "",
      ritual: false,
      concentration: false,
      description: "Ends spells of 3rd level or lower automatically. Higher level spells require ability checks. For full details, see the D&D 5e Wiki link.",
      wikiLink: "https://dnd5e.wikidot.com/spell:dispel-magic"
    },
    {
      name: "Elemental Weapon",
      level: 3,
      school: "Transmutation",
      castingTime: "1 action",
      range: "Touch",
      components: "V, S",
      duration: "Concentration, up to 1 hour",
      damage: "",
      save: "",
      attack: "",
      ritual: false,
      concentration: true,
      description: "Makes a weapon magical with +1 to attack rolls and +1d4 elemental damage. For full details, see the D&D 5e Wiki link.",
      wikiLink: "https://dnd5e.wikidot.com/spell:elemental-weapon"
    },
    {
      name: "Fear",
      level: 3,
      school: "Illusion",
      castingTime: "1 action",
      range: "Self (30-foot cone)",
      components: "V, S, M",
      duration: "Concentration, up to 1 minute",
      damage: "",
      save: "Wisdom save",
      attack: "",
      ritual: false,
      concentration: true,
      description: "Creates a 30-foot cone of fear. Creatures make Wisdom saves or drop held items and become frightened. For full details, see the D&D 5e Wiki link.",
      wikiLink: "https://dnd5e.wikidot.com/spell:fear"
    },
    {
      name: "Fireball",
      level: 3,
      school: "Evocation",
      castingTime: "1 action",
      range: "150 feet",
      components: "V, S, M",
      duration: "Instantaneous",
      damage: "8d6 fire damage",
      save: "Dexterity save",
      attack: "",
      ritual: false,
      concentration: false,
      description: "Creates a 20-foot radius explosion dealing 8d6 fire damage. Targets make Dexterity saves for half damage. For full details, see the D&D 5e Wiki link.",
      wikiLink: "https://dnd5e.wikidot.com/spell:fireball"
    },
    {
      name: "Fly",
      level: 3,
      school: "Transmutation",
      castingTime: "1 action",
      range: "Touch",
      components: "V, S, M",
      duration: "Concentration, up to 10 minutes",
      damage: "",
      save: "",
      attack: "",
      ritual: false,
      concentration: true,
      description: "Grants a flying speed of 60 feet for 10 minutes. For full details, see the D&D 5e Wiki link.",
      wikiLink: "https://dnd5e.wikidot.com/spell:fly"
    },
    {
      name: "Gaseous Form",
      level: 3,
      school: "Transmutation",
      castingTime: "1 action",
      range: "Touch",
      components: "V, S, M",
      duration: "Concentration, up to 1 hour",
      damage: "",
      save: "",
      attack: "",
      ritual: false,
      concentration: true,
      description: "Transforms a creature into a misty cloud for 1 hour. For full details, see the D&D 5e Wiki link.",
      wikiLink: "https://dnd5e.wikidot.com/spell:gaseous-form"
    },
    {
      name: "Glyph of Warding",
      level: 3,
      school: "Abjuration",
      castingTime: "1 hour",
      range: "Touch",
      components: "V, S, M",
      duration: "Until dispelled or triggered",
      damage: "",
      save: "",
      attack: "",
      ritual: false,
      concentration: false,
      description: "Inscribes a magical glyph that triggers when disturbed, dealing damage or other effects. For full details, see the D&D 5e Wiki link.",
      wikiLink: "https://dnd5e.wikidot.com/spell:glyph-of-warding"
    },
    {
      name: "Haste",
      level: 3,
      school: "Transmutation",
      castingTime: "1 action",
      range: "30 feet",
      components: "V, S, M",
      duration: "Concentration, up to 1 minute",
      damage: "",
      save: "",
      attack: "",
      ritual: false,
      concentration: true,
      description: "Doubles speed, grants +2 AC, advantage on Dexterity saves, and an additional action each turn. For full details, see the D&D 5e Wiki link.",
      wikiLink: "https://dnd5e.wikidot.com/spell:haste"
    },
    {
      name: "Hypnotic Pattern",
      level: 3,
      school: "Illusion",
      castingTime: "1 action",
      range: "120 feet",
      components: "S, M",
      duration: "Concentration, up to 1 minute",
      damage: "",
      save: "Wisdom save",
      attack: "",
      ritual: false,
      concentration: true,
      description: "Creates a 30-foot cube of twisting colors that charms creatures who see it. Targets make Wisdom saves. For full details, see the D&D 5e Wiki link.",
      wikiLink: "https://dnd5e.wikidot.com/spell:hypnotic-pattern"
    },
    {
      name: "Intellect Fortress",
      level: 3,
      school: "Abjuration",
      castingTime: "1 action",
      range: "Touch",
      components: "V, S",
      duration: "Concentration, up to 1 hour",
      damage: "",
      save: "",
      attack: "",
      ritual: false,
      concentration: true,
      description: "Grants resistance to psychic damage and advantage on Intelligence, Wisdom, and Charisma saves. For full details, see the D&D 5e Wiki link.",
      wikiLink: "https://dnd5e.wikidot.com/spell:intellect-fortress"
    },
    {
      name: "Lightning Bolt",
      level: 3,
      school: "Evocation",
      castingTime: "1 action",
      range: "Self (100-foot line)",
      components: "V, S, M",
      duration: "Instantaneous",
      damage: "8d6 lightning damage",
      save: "Dexterity save",
      attack: "",
      ritual: false,
      concentration: false,
      description: "Creates a 100-foot line of lightning dealing 8d6 lightning damage. Targets make Dexterity saves for half damage. For full details, see the D&D 5e Wiki link.",
      wikiLink: "https://dnd5e.wikidot.com/spell:lightning-bolt"
    },
    {
      name: "Magic Circle",
      level: 3,
      school: "Abjuration",
      castingTime: "1 minute",
      range: "10 feet",
      components: "V, S, M",
      duration: "1 hour",
      damage: "",
      save: "",
      attack: "",
      ritual: false,
      concentration: false,
      description: "Creates a 10-foot radius cylinder that blocks or traps certain creature types. For full details, see the D&D 5e Wiki link.",
      wikiLink: "https://dnd5e.wikidot.com/spell:magic-circle"
    },
    {
      name: "Major Image",
      level: 3,
      school: "Illusion",
      castingTime: "1 action",
      range: "120 feet",
      components: "V, S, M",
      duration: "Concentration, up to 10 minutes",
      damage: "",
      save: "",
      attack: "",
      ritual: false,
      concentration: true,
      description: "Creates a visual illusion of an object or creature in a 20-foot cube. For full details, see the D&D 5e Wiki link.",
      wikiLink: "https://dnd5e.wikidot.com/spell:major-image"
    },
    {
      name: "Mass Healing Word",
      level: 3,
      school: "Evocation",
      castingTime: "1 bonus action",
      range: "60 feet",
      components: "V",
      duration: "Instantaneous",
      damage: "",
      save: "",
      attack: "",
      ritual: false,
      concentration: false,
      description: "Bonus action healing spell that restores 1d4 + spellcasting modifier hit points to up to 6 creatures. For full details, see the D&D 5e Wiki link.",
      wikiLink: "https://dnd5e.wikidot.com/spell:mass-healing-word"
    },
    {
      name: "Meld into Stone",
      level: 3,
      school: "Transmutation",
      castingTime: "1 action",
      range: "Touch",
      components: "V, S",
      duration: "8 hours",
      damage: "",
      save: "",
      attack: "",
      ritual: true,
      concentration: false,
      description: "Allows you to meld into stone for 8 hours, becoming undetectable. For full details, see the D&D 5e Wiki link.",
      wikiLink: "https://dnd5e.wikidot.com/spell:meld-into-stone"
    },
    {
      name: "Nondetection",
      level: 3,
      school: "Abjuration",
      castingTime: "1 action",
      range: "Touch",
      components: "V, S, M",
      duration: "8 hours",
      damage: "",
      save: "",
      attack: "",
      ritual: false,
      concentration: false,
      description: "Hides a target from divination magic and magical scrying for 8 hours. For full details, see the D&D 5e Wiki link.",
      wikiLink: "https://dnd5e.wikidot.com/spell:nondetection"
    },
    {
      name: "Plant Growth",
      level: 3,
      school: "Transmutation",
      castingTime: "1 action",
      range: "150 feet",
      components: "V, S",
      duration: "Instantaneous",
      damage: "",
      save: "",
      attack: "",
      ritual: false,
      concentration: false,
      description: "Channels vitality into plants, creating difficult terrain or enhancing crop growth. For full details, see the D&D 5e Wiki link.",
      wikiLink: "https://dnd5e.wikidot.com/spell:plant-growth"
    },
    {
      name: "Protection from Energy",
      level: 3,
      school: "Abjuration",
      castingTime: "1 action",
      range: "Touch",
      components: "V, S",
      duration: "Concentration, up to 1 hour",
      damage: "",
      save: "",
      attack: "",
      ritual: false,
      concentration: true,
      description: "Grants resistance to one damage type (acid, cold, fire, lightning, or thunder) for 1 hour. For full details, see the D&D 5e Wiki link.",
      wikiLink: "https://dnd5e.wikidot.com/spell:protection-from-energy"
    },
    {
      name: "Remove Curse",
      level: 3,
      school: "Abjuration",
      castingTime: "1 action",
      range: "Touch",
      components: "V, S",
      duration: "Instantaneous",
      damage: "",
      save: "",
      attack: "",
      ritual: false,
      concentration: false,
      description: "Removes all curses from a creature or object. Breaks attunement to cursed magic items. For full details, see the D&D 5e Wiki link.",
      wikiLink: "https://dnd5e.wikidot.com/spell:remove-curse"
    },
    {
      name: "Revivify",
      level: 3,
      school: "Necromancy",
      castingTime: "1 action",
      range: "Touch",
      components: "V, S, M",
      duration: "Instantaneous",
      damage: "",
      save: "",
      attack: "",
      ritual: false,
      concentration: false,
      description: "Brings back a creature that died within the last minute with 1 hit point. For full details, see the D&D 5e Wiki link.",
      wikiLink: "https://dnd5e.wikidot.com/spell:revivify"
    },
    {
      name: "Sending",
      level: 3,
      school: "Evocation",
      castingTime: "1 action",
      range: "Unlimited",
      components: "V, S, M",
      duration: "1 round",
      damage: "",
      save: "",
      attack: "",
      ritual: false,
      concentration: false,
      description: "Sends a 25-word message to a familiar creature anywhere. They can reply immediately. For full details, see the D&D 5e Wiki link.",
      wikiLink: "https://dnd5e.wikidot.com/spell:sending"
    },
    {
      name: "Sleet Storm",
      level: 3,
      school: "Conjuration",
      castingTime: "1 action",
      range: "150 feet",
      components: "V, S, M",
      duration: "Concentration, up to 1 minute",
      damage: "",
      save: "Dexterity save",
      attack: "",
      ritual: false,
      concentration: true,
      description: "Creates a 40-foot radius cylinder of freezing rain and sleet that heavily obscures the area. For full details, see the D&D 5e Wiki link.",
      wikiLink: "https://dnd5e.wikidot.com/spell:sleet-storm"
    },
    {
      name: "Slow",
      level: 3,
      school: "Transmutation",
      castingTime: "1 action",
      range: "120 feet",
      components: "V, S, M",
      duration: "Concentration, up to 1 minute",
      damage: "",
      save: "Wisdom save",
      attack: "",
      ritual: false,
      concentration: true,
      description: "Slows up to 6 creatures in a 40-foot cube. Targets make Wisdom saves or are affected. For full details, see the D&D 5e Wiki link.",
      wikiLink: "https://dnd5e.wikidot.com/spell:slow"
    },
    {
      name: "Speak with Dead",
      level: 3,
      school: "Necromancy",
      castingTime: "1 action",
      range: "10 feet",
      components: "V, S, M",
      duration: "10 minutes",
      damage: "",
      save: "",
      attack: "",
      ritual: false,
      concentration: false,
      description: "Allows a corpse to answer questions for 10 minutes. Can't be used on the same corpse within 10 days. For full details, see the D&D 5e Wiki link.",
      wikiLink: "https://dnd5e.wikidot.com/spell:speak-with-dead"
    },
    {
      name: "Spirit Guardians",
      level: 3,
      school: "Conjuration",
      castingTime: "1 action",
      range: "Self (15-foot radius)",
      components: "V, S, M",
      duration: "Concentration, up to 10 minutes",
      damage: "3d8 radiant damage",
      save: "Wisdom save",
      attack: "",
      ritual: false,
      concentration: true,
      description: "Summons spirits in a 15-foot radius that deal 3d8 radiant damage to enemies. For full details, see the D&D 5e Wiki link.",
      wikiLink: "https://dnd5e.wikidot.com/spell:spirit-guardians"
    },
    {
      name: "Stinking Cloud",
      level: 3,
      school: "Conjuration",
      castingTime: "1 action",
      range: "90 feet",
      components: "V, S, M",
      duration: "Concentration, up to 1 minute",
      damage: "",
      save: "Constitution save",
      attack: "",
      ritual: false,
      concentration: true,
      description: "Creates a 20-foot radius sphere of nauseating gas that heavily obscures the area. For full details, see the D&D 5e Wiki link.",
      wikiLink: "https://dnd5e.wikidot.com/spell:stinking-cloud"
    },
    {
      name: "Tiny Servant",
      level: 3,
      school: "Transmutation",
      castingTime: "1 minute",
      range: "Touch",
      components: "V, S",
      duration: "8 hours",
      damage: "",
      save: "",
      attack: "",
      ritual: false,
      concentration: false,
      description: "Animates a Tiny object into a servant under your control for 8 hours. For full details, see the D&D 5e Wiki link.",
      wikiLink: "https://dnd5e.wikidot.com/spell:tiny-servant"
    },
    {
      name: "Tongues",
      level: 3,
      school: "Divination",
      castingTime: "1 action",
      range: "Touch",
      components: "V, M",
      duration: "1 hour",
      damage: "",
      save: "",
      attack: "",
      ritual: false,
      concentration: false,
      description: "Allows understanding and speaking of any language for 1 hour. For full details, see the D&D 5e Wiki link.",
      wikiLink: "https://dnd5e.wikidot.com/spell:tongues"
    },
    {
      name: "Vampiric Touch",
      level: 3,
      school: "Necromancy",
      castingTime: "1 action",
      range: "Self",
      components: "V, S",
      duration: "Concentration, up to 1 minute",
      damage: "3d6 necrotic damage",
      save: "",
      attack: "Melee spell attack",
      ritual: false,
      concentration: true,
      description: "Melee spell attack dealing 3d6 necrotic damage and healing you for half the damage dealt. For full details, see the D&D 5e Wiki link.",
      wikiLink: "https://dnd5e.wikidot.com/spell:vampiric-touch"
    },
    {
      name: "Wall of Sand",
      level: 3,
      school: "Evocation",
      castingTime: "1 action",
      range: "90 feet",
      components: "V, S, M",
      duration: "Concentration, up to 10 minutes",
      damage: "",
      save: "",
      attack: "",
      ritual: false,
      concentration: true,
      description: "Creates a wall of swirling sand that can be shaped into various forms. For full details, see the D&D 5e Wiki link.",
      wikiLink: "https://dnd5e.wikidot.com/spell:wall-of-sand"
    },
    {
      name: "Wall of Water",
      level: 3,
      school: "Evocation",
      castingTime: "1 action",
      range: "60 feet",
      components: "V, S, M",
      duration: "Concentration, up to 10 minutes",
      damage: "",
      save: "",
      attack: "",
      ritual: false,
      concentration: true,
      description: "Creates a wall of water that can be shaped into various forms. For full details, see the D&D 5e Wiki link.",
      wikiLink: "https://dnd5e.wikidot.com/spell:wall-of-water"
    },
    {
      name: "Water Breathing",
      level: 3,
      school: "Transmutation",
      castingTime: "1 action",
      range: "30 feet",
      components: "V, S, M",
      duration: "24 hours",
      damage: "",
      save: "",
      attack: "",
      ritual: true,
      concentration: false,
      description: "Grants up to 10 creatures the ability to breathe underwater for 24 hours. For full details, see the D&D 5e Wiki link.",
      wikiLink: "https://dnd5e.wikidot.com/spell:water-breathing"
    },
    {
      name: "Water Walk",
      level: 3,
      school: "Transmutation",
      castingTime: "1 action",
      range: "30 feet",
      components: "V, S, M",
      duration: "1 hour",
      damage: "",
      save: "",
      attack: "",
      ritual: true,
      concentration: false,
      description: "Grants up to 10 creatures the ability to walk on liquid surfaces for 1 hour. For full details, see the D&D 5e Wiki link.",
      wikiLink: "https://dnd5e.wikidot.com/spell:water-walk"
    },
    {
      name: "Wind Wall",
      level: 3,
      school: "Evocation",
      castingTime: "1 action",
      range: "120 feet",
      components: "V, S, M",
      duration: "Concentration, up to 1 minute",
      damage: "",
      save: "",
      attack: "",
      ritual: false,
      concentration: true,
      description: "Creates a wall of strong wind that deflects projectiles and creates difficult terrain. For full details, see the D&D 5e Wiki link.",
      wikiLink: "https://dnd5e.wikidot.com/spell:wind-wall"
    },
    {
      name: "Arcane Eye",
      level: 4,
      school: "Divination",
      castingTime: "1 action",
      range: "30 feet",
      components: "V, S, M",
      duration: "Concentration, up to 1 hour",
      damage: "",
      save: "",
      attack: "",
      ritual: false,
      concentration: true,
      description: "Creates an invisible eye that you can see through and control for 1 hour. For full details, see the D&D 5e Wiki link.",
      wikiLink: "https://dnd5e.wikidot.com/spell:arcane-eye"
    },
    {
      name: "Aura of Life",
      level: 4,
      school: "Abjuration",
      castingTime: "1 action",
      range: "Self (30-foot radius)",
      components: "V",
      duration: "Concentration, up to 10 minutes",
      damage: "",
      save: "",
      attack: "",
      ritual: false,
      concentration: true,
      description: "Creates a 30-foot radius aura that grants resistance to necrotic damage and prevents hit point maximum reduction. For full details, see the D&D 5e Wiki link.",
      wikiLink: "https://dnd5e.wikidot.com/spell:aura-of-life"
    },
    {
      name: "Aura of Purity",
      level: 4,
      school: "Abjuration",
      castingTime: "1 action",
      range: "Self (30-foot radius)",
      components: "V",
      duration: "Concentration, up to 10 minutes",
      damage: "",
      save: "",
      attack: "",
      ritual: false,
      concentration: true,
      description: "Creates a 30-foot radius aura that prevents disease, grants poison resistance, and advantage on saves against various conditions. For full details, see the D&D 5e Wiki link.",
      wikiLink: "https://dnd5e.wikidot.com/spell:aura-of-purity"
    },
    {
      name: "Banishment",
      level: 4,
      school: "Abjuration",
      castingTime: "1 action",
      range: "60 feet",
      components: "V, S, M",
      duration: "Concentration, up to 1 minute",
      damage: "",
      save: "Charisma save",
      attack: "",
      ritual: false,
      concentration: true,
      description: "Attempts to banish a creature to another plane. Target makes Charisma save. For full details, see the D&D 5e Wiki link.",
      wikiLink: "https://dnd5e.wikidot.com/spell:banishment"
    },
    {
      name: "Blight",
      level: 4,
      school: "Necromancy",
      castingTime: "1 action",
      range: "30 feet",
      components: "V, S",
      duration: "Instantaneous",
      damage: "8d8 necrotic damage",
      save: "Constitution save",
      attack: "",
      ritual: false,
      concentration: false,
      description: "Deals 8d8 necrotic damage to a creature. Target makes Constitution save for half damage. For full details, see the D&D 5e Wiki link.",
      wikiLink: "https://dnd5e.wikidot.com/spell:blight"
    },
    {
      name: "Compulsion",
      level: 4,
      school: "Enchantment",
      castingTime: "1 action",
      range: "30 feet",
      components: "V, S",
      duration: "Concentration, up to 1 minute",
      damage: "",
      save: "Wisdom save",
      attack: "",
      ritual: false,
      concentration: true,
      description: "Forces creatures to move in a specific direction. Targets make Wisdom saves. For full details, see the D&D 5e Wiki link.",
      wikiLink: "https://dnd5e.wikidot.com/spell:compulsion"
    },
    {
      name: "Confusion",
      level: 4,
      school: "Enchantment",
      castingTime: "1 action",
      range: "90 feet",
      components: "V, S, M",
      duration: "Concentration, up to 1 minute",
      damage: "",
      save: "Wisdom save",
      attack: "",
      ritual: false,
      concentration: true,
      description: "Creates a 10-foot radius sphere that confuses creatures. Targets make Wisdom saves. For full details, see the D&D 5e Wiki link.",
      wikiLink: "https://dnd5e.wikidot.com/spell:confusion"
    },
    {
      name: "Conjure Minor Elementals",
      level: 4,
      school: "Conjuration",
      castingTime: "1 minute",
      range: "90 feet",
      components: "V, S",
      duration: "Concentration, up to 1 hour",
      damage: "",
      save: "",
      attack: "",
      ritual: false,
      concentration: true,
      description: "Summons elementals of various challenge ratings. Choose from different options based on CR. For full details, see the D&D 5e Wiki link.",
      wikiLink: "https://dnd5e.wikidot.com/spell:conjure-minor-elementals"
    },
    {
      name: "Conjure Woodland Beings",
      level: 4,
      school: "Conjuration",
      castingTime: "1 action",
      range: "60 feet",
      components: "V, S, M",
      duration: "Concentration, up to 1 hour",
      damage: "",
      save: "",
      attack: "",
      ritual: false,
      concentration: true,
      description: "Summons fey creatures of various challenge ratings. Choose from different options based on CR. For full details, see the D&D 5e Wiki link.",
      wikiLink: "https://dnd5e.wikidot.com/spell:conjure-woodland-beings"
    },
    {
      name: "Control Water",
      level: 4,
      school: "Transmutation",
      castingTime: "1 action",
      range: "300 feet",
      components: "V, S, M",
      duration: "Concentration, up to 10 minutes",
      damage: "",
      save: "",
      attack: "",
      ritual: false,
      concentration: true,
      description: "Controls water in a 100-foot cube with various effects like flooding, parting, or redirecting. For full details, see the D&D 5e Wiki link.",
      wikiLink: "https://dnd5e.wikidot.com/spell:control-water"
    },
    {
      name: "Death Ward",
      level: 4,
      school: "Abjuration",
      castingTime: "1 action",
      range: "Touch",
      components: "V, S",
      duration: "8 hours",
      damage: "",
      save: "",
      attack: "",
      ritual: false,
      concentration: false,
      description: "Prevents a creature from dropping to 0 hit points once. The first time they would die, they drop to 1 hit point instead. For full details, see the D&D 5e Wiki link.",
      wikiLink: "https://dnd5e.wikidot.com/spell:death-ward"
    },
    {
      name: "Dimension Door",
      level: 4,
      school: "Conjuration",
      castingTime: "1 action",
      range: "500 feet",
      components: "V",
      duration: "Instantaneous",
      damage: "",
      save: "",
      attack: "",
      ritual: false,
      concentration: false,
      description: "Teleports you up to 500 feet to any location you can see or describe. For full details, see the D&D 5e Wiki link.",
      wikiLink: "https://dnd5e.wikidot.com/spell:dimension-door"
    },
    {
      name: "Divination",
      level: 4,
      school: "Divination",
      castingTime: "1 action",
      range: "Self",
      components: "V, S, M",
      duration: "Instantaneous",
      damage: "",
      save: "",
      attack: "",
      ritual: true,
      concentration: false,
      description: "Asks a single question to a god or their servants about events within 7 days. For full details, see the D&D 5e Wiki link.",
      wikiLink: "https://dnd5e.wikidot.com/spell:divination"
    },
    {
      name: "Dominate Beast",
      level: 4,
      school: "Enchantment",
      castingTime: "1 action",
      range: "60 feet",
      components: "V, S",
      duration: "Concentration, up to 1 minute",
      damage: "",
      save: "Wisdom save",
      attack: "",
      ritual: false,
      concentration: true,
      description: "Charms a beast, making it follow your commands. Target makes Wisdom save. For full details, see the D&D 5e Wiki link.",
      wikiLink: "https://dnd5e.wikidot.com/spell:dominate-beast"
    },
    {
      name: "Elemental Bane",
      level: 4,
      school: "Transmutation",
      castingTime: "1 action",
      range: "90 feet",
      components: "V, S",
      duration: "Concentration, up to 1 minute",
      damage: "",
      save: "Constitution save",
      attack: "",
      ritual: false,
      concentration: true,
      description: "Curses a creature to take extra damage from one elemental type. Target makes Constitution save. For full details, see the D&D 5e Wiki link.",
      wikiLink: "https://dnd5e.wikidot.com/spell:elemental-bane"
    },
    {
      name: "Evard's Black Tentacles",
      level: 4,
      school: "Conjuration",
      castingTime: "1 action",
      range: "90 feet",
      components: "V, S, M",
      duration: "Concentration, up to 1 minute",
      damage: "3d6 bludgeoning damage",
      save: "Dexterity save",
      attack: "",
      ritual: false,
      concentration: true,
      description: "Creates a 20-foot square of black tentacles that deal 3d6 bludgeoning damage and restrain creatures. For full details, see the D&D 5e Wiki link.",
      wikiLink: "https://dnd5e.wikidot.com/spell:evards-black-tentacles"
    },
    {
      name: "Fabricate",
      level: 4,
      school: "Transmutation",
      castingTime: "10 minutes",
      range: "120 feet",
      components: "V, S",
      duration: "Instantaneous",
      damage: "",
      save: "",
      attack: "",
      ritual: false,
      concentration: false,
      description: "Converts raw materials into finished products of the same material. For full details, see the D&D 5e Wiki link.",
      wikiLink: "https://dnd5e.wikidot.com/spell:fabricate"
    },
    {
      name: "Fire Shield",
      level: 4,
      school: "Evocation",
      castingTime: "1 action",
      range: "Self",
      components: "V, S, M",
      duration: "10 minutes",
      damage: "2d8 fire damage",
      save: "",
      attack: "",
      ritual: false,
      concentration: false,
      description: "Creates a shield of flames that provides resistance to fire or cold damage and deals 2d8 damage to attackers. For full details, see the D&D 5e Wiki link.",
      wikiLink: "https://dnd5e.wikidot.com/spell:fire-shield"
    },
    {
      name: "Freedom of Movement",
      level: 4,
      school: "Abjuration",
      castingTime: "1 action",
      range: "Touch",
      components: "V, S, M",
      duration: "1 hour",
      damage: "",
      save: "",
      attack: "",
      ritual: false,
      concentration: false,
      description: "Grants immunity to difficult terrain and prevents speed reduction, paralysis, and restraint. For full details, see the D&D 5e Wiki link.",
      wikiLink: "https://dnd5e.wikidot.com/spell:freedom-of-movement"
    },
    {
      name: "Giant Insect",
      level: 4,
      school: "Transmutation",
      castingTime: "1 action",
      range: "30 feet",
      components: "V, S, M",
      duration: "Concentration, up to 10 minutes",
      damage: "",
      save: "",
      attack: "",
      ritual: false,
      concentration: true,
      description: "Transforms insects into giant versions for 10 minutes. For full details, see the D&D 5e Wiki link.",
      wikiLink: "https://dnd5e.wikidot.com/spell:giant-insect"
    },
    {
      name: "Grasping Vine",
      level: 4,
      school: "Conjuration",
      castingTime: "1 bonus action",
      range: "30 feet",
      components: "V, S",
      duration: "Concentration, up to 1 minute",
      damage: "2d6 bludgeoning damage",
      save: "Strength save",
      attack: "",
      ritual: false,
      concentration: true,
      description: "Creates a vine that can pull creatures 20 feet toward it. Target makes Strength save. For full details, see the D&D 5e Wiki link.",
      wikiLink: "https://dnd5e.wikidot.com/spell:grasping-vine"
    },
    {
      name: "Greater Invisibility",
      level: 4,
      school: "Illusion",
      castingTime: "1 action",
      range: "Touch",
      components: "V, S",
      duration: "Concentration, up to 1 minute",
      damage: "",
      save: "",
      attack: "",
      ritual: false,
      concentration: true,
      description: "Makes a creature invisible for 1 minute. Invisibility doesn't end when attacking or casting spells. For full details, see the D&D 5e Wiki link.",
      wikiLink: "https://dnd5e.wikidot.com/spell:greater-invisibility"
    },
    {
      name: "Guardian of Faith",
      level: 4,
      school: "Conjuration",
      castingTime: "1 action",
      range: "30 feet",
      components: "V",
      duration: "8 hours",
      damage: "60 radiant damage",
      save: "",
      attack: "",
      ritual: false,
      concentration: false,
      description: "Creates a spectral guardian that attacks creatures entering its space for 60 radiant damage. For full details, see the D&D 5e Wiki link.",
      wikiLink: "https://dnd5e.wikidot.com/spell:guardian-of-faith"
    },
    {
      name: "Hallucinatory Terrain",
      level: 4,
      school: "Illusion",
      castingTime: "10 minutes",
      range: "300 feet",
      components: "V, S, M",
      duration: "24 hours",
      damage: "",
      save: "",
      attack: "",
      ritual: false,
      concentration: false,
      description: "Makes natural terrain in a 150-foot cube look, sound, and smell like different terrain for 24 hours. For full details, see the D&D 5e Wiki link.",
      wikiLink: "https://dnd5e.wikidot.com/spell:hallucinatory-terrain"
    },
    {
      name: "Ice Storm",
      level: 4,
      school: "Evocation",
      castingTime: "1 action",
      range: "300 feet",
      components: "V, S, M",
      duration: "Instantaneous",
      damage: "2d8 bludgeoning damage",
      save: "Dexterity save",
      attack: "",
      ritual: false,
      concentration: false,
      description: "Creates a 20-foot radius cylinder of ice that deals 2d8 bludgeoning and 4d6 cold damage. Targets make Dexterity saves for half damage. For full details, see the D&D 5e Wiki link.",
      wikiLink: "https://dnd5e.wikidot.com/spell:ice-storm"
    },
    {
      name: "Leomund's Secret Chest",
      level: 4,
      school: "Conjuration",
      castingTime: "1 action",
      range: "Touch",
      components: "V, S, M",
      duration: "Instantaneous",
      damage: "",
      save: "",
      attack: "",
      ritual: false,
      concentration: false,
      description: "Hides a chest and its contents on the Ethereal Plane. Can be retrieved with the miniature replica. For full details, see the D&D 5e Wiki link.",
      wikiLink: "https://dnd5e.wikidot.com/spell:leomunds-secret-chest"
    },
    {
      name: "Locate Creature",
      level: 4,
      school: "Divination",
      castingTime: "1 action",
      range: "Self",
      components: "V, S, M",
      duration: "Concentration, up to 1 hour",
      damage: "",
      save: "",
      attack: "",
      ritual: false,
      concentration: true,
      description: "Senses the direction to a familiar creature within 1,000 feet. For full details, see the D&D 5e Wiki link.",
      wikiLink: "https://dnd5e.wikidot.com/spell:locate-creature"
    },
    {
      name: "Mordenkainen's Faithful Hound",
      level: 4,
      school: "Conjuration",
      castingTime: "1 action",
      range: "30 feet",
      components: "V, S, M",
      duration: "8 hours",
      damage: "4d8 piercing damage",
      save: "",
      attack: "",
      ritual: false,
      concentration: false,
      description: "Creates an invisible phantom hound that attacks intruders for 4d8 piercing damage. For full details, see the D&D 5e Wiki link.",
      wikiLink: "https://dnd5e.wikidot.com/spell:mordenkainens-faithful-hound"
    },
    {
      name: "Mordenkainen's Private Sanctum",
      level: 4,
      school: "Abjuration",
      castingTime: "10 minutes",
      range: "120 feet",
      components: "V, S, M",
      duration: "24 hours",
      damage: "",
      save: "",
      attack: "",
      ritual: false,
      concentration: false,
      description: "Creates a magically secure area that can be customized with various security properties. For full details, see the D&D 5e Wiki link.",
      wikiLink: "https://dnd5e.wikidot.com/spell:mordenkainens-private-sanctum"
    },
    {
      name: "Otiluke's Resilient Sphere",
      level: 4,
      school: "Evocation",
      castingTime: "1 action",
      range: "30 feet",
      components: "V, S, M",
      duration: "Concentration, up to 1 minute",
      damage: "",
      save: "Dexterity save",
      attack: "",
      ritual: false,
      concentration: true,
      description: "Creates a sphere of force that encloses a creature or object. Target makes Dexterity save. For full details, see the D&D 5e Wiki link.",
      wikiLink: "https://dnd5e.wikidot.com/spell:otilukes-resilient-sphere"
    },
    {
      name: "Phantasmal Killer",
      level: 4,
      school: "Illusion",
      castingTime: "1 action",
      range: "120 feet",
      components: "V, S",
      duration: "Concentration, up to 1 minute",
      damage: "4d10 psychic damage",
      save: "Wisdom save",
      attack: "",
      ritual: false,
      concentration: true,
      description: "Creates a phantasmal killer that frightens a creature and deals 4d10 psychic damage each turn. Target makes Wisdom saves. For full details, see the D&D 5e Wiki link.",
      wikiLink: "https://dnd5e.wikidot.com/spell:phantasmal-killer"
    },
    {
      name: "Polymorph",
      level: 4,
      school: "Transmutation",
      castingTime: "1 action",
      range: "60 feet",
      components: "V, S, M",
      duration: "Concentration, up to 1 hour",
      damage: "",
      save: "Wisdom save",
      attack: "",
      ritual: false,
      concentration: true,
      description: "Transforms a creature into a new form. Target makes Wisdom save. For full details, see the D&D 5e Wiki link.",
      wikiLink: "https://dnd5e.wikidot.com/spell:polymorph"
    },
    {
      name: "Staggering Smite",
      level: 4,
      school: "Evocation",
      castingTime: "1 bonus action",
      range: "Self",
      components: "V",
      duration: "Concentration, up to 1 minute",
      damage: "4d6 psychic damage",
      save: "Wisdom save",
      attack: "",
      ritual: false,
      concentration: true,
      description: "Next melee attack deals +4d6 psychic damage and staggers the target if they fail Wisdom save. For full details, see the D&D 5e Wiki link.",
      wikiLink: "https://dnd5e.wikidot.com/spell:staggering-smite"
    },
    {
      name: "Stone Shape",
      level: 4,
      school: "Transmutation",
      castingTime: "1 action",
      range: "Touch",
      components: "V, S, M",
      duration: "Instantaneous",
      damage: "",
      save: "",
      attack: "",
      ritual: false,
      concentration: false,
      description: "Shapes stone into any form you desire. Can create weapons, passages, or other objects. For full details, see the D&D 5e Wiki link.",
      wikiLink: "https://dnd5e.wikidot.com/spell:stone-shape"
    },
    {
      name: "Stoneskin",
      level: 4,
      school: "Abjuration",
      castingTime: "1 action",
      range: "Touch",
      components: "V, S, M",
      duration: "Concentration, up to 1 hour",
      damage: "",
      save: "",
      attack: "",
      ritual: false,
      concentration: true,
      description: "Grants resistance to nonmagical bludgeoning, piercing, and slashing damage for 1 hour. For full details, see the D&D 5e Wiki link.",
      wikiLink: "https://dnd5e.wikidot.com/spell:stoneskin"
    },
    {
      name: "Wall of Fire",
      level: 4,
      school: "Evocation",
      castingTime: "1 action",
      range: "120 feet",
      components: "V, S, M",
      duration: "Concentration, up to 1 minute",
      damage: "5d8 fire damage",
      save: "Dexterity save",
      attack: "",
      ritual: false,
      concentration: true,
      description: "Creates a wall of fire that deals 5d8 fire damage to creatures passing through. For full details, see the D&D 5e Wiki link.",
      wikiLink: "https://dnd5e.wikidot.com/spell:wall-of-fire"
    },
    {
      name: "Watery Sphere",
      level: 4,
      school: "Conjuration",
      castingTime: "1 action",
      range: "90 feet",
      components: "V, S, M",
      duration: "Concentration, up to 1 minute",
      damage: "4d6 bludgeoning damage",
      save: "Dexterity save",
      attack: "",
      ritual: false,
      concentration: true,
      description: "Creates a 5-foot radius sphere of water that traps and damages creatures. Target makes Dexterity save. For full details, see the D&D 5e Wiki link.",
      wikiLink: "https://dnd5e.wikidot.com/spell:watery-sphere"
    },
    {
      name: "Animate Objects",
      level: 5,
      school: "Transmutation",
      castingTime: "1 action",
      range: "120 feet",
      components: "V, S",
      duration: "Concentration, up to 1 minute",
      damage: "",
      save: "",
      attack: "",
      ritual: false,
      concentration: true,
      description: "Animates up to 10 nonmagical objects, turning them into creatures under your control. For full details, see the D&D 5e Wiki link.",
      wikiLink: "https://dnd5e.wikidot.com/spell:animate-objects"
    },
    {
      name: "Bigby's Hand",
      level: 5,
      school: "Evocation",
      castingTime: "1 action",
      range: "120 feet",
      components: "V, S, M",
      duration: "Concentration, up to 1 minute",
      damage: "4d8 force damage",
      save: "Strength save",
      attack: "",
      ritual: false,
      concentration: true,
      description: "Creates a Large force hand that can attack, grapple, push, or block. For full details, see the D&D 5e Wiki link.",
      wikiLink: "https://dnd5e.wikidot.com/spell:bigbys-hand"
    },
    {
      name: "Circle of Power",
      level: 5,
      school: "Abjuration",
      castingTime: "1 action",
      range: "Self (30-foot radius)",
      components: "V",
      duration: "Concentration, up to 10 minutes",
      damage: "",
      save: "",
      attack: "",
      ritual: false,
      concentration: true,
      description: "Creates a 30-foot radius aura that grants advantage on saves against spells and prevents damage on successful saves. For full details, see the D&D 5e Wiki link.",
      wikiLink: "https://dnd5e.wikidot.com/spell:circle-of-power"
    },
    {
      name: "Cloudkill",
      level: 5,
      school: "Conjuration",
      castingTime: "1 action",
      range: "120 feet",
      components: "V, S",
      duration: "Concentration, up to 10 minutes",
      damage: "5d8 poison damage",
      save: "Constitution save",
      attack: "",
      ritual: false,
      concentration: true,
      description: "Creates a 20-foot radius sphere of poisonous fog that deals 5d8 poison damage. For full details, see the D&D 5e Wiki link.",
      wikiLink: "https://dnd5e.wikidot.com/spell:cloudkill"
    },
    {
      name: "Commune",
      level: 5,
      school: "Divination",
      castingTime: "1 minute",
      range: "Self",
      components: "V, S, M",
      duration: "1 minute",
      damage: "",
      save: "",
      attack: "",
      ritual: true,
      concentration: false,
      description: "Allows you to ask up to 3 yes/no questions to your deity or divine proxy. For full details, see the D&D 5e Wiki link.",
      wikiLink: "https://dnd5e.wikidot.com/spell:commune"
    },
    {
      name: "Commune with Nature",
      level: 5,
      school: "Divination",
      castingTime: "1 minute",
      range: "Self",
      components: "V, S",
      duration: "Instantaneous",
      damage: "",
      save: "",
      attack: "",
      ritual: true,
      concentration: false,
      description: "Grants knowledge of the surrounding natural territory within 3 miles (or 300 feet underground). For full details, see the D&D 5e Wiki link.",
      wikiLink: "https://dnd5e.wikidot.com/spell:commune-with-nature"
    },
    {
      name: "Cone of Cold",
      level: 5,
      school: "Evocation",
      castingTime: "1 action",
      range: "Self (60-foot cone)",
      components: "V, S, M",
      duration: "Instantaneous",
      damage: "8d8 cold damage",
      save: "Constitution save",
      attack: "",
      ritual: false,
      concentration: false,
      description: "Creates a 60-foot cone of cold air dealing 8d8 cold damage. Targets make Constitution saves for half damage. For full details, see the D&D 5e Wiki link.",
      wikiLink: "https://dnd5e.wikidot.com/spell:cone-of-cold"
    },
    {
      name: "Conjure Elemental",
      level: 5,
      school: "Conjuration",
      castingTime: "1 minute",
      range: "90 feet",
      components: "V, S, M",
      duration: "Concentration, up to 1 hour",
      damage: "",
      save: "",
      attack: "",
      ritual: false,
      concentration: true,
      description: "Summons an elemental of CR 5 or lower from a 10-foot cube of the appropriate element. For full details, see the D&D 5e Wiki link.",
      wikiLink: "https://dnd5e.wikidot.com/spell:conjure-elemental"
    },
    {
      name: "Contact Other Plane",
      level: 5,
      school: "Divination",
      castingTime: "1 minute",
      range: "Self",
      components: "V",
      duration: "1 minute",
      damage: "",
      save: "",
      attack: "",
      ritual: true,
      concentration: false,
      description: "Contacts an extraplanar entity for information. Risk of insanity on failed Intelligence save. For full details, see the D&D 5e Wiki link.",
      wikiLink: "https://dnd5e.wikidot.com/spell:contact-other-plane"
    },
    {
      name: "Contagion",
      level: 5,
      school: "Necromancy",
      castingTime: "1 action",
      range: "Touch",
      components: "V, S",
      duration: "7 days",
      damage: "",
      save: "Constitution save",
      attack: "",
      ritual: false,
      concentration: false,
      description: "Melee spell attack that inflicts disease. Target makes Constitution saves to resist. For full details, see the D&D 5e Wiki link.",
      wikiLink: "https://dnd5e.wikidot.com/spell:contagion"
    },
    {
      name: "Creation",
      level: 5,
      school: "Illusion",
      castingTime: "1 minute",
      range: "30 feet",
      components: "V, S, M",
      duration: "Special",
      damage: "",
      save: "",
      attack: "",
      ritual: false,
      concentration: false,
      description: "Creates a nonliving object of vegetable or mineral matter up to 5-foot cube in size. For full details, see the D&D 5e Wiki link.",
      wikiLink: "https://dnd5e.wikidot.com/spell:creation"
    },
    {
      name: "Destructive Wave",
      level: 5,
      school: "Evocation",
      castingTime: "1 action",
      range: "Self (30-foot radius)",
      components: "V",
      duration: "Instantaneous",
      damage: "5d6 thunder damage",
      save: "Constitution save",
      attack: "",
      ritual: false,
      concentration: false,
      description: "Creates a 30-foot radius burst dealing 5d6 thunder + 5d6 radiant/necrotic damage and knocks prone. Targets make Constitution saves. For full details, see the D&D 5e Wiki link.",
      wikiLink: "https://dnd5e.wikidot.com/spell:destructive-wave"
    },
    {
      name: "Dispel Evil and Good",
      level: 5,
      school: "Abjuration",
      castingTime: "1 action",
      range: "Self",
      components: "V, S, M",
      duration: "Concentration, up to 1 minute",
      damage: "",
      save: "",
      attack: "",
      ritual: false,
      concentration: true,
      description: "Protects you from extraplanar creatures and allows you to banish or turn them. For full details, see the D&D 5e Wiki link.",
      wikiLink: "https://dnd5e.wikidot.com/spell:dispel-evil-and-good"
    },
    {
      name: "Dominate Person",
      level: 5,
      school: "Enchantment",
      castingTime: "1 action",
      range: "60 feet",
      components: "V, S",
      duration: "Concentration, up to 1 minute",
      damage: "",
      save: "Wisdom save",
      attack: "",
      ritual: false,
      concentration: true,
      description: "Charms a humanoid, making it follow your commands. Target makes Wisdom save. For full details, see the D&D 5e Wiki link.",
      wikiLink: "https://dnd5e.wikidot.com/spell:dominate-person"
    },
    {
      name: "Dream",
      level: 5,
      school: "Illusion",
      castingTime: "1 minute",
      range: "Special",
      components: "V, S, M",
      duration: "8 hours",
      damage: "3d6 psychic damage",
      save: "Wisdom save",
      attack: "",
      ritual: false,
      concentration: false,
      description: "Shapes a creature's dreams to deliver messages or deal 3d6 psychic damage. For full details, see the D&D 5e Wiki link.",
      wikiLink: "https://dnd5e.wikidot.com/spell:dream"
    },
    {
      name: "Flame Strike",
      level: 5,
      school: "Evocation",
      castingTime: "1 action",
      range: "60 feet",
      components: "V, S, M",
      duration: "Instantaneous",
      damage: "4d6 fire damage",
      save: "Dexterity save",
      attack: "",
      ritual: false,
      concentration: false,
      description: "Creates a 10-foot radius cylinder of divine fire dealing 4d6 fire + 4d6 radiant damage. Targets make Dexterity saves for half damage. For full details, see the D&D 5e Wiki link.",
      wikiLink: "https://dnd5e.wikidot.com/spell:flame-strike"
    },
    {
      name: "Geas",
      level: 5,
      school: "Enchantment",
      castingTime: "1 minute",
      range: "60 feet",
      components: "V",
      duration: "30 days",
      damage: "5d10 psychic damage",
      save: "Wisdom save",
      attack: "",
      ritual: false,
      concentration: false,
      description: "Places a magical command on a creature for 30 days. Violating the command deals 5d10 psychic damage. Target makes Wisdom save. For full details, see the D&D 5e Wiki link.",
      wikiLink: "https://dnd5e.wikidot.com/spell:geas"
    },
    {
      name: "Greater Restoration",
      level: 5,
      school: "Abjuration",
      castingTime: "1 action",
      range: "Touch",
      components: "V, S, M",
      duration: "Instantaneous",
      damage: "",
      save: "",
      attack: "",
      ritual: false,
      concentration: false,
      description: "Removes debilitating effects like charm, petrification, curses, ability score reduction, or hit point maximum reduction. For full details, see the D&D 5e Wiki link.",
      wikiLink: "https://dnd5e.wikidot.com/spell:greater-restoration"
    },
    {
      name: "Hallow",
      level: 5,
      school: "Evocation",
      castingTime: "24 hours",
      range: "Touch",
      components: "V, S, M",
      duration: "Until dispelled",
      damage: "",
      save: "",
      attack: "",
      ritual: false,
      concentration: false,
      description: "Consecrates a 60-foot radius area, preventing extraplanar creatures from entering and providing various protective effects. For full details, see the D&D 5e Wiki link.",
      wikiLink: "https://dnd5e.wikidot.com/spell:hallow"
    },
    {
      name: "Hold Monster",
      level: 5,
      school: "Enchantment",
      castingTime: "1 action",
      range: "90 feet",
      components: "V, S, M",
      duration: "Concentration, up to 1 minute",
      damage: "",
      save: "Wisdom save",
      attack: "",
      ritual: false,
      concentration: true,
      description: "Paralyzes a creature. Target makes Wisdom saves to resist and can repeat the save each turn. For full details, see the D&D 5e Wiki link.",
      wikiLink: "https://dnd5e.wikidot.com/spell:hold-monster"
    },
    {
      name: "Immolation",
      level: 5,
      school: "Evocation",
      castingTime: "1 action",
      range: "90 feet",
      components: "V",
      duration: "Concentration, up to 1 minute",
      damage: "8d6 fire damage",
      save: "Dexterity save",
      attack: "",
      ritual: false,
      concentration: true,
      description: "Wreathes a creature in flames dealing 8d6 fire damage initially, then 4d6 fire damage each turn. Target makes Dexterity saves. For full details, see the D&D 5e Wiki link.",
      wikiLink: "https://dnd5e.wikidot.com/spell:immolation"
    },
    {
      name: "Insect Plague",
      level: 5,
      school: "Conjuration",
      castingTime: "1 action",
      range: "300 feet",
      components: "V, S, M",
      duration: "Concentration, up to 10 minutes",
      damage: "4d10 piercing damage",
      save: "Constitution save",
      attack: "",
      ritual: false,
      concentration: true,
      description: "Creates a 20-foot radius sphere of swarming locusts dealing 4d10 piercing damage. Targets make Constitution saves. For full details, see the D&D 5e Wiki link.",
      wikiLink: "https://dnd5e.wikidot.com/spell:insect-plague"
    },
    {
      name: "Legend Lore",
      level: 5,
      school: "Divination",
      castingTime: "10 minutes",
      range: "Self",
      components: "V, S, M",
      duration: "Instantaneous",
      damage: "",
      save: "",
      attack: "",
      ritual: false,
      concentration: false,
      description: "Reveals significant lore about a person, place, or object of legendary importance. For full details, see the D&D 5e Wiki link.",
      wikiLink: "https://dnd5e.wikidot.com/spell:legend-lore"
    },
    {
      name: "Mass Cure Wounds",
      level: 5,
      school: "Evocation",
      castingTime: "1 action",
      range: "60 feet",
      components: "V, S",
      duration: "Instantaneous",
      damage: "",
      save: "",
      attack: "",
      ritual: false,
      concentration: false,
      description: "Heals up to 6 creatures in a 30-foot radius for 3d8 + spellcasting modifier hit points. For full details, see the D&D 5e Wiki link.",
      wikiLink: "https://dnd5e.wikidot.com/spell:mass-cure-wounds"
    },
    {
      name: "Mislead",
      level: 5,
      school: "Illusion",
      castingTime: "1 action",
      range: "Self",
      components: "S",
      duration: "Concentration, up to 1 hour",
      damage: "",
      save: "",
      attack: "",
      ritual: false,
      concentration: true,
      description: "Makes you invisible and creates an illusory double that you can control. For full details, see the D&D 5e Wiki link.",
      wikiLink: "https://dnd5e.wikidot.com/spell:mislead"
    },
    {
      name: "Modify Memory",
      level: 5,
      school: "Enchantment",
      castingTime: "1 action",
      range: "30 feet",
      components: "V, S",
      duration: "Concentration, up to 1 minute",
      damage: "",
      save: "Wisdom save",
      attack: "",
      ritual: false,
      concentration: true,
      description: "Allows you to modify a creature's memories. Target makes Wisdom save. For full details, see the D&D 5e Wiki link.",
      wikiLink: "https://dnd5e.wikidot.com/spell:modify-memory"
    },
    {
      name: "Passwall",
      level: 5,
      school: "Transmutation",
      castingTime: "1 action",
      range: "30 feet",
      components: "V, S, M",
      duration: "1 hour",
      damage: "",
      save: "",
      attack: "",
      ritual: false,
      concentration: false,
      description: "Creates a passage through wooden, plaster, or stone surfaces up to 5 feet wide, 8 feet tall, and 20 feet deep. For full details, see the D&D 5e Wiki link.",
      wikiLink: "https://dnd5e.wikidot.com/spell:passwall"
    },
    {
      name: "Planar Binding",
      level: 5,
      school: "Abjuration",
      castingTime: "1 hour",
      range: "60 feet",
      components: "V, S, M",
      duration: "24 hours",
      damage: "",
      save: "Charisma save",
      attack: "",
      ritual: false,
      concentration: false,
      description: "Binds a celestial, elemental, fey, or fiend to your service. Target makes Charisma save. For full details, see the D&D 5e Wiki link.",
      wikiLink: "https://dnd5e.wikidot.com/spell:planar-binding"
    },
    {
      name: "Raise Dead",
      level: 5,
      school: "Necromancy",
      castingTime: "1 hour",
      range: "Touch",
      components: "V, S, M",
      duration: "Instantaneous",
      damage: "",
      save: "",
      attack: "",
      ritual: false,
      concentration: false,
      description: "Returns a dead creature to life if it has been dead no longer than 10 days. For full details, see the D&D 5e Wiki link.",
      wikiLink: "https://dnd5e.wikidot.com/spell:raise-dead"
    },
    {
      name: "Rary's Telepathic Bond",
      level: 5,
      school: "Divination",
      castingTime: "1 action",
      range: "30 feet",
      components: "V, S, M",
      duration: "1 hour",
      damage: "",
      save: "",
      attack: "",
      ritual: true,
      concentration: false,
      description: "Creates a telepathic link among up to 8 willing creatures for communication over any distance. For full details, see the D&D 5e Wiki link.",
      wikiLink: "https://dnd5e.wikidot.com/spell:rarys-telepathic-bond"
    },
    {
      name: "Scrying",
      level: 5,
      school: "Divination",
      castingTime: "10 minutes",
      range: "Self",
      components: "V, S, M",
      duration: "Concentration, up to 10 minutes",
      damage: "",
      save: "Wisdom save",
      attack: "",
      ritual: false,
      concentration: true,
      description: "Allows you to see and hear a creature on the same plane. Target makes Wisdom save. For full details, see the D&D 5e Wiki link.",
      wikiLink: "https://dnd5e.wikidot.com/spell:scrying"
    },
    {
      name: "Seeming",
      level: 5,
      school: "Illusion",
      castingTime: "1 action",
      range: "30 feet",
      components: "V, S",
      duration: "8 hours",
      damage: "",
      save: "",
      attack: "",
      ritual: false,
      concentration: false,
      description: "This spell allows you to change the appearance of any number of creatures that you can see within range. You give each target you choose a new, illusory appearance. An unwilling target can make a Charisma saving throw, and if it succeeds, it is unaffected by this spell. The spell disguises physical appearance as well as clothing, armor, weapons, and equipment. You can make each creature seem 1 foot shorter or taller and appear thin, fat, or in between. You can't change a target's body type, so you must choose a form that has the same basic arrangement of limbs. Otherwise, the extent of the illusion is up to you.",
      wikiLink: "https://dnd5e.wikidot.com/spell:seeming"
    },
    {
      name: "Skill Empowerment",
      level: 5,
      school: "Transmutation",
      castingTime: "1 action",
      range: "Touch",
      components: "V, S",
      duration: "Concentration, up to 1 hour",
      damage: "",
      save: "",
      attack: "",
      ritual: false,
      concentration: true,
      description: "Your magic deepens a creature's understanding of its own talent. You touch one willing creature and give it expertise in one skill of your choice; until the spell ends, the creature doubles its proficiency bonus for ability checks it makes that use the chosen skill. You must choose a skill in which the target is proficient and that isn't already benefiting from an effect, such as Expertise, that doubles its proficiency bonus.",
      wikiLink: "https://dnd5e.wikidot.com/spell:skill-empowerment"
    },
    {
      name: "Telekinesis",
      level: 5,
      school: "Transmutation",
      castingTime: "1 action",
      range: "60 feet",
      components: "V, S",
      duration: "Concentration, up to 10 minutes",
      damage: "",
      save: "Strength save",
      attack: "",
      ritual: false,
      concentration: true,
      description: "You gain the ability to move or manipulate creatures or objects by thought. When you cast the spell, and as your action each round for the duration, you can exert your will on one creature or object that you can see within range, causing the appropriate effect below. You can affect the same target round after round, or choose a new one at any time. If you switch targets, the prior target is no longer affected by the spell.",
      wikiLink: "https://dnd5e.wikidot.com/spell:telekinesis"
    },
    {
      name: "Teleportation Circle",
      level: 5,
      school: "Conjuration",
      castingTime: "1 minute",
      range: "10 feet",
      components: "V, M",
      duration: "1 round",
      damage: "",
      save: "",
      attack: "",
      ritual: false,
      concentration: false,
      description: "As you cast the spell, you draw a 10-foot-diameter circle on the ground inscribed with sigils that link your location to a permanent teleportation circle of your choice whose sigil sequence you know and that is on the same plane of existence as you. A shimmering portal opens within the circle you drew and remains open until the end of your next turn. Any creature that enters the portal instantly appears within 5 feet of the destination circle or in the nearest unoccupied space if that space is occupied.",
      wikiLink: "https://dnd5e.wikidot.com/spell:teleportation-circle"
    },
    {
      name: "Transmute Rock",
      level: 5,
      school: "Transmutation",
      castingTime: "1 action",
      range: "120 feet",
      components: "V, S, M",
      duration: "Until dispelled",
      damage: "",
      save: "",
      attack: "",
      ritual: false,
      concentration: false,
      description: "You choose an area of stone or mud that you can see that fits within a 40-foot cube and that is within range, and choose one of the following effects.",
      wikiLink: "https://dnd5e.wikidot.com/spell:transmute-rock"
    },
    {
      name: "Tree Stride",
      level: 5,
      school: "Conjuration",
      castingTime: "1 action",
      range: "Self",
      components: "V, S",
      duration: "Concentration, up to 1 minute",
      damage: "",
      save: "",
      attack: "",
      ritual: false,
      concentration: true,
      description: "You gain the ability to enter a tree and move from inside it to inside another tree of the same kind within 500 feet. Both trees must be living and at least the same size as you. You must use 5 feet of movement to enter a tree. You instantly know the location of all other trees of the same kind within 500 feet and, as part of the move used to enter the tree, can either pass into one of those trees or step out of the tree you're in. You appear in a spot of your choice within 5 feet of the destination tree, using another 5 feet of movement. If you have no movement left, you appear within 5 feet of the tree you entered.",
      wikiLink: "https://dnd5e.wikidot.com/spell:tree-stride"
    },
    {
      name: "Wall of Force",
      level: 5,
      school: "Evocation",
      castingTime: "1 action",
      range: "120 feet",
      components: "V, S, M",
      duration: "Concentration, up to 10 minutes",
      damage: "",
      save: "",
      attack: "",
      ritual: false,
      concentration: true,
      description: "An invisible wall of force springs into existence at a point you choose within range. The wall appears in any orientation you choose, as a horizontal or vertical barrier or at an angle. It can be free floating or resting on a solid surface. You can form it into a hemispherical dome or a sphere with a radius of up to 10 feet, or you can shape a flat surface made up of ten 10-foot-by-10-foot panels. Each panel must be contiguous with another panel. In any form, the wall is 1/4 inch thick. It lasts for the duration. If the wall cuts through a creature's space when it appears, the creature is pushed to one side of the wall (your choice which side).",
      wikiLink: "https://dnd5e.wikidot.com/spell:wall-of-force"
    },
    {
      name: "Wall of Stone",
      level: 5,
      school: "Evocation",
      castingTime: "1 action",
      range: "120 feet",
      components: "V, S, M",
      duration: "10 minutes",
      damage: "",
      save: "",
      attack: "",
      ritual: false,
      concentration: false,
      description: "A nonmagical wall of solid stone springs into existence at a point you choose within range. The wall is 6 inches thick and is composed of ten 10-foot-by-10-foot panels. Each panel must be contiguous with at least one other panel. Alternatively, you can create 10-foot-by-20-foot panels that are only 3 inches thick. If the wall cuts through a creature's space when it appears, the creature is pushed to one side of the wall (your choice). If a creature would be surrounded on all sides by the wall (or the wall and another solid surface), that creature can make a Dexterity saving throw. On a success, it can use its reaction to move up to its speed so that it is no longer enclosed by the wall.",
      wikiLink: "https://dnd5e.wikidot.com/spell:wall-of-stone"
    },
    {
      name: "Arcane Gate",
      level: 6,
      school: "Conjuration",
      castingTime: "1 action",
      range: "500 feet",
      components: "V, S",
      duration: "Concentration, up to 10 minutes",
      damage: "",
      save: "",
      attack: "",
      ritual: false,
      concentration: true,
      description: "You create linked teleportation portals that remain open for the duration. Choose two points on the ground that you can see, one point within 10 feet of you and one point within 500 feet of you. A circular portal, 10 feet in diameter, opens over each point. If the portal would open in the space occupied by a creature, the spell fails, and the casting is wasted.",
      wikiLink: "https://dnd5e.wikidot.com/spell:arcane-gate"
    },
    {
      name: "Blade Barrier",
      level: 6,
      school: "Evocation",
      castingTime: "1 action",
      range: "90 feet",
      components: "V, S",
      duration: "Concentration, up to 10 minutes",
      damage: "6d10 slashing damage",
      save: "Dexterity save",
      attack: "",
      ritual: false,
      concentration: true,
      description: "You create a vertical wall of whirling, razor-sharp blades made of magical energy. The wall appears within range and lasts for the duration. You can make a straight wall up to 100 feet long, 20 feet high, and 5 feet thick, or a ringed wall up to 60 feet in diameter, 20 feet high, and 5 feet thick. The wall provides three-quarters cover to creatures behind it, and its space is difficult terrain.",
      wikiLink: "https://dnd5e.wikidot.com/spell:blade-barrier"
    },
    {
      name: "Bones of the Earth",
      level: 6,
      school: "Transmutation",
      castingTime: "1 action",
      range: "120 feet",
      components: "V, S",
      duration: "Instantaneous",
      damage: "4d6 bludgeoning damage",
      save: "Dexterity save",
      attack: "",
      ritual: false,
      concentration: false,
      description: "You cause up to six pillars of stone to burst from places on the ground that you can see within range. Each pillar is a cylinder that has a diameter of 5 feet and a height of up to 30 feet. The ground where a pillar appears must be wide enough for its diameter, and you can target the ground under a creature if that creature is Medium or smaller. Each pillar has AC 5 and 30 hit points. When reduced to 0 hit points, a pillar crumbles into rubble, which creates an area of difficult terrain with a 10-foot radius. The rubble lasts until cleared.",
      wikiLink: "https://dnd5e.wikidot.com/spell:bones-of-the-earth"
    },
    {
      name: "Chain Lightning",
      level: 6,
      school: "Evocation",
      castingTime: "1 action",
      range: "150 feet",
      components: "V, S, M",
      duration: "Instantaneous",
      damage: "10d8 lightning damage",
      save: "Dexterity save",
      attack: "",
      ritual: false,
      concentration: false,
      description: "You create a bolt of lightning that arcs toward a target of your choice that you can see within range. Three bolts then leap from that target to as many as three other targets, each of which must be within 30 feet of the first target. A target can be a creature or an object and can be targeted by only one of the bolts. A target must make a Dexterity saving throw. The target takes 10d8 lightning damage on a failed save, or half as much damage on a successful one.",
      wikiLink: "https://dnd5e.wikidot.com/spell:chain-lightning"
    },
    {
      name: "Circle of Death",
      level: 6,
      school: "Necromancy",
      castingTime: "1 action",
      range: "150 feet",
      components: "V, S, M",
      duration: "Instantaneous",
      damage: "8d6 necrotic damage",
      save: "Constitution save",
      attack: "",
      ritual: false,
      concentration: false,
      description: "A sphere of negative energy ripples out in a 60-foot-radius sphere centered on a point within range. Each creature in that area must make a Constitution saving throw. A target takes 8d6 necrotic damage on a failed save, or half as much damage on a successful one.",
      wikiLink: "https://dnd5e.wikidot.com/spell:circle-of-death"
    },
    {
      name: "Conjure Fey",
      level: 6,
      school: "Conjuration",
      castingTime: "1 minute",
      range: "90 feet",
      components: "V, S, M",
      duration: "Concentration, up to 1 hour",
      damage: "",
      save: "",
      attack: "",
      ritual: false,
      concentration: true,
      description: "You summon a fey creature of challenge rating 6 or lower, or a fey spirit that takes the form of a beast of challenge rating 6 or lower. It appears in an unoccupied space that you can see within range. The fey creature disappears when it drops to 0 hit points or when the spell ends. The fey creature is friendly to you and your companions for the duration. Roll initiative for the summoned creature, which has its own turns. It obeys any verbal commands that you issue to it (no action required by you). If you don't issue any commands to the fey creature, it defends itself from hostile creatures but otherwise takes no actions.",
      wikiLink: "https://dnd5e.wikidot.com/spell:conjure-fey"
    },
    {
      name: "Contingency",
      level: 6,
      school: "Evocation",
      castingTime: "10 minutes",
      range: "Self",
      components: "V, S, M",
      duration: "10 days",
      damage: "",
      save: "",
      attack: "",
      ritual: false,
      concentration: false,
      description: "Choose a spell of 5th level or lower that you can cast, that has a casting time of 1 action, and that can target you. You cast that spell—called the contingent spell—as part of casting contingency, expending spell slots for both, but the contingent spell doesn't come into effect. Instead, it takes effect when a certain circumstance occurs. You describe that circumstance when you cast the two spells. For example, a contingency cast with water breathing might stipulate that water breathing comes into effect when you are engulfed in water or a similar liquid.",
      wikiLink: "https://dnd5e.wikidot.com/spell:contingency"
    },
    {
      name: "Create Undead",
      level: 6,
      school: "Necromancy",
      castingTime: "1 minute",
      range: "10 feet",
      components: "V, S, M",
      duration: "Instantaneous",
      damage: "",
      save: "",
      attack: "",
      ritual: false,
      concentration: false,
      description: "You can cast this spell only at night. Choose up to three corpses of Medium or Small humanoids within range. Each target becomes a ghoul under your control. (The DM has game statistics for these creatures.) As a bonus action on each of your turns, you can mentally command any creature you animated with this spell if the creature is within 120 feet of you (if you control multiple creatures, you can command any or all of them at the same time, issuing the same command to each one). You decide what action the creature will take and where it will move during its next turn, or you can issue a general command, such as to guard a particular chamber or corridor.",
      wikiLink: "https://dnd5e.wikidot.com/spell:create-undead"
    },
    {
      name: "Disintegrate",
      level: 6,
      school: "Transmutation",
      castingTime: "1 action",
      range: "60 feet",
      components: "V, S, M",
      duration: "Instantaneous",
      damage: "10d6 + 40 force damage",
      save: "Dexterity save",
      attack: "",
      ritual: false,
      concentration: false,
      description: "A thin green ray springs from your pointing finger to a target that you can see within range. The target can be a creature, an object, or a creation of magical force, such as the wall created by wall of force. A creature targeted by this spell must make a Dexterity saving throw. On a failed save, the target takes 10d6 + 40 force damage. If this damage reduces the target to 0 hit points, it is disintegrated.",
      wikiLink: "https://dnd5e.wikidot.com/spell:disintegrate"
    },
    {
      name: "Drawmij's Instant Summons",
      level: 6,
      school: "Conjuration",
      castingTime: "1 minute",
      range: "Touch",
      components: "V, S, M",
      duration: "Until dispelled",
      damage: "",
      save: "",
      attack: "",
      ritual: true,
      concentration: false,
      description: "You touch an object weighing 10 pounds or less whose longest dimension is 6 feet or less. The spell leaves an invisible mark on its surface and invisibly inscribes the name of the item on the sapphire you use as the material component. Each time you cast this spell, you must use a different sapphire. At any time thereafter, you can use your action to speak the item's name and crush the sapphire. The item instantly appears in your hand regardless of physical or planar distances, and the spell ends. If another creature is holding or carrying the item, crushing the sapphire doesn't transport the item to you, but instead you learn who the creature possessing the item is and roughly where that creature is located at that moment.",
      wikiLink: "https://dnd5e.wikidot.com/spell:drawmijs-instant-summons"
    },
    {
      name: "Eyebite",
      level: 6,
      school: "Necromancy",
      castingTime: "1 action",
      range: "Self",
      components: "V, S",
      duration: "Concentration, up to 1 minute",
      damage: "",
      save: "Wisdom save",
      attack: "",
      ritual: false,
      concentration: true,
      description: "For the spell's duration, your eyes become an inky void imbued with dread power. One creature of your choice within 60 feet of you that you can see must succeed on a Wisdom saving throw or be affected by one of the following effects of your choice for the duration. On each of your turns until the spell ends, you can use your action to target another creature but can't target a creature again if it has succeeded on a saving throw against this casting of eyebite.",
      wikiLink: "https://dnd5e.wikidot.com/spell:eyebite"
    },
    {
      name: "Find the Path",
      level: 6,
      school: "Divination",
      castingTime: "1 minute",
      range: "Self",
      components: "V, S, M",
      duration: "Concentration, up to 1 day",
      damage: "",
      save: "",
      attack: "",
      ritual: false,
      concentration: true,
      description: "This spell allows you to find the shortest, most direct physical route to a specific fixed location that you are familiar with on the same plane of existence. If you name a destination on another plane of existence, a destination that moves (such as a mobile fortress), or a destination that isn't specific (such as 'a green dragon's lair'), the spell fails. For the duration, as long as you are on the same plane of existence as the destination, you know how far it is and in what direction it lies. While you are traveling there, whenever you are presented with a choice of paths along the way, you automatically determine which path is the shortest and most direct route (but not necessarily the safest route) to the destination.",
      wikiLink: "https://dnd5e.wikidot.com/spell:find-the-path"
    },
    {
      name: "Flesh to Stone",
      level: 6,
      school: "Transmutation",
      castingTime: "1 action",
      range: "60 feet",
      components: "V, S, M",
      duration: "Concentration, up to 1 minute",
      damage: "",
      save: "Constitution save",
      attack: "",
      ritual: false,
      concentration: true,
      description: "You attempt to turn one creature that you can see within range into stone. If the target's body is made of flesh, the creature must make a Constitution saving throw. On a failed save, it is restrained as its flesh begins to harden. On a successful save, the creature isn't affected. A creature restrained by this spell must make another Constitution saving throw at the end of each of its turns. If it successfully saves against this spell three times, the spell ends. If it fails its saves three times, it is turned to stone and subjected to the petrified condition for the duration. The successes and failures don't need to be consecutive; keep track of both until the target collects three of a kind.",
      wikiLink: "https://dnd5e.wikidot.com/spell:flesh-to-stone"
    },
    {
      name: "Forbiddance",
      level: 6,
      school: "Abjuration",
      castingTime: "10 minutes",
      range: "Touch",
      components: "V, S, M",
      duration: "1 day",
      damage: "5d10 radiant damage",
      save: "",
      attack: "",
      ritual: true,
      concentration: false,
      description: "You create a ward against magical travel that protects up to 40,000 square feet of floor space to a height of 30 feet above the floor. For the duration, creatures can't teleport into the area or use portals, such as those created by the gate spell, to enter the area. The spell proofs the area against planar travel, and therefore prevents creatures from accessing the area by way of the Astral Plane, Ethereal Plane, Feywild, Shadowfell, or the plane shift spell. In addition, the spell damages types of creatures that you choose when you cast it. Choose one or more of the following: celestials, elementals, fey, fiends, and undead. When a chosen creature enters the spell's area for the first time on a turn or starts its turn there, the creature takes 5d10 radiant or necrotic damage (your choice when you cast this spell).",
      wikiLink: "https://dnd5e.wikidot.com/spell:forbiddance"
    },
    {
      name: "Globe of Invulnerability",
      level: 6,
      school: "Abjuration",
      castingTime: "1 action",
      range: "Self (10-foot radius)",
      components: "V, S, M",
      duration: "Concentration, up to 1 minute",
      damage: "",
      save: "",
      attack: "",
      ritual: false,
      concentration: true,
      description: "An immobile, faintly shimmering barrier springs into existence in a 10-foot radius around you and remains for the duration. Any spell of 5th level or lower cast from outside the barrier can't affect creatures or objects within it, even if the spell is cast using a higher level spell slot. Such a spell can target creatures and objects within the barrier, but the spell has no effect on them. Similarly, the area within the barrier is excluded from the areas affected by such spells.",
      wikiLink: "https://dnd5e.wikidot.com/spell:globe-of-invulnerability"
    },
    {
      name: "Guards and Wards",
      level: 6,
      school: "Abjuration",
      castingTime: "10 minutes",
      range: "Touch",
      components: "V, S, M",
      duration: "24 hours",
      damage: "",
      save: "",
      attack: "",
      ritual: false,
      concentration: false,
      description: "You create a ward that protects up to 2,500 square feet of floor space (an area 50 feet square, or one hundred 5-foot squares or twenty-five 10-foot squares). The warded area can be up to 20 feet tall, and shaped as you desire. You can ward several stories of a stronghold by dividing the area among them, as long as you can walk into each contiguous area while you are casting the spell. When you cast this spell, you can specify individuals that are unaffected by any or all of the effects that you choose. You can also specify a password that, when spoken aloud, makes the speaker immune to these effects.",
      wikiLink: "https://dnd5e.wikidot.com/spell:guards-and-wards"
    },
    {
      name: "Harm",
      level: 6,
      school: "Necromancy",
      castingTime: "1 action",
      range: "60 feet",
      components: "V, S",
      duration: "Instantaneous",
      damage: "14d6 necrotic damage",
      save: "Constitution save",
      attack: "",
      ritual: false,
      concentration: false,
      description: "You unleash a virulent disease on a creature that you can see within range. The target must make a Constitution saving throw. On a failed save, it takes 14d6 necrotic damage, or half as much damage on a successful save. The damage can't reduce the target's hit points below 1. If the target fails the saving throw, its hit point maximum is reduced for 1 hour by an amount equal to the necrotic damage it took. Any effect that removes a disease allows a creature's hit point maximum to return to normal before that time passes.",
      wikiLink: "https://dnd5e.wikidot.com/spell:harm"
    },
    {
      name: "Heal",
      level: 6,
      school: "Evocation",
      castingTime: "1 action",
      range: "60 feet",
      components: "V, S",
      duration: "Instantaneous",
      damage: "",
      save: "",
      attack: "",
      ritual: false,
      concentration: false,
      description: "Choose a creature that you can see within range. A surge of positive energy washes through the creature, causing it to regain 70 hit points. This spell also ends blindness, deafness, and any diseases affecting the target. This spell has no effect on constructs or undead.",
      wikiLink: "https://dnd5e.wikidot.com/spell:heal"
    },
    {
      name: "Heroes' Feast",
      level: 6,
      school: "Conjuration",
      castingTime: "10 minutes",
      range: "30 feet",
      components: "V, S, M",
      duration: "Instantaneous",
      damage: "",
      save: "",
      attack: "",
      ritual: false,
      concentration: false,
      description: "You bring forth a great feast, including magnificent food and drink. The feast takes 1 hour to consume and disappears at the end of that time, and the beneficial effects don't set in until this hour is over. Up to twelve other creatures can partake of the feast. A creature that partakes of the feast gains several benefits. The creature is cured of all diseases and poison, becomes immune to poison and being frightened, and makes all Wisdom saving throws with advantage. Its hit point maximum also increases by 2d10, and it gains the same number of hit points. These benefits last for 24 hours.",
      wikiLink: "https://dnd5e.wikidot.com/spell:heroes-feast"
    },
    {
      name: "Investiture of Flame",
      level: 6,
      school: "Transmutation",
      castingTime: "1 action",
      range: "Self",
      components: "V, S",
      duration: "Concentration, up to 10 minutes",
      damage: "2d6 fire damage",
      save: "",
      attack: "",
      ritual: false,
      concentration: true,
      description: "Flames race across your body, shedding bright light in a 30-foot radius and dim light for an additional 30 feet for the spell's duration. The flames don't harm you. Until the spell ends, you gain the following benefits: You are immune to fire damage and have resistance to cold damage. Any creature that moves within 5 feet of you for the first time on a turn or ends its turn there takes 1d10 fire damage. You can use your action to create a line of fire 15 feet long and 5 feet wide extending from you in a direction you choose. Each creature in the line must make a Dexterity saving throw. A creature takes 4d8 fire damage on a failed save, or half as much damage on a successful one.",
      wikiLink: "https://dnd5e.wikidot.com/spell:investiture-of-flame"
    },
    {
      name: "Investiture of Ice",
      level: 6,
      school: "Transmutation",
      castingTime: "1 action",
      range: "Self",
      components: "V, S",
      duration: "Concentration, up to 10 minutes",
      damage: "2d6 cold damage",
      save: "",
      attack: "",
      ritual: false,
      concentration: true,
      description: "Until the spell ends, ice rimes your body, and you gain the following benefits: You are immune to cold damage and have resistance to fire damage. You can move across difficult terrain created by ice or snow without spending extra movement. The ground in a 10-foot radius around you is icy and is difficult terrain for creatures other than you. The radius moves with you. You can use your action to create a 15-foot cone of freezing wind extending from your outstretched hand in a direction you choose. Each creature in the cone must make a Constitution saving throw. A creature takes 4d6 cold damage on a failed save, or half as much damage on a successful one. A creature that fails its save against this effect has its speed halved until the start of your next turn.",
      wikiLink: "https://dnd5e.wikidot.com/spell:investiture-of-ice"
    },
    {
      name: "Investiture of Stone",
      level: 6,
      school: "Transmutation",
      castingTime: "1 action",
      range: "Self",
      components: "V, S",
      duration: "Concentration, up to 10 minutes",
      damage: "",
      save: "",
      attack: "",
      ritual: false,
      concentration: true,
      description: "Until the spell ends, bits of rock spread across your body, and you gain the following benefits: You have resistance to bludgeoning, piercing, and slashing damage from nonmagical weapons. You can use your action to create a small earthquake on the ground in a 15-foot radius centered on you. Other creatures on that ground must succeed on a Strength saving throw or be knocked prone. You can move across difficult terrain made of earth or stone without spending extra movement. You can move through solid earth or stone as if it was air and without destabilizing it, but you can't end your movement there. If you do, you are ejected to the nearest unoccupied space, this spell ends, and you are stunned until the end of your next turn.",
      wikiLink: "https://dnd5e.wikidot.com/spell:investiture-of-stone"
    },
    {
      name: "Investiture of Wind",
      level: 6,
      school: "Transmutation",
      castingTime: "1 action",
      range: "Self",
      components: "V, S",
      duration: "Concentration, up to 10 minutes",
      damage: "2d6 bludgeoning damage",
      save: "",
      attack: "",
      ritual: false,
      concentration: true,
      description: "Until the spell ends, wind whirls around you, and you gain the following benefits: Ranged weapon attacks made against you have disadvantage on the attack roll. You gain a flying speed of 60 feet. If you are still flying when the spell ends, you fall, unless you can somehow prevent it. You can use your action to create a 15-foot cube of swirling wind centered on a point you can see within 60 feet of you. Each creature in that area must make a Constitution saving throw. A creature takes 2d6 bludgeoning damage on a failed save, or half as much damage on a successful one. If a Large or smaller creature fails the save, that creature is also pushed up to 10 feet away from the center of the cube.",
      wikiLink: "https://dnd5e.wikidot.com/spell:investiture-of-wind"
    },
    {
      name: "Magic Jar",
      level: 6,
      school: "Necromancy",
      castingTime: "1 minute",
      range: "Self",
      components: "V, S, M",
      duration: "Until dispelled",
      damage: "",
      save: "Charisma save",
      attack: "",
      ritual: false,
      concentration: false,
      description: "Your body falls into a catatonic state as your soul leaves it and enters the container you used for the spell's material component. While your soul inhabits the container, you are aware of your surroundings as if you were in the container's space. You can't move or use reactions. The only action you can take is to project your soul up to 100 feet out of the container, either returning to your living body (and ending the spell) or attempting to possess a humanoid's body.",
      wikiLink: "https://dnd5e.wikidot.com/spell:magic-jar"
    },
    {
      name: "Mass Suggestion",
      level: 6,
      school: "Enchantment",
      castingTime: "1 action",
      range: "60 feet",
      components: "V, M",
      duration: "24 hours",
      damage: "",
      save: "Wisdom save",
      attack: "",
      ritual: false,
      concentration: false,
      description: "You suggest a course of activity (limited to a sentence or two) and magically influence up to twelve creatures of your choice that you can see within range and that can hear and understand you. Creatures that can't be charmed are immune to this effect. The suggestion must be worded in such a manner as to make the course of action sound reasonable. Asking the creature to stab itself, throw itself onto a spear, immolate itself, or do some other obviously harmful act automatically negates the effect of the spell. Each target must make a Wisdom saving throw. On a failed save, it pursues the course of action you described to the best of its ability. The suggested course of action can continue for the entire duration. If the suggested activity can be completed in a shorter time, the spell ends when the subject finishes what it was asked to do.",
      wikiLink: "https://dnd5e.wikidot.com/spell:mass-suggestion"
    },
    {
      name: "Move Earth",
      level: 6,
      school: "Transmutation",
      castingTime: "1 action",
      range: "120 feet",
      components: "V, S, M",
      duration: "Concentration, up to 2 hours",
      damage: "",
      save: "",
      attack: "",
      ritual: false,
      concentration: true,
      description: "Choose an area of terrain no larger than 40 feet on a side within range. You can reshape dirt, sand, or clay in the area in any manner you choose for the duration. You can raise or lower the area's elevation, create or fill in a trench, erect or flatten a wall, or form a pillar. The extent of any such changes can't exceed half the area's largest dimension. So, if you affect a 40-foot square, you can create a pillar up to 20 feet high, raise or lower the square's elevation by up to 20 feet, dig a trench up to 20 feet deep, and so on. It takes 10 minutes for these changes to complete. At the end of every 10 minutes you spend concentrating on the spell, you can choose a new area of terrain to affect.",
      wikiLink: "https://dnd5e.wikidot.com/spell:move-earth"
    },
    {
      name: "Otiluke's Freezing Sphere",
      level: 6,
      school: "Evocation",
      castingTime: "1 action",
      range: "300 feet",
      components: "V, S, M",
      duration: "Instantaneous",
      damage: "10d6 cold damage",
      save: "Constitution save",
      attack: "",
      ritual: false,
      concentration: false,
      description: "A frigid globe of cold energy streaks from your fingertips to a point of your choice within range, where it explodes in a 60-foot-radius sphere. Each creature within the area must make a Constitution saving throw. On a failed save, a creature takes 10d6 cold damage. On a successful save, it takes half as much damage. If the globe strikes a body of water or a liquid that is principally water (not including water-based creatures), it freezes the liquid to a depth of 6 inches over an area 30 feet square. This ice lasts for 1 minute. Creatures that were swimming on the surface of frozen water are trapped in the ice. A trapped creature can use an action to make a Strength check against your spell save DC to free itself.",
      wikiLink: "https://dnd5e.wikidot.com/spell:otilukes-freezing-sphere"
    },
    {
      name: "Otto's Irresistible Dance",
      level: 6,
      school: "Enchantment",
      castingTime: "1 action",
      range: "30 feet",
      components: "V",
      duration: "Concentration, up to 1 minute",
      damage: "",
      save: "Wisdom save",
      attack: "",
      ritual: false,
      concentration: true,
      description: "Choose one creature that you can see within range. The target begins a comic dance in place: shuffling, tapping its feet, and capering for the duration. Creatures that can't be charmed are immune to this spell. A dancing creature must use all its movement to dance without leaving its space and has disadvantage on Dexterity saving throws and attack rolls. While the target is affected by this spell, other creatures have advantage on attack rolls against it. As an action, a dancing creature makes a Wisdom saving throw to regain control of itself. On a successful save, the spell ends.",
      wikiLink: "https://dnd5e.wikidot.com/spell:ottos-irresistible-dance"
    },
    {
      name: "Planar Ally",
      level: 6,
      school: "Conjuration",
      castingTime: "10 minutes",
      range: "60 feet",
      components: "V, S",
      duration: "Instantaneous",
      damage: "",
      save: "",
      attack: "",
      ritual: false,
      concentration: false,
      description: "You beseech an otherworldly entity for aid. The being must be known to you: a god, a primordial, a demon prince, or some other being of cosmic power. That entity sends a celestial, an elemental, or a fiend loyal to it to aid you, making the creature appear in an unoccupied space within range. If you know a specific creature's name, you can speak that name when you cast this spell to request that creature, though you might get a different creature anyway (DM's choice).",
      wikiLink: "https://dnd5e.wikidot.com/spell:planar-ally"
    },
    {
      name: "Programmed Illusion",
      level: 6,
      school: "Illusion",
      castingTime: "1 action",
      range: "120 feet",
      components: "V, S, M",
      duration: "Until dispelled",
      damage: "",
      save: "",
      attack: "",
      ritual: false,
      concentration: false,
      description: "You create an illusion of an object, a creature, or some other visible phenomenon within range that activates when a specific condition occurs. The illusion is imperceptible until then. It must be no larger than a 30-foot cube, and you decide when you cast the spell how the illusion behaves and what sounds it makes. This scripted performance can last up to 5 minutes. When the condition you specify occurs, the illusion springs into existence and performs in the manner you described. Once the illusion finishes performing, it disappears and remains dormant for 10 minutes. After this time, the illusion can be activated again.",
      wikiLink: "https://dnd5e.wikidot.com/spell:programmed-illusion"
    },
    {
      name: "Sunbeam",
      level: 6,
      school: "Evocation",
      castingTime: "1 action",
      range: "Self (60-foot line)",
      components: "V, S, M",
      duration: "Concentration, up to 1 minute",
      damage: "6d8 radiant damage",
      save: "Constitution save",
      attack: "",
      ritual: false,
      concentration: true,
      description: "A beam of brilliant light flashes out from your hand in a 5-foot-wide, 60-foot-long line. Each creature in the line must make a Constitution saving throw. On a failed save, a creature takes 6d8 radiant damage and is blinded until your next turn. On a successful save, it takes half as much damage and isn't blinded by this spell. Undead and oozes have disadvantage on this saving throw. You can create a new line of radiance as your action on any turn until the spell ends. For the duration, a mote of brilliant radiance shines in your hand. It sheds bright light in a 30-foot radius and dim light for an additional 30 feet. The light is sunlight.",
      wikiLink: "https://dnd5e.wikidot.com/spell:sunbeam"
    },
    {
      name: "Transport via Plants",
      level: 6,
      school: "Conjuration",
      castingTime: "1 action",
      range: "10 feet",
      components: "V, S",
      duration: "1 round",
      damage: "",
      save: "",
      attack: "",
      ritual: false,
      concentration: false,
      description: "This spell creates a magical link between a Large or larger inanimate plant within range and another plant, at any distance, on the same plane of existence. You must have seen or touched the destination plant at least once before. For the duration, any creature can step into the target plant and exit from the destination plant by using 5 feet of movement.",
      wikiLink: "https://dnd5e.wikidot.com/spell:transport-via-plants"
    },
    {
      name: "True Seeing",
      level: 6,
      school: "Divination",
      castingTime: "1 action",
      range: "Touch",
      components: "V, S, M",
      duration: "1 hour",
      damage: "",
      save: "",
      attack: "",
      ritual: false,
      concentration: false,
      description: "This spell gives the willing creature you touch the ability to see things as they actually are. For the duration, the creature has truesight, notices secret doors hidden by magic, and can see into the Ethereal Plane, all out to a range of 120 feet.",
      wikiLink: "https://dnd5e.wikidot.com/spell:true-seeing"
    },
    {
      name: "Wall of Ice",
      level: 6,
      school: "Evocation",
      castingTime: "1 action",
      range: "120 feet",
      components: "V, S, M",
      duration: "Concentration, up to 10 minutes",
      damage: "10d6 cold damage",
      save: "Dexterity save",
      attack: "",
      ritual: false,
      concentration: true,
      description: "You create a wall of ice on a solid surface within range. You can form it into a hemispherical dome or a sphere with a radius of up to 10 feet, or you can shape a flat surface made up of ten 10-foot-by-10-foot panels. Each panel must be contiguous with another panel. In any form, the wall is 1 foot thick and lasts for the duration. If the wall cuts through a creature's space when it appears, the creature within its area is pushed to one side of the wall and must make a Dexterity saving throw. On a failed save, the creature takes 10d6 cold damage, or half as much damage on a successful save. The wall is an object that can be damaged and thus breached. It has AC 12 and 30 hit points per 10-foot section, and it is vulnerable to fire damage. Reducing a 10-foot section of wall to 0 hit points destroys it and leaves behind a sheet of frigid air in the space the wall occupied. Until the end of your next turn, when a creature enters the sheet's space for the first time on a turn or starts its turn there, the creature takes 5d6 cold damage.",
      wikiLink: "https://dnd5e.wikidot.com/spell:wall-of-ice"
    },
    {
      name: "Wall of Thorns",
      level: 6,
      school: "Conjuration",
      castingTime: "1 action",
      range: "120 feet",
      components: "V, S, M",
      duration: "Concentration, up to 10 minutes",
      damage: "7d8 piercing damage",
      save: "Dexterity save",
      attack: "",
      ritual: false,
      concentration: true,
      description: "You create a wall of tough, pliable, tangled brush bristling with needle-sharp thorns. The wall appears within range on a solid surface and lasts for the duration. You choose to make the wall up to 60 feet long, 10 feet high, and 5 feet thick or a circle that has a 20-foot diameter and is up to 20 feet high and 5 feet thick. The wall blocks line of sight. When the wall appears, each creature within its area takes 7d8 piercing damage, or half as much damage on a successful Dexterity saving throw. A creature can move through the wall, albeit slowly and painfully. For every 1 foot a creature moves through the wall, it must spend 4 feet of movement. Furthermore, the first time a creature enters the wall on a turn or ends its turn there, the creature takes 7d8 piercing damage, or half as much damage on a successful Dexterity saving throw.",
      wikiLink: "https://dnd5e.wikidot.com/spell:wall-of-thorns"
    },
    {
      name: "Wind Walk",
      level: 6,
      school: "Transmutation",
      castingTime: "1 minute",
      range: "30 feet",
      components: "V, S, M",
      duration: "8 hours",
      damage: "",
      save: "",
      attack: "",
      ritual: false,
      concentration: false,
      description: "You and up to ten willing creatures you can see within range assume a gaseous form for the duration, appearing as wisps of cloud. While in this cloud form, a creature has a flying speed of 300 feet and has resistance to damage from nonmagical weapons. The only actions a creature can take in this form are the Dash action or to revert to its normal form. Reverting takes 1 minute, during which time a creature is incapacitated and can't move. Until the spell ends, a creature can revert to cloud form, which also requires the 1-minute transformation. If a creature is in cloud form and flying when the effect ends, the creature descends 60 feet per round for 1 minute until it lands, which it does safely. If it can't land after 1 minute, the creature falls the remaining distance.",
      wikiLink: "https://dnd5e.wikidot.com/spell:wind-walk"
    },
    {
      name: "Conjure Celestial",
      level: 7,
      school: "Conjuration",
      castingTime: "1 minute",
      range: "90 feet",
      components: "V, S",
      duration: "Concentration, up to 1 hour",
      damage: "",
      save: "",
      attack: "",
      ritual: false,
      concentration: true,
      description: "You summon a celestial of challenge rating 4 or lower, which appears in an unoccupied space that you can see within range. The celestial disappears when it drops to 0 hit points or when the spell ends. The celestial is friendly to you and your companions for the duration. Roll initiative for the summoned celestial, which has its own turns. It obeys any verbal commands that you issue to it (no action required by you). If you don't issue any commands to the celestial, it defends itself from hostile creatures but otherwise takes no actions.",
      wikiLink: "https://dnd5e.wikidot.com/spell:conjure-celestial"
    },
    {
      name: "Delayed Blast Fireball",
      level: 7,
      school: "Evocation",
      castingTime: "1 action",
      range: "150 feet",
      components: "V, S, M",
      duration: "Concentration, up to 1 minute",
      damage: "12d6 fire damage",
      save: "Dexterity save",
      attack: "",
      ritual: false,
      concentration: true,
      description: "A beam of yellow light flashes from your pointing finger, then condenses to linger as a glowing bead for the duration. When the spell ends, either because your concentration is broken or because you decide to end it, the bead blossoms with a low roar into an explosion of flame that spreads around corners. Each creature in a 20-foot-radius sphere centered on that point must make a Dexterity saving throw. A creature takes fire damage equal to the total accumulated damage on a failed save, or half as much damage on a successful one.",
      wikiLink: "https://dnd5e.wikidot.com/spell:delayed-blast-fireball"
    },
    {
      name: "Divine Word",
      level: 7,
      school: "Evocation",
      castingTime: "1 bonus action",
      range: "30 feet",
      components: "V",
      duration: "Instantaneous",
      damage: "",
      save: "Charisma save",
      attack: "",
      ritual: false,
      concentration: false,
      description: "You utter a divine word, imbued with the power that shaped the world at the dawn of creation. Choose any number of creatures you can see within range. Each creature that can hear you must make a Charisma saving throw. On a failed save, a creature suffers an effect based on its current hit points: 50 hit points or fewer: deafened for 1 minute, 40 hit points or fewer: deafened and blinded for 10 minutes, 30 hit points or fewer: blinded, deafened, and stunned for 1 hour, 20 hit points or fewer: killed instantly.",
      wikiLink: "https://dnd5e.wikidot.com/spell:divine-word"
    },
    {
      name: "Etherealness",
      level: 7,
      school: "Transmutation",
      castingTime: "1 action",
      range: "Self",
      components: "V, S",
      duration: "Up to 8 hours",
      damage: "",
      save: "",
      attack: "",
      ritual: false,
      concentration: false,
      description: "You step into the border regions of the Ethereal Plane, in the area where it overlaps with your current plane. You remain in the Border Ethereal for the duration or until you use your action to dismiss the spell. During this time, you can move in any direction. If you move up or down, every foot of movement costs an extra foot. You can see and hear the plane you originated from, but everything there looks gray, and you can't see anything more than 60 feet away.",
      wikiLink: "https://dnd5e.wikidot.com/spell:etherealness"
    },
    {
      name: "Finger of Death",
      level: 7,
      school: "Necromancy",
      castingTime: "1 action",
      range: "60 feet",
      components: "V, S",
      duration: "Instantaneous",
      damage: "7d8 + 30 necrotic damage",
      save: "Constitution save",
      attack: "",
      ritual: false,
      concentration: false,
      description: "You send negative energy coursing through a creature that you can see within range, causing it searing pain. The target must make a Constitution saving throw. It takes 7d8 + 30 necrotic damage on a failed save, or half as much damage on a successful one. A humanoid killed by this spell rises at the start of your next turn as a zombie that is permanently under your command, following your verbal orders to the best of its ability.",
      wikiLink: "https://dnd5e.wikidot.com/spell:finger-of-death"
    },
    {
      name: "Fire Storm",
      level: 7,
      school: "Evocation",
      castingTime: "1 action",
      range: "150 feet",
      components: "V, S",
      duration: "Instantaneous",
      damage: "7d10 fire damage",
      save: "Dexterity save",
      attack: "",
      ritual: false,
      concentration: false,
      description: "A storm made up of sheets of roaring flame appears in a location you choose within range. The area of the storm consists of up to ten 10-foot cubes, which you can arrange as you wish. Each cube must have at least one face adjacent to the face of another cube. Each creature in the area must make a Dexterity saving throw. It takes 7d10 fire damage on a failed save, or half as much damage on a successful one. The fire damages objects in the area and ignites flammable objects that aren't being worn or carried.",
      wikiLink: "https://dnd5e.wikidot.com/spell:fire-storm"
    },
    {
      name: "Forcecage",
      level: 7,
      school: "Evocation",
      castingTime: "1 action",
      range: "100 feet",
      components: "V, S, M",
      duration: "1 hour",
      damage: "",
      save: "",
      attack: "",
      ritual: false,
      concentration: false,
      description: "An immobile, invisible, cube-shaped prison composed of magical force springs into existence around an area you choose within range. The prison can be a cage or a solid box, as you choose. A prison in the shape of a cage can be up to 20 feet on a side and is made from 1/2-inch diameter bars spaced 1/2 inch apart. A prison in the shape of a box can be up to 10 feet on a side, creating a solid barrier that prevents any matter from passing through it and blocking any spells cast into or out from the area.",
      wikiLink: "https://dnd5e.wikidot.com/spell:forcecage"
    },
    {
      name: "Mirage Arcane",
      level: 7,
      school: "Illusion",
      castingTime: "10 minutes",
      range: "Sight",
      components: "V, S",
      duration: "10 days",
      damage: "",
      save: "",
      attack: "",
      ritual: false,
      concentration: false,
      description: "You make terrain in an area up to 1 mile square look, sound, smell, and even feel like some other sort of terrain. The terrain's general shape remains the same, however. Open fields or a road could be made to resemble a swamp, hill, crevasse, or some other difficult or impassable terrain. A pond can be made to seem like a grassy meadow, a precipice like a gentle slope, or a rock-strewn gully like a wide and smooth road. Similarly, you can alter the appearance of structures, or add them where none are present. The spell doesn't disguise, conceal, or add creatures.",
      wikiLink: "https://dnd5e.wikidot.com/spell:mirage-arcane"
    },
    {
      name: "Mordenkainen's Magnificent Mansion",
      level: 7,
      school: "Conjuration",
      castingTime: "1 minute",
      range: "300 feet",
      components: "V, S, M",
      duration: "24 hours",
      damage: "",
      save: "",
      attack: "",
      ritual: false,
      concentration: false,
      description: "You conjure an extradimensional dwelling in range that lasts for the duration. You choose where its one entrance is located. The entrance shimmers faintly and is 5 feet wide and 10 feet tall. You and any creature you designate when you cast the spell can enter the extradimensional dwelling as long as the portal remains open. You can open or close the portal if you are within 30 feet of it. While closed, the portal is invisible. Beyond the portal is a magnificent foyer with numerous chambers beyond. The atmosphere is clean, fresh, and warm.",
      wikiLink: "https://dnd5e.wikidot.com/spell:mordenkainens-magnificent-mansion"
    },
    {
      name: "Mordenkainen's Sword",
      level: 7,
      school: "Evocation",
      castingTime: "1 action",
      range: "60 feet",
      components: "V, S, M",
      duration: "Concentration, up to 1 minute",
      damage: "3d10 force damage",
      save: "",
      attack: "Melee spell attack",
      ritual: false,
      concentration: true,
      description: "You create a sword-shaped plane of force that hovers within range. It lasts for the duration. When the sword appears, you make a melee spell attack against a target of your choice within 5 feet of the sword. On a hit, the target takes 3d10 force damage. Until the spell ends, you can use a bonus action on each of your turns to move the sword up to 20 feet to a spot you can see and repeat this attack against the same target or a different one.",
      wikiLink: "https://dnd5e.wikidot.com/spell:mordenkainens-sword"
    },
    {
      name: "Plane Shift",
      level: 7,
      school: "Conjuration",
      castingTime: "1 action",
      range: "Touch",
      components: "V, S, M",
      duration: "Instantaneous",
      damage: "",
      save: "Charisma save",
      attack: "",
      ritual: false,
      concentration: false,
      description: "You and up to eight willing creatures (or a single object) are transported to another plane of existence. You can specify a target destination in one of the following ways: by name (if you are familiar with the plane), by planar coordinates, or by the general description of the plane. If you are trying to reach the Elemental Plane of Fire, for example, you could say 'the Elemental Plane of Fire' or 'the Plane of Fire.' If you are familiar with a specific location on that plane, you can name that place, and the spell transports you there.",
      wikiLink: "https://dnd5e.wikidot.com/spell:plane-shift"
    },
    {
      name: "Prismatic Spray",
      level: 7,
      school: "Evocation",
      castingTime: "1 action",
      range: "Self (60-foot cone)",
      components: "V, S",
      duration: "Instantaneous",
      damage: "10d6 damage",
      save: "Dexterity save",
      attack: "",
      ritual: false,
      concentration: false,
      description: "Eight multicolored rays of light flash from your hand. Each ray is a different color and has a different power and purpose. Each creature in a 60-foot cone must make a Dexterity saving throw. For each target, roll a d8 to determine which color ray affects it. 1-Red: The target takes 10d6 fire damage on a failed save, or half as much damage on a successful one. 2-Orange: The target takes 10d6 acid damage on a failed save, or half as much damage on a successful one. 3-Yellow: The target takes 10d6 lightning damage on a failed save, or half as much damage on a successful one. 4-Green: The target takes 10d6 poison damage on a failed save, or half as much damage on a successful one. 5-Blue: The target takes 10d6 cold damage on a failed save, or half as much damage on a successful one. 6-Indigo: On a failed save, the target is restrained. It must then make a Constitution saving throw at the end of each of its turns. If it successfully saves three times, the spell ends. If it fails its save three times, it permanently turns to stone and is subjected to the petrified condition. The successes and failures don't need to be consecutive; keep track of both until the target collects three of a kind. 7-Violet: On a failed save, the target is blinded. It must then make a Wisdom saving throw at the start of your next turn. A successful save means the spell ends. If it fails that save, the creature is transported to another plane of existence of the DM's choosing and is no longer blinded. (Typically, a creature that is on a plane that isn't its home plane is banished home, while other creatures are usually cast into the Astral or Ethereal planes.) 8-Special: The target is struck by two rays. Roll twice more, rerolling any 8.",
      wikiLink: "https://dnd5e.wikidot.com/spell:prismatic-spray"
    },
    {
      name: "Project Image",
      level: 7,
      school: "Illusion",
      castingTime: "1 action",
      range: "500 miles",
      components: "V, S, M",
      duration: "Concentration, up to 1 day",
      damage: "",
      save: "",
      attack: "",
      ritual: false,
      concentration: true,
      description: "You create an illusory copy of yourself that lasts for the duration. The copy can appear at any location within range that you have seen before, regardless of intervening obstacles. The illusion looks and sounds like you but is intangible. If the illusion takes any damage, it disappears, and the spell ends. You can use your action to move this illusion up to twice your speed, and make it gesture, speak, and behave in whatever way you choose. It mimics your mannerisms perfectly. You can see through its eyes and hear through its ears as if you were located where it is. On each of your turns as a bonus action, you can switch from using its senses to using your own, or back again. While you are using its senses, you are blinded and deafened in regard to your own surroundings.",
      wikiLink: "https://dnd5e.wikidot.com/spell:project-image"
    },
    {
      name: "Regenerate",
      level: 7,
      school: "Transmutation",
      castingTime: "1 minute",
      range: "Touch",
      components: "V, S, M",
      duration: "1 hour",
      damage: "",
      save: "",
      attack: "",
      ritual: false,
      concentration: false,
      description: "You touch a creature and stimulate its natural healing ability. The target regains 4d8 + 15 hit points. For the duration of the spell, the target regains 1 hit point at the start of each of its turns (10 hit points each minute). The target's severed body members (fingers, legs, tails, and so on), if any, are restored after 2 minutes. If you have the severed part and hold it to the stump, the spell instantaneously causes the limb to knit to the stump.",
      wikiLink: "https://dnd5e.wikidot.com/spell:regenerate"
    },
    {
      name: "Resurrection",
      level: 7,
      school: "Necromancy",
      castingTime: "1 hour",
      range: "Touch",
      components: "V, S, M",
      duration: "Instantaneous",
      damage: "",
      save: "",
      attack: "",
      ritual: false,
      concentration: false,
      description: "You touch a dead creature that has been dead for no more than a century, that didn't die of old age, and that isn't undead. If its soul is free and willing, the target returns to life with all its hit points. This spell neutralizes any poisons and cures normal diseases afflicting the creature when it died. It doesn't, however, remove magical diseases, curses, and the like; if such effects aren't removed prior to casting the spell, they afflict the target on its return to life. This spell closes all mortal wounds and restores any missing body parts. Coming back from the dead is an ordeal. The target takes a -4 penalty to all attack rolls, saving throws, and ability checks. Every time the target finishes a long rest, the penalty is reduced by 1 until it disappears.",
      wikiLink: "https://dnd5e.wikidot.com/spell:resurrection"
    },
    {
      name: "Reverse Gravity",
      level: 7,
      school: "Transmutation",
      castingTime: "1 action",
      range: "100 feet",
      components: "V, S, M",
      duration: "Concentration, up to 1 minute",
      damage: "",
      save: "Dexterity save",
      attack: "",
      ritual: false,
      concentration: true,
      description: "This spell reverses gravity in a 50-foot-radius, 100-foot high cylinder centered on a point within range. All creatures and objects that aren't somehow anchored to the ground in the area fall upward and reach the top of the area when you cast this spell. A creature can make a Dexterity saving throw to grab onto a fixed object it can reach, thus avoiding the fall. If some solid object (such as a ceiling) is encountered in this fall, falling objects and creatures strike it just as they would during a normal downward fall. If an object or creature reaches the top of the area without striking anything, it remains there, oscillating slightly, for the duration.",
      wikiLink: "https://dnd5e.wikidot.com/spell:reverse-gravity"
    },
    {
      name: "Sequester",
      level: 7,
      school: "Transmutation",
      castingTime: "1 action",
      range: "Touch",
      components: "V, S, M",
      duration: "Until dispelled",
      damage: "",
      save: "",
      attack: "",
      ritual: false,
      concentration: false,
      description: "By means of this spell, a willing creature or an object can be hidden away, safe from detection for the duration. When you cast the spell and touch the target, it becomes invisible and can't be targeted by divination spells or perceived through scrying sensors created by divination spells. If the target is a creature, it falls into a state of suspended animation. Time ceases to flow for it, and it doesn't grow older. You can set a condition for the spell to end early. The condition can be anything you choose, but it must occur or be visible within 1 mile of the target. Examples include 'after 1,000 years' or 'when the tarrasque awakens.' This spell also ends if the target takes any damage.",
      wikiLink: "https://dnd5e.wikidot.com/spell:sequester"
    },
    {
      name: "Simulacrum",
      level: 7,
      school: "Illusion",
      castingTime: "12 hours",
      range: "Touch",
      components: "V, S, M",
      duration: "Until dispelled",
      damage: "",
      save: "",
      attack: "",
      ritual: false,
      concentration: false,
      description: "You shape an illusory duplicate of one beast or humanoid that is within range for the entire casting time of the spell. The duplicate is a creature, partially real and formed from ice or snow, and it can take actions and otherwise be affected as a normal creature. It appears to be the same as the original, but it has half the creature's hit point maximum and is formed without any equipment. Otherwise, the illusion uses all the statistics of the creature it duplicates. The simulacrum is friendly to you and creatures you designate. It obeys your spoken commands, moving and acting in accordance with your wishes and acting on your turn in combat. The simulacrum lacks the ability to learn or become more powerful, so it never increases its level or other abilities, nor can it regain expended spell slots.",
      wikiLink: "https://dnd5e.wikidot.com/spell:simulacrum"
    },
    {
      name: "Symbol",
      level: 7,
      school: "Abjuration",
      castingTime: "1 minute",
      range: "Touch",
      components: "V, S, M",
      duration: "Until dispelled or triggered",
      damage: "",
      save: "",
      attack: "",
      ritual: false,
      concentration: false,
      description: "When you cast this spell, you inscribe a harmful glyph either on a surface (such as a section of floor, a wall, or a table) or within an object that can be closed to conceal the glyph (such as a book, a scroll, or a treasure chest). If you choose a surface, the glyph can cover an area of the surface no larger than 10 feet in diameter. If you choose an object, that object must remain in its place; if the object is moved more than 10 feet from where you cast this spell, the glyph is broken, and the spell ends without being triggered.",
      wikiLink: "https://dnd5e.wikidot.com/spell:symbol"
    },
    {
      name: "Teleport",
      level: 7,
      school: "Conjuration",
      castingTime: "1 action",
      range: "10 feet",
      components: "V",
      duration: "Instantaneous",
      damage: "",
      save: "",
      attack: "",
      ritual: false,
      concentration: false,
      description: "This spell instantly transports you and up to eight willing creatures of your choice that you can see within range, or a single object that you can see within range, to a destination you select. If you target an object, it must be able to fit entirely inside a 10-foot cube, and it can't be held or carried by an unwilling creature. The destination you choose must be known to you, and it must be on the same plane of existence as you. Your familiarity with the destination determines whether you arrive there successfully.",
      wikiLink: "https://dnd5e.wikidot.com/spell:teleport"
    },
    {
      name: "Whirlwind",
      level: 7,
      school: "Evocation",
      castingTime: "1 action",
      range: "300 feet",
      components: "V, M",
      duration: "Concentration, up to 1 minute",
      damage: "2d8 bludgeoning damage",
      save: "Strength save",
      attack: "",
      ritual: false,
      concentration: true,
      description: "A whirlwind howls down to a point that you can see on the ground within range. The whirlwind is a 10-foot-radius, 30-foot-high cylinder centered on that point. Until the spell ends, you can use your action to move the whirlwind up to 30 feet in any direction along the ground. The whirlwind sucks up any Medium or smaller objects that aren't secured to anything and that aren't worn or carried by anyone. A creature must make a Strength saving throw the first time on a turn that it enters the whirlwind or that the whirlwind enters its space, including when the whirlwind first appears. On a failed save, the creature takes 2d8 bludgeoning damage and is caught in the whirlwind until the spell ends. On a successful save, the creature takes half as much damage and isn't caught in the whirlwind.",
      wikiLink: "https://dnd5e.wikidot.com/spell:whirlwind"
    },
    {
      name: "Abi-Dalzim's Horrid Wilting",
      level: 8,
      school: "Necromancy",
      castingTime: "1 action",
      range: "150 feet",
      components: "V, S, M",
      duration: "Instantaneous",
      damage: "12d8 necrotic damage",
      save: "Constitution save",
      attack: "",
      ritual: false,
      concentration: false,
      description: "You draw the moisture from every creature in a 30-foot cube centered on a point you choose within range. Each creature in that area must make a Constitution saving throw. Constructs and undead aren't affected, and plants and water elementals make this saving throw with disadvantage. A creature takes 12d8 necrotic damage on a failed save, or half as much damage on a successful one. Nonmagical plants in the area that aren't creatures, such as trees and shrubs, wither and die instantly.",
      wikiLink: "https://dnd5e.wikidot.com/spell:abi-dalzims-horrid-wilting"
    },
    {
      name: "Animal Shapes",
      level: 8,
      school: "Transmutation",
      castingTime: "1 action",
      range: "30 feet",
      components: "V, S",
      duration: "24 hours",
      damage: "",
      save: "",
      attack: "",
      ritual: false,
      concentration: false,
      description: "Your magic turns others into beasts. Choose any number of willing creatures that you can see within range. You transform each target into the form of a Large or smaller beast with a challenge rating of 4 or lower. On subsequent turns, you can use your action to transform affected creatures into new forms. The transformation lasts for the spell's duration, or until the target drops to 0 hit points or dies. You can choose a different form for each target. A target's game statistics are replaced by the statistics of the chosen beast, though the target retains its alignment and Intelligence, Wisdom, and Charisma scores. The target assumes the hit points of its new form, and when it reverts to its normal form, it returns to the number of hit points it had before it was transformed. If it reverts as a result of dropping to 0 hit points, any excess damage carries over to its normal form.",
      wikiLink: "https://dnd5e.wikidot.com/spell:animal-shapes"
    },
    {
      name: "Antimagic Field",
      level: 8,
      school: "Abjuration",
      castingTime: "1 action",
      range: "Self (10-foot radius)",
      components: "V, S, M",
      duration: "Concentration, up to 1 hour",
      damage: "",
      save: "",
      attack: "",
      ritual: false,
      concentration: true,
      description: "A 10-foot-radius invisible sphere of antimagic surrounds you. This area is divorced from the magical energy that suffuses the multiverse. Within the sphere, spells can't be cast, summoned creatures disappear, and even magic items become mundane. Until the spell ends, the space moves with you, centered on you. Spells and other magical effects, except those created by an artifact or a deity, are suppressed in the sphere and can't protrude into it. A slot expended to cast a suppressed spell is consumed. While an effect is suppressed, it doesn't function, but the time it spends suppressed counts against its duration.",
      wikiLink: "https://dnd5e.wikidot.com/spell:antimagic-field"
    },
    {
      name: "Antipathy/Sympathy",
      level: 8,
      school: "Enchantment",
      castingTime: "1 hour",
      range: "60 feet",
      components: "V, S, M",
      duration: "10 days",
      damage: "",
      save: "Wisdom save",
      attack: "",
      ritual: false,
      concentration: false,
      description: "This spell attracts or repels creatures of your choice. You target something within range, either a Huge or smaller object or creature or an area that is no larger than a 200-foot cube. Then specify a kind of intelligent creature, such as red dragons, goblins, or vampires. You invest the target with an aura that either attracts or repels the specified creatures for the duration. Choose antipathy or sympathy as the aura's effect.",
      wikiLink: "https://dnd5e.wikidot.com/spell:antipathy-sympathy"
    },
    {
      name: "Clone",
      level: 8,
      school: "Necromancy",
      castingTime: "1 hour",
      range: "Touch",
      components: "V, S, M",
      duration: "Instantaneous",
      damage: "",
      save: "",
      attack: "",
      ritual: false,
      concentration: false,
      description: "This spell grows an inert duplicate of a living creature as a safeguard against death. This clone forms inside a sealed vessel and grows to full size and maturity after 120 days; you can also choose to have the clone be a younger version of the same creature. It remains inert and endures indefinitely, as long as its vessel remains undisturbed. At any time after the clone matures, if the original creature dies, its soul transfers to the clone, provided that the soul is free and willing to return. The clone is physically identical to the original and has the same personality, memories, and abilities, but none of the original's equipment. The original creature's physical remains, if they still exist, become inert and can't thereafter be restored to life, since the creature's soul is elsewhere.",
      wikiLink: "https://dnd5e.wikidot.com/spell:clone"
    },
    {
      name: "Control Weather",
      level: 8,
      school: "Transmutation",
      castingTime: "10 minutes",
      range: "Self (5-mile radius)",
      components: "V, S, M",
      duration: "Concentration, up to 8 hours",
      damage: "",
      save: "",
      attack: "",
      ritual: false,
      concentration: true,
      description: "You take control of the weather within 5 miles of you for the duration. You must be outdoors to cast this spell. Moving to a place where you don't have a clear path to the sky ends the spell early. When you cast the spell, you change the current weather conditions, which are determined by the DM based on the climate and season. You can change precipitation, temperature, and wind. It takes 1d4 × 10 minutes for the new conditions to take effect. Once they do so, you can change the conditions again. When the spell ends, the weather gradually returns to normal.",
      wikiLink: "https://dnd5e.wikidot.com/spell:control-weather"
    },
    {
      name: "Demiplane",
      level: 8,
      school: "Conjuration",
      castingTime: "1 action",
      range: "60 feet",
      components: "S",
      duration: "1 hour",
      damage: "",
      save: "",
      attack: "",
      ritual: false,
      concentration: false,
      description: "You create a shadowy door on a flat solid surface that you can see within range. The door is large enough to allow Medium creatures to pass through unhindered. When opened, the door leads to a demiplane that appears to be an empty room 30 feet in each dimension, made of wood or stone. When the spell ends, the door disappears, and any creatures or objects inside the demiplane remain trapped there, as the door also disappears from the other side. Each time you cast this spell, you can create a new demiplane, or have the shadowy door connect to a demiplane you created with a previous casting of this spell. Additionally, if you know the nature and contents of a demiplane created by a casting of this spell by another creature, you can have the shadowy door connect to its demiplane instead.",
      wikiLink: "https://dnd5e.wikidot.com/spell:demiplane"
    },
    {
      name: "Dominate Monster",
      level: 8,
      school: "Enchantment",
      castingTime: "1 action",
      range: "60 feet",
      components: "V, S",
      duration: "Concentration, up to 1 hour",
      damage: "",
      save: "Wisdom save",
      attack: "",
      ritual: false,
      concentration: true,
      description: "You attempt to beguile a creature that you can see within range. It must succeed on a Wisdom saving throw or be charmed by you for the duration. If you or creatures that are friendly to you are fighting it, it has advantage on the saving throw. While the target is charmed, you have a telepathic link with it as long as the two of you are on the same plane of existence. You can use this telepathic link to issue commands to the creature while you are conscious (no action required), which it does its best to obey. You can specify a simple and general course of action, such as 'Attack that creature,' 'Run over there,' or 'Fetch that object.' If the creature completes the order and doesn't receive further direction from you, it defends and preserves itself to the best of its ability.",
      wikiLink: "https://dnd5e.wikidot.com/spell:dominate-monster"
    },
    {
      name: "Earthquake",
      level: 8,
      school: "Evocation",
      castingTime: "1 action",
      range: "500 feet",
      components: "V, S, M",
      duration: "Concentration, up to 1 minute",
      damage: "",
      save: "Dexterity save",
      attack: "",
      ritual: false,
      concentration: true,
      description: "You create a seismic disturbance within range. For the duration, an intense tremor rips through the ground in a 100-foot-radius circle centered on that point and shakes creatures and structures in contact with the ground in that area. The ground in the area becomes difficult terrain. Each creature on the ground that is concentrating must make a Constitution saving throw. On a failed save, the creature's concentration is broken. When you cast this spell and at the end of each turn you spend concentrating on it, each creature on the ground in the area must make a Dexterity saving throw. On a failed save, the creature is knocked prone.",
      wikiLink: "https://dnd5e.wikidot.com/spell:earthquake"
    },
    {
      name: "Feeblemind",
      level: 8,
      school: "Enchantment",
      castingTime: "1 action",
      range: "150 feet",
      components: "V, S, M",
      duration: "Instantaneous",
      damage: "",
      save: "Intelligence save",
      attack: "",
      ritual: false,
      concentration: false,
      description: "You blast the mind of a creature that you can see within range, attempting to shatter its intellect and personality. The target takes 4d6 psychic damage and must make an Intelligence saving throw. On a failed save, the creature's Intelligence and Charisma scores become 1. The creature can't cast spells, activate magic items, understand language, or communicate in any intelligible way. The creature can, however, identify its friends, follow them, and even protect them. At the end of every 30 days, the creature can repeat its saving throw against this spell. If it succeeds on its saving throw, the spell ends. The spell can also be ended by greater restoration, heal, or wish.",
      wikiLink: "https://dnd5e.wikidot.com/spell:feeblemind"
    },
    {
      name: "Glibness",
      level: 8,
      school: "Transmutation",
      castingTime: "1 action",
      range: "Self",
      components: "V",
      duration: "1 hour",
      damage: "",
      save: "",
      attack: "",
      ritual: false,
      concentration: false,
      description: "Until the spell ends, when you make a Charisma check, you can replace the number you roll with a 15. Additionally, no matter what you say, magic that would determine if you are telling the truth indicates that you are being truthful.",
      wikiLink: "https://dnd5e.wikidot.com/spell:glibness"
    },
    {
      name: "Holy Aura",
      level: 8,
      school: "Abjuration",
      castingTime: "1 action",
      range: "Self",
      components: "V, S, M",
      duration: "Concentration, up to 1 minute",
      damage: "",
      save: "",
      attack: "",
      ritual: false,
      concentration: true,
      description: "Divine light washes out from you and coalesces in a soft radiance in a 30-foot radius around you. Creatures of your choice in that radius when you cast this spell shed dim light in a 5-foot radius and have advantage on all saving throws, and other creatures have disadvantage on attack rolls against them until the spell ends. In addition, when a fiend or an undead hits an affected creature with a melee attack, the aura flashes with brilliant light. The attacker must succeed on a Constitution saving throw or be blinded until the spell ends.",
      wikiLink: "https://dnd5e.wikidot.com/spell:holy-aura"
    },
    {
      name: "Incendiary Cloud",
      level: 8,
      school: "Conjuration",
      castingTime: "1 action",
      range: "150 feet",
      components: "V, S",
      duration: "Concentration, up to 1 minute",
      damage: "10d8 fire damage",
      save: "Dexterity save",
      attack: "",
      ritual: false,
      concentration: true,
      description: "A swirling cloud of smoke shot through with white-hot embers appears in a 20-foot-radius sphere centered on a point within range. The cloud spreads around corners and is heavily obscured. It lasts for the duration or until a wind of moderate or greater speed (at least 10 miles per hour) disperses it. When the cloud appears, each creature in it must make a Dexterity saving throw. A creature takes 10d8 fire damage on a failed save, or half as much damage on a successful one. A creature must also make this saving throw when it enters the spell's area for the first time on a turn or ends its turn there.",
      wikiLink: "https://dnd5e.wikidot.com/spell:incendiary-cloud"
    },
    {
      name: "Maze",
      level: 8,
      school: "Conjuration",
      castingTime: "1 action",
      range: "60 feet",
      components: "V, S",
      duration: "Concentration, up to 10 minutes",
      damage: "",
      save: "",
      attack: "",
      ritual: false,
      concentration: true,
      description: "You banish a creature that you can see within range into a labyrinthine demiplane. The target remains there for the duration or until it escapes the maze. The target can use its action to attempt to escape. When it does so, it makes a DC 20 Intelligence check. If it succeeds, it escapes, and the spell ends (a minotaur or goristro demon automatically succeeds). Otherwise, it must make a DC 20 Intelligence check at the end of each of its turns for the duration of the spell. If it accumulates a total of three successful Intelligence checks before failing a total of three Intelligence checks, it escapes, and the spell ends.",
      wikiLink: "https://dnd5e.wikidot.com/spell:maze"
    },
    {
      name: "Mind Blank",
      level: 8,
      school: "Abjuration",
      castingTime: "1 action",
      range: "Touch",
      components: "V, S",
      duration: "24 hours",
      damage: "",
      save: "",
      attack: "",
      ritual: false,
      concentration: false,
      description: "Until the spell ends, one willing creature you touch is immune to psychic damage, any effect that would sense its emotions or read its thoughts, divination spells, and the charmed condition. The spell even foils wish spells and spells or effects of similar power used to affect the target's mind or to gain information about the target.",
      wikiLink: "https://dnd5e.wikidot.com/spell:mind-blank"
    },
    {
      name: "Power Word Stun",
      level: 8,
      school: "Enchantment",
      castingTime: "1 action",
      range: "60 feet",
      components: "V",
      duration: "Instantaneous",
      damage: "",
      save: "",
      attack: "",
      ritual: false,
      concentration: false,
      description: "You speak a word of power that can overwhelm the mind of one creature you can see within range, leaving it dumbfounded. If the target has 150 hit points or fewer, it is stunned. Otherwise, the spell has no effect. The stunned target must make a Constitution saving throw at the end of each of its turns. On a successful save, this stunning effect ends.",
      wikiLink: "https://dnd5e.wikidot.com/spell:power-word-stun"
    },
    {
      name: "Sunburst",
      level: 8,
      school: "Evocation",
      castingTime: "1 action",
      range: "150 feet",
      components: "V, S, M",
      duration: "Instantaneous",
      damage: "12d6 radiant damage",
      save: "Constitution save",
      attack: "",
      ritual: false,
      concentration: false,
      description: "Brilliant sunlight flashes in a 60-foot-radius sphere centered on a point you choose within range. Each creature in that light must make a Constitution saving throw. It takes 12d6 radiant damage on a failed save, or half as much damage on a successful one. A creature that has total cover from the point of origin of the spell isn't affected by it. Undead and oozes have disadvantage on this saving throw. A creature killed by this spell becomes a pile of fine ash. The light is sunlight.",
      wikiLink: "https://dnd5e.wikidot.com/spell:sunburst"
    },
    {
      name: "Telepathy",
      level: 8,
      school: "Evocation",
      castingTime: "1 action",
      range: "Unlimited",
      components: "V, S, M",
      duration: "24 hours",
      damage: "",
      save: "",
      attack: "",
      ritual: false,
      concentration: false,
      description: "You create a telepathic link between yourself and a willing creature with which you are familiar. The creature can be anywhere on the same plane of existence as you. The spell ends if you or the target are no longer on the same plane. Until the spell ends, you and the target can instantaneously share words, images, sounds, and other sensory messages with one another through the link, and the target recognizes you as the creature it is communicating with. The spell enables a creature with an Intelligence score of at least 1 to understand the meaning of your words and transmit mental messages in response.",
      wikiLink: "https://dnd5e.wikidot.com/spell:telepathy"
    },
    {
      name: "Tsunami",
      level: 8,
      school: "Conjuration",
      castingTime: "1 minute",
      range: "Sight",
      components: "V, S",
      duration: "6 rounds",
      damage: "6d10 bludgeoning damage",
      save: "Strength save",
      attack: "",
      ritual: false,
      concentration: false,
      description: "A wall of water springs into existence at a point you choose within range. You can make the wall up to 300 feet long, 300 feet high, and 50 feet thick. The wall lasts for the duration. When the wall appears, each creature within its area must make a Strength saving throw. On a failed save, a creature takes 6d10 bludgeoning damage, or half as much damage on a successful save. At the start of each of your turns after the wall appears, the wall, along with any creatures in it, moves 50 feet away from you. Any Huge or smaller creature inside the wall or whose space the wall enters when it moves must succeed on a Strength saving throw or be caught up in the wall and carried along with it.",
      wikiLink: "https://dnd5e.wikidot.com/spell:tsunami"
    },
    {
      name: "Astral Projection",
      level: 9,
      school: "Necromancy",
      castingTime: "1 hour",
      range: "10 feet",
      components: "V, S, M",
      duration: "Special",
      damage: "",
      save: "",
      attack: "",
      ritual: false,
      concentration: false,
      description: "You and up to eight willing creatures within range project your astral bodies into the Astral Plane (the spell fails and the casting is wasted if you are already on that plane). The material body you leave behind is unconscious and in a state of suspended animation; it doesn't need food or air and doesn't age. Your astral body resembles your mortal form in almost every way, replicating your game statistics and possessions. The principal difference is the addition of an astral cord that extends from between your shoulder blades and trails behind you, fading to invisibility after 1 foot. This cord is your tether to your material body. As long as the tether remains intact, you can find your way home. And, if the tether is broken—by a wish spell or by something cutting it—your soul and body are separated, killing you instantly.",
      wikiLink: "https://dnd5e.wikidot.com/spell:astral-projection"
    },
    {
      name: "Foresight",
      level: 9,
      school: "Divination",
      castingTime: "1 minute",
      range: "Touch",
      components: "V, S, M",
      duration: "8 hours",
      damage: "",
      save: "",
      attack: "",
      ritual: false,
      concentration: false,
      description: "You touch a willing creature and bestow a limited ability to see into the immediate future. For the duration, the target can't be surprised and has advantage on all attack rolls, ability checks, and saving throws. Additionally, other creatures have disadvantage on attack rolls against the target for the duration. This spell immediately ends if you cast it again before its duration ends.",
      wikiLink: "https://dnd5e.wikidot.com/spell:foresight"
    },
    {
      name: "Gate",
      level: 9,
      school: "Conjuration",
      castingTime: "1 action",
      range: "60 feet",
      components: "V, S, M",
      duration: "Concentration, up to 1 minute",
      damage: "",
      save: "",
      attack: "",
      ritual: false,
      concentration: true,
      description: "You conjure a portal linking an unoccupied space you can see within range to a precise location on a different plane of existence. The portal is a circular opening, which you can make 5 to 20 feet in diameter. You can orient the portal in any direction you choose. The portal lasts for the duration. The portal has a front and a back on each plane where it appears. Travel through the portal is possible only by moving through its front. Anything that does so is instantly transported to the other plane, appearing in the unoccupied space nearest to the portal. Deities and other planar rulers can prevent portals created by this spell from opening in their presence or anywhere within their domains.",
      wikiLink: "https://dnd5e.wikidot.com/spell:gate"
    },
    {
      name: "Imprisonment",
      level: 9,
      school: "Abjuration",
      castingTime: "1 minute",
      range: "30 feet",
      components: "V, S, M",
      duration: "Until dispelled",
      damage: "",
      save: "Wisdom save",
      attack: "",
      ritual: false,
      concentration: false,
      description: "You create a magical restraint to hold a creature. The target must be within range for the entire casting of the spell. On completion, the target disappears and becomes bound in an extradimensional prison. The prison can be a tiny, harmless demiplane or a labyrinth with a minotaur, which you choose when you cast the spell. The prison can be a physical location you designate on the current plane, or it can be a demiplane that moves along the Ethereal Plane. When you cast the spell, you can specify a condition that will cause the spell to end and release the target. The condition can be as specific or as elaborate as you choose, but the DM must agree that the condition is reasonable and has a likelihood of coming to pass. The conditions can be based on a creature's name, identity, or deity but otherwise must be based on observable actions or qualities and not based on intangibles such as level, class, or hit points.",
      wikiLink: "https://dnd5e.wikidot.com/spell:imprisonment"
    },
    {
      name: "Mass Heal",
      level: 9,
      school: "Evocation",
      castingTime: "1 action",
      range: "60 feet",
      components: "V, S",
      duration: "Instantaneous",
      damage: "",
      save: "",
      attack: "",
      ritual: false,
      concentration: false,
      description: "A flood of healing energy flows from you into injured creatures around you. You restore up to 700 hit points, divided as you choose among any number of creatures that you can see within range. Creatures healed by this spell are also cured of all diseases and any effect making them blinded or deafened. This spell has no effect on undead or constructs.",
      wikiLink: "https://dnd5e.wikidot.com/spell:mass-heal"
    },
    {
      name: "Meteor Swarm",
      level: 9,
      school: "Evocation",
      castingTime: "1 action",
      range: "1 mile",
      components: "V, S",
      duration: "Instantaneous",
      damage: "20d6 fire damage",
      save: "Dexterity save",
      attack: "",
      ritual: false,
      concentration: false,
      description: "Blazing orbs of fire plummet to the ground at four different points you can see within range. Each creature in a 40-foot-radius sphere centered on each point you choose must make a Dexterity saving throw. The sphere spreads around corners. A creature takes 20d6 fire damage and 20d6 bludgeoning damage on a failed save, or half as much damage on a successful one. A creature in the area of more than one fiery burst is affected only once. The spell damages objects in the area and ignites flammable objects that aren't being worn or carried.",
      wikiLink: "https://dnd5e.wikidot.com/spell:meteor-swarm"
    },
    {
      name: "Power Word Kill",
      level: 9,
      school: "Enchantment",
      castingTime: "1 action",
      range: "60 feet",
      components: "V",
      duration: "Instantaneous",
      damage: "",
      save: "",
      attack: "",
      ritual: false,
      concentration: false,
      description: "You utter a word of power that can compel one creature you can see within range to die instantly. If the creature you choose has 100 hit points or fewer, it dies. Otherwise, the spell has no effect.",
      wikiLink: "https://dnd5e.wikidot.com/spell:power-word-kill"
    },
    {
      name: "Prismatic Wall",
      level: 9,
      school: "Abjuration",
      castingTime: "1 action",
      range: "60 feet",
      components: "V, S",
      duration: "10 minutes",
      damage: "",
      save: "",
      attack: "",
      ritual: false,
      concentration: false,
      description: "A shimmering, multicolored plane of light forms a vertical opaque wall—up to 90 feet long, 30 feet high, and 1 inch thick—centered on a point you can see within range. Alternatively, you can shape the wall into a sphere up to 30 feet in diameter centered on that point. The wall remains in place for the duration. If you position the wall so that it passes through a space occupied by a creature, the spell fails, and your action and the spell slot are wasted. The wall sheds bright light out to a range of 100 feet and dim light for an additional 100 feet. You and creatures you designate at the time you cast the spell can pass through and remain near the wall without harm. If another creature that can see the wall moves to within 20 feet of it or starts its turn there, the creature must succeed on a Constitution saving throw or become blinded for 1 minute.",
      wikiLink: "https://dnd5e.wikidot.com/spell:prismatic-wall"
    },
    {
      name: "Shapechange",
      level: 9,
      school: "Transmutation",
      castingTime: "1 action",
      range: "Self",
      components: "V, S, M",
      duration: "Concentration, up to 1 hour",
      damage: "",
      save: "",
      attack: "",
      ritual: false,
      concentration: true,
      description: "You assume the form of a different creature for the duration. The new form can be of any creature with a challenge rating equal to your level or lower. You can't use this spell to become an undead or a construct. You also can't assume a form that has 0 hit points. You transform into an average example of that creature, one without any class levels or the Spellcasting trait. Your game statistics are replaced by the statistics of the chosen creature, though you retain your alignment and Intelligence, Wisdom, and Charisma scores. You also retain all of your skill and saving throw proficiencies, in addition to gaining those of the creature. If the creature has the same proficiency as you and the bonus listed in its statistics is higher than yours, use the creature's bonus in place of yours. You can't use any legendary actions or lair actions of the new form.",
      wikiLink: "https://dnd5e.wikidot.com/spell:shapechange"
    },
    {
      name: "Storm of Vengeance",
      level: 9,
      school: "Conjuration",
      castingTime: "1 action",
      range: "Sight",
      components: "V, S",
      duration: "Concentration, up to 1 minute",
      damage: "",
      save: "Constitution save",
      attack: "",
      ritual: false,
      concentration: true,
      description: "A churning storm cloud forms, centered on a point you can see and spreading to a radius of 360 feet. Lightning flashes in the area, thunder booms, and strong winds roar. Each creature under the cloud (no more than 5,000 feet beneath the cloud) when it appears must make a Constitution saving throw. On a failed save, a creature takes 2d6 thunder damage and becomes deafened for 5 minutes. Each round you maintain concentration on this spell, the storm produces different effects on your turn.",
      wikiLink: "https://dnd5e.wikidot.com/spell:storm-of-vengeance"
    },
    {
      name: "Time Stop",
      level: 9,
      school: "Transmutation",
      castingTime: "1 action",
      range: "Self",
      components: "V",
      duration: "Instantaneous",
      damage: "",
      save: "",
      attack: "",
      ritual: false,
      concentration: false,
      description: "You briefly stop the flow of time for everyone but yourself. No time passes for other creatures, while you take 1d4 + 1 turns in a row, during which you can use actions and move as normal. This spell ends if one of the actions you use during this period, or any effects that you create during this period, affects a creature other than you or an object being worn or carried by someone other than you. In addition, the spell ends if you move to a place more than 1,000 feet from the location where you cast it.",
      wikiLink: "https://dnd5e.wikidot.com/spell:time-stop"
    },
    {
      name: "True Polymorph",
      level: 9,
      school: "Transmutation",
      castingTime: "1 action",
      range: "30 feet",
      components: "V, S, M",
      duration: "Concentration, up to 1 hour",
      damage: "",
      save: "",
      attack: "",
      ritual: false,
      concentration: true,
      description: "Choose one creature or nonmagical object that you can see within range. You transform the creature into a different creature, the creature into a nonmagical object, or the object into a creature (the object must be neither worn nor carried by another creature). The transformation lasts for the duration, or until the target drops to 0 hit points or dies. If you concentrate on this spell for the full duration, the transformation becomes permanent. Shapechangers aren't affected by this spell. An unwilling creature can make a Wisdom saving throw, and if it succeeds, it isn't affected by this spell.",
      wikiLink: "https://dnd5e.wikidot.com/spell:true-polymorph"
    },
    {
      name: "True Resurrection",
      level: 9,
      school: "Necromancy",
      castingTime: "1 hour",
      range: "Touch",
      components: "V, S, M",
      duration: "Instantaneous",
      damage: "",
      save: "",
      attack: "",
      ritual: false,
      concentration: false,
      description: "You touch a creature that has been dead for no longer than 200 years and that died for any reason except old age. If the creature's soul is free and willing, the creature is restored to life with all its hit points. This spell closes all wounds, neutralizes any poison, cures all diseases, and lifts any curses affecting the creature when it died. The spell replaces damaged or missing organs and limbs. The spell can even provide a new body if the original no longer exists, in which case you must speak the creature's name. The creature then appears in an unoccupied space you choose within 10 feet of you.",
      wikiLink: "https://dnd5e.wikidot.com/spell:true-resurrection"
    },
    {
      name: "Weird",
      level: 9,
      school: "Illusion",
      castingTime: "1 action",
      range: "120 feet",
      components: "V, S",
      duration: "Concentration, up to 1 minute",
      damage: "4d10 psychic damage",
      save: "Wisdom save",
      attack: "",
      ritual: false,
      concentration: true,
      description: "Drawing on the deepest fears of a group of creatures, you create illusory creatures in their minds, visible only to them. Each creature in a 30-foot-radius sphere centered on a point of your choice within range must make a Wisdom saving throw. On a failed save, a creature becomes frightened for the duration. The illusion calls on the creature's deepest fears, manifesting its worst nightmares as an implacable threat. At the end of each of the frightened creature's turns, it must succeed on a Wisdom saving throw or take 4d10 psychic damage. On a successful save, the spell ends for that creature.",
      wikiLink: "https://dnd5e.wikidot.com/spell:weird"
    },
    {
      name: "Wish",
      level: 9,
      school: "Conjuration",
      castingTime: "1 action",
      range: "Self",
      components: "V",
      duration: "Instantaneous",
      damage: "",
      save: "",
      attack: "",
      ritual: false,
      concentration: false,
      description: "Wish is the mightiest spell a mortal creature can cast. By simply speaking aloud, you can alter the very foundations of reality in accord with your desires. The basic use of this spell is to duplicate any other spell of 8th level or lower. You don't need to meet any requirements in that spell, including costly components. The spell simply takes effect. Alternatively, you can create one of the following effects of your choice: You create one object of up to 25,000 gp in value that isn't a magic item. The object can be no more than 300 feet in any dimension, and it appears in an unoccupied space you can see on the ground. You allow up to twenty creatures that you can see to regain all hit points, and you end all effects on them described in the greater restoration spell. You grant up to ten creatures that you can see resistance to a damage type you choose. You grant up to ten creatures you can see immunity to a single spell or other magical effect for 8 hours. For instance, you could make yourself and all your companions immune to a lich's life drain attack. You undo a single recent event by forcing a reroll of any roll made within the last round (including your last turn). Reality reshapes itself to accommodate the new result. For example, a wish spell could undo an opponent's successful save, a foe's critical hit, or a friend's failed save. You can force the reroll to be made with advantage or disadvantage, and you can choose whether to use the reroll or the original roll.",
      wikiLink: "https://dnd5e.wikidot.com/spell:wish"
    }
  ]
};

// Initialize spell system
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

// Add spell slot type
function addSpellSlot() {
  const name = document.getElementById('spell_slot_name').value.trim();
  const maxValue = parseInt(document.getElementById('spell_slot_max').value) || 1;
  const resetType = document.getElementById('spell_slot_reset_type').value;
  
  if (!name) {
    alert("Please enter a spell slot name");
    return;
  }
  
  // Check if spell slot name already exists
  if (manualSpellSlots.find(s => s.name.toLowerCase() === name.toLowerCase())) {
    alert("A spell slot type with this name already exists");
    return;
  }
  
  const slotId = 'spell_' + Date.now();
  const newSlot = {
    id: slotId,
    name: name,
    maxValue: maxValue,
    resetType: resetType
  };
  
  manualSpellSlots.push(newSlot);
  manualSpellSlotsUsed[slotId] = 0;
  
  updateSpellSlots();
  closePopup('addSpellSlotPopup');
  autosave();
}

// Remove spell slot type
function removeSpellSlot(slotId) {
  if (confirm('Are you sure you want to remove this spell slot type?')) {
    manualSpellSlots = manualSpellSlots.filter(s => s.id !== slotId);
    delete manualSpellSlotsUsed[slotId];
    updateSpellSlots();
    autosave();
  }
}

// Update spell slots display
function updateSpellSlots() {
  const container = document.getElementById('spell_slots_container');
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
    
    slotDiv.innerHTML = `
      <span class="spell-level-label" title="${slot.resetType === 'long' ? 'Resets on Long Rest' : slot.resetType === 'short' ? 'Resets on Short Rest' : 'Manual Reset Only'}">${slot.name}:</span>
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
    
    // Create the dots for this spell slot
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

// Update spell slot max value
function updateSpellSlotMax(slotId, newMax) {
  const slot = manualSpellSlots.find(s => s.id === slotId);
  if (slot) {
    slot.maxValue = parseInt(newMax) || 1;
    // Adjust used value if it exceeds new max
    if (manualSpellSlotsUsed[slotId] > slot.maxValue) {
      manualSpellSlotsUsed[slotId] = slot.maxValue;
    }
    updateSpellSlots();
    autosave();
  }
}

// Toggle spell slot usage
function toggleSpellSlot(slotId, index) {
  const usedValue = manualSpellSlotsUsed[slotId] || 0;
  if (index < usedValue) {
    manualSpellSlotsUsed[slotId] = index;
  } else {
    manualSpellSlotsUsed[slotId] = index + 1;
  }
  updateSpellSlots();
  autosave();
}

// Reset spell slots based on rest type
function resetSpellSlots(restType = 'all') {
  if (restType === 'all') {
    if (confirm('Are you sure you want to reset all spell slots?')) {
      manualSpellSlots.forEach(slot => {
        manualSpellSlotsUsed[slot.id] = 0;
      });
      updateSpellSlots();
      autosave();
    }
  } else {
    // Reset based on rest type (short/long)
    manualSpellSlots.forEach(slot => {
      if (slot.resetType === restType || (restType === 'long' && slot.resetType === 'short')) {
        manualSpellSlotsUsed[slot.id] = 0;
      }
    });
    updateSpellSlots();
    autosave();
  }
}

// Show edit spell slot popup
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

// Save spell slot edit
function saveSpellSlotEdit() {
  if (!currentEditingSpellSlotId) return;
  
  const name = document.getElementById('edit_spell_slot_name').value.trim();
  const maxValue = parseInt(document.getElementById('edit_spell_slot_max').value) || 1;
  const resetType = document.getElementById('edit_spell_slot_reset_type').value;
  
  if (!name) {
    alert("Please enter a spell slot name");
    return;
  }
  
  // Check if name already exists (but allow same name for current slot)
  const existingSlot = manualSpellSlots.find(s => s.name.toLowerCase() === name.toLowerCase() && s.id !== currentEditingSpellSlotId);
  if (existingSlot) {
    alert("A spell slot type with this name already exists");
    return;
  }
  
  // Find and update the slot
  const slot = manualSpellSlots.find(s => s.id === currentEditingSpellSlotId);
  if (slot) {
    slot.name = name;
    slot.maxValue = maxValue;
    slot.resetType = resetType;
    
    // Adjust used value if it exceeds new max
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

// Show add custom resource popup
function showAddCustomResourcePopup() {
  document.getElementById('custom_resource_name').value = '';
  document.getElementById('custom_resource_max').value = '1';
  document.getElementById('custom_resource_reset_type').value = 'long';
  showPopup('addCustomResourcePopup');
}

// Add custom resource
function addCustomResource() {
  const name = document.getElementById('custom_resource_name').value.trim();
  const maxValue = parseInt(document.getElementById('custom_resource_max').value) || 1;
  const resetType = document.getElementById('custom_resource_reset_type').value;
  
  if (!name) {
    alert("Please enter a resource name");
    return;
  }
  
  // Check if resource name already exists
  if (customResources.find(r => r.name.toLowerCase() === name.toLowerCase())) {
    alert("A resource with this name already exists");
    return;
  }
  
  const resourceId = 'custom_' + Date.now();
  const newResource = {
    id: resourceId,
    name: name,
    maxValue: maxValue,
    resetType: resetType
  };
  
  customResources.push(newResource);
  customResourcesUsed[resourceId] = 0;
  
  updateCustomResources();
  closePopup('addCustomResourcePopup');
  autosave();
}

// Remove custom resource
function removeCustomResource(resourceId) {
  if (confirm('Are you sure you want to remove this custom resource?')) {
    customResources = customResources.filter(r => r.id !== resourceId);
    delete customResourcesUsed[resourceId];
    updateCustomResources();
    autosave();
  }
}

// Update custom resources display
function updateCustomResources() {
  const container = document.getElementById('custom_resources_container');
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
    
    resourceDiv.innerHTML = `
      <span class="spell-level-label" title="${resource.resetType === 'long' ? 'Resets on Long Rest' : resource.resetType === 'short' ? 'Resets on Short Rest' : 'Manual Reset Only'}">${resource.name}:</span>
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
    
    // Create the dots for this resource
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

// Update custom resource max value
function updateCustomResourceMax(resourceId, newMax) {
  const resource = customResources.find(r => r.id === resourceId);
  if (resource) {
    resource.maxValue = parseInt(newMax) || 1;
    // Adjust used value if it exceeds new max
    if (customResourcesUsed[resourceId] > resource.maxValue) {
      customResourcesUsed[resourceId] = resource.maxValue;
    }
    updateCustomResources();
    autosave();
  }
}

// Toggle custom resource usage
function toggleCustomResource(resourceId, index) {
  const usedValue = customResourcesUsed[resourceId] || 0;
  if (index < usedValue) {
    customResourcesUsed[resourceId] = index;
  } else {
    customResourcesUsed[resourceId] = index + 1;
  }
  updateCustomResources();
  autosave();
}

// Reset custom resources based on rest type
function resetCustomResources(restType = 'all') {
  if (restType === 'all') {
    if (confirm('Are you sure you want to reset all custom resources?')) {
      customResources.forEach(resource => {
        customResourcesUsed[resource.id] = 0;
      });
      updateCustomResources();
      autosave();
    }
  } else {
    // Reset based on rest type (short/long)
    customResources.forEach(resource => {
      if (resource.resetType === restType || (restType === 'long' && resource.resetType === 'short')) {
        customResourcesUsed[resource.id] = 0;
      }
    });
    updateCustomResources();
    autosave();
  }
}

// Show spell form
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

// Removed legacy standalone localStorage for spells.

// Import common cantrips
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
function showImportPopup(type) {
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
      const classData = dndClasses[className];
      
      // Add cantrips (if allowed by mode)
      if (importMode !== 'spell' && classData.cantrips) {
        classData.cantrips.forEach(cantrip => {
          if (!cantripsToImport.find(c => c.name === cantrip)) {
            cantripsToImport.push({ name: cantrip, class: className });
          }
        });
      }
      
      // Add spells up to the selected level (if allowed by mode)
      if (importMode !== 'cantrip') {
        for (let i = 1; i <= Math.min(level, 9); i++) {
          if (classData.spells && classData.spells[i]) {
            classData.spells[i].forEach(spell => {
              if (!spellsToImport.find(s => s.name === spell)) {
                spellsToImport.push({ name: spell, level: i, class: className });
              }
            });
          }
        }
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
      const classData = dndClasses[className];
      
      // Import cantrips (only if mode allows)
      if (importMode !== 'spell' && classData.cantrips) {
        classData.cantrips.forEach(cantripName => {
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
        for (let i = 1; i <= Math.min(level, 9); i++) {
          if (classData.spells && classData.spells[i]) {
            classData.spells[i].forEach(spellName => {
              if (!spellsData.spells.find(s => s.name === spellName)) {
                const spell = createSpellFromName(spellName, i);
                if (spell) {
                  spellsData.spells.push(spell);
                  importedCount++;
                }
              }
            });
          }
        }
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
    return {
      name: name,
      level: spellData.level,
      school: spellData.school,
      castingTime: spellData.castingTime,
      range: spellData.range,
      components: spellData.components,
      duration: spellData.duration,
      damage: spellData.damage,
      save: spellData.save,
      attack: spellData.attack,
      ritual: spellData.ritual,
      concentration: spellData.concentration,
      prepared: false,
      description: spellData.description,
      wikiLink: spellData.wikiLink
    };
  }
  
  // Fallback for spells not in our database
  return {
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
    prepared: false,
    description: `${name} - Official D&D 5e spell. Full description available in Player's Handbook.`,
    wikiLink: `https://dnd5e.wikidot.com/spell:${name.toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]/g, '')}`
  };
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

// Initialize spell system when page loads
document.addEventListener('DOMContentLoaded', function() {
  initializeSpellSystem();
});

function loadLayout() {
  // Add layout loading logic here if needed
}

