import { Quest } from './Quest.js';
import { Collectible } from '../entities/Collectible.js';
import { Slime } from '../entities/Slime.js';
import { createMysteryCrystal, createKey } from '../models/gear.js';
import { RAINBOW } from '../world/StoneCircle.js';
import { createRng } from '../utils/random.js';
import { SEED, PLACES } from '../config.js';
import { SIDE_QUESTS } from '../story.js';

/**
 * Find things scattered around the island (gems on the grass, seashells on the beach).
 * The quest arrow points at the nearest one.
 */
export class FindGemsQuest extends Quest {
  constructor(game, {
    count = 6,
    id = 'gems',
    story = SIDE_QUESTS.gems,
    reward = 25,
    where = 'grass',
    itemName = 'gem',
    model = null,
    colors = ['#3fd0ff', '#ff5ec4', '#ffd23f', '#7dff6b', '#ff8a3d', '#b46bff'],
    ...rest
  } = {}) {
    super(game, { id, title: story.title, text: story.text, reward, ...rest });
    this.count = count;
    this.where = where;
    this.itemName = itemName;
    this.model = model;
    this.colors = colors;
    this.gems = [];
  }

  /** A random spot on the grass (away from the village) or on the beach. */
  randomSpot(rng) {
    const { game } = this;
    if (this.where === 'beach') {
      const a = rng.range(0, Math.PI * 2);
      const edge = game.terrain.edgeRadius(Math.cos(a), Math.sin(a));
      const d = edge - 3;
      return { x: Math.cos(a) * d, z: Math.sin(a) * d };
    }
    const r = game.terrain.radius;
    return { x: rng.range(-r, r), z: rng.range(-r, r) };
  }

  spotIsGood(x, z) {
    const { game } = this;
    if (this.where === 'beach') {
      if (!game.terrain.isInside(x, z, 0.3) || game.terrain.isGrass(x, z) || game.dock?.isInside(x, z, -3)) return false;
    } else if (Math.hypot(x, z) < 30 || !game.terrain.isGrass(x, z, 3) || game.isReserved(x, z, 2)) {
      return false;
    }
    if (game.colliders.some((c) => c.radius && Math.hypot(c.x - x, c.z - z) < c.radius + 1.5)) return false;
    return !this.gems.some((g) => Math.hypot(g.object3d.position.x - x, g.object3d.position.z - z) < 18);
  }

  onStart() {
    const { game } = this;
    const rng = createRng(SEED + 21 + this.id.length);
    for (let attempt = 0; attempt < 800 && this.gems.length < this.count; attempt++) {
      const { x, z } = this.randomSpot(rng);
      if (!this.spotIsGood(x, z)) continue;
      const color = this.colors[this.gems.length % this.colors.length];
      const gem = game.add(new Collectible({ x, z }, { color, model: this.model?.(color) }));
      gem.onCollect = () => this.collected(gem);
      this.gems.push(gem);
    }
    this.count = this.gems.length; // in case fewer spots were free than asked for
    this.found = 0;
    this.updateObjective();
  }

  collected(gem) {
    this.gems = this.gems.filter((g) => g !== gem);
    this.found++;
    if (this.gems.length === 0) this.readyToTurnIn(`You found all the ${this.itemName}s!`);
    else {
      this.game.questLog.toast(`Found a ${this.itemName}! (${this.found}/${this.count})`);
      this.updateObjective();
    }
  }

  nearestGem() {
    const p = this.game.player.object3d.position;
    let best = null;
    for (const g of this.gems) if (!best || g.object3d.position.distanceTo(p) < best.object3d.position.distanceTo(p)) best = g;
    return best;
  }

  updateObjective() {
    this.setObjective(`Find the ${this.itemName}s (${this.found}/${this.count})`, () => this.nearestGem());
  }
}

/** Bring materials: chop wood or mine stone and hand it over. */
export class DeliveryQuest extends Quest {
  constructor(game, { id, story, material, amount, reward, ...rest }) {
    super(game, { id, title: story.title, text: story.text, reward, ...rest });
    this.material = material;
    this.amount = amount;
  }

  get enough() {
    return this.game.player[this.material] >= this.amount;
  }

  get marker() {
    if (this.stage === 'active' && this.enough) return '?';
    return super.marker;
  }

  onStart() {
    const tool = this.material === 'wood' ? 'chop trees with an axe' : 'mine boulders with a pickaxe';
    this.setObjective(`Bring ${this.giver.name} ${this.amount} ${this.material} (${tool})`, () =>
      this.enough ? this.giver : this.nearestSource(),
    );
  }

