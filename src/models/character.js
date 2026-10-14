import * as THREE from 'three';

const boxCache = new Map();
function boxGeometry(w, h, d) {
  const key = `${w},${h},${d}`;
  if (!boxCache.has(key)) boxCache.set(key, new THREE.BoxGeometry(w, h, d));
  return boxCache.get(key);
}

/** Adds a colored box to `parent`. Shared by the character and the items they hold. */
export function part(parent, [w, h, d], color, [x, y, z], { emissive } = {}) {
  const material = new THREE.MeshLambertMaterial({ color });
  if (emissive) {
    material.emissive.set(emissive);
    material.emissiveIntensity = 0.25;
  }
  const mesh = new THREE.Mesh(boxGeometry(w, h, d), material);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  parent.add(mesh);
  return mesh;
}

function pivot(parent, [x, y, z]) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  parent.add(g);
  return g;
}

/**
 * Builds a blocky character facing +Z with its feet at y = 0.
 * Limbs are wrapped in pivot groups so they can swing from the hip/shoulder.
 * Facing +Z, the character's right side is -X.
 * handR / handL are empty groups to attach held items to.
 */
export function createCharacter({
  skin = '#ffcc99',
  shirt = '#ff4f6d',
  pants = '#3d5afe',
  shoes = '#2b2b2b',
  hair = '#6b3e1f',
} = {}) {
  const root = new THREE.Group();
  // Each part remembers what it's made of (skin, shirt...), so applyLook() can recolor it.
  const tagged = (role, ...args) => {
    const mesh = part(...args);
    mesh.userData.role = role;
    return mesh;
  };

  // Legs (pivot at hip)
  const legR = pivot(root, [-0.16, 0.75, 0]);
  const legL = pivot(root, [0.16, 0.75, 0]);
  for (const leg of [legL, legR]) {
    tagged('pants', leg, [0.28, 0.62, 0.3], pants, [0, -0.31, 0]);
    tagged('shoes', leg, [0.3, 0.14, 0.36], shoes, [0, -0.68, 0.03]);
  }

  // Body
  tagged('shirt', root, [0.62, 0.72, 0.36], shirt, [0, 1.11, 0]);
  tagged('pants', root, [0.64, 0.1, 0.38], pants, [0, 0.78, 0]); // belt line

  // Arms (pivot at shoulder)
  const armR = pivot(root, [-0.43, 1.4, 0]);
  const armL = pivot(root, [0.43, 1.4, 0]);
  for (const arm of [armL, armR]) {
    tagged('shirt', arm, [0.22, 0.5, 0.26], shirt, [0, -0.22, 0]);
    tagged('skin', arm, [0.2, 0.18, 0.24], skin, [0, -0.55, 0]);
  }
  const handR = pivot(armR, [0, -0.58, 0.02]);
  const handL = pivot(armL, [0, -0.58, 0.02]);

  // Head
  const head = pivot(root, [0, 1.47, 0]);
  tagged('skin', head, [0.6, 0.6, 0.6], skin, [0, 0.3, 0]);
  const hairGroup = pivot(head, [0, 0, 0]);
  buildHair(hairGroup, 'classic', hair);
  part(head, [0.09, 0.12, 0.02], '#1d1d1d', [-0.13, 0.33, 0.305]);
  part(head, [0.09, 0.12, 0.02], '#1d1d1d', [0.13, 0.33, 0.305]);
  part(head, [0.1, 0.06, 0.02], '#ff8fa3', [-0.21, 0.2, 0.305]);
  part(head, [0.1, 0.06, 0.02], '#ff8fa3', [0.21, 0.2, 0.305]);
  part(head, [0.16, 0.05, 0.02], '#b5523b', [0, 0.16, 0.305]);

  return { root, head, hair: hairGroup, hairStyle: 'classic', armL, armR, legL, legR, handL, handR };
}

/** Hair styles for the character customization screen. Each adds boxes to the head's hair group. */
export const HAIR_STYLES = {
  classic: { name: 'Classic' },
  spiky: { name: 'Spiky' },
  long: { name: 'Long' },
  mohawk: { name: 'Mohawk' },
  curly: { name: 'Curly' },
};

function buildHair(group, style, color) {
  while (group.children.length) group.remove(group.children[0]);
  const add = (size, at) => (part(group, size, color, at).userData.role = 'hair');
  if (style === 'mohawk') {
    add([0.16, 0.22, 0.6], [0, 0.68, 0]);
    add([0.12, 0.12, 0.5], [0, 0.82, -0.02]);
    return;
  }
  add([0.64, 0.16, 0.64], [0, 0.62, 0]); // top
  if (style === 'spiky') {
    add([0.64, 0.4, 0.14], [0, 0.42, -0.26]); // back
    for (const [x, z, h] of [[-0.2, 0.15, 0.2], [0, 0.18, 0.26], [0.2, 0.12, 0.2], [-0.12, -0.12, 0.22], [0.14, -0.1, 0.24]]) {
      add([0.16, h, 0.16], [x, 0.7 + h / 2, z]);
    }
  } else if (style === 'long') {
    add([0.66, 0.72, 0.16], [0, 0.3, -0.27]); // down to the shoulders
    for (const side of [-1, 1]) add([0.1, 0.5, 0.4], [side * 0.33, 0.37, -0.08]); // over the ears
    add([0.64, 0.1, 0.12], [0, 0.52, 0.27]); // fringe
  } else if (style === 'curly') {
    add([0.64, 0.4, 0.14], [0, 0.42, -0.26]);
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2;
      add([0.2, 0.18, 0.2], [Math.sin(a) * 0.28, 0.7 + (i % 2) * 0.06, Math.cos(a) * 0.28]);
    }
    add([0.24, 0.2, 0.24], [0, 0.76, 0]);
  } else {
    add([0.64, 0.4, 0.14], [0, 0.42, -0.26]); // classic: a short back
  }
}

/**
 * Recolor (and restyle) a character from createCharacter(): look = { skin, hair, hairStyle, shirt,
 * pants, shoes } (any of them). Parts added later, like armor or held gear, aren't touched.
 */
export function applyLook(model, look) {
  if (look.hairStyle && look.hairStyle !== model.hairStyle && HAIR_STYLES[look.hairStyle]) {
    const hairColor = look.hair ?? model.hair.children[0]?.material.color.getStyle();
    buildHair(model.hair, look.hairStyle, hairColor);
    model.hairStyle = look.hairStyle;
  }
  model.root.traverse((o) => {
    const color = o.userData.role && look[o.userData.role];
    if (color) o.material.color.set(color);
  });
}

/** Swings arms and legs for walking. `swing` 0 = standing still, ~1 = full stride. */
export function poseWalk(model, phase, swing) {
  const s = Math.sin(phase) * swing;
  model.legL.rotation.x = s;
  model.legR.rotation.x = -s;
  model.armL.rotation.x = -s;
  model.armR.rotation.x = s;
  model.head.position.y = (model.headY ?? 1.47) + Math.abs(Math.sin(phase)) * 0.04 * swing;
}

/** Turns the model to face an angle (radians around Y), smoothly and the short way round. */
export function turnToward(model, angle, dt, speed = 12) {
  let delta = angle - model.root.rotation.y;
  delta = Math.atan2(Math.sin(delta), Math.cos(delta));
  model.root.rotation.y += delta * (1 - Math.exp(-speed * dt));
}
