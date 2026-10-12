import { Entity } from '../core/Entity.js';

const NUMBER_KEYS = ['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5', 'Digit6', 'Digit7', 'Digit8', 'Digit9'];

/**
 * A shop menu. Open it with shop.open() (an Npc's onInteract usually does this).
 * Click Buy, or press the item's number key. Esc or T closes it.
 *
 *   new Shop({ title: "Blacksmith's Forge", greeting: 'Welcome!', items: (player) => [...] })
 *
 * `items(player)` returns what's for sale right now (see shops.js):
 *   { name, icon, description, price, wood, stone, owned, locked, buy, bought, section }
 *   price / wood / stone: what it costs (wood and stone are optional, for upgrades)
 *   section: a heading to show above this item (like "Upgrades")
 *   currency: 'coins' (default) or 'dreamPoints'
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
    this.el.className = 'shop hidden';
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
    this.render();
    this.el.classList.remove('hidden');
  }

  close() {
    this.isOpen = false;
    this.el.classList.add('hidden');
  }

  buy(index) {
    const item = this.items()[index];
    const player = this.game.player;
    if (!item || item.owned) return;
    if (item.locked) {
      this.message = item.lockedMessage ?? `Sorry, you can't buy that yet: ${item.locked}.`;
    } else if (player[item.currency ?? 'coins'] < item.price) {
      const have = player[item.currency ?? 'coins'];
      this.message =
        item.currency === 'dreamPoints'
          ? `You need ${item.price - have} more dream points. Do the Dream Keeper's quests to earn them!`
          : `You need ${item.price - have} more coins for that. Try quests and treasure chests!`;
    } else if (player.wood < (item.wood ?? 0) || player.stone < (item.stone ?? 0)) {
      const need = [];
      if (player.wood < item.wood) need.push(`${item.wood - player.wood} more wood (chop trees with an axe)`);
      if (player.stone < item.stone) need.push(`${item.stone - player.stone} more stone (mine boulders with a pickaxe)`);
      this.message = `You need ${need.join(' and ')}.`;
    } else {
      player[item.currency ?? 'coins'] -= item.price;
      player.wood -= item.wood ?? 0;
      player.stone -= item.stone ?? 0;
      item.buy();
      if (item.action) {
        this.close();
        return;
      }
      this.message = item.bought ?? `Here's your ${item.name}! Use it well.`;
      const article = item.article === 'a' && /^[aeiou]/i.test(item.name) ? 'an' : (item.article ?? 'the');
      this.game.questLog?.toast(`You bought ${article ? `${article} ` : ''}${item.name}!`);
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
    const { coins, wood, stone, dreamPoints } = this.game.player;
    const cost = (item) => {
      if (item.action) return item.buttonLabel ?? 'Go';
      let text = item.currency === 'dreamPoints' ? `${item.price} ✨` : `${item.price} coins`;
      if (!item.price && (item.wood || item.stone)) text = '';
      if (item.wood) text += `${text ? ' + ' : ''}${item.wood} 🪵`;
      if (item.stone) text += `${text ? ' + ' : ''}${item.stone} 🪨`;
      return text;
    };
    const button = (item) => {
      if (item.owned) return 'Owned';
      if (item.locked) return item.locked;
      return cost(item);
    };
    const wallet = { coins, dreamPoints };
    const affordable = (item) =>
      wallet[item.currency ?? 'coins'] >= item.price && wood >= (item.wood ?? 0) && stone >= (item.stone ?? 0);
    this.el.innerHTML = `
      <div class="shop-header">
        <div class="shop-title">${this.title}</div>
        <div class="shop-coins">${
          this.config.showDreamPoints ? `✨ ${dreamPoints}` : `<span class="coin"></span>${coins} &nbsp;🪵 ${wood} &nbsp;🪨 ${stone}`
        }</div>
      </div>
      <p class="shop-message">${this.message}</p>
      ${this.items()
        .map(
          (item, i) => `${item.section ? `<div class="shop-section">${item.section}</div>` : ''}
        <div class="shop-item${item.owned ? ' owned' : ''}">
          <div class="shop-icon">${item.icon}</div>
          <div class="shop-info">
            <div class="shop-name"><kbd>${i + 1}</kbd> ${item.name}</div>
            <div class="shop-desc">${item.description}</div>
          </div>
          <button data-index="${i}" class="${!affordable(item) || item.locked ? 'cant-afford' : ''}" ${item.owned ? 'disabled' : ''}>
            ${button(item)}
          </button>
        </div>`,
        )
        .join('')}
      <button class="shop-close" data-close="1">Close (Esc)</button>`;
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
    if (this.pendingClose || closeKey) this.close();
    this.pendingClose = false;
    this.openedFrame = false;
  }
}
