import * as THREE from 'three';
import { Entity } from '../core/Entity.js';

const _forward = new THREE.Vector3();
const COMPLETE_SHOW_SECONDS = 5;

/**
 * Top-right quest panel listing every active quest, with an arrow pointing at the goal of the
 * most recently updated one, plus pop-up "toast" messages. Lives at game.questLog.
 *
 *   game.questLog.set('gems', { title: 'Lost Gems', objective: 'Find 4 gems', target });
 *   game.questLog.complete('gems');
 *   game.questLog.toast('You found a thing!');
 *
 * `target` can be an entity, anything with a `questPosition`, a function returning one, or null.
 */
export class QuestLog extends Entity {
  constructor() {
    super();
    this.panel = document.createElement('div');
    this.panel.className = 'quest hidden';
    this.toastEl = document.createElement('div');
    this.toastEl.className = 'toast hidden';
    document.body.append(this.panel, this.toastEl);

    this.entries = new Map(); // id -> { title, objective, target, el, done }
    this.tracked = null;
    this.toastTimer = 0;
  }

  onAdd(game) {
    game.questLog = this;
  }

  set(id, { title, objective, target = null }) {
    let entry = this.entries.get(id);
    if (!entry) {
      const el = document.createElement('div');
      el.className = 'quest-entry';
      el.innerHTML = `
        <div class="quest-title"></div>
        <div class="quest-objective"></div>
        <div class="quest-direction"><span class="quest-arrow">▲</span><span class="quest-distance"></span></div>`;
      this.panel.append(el);
      entry = { el };
      this.entries.set(id, entry);
    }
    Object.assign(entry, { title, objective, target, done: false });
    entry.el.querySelector('.quest-title').textContent = title;
    entry.el.querySelector('.quest-objective').textContent = objective;
    entry.el.classList.remove('done');
    this.track(id);
  }

  /** Show a quest as finished for a few seconds, then remove it. */
  complete(id) {
    const entry = this.entries.get(id);
    if (!entry) return;
    entry.done = COMPLETE_SHOW_SECONDS;
    entry.target = null;
    entry.el.querySelector('.quest-objective').textContent = 'Quest complete!';
    entry.el.classList.add('done');
    if (this.tracked === id) this.tracked = [...this.entries.keys()].find((k) => !this.entries.get(k).done) ?? null;
  }

  track(id) {
    this.tracked = id;
    this.panel.classList.remove('hidden');
    const el = this.entries.get(id).el;
    el.classList.remove('pop');
    void el.offsetWidth; // restart the pop animation
    el.classList.add('pop');
  }

  toast(text, seconds = 3) {
    this.toastEl.textContent = text;
    this.toastEl.classList.remove('hidden');
    this.toastEl.classList.remove('pop');
    void this.toastEl.offsetWidth;
    this.toastEl.classList.add('pop');
    this.toastTimer = seconds;
  }

  update(dt, game) {
    if (this.toastTimer > 0 && (this.toastTimer -= dt) <= 0) this.toastEl.classList.add('hidden');

    for (const [id, entry] of this.entries) {
      if (entry.done && (entry.done -= dt) <= 0) {
        entry.el.remove();
        this.entries.delete(id);
      }
    }
    this.panel.classList.toggle('hidden', this.entries.size === 0);

    for (const [id, entry] of this.entries) {
      const direction = entry.el.querySelector('.quest-direction');
      entry.el.classList.toggle('tracked', id === this.tracked);
      const target = typeof entry.target === 'function' ? entry.target() : entry.target;
      const to = target?.questPosition ?? target?.object3d?.position;
      const show = id === this.tracked && to && game.player;
      direction.classList.toggle('hidden', !show);
      if (!show) continue;

      // Arrow angle on screen: 0 = straight ahead of the camera, clockwise positive.
      const from = game.player.object3d.position;
      const dx = to.x - from.x;
      const dz = to.z - from.z;
      game.camera.getWorldDirection(_forward);
      const ahead = dx * _forward.x + dz * _forward.z;
      const right = dx * -_forward.z + dz * _forward.x;
      direction.querySelector('.quest-arrow').style.transform = `rotate(${Math.atan2(right, ahead)}rad)`;
      direction.querySelector('.quest-distance').textContent = `${Math.round(Math.hypot(dx, dz))} m`;
    }
  }
}
