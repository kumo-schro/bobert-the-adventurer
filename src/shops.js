// What each shop sells. Each function gets the player and returns the items for the Shop menu
// (see ui/Shop.js for the fields). Add a new item by adding an entry to a list.

import { SWORDS, FORGE, FOOD, BOW } from './config.js';
import { BLACKSMITH, BAKER } from './story.js';

const U = FORGE.upgrades;

export const FORGE_SHOP = {
  title: `${BLACKSMITH.name}'s Forge`,
  greeting: BLACKSMITH.greeting,
  items: (player) => [
    {
      name: 'Shield',
      icon: '🛡️',
      description: 'Hold J to block attacks. (You can’t swing your sword while blocking.)',
      price: FORGE.prices.shield,
      owned: player.hasShield,
      buy: () => player.giveShield(),
    },
    {
      name: 'Bow',
      icon: '🏹',
      description: `Press K to draw and shoot (takes 1 second). Aims at the closest monster in front of you. Comes with ${BOW.startArrows} arrows.`,
      price: FORGE.prices.bow,
      owned: player.hasBow,
      buy: () => player.giveBow(),
    },
    {
      name: `${FORGE.arrowsPerBundle} Arrows`,
      article: '',
      icon: '➶',
      description: `You have ${player.arrows}/${BOW.maxArrows} arrows. When you run out, you can't shoot until you buy more.`,
      price: FORGE.prices.arrows,
      locked: !player.hasBow ? 'Buy the Bow first' : player.arrows >= BOW.maxArrows ? 'Quiver full' : null,
      lockedMessage: !player.hasBow ? 'Arrows are no good without a bow! Buy the Bow first.' : `Your quiver is full! It holds ${BOW.maxArrows} arrows.`,
      buy: () => player.addArrows(FORGE.arrowsPerBundle),
      bought: 'Here you go. Make every arrow count!',
    },
    {
      name: 'Axe',
      icon: '🪓',
      description: 'Chop trees for wood: press T next to a tree. Wood is for upgrades.',
      price: FORGE.prices.axe,
      owned: player.hasAxe,
      buy: () => player.giveTool('axe'),
    },
    {
      name: 'Pickaxe',
      icon: '⛏️',
      description: 'Mine boulders for stone: press T next to a big rock. Stone is for upgrades.',
      price: FORGE.prices.pickaxe,
      owned: player.hasPickaxe,
      buy: () => player.giveTool('pickaxe'),
    },
    {
      section: 'Upgrades (need wood and stone)',
      name: SWORDS[1].name,
      icon: '⚔️',
      description: 'Upgrade your sword: hits twice as hard and reaches farther.',
      price: U.sword.coins,
      wood: U.sword.wood,
      stone: U.sword.stone,
      owned: player.swordTier >= 1,
      buy: () => player.upgradeSword(),
    },
    {
      name: 'Power Bow',
      icon: '🎯',
      description: `Upgrade your bow: hold K to charge. +1 damage for every ${BOW.secondsPerDamage} seconds you hold it, up to ${BOW.maxDamage}.`,
      price: U.powerBow.coins,
      wood: U.powerBow.wood,
      stone: U.powerBow.stone,
      owned: player.bowTier >= 1,
      locked: player.hasBow ? null : 'Buy the Bow first',
      lockedMessage: 'I can only upgrade a bow you already have. Buy the Bow first!',
      buy: () => player.upgradeBow(),
    },
    {
      name: 'Iron Shield',
      icon: '🔰',
      description: 'Upgrade your shield: walk at full speed while blocking, and monsters bounce off it.',
      price: U.ironShield.coins,
      wood: U.ironShield.wood,
      stone: U.ironShield.stone,
      owned: player.shieldTier >= 1,
      locked: player.hasShield ? null : 'Buy the Shield first',
      lockedMessage: 'I can only make your shield stronger once you have one. Buy the Shield first!',
      buy: () => player.upgradeShield(),
    },
    {
      name: 'Knight Armor',
      icon: '🦺',
      description: `Sturdy steel armor: +${FORGE.armorHearts} max hearts.`,
      price: U.armor.coins,
      wood: U.armor.wood,
      stone: U.armor.stone,
      owned: player.armor,
      buy: () => player.giveArmor(),
    },
  ],
};

/** Hana's bakery. After you upgrade her oven (wood + stone) she bakes special food with golden hearts. */
export const BAKERY_SHOP = {
  title: `${BAKER.name}'s Bakery`,
  greeting: BAKER.greeting,
  ovenUpgraded: false,
  items(player) {
    const foods = FOOD.menu.filter((f) => !f.upgraded || this.ovenUpgraded);
    const list = foods.map((food) => ({
      name: food.name,
      article: 'a',
      icon: food.icon,
      section: food.upgraded && food === foods.find((f) => f.upgraded) ? 'Special food (golden hearts!)' : undefined,
      description: `Heals ${food.heals === 1 ? '1 heart' : food.heals >= 99 ? 'all your hearts' : `${food.heals} hearts`}${
        food.extra ? ` and gives ${food.extra} golden ${food.extra === 1 ? 'heart' : 'hearts'} (extra hearts that go away when you get hit)` : ''
      }. (You have ${player.food.length}/${FOOD.carry} food.)`,
      price: food.price,
      locked: player.food.length >= FOOD.carry ? 'Bag full' : null,
      lockedMessage: `Your bag is full! You can carry ${FOOD.carry} things. Eat something first (press F).`,
      buy: () => player.addFood(food.id),
      bought: BAKER.bought,
    }));
    if (!this.ovenUpgraded) {
      const o = FOOD.ovenUpgrade;
      list.push({
        section: 'Upgrade',
        name: 'Bigger Oven',
        icon: '🔥',
        description: 'Help Hana build a bigger oven, and she can bake special food that gives golden extra hearts!',
        price: o.coins,
        wood: o.wood,
        stone: o.stone,
        buy: () => (this.ovenUpgraded = true),
        bought: 'What a wonderful oven! Look, now I can bake Golden Apples, Hearty Stew and a Royal Feast!',
      });
    }
    return list;
  },
};
