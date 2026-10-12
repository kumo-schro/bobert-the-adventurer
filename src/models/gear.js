import * as THREE from 'three';
import { part } from './character.js';

const GOLD = '#ffc93c';

/**
 * A voxel sword. Attach to a hand; the blade points forward and a little up.
 * tier 0 = starting sword, tier 1 = the Knight's Sword from the shop (longer, blue, with a gem).
 */
export function createSword(tier = 0) {
  const sword = new THREE.Group();
  const knight = tier >= 1;
  const blade = knight ? '#cfe6ff' : '#dfe9f2';
  const glow = knight ? '#7fc4ff' : '#bfe6ff';
  const length = knight ? 0.95 : 0.7;

  part(sword, [0.08, 0.22, 0.08], knight ? '#2b3a8f' : '#6b3e1f', [0, 0, 0]); // grip
  part(sword, [0.12, 0.08, 0.12], GOLD, [0, -0.14, 0], { emissive: GOLD }); // pommel
  part(sword, [knight ? 0.5 : 0.36, 0.07, 0.1], GOLD, [0, 0.14, 0], { emissive: GOLD }); // crossguard
  if (knight) part(sword, [0.1, 0.1, 0.12], '#3fd0ff', [0, 0.14, 0], { emissive: '#3fd0ff' }); // gem
  part(sword, [knight ? 0.13 : 0.1, length, 0.04], blade, [0, 0.18 + length / 2, 0], { emissive: glow }); // blade
  part(sword, [0.03, length - 0.04, 0.05], knight ? '#5b8fd6' : '#a9bccd', [0, 0.16 + length / 2, 0]); // groove
  part(sword, [0.06, 0.08, 0.04], blade, [0, 0.22 + length, 0], { emissive: glow }); // tip
  sword.rotation.x = Math.PI / 2 - 0.5;
  return sword;
}

/**
 * A shield that faces forward (+Z). tier 0 = the blue wooden shield,
 * tier 1 = the Iron Shield from the forge (bigger, steel with a red emblem and studs).
 */
export function createShield(tier = 0) {
  const shield = new THREE.Group();
  const iron = tier >= 1;
  const rim = iron ? '#8a929c' : '#c3cad3';
  const [w, h] = iron ? [0.66, 0.78] : [0.56, 0.66];
  part(shield, [w, h, 0.07], iron ? '#b9c2cc' : '#2f6fd6', [0, 0, 0]); // face
  part(shield, [w + 0.06, 0.06, 0.09], rim, [0, h / 2 + 0.01, 0]);
  part(shield, [w + 0.06, 0.06, 0.09], rim, [0, -h / 2 - 0.01, 0]);
  part(shield, [0.06, h, 0.09], rim, [-w / 2, 0, 0]);
  part(shield, [0.06, h, 0.09], rim, [w / 2, 0, 0]);
  const emblem = iron ? '#d9293f' : GOLD;
  part(shield, [0.08, 0.4, 0.03], emblem, [0, 0, 0.045], { emissive: emblem }); // emblem
  part(shield, [0.3, 0.08, 0.03], emblem, [0, 0.04, 0.045], { emissive: emblem });
  part(shield, [0.12, 0.12, 0.04], iron ? '#ffc93c' : '#ffe08a', [0, 0.04, 0.05], { emissive: GOLD });
  if (iron) {
    for (const [x, y] of [[-0.24, 0.3], [0.24, 0.3], [-0.24, -0.3], [0.24, -0.3]]) {
      part(shield, [0.07, 0.07, 0.05], '#5f6670', [x, y, 0.05]); // studs
    }
  }
  shield.position.set(0.06, 0.2, 0.2);
  return shield;
}

/** A wooden bow (string toward -Z). Held in the left hand when shooting, otherwise worn on the back. */
export function createBow() {
  const bow = new THREE.Group();
  const wood = '#8a5a35';
  part(bow, [0.08, 0.26, 0.08], '#5e3b22', [0, 0, 0]); // grip
  part(bow, [0.07, 0.3, 0.07], wood, [0, 0.27, 0.06]).rotation.x = -0.35;
  part(bow, [0.07, 0.3, 0.07], wood, [0, -0.27, 0.06]).rotation.x = 0.35;
  part(bow, [0.06, 0.18, 0.06], wood, [0, 0.5, 0.0]).rotation.x = 0.4;
  part(bow, [0.06, 0.18, 0.06], wood, [0, -0.5, 0.0]).rotation.x = -0.4;
  part(bow, [0.015, 1.06, 0.015], '#f4ecd8', [0, 0, -0.08]); // string
  return bow;
}

