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
import { FireIsland } from './world/FireIsland.js';
import { Tulane } from './world/Tulane.js';
import { Intro, Ending, introSeen } from './ui/Cutscene.js';
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
import { SavePoint } from './entities/SavePoint.js';
import { colliderAt } from './core/collision.js';
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
import { PauseMenu } from './ui/PauseMenu.js';
import { TitleScreen } from './ui/TitleScreen.js';
import { FloatingText } from './ui/FloatingText.js';
import { BossBar } from './ui/BossBar.js';
import { Tips } from './ui/Tips.js';
import { TouchControls } from './ui/TouchControls.js';
import { Customizer, storedLook } from './ui/Customizer.js';
import { Sound } from './core/Sound.js';
import { ArtifactQuest } from './quest/ArtifactQuest.js';
import {
  FindGemsQuest,
  SlimeHuntQuest,
  RainbowStonesQuest,
  CrystalQuest,
  CharibdisQuest,
  JungleQuest,
  OakDuelQuest,
  VineQuest,
  DreamStarsQuest,
  DreamWispsQuest,
  CloudHopQuest,
  FindJacksonQuest,
  SkyStrikeQuest,
  JacksonDuelQuest,
  VelizarQuest,
  ThomageQuest,
  KingQuest,
} from './quest/sideQuests.js';
import { createShell, createPlank, createWellStone } from './models/gear.js';
import { LOOKS } from './models/people.js';
import { createGecko } from './models/critters.js';
import { SIDE_QUESTS, BLACKSMITH, BAKER, VILLAGER_CHATTER, PIP_CRYSTAL, OLLIE, ZACH, HERALD, TULANE_GUARD } from './story.js';
import { FORGE_SHOP, BAKERY_SHOP, BOAT_MENU, DREAM_SHRINE, BARRETT_SHOP, PIP_SHOP, FINN_TRIPS } from './shops.js';
import { VILLAGE, SEA, PLACES, DREAM, JACKSON, FAME } from './config.js';

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
game.add(new Gathering()); // boulders (before the forest, so trees grow around them)
game.add(new Forest());

