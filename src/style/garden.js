import * as THREE from 'three';

// The Psychedelic Garden look (see art/ART_DIRECTION.md): beveled blocks, soft toon shading
// with a glowing rim, and painted textures mapped in world space. Everything that draws
// blocks (VoxelBuilder, character parts) uses these.

// ---------- Textures ----------

const loader = new THREE.TextureLoader();
const cache = new Map();

/** A painted, tileable texture from public/textures/<name>.webp. */
export function gardenTexture(name) {
  if (!cache.has(name)) {
    const texture = loader.load(`${import.meta.env.BASE_URL}textures/${name}.webp`);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.anisotropy = 4;
    cache.set(name, texture);
  }
  return cache.get(name);
}

// How many world units one copy of each texture covers (bigger = larger pattern).
export const TEXTURE_SIZE = {
  grass: 6,
  sand: 7,
  path: 3,
  stone: 3,
  bark: 1.6,
  foliage: 3,
  rooftiles: 2.5,
  planks: 3,
};

// ---------- Toon shading ----------

/** Four soft light bands: shadows stay colorful, never black. */
export const gradientMap = (() => {
  const data = new Uint8Array([120, 120, 120, 255, 175, 175, 175, 255, 228, 228, 228, 255, 255, 255, 255, 255]);
  const texture = new THREE.DataTexture(data, 4, 1, THREE.RGBAFormat);
  texture.minFilter = texture.magFilter = THREE.LinearFilter;
  texture.needsUpdate = true;
  return texture;
})();

/**
 * The garden material: toon shading + rim light, optionally a painted texture mapped in world
 * space (so it tiles evenly on blocks of any size), and constant-size bevels on instanced
 * BevelBox geometry.
 *   map:        texture name ('grass', 'stone'...) or null
 *   tint:       how much the object's own color tints the texture (0..1); colorful textures
 *               like grass use a little, neutral ones like stone use a lot
 *   bevel:      bevel size in world units for instanced bevel boxes (0 = sharp)
 *   rim:        strength of the soft glowing outline light
 *   emissive / emissiveIntensity: for things that glow
 *   glow:       glows in its own color (works with per-instance colors, unlike emissive)
 */
