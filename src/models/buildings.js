import { vary } from '../utils/color.js';

// Building recipes. Each one draws in LOCAL coordinates through `put(x, y, z, color, sx, sy, sz)`
// (a box centered at x,y,z), with its front facing +Z, and returns its collider half-size.
// The Village rotates and places them, so recipes never worry about where they end up.

const STONE = ['#8e8e8e', '#9d9d9d', '#7f7f7f', '#a9a49a', '#8a8f96'];
const DARK_STONE = '#666a70';
const WOOD = '#8a5a35';
const DARK_WOOD = '#5e3b22';
const GLASS = '#9fdcff';
const DOOR = '#7a4a24';

// Each house gets its own wall stone and shutter color so the village doesn't look copy-pasted.
const WALL_STYLES = [
  ['#8e8e8e', '#9d9d9d', '#7f7f7f', '#a9a49a', '#8a8f96'], // grey cobble
  ['#d8c7a3', '#cdb994', '#e1d1b0', '#c4b08a'], // sandstone
  ['#e9e4da', '#dcd6ca', '#f2eee6', '#d2cbbf'], // whitewashed
  ['#a8988a', '#9b8b7e', '#b3a597', '#8f8073'], // brown fieldstone
];
const SHUTTERS = ['#2f6fd6', '#2fa36b', '#d9493f', '#7a4fd1', '#e08a2e', '#2fb5a8'];
const FLOWERS = ['#ff4d6d', '#ffd23f', '#ff8fab', '#c77dff', '#ffffff'];

/**
 * A cobblestone cottage: gabled roof, framed windows with shutters and sills, a front door
 * with a lantern, flower boxes, ivy, a chimney (returns where its smoke comes out), and a
 * yard with a woodpile, barrel and crates on one side and a little vegetable garden on the other.
 */
