import * as THREE from 'three';
import { Monster } from './Monster.js';
import { Shark } from './Shark.js';
import { Eel } from './Eel.js';
import { part } from '../models/character.js';
import { CHARIBDIS, SEA } from '../config.js';

const WAKE_RANGE = 16;
const TEAL = '#1f6f78';
const DARK = '#164f56';
const swirlMaterial = new THREE.MeshLambertMaterial({ color: '#e8fbff', transparent: true, opacity: 0.7, emissive: '#bfe6ff', emissiveIntensity: 0.3 });

/**
 * Charibdis: a giant fish with a huge mouth, covered in eyes, living in the flooded sea cave.
 * It doesn't move or bite. Instead it spins a whirlpool around itself: anyone swimming in it
 * gets pulled round and takes 5 hearts of damage every 3 seconds. The whirlpool runs for
 * 10 seconds, then stops for 30 (your chance to attack!), then Charibdis calls for help
 * (3 sharks or an eel) and starts it again. 15 hits to defeat.
 */
export class Charibdis extends Monster {
  constructor({ x, z }) {
    super({
      x,
      z,
      health: CHARIBDIS.health,
      damage: CHARIBDIS.damage,
      coins: 50,
      radius: 2.4,
      barHeight: 4.2,
      colors: [TEAL, '#ffffff', '#d9293f'],
      aquatic: true,
      touchDamage: false,
    });
    this.awake = false;
    this.whirling = false;
    this.phaseTimer = 0;
    this.tickTimer = CHARIBDIS.tickSeconds;
    this.helpers = [];
    this.buildModel();
    this.buildWhirlpool();
  }

  buildModel() {
    const fish = new THREE.Group();
    this.fish = fish;
    this.body.add(fish);
    part(fish, [3.2, 2.6, 3.0], TEAL, [0, 0.6, -0.2]); // big round body
    part(fish, [2.6, 0.6, 2.4], DARK, [0, 2.0, -0.3]); // hump
    // The huge mouth, wide open, with rows of teeth.
    part(fish, [2.6, 1.7, 0.4], '#3b0d16', [0, 0.45, 1.3]);
    part(fish, [1.6, 0.9, 0.1], '#d9293f', [0, 0.3, 1.52]); // tongue
    for (let i = 0; i < 7; i++) {
      const x = -1.1 + i * 0.37;
      part(fish, [0.18, 0.3, 0.12], '#ffffff', [x, 1.18, 1.55]);
      part(fish, [0.18, 0.3, 0.12], '#ffffff', [x, -0.28, 1.55]);
    }
    part(fish, [3.0, 0.3, 0.5], TEAL, [0, 1.45, 1.2]); // top lip
    part(fish, [3.0, 0.3, 0.5], TEAL, [0, -0.55, 1.2]); // bottom lip
    // Covered in eyes!
    const eyes = [
      [-1.62, 1.0, 0.4, 'x'], [-1.62, 0.2, -0.6, 'x'], [-1.62, 1.4, -1.2, 'x'],
      [1.62, 1.0, 0.4, 'x'], [1.62, 0.2, -0.6, 'x'], [1.62, 1.4, -1.2, 'x'],
      [-0.8, 2.32, 0.4, 'y'], [0.7, 2.32, 0.6, 'y'], [0, 2.32, -0.6, 'y'], [-0.9, 2.32, -1.1, 'y'], [0.9, 2.32, -1.2, 'y'],
      [-0.7, 1.75, 1.42, 'z'], [0.7, 1.75, 1.42, 'z'],
    ];
    this.pupils = [];
    for (const [x, y, z, axis] of eyes) {
      const big = 0.42;
      const thin = 0.08;
      const size = axis === 'x' ? [thin, big, big] : axis === 'y' ? [big, thin, big] : [big, big, thin];
      part(fish, size, '#ffffff', [x, y, z]);
      const out = { x: [Math.sign(x) * 0.05, 0, 0], y: [0, 0.05, 0], z: [0, 0, 0.05] }[axis];
      const pupilSize = size.map((s) => (s === thin ? thin : 0.2));
      this.pupils.push(part(fish, pupilSize, '#1d1d1d', [x + out[0], y + out[1], z + out[2]]));
    }
    // Fins and tail
    for (const side of [-1, 1]) part(fish, [0.9, 0.12, 0.7], DARK, [side * 1.9, 0.2, -0.3]).rotation.z = side * 0.4;
    part(fish, [0.15, 1.0, 1.2], DARK, [0, 2.6, -0.8]); // back fin
    this.tail = new THREE.Group();
    this.tail.position.set(0, 0.6, -1.8);
    fish.add(this.tail);
    part(this.tail, [0.2, 1.8, 1.0], DARK, [0, 0, -0.5]);
  }

