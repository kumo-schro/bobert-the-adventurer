import { Game } from './core/Game.js';
import { Sky } from './world/Sky.js';
import { Lighting } from './world/Lighting.js';
import { Mountains } from './world/Mountains.js';
import { Water } from './world/Water.js';
import { Ground } from './world/Ground.js';
import { Dock } from './world/Dock.js';
import { TowerIsland } from './world/TowerIsland.js';
import { SmallIsland } from './world/SmallIsland.js';
import { CharibdisCave } from './world/CharibdisCave.js';
import { Road } from './world/Road.js';
import { Cellar } from './world/Cellar.js';
import { DayNight } from './world/DayNight.js';
import { Gathering } from './world/Gathering.js';
import { Jungle } from './world/Jungle.js';
import { Underwater } from './world/Underwater.js';
import { DreamWorld, DreamPortal } from './world/Dream.js';
import { Wisp } from './entities/Wisp.js';
import { Village } from './world/Village.js';
import { Cave } from './world/Cave.js';
import { StoneCircle } from './world/StoneCircle.js';
import { Flowers } from './world/Flowers.js';
import { Forest } from './world/Forest.js';
import { Clouds } from './world/Clouds.js';
import { Butterflies } from './entities/Butterflies.js';
import { Particles } from './entities/Particles.js';
import { Player } from './entities/Player.js';
import { Npc } from './entities/Npc.js';
import { Grayson } from './entities/Grayson.js';
import { Shark } from './entities/Shark.js';
import { Eel } from './entities/Eel.js';
import { Kraken } from './entities/Kraken.js';
import { Charibdis } from './entities/Charibdis.js';
import { Trapdoor } from './entities/Trapdoor.js';
import { Boat } from './entities/Boat.js';
import { CameraRig } from './entities/CameraRig.js';
import { Dialog } from './ui/Dialog.js';
import { Shop } from './ui/Shop.js';
import { QuestLog } from './ui/QuestLog.js';
import { StatusBar } from './ui/StatusBar.js';
import { ControlsMenu } from './ui/ControlsMenu.js';
import { DebugMenu } from './ui/DebugMenu.js';
import { Suggestions } from './ui/Suggestions.js';
import { SaveMenu } from './ui/SaveMenu.js';
import { Customizer, storedLook } from './ui/Customizer.js';
import { Sound } from './core/Sound.js';
import { ArtifactQuest } from './quest/ArtifactQuest.js';
import {
  FindGemsQuest,
  SlimeHuntQuest,
  RainbowStonesQuest,
  CrystalQuest,
  CharibdisQuest,
  DeliveryQuest,
  JungleQuest,
  OakDuelQuest,
  VineQuest,
  DreamStarsQuest,
  DreamWispsQuest,
  CloudHopQuest,
  FindJacksonQuest,
  SkyStrikeQuest,
  JacksonDuelQuest,
} from './quest/sideQuests.js';
import { createShell } from './models/gear.js';
import { LOOKS } from './models/people.js';
import { createGecko } from './models/critters.js';
import { SIDE_QUESTS, BLACKSMITH, BAKER, VILLAGER_CHATTER, PIP_CRYSTAL } from './story.js';
import { FORGE_SHOP, BAKERY_SHOP, BOAT_MENU, DREAM_SHRINE, BARRETT_SHOP, PIP_SHOP } from './shops.js';
import { VILLAGE, SEA, PLACES, DREAM, JACKSON } from './config.js';

const game = new Game(document.getElementById('app'));

// Background
game.add(new Sky());
game.add(new Lighting());
game.add(new Mountains());
game.add(new Water());
game.add(new Clouds());
game.add(new DayNight());

// The island. Ground comes first, then places that reserve their space (dock, village, road,
// cave mountain, stone circle), then scenery that fills in around them.
game.add(new Ground());
const dock = game.add(new Dock());
const village = game.add(new Village());
const road = game.add(new Road(village, dock));
const cellar = game.add(new Cellar());
const trapdoor = game.add(new Trapdoor(road.trapdoorSpot, cellar));
cellar.trapdoor = trapdoor;
const cave = game.add(new Cave());
const stoneCircle = game.add(new StoneCircle());
game.add(new Flowers());
game.add(new Gathering()); // boulders to mine (before the forest, so trees grow around them)
game.add(new Forest());

