import * as THREE from 'three';
import { Entity } from '../core/Entity.js';
import { SKY } from '../config.js';

/**
 * Soft sky/ground ambient light plus a sun that casts shadows. The shadow area follows the
 * player, so things far out at sea (like the tower island) get shadows too.
 */
export class Lighting extends Entity {
  constructor() {
    super();

    const hemi = new THREE.HemisphereLight('#efe2ff', '#8a64d8', 1.7);
    this.hemi = hemi;
    this.object3d.add(hemi);

    const sun = new THREE.DirectionalLight('#fff0d6', 2.5);
    sun.position.copy(SKY.sunDirection).multiplyScalar(150);
    this.sun = sun;
    sun.castShadow = true;
    const extent = 64; // shadows cover the area around the player (it follows them)
    Object.assign(sun.shadow.camera, {
      left: -extent,
      right: extent,
      top: extent,
      bottom: -extent,
      near: 1,
      far: 320,
    });
    sun.shadow.mapSize.set(2048, 2048);
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
    // Move in big steps so the shadows don't shimmer while walking.
    const step = 16;
    const x = Math.round(p.x / step) * step;
    const z = Math.round(p.z / step) * step;
    const y = p.y > 50 ? Math.round(p.y) : 0; // up in the dream dimension, the shadows come with you
    if (x === this.cx && z === this.cz && y === this.cy) return;
    this.cx = x;
    this.cz = z;
    this.cy = y;
    this.sun.target.position.set(x, y, z);
    this.sun.position.copy(SKY.sunDirection).multiplyScalar(150).add(this.sun.target.position);
  }
}
