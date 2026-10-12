import * as THREE from 'three';
import { Entity } from '../core/Entity.js';
import { VoxelBuilder } from '../core/VoxelBuilder.js';
import { stoneTexture, texturedVoxelMaterial, grassMaterial, sandMaterial } from '../core/textures.js';
import { createRng } from '../utils/random.js';
import { vary } from '../utils/color.js';
import { Eel } from '../entities/Eel.js';
import { Gargoyle } from '../entities/Gargoyle.js';
import { islandGround, bushOrRock } from './SmallIsland.js';
import { SEED, PLACES, SEA } from '../config.js';

const CELL = 0.5; // the tower and stairs are built from half-size voxels
const TOWER_RADIUS = 5.5;
const STAIR_WIDTH = 2;
const STEPS = 52;
const STEP_HEIGHT = 0.5;
const TOP = STEPS * STEP_HEIGHT; // height of the tower's roof (the last step is level with it)
const SWEEP = THREE.MathUtils.degToRad(340); // the stairs wrap almost all the way round
const STAIR_START = Math.PI; // the first step faces west, toward the dock

const STONE = ['#c9c2b5', '#b8b1a4', '#d3ccbf', '#aaa497'];

const stoneMaterial = texturedVoxelMaterial(stoneTexture);

const snap = (v) => (Math.floor(v / CELL) + 0.5) * CELL;

/**
 * A little island out at sea with a tall old stone tower. Stairs spiral up the outside to the
 * roof, where the mystery crystal sits. Stone gargoyles perch on the tower and electric eels
 * guard the water around it. Registers as walkable land; `crystalSpot` is where the crystal goes.
 */
export class TowerIsland extends Entity {
  constructor({ x, z, radius } = PLACES.towerIsland) {
    super();
    this.center = { x, z };
    this.swimFromShore = true; // you can walk off the beach into the sea to swim home
    this.radius = radius;
    this.rng = createRng(SEED + 41);
    this.crystalSpot = new THREE.Vector3(x, TOP + 0.5, z);
    this.eelSpots = [];
    this.gargoyleSpots = [];
    this.build();
  }

  onAdd(game) {
    game.lands.push(this);
    game.cameraBlockers.push(this.towerMesh);
    for (const spot of this.eelSpots) game.add(new Eel(spot));
    for (const spot of this.gargoyleSpots) game.add(new Gargoyle(spot)).perchFacing = spot.facing;
  }

  /** On the island (keeping off the wet beach edge like the main island does)? */
  isInside(x, z, margin = 0) {
    return Math.hypot(x - this.center.x, z - this.center.z) < this.radius - 2 - margin;
  }

  /** Height of the tower roof, the parapet and each stair. null on plain ground. */
  heightAt(x, z) {
    const cx = snap(x) - this.center.x;
    const cz = snap(z) - this.center.z;
    const d = Math.hypot(cx, cz);
    if (d < 0.6) return TOP + 0.5; // the crystal's pedestal
    if (d < TOWER_RADIUS) return this.isParapet(cx, cz, d) ? TOP + 1 : TOP;
    if (d < TOWER_RADIUS + STAIR_WIDTH) {
      const step = this.stepAt(cx, cz);
      return step === null ? null : (step + 1) * STEP_HEIGHT;
    }
    return null;
  }