export function gardenMaterial({
  map = null,
  color = '#ffffff',
  tint = 1,
  bevel = 0.08,
  rim = 0.35,
  rimColor = '#fff2ff',
  emissive = '#000000',
  emissiveIntensity = 0,
  glow = 0,
  transparent = false,
  opacity = 1,
  side = THREE.FrontSide,
} = {}) {
  const material = new THREE.MeshToonMaterial({ color, gradientMap, emissive, emissiveIntensity, transparent, opacity, side });
  const texture = map ? gardenTexture(map) : null;
  const scale = map ? 1 / (TEXTURE_SIZE[map] ?? 3) : 1;
  material.userData.garden = { map, bevel, rim, glow };
  material.onBeforeCompile = (shader) => {
    shader.uniforms.gBevel = { value: bevel };
    shader.uniforms.gRim = { value: rim };
    shader.uniforms.gRimColor = { value: new THREE.Color(rimColor) };
    shader.uniforms.gTex = { value: texture };
    shader.uniforms.gTexScale = { value: scale };
    shader.uniforms.gTint = { value: tint };
    shader.uniforms.gGlow = { value: glow };
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
        attribute vec3 aBevel;
        uniform float gBevel;
        varying vec3 gWorldPos;
        varying vec3 gWorldNormal;
        vec3 gInstanceScale() {
          #ifdef USE_INSTANCING
            return vec3(length(instanceMatrix[0].xyz), length(instanceMatrix[1].xyz), length(instanceMatrix[2].xyz));
          #else
            return vec3(1.0);
          #endif
        }`,
      )
      .replace(
        '#include <beginnormal_vertex>',
        `#include <beginnormal_vertex>
        // Keep bevel normals at 45 degrees however much the block is stretched.
        vec3 gScale = max(gInstanceScale(), vec3(1e-4));
        objectNormal = normalize(objectNormal / gScale);`,
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        // Bevels stay the same size in the world (not stretched with the block), and never
        // more than a third of the block's thinnest side.
        float gB = min(gBevel, 0.33 * min(gScale.x, min(gScale.y, gScale.z)));
        transformed += aBevel * gB / gScale;`,
      )
      .replace(
        '#include <worldpos_vertex>',
        `#include <worldpos_vertex>
        vec4 gWorld = vec4(transformed, 1.0);
        #ifdef USE_INSTANCING
          gWorld = instanceMatrix * gWorld;
        #endif
        gWorld = modelMatrix * gWorld;
        gWorldPos = gWorld.xyz;
        vec3 gN = objectNormal;
        #ifdef USE_INSTANCING
          gN = mat3(instanceMatrix) * gN;
        #endif
        gWorldNormal = normalize(mat3(modelMatrix) * gN);`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        uniform float gRim;
        uniform vec3 gRimColor;
        uniform sampler2D gTex;
        uniform float gTexScale;
        uniform float gTint;
        uniform float gGlow;
        varying vec3 gWorldPos;
        varying vec3 gWorldNormal;`,
      )
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
        totalEmissiveRadiance += diffuseColor.rgb * gGlow;`,
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        ${
          texture
            ? `// Painted texture, projected from whichever side the surface faces.
        vec3 gA = abs(gWorldNormal);
        vec2 gUv = gA.y > max(gA.x, gA.z) ? gWorldPos.xz : (gA.x > gA.z ? gWorldPos.zy : gWorldPos.xy);
        vec3 gT = texture2D(gTex, gUv * gTexScale).rgb;
        diffuseColor.rgb = gT * mix(vec3(1.0), diffuseColor.rgb, gTint);`
            : ''
        }`,
      )
      .replace(
        '#include <opaque_fragment>',
        `// Soft glowing rim around the edges (strongest where the surface turns away from us).
        float gFacing = 1.0 - clamp(dot(normal, normalize(vViewPosition)), 0.0, 1.0);
        outgoingLight += gRimColor * pow(gFacing, 3.0) * gRim * (0.4 + 0.6 * diffuseColor.rgb);
        #include <opaque_fragment>`,
      );
  };
  material.customProgramCacheKey = () => `garden-${texture ? 'tex' : 'plain'}`;
  return material;
}

// ---------- Beveled boxes ----------

/**
 * A box with chamfered (beveled) edges and corners: 6 faces, 12 edge strips, 8 corner triangles
 * (44 triangles). Every vertex sits on the unit box's corners/edges (+-0.5) with an `aBevel`
 * attribute that pulls it inward; the garden material applies the bevel in the shader so it
 * stays the same size in the world no matter how the box is scaled.
 * With `size` and `bevel` given, the bevel is baked in instead (for non-instanced meshes).
 */
