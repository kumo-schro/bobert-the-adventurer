import { Entity } from '../core/Entity.js';
import { VoxelBuilder } from '../core/VoxelBuilder.js';
import { barkTexture, leafTexture, stoneTexture, texturedVoxelMaterial, grassMaterial, sandMaterial } from '../core/textures.js';
import { createRng, createNoise2D } from '../utils/random.js';
import { vary } from '../utils/color.js';
import { Chest } from '../entities/Chest.js';
import { FlyTrap, Snake, Gorilla } from '../entities/JungleMonsters.js';
import { SEED, PLACES } from '../config.js';

const GRASS = ['#2f9e3a', '#38a83f', '#278a33', '#44b04a'];
const SAND = '#ecd38f';
const WET_SAND = '#d9bb72';
const barkMaterial = texturedVoxelMaterial(barkTexture);
const leafMaterial = texturedVoxelMaterial(leafTexture);
const stoneMaterial = texturedVoxelMaterial(stoneTexture);

/**
 * The jungle island, far across the sea. Captain Finn brings you here after Charibdis is
 * slain. Huge trees with vines, ferns, an old temple with treasure, and monsters: giant Venus
 * fly traps, snakes and gorillas. You can't swim away (the currents are too strong); talk to
 * Finn on the beach to go home. Exposes `arrive` and `finnSpot`; `travel(game)` takes you there.
 */
export class Jungle extends Entity {
  constructor({ x, z, radius } = PLACES.jungle) {
    super();
    this.center = { x, z };
    this.radius = radius;
    this.noise = createNoise2D(SEED + 111);
    this.rng = createRng(SEED + 111);
    // You arrive on the south beach.
    const south = this.edgeRadius(0, 1) - 4;
    this.arrive = { x, z: z + south - 2, facing: Math.PI };
    this.finnSpot = { x: x + 2.5, z: z + south - 1.5 };
    this.templeSpot = { x: x - 4, z: z - radius * 0.45 };
    this.trees = [];
  }

  edgeRadius(dx, dz) {
    const a = Math.atan2(dz, dx);
    return this.radius + (this.noise(Math.cos(a) * 1.8 + 20, Math.sin(a) * 1.8 + 20) - 0.5) * 18;
  }

  isInside(x, z, margin = 0) {
    const dx = x - this.center.x;
    const dz = z - this.center.z;
    return Math.hypot(dx, dz) < this.edgeRadius(dx, dz) - 2 - margin;
  }

  heightAt() {
    return null;
  }

  onAdd(game) {
    game.lands.push(this);
    game.jungle = this;
    this.buildGround();
    this.buildTemple(game);
    this.buildTrees(game);
    this.spawnMonsters(game);
  }

  /** Captain Finn takes you here. */
  travel(game) {
    game.teleport(this.arrive.x, this.arrive.z, { facing: this.arrive.facing });
    game.questLog?.toast('Captain Finn takes you to the jungle island!');
  }

  buildGround() {
    const { rng } = this;
    const grass = new VoxelBuilder();
    const sand = new VoxelBuilder();
    const plants = new VoxelBuilder();
    const { x: X, z: Z } = this.center;
    const reach = this.radius + 10;
    for (let ix = Math.floor(X - reach); ix < X + reach; ix++) {
      for (let iz = Math.floor(Z - reach); iz < Z + reach; iz++) {
        const x = ix + 0.5;
        const z = iz + 0.5;
        const dx = x - X;
        const dz = z - Z;
        const d = Math.hypot(dx, dz);
        const edge = this.edgeRadius(dx, dz);
        if (d > edge) continue;
        if (d > edge - 1.5) sand.add(x, -1.5, z, vary(WET_SAND, rng));
        else if (d > edge - 4) sand.add(x, -0.5, z, vary(SAND, rng));
        else {
          grass.add(x, -0.5, z, vary(rng.pick(GRASS), rng, 0.06));
          // Ferns and big jungle flowers
          if (rng.chance(0.05)) {
            const c = vary('#2a8a35', rng, 0.08);
            plants.box(x, 0.25, z, 0.9, 0.12, 0.25, c);
            plants.box(x, 0.25, z, 0.25, 0.12, 0.9, c);
            plants.box(x, 0.4, z, 0.5, 0.12, 0.5, c);
          } else if (rng.chance(0.012)) {
            plants.box(x, 0.3, z, 0.12, 0.6, 0.12, '#2a8a35');
            plants.box(x, 0.65, z, 0.5, 0.12, 0.5, rng.pick(['#ff3b8d', '#ff9a1f', '#b46bff', '#ffd23f']));
            plants.box(x, 0.72, z, 0.16, 0.06, 0.16, '#ffe08a');
          }
        }
      }
    }
    this.object3d.add(
      grass.build({ castShadow: false, material: grassMaterial }),
      sand.build({ castShadow: false, material: sandMaterial }),
      plants.build({ castShadow: false }),
    );
  }

