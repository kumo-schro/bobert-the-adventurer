// Saved games, kept in the browser (localStorage). Press Esc in the game to save or load.
//
// A save remembers the player (gear, coins, powers, where they are), every quest's stage, and
// the things that change in the world (the bigger forge, the boat, opened chests...). It does not
// remember every monster: they come back when a save is loaded, like after a fresh start.
//
// Loading reloads the page and sets the fresh game up from the save (like the debug checkpoints).
// Saves from a different SAVES.version can't be loaded: bump it after big changes to the game
// (or teach migrate() how to bring the older saves up to date).

import { Chest } from './entities/Chest.js';
import { FORGE_SHOP } from './shops.js';
import { SAVES } from './config.js';

const STORAGE_KEY = 'bobert-saves';
const LOAD_KEY = 'bobert-load-save'; // the save to load after the page reloads

/** Everything that's saved: [{ id, name, version, savedAt, summary, data }], newest first. */
export function listSaves() {
  try {
    const saves = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]');
    return Array.isArray(saves) ? saves.sort((a, b) => b.savedAt.localeCompare(a.savedAt)) : [];
  } catch {
    return [];
  }
}

function writeSaves(saves) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(saves));
}

export const canLoad = (save) => save.version === SAVES.version || save.version === 1;

/**
 * Brings a version 1 save up to date: wood, stone, arrows and golden health are gone, the dodge
 * is everyone's now (Jackson teaches the Perfect Dodge), and the dream powers were reshuffled.
 */
function migrate(data, version) {
  if (version !== 1) return data;
  const p = data.player;
  p.knowsPerfectDodge = p.knowsDodge;
  p.hasDreamDash = p.hasDash;
  p.food = (p.food ?? []).map((id) => ({ goldenApple: 'apple', stew: 'bread', feast: 'pie' })[id] ?? id);
  const q = data.quests;
  if (q.wood) q.planks = { stage: q.wood.stage };
  if (q.stone) q.wellStones = { stage: q.stone.stage };
  return data;
}

/** Save the game under `name`. A save with the same name is replaced. Returns the save. */
export function saveGame(game, name) {
  const saves = listSaves();
  const old = saves.find((s) => s.name.toLowerCase() === name.toLowerCase());
  const save = {
    id: old?.id ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    name,
    version: SAVES.version,
    savedAt: new Date().toISOString(),
    summary: summarize(game),
    data: collect(game),
  };
  writeSaves([save, ...saves.filter((s) => s !== old)]);
  game.saveName = name; // the adventure you're playing now: save points save to it
  return save;
}

export function deleteSave(id) {
  writeSaves(listSaves().filter((s) => s.id !== id));
}

/** Restart the game from a save (the page reloads, then applyPendingLoad picks it up). */
export function loadSave(id) {
  sessionStorage.setItem(LOAD_KEY, id);
  location.href = location.pathname; // drop any ?checkpoint=...
}

/** Called once the fresh game is built: load the save asked for before the reload, if any. */
export function applyPendingLoad(game) {
  worldChests(game); // note the world's chests now, before any puzzle makes more
  let id;
  try {
    id = sessionStorage.getItem(LOAD_KEY);
    sessionStorage.removeItem(LOAD_KEY);
  } catch {
    return null;
  }
  const save = id && listSaves().find((s) => s.id === id);
  if (!save || !canLoad(save)) return null;
  apply(game, migrate(save.data, save.version));
  game.saveName = save.name;
  return save;
}

// ---- What goes into a save ----

const PLAYER_FIELDS = [
  'coins', 'health', 'food', 'buffs', 'heartCrystals', 'hasConduit', 'magic', 'swiftCrystal', 'seaCrystal', 'luckyCrystal',
  'visitedFire', 'fame', 'visitedTulane', 'knowsSpin', 'knowsSkyStrike', 'knowsPerfectDodge', 'hasDoubleJump', 'hasDreamDash',
  'hasDreamHeal', 'hasCrystal', 'hasKey', 'visitedJungle', 'canSwimFromBeach',
];

/** Every quest in the game (they all belong to someone), in the order they're given out. */
function allQuests(game) {
  return game.entities.flatMap((e) => e.quests ?? []);
}

/** The chests that are part of the world (not ones a puzzle makes later), in a fixed order. */
function worldChests(game) {
  game.worldChests ??= game.entities.filter((e) => e instanceof Chest);
  return game.worldChests;
}

