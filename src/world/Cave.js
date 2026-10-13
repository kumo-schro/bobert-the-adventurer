import * as THREE from 'three';
import { Entity } from '../core/Entity.js';
import { VoxelBuilder } from '../core/VoxelBuilder.js';
import { stoneTexture, texturedVoxelMaterial } from '../core/textures.js';
import { gardenMaterial } from '../style/garden.js';
import { heightfieldGeometry, heightRamp } from '../style/heightfield.js';
import { createRng, createNoise2D } from '../utils/random.js';
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

const GRAVEL = '#8a7aa8';
const GOO = '#5fd86a';

// The mountain is drawn as a layer cake: soft terraces, each its own candy color, from a grassy
// foot to pink-white snowy peaks.
const TERRACE = 4;
const LAYER_COLORS = ['#7ddc5a', '#3fc6a0', '#4aa6f0', '#7c74ff', '#a866f0', '#e070d0', '#ff9ad0', '#ffd0ea', '#fff6fb'];
const MOUNTAIN_COLORS = heightRamp(LAYER_COLORS.flatMap((c, i) => [[i * TERRACE + 0.4, c], [(i + 1) * TERRACE - 0.6, LAYER_COLORS[Math.min(i + 1, LAYER_COLORS.length - 1)]]]));
function terrace(h) {
  const raw = h / TERRACE;
  const level = Math.floor(raw);
  return (level + THREE.MathUtils.smoothstep(raw - level, 0.45, 0.9)) * TERRACE;
}
function mountainMaterial() {
  const m = gardenMaterial({ rim: 0.2 });
  m.vertexColors = true;
  m.flatShading = true;
  return m;
}
const wallMaterial = mountainMaterial();
const roofMaterial = mountainMaterial();
const floorMaterial = texturedVoxelMaterial(stoneTexture, { bevel: 0 });
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
    const floor = new VoxelBuilder();
    const r = MOUNTAIN_RADIUS;
    const cx = Math.floor(this.center.x);
    const cz = Math.floor(this.center.z);
    const bounds = { minX: cx - r - 1, maxX: cx + r + 1, minZ: cz - r - 1, maxZ: cz + r + 1 };

    for (let ix = bounds.minX; ix <= bounds.maxX; ix++) {
      for (let iz = bounds.minZ; iz <= bounds.maxZ; iz++) {
        const h = this.heightAt(ix, iz);
        const cell = this.cells.get(`${ix},${iz}`);
        if (cell) {
          floor.box(ix + 0.5, 0.03, iz + 0.5, 1, 0.06, 1, cell.chamber ? GOO : GRAVEL);
          cell.covered = h > cell.ceiling + 1;
          continue;
        }
        if (h >= 1) this.solid.add(`${ix},${iz}`);
      }
    }

    // The low walls you still see inside when the roof is cut away, sloping down to the grass
    // round the outside of the mountain.
    const key = (ix, iz) => `${ix},${iz}`;
    const walls = heightfieldGeometry({
      ...bounds,
      top: (ix, iz) => (this.solid.has(key(ix, iz)) ? Math.min(this.heightAt(ix, iz), WALL_HEIGHT) : null),
      blend: (ix, iz) => (this.cells.has(key(ix, iz)) ? null : 0),
      bottom: () => -0.5,
      color: MOUNTAIN_COLORS,
    });
    // The mountain above the walls (and over the covered tunnels): hidden while you're inside.
    const isRoof = (ix, iz) => (this.solid.has(key(ix, iz)) && this.heightAt(ix, iz) > WALL_HEIGHT) || this.cells.get(key(ix, iz))?.covered;
    const roof = heightfieldGeometry({
      ...bounds,
      top: (ix, iz) => {
        if (!isRoof(ix, iz)) return null;
        const floorOfRoof = this.cells.get(key(ix, iz))?.ceiling ?? WALL_HEIGHT;
        return Math.max(terrace(this.heightAt(ix, iz)), floorOfRoof + 0.8);
      },
      bottom: (ix, iz) => this.cells.get(key(ix, iz))?.ceiling ?? WALL_HEIGHT,
      underside: (ix, iz) => !!this.cells.get(key(ix, iz))?.covered,
      color: MOUNTAIN_COLORS,
    });

    this.walls = new THREE.Mesh(walls, wallMaterial);
    this.roof = new THREE.Mesh(roof, roofMaterial);
    for (const m of [this.walls, this.roof]) m.castShadow = m.receiveShadow = true;
    this.floor = floor.build({ material: floorMaterial, castShadow: false });
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
    this.object3d.add(posts.build({ castShadow: false }));
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
      this.roof.userData.ignoreCamera = inside;
      this.walls.userData.ignoreCamera = inside;
      game.cameraMode = inside ? 'cave' : null;
    }

    for (const [i, flame] of this.flames.entries()) {
      const flicker = 1 + Math.sin(game.elapsed * 13 + i * 2.1) * 0.12 + Math.sin(game.elapsed * 7.3 + i) * 0.08;
      flame.scale.set(flicker, flicker * 1.15, flicker);
      this.lights[i].intensity = 6 * flicker;
    }
  }
}
