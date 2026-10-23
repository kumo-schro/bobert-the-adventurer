import * as THREE from 'three';
import { Entity } from '../core/Entity.js';

const LIFE = { damage: 0.8, big: 1, perfect: 1.1, alert: 0.9 };
const _v = new THREE.Vector3();

/**
 * Little numbers and words that pop out of things in the world and float up: the damage a hit
 * does, "Perfect!" after a Perfect Dodge, a "!" when a monster spots you.
 * game.floatText(position, text, kind) where kind is 'damage', 'big', 'perfect' or 'alert'.
 */
export class FloatingText extends Entity {
  constructor() {
    super();
    this.layer = document.createElement('div');
    this.layer.className = 'float-layer';
    document.body.append(this.layer);
    this.items = [];
  }

  onAdd(game) {
    game.floatText = (position, text, kind = 'damage') => this.spawn(position, text, kind);
  }

  spawn(position, text, kind) {
    const el = document.createElement('div');
    el.className = `float-text ${kind}`;
    el.textContent = text;
    this.layer.append(el);
    // A little sideways scatter, so several hits in a row don't stack exactly.
    const drift = (Math.random() - 0.5) * 0.8;
    this.items.push({ el, pos: position.clone().add(new THREE.Vector3(drift, 0, drift)), age: 0, life: LIFE[kind] ?? 0.8 });
    if (this.items.length > 24) this.remove(this.items[0]);
  }

  remove(item) {
    item.el.remove();
    this.items = this.items.filter((i) => i !== item);
  }

  update(dt, game) {
    const w = this.layer.clientWidth;
    const h = this.layer.clientHeight;
    for (const item of [...this.items]) {
      item.age += dt;
      if (item.age >= item.life) {
        this.remove(item);
        continue;
      }
      const t = item.age / item.life;
      item.pos.y += dt * (1.6 - t * 1.2);
      _v.copy(item.pos).project(game.camera);
      const visible = _v.z < 1;
      item.el.style.display = visible ? '' : 'none';
      if (!visible) continue;
      const pop = t < 0.15 ? 0.6 + (t / 0.15) * 0.6 : 1.2 - Math.min(0.2, (t - 0.15) * 0.5);
      item.el.style.transform = `translate(${((_v.x + 1) / 2) * w}px, ${((1 - _v.y) / 2) * h}px) translate(-50%, -50%) scale(${pop})`;
      item.el.style.opacity = t > 0.7 ? String(1 - (t - 0.7) / 0.3) : '1';
    }
  }
}
