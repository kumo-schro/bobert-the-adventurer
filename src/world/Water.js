import * as THREE from 'three';
import { Entity } from '../core/Entity.js';

/** A calm sea around the island that gently bobs. */
export class Water extends Entity {
  constructor() {
    super();
    const material = new THREE.MeshLambertMaterial({
      color: '#3cc6ea',
      transparent: true,
      opacity: 0.82,
    });
    this.mesh = new THREE.Mesh(new THREE.CircleGeometry(1200, 64), material);
    this.mesh.rotation.x = -Math.PI / 2;
    this.mesh.receiveShadow = true;
    this.object3d.add(this.mesh);
  }

  update(_dt, game) {
    this.mesh.position.y = -0.4 + Math.sin(game.elapsed * 0.8) * 0.06;
  }
}
