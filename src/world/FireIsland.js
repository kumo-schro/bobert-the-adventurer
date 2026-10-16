import * as THREE from 'three';
import { Entity } from '../core/Entity.js';
import { VoxelBuilder } from '../core/VoxelBuilder.js';
import { stoneTexture, texturedVoxelMaterial } from '../core/textures.js';
import { createRng, createNoise2D } from '../utils/random.js';
import { vary } from '../utils/color.js';
import { LavaMonster } from '../entities/LavaMonster.js';
import { EmberBat, MagmaSlime, ObsidianGolem } from '../entities/FireMonsters.js';
import { SEED, PLACES, SEA, FIRE } from '../config.js';

const BASALT = ['#3a3533', '#433d3a', '#352f2d', '#4a4240'];
const ASH = ['#6e6560', '#7a706a'];
const BLACK_SAND = '#2b2726';
const rockMaterial = texturedVoxelMaterial(stoneTexture);
// Lava glows on its own (and pulses a little, see update).
const lavaMaterial = new THREE.MeshLambertMaterial({ color: '#ffffff', emissive: '#ff4a12', emissiveIntensity: 0.85 });

/**
 * The fire island: a volcano island far across the sea, open once the Viniac is beaten. Captain
 * Max (on the jungle beach) takes you here, or you can sail your boat. Rivers of lava run down
 * from the volcano: walking on them burns (Frosty Feet from Pip's Frost Crystal stops that), and
 * now and then a lava monster climbs out of one. Velizar the dragon lives in the lair beside the
 * volcano. Exposes `arrive`, `finnSpot`, `emberSpot`, `lairSpot`; `travel(game)` takes you there.
 */
export class FireIsland extends Entity {
  constructor({ x, z, radius } = PLACES.fireIsland) {
    super();
    this.center = { x, z };
    this.radius = radius;
    this.noise = createNoise2D(SEED + 131);
    this.rng = createRng(SEED + 131);
    // You arrive on the south beach, looking up at the volcano.
    const south = this.edgeRadius(0, -1) - 4;
    this.arrive = { x, z: z - south + 2, facing: 0 };
    this.finnSpot = { x: x - 2.5, z: z - south + 1.5 };
    this.emberSpot = { x: x + 3, z: z - south + 6 };
    this.volcano = { x: x + 6, z: z + 24, r: 13 };
    this.lairSpot = { x: x - 24, z: z + 17 }; // Velizar's lair, beside the volcano
    // Lava rivers (lines from the volcano) and pools. Lava is this wide.
    this.lavaWidth = 2.6;
    this.flows = [
      [[x + 1, z + 13], [x - 6, z + 4], [x - 16, z - 2], [x - 31, z - 7]],
      [[x + 13, z + 14], [x + 18, z + 4], [x + 22, z - 10], [x + 33, z - 19]],
    ];
    this.pools = [
      { x: x - 9, z: z - 21, r: 3 },
      { x: x + 30, z: z + 6, r: 2.5 },
    ];
    this.lavaPoints = []; // spots along the lava where monsters can climb out
    this.monsterTimer = 6;
    this.emberTimer = 0;
  }

  edgeRadius(dx, dz) {
    const a = Math.atan2(dz, dx);
    return this.radius + (this.noise(Math.cos(a) * 1.6 + 40, Math.sin(a) * 1.6 + 40) - 0.5) * 14;
  }

  isInside(x, z, margin = 0) {
    const dx = x - this.center.x;
    const dz = z - this.center.z;
    return Math.hypot(dx, dz) < this.edgeRadius(dx, dz) - 2 - margin;
  }

  heightAt() {
    return null;
  }

  /** Is (x, z) on a lava river or pool? */
  isLava(x, z) {
    const half = this.lavaWidth / 2;
    for (const flow of this.flows) {
      for (let i = 0; i < flow.length - 1; i++) {
        if (distToSegment(x, z, flow[i], flow[i + 1]) < half) return true;
      }
    }
    return this.pools.some((p) => Math.hypot(x - p.x, z - p.z) < p.r);
  }

