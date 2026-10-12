import * as THREE from 'three';
import { Entity } from '../core/Entity.js';
import { VoxelBuilder } from '../core/VoxelBuilder.js';
import { blockMaterial, dirtMaterial } from '../core/textures.js';
import { createRng } from '../utils/random.js';
import { vary } from '../utils/color.js';
import { stoneHouse, marketStall, bakeryStall, well, forge } from '../models/buildings.js';
import { SEED, VILLAGE, CAMERA } from '../config.js';

const COBBLE = ['#b9b4aa', '#a8a39a', '#c7c2b8', '#9d9a94'];
const DIRT = ['#c9a46b', '#bf9a60', '#d1ad75'];
export const glowMaterial = new THREE.MeshLambertMaterial({ emissive: '#ffb300', emissiveIntensity: 0.6 });

// Rotate a local (x, z) by k quarter turns. k = 0 keeps the front facing +Z.
function rotate(x, z, k) {
  switch (k & 3) {
    case 0: return [x, z];
    case 1: return [z, -x];
    case 2: return [-x, -z];
    default: return [-z, x];
  }
}

// The quarter turn that best points a building's front (+Z) at the direction (dx, dz).
function facing(dx, dz) {
  const fronts = [[0, 1], [1, 0], [0, -1], [-1, 0]];
  let best = 0;
  fronts.forEach(([fx, fz], k) => {
    if (fx * dx + fz * dz > fronts[best][0] * dx + fronts[best][1] * dz) best = k;
  });
  return best;
}

/**
 * The starting village: a cobblestone plaza with a well, a ring of stone houses with
 * dirt paths to their doors, the merchant's stall and the bakery. The player spawns in the plaza.
 * Chimneys puff smoke.
 *
 * Exposes `merchantSpot` / `blacksmithSpot` / `bakerSpot` (where those characters stand), plus
 * the angle each should face, for main.js.
 */
export class Village extends Entity {
  constructor() {
    super();
    this.builder = new VoxelBuilder();
    this.floor = new VoxelBuilder(); // flat paving, doesn't cast shadows
    this.glow = new VoxelBuilder(); // lanterns and oven fires
    this.chimneys = []; // where smoke comes out
    this.houses = []; // { door, front } for each house, so villagers can go home to sleep
    this.ringAngles = []; // angle of every building around the ring (for finding gaps between them)
    this.colliders = [];
    this.reserved = [];
    this.rng = createRng(SEED + 5);

    // Put the merchant's stall straight ahead of where the camera starts looking,
    // so the first thing the player sees is the merchant waiting with a quest.
    const viewX = -Math.sin(CAMERA.yaw);
    const viewZ = -Math.cos(CAMERA.yaw);
    const stallAngle = Math.atan2(viewZ, viewX);

    this.buildPlaza();

    // Houses fill the ring, leaving a gap in front of the camera for the stall.
    // One spot in the ring (the first one) is the blacksmith's forge, where the shop is.
    const gap = THREE.MathUtils.degToRad(110);
    const step = (Math.PI * 2 - gap) / (VILLAGE.houseCount - 1);
    for (let i = 0; i < VILLAGE.houseCount; i++) {
      const angle = stallAngle + gap / 2 + i * step;
      this.ringAngles.push(angle);
      const radius = VILLAGE.ringRadius + this.rng.range(-1.5, 1.5);
      if (i === 0) {
        const smithy = this.place(forge, angle, radius - 1);
        this.buildPath(smithy, 2 + 2.3);
        this.reserved.push({ ...smithy.center, radius: 5 });
        this.blacksmithSpot = new THREE.Vector3(
          smithy.center.x + smithy.front.x * 3.6,
          0,
          smithy.center.z + smithy.front.z * 3.6,
        );
        this.blacksmithFacing = Math.atan2(smithy.front.x, smithy.front.z);
        // Where the blacksmith goes in for the night.
        this.forgeDoor = { x: smithy.center.x + smithy.front.x * 2.9, z: smithy.center.z + smithy.front.z * 2.9 };
        continue;
      }
      const roof = VILLAGE.roofColors[i % VILLAGE.roofColors.length];
      const hw = this.rng.int(3, 4);
      const hd = this.rng.int(2, 3);
      const house = this.place(stoneHouse, angle, radius, { hw, hd, roof, style: i });
      this.buildPath(house, hd + 1.3);
      this.reserved.push({ ...house.center, radius: Math.hypot(hw + 2, hd) + 1 });
      this.houses.push({
        door: { x: house.center.x + house.front.x * (hd + 1.3), z: house.center.z + house.front.z * (hd + 1.3) },
        front: house.front,
      });
    }

    const stall = this.place(marketStall, stallAngle, VILLAGE.plazaRadius + 4);
    this.reserved.push({ ...stall.center, radius: 4 });
    this.merchantSpot = new THREE.Vector3(
      stall.center.x + stall.front.x * 2.2,
      0,
      stall.center.z + stall.front.z * 2.2,
    );
    this.merchantFacing = Math.atan2(stall.front.x, stall.front.z);

    // The bakery sits between two houses on the left of the starting view (the forge is on the right).
    const bakery = this.place(bakeryStall, stallAngle - gap / 2 - step / 2, VILLAGE.plazaRadius + 4.5);
    this.reserved.push({ ...bakery.center, radius: 4.5 });
    this.bakerSpot = new THREE.Vector3(
      bakery.center.x + bakery.front.x * 2.2,
      0,
      bakery.center.z + bakery.front.z * 2.2,
    );
    this.bakerFacing = Math.atan2(bakery.front.x, bakery.front.z);

    // Well off to the side so it isn't in the merchant's way.
    const wellAngle = stallAngle - Math.PI / 2;
    const w = this.place(well, wellAngle, VILLAGE.plazaRadius - 2.5, { roof: '#d9493f' });
    this.reserved.push({ ...w.center, radius: 2.5 });

    this.object3d.add(this.builder.build({ material: blockMaterial }));
    this.object3d.add(this.floor.build({ castShadow: false, material: dirtMaterial }));
    this.object3d.add(this.glow.build({ material: glowMaterial, castShadow: false }));
    this.smokeTimer = 0;
    this.ringAngles.push(stallAngle);
  }

