import { loadBindings, saveBindings } from '../controls.js';

const BLOCKED_KEYS = new Set(['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab']);

/**
 * Keyboard + pointer state. Read it from entity update() methods via game.input.
 * Game controls go through named actions (see controls.js) so players can change their keys:
 *   held('shield'), hit('swing'), axisOf('left', 'right')
 * isDown / wasPressed check raw key codes (for menus).
 */
export class Input {
  constructor(element) {
    this.bindings = loadBindings();
    this.keys = new Set();
    this.pressed = new Set(); // keys that went down this frame
    this.drag = { dx: 0, dy: 0, active: false };
    this.wheel = 0;
    this.clicked = false; // a click (press + release without dragging) on the canvas this frame

    let lastX = 0;
    let lastY = 0;
    let downX = 0;
    let downY = 0;

    // Typing in a text box (like the suggestion box) shouldn't move the player.
    const typing = (e) => e.target instanceof HTMLElement && e.target.closest('input, textarea');
    window.addEventListener('keydown', (e) => {
      if (typing(e)) return;
      if (BLOCKED_KEYS.has(e.code)) e.preventDefault();
      if (!this.keys.has(e.code)) this.pressed.add(e.code);
      this.keys.add(e.code);
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => this.keys.clear());

    // Right-click drag looks around too, so don't pop up the browser menu.
    element.addEventListener('contextmenu', (e) => e.preventDefault());
    element.addEventListener('pointerdown', (e) => {
      this.drag.active = true;
      this.drag.button = e.button;
      lastX = downX = e.clientX;
      lastY = downY = e.clientY;
      element.setPointerCapture(e.pointerId);
    });
    element.addEventListener('pointermove', (e) => {
      if (!this.drag.active) return;
      this.drag.dx += e.clientX - lastX;
      this.drag.dy += e.clientY - lastY;
      lastX = e.clientX;
      lastY = e.clientY;
    });
    const endDrag = () => (this.drag.active = false);
    element.addEventListener('pointerup', (e) => {
      // Only a left click counts as a click (it swings the sword); other buttons just look around.
      if (this.drag.active && this.drag.button === 0 && Math.hypot(e.clientX - downX, e.clientY - downY) < 6) {
        this.clicked = true;
        this.clickX = e.clientX; // where on the screen (for picking things to suggest changes to)
        this.clickY = e.clientY;
      }
      endDrag();
    });
    element.addEventListener('pointercancel', endDrag);
    element.addEventListener(
      'wheel',
      (e) => {
        e.preventDefault();
        this.wheel += e.deltaY;
      },
      { passive: false },
    );
  }

  /** Is the key for this action held down? */
  held(action) {
    return this.isDown(...this.bindings[action]);
  }

  /** Was the key for this action pressed this frame? */
  hit(action) {
    return this.wasPressed(...this.bindings[action]);
  }

  /** -1, 0 or 1 from two actions (like 'left' and 'right'). */
  axisOf(negative, positive) {
    return (this.held(positive) ? 1 : 0) - (this.held(negative) ? 1 : 0);
  }

  /** Give an action a new key (taking it away from any other action that used it). */
  rebind(action, code) {
    for (const [id, keys] of Object.entries(this.bindings)) {
      if (id !== action && keys.includes(code)) this.bindings[id] = keys.filter((k) => k !== code);
    }
    this.bindings[action] = [code];
    saveBindings(this.bindings);
  }

  resetBindings(defaults) {
    this.bindings = defaults;
    saveBindings(this.bindings);
  }

  isDown(...codes) {
    return codes.some((c) => this.keys.has(c));
  }

  wasPressed(...codes) {
    return codes.some((c) => this.pressed.has(c));
  }

  /** -1, 0 or 1 depending on which of two key groups is held. */
  axis(negative, positive) {
    return (this.isDown(...positive) ? 1 : 0) - (this.isDown(...negative) ? 1 : 0);
  }

  endFrame() {
    this.pressed.clear();
    this.drag.dx = 0;
    this.drag.dy = 0;
    this.wheel = 0;
    this.clicked = false;
  }
}
