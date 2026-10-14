import { Entity } from '../core/Entity.js';
import { listSaves, saveGame, deleteSave, loadSave, canLoad, applyPendingLoad } from '../saves.js';

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

/** "5 minutes ago", "Yesterday", "Oct 12" */
function when(iso) {
  const minutes = (Date.now() - new Date(iso)) / 60000;
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${Math.floor(minutes)} minute${minutes < 2 ? '' : 's'} ago`;
  if (minutes < 60 * 24) return `${Math.floor(minutes / 60)} hour${minutes < 120 ? '' : 's'} ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

/**
 * Saved games: press Esc (or click 💾) to name and save your adventure, or load / delete a save.
 * Saves live in this browser (see saves.js). Lives at game.saveMenu.
 */
export class SaveMenu extends Entity {
  constructor() {
    super();
    this.isOpen = false;
    this.confirming = null; // { id, action } waiting for a second click

    this.button = document.createElement('button');
    this.button.className = 'save-button';
    this.button.textContent = '💾 Save (Esc)';
    this.button.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      this.requestOpen = true;
    });

    this.el = document.createElement('div');
    this.el.className = 'shop save-menu hidden';
    this.el.innerHTML = `
      <div class="shop-header"><div class="shop-title">💾 Saved games</div></div>
      <p class="shop-message save-message"></p>
      <form class="save-new">
        <input class="save-name" maxlength="30" placeholder="Name your save (like: Bobert's big adventure)" />
        <button type="submit">Save</button>
      </form>
      <div class="save-list"></div>
      <button class="shop-close" data-close="1">Close (Esc)</button>`;
    this.messageEl = this.el.querySelector('.save-message');
    this.nameEl = this.el.querySelector('.save-name');
    this.listEl = this.el.querySelector('.save-list');
    this.el.querySelector('form').addEventListener('submit', (e) => {
      e.preventDefault();
      this.save();
    });
    this.el.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') this.close();
    });
    this.el.addEventListener('click', (e) => {
      const button = e.target.closest('button');
      if (button?.dataset.close) this.close();
      else if (button?.dataset.load) this.confirm(button.dataset.load, 'load');
      else if (button?.dataset.delete) this.confirm(button.dataset.delete, 'delete');
    });
    document.body.append(this.button, this.el);
  }

  onAdd(game) {
    this.game = game;
    game.saveMenu = this;
    game.ui.push(this);
  }

  /** Called once everything is set up: load the save picked before the page reloaded. */
  start() {
    const save = applyPendingLoad(this.game);
    if (save) this.game.questLog.toast(`Loaded “${save.name}”`);
    return save;
  }

  open() {
    this.isOpen = true;
    this.confirming = null;
    this.nameEl.value = listSaves().find(canLoad)?.name ?? '';
    this.show(this.game.player.dead ? "You can save once you're back on your feet." : 'Type a name and press Save. Using the same name again saves over it.');
    this.el.classList.remove('hidden');
    this.nameEl.focus();
    this.nameEl.select();
  }

  close() {
    this.isOpen = false;
    this.el.classList.add('hidden');
    this.nameEl.blur();
  }

  show(message) {
    this.messageEl.textContent = message;
    this.renderList();
  }

  save() {
    const name = this.nameEl.value.trim();
    if (!name) return this.show('Give your save a name first.');
    if (this.game.player.dead) return this.show("You can save once you're back on your feet.");
    const replacing = listSaves().some((s) => s.name.toLowerCase() === name.toLowerCase());
    try {
      saveGame(this.game, name);
    } catch {
      return this.show("Couldn't save: this browser isn't letting the game store anything.");
    }
    this.close();
    this.game.questLog.toast(replacing ? `Saved over “${name}” 💾` : `Saved “${name}” 💾`);
  }

  /** Loading and deleting take two clicks, so nothing's lost by accident. */
  confirm(id, action) {
    if (this.confirming?.id !== id || this.confirming.action !== action) {
      this.confirming = { id, action };
      return this.renderList();
    }
    this.confirming = null;
    if (action === 'load') loadSave(id); // the page reloads
    else {
      deleteSave(id);
      this.show('Deleted.');
    }
  }

  renderList() {
    const saves = listSaves();
    if (!saves.length) {
      this.listEl.innerHTML = '<p class="shop-desc">No saved games yet.</p>';
      return;
    }
    const sure = (id, action) => this.confirming?.id === id && this.confirming.action === action;
    this.listEl.innerHTML = saves
      .map((s) => {
        const ok = canLoad(s);
        return `
        <div class="shop-item save-row${ok ? '' : ' obsolete'}">
          <div class="shop-info">
            <div class="shop-name">${esc(s.name)}</div>
            <div class="shop-desc">${ok ? `${esc(s.summary)} · ${when(s.savedAt)}` : 'Made with an older version of the game, so it can’t be loaded.'}</div>
          </div>
          ${ok ? `<button data-load="${s.id}">${sure(s.id, 'load') ? 'Sure? Load' : 'Load'}</button>` : ''}
          <button class="save-delete" data-delete="${s.id}">${sure(s.id, 'delete') ? 'Sure? Delete' : 'Delete'}</button>
        </div>`;
      })
      .join('');
    if (this.confirming?.action === 'load') this.messageEl.textContent = 'Anything you haven’t saved yet will be lost. Click again to load.';
    if (this.confirming?.action === 'delete') this.messageEl.textContent = 'Click again to delete it for good.';
  }

  update(_dt, game) {
    const { input } = game;
    const uiWasOpen = this.uiWasOpen; // so the Esc that closes another menu doesn't open this one
    this.uiWasOpen = game.isUiOpen();
    if (this.isOpen) {
      if (input.wasPressed('Escape')) this.close();
      return;
    }
    if (this.requestOpen || (input.wasPressed('Escape') && !uiWasOpen && !game.isUiOpen())) {
      this.requestOpen = false;
      if (!game.isUiOpen()) this.open();
    }
  }
}