  nearestSource() {
    const { game } = this;
    const p = game.player.object3d.position;
    const kind = this.material;
    let best = null;
    let bestDist = Infinity;
    for (const node of game.gathering?.nodes ?? []) {
      if (node.kind !== kind || node.left <= 0) continue;
      const d = Math.hypot(node.x - p.x, node.z - p.z);
      if (d < bestDist) {
        best = node;
        bestDist = d;
      }
    }
    return best && { questPosition: { x: best.x, z: best.z } };
  }

  dialogFor() {
    const player = this.game.player;
    if (this.stage === 'active') {
      if (this.enough) {
        return {
          pages: this.text.turnIn,
          onClose: () => {
            player[this.material] -= this.amount;
            this.finish();
          },
        };
      }
      return { pages: [...this.text.active, `You have ${player[this.material]} of ${this.amount} ${this.material} so far.`] };
    }
    return super.dialogFor();
  }
}

/** Defeat monsters: blue slimes bothering the farmer's fields. */
export class SlimeHuntQuest extends Quest {
  constructor(game, { count = 5, where = PLACES.slimeMeadow, ...rest } = {}) {
    super(game, { id: 'hunt', title: SIDE_QUESTS.hunt.title, text: SIDE_QUESTS.hunt.text, reward: 30, ...rest });
    this.count = count;
    this.where = where;
    this.slimes = [];
  }

  onStart() {
    const { game } = this;
    for (let i = 0; i < this.count; i++) {
      const a = (i / this.count) * Math.PI * 2;
      const slime = game.add(
        new Slime(
          { x: this.where.x + Math.cos(a) * 5, z: this.where.z + Math.sin(a) * 5 },
          { size: 0.38, color: '#4cc9f0', glow: '#1f6fa8', health: 3, coins: 3, chaseRange: 10 },
        ),
      );
      slime.onDefeated = () => this.defeated(slime);
      this.slimes.push(slime);
    }
    this.updateObjective();
  }

  defeated(slime) {
    this.slimes = this.slimes.filter((s) => s !== slime);
    if (this.slimes.length === 0) this.readyToTurnIn('All the blue slimes are gone!');
    else this.updateObjective();
  }

  updateObjective() {
    const done = this.count - this.slimes.length;
    this.setObjective(`Defeat the blue slimes (${done}/${this.count})`, () => this.slimes[0] ?? null);
  }
}

/** Puzzle: step on the rainbow stones in the right order, then open the chest that appears. */
export class RainbowStonesQuest extends Quest {
  constructor(game, { circle, reverse = false, ...rest }) {
    const story = reverse ? SIDE_QUESTS.reverse : SIDE_QUESTS.puzzle;
    super(game, { id: reverse ? 'reverse' : 'puzzle', title: story.title, text: story.text, reward: 0, ...rest });
    this.circle = circle;
    this.reverse = reverse;
  }

  onStart() {
    this.circle.activate({ reverse: this.reverse });
    const order = RAINBOW.map((c) => c.name);
    if (this.reverse) order.reverse();
    this.setObjective(`Step on the stones: ${order.join(', ')}`, this.circle);
    this.circle.onSolved = (chest) => {
      this.setObjective('Open the treasure chest', chest);
      chest.onOpen = () => this.readyToTurnIn();
    };
  }
}

/**
 * Find something far away: swim to the tower island and fetch the mystery crystal from the top.
 * Captain Finn lets you keep it: it's the key to the old trapdoor outside of town.
 */
export class CrystalQuest extends Quest {
  constructor(game, { island, trapdoor, ...rest }) {
    super(game, { id: 'crystal', title: SIDE_QUESTS.crystal.title, text: SIDE_QUESTS.crystal.text, reward: 60, ...rest });
    this.island = island;
    this.trapdoor = trapdoor;
  }

  onStart() {
    const { game } = this;
    this.crystal = game.add(new Collectible(this.island.crystalSpot, { color: '#5ef2e0', model: createMysteryCrystal() }));
    this.crystal.onCollect = () => this.readyToTurnIn('You got the mystery crystal!');
    this.setObjective('Swim to the tower island and climb to the top', this.crystal);
  }

