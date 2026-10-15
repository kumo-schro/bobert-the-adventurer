// Story checkpoints for the debug menu (press ` in the game), so you can jump straight to any
// part of the story without playing all the way there. They match the sections in story.md.
//
// Each checkpoint has:
//   setup(game)  changes the story/gear the way it would be by this point (runs for every
//                checkpoint before it too, in order, so later ones build on earlier ones)
//   place(game)  puts the player where this part of the story happens
//
// Opening a checkpoint reloads the page with ?checkpoint=<id>, so it always starts fresh.

const npc = (game, name) => game.entities.find((e) => e.name === name);

/** Mark a quest finished without its side effects (nothing spawned, no reward). */
function skipQuest(game, quest) {
  if (quest.stage === 'complete') return;
  quest.stage = 'complete';
  quest.completedAt = game.elapsed - 9999; // long ago, so the next quest in a chain is ready
  game.questLog.complete(quest.id);
}

const go = (game, x, z, extra) => game.teleport(x, z, extra);

export const CHECKPOINTS = [
  {
    id: 'start',
    label: '1. A new adventure (the start)',
    setup() {},
    place() {},
  },
  {
    id: 'merchant-quest',
    label: '2. Off to the mountain cave',
    setup(game) {
      if (game.quests.main.stage === 'offer') game.quests.main.start();
    },
    place(game) {
      const e = game.cave.entrance;
      go(game, e.x - 1, e.z + 2, { facing: Math.PI });
    },
  },
  {
    id: 'slime-fight',
    label: '3. Face the Gelationus Slime',
    setup() {},
    place(game) {
      const b = game.cave.bossSpot;
      go(game, b.x, b.z + 2.5, { facing: Math.PI }); // inside the slime's chamber
    },
  },
  {
    id: 'merchant-done',
    label: '4. Merchant quest done (side quests open up)',
    setup(game) {
      const boss = game.monsters.find((m) => m.artifact);
      if (boss) game.remove(boss);
      skipQuest(game, game.quests.main);
      game.player.addCoins(100);
    },
    place(game) {
      go(game, 0, 0);
    },
  },
  {
    id: 'geared-up',
    label: '5. Side quests done, basic gear',
    setup(game) {
      for (const name of ['Pip', 'Bram', 'Elda', 'Tomas']) skipQuest(game, npc(game, name).quests[0]);
      const p = game.player;
      p.giveShield();
      p.giveBow();
      p.addArrows(20);
      p.giveTool('axe');
      p.giveTool('pickaxe');
      p.addCoins(150);
      p.wood += 15;
      p.stone += 15;
      p.food = ['bread', 'bread', 'pie'];
    },
    place(game) {
      go(game, 0, 0);
    },
  },
  {
    id: 'crystal-quest',
    label: "6. Captain Finn's mystery crystal",
    setup(game) {
      if (game.quests.crystal.stage === 'offer') game.quests.crystal.start();
    },
    place(game) {
      const d = game.dock;
      go(game, d.end - 2, d.z, { facing: Math.PI / 2 });
    },
  },
  {
    id: 'tower-top',
    label: '7. Top of the sea tower (crystal)',
    setup() {},
    place(game) {
      const spot = game.quests.crystal.island.crystalSpot;
      go(game, spot.x + 2, spot.z, { y: spot.y - 0.5, facing: -Math.PI / 2 });
    },
  },
  {
    id: 'crystal-done',
    label: '8. Got the crystal: the old trapdoor',
    setup(game) {
      const q = game.quests.crystal;
      if (q.crystal && game.entities.includes(q.crystal)) game.remove(q.crystal);
      if (q.stage !== 'complete') q.finish(); // Finn lets you keep the crystal
    },
    place(game) {
      const t = game.quests.crystal.trapdoor.object3d.position;
      go(game, t.x + 2, t.z);
    },
  },
  {
    id: 'keegan',
    label: "9. Old Man Keegan's cellar",
    setup(game) {
      game.pip.crystalShown = true; // Pip told you about Keegan
      const trapdoor = game.quests.crystal.trapdoor;
      if (!trapdoor.open) trapdoor.unlock(game);
      game.questLog.complete('trapdoor');
    },
    place(game) {
      const a = game.cellar.arrive;
      go(game, a.x, a.z, { facing: a.facing });
    },
  },
  {
    id: 'kraken',
    label: '10. Hunt the Kraken / Sea Serpent (full gear)',
    setup(game) {
      if (game.quests.keegan.stage === 'offer') game.quests.keegan.start();
      const p = game.player;
      if (p.swordTier < 1) p.upgradeSword();
      if (p.shieldTier < 1) p.upgradeShield();
      if (p.bowTier < 1) p.upgradeBow();
      p.giveArmor();
      p.addArrows(60);
      p.food = ['pie', 'pie', 'pie', 'bread', 'bread'];
    },
    place(game) {
      const k = game.monsters.find((m) => m.constructor.name === 'Kraken')?.object3d.position ?? game.quests.keegan.cave.center;
      go(game, k.x + 14, k.z, { facing: -Math.PI / 2 });
    },
  },
  {
    id: 'charibdis-gate',
    label: "11. Got the key: Charibdis's cave",
    setup(game) {
      const q = game.quests.keegan;
      game.player.hasKey = true;
      q.keyDropped = true;
      q.setObjective("Unlock Charibdis's cave", q.cave);
    },
    place(game) {
      const g = game.charibdisCave.gateSpot;
      go(game, g.x, g.z - 3);
    },
  },
  {
    id: 'charibdis',
    label: '12. Fight Charibdis',
    setup(game) {
      if (game.charibdisCave.locked) game.charibdisCave.unlock(game);
    },
    place(game) {
      const g = game.charibdisCave.gateSpot;
      go(game, g.x, g.z + 6);
    },
  },
  {
    id: 'charibdis-done',
    label: '13. Charibdis slain: to the jungle with Finn',
    setup(game) {
      const q = game.quests.keegan;
      if (q.charibdis && game.monsters.includes(q.charibdis)) game.remove(q.charibdis);
      if (q.stage !== 'complete') q.finish();
    },
    place(game) {
      const f = game.dock.keeperSpot;
      go(game, f.x - 1.5, f.z, { facing: Math.PI / 2 });
    },
  },
  {
    id: 'jungle',
    label: '14. The jungle island',
    setup(game) {
      if (game.quests.jungle.stage === 'offer') game.quests.jungle.start(); // Finn takes you there
    },
    place() {},
  },
  {
    id: 'boat',
    label: '15. Build a boat at the dock',
    setup(game) {
      game.player.visitedJungle = true;
      game.player.wood = Math.max(game.player.wood, 45);
    },
    place(game) {
      const d = game.dock;
      go(game, d.end - 1.5, d.z, { facing: Math.PI / 2 });
    },
  },
  {
    id: 'oak',
    label: "16. Master Oak's challenge",
    setup() {},
    place(game) {
      const o = game.jungle.oakSpot;
      go(game, o.x + 3, o.z, { facing: -Math.PI / 2 });
    },
  },
  {
    id: 'sky-strike',
    label: '17. Master Oak teaches the Sky Strike (knows the spin attack)',
    setup(game) {
      skipQuest(game, game.quests.oak);
      game.player.knowsSpin = true;
      if (game.quests.skyStrike.stage === 'offer') game.quests.skyStrike.start();
    },
    place(game) {
      const o = game.jungle.oakSpot;
      go(game, o.x + 3, o.z, { facing: -Math.PI / 2 });
    },
  },
  {
    id: 'vine',
    label: '18. Fight the Viniac (knows the spin attack and the Sky Strike)',
    setup(game) {
      const q = game.quests.skyStrike;
      for (const post of q.posts ?? []) if (game.entities.includes(post)) game.remove(post);
      skipQuest(game, q);
      game.player.knowsSkyStrike = true;
      if (game.quests.vine.stage === 'offer') game.quests.vine.start();
    },
    place(game) {
      const v = game.jungle.vineSpot;
      go(game, v.x, v.z + 14, { facing: Math.PI });
    },
  },
  {
    id: 'dream',
    label: '19. The dream dimension',
    setup(game) {
      const q = game.quests.vine;
      if (q.vine && game.monsters.includes(q.vine)) game.remove(q.vine);
      if (q.stage !== 'complete') q.finish(); // the dream portal opens
    },
    place(game) {
      game.dreamPortal.enter(game);
    },
  },
  {
    id: 'dream-powers',
    label: '20. All the dream powers, and a magic conduit full of magic',
    setup(game) {
      for (const q of npc(game, 'Dream Keeper').quests) {
        skipQuest(game, q);
        q.onFinish(); // learns its two abilities
      }
      game.player.hasConduit = true;
      game.player.magic = 100;
    },
    place(game) {
      const s = game.dream.shrineSpot;
      go(game, s.x, s.z - 2, { y: s.y, facing: 0 });
    },
  },
  {
    id: 'jackson',
    label: "21. Master Jackson's duel (only a spin attack hits him)",
    setup(game) {
      skipQuest(game, game.quests.findJackson);
    },
    place(game) {
      const j = game.entities.find((e) => e.name === 'Master Jackson').object3d.position;
      go(game, j.x - 2.5, j.z, { facing: Math.PI / 2 });
    },
  },
];

/** Set the game up as it would be at checkpoint `id` (on a freshly loaded game). */
export function applyCheckpoint(game, id) {
  const index = CHECKPOINTS.findIndex((c) => c.id === id);
  if (index === -1) return false;
  for (let i = 0; i <= index; i++) CHECKPOINTS[i].setup(game);
  CHECKPOINTS[index].place(game);
  game.dayNight.time = 0.1; // start in the morning
  game.questLog.toast(`Debug: ${CHECKPOINTS[index].label}`);
  return true;
}
