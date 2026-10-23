import * as THREE from 'three';

// Central place for tweakable world settings. Change these to restyle the game.

export const SEED = 1337;

export const WORLD = {
  islandRadius: 130, // radius of the grassy island, in voxels
  treeCount: 190,
  treeSpacing: 9, // minimum distance between trees
  flowerCount: 3600,
  butterflyCount: 16,
};

export const SKY = {
  top: '#2f7fe0',
  middle: '#8fd0ff',
  horizon: '#ffe6cf', // also used as the fog color so distant things melt into the sky
  sun: '#fff6c9',
  sunDirection: new THREE.Vector3(0.5, 0.6, 0.4).normalize(),
};

export const FOG = {
  near: 70,
  far: 650,
};

// One full day and night every five minutes. Only the lighting changes (and villagers go to bed).
export const DAY = {
  length: 300, // seconds for a whole day + night
  startAt: 0.05, // where in the day the game starts (0 = sunrise, 0.5 = sunset)
};

// The camera: you can turn it, zoom and tilt it between minPitch and maxPitch (radians above the
// horizon). Where you go never changes it by itself.
export const CAMERA = {
  yaw: 0.9, // starting angle around the player (radians)
  pitch: 0.35,
  minPitch: 0.05,
  maxPitch: 1.35,
  distance: 13,
};

export const VILLAGE = {
  houseCount: 6,
  ringRadius: 18, // distance from the plaza center to each house
  outerRingRadius: 33, // a second ring of houses further out
  plazaRadius: 7,
  roofColors: ['#d9493f', '#3f7fd9', '#e08a2e', '#7a4fd1', '#2fa36b', '#d94f9a'],
  wanderRadius: 22, // how far villagers stroll from the plaza
};

// Sound effects (made in code, see core/Sound.js). Press M in the game to turn them off.
export const SOUND = {
  volume: 0.6,
  music: 0.55, // background music, on top of the volume (core/Music.js)
};

// The character customization screen (press P): the choices for each part of Bobert, and how he
// looks to start with. Add a color to a list to offer it.
export const CUSTOMIZE = {
  start: { skin: '#ffcc99', hair: '#6b3e1f', hairStyle: 'classic', shirt: '#ff4f6d', pants: '#3d5afe', shoes: '#2b2b2b' },
  skin: ['#ffe0c4', '#ffcc99', '#e8b07f', '#c68642', '#8d5524', '#5c3a21'],
  hair: ['#6b3e1f', '#2b1d14', '#e0a030', '#c0392b', '#f2f2f2', '#1d1d1d', '#3f7fd9', '#ff6bb5'],
  shirt: ['#ff4f6d', '#ff8a1f', '#ffd23f', '#2fa36b', '#2fb5a8', '#3f7fd9', '#7a4fd1', '#ffffff', '#4a4a4a'],
  pants: ['#3d5afe', '#2b3a55', '#6b5a3a', '#4a4a4a', '#2fa36b', '#7a4fd1', '#c0392b', '#f2c14e'],
  shoes: ['#2b2b2b', '#4a2f1a', '#e23b4a', '#ffffff', '#3f7fd9', '#2fa36b'],
};

export const PLAYER = {
  maxHealth: 5, // hits you can take before you're knocked out
  regenDelay: 6, // seconds without getting hit before health starts coming back
  regenInterval: 4, // seconds per point of health while regenerating
  walkSpeed: 6.5,
  runSpeed: 11, // holding the roll key (Shift) after a roll keeps you running
  coyoteTime: 0.12, // you can still jump this long after running off a ledge...
  jumpBuffer: 0.14, // ...and a jump pressed this long before landing still happens
  swingSlowdown: 0.35, // how fast you can move while swinging (0..1 of normal speed)
  autoAim: 3.2, // a swing turns you toward a monster this close (on top of the sword's reach)
};

// Rolling: Shift, from the very start. You can't be hurt in the middle of a roll. Master Jackson
// teaches the Perfect Dodge: roll through an attack at the last moment and time slows down, and
// your next swing is a big counter-attack.
export const DODGE = {
  speed: 13,
  time: 0.32, // seconds of rolling (you can't be hurt for all of it)
  cooldown: 0.22, // after a roll ends
  slowMo: 0.6, // Perfect Dodge: seconds of slow motion...
  slowMoScale: 0.3, // ...at this speed
  counterTime: 1.6, // seconds to land the counter-attack
  counterBonus: 2, // extra damage it does
};

