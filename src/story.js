// All the words characters say live here, so the story is easy to read and change.

import { MENU_KEYS } from './controls.js';

export const MAIN_QUEST = {
  title: 'The Precious Artifact',
  text: {
    // Exact wording from theme.md.
    offer: [
      'The village as we know it is in imminent danger you must slay a Gelationus Slime to retrieve our villages precious artifact. you will be rewarded handsomely',
    ],
    active: [
      'The Gelationus Slime hides in the cave inside the mountain. Follow the arrow at the top of the screen!',
      'Watch out for spiders in the tunnel. The blacksmith sells shields, swords, bows and armor, if you have the coins.',
      'And take some food from Hana the baker. Press F to eat it when you get hurt!',
    ],
    turnIn: [
      'You did it! Our precious artifact is safe once more.',
      'As promised, you will be rewarded handsomely. Here are 100 gold coins!',
    ],
    complete: ['Thank you, hero! The whole village is safe because of you.'],
  },
};

export const OBJECTIVES = {
  meet: 'Talk to the merchant at the market stall',
  slay: 'Slay the Gelationus Slime in the mountain cave',
  pickup: 'Pick up the precious artifact',
};

export const TOASTS = {
  slimeAppeared: 'A Gelationus Slime is lurking in the mountain cave!',
  slimeDefeated: 'You slew the Gelationus Slime!',
  artifact: 'You got the precious artifact!',
};

export const SIDE_QUESTS = {
  gems: {
    giver: 'Pip',
    title: 'Lost Gems',
    text: {
      offer: [
        'Oh no, oh no! I was juggling my shiny gems and they flew all over the island!',
        'Can you find all 6 of them? They glow, so look for beams of light! Some went really far.',
      ],
      active: ['Look for the beams of light around the island. The arrow points to the closest gem!'],
      turnIn: ['My gems! All of them! You are the best gem finder ever. Here, take some coins!'],
      complete: ['I am never juggling gems again. Probably.'],
    },
  },
  hunt: {
    giver: 'Bram',
    title: 'Slime Trouble',
    text: {
      offer: [
        'Howdy! Some blue slimes are hopping around the meadow and squishing my cabbages.',
        'Could you shoo them away with that sword of yours? There are 5 of them, and they are tougher than they look!',
      ],
      active: ['Those blue slimes are in the meadow. Follow the arrow, and swing that sword!'],
      turnIn: ['My cabbages are saved! Thank you kindly. Here is a little something for your trouble.'],
      complete: ['The cabbages are growing big and happy now.'],
    },
  },
  puzzle: {
    giver: 'Elda',
    title: 'The Rainbow Stones',
    text: {
      offer: [
        'Hello, dearie. Out past the trees there is a ring of old standing stones.',
        'Legend says if you step on the colored stones in rainbow order, a treasure appears!',
        'Red, orange, yellow, green, blue, then purple. Step on a wrong one and you must start over.',
      ],
      active: ['Remember: red, orange, yellow, green, blue, purple. Just like a rainbow!'],
      turnIn: ['You solved the riddle of the stones! I knew you could do it. Keep the treasure, dearie.'],
      complete: ['Those old stones have not glowed like that in a hundred years.'],
    },
  },
  crystal: {
    giver: 'Captain Finn',
    title: 'The Mystery Crystal',
    text: {
      offer: [
        'Ahoy there! See that little island out at sea, with the old tower on it?',
        'Folks say a mystery crystal glows at the very top. I would fetch it myself, but my knees are too creaky for all those stairs.',
        'Walk off the end of my dock to jump in and swim there. Mind the sharks, and watch out for the zappy eels by the rocks!',
      ],
      active: [
        'Swim out to the tower island and climb the stairs to the top. Sharks bite, but eels zap even harder, so keep away from the rocks!',
        'To swim home, just walk off the island beach. If you get hurt, eat some food with F.',
      ],
      turnIn: [
        'Shiver me timbers, you found it! Look how it sparkles...',
        'Wait a moment. I know that shape! It fits the lock on the old trapdoor outside of town, by the road.',
        'Keep the crystal, matey, and take these coins too. Old Man Keegan lives down there. He knows the secrets of the sea.',
      ],
      complete: ['Have you opened the old trapdoor yet? It is just off the road to my dock.'],
    },
  },
  charibdis: {
    giver: 'Old Man Keegan',
    title: 'Slay Charibdis',
    text: {
      offer: [
        'Well, well! A visitor! Nobody has opened that trapdoor in fifty years.',
        'Listen close. Far out at sea there is a rocky cave full of water, and in it lives Charibdis: a fish with a huge mouth, covered in eyes!',
        'Its whirlpool sinks ships. Anyone caught in it gets hurt every few seconds, so wait until the whirlpool stops, then strike!',
        'The cave is locked. The key was swallowed by either the Kraken or the Sea Serpent. Defeat one of them to get it.',
        'The Kraken slams its tentacles down: when you see the red circle, swim away! The Sea Serpent is a huge, fast eel.',
        'Go now, and slay Charibdis!',
      ],
      active: [
        'Defeat the Kraken or the Sea Serpent for the key, then unlock the cave and slay Charibdis.',
        'Remember: stay out of the whirlpool! Strike when it stops. Food from Hana will help.',
      ],
      turnIn: ['You... you slew Charibdis?! The seas are safe at last! Take my treasure, hero. You have earned every coin.'],
      complete: ['Ahh, I can finally sleep without hearing that whirlpool. Thank you, hero.'],
    },
  },
};

