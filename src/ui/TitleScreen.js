import { Entity } from '../core/Entity.js';
import { listSaves, canLoad, loadSave } from '../saves.js';

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

/**
 * The title screen, shown when the game opens: Continue (your newest saved game), a new
 * adventure, or pick a saved game. The camera drifts slowly round the village behind it.
 * Lives at game.titleScreen.
 */
export class TitleScreen extends Entity {
  constructor() {
    super();
    this.isOpen = false;
    this.el = document.createElement('div');
    this.el.className = 'title hidden';
    this.el.addEventListener('click', (e) => {
      const button = e.target.closest('button');
      if (button?.dataset.choice) this.pending = button.dataset.choice;
    });
    document.body.append(this.el);
  }

  onAdd(game) {
    this.game = game;
    game.titleScreen = this;
    game.ui.push(this);
  }

  /** Show the title. `onNew` runs when a new adventure starts. */
  open({ onNew }) {
    this.onNew = onNew;
    this.isOpen = true;
    this.waitingForSaveMenu = false;
    const latest = listSaves().find(canLoad);
    this.latest = latest;
    this.el.innerHTML = `
      <div class="title-inner">
        <div class="title-logo">
          <div class="title-small">The legend of</div>
          <div class="title-big">Bobert</div>
          <div class="title-sub">the Adventurer</div>
        </div>
        <div class="title-buttons">
          ${latest ? `<button class="primary" data-choice="continue">Continue<small>${esc(latest.name)}</small></button>` : ''}
          <button class="${latest ? '' : 'primary'}" data-choice="new">New adventure</button>
          ${latest ? '<button data-choice="load">Load a saved game</button>' : ''}
        </div>
        <div class="title-hint">Press <kbd>Enter</kbd> to ${latest ? 'continue' : 'start'}</div>
      </div>`;
    this.el.classList.remove('hidden');
    document.body.classList.add('title-open');
  }

  close() {
    this.isOpen = false;
    this.el.classList.add('leaving');
    document.body.classList.remove('title-open');
    setTimeout(() => this.el.classList.add('hidden'), 600);
  }

  choose(choice) {
    const game = this.game;
    game.sound?.play('click');
    if (choice === 'continue' && this.latest) {
      this.el.classList.add('loading');
      loadSave(this.latest.id); // the page reloads into the saved game
    } else if (choice === 'new') {
      this.close();
      this.onNew?.();
    } else if (choice === 'load') {
      // The saved games list, on top of the title; Back comes back here.
      this.isOpen = false;
      this.waitingForSaveMenu = true;
      game.saveMenu.open({ loadOnly: true });
    }
  }

  update(_dt, game) {
    if (this.waitingForSaveMenu && !game.saveMenu.isOpen) {
      this.waitingForSaveMenu = false;
      this.isOpen = true;
    }
    if (!this.isOpen) return;
    if (this.pending) this.choose(this.pending);
    else if (game.input.wasPressed('Enter', 'NumpadEnter', 'Space')) this.choose(this.latest ? 'continue' : 'new');
    this.pending = null;
  }
}
