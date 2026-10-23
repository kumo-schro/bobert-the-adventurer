import * as THREE from 'three';
import { Entity } from '../core/Entity.js';
import { keyName } from '../controls.js';

const _forward = new THREE.Vector3();
const COMPLETE_SHOW_SECONDS = 4;
const MAX_TOASTS = 3;
const LEADING_EMOJI = /^(\p{Extended_Pictographic}[️‍\p{Extended_Pictographic}]*)\s*/u;

/**
 * The quest tracker (top right): the quest you're on, what to do next, and an arrow pointing the
 * way. Tab (or Option / Alt) shows every quest you have. Also pops up "toast" messages at the top
 * of the screen (a few can stack up). Lives at game.questLog.
 *
 *   game.questLog.set('gems', { title: 'Lost Gems', objective: 'Find 4 gems', target });
 *   game.questLog.complete('gems');
 *   game.questLog.toast('You found a thing!', { icon: '💎', seconds: 4 });
 *
 * `target` can be an entity, anything with a `questPosition`, a function returning one, or null.
 */
export class QuestLog extends Entity {
  constructor() {
    super();
    this.panel = document.createElement('div');
    this.panel.className = 'quests hidden';
    this.panel.innerHTML = `
      <div class="quests-head"><span>Quests</span><span class="quests-hint"></span></div>
      <div class="quests-list"></div>`;
    this.list = this.panel.querySelector('.quests-list');
    this.hintEl = this.panel.querySelector('.quests-hint');
    this.toastsEl = document.createElement('div');
    this.toastsEl.className = 'toasts';
    this.bannerEl = document.createElement('div');
    this.bannerEl.className = 'banner hidden';
    document.body.append(this.panel, this.toastsEl, this.bannerEl);

    this.entries = new Map(); // id -> { title, objective, target, el, done }
    this.tracked = null;
    this.toasts = []; // { el, timer }
    this.expanded = false;
  }

