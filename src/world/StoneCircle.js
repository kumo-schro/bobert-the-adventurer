import * as THREE from 'three';
import { Entity } from '../core/Entity.js';
import { VoxelBuilder } from '../core/VoxelBuilder.js';
import { stoneTexture, texturedVoxelMaterial } from '../core/textures.js';
import { createRng } from '../utils/random.js';
import { vary } from '../utils/color.js';
import { Chest } from '../entities/Chest.js';
import { SEED, PLACES } from '../config.js';

// The order to step on the plates (a rainbow!). Add more colors to make it harder.
export const RAINBOW = [
  { name: 'red', color: '#ff4d4d' },
  { name: 'orange', color: '#ff9a1f' },
  { name: 'yellow', color: '#ffd23f' },
  { name: 'green', color: '#5fd35a' },
  { name: 'blue', color: '#3f8cff' },
  { name: 'purple', color: '#a45cff' },
];

const STONE = ['#9a9ca3', '#8d8f96', '#a6a8ae'];
const PLATE_HALF = 0.75;
const stoneMaterial = texturedVoxelMaterial(stoneTexture);

/**
 * An old ring of standing stones with colored pressure plates inside. Step on the plates in
 * rainbow order to make a treasure chest appear. Stepping on the wrong one resets them.
 *
 * The puzzle only wakes up after `activate()` (when the elder gives you the quest).
 * Callbacks: `onSolved(chest)`, `onReset()`.
 */
export class StoneCircle extends Entity {
  constructor({ x, z } = PLACES.stoneCircle) {
    super();
    this.position = new THREE.Vector3(x, 0, z);
    this.questPosition = this.position; // where the quest arrow points
    this.rng = createRng(SEED + 12);
    this.active = false;
    this.solved = false;
    this.next = 0;
    this.standingOn = null;
    this.colliders = [];
    this.onSolved = null;
    this.onReset = null;

    this.buildStones();
    this.buildPlates();
  }

  buildStones() {
    const b = new VoxelBuilder();
    const { x, z } = this.position;
    const count = 8;
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2;
      const sx = x + Math.cos(a) * 6;
      const sz = z + Math.sin(a) * 6;
      const h = this.rng.range(2.2, 3.4);
      b.box(sx, h / 2, sz, 1.1, h, 0.8, vary(this.rng.pick(STONE), this.rng, 0.04));
      b.box(sx, h + 0.1, sz, 1.0, 0.2, 0.7, vary('#6fbf4a', this.rng, 0.05)); // moss
      this.colliders.push({ x: sx, z: sz, radius: 0.65 });
    }
    // Hint stone at the edge of the ring: the colors in order, left to right.
    const hx = x;
    const hz = z + 4.2;
    const width = RAINBOW.length * 0.6 + 0.4;
    b.box(hx, 0.7, hz, width, 1.4, 0.5, vary(STONE[0], this.rng, 0.03));
    RAINBOW.forEach((c, i) => b.box(hx - ((RAINBOW.length - 1) * 0.6) / 2 + i * 0.6, 0.9, hz + 0.27, 0.4, 0.4, 0.06, c.color));
    this.colliders.push({ x: hx, z: hz, halfX: width / 2, halfZ: 0.25 });

    this.object3d.add(b.build({ merge: true, material: stoneMaterial }));
  }

  buildPlates() {
    const { x, z } = this.position;
    const spots = [[-2.6, -2], [0, -2], [2.6, -2], [-2.6, 1.2], [0, 1.2], [2.6, 1.2]];
    // Shuffle so the plates aren't laid out in order.
    for (let i = spots.length - 1; i > 0; i--) {
      const j = this.rng.int(0, i);
      [spots[i], spots[j]] = [spots[j], spots[i]];
    }
    this.plates = RAINBOW.map((c, order) => {
      const [ox, oz] = spots[order];
      const group = new THREE.Group();
      group.position.set(x + ox, 0, z + oz);
      const frame = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.1, 1.8), new THREE.MeshLambertMaterial({ color: '#7d8088' }));
      frame.position.y = 0.05;
      frame.receiveShadow = true;
      const material = new THREE.MeshLambertMaterial({ color: c.color, emissive: c.color, emissiveIntensity: 0 });
      const top = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.16, 1.4), material);
      top.position.y = 0.16;
      top.castShadow = top.receiveShadow = true;
      group.add(frame, top);
      this.object3d.add(group);
      return { order, ...c, group, top, material, pressed: false };
    });
  }

  onAdd(game) {
    game.colliders.push(...this.colliders);
    game.reservedAreas.push({ x: this.position.x, z: this.position.z, radius: 8 });
  }

  /** Wake the puzzle up. With `reverse: true` the order is backwards (purple first). */
  activate({ reverse = false } = {}) {
    this.active = true;
    this.solved = false;
    this.reverse = reverse;
    this.next = 0;
    this.round = (this.round ?? 0) + 1;
    this.standingOn = null; // forget the last stone from the previous round
    for (const p of this.plates) p.pressed = false;
  }

  /** Which plate (by rainbow order) should be stepped on next. */
  get expected() {
    return this.reverse ? this.plates.length - 1 - this.next : this.next;
  }

  plateUnder(p) {
    if (p.y > 0.6) return null;
    return this.plates.find((pl) => Math.abs(pl.group.position.x - p.x) < PLATE_HALF && Math.abs(pl.group.position.z - p.z) < PLATE_HALF) ?? null;
  }

  update(dt, game) {
    // Pressed plates sink and glow; the next plate pulses gently once the puzzle is awake.
    for (const plate of this.plates) {
      const down = plate.pressed ? 0.08 : 0.16;
      plate.top.position.y += (down - plate.top.position.y) * (1 - Math.exp(-12 * dt));
      plate.material.emissiveIntensity = plate.pressed ? 0.6 : this.active && !this.solved ? 0.08 + Math.sin(game.elapsed * 3) * 0.06 : 0;
    }
    if (!this.active || this.solved) return;

    const plate = this.plateUnder(game.player.object3d.position);
    if (plate === this.standingOn) return;
    this.standingOn = plate;
    if (!plate || plate.pressed) return;

    if (plate.order === this.expected) {
      plate.pressed = true;
      this.next++;
      game.particles?.burst(plate.group.position.clone().setY(0.4), { count: 16, colors: [plate.color, '#ffffff'], speed: 4, size: 0.14 });
      if (this.next === this.plates.length) this.solve(game);
    } else {
      this.reset(game, plate);
    }
  }

  reset(game, wrongPlate) {
    for (const p of this.plates) p.pressed = false;
    this.next = 0;
    game.particles?.burst(wrongPlate.group.position.clone().setY(0.4), { count: 20, colors: ['#3b3b3b', '#7d8088'], speed: 4, size: 0.16 });
    game.questLog?.toast('Oops! Wrong order. The stones reset.');
    this.onReset?.();
  }

  solve(game) {
    this.solved = true;
    const chest = game.add(new Chest({ x: this.position.x + (this.round - 1) * 1.6, z: this.position.z - 0.4 }, { coins: 40, facing: 0 }));
    game.particles?.burst(this.position.clone().setY(1), {
      count: 60,
      colors: RAINBOW.map((c) => c.color),
      speed: 7,
      size: 0.2,
      life: 1.5,
    });
    game.questLog?.toast('The stones glow... a treasure chest appeared!');
    this.onSolved?.(chest);
  }
}
