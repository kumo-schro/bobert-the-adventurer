import * as THREE from 'three';

// Central place for tweakable world settings. Change these to restyle the game.

export const SEED = 1337;

export const WORLD = {
  islandRadius: 76, // radius of the grassy island, in voxels
  treeCount: 70,
  treeSpacing: 9, // minimum distance between trees
  flowerCount: 1400,
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
  plazaRadius: 7,
  roofColors: ['#d9493f', '#3f7fd9', '#e08a2e', '#7a4fd1', '#2fa36b', '#d94f9a'],
  wanderRadius: 14, // how far villagers stroll from the plaza
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

// What the blacksmith's forge sells. Upgrades also need wood and stone.
export const FORGE = {
  prices: { shield: 25, bow: 40, arrows: 20, axe: 10, pickaxe: 10 },
  upgrades: {
    sword: { coins: 40, wood: 6, stone: 6 },
    powerBow: { coins: 50, wood: 8, stone: 4 },
    ironShield: { coins: 40, wood: 2, stone: 10 },
    armor: { coins: 60, wood: 4, stone: 12 },
  },
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
  perNode: 3, // how much one tree or boulder gives before it needs a rest
  regrowSeconds: 60,
  boulderCount: 16,
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
  // Sharks are common, eels are rare (two live by the tower island).
  sharks: [
    { x: 104, z: 4 },
    { x: 110, z: 40 },
    { x: 96, z: -30 },
    { x: 40, z: 120 },
    { x: -110, z: 50 },
    { x: -90, z: -120 },
    { x: 60, z: -120 },
    { x: 160, z: -10 },
    { x: 20, z: 175 },
    { x: -60, z: 140 },
    { x: -170, z: -40 },
    { x: -40, z: -170 },
    { x: 130, z: -130 },
    { x: 210, z: 40 },
    { x: 150, z: 160 },
    { x: -200, z: 100 },
    { x: 100, z: 90 },
    { x: -130, z: -180 },
  ],
  // Little islands to rest on. `chest` puts a treasure chest on it.
  islands: [
    { x: 75, z: 135, radius: 8, chest: 20 },
    { x: -125, z: 95, radius: 9 },
    { x: -140, z: -110, radius: 7, chest: 25 },
    { x: 10, z: -145, radius: 8 },
    { x: 180, z: -60, radius: 7 },
    { x: 190, z: 110, radius: 6, chest: 30 },
  ],
};

// Where things are on the island.
export const PLACES = {
  cave: { x: 24, z: -48 }, // center of the mountain with the slime's cave
  stoneCircle: { x: -44, z: -20 }, // the rainbow stones puzzle
  slimeMeadow: { x: -36, z: 38 }, // where the farmer's slime problem is
  dockZ: 6, // the dock sticks out of the east beach at this z
  towerIsland: { x: 138, z: 22, radius: 18 }, // island with the big tower and the mystery crystal
  kraken: { x: 95, z: -170 },
  seaSerpent: { x: -190, z: 10 },
  charibdisCave: { x: -30, z: 195 }, // rocky sea cave, locked with the key
  jungle: { x: 0, z: -1000, radius: 55 }, // the jungle island, far across the sea (Finn takes you)
  cellar: { x: 900, z: 0 }, // Old Man Keegan's cellar, under the trapdoor (built far away, out of sight)
};

export const CHARIBDIS = {
  health: 15,
  damage: 5, // to anyone in the whirlpool...
  tickSeconds: 3, // ...every this many seconds
  whirlpoolRadius: 6,
  onSeconds: 10, // whirlpool spins this long...
  offSeconds: 30, // ...then stops this long, then summons helpers and starts again
  maxHelpers: 6,
};

export const QUEST = {
  slimeHealth: 10, // sword hits (with the starting sword) to defeat the Gelationus Slime
  rewardCoins: 100,
};
