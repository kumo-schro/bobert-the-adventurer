import * as THREE from 'three';
import { vary } from '../utils/color.js';

// Building recipes. Each one draws in LOCAL coordinates through `put(x, y, z, color, sx, sy, sz, tilt)`
// (a soft beveled box centered at x,y,z, leaned `tilt` radians around X), with its front facing
// +Z, and returns its collider half-size. put.stone / put.roof / put.wood draw painted stone,
// roof tiles and planks (tinted by the color); put.glow draws glowing parts.
// The Village rotates and places them, so recipes never worry about where they end up.

const DARK_STONE = '#666a70';
const WOOD = '#8a5a35';
const DARK_WOOD = '#5e3b22';
const GLASS = '#9fdcff';
const DOOR = '#7a4a24';

// Each house gets its own pastel stone and shutter color so the village doesn't look copy-pasted.
const WALL_STYLES = ['#d9ccff', '#ffd9b0', '#fff0f6', '#c4f2e2', '#ffe9a8', '#cfe4ff'];
const SHUTTERS = ['#2f6fd6', '#2fa36b', '#d9493f', '#7a4fd1', '#e08a2e', '#2fb5a8'];
const FLOWERS = ['#ff4d6d', '#ffd23f', '#ff8fab', '#c77dff', '#ffffff'];
const SLOPE = Math.PI / 4;

/**
 * A pitched roof over a (2*hw+1) x (2*hd+1) box whose walls stop at `height`: two tiled slabs
 * meeting at a ridge along X, timber gables underneath, and a ridge cap. Returns the ridge height.
 */
export function gableRoof(put, { hw, hd, height, roof, gable = '#e0a56a' }) {
  const W = hw * 2 + 1;
  const eave = hd + 1.2; // how far out the roof reaches (past the walls)
  const base = height - 0.2; // height of the roof's top surface at the eave
  const t = 0.4; // slab thickness
  const len = eave * Math.SQRT2 + 0.35;
  const inward = t / 2 / Math.SQRT2;
  for (const side of [1, -1]) {
    put.roof(0, base + eave / 2 - inward, side * (eave / 2 - inward), roof, W + 1.3, t, len, side * SLOPE);
  }
  // Gable ends: a long diamond tucked under the slabs (only its top half shows).
  const apex = base + eave - t * Math.SQRT2;
  const half = apex - base;
  put.wood(0, base, 0, gable, W - 0.3, half * Math.SQRT2, half * Math.SQRT2, SLOPE);
  const ridge = base + eave;
  put.roof(0, ridge, 0, new THREE.Color(roof).offsetHSL(0, 0, -0.12), W + 1.5, 0.32, 0.55);
  return ridge;
}

/**
 * A cottage of painted pastel stone: a pitched tiled roof with timber gables, corner posts,
 * framed windows with shutters and sills, a front door with a lantern, flower boxes, ivy, a
 * chimney (returns where its smoke comes out), and a yard with a woodpile, barrel and crates on
 * one side and a little vegetable garden on the other.
 */
