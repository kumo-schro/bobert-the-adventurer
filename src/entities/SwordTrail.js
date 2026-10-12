import * as THREE from 'three';
import { Entity } from '../core/Entity.js';

const SAMPLES = 18; // how many recent blade positions make up the ribbon
const FADE = 0.18; // seconds for the end of the trail to fade away

/**
 * A glowing ribbon that follows the sword blade during a swing, like a swoosh in a cartoon.
 * The player calls `add(base, tip, color)` every frame while swinging; the trail fades out
 * by itself afterwards.
 */
export class SwordTrail extends Entity {
  constructor() {
    super();
    this.points = []; // { base, tip, age, color }
    const positions = new Float32Array(SAMPLES * 2 * 3);
    const colors = new Float32Array(SAMPLES * 2 * 4);
    const index = [];
    for (let i = 0; i < SAMPLES - 1; i++) {
      const a = i * 2;
      index.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
    this.geometry = new THREE.BufferGeometry();
    this.geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    this.geometry.setAttribute('color', new THREE.BufferAttribute(colors, 4));
    this.geometry.setIndex(index);
    this.mesh = new THREE.Mesh(
      this.geometry,
      new THREE.MeshBasicMaterial({
        vertexColors: true,
        transparent: true,
        side: THREE.DoubleSide,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        fog: false,
      }),
    );
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 10;
    this.object3d.add(this.mesh);
    this.color = new THREE.Color();
  }

  /** Record where the blade is this frame. */
  add(base, tip, color) {
    this.points.unshift({ base: base.clone(), tip: tip.clone(), age: 0, color });
    if (this.points.length > SAMPLES) this.points.length = SAMPLES;
  }

  update(dt) {
    for (const p of this.points) p.age += dt;
    while (this.points.length && this.points.at(-1).age > FADE) this.points.pop();

    const pos = this.geometry.attributes.position;
    const col = this.geometry.attributes.color;
    const n = this.points.length;
    for (let i = 0; i < SAMPLES; i++) {
      const p = this.points[Math.min(i, n - 1)];
      if (!p) {
        // Nothing to draw: squash everything to a point with no color.
        for (let j = 0; j < 2; j++) col.setXYZW(i * 2 + j, 0, 0, 0, 0);
        continue;
      }
      pos.setXYZ(i * 2, p.base.x, p.base.y, p.base.z);
      pos.setXYZ(i * 2 + 1, p.tip.x, p.tip.y, p.tip.z);
      // Bright at the blade, fading along the trail and with age. The tip edge is brightest.
      const fade = i < n ? (1 - i / SAMPLES) * (1 - p.age / FADE) : 0;
      this.color.set(p.color);
      col.setXYZW(i * 2, this.color.r, this.color.g, this.color.b, fade * 0.15);
      col.setXYZW(i * 2 + 1, this.color.r, this.color.g, this.color.b, fade * 0.9);
    }
    pos.needsUpdate = true;
    col.needsUpdate = true;
    this.mesh.visible = n > 1;
  }
}
