import * as THREE from 'three';

// Returns a slightly varied copy of a color. Small per-voxel variation is what
// makes the voxel look feel hand-made instead of flat.
export function vary(color, rng, amount = 0.04) {
  return new THREE.Color(color).offsetHSL(
    (rng.next() - 0.5) * amount * 0.5,
    (rng.next() - 0.5) * amount,
    (rng.next() - 0.5) * amount,
  );
}
