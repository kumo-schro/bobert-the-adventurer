import * as THREE from 'three';
import { Entity } from '../core/Entity.js';
import { VoxelBuilder } from '../core/VoxelBuilder.js';
import { stoneTexture, texturedVoxelMaterial, grassMaterial, sandMaterial, blockMaterial } from '../core/textures.js';
import { createRng, createNoise2D } from '../utils/random.js';
import { vary } from '../utils/color.js';
import { SEED, PLACES, SEA } from '../config.js';

const GRASS = ['#3fae4a', '#48b852', '#379c40', '#52bf5b'];
const COBBLE = ['#a8a39a', '#b5b0a6', '#9a958c', '#c0bbb1'];
const WALL = ['#c9c2b4', '#bdb5a6', '#d4cdbf', '#b3ab9b'];
const BLUE = '#2f5fb8';
const GOLD = '#ffcf3f';
const stoneMaterial = texturedVoxelMaterial(stoneTexture);
const glowMaterial = new THREE.MeshLambertMaterial({ color: '#ffffff', emissive: '#ffb347', emissiveIntensity: 0.9 });

const HALF = 15; // the castle walls make a square this far from the middle of the courtyard
const WALL_HEIGHT = 5;
const GATE = 2.6; // half the width of the gate

/**
 * Tulane Kingdom, Bobert's home, far across the sea. A white stone castle with corner towers,
 * blue and gold banners, a cobbled courtyard and King Stuart's golden throne. The intro starts
 * here (Bobert juggling swords for the king), and once Bobert is famous again, Tulane's herald
 * brings him back to face the king. You can't swim away (the currents are too strong).
 * Exposes `arrive`, `captainSpot`, `courtyard`, `jugglerSpot`, `kingSpot`, `princeSpot`, `throneSpot`,
 * `guardSpots`; `travel(game)` takes you there.
 */
export class Tulane extends Entity {
  constructor({ x, z, radius } = PLACES.tulane) {
    super();
    this.center = { x, z };
    this.radius = radius;
    this.noise = createNoise2D(SEED + 151);
    this.rng = createRng(SEED + 151);
    const south = this.edgeRadius(0, -1) - 4;
    this.arrive = { x, z: z - south + 3, facing: 0 }; // on the pier, looking up at the castle
    this.captainSpot = { x: x + 3, z: z - south + 4 };
    this.courtyard = { x, z: z + 6 };
    this.throneSpot = { x, z: this.courtyard.z + HALF - 3 };
    this.kingSpot = { x, z: this.throneSpot.z - 1.6 };
    this.princeSpot = { x: x + 2.6, z: this.throneSpot.z - 2 };
    this.jugglerSpot = { x, z: this.courtyard.z + 2 };
    this.guardSpots = [
      { x: x - 4.5, z: this.courtyard.z + 8, facing: Math.PI / 2 },
      { x: x + 4.5, z: this.courtyard.z + 8, facing: -Math.PI / 2 },
      { x: x - GATE - 1.2, z: this.courtyard.z - HALF - 1.6, facing: Math.PI },
      { x: x + GATE + 1.2, z: this.courtyard.z - HALF - 1.6, facing: Math.PI },
    ];
  }

  edgeRadius(dx, dz) {
    const a = Math.atan2(dz, dx);
    return this.radius + (this.noise(Math.cos(a) * 1.5 + 60, Math.sin(a) * 1.5 + 60) - 0.5) * 10;
  }

  isInside(x, z, margin = 0) {
    const dx = x - this.center.x;
    const dz = z - this.center.z;
    return Math.hypot(dx, dz) < this.edgeRadius(dx, dz) - 2 - margin;
  }

  heightAt() {
    return null;
  }

  /** Somewhere on the island? */
  contains(x, z) {
    return this.isInside(x, z, -6);
  }

  onAdd(game) {
    game.lands.push(this);
    game.tulane = this;
    this.buildGround();
    this.buildCastle(game);
  }