export function stoneHouse(put, rng, { hw = 4, hd = 3, height = 4, roof = '#d9493f', style = 0 } = {}) {
  const wall = WALL_STYLES[style % WALL_STYLES.length];
  const shutter = rng.pick(SHUTTERS);
  const W = hw * 2 + 1;
  const D = hd * 2 + 1;

  // Plinth, walls, a timber band under the eaves, and chunky corner posts.
  put.stone(0, 0.3, 0, new THREE.Color(wall).offsetHSL(0.02, -0.1, -0.18), W + 0.35, 0.6, D + 0.35);
  put.stone(0, height / 2 + 0.2, 0, wall, W, height - 0.4, D);
  put.wood(0, height - 0.25, 0, '#c98a55', W + 0.2, 0.45, D + 0.3);
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) put.wood(sx * (hw + 0.4), height / 2, sz * (hd + 0.4), '#b5713f', 0.55, height, 0.55);
  }
  gableRoof(put, { hw, hd, height, roof });
  // Round-ish attic window in each gable.
  for (const side of [-1, 1]) {
    put(side * (hw + 0.36), height + 0.75, 0, GLASS, 0.08, 0.7, 0.7);
    put(side * (hw + 0.34), height + 0.75, 0, DARK_WOOD, 0.06, 0.9, 0.9);
  }

  // Chimney poking out of the back slope, with a cap.
  const chimneyTop = height + hd + 2;
  put.stone(hw - 1, (height + chimneyTop) / 2, -1, new THREE.Color(wall).offsetHSL(0, 0, -0.1), 1, chimneyTop - height, 1);
  put(hw - 1, chimneyTop + 0.1, -1, '#4a4f55', 1.3, 0.2, 1.3);

  // Window frames, sills and shutters (front windows, plus one on each side wall).
  const front = hd + 0.5;
  const windows = [];
  if (hw >= 3) windows.push([-2, front, 1], [2, front, 1]);
  windows.push([hw + 0.5, 0, 0], [-hw - 0.5, 0, 0]);
  for (const [wx, wz, facingFront] of windows) {
    if (facingFront) {
      put(wx, 2, wz + 0.01, GLASS, 1, 2, 0.06); // glass
      put(wx, 2.5, wz + 0.04, '#f4ecd8', 0.08, 2, 0.06); // cross-shaped window frame
      put(wx, 2, wz + 0.04, '#f4ecd8', 1, 0.08, 0.06);
      put(wx, 3.05, wz + 0.06, DARK_WOOD, 1.2, 0.12, 0.14); // top frame
      put(wx - 0.62, 2, wz + 0.08, shutter, 0.22, 1.9, 0.08); // shutters
      put(wx + 0.62, 2, wz + 0.08, shutter, 0.22, 1.9, 0.08);
    } else {
      const side = Math.sign(wx);
      put(wx + side * 0.01, 2, 0, GLASS, 0.06, 2, 1); // glass
      put(wx + side * 0.04, 2.5, 0, '#f4ecd8', 0.06, 2, 0.08);
      put(wx + side * 0.04, 2, 0, '#f4ecd8', 0.06, 0.08, 1);
      put(wx + side * 0.08, 2, -0.62, shutter, 0.08, 1.9, 0.22);
      put(wx + side * 0.08, 2, 0.62, shutter, 0.08, 1.9, 0.22);
      put(wx + side * 0.15, 0.95, 0, '#b8b2a6', 0.3, 0.12, 1.2); // sill
    }
  }

  // Front door: frame, little window, golden knob, and a lantern beside it.
  put(0, 1.05, front + 0.04, DARK_WOOD, 1.2, 2.1, 0.06);
  put(0, 1, front + 0.07, '#8a5530', 0.9, 1.9, 0.06);
  put(0, 1.5, front + 0.1, GLASS, 0.35, 0.3, 0.04);
  put(0.3, 0.95, front + 0.12, '#ffc93c', 0.1, 0.1, 0.06);
  put(-0.95, 2.2, front + 0.2, '#3b3b3b', 0.1, 0.1, 0.35); // lantern bracket
  put.glow(-0.95, 1.95, front + 0.35, '#ffd23f', 0.24, 0.32, 0.24);
  put(-0.95, 2.15, front + 0.35, '#3b3b3b', 0.3, 0.08, 0.3);

  // Doorstep and a welcome mat.
  put(0, 0.08, hd + 0.8, DARK_STONE, 1.4, 0.16, 0.6);
  put(0, 0.17, hd + 0.85, '#c0392b', 1, 0.03, 0.45);

  // Flower boxes under the front windows, and bushes by the door.
  if (hw >= 3) {
    for (const x of [-2, 2]) {
      put(x, 0.75, hd + 0.65, WOOD, 0.9, 0.3, 0.3);
      for (const dx of [-0.25, 0, 0.25]) put(x + dx, 1.0, hd + 0.65, rng.pick(FLOWERS), 0.18, 0.18, 0.18);
    }
  }
  for (const x of [-1.1, 1.1]) {
    put(x, 0.3, hd + 0.9, vary('#3fae3a', rng, 0.06), 0.6, 0.6, 0.6);
    put(x + 0.1, 0.62, hd + 1.05, rng.pick(FLOWERS), 0.14, 0.14, 0.14);
  }

  // Ivy climbing up one side wall.
  const ivySide = rng.chance(0.5) ? 1 : -1;
  for (let i = 0; i < 14; i++) {
    const z = rng.int(-hd + 1, hd - 1);
    const y = rng.range(0.3, height - 0.5) * (1 - i / 20);
    if (z === 0 && y > 0.9 && y < 3.1) continue; // not over the window
    put(ivySide * (hw + 0.55), y, z + rng.range(-0.3, 0.3), vary('#3a9a3a', rng, 0.08), 0.1, 0.45, 0.45);
  }

  // Yard on the right side: woodpile, barrel and crates.
  const yard = hw + 1.2;
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3 - i; j++) {
      put(yard, 0.2 + i * 0.36, -hd + 0.8 + j * 0.4 + i * 0.2, '#9a6535', 0.9, 0.34, 0.34); // logs
      put(yard + 0.46, 0.2 + i * 0.36, -hd + 0.8 + j * 0.4 + i * 0.2, '#e0b98a', 0.04, 0.26, 0.26); // log ends
    }
  }
  put(yard, 0.5, 0.6, DARK_WOOD, 0.8, 1, 0.8); // barrel
  put(yard, 0.35, 0.6, '#b0b6bd', 0.84, 0.08, 0.84);
  put(yard, 0.75, 0.6, '#b0b6bd', 0.84, 0.08, 0.84);
  put(yard, 0.35, hd - 0.4, WOOD, 0.7, 0.7, 0.7); // crate
  put(yard, 0.35, hd - 0.4, DARK_WOOD, 0.74, 0.08, 0.74);

  // Garden on the left side: a little fence with rows of cabbages and carrots.
  const gx = -hw - 1.3;
  for (let z = -hd + 0.3; z <= hd - 0.3; z += 0.9) {
    put(gx - 0.7, 0.4, z, '#c58b52', 0.12, 0.8, 0.12); // fence posts
  }
  put(gx - 0.7, 0.55, 0, '#c58b52', 0.08, 0.08, hd * 2 - 0.4); // fence rail
  put(gx, 0.04, 0, '#7a5230', 1.2, 0.08, hd * 2 - 0.6); // soil
  for (let z = -hd + 0.6; z <= hd - 0.6; z += 0.7) {
    const cabbage = rng.chance(0.5);
    put(gx + (cabbage ? -0.25 : 0.25), cabbage ? 0.2 : 0.15, z, cabbage ? '#7ddc55' : '#2fa36b', cabbage ? 0.34 : 0.12, cabbage ? 0.28 : 0.2, cabbage ? 0.34 : 0.12);
    if (!cabbage) put(gx + 0.25, 0.05, z, '#ff8a1f', 0.12, 0.1, 0.12); // carrot top peeking out
  }

  return {
    halfX: hw + 2,
    halfZ: hd + 0.5,
    smoke: [hw - 1, chimneyTop + 0.4, -1],
  };
}