  onAdd(game) {
    this.game = game;
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
        <div class="quest-direction"><span class="quest-arrow"><svg viewBox="0 0 20 20"><path d="M10 1 L18 17 L10 13 L2 17 Z"/></svg></span><span class="quest-distance"></span></div>`;
      el.addEventListener('pointerdown', () => this.track(id));
      this.list.prepend(el);
      entry = { el };
      this.entries.set(id, entry);
    }
    const changed = entry.objective !== objective;
    Object.assign(entry, { title, objective, target, done: false });
    entry.el.querySelector('.quest-title').textContent = title;
    entry.el.querySelector('.quest-objective').textContent = objective;
    entry.el.classList.remove('done');
    if (changed) this.track(id);
  }

  /** Show a quest as finished for a few seconds, then remove it. */
  complete(id) {
    const entry = this.entries.get(id);
    if (!entry) return;
    entry.done = COMPLETE_SHOW_SECONDS;
    entry.target = null;
    entry.el.querySelector('.quest-objective').textContent = 'Complete!';
    entry.el.classList.add('done');
    if (this.tracked === id) this.tracked = this.nextQuest(id);
  }

  /** Take a quest off the list without calling it complete (like when you give up). */
  remove(id) {
    const entry = this.entries.get(id);
    if (!entry) return;
    entry.el.remove();
    this.entries.delete(id);
    if (this.tracked === id) this.tracked = this.nextQuest(id);
  }

  nextQuest(except) {
    return [...this.entries.keys()].reverse().find((k) => k !== except && !this.entries.get(k).done) ?? null;
  }

  track(id) {
    this.tracked = id;
    const el = this.entries.get(id).el;
    this.list.prepend(el); // the tracked quest goes to the top
    el.classList.remove('pop');
    void el.offsetWidth; // restart the pop animation
    el.classList.add('pop');
  }

  /**
   * A message at the top of the screen. `options` is { seconds, icon } (or just the seconds).
   * A leading emoji in the text becomes the icon.
   */
  toast(text, options = {}) {
    const { seconds = 3.2, icon: givenIcon } = typeof options === 'number' ? { seconds: options } : options;
    let icon = givenIcon;
    const match = !icon && text.match(LEADING_EMOJI);
    if (match) {
      icon = match[1];
      text = text.slice(match[0].length);
    }
    // The same message again just stays up longer.
    const same = this.toasts.find((t) => t.text === text);
    if (same) {
      same.timer = Math.max(same.timer, seconds);
      same.el.classList.remove('bump');
      void same.el.offsetWidth;
      same.el.classList.add('bump');
      return;
    }
    const el = document.createElement('div');
    el.className = 'toast';
    el.innerHTML = `${icon ? '<span class="toast-icon"></span>' : ''}<span class="toast-text"></span>`;
    if (icon) el.querySelector('.toast-icon').textContent = icon;
    el.querySelector('.toast-text').textContent = text;
    this.toastsEl.append(el);
    this.toasts.push({ el, text, timer: seconds });
    while (this.toasts.length > MAX_TOASTS) this.dismiss(this.toasts[0]);
  }

  /** A big "Quest complete!" banner in the middle of the screen, with what you got. */
  celebrate(title, rewards = []) {
    this.bannerEl.innerHTML = `<div class="banner-kicker">Quest complete</div><div class="banner-title"></div><div class="banner-rewards">${rewards
      .map((r) => `<span class="pill">${r}</span>`)
      .join('')}</div>`;
    this.bannerEl.querySelector('.banner-title').textContent = title;
    this.bannerEl.classList.remove('hidden', 'show');
    void this.bannerEl.offsetWidth;
    this.bannerEl.classList.add('show');
    this.bannerTimer = 3;
  }

  dismiss(toast) {
    this.toasts = this.toasts.filter((t) => t !== toast);
    toast.el.classList.add('leaving');
    setTimeout(() => toast.el.remove(), 250);
  }

  update(dt, game) {
    for (const t of [...this.toasts]) if ((t.timer -= dt) <= 0) this.dismiss(t);
    if (this.bannerTimer > 0 && (this.bannerTimer -= dt) <= 0) this.bannerEl.classList.add('hidden');

    // Tab (or Option / Alt) shows every quest; otherwise just the one you're tracking.
    if (game.input.hit('quests') || game.input.wasPressed('AltLeft', 'AltRight')) this.expanded = !this.expanded;
    this.hintEl.innerHTML = this.entries.size > 1 ? `<kbd>${keyName(game.input.bindings.quests[0] ?? 'Tab')}</kbd> ${this.expanded ? 'less' : `all ${this.entries.size}`}` : '';

    for (const [id, entry] of this.entries) {
      if (entry.done && (entry.done -= dt) <= 0) {
        entry.el.remove();
        this.entries.delete(id);
      }
    }
    if (!this.tracked || !this.entries.has(this.tracked)) this.tracked = this.nextQuest(null);
    const hidden = this.entries.size === 0 || document.body.classList.contains('in-cutscene') || document.body.classList.contains('title-open');
    this.panel.classList.toggle('hidden', hidden);
    this.panel.classList.toggle('expanded', this.expanded);

    for (const [id, entry] of this.entries) {
      const tracked = id === this.tracked;
      entry.el.classList.toggle('tracked', tracked);
      entry.el.classList.toggle('collapsed', !tracked && !this.expanded && !entry.done);
      const direction = entry.el.querySelector('.quest-direction');
      const target = typeof entry.target === 'function' ? entry.target() : entry.target;
      const to = target?.questPosition ?? target?.object3d?.position;
      const show = tracked && to && game.player;
      direction.classList.toggle('hidden', !show);
      if (!show) continue;

      // Arrow angle on screen: 0 = straight ahead of the camera, clockwise positive.
      const from = game.player.object3d.position;
      const dx = to.x - from.x;
      const dz = to.z - from.z;
      game.camera.getWorldDirection(_forward);
      const ahead = dx * _forward.x + dz * _forward.z;
      const right = dx * -_forward.z + dz * _forward.x;
      const distance = Math.round(Math.hypot(dx, dz));
      direction.querySelector('.quest-arrow').style.transform = `rotate(${Math.atan2(right, ahead)}rad)`;
      direction.querySelector('.quest-distance').textContent = distance < 4 ? 'Here!' : `${distance} m`;
    }
  }
}
