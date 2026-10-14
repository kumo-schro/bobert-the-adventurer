import * as THREE from 'three';
import { part } from './character.js';

// Animal friends that talk like villagers. Each returns the same pieces as createCharacter()
// (root, head, arms, legs, hands) so an Npc can use it: for a gecko the "arms" are its front
// legs. `headY` is where the head sits, and `idle(time)` wiggles things like tails.

function pivot(parent, [x, y, z]) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  parent.add(g);
  return g;
}

/** Barrett: a chubby green gecko with orange spots, big eyes and a gold coin on a string. */
export function createGecko() {
  const root = new THREE.Group();
  const body = pivot(root, [0, 0, 0]);
  body.scale.setScalar(1.35);
  const green = '#3fcf6a';
  const belly = '#c8f58a';
  const spot = '#ff9a3d';
  part(body, [0.62, 0.38, 1.0], green, [0, 0.42, 0]); // body
  part(body, [0.5, 0.06, 0.84], belly, [0, 0.22, 0]);
  for (const [x, z] of [[-0.18, 0.2], [0.2, -0.15], [0, -0.35], [-0.12, -0.05]]) part(body, [0.14, 0.04, 0.14], spot, [x, 0.62, z]);
  // Legs splayed out to the sides: front ones are the "arms".
  const legs = {};
  for (const [name, x, z] of [['armL', 0.32, 0.32], ['armR', -0.32, 0.32], ['legL', 0.32, -0.32], ['legR', -0.32, -0.32]]) {
    const leg = pivot(body, [x, 0.4, z]);
    part(leg, [0.3, 0.12, 0.14], green, [Math.sign(x) * 0.15, -0.05, 0]);
    part(leg, [0.12, 0.3, 0.12], green, [Math.sign(x) * 0.28, -0.2, 0]);
    part(leg, [0.24, 0.06, 0.24], belly, [Math.sign(x) * 0.3, -0.34, 0.02]); // sticky toes
    legs[name] = leg;
  }
  const head = pivot(body, [0, 0.5, 0.55]);
  part(head, [0.52, 0.36, 0.5], green, [0, 0.05, 0.15]);
  part(head, [0.4, 0.12, 0.2], belly, [0, -0.1, 0.32]); // chin
  for (const side of [-1, 1]) {
    part(head, [0.18, 0.2, 0.18], '#ffffff', [side * 0.24, 0.2, 0.22]); // bulgy eyes
    part(head, [0.1, 0.14, 0.04], '#2a1840', [side * 0.25, 0.2, 0.32]);
    part(head, [0.04, 0.04, 0.02], '#ffffff', [side * 0.23, 0.24, 0.345]);
  }
  part(head, [0.22, 0.03, 0.02], '#2a6a3a', [0, -0.02, 0.405]); // smile
  // A gold coin hanging round his neck (he does love coins).
  part(body, [0.5, 0.04, 0.04], '#8a5a35', [0, 0.5, 0.52]);
  part(body, [0.2, 0.2, 0.05], '#ffc93c', [0, 0.36, 0.56], { emissive: '#ffc93c' });
  const tail = pivot(body, [0, 0.42, -0.5]);
  part(tail, [0.3, 0.22, 0.5], green, [0, 0, -0.22]);
  part(tail, [0.2, 0.16, 0.4], green, [0, -0.02, -0.62]);
  part(tail, [0.12, 0.1, 0.3], spot, [0, -0.03, -0.95]);
  const handR = pivot(legs.armR, [0, -0.3, 0]);
  const handL = pivot(legs.armL, [0, -0.3, 0]);
  return {
    root,
    head,
    headY: 0.5,
    ...legs,
    handL,
    handR,
    idle(t) {
      tail.rotation.y = Math.sin(t * 2.2) * 0.35;
    },
  };
}

/** Grayson: a round, friendly fish in sunny orange and sky blue, with big fins. */
export function createFish() {
  const root = new THREE.Group();
  const body = pivot(root, [0, 0, 0]);
  body.scale.setScalar(1.3);
  const orange = '#ff9a3d';
  const blue = '#4fc6ff';
  part(body, [0.6, 0.8, 1.0], orange, [0, 0.6, 0]); // body
  part(body, [0.62, 0.3, 0.6], blue, [0, 0.62, -0.05]); // stripe
  part(body, [0.5, 0.2, 0.7], '#ffe0b8', [0, 0.24, 0.05]); // belly
  part(body, [0.08, 0.4, 0.5], blue, [0, 1.12, -0.1]); // top fin
  const head = pivot(body, [0, 0.6, 0.5]);
  for (const side of [-1, 1]) {
    part(head, [0.06, 0.26, 0.26], '#ffffff', [side * 0.3, 0.12, 0.05]);
    part(head, [0.05, 0.16, 0.14], '#2a1840', [side * 0.33, 0.1, 0.1]);
    part(head, [0.02, 0.05, 0.05], '#ffffff', [side * 0.36, 0.15, 0.13]);
  }
  part(head, [0.3, 0.1, 0.08], '#d9493f', [0, -0.1, 0.05]); // smile
  const fins = {};
  for (const [name, side] of [['armL', 1], ['armR', -1]]) {
    const fin = pivot(body, [side * 0.3, 0.5, 0.1]);
    part(fin, [0.06, 0.3, 0.4], blue, [side * 0.06, 0, -0.1]);
    fins[name] = fin;
  }
  const tail = pivot(body, [0, 0.6, -0.5]);
  part(tail, [0.08, 0.7, 0.5], blue, [0, 0, -0.25]);
  const legL = pivot(body, [0, 0, 0]);
  const legR = pivot(body, [0, 0, 0]);
  const handR = pivot(fins.armR, [0, 0, 0]);
  const handL = pivot(fins.armL, [0, 0, 0]);
  return {
    root,
    head,
    headY: 0.6,
    ...fins,
    legL,
    legR,
    handL,
    handR,
    idle(t) {
      tail.rotation.y = Math.sin(t * 5) * 0.4;
      fins.armL.rotation.z = 0.3 + Math.sin(t * 4) * 0.25;
      fins.armR.rotation.z = -0.3 - Math.sin(t * 4) * 0.25;
      body.position.y = Math.sin(t * 1.6) * 0.12; // bobbing in the water
    },
  };
}
