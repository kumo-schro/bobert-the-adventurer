import * as THREE from 'three';
import { Entity } from '../core/Entity.js';
import { DROPS } from '../config.js';

const GRAVITY = 22;
const COLLECT_DISTANCE = 0.9;
const GIVE_UP = 8; // seconds: after this, whatever's left is just given to you
let lastJingle = 0;

const coinGeometry = new THREE.BoxGeometry(0.34, 0.34, 0.1);
const coinMaterial = new THREE.MeshLambertMaterial({ color: '#ffc93c', emissive: '#a86b00', emissiveIntensity: 0.35 });
const coinEdge = new THREE.BoxGeometry(0.2, 0.2, 0.12);
const coinEdgeMaterial = new THREE.MeshLambertMaterial({ color: '#ffe8a0', emissive: '#ffcf3f', emissiveIntensity: 0.3 });
const heartMaterial = new THREE.MeshLambertMaterial({ color: '#ff3d63', emissive: '#a3002a', emissiveIntensity: 0.45 });
const heartBox = new THREE.BoxGeometry(1, 1, 1);

/** A chunky red heart (the health pickup). */
function createHeart() {
  const g = new THREE.Group();
  for (const [x, y, w, h] of [
    [-0.1, 0.06, 0.18, 0.18],
    [0.1, 0.06, 0.18, 0.18],
    [0, -0.04, 0.38, 0.14],
    [0, -0.14, 0.24, 0.1],
    [0, -0.22, 0.1, 0.08],
  ]) {
    const m = new THREE.Mesh(heartBox, heartMaterial);
    m.scale.set(w, h, 0.14);
    m.position.set(x, y, 0);
    g.add(m);
  }
  g.scale.setScalar(1.3);
  return g;
}

/**
 * Coins and health that pop out of a defeated monster, bounce, and fly to you: walk close and
 * they come to you, and after a moment they come anyway. Pickup.coins(game, where, amount)
 * scatters a pile of coins worth `amount`.
 */
export class Pickup extends Entity {
  /** Split `amount` coins into a few pieces (at most 8) and scatter them. */
  static coins(game, where, amount) {
    const pieces = Math.min(8, Math.max(1, Math.ceil(amount / 2)));
    for (let i = 0; i < pieces; i++) {
      const value = Math.floor(amount / pieces) + (i < amount % pieces ? 1 : 0);
      if (value > 0) game.add(new Pickup('coin', where, value));
    }
  }

  constructor(kind, where, value) {
    super();
    this.kind = kind; // 'coin' or 'health'
    this.value = value;
    this.age = 0;
    this.object3d.position.copy(where);
    if (kind === 'coin') {
      this.model = new THREE.Mesh(coinGeometry, coinMaterial);
      this.model.add(new THREE.Mesh(coinEdge, coinEdgeMaterial));
    } else {
      this.model = createHeart();
    }
    this.object3d.add(this.model);
    const a = Math.random() * Math.PI * 2;
    const out = kind === 'coin' ? 2 + Math.random() * 2.5 : 1.5;
    this.velocity = new THREE.Vector3(Math.cos(a) * out, 6 + Math.random() * 3, Math.sin(a) * out);
    this.spin = (Math.random() < 0.5 ? -1 : 1) * (5 + Math.random() * 4);
    this.homing = false;
  }

  onAdd(game) {
    // In the sea, things don't fall: they just drift to you.
    const p = this.object3d.position;
    this.inWater = !game.isWalkable(p.x, p.z) && p.y < 0;
    if (this.inWater) this.velocity.multiplyScalar(0.4);
  }

  update(dt, game) {
    this.age += dt;
    const pos = this.object3d.position;
    const player = game.player;
    const target = player.object3d.position.clone().setY(player.object3d.position.y + 1);
    const dist = pos.distanceTo(target);

    if (this.age > GIVE_UP) return this.collect(game);
    if (!player.dead && this.age > 0.35 && (dist < DROPS.magnetRange || this.age > DROPS.autoCollect) && dist < 60) this.homing = true;

    if (this.homing) {
      // Fly to the player, faster and faster.
      const speed = 8 + (this.age - 0.35) * 30;
      const step = Math.min(dist, speed * dt);
      pos.addScaledVector(target.sub(pos).normalize(), step);
      if (dist < COLLECT_DISTANCE) return this.collect(game);
    } else if (this.inWater) {
      this.velocity.multiplyScalar(Math.exp(-3 * dt));
      pos.addScaledVector(this.velocity, dt);
    } else {
      this.velocity.y -= GRAVITY * dt;
      pos.addScaledVector(this.velocity, dt);
      const ground = game.heightAt(pos.x, pos.z) + 0.25;
      if (pos.y < ground) {
        pos.y = ground;
        this.velocity.y = Math.abs(this.velocity.y) * 0.45; // bounce
        this.velocity.x *= 0.6;
        this.velocity.z *= 0.6;
      }
    }
    this.model.rotation.y += this.spin * dt;
    if (this.kind === 'health') this.model.position.y = Math.sin(this.age * 5) * 0.08;
  }

  collect(game) {
    game.remove(this);
    const player = game.player;
    if (this.kind === 'coin') {
      player.coins += this.value;
      // A pile of coins arriving together jingles, rather than playing eight sounds at once.
      const now = performance.now();
      if (now - lastJingle > 70) {
        lastJingle = now;
        game.sound?.play('coin', { volume: 0.6 });
      }
      game.statusBar?.coinPop();
    } else {
      player.heal(this.value);
      game.sound?.play('heart');
    }
  }
}
