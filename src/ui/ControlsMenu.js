import { Entity } from '../core/Entity.js';
import { ACTIONS, RESERVED, keyName } from '../controls.js';

/**
 * Two small bits of UI:
 *  - Option shows / hides the quest panel and the controls list (hidden to start with).
 *  - Command opens the controls menu, where you click a control and press a new key for it.
 * Changed keys are saved in the browser. Lives at game.controlsMenu.
 */
export class ControlsMenu extends Entity {
  constructor() {
    super();
    this.isOpen = false;
    this.waitingFor = null; // action id waiting for a new key
    this.el = document.createElement('div');
    this.el.className = 'shop controls-menu hidden';
    this.hint = document.createElement('div');
    this.hint.className = 'menu-hint';
    this.hint.innerHTML = '<kbd>Option</kbd> quests &amp; controls &nbsp; <kbd>Command</kbd> change keys';
    document.body.append(this.el, this.hint);
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
    this.renderHud();
  }

  /** The list of controls in the corner panel (shown with Option). */
  renderHud() {
    const list = document.querySelector('#hud ul');
    if (!list) return;
    const keys = (id) => keyName(this.game.input.bindings[id][0] ?? '?'); // just the main key, to keep it short
    const rows = [
      [`${keys('forward')} ${keys('left')} ${keys('back')} ${keys('right')}`, 'move / swim'],
      [keys('jump'), 'jump'],
      [keys('run'), 'run'],
      [keys('swing'), 'swing sword'],
      [keys('shield'), 'hold to block'],
      [keys('bow'), 'shoot bow (hold to charge a power bow)'],
      [keys('eat'), 'eat food'],
      [keys('interact'), 'talk / open / chop / mine'],
      ['Drag', 'look around'],
      [`${keys('camLeft')} ${keys('camRight')}`, 'turn camera'],
      [`${keys('tiltUp')} ${keys('tiltDown')}`, 'tilt camera'],
      [keys('camBehind'), 'camera behind you'],
      ['Scroll', 'zoom'],
    ];
    list.innerHTML = rows.map(([k, what]) => `<li><kbd>${k}</kbd> ${what}</li>`).join('');
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
      <div class="shop-header"><div class="shop-title">Controls</div></div>
      <p class="shop-message">${
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
      <div class="controls-buttons">
        <button class="shop-close" data-reset="1">Reset to default</button>
        <button class="shop-close" data-close="1">Done (Esc)</button>
      </div>`;
  }

  update(_dt, game) {
    const { input } = game;
    if (input.wasPressed('AltLeft', 'AltRight')) document.body.classList.toggle('show-panels');

    if (!this.isOpen) {
      if (input.wasPressed('MetaLeft', 'MetaRight') && !game.isUiOpen()) this.open();
    } else {
      if (this.waitingFor) {
        const code = [...input.pressed].find((c) => !RESERVED.has(c));
        if (code) {
          input.rebind(this.waitingFor, code);
          this.waitingFor = null;
          this.dirty = true;
          this.renderHud();
        } else if (input.wasPressed('Escape')) {
          this.waitingFor = null;
          this.dirty = true;
        }
      } else if (input.wasPressed('Escape', 'MetaLeft', 'MetaRight') || this.pendingClose) {
        this.close();
      }
      if (this.pendingReset) {
        input.resetBindings(Object.fromEntries(ACTIONS.map((a) => [a.id, [...a.keys]])));
        this.renderHud();
      }
    }
    this.pendingClose = this.pendingReset = false;
    if (this.isOpen && this.dirty) {
      this.dirty = false;
      this.render();
    }
  }
}