  /** Somewhere on the island (and not in the volcano)? */
  contains(x, z) {
    return this.isInside(x, z, -6);
  }

  onAdd(game) {
    game.lands.push(this);
    game.fireIsland = this;
    this.buildGround();
    this.buildVolcano(game);
    this.buildLair(game);
    this.buildRocks(game);
    this.spawnMonsters(game);
  }

  /** Ember bats, magma slimes and obsidian golems around the island (not on the landing beach). */
  spawnMonsters(game) {
    const rng = createRng(SEED + 137);
    const { x: X, z: Z } = this.center;
    const spots = [];
    const pick = (from) => {
      for (let attempt = 0; attempt < 200; attempt++) {
        const x = X + rng.range(-this.radius, this.radius);
        const z = Z + rng.range(-this.radius, this.radius);
        if (!this.isInside(x, z, 4) || this.isLava(x, z) || this.nearLava(x, z, 2)) continue;
        if (Math.hypot(x - this.arrive.x, z - this.arrive.z) < from) continue;
        if (Math.hypot(x - this.volcano.x, z - this.volcano.z) < this.volcano.r + 3) continue;
        if (Math.hypot(x - this.lairSpot.x, z - this.lairSpot.z) < 14) continue;
        if (spots.some((s) => Math.hypot(s.x - x, s.z - z) < 7)) continue;
        const spot = { x, z };
        spots.push(spot);
        return spot;
      }
      return null;
    };
    for (const [Kind, count, from] of [[EmberBat, 7, 16], [MagmaSlime, 8, 14], [ObsidianGolem, 3, 24]]) {
      for (let i = 0; i < count; i++) {
        const s = pick(from);
        if (s) game.add(new Kind(s));
      }
    }
  }

  /** Captain Max (or your boat) brings you here. */
  travel(game) {
    game.player.boat = null;
    game.teleport(this.arrive.x, this.arrive.z, { facing: this.arrive.facing });
    game.player.visitedFire = true;
    game.questLog?.remove('fireIsland');
    game.questLog?.toast('You arrived at the fire island! Careful: lava burns.');
  }

