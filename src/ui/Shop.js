import { Entity } from '../core/Entity.js';

const NUMBER_KEYS = ['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5', 'Digit6', 'Digit7', 'Digit8', 'Digit9'];

/**
 * A shop menu. Open it with shop.open() (an Npc's onInteract usually does this).
 * Click an item's button, or press its number key. Esc or T closes it.
 *
 *   new Shop({ title: "Blacksmith's Forge", greeting: 'Welcome!', items: (player) => [...] })
 *
 * `items(player)` returns what's for sale right now (see shops.js):
 *   { name, icon, description, price, owned, locked, buy, bought, section }
 *   price:  coins
 *   section: a heading to show above this item (like "Upgrades")
 *   action: true for menu choices that aren't things you buy (like "Sail to the jungle"):
 *           the button shows `buttonLabel` and the menu closes after
 *   owned:  already bought (shows "Owned")
 *   locked: a short reason it can't be bought yet (shown on the button), or null
 *   lockedMessage: what the shopkeeper says if you try anyway (optional)
 *   buy():  give the item to the player
 *   bought: what the shopkeeper says afterward (optional)
 */
export class Shop extends Entity {
  constructor(config) {
    super();
    this.config = config; // { title, greeting, items(player) } (items is called on the config)
    this.title = config.title;
    this.greeting = config.greeting;
    this.el = document.createElement('div');
    this.el.className = 'modal shop hidden';
    document.body.append(this.el);
    this.isOpen = false;
    this.el.addEventListener('pointerdown', (e) => {
      const button = e.target.closest('button');
      if (button?.dataset.index) this.pendingBuy = Number(button.dataset.index);
      if (button?.dataset.close) this.pendingClose = true;
    });
  }

  onAdd(game) {
    game.ui.push(this);
    this.game = game;
  }

  items() {
    return this.config.items(this.game.player);
  }

  open() {
    this.isOpen = true;
    this.openedFrame = true;
    this.message = this.greeting;
    this.mood = '';
    this.render();
    this.el.classList.remove('hidden');
    this.game.sound?.play('open');
  }

  close() {
    this.isOpen = false;
    this.el.classList.add('hidden');
    this.game.sound?.play('close');
  }

  buy(index) {
    const item = this.items()[index];
    const player = this.game.player;
    if (!item || item.owned) return;
    if (item.locked) {
      this.message = item.lockedMessage ?? `Sorry, you can't buy that yet: ${item.locked}.`;
      this.mood = 'no';
      this.game.sound?.play('deny');
    } else if (player.coins < item.price) {
      this.message = `You need ${item.price - player.coins} more coins for that. Monsters, quests and treasure chests all have coins!`;
      this.mood = 'no';
      this.game.sound?.play('deny');
    } else {
      player.coins -= item.price;
      item.buy();
      if (item.action) {
        this.close();
        return;
      }
      this.message = item.bought ?? `Here's your ${item.name}! Use it well.`;
      this.mood = 'yes';
      this.game.sound?.play('buy');
      const article = item.article === 'a' && /^[aeiou]/i.test(item.name) ? 'an' : (item.article ?? 'the');
      this.game.questLog?.toast(`You bought ${article ? `${article} ` : ''}${item.name}!`, { icon: item.icon });
      this.game.particles?.burst(player.object3d.position.clone().setY(player.object3d.position.y + 1.5), {
        count: 30,
        colors: ['#ffc93c', '#ffffff', '#7fc4ff'],
        speed: 5,
        size: 0.14,
      });
    }
    this.render();
  }

  render() {
    const { coins } = this.game.player;
    const button = (item) => {
      if (item.owned) return 'Owned';
      if (item.locked) return item.locked;
      if (item.action) return item.buttonLabel ?? 'Go';
      return `<span class="coin"></span>${item.price}`;
    };
    const anyPrices = this.items().some((item) => !item.action);
    this.el.innerHTML = `
      <div class="modal-header">
        <div class="modal-title">${this.title}</div>
        ${anyPrices ? `<div class="wallet"><span class="coin"></span>${coins}</div>` : ''}
      </div>
      <p class="modal-message ${this.mood}">${this.message}</p>
      <div class="shop-items">
      ${this.items()
        .map(
          (item, i) => `${item.section ? `<div class="shop-section">${item.section}</div>` : ''}
        <div class="shop-item${item.owned ? ' owned' : ''}${item.locked && !item.owned ? ' locked' : ''}">
          <div class="shop-icon">${item.icon}</div>
          <div class="shop-info">
            <div class="shop-name">${item.name}</div>
            <div class="shop-desc">${item.description}</div>
          </div>
          <button data-index="${i}" class="buy${item.action ? ' action' : ''}${!item.action && (coins < item.price || item.locked) ? ' cant-afford' : ''}" ${item.owned ? 'disabled' : ''}>
            <kbd>${i + 1}</kbd>${button(item)}
          </button>
        </div>`,
        )
        .join('')}
      </div>
      <div class="modal-footer"><button class="ghost" data-close="1"><kbd>Esc</kbd> Close</button></div>`;
  }

  update(_dt, game) {
    if (!this.isOpen) return;
    const { input } = game;
    if (this.pendingBuy !== undefined) {
      this.buy(this.pendingBuy);
      this.pendingBuy = undefined;
    }
    NUMBER_KEYS.forEach((code, i) => {
      if (input.wasPressed(code, `Numpad${i + 1}`)) this.buy(i);
    });
    // Ignore T on the frame the shop opened (that same T press opened it).
    const closeKey = input.wasPressed('Escape') || (!this.openedFrame && input.hit('interact'));
    if (this.isOpen && (this.pendingClose || closeKey)) this.close();
    this.pendingClose = false;
    this.openedFrame = false;
  }
}
