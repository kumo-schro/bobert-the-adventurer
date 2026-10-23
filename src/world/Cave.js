import * as THREE from 'three';
import { Entity } from '../core/Entity.js';
import { VoxelBuilder } from '../core/VoxelBuilder.js';
import { stoneTexture, texturedVoxelMaterial } from '../core/textures.js';
import { createRng, createNoise2D } from '../utils/random.js';
import { vary } from '../utils/color.js';
import { Chest } from '../entities/Chest.js';
import { Spider } from '../entities/Spider.js';
import { SEED, PLACES } from '../config.js';

// The cave, seen from above. North is the top row; the entrance (E) faces south toward the village.
// The entrance tunnel is extended automatically until it pokes out of the mountainside.
//   #  rock            .  tunnel floor          o  slime chamber floor (goo, taller ceiling)
//   E  entrance        C  treasure chest        S  cave spider
//   t  torch (tunnel)  T  torch (chamber)       B  where the Gelationus Slime lives
const MAP = [
  '##########################',
  '##########################',
  '########oooooooooo########',
  '#######TooooooooooT#######',
  '######oooooooooooooo######',
  '######ooooooBooooooo######',
  '######oooooooooooooo######',
  '#######oooooooooooo#######',
  '###########oooo###########',
  '############..############',
  '##.....t....S.......t...##',
  '##.C................S.C.##',
  '##....######..######....##',
  '############..############',
  '############..t###########',
  '#######.........##########',
  '#######.C...S...##########',
  '#######.....##..##########',
  '##############..##########',
  '##############..##########',
  '##############..##########',
  '##############EE##########',
];

const CHEST_COINS = [20, 15, 25];
const WALL_HEIGHT = 2; // walls that stay visible when the roof is cut away (low, so you can see in)
const MOUNTAIN_RADIUS = 23;
const MOUNTAIN_HEIGHT = 26;

const STONE = ['#8d8f96', '#7d8088', '#9a9ca3', '#878079'];
const GRAVEL = ['#5f5a54', '#57534e', '#68625b'];
const GOO = ['#4caf50', '#5fc35a', '#3f9e45'];
const GRASS_TOP = '#5cb85c';
const SNOW = '#f4f7fb';

const wallMaterial = texturedVoxelMaterial(stoneTexture);
const roofMaterial = texturedVoxelMaterial(stoneTexture);
const floorMaterial = texturedVoxelMaterial(stoneTexture);
const flameMaterial = new THREE.MeshLambertMaterial({ color: '#ffb300', emissive: '#ff8a00', emissiveIntensity: 1 });

/**
 * A rocky mountain with a winding cave inside: chests, spiders, torches, and the slime's
 * chamber at the end. When the player walks in, the mountain's roof is cut away (it still
 * casts its shadow, so the cave stays dim) and the camera looks down from above.
 *
 * Exposes `bossSpot` (where the Gelationus Slime appears) and `entrance`.
 */
export class Cave extends Entity {
  constructor({ x, z } = PLACES.cave) {
    super();
    this.center = { x, z };
    this.inside = false; // only change the camera when we go in or come out
    this.cells = new Map(); // "ix,iz" -> { open, ceiling, height }
    this.solid = new Set();
    this.spawns = { chests: [], spiders: [], torches: [] };
    this.rng = createRng(SEED + 9);
    this.noise = createNoise2D(SEED + 9);

    this.originX = Math.round(x - MAP[0].length / 2);
    this.originZ = Math.round(z - MAP.length / 2);
    this.readMap();
    this.carveEntrance();
    this.buildMountain();
    this.buildTorches();
  }

  heightAt(ix, iz) {
    const d = Math.hypot(ix + 0.5 - this.center.x, iz + 0.5 - this.center.z);
    if (d > MOUNTAIN_RADIUS) return 0;
    const dome = MOUNTAIN_HEIGHT * (1 - Math.pow(d / MOUNTAIN_RADIUS, 1.6));
    return Math.round(dome + (this.noise(ix * 0.15, iz * 0.15) - 0.5) * 6);
  }

  readMap() {
    MAP.forEach((row, r) => {
      [...row].forEach((ch, c) => {
        if (ch === '#') return;
        const ix = this.originX + c;
        const iz = this.originZ + r;
        const chamber = 'oBT'.includes(ch);
        this.cells.set(`${ix},${iz}`, { open: true, ceiling: chamber ? 6 : 4, chamber, entrance: ch === 'E' });
        const spot = { x: ix + 0.5, z: iz + 0.5 };
        if (ch === 'C') this.spawns.chests.push(spot);
        if (ch === 'S') this.spawns.spiders.push(spot);
        if (ch === 't' || ch === 'T') this.spawns.torches.push({ ...spot, chamber });
        if (ch === 'B') this.bossSpot = spot;
      });
    });
  }

  /** Extend the entrance tunnel south until it comes out of the mountainside. */
  carveEntrance() {
    const mouth = [...this.cells.entries()].filter(([, c]) => c.entrance).map(([k]) => k.split(',').map(Number));
    let iz = mouth[0][1];
    for (;;) {
      iz++;
      const stillInside = mouth.some(([ix]) => this.heightAt(ix, iz) >= 1);
      for (const [ix] of mouth) this.cells.set(`${ix},${iz}`, { open: true, ceiling: 4 });
      if (!stillInside) break;
    }
    this.entrance = { x: mouth[0][0] + 1, z: iz + 1 };
  }

