// All the words characters say live here, so the story is easy to read and change.


export const MAIN_QUEST = {
  title: 'The Precious Artifact',
  text: {
    // Exact wording from theme.md.
    offer: [
      'The village as we know it is in imminent danger you must slay a Gelationus Slime to retrieve our villages precious artifact. you will be rewarded handsomely',
    ],
    active: [
      'The slime crawled away into the dark, where the mountain keeps its secrets.',
      'Others lurk in there too. The blacksmith may have something to help, if you have the coins.',
      'And Hana the baker makes food that mends a hero. Press F to eat it.',
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
        'There were six. They glow when the light catches them... and some flew really, REALLY far.',
      ],
      active: ['Six gems, all glowing somewhere out there. Keep your eyes open!'],
      turnIn: ['My gems! All of them! You are the best gem finder ever. Here, take some coins!'],
      complete: ['I am never juggling gems again. Probably.'],
    },
  },
  hunt: {
    giver: 'Jonah',
    title: 'Slime Trouble',
    text: {
      offer: [
        'Howdy! Somethin\' blue and bouncy keeps squishin\' my cabbages, out where the flowers grow thick.',
        'A whole gang of \'em, and they\'re tougher than they look. Could you shoo them off for good?',
      ],
      active: ['Out where the flowers grow thick. Listen for the squish-squish!'],
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
        'Each stone is a different color. Step on them in the right order and a treasure appears!',
        'The old rhyme says: "After the storm, follow the bow that bends across the sky." Step wrong, and you start again.',
      ],
      active: ['"After the storm, follow the bow that bends across the sky." That is all the rhyme says, dearie.'],
      turnIn: ['You solved the riddle of the stones! I knew you could do it. Keep the treasure, dearie.'],
      complete: ['Those old stones have not glowed like that in a hundred years.'],
    },
  },
  crystal: {
    giver: 'Captain Max',
    title: 'The Mystery Crystal',
    text: {
      offer: [
        'Ahoy there! Ever looked out to sea, toward the sunrise? There is an old tower out there.',
        'Folks say something glows at the very top. I would fetch it myself, but my knees are too creaky for all those stairs.',
        'There is no bridge, matey. My dock is as good a place as any to start a swim. And the sea has teeth!',
      ],
      active: [
        'The tower stands toward the sunrise. Whatever glows up there is waiting at the very top.',
        'Sharks bite, and something by the rocks zaps. Keep moving, and keep some food handy.',
      ],
      turnIn: [
        'Shiver me timbers, you found it! Look how it sparkles...',
        'Hmm. I have seen a lock that shape somewhere... I just cannot remember where. Somebody who collects crystals might know!',
        'Keep it, matey, and take these coins too.',
      ],
      complete: ['Found where that crystal belongs yet? A crystal collector would know. They always do.'],
    },
  },
  charibdis: {
    giver: 'Old Man Ward',
    title: 'Slay Charibdis',
    text: {
      offer: [
        'Well, well! A visitor! Nobody has opened that trapdoor in fifty years.',
        'Listen close. Far out at sea there is a rocky cave full of water, and in it lives Charibdis: a fish with a huge mouth, covered in eyes!',
        'Its whirlpool sinks ships. But even a whirlpool has to rest sometimes...',
        'The cave is locked tight. Its key was swallowed long ago by one of the two great beasts of the deep: one with many arms, and one long and quick.',
        'Watch the water around them. It will warn you before they strike.',
        'Go now, and slay Charibdis!',
      ],
      active: [
        'One of the two great beasts of the deep has the key. The cave waits beyond.',
        'And remember: even a whirlpool must rest.',
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
        'Can you find five pretty ones for me? They wash up where the sand meets the waves.',
      ],
      active: ['Where the sand meets the waves. Five of them!'],
      turnIn: ['Ooh, they are SO pretty! This one sounds like the sea. Thank you, here are some coins!'],
      complete: ['My seashell collection is the best in the whole village.'],
    },
  },
  wood: {
    giver: 'Jonah',
    title: 'Fence Mending',
    text: {
      offer: [
        'Those slimes squashed my fence flat, and the wind blew the planks all over the island!',
        'Could you find my 5 fence planks? Look out in the meadows. They\'re hard to miss: bright red paint!',
      ],
      active: ['5 red fence planks, out in the meadows somewhere. That wind sure was strong!'],
      turnIn: ['All five planks! My fence will be stronger than ever. Thank you, partner!'],
      complete: ['Not a single slime has gotten through my new fence.'],
    },
  },
  reverse: {
    giver: 'Elda',
    title: 'The Backwards Rainbow',
    text: {
      offer: [
        'The stones are humming again, dearie. I found another riddle in my old book.',
        'This time it says: "Walk the bow home, from its end back to its start."',
        'Solve it and the stones will give you another treasure!',
      ],
      active: ['"Walk the bow home, from its end back to its start."'],
      turnIn: ['Backwards and all! You are cleverer than I was at your age. Keep the treasure, dearie.'],
      complete: ['I wonder what other secrets those old stones are hiding...'],
    },
  },
  stone: {
    giver: 'Julian',
    title: 'Stones for the Well',
    text: {
      offer: [
        'Lovely day! Say, the old well is getting a bit wobbly.',
        'Some of its old blue stones rolled away down the hills. Could you find 5 of them for me?',
        'And a tip: press Tab to see all your quests, and Esc for the menu!',
      ],
      active: ['5 blue well stones, rolled off across the island. They glow a little, like the well water.'],
      turnIn: ['Wonderful! The well will be good as new. Here, take these coins.'],
      complete: [
        'Lovely day for a walk! Drag the mouse, or press Q and E to turn the camera. C puts it right behind you.',
        'I heard an old sailor down by the water is looking for a brave swimmer.',
      ],
    },
  },
  jungle: {
    giver: 'Captain Max',
    title: 'The Jungle Island',
    text: {
      offer: [
        'Ahoy, hero! Old Ward told me you slew Charibdis! Now the sea is safe, I can show you something.',
        'Far away there is a wild jungle island. I know a secret way there through the sea currents.',
        'But beware: some of the plants there BITE. They are slow, but you do not want to find out how hard.',
        'Hold on tight... here we go!',
      ],
      active: [
        'The biting plants have to go. Watch their mouths!',
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
        'Be warned: my own spin attack hurts a LOT.',
        'Watch my staff. It will tell you when to strike, and when to run. I may be old, but I do not flinch!',
        'Are you ready? Then let us begin!',
      ],
      active: ['Defeat Master Oak in battle! Watch his staff closely.'],
      turnIn: [
        'Ha! You have beaten me, fair and square. Now, the spin attack:',
        'Hold down your sword button after a swing until your sword sparkles. Then let go, and spin round to hit everything near you!',
      ],
      complete: ['Practice your spin, young one. You will need it.'],
    },
  },
  vine: {
    giver: 'Master Oak',
    title: 'The Viniac',
    text: {
      offer: [
        'Now hear me. Where the morning sun first touches this jungle, something huge has taken root: the Viniac.',
        'Its arms fall like trees. When the ground beneath you turns red, do not stand there admiring it!',
        'Defeat the Viniac and the jungle will be free. Use everything you have learned.',
      ],
      active: ['The Viniac grows where the morning sun first touches the jungle. Mind the red.'],
      turnIn: [
        'You did it! The Viniac is gone, and look... where it grew, a portal has opened!',
        'They say it leads to the dream dimension, where the Dream Keeper teaches amazing dream powers to those who help her.',
        'And listen... do you feel the ground rumble? Somewhere across the sea, an old volcano has woken up. Sailors always know the way.',
      ],
      complete: ['The portal shimmers where the Viniac used to grow.'],
    },
  },
  findJackson: {
    giver: 'Master Oak',
    title: 'The Second Master',
    text: {
      offer: [
        'You beat me, and you beat the Viniac. There is nothing left for me to teach you.',
        'But I have an old friend: Master Jackson. We trained together when we were young. Nobody has ever landed a hit on him!',
        'He lives alone on a speck of sand, far beyond the old tower, toward the sunrise. Find him, and tell him Oak sent you.',
      ],
      active: ['Beyond the old tower, toward the sunrise. A speck of sand with a stubborn man on it.'],
      complete: [
        'Did you find Jackson? Ha! I bet he is still doing push-ups on that beach.',
        'We both learned from the same teacher, long ago: Master Zach. He lives out where the sun sets over the sea... north of it, I think.',
      ],
    },
  },
  skyStrike: {
    giver: 'Master Oak',
    title: 'The Sky Strike',
    text: {
      offer: [
        'You have the spin. Now my second secret: the SKY STRIKE. Jump high, then swing your sword while you are in the air.',
        'You will dive straight down and SLAM the ground, hitting everything around you!',
        'Show me you can do it: smash my three training posts. Only a Sky Strike can break them!',
      ],
      active: ['Jump, then swing in the air to Sky Strike! Smash all three of Master Oak\'s training posts.'],
      turnIn: ['Ha! Look at those splinters! You have mastered the Sky Strike. Here, take these coins.'],
      complete: ['Jump high and swing to Sky Strike. Bounce mushrooms and double jumps make it even stronger... or at least more fun!'],
    },
  },
  jackson: {
    giver: 'Master Jackson',
    title: 'The Untouchable Master',
    text: {
      locked: ['Hm? Who are you? I only train the students of my old friend, Master Oak.'],
      offer: [
        'Oak sent you? That old tree! Welcome, welcome. I am Master Jackson.',
        'I teach the art of the PERFECT DODGE. But first, you must land a hit on me... and nobody has ever hit Master Jackson!',
        'Swing, shoot, slam: I will dodge them all. Well... almost all. Let us see what Oak taught you. Begin!',
      ],
      active: ['Land hits on Master Jackson! He dodges almost everything... what did Master Oak teach you?'],
      turnIn: [
        'Oof! A spin attack! Nobody can dodge something that comes from every side at once. Well fought!',
        'Now my secret: the PERFECT DODGE. When a blow is about to land, roll right through it.',
        'Time slows down for you, and your very next swing is a mighty counter-attack!',
      ],
      complete: [
        'Remember: roll through the blow just as it lands, then strike back!',
        'Oak and I learned everything from old Master Zach. They say he could dodge raindrops. He went to live on an island toward the sunset.',
      ],
    },
  },
  velizar: {
    giver: 'Ani',
    title: 'Velizar the Dragon',
    text: {
      offer: [
        'An adventurer! On the fire island! I am Ani. I study volcanoes... from a safe distance.',
        'When the Viniac fell, the volcano woke up, and so did VELIZAR, the dragon who sleeps in the lair beside it.',
        'He breathes fire! Watch the ground: it always knows where the fire is going before he does. And even dragons get out of breath.',
        'Oh, and do not walk on the lava. It burns! Some say crystals can keep your feet cool...',
        'Will you defeat Velizar? He sleeps in the volcano\'s shadow, inside a ring of black stones.',
      ],
      active: ['A ring of black stones, in the volcano\'s shadow. When the ground glows, MOVE!'],
      turnIn: ['You did it! Velizar is beaten, and the island is safe again. You are the bravest adventurer I have ever met! Take this treasure.'],
      complete: ['Lava monsters still climb out of the lava now and then. Be careful out there!'],
    },
  },
  king: {
    giver: 'King Stuart',
    title: 'The King of Tulane',
    text: {
      offer: [
        'So. The sword juggler returns.',
        'I hear the people of Crestview sing your name now. Hmph! Fame will not bring back my son.',
        'You came to do your duty? Then draw your sword. Let us end this!',
      ],
      active: ['Defeat King Stuart. His shield guards his front... but not every side at once.'],
      turnIn: ['...'],
      complete: ['...'],
    },
  },
  stars: {
    giver: 'Dream Keeper',
    title: 'Fallen Stars',
    text: {
      offer: [
        'Welcome, dreamer. I am the Dream Keeper. This is where dreams are made.',
        'Some of my stars have fallen onto the dream islands. Catch them all and I will teach you a dream power.',
        'And visit Aleli at the shrine. Her magic conduit lets you call down the STAR BURST.',
      ],
      active: ['My stars fell wherever the rainbows lead.'],
      turnIn: ['My stars! They shine so brightly again. Now you can DOUBLE JUMP: jump again in the air!'],
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
      turnIn: ['Sweet dreams have returned! Thank you. Now your roll becomes a DREAM DASH: long and fast, and it hurts any monster in your way!'],
      complete: ['No more nightmares. Well... not today.'],
    },
  },
  hop: {
    giver: 'Dream Keeper',
    title: 'Above the Clouds',
    text: {
      offer: [
        'One last thing. A staircase of clouds climbs to the very top of the dream.',
        'A star waits at the very top, for anyone brave enough to jump that high.',
      ],
      active: ['Up, up, up the clouds. The star is waiting at the top.'],
      turnIn: ['You reached the top of the dream! You are a true dreamer. Now your Star Burst heals you too: that is DREAM HEAL.'],
      complete: ['Come back whenever you like, dreamer. The dream is always here.'],
    },
  },
  thomage: {
    giver: 'Dream Keeper',
    title: 'The Nightmare Mage',
    text: {
      offer: [
        'Dreamer... I have not told you everything. Someone else lives in the dream.',
        'Thomage. Once he was a dream wizard, but now he only makes nightmares, and he wants the whole dream for himself.',
        'He floats where swords cannot reach, and his staff glows before every spell. Watch it!',
        'But even a great mage gets tired. When he sinks down to rest... that is your moment.',
      ],
      active: ['His staff glows before every spell. When he gets tired and sinks down, strike!'],
      turnIn: ['The nightmares are gone, and the dream is peaceful again. You are the greatest dreamer I have ever known. Take this treasure!'],
      complete: ['Sweet dreams, hero. Sweet dreams.'],
      later: ['Rest a while, dreamer. There is something else I must tell you, when you are ready.'],
    },
  },
});

