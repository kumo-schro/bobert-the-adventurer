import { gardenMaterial } from '../style/garden.js';

// The world's painted textures (made with Codex, see art/textures and art/ART_DIRECTION.md).
// These names are what texturedVoxelMaterial() takes. Each one is mapped in world space, so it
// tiles evenly over blocks of any size.
export const grassTexture = 'grass';
export const sandTexture = 'sand';
export const dirtTexture = 'path';
export const stoneTexture = 'stone';
export const barkTexture = 'bark';
export const leafTexture = 'foliage';
export const plankTexture = 'planks';
export const roofTexture = 'rooftiles';
export const blockTexture = null; // plain painted blocks (no texture)

// How much each block's own color tints the texture: colorful textures keep their paint,
// neutral ones (foliage, roof tiles) take on the block's color.
const TINT = { grass: 0.3, sand: 0.35, path: 0.2, stone: 0.45, bark: 0.35, foliage: 1, planks: 0.35, rooftiles: 1 };

/** A material for VoxelBuilder blocks with one of the textures above (beveled, toon-shaded). */
export function texturedVoxelMaterial(texture, options = {}) {
  return gardenMaterial({ map: texture, tint: texture ? TINT[texture] ?? 1 : 1, ...options });
}

// Shared materials for the world.
export const grassMaterial = texturedVoxelMaterial(grassTexture, { bevel: 0 });
export const sandMaterial = texturedVoxelMaterial(sandTexture, { bevel: 0 });
export const dirtMaterial = texturedVoxelMaterial(dirtTexture, { bevel: 0.06 });
export const plankMaterial = texturedVoxelMaterial(plankTexture, { bevel: 0.05 });
export const blockMaterial = texturedVoxelMaterial(blockTexture);