/** Hana's bakery stall: yellow awning, bread, pies and a little brick oven. Sells food. */
export function bakeryStall(put, rng) {
  for (const x of [-1.6, 1.6]) {
    for (const z of [-1.1, 0.5]) put(x, 1.3, z, DARK_WOOD, 0.2, 2.6, 0.2);
  }
  put(0, 0.5, 0.3, '#c58b52', 3, 1, 0.7);
  put(0, 1.05, 0.3, '#e8c48a', 3.3, 0.1, 0.9);
  for (let i = 0; i < 7; i++) {
    const x = -1.65 + i * 0.55;
    const color = i % 2 === 0 ? '#ffc93c' : '#ffffff';
    put(x, 2.75, -0.6, color, 0.55, 0.15, 1.3);
    put(x, 2.55, 0.35, color, 0.55, 0.15, 0.9);
    put(x, 2.3, 0.82, color, 0.55, 0.3, 0.06);
  }
  // Loaves, apples and pies on the counter.
  for (let i = 0; i < 3; i++) {
    put(-1.2 + i * 0.4, 1.22, 0.35, '#c98a3f', 0.32, 0.22, 0.18);
    put(-1.2 + i * 0.4, 1.34, 0.35, '#e0a85a', 0.26, 0.04, 0.12);
  }
  for (let i = 0; i < 4; i++) put(0.2 + (i % 2) * 0.22, 1.2 + Math.floor(i / 2) * 0.18, 0.25, '#ff3b3b', 0.16, 0.16, 0.16);
  put(1.1, 1.17, 0.3, '#e0a85a', 0.5, 0.12, 0.5); // pie
  put(1.1, 1.24, 0.3, '#9b2fd1', 0.36, 0.03, 0.36);
  // Brick oven beside the stall, glowing.
  put(-2.9, 0.8, -0.5, '#b5523b', 1.2, 1.6, 1.2);
  put(-2.9, 1.75, -0.5, '#a3462f', 1.0, 0.3, 1.0);
  put(-2.9, 2.4, -0.7, '#7a3524', 0.4, 1.0, 0.4); // chimney
  put.glow(-2.9, 0.7, 0.12, '#ff9a1f', 0.6, 0.5, 0.05);
  // Sign with a loaf on it.
  put(0, 3.15, 0.85, WOOD, 1.4, 0.5, 0.08);
  put(0, 3.15, 0.9, '#e0a85a', 0.7, 0.24, 0.04);
  // Flour sacks.
  put(2.3, 0.4, 0, '#f4ecd8', 0.6, 0.8, 0.6);
  put(2.3, 0.85, 0, '#d8c39a', 0.3, 0.15, 0.3);
  put(2.3, 0.35, -0.75, '#f4ecd8', 0.6, 0.7, 0.6);

  return { halfX: 3.5, halfZ: 1.2, smoke: [-2.9, 3.1, -0.7] };
}

