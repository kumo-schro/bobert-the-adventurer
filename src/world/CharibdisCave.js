import * as THREE from 'three';
import { Entity } from '../core/Entity.js';
import { VoxelBuilder } from '../core/VoxelBuilder.js';
import { stoneTexture, texturedVoxelMaterial } from '../core/textures.js';
import { createRng, createNoise2D } from '../utils/random.js';
import { vary } from '../utils/color.js';
import { part } from '../models/character.js';
import { SEED, PLACES, SEA } from '../config.js';

const POOL = 14; // radius of the flooded chamber inside
const OUTER = 21; // outside radius of the rock
const WALL = 6; // height of the rock walls (the roof goes on top)
const TUNNEL_HALF = 2; // the way in is 4 wide, on the side facing the main island (-z)

const ROCK = ['#6f7480', '#5f646e', '#7b808a', '#676157'];
const MOSS = ['#3f8f4a', '#4fa35a', '#367a40'];

const wallMaterial = texturedVoxelMaterial(stoneTexture);
const roofMaterial = texturedVoxelMaterial(stoneTexture);

/**
 * Charibdis's cave: a rocky island far out at sea with a flooded cave inside. The way in is
 * barred by an iron gate that only the key opens. Inside, the roof is cut away (like the slime
 * cave) so you can see down into the water. Exposes `lairSpot` (where Charibdis lives) and `gate`.
 * `onUnlock` is set by the quest. Lives at game.charibdisCave.
 */
export class CharibdisCave extends Entity {
  constructor({ x, z } = PLACES.charibdisCave) {
    super();
    this.center = { x, z };
    this.inside = false; // only change the camera when we go in or come out
    this.lairSpot = { x, z: z + 1 };
    this.solid = new Set();
    this.rng = createRng(SEED + 71);
    this.noise = createNoise2D(SEED + 71);
    this.locked = true;
    this.onUnlock = null;
    this.gateSpot = { x, z: z - OUTER + 0.5 };
    this.questPosition = new THREE.Vector3(this.gateSpot.x, 0, this.gateSpot.z - 1.5);
    this.build();
  }

  /** Inside the cave (the chamber or the tunnel)? */
  isInsideCave(x, z) {
    const lx = x - this.center.x;
    const lz = z - this.center.z;
    if (Math.hypot(lx, lz) < POOL + 0.5) return true;
    return Math.abs(lx) < TUNNEL_HALF + 0.5 && lz < 0 && lz > -OUTER + 1;
  }

  isTunnel(lx, lz) {
    return Math.abs(lx) < TUNNEL_HALF && lz < 0;
  }

  isSolid(ix, iz) {
    return this.solid.has(`${ix},${iz}`) || (this.locked && this.gateCells.has(`${ix},${iz}`));
  }

  build() {
    const { rng } = this;
    const walls = new VoxelBuilder();
    const roof = new VoxelBuilder();
    const { x: X, z: Z } = this.center;
    this.gateCells = new Set();

    for (let ix = Math.floor(X - OUTER - 1); ix <= X + OUTER + 1; ix++) {
      for (let iz = Math.floor(Z - OUTER - 1); iz <= Z + OUTER + 1; iz++) {
        const x = ix + 0.5;
        const z = iz + 0.5;
        const lx = x - X;
        const lz = z - Z;
        const d = Math.hypot(lx, lz);
        const wobble = (this.noise(ix * 0.2, iz * 0.2) - 0.5) * 3;
        if (d > OUTER + wobble * 0.5) continue;
        const tunnel = this.isTunnel(lx, lz);
        // Rounded dome over the chamber and tunnel; the outside slopes down to the sea.
        const outside = Math.max(0, d - POOL) / (OUTER - POOL);
        const top = Math.round(WALL + 4 * (1 - (d / OUTER) ** 2) - outside * 3 + wobble);

        if (d < POOL || tunnel) {
          // Open water inside, with a roof overhead (hidden when you're in).
          roof.box(x, (WALL + top) / 2 + 0.5, z, 1, Math.max(1, top - WALL + 1), 1, vary(rng.pick(ROCK), rng, 0.05));
          if (tunnel && Math.abs(lz + OUTER - 0.5) < 0.6) this.gateCells.add(`${ix},${iz}`);
          continue;
        }
        this.solid.add(`${ix},${iz}`);
        const h = Math.max(1, Math.min(top, WALL));
        walls.box(x, (h + SEA.floor) / 2, z, 1, h - SEA.floor, 1, vary(rng.pick(ROCK), rng, 0.05)); // rock all the way down
        if (top > WALL) roof.box(x, (WALL + top) / 2, z, 1, top - WALL, 1, vary(rng.pick(ROCK), rng, 0.05));
        else walls.box(x, h + 0.1, z, 1, 0.2, 1, vary(rng.pick(MOSS), rng, 0.06)); // mossy top
      }
    }

    this.walls = walls.build({ merge: true, material: wallMaterial });
    this.roof = roof.build({ merge: true, material: roofMaterial });
    this.object3d.add(this.walls, this.roof);
    this.buildGate();
    this.buildLights();
  }

