import * as THREE from 'three';
import { Monster } from './Monster.js';
import { part } from '../models/character.js';
import { createArtifact } from '../models/gear.js';
import { QUEST } from '../config.js';

const HOP_SPEED = 3.2; // slowed down so slimes are easier to dodge

/**
 * A wobbly jelly cube that hops around its home and chases the player.
 * `size` 0.7 is the Gelationus Slime; the little blue slimes are ~0.38.
 * With `artifact: true` the stolen artifact is stuck inside it.
 */
export class Slime extends Monster {
  constructor({ x, z }, { size = 1, color = '#5fe36a', glow = '#2a8f30', health = 2, artifact = false, chaseRange = 12 } = {}) {
    super({
      x,
      z,
      health,
      radius: 1.3 * size,
      barHeight: 3.1 * size,
      hitSound: 'squish',
      colors: [color, '#ffffff', glow],
    });
    this.size = size;
    this.chaseRange = chaseRange;
    this.hopTimer = 1;
    this.squash = 0;
    this.buildModel(color, glow, artifact);
  }

  /** The Gelationus Slime from the merchant's quest: big, tough, and carrying the artifact. */
  static boss(position) {
    return new Slime(position, { size: 0.7, health: QUEST.slimeHealth, artifact: true, chaseRange: 11 });
  }

  buildModel(color, glow, hasArtifact) {
    // `shape` is scaled for squash & stretch; it pivots at the slime's feet.
    this.shape = new THREE.Group();
    this.shape.scale.setScalar(this.size);
    this.body.add(this.shape);

    const jelly = new THREE.MeshLambertMaterial({ color, transparent: true, opacity: 0.6, emissive: glow, emissiveIntensity: 0.35 });
    const jellyBox = (size, pos) => {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), jelly);
      mesh.position.set(...pos);
      mesh.castShadow = true;
      this.shape.add(mesh);
    };
    jellyBox([2.4, 1.9, 2.4], [0, 0.95, 0]);
    jellyBox([1.8, 0.45, 1.8], [0, 2.12, 0]);
    for (const [x, z] of [[1.25, 0.6], [-1.25, -0.4], [0.3, 1.25], [-0.7, -1.25]]) {
      jellyBox([0.35, 0.3, 0.35], [x, 0.15, z]); // gooey drips
    }

    // Face
    const dark = new THREE.Color(glow).offsetHSL(0, 0, -0.1).getStyle();
    for (const side of [-1, 1]) {
      part(this.shape, [0.46, 0.52, 0.06], '#ffffff', [side * 0.5, 1.35, 1.23]);
      part(this.shape, [0.22, 0.3, 0.06], '#1d1d1d', [side * 0.45, 1.3, 1.27]);
      part(this.shape, [0.08, 0.08, 0.04], '#ffffff', [side * 0.4, 1.38, 1.31]);
      part(this.shape, [0.5, 0.1, 0.06], dark, [side * 0.5, 1.7, 1.23]).rotation.z = side * 0.25; // angry brows
    }
    part(this.shape, [0.7, 0.14, 0.06], dark, [0, 0.78, 1.23]);

    if (hasArtifact) {
      this.artifact = createArtifact(); // visible through the jelly
      this.artifact.position.set(0, 0.55, 0);
      this.shape.add(this.artifact);
    }
  }

  think(dt, game, toPlayer) {
    this.hopTimer -= dt;
    if (!this.onGround || this.hopTimer > 0) return;

    const chasing = this.chasing(toPlayer, this.chaseRange, !game.player.swimming);
    let dirX;
    let dirZ;
    if (chasing) {
      dirX = toPlayer.x;
      dirZ = toPlayer.z;
    } else {
      const pos = this.object3d.position;
      const hx = this.home.x - pos.x;
      const hz = this.home.z - pos.z;
      const homeDist = Math.hypot(hx, hz);
      const a = Math.random() * Math.PI * 2;
      dirX = homeDist > 4 ? hx / homeDist : Math.cos(a) * 0.5;
      dirZ = homeDist > 4 ? hz / homeDist : Math.sin(a) * 0.5;
    }
    const speed = HOP_SPEED * (0.6 + this.size * 0.4);
    this.velocity.set(dirX * speed, 8 * (0.7 + this.size * 0.3), dirZ * speed);
    this.onGround = false;
    this.hopTimer = chasing ? 1 : 2.4;
  }

  landed() {
    this.squash = 0.35; // splat!
  }

  hit(game, toPlayer, damage) {
    this.squash = 0.45;
    this.hopTimer = 0.9;
    super.hit(game, toPlayer, damage);
  }

  animate(dt, game) {
    const pos = this.object3d.position;
    const p = game.player.object3d.position;
    const turn = Math.atan2(p.x - pos.x, p.z - pos.z) - this.body.rotation.y;
    this.body.rotation.y += Math.atan2(Math.sin(turn), Math.cos(turn)) * (1 - Math.exp(-6 * dt));

    this.squash *= Math.exp(-6 * dt);
    const sy = this.onGround ? 1 - this.squash + Math.sin(game.elapsed * 4) * 0.04 : 1.12;
    const sxz = 1 / Math.sqrt(sy);
    this.body.scale.set(sxz, sy, sxz);
    if (this.artifact) this.artifact.rotation.y += dt;
  }
}