// Out at sea: the tower island, little islands to rest on, and Charibdis's locked cave.
const towerIsland = game.add(new TowerIsland());
SEA.islands.forEach((island, i) => game.add(new SmallIsland(island, i)));
const charibdisCave = game.add(new CharibdisCave());
const jungle = game.add(new Jungle());
game.add(new DreamPortal(jungle.portalSpot)); // opens once the Vine is beaten
const dream = game.add(new DreamWorld());
dream.addWanderingWisps(game, (spot) => new Wisp(spot), { respawnSeconds: DREAM.wispRespawn });

// Living things. The player spawns in the middle of the village plaza.
game.add(new Particles());
game.add(new Butterflies());
const player = game.add(new Player({ x: 0, z: 0 }));
for (const spot of SEA.sharks) game.add(new Shark(spot));
game.add(new Grayson(game)); // a friendly fish who gives free buffs (and turns up all over the sea)

// Shops (their menus open when you talk to the shopkeeper).
const forgeShop = new Shop(FORGE_SHOP);
FORGE_SHOP.onBuilt = () => village.upgradeForge(game); // the forge grows a big new wing
const bakeryShop = new Shop(BAKERY_SHOP);
const boatMenu = new Shop(BOAT_MENU);
const dreamShrine = new Shop(DREAM_SHRINE);
const barrettShop = new Shop(BARRETT_SHOP);
const pipShop = new Shop(PIP_SHOP);
BARRETT_SHOP.game = game;
BOAT_MENU.game = game;
game.add(new Boat(dock, boatMenu)); // built at the end of the dock once you've been to the jungle

// Townsfolk. The merchant waits at the market stall with the main quest; the villagers
// stroll around the village with side quests ("!" over their heads) once you've helped the
// merchant, and come up with new ones over time. Everyone in town goes home at night.
const mainQuest = new ArtifactQuest(game, { cave });
game.mainQuest = mainQuest;
const afterMerchant = () => mainQuest.stage === 'complete';
const LATER = 60; // seconds before a villager has a new quest for you
const houses = village.houses;
const nearestHouse = (spot) => [...houses].sort((a, b) => Math.hypot(a.door.x - spot.x, a.door.z - spot.z) - Math.hypot(b.door.x - spot.x, b.door.z - spot.z))[0];
game.add(
  new Npc({
    name: 'Merchant',
    look: LOOKS.merchant,
    position: village.merchantSpot,
    facing: village.merchantFacing,
    quest: mainQuest,
    home: nearestHouse(village.merchantSpot).door,
  }),
);
game.add(
  new Npc({
    name: BLACKSMITH.name,
    look: LOOKS.blacksmith,
    position: village.blacksmithSpot,
    facing: village.blacksmithFacing,
    interactText: 'Press T to shop at the forge',
    onInteract: () => forgeShop.open(),
    home: village.forgeDoor,
  }),
);
game.add(
  new Npc({
    name: BAKER.name,
    look: LOOKS.baker,
    position: village.bakerSpot,
    facing: village.bakerFacing,
    interactText: 'Press T to buy food',
    onInteract: () => bakeryShop.open(),
    home: nearestHouse(village.bakerSpot).door,
  }),
);
const keeganQuest = new CharibdisQuest(game, {
  cave: charibdisCave,
  makeKraken: () => new Kraken(PLACES.kraken),
  makeSerpent: () => new Eel(PLACES.seaSerpent, { kind: 'serpent' }),
  makeCharibdis: () => new Charibdis(charibdisCave.lairSpot),
});
const crystalQuest = new CrystalQuest(game, { island: towerIsland, trapdoor, requires: afterMerchant });
const jungleQuest = new JungleQuest(game, { jungle, after: crystalQuest, requires: () => keeganQuest.stage === 'complete' });
// The big story quests, by name (the debug menu's checkpoints use these).
game.quests = { main: mainQuest, crystal: crystalQuest, keegan: keeganQuest, jungle: jungleQuest };
game.add(
  new Npc({
    name: SIDE_QUESTS.crystal.giver,
    look: LOOKS.sailor,
    position: dock.keeperSpot,
    facing: -Math.PI / 2,
    // After talking to Finn you can jump in the sea from any beach, not just the dock.
    onTalk: (g) => {
      if (g.player.canSwimFromBeach) return;
      g.player.canSwimFromBeach = true;
      g.questLog.toast('Captain Finn showed you how to swim from any beach!');
    },
    quests: [
      crystalQuest,
      // After Charibdis is slain (and you've told Keegan), Finn takes you to the jungle.
      jungleQuest,
    ],
  }),
);
game.add(
  new Npc({
    name: SIDE_QUESTS.charibdis.giver,
    look: LOOKS.oldMan,
    position: cellar.keeganSpot,
    facing: -2.3,
    quest: keeganQuest,
  }),
);
// Finn waits on the jungle beach to take you home.
game.add(
  new Npc({
    name: 'Captain Finn',
    look: LOOKS.sailor,
    position: jungle.finnSpot,
    facing: Math.PI,
    interactText: 'Press T to go home with Captain Finn',
    onInteract: (g) => {
      g.teleport(dock.keeperSpot.x - 1.5, dock.keeperSpot.z, { facing: -Math.PI / 2 });
      g.questLog.toast('Back home at the dock!');
    },
  }),
);

