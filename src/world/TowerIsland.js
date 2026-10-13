import * as THREE from 'three';
import { Entity } from '../core/Entity.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { VoxelBuilder } from '../core/VoxelBuilder.js';
import { stoneTexture, texturedVoxelMaterial } from '../core/textures.js';
import { gardenMaterial } from '../style/garden.js';
import { createRng } from '../utils/random.js';
import { vary } from '../utils/color.js';
import { Eel } from '../entities/Eel.js';
import { Gargoyle } from '../entities/Gargoyle.js';
import { islandGround, bushOrRock, buildProps } from './SmallIsland.js';
import { SEED, PLACES, SEA } from '../config.js';

const CELL = 0.5; // heights (stairs, parapet) are worked out on a half-size grid
const TOWER_RADIUS = 5.5;
const STAIR_WIDTH = 2;
const STEPS = 52;
const STEP_HEIGHT = 0.5;
const TOP = STEPS * STEP_HEIGHT; // height of the tower's roof (the last step is level with it)
const SWEEP = THREE.MathUtils.degToRad(340); // the stairs wrap almost all the way round
const STAIR_START = Math.PI; // the first step faces west, toward the dock

const STONE = ['#d9ccff', '#cfc4f2', '#e2d8ff', '#c4bae6'];
const SIDES = 14; // the tower is a chunky 14-sided prism