  /** An old mossy stone temple with two treasure chests inside. */
  buildTemple(game) {
    const { rng } = this;
    const b = new VoxelBuilder();
    const { x: X, z: Z } = this.templeSpot;
    const stone = ['#8d8f96', '#9a9ca3', '#7d8088'];
    const moss = ['#3f8f4a', '#4fa35a'];
    // Stepped base
    for (let level = 0; level < 3; level++) {
      const half = 7 - level * 1.5;
      for (let ix = -half; ix < half; ix++) {
        for (let iz = -half; iz < half; iz++) {
          const edge = ix === -half || iz === -half || ix === half - 1 || iz === half - 1;
          if (!edge && level < 2) continue;
          b.add(X + ix + 0.5, level + 0.5, Z + iz + 0.5, vary(rng.chance(0.25) ? rng.pick(moss) : rng.pick(stone), rng, 0.05));
        }
      }
    }
    // Pillars at the corners
    for (const [px, pz] of [[-6, -6], [5, -6], [-6, 5], [5, 5]]) {
      for (let y = 3; y < 6; y++) b.add(X + px + 0.5, y + 0.5, Z + pz + 0.5, vary(rng.pick(stone), rng, 0.05));
    }
    this.object3d.add(b.build({ material: stoneMaterial }));
    // The temple is a solid block you can't walk through; the treasure sits out front.
    game.colliders.push({ x: X, z: Z, halfX: 7, halfZ: 7 });
    game.add(new Chest({ x: X - 2, z: Z + 8.5 }, { coins: 40 }));
    game.add(new Chest({ x: X + 2, z: Z + 8.5 }, { coins: 40 }));
  }

  buildTrees(game) {
    const { rng } = this;
    const trunks = new VoxelBuilder();
    const leaves = new VoxelBuilder();
    const { x: X, z: Z } = this.center;
    for (let attempt = 0; attempt < 2000 && this.trees.length < 70; attempt++) {
      const x = Math.floor(X + rng.range(-this.radius, this.radius)) + 0.5;
      const z = Math.floor(Z + rng.range(-this.radius, this.radius)) + 0.5;
      if (!this.isInside(x, z, 3)) continue;
      if (Math.hypot(x - this.arrive.x, z - this.arrive.z) < 8) continue; // keep the landing beach clear
      if (Math.abs(x - this.templeSpot.x) < 11 && Math.abs(z - this.templeSpot.z) < 13) continue;
      if (this.trees.some((t) => Math.hypot(t.x - x, t.z - z) < 6.5)) continue;

      // A tall jungle tree: long trunk, flat layered canopy, and vines hanging down.
      const h = rng.int(9, 13);
      for (let y = 0; y < h; y++) trunks.add(x, y + 0.5, z, vary('#6b4a2b', rng, 0.05));
      const palette = ['#1f8a3a', '#2a9e45', '#17752f'];
      for (const [dy, r] of [[0, 3.5], [1, 2.6], [2, 1.5]]) {
        for (let dx = -Math.ceil(r); dx <= Math.ceil(r); dx++) {
          for (let dz = -Math.ceil(r); dz <= Math.ceil(r); dz++) {
            if (dx * dx + dz * dz > r * r + rng.range(-1, 1)) continue;
            leaves.add(x + dx, h + dy + 0.5, z + dz, vary(rng.pick(palette), rng, 0.05));
            if (dy === 0 && dx * dx + dz * dz > (r - 1) ** 2 && rng.chance(0.18)) {
              const len = rng.int(2, 5);
              for (let v = 1; v <= len; v++) leaves.box(x + dx, h - v + 0.5, z + dz, 0.25, 1, 0.25, '#2e7d32'); // vine
            }
          }
        }
      }
      const tree = { x, z, radius: 0.8 };
      this.trees.push(tree);
      game.colliders.push(tree);
      game.gathering?.addNode({ kind: 'wood', x, z, radius: 0.8 });
    }
    this.object3d.add(trunks.build({ material: barkMaterial }), leaves.build({ material: leafMaterial }));
  }

  spawnMonsters(game) {
    const rng = createRng(SEED + 112);
    const spots = [];
    const pick = (minFromBeach) => {
      for (let i = 0; i < 300; i++) {
        const x = this.center.x + rng.range(-this.radius, this.radius);
        const z = this.center.z + rng.range(-this.radius, this.radius);
        if (!this.isInside(x, z, 2)) continue;
        if (Math.hypot(x - this.arrive.x, z - this.arrive.z) < minFromBeach) continue;
        if (Math.abs(x - this.templeSpot.x) < 9 && Math.abs(z - this.templeSpot.z) < 11) continue;
        if (this.trees.some((t) => Math.hypot(t.x - x, t.z - z) < 2)) continue;
        if (spots.some((s) => Math.hypot(s.x - x, s.z - z) < 7)) continue;
        const spot = { x, z };
        spots.push(spot);
        return spot;
      }
      return null;
    };
    for (let i = 0; i < 6; i++) {
      const s = pick(14);
      if (s) game.add(new FlyTrap(s));
    }
    for (let i = 0; i < 5; i++) {
      const s = pick(16);
      if (s) game.add(new Snake(s));
    }
    for (let i = 0; i < 3; i++) {
      const s = pick(22);
      if (s) game.add(new Gorilla(s));
    }
  }
}
