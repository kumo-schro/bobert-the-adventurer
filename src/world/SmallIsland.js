import { Entity } from '../core/Entity.js';
import { VoxelBuilder } from '../core/VoxelBuilder.js';
import { grassMaterial, sandMaterial, blockMaterial } from '../core/textures.js';
import { createRng } from '../utils/random.js';
import { vary } from '../utils/color.js';
import { Chest } from '../entities/Chest.js';
import { SEED, SEA } from '../config.js';

const SAND = '#f5dfa0';
const WET_SAND = '#e3c47f';
const GRASS = ['#5cc93b', '#6fd64a', '#4fb83a'];
const ROCK = ['#c9c2b5', '#b8b1a4', '#aaa497'];

/** Adds a round sandy island with a grassy middle (like a tiny main island) to two VoxelBuilders. */
export function islandGround({ grass, sand }, rng, X, Z, r) {
  for (let ix = Math.floor(X - r); ix < X + r; ix++) {
    for (let iz = Math.floor(Z - r); iz < Z + r; iz++) {
      const x = ix + 0.5;
      const z = iz + 0.5;
      const d = Math.hypot(x - X, z - Z);
      if (d > r) continue;
      if (d > r - 1.5) sand.box(x, (SEA.floor - 1) / 2, z, 1, -1 - SEA.floor, 1, vary(WET_SAND, rng)); // down to the seabed
      else if (d > r - 4) sand.add(x, -0.5, z, vary(SAND, rng));
      else grass.add(x, -0.5, z, vary(rng.pick(GRASS), rng, 0.06));
    }
  }
}

/** A berry bush or a boulder at (x, z). */
export function bushOrRock(builder, rng, x, z) {
  if (rng.chance(0.5)) {
    builder.box(x, 0.4, z, 1.2, 0.8, 1.2, vary('#3fae3a', rng, 0.06));
    builder.box(x + 0.2, 0.85, z, 0.2, 0.2, 0.2, '#ff4d6d');
  } else {
    builder.box(x, 0.3, z, 1.1, 0.6, 0.9, vary(rng.pick(ROCK), rng, 0.05));
  }
}

/**
 * A little island out at sea: a place to rest while swimming. Some have a treasure chest.
 * Walk off the beach to swim on. Registers as walkable land.
 */
export class SmallIsland extends Entity {
  constructor({ x, z, radius = 8, chest = 0 }, index = 0) {
    super();
    this.center = { x, z };
    this.radius = radius;
    this.chestCoins = chest;
    this.swimFromShore = true;
    const rng = createRng(SEED + 60 + index);
    const ground = { grass: new VoxelBuilder(), sand: new VoxelBuilder() };
    const props = new VoxelBuilder();
    islandGround(ground, rng, x, z, radius);
    for (let i = 0; i < Math.round(radius / 2); i++) {
      const a = rng.range(0, Math.PI * 2);
      const d = rng.range(1.5, radius - 4);
      bushOrRock(props, rng, x + Math.cos(a) * d, z + Math.sin(a) * d);
    }
    this.object3d.add(
      ground.grass.build({ castShadow: false, material: grassMaterial }),
      ground.sand.build({ castShadow: false, material: sandMaterial }),
      props.build({ material: blockMaterial }),
    );
  }

  onAdd(game) {
    game.lands.push(this);
    if (this.chestCoins) game.add(new Chest({ x: this.center.x + 0.5, z: this.center.z - 0.5 }, { coins: this.chestCoins }));
  }

  isInside(x, z, margin = 0) {
    return Math.hypot(x - this.center.x, z - this.center.z) < this.radius - 2 - margin;
  }

  heightAt() {
    return null;
  }
}