// Out at sea: the tower island, little islands to rest on, and Charibdis's locked cave.
const towerIsland = game.add(new TowerIsland());
const smallIslands = SEA.islands.map((island, i) => game.add(new SmallIsland(island, i)));
const charibdisCave = game.add(new CharibdisCave());
const jungle = game.add(new Jungle());
const fireIsland = game.add(new FireIsland()); // the volcano island, open once the Viniac is beaten
const tulane = game.add(new Tulane()); // Tulane Kingdom: the intro starts here, and the story ends here
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
PIP_SHOP.game = game;
const finnTrips = new Shop(FINN_TRIPS);
FINN_TRIPS.game = game;
/** Captain Max's trip menu, from the jungle beach or the fire island. */
const tripsFrom = (here) => () => {
  FINN_TRIPS.here = here;
  finnTrips.open();
};
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
    // After talking to Max you can jump in the sea from any beach, not just the dock.
    onTalk: (g) => {
      if (g.player.canSwimFromBeach) return;
      g.player.canSwimFromBeach = true;
      g.questLog.toast('Captain Max showed you how to swim from any beach!');
    },
    quests: [
      crystalQuest,
      // After Charibdis is slain (and you've told Ward), Max takes you to the jungle.
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
// Max waits on the jungle beach to take you home (or, once the Viniac is beaten, to the fire island).
game.jungleFinn = game.add(
  new Npc({
    name: 'Captain Max',
    look: LOOKS.sailor,
    position: jungle.finnSpot,
    facing: Math.PI,
    interactText: 'Press T to sail with Captain Max',
    onInteract: tripsFrom('jungle'),
  }),
);

// The fire island: Max waits on the beach, and Ani (who studies the volcano) asks you to
// defeat Velizar the dragon.
game.add(
  new Npc({
    name: 'Captain Max',
    look: LOOKS.sailor,
    position: fireIsland.finnSpot,
    facing: Math.PI,
    interactText: 'Press T to sail with Captain Max',
    onInteract: tripsFrom('fire'),
  }),
);
const velizarQuest = new VelizarQuest(game, { island: fireIsland });
game.add(new Npc({ name: 'Ani', look: LOOKS.ember, position: fireIsland.emberSpot, facing: Math.PI, quest: velizarQuest }));

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

// The dream dimension: each of the Dream Keeper's quests teaches two dream abilities. Aleli's shrine
// sells the magic conduit they run on (defeating monsters fills it with magic).
const starsQuest = new DreamStarsQuest(game, { dream });
const wispsQuest = new DreamWispsQuest(game, { dream, makeWisp: (spot) => new Wisp(spot), after: starsQuest });
const hopQuest = new CloudHopQuest(game, { dream, after: wispsQuest });
const thomageQuest = new ThomageQuest(game, { dream, after: hopQuest, delay: 20 });
for (const q of [starsQuest, wispsQuest, hopQuest]) for (const id of q.abilities) DREAM_SHRINE.quests[id] = q;
game.add(
  new Npc({
    name: 'Dream Keeper',
    look: LOOKS.dreamKeeper,
    position: dream.keeperSpot,
    facing: Math.PI,
    quests: [starsQuest, wispsQuest, hopQuest, thomageQuest],
  }),
);
game.add(
  new Npc({
    name: 'Aleli',
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
      new FindGemsQuest(game, {
        id: 'planks',
        story: SIDE_QUESTS.wood,
        count: 5,
        reward: 35,
        itemName: 'fence plank',
        model: createPlank,
        colors: ['#e0483e'],
        after: huntQuest,
        delay: LATER,
      }),
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
    quests: [
      new FindGemsQuest(game, {
        id: 'wellStones',
        story: SIDE_QUESTS.stone,
        count: 5,
        reward: 30,
        itemName: 'well stone',
        model: createWellStone,
        colors: ['#5fa8e8'],
        requires: afterMerchant,
      }),
    ],
  },
];
// Each villager has a house to go to bed in at night.
villagers.forEach((v, i) => {
  game.add(new Npc({ ...v, position: { x: v.at[0], z: v.at[1] }, wander: strolling, home: houses[i].door }));
});
// Pip collects crystals. Show him the mystery crystal and he tells you about Old Man Ward, then
// sells you crystals from his collection (after that, his shop opens unless he has a quest to talk about).
const pip = game.entities.find((e) => e.name === SIDE_QUESTS.gems.giver);
game.pip = pip;
crystalQuest.pip = pip;
/** Pip opens his crystal shop on the plaza for good: from now on he works at his stall. */
pip.openShop = () => {
  pip.crystalShown = true;
  pip.wander = null;
  pip.post = { x: village.pipShopSpot.x, z: village.pipShopSpot.z, facing: village.pipShopFacing };
};
pip.onInteract = (g) => {
  if (!g.player.hasCrystal) return false; // just his quests until then
  if (!pip.crystalShown) {
    pip.say(g, PIP_CRYSTAL.first, () => {
      pip.openShop();
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
  { name: 'Clara', look: LOOKS.gardener },
  { name: 'Emi', look: LOOKS.fisher },
  { name: 'Hatty', look: LOOKS.grandma },
  { name: 'Eve', look: LOOKS.guard },
  { name: 'Evie', look: LOOKS.painter },
];
houses
  .filter((h) => h.outer)
  .forEach((house, i) => {
    const v = neighbours[i % neighbours.length];
    const at = { x: house.door.x + house.front.x * 2, z: house.door.z + house.front.z * 2 };
    game.add(new Npc({ ...v, lines: VILLAGER_CHATTER[v.name], position: at, wander: strolling, home: house.door }));
  });

// Save points: one on every island. Walk up to one and it saves your adventure straight away
// (and if you're knocked out, you get back up at the last one you touched).
const freeSpotNear = (x, z, y = null) => {
  for (let r = 0; r <= 6; r += 1.5) {
    for (let a = 0; a < Math.PI * 2; a += Math.PI / 4) {
      const sx = x + Math.cos(a) * r;
      const sz = z + Math.sin(a) * r;
      if (game.isWalkable(sx, sz, 1) && !colliderAt(sx, sz, game.colliders) && !colliderAt(sx + 1, sz, game.colliders) && !colliderAt(sx - 1, sz, game.colliders)) {
        return { x: sx, y: y ?? game.heightAt(sx, sz), z: sz };
      }
      if (r === 0) break;
    }
  }
  return { x, y: y ?? game.heightAt(x, z), z };
};
const towerSide = PLACES.towerIsland;
const villageSave = freeSpotNear(-4, 4);
for (const [spot, name] of [
  [villageSave, 'the village save point'],
  [freeSpotNear(towerSide.x - towerSide.radius + 6, towerSide.z), 'the tower island save point'],
  ...smallIslands.map((s) => [freeSpotNear(s.center.x - 2, s.center.z + 2), 'a little island save point']),
  [freeSpotNear(jungle.arrive.x + 5, jungle.arrive.z - 3), 'the jungle save point'],
  [freeSpotNear(fireIsland.arrive.x - 5, fireIsland.arrive.z + 3), 'the fire island save point'],
  [freeSpotNear(dream.arrive.x + 3, dream.arrive.z - 2, dream.y), 'the dream save point'],
  [freeSpotNear(tulane.captainSpot.x - 4, tulane.captainSpot.z - 2), 'the Tulane save point'],
]) {
  game.add(new SavePoint(spot, name));
}
// Master Zach, who taught Master Oak and Master Jackson, lives on the island toward the sunset.
const zachIsland = smallIslands.find((s) => s.center.x < 0 && s.center.z > 0) ?? smallIslands[0];
game.add(new Npc({ name: 'Master Zach', look: LOOKS.zach, lines: ZACH, position: freeSpotNear(zachIsland.center.x + 2, zachIsland.center.z - 1), facing: Math.PI / 2 }));
// Tulane Kingdom: King Stuart on his throne (the last boss, once you're famous again), his guards,
// and Captain Max at the pier to sail you home.
const kingQuest = new KingQuest(game, { requires: () => player.fame >= FAME.needed });
game.kingNpc = game.add(new Npc({ name: 'King Stuart', look: LOOKS.king, position: tulane.kingSpot, facing: Math.PI, quest: kingQuest }));
for (const spot of tulane.guardSpots) game.add(new Npc({ name: 'Tulane Guard', look: LOOKS.soldier, lines: TULANE_GUARD, position: spot, facing: spot.facing }));
game.add(
  new Npc({
    name: 'Captain Max',
    look: LOOKS.sailor,
    position: tulane.captainSpot,
    facing: Math.PI,
    interactText: 'Press T to sail with Captain Max',
    onInteract: tripsFrom('tulane'),
  }),
);
// Once Bobert is famous again, Tulane's herald waits in Crestview Village to take him back.
const herald = game.add(new Npc({ name: 'Tulane Herald', look: LOOKS.herald, position: freeSpotNear(3, -3.5), facing: 0 }));
herald.onInteract = (g) => {
  herald.say(g, HERALD, () => {
    tulane.travel(g);
    g.questLog.set('tulane', { title: 'The King of Tulane', objective: 'Face King Stuart on his throne', target: g.kingNpc });
    g.questLog.toast('Tulane Kingdom. Home... sort of.', 4);
  });
  return true;
};
const updateHerald = () => {
  const famous = player.fame >= FAME.needed && kingQuest.stage !== 'complete';
  herald.setHidden(!famous);
  if (famous && kingQuest.stage === 'offer' && !game.questLog.entries.has('tulane')) {
    game.questLog.set('tulane', { title: 'The King of Tulane', objective: 'Your fame has spread across the sea! A herald from Tulane is waiting in Crestview Village.', target: herald });
  }
};
game.onFamous = () => {
  updateHerald();
  game.questLog.toast('Your fame has spread across the sea... A herald from Tulane Kingdom has come to Crestview!', 6);
};
// Ollie (new in town) stands by the village save point and tells you how it works.
game.add(new Npc({ name: 'Ollie', look: LOOKS.ollie, lines: OLLIE, position: freeSpotNear(villageSave.x + 2.2, villageSave.z), facing: Math.PI }));

// UI after the characters, so the key that closes a dialog doesn't also swing the sword.
game.add(new Dialog());
game.add(forgeShop);
game.add(bakeryShop);
game.add(boatMenu);
game.add(dreamShrine);
game.add(barrettShop);
game.add(pipShop);
game.add(finnTrips);
game.add(new QuestLog());
game.add(new StatusBar());
game.add(new BossBar()); // a big health bar while you fight a boss
game.add(new Tips()); // how-to-play tips, each once, when they're useful
game.add(new TouchControls()); // a stick and buttons on phones and tablets
game.add(new ControlsMenu());
const debugMenu = game.add(new DebugMenu());
game.add(new Suggestions()); // /: click on something and suggest a change
const saveMenu = game.add(new SaveMenu()); // name and save your adventure, or load one
const customizer = game.add(new Customizer()); // P: pick how Bobert looks
game.add(new PauseMenu()); // Esc (after the menus it opens, so it knows when they close)
const titleScreen = game.add(new TitleScreen());
game.add(new Sound()); // sword swishes and hits (M turns sound off)
mainQuest.announce();

// Camera last so it follows the player's final position each frame
game.add(new CameraRig(player));
game.add(new Underwater()); // after the camera: switches to the underwater look when it dips below the waves
const intro = game.add(new Intro()); // after the camera, so it can move the camera during the cutscene
game.add(new Ending());
game.add(new FloatingText()); // last, so the damage numbers follow the camera's final position

game.quests.oak = oakDuel;
game.quests.vine = vineQuest;
game.quests.findJackson = findJackson;
game.quests.skyStrike = skyStrike;
game.quests.jacksonDuel = jacksonDuel;
game.quests.velizar = velizarQuest;
game.quests.king = kingQuest;
game.quests.stars = starsQuest;
game.quests.thomage = thomageQuest;

// Opened with ?checkpoint=... (from the debug menu)? Jump to that point in the story.
debugMenu.start();
const checkpoint = new URLSearchParams(location.search).has('checkpoint');
// Bobert's look from last time, then a saved game to load (the page reloaded for it), which
// brings its own look.
const firstVisit = !storedLook() && !checkpoint;
customizer.start();
const loaded = saveMenu.start();
updateHerald();
// Otherwise, the title screen. A new adventure starts by picking how Bobert looks (the first
// time), then the intro in Tulane Kingdom.
if (!loaded && !checkpoint) {
  titleScreen.open({
    onNew: () => {
      if (firstVisit) customizer.open();
      if (!introSeen()) intro.queue();
    },
  });
}

game.start();

// The world is built: fade the loading screen away.
const loading = document.getElementById('loading');
loading?.classList.add('done');
setTimeout(() => loading?.remove(), 600);

// Handy for poking at things from the browser console.
window.game = game;
