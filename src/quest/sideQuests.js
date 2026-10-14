import { Quest } from './Quest.js';
import { Collectible } from '../entities/Collectible.js';
import { Slime } from '../entities/Slime.js';
import { OakFighter, Vine } from '../entities/JungleMonsters.js';
import { TrainingPost } from '../entities/TrainingPost.js';
import { createCharacter } from '../models/character.js';
import { LOOKS } from '../models/people.js';
import { createMysteryCrystal, createKey } from '../models/gear.js';
import { RAINBOW } from '../world/StoneCircle.js';
import { createRng } from '../utils/random.js';
import { SEED, PLACES, JACKSON } from '../config.js';
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

/**
 * Master Oak will only teach the spin attack to someone who beats him in battle. When the duel
 * starts he steps out as an OakFighter; if you're knocked out, the duel is off (try again).
 */
export class OakDuelQuest extends Quest {
  constructor(game, rest = {}) {
    super(game, { id: 'oak', title: SIDE_QUESTS.oak.title, text: SIDE_QUESTS.oak.text, reward: 0, ...rest });
  }

  onStart() {
    const { game } = this;
    const oak = this.giver;
    const model = createCharacter(LOOKS.oak.colors);
    LOOKS.oak.decorate(model);
    this.fighter = game.add(new OakFighter(oak.object3d.position, model));
    oak.object3d.visible = false;
    oak.collider.x = oak.collider.z = 1e6;
    oak.hidden = true;
    this.fighter.onDefeated = () => {
      this.endDuel();
      this.readyToTurnIn('You beat Master Oak! Talk to him.');
    };
    this.setObjective('Defeat Master Oak in battle! (Dodge when his staff glows.)', this.fighter);
    game.questLog.toast('Master Oak raises his staff. The duel begins!');
  }

  endDuel() {
    const oak = this.giver;
    oak.hidden = false;
    oak.object3d.visible = true;
    if (this.fighter) oak.object3d.position.copy(this.fighter.object3d.position);
  }

  /** Knocked out by Oak? The duel's off; talk to him again to try again. */
  update() {
    const { game } = this;
    if (this.stage !== 'active' || !game.player.dead || !this.fighter) return;
    game.remove(this.fighter);
    this.endDuel();
    this.fighter = null;
    this.stage = 'offer';
    game.questLog.remove(this.id);
  }

  onFinish() {
    this.game.player.knowsSpin = true;
    this.game.questLog.toast('You learned the SPIN ATTACK! Hold the swing button, then let go.', 5);
  }
}

/** The Vine, boss of the jungle. Beating it opens the way to the dream dimension. */
export class VineQuest extends Quest {
  constructor(game, { jungle, ...rest }) {
    super(game, { id: 'vine', title: SIDE_QUESTS.vine.title, text: SIDE_QUESTS.vine.text, reward: 150, ...rest });
    this.jungle = jungle;
  }

  onStart() {
    const { game } = this;
    this.vine = game.add(new Vine(this.jungle.vineSpot));
    this.vine.onDefeated = () => this.readyToTurnIn('You defeated the Vine!');
    this.setObjective('Defeat the Vine, boss of the jungle (watch for the red circles!)', this.vine);
  }

  onFinish() {
    this.game.dreamPortal?.open(this.game);
  }
}

// ---- Dream dimension quests (the Dream Keeper). They give dream points instead of coins. ----

/** Catch the fallen stars scattered around the dream islands. */
export class DreamStarsQuest extends Quest {
  constructor(game, { dream, ...rest }) {
    super(game, { id: 'stars', title: SIDE_QUESTS.stars.title, text: SIDE_QUESTS.stars.text, dreamPoints: 3, ...rest });
    this.dream = dream;
    this.stars = [];
  }

  onStart() {
    const { game } = this;
    for (const spot of this.dream.starSpots) {
      const star = game.add(new Collectible(spot, { color: '#ffe66b' }));
      star.onCollect = () => {
        this.stars = this.stars.filter((s) => s !== star);
        if (this.stars.length === 0) this.readyToTurnIn('You caught all the fallen stars!');
        else this.updateObjective();
      };
      this.stars.push(star);
    }
    this.total = this.stars.length;
    this.updateObjective();
  }