  /** Which stair (0 = bottom) is at this spot around the tower, or null for the gap. */
  stepAt(cx, cz) {
    let a = Math.atan2(cz, cx) - STAIR_START;
    a = ((a % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
    const step = Math.floor(a / (SWEEP / STEPS));
    return step < STEPS ? step : null;
  }

  /** The low wall round the roof, with an opening where the stairs arrive. */
  isParapet(cx, cz, d) {
    if (d < TOWER_RADIUS - CELL) return false;
    const arrive = STAIR_START + SWEEP - SWEEP / STEPS / 2;
    const a = Math.atan2(cz, cx);
    const off = Math.atan2(Math.sin(a - arrive), Math.cos(a - arrive));
    return Math.abs(off) > 0.5;
  }

  build() {
    const { rng } = this;
    const ground = new VoxelBuilder(); // bushes and rocks
    const land = { grass: new VoxelBuilder(), sand: new VoxelBuilder() };
    const tower = new VoxelBuilder();
    const { x: X, z: Z } = this.center;
    const r = this.radius;

    islandGround(land, rng, X, Z, r);
    for (let i = 0; i < 9; i++) {
      const a = rng.range(0, Math.PI * 2);
      const d = rng.range(TOWER_RADIUS + STAIR_WIDTH + 1.5, r - 4);
      bushOrRock(ground, rng, X + Math.cos(a) * d, Z + Math.sin(a) * d);
    }

    // Rocky spots in the water around the island: that's where the eels live.
    for (let i = 0; i < 4; i++) {
      const a = Math.PI * 0.55 + i * (Math.PI * 0.32); // spread around the side facing the dock
      const d = r + 4;
      const x = X + Math.cos(a) * d;
      const z = Z + Math.sin(a) * d;
      for (let k = 0; k < 4; k++) {
        const rx = x + rng.range(-1.5, 1.5);
        const rz = z + rng.range(-1.5, 1.5);
        const h = rng.range(0.6, 1.6);
        const top = SEA.level + h - 1;
        tower.box(rx, (top + SEA.floor) / 2, rz, rng.range(0.8, 1.6), top - SEA.floor, rng.range(0.8, 1.6), vary(rng.pick(STONE), rng, 0.08));
      }
      if (i === 0 || i === 2) this.eelSpots.push({ x: X + Math.cos(a) * (d - 0.5), z: Z + Math.sin(a) * (d - 0.5) });
    }

    // The tower and stairs, column by column on the half-size grid.
    const reach = TOWER_RADIUS + STAIR_WIDTH;
    for (let cx = -reach; cx <= reach; cx += CELL) {
      for (let cz = -reach; cz <= reach; cz += CELL) {
        const x = snap(X + cx);
        const z = snap(Z + cz);
        const lx = x - X;
        const lz = z - Z;
        const d = Math.hypot(lx, lz);
        if (d >= reach) continue;
        const h = this.heightAt(x, z);
        if (h === null) continue;

        if (d < TOWER_RADIUS) {
          const shell = d > TOWER_RADIUS - CELL * 1.5;
          if (d < 0.6) {
            tower.box(x, (TOP + 0.5) / 2, z, CELL, TOP + 0.5, CELL, '#9d968a'); // pedestal
            continue;
          }
          if (!shell) {
            tower.box(x, TOP / 2, z, CELL, TOP, CELL, '#9d968a'); // solid inside
            tower.box(x, TOP - 0.05, z, CELL, 0.1, CELL, vary('#a06c3b', rng, 0.05)); // wooden roof boards
            continue;
          }
          // Outer wall, brick by brick, with dark window slits and a door.
          const angle = Math.atan2(lz, lx);
          for (let y = 0; y < h; y += CELL) {
            let color = vary(rng.pick(STONE), rng, 0.05);
            const facing = (k) => Math.abs(Math.atan2(Math.sin(angle - k), Math.cos(angle - k))) < 0.18;
            if (y >= 3 && y < 4 && (facing(0.4) || facing(2.5))) color = '#2b3a55'; // windows
            if (y >= 6.5 && y < 7.5 && facing(-1.7)) color = '#2b3a55';
            if (y >= 10 && y < 11 && (facing(1.2) || facing(-0.6))) color = '#2b3a55';
            if (y < 1.5 && facing(STAIR_START - 0.17)) color = y < 1 ? '#7a4a24' : '#5e3b22'; // door
            if (Math.abs(y - 5) < 0.01 || Math.abs(y - 9.5) < 0.01 || Math.abs(y - (TOP - 1)) < 0.01) color = '#9d968a'; // stone bands
            tower.box(x, y + CELL / 2, z, CELL, CELL, CELL, color);
          }
          continue;
        }
        // A stair: stone column with a wooden tread on top.
        tower.box(x, (h - 0.1) / 2, z, CELL, h - 0.1, CELL, vary(rng.pick(STONE), rng, 0.04));
        tower.box(x, h - 0.05, z, CELL, 0.1, CELL, vary('#b07a45', rng, 0.05));
      }
    }

    // Gargoyle perches: on the parapet, and on stone ledges sticking out of the wall above the stairs.
    const arrive = STAIR_START + SWEEP;
    for (const off of [1.2, 2.4, 3.6, 4.8]) {
      const a = arrive + off;
      this.gargoyleSpots.push({ x: X + Math.cos(a) * (TOWER_RADIUS - 0.3), y: TOP + 1, z: Z + Math.sin(a) * (TOWER_RADIUS - 0.3), facing: Math.atan2(Math.cos(a), Math.sin(a)) });
    }
    for (const frac of [0.25, 0.5, 0.75]) {
      const a = STAIR_START + SWEEP * frac;
      const y = (Math.floor((STEPS * frac)) + 1) * STEP_HEIGHT + 2.6;
      const r = TOWER_RADIUS + 0.4;
      tower.box(X + Math.cos(a) * r, y - 0.15, Z + Math.sin(a) * r, 0.9, 0.3, 0.9, '#9d968a'); // ledge
      this.gargoyleSpots.push({ x: X + Math.cos(a) * (r + 0.1), y, z: Z + Math.sin(a) * (r + 0.1), facing: Math.atan2(Math.cos(a), Math.sin(a)) });
    }

    // Flag on the roof.
    tower.box(X - 1.6, TOP + 1.5, Z - 1.6, 0.15, 3, 0.15, '#5e3b22');
    tower.box(X - 1.6 + 0.6, TOP + 2.6, Z - 1.6, 1.1, 0.7, 0.06, '#7b3fd1');

    this.object3d.add(
      ground.build(),
      land.grass.build({ castShadow: false, material: grassMaterial }),
      land.sand.build({ castShadow: false, material: sandMaterial }),
    );
    this.towerMesh = tower.build({ material: stoneMaterial });
    this.object3d.add(this.towerMesh);
  }
}
