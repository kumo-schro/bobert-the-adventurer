// What each shop sells. Each function gets the player and returns the items for the Shop menu
// (see ui/Shop.js for the fields). Add a new item by adding an entry to a list.

import { SWORDS, FORGE, FOOD, BOW, GATHER, BUFFS, MAGIC, CRYSTALS, DREAM_ABILITIES, FAME } from './config.js';
import { BLACKSMITH, BAKER, PIP_CRYSTAL } from './story.js';

const U = FORGE.upgrades;

/** The blacksmith's forge. Build a bigger forge (wood + stone) to unlock the upgrades. */
export const FORGE_SHOP = {
  title: `${BLACKSMITH.name}'s Forge`,
  greeting: BLACKSMITH.greeting,
  forgeBuilt: false,
  onBuilt: null, // set by main.js: makes the forge bigger in the village
  items(player) {
    const list = [
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
        description: 'Chop trees for wood: press T next to a tree.',
        price: FORGE.prices.axe,
        owned: player.hasAxe,
        buy: () => player.giveTool('axe'),
      },
      {
        name: 'Pickaxe',
        icon: '⛏️',
        description: 'Mine boulders for stone: press T next to a big rock.',
        price: FORGE.prices.pickaxe,
        owned: player.hasPickaxe,
        buy: () => player.giveTool('pickaxe'),
      },
    ];
    if (!this.forgeBuilt) {
      const b = FORGE.biggerForge;
      list.push({
        section: 'Upgrade',
        name: 'Bigger Forge',
        icon: '🔥',
        description: 'Help the blacksmith build a bigger forge, and they can make upgraded gear: the Knight Sword, Power Bow, Iron Shield, Knight Armor and steel tools!',
        price: b.coins,
        wood: b.wood,
        stone: b.stone,
        buy: () => {
          this.forgeBuilt = true;
          this.onBuilt?.();
        },
        bought: 'Look at this beauty! With a forge this big, I can make anything. Have a look at the upgrades!',
      });
      return list;
    }
    const upgrade = (item) => ({ bought: 'Fresh from the big forge. Use it well!', ...item });
    list.push(
      upgrade({
        section: 'Upgraded gear (from the big forge)',
        name: SWORDS[1].name,
        icon: '⚔️',
        description: 'Hits twice as hard and reaches farther.',
        price: U.sword,
        owned: player.swordTier >= 1,
        buy: () => player.upgradeSword(),
      }),
      upgrade({
        name: 'Power Bow',
        icon: '🎯',
        description: `Hold K to charge: +1 damage for every ${BOW.secondsPerDamage} seconds you hold it, up to ${BOW.maxDamage}.`,
        price: U.powerBow,
        owned: player.bowTier >= 1,
        locked: player.hasBow ? null : 'Buy the Bow first',
        lockedMessage: 'I can only upgrade a bow you already have. Buy the Bow first!',
        buy: () => player.upgradeBow(),
      }),
      upgrade({
        name: 'Iron Shield',
        icon: '🔰',
        description: 'Walk at full speed while blocking, and monsters bounce off it.',
        price: U.ironShield,
        owned: player.shieldTier >= 1,
        locked: player.hasShield ? null : 'Buy the Shield first',
        lockedMessage: 'I can only make your shield stronger once you have one. Buy the Shield first!',
        buy: () => player.upgradeShield(),
      }),
      upgrade({
        name: 'Knight Armor',
        icon: '🦺',
        description: 'Sturdy steel armor: you can take more hits before you get knocked out.',
        price: U.armor,
        owned: player.armor,
        buy: () => player.giveArmor(),
      }),
      upgrade({
        name: 'Steel Axe',
        icon: '🪓',
        description: `Chops ${GATHER.steelBonus} wood at a time instead of 1.`,
        price: U.steelAxe,
        owned: player.axeTier >= 1,
        locked: player.hasAxe ? null : 'Buy the Axe first',
        buy: () => player.upgradeTool('axe'),
      }),
      upgrade({
        name: 'Steel Pickaxe',
        icon: '⛏️',
        description: `Mines ${GATHER.steelBonus} stone at a time instead of 1.`,
        price: U.steelPickaxe,
        owned: player.pickaxeTier >= 1,
        locked: player.hasPickaxe ? null : 'Buy the Pickaxe first',
        buy: () => player.upgradeTool('pickaxe'),
      }),
    );
    return list;
  },
};