  buildMountain() {
    const walls = new VoxelBuilder();
    const roof = new VoxelBuilder();
    const floor = new VoxelBuilder();
    const { rng } = this;
    const r = MOUNTAIN_RADIUS;
    const cx = Math.floor(this.center.x);
    const cz = Math.floor(this.center.z);

    const cap = (h) => (h <= 8 ? GRASS_TOP : h <= 17 ? rng.pick(STONE) : SNOW);
    // A stone column from y0 to y1, topped with a grass/stone/snow cap if it reaches the surface.
    const column = (b, x, z, y0, y1, surface) => {
      const top = surface ? y1 - 1 : y1;
      if (top > y0) b.box(x, (y0 + top) / 2, z, 1, top - y0, 1, vary(rng.pick(STONE), rng, 0.03));
      if (surface) b.add(x, y1 - 0.5, z, vary(cap(y1), rng, 0.04));
    };

    for (let ix = cx - r - 1; ix <= cx + r + 1; ix++) {
      for (let iz = cz - r - 1; iz <= cz + r + 1; iz++) {
        const h = this.heightAt(ix, iz);
        const cell = this.cells.get(`${ix},${iz}`);
        const x = ix + 0.5;
        const z = iz + 0.5;

        if (cell) {
          const palette = cell.chamber ? GOO : GRAVEL;
          floor.box(x, 0.03, z, 1, 0.06, 1, vary(rng.pick(palette), rng, 0.04));
          cell.covered = h > cell.ceiling + 1;
          if (cell.covered) column(roof, x, z, cell.ceiling, h, true);
          continue;
        }
        if (h < 1) continue;

        this.solid.add(`${ix},${iz}`);
        if (h <= WALL_HEIGHT) {
          column(walls, x, z, -2, h, true);
        } else {
          column(walls, x, z, -2, WALL_HEIGHT, false);
          column(roof, x, z, WALL_HEIGHT, h, true);
        }
      }
    }

    this.walls = walls.build({ merge: true, material: wallMaterial });
    this.roof = roof.build({ merge: true, material: roofMaterial });
    this.floor = floor.build({ merge: true, cullBottom: true, material: floorMaterial, castShadow: false });
    this.object3d.add(this.walls, this.roof, this.floor);
  }

  buildTorches() {
    const posts = new VoxelBuilder();
    this.flames = [];
    this.lights = [];
    for (const t of this.spawns.torches) {
      posts.box(t.x, 0.8, t.z, 0.18, 1.6, 0.18, '#5e3b22');
      posts.box(t.x, 1.62, t.z, 0.3, 0.08, 0.3, '#3b3b3b');
      const flame = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.34, 0.26), flameMaterial);
      flame.position.set(t.x, 1.85, t.z);
      this.object3d.add(flame);
      this.flames.push(flame);

      const light = new THREE.PointLight(t.chamber ? '#9dff8a' : '#ffb35c', 6, 12, 1.6);
      light.position.set(t.x, 2.4, t.z);
      this.object3d.add(light);
      this.lights.push(light);
    }
    this.object3d.add(posts.build({ merge: true, castShadow: false }));
  }

  /** The grid collider: rock cells the player and monsters can't walk into. */
  isSolid(ix, iz) {
    return this.solid.has(`${ix},${iz}`);
  }

  /** True when (x, z) is under the mountain's roof. */
  isUnderRoof(x, z) {
    return !!this.cells.get(`${Math.floor(x)},${Math.floor(z)}`)?.covered;
  }

  onAdd(game) {
    game.colliders.push(this);
    for (const t of this.spawns.torches) game.colliders.push({ x: t.x, z: t.z, radius: 0.25 });
    game.reservedAreas.push({ ...this.center, radius: MOUNTAIN_RADIUS + 1 });
    game.cameraBlockers.push(this.walls, this.roof);
    game.cave = this;

    this.spawns.chests.forEach((spot, i) => game.add(new Chest(spot, { coins: CHEST_COINS[i % CHEST_COINS.length] })));
    for (const spot of this.spawns.spiders) game.add(new Spider(spot));
  }

  update(dt, game) {
    const p = game.player?.object3d.position;
    const inside = !!p && this.isUnderRoof(p.x, p.z);
    if (inside !== this.inside) {
      this.inside = inside;
      // Hide the roof but keep its shadow, so the cave stays dark and cozy.
      roofMaterial.colorWrite = roofMaterial.depthWrite = !inside;
      this.roof.userData.ignoreCamera = inside; // the walls turn see-through when they're in the way
    }

    for (const [i, flame] of this.flames.entries()) {
      const flicker = 1 + Math.sin(game.elapsed * 13 + i * 2.1) * 0.12 + Math.sin(game.elapsed * 7.3 + i) * 0.08;
      flame.scale.set(flicker, flicker * 1.15, flicker);
      this.lights[i].intensity = 6 * flicker;
    }
  }
}