// Master Oak, in his jungle clearing: beat him to learn the spin attack, then he teaches the Sky
// Strike, then you take on the Viniac. After that he sends you to find his old friend Master
// Jackson, who dodges everything but a spin attack, and teaches you to dodge.
const oakDuel = new OakDuelQuest(game);
const skyStrike = new SkyStrikeQuest(game, { place: jungle.oakSpot, after: oakDuel });
const vineQuest = new VineQuest(game, { jungle, after: skyStrike });
const findJackson = new FindJacksonQuest(game, { after: vineQuest });
game.add(
  new Npc({
    name: 'Master Oak',
    look: LOOKS.oak,
    position: jungle.oakSpot,
    facing: Math.PI / 2,
    quests: [oakDuel, skyStrike, vineQuest, findJackson],
  }),
);
const jacksonDuel = new JacksonDuelQuest(game, { requires: () => findJackson.stage === 'complete' });
findJackson.jackson = game.add(
  new Npc({
    name: 'Master Jackson',
    look: LOOKS.jackson,
    position: JACKSON.island,
    facing: -Math.PI / 2,
    quests: [jacksonDuel],
    onTalk: () => findJackson.found(), // Oak sent you to find him: found him!
  }),
);

// Barrett the gecko, near the jungle beach: he loves coins, and sells buffs for them.
game.add(
  new Npc({
    name: 'Barrett',
    createModel: createGecko,
    position: jungle.barrettSpot,
    facing: Math.PI,
    interactText: 'Press T to see Barrett the gecko',
    onInteract: () => barrettShop.open(),
  }),
);

// The dream dimension: each of the Dream Keeper's quests teaches two dream abilities. Luma's shrine
// sells the magic conduit they run on (defeating monsters fills it with magic).
const starsQuest = new DreamStarsQuest(game, { dream });
const wispsQuest = new DreamWispsQuest(game, { dream, makeWisp: (spot) => new Wisp(spot), after: starsQuest });
const hopQuest = new CloudHopQuest(game, { dream, after: wispsQuest });
for (const q of [starsQuest, wispsQuest, hopQuest]) for (const id of q.abilities) DREAM_SHRINE.quests[id] = q;
game.add(
  new Npc({
    name: 'Dream Keeper',
    look: LOOKS.dreamKeeper,
    position: dream.keeperSpot,
    facing: Math.PI,
    quests: [starsQuest, wispsQuest, hopQuest],
  }),
);
game.add(
  new Npc({
    name: 'Luma',
    look: LOOKS.sprite,
    position: dream.shrineSpot,
    facing: Math.PI,
    interactText: 'Press T to visit the dream shrine',
    onInteract: () => dreamShrine.open(),
  }),
);