// Pip, once you've got the mystery crystal: he tells you about Old Man Ward, and opens a crystal shop.
export const PIP_CRYSTAL = {
  first: [
    'Whoa! Is that... a MYSTERY CRYSTAL? I collect crystals, and I have never seen one that glows like that!',
    'You know who would love to see it? Old Man Ward. Nobody ever sees him. They say he lives UNDER the ground, below an old trapdoor near a road.',
    'Grown-ups say he knows all about the monsters out at sea. And I bet his trapdoor has a crystal-shaped lock...',
    'Hey, since you like crystals too: I am opening a crystal shop! You will find me at my stall on the plaza from now on.',
  ],
  shop: {
    title: "💎 Pip's Crystals",
    greeting: 'Crystals from all over the island! Some are even magic.',
  },
};

// The intro: Bobert juggles swords for King Stuart of Tulane, an accident happens, and he is
// banished to Crestview Village. The narration is the owner's words (from theme.md).
export const INTRO = {
  kingdom: 'Tulane Kingdom',
  king: ['My son! MY SON!', 'GUARDS! Seize that juggler! You are BANISHED from Tulane Kingdom, forever!'],
  narration: [
    "After being banished from the Tulane Kingdom, Bobert is taken to Crestview Village as punishment for killing King Stuart's son in a sword juggling accident.",
    'You must work your way to fame again through acts of kindness and helping others in the village.',
    'Once more powerful, you must come and do your duty by killing the king of Tulane Kingdom.',
    'So, are you ready? Because your story starts... NOW.',
  ],
  village: 'Crestview Village',
  soldiers: ['This is Crestview Village. Your new home, juggler.', 'And keep your swords to yourself!'],
};

