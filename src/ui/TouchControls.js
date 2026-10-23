import { Entity } from '../core/Entity.js';
import { icon } from './icons.js';

const STICK_RADIUS = 46; // how far the stick's knob can move (pixels)
const DEAD_ZONE = 0.3;

/**
 * On-screen controls for phones and tablets (only shown on touch screens): a stick on the left to
 * move, and buttons on the right. They press the same keys the keyboard would (the first key of
 * each control), so everything else in the game just works. Drag anywhere else to look around.
 */
export class TouchControls extends Entity {
  constructor() {
    super();
    this.enabled = matchMedia('(pointer: coarse)').matches || new URLSearchParams(location.search).has('touch');
    if (!this.enabled) return;
    document.body.classList.add('touch');
    this.el = document.createElement('div');
    this.el.className = 'touch-controls';
    this.el.innerHTML = `
      <div class="stick"><div class="stick-knob"></div></div>
      <div class="touch-buttons">
        <button data-action="swing" class="big">${icon('sword')}</button>
        <button data-action="jump" class="jump"><span>Jump</span></button>
        <button data-action="dodge" class="roll">${icon('roll')}</button>
        <button data-action="interact" class="talk"><span>Use</span></button>
        <button data-action="shield" class="gear shield">${icon('shield')}</button>
        <button data-action="bow" class="gear bow">${icon('bow')}</button>
        <button data-action="power" class="gear burst">${icon('burst')}</button>
        <button data-action="eat" class="gear food">${icon('apple')}</button>
      </div>
      <button class="touch-pause" data-key="Escape">❚❚</button>`;
    document.body.append(this.el);
    this.stick = this.el.querySelector('.stick');
    this.knob = this.el.querySelector('.stick-knob');
    this.stickPointer = null;
    this.held = new Map(); // pointerId -> key code held by a button
    this.moveKeys = new Set();

    this.stick.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      this.stickPointer = e.pointerId;
      this.stick.setPointerCapture(e.pointerId);
      this.moveStick(e);
    });
    this.stick.addEventListener('pointermove', (e) => e.pointerId === this.stickPointer && this.moveStick(e));
    const endStick = (e) => {
      if (e.pointerId !== this.stickPointer) return;
      this.stickPointer = null;
      this.knob.style.transform = '';
      this.setMove(0, 0);
    };
    this.stick.addEventListener('pointerup', endStick);
    this.stick.addEventListener('pointercancel', endStick);

    for (const button of this.el.querySelectorAll('button')) {
      button.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const code = button.dataset.key ?? this.game?.input.bindings[button.dataset.action]?.[0];
        if (!code) return;
        button.setPointerCapture(e.pointerId);
        button.classList.add('down');
        this.press(code);
        this.held.set(e.pointerId, { code, button });
      });
      const release = (e) => {
        const h = this.held.get(e.pointerId);
        if (!h) return;
        this.held.delete(e.pointerId);
        h.button.classList.remove('down');
        this.release(h.code);
      };
      button.addEventListener('pointerup', release);
      button.addEventListener('pointercancel', release);
    }
  }

  onAdd(game) {
    this.game = game;
  }

  press(code) {
    const input = this.game.input;
    if (!input.keys.has(code)) input.pressed.add(code);
    input.keys.add(code);
  }

  release(code) {
    this.game.input.keys.delete(code);
  }

  moveStick(e) {
    const r = this.stick.getBoundingClientRect();
    let dx = e.clientX - (r.left + r.width / 2);
    let dy = e.clientY - (r.top + r.height / 2);
    const len = Math.hypot(dx, dy);
    if (len > STICK_RADIUS) {
      dx = (dx / len) * STICK_RADIUS;
      dy = (dy / len) * STICK_RADIUS;
    }
    this.knob.style.transform = `translate(${dx}px, ${dy}px)`;
    this.setMove(dx / STICK_RADIUS, dy / STICK_RADIUS);
  }

  /** Hold the move keys that match the stick's direction. */
  setMove(x, y) {
    const b = this.game?.input.bindings;
    if (!b) return;
    const want = new Set();
    if (y < -DEAD_ZONE) want.add(b.forward[0]);
    if (y > DEAD_ZONE) want.add(b.back[0]);
    if (x < -DEAD_ZONE) want.add(b.left[0]);
    if (x > DEAD_ZONE) want.add(b.right[0]);
    for (const code of this.moveKeys) if (!want.has(code)) this.release(code);
    for (const code of want) if (!this.moveKeys.has(code)) this.press(code);
    this.moveKeys = want;
  }

  update(_dt, game) {
    if (!this.enabled) return;
    const p = game.player;
    const hidden = game.isUiOpen() || document.body.classList.contains('title-open');
    this.el.classList.toggle('hidden', hidden);
    this.el.querySelector('.shield').classList.toggle('hidden', !p.hasShield);
    this.el.querySelector('.bow').classList.toggle('hidden', !p.hasBow);
    this.el.querySelector('.burst').classList.toggle('hidden', !p.hasConduit);
    this.el.querySelector('.food').classList.toggle('hidden', !p.food.length);
    this.el.querySelector('.talk').classList.toggle('hidden', document.querySelector('.prompt')?.classList.contains('hidden') ?? true);
  }
}