/** An arrow pointing along +Z. A charged power-bow arrow glows. */
export function createArrow(charged = false) {
  const arrow = new THREE.Group();
  part(arrow, [0.05, 0.05, 0.8], '#c58b52', [0, 0, 0]); // shaft
  const head = part(arrow, [0.1, 0.1, 0.14], charged ? '#ffe08a' : '#b9c2cc', [0, 0, 0.44], charged ? { emissive: '#ffb300' } : {});
  if (charged) head.material.emissiveIntensity = 1;
  part(arrow, [0.16, 0.02, 0.16], '#ff4d6d', [0, 0, -0.34]); // feathers
  part(arrow, [0.02, 0.16, 0.16], '#ffffff', [0, 0, -0.34]);
  return arrow;
}

/** Steel armor that fits over a character from createCharacter(): chest plate and shoulder pads. */
export function addArmor({ root, armL, armR }) {
  const steel = '#b9c2cc';
  const dark = '#7d8590';
  const parts = [
    part(root, [0.68, 0.6, 0.42], steel, [0, 1.15, 0]), // chest plate
    part(root, [0.7, 0.1, 0.44], dark, [0, 0.86, 0]), // bottom rim
    part(root, [0.24, 0.24, 0.03], '#d9293f', [0, 1.2, 0.215], { emissive: '#d9293f' }), // red crest
  ];
  for (const arm of [armL, armR]) parts.push(part(arm, [0.3, 0.16, 0.32], dark, [0, -0.02, 0])); // shoulder pads
  return parts;
}

/** The sea tower's mystery crystal: a tall swirling gem with smaller shards around it. */
export function createMysteryCrystal() {
  const crystal = new THREE.Group();
  const glow = (c) => ({ emissive: c });
  part(crystal, [0.34, 0.7, 0.34], '#5ef2e0', [0, 0, 0], glow('#2fd4c4')).material.emissiveIntensity = 0.9;
  part(crystal, [0.22, 0.22, 0.22], '#e0fffb', [0, 0.45, 0], glow('#5ef2e0')).material.emissiveIntensity = 0.8;
  part(crystal, [0.22, 0.22, 0.22], '#5ef2e0', [0, -0.45, 0], glow('#2fd4c4')).material.emissiveIntensity = 0.9;
  for (const [x, z, c] of [[0.32, 0, '#ff8fe0'], [-0.32, 0, '#ffd23f'], [0, 0.32, '#b46bff']]) {
    part(crystal, [0.12, 0.3, 0.12], c, [x, -0.1, z], glow(c)).material.emissiveIntensity = 0.8;
  }
  return crystal;
}

/** The village's precious artifact: a glowing crystal on a golden stand. */
export function createArtifact() {
  const artifact = new THREE.Group();
  part(artifact, [0.5, 0.1, 0.5], GOLD, [0, 0.05, 0], { emissive: GOLD });
  part(artifact, [0.18, 0.24, 0.18], GOLD, [0, 0.22, 0], { emissive: GOLD });
  part(artifact, [0.42, 0.1, 0.42], GOLD, [0, 0.38, 0], { emissive: GOLD });
  const crystal = new THREE.Group();
  crystal.position.y = 0.68;
  crystal.rotation.y = Math.PI / 4;
  const glow = { emissive: '#b46bff' };
  part(crystal, [0.3, 0.46, 0.3], '#c78bff', [0, 0, 0], glow).material.emissiveIntensity = 0.8;
  part(crystal, [0.18, 0.18, 0.18], '#e4c4ff', [0, 0.3, 0], glow).material.emissiveIntensity = 0.8;
  artifact.add(crystal);
  return artifact;
}

/** A sparkly gem for collect quests. */
export function createGem(color = '#3fd0ff') {
  const gem = new THREE.Group();
  const glow = { emissive: color };
  part(gem, [0.34, 0.34, 0.34], color, [0, 0, 0], glow).material.emissiveIntensity = 0.7;
  part(gem, [0.2, 0.2, 0.2], '#ffffff', [0, 0.24, 0], glow).material.emissiveIntensity = 0.5;
  part(gem, [0.2, 0.2, 0.2], color, [0, -0.24, 0], glow).material.emissiveIntensity = 0.7;
  gem.rotation.z = Math.PI / 4;
  return gem;
}