const strolling = { x: 0, z: 0, radius: VILLAGE.wanderRadius };
const gemsQuest = new FindGemsQuest(game, { requires: afterMerchant });
const huntQuest = new SlimeHuntQuest(game, { requires: afterMerchant });
const puzzleQuest = new RainbowStonesQuest(game, { circle: stoneCircle, requires: afterMerchant });
const villagers = [
  {
    name: SIDE_QUESTS.gems.giver,
    look: LOOKS.kid,
    at: [6, 5],
    quests: [
      gemsQuest,
      new FindGemsQuest(game, {
        id: 'shells',
        story: SIDE_QUESTS.shells,
        count: 5,
        reward: 30,
        where: 'beach',
        itemName: 'seashell',
        model: createShell,
        colors: ['#ffb3c7', '#ffd6a5', '#cdb4ff', '#a0e7e5', '#fff1a8'],
        after: gemsQuest,
        delay: LATER,
      }),
    ],
  },
  {
    name: SIDE_QUESTS.hunt.giver,
    look: LOOKS.farmer,
    at: [-6, 4],
    quests: [
      huntQuest,
      new DeliveryQuest(game, { id: 'wood', story: SIDE_QUESTS.wood, material: 'wood', amount: 10, reward: 35, after: huntQuest, delay: LATER }),
    ],
  },
  {
    name: SIDE_QUESTS.puzzle.giver,
    look: LOOKS.elder,
    at: [-4, -6],
    quests: [puzzleQuest, new RainbowStonesQuest(game, { circle: stoneCircle, reverse: true, after: puzzleQuest, delay: LATER })],
  },
  {
    name: SIDE_QUESTS.stone.giver,
    look: LOOKS.villager,
    at: [5, -4],
    quests: [new DeliveryQuest(game, { id: 'stone', story: SIDE_QUESTS.stone, material: 'stone', amount: 8, reward: 30, requires: afterMerchant })],
  },
];
// Each villager has a house to go to bed in at night.
villagers.forEach((v, i) => {
  game.add(new Npc({ ...v, position: { x: v.at[0], z: v.at[1] }, wander: strolling, home: houses[i].door }));
});
// Pip collects crystals. Show him the mystery crystal and he tells you about Old Man Keegan, then
// sells you crystals from his collection (after that, his shop opens unless he has a quest to talk about).
const pip = game.entities.find((e) => e.name === SIDE_QUESTS.gems.giver);
game.pip = pip;
crystalQuest.pip = pip;
pip.onInteract = (g) => {
  if (!g.player.hasCrystal) return false; // just his quests until then
  if (!pip.crystalShown) {
    pip.say(g, PIP_CRYSTAL.first, () => {
      pip.crystalShown = true;
      crystalQuest.pointToTrapdoor();
      pipShop.open();
    });
    return true;
  }
  if (pip.quest?.marker) return false; // a quest to give or hand in comes first
  pipShop.open();
  return true;
};
// More villagers, living in the outer ring of houses.
const neighbours = [
  { name: 'Rosa', look: LOOKS.gardener },
  { name: 'Milo', look: LOOKS.fisher },
  { name: 'Greta', look: LOOKS.grandma },
  { name: 'Juno', look: LOOKS.guard },
  { name: 'Wren', look: LOOKS.painter },
];
houses
  .filter((h) => h.outer)
  .forEach((house, i) => {
    const v = neighbours[i % neighbours.length];
    const at = { x: house.door.x + house.front.x * 2, z: house.door.z + house.front.z * 2 };
    game.add(new Npc({ ...v, lines: VILLAGER_CHATTER[v.name], position: at, wander: strolling, home: house.door }));
  });

// UI after the characters, so the key that closes a dialog doesn't also swing the sword.
game.add(new Dialog());
game.add(forgeShop);
game.add(bakeryShop);
game.add(boatMenu);
game.add(dreamShrine);
game.add(barrettShop);
game.add(pipShop);
game.add(new QuestLog());
game.add(new StatusBar());
game.add(new ControlsMenu());
const debugMenu = game.add(new DebugMenu());
game.add(new Suggestions()); // 💡 click on something and suggest a change
const saveMenu = game.add(new SaveMenu()); // 💾 Esc: name and save your adventure, or load one
const customizer = game.add(new Customizer()); // 👕 P: pick how Bobert looks
game.add(new Sound()); // sword swishes and hits (M turns sound off)
mainQuest.announce();

// Camera last so it follows the player's final position each frame
game.add(new CameraRig(player));
game.add(new Underwater()); // after the camera: switches to the underwater look when it dips below the waves

game.quests.oak = oakDuel;
game.quests.vine = vineQuest;
game.quests.findJackson = findJackson;
game.quests.skyStrike = skyStrike;
game.quests.jacksonDuel = jacksonDuel;
game.quests.stars = starsQuest;

// Opened with ?checkpoint=... (from the debug menu)? Jump to that point in the story.
debugMenu.start();
// Bobert's look from last time, then a saved game to load (the page reloaded for it), which
// brings its own look. A brand-new player starts by picking how Bobert looks.
const firstVisit = !storedLook() && !new URLSearchParams(location.search).has('checkpoint');
customizer.start();
const loaded = saveMenu.start();
if (firstVisit && !loaded) customizer.open();

game.start();

// Handy for poking at things from the browser console.
window.game = game;