  buildWhirlpool() {
    this.whirlpool = new THREE.Group();
    this.rings = [];
    const geo = new THREE.BoxGeometry(0.5, 0.08, 0.18);
    for (let r = 0; r < 4; r++) {
      const ring = new THREE.Group();
      const radius = 2.8 + r * ((CHARIBDIS.whirlpoolRadius - 2.8) / 3);
      const count = 10 + r * 5;
      for (let i = 0; i < count; i++) {
        const a = (i / count) * Math.PI * 2;
        const bit = new THREE.Mesh(geo, swirlMaterial);
        bit.position.set(Math.cos(a) * radius, 0.08 - r * 0.04, Math.sin(a) * radius);
        bit.rotation.y = -a + 0.5; // angled, so it looks like it's swirling inward
        ring.add(bit);
      }
      this.whirlpool.add(ring);
      this.rings.push(ring);
    }
    this.whirlpool.visible = false;
    this.object3d.add(this.whirlpool);
  }

  think() {
    this.velocity.set(0, 0, 0); // Charibdis stays put
  }

  update(dt, game) {
    super.update(dt, game);
    if (this.health <= 0 || game.isUiOpen()) return;
    const player = game.player;
    const pos = this.object3d.position;
    const p = player.object3d.position;
    const dist = Math.hypot(p.x - pos.x, p.z - pos.z);

    if (!this.awake) {
      if (dist < WAKE_RANGE && !player.dead) this.startWhirlpool(game, false);
      return;
    }

    this.phaseTimer -= dt;
    if (this.whirling) {
      if (this.phaseTimer <= 0) this.stopWhirlpool();
      // Pull swimmers round and in, and hurt them every few seconds.
      const inside = player.swimming && !player.dead && dist < CHARIBDIS.whirlpoolRadius;
      if (inside) {
        const ix = (pos.x - p.x) / (dist || 1);
        const iz = (pos.z - p.z) / (dist || 1);
        p.x += (ix * 0.8 - iz * 2) * dt;
        p.z += (iz * 0.8 + ix * 2) * dt;
      }
      this.tickTimer -= dt;
      if (this.tickTimer <= 0) {
        this.tickTimer = CHARIBDIS.tickSeconds;
        if (inside) player.takeDamage(game, this.power, pos.x, pos.z);
      }
    } else if (this.phaseTimer <= 0) {
      this.summonHelpers(game);
      this.startWhirlpool(game, true);
    }
  }

  startWhirlpool(game, announce) {
    this.awake = true;
    this.whirling = true;
    this.phaseTimer = CHARIBDIS.onSeconds;
    this.tickTimer = CHARIBDIS.tickSeconds;
    this.whirlpool.visible = true;
    if (announce) game.questLog?.toast('The whirlpool is back! Swim out of it!');
  }

  stopWhirlpool() {
    this.whirling = false;
    this.phaseTimer = CHARIBDIS.offSeconds;
    this.whirlpool.visible = false;
  }

  /** Before the whirlpool starts again: 3 sharks or 1 eel come to help (up to a limit). */
  summonHelpers(game) {
    this.helpers = this.helpers.filter((h) => game.monsters.includes(h));
    const pos = this.object3d.position;
    const sharks = Math.random() < 0.5;
    const count = Math.min(sharks ? 3 : 1, CHARIBDIS.maxHelpers - this.helpers.length);
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const spot = { x: pos.x + Math.cos(a) * 7, z: pos.z + Math.sin(a) * 7 };
      const helper = game.add(sharks ? new Shark(spot) : new Eel(spot));
      this.helpers.push(helper);
      game.particles?.burst(new THREE.Vector3(spot.x, SEA.level + 0.3, spot.z), { count: 20, colors: ['#ffffff', '#3cc6ea'], speed: 5 });
    }
    if (count > 0) game.questLog?.toast(sharks ? 'Charibdis called its sharks!' : 'Charibdis called an eel!');
  }

  defeat(game) {
    // Its helpers swim off when it's beaten.
    for (const h of this.helpers) {
      if (!game.monsters.includes(h)) continue;
      game.particles?.burst(h.object3d.position.clone().setY(SEA.level + 0.5), { count: 15, colors: ['#ffffff', '#3cc6ea'], speed: 4 });
      game.remove(h);
    }
    super.defeat(game);
  }

  animate(dt, game) {
    const pos = this.object3d.position;
    const p = game.player.object3d.position;
    const turn = Math.atan2(p.x - pos.x, p.z - pos.z) - this.fish.rotation.y;
    this.fish.rotation.y += Math.atan2(Math.sin(turn), Math.cos(turn)) * (1 - Math.exp(-2 * dt));
    this.fish.position.y = Math.sin(game.elapsed * 1.5) * 0.12 - 0.3;
    this.tail.rotation.y = Math.sin(game.elapsed * 3) * 0.4;
    // Eyes look around (twitchy!)
    this.pupils.forEach((pupil, i) => (pupil.visible = Math.sin(game.elapsed * 0.7 + i * 2.3) > -0.95)); // blink
    if (this.whirlpool.visible) {
      this.rings.forEach((ring, i) => (ring.rotation.y -= dt * (2.6 - i * 0.4)));
    }
  }
}