/** A treasure chest. `lid` pivots at the back edge so it can swing open. */
export function createChest() {
  const root = new THREE.Group();
  const wood = '#9a5b2a';
  const dark = '#5e3b22';
  part(root, [1.0, 0.55, 0.7], wood, [0, 0.275, 0]);
  part(root, [1.04, 0.08, 0.74], dark, [0, 0.12, 0]);
  part(root, [0.08, 0.57, 0.74], GOLD, [-0.36, 0.28, 0], { emissive: GOLD });
  part(root, [0.08, 0.57, 0.74], GOLD, [0.36, 0.28, 0], { emissive: GOLD });

  const lid = new THREE.Group();
  lid.position.set(0, 0.55, -0.35);
  root.add(lid);
  part(lid, [1.04, 0.28, 0.74], wood, [0, 0.14, 0.35]);
  part(lid, [0.08, 0.3, 0.76], GOLD, [-0.36, 0.14, 0.35], { emissive: GOLD });
  part(lid, [0.08, 0.3, 0.76], GOLD, [0.36, 0.14, 0.35], { emissive: GOLD });
  part(lid, [0.16, 0.2, 0.06], GOLD, [0, 0, 0.73], { emissive: GOLD }); // lock

  // Treasure glow inside, only visible once the lid opens.
  const loot = part(root, [0.86, 0.06, 0.56], '#ffe08a', [0, 0.53, 0], { emissive: GOLD });
  loot.material.emissiveIntensity = 0.9;

  return { root, lid };
}

/** The big golden key that opens Charibdis's cave. */
export function createKey() {
  const key = new THREE.Group();
  const gold = { emissive: GOLD };
  part(key, [0.5, 0.5, 0.12], GOLD, [0, 0.45, 0], gold); // ring
  part(key, [0.24, 0.24, 0.14], '#1f6f78', [0, 0.45, 0]); // hole (with a sea-blue gem)
  part(key, [0.12, 0.8, 0.12], GOLD, [0, -0.15, 0], gold); // shaft
  part(key, [0.28, 0.1, 0.12], GOLD, [0.14, -0.45, 0], gold); // teeth
  part(key, [0.2, 0.1, 0.12], GOLD, [0.1, -0.28, 0], gold);
  return key;
}

/** A woodcutter's axe (held in the hand like the sword). */
export function createAxe() {
  const axe = new THREE.Group();
  part(axe, [0.08, 0.8, 0.08], '#8a5a35', [0, 0.25, 0]); // handle
  part(axe, [0.06, 0.3, 0.32], '#b9c2cc', [0, 0.55, 0.14]); // blade
  part(axe, [0.07, 0.34, 0.06], '#dfe9f2', [0, 0.55, 0.31]); // sharp edge
  axe.rotation.x = Math.PI / 2 - 0.5;
  return axe;
}

/** A miner's pickaxe. */
export function createPickaxe() {
  const pick = new THREE.Group();
  part(pick, [0.08, 0.8, 0.08], '#8a5a35', [0, 0.25, 0]); // handle
  part(pick, [0.08, 0.1, 0.8], '#8d8f96', [0, 0.62, 0]); // head
  part(pick, [0.06, 0.08, 0.14], '#b9c2cc', [0, 0.58, 0.44]); // points
  part(pick, [0.06, 0.08, 0.14], '#b9c2cc', [0, 0.58, -0.44]);
  pick.rotation.x = Math.PI / 2 - 0.5;
  return pick;
}

/** A spiral seashell for the beach-combing quest. */
export function createShell(color = '#ffb3c7') {
  const shell = new THREE.Group();
  const glow = { emissive: color };
  part(shell, [0.4, 0.3, 0.34], color, [0, 0, 0], glow).material.emissiveIntensity = 0.4;
  part(shell, [0.28, 0.22, 0.24], '#ffffff', [0.1, 0.2, 0], glow).material.emissiveIntensity = 0.3;
  part(shell, [0.16, 0.14, 0.14], color, [0.16, 0.34, 0], glow).material.emissiveIntensity = 0.4;
  part(shell, [0.2, 0.1, 0.4], '#ffe0e8', [-0.2, -0.1, 0]);
  return shell;
}