export function stoneHouse(put, rng, { hw = 4, hd = 3, height = 4, roof = '#d9493f', style = 0 } = {}) {
  const stone = WALL_STYLES[style % WALL_STYLES.length];
  const shutter = rng.pick(SHUTTERS);
  // Collect unit voxels in a map first so later parts (chimney) cleanly replace earlier ones.
  const cells = new Map();
  const set = (x, y, z, color) => cells.set(`${x},${y},${z}`, { x, y, z, color });
  const frontWindow = (x, z) => Math.abs(z) === hd && Math.abs(x) === 2 && hw >= 3;
  const sideWindow = (x, z) => Math.abs(x) === hw && z === 0;
  const isWindow = (x, y, z) => (y === 1 || y === 2) && (frontWindow(x, z) || sideWindow(x, z));

  // Walls (hollow shell)
  for (let y = 0; y < height; y++) {
    for (let x = -hw; x <= hw; x++) {
      for (let z = -hd; z <= hd; z++) {
        const edgeX = Math.abs(x) === hw;
        const edgeZ = Math.abs(z) === hd;
        if (!edgeX && !edgeZ) continue;

        let color = vary(rng.pick(stone), rng, 0.05);
        if (y === 0) color = vary(DARK_STONE, rng, 0.05); // foundation
        if (edgeX && edgeZ) color = vary(DARK_STONE, rng, 0.03); // corner stones
        else if (z === hd && x === 0 && y < 2) color = DOOR;
        else if (z === hd && x === 0 && y === 2) color = DARK_WOOD; // lintel
        else if (y === height - 1) color = vary(DARK_WOOD, rng, 0.03); // timber band
        else if (isWindow(x, y, z)) color = GLASS;
        set(x, y, z, color);
      }
    }
  }

  // Gabled roof with the ridge running along X, overhanging the walls by one block.
  const roofDark = vary(roof, rng, 0).offsetHSL(0, 0, -0.12);
  for (let i = 0; i <= hd + 1; i++) {
    const z = hd + 1 - i;
    const y = height + i;
    for (let x = -hw - 1; x <= hw + 1; x++) {
      // Every other row a touch darker, like rows of roof tiles.
      const color = i === hd + 1 ? roofDark : vary(roof, rng, 0.04).offsetHSL(0, 0, i % 2 ? -0.04 : 0);
      set(x, y, z, color);
      set(x, y, -z, color);
    }
    for (let gz = -z + 1; gz <= z - 1; gz++) {
      set(-hw, y, gz, vary(WOOD, rng, 0.04));
      set(hw, y, gz, vary(WOOD, rng, 0.04));
    }
  }
  // Round attic window in each gable.
  if (hd >= 2) {
    set(-hw, height + 1, 0, GLASS);
    set(hw, height + 1, 0, GLASS);
  }

  // Chimney poking out of the back slope, with a cap.
  const chimneyTop = height + hd + 2;
  for (let y = height; y <= chimneyTop; y++) set(hw - 1, y, -1, vary(DARK_STONE, rng, 0.04));

  for (const c of cells.values()) put(c.x, c.y + 0.5, c.z, c.color);
  put(hw - 1, chimneyTop + 1.1, -1, '#4a4f55', 1.3, 0.2, 1.3);

  // Window frames, sills and shutters (front windows, plus one on each side wall).
  const front = hd + 0.5;
  const windows = [];
  if (hw >= 3) windows.push([-2, front, 1], [2, front, 1]);
  windows.push([hw + 0.5, 0, 0], [-hw - 0.5, 0, 0]);
  for (const [wx, wz, facingFront] of windows) {
    if (facingFront) {
      put(wx, 2.5, wz + 0.04, '#f4ecd8', 0.08, 2, 0.06); // cross-shaped window frame
      put(wx, 2, wz + 0.04, '#f4ecd8', 1, 0.08, 0.06);
      put(wx, 3.05, wz + 0.06, DARK_WOOD, 1.2, 0.12, 0.14); // top frame
      put(wx - 0.62, 2, wz + 0.08, shutter, 0.22, 1.9, 0.08); // shutters
      put(wx + 0.62, 2, wz + 0.08, shutter, 0.22, 1.9, 0.08);
    } else {
      const side = Math.sign(wx);
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
    smoke: [hw - 1, chimneyTop + 1.4, -1],
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

/** Pip's crystal shop: a little stall with a purple and teal awning and glowing crystals. */
export function crystalStall(put, rng) {
  for (const x of [-1.4, 1.4]) {
    for (const z of [-0.9, 0.5]) put(x, 1.2, z, DARK_WOOD, 0.2, 2.4, 0.2);
  }
  put(0, 0.5, 0.3, '#5b3f9e', 2.6, 1, 0.7); // counter
  put(0, 1.05, 0.3, '#c58b52', 2.9, 0.1, 0.9);
  for (let i = 0; i < 6; i++) {
    const x = -1.4 + i * 0.56;
    const color = i % 2 === 0 ? '#7a4fd1' : '#2fb5a8';
    put(x, 2.55, -0.5, color, 0.56, 0.15, 1.2);
    put(x, 2.35, 0.35, color, 0.56, 0.15, 0.9);
    put(x, 2.12, 0.8, color, 0.56, 0.26, 0.06);
  }
  // Crystals on the counter (they glow)
  const crystals = ['#ff6bb5', '#3fd0ff', '#7dff8a', '#c77dff', '#ffd23f', '#9df2ff'];
  for (let i = 0; i < 6; i++) {
    const h = 0.22 + rng.range(0, 0.22);
    put.glow(-1.1 + i * 0.44, 1.1 + h / 2, 0.3 + rng.range(-0.15, 0.15), crystals[i], 0.18, h, 0.18);
  }
  // A big crystal on a little stand by the side, and a sign
  put(1.9, 0.35, 0, DARK_WOOD, 0.6, 0.7, 0.6);
  put.glow(1.9, 1.05, 0, '#3fd0ff', 0.35, 0.7, 0.35);
  put(-1.9, 0.9, 0.6, DARK_WOOD, 0.1, 1.8, 0.1);
  put(-1.9, 1.7, 0.6, '#f4ecd8', 0.8, 0.5, 0.08);
  put.glow(-1.9, 1.7, 0.65, '#c77dff', 0.25, 0.25, 0.04);
  return { halfX: 2.3, halfZ: 1.1 };
}

/** A stone well with a little roof and a bucket. */
export function well(put, rng, { roof = '#3f7fd9' } = {}) {
  for (let x = -1; x <= 1; x++) {
    for (let z = -1; z <= 1; z++) {
      if (x === 0 && z === 0) put(0, 0.4, 0, '#3cc6ea', 1, 0.2, 1);
      else put(x, 0.5, z, vary(rng.pick(STONE), rng, 0.05));
    }
  }
  for (const x of [-1, 1]) put(x, 1.75, 0, DARK_WOOD, 0.25, 1.5, 0.25);
  put(0, 2.2, 0, DARK_WOOD, 2, 0.12, 0.12); // crank bar
  put(0, 1.95, 0, '#d8c39a', 0.04, 0.4, 0.04); // rope
  put(0, 1.65, 0, WOOD, 0.3, 0.3, 0.3); // bucket
  put(0, 2.6, 0, roof, 2.8, 0.2, 1.9);
  put(0, 2.8, 0, vary(roof, rng, 0).offsetHSL(0, 0, -0.12), 2.2, 0.2, 1.0);
  return { halfX: 1.5, halfZ: 1.5 };
}

/** The blacksmith's forge: open front, glowing furnace, anvil and a rack of swords. Sells gear. */
export function forge(put, rng, { roof = '#4a4f5a' } = {}) {
  const hw = 3;
  const hd = 2;
  const height = 4;
  // Back and side walls (front is open)
  for (let y = 0; y < height; y++) {
    for (let x = -hw; x <= hw; x++) {
      for (let z = -hd; z <= hd; z++) {
        const back = z === -hd;
        const side = Math.abs(x) === hw;
        if (!back && !side) continue;
        if (side && z === hd && y < height - 1) continue; // posts handle the front corners
        put(x, y + 0.5, z, side && z === hd ? DARK_WOOD : vary(rng.pick(STONE), rng, 0.05));
      }
    }
  }
  for (const x of [-hw, hw]) put(x, 1.5, hd, DARK_WOOD, 0.5, 3, 0.5); // front posts
  // Sloped slate roof
  for (let i = 0; i < 3; i++) {
    put(0, height + 0.25 + i * 0.5, hd + 0.5 - i * 1.6, vary(roof, rng, 0.04), hw * 2 + 2, 0.5, 1.8);
  }
  put(0, height + 1.4, -hd - 0.2, vary(roof, rng, 0.04), hw * 2 + 2, 0.5, 1.4);
  // Furnace with glowing coals
  put(-1.5, 1, -1.1, DARK_STONE, 2, 2, 1.4);
  put(-1.5, 0.75, -0.42, '#ff7a1a', 1.2, 0.7, 0.06);
  put(-1.5, 0.6, -0.4, '#ffd23f', 0.7, 0.3, 0.06);
  put(-1.5, 3, -1.2, DARK_STONE, 0.7, 2, 0.7); // chimney
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
  // Back and outer side walls
  for (let y = 0; y < 4; y++) {
    for (let x = 0; x <= 4; x++) put(x0 + x, y + 0.5, -2, vary(rng.pick(STONE), rng, 0.05));
    for (let z = -2; z <= 2; z++) put(x0 + 4, y + 0.5, z, vary(rng.pick(STONE), rng, 0.05));
  }
  put(x0 + 2, 4.25, 0, vary(roof, rng, 0.04), 6, 0.5, 5); // roof
  put(x0 + 0.2, 1.5, 2, DARK_WOOD, 0.5, 3, 0.5); // front post
  // Huge furnace
  put(x0 + 2, 1.4, -1.1, DARK_STONE, 2.8, 2.8, 1.6);
  put.glow(x0 + 2, 1, -0.28, '#ff7a1a', 1.8, 1, 0.06);
  put.glow(x0 + 2, 0.8, -0.26, '#ffd23f', 1, 0.4, 0.06);
  put(x0 + 2, 5, -1.3, DARK_STONE, 1, 4, 1); // tall chimney
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
