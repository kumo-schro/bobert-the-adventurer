import * as THREE from 'three';
import { Entity } from '../core/Entity.js';
import { createRng } from '../utils/random.js';
import { SEED, WORLD } from '../config.js';

const COLORS = ['#ff6b6b', '#ffd93d', '#6bcBff', '#c77dff', '#ff9f43', '#ffffff'];
const bodyGeometry = new THREE.BoxGeometry(0.06, 0.06, 0.28);
const bodyMaterial = new THREE.MeshLambertMaterial({ color: '#2b2b2b' });
const wingGeometry = new THREE.BoxGeometry(0.3, 0.02, 0.26).translate(0.16, 0, 0);

/**
 * A small example of an animated entity: butterflies that flutter around a home spot.
 * Copy this file as a starting point for new creatures.
 */
export class Butterflies extends Entity {
  constructor({ count = WORLD.butterflyCount } = {}) {
    super();
    this.count = count;
    this.flock = [];
  }

  onAdd(game) {
    const rng = createRng(SEED + 4);
    const r = game.terrain.radius * 0.8;

    for (let i = 0; i < this.count; i++) {
      const wingMaterial = new THREE.MeshLambertMaterial({ color: rng.pick(COLORS) });
      const group = new THREE.Group();
      group.add(new THREE.Mesh(bodyGeometry, bodyMaterial));
      const wingL = new THREE.Mesh(wingGeometry, wingMaterial);
      const wingR = new THREE.Mesh(wingGeometry, wingMaterial);
      wingR.scale.x = -1;
      group.add(wingL, wingR);

      // Pick a home spot that isn't inside the mountain or a building.
      const home = new THREE.Vector3();
      for (let tries = 0; tries < 20; tries++) {
        home.set(rng.range(-r, r), 0, rng.range(-r, r));
        if (!game.isReserved(home.x, home.z)) break;
      }
      group.position.copy(home);
      this.object3d.add(group);
      this.flock.push({
        group,
        wingL,
        wingR,
        home,
        heading: rng.range(0, Math.PI * 2),
        phase: rng.range(0, 10),
        speed: rng.range(1.5, 2.5),
      });
    }
  }

  update(dt, game) {
    const t = game.elapsed;
    for (const b of this.flock) {
      const pos = b.group.position;

      // Wander, but steer back toward home when straying too far.
      b.heading += Math.sin(t * 1.3 + b.phase) * 2.5 * dt;
      const toHomeX = b.home.x - pos.x;
      const toHomeZ = b.home.z - pos.z;
      if (toHomeX * toHomeX + toHomeZ * toHomeZ > 36) {
        const desired = Math.atan2(toHomeX, toHomeZ);
        const delta = Math.atan2(Math.sin(desired - b.heading), Math.cos(desired - b.heading));
        b.heading += delta * 2 * dt;
      }

      pos.x += Math.sin(b.heading) * b.speed * dt;
      pos.z += Math.cos(b.heading) * b.speed * dt;
      pos.y = 1.2 + Math.sin(t * 2 + b.phase) * 0.5;
      b.group.rotation.y = b.heading;

      const flap = Math.sin(t * 18 + b.phase) * 0.9;
      b.wingL.rotation.z = flap;
      b.wingR.rotation.z = -flap;
    }
  }
}