export function createBevelBox(size = null, bevel = 0) {
  const positions = [];
  const normals = [];
  const bevels = [];
  const push = (corner, inset, normal) => {
    positions.push(corner[0] * 0.5, corner[1] * 0.5, corner[2] * 0.5);
    bevels.push(-inset[0] * corner[0], -inset[1] * corner[1], -inset[2] * corner[2]);
    normals.push(...normal);
  };
  // Where a point ends up on a sample box (used to make every triangle face outward).
  const at = ([corner, inset]) => corner.map((c, i) => c * 0.5 - inset[i] * c * 0.1);
  const tri = (a, b, c, n) => {
    const [pa, pb, pc] = [at(a), at(b), at(c)];
    const u = pb.map((v, i) => v - pa[i]);
    const v = pc.map((x, i) => x - pa[i]);
    const cross = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
    if (cross[0] * n[0] + cross[1] * n[1] + cross[2] * n[2] < 0) [b, c] = [c, b]; // wound the wrong way: flip
    push(...a, n);
    push(...b, n);
    push(...c, n);
  };
  const quad = (a, b, c, d, n) => {
    tri(a, b, c, n);
    tri(a, c, d, n);
  };
  // A point is [corner signs, which axes are pulled in by the bevel].
  const P = (sx, sy, sz, ix, iy, iz) => [[sx, sy, sz], [ix, iy, iz]];
  const s = [-1, 1];
  // Faces
  for (const sx of s) {
    const n = [sx, 0, 0];
    const pts = [P(sx, -1, -1, 0, 1, 1), P(sx, 1, -1, 0, 1, 1), P(sx, 1, 1, 0, 1, 1), P(sx, -1, 1, 0, 1, 1)];
    if (sx > 0) quad(pts[0], pts[1], pts[2], pts[3], n);
    else quad(pts[0], pts[3], pts[2], pts[1], n);
  }
  for (const sy of s) {
    const n = [0, sy, 0];
    const pts = [P(-1, sy, -1, 1, 0, 1), P(-1, sy, 1, 1, 0, 1), P(1, sy, 1, 1, 0, 1), P(1, sy, -1, 1, 0, 1)];
    if (sy > 0) quad(pts[0], pts[1], pts[2], pts[3], n);
    else quad(pts[0], pts[3], pts[2], pts[1], n);
  }
  for (const sz of s) {
    const n = [0, 0, sz];
    const pts = [P(-1, -1, sz, 1, 1, 0), P(1, -1, sz, 1, 1, 0), P(1, 1, sz, 1, 1, 0), P(-1, 1, sz, 1, 1, 0)];
    if (sz > 0) quad(pts[0], pts[1], pts[2], pts[3], n);
    else quad(pts[0], pts[3], pts[2], pts[1], n);
  }
  // Edge strips (along x, y and z), then corner triangles.
  const r = Math.SQRT1_2;
  for (const sy of s) {
    for (const sz of s) {
      const n = [0, sy * r, sz * r];
      const a = P(-1, sy, sz, 1, 0, 1);
      const b = P(1, sy, sz, 1, 0, 1);
      const c = P(1, sy, sz, 1, 1, 0);
      const d = P(-1, sy, sz, 1, 1, 0);
      if (sy * sz > 0) quad(a, d, c, b, n);
      else quad(a, b, c, d, n);
    }
  }
  for (const sx of s) {
    for (const sz of s) {
      const n = [sx * r, 0, sz * r];
      const a = P(sx, -1, sz, 0, 1, 1);
      const b = P(sx, 1, sz, 0, 1, 1);
      const c = P(sx, 1, sz, 1, 1, 0);
      const d = P(sx, -1, sz, 1, 1, 0);
      if (sx * sz > 0) quad(a, b, c, d, n);
      else quad(a, d, c, b, n);
    }
  }
  for (const sx of s) {
    for (const sy of s) {
      const n = [sx * r, sy * r, 0];
      const a = P(sx, sy, -1, 0, 1, 1);
      const b = P(sx, sy, 1, 0, 1, 1);
      const c = P(sx, sy, 1, 1, 0, 1);
      const d = P(sx, sy, -1, 1, 0, 1);
      if (sx * sy > 0) quad(a, d, c, b, n);
      else quad(a, b, c, d, n);
    }
  }
  const k = 1 / Math.sqrt(3);
  for (const sx of s) {
    for (const sy of s) {
      for (const sz of s) {
        const n = [sx * k, sy * k, sz * k];
        const a = P(sx, sy, sz, 0, 1, 1);
        const b = P(sx, sy, sz, 1, 0, 1);
        const c = P(sx, sy, sz, 1, 1, 0);
        if (sx * sy * sz > 0) tri(a, b, c, n);
        else tri(a, c, b, n);
      }
    }
  }

  const geometry = new THREE.BufferGeometry();
  if (size) {
    // Bake the size and bevel in (character parts and other one-off meshes).
    const [w, h, d] = size;
    const b = Math.min(bevel, 0.33 * Math.min(w, h, d));
    for (let i = 0; i < positions.length; i += 3) {
      positions[i] = positions[i] * w + bevels[i] * b;
      positions[i + 1] = positions[i + 1] * h + bevels[i + 1] * b;
      positions[i + 2] = positions[i + 2] * d + bevels[i + 2] * b;
    }
    geometry.setAttribute('aBevel', new THREE.Float32BufferAttribute(new Float32Array(bevels.length), 3));
  } else {
    geometry.setAttribute('aBevel', new THREE.Float32BufferAttribute(bevels, 3));
  }
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geometry.computeBoundingSphere();
  return geometry;
}

/** The shared unit bevel box used by every VoxelBuilder. */
export const unitBevelBox = createBevelBox();
