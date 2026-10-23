import { Entity } from '../core/Entity.js';
import { applyLook, HAIR_STYLES } from '../models/character.js';
import { keyName } from '../controls.js';
import { CUSTOMIZE } from '../config.js';

const STORAGE_KEY = 'bobert-look';

const ROWS = [
  { id: 'skin', label: 'Skin' },
  { id: 'hair', label: 'Hair' },
  { id: 'hairStyle', label: 'Hair style' },
  { id: 'shirt', label: 'Shirt' },
  { id: 'pants', label: 'Trousers' },
  { id: 'shoes', label: 'Shoes' },
];

/** The look the player picked last time in this browser (or Bobert's starting look). */
export function storedLook() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (saved && typeof saved === 'object') return { ...CUSTOMIZE.start, ...saved };
  } catch {
    // nothing saved, or storage blocked
  }
  return null;
}

/**
 * The character customization screen: pick Bobert's skin, hair, hair style, shirt, trousers and
 * shoes. Opens by itself the first time someone plays, and any time with P (or from the pause menu).
 * Changes show on Bobert straight away, the camera swings round to his front while it's open,
 * and the look is remembered in the browser (and in saved games). Lives at game.customizer.
 */
export class Customizer extends Entity {
  constructor() {
    super();
    this.isOpen = false;
    this.look = storedLook() ?? { ...CUSTOMIZE.start };

    this.el = document.createElement('div');
    this.el.className = 'modal customizer hidden';
    this.el.addEventListener('click', (e) => {
      const button = e.target.closest('button');
      if (!button) return;
      if (button.dataset.part) this.set({ [button.dataset.part]: button.dataset.value });
      else if (button.dataset.random) this.randomize();
      else if (button.dataset.reset) this.set({ ...CUSTOMIZE.start });
      else if (button.dataset.done) this.close();
    });
    document.body.append(this.el);
  }

  onAdd(game) {
    this.game = game;
    game.customizer = this;
    game.ui.push(this);
  }

  /** Called once everything is set up: put on the look from last time. */
  start() {
    this.wear(this.look);
  }

  /** Dress Bobert in a look (without remembering it, e.g. from a saved game). */
  wear(look) {
    this.look = { ...CUSTOMIZE.start, ...look };
    applyLook(this.game.player.model, this.look);
    this.game.player.look = this.look;
  }

  /** Change part of the look, show it and remember it. */
  set(changes) {
    this.wear({ ...this.look, ...changes });
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.look));
    } catch {
      // storage blocked: the look lasts for this visit
    }
    this.render();
  }

  randomize() {
    const pick = (list) => list[Math.floor(Math.random() * list.length)];
    this.set({
      skin: pick(CUSTOMIZE.skin),
      hair: pick(CUSTOMIZE.hair),
      hairStyle: pick(Object.keys(HAIR_STYLES)),
      shirt: pick(CUSTOMIZE.shirt),
      pants: pick(CUSTOMIZE.pants),
      shoes: pick(CUSTOMIZE.shoes),
    });
  }

  open() {
    this.isOpen = true;
    this.render();
    this.el.classList.remove('hidden');
    document.body.classList.add('customizing');
  }

  close() {
    this.isOpen = false;
    this.el.classList.add('hidden');
    document.body.classList.remove('customizing');
  }

  render() {
    const options = (row) => {
      if (row.id === 'hairStyle') {
        return Object.entries(HAIR_STYLES)
          .map(([id, s]) => `<button class="style-choice${this.look.hairStyle === id ? ' chosen' : ''}" data-part="hairStyle" data-value="${id}">${s.name}</button>`)
          .join('');
      }
      return CUSTOMIZE[row.id]
        .map((c) => `<button class="swatch${this.look[row.id] === c ? ' chosen' : ''}" style="background:${c}" data-part="${row.id}" data-value="${c}" aria-label="${row.label} ${c}"></button>`)
        .join('');
    };
    this.el.innerHTML = `
      <div class="modal-header"><div class="modal-title">Customize Bobert</div></div>
      <p class="modal-message">Pick how Bobert looks. Change it any time with <kbd>${keyName(this.game.input.bindings.customize[0] ?? 'KeyP')}</kbd> or from the menu.</p>
      ${ROWS.map((row) => `<div class="custom-row"><div class="custom-label">${row.label}</div><div class="custom-options">${options(row)}</div></div>`).join('')}
      <div class="modal-footer">
        <button class="ghost" data-random="1">🎲 Surprise me</button>
        <button class="ghost" data-reset="1">Reset</button>
        <button class="primary" data-done="1">Done</button>
      </div>`;
  }

  update(_dt, game) {
    const { input } = game;
    if (this.isOpen) {
      if (input.wasPressed('Escape', 'Enter', 'NumpadEnter') || input.hit('customize')) this.close();
      return;
    }
    if (this.requestOpen || (input.hit('customize') && !game.isUiOpen())) {
      this.requestOpen = false;
      if (!game.isUiOpen()) this.open();
    }
  }
}
