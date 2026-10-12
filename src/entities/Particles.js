import * as THREE from 'three';
import { Entity } from '../core/Entity.js';

const MAX = 600;
const GRAVITY = 20;

const _matrix = new THREE.Matrix4();
const _quat = new THREE.Quaternion();
const _scale = new THREE.Vector3();
const _color = new THREE.Color();

/**
 * Little flying voxel bits for hits, explosions, sparkles and coins. Lives at game.particles.
 *
 *   game.particles.burst(position, { count: 20, colors: ['#ff0', '#fff'], speed: 6 });
 */
export class Particles extends Entity {
  constructor() {
    super();
    const material = new THREE.MeshLambertMaterial({ emissive: '#ffffff', emissiveIntensity: 0.15 });
    this.mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), material, MAX);
    this.mesh.frustumCulled = false;
    this.mesh.castShadow = true;
    for (let i = 0; i < MAX; i++) this.mesh.setColorAt(i, _color.set('#ffffff'));
    this.mesh.count = 0;
    this.object3d.add(this.mesh);
    this.list = [];
  }

  onAdd(game) {
    game.particles = this;
  }

  burst(position, { count = 12, colors = ['#ffffff'], speed = 5, size = 0.2, life = 1, up = 1, gravity = GRAVITY } = {}) {
    for (let i = 0; i < count && this.list.length < MAX; i++) {
      const angle = Math.random() * Math.PI * 2;
      const spread = speed * (0.4 + Math.random() * 0.6);
      this.list.push({
        pos: new THREE.Vector3().copy(position),
        vel: new THREE.Vector3(
          Math.cos(angle) * spread,
          (0.5 + Math.random()) * speed * up,
          Math.sin(angle) * spread,
        ),
        spin: new THREE.Euler(Math.random() * 3, Math.random() * 3, 0),
        size: size * (0.7 + Math.random() * 0.6),
        life: life * (0.7 + Math.random() * 0.6),
        maxLife: life,
        color: new THREE.Color(colors[Math.floor(Math.random() * colors.length)]),
        gravity,
      });
    }
  }

  update(dt) {
    let n = 0;
    this.list = this.list.filter((p) => (p.life -= dt) > 0);
    for (const p of this.list) {
      p.vel.y -= p.gravity * dt;
      p.pos.addScaledVector(p.vel, dt);
      if (p.pos.y < p.size / 2) {
        p.pos.y = p.size / 2;
        p.vel.y *= -0.4;
        p.vel.x *= 0.7;
        p.vel.z *= 0.7;
      }
      p.spin.x += dt * 5;
      p.spin.y += dt * 4;

      const s = p.size * Math.min(1, p.life / 0.3); // shrink away at the end
      _matrix.compose(p.pos, _quat.setFromEuler(p.spin), _scale.set(s, s, s));
      this.mesh.setMatrixAt(n, _matrix);
      this.mesh.setColorAt(n, p.color);
      n++;
    }
    this.mesh.count = n;
    this.mesh.instanceMatrix.needsUpdate = true;
    this.mesh.instanceColor.needsUpdate = true;
  }
}
