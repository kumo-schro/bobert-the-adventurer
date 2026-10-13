import * as THREE from 'three';
import { Entity } from '../core/Entity.js';
import { gardenMaterial } from '../style/garden.js';
import { heightfieldGeometry, heightRamp } from '../style/heightfield.js';
import { createRng, createNoise2D } from '../utils/random.js';
import { part } from '../models/character.js';
import { SEED, PLACES, SEA } from '../config.js';

const POOL = 14; // radius of the flooded chamber inside
const OUTER = 21; // outside radius of the rock
const WALL = 6; // height of the rock walls (the roof goes on top)
const TUNNEL_HALF = 2; // the way in is 4 wide, on the side facing the main island (-z)

// Sea rock by height: deep blue-violet under the water, lavender cliffs, mossy green tops.
const ROCK_COLORS = heightRamp([[SEA.floor, '#1f2a5a'], [-1, '#3a3f8a'], [1, '#5a5cc0'], [4.5, '#7a6cd8'], [5.6, '#4fc890'], [8, '#8fe08a'], [11, '#d0f5a0']]);
function rockMaterial() {
  const m = gardenMaterial({ rim: 0.25, rimColor: '#c8f0ff' });
  m.vertexColors = true;
  m.flatShading = true;
  return m;
}
const wallMaterial = rockMaterial();
const roofMaterial = rockMaterial();

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
    const { x: X, z: Z } = this.center;
    this.gateCells = new Set();
    const tops = new Map(); // "ix,iz" -> height of the rock's top
    const open = new Set(); // the flooded chamber and the tunnel (roofed over)
    const key = (ix, iz) => `${ix},${iz}`;
    const bounds = { minX: Math.floor(X - OUTER - 1), maxX: Math.ceil(X + OUTER + 1), minZ: Math.floor(Z - OUTER - 1), maxZ: Math.ceil(Z + OUTER + 1) };

    for (let ix = bounds.minX; ix <= bounds.maxX; ix++) {
      for (let iz = bounds.minZ; iz <= bounds.maxZ; iz++) {
        const lx = ix + 0.5 - X;
        const lz = iz + 0.5 - Z;
        const d = Math.hypot(lx, lz);
        const wobble = (this.noise(ix * 0.2, iz * 0.2) - 0.5) * 3;
        if (d > OUTER + wobble * 0.5) continue;
        const tunnel = this.isTunnel(lx, lz);
        // Rounded dome over the chamber and tunnel; the outside slopes down to the sea.
        const outside = Math.max(0, d - POOL) / (OUTER - POOL);
        tops.set(key(ix, iz), WALL + 4 * (1 - (d / OUTER) ** 2) - outside * 3 + wobble);
        if (d < POOL || tunnel) {
          open.add(key(ix, iz));
          if (tunnel && Math.abs(lz + OUTER - 0.5) < 0.6) this.gateCells.add(key(ix, iz));
          continue;
        }
        this.solid.add(key(ix, iz));
      }
    }

    // Rock walls from the seabed up to the walls' height (all that's left when the roof is cut away)...
    const walls = heightfieldGeometry({
      ...bounds,
      top: (ix, iz) => (this.solid.has(key(ix, iz)) ? Math.max(1, Math.min(tops.get(key(ix, iz)), WALL)) : null),
      blend: (ix, iz) => (open.has(key(ix, iz)) ? null : -2.5), // the outside edge slopes into the sea
      bottom: () => SEA.floor,
      color: ROCK_COLORS,
    });
    // ...and the dome above them, roofing over the chamber and the tunnel.
    const isRoof = (ix, iz) => open.has(key(ix, iz)) || (this.solid.has(key(ix, iz)) && tops.get(key(ix, iz)) > WALL);
    const roof = heightfieldGeometry({
      ...bounds,
      top: (ix, iz) => (isRoof(ix, iz) ? Math.max(tops.get(key(ix, iz)), WALL + 1) : null),
      bottom: () => WALL,
      underside: (ix, iz) => open.has(key(ix, iz)),
      color: ROCK_COLORS,
    });

    this.walls = new THREE.Mesh(walls, wallMaterial);
    this.roof = new THREE.Mesh(roof, roofMaterial);
    for (const m of [this.walls, this.roof]) m.castShadow = m.receiveShadow = true;
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
      this.roof.userData.ignoreCamera = this.walls.userData.ignoreCamera = inside;
      game.cameraMode = inside ? 'cave' : null;
    }
  }
}