  buildGround() {
    const { rng } = this;
    const ground = new VoxelBuilder();
    const sand = new VoxelBuilder();
    const lava = new VoxelBuilder();
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
        if (d > edge - 1.5) sand.box(x, (SEA.floor - 1) / 2, z, 1, -1 - SEA.floor, 1, vary(BLACK_SAND, rng));
        else if (d > edge - 3.5) sand.add(x, -0.5, z, vary(BLACK_SAND, rng, 0.08));
        else if (this.isLava(x, z)) {
          lava.box(x, -0.15, z, 1, 0.2, 1, rng.pick(['#ff5a1f', '#ff7a1f', '#ff3b12', '#ffb02e']));
          ground.add(x, -0.75, z, '#2a2422'); // the lava's bed
          this.lavaPoints.push({ x, z });
        } else ground.add(x, -0.5, z, vary(rng.chance(0.15) ? rng.pick(ASH) : rng.pick(BASALT), rng, 0.06));
      }
    }
    // Keep only a few of the lava spots for monsters to climb out of.
    this.lavaPoints = this.lavaPoints.filter((_, i) => i % 9 === 0);
    this.lava = lava.build({ castShadow: false, receiveShadow: false, material: lavaMaterial });
    this.object3d.add(ground.build({ castShadow: false, material: rockMaterial }), sand.build({ castShadow: false }), this.lava);
  }

  /** The volcano: a stack of dark rock rings with a glowing crater, and lava down its side. */
  buildVolcano(game) {
    const { rng } = this;
    const rock = new VoxelBuilder();
    const glow = new VoxelBuilder();
    const { x: VX, z: VZ, r: R } = this.volcano;
    const height = 14;
    for (let y = 0; y < height; y++) {
      const r = R * (1 - (y / height) * 0.65);
      const crater = y >= height - 2 ? r - 3 : 0;
      for (let ix = Math.floor(VX - r); ix <= VX + r; ix++) {
        for (let iz = Math.floor(VZ - r); iz <= VZ + r; iz++) {
          const d = Math.hypot(ix + 0.5 - VX, iz + 0.5 - VZ);
          if (d > r || d < r - 2.5 || d < crater) continue; // a hollow shell, open at the top
          rock.add(ix + 0.5, y + 0.5, iz + 0.5, vary(rng.pick(BASALT), rng, 0.06));
        }
      }
    }
    // Lava filling the crater, and streaks running down the front toward the rivers
    const top = R * 0.35;
    for (let ix = Math.floor(VX - top); ix <= VX + top; ix++) {
      for (let iz = Math.floor(VZ - top); iz <= VZ + top; iz++) {
        if (Math.hypot(ix + 0.5 - VX, iz + 0.5 - VZ) < top - 0.5) glow.add(ix + 0.5, height - 1.6, iz + 0.5, rng.pick(['#ff5a1f', '#ffb02e', '#ff3b12']));
      }
    }
    for (const [dx, dz] of [[-0.45, -0.9], [0.5, -0.85]]) {
      for (let y = 0; y < height; y++) {
        const r = R * (1 - (y / height) * 0.65) - 0.4;
        glow.box(VX + dx * r, y + 0.5, VZ + dz * r, 1.4, 1.02, 1.4, rng.pick(['#ff5a1f', '#ff7a1f']));
      }
    }
    this.object3d.add(rock.build({ material: rockMaterial }), glow.build({ castShadow: false, material: lavaMaterial }));
    game.colliders.push({ x: VX, z: VZ, radius: R - 0.5 });
    const light = new THREE.PointLight('#ff6a2a', 30, 40, 1.6);
    light.position.set(VX, height + 2, VZ);
    this.object3d.add(light);
  }

  /** Velizar's lair: a ring of tall obsidian spikes around a flat, scorched floor. */
  buildLair(game) {
    const { rng } = this;
    const b = new VoxelBuilder();
    const { x: LX, z: LZ } = this.lairSpot;
    const r = 12;
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2;
      if (Math.abs(Math.sin(a + 0.8)) > 0.97) continue; // a gap to walk in through
      const x = LX + Math.cos(a) * r;
      const z = LZ + Math.sin(a) * r;
      const h = rng.range(2.5, 5);
      b.box(x, h / 2, z, 1.1, h, 1.1, vary('#1d1a24', rng, 0.08));
      b.box(x, h + 0.4, z, 0.6, 0.8, 0.6, '#2b2638');
      game.colliders.push({ x, z, radius: 0.7 });
    }
    // Scorch marks and old bones on the floor
    for (let i = 0; i < 26; i++) {
      const a = rng.range(0, Math.PI * 2);
      const d = rng.range(0, r - 2);
      b.box(LX + Math.cos(a) * d, 0.02, LZ + Math.sin(a) * d, rng.range(0.8, 2), 0.04, rng.range(0.8, 2), '#1f1b1a');
    }
    for (let i = 0; i < 5; i++) {
      const a = rng.range(0, Math.PI * 2);
      const d = rng.range(4, r - 2);
      b.box(LX + Math.cos(a) * d, 0.1, LZ + Math.sin(a) * d, 1.2, 0.18, 0.18, '#e8dcc8');
    }
    this.object3d.add(b.build({ material: rockMaterial }));
    game.reservedAreas.push({ ...this.lairSpot, radius: r });
  }

  /** Big basalt boulders and glowing cracks around the island. */
  buildRocks(game) {
    const { rng } = this;
    const b = new VoxelBuilder();
    const { x: X, z: Z } = this.center;
    let placed = 0;
    for (let attempt = 0; attempt < 300 && placed < 22; attempt++) {
      const x = X + rng.range(-this.radius, this.radius);
      const z = Z + rng.range(-this.radius, this.radius);
      if (!this.isInside(x, z, 5) || this.isLava(x, z) || this.nearLava(x, z, 3)) continue;
      if (Math.hypot(x - this.volcano.x, z - this.volcano.z) < this.volcano.r + 3) continue;
      if (Math.hypot(x - this.lairSpot.x, z - this.lairSpot.z) < 14) continue;
      if (Math.hypot(x - this.arrive.x, z - this.arrive.z) < 8) continue;
      const s = rng.range(0.9, 1.8);
      b.box(x, s * 0.5, z, s * 1.4, s, s * 1.2, vary(rng.pick(BASALT), rng, 0.06));
      b.box(x + s * 0.2, s * 1.15, z - 0.1, s * 0.8, s * 0.5, s * 0.7, vary(rng.pick(BASALT), rng, 0.06));
      game.colliders.push({ x, z, radius: s * 0.75 });
      placed++;
    }
    this.object3d.add(b.build({ material: rockMaterial }));
  }

  nearLava(x, z, distance) {
    for (let a = 0; a < Math.PI * 2; a += Math.PI / 4) {
      if (this.isLava(x + Math.cos(a) * distance, z + Math.sin(a) * distance)) return true;
    }
    return false;
  }

  update(dt, game) {
    const player = game.player;
    const p = player?.object3d.position;
    if (!p || !this.contains(p.x, p.z)) return;
    // The lava glows brighter and dimmer.
    lavaMaterial.emissiveIntensity = 0.8 + Math.sin(game.elapsed * 2.2) * 0.12;

    // Walking on lava burns (a little at a time, and pushes you back out).
    this.burnTimer = Math.max(0, (this.burnTimer ?? 0) - dt);
    const onLava = this.isLava(p.x, p.z) && !player.swimming && !player.dead && p.y < 0.4;
    if (onLava && !player.buffs.frostyFeet && this.burnTimer === 0 && !game.isUiOpen()) {
      this.burnTimer = FIRE.lavaEvery;
      const v = Math.hypot(player.velocity.x, player.velocity.z);
      const f = player.model.root.rotation.y;
      const ax = v > 0.5 ? player.velocity.x / v : Math.sin(f);
      const az = v > 0.5 ? player.velocity.z / v : Math.cos(f);
      player.takeDamage(game, FIRE.lavaDamage, p.x + ax, p.z + az); // pushed back the way you came
      game.particles?.burst(p.clone().setY(p.y + 0.3), { count: 14, colors: ['#ff5a1f', '#ffd23f', '#3b2a2a'], speed: 3, size: 0.14, gravity: -4, life: 0.5 });
      if (!this.warned) {
        this.warned = true;
        game.questLog?.toast('Ouch! Lava burns. (A Frost Crystal from Pip keeps your feet cool.)', 4);
      }
    }

    // Embers float up from the lava near you.
    this.emberTimer -= dt;
    if (this.emberTimer <= 0 && this.lavaPoints.length) {
      this.emberTimer = 0.25;
      const spot = this.lavaPoints[Math.floor(Math.random() * this.lavaPoints.length)];
      if (Math.hypot(spot.x - p.x, spot.z - p.z) < 35) {
        game.particles?.burst(new THREE.Vector3(spot.x, 0.1, spot.z), { count: 3, colors: ['#ff7a1f', '#ffd23f'], speed: 1.2, size: 0.1, gravity: -2.5, life: 1.2 });
      }
    }

    // Now and then (not often), a lava monster climbs out of a lava flow near you.
    this.monsterTimer -= dt;
    if (this.monsterTimer <= 0) {
      const [lo, hi] = FIRE.lavaMonsters.every;
      this.monsterTimer = lo + Math.random() * (hi - lo);
      const alive = game.monsters.filter((m) => m.isLavaMonster).length;
      const near = this.lavaPoints.filter((s) => {
        const d = Math.hypot(s.x - p.x, s.z - p.z);
        return d > 6 && d < 22;
      });
      if (alive < FIRE.lavaMonsters.most && near.length && !player.dead) {
        const spot = near[Math.floor(Math.random() * near.length)];
        game.add(new LavaMonster(spot));
      }
    }
  }
}

function distToSegment(x, z, [ax, az], [bx, bz]) {
  const vx = bx - ax;
  const vz = bz - az;
  const t = Math.max(0, Math.min(1, ((x - ax) * vx + (z - az) * vz) / (vx * vx + vz * vz)));
  return Math.hypot(x - (ax + vx * t), z - (az + vz * t));
}