  buildGate() {
    this.gate = new THREE.Group();
    this.gate.position.set(this.gateSpot.x, 0, this.gateSpot.z);
    for (let i = -4; i <= 4; i++) part(this.gate, [0.14, 4, 0.14], '#4a4f5a', [i * 0.45, 0.6, 0]); // bars
    for (const y of [-0.8, 1, 2.4]) part(this.gate, [4.2, 0.16, 0.18], '#3b3f48', [0, y, 0]);
    part(this.gate, [0.5, 0.6, 0.25], '#ffc93c', [0, 1.1, -0.1], { emissive: '#ffc93c' }); // big golden lock
    part(this.gate, [0.12, 0.25, 0.05], '#1d1d1d', [0, 1.05, -0.24]); // keyhole
    this.object3d.add(this.gate);
  }

  buildLights() {
    // Glowing crystals on the chamber walls, so it's not pitch black under the roof.
    for (let i = 0; i < 7; i++) {
      const a = Math.PI / 2 + (i - 3) * 0.75;
      const x = this.center.x + Math.cos(a) * (POOL + 0.2);
      const z = this.center.z + Math.sin(a) * (POOL + 0.2);
      const c = part(this.object3d, [0.4, 0.8, 0.4], '#5ef2e0', [x, 1.5, z], { emissive: '#5ef2e0' });
      c.material.emissiveIntensity = 1;
      const light = new THREE.PointLight('#7fffe8', 5, 14, 1.6);
      light.position.set(x, 2.5, z);
      this.object3d.add(light);
    }
  }

  onAdd(game) {
    game.colliders.push(this);
    game.cameraBlockers.push(this.walls, this.roof);
    game.charibdisCave = this;
  }

  unlock(game) {
    this.locked = false;
    this.gateOpening = true;
    game.questLog?.toast('Click! The gate swings open...');
    this.onUnlock?.();
  }

  update(dt, game) {
    const player = game.player;
    const p = player?.object3d.position;
    if (!p) return;

    if (this.gateOpening) {
      this.gate.position.y = Math.min(this.gate.position.y + dt * 2, 5); // slides up out of the way
      if (this.gate.position.y >= 5) this.gate.visible = this.gateOpening = false;
    }
    if (this.locked && !player.dead) {
      const d = Math.hypot(p.x - this.gateSpot.x, p.z - this.gateSpot.z);
      if (d < 3.2) {
        if (player.hasKey) game.dialog.offerInteraction('Press T to unlock the gate with the key', d, () => this.unlock(game));
        else game.dialog.offerInteraction('Press T to try the gate', d, () => game.questLog.toast('Locked tight! It needs a big golden key.'));
      }
    }

    const inside = this.isInsideCave(p.x, p.z);
    if (inside !== this.inside) {
      this.inside = inside;
      roofMaterial.colorWrite = roofMaterial.depthWrite = !inside; // still casts its shadow
      this.roof.userData.ignoreCamera = inside; // the walls turn see-through when they're in the way
    }
  }
}