// More quests the villagers give you over time (after their first one).
Object.assign(SIDE_QUESTS, {
  shells: {
    giver: 'Pip',
    title: 'Seashell Hunt',
    text: {
      offer: [
        'Guess what? I am starting a seashell collection! But the waves keep washing them away.',
        'Can you find 5 pretty seashells on the beaches around the island? Look for the beams of light!',
      ],
      active: ['The seashells are on the sandy beaches all around the island. Follow the arrow!'],
      turnIn: ['Ooh, they are SO pretty! This one sounds like the sea. Thank you, here are some coins!'],
      complete: ['My seashell collection is the best in the whole village.'],
    },
  },
  wood: {
    giver: 'Bram',
    title: 'Fence Mending',
    text: {
      offer: [
        'Those slimes squashed my fence flat! I need wood to build a new one.',
        'Could you bring me 10 wood? Chop trees with an axe: the blacksmith sells them. Just press T next to a tree.',
      ],
      active: ['I need 10 wood for my fence. Chop trees with an axe (press T next to a tree).'],
      turnIn: ['That is plenty of wood! My fence will be stronger than ever. Thank you, partner!'],
      complete: ['Not a single slime has gotten through my new fence.'],
    },
  },
  reverse: {
    giver: 'Elda',
    title: 'The Backwards Rainbow',
    text: {
      offer: [
        'The stones are humming again, dearie. I found another riddle in my old book.',
        'This time the rainbow goes BACKWARDS: purple, blue, green, yellow, orange, then red.',
        'Solve it and the stones will give you another treasure!',
      ],
      active: ['Backwards this time: purple, blue, green, yellow, orange, red.'],
      turnIn: ['Backwards and all! You are cleverer than I was at your age. Keep the treasure, dearie.'],
      complete: ['I wonder what other secrets those old stones are hiding...'],
    },
  },
  stone: {
    giver: 'Tomas',
    title: 'Stones for the Well',
    text: {
      offer: [
        'Lovely day! Say, the old well is getting a bit wobbly.',
        'Could you bring me 8 stone to fix it? Mine the big boulders with a pickaxe (press T next to one). The blacksmith sells pickaxes.',
        `And a tip: press ${MENU_KEYS.panels} to see your quests and controls, and ${MENU_KEYS.controls} to change the keys!`,
      ],
      active: ['8 stone for the well, please! Mine the boulders around the island with a pickaxe.'],
      turnIn: ['Wonderful! The well will be good as new. Here, take these coins.'],
      complete: [
        'Lovely day for a walk! Drag the mouse, or press Q and E to turn the camera. C puts it right behind you.',
        'Captain Finn at the dock on the east beach is looking for a brave swimmer.',
      ],
    },
  },
  jungle: {
    giver: 'Captain Finn',
    title: 'The Jungle Island',
    text: {
      offer: [
        'Ahoy, hero! Old Keegan told me you slew Charibdis! Now the sea is safe, I can show you something.',
        'Far away there is a wild jungle island. I know a secret way there through the sea currents.',
        'But beware: giant Venus fly traps grow there. They cannot move and they bite slowly, but one bite really hurts! One good hit and they are done for.',
        'Hold on tight... here we go!',
      ],
      active: [
        'Defeat the giant Venus fly traps in the jungle. Strike when their mouth is closed, and step back when it opens!',
        'Talk to me on the jungle beach when you want to go home.',
      ],
      turnIn: ['You cleared out the fly traps! You are the bravest explorer on the seven seas. Here is your reward!'],
      complete: ['Back to the jungle, matey? Hold on tight! (Talk to me on the jungle beach to come home.)'],
    },
  },
});

