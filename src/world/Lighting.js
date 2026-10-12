import * as THREE from 'three';
import { Entity } from '../core/Entity.js';
import { SKY, WORLD } from '../config.js';

/**
 * Soft sky/ground ambient light plus a sun that casts shadows. The shadow area follows the
 * player, so things far out at sea (like the tower island) get shadows too.
 */
export class Lighting extends Entity {
  constructor() {
    super();

    const hemi = new THREE.HemisphereLight('#d8eeff', '#7a9c5a', 1.6);
    this.hemi = hemi;
    this.object3d.add(hemi);

    const sun = new THREE.DirectionalLight('#fff3dc', 2.4);
    sun.position.copy(SKY.sunDirection).multiplyScalar(150);
    this.sun = sun;
    sun.castShadow = true;
    const extent = WORLD.islandRadius + 8;
    Object.assign(sun.shadow.camera, {
      left: -extent,
      right: extent,
      top: extent,
      bottom: -extent,
      near: 1,
      far: 400,
    });
    sun.shadow.mapSize.set(4096, 4096);
    sun.shadow.bias = -0.0004;
    sun.shadow.normalBias = 0.03;
    this.object3d.add(sun, sun.target);
  }

  onAdd(game) {
    game.lighting = this;
  }

  update(_dt, game) {
    const p = game.player?.object3d.position;
    if (!p) return;
    // Move in big steps so the shadows don't shimmer while walking. Near the village the
    // shadow area stays centered on the island.
    const step = 16;
    const x = Math.hypot(p.x, p.z) < 40 ? 0 : Math.round(p.x / step) * step;
    const z = Math.hypot(p.x, p.z) < 40 ? 0 : Math.round(p.z / step) * step;
    const y = p.y > 50 ? Math.round(p.y) : 0; // up in the dream dimension, the shadows come with you
    if (x === this.cx && z === this.cz && y === this.cy) return;
    this.cx = x;
    this.cz = z;
    this.cy = y;
    this.sun.target.position.set(x, y, z);
    this.sun.position.copy(SKY.sunDirection).multiplyScalar(150).add(this.sun.target.position);
  }
}