export const SWORDS = [
  { name: 'Wooden-Handled Sword', damage: 1, reach: 1.1 },
  { name: "Knight's Sword", damage: 2, reach: 1.5 },
];

// What the blacksmith's forge sells. Pay to build a bigger forge to unlock the upgraded things.
export const FORGE = {
  prices: { shield: 25, bow: 40 },
  biggerForge: 60,
  upgrades: { sword: 60, powerBow: 70, ironShield: 60, armor: 90 },
  armorHearts: 2, // extra max health from the armor
};

// What the baker sells. `heals` is how much health it brings back. Press F to eat.
export const FOOD = {
  carry: 5, // how much food you can carry at once
  menu: [
    { id: 'apple', name: 'Apple', icon: '🍎', heals: 1, price: 3 },
    { id: 'bread', name: 'Bread', icon: '🍞', heals: 2, price: 5 },
    { id: 'pie', name: 'Berry Pie', icon: '🥧', heals: 99, price: 15 }, // 99 = all the way
  ],
};

// What monsters drop besides coins: when you're hurt, a health pickup now and then.
export const DROPS = {
  healthChance: 0.3, // chance a defeated monster drops one, if you're missing health
  magnetRange: 6, // pickups fly to you from this close...
  autoCollect: 0.7, // ...and from anywhere nearby after this many seconds
};

// Boulders around the island (scenery).
export const GATHER = {
  boulderCount: 40,
};

// The bow never runs out of arrows: it just takes a moment to draw.
export const BOW = {
  damage: 1,
  secondsPerDamage: 0.6, // power bow: +1 damage for every 0.6 seconds you hold the bow key...
  maxDamage: 4, // ...up to 4
  drawTime: 0.45, // seconds to pull the string back before the arrow flies
  speed: 32,
  range: 30, // how far an arrow flies
};

// The sea around the island. You can swim in it after jumping off the dock.
export const SEA = {
  level: -0.4, // water surface height
  radius: 340, // how far out you can swim
  swimDepth: 3.4, // swimming is underwater: your feet are this far below the surface
  monsterDepth: 2.4, // sea monsters swim this far down too
  floor: -12, // the sandy seabed
  // Sharks are common, eels are rare (two live by the tower island).
  sharks: [
    { x: 176, z: 3 },
    { x: 182, z: 72 },
    { x: 169, z: -58 },
    { x: 65, z: 188 },
    { x: -182, z: 78 },
    { x: -130, z: -169 },
    { x: 91, z: -182 },
    { x: 260, z: -52 },
    { x: 26, z: 228 },
    { x: -84, z: 195 },
    { x: -228, z: -52 },
    { x: -52, z: -221 },
    { x: 182, z: -182 },
    { x: 280, z: 58 },
    { x: 195, z: 208 },
    { x: -260, z: 130 },
    { x: 156, z: 143 },
    { x: -169, z: -234 },
  ],
  // Little islands to rest on. `chest` puts a treasure chest on it.
  islands: [
    { x: 110, z: 195, radius: 10, chest: 20 },
    { x: -176, z: 136, radius: 12 },
    { x: -195, z: -150, radius: 9, chest: 25 },
    { x: 13, z: -208, radius: 10 },
    { x: 247, z: -104, radius: 9 },
    { x: 254, z: 150, radius: 8, chest: 30 },
  ],
};

// Where things are on the island.
export const PLACES = {
  cave: { x: 31, z: -62 }, // center of the mountain with the slime's cave
  stoneCircle: { x: -57, z: -26 }, // the rainbow stones puzzle
  slimeMeadow: { x: -47, z: 49 }, // where the farmer's slime problem is
  dockZ: 6, // the dock sticks out of the east beach at this z
  towerIsland: { x: 221, z: 29, radius: 23 }, // island with the big tower and the mystery crystal
  kraken: { x: 130, z: -240 },
  seaSerpent: { x: -260, z: 13 },
  charibdisCave: { x: -39, z: 266 }, // rocky sea cave, locked with the key
  jungle: { x: 0, z: -1000, radius: 77 }, // the jungle island, far across the sea (Max takes you)
  cellar: { x: 900, z: 0 }, // Old Man Ward's cellar, under the trapdoor (built far away, out of sight)
  dream: { x: -1000, z: 0, y: 140 }, // the dream dimension, floating high in the sky far away
  fireIsland: { x: 0, z: 1000, radius: 70 }, // the volcano island, far across the sea (after the Viniac)
  tulane: { x: -900, z: 900, radius: 46 }, // Tulane Kingdom, where Bobert comes from (the intro starts here)
};

