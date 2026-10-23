import * as THREE from 'three';
import { Entity } from '../core/Entity.js';
import { VoxelBuilder } from '../core/VoxelBuilder.js';
import { blockMaterial, dirtMaterial } from '../core/textures.js';
import { createRng } from '../utils/random.js';
import { vary } from '../utils/color.js';
import { stoneHouse, marketStall, bakeryStall, crystalStall, well, forge, forgeWing } from '../models/buildings.js';
import { SEED, VILLAGE, CAMERA, PLACES, WORLD } from '../config.js';

const ROOF_NAMES = {
  '#d9493f': 'red',
  '#3f7fd9': 'blue',
  '#e08a2e': 'orange',
  '#7a4fd1': 'purple',
  '#2fa36b': 'green',
  '#d94f9a': 'pink',
};
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
    this.buildingBuilders = []; // one per building, so each can turn see-through on its own
    this.floor = new VoxelBuilder(); // flat paving, doesn't cast shadows
    this.glow = new VoxelBuilder(); // lanterns and oven fires
    this.chimneys = []; // where smoke comes out
    this.houses = []; // { door, front } for each house, so villagers can go home to sleep
    this.ringAngles = []; // angle of every building around the ring (for finding gaps between them)
    this.landmarks = []; // { name, x, z } for describing what someone clicked on
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
        const smithy = this.place(forge, angle, radius - 1, undefined, 'the forge');
        this.smithy = smithy;
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
      const house = this.place(stoneHouse, angle, radius, { hw, hd, roof, style: i }, `a house (the one with the ${ROOF_NAMES[roof] ?? 'colored'} roof)`);
      this.buildPath(house, hd + 1.3);
      this.reserved.push({ ...house.center, radius: Math.hypot(hw + 2, hd) + 1 });
      this.houses.push({
        door: { x: house.center.x + house.front.x * (hd + 1.3), z: house.center.z + house.front.z * (hd + 1.3) },
        front: house.front,
      });
    }

    const stall = this.place(marketStall, stallAngle, VILLAGE.plazaRadius + 4, undefined, "the merchant's market stall");
    this.ringAngles.push(stallAngle);
    this.reserved.push({ ...stall.center, radius: 4 });
    this.merchantSpot = new THREE.Vector3(
      stall.center.x + stall.front.x * 2.2,
      0,
      stall.center.z + stall.front.z * 2.2,
    );
    this.merchantFacing = Math.atan2(stall.front.x, stall.front.z);

    // The bakery sits between two houses on the left of the starting view (the forge is on the right).
    const bakeryAngle = stallAngle - gap / 2 - step / 2;
    const bakery = this.place(bakeryStall, bakeryAngle, VILLAGE.plazaRadius + 4.5, undefined, "Hana's bakery");
    this.reserved.push({ ...bakery.center, radius: 4.5 });
    this.bakerSpot = new THREE.Vector3(
      bakery.center.x + bakery.front.x * 2.2,
      0,
      bakery.center.z + bakery.front.z * 2.2,
    );
    this.bakerFacing = Math.atan2(bakery.front.x, bakery.front.z);

    // Well off to the side so it isn't in the merchant's way.
    const wellAngle = stallAngle - Math.PI / 2;
    const w = this.place(well, wellAngle, VILLAGE.plazaRadius - 2.5, { roof: '#3f7fd9' }, 'the well');
    this.reserved.push({ ...w.center, radius: 2.5 });

    this.buildOuterRing(bakeryAngle);

    // Pip's crystal shop, between two houses on the right of the plaza. (Built last, so the
    // rest of the village comes out the same as before it was added.)
    const crystalAngle = stallAngle + THREE.MathUtils.degToRad(80);
    const crystals = this.place(crystalStall, crystalAngle, VILLAGE.plazaRadius + 4, undefined, "Pip's crystal shop");
    this.reserved.push({ ...crystals.center, radius: 3.5 });
    this.pipShopSpot = { x: crystals.center.x + crystals.front.x * 2.1, z: crystals.center.z + crystals.front.z * 2.1 };
    this.pipShopFacing = Math.atan2(crystals.front.x, crystals.front.z);

    this.buildingMeshes = this.buildingBuilders.map((b) => b.build({ merge: true, material: blockMaterial }));
    this.object3d.add(...this.buildingMeshes);
    this.object3d.add(this.floor.build({ merge: true, cullBottom: true, castShadow: false, material: dirtMaterial }));
    this.object3d.add(this.glow.build({ merge: true, material: glowMaterial, castShadow: false }));
    this.smokeTimer = 0;
  }

  /**
   * Places a building recipe at (angle, radius) from the plaza center, rotated to face
   * the center. Returns where it ended up and which way its front faces.
   */
  place(recipe, angle, radius, options, name = 'a building') {
    const cx = Math.floor(Math.cos(angle) * radius) + 0.5;
    const cz = Math.floor(Math.sin(angle) * radius) + 0.5;
    const k = facing(-cx, -cz);
    const into = (builder) => (x, y, z, color, sx = 1, sy = 1, sz = 1) => {
      const [rx, rz] = rotate(x, z, k);
      const [w, d] = k % 2 ? [sz, sx] : [sx, sz];
      builder.box(cx + rx, y, cz + rz, w, sy, d, color);
    };
    const builder = new VoxelBuilder();
    this.buildingBuilders.push(builder);
    const put = into(builder);
    put.glow = into(this.glow); // glowing parts (lanterns, fires)
    const { halfX, halfZ, smoke } = recipe(put, this.rng, options);
    if (smoke) {
      const [sx, sz] = rotate(smoke[0], smoke[2], k);
      this.chimneys.push(new THREE.Vector3(cx + sx, smoke[1], cz + sz));
    }
    const [hx, hz] = k % 2 ? [halfZ, halfX] : [halfX, halfZ];
    this.colliders.push({ x: cx, z: cz, halfX: hx, halfZ: hz });

    const [fx, fz] = rotate(0, 1, k);
    this.landmarks.push({ name, x: cx, z: cz });
    return { center: { x: cx, z: cz }, front: { x: fx, z: fz }, k };
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

  /**
   * More houses: an outer ring, each one out through a gap between the inner houses (so its
   * path doesn't run through anything). Skips the gaps used by the bakery and the road to the
   * dock, and anywhere too close to the mountain, the stone circle or the slime meadow.
   */
  buildOuterRing(bakeryAngle) {
    const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
    const roadGap = this.gapToward(Math.atan2(PLACES.dockZ, WORLD.islandRadius));
    const sorted = this.ringAngles.map(wrap).sort((a, b) => a - b);
    const avoid = [
      { ...PLACES.cave, r: 32 },
      { ...PLACES.stoneCircle, r: 16 },
      { ...PLACES.slimeMeadow, r: 14 },
    ];
    let n = 0;
    sorted.forEach((a, i) => {
      const b = i + 1 < sorted.length ? sorted[i + 1] : sorted[0] + Math.PI * 2;
      const angle = (a + b) / 2;
      if (Math.abs(wrap(angle - bakeryAngle)) < 0.35 || Math.abs(wrap(angle - roadGap)) < 0.35) return;
      const radius = VILLAGE.outerRingRadius + this.rng.range(-1.5, 1.5);
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;
      if (avoid.some((p) => Math.hypot(p.x - x, p.z - z) < p.r)) return;
      const roof = VILLAGE.roofColors[(n + 3) % VILLAGE.roofColors.length];
      const hw = this.rng.int(3, 4);
      const hd = this.rng.int(2, 3);
      const house = this.place(stoneHouse, angle, radius, { hw, hd, roof, style: n + 1 }, `a house (the one with the ${ROOF_NAMES[roof] ?? 'colored'} roof)`);
      this.buildPath(house, hd + 1.3);
      this.reserved.push({ ...house.center, radius: Math.hypot(hw + 2, hd) + 1 });
      this.houses.push({
        door: { x: house.center.x + house.front.x * (hd + 1.3), z: house.center.z + house.front.z * (hd + 1.3) },
        front: house.front,
        outer: true,
      });
      n++;
    });
  }

  /** Build the forge's big new wing (when the player helps make a bigger forge). */
  upgradeForge(game) {
    if (this.forgeUpgraded) return;
    this.forgeUpgraded = true;
    const { center, k } = this.smithy;
    const builder = new VoxelBuilder();
    const glow = new VoxelBuilder();
    const into = (b) => (x, y, z, color, sx = 1, sy = 1, sz = 1) => {
      const [rx, rz] = rotate(x, z, k);
      const [w, d] = k % 2 ? [sz, sx] : [sx, sz];
      b.box(center.x + rx, y, center.z + rz, w, sy, d, color);
    };
    const put = into(builder);
    put.glow = into(glow);
    const wing = forgeWing(put, this.rng);
    const wingMesh = builder.build({ merge: true, material: blockMaterial });
    this.object3d.add(wingMesh, glow.build({ merge: true, material: glowMaterial, castShadow: false }));
    game.cameraBlockers.push(wingMesh);
    const [wx, wz] = rotate(wing.center[0], wing.center[1], k);
    const [hx, hz] = k % 2 ? [wing.halfZ, wing.halfX] : [wing.halfX, wing.halfZ];
    game.colliders.push({ x: center.x + wx, z: center.z + wz, halfX: hx, halfZ: hz });
    const [sx, sz] = rotate(wing.smoke[0], wing.smoke[2], k);
    this.chimneys.push(new THREE.Vector3(center.x + sx, wing.smoke[1], center.z + sz));
    this.landmarks.push({ name: 'the big forge', x: center.x + wx, z: center.z + wz });
    game.particles?.burst(new THREE.Vector3(center.x + wx, 2, center.z + wz), { count: 60, colors: ['#ffc93c', '#ff7a1a', '#ffffff'], speed: 6, size: 0.2 });
  }

  /** What's at this spot (for the "suggest a change" tool): the nearest building, or the plaza. */
  describe(point) {
    if (Math.hypot(point.x, point.z) < VILLAGE.plazaRadius && point.y < 0.3) return 'the village plaza';
    let best = null;
    for (const l of this.landmarks) {
      const d = Math.hypot(l.x - point.x, l.z - point.z);
      if (!best || d < best.d) best = { name: l.name, d };
    }
    return best && best.d < 8 ? best.name : 'a path in the village';
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
    game.village = this;
    game.colliders.push(...this.colliders);
    game.reservedAreas.push(...this.reserved);
    game.cameraBlockers.push(...this.buildingMeshes); // each building turns see-through when it's in the way
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
