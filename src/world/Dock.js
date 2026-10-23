import { Entity } from '../core/Entity.js';
import { VoxelBuilder } from '../core/VoxelBuilder.js';
import { plankMaterial } from '../core/textures.js';
import { createRng } from '../utils/random.js';
import { vary } from '../utils/color.js';
import { SEED, PLACES, SEA } from '../config.js';

const PLANK = ['#b07a45', '#a06c3b', '#bb8550', '#9a6535'];
const POST = '#5e3b22';
const DECK = 0.3; // height of the walkway
const HALF_WIDTH = 1.5;
const LENGTH_OUT = 14; // how far it sticks out past the beach

/**
 * A wooden dock sticking out of the east beach into the sea. Walk off the end (or the sides)
 * to jump in and swim. Registers as game.dock and as walkable land.
 * Exposes `start` / `end` (x of each end), `z`, and `keeperSpot` (where the sailor stands).
 */
export class Dock extends Entity {
  constructor({ z = PLACES.dockZ } = {}) {
    super();
    this.z = z;
  }

  onAdd(game) {
    // Where the east coastline crosses our z (the coast wobbles, so ask the terrain).
    const r = game.terrain.radius;
    const edge = game.terrain.edgeRadius(Math.sqrt(r * r - this.z * this.z), this.z);
    const beach = Math.sqrt(edge * edge - this.z * this.z);
    this.start = Math.floor(beach - 6);
    this.end = Math.floor(beach + LENGTH_OUT);
    this.keeperSpot = { x: this.start + 2.5, z: this.z - 3 };
    this.build();

    game.dock = this;
    game.lands.push(this);
    for (let x = this.start - 3; x < beach; x += 3) game.reservedAreas.push({ x, z: this.z, radius: 4 });
    game.reservedAreas.push({ ...this.keeperSpot, radius: 3 });
  }

  /** On the walkway? Positive margin shrinks the area, negative grows it. */
  isInside(x, z, margin = 0) {
    return x > this.start + margin && x < this.end - margin && Math.abs(z - this.z) < HALF_WIDTH - margin;
  }

  heightAt(x, z) {
    return this.isInside(x, z) ? DECK : null;
  }

  build() {
    const b = new VoxelBuilder();
    const rng = createRng(SEED + 31);
    const { start, end, z } = this;

    // Planks run across the dock, with little gaps between some of them.
    for (let x = start; x < end; x += 0.5) {
      if (rng.chance(0.04)) continue;
      b.box(x + 0.25, DECK - 0.08, z, 0.46, 0.16, HALF_WIDTH * 2, vary(rng.pick(PLANK), rng, 0.04));
    }
    // Support beams and posts going down into the water.
    for (const side of [-1, 1]) {
      b.box((start + end) / 2, DECK - 0.24, z + side * (HALF_WIDTH - 0.2), end - start, 0.16, 0.2, POST);
      for (let x = start + 1; x <= end; x += 3) {
        const px = Math.min(x, end - 0.25);
        b.box(px, (0.5 + SEA.floor) / 2, z + side * (HALF_WIDTH + 0.05), 0.3, 0.5 - SEA.floor, 0.3, POST); // posts down to the seabed
        // Rope railing between posts, out over the water.
        if (px > start + 6 && px + 3 <= end) b.box(px + 1.5, 0.75, z + side * (HALF_WIDTH + 0.05), 3, 0.06, 0.06, '#e8d7a8');
      }
    }
    // Lanterns on the last posts.
    for (const side of [-1, 1]) {
      b.box(end - 0.25, 0.75, z + side * (HALF_WIDTH + 0.05), 0.12, 0.6, 0.12, POST);
      b.box(end - 0.25, 1.15, z + side * (HALF_WIDTH + 0.05), 0.3, 0.3, 0.3, '#ffd23f');
    }
    // Ladder down into the water at the end.
    for (const side of [-0.4, 0.4]) b.box(end + 0.1, -0.3, z + side, 0.12, 1.4, 0.12, POST);
    for (let y = -0.8; y <= 0.1; y += 0.3) b.box(end + 0.1, y, z, 0.1, 0.08, 0.9, POST);

    // Crates, a barrel and a fishing net on the beach end.
    b.box(start + 1, DECK + 0.4, z + 1, 0.8, 0.8, 0.8, '#a06c3b');
    b.box(start + 1, DECK + 0.4, z + 1, 0.84, 0.1, 0.84, '#5e3b22');
    b.box(start + 2, DECK + 0.35, z + 1.05, 0.6, 0.7, 0.6, '#7a4a24');
    b.box(start + 2, DECK + 0.35, z + 1.05, 0.64, 0.08, 0.64, '#b0b6bd');
    b.box(start + 1.2, DECK + 0.05, z - 0.9, 1.4, 0.08, 0.9, '#d8c39a');

    // A signpost pointing out to sea.
    const sx = start + 0.5;
    const sz = z - HALF_WIDTH - 0.6;
    b.box(sx, 0.9, sz, 0.15, 1.8, 0.15, POST);
    b.box(sx + 0.5, 1.55, sz, 1.3, 0.4, 0.08, '#c58b52');
    b.box(sx + 1.25, 1.55, sz, 0.25, 0.25, 0.08, '#c58b52');
    b.box(sx + 0.45, 1.55, sz + 0.05, 0.9, 0.06, 0.02, '#3cc6ea'); // little wave painted on

    this.object3d.add(b.build({ merge: true, material: plankMaterial }));
  }
}