  /** The herald's ship (or Captain Max) brings you here. */
  travel(game) {
    game.player.boat = null;
    game.teleport(this.arrive.x, this.arrive.z, { facing: this.arrive.facing });
    game.player.visitedTulane = true;
  }

  buildGround() {
    const { rng } = this;
    const grass = new VoxelBuilder();
    const sand = new VoxelBuilder();
    const cobble = new VoxelBuilder();
    const { x: X, z: Z } = this.center;
    const reach = this.radius + 8;
    const { x: CX, z: CZ } = this.courtyard;
    for (let ix = Math.floor(X - reach); ix < X + reach; ix++) {
      for (let iz = Math.floor(Z - reach); iz < Z + reach; iz++) {
        const x = ix + 0.5;
        const z = iz + 0.5;
        const d = Math.hypot(x - X, z - Z);
        const edge = this.edgeRadius(x - X, z - Z);
        if (d > edge) continue;
        if (d > edge - 1.5) sand.box(x, (SEA.floor - 1) / 2, z, 1, -1 - SEA.floor, 1, vary('#dcc58a', rng));
        else if (d > edge - 4) sand.add(x, -0.5, z, vary('#ecd38f', rng));
        else if (Math.abs(x - CX) < HALF && Math.abs(z - CZ) < HALF) cobble.add(x, -0.5, z, vary(rng.pick(COBBLE), rng, 0.04));
        else if (Math.abs(x - X) < 1.6 && z < CZ - HALF) cobble.add(x, -0.5, z, vary(rng.pick(COBBLE), rng, 0.04)); // the road to the gate
        else grass.add(x, -0.5, z, vary(rng.pick(GRASS), rng, 0.05));
      }
    }
    this.object3d.add(
      grass.build({ merge: true, cullBottom: true, chunk: 48, castShadow: false, material: grassMaterial }),
      sand.build({ merge: true, cullBottom: true, chunk: 48, castShadow: false, material: sandMaterial }),
      cobble.build({ merge: true, cullBottom: true, chunk: 48, castShadow: false, material: stoneMaterial }),
    );
  }

