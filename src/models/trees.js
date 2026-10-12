import { vary } from '../utils/color.js';

// Each tree function writes voxels into `parts.trunk` and `parts.leaves` (two VoxelBuilders,
// so bark and leaves can have different textures) with its base at (x, 0, z), and returns
// { radius } for the trunk collider. Add new kinds here and list them in TREE_KINDS.

const TRUNK = '#8a5a35';

function trunk(b, x, z, height, color, rng) {
  for (let y = 0; y < height; y++) b.add(x, y + 0.5, z, vary(color, rng));
}

function blob(b, x, baseY, z, radius, palette, rng, { squash = 1, extras } = {}) {
  const r = Math.ceil(radius);
  for (let dx = -r; dx <= r; dx++) {
    for (let dy = -r; dy <= r; dy++) {
      for (let dz = -r; dz <= r; dz++) {
        const dist = dx * dx + (dy * squash) ** 2 + dz * dz;
        if (dist > radius * radius + rng.range(-1.5, 1.5)) continue;
        const onSurface = dist > (radius - 1.2) ** 2;
        let color = rng.pick(palette);
        if (extras && onSurface && rng.chance(extras.chance)) color = rng.pick(extras.colors);
        b.add(x + dx, baseY + dy + 0.5, z + dz, vary(color, rng, 0.05));
      }
    }
  }
}

export function oakTree({ trunk: t, leaves }, x, z, rng) {
  const h = rng.int(6, 9);
  trunk(t, x, z, h, TRUNK, rng);
  blob(leaves, x, h + 2, z, rng.range(2.8, 3.6), ['#3fae3a', '#4cc046', '#36a03a'], rng, {
    extras: rng.chance(0.4) ? { chance: 0.08, colors: ['#ff3b3b'] } : undefined, // apples!
  });
  return { radius: 0.8 };
}

export function pineTree({ trunk: t, leaves }, x, z, rng) {
  const h = rng.int(4, 6);
  trunk(t, x, z, h, '#6b4226', rng);
  const layers = rng.int(7, 10);
  const palette = ['#1f8a5b', '#25a06a', '#1c7a52'];
  let y = h;
  for (let i = 0; i < layers; i++) {
    const r = Math.max(0, Math.round((layers - i) * 0.45));
    for (let dx = -r; dx <= r; dx++) {
      for (let dz = -r; dz <= r; dz++) {
        if (r > 1 && Math.abs(dx) === r && Math.abs(dz) === r) continue; // round the corners
        leaves.add(x + dx, y + 0.5, z + dz, vary(rng.pick(palette), rng));
      }
    }
    y += 1;
  }
  leaves.add(x, y + 0.5, z, vary(palette[0], rng));
  return { radius: 0.8 };
}

// Weighted list: repeat an entry to make it more common.
export const TREE_KINDS = [oakTree, oakTree, oakTree, pineTree, pineTree];