/** Hana's bakery. After you upgrade her oven (wood + stone) she bakes special food that gives golden extra health. */
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
      section: food.upgraded && food === foods.find((f) => f.upgraded) ? 'Special food (golden health!)' : undefined,
      description: `${food.heals >= 99 ? 'Makes you feel all better' : food.heals >= 2 ? 'Heals you a lot' : 'Heals you a little'}${
        food.extra ? `, and gives you ${food.extra >= 3 ? 'lots of ' : ''}extra golden health that soaks up the next hits` : ''
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
        description: 'Help Hana build a bigger oven, and she can bake special food that gives extra golden health!',
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

/** The boat map: where to sail. (Not a shop really: every choice is free.) */
export const BOAT_MENU = {
  title: '⛵ Boat map',
  greeting: 'Where to, captain?',
  items() {
    const game = this.game;
    const boat = game.boat;
    const inJungleSea = Math.hypot(boat.object3d.position.x, boat.object3d.position.z) > 400;
    const jungle = game.jungle;
    const list = [];
    if (game.quests.vine.stage === 'complete') {
      const fire = game.fireIsland;
      list.push({
        action: true,
        name: 'Sail to the fire island',
        icon: '🌋',
        description: 'Follow the warm currents to the volcano island.',
        price: 0,
        buttonLabel: 'Set sail',
        buy: () => {
          boat.sailTo(game, fire.center.x, fire.center.z - fire.edgeRadius(0, -1) - 8, 0);
          game.questLog.toast('You sailed to the fire island! It is hot here...');
        },
      });
    }
    if (!inJungleSea) {
      list.push({
        action: true,
        name: 'Sail to the jungle',
        icon: '🌴',
        description: 'Follow the sea currents all the way to the jungle island.',
        price: 0,
        buttonLabel: 'Set sail',
        buy: () => {
          boat.sailTo(game, jungle.center.x, jungle.center.z + jungle.edgeRadius(0, 1) + 8, Math.PI);
          game.questLog.toast('You sailed to the jungle island!');
        },
      });
    }
    list.push({
      action: true,
      name: inJungleSea ? 'Sail home' : 'Sail back to the dock',
      icon: '⚓',
      description: 'Back to Captain Max\'s dock on the home island.',
      price: 0,
      buttonLabel: 'Set sail',
      buy: () => {
        boat.sailTo(game, boat.mooring.x, boat.mooring.z, -Math.PI / 2);
        game.questLog.toast('Home to the dock!');
      },
    });
    list.push({
      action: true,
      name: 'Hop out and swim',
      icon: '🌊',
      description: 'Jump over the side. (Your boat waits right here.)',
      price: 0,
      buttonLabel: 'Splash!',
      buy: () => boat.hopOut(game),
    });
    list.push({
      action: true,
      name: 'Keep exploring',
      icon: '🧭',
      description: 'Steer with the move keys. Hold Shift to go faster.',
      price: 0,
      buttonLabel: 'OK',
      buy: () => {},
    });
    return list;
  },
};

/**
 * The dream shrine (Aleli): sells the magic conduit, which holds the magic points that dream
 * abilities run on. The abilities themselves are taught by the Dream Keeper's quests; the shrine
 * lists them so you can see which quest teaches which.
 */
export const DREAM_SHRINE = {
  title: '✨ Dream Shrine',
  greeting: 'Dream powers run on magic, dreamer. A conduit holds it, and every monster you defeat fills it up.',
  quests: {}, // set in main.js: ability id -> the quest that teaches it
  items(player) {
    const list = [
      {
        name: 'Magic Conduit',
        icon: '🔮',
        description: `Holds up to ${MAGIC.max} magic points for your dream abilities (it comes with ${MAGIC.starting}). Defeat monsters to fill it up.`,
        price: MAGIC.conduitPrice,
        owned: player.hasConduit,
        buy: () => {
          player.hasConduit = true;
          player.magic = Math.max(player.magic, MAGIC.starting);
        },
        bought: 'Feel it hum? Every monster you defeat now gives you magic. Bigger monsters give more!',
      },
    ];
    Object.entries(DREAM_ABILITIES).forEach(([id, a], i) => {
      const quest = this.quests[id];
      list.push({
        section: i === 0 ? 'Dream abilities (the Dream Keeper teaches them)' : undefined,
        name: a.name,
        icon: a.icon,
        description: `${a.how[0].toUpperCase()}${a.how.slice(1)}. Uses ${MAGIC.cost[id]} magic${id === 'speedBoots' ? ' a second while you move' : ''}.`,
        price: 0,
        owned: player[a.flag],
        locked: player[a.flag] ? null : 'Quest',
        lockedMessage: `The Dream Keeper teaches this one. Do her quest "${quest?.title ?? '?'}".`,
        buy: () => {},
      });
    });
    return list;
  },
};

/** Pip's crystals (once you've shown Pip the mystery crystal). */
export const PIP_SHOP = {
  title: PIP_CRYSTAL.shop.title,
  greeting: PIP_CRYSTAL.shop.greeting,
  items: (player) => [
    {
      name: 'Heart Crystal',
      icon: '💗',
      description: `One more health, for good! (You have ${player.heartCrystals}/${CRYSTALS.heart.most}.)`,
      price: CRYSTALS.heart.price,
      owned: player.heartCrystals >= CRYSTALS.heart.most,
      buy: () => player.addHeartCrystal(),
      bought: 'It glows right into you! You feel tougher already.',
    },
    {
      name: 'Magic Crystal',
      icon: '💎',
      description: `Fills up ${CRYSTALS.magic.points} magic points for your dream abilities.`,
      price: CRYSTALS.magic.price,
      locked: !player.hasConduit ? 'Needs a conduit' : player.magic >= MAGIC.max ? 'Magic full' : null,
      lockedMessage: !player.hasConduit
        ? 'Ooh, this one is magic! You need a magic conduit to hold it. They say they sell them in the dream dimension...'
        : 'Your magic is already full!',
      buy: () => player.addMagic(CRYSTALS.magic.points),
      bought: 'Zing! Magic, right into your conduit.',
    },
    {
      name: 'Big Magic Crystal',
      icon: '🔷',
      description: 'Fills your magic all the way up.',
      price: CRYSTALS.bigMagic.price,
      locked: !player.hasConduit ? 'Needs a conduit' : player.magic >= MAGIC.max ? 'Magic full' : null,
      lockedMessage: !player.hasConduit ? 'You need a magic conduit to hold this much magic!' : 'Your magic is already full!',
      buy: () => player.addMagic(CRYSTALS.bigMagic.points),
      bought: 'WHOOSH! That is a LOT of magic.',
    },
    {
      name: 'Frost Crystal',
      icon: '🧊',
      description: "Frosty Feet for five minutes: lava can't burn you.",
      price: CRYSTALS.frost.price,
      locked: player.buffs.frostyFeet ? `${Math.ceil(player.buffs.frostyFeet / 60)} min left` : null,
      buy: () => player.addBuff(PIP_SHOP.game, 'frostyFeet'),
      bought: 'Brrr! Your feet are frosty. Go and stomp on some lava!',
    },
    {
      name: 'Swift Crystal',
      icon: '⚡',
      description: 'Walk and run a little faster, for good.',
      price: CRYSTALS.swift.price,
      owned: player.swiftCrystal,
      buy: () => (player.swiftCrystal = true),
      bought: 'Zoom! Your feet feel lighter already.',
    },
    {
      name: 'Sea Crystal',
      icon: '🌊',
      description: 'Swim much faster, for good.',
      price: CRYSTALS.sea.price,
      owned: player.seaCrystal,
      buy: () => (player.seaCrystal = true),
      bought: 'Now you swim like a fish! Well, almost.',
    },
    {
      name: 'Lucky Crystal',
      icon: '🍀',
      description: 'Every monster you defeat drops 2 more coins, for good.',
      price: CRYSTALS.lucky.price,
      owned: player.luckyCrystal,
      buy: () => (player.luckyCrystal = true),
      bought: 'Lucky you! Coins will just love you now.',
    },
  ],
  game: null, // set in main.js
};

/**
 * Captain Max's trips (on the jungle beach and the fire island): home to the dock, to the
 * jungle, or (once the Viniac is beaten) to the fire island.
 */
export const FINN_TRIPS = {
  title: '⚓ Captain Max',
  greeting: 'Where to, adventurer?',
  game: null, // set in main.js
  here: null, // set by whoever opens it: 'jungle' or 'fire'
  items() {
    const game = this.game;
    const fireOpen = game.quests.vine.stage === 'complete';
    const famous = game.player.fame >= FAME.needed;
    const trip = (name, icon, description, go) => ({ action: true, name, icon, description, price: 0, buttonLabel: 'Let\'s go', buy: go });
    const list = [
      trip('Home to the dock', '⚓', 'Back to the dock on the home island.', () => {
        game.teleport(game.dock.keeperSpot.x - 1.5, game.dock.keeperSpot.z, { facing: -Math.PI / 2 });
        game.questLog.toast('Back home at the dock!');
      }),
    ];
    if (this.here !== 'jungle' && game.player.visitedJungle) list.push(trip('To the jungle', '🌴', 'Across the sea to the jungle island.', () => game.jungle.travel(game)));
    if (this.here !== 'fire') {
      list.push({
        ...trip('To the fire island', '🌋', 'A volcano island, full of lava and fire monsters. Its dragon has woken up!', () => game.fireIsland.travel(game)),
        locked: fireOpen ? null : 'Not yet',
        lockedMessage: 'The fire island? Nobody goes there! Not while the Viniac still rules this jungle, anyway.',
      });
    }
    if (this.here !== 'tulane' && famous) list.push(trip('To Tulane Kingdom', '🏰', 'Back to where it all began.', () => game.tulane.travel(game)));
    return list;
  },
};

/** Barrett the gecko loves coins: pay him and he gives you a little boost for five minutes. */
export const BARRETT_SHOP = {
  title: "🦎 Barrett's Lucky Buffs",
  greeting: "Coins! Shiny, shiny coins! Give me some and I'll give you a little boost. Each one lasts five minutes!",
  game: null, // set in main.js
  items: (player) =>
    ['quickFeet', 'toughScales', 'luckyTail'].map((id) => {
      const buff = BUFFS[id];
      const left = player.buffs[id];
      return {
        name: buff.name,
        icon: buff.icon,
        description: buff.description,
        price: buff.price,
        owned: false,
        locked: left ? `${Math.ceil(left / 60)} min left` : null,
        buy: () => player.addBuff(BARRETT_SHOP.game, id),
        bought: `${buff.name}! Ooh, thank you for the coins! Hee hee!`,
      };
    }),
};
