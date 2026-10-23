import { Entity } from '../core/Entity.js';
import { VoxelBuilder } from '../core/VoxelBuilder.js';
import { stoneTexture, texturedVoxelMaterial } from '../core/textures.js';
import { createRng } from '../utils/random.js';
import { vary } from '../utils/color.js';
import { SEED, GATHER } from '../config.js';

const ROCK = ['#8d8f96', '#7d8088', '#9a9ca3', '#a6a8ae'];
const rockMaterial = texturedVoxelMaterial(stoneTexture);

/**
 * Big boulders scattered over the main island (scenery you bump into, and that your sword clinks
 * off). Lives at game.gathering; `addNode()` is still there (and does nothing) for places that
 * used to register trees to chop.
 */
export class Gathering extends Entity {
  constructor({ boulders = GATHER.boulderCount } = {}) {
    super();
    this.boulderCount = boulders;
  }

  onAdd(game) {
    game.gathering = this;
    this.placeBoulders(game);
  }

  addNode() {}

  placeBoulders(game) {
    const rng = createRng(SEED + 101);
    const r = game.terrain.radius;
    let placed = 0;
    for (let attempt = 0; attempt < 600 && placed < this.boulderCount; attempt++) {
      const x = rng.range(-r, r);
      const z = rng.range(-r, r);
      if (Math.hypot(x, z) < 22 || !game.terrain.isGrass(x, z, 3) || game.isReserved(x, z, 2)) continue;
      if (game.colliders.some((c) => c.radius && Math.hypot(c.x - x, c.z - z) < c.radius + 2.5)) continue;
      const b = new VoxelBuilder();
      const size = rng.range(1.1, 1.6);
      b.box(0, size * 0.45, 0, size * 1.3, size * 0.9, size, vary(rng.pick(ROCK), rng, 0.05));
      b.box(size * 0.2, size * 1.0, -0.1, size * 0.8, size * 0.5, size * 0.7, vary(rng.pick(ROCK), rng, 0.05));
      b.box(-size * 0.4, size * 0.25, size * 0.3, 0.6, 0.5, 0.6, vary(rng.pick(ROCK), rng, 0.05));
      const model = b.build({ material: rockMaterial });
      model.position.set(x, 0, z);
      model.rotation.y = rng.range(0, Math.PI);
      this.object3d.add(model);
      game.colliders.push({ x, z, radius: size * 0.75 });
      game.reservedAreas.push({ x, z, radius: 2 });
      placed++;
    }
  }
}
