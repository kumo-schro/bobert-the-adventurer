import * as THREE from 'three';
import { Entity } from '../core/Entity.js';
import { VoxelBuilder } from '../core/VoxelBuilder.js';
import { stoneTexture, texturedVoxelMaterial, blockMaterial } from '../core/textures.js';
import { createRng } from '../utils/random.js';
import { vary } from '../utils/color.js';
import { glowMaterial } from './Village.js';
import { SEED, PLACES } from '../config.js';

const HALF_X = 7; // inside of the room
const HALF_Z = 5;
const WALL = 4;
const EARTH = 36; // dirt all around, so it looks like a room dug into the ground

const stoneMaterial = texturedVoxelMaterial(stoneTexture);

/**
 * Old Man Ward's cellar, down the trapdoor. It's built far away from the island (out of
 * sight) and you get there by teleporting. Cozy: fireplace, bed, books, maps of the sea.
 * The ladder takes you back up to the trapdoor. Registers as walkable land.
 * Exposes `arrive` (where you land coming down), `keeganSpot`, and `trapdoor` (set by main.js).
 */
export class Cellar extends Entity {
  constructor({ x, z } = PLACES.cellar) {
    super();
    this.center = { x, z };
    this.inside = false; // only change the camera when we go in or come out
    this.ladder = { x: x - HALF_X + 1.2, z: z - HALF_Z + 1 };
    this.arrive = { x: this.ladder.x + 1.2, z: this.ladder.z + 1.2, facing: 0.8 };
    this.keeganSpot = { x: x + 2.5, z: z + 0.5 };
    this.trapdoor = null;
    this.build();
  }

  isInside(x, z, margin = 0) {
    return Math.abs(x - this.center.x) < HALF_X - 0.5 - margin && Math.abs(z - this.center.z) < HALF_Z - 0.5 - margin;
  }

  heightAt(x, z) {
    return this.isInside(x, z) ? 0 : null;
  }

  build() {
    const rng = createRng(SEED + 91);
    const stone = new VoxelBuilder();
    const b = new VoxelBuilder();
    const earth = new VoxelBuilder(); // the dark earth around the room (see-through when it's in the way)
    const glow = new VoxelBuilder();
    const { x: X, z: Z } = this.center;

    // Plank floor
    for (let ix = -HALF_X; ix < HALF_X; ix++) {
      b.box(X + ix + 0.5, -0.05, Z, 1, 0.1, HALF_Z * 2, vary(rng.pick(['#8a5a35', '#7a4a24', '#94633b']), rng, 0.04));
    }
    // Stone walls, and dark earth all around up to the top of them.
    for (let ix = -EARTH; ix < EARTH; ix += 2) {
      for (let iz = -EARTH; iz < EARTH; iz += 2) {
        const cx = X + ix + 1;
        const cz = Z + iz + 1;
        if (Math.abs(cx - X) < HALF_X + 1 && Math.abs(cz - Z) < HALF_Z + 1) continue;
        earth.box(cx, WALL / 2 - 0.5, cz, 2, WALL + 1, 2, vary(rng.pick(['#4a3526', '#56402c', '#3f2e21']), rng, 0.05));
      }
    }
    for (let ix = -HALF_X - 1; ix <= HALF_X; ix++) {
      for (let iz = -HALF_Z - 1; iz <= HALF_Z; iz++) {
        const edge = ix === -HALF_X - 1 || ix === HALF_X || iz === -HALF_Z - 1 || iz === HALF_Z;
        if (!edge) continue;
        for (let y = 0; y < WALL; y++) stone.add(X + ix + 0.5, y + 0.5, Z + iz + 0.5, vary(rng.pick(['#8d8f96', '#7d8088', '#9a9ca3']), rng, 0.04));
      }
    }

    const back = Z - HALF_Z; // the back wall (inside face)
    // Fireplace on the back wall
    stone.box(X + 2, 1.2, back + 0.5, 2.6, 2.4, 1, '#6f7480');
    stone.box(X + 2, 3, back + 0.4, 1, 2, 0.8, '#6f7480');
    b.box(X + 2, 0.6, back + 1.02, 1.4, 1, 0.05, '#1d1d1d');
    glow.box(X + 2, 0.4, back + 1.05, 1, 0.5, 0.1, '#ff9a1f');
    glow.box(X + 2, 0.7, back + 1.06, 0.5, 0.4, 0.1, '#ffd23f');
    // Bed in the corner
    b.box(X + 5.4, 0.35, Z + 3, 2.2, 0.5, 3, '#7a4a24');
    b.box(X + 5.4, 0.68, Z + 3.2, 2, 0.18, 2.4, '#3f7fd9'); // blanket
    b.box(X + 5.4, 0.75, Z + 4.1, 1.6, 0.25, 0.6, '#ffffff'); // pillow
    // Table with a candle and a map of the sea
    b.box(X - 1, 0.8, Z + 1.5, 2, 0.15, 1.3, '#94633b');
    for (const [dx, dz] of [[-0.8, -0.5], [0.8, -0.5], [-0.8, 0.5], [0.8, 0.5]]) b.box(X - 1 + dx, 0.38, Z + 1.5 + dz, 0.15, 0.75, 0.15, '#5e3b22');
    b.box(X - 1.3, 0.89, Z + 1.5, 0.9, 0.02, 0.7, '#f4ecd8');
    b.box(X - 1.3, 0.9, Z + 1.5, 0.3, 0.02, 0.3, '#3cc6ea'); // a little sea drawn on it
    b.box(X - 0.3, 0.95, Z + 1.3, 0.14, 0.2, 0.14, '#f4ecd8');
    glow.box(X - 0.3, 1.1, Z + 1.3, 0.08, 0.12, 0.08, '#ffd23f');
    b.box(X - 1, 0.45, Z + 2.6, 0.6, 0.9, 0.6, '#7a4a24'); // stool
    // Bookshelf on the side wall
    b.box(X - HALF_X + 0.4, 1.5, Z + 1.5, 0.6, 3, 2.6, '#5e3b22');
    for (let shelf = 0; shelf < 3; shelf++) {
      for (let i = 0; i < 6; i++) {
        b.box(X - HALF_X + 0.75, 0.55 + shelf * 0.9, Z + 0.5 + i * 0.38, 0.1, 0.6, 0.3, rng.pick(['#d9493f', '#3f7fd9', '#2fa36b', '#ffc93c', '#7a4fd1']));
      }
    }
    // Barrels and a big old anchor leaning on the wall
    b.box(X + 5.6, 0.5, Z - 3.6, 0.9, 1, 0.9, '#5e3b22');
    b.box(X + 4.5, 0.5, Z - 3.8, 0.9, 1, 0.9, '#5e3b22');
    b.box(X - 3.5, 1.5, back + 0.2, 0.25, 2.4, 0.2, '#55595f');
    b.box(X - 3.5, 0.4, back + 0.2, 1.4, 0.25, 0.2, '#55595f');
    // Ladder up to the trapdoor, with daylight shining down it
    const { x: lx, z: lz } = this.ladder;
    for (const dx of [-0.4, 0.4]) b.box(lx + dx, WALL / 2, lz - 0.3, 0.12, WALL, 0.12, '#5e3b22');
    for (let y = 0.4; y < WALL; y += 0.5) b.box(lx, y, lz - 0.3, 0.8, 0.08, 0.1, '#5e3b22');
    const beam = new THREE.Mesh(
      new THREE.BoxGeometry(1.4, WALL + 2, 1.4),
      new THREE.MeshBasicMaterial({ color: '#fff6c9', transparent: true, opacity: 0.18, depthWrite: false }),
    );
    beam.position.set(lx, (WALL + 2) / 2, lz);
    this.object3d.add(beam);

    // A big dark shell all around, so from the cellar you only ever see earth (it's built far
    // out at sea). The camera sits inside it.
    const shell = new THREE.Mesh(new THREE.BoxGeometry(90, 70, 90), new THREE.MeshBasicMaterial({ color: '#140d08', side: THREE.BackSide }));
    shell.position.set(X, 20, Z);
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(90, 90), new THREE.MeshBasicMaterial({ color: '#1f150d' }));
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(X, -0.3, Z); // covers the sea under the see-through earth
    this.object3d.add(shell, ground);
    this.walls = stone.build({ material: stoneMaterial });
    this.earth = earth.build({ material: blockMaterial });
    this.object3d.add(this.walls, this.earth, b.build({ material: blockMaterial }), glow.build({ material: glowMaterial, castShadow: false }));

