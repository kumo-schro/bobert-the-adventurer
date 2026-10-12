import * as THREE from 'three';
import { Entity } from '../core/Entity.js';
import { part } from '../models/character.js';

const RANGE = 2.6;

/**
 * The old trapdoor outside of town. It's locked until you have the mystery crystal; the crystal
 * fits the lock. Once open, press T to climb down to Old Man Keegan's cellar (`cellar.arrive`).
 * Set `onOpen()` to react when it's unlocked.
 */
export class Trapdoor extends Entity {
  constructor({ x, z }, cellar) {
    super();
    this.cellar = cellar;
    this.object3d.position.set(x, 0, z);
    this.questPosition = this.object3d.position;
    this.open = false;
    this.lidAngle = 0;
    this.onOpen = null;
    this.buildModel();
  }

  buildModel() {
    const g = this.object3d;
    // Stone frame
    for (const [x, z, w, d] of [[0, -1.2, 2.8, 0.4], [0, 1.2, 2.8, 0.4], [-1.2, 0, 0.4, 2], [1.2, 0, 0.4, 2]]) {
      part(g, [w, 0.2, d], '#8d8f96', [x, 0.1, z]);
    }
    part(g, [2, 0.04, 2], '#1d1d1d', [0, 0.02, 0]); // the dark hole underneath
    // Wooden lid, hinged at the back edge
    this.lid = new THREE.Group();
    this.lid.position.set(0, 0.16, -1);
    g.add(this.lid);
    part(this.lid, [2, 0.14, 2], '#8a5530', [0, 0, 1]);
    for (const z of [0.4, 1.6]) part(this.lid, [2.04, 0.16, 0.18], '#3b3b3b', [0, 0.02, z]); // iron bands
    part(this.lid, [0.2, 0.08, 0.5], '#3b3b3b', [0.6, 0.1, 1.7]); // handle
    // The crystal-shaped lock: dark until the crystal is in it.
    this.socket = part(this.lid, [0.36, 0.06, 0.5], '#2b3a55', [0, 0.1, 1]);
    // Ladder going down (only seen when open)
    for (const x of [-0.4, 0.4]) part(g, [0.1, 1.6, 0.1], '#5e3b22', [x, -0.7, -0.7]);
  }

  onAdd(game) {
    this.collider = { x: this.object3d.position.x, z: this.object3d.position.z, halfX: 1, halfZ: 1 };
  }

  unlock(game) {
    this.open = true;
    this.socket.material.color.set('#5ef2e0');
    this.socket.material.emissive.set('#5ef2e0');
    this.socket.material.emissiveIntensity = 1;
    game.colliders.push(this.collider); // don't walk into the hole
    game.particles?.burst(this.object3d.position.clone().setY(0.6), { count: 40, colors: ['#5ef2e0', '#ffffff', '#ff8fe0'], speed: 5, size: 0.14 });
    game.questLog?.toast('The crystal fits! The trapdoor creaks open...');
    this.onOpen?.();
  }

  climbDown(game) {
    game.questLog?.complete('trapdoor');
    const { x, z, facing } = this.cellar.arrive;
    game.teleport(x, z, { facing });
  }

  update(dt, game) {
    this.lidAngle += ((this.open ? -1.9 : 0) - this.lidAngle) * (1 - Math.exp(-4 * dt));
    this.lid.rotation.x = this.lidAngle;

    const player = game.player;
    if (player.dead) return;
    const d = player.object3d.position.distanceTo(this.object3d.position);
    if (d > RANGE) return;
    if (this.open) game.dialog.offerInteraction('Press T to climb down the trapdoor', d, () => this.climbDown(game));
    else if (player.hasCrystal) game.dialog.offerInteraction('Press T to put the mystery crystal in the lock', d, () => this.unlock(game));
    else game.dialog.offerInteraction('Press T to look at the trapdoor', d, () => game.questLog.toast("Locked tight. There's a crystal-shaped hole in the lock..."));
  }
}
