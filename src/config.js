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
  regenDelay: 6, // seconds without getting hit before hearts start coming back
  regenInterval: 4, // seconds per heart while regenerating
};

export const SWORDS = [
  { name: 'Wooden-Handled Sword', damage: 1, reach: 1.1 },
  { name: "Knight's Sword", damage: 2, reach: 1.5 },
];

// What the blacksmith's forge sells. Like Hana's oven, you help build a bigger forge (with wood
// and stone) to unlock all the upgraded things.
export const FORGE = {
  prices: { shield: 25, bow: 40, arrows: 20, axe: 10, pickaxe: 10 },
  biggerForge: { coins: 40, wood: 20, stone: 20 },
  upgrades: { sword: 60, powerBow: 70, ironShield: 60, armor: 90, steelAxe: 30, steelPickaxe: 30 },
  arrowsPerBundle: 10, // how many arrows you get for prices.arrows
  armorHearts: 2, // extra max hearts from the armor
};

// What the baker sells. `heals` is how many hearts it brings back; `extra` is golden extra
// hearts on top (they disappear once you take that much damage). Press F to eat.
// `upgraded` foods only appear after Hana's oven is upgraded with wood and stone.
export const FOOD = {
  carry: 5, // how much food you can carry at once
  maxExtra: 5, // most golden hearts you can have at once
  menu: [
    { id: 'apple', name: 'Apple', icon: '🍎', heals: 1, extra: 0, price: 2 },
    { id: 'bread', name: 'Bread', icon: '🍞', heals: 2, extra: 0, price: 4 },
    { id: 'pie', name: 'Berry Pie', icon: '🥧', heals: 99, extra: 0, price: 15 }, // 99 = all your hearts
    { id: 'goldenApple', name: 'Golden Apple', icon: '🍏', heals: 1, extra: 1, price: 8, upgraded: true },
    { id: 'stew', name: 'Hearty Stew', icon: '🍲', heals: 3, extra: 2, price: 15, upgraded: true },
    { id: 'feast', name: 'Royal Feast', icon: '🍗', heals: 99, extra: 3, price: 30, upgraded: true },
  ],
  ovenUpgrade: { coins: 20, wood: 6, stone: 8 },
};

// Wood and stone: chop trees with an axe and mine boulders with a pickaxe (press T next to them).
export const GATHER = {
  perNode: 3, // how many chops (or swings of the pickaxe) one tree or boulder takes before it needs a rest
  steelBonus: 2, // a steel axe / pickaxe gets this much per chop instead of 1
  regrowSeconds: 60,
  boulderCount: 40,
};

export const BOW = {
  damage: 1,
  secondsPerDamage: 2, // power bow: +1 damage for every 2 seconds you hold the bow key...
  maxDamage: 5, // ...up to 5
  drawTime: 1, // seconds to pull the string back before the arrow flies
  startArrows: 10, // arrows that come with the bow
  maxArrows: 100, // the quiver holds this many
  speed: 28,
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
// duel and he teaches you to dodge.
export const JACKSON = {
  island: { x: 247, z: -104 }, // he trains on this little island
  health: 6, // spin attacks it takes to beat him (each spin does at least 2)
  damage: 2, // his quick jabs
  reward: 60,
};

// Dodging (Master Jackson teaches it): press X to leap out of the way. Nothing can hurt you mid-leap.
export const DODGE = {
  speed: 13,
  time: 0.28, // seconds of leaping
  cooldown: 0.7,
};

// The dream dimension. Each Dream Keeper quest teaches two dream abilities. Using them takes magic
// points (see MAGIC). These are the abilities' own settings.
export const DREAM = {
  speedBoost: 1.35, // Speed Boots: run and swim this much faster
  healCooldown: 60, // Dream Heal: seconds before you can heal again
  starShieldHits: 3, // Star Shield: blocks this many hits...
  starShieldTime: 12, // ...or until this many seconds pass
  starShieldCooldown: 30,
  wispRespawn: 25, // seconds before a popped wandering wisp floats back
  dashSpeed: 24,
  dashTime: 0.22, // seconds of dashing
  dashCooldown: 1.2,
  invisibleTime: 6, // seconds you stay invisible...
  invisibleCooldown: 18, // ...and how long before you can do it again
};

// The dream abilities. Each one is taught by a Dream Keeper quest (see sideQuests.js), and using
// it costs magic points (MAGIC.cost has the same names).
export const DREAM_ABILITIES = {
  doubleJump: { flag: 'hasDoubleJump', name: 'Double Jump', icon: '🦘', how: 'press Space again in mid-air to jump a second time' },
  speedBoots: { flag: 'hasSpeedBoots', name: 'Speed Boots', icon: '👟', how: 'run and swim much faster' },
  dash: { flag: 'hasDash', name: 'Dash', icon: '💨', how: 'press L to dash forward in a flash' },
  invisible: { flag: 'hasInvisibility', name: 'Invisibility', icon: '👻', how: "press I to turn invisible, so monsters can't see you" },
  dreamHeal: { flag: 'hasDreamHeal', name: 'Dream Heal', icon: '🌈', how: 'press U to heal all the way' },
  starShield: { flag: 'hasStarShield', name: 'Star Shield', icon: '🔮', how: 'press O for a starlight bubble that blocks the next 3 hits' },
};

// Magic points power the dream abilities. You need a magic conduit (Aleli sells it at the dream
// shrine) to hold them. Defeating a monster gives (its health + its damage) / 4 magic points,
// at least 1.
export const MAGIC = {
  conduitPrice: 60, // coins
  max: 100,
  starting: 20, // magic points a new conduit comes with
  cost: {
    dash: 5,
    invisible: 20,
    doubleJump: 3,
    speedBoots: 1, // per second while you're moving
    dreamHeal: 25,
    starShield: 20,
  },
};

// Pip's crystal shop: his stall on the plaza opens once you show him the mystery crystal.
export const CRYSTALS = {
  heart: { price: 80, most: 2 }, // +1 max health each, up to `most` of them
  magic: { price: 15, points: 30 }, // fills up 30 magic points (needs a magic conduit)
  bigMagic: { price: 40, points: 100 }, // fills your magic all the way
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
  wood: 40,
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
  version: 1,
};

export const QUEST = {
  slimeHealth: 10, // sword hits (with the starting sword) to defeat the Gelationus Slime
  rewardCoins: 100,
};
