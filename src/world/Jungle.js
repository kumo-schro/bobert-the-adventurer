import { Entity } from '../core/Entity.js';
import { VoxelBuilder } from '../core/VoxelBuilder.js';
import { stoneTexture, texturedVoxelMaterial } from '../core/textures.js';
import { IslandSurface } from '../style/IslandSurface.js';
import { instances } from '../style/models.js';
import { createRng, createNoise2D } from '../utils/random.js';
import { Chest } from '../entities/Chest.js';
import { FlyTrap, Snake, Gorilla, Frog, Panther } from '../entities/JungleMonsters.js';
import { SEED, PLACES } from '../config.js';

const CANOPY = ['#21c46b', '#18c9a0', '#2fd27a', '#4be3a0', '#7dff3a', '#18a9a0', '#ff5ec8'];
const FERNS = ['#1fae5a', '#18a9a0', '#2fd27a', '#5ad84a'];
const BLOOMS = ['#ff3b8d', '#ff8a3d', '#b07cff', '#ffe14d', '#36e6ff'];
const stoneMaterial = texturedVoxelMaterial(stoneTexture, { bevel: 0.14 });

/**
 * The jungle island, far across the sea. Captain Finn brings you here after Charibdis is
 * slain. Huge trees with vines, ferns, an old temple with treasure, and monsters: giant Venus
 * fly traps, snakes and gorillas. You can't swim away (the currents are too strong); talk to
 * Finn on the beach to go home. Master Oak lives in a clearing to the west, and the Vine (the
 * jungle's boss) grows to the east. Exposes `arrive`, `finnSpot`, `oakSpot`, `vineSpot`,
 * `portalSpot`; `travel(game)` takes you there.
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
    this.oakSpot = { x: x - 26, z: z + 6 }; // Master Oak's clearing
    this.vineSpot = { x: x + 26, z: z - 8 }; // where the Vine grows
    this.portalSpot = { x: x + 26, z: z + 1 }; // the dream portal opens here once the Vine is gone
    this.clearings = [
      { ...this.oakSpot, r: 6 },
      { ...this.vineSpot, r: 11 },
      { ...this.portalSpot, r: 4 },
    ];
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
    game.player.boat = null;
    game.teleport(this.arrive.x, this.arrive.z, { facing: this.arrive.facing });
    game.player.visitedJungle = true; // now a boat can be built at the dock
    game.questLog?.toast('Captain Finn takes you to the jungle island!');
  }

  buildGround() {
    const { rng } = this;
    const { x: X, z: Z } = this.center;
    // One smooth island surface: deep green jungle grass and a sandy beach.
    const surface = new IslandSurface({
      center: this.center,
      edge: (a) => this.edgeRadius(Math.cos(a), Math.sin(a)),
      maxRadius: this.radius + 12,
      segments: 160,
      rings: 44,
      swirl: 0.6,
      grassTint: '#a8e6a0',
    });
    this.object3d.add(surface.mesh);

    // Ferns and big jungle flowers.
    const ferns = [];
    const blooms = [];
    for (let i = 0; i < 260; i++) {
      const x = X + rng.range(-this.radius, this.radius);
      const z = Z + rng.range(-this.radius, this.radius);
      const dx = x - X;
      const dz = z - Z;
      if (Math.hypot(dx, dz) > this.edgeRadius(dx, dz) - 5) continue;
      const spot = { x, z, rotation: rng.range(0, Math.PI * 2), tiltX: rng.range(-0.1, 0.1), tiltZ: rng.range(-0.1, 0.1) };
      if (rng.chance(0.75)) ferns.push({ ...spot, scale: rng.range(0.55, 1.0), scaleY: rng.range(0.45, 0.7), color: rng.pick(FERNS) });
      else blooms.push({ ...spot, scale: rng.range(0.8, 1.2), color: rng.pick(BLOOMS) });
    }
    this.object3d.add(
      instances('bush', ferns, { castShadow: false, cellSize: 80 }),
      instances('tulip', blooms, { castShadow: false, cellSize: 80 }),
    );
  }

  /** An old mossy stone temple with two treasure chests inside. */
  buildTemple(game) {
    const { rng } = this;
    const b = new VoxelBuilder();
    const { x: X, z: Z } = this.templeSpot;
    const stone = ['#b9b3d6', '#c6c0e0', '#aaa4c8'];
    const moss = '#9fd8a8';
    // Stepped base: three big solid tiers.
    for (let level = 0; level < 3; level++) {
      const size = 14 - level * 3;
      b.box(X, level + 0.5, Z, size, 1, size, rng.pick(stone));
      // Mossy patches creeping over the edges.
      for (let i = 0; i < 6; i++) {
        const along = rng.range(-size / 2 + 1, size / 2 - 1);
        const side = rng.chance(0.5) ? -1 : 1;
        const [mx, mz] = rng.chance(0.5) ? [along, side * (size / 2)] : [side * (size / 2), along];
        b.box(X + mx, level + 0.9, Z + mz, rng.range(1, 2.4), 0.3, rng.range(1, 2.4), moss);
      }
    }
    // Pillars at the corners, with caps.
    for (const [px, pz] of [[-5.5, -5.5], [5.5, -5.5], [-5.5, 5.5], [5.5, 5.5]]) {
      b.box(X + px, 4.5, Z + pz, 1, 3, 1, rng.pick(stone));
      b.box(X + px, 6.15, Z + pz, 1.4, 0.3, 1.4, moss);
    }
    this.object3d.add(b.build({ material: stoneMaterial }));
    // The temple is a solid block you can't walk through; the treasure sits out front.
    game.colliders.push({ x: X, z: Z, halfX: 7, halfZ: 7 });
    game.add(new Chest({ x: X - 2, z: Z + 8.5 }, { coins: 40 }));
    game.add(new Chest({ x: X + 2, z: Z + 8.5 }, { coins: 40 }));
  }

  buildTrees(game) {
    const { rng } = this;
    const list = [];
    const { x: X, z: Z } = this.center;
    for (let attempt = 0; attempt < 2000 && this.trees.length < 70; attempt++) {
      const x = Math.floor(X + rng.range(-this.radius, this.radius)) + 0.5;
      const z = Math.floor(Z + rng.range(-this.radius, this.radius)) + 0.5;
      if (!this.isInside(x, z, 3)) continue;
      if (Math.hypot(x - this.arrive.x, z - this.arrive.z) < 8) continue; // keep the landing beach clear
      if (Math.abs(x - this.templeSpot.x) < 11 && Math.abs(z - this.templeSpot.z) < 13) continue;
      if (this.clearings.some((c) => Math.hypot(c.x - x, c.z - z) < c.r + 3)) continue;
      if (this.trees.some((t) => Math.hypot(t.x - x, t.z - z) < 6.5)) continue;

      // A tall jungle tree: bendy trunk, big drooping leaf pads, and vines hanging down.
      list.push({ x, z, rotation: rng.range(0, Math.PI * 2), scale: rng.range(0.9, 1.15), color: rng.pick(CANOPY) });
      const tree = { x, z, radius: 0.8 };
      this.trees.push(tree);
      game.colliders.push(tree);
      game.gathering?.addNode({ kind: 'wood', x, z, radius: 0.8 });
    }
    this.object3d.add(instances('jungle_tree', list, { cellSize: 80 }));
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
        if (this.clearings.some((c) => Math.hypot(c.x - x, c.z - z) < c.r + 4)) continue;
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
    for (let i = 0; i < 8; i++) {
      const s = pick(16);
      if (s) game.add(new Snake(s));
    }
    for (let i = 0; i < 3; i++) {
      const s = pick(22);
      if (s) game.add(new Gorilla(s));
    }
    for (let i = 0; i < 5; i++) {
      const s = pick(14);
      if (s) game.add(new Frog(s));
    }
    for (let i = 0; i < 3; i++) {
      const s = pick(24);
      if (s) game.add(new Panther(s));
    }
  }
}
