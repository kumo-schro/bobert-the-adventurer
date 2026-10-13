import { Entity } from '../core/Entity.js';
import { createRng } from '../utils/random.js';
import { instances } from '../style/models.js';
import { SEED, WORLD } from '../config.js';

const PETALS = ['#ff4fd8', '#ffe14d', '#ffffff', '#b07cff', '#36e6ff', '#ff8a3d', '#ff5e7e'];
const CAPS = ['#ff3d6e', '#ff8a3d', '#b07cff', '#36b6ff', '#ff4fd8'];
const BUSHES = ['#2fd27a', '#18c9a0', '#7dff3a', '#4be3a0'];

// How the meadow is shared out between the different plants (out of WORLD.flowerCount).
const MIX = [
  { name: 'grass_tuft', share: 0.5, scale: [0.8, 1.3] },
  { name: 'daisy_small', share: 0.24, scale: [0.35, 0.5], colors: PETALS },
  { name: 'tulip_small', share: 0.16, scale: [0.35, 0.5], colors: PETALS },
  { name: 'bush', share: 0.025, scale: [0.7, 1.15], colors: BUSHES, shadow: true },
  { name: 'mushroom', share: 0.025, scale: [0.35, 0.9], colors: CAPS, shadow: true },
];

/** Flowers, grass tufts, bushes and toadstools sprinkled over the meadow. */
export class Flowers extends Entity {
  constructor({ count = WORLD.flowerCount } = {}) {
    super();
    this.count = count;
  }

  onAdd(game) {
    const rng = createRng(SEED + 2);
    const r = game.terrain.radius;
    const lists = new Map(MIX.map((kind) => [kind, []]));
    const total = MIX.reduce((sum, k) => sum + k.share, 0);

    let placed = 0;
    for (let attempt = 0; attempt < this.count * 10 && placed < this.count; attempt++) {
      const x = rng.range(-r, r);
      const z = rng.range(-r, r);
      if (!game.terrain.isGrass(x, z, 1) || game.isReserved(x, z)) continue;
      placed++;

      let pick = rng.range(0, total);
      const kind = MIX.find((k) => (pick -= k.share) < 0) ?? MIX[0];
      lists.get(kind).push({
        x,
        y: game.terrain.heightAt?.(x, z) ?? 0,
        z,
        rotation: rng.range(0, Math.PI * 2),
        scale: rng.range(...kind.scale),
        tiltX: rng.range(-0.12, 0.12),
        tiltZ: rng.range(-0.12, 0.12),
        color: kind.colors && rng.pick(kind.colors),
      });
    }

    for (const [kind, list] of lists) {
      if (!list.length) continue;
      const shadow = !!kind.shadow; // little plants don't cast shadows (much cheaper)
      this.object3d.add(instances(kind.name, list, { castShadow: shadow }));
    }
  }
}