// The jungle and the dream dimension.
Object.assign(SIDE_QUESTS, {
  oak: {
    giver: 'Master Oak',
    title: 'The Spin Attack',
    text: {
      offer: [
        'Hmm. A young adventurer, deep in my jungle. I am Master Oak.',
        'I know a secret sword move: the SPIN ATTACK. But I only teach those who can beat me in battle.',
        'Be warned: I begin with my own spin attack, and it hurts a LOT. Then I must charge up the next one.',
        'While my staff glows, strike fast! When it sparkles, it is ready, so stay out of reach or I will spin again. I am old and slow, but I do not flinch!',
        'Are you ready? Then let us begin!',
      ],
      active: ['Defeat Master Oak in battle! Strike while his staff charges, and keep away when it sparkles.'],
      turnIn: [
        'Ha! You have beaten me, fair and square. Now, the spin attack:',
        'Hold down your sword button after a swing until your sword sparkles. Then let go, and spin round to hit everything near you!',
      ],
      complete: ['Practice your spin, young one. It will serve you well against the Vine.'],
    },
  },
  vine: {
    giver: 'Master Oak',
    title: 'The Vine',
    text: {
      offer: [
        'Now hear me. To the east grows the Vine, the boss of this jungle. A giant plant with arms like a kraken.',
        'Its arms SLAM down where you stand, and that hurts a lot! When you see a red circle under your feet, run!',
        'Defeat the Vine and the jungle will be free. It takes many, many hits. Use everything you have learned.',
      ],
      active: ['The Vine grows to the east. Watch for the red circles, and keep hitting it!'],
      turnIn: [
        'You did it! The Vine is gone, and look... where it grew, a portal has opened!',
        'They say it leads to the dream dimension, where the Dream Keeper gives out dream points. With enough of them, you can learn amazing powers.',
      ],
      complete: ['The dream portal is to the east, where the Vine used to grow.'],
    },
  },
  stars: {
    giver: 'Dream Keeper',
    title: 'Fallen Stars',
    text: {
      offer: [
        'Welcome, dreamer. I am the Dream Keeper. This is where dreams are made.',
        'Some of my stars have fallen onto the dream islands. Catch them all and I will give you dream points.',
        'Spend dream points at the shrine, where Luma will teach you dream powers!',
      ],
      active: ['The fallen stars are on the floating islands. Cross the rainbow bridges to find them.'],
      turnIn: ['My stars! They shine so brightly again. Here are 3 dream points.'],
      complete: ['Every star you saved is a happy dream for someone.'],
    },
  },
  wisps: {
    giver: 'Dream Keeper',
    title: 'Nightmare Wisps',
    text: {
      offer: [
        'Oh dear. Nightmare wisps are floating around the islands, giving everyone bad dreams.',
        'Chase them away! They sting a little, but two good hits will pop them.',
      ],
      active: ['Chase away the nightmare wisps on the floating islands.'],
      turnIn: ['Sweet dreams have returned! Thank you. Here are 3 more dream points.'],
      complete: ['No more nightmares. Well... not today.'],
    },
  },
  hop: {
    giver: 'Dream Keeper',
    title: 'Above the Clouds',
    text: {
      offer: [
        'One last thing. A staircase of clouds climbs to the very top of the dream.',
        'Jump from cloud to cloud (each one is higher than the last) and catch the star at the summit.',
      ],
      active: ['Jump up the cloud stones (press Space) to reach the summit.'],
      turnIn: ['You reached the top of the dream! You are a true dreamer. Here are 2 dream points.'],
      complete: ['Come back whenever you like, dreamer. The dream is always here.'],
    },
  },
});

// What side-quest givers say before you've helped the merchant.
export const QUEST_LOCKED = [
  'Oh, hello there! I could really use some help...',
  'But the merchant at the market stall needs you more right now. Go talk to them first, then come back!',
];

// What a villager says while they don't have a new quest for you yet.
export const COME_BACK_LATER = ['Come back a little later. I might need your help again!'];

export const VILLAGER_CHATTER = {
  Rosa: [
    'Hello! I grow all the flowers you see around the island.',
    'My secret? Talk to them every morning. And keep the slimes away!',
  ],
  Milo: [
    'I am going to be a famous fisherman one day!',
    'Have you seen the sharks out there? Captain Finn says the water is safe if you keep swimming. I am not so sure.',
  ],
  Greta: [
    'Back in my day we did not have fancy iron shields. We had a stick! And we liked it!',
    'If you are hungry, Hana bakes the best berry pie on the island.',
  ],
  Juno: [
    'I keep watch over the village, day and night. Well... mostly day.',
    'Be careful after dark. Monsters get stronger at night.',
  ],
  Wren: [
    'I am painting the sea tower! It is so tall I need a very long brush.',
    'Have you been all the way to the top? I hear there are gargoyles.',
  ],
  Tomas: [
    'Lovely day for a walk! If you want to look around, drag with the mouse, or press Q and E to turn the camera.',
    'Press C to put the camera right behind you. Handy when you get turned around!',
    'Captain Finn at the dock on the east beach is looking for a brave swimmer.',
  ],
};

export const BLACKSMITH = {
  name: 'Blacksmith',
  greeting: 'Welcome to my forge! Take a look at my wares.',
};

export const BAKER = {
  name: 'Hana',
  greeting: 'Fresh from the oven! Food makes you feel better when you are hurt. Press F to eat. You can carry 5 things.',
  bought: 'Enjoy! Press F to eat it when you are hurt.',
};