  buildCastle(game) {
    const { rng } = this;
    const walls = new VoxelBuilder();
    const deco = new VoxelBuilder();
    const glow = new VoxelBuilder();
    const { x: CX, z: CZ } = this.courtyard;
    const wallBox = (x, z, w, d) => {
      walls.box(x, WALL_HEIGHT / 2, z, w, WALL_HEIGHT, d, vary(rng.pick(WALL), rng, 0.03));
      game.colliders.push({ x, z, halfX: w / 2, halfZ: d / 2, sound: 'stone' });
    };
    // Four walls, with a gate in the south one
    wallBox(CX, CZ + HALF, HALF * 2 + 1.5, 1.5);
    wallBox(CX - HALF, CZ, 1.5, HALF * 2);
    wallBox(CX + HALF, CZ, 1.5, HALF * 2);
    const side = (HALF - GATE) / 2;
    wallBox(CX - GATE - side, CZ - HALF, HALF - GATE, 1.5);
    wallBox(CX + GATE + side, CZ - HALF, HALF - GATE, 1.5);
    // Battlements along the tops
    for (let t = -HALF; t <= HALF; t += 1.5) {
      for (const [x, z] of [[CX + t, CZ + HALF], [CX - HALF, CZ + t], [CX + HALF, CZ + t], [CX + t, CZ - HALF]]) {
        if (z === CZ - HALF && Math.abs(x - CX) < GATE + 0.5) continue;
        walls.box(x, WALL_HEIGHT + 0.4, z, 0.8, 0.8, 0.8, vary(rng.pick(WALL), rng, 0.03));
      }
    }
    // The gatehouse arch over the gate, with a banner
    walls.box(CX, WALL_HEIGHT + 1, CZ - HALF, GATE * 2 + 2, 2, 1.8, vary(WALL[0], rng, 0.03));
    for (const s of [-1, 1]) wallBox(CX + s * (GATE + 0.6), CZ - HALF, 1.2, 1.8);
    deco.box(CX, WALL_HEIGHT + 0.7, CZ - HALF - 0.95, 1.6, 2.2, 0.08, BLUE);
    deco.box(CX, WALL_HEIGHT + 1, CZ - HALF - 1.0, 0.6, 0.6, 0.06, GOLD);
    // Corner towers with blue roofs
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        const x = CX + sx * HALF;
        const z = CZ + sz * HALF;
        walls.box(x, 4.5, z, 4, 9, 4, vary(WALL[1], rng, 0.03));
        for (let i = 0; i < 4; i++) deco.box(x, 9.4 + i * 0.7, z, 4.4 - i * 1.1, 0.7, 4.4 - i * 1.1, BLUE);
        deco.box(x, 12.6, z, 0.12, 1.4, 0.12, '#5e3b22');
        deco.box(x + 0.4, 13, z, 0.7, 0.45, 0.05, GOLD); // a little flag
        game.colliders.push({ x, z, halfX: 2, halfZ: 2, sound: 'stone' });
      }
    }
    // Banners hanging inside the walls
    for (const t of [-9, -3, 3, 9]) {
      deco.box(CX + t, 3.2, CZ + HALF - 0.8, 1.4, 2.6, 0.08, BLUE);
      deco.box(CX + t, 3.4, CZ + HALF - 0.85, 0.5, 0.5, 0.06, GOLD);
    }
    // The throne on its dais, and a red carpet up to it
    const { x: TX, z: TZ } = this.throneSpot;
    deco.box(TX, 0.2, TZ, 6, 0.4, 4, '#8d8f96');
    deco.box(TX, 0.55, TZ + 0.3, 4.4, 0.3, 3, '#a8a39a');
    deco.box(TX, 1.3, TZ + 0.6, 1.6, 1.2, 1.2, GOLD); // seat
    deco.box(TX, 1.95, TZ + 0.6, 1.2, 0.12, 1.0, '#c0392b'); // cushion
    deco.box(TX, 2.8, TZ + 1.15, 1.6, 2.6, 0.3, GOLD); // tall back
    deco.box(TX, 3.6, TZ + 1.0, 0.5, 0.5, 0.06, '#3fd0ff'); // a jewel
    for (const s of [-1, 1]) deco.box(TX + s * 0.75, 1.9, TZ + 0.6, 0.15, 0.4, 1.0, GOLD); // arms
    for (let z = CZ - HALF; z < TZ - 2; z += 1) deco.box(TX, 0.03, z + 0.5, 2, 0.06, 1, '#b02a2a');
    game.colliders.push({ x: TX, z: TZ + 0.8, halfX: 1, halfZ: 0.9, sound: 'stone' });
    // Torches on the walls
    for (const [x, z] of [[CX - HALF + 1, CZ - 6], [CX - HALF + 1, CZ + 6], [CX + HALF - 1, CZ - 6], [CX + HALF - 1, CZ + 6], [CX - GATE - 1.5, CZ - HALF + 1], [CX + GATE + 1.5, CZ - HALF + 1]]) {
      deco.box(x, 2.6, z, 0.2, 0.8, 0.2, '#5e3b22');
      glow.box(x, 3.15, z, 0.3, 0.35, 0.3, '#ffb347');
    }
    // A little pier on the south beach, where boats come in
    const { x: AX, z: AZ } = this.arrive;
    for (let z = AZ - 8; z < AZ + 1; z += 1) deco.box(AX, -0.05, z + 0.5, 3, 0.2, 0.9, vary('#a0703f', rng, 0.06));
    for (const s of [-1, 1]) for (const z of [AZ - 7, AZ - 3]) deco.box(AX + s * 1.4, -1, z, 0.3, 2.4, 0.3, '#6b4423');
    this.walls = walls.build({ merge: true, material: stoneMaterial });
    this.object3d.add(this.walls, deco.build({ merge: true, material: blockMaterial }), glow.build({ merge: true, castShadow: false, material: glowMaterial }));
    game.cameraBlockers.push(this.walls);
    game.reservedAreas.push({ ...this.courtyard, radius: HALF + 3 });
  }
}