/** The merchant's market stall: counter, striped awning, and goods for sale. */
export function marketStall(put, rng) {
  // Posts
  for (const x of [-1.6, 1.6]) {
    for (const z of [-1.1, 0.5]) put(x, 1.3, z, DARK_WOOD, 0.2, 2.6, 0.2);
  }
  // Counter
  put(0, 0.5, 0.3, WOOD, 3, 1, 0.7);
  put(0, 1.05, 0.3, '#c58b52', 3.3, 0.1, 0.9);
  // Striped awning, sloping down toward the front
  for (let i = 0; i < 7; i++) {
    const x = -1.65 + i * 0.55;
    const color = i % 2 === 0 ? '#e23b4a' : '#ffffff';
    put(x, 2.75, -0.6, color, 0.55, 0.15, 1.3);
    put(x, 2.55, 0.35, color, 0.55, 0.15, 0.9);
    put(x, 2.3, 0.82, color, 0.55, 0.3, 0.06); // front valance
  }
  // Goods on the counter
  const goods = ['#ff3b3b', '#ffd23f', '#4cc9f0', '#c77dff', '#7ddc55'];
  for (let i = 0; i < 6; i++) {
    put(-1.25 + i * 0.5, 1.22, 0.3, rng.pick(goods), 0.24, 0.24, 0.24);
  }
  // Potion bottles
  put(-0.9, 1.3, 0.05, '#ff6bcb', 0.16, 0.4, 0.16);
  put(-0.6, 1.3, 0.05, '#5ee0a0', 0.16, 0.4, 0.16);
  // Crates and a barrel beside the stall
  put(2.3, 0.4, -0.2, WOOD, 0.8, 0.8, 0.8);
  put(2.3, 0.85, -0.2, '#ff9a1f', 0.6, 0.1, 0.6);
  put(-2.3, 0.5, -0.4, DARK_WOOD, 0.8, 1, 0.8);
  put(-2.3, 0.5, -0.4, '#b0b6bd', 0.84, 0.1, 0.84);

  return { halfX: 2.7, halfZ: 1.2 };
}

/** A stone well with a little roof and a bucket. */
export function well(put, rng, { roof = '#3f7fd9' } = {}) {
  const stone = '#d9ccff';
  for (const z of [-1, 1]) put.stone(0, 0.5, z, stone, 3, 1, 1);
  for (const x of [-1, 1]) put.stone(x, 0.5, 0, stone, 1, 1, 1.02);
  put(0, 0.85, 0, '#3ff0e6', 1, 0.1, 1); // water
  for (const x of [-1, 1]) put.wood(x, 1.75, 0, '#a8693a', 0.25, 1.5, 0.25);
  put(0, 2.2, 0, DARK_WOOD, 2, 0.12, 0.12); // crank bar
  put(0, 1.95, 0, '#d8c39a', 0.04, 0.4, 0.04); // rope
  put(0, 1.65, 0, WOOD, 0.3, 0.3, 0.3); // bucket
  for (const side of [1, -1]) put.roof(0, 2.75, side * 0.55, roof, 2.6, 0.18, 1.45, side * 0.6);
  put.roof(0, 3.08, 0, new THREE.Color(roof).offsetHSL(0, 0, -0.12), 2.75, 0.2, 0.35);
  return { halfX: 1.5, halfZ: 1.5 };
}