  updateObjective() {
    const p = this.game.player.object3d.position;
    this.setObjective(`Catch the fallen stars (${this.total - this.stars.length}/${this.total})`, () =>
      [...this.stars].sort((a, b) => a.object3d.position.distanceTo(p) - b.object3d.position.distanceTo(p))[0] ?? null,
    );
  }
}

/** Chase away the nightmare wisps. */
export class DreamWispsQuest extends Quest {
  constructor(game, { dream, makeWisp, ...rest }) {
    super(game, { id: 'wisps', title: SIDE_QUESTS.wisps.title, text: SIDE_QUESTS.wisps.text, dreamPoints: 3, ...rest });
    this.dream = dream;
    this.makeWisp = makeWisp;
  }

  onStart() {
    this.wisps = this.dream.wispSpots.map((spot) => {
      const wisp = this.game.add(this.makeWisp(spot));
      wisp.onDefeated = () => {
        this.wisps = this.wisps.filter((w) => w !== wisp);
        if (this.wisps.length === 0) this.readyToTurnIn('The nightmares are gone!');
        else this.updateObjective();
      };
      return wisp;
    });
    this.updateObjective();
  }

  updateObjective() {
    this.setObjective(`Chase away the nightmare wisps (${this.wisps.length} left)`, () => this.wisps[0] ?? null);
  }
}

/** Jump up the cloud stones to the summit and catch the dream star there. */
export class CloudHopQuest extends Quest {
  constructor(game, { dream, ...rest }) {
    super(game, { id: 'hop', title: SIDE_QUESTS.hop.title, text: SIDE_QUESTS.hop.text, dreamPoints: 2, ...rest });
    this.dream = dream;
  }

  onStart() {
    const star = this.game.add(new Collectible(this.dream.summitSpot, { color: '#ff8fe0' }));
    star.onCollect = () => this.readyToTurnIn('You reached the top of the clouds!');
    this.setObjective('Jump up the cloud stones to the summit (press Space to jump)', star);
  }
}

/** Master Oak sends you to find his old friend, Master Jackson. Talking to Jackson finishes it. */
export class FindJacksonQuest extends Quest {
  constructor(game, rest = {}) {
    super(game, { id: 'findJackson', title: SIDE_QUESTS.findJackson.title, text: SIDE_QUESTS.findJackson.text, ...rest });
    this.jackson = null; // set in main.js
  }

  onStart() {
    this.setObjective('Find Master Jackson on the little island far east of the village', this.jackson);
  }

  /** You reached Jackson (he calls this when you talk to him). */
  found() {
    if (this.stage !== 'active') return;
    this.finish();
    this.game.questLog.toast('You found Master Jackson!');
  }
}

/** Master Jackson teaches the Sky Strike: smash his training posts with it to pass. */
export class SkyStrikeQuest extends Quest {
  constructor(game, { island, ...rest }) {
    super(game, { id: 'skyStrike', title: SIDE_QUESTS.skyStrike.title, text: SIDE_QUESTS.skyStrike.text, reward: 60, ...rest });
    this.island = island;
    this.smashed = 0;
  }

  onStart() {
    const { game } = this;
    game.player.knowsSkyStrike = true;
    game.questLog.toast('You learned the SKY STRIKE! Jump, then swing in the air.', 5);
    this.posts = [];
    for (let i = 0; i < JACKSON.posts; i++) {
      const a = Math.PI * 0.75 + (i - 1) * 1.2;
      const post = game.add(new TrainingPost({ x: this.island.x + Math.cos(a) * 3.2, z: this.island.z + Math.sin(a) * 3.2 }, () => this.postBroken()));
      this.posts.push(post);
    }
    this.showProgress();
  }

  showProgress() {
    this.setObjective(`Smash Master Jackson's training posts with a Sky Strike (${this.smashed}/${JACKSON.posts})`, () =>
      this.posts.find((p) => this.game.entities.includes(p)) ?? null,
    );
  }

  postBroken() {
    this.smashed++;
    if (this.smashed < JACKSON.posts) this.showProgress();
    else this.readyToTurnIn('All the posts are smashed! Talk to Master Jackson.');
  }
}
