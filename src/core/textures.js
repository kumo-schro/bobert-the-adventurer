import * as THREE from 'three';
import { createRng } from '../utils/random.js';

// Little 16x16 pixel-art textures, generated in code so there are no image files to manage.
// They are grayscale and get multiplied with each voxel's color.

const SIZE = 16;

function makeTexture(seed, shade) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = SIZE;
  const ctx = canvas.getContext('2d');
  const rng = createRng(seed);
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const v = Math.round(THREE.MathUtils.clamp(shade(x, y, rng), 0, 1) * 255);
      ctx.fillStyle = `rgb(${v},${v},${v})`;
      ctx.fillRect(x, y, 1, 1);
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.magFilter = THREE.NearestFilter;
  return texture;
}

/** Bark: vertical grooves with a little speckle. */
export const barkTexture = (() => {
  const rng = createRng(11);
  const columns = Array.from({ length: SIZE }, (_, x) => (x % 5 === 0 || rng.chance(0.15) ? 0.62 : 0.85 + rng.next() * 0.12));
  return makeTexture(12, (x, y, r) => columns[x] + (r.next() - 0.5) * 0.12 - (r.chance(0.06) ? 0.15 : 0));
})();

/** Leaves: bumpy clusters with dark gaps and bright highlights. */
export const leafTexture = makeTexture(21, (x, y, r) => {
  const roll = r.next();
  if (roll < 0.12) return 0.6; // shadowy gap between leaves
  if (roll < 0.2) return 1.0; // sunlit leaf
  return 0.78 + r.next() * 0.16;
});

/** Stone: rough speckles with a few cracks. */
export const stoneTexture = (() => {
  const cracks = new Set();
  const rng = createRng(31);
  for (let i = 0; i < 3; i++) {
    let x = rng.int(0, SIZE - 1);
    let y = rng.int(0, SIZE - 1);
    for (let s = 0; s < 6; s++) {
      cracks.add(`${x},${y}`);
      x = (x + rng.int(-1, 1) + SIZE) % SIZE;
      y = (y + 1) % SIZE;
    }
  }
  return makeTexture(32, (x, y, r) => (cracks.has(`${x},${y}`) ? 0.62 : 0.8 + r.next() * 0.18));
})();

/** Grass: soft speckle with darker blades and a few bright tips. */
export const grassTexture = (() => {
  const blades = new Set();
  const rng = createRng(41);
  for (let i = 0; i < 18; i++) {
    const x = rng.int(0, SIZE - 1);
    const y = rng.int(0, SIZE - 1);
    blades.add(`${x},${y}`);
    blades.add(`${x},${(y + 1) % SIZE}`);
  }
  return makeTexture(42, (x, y, r) => {
    if (blades.has(`${x},${y}`)) return 0.74;
    if (r.chance(0.05)) return 1.0;
    return 0.86 + r.next() * 0.1;
  });
})();

/** Sand: fine grain with a few darker specks. */
export const sandTexture = makeTexture(51, (x, y, r) => (r.chance(0.07) ? 0.8 : 0.9 + r.next() * 0.1));

/** Dirt and cobbles: pebbly, with little light stones. */
export const dirtTexture = makeTexture(61, (x, y, r) => {
  const roll = r.next();
  if (roll < 0.08) return 1.0; // pebble
  if (roll < 0.16) return 0.72;
  return 0.84 + r.next() * 0.1;
});

/** Wood planks: grain lines, a knot or two. */
export const plankTexture = (() => {
  const rng = createRng(71);
  const knots = new Set([`${rng.int(2, 13)},${rng.int(2, 13)}`, `${rng.int(2, 13)},${rng.int(2, 13)}`]);
  return makeTexture(72, (x, y, r) => {
    if (knots.has(`${x},${y}`)) return 0.6;
    if (y % 4 === 0) return 0.76; // grain line
    return 0.86 + r.next() * 0.08;
  });
})();

/** A soft bevel around every 1x1 block, so voxel buildings show their blocks. */
export const blockTexture = makeTexture(81, (x, y, r) => {
  const edge = x === 0 || y === 0 || x === SIZE - 1 || y === SIZE - 1;
  return edge ? 0.82 : 0.93 + r.next() * 0.07;
});

/**
 * A Lambert material that paints `texture` onto every voxel face, tiled once per world unit.
 * UVs come from the world position, so stretched boxes (tall mountain columns, etc.) get
 * evenly sized pixels instead of a smeared texture. Works with VoxelBuilder's instanced meshes.
 */
export function texturedVoxelMaterial(texture) {
  const material = new THREE.MeshLambertMaterial();
  material.onBeforeCompile = (shader) => {
    shader.uniforms.voxelTexture = { value: texture };
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vVoxelPos;\nvarying vec3 vVoxelNormal;')
      .replace(
        '#include <project_vertex>',
        `#include <project_vertex>
        vec4 voxelWorld = vec4(transformed, 1.0);
        #ifdef USE_INSTANCING
          voxelWorld = instanceMatrix * voxelWorld;
        #endif
        vVoxelPos = (modelMatrix * voxelWorld).xyz;
        vVoxelNormal = normal;`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        '#include <common>\nuniform sampler2D voxelTexture;\nvarying vec3 vVoxelPos;\nvarying vec3 vVoxelNormal;',
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        vec3 voxelAxis = abs(vVoxelNormal);
        vec2 voxelUv = voxelAxis.x > 0.5 ? vVoxelPos.zy : (voxelAxis.y > 0.5 ? vVoxelPos.xz : vVoxelPos.xy);
        diffuseColor.rgb *= texture2D(voxelTexture, voxelUv).rgb;`,
      );
  };
  material.customProgramCacheKey = () => 'textured-voxel';
  return material;
}

// Shared textured materials for the world, so every voxel surface has a little pixel detail.
export const grassMaterial = texturedVoxelMaterial(grassTexture);
export const sandMaterial = texturedVoxelMaterial(sandTexture);
export const dirtMaterial = texturedVoxelMaterial(dirtTexture);
export const plankMaterial = texturedVoxelMaterial(plankTexture);
export const blockMaterial = texturedVoxelMaterial(blockTexture);