/** The blacksmith's forge: open front, glowing furnace, anvil and a rack of swords. Sells gear. */
export function forge(put, rng, { roof = '#4a4f5a' } = {}) {
  const hw = 3;
  const hd = 2;
  const height = 4;
  const stone = '#c9bfe6';
  // Back and side walls (the front is open), front posts and a beam across the top.
  put.stone(0, height / 2, -hd, stone, hw * 2 + 1, height, 1);
  for (const x of [-hw, hw]) put.stone(x, height / 2, -0.5, stone, 1, height, hd * 2);
  for (const x of [-hw, hw]) put.wood(x, 1.5, hd, '#8a5a35', 0.55, 3, 0.55); // front posts
  put.wood(0, height - 0.5, hd, '#a8693a', hw * 2 + 1.2, 1, 0.55);
  // A slate roof sloping down toward the front.
  const rise = 1.6;
  const run = hd * 2 + 2.2;
  put.roof(0, height + 0.25 + rise / 2, 0.2, roof, hw * 2 + 2, 0.45, Math.hypot(rise, run), Math.atan2(rise, run));
  // Furnace with glowing coals
  put.stone(-1.5, 1, -1.1, '#9a8fc0', 2, 2, 1.4);
  put(-1.5, 0.75, -0.42, '#ff7a1a', 1.2, 0.7, 0.06);
  put(-1.5, 0.6, -0.4, '#ffd23f', 0.7, 0.3, 0.06);
  put.stone(-1.5, 3, -1.2, '#9a8fc0', 0.7, 2, 0.7); // chimney
  // Anvil
  put(1.4, 0.3, 1.2, '#3b3b3b', 0.6, 0.6, 0.5);
  put(1.4, 0.75, 1.2, '#55595f', 1.1, 0.3, 0.5);
  // Sword rack on the back wall
  for (let i = 0; i < 3; i++) {
    put(0.6 + i * 0.6, 1.6, -hd + 0.6, '#dfe9f2', 0.1, 1.2, 0.05);
    put(0.6 + i * 0.6, 1.05, -hd + 0.6, '#ffc93c', 0.3, 0.07, 0.08);
  }
  // Hanging sign with a little sword on it
  put(0, height - 0.6, hd + 0.4, WOOD, 1.6, 0.8, 0.1);
  put(0, height - 0.6, hd + 0.47, '#dfe9f2', 1.0, 0.12, 0.05);
  put(-0.42, height - 0.6, hd + 0.47, '#ffc93c', 0.1, 0.36, 0.06);

  return { halfX: hw + 0.5, halfZ: hd + 0.5 };
}

/**
 * The forge's new wing, built when you help make a bigger forge: a huge furnace with a tall
 * chimney, a big anvil, a water trough and a grindstone. Drawn beside the forge (local x 4..9).
 */
export function forgeWing(put, rng, { roof = '#4a4f5a' } = {}) {
  const x0 = 4.2;
  // Back and outer side walls, roof and a front post.
  const stone = '#c9bfe6';
  put.stone(x0 + 2, 2, -2, stone, 5, 4, 1);
  put.stone(x0 + 4, 2, 0.5, stone, 1, 4, 4);
  put.roof(x0 + 2, 4.25, 0, roof, 6, 0.5, 5);
  put.wood(x0 + 0.2, 1.5, 2, '#8a5a35', 0.5, 3, 0.5);
  // Huge furnace
  put.stone(x0 + 2, 1.4, -1.1, '#9a8fc0', 2.8, 2.8, 1.6);
  put.glow(x0 + 2, 1, -0.28, '#ff7a1a', 1.8, 1, 0.06);
  put.glow(x0 + 2, 0.8, -0.26, '#ffd23f', 1, 0.4, 0.06);
  put.stone(x0 + 2, 5, -1.3, '#9a8fc0', 1, 4, 1); // tall chimney
  put(x0 + 2, 7.1, -1.3, '#3b3b3b', 1.3, 0.25, 1.3);
  // Big anvil, water trough, grindstone
  put(x0 + 1.2, 0.35, 1.2, '#3b3b3b', 0.7, 0.7, 0.6);
  put(x0 + 1.2, 0.85, 1.2, '#55595f', 1.4, 0.35, 0.6);
  put(x0 + 3.2, 0.35, 1.0, DARK_WOOD, 1.2, 0.7, 0.7);
  put(x0 + 3.2, 0.62, 1.0, '#3cc6ea', 1.0, 0.1, 0.5);
  put(x0 + 3.3, 0.7, -0.2, '#9a9ca3', 0.25, 1.1, 1.1);
  // A banner showing a hammer
  put(x0 + 4.1, 2.6, 0, '#d9293f', 0.06, 1.6, 1);
  put(x0 + 4.15, 2.8, 0, '#ffc93c', 0.04, 0.2, 0.6);
  put(x0 + 4.15, 2.5, 0, '#ffc93c', 0.04, 0.6, 0.15);
  return { center: [x0 + 2, 0], halfX: 2.6, halfZ: 2.5, smoke: [x0 + 2, 7.6, -1.3] };
}