// All monsters attack this many times faster than their base timings below and in their files
// (Charibdis's whirlpool keeps its own exact timing).
export const MONSTERS = {
  attackSpeed: 1.25,
};

// Little power-ups that last a few minutes: Barrett the gecko sells them in the jungle, and
// Grayson the fish gives one away free when you find him at sea.
export const BUFFS = {
  seconds: 300, // each one lasts five minutes
  quickFeet: { name: 'Quick Feet', icon: '🦎', price: 25, speed: 1.2, description: 'Walk and run a little faster.' },
  toughScales: { name: 'Tough Scales', icon: '🛡️', price: 35, description: 'Every hit hurts 1 less (but always at least 1).' },
  luckyTail: { name: 'Lucky Tail', icon: '🍀', price: 30, coins: 2, description: 'Monsters drop twice as many coins.' },
  fastFins: { name: 'Fast Fins', icon: '🐟', price: 0, swim: 1.5, description: 'Swim much faster.' },
  frostyFeet: { name: 'Frosty Feet', icon: '🧊', price: 0, description: "Lava can't burn you." },
};

// Grayson the friendly fish: where he can turn up, and how long he's away after giving a gift.
export const GRAYSON = {
  spots: [
    { x: 162, z: 31 }, // off the beach just north of the dock
    { x: -159, z: 120 }, // by the little island in the north-west
    { x: 18, z: -188 }, // by the little island to the south
    { x: 130, z: -117 }, // south-east, on the way to the kraken's rocks
    { x: -161, z: -57 }, // off the west beach
  ], // (all well away from the sharks)
  awaySeconds: 60,
};

// The Sky Strike: Master Oak teaches it after the spin attack (jump, then swing in mid-air).
export const SKY_STRIKE = {
  posts: 3, // training posts to smash with it in Oak's clearing
  damage: 3,
  radius: 3.5,
  speed: 32, // how fast you dive down
};

// Master Jackson, Oak's old friend: he dodges every attack except a spin attack. Beat him in a
// duel and he teaches you the Perfect Dodge (see DODGE).
export const JACKSON = {
  island: { x: 247, z: -104 }, // he trains on this little island
  health: 6, // spin attacks it takes to beat him (each spin does at least 2)
  damage: 2, // his quick jabs
  reward: 60,
};

// The dream dimension. Aleli's magic conduit holds magic, and gives you the Star Burst (press L):
// a ring of starlight that knocks back and hurts every monster around you, and wraps you in a
// star shield. Each Dream Keeper quest teaches one more dream ability.
export const DREAM = {
  wispRespawn: 25, // seconds before a popped wandering wisp floats back
  burstRadius: 6, // Star Burst: how far it reaches...
  burstDamage: 3, // ...how hard it hits...
  burstCooldown: 1.2,
  shieldHits: 1, // ...and the star shield it leaves blocks this many hits...
  shieldTime: 8, // ...for this many seconds
  healAmount: 2, // Dream Heal: the Star Burst heals you this much too
  dashSpeed: 22, // Dream Dash: your roll becomes a long dash...
  dashTime: 0.3,
  dashDamage: 1, // ...that hurts monsters you dash through
};

// The dream abilities the Dream Keeper's quests teach (see sideQuests.js). None of them has its own key.
export const DREAM_ABILITIES = {
  doubleJump: { flag: 'hasDoubleJump', name: 'Double Jump', icon: '🦘', how: 'jump again in mid-air' },
  dreamDash: { flag: 'hasDreamDash', name: 'Dream Dash', icon: '💨', how: 'your roll becomes a long dash that hurts monsters' },
  dreamHeal: { flag: 'hasDreamHeal', name: 'Dream Heal', icon: '🌈', how: 'your Star Burst heals you too' },
};

// Magic powers the Star Burst. You need a magic conduit (Aleli sells it at the dream shrine) to
// hold it. Defeating a monster gives (its health + its damage) / 4 magic points, at least 1.
export const MAGIC = {
  conduitPrice: 60, // coins
  max: 100,
  starting: 50, // magic points a new conduit comes with
  burstCost: 25, // each Star Burst
};

