import * as THREE from 'three';

// Central place for tweakable world settings. Change these to restyle the game.

export const SEED = 1337;

export const WORLD = {
  islandRadius: 100, // radius of the grassy island, in voxels
  treeCount: 115,
  treeSpacing: 9, // minimum distance between trees
  flowerCount: 2400,
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

// One full day and night every two minutes. Only the lighting changes (and villagers go to bed).
export const DAY = {
  length: 120, // seconds for a whole day + night
  startAt: 0.05, // where in the day the game starts (0 = sunrise, 0.5 = sunset)
};

export const CAMERA = {
  yaw: 0.9, // starting angle around the player (radians)
  pitch: 0.35,
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
  boulderCount: 26,
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
  radius: 260, // how far out you can swim
  swimDepth: 3.4, // swimming is underwater: your feet are this far below the surface
  monsterDepth: 2.4, // sea monsters swim this far down too
  floor: -12, // the sandy seabed
  // Sharks are common, eels are rare (two live by the tower island).
  sharks: [
    { x: 135, z: 2 },
    { x: 140, z: 55 },
    { x: 130, z: -45 },
    { x: 50, z: 145 },
    { x: -140, z: 60 },
    { x: -100, z: -130 },
    { x: 70, z: -140 },
    { x: 200, z: -40 },
    { x: 20, z: 175 },
    { x: -65, z: 150 },
    { x: -175, z: -40 },
    { x: -40, z: -170 },
    { x: 140, z: -140 },
    { x: 215, z: 45 },
    { x: 150, z: 160 },
    { x: -200, z: 100 },
    { x: 120, z: 110 },
    { x: -130, z: -180 },
  ],
  // Little islands to rest on. `chest` puts a treasure chest on it.
  islands: [
    { x: 85, z: 150, radius: 8, chest: 20 },
    { x: -135, z: 105, radius: 9 },
    { x: -150, z: -115, radius: 7, chest: 25 },
    { x: 10, z: -160, radius: 8 },
    { x: 190, z: -80, radius: 7 },
    { x: 195, z: 115, radius: 6, chest: 30 },
  ],
};

// Where things are on the island.
export const PLACES = {
  cave: { x: 24, z: -48 }, // center of the mountain with the slime's cave
  stoneCircle: { x: -44, z: -20 }, // the rainbow stones puzzle
  slimeMeadow: { x: -36, z: 38 }, // where the farmer's slime problem is
  dockZ: 6, // the dock sticks out of the east beach at this z
  towerIsland: { x: 170, z: 22, radius: 18 }, // island with the big tower and the mystery crystal
  kraken: { x: 100, z: -185 },
  seaSerpent: { x: -200, z: 10 },
  charibdisCave: { x: -30, z: 205 }, // rocky sea cave, locked with the key
  jungle: { x: 0, z: -1000, radius: 55 }, // the jungle island, far across the sea (Finn takes you)
  cellar: { x: 900, z: 0 },
  dream: { x: -1000, z: 0, y: 140 }, // the dream dimension, floating high in the sky far away // Old Man Keegan's cellar, under the trapdoor (built far away, out of sight)
};

// Dream abilities, bought at the dream shrine with dream points.
export const DREAM = {
  dashCost: 4,
  invisibleCost: 4,
  dashSpeed: 24,
  dashTime: 0.22, // seconds of dashing
  dashCooldown: 1.2,
  invisibleTime: 6, // seconds you stay invisible...
  invisibleCooldown: 18, // ...and how long before you can do it again
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
  tickSeconds: 2, // ...every this many seconds
  whirlpoolRadius: 6,
  onSeconds: 10, // whirlpool spins this long...
  offSeconds: 10, // ...then stops this long, then summons helpers and starts again
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

export const QUEST = {
  slimeHealth: 10, // sword hits (with the starting sword) to defeat the Gelationus Slime
  rewardCoins: 100,
};