  /**
   * Places a building recipe at (angle, radius) from the plaza center, rotated to face
   * the center. Returns where it ended up and which way its front faces.
   */
  place(recipe, angle, radius, options) {
    const cx = Math.floor(Math.cos(angle) * radius) + 0.5;
    const cz = Math.floor(Math.sin(angle) * radius) + 0.5;
    const k = facing(-cx, -cz);
    const into = (builder) => (x, y, z, color, sx = 1, sy = 1, sz = 1) => {
      const [rx, rz] = rotate(x, z, k);
      const [w, d] = k % 2 ? [sz, sx] : [sx, sz];
      builder.box(cx + rx, y, cz + rz, w, sy, d, color);
    };
    const put = into(this.builder);
    put.glow = into(this.glow); // glowing parts (lanterns, fires)
    const { halfX, halfZ, smoke } = recipe(put, this.rng, options);
    if (smoke) {
      const [sx, sz] = rotate(smoke[0], smoke[2], k);
      this.chimneys.push(new THREE.Vector3(cx + sx, smoke[1], cz + sz));
    }
    const [hx, hz] = k % 2 ? [halfZ, halfX] : [halfX, halfZ];
    this.colliders.push({ x: cx, z: cz, halfX: hx, halfZ: hz });

    const [fx, fz] = rotate(0, 1, k);
    return { center: { x: cx, z: cz }, front: { x: fx, z: fz } };
  }

  buildPlaza() {
    const r = VILLAGE.plazaRadius;
    for (let x = -r; x < r; x++) {
      for (let z = -r; z < r; z++) {
        const cx = x + 0.5;
        const cz = z + 0.5;
        const d = Math.hypot(cx, cz);
        if (d > r) continue;
        // Ragged edge: drop some outer stones.
        if (d > r - 1 && this.rng.chance(0.35)) continue;
        this.tile(cx, cz, COBBLE);
      }
    }
    this.reserved.push({ x: 0, z: 0, radius: r + 1 });
  }

  /** A 2-wide dirt path from the plaza edge to a house's front door. */
  buildPath({ center, front }, doorDistance) {
    const doorX = center.x + front.x * doorDistance;
    const doorZ = center.z + front.z * doorDistance;
    const length = Math.hypot(doorX, doorZ);
    const done = new Set();
    for (let t = VILLAGE.plazaRadius - 1; t <= length; t += 0.5) {
      const px = (doorX / length) * t;
      const pz = (doorZ / length) * t;
      for (const [ox, oz] of [[0, 0], [front.z, front.x], [-front.z, -front.x]]) {
        const tx = Math.floor(px + ox * 0.6) + 0.5;
        const tz = Math.floor(pz + oz * 0.6) + 0.5;
        const key = `${tx},${tz}`;
        if (done.has(key) || Math.hypot(tx, tz) < VILLAGE.plazaRadius - 0.5) continue;
        done.add(key);
        this.tile(tx, tz, DIRT);
      }
      this.reserved.push({ x: px, z: pz, radius: 1.5 });
    }
  }

  /** The middle of the gap between ring buildings that points most toward `angle`. */
  gapToward(angle) {
    const sorted = this.ringAngles.map((a) => ((a % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2)).sort((a, b) => a - b);
    let best = null;
    sorted.forEach((a, i) => {
      const b = i + 1 < sorted.length ? sorted[i + 1] : sorted[0] + Math.PI * 2;
      const mid = (a + b) / 2;
      const off = Math.abs(Math.atan2(Math.sin(mid - angle), Math.cos(mid - angle)));
      if (!best || off < best.off) best = { mid, off };
    });
    return best.mid;
  }

  tile(x, z, palette) {
    this.floor.box(x, 0.03, z, 1, 0.06, 1, vary(this.rng.pick(palette), this.rng, 0.04));
  }

  onAdd(game) {
    game.colliders.push(...this.colliders);
    game.reservedAreas.push(...this.reserved);
    game.cameraBlockers.push(this.object3d.children[0]);
  }

  update(dt, game) {
    // Lanterns glow brighter at night.
    glowMaterial.emissiveIntensity = 0.6 + (game.dayNight?.nightness ?? 0) * 1.6;

    // A puff of smoke from a random chimney every so often.
    this.smokeTimer -= dt;
    if (this.smokeTimer > 0 || !this.chimneys.length) return;
    this.smokeTimer = 0.25;
    const chimney = this.chimneys[Math.floor(Math.random() * this.chimneys.length)];
    game.particles?.burst(chimney, {
      count: 1,
      colors: ['#e6e6e6', '#d0d0d0', '#f4f4f4'],
      speed: 0.4,
      size: 0.45,
      life: 2.6,
      gravity: -0.6,
    });
  }
}