// Pip's crystal shop: his stall on the plaza opens once you show him the mystery crystal.
export const CRYSTALS = {
  heart: { price: 80, most: 2 }, // +1 max health each, up to `most` of them
  magic: { price: 30 }, // fills your magic all the way (needs a magic conduit)
  swift: { price: 120, speed: 1.1 }, // walk and run 10% faster, for good
  sea: { price: 90, swim: 1.25 }, // swim 25% faster, for good
  lucky: { price: 150, coins: 2 }, // every monster drops 2 more coins, for good
  frost: { price: 30 }, // Frosty Feet for five minutes: lava doesn't burn you (see BUFFS.frostyFeet)
};

// The fire island: a volcano across the sea. You can go once the Viniac is beaten (Captain Max
// on the jungle beach takes you, or sail there). Lava hurts to walk on.
export const FIRE = {
  lavaDamage: 1, // on lava, you get burned for this much...
  lavaEvery: 0.8, // ...every this many seconds
  lavaMonsters: { most: 2, every: [12, 28] }, // at most 2 at a time, one every 12-28 s when you're near a lava flow
};

// Fame: Bobert was banished from Tulane Kingdom, and wins back his name by helping people.
// Every quest you finish gives fame; with enough of it, Tulane's herald comes to Crestview Village.
export const FAME = {
  perQuest: 10,
  needed: 120, // fame to be summoned back to Tulane Kingdom
};

// King Stuart of Tulane, the last boss. He blocks hits from the front with his shield (a spin
// attack or a Sky Strike gets round it, or hit him from behind), sweeps his big sword, and calls
// his guards when he's hurt.
export const KING = {
  health: 40,
  damage: 3, // his sword sweep
  sweepRange: 3.4,
  guards: 2, // guards he calls (once, at half health)
};

// Thomage, the Nightmare Mage: the boss of the dream dimension (the Dream Keeper's last quest).
export const THOMAGE = {
  health: 40,
  damage: 2, // his star bolts and rune circles
  boltSpeed: 9,
  reward: 200,
};

// Velizar, the dragon boss of the fire island.
export const VELIZAR = {
  health: 30,
  flameDamage: 4, // his fire breath, to anyone in front of him
  biteDamage: 2, // a quick bite when you're close in front of him
  biteRange: 3.8,
  damage: 2, // bumping into him
  flameRange: 9,
  flameWidth: 0.55, // half-angle of the flames (radians)
  reward: 200,
};

// The sailboat: unlocked once you've been to the jungle, built at the dock.
export const BOAT = {
  price: 60, // coins
  speed: 9,
  fastSpeed: 14,
};

export const CHARIBDIS = {
  health: 30,
  damage: 5, // to anyone in the whirlpool...
  tickSeconds: 3, // ...every this many seconds
  whirlpoolRadius: 6,
  onSeconds: 5, // whirlpool spins this long...
  offSeconds: 9, // ...then stops this long, then starts again
  summonsHelpers: false, // true: calls 3 sharks or an eel each time the whirlpool starts
  maxHelpers: 6,
  // Extra ways it fights back (so it isn't too easy):
  pull: 2.2, // how hard the whirlpool drags you in
  shieldedWhileSpinning: true, // the spinning water protects it: attacks only work while it's stopped
  biteDamage: 3, // when the whirlpool is stopped, it lunges and bites anyone close...
  biteRange: 4.8,
  biteWindup: 0.9, // ...after opening its mouth wide for this long
  biteCooldown: 2.2,
  spitDamage: 1, // while the whirlpool spins, it spits water balls at you if you stay outside it
  spitEvery: 2,
  spitRange: 22,
};

// Saved games (press Esc in the game). Bump `version` after a big change to the game:
// saves made with a different version can't be loaded any more (they're not converted).
export const SAVES = {
  version: 2, // 2: wood, stone, arrows and golden health are gone
};

export const QUEST = {
  slimeHealth: 10, // sword hits (with the starting sword) to defeat the Gelationus Slime
  rewardCoins: 100,
};

// Drawing (performance). Things further than this from the camera aren't drawn.
export const RENDER = {
  npcDrawDistance: 110, // townspeople (each one is lots of little parts)
};