  onFinish() {
    const { game } = this;
    game.player.hasCrystal = true;
    game.questLog.set('trapdoor', {
      title: 'The Old Trapdoor',
      objective: 'Use the crystal on the trapdoor outside of town',
      target: this.trapdoor,
    });
    this.trapdoor.onOpen = () => game.questLog.set('trapdoor', {
      title: 'The Old Trapdoor',
      objective: 'Climb down the trapdoor',
      target: this.trapdoor,
    });
  }
}

/**
 * Old Man Keegan's quest, "Slay Charibdis": defeat the kraken or the sea serpent for the key,
 * unlock Charibdis's sea cave, and slay Charibdis.
 */
export class CharibdisQuest extends Quest {
  constructor(game, { cave, makeKraken, makeSerpent, makeCharibdis }) {
    super(game, { id: 'charibdis', title: SIDE_QUESTS.charibdis.title, text: SIDE_QUESTS.charibdis.text, reward: 150 });
    this.cave = cave;
    this.make = { kraken: makeKraken, serpent: makeSerpent, charibdis: makeCharibdis };
    this.keyHolders = [];
  }

  /** Talking to Keegan for the first time also finishes the trapdoor quest-log entry. */
  dialogFor(npc) {
    if (this.stage === 'offer') this.game.questLog.complete('trapdoor');
    return super.dialogFor(npc);
  }

  onStart() {
    const { game } = this;
    this.keyHolders = [game.add(this.make.kraken()), game.add(this.make.serpent())];
    for (const boss of this.keyHolders) boss.onDefeated = (where) => this.bossDefeated(where);
    this.setObjective('Defeat the Kraken or the Sea Serpent to get the key', () => this.nearestKeyHolder());
    this.cave.onUnlock = () => this.caveOpened();
  }

  nearestKeyHolder() {
    const p = this.game.player.object3d.position;
    const alive = this.keyHolders.filter((m) => this.game.monsters.includes(m));
    alive.sort((a, b) => a.object3d.position.distanceTo(p) - b.object3d.position.distanceTo(p));
    return alive[0] ?? null;
  }

  bossDefeated(where) {
    if (this.keyDropped) return; // only the first one has the key
    this.keyDropped = true;
    const { game } = this;
    const key = game.add(new Collectible({ x: where.x, z: where.z, y: where.y }, { color: '#ffc93c', model: createKey() }));
    key.onCollect = () => {
      game.player.hasKey = true;
      game.questLog.toast('You got the key to Charibdis\'s cave!');
      this.setObjective('Unlock Charibdis\'s cave', this.cave);
    };
    this.setObjective('Grab the key!', key);
    game.questLog.toast('It dropped a big golden key!');
  }

  caveOpened() {
    const { game } = this;
    this.charibdis = game.add(this.make.charibdis());
    this.charibdis.onDefeated = () => this.readyToTurnIn('You slew Charibdis!');
    this.setObjective('Slay Charibdis! Attack when the whirlpool stops.', this.charibdis);
  }
}

/**
 * After Charibdis is slain, Captain Finn takes you to the jungle island. Defeat the giant
 * Venus fly traps there, then come back and tell Finn.
 */
export class JungleQuest extends Quest {
  constructor(game, { jungle, ...rest }) {
    super(game, { id: 'jungle', title: SIDE_QUESTS.jungle.title, text: SIDE_QUESTS.jungle.text, reward: 120, ...rest });
    this.jungle = jungle;
  }

  onStart() {
    const { game } = this;
    this.traps = game.monsters.filter((m) => m.isFlyTrap);
    for (const trap of this.traps) {
      const done = trap.onDefeated;
      trap.onDefeated = (where) => {
        done?.(where);
        this.trapDefeated(trap);
      };
    }
    this.jungle.travel(game);
    this.updateObjective();
  }

  /** After the quest, Finn will take you back to the jungle whenever you like. */
  dialogFor() {
    if (this.stage === 'complete') return { pages: this.text.complete, onClose: () => this.jungle.travel(this.game) };
    return super.dialogFor();
  }

  trapDefeated(trap) {
    this.traps = this.traps.filter((t) => t !== trap);
    if (this.traps.length === 0) this.readyToTurnIn('All the giant fly traps are gone! Go back to Captain Finn.');
    else this.updateObjective();
  }

  updateObjective() {
    const p = this.game.player.object3d.position;
    this.setObjective(`Defeat the giant Venus fly traps (${this.traps.length} left)`, () =>
      [...this.traps].sort((a, b) => a.object3d.position.distanceTo(p) - b.object3d.position.distanceTo(p))[0] ?? null,
    );
  }
}