// Once Bobert is famous again, Tulane's herald comes to Crestview.
export const HERALD = [
  'Hear ye, hear ye! The tales of Bobert of Crestview have reached Tulane Kingdom!',
  'Songs are sung of your kindness. They say you are not the boy who was banished... but a hero.',
  'It is time to face King Stuart. My ship is ready. Shall we sail?',
];

export const TULANE_GUARD = ['Long live... um. Whoever is in charge.', 'Welcome to Tulane Kingdom.'];

// The end of the story (after King Stuart).
export const ENDING = [
  'King Stuart is defeated!',
  'The people of Tulane gather in the courtyard. They remember the Bobert they knew, before the banishment.',
  'Tulane Kingdom is yours to protect now. Welcome home, Bobert!',
  'THE END... but the adventure goes on!',
];

// Master Zach, who taught Master Oak and Master Jackson, lives on the island toward the sunset.
export const ZACH = [
  'Oh! A visitor. Not many people find this island. I am Zach.',
  'Long ago, two young students came to me: a quiet one who loved trees, and one who could not stand still for a single second.',
  'Oak and Jackson! Ha! I taught them everything they know. Well... almost everything.',
  'If you have learned from both of them, then you are my student too. Keep practicing: spin, strike from the sky, and dodge.',
];

// Ollie looks after the save stones.
export const OLLIE = [
  "Hi! I'm Ollie. I look after the save stones. Well... I polish them.",
  'See the glowing crystal? Walk up to it, and it remembers your whole adventure. Every time!',
  "There's one on every island. Even the far-away ones. Even the ones up in the clouds, I heard.",
];

