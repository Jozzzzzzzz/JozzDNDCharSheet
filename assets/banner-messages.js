/*
  Rolling Banner Messages
  -----------------------
  Add new messages anywhere in the list below — just follow the format:

    'Your message here.',

  Keep them short enough to read at a glance.
  No HTML tags — plain text only.
  Don't forget the comma at the end of every line except the last one.

  ✏️  QUICK ADD — drop a new line anywhere in the "VIBES" section:
  ---------------------------------------------------------------
  'Fun fact: Your message here.',
  ---------------------------------------------------------------
*/

// ----------------------------------------------------------------
// FIRST LOAD MESSAGE
// This shows once every time the app opens, before the rotation starts.
// Change the text between the quotes to whatever you want.
// Set to '' (empty) to skip it and go straight into the rotation.
// ----------------------------------------------------------------
window.BANNER_FIRST_MESSAGE = 'HELLOOOO DND';

window.BANNER_MESSAGES = [

  // ----------------------------------------------------------------
  // SHEET TIPS — how to use this app
  // ----------------------------------------------------------------
  'Tip: This sheet autosaves every time you type. Use Export to back up your character.',
  'Tip: Cloud Sync keeps your sheet in sync across all your devices.',
  'Tip: Cloud Sync is best for device-to-device play. Export is your emergency backup.',
  'Tip: Keep your Notes updated before long rests so nothing gets lost.',
  'Tip: Short rests let you recover Hit Dice and certain class features without camping.',
  'Tip: Pin your most-used characters as favourites so they load faster.',
  'Tip: Use the Notes page to track quest leads, NPC names, and things your party owes people.',
  'Tip: You can track custom currencies alongside CP, SP, EP, and GP.',
  'Tip: Death save results reset after a short or long rest — not just after going down.',
  'Tip: Your spell slots and custom resources are saved between sessions.',

  // ----------------------------------------------------------------
  // FUN FACTS — D&D rules, lore, and trivia
  // ----------------------------------------------------------------
  'Fun fact: A mimic can be a chest, a door, or your trust issues.',
  'Fun fact: The average party plan survives about six seconds after initiative.',
  'Fun fact: Feather Fall is a reaction, so you can cast it after stepping off the ledge.',
  'Fun fact: A Natural 20 on a death saving throw stabilises you immediately.',
  'Fun fact: Elves trance for 4 hours and get the equivalent of a full 8-hour rest.',
  'Fun fact: Halflings can reroll any 1 on an attack roll, ability check, or saving throw.',
  'Fun fact: Zone of Truth does not compel anyone to speak — it just stops them from lying if they do.',
  'Fun fact: Counterspell can counter another Counterspell.',
  'Fun fact: Healing Word is a bonus action, so you can cast it and still attack.',
  'Fun fact: Sending lets you communicate across planes — 25 words maximum.',
  'Fun fact: True Polymorph becomes permanent if you hold concentration for a full hour.',
  'Fun fact: A Bag of Holding holds 500 lbs and 64 cubic feet — roughly the size of a fridge.',
  'Fun fact: Prestidigitation can chill, warm, or flavour up to 1 cubic foot of nonliving material.',
  'Fun fact: Speak with Dead works on a corpse even if the creature never had a language.',
  'Fun fact: Gust of Wind can extinguish unprotected flames and disperse fog clouds.',
  'Fun fact: Wild Shape has a range of beast CRs that scales with your druid level.',
  'Fun fact: Mirror Image creates 3 duplicates — each one has AC 10 + your Dex modifier.',
  'Fun fact: The Tarrasque has a CR of 30 and regenerates 30 HP at the start of every turn.',
  'Fun fact: Polymorph can turn a Tyrannosaurus Rex into a sheep — if you beat the Wisdom save.',
  'Fun fact: D&D was first published in 1974. The world has been rolling dice ever since.',
  'Fun fact: Vampires cannot enter a residence without an invitation.',
  'Fun fact: You can hold your breath for at least 1 minute in 5e regardless of your Constitution.',
  'Fun fact: The word "dungeon" comes from the Old French "donjon" — meaning the keep of a castle.',
  'Fun fact: The beholder is one of the few D&D monsters that is not based on mythology.',
  'Fun fact: Illithids (mind flayers) reproduce by implanting larvae into a host brain.',
  'Fun fact: A Lich must consume souls stored in a phylactery to sustain its undead form.',
  'Fun fact: The githyanki and githzerai were once the same people, enslaved by mind flayers.',
  'Fun fact: A Gelatinous Cube is nearly invisible — it is essentially a walking corridor trap.',
  'Fun fact: The tarrasque cannot fly — kite it from range and you have a chance.',
  'Fun fact: Dragons gain new abilities as they age through wyrmling, young, adult, and ancient.',
  'Fun fact: A creature can only benefit from one long rest in any 24-hour period.',
  'Fun fact: Grappling does not need an attack roll — it is an Athletics check against the target.',
  'Fun fact: Twin spells like Haste can target two creatures if you are a Sorcerer with Twinned Spell.',
  'Fun fact: Darkvision sees in dim light as bright, and darkness as dim — everything looks greyscale.',
  'Fun fact: A flying creature falls if it is knocked prone, restrained, or its speed drops to 0.',
  'Fun fact: Bless adds 1d4 to attack rolls and saving throws — quietly one of the best level-1 spells.',
  'Fun fact: A familiar can deliver touch spells for you from up to 100 feet away.',
  'Fun fact: You can drop prone for free, but standing up costs half your movement.',
  'Fun fact: Critical hits double the dice you roll, not the total — modifiers are added once.',
  'Fun fact: Hiding needs cover or obscurement — you cannot hide from a creature that can clearly see you.',
  'Fun fact: Goblins get Nimble Escape: they can Disengage or Hide as a bonus action every turn.',
  'Fun fact: A net attack can restrain a Large or smaller creature — niche, but it wins fights.',
  'Fun fact: Owlbears are believed to be the result of a wizard crossing a giant owl with a bear.',
  'Fun fact: A Rope of Climbing can move on its own and tie knots on command.',
  'Fun fact: Most spells need only one free hand for somatic components, even while holding a shield.',
  'Fun fact: Drinking a potion is an action; feeding one to an unconscious ally is also an action.',

  // ----------------------------------------------------------------
  // PARTY VIBES — relatable chaos
  // ----------------------------------------------------------------
  'Fun fact: "I cast Fireball" has ended more parties than any BBEG.',
  'Fun fact: The most dangerous words at any table are "I have an idea."',
  'Fun fact: Splitting the party is technically valid if everyone is playing a rogue.',
  'Fun fact: There is always one player who has read more rulebooks than the DM.',
  'Fun fact: "Can I roll Persuasion?" is how every bad plan ends.',
  'Fun fact: The rogue will steal from the party at least once. It is tradition.',
  'Fun fact: Someone always forgets they have Inspiration until after the session.',
  'Fun fact: The most rolled stat in D&D is probably Perception, not Attack.',
  'Fun fact: At least one spell slot will be wasted on something before the final boss.',
  'Fun fact: Every wizard thinks their spell choice is optimal. Every wizard is wrong about something.',

  // ----------------------------------------------------------------
  // NEWS / CUSTOM SLOT — update this for your campaign or group
  // ----------------------------------------------------------------
  'News: Add your latest campaign update or patch note here for your players.',

  // ----------------------------------------------------------------
  // MONEY MATHS — GP to real-world comparisons (1 GP ≈ NZ$100 estimate)
  // These are intentionally near the bottom since they involve numbers.
  // ----------------------------------------------------------------
  'Did you know: As a table-friendly estimate, this sheet treats 1 GP as roughly NZ$100.',
  'Did you know: A rough money guide: 1 CP ≈ NZ$1, 1 SP ≈ NZ$10, 1 GP ≈ NZ$100, 1 PP ≈ NZ$1,000.',
  'Did you know: One loose take on 1 GP is about US$60, NZ$100, or £50 — pure flavour, not official.',
  'Did you know: By this sheet estimate, becoming a real-world millionaire takes around 10,000 GP.',
  'Did you know: A dragon hoarding 100,000 GP is sitting on roughly NZ$10 million by this estimate.',
  'Tip: Money comparisons here are just table flavour — D&D prices are not balanced like modern shopping.'

];
