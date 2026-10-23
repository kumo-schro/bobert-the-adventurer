import { Entity } from '../core/Entity.js';
import { ACTIONS, RESERVED, keyName } from '../controls.js';

/**
 * The controls menu: click a control and press a new key for it. Changed keys are saved in the
 * browser. Opens from the pause menu, or with Ctrl or Command. Lives at game.controlsMenu.
 */
const MENU_OPENERS = ['MetaLeft', 'MetaRight', 'ControlLeft', 'ControlRight'];

export class ControlsMenu extends Entity {
  constructor() {
    super();
    this.isOpen = false;
    this.waitingFor = null; // action id waiting for a new key
    this.el = document.createElement('div');
    this.el.className = 'modal controls-menu hidden';
    document.body.append(this.el);
    this.el.addEventListener('pointerdown', (e) => {
      const button = e.target.closest('button');
      if (!button) return;
      if (button.dataset.action) this.waitingFor = button.dataset.action;
      if (button.dataset.reset) this.pendingReset = true;
      if (button.dataset.close) this.pendingClose = true;
      this.dirty = true;
    });
  }

  onAdd(game) {
    this.game = game;
    game.controlsMenu = this;
    game.ui.push(this);
  }

  open() {
    this.isOpen = true;
    this.waitingFor = null;
    this.dirty = true;
    this.el.classList.remove('hidden');
  }

  close() {
    this.isOpen = false;
    this.waitingFor = null;
    this.el.classList.add('hidden');
  }

  render() {
    const { bindings } = this.game.input;
    this.el.innerHTML = `
      <div class="modal-header"><div class="modal-title">Controls</div></div>
      <p class="modal-message">${
        this.waitingFor
          ? `Press the new key for <b>${ACTIONS.find((a) => a.id === this.waitingFor).label}</b>...`
          : 'Click a control, then press the key you want for it.'
      }</p>
      <div class="controls-list">
        ${ACTIONS.map(
          (a) => `
          <button class="control-row${this.waitingFor === a.id ? ' waiting' : ''}" data-action="${a.id}">
            <span>${a.label}</span>
            <span class="control-keys">${this.waitingFor === a.id ? '...' : bindings[a.id].map((k) => `<kbd>${keyName(k)}</kbd>`).join(' ')}</span>
          </button>`,
        ).join('')}
      </div>
      <div class="modal-footer">
        <button class="ghost" data-reset="1">Reset to default</button>
        <button class="primary" data-close="1">Done</button>
      </div>`;
  }

  update(_dt, game) {
    const { input } = game;
    if (!this.isOpen) {
      if (input.wasPressed(...MENU_OPENERS) && !game.isUiOpen()) this.open();
    } else {
      if (this.waitingFor) {
        const code = [...input.pressed].find((c) => !RESERVED.has(c));
        if (code) {
          input.rebind(this.waitingFor, code);
          this.waitingFor = null;
          this.dirty = true;
        } else if (input.wasPressed('Escape')) {
          this.waitingFor = null;
          this.dirty = true;
        }
      } else if (input.wasPressed('Escape', ...MENU_OPENERS) || this.pendingClose) {
        this.close();
      }
      if (this.pendingReset) {
        input.resetBindings(Object.fromEntries(ACTIONS.map((a) => [a.id, [...a.keys]])));
      }
    }
    this.pendingClose = this.pendingReset = false;
    if (this.isOpen && this.dirty) {
      this.dirty = false;
      this.render();
    }
  }
}