// What side-quest givers say before you've helped the merchant.
export const QUEST_LOCKED = [
  'Oh, hello there! I could really use some help...',
  'But the merchant at the market stall needs you more right now. Go talk to them first, then come back!',
];

// What a villager says while they don't have a new quest for you yet.
export const COME_BACK_LATER = ['Come back a little later. I might need your help again!'];

export const VILLAGER_CHATTER = {
  Clara: [
    'Hello! I grow all the flowers you see around the island.',
    'My secret? Talk to them every morning. And keep the slimes away!',
  ],
  Emi: [
    'I am going to be a famous fisherman one day!',
    'Have you seen the sharks out there? Captain Max says the water is safe if you keep swimming. I am not so sure.',
  ],
  Hatty: [
    'Back in my day we did not have fancy iron shields. We had a stick! And we liked it!',
    'If you are hungry, Hana bakes the best berry pie on the island.',
  ],
  Eve: [
    'I keep watch over the village, day and night. Well... mostly day.',
    'Be careful after dark. Monsters get stronger at night.',
  ],
  Evie: [
    'I am painting the sea tower! It is so tall I need a very long brush.',
    'Have you been all the way to the top? I hear there are gargoyles.',
  ],
  Julian: [
    'Lovely day for a walk! If you want to look around, drag with the mouse, or press Q and E to turn the camera.',
    'Press C to put the camera right behind you. Handy when you get turned around!',
    'Captain Max at the dock on the east beach is looking for a brave swimmer.',
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