function collect(game) {
  const p = game.player;
  const pos = p.object3d.position;
  const player = Object.fromEntries(PLAYER_FIELDS.map((f) => [f, structuredClone(p[f])]));
  Object.assign(player, {
    swordTier: p.swordTier,
    shieldTier: p.shieldTier,
    bowTier: p.bowTier,
    armor: p.armor,
    position: { x: pos.x, y: p.boat ? 0 : pos.y, z: pos.z },
    facing: p.model.root.rotation.y,
    spawn: { x: p.spawn.x, y: p.spawn.y, z: p.spawn.z }, // the last save crystal touched
    swimming: p.swimming,
    inBoat: !!p.boat,
    look: p.look,
  });
  const quests = {};
  for (const q of allQuests(game)) quests[q.id] = { stage: q.stage, progress: q.stage === 'active' ? q.saveProgress?.() : undefined };
  return {
    player,
    quests,
    world: {
      time: game.dayNight.time,
      forgeBuilt: FORGE_SHOP.forgeBuilt,
      pipCrystalShown: !!game.pip?.crystalShown,
      boatBuilt: !!game.boat?.built,
      trapdoorOpen: !!game.quests.crystal.trapdoor.open,
      caveUnlocked: !game.charibdisCave.locked,
      chests: worldChests(game).flatMap((c, i) => (c.opened ? [i] : [])),
    },
  };
}

/** A short line for the save list: where you are and how far along. */
function summarize(game) {
  const p = game.player;
  const pos = p.object3d.position;
  const area = game.suggestions?.areaName(pos.x, pos.y, pos.z) ?? '';
  const done = allQuests(game).filter((q) => q.stage === 'complete').length;
  const where = area ? `${area[0].toUpperCase()}${area.slice(1)} · ` : ''; // "The jungle · ..."
  return `${where}${p.coins} coins · ${done} quest${done === 1 ? '' : 's'} done`;
}

// ---- Setting a fresh game up from a save ----

function apply(game, data) {
  const toast = game.questLog.toast;
  game.questLog.toast = () => {}; // no "you got..." messages while everything is put back
  try {
    applyPlayer(game, data.player);
    applyQuests(game, data.quests);
    applyWorld(game, data.world);
    placePlayer(game, data.player);
  } finally {
    game.questLog.toast = toast;
  }
}

function applyPlayer(game, saved) {
  const p = game.player;
  if (saved.shieldTier >= 0) p.giveShield();
  if (saved.shieldTier >= 1) p.upgradeShield();
  while (p.swordTier < saved.swordTier) p.upgradeSword();
  if (saved.bowTier >= 0) p.giveBow();
  if (saved.bowTier >= 1) p.upgradeBow();
  if (saved.armor) p.giveArmor();
  p.maxHealth += saved.heartCrystals ?? 0; // Pip's heart crystals
  for (const f of PLAYER_FIELDS) if (saved[f] !== undefined) p[f] = saved[f];
  p.health = Math.min(p.health, p.maxHealth);
  if (saved.look) game.customizer?.wear(saved.look);
  if (saved.spawn) p.spawn.set(saved.spawn.x, saved.spawn.y, saved.spawn.z);
}

function applyQuests(game, saved) {
  for (const quest of allQuests(game)) {
    const { stage, progress } = saved[quest.id] ?? {};
    if (stage === 'complete') {
      quest.stage = 'complete';
      quest.completedAt = game.elapsed - 9999; // long ago, so the next quest in a chain is ready
      game.questLog.complete(quest.id);
      quest.onFinish(); // what finishing it changed for good (no reward again)
    } else if (stage === 'turnIn') {
      quest.readyToTurnIn();
    } else if (stage === 'active' && !quest.restartsWhenLoaded) {
      quest.start();
      if (progress !== undefined) quest.loadProgress?.(progress);
    }
  }
}

function applyWorld(game, world) {
  game.dayNight.time = world.time;
  if (world.forgeBuilt && !FORGE_SHOP.forgeBuilt) {
    FORGE_SHOP.forgeBuilt = true;
    FORGE_SHOP.onBuilt?.(); // the forge's big new wing
  }
  if (world.boatBuilt) {
    game.boat.built = true;
    game.boat.object3d.visible = true;
  }
  const trapdoor = game.quests.crystal.trapdoor;
  if (world.trapdoorOpen && !trapdoor.open) trapdoor.unlock(game);
  if (world.caveUnlocked && game.charibdisCave.locked) game.charibdisCave.unlock(game);
  const chests = worldChests(game);
  for (const i of world.chests) if (chests[i]) chests[i].opened = true;
  if (world.pipCrystalShown && game.pip) {
    game.pip.openShop();
    if (game.quests.crystal.stage === 'complete') game.quests.crystal.pointToTrapdoor();
  }
  // The trapdoor's quest-log line is done once you've met Old Man Ward.
  if (game.quests.keegan.stage !== 'offer') game.questLog.complete('trapdoor');
}

function placePlayer(game, saved) {
  const { x, y, z } = saved.position;
  game.teleport(x, z, { y, facing: saved.facing });
  game.player.swimming = saved.swimming && !saved.inBoat;
  if (saved.inBoat && game.boat.built) {
    game.boat.object3d.position.x = x;
    game.boat.object3d.position.z = z;
    game.boat.board(game);
  }
}