const stoneMaterial = texturedVoxelMaterial(stoneTexture, { bevel: 0.1 });
const towerMaterial = gardenMaterial({ map: 'stone', tint: 0.45, color: '#d9ccff', rim: 0.3 });
towerMaterial.flatShading = true;
const _q = new THREE.Quaternion();
const Y_AXIS = new THREE.Vector3(0, 1, 0);
const turned = (angle) => _q.clone().setFromAxisAngle(Y_AXIS, -angle); // local +X points along `angle`

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
    game.cameraBlockers.push(...this.towerMeshes);
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
    const props = { bushes: [], rocks: [] };
    const tower = new VoxelBuilder(); // stairs, parapet, windows, ledges, rocks
    const { x: X, z: Z } = this.center;
    const r = this.radius;

    for (let i = 0; i < 9; i++) {
      const a = rng.range(0, Math.PI * 2);
      const d = rng.range(TOWER_RADIUS + STAIR_WIDTH + 1.5, r - 4);
      bushOrRock(props, rng, X + Math.cos(a) * d, Z + Math.sin(a) * d);
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
        tower.box(rx, (top + SEA.floor) / 2, rz, rng.range(0.8, 1.6), top - SEA.floor, rng.range(0.8, 1.6), vary(rng.pick(STONE), rng, 0.08), turned(rng.range(0, 6)));
      }
      if (i === 0 || i === 2) this.eelSpots.push({ x: X + Math.cos(a) * (d - 0.5), z: Z + Math.sin(a) * (d - 0.5) });
    }

    // The tower: a faceted stone prism with three carved bands around it.
    const body = new THREE.CylinderGeometry(TOWER_RADIUS - 0.1, TOWER_RADIUS + 0.2, TOP, SIDES).translate(0, TOP / 2, 0);
    const bands = [5.25, 9.75, TOP - 0.75].map((y) => new THREE.CylinderGeometry(TOWER_RADIUS + 0.22, TOWER_RADIUS + 0.22, 0.5, SIDES).translate(0, y, 0));
    const towerMesh = new THREE.Mesh(mergeGeometries([body, ...bands]), towerMaterial);
    towerMesh.position.set(X, 0, Z);
    towerMesh.castShadow = towerMesh.receiveShadow = true;
    // Wooden roof boards and the crystal's pedestal.
    tower.box(X, TOP + 0.03, Z, (TOWER_RADIUS - 0.6) * 1.45, 0.1, (TOWER_RADIUS - 0.6) * 1.45, '#d9a066');
    tower.box(X, TOP + 0.25, Z, 1, 0.5, 1, '#c4bae6');

    // Parapet round the roof, with an opening where the stairs arrive, and crenels on top.
    const arriveAt = STAIR_START + SWEEP - SWEEP / STEPS / 2;
    const blocks = 30;
    for (let i = 0; i < blocks; i++) {
      const a = (i / blocks) * Math.PI * 2;
      if (Math.abs(Math.atan2(Math.sin(a - arriveAt), Math.cos(a - arriveAt))) < 0.5) continue;
      const pr = TOWER_RADIUS - 0.25;
      const q = turned(a + Math.PI / 2);
      tower.box(X + Math.cos(a) * pr, TOP + 0.5, Z + Math.sin(a) * pr, 1.2, 1, 0.55, rng.pick(STONE), q);
      if (i % 2) tower.box(X + Math.cos(a) * pr, TOP + 1.2, Z + Math.sin(a) * pr, 0.8, 0.4, 0.55, rng.pick(STONE), q);
    }

    // Dark window slits and the door, set into the wall.
    const windows = [[0.4, 3.5], [2.5, 3.5], [-1.7, 7], [1.2, 10.5], [-0.6, 10.5]];
    for (const [a, y] of windows) {
      const wr = TOWER_RADIUS + 0.05;
      tower.box(X + Math.cos(a) * wr, y, Z + Math.sin(a) * wr, 0.3, 1.1, 0.7, '#3a1450', turned(a));
      tower.box(X + Math.cos(a) * (wr + 0.05), y + 0.65, Z + Math.sin(a) * (wr + 0.05), 0.3, 0.22, 1.0, '#c4bae6', turned(a));
    }
    const doorA = STAIR_START - 0.17;
    tower.box(X + Math.cos(doorA) * (TOWER_RADIUS + 0.1), 0.8, Z + Math.sin(doorA) * (TOWER_RADIUS + 0.1), 0.3, 1.6, 1.2, '#8a5530', turned(doorA));

    // The stairs: one chunky stone block per step with a wooden tread, spiralling up the outside.
    const mid = TOWER_RADIUS + STAIR_WIDTH / 2;
    const stepWidth = (SWEEP / STEPS) * (TOWER_RADIUS + STAIR_WIDTH) + 0.1;
    for (let i = 0; i < STEPS; i++) {
      const a = STAIR_START + (i + 0.5) * (SWEEP / STEPS);
      const h = (i + 1) * STEP_HEIGHT;
      const x = X + Math.cos(a) * mid;
      const z = Z + Math.sin(a) * mid;
      tower.box(x, (h - 0.1) / 2, z, STAIR_WIDTH + 0.3, h - 0.1, stepWidth, vary(rng.pick(STONE), rng, 0.04), turned(a));
      tower.box(x, h - 0.05, z, STAIR_WIDTH + 0.35, 0.12, stepWidth + 0.02, vary('#d9a066', rng, 0.05), turned(a));
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
      const lr = TOWER_RADIUS + 0.4;
      tower.box(X + Math.cos(a) * lr, y - 0.15, Z + Math.sin(a) * lr, 1.0, 0.3, 0.9, '#c4bae6', turned(a)); // ledge
      this.gargoyleSpots.push({ x: X + Math.cos(a) * (lr + 0.1), y, z: Z + Math.sin(a) * (lr + 0.1), facing: Math.atan2(Math.cos(a), Math.sin(a)) });
    }

    // Flag on the roof.
    tower.box(X - 1.6, TOP + 1.5, Z - 1.6, 0.15, 3, 0.15, '#5e3b22');
    tower.box(X - 1.6 + 0.6, TOP + 2.6, Z - 1.6, 1.1, 0.7, 0.06, '#b07cff');

    const details = tower.build({ material: stoneMaterial });
    this.towerMeshes = [towerMesh, details];
    this.object3d.add(islandGround(X, Z, r), ...buildProps(props), towerMesh, details);
  }
}