    // Warm firelight and candlelight
    const fire = new THREE.PointLight('#ff9a4a', 12, 16, 1.4);
    fire.position.set(X + 2, 1.5, back + 2);
    const candle = new THREE.PointLight('#ffd27a', 5, 9, 1.6);
    candle.position.set(X - 0.3, 1.8, Z + 1.3);
    this.fire = fire;
    this.object3d.add(fire, candle);
  }

  onAdd(game) {
    game.lands.push(this);
    game.cellar = this;
    game.cameraBlockers.push(this.walls, this.earth); // see-through when they're between the camera and you
    const { x: X, z: Z } = this.center;
    const back = Z - HALF_Z;
    game.colliders.push(
      { x: X + 2, z: back + 0.5, halfX: 1.3, halfZ: 0.6 }, // fireplace
      { x: X + 5.4, z: Z + 3, halfX: 1.1, halfZ: 1.5 }, // bed
      { x: X - 1, z: Z + 1.5, halfX: 1, halfZ: 0.65 }, // table
      { x: X - HALF_X + 0.4, z: Z + 1.5, halfX: 0.3, halfZ: 1.3 }, // bookshelf
      { x: X + 5.05, z: Z - 3.7, halfX: 1, halfZ: 0.5 }, // barrels
    );
  }

  update(dt, game) {
    const player = game.player;
    const p = player?.object3d.position;
    if (!p) return;
    const inside = Math.abs(p.x - this.center.x) < HALF_X + 2 && Math.abs(p.z - this.center.z) < HALF_Z + 2;
    this.inside = inside;
    if (!inside) return;
    this.fire.intensity = 12 + Math.sin(game.elapsed * 11) * 1.5 + Math.sin(game.elapsed * 5.3) * 1;

    const d = Math.hypot(p.x - this.ladder.x, p.z - this.ladder.z);
    if (d < 2 && this.trapdoor && !player.dead) {
      game.dialog.offerInteraction('Press T to climb up the ladder', d, () => {
        const t = this.trapdoor.object3d.position;
        game.teleport(t.x + 1.8, t.z, { facing: Math.PI / 2 });
      });
    }
  }
}
