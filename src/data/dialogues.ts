/**
 * Dialogue tree registry (looked up by startDialogue(treeId), like rooms).
 * Hub-and-spoke Sierra model: intro lines, then a topic menu whose options
 * come and go with flags ('showIf') or after being asked ('once').
 *
 * All lines are original writing in the demo's house voice.
 */

import { disableHotspot, enableExit, giveItem, playCutscene, setFlag } from './script';
import type { DialogueTree } from './types';

// ---------------------------------------------------------------------------
// Mordecai — the tutorial guildmaster (Act I centerpiece)
// ---------------------------------------------------------------------------

const mordecai: DialogueTree = {
  id: 'mordecai',
  entry: 'greet',
  nodes: {
    greet: {
      lines: [
        { speakerId: 'mordecai', text: 'Come in, close the door, touch nothing that glows. I am Mordecai. This is the tutorial guild. Ask your questions.' },
      ],
      goto: 'hub',
    },
    hub: {
      lines: [],
      choices: [
        { text: 'What is the crawl?', goto: 'crawl' },
        { text: 'Who is running this?', goto: 'syndicate' },
        { text: 'How do loot and levels work?', goto: 'loot' },
        { text: 'How do I stay alive?', goto: 'advice' },
        { text: 'Nice place.', goto: 'aside', once: true },
        { text: 'Get me registered.', goto: 'register', showIf: { flag: 'carl:registered', not: true } },
        { text: 'About the cat...', goto: 'cat', showIf: { flag: 'carl:registered' }, once: true },
        { text: "We're heading out.", goto: 'warning', showIf: { flag: 'act1:party_formed' } },
        { text: 'That is all for now.', goto: 'bye' },
      ],
    },
    crawl: {
      lines: [
        { speakerId: 'mordecai', text: 'Your planet got turned into a game show. Eighteen floors, down being the only direction, cameras in everything.' },
        { speakerId: 'mordecai', text: 'Survive a floor, you may descend. Entertain the audience, you get gifts. Bore them and... do not bore them.' },
        { speakerId: 'mordecai', text: 'I have watched a lot of seasons. The ones who treat it like a game last longer than the ones who treat it like a funeral.', expression: 'worried' },
      ],
      goto: 'hub',
    },
    syndicate: {
      lines: [
        { speakerId: 'mordecai', text: 'A mining syndicate holds your planetary license. The show pays for the dig. The dig pays for the show. Tidy, if you are not the dirt.' },
        { speakerId: 'mordecai', text: 'The AI that runs the dungeon answers to them. Mostly. Lately it laughs at strange times. I would not rely on the org chart.' },
      ],
      goto: 'hub',
    },
    loot: {
      lines: [
        { speakerId: 'mordecai', text: 'Kill things, open things, amuse the viewers: experience and loot boxes. Levels make you harder to kill. Take both seriously.' },
        { speakerId: 'mordecai', text: 'Gear goes in three places. A thing to hit with, a thing to be hit in, and a trinket. Check your pack after every fight.' },
      ],
      goto: 'hub',
    },
    advice: {
      lines: [
        { speakerId: 'mordecai', text: 'Look at everything. Touch carefully. Talk to whatever talks back. The floor rewards the curious and eats the careless.' },
        { speakerId: 'mordecai', text: 'And keep the audience laughing. A sponsored crawler is a living crawler.', expression: 'worried' },
      ],
      goto: 'hub',
    },
    aside: {
      lines: [
        { speakerId: 'mordecai', text: 'It is a repurposed storage closet with a liquor shelf. But thank you. Nobody says that.' },
      ],
      goto: 'hub',
    },
    register: {
      onEnter: [playCutscene('act1_character_creation')],
      lines: [
        { speakerId: 'mordecai', text: 'There. Registered, classed, and dressed. You look almost dangerous. Almost.' },
      ],
      goto: 'hub',
    },
    cat: {
      onEnter: [playCutscene('act1_donut_transformation')],
      lines: [
        { speakerId: 'mordecai', text: 'Congratulations. In thirty years of guild work I have never once been outranked by a cat this fast.', expression: 'worried' },
      ],
      goto: 'hub',
    },
    warning: {
      onEnter: [enableExit('onward'), setFlag('act1:briefed', true)],
      lines: [
        { speakerId: 'mordecai', text: 'Then hear the quiet version, once: the floor is a machine for making stories out of people. Be the teller, not the material.', expression: 'worried' },
        { speakerId: 'mordecai', text: 'Door on the right goes deeper. Come back if you breathe wrong. I stock bandages and told-you-sos.' },
        { speakerId: 'donut', text: 'We thank you for your service, rat person. You may bow at your convenience.', expression: 'smug' },
      ],
      goto: 'end',
    },
    bye: {
      lines: [
        { speakerId: 'mordecai', text: 'Go on. And crawler - eat something. Dead men skip meals.' },
      ],
      goto: 'end',
    },
  },
};

// ---------------------------------------------------------------------------
// Donut, post-transformation (small court-holding tree)
// ---------------------------------------------------------------------------

const donutCourt: DialogueTree = {
  id: 'donut_court',
  entry: 'greet',
  nodes: {
    greet: {
      lines: [
        { speakerId: 'donut', text: 'You may approach.', expression: 'smug' },
      ],
      goto: 'hub',
    },
    hub: {
      lines: [],
      choices: [
        { text: 'How are you feeling?', goto: 'feeling', once: true },
        { text: 'You are still a cat.', goto: 'stillcat', once: true },
        { text: 'Ready to go?', goto: 'ready' },
      ],
    },
    feeling: {
      lines: [
        { speakerId: 'donut', text: 'Enormous. Verbal. Slightly betrayed that you never mentioned thumbs were this useful. I will manage without.' },
      ],
      goto: 'hub',
    },
    stillcat: {
      lines: [
        { speakerId: 'donut', text: 'I am an APEX cat with a TITLE and a SPELL, Carl. You are a man in foam shoes. Let us not do comparisons.', expression: 'smug' },
      ],
      goto: 'hub',
    },
    ready: {
      lines: [
        { speakerId: 'donut', text: 'The Royal Court advances when I say. ...I say now. Walk ahead of me, it is drafty.' },
      ],
      goto: 'end',
    },
  },
};

// ---------------------------------------------------------------------------
// Tally — the MoonBurger safe-room attendant (polite, cheerful, rule-bound)
// ---------------------------------------------------------------------------

const tally: DialogueTree = {
  id: 'tally',
  entry: 'greet',
  nodes: {
    greet: {
      lines: [
        { speakerId: 'tally', text: 'Welcome to MoonBurger! I am Tally. I am contractually delighted to see you. The delight is also genuine, which is a nice overlap.' },
      ],
      goto: 'hub',
    },
    hub: {
      lines: [],
      choices: [
        { text: 'What is this place?', goto: 'saferoom' },
        { text: 'Can we rest here?', goto: 'rest' },
        { text: 'What is that terminal?', goto: 'shop' },
        { text: 'Are you a prisoner here?', goto: 'prisoner', once: true },
        { text: 'The show premiered...', goto: 'premiere', showIf: { flag: 'act2:premiere_seen' }, once: true },
        { text: 'We should go.', goto: 'bye' },
      ],
    },
    saferoom: {
      lines: [
        { speakerId: 'tally', text: 'A safe room! Nothing hostile may enter, by rule. The rule is very strict and the things outside are very angry about it.' },
        { speakerId: 'tally', text: 'We offer food, rest, and a door that locks. On this floor, that makes us a five-star establishment.' },
      ],
      goto: 'hub',
    },
    rest: {
      lines: [
        { speakerId: 'tally', text: 'The corner booth is reserved for exactly this. Sit, breathe, let the walls do the worrying. Your progress is recorded while you rest.' },
      ],
      goto: 'hub',
    },
    shop: {
      lines: [
        { speakerId: 'tally', text: 'Our shop terminal! It is still coming online. Corporate says SOON. Corporate has said SOON for two seasons.', expression: 'smug' },
        { speakerId: 'tally', text: 'When it wakes, your gold will be very welcome here. Until then, admire the menu board. The pictures are aspirational.' },
      ],
      goto: 'hub',
    },
    prisoner: {
      lines: [
        { speakerId: 'tally', text: 'Oh, I prefer RESIDENT. I was born in a break room and I will retire in one. Between those, I get to meet everyone brave on this floor.' },
        { speakerId: 'tally', text: 'It is not freedom. But it is a kindness with a roof, and I have decided that counts.', expression: 'smug' },
      ],
      goto: 'hub',
    },
    premiere: {
      lines: [
        { speakerId: 'tally', text: 'I saw! You are on the big screens now. Your cat tested extremely well. You tested... present! Present is survivable.' },
      ],
      goto: 'hub',
    },
    bye: {
      lines: [
        { speakerId: 'tally', text: 'Come back whenever the outside becomes too much outside. I will keep a booth warm.' },
      ],
      goto: 'end',
    },
  },
};

// ---------------------------------------------------------------------------
// Kivvi — the pierced goblin engineer (Act II part 2 parley)
// ---------------------------------------------------------------------------

const kivvi: DialogueTree = {
  id: 'kivvi',
  entry: 'greet',
  nodes: {
    greet: {
      lines: [
        { speakerId: 'kivvi', text: 'Tk-tk. A human, walking INTO the yard. Either brave or lost. I am Kivvi. Do not touch my bike.' },
      ],
      goto: 'hub',
    },
    hub: {
      lines: [],
      choices: [
        { text: 'What is this place?', goto: 'yard' },
        { text: 'Tell me about the kegs.', goto: 'kegs' },
        { text: 'The patrol looks jumpy.', goto: 'patrol', showIf: { flag: 'goblin:covered', not: true }, once: true },
        { text: 'Why talk to me at all?', goto: 'why', once: true },
        { text: 'Got a spark on you?', goto: 'spark', showIf: { flag: 'goblin:striker_given', not: true } },
        { text: "I'll be going.", goto: 'bye' },
      ],
    },
    yard: {
      lines: [
        { speakerId: 'kivvi', text: 'Clan workshop. We build the copper choppers. Fast, loud, occasionally on fire. The good kind of occasionally.' },
        { speakerId: 'kivvi', text: 'The big door at the back? The War Chieftain. He signs for every delivery personally. Very hands-on. Very stampy.' },
      ],
      goto: 'hub',
    },
    kegs: {
      lines: [
        { speakerId: 'kivvi', text: 'Blasting powder, floor to roof, plus the fuel line feeding the forge. One spark indoors and the whole shop becomes weather.', expression: 'smug' },
        { speakerId: 'kivvi', text: 'So: no sparks. The coal cart rail runs straight past his door, so mind it. He hates waiting for coal.' },
      ],
      goto: 'hub',
    },
    patrol: {
      onEnter: [setFlag('goblin:covered', true), disableHotspot('patrol')],
      lines: [
        { speakerId: 'kivvi', text: 'Them? Bored, not brave. I will whistle them down the line. You were never here, tall thing. You owe me a favor and a story.' },
      ],
      goto: 'hub',
    },
    why: {
      lines: [
        { speakerId: 'kivvi', text: 'The clan likes war. I like machines. Machines do not bite each other over rank. You seem machine-adjacent. Your cat is clearly management.' },
        { speakerId: 'donut', text: 'The goblin has excellent instincts. Continue, goblin.', expression: 'smug' },
      ],
      goto: 'hub',
    },
    spark: {
      onEnter: [giveItem('flint_striker'), setFlag('goblin:striker_given', true)],
      lines: [
        { speakerId: 'kivvi', text: 'Take my striker. One squeeze, one spark. Point it away from the yard, the shop, my bike, and me. In that order, reversed.' },
      ],
      goto: 'hub',
    },
    bye: {
      lines: [
        { speakerId: 'kivvi', text: 'Tk. Walk soft, tall thing. And if you hear a big voice yelling about deliveries, that is not a voice you answer.' },
      ],
      goto: 'end',
    },
  },
};

// ---------------------------------------------------------------------------
// Frank & Maggie — hostile crawlers (Act III, R12). Talk turns to threat.
// ---------------------------------------------------------------------------

const frankMaggie: DialogueTree = {
  id: 'frank_maggie',
  entry: 'greet',
  nodes: {
    greet: {
      lines: [
        { speakerId: 'frank', text: "Well. The explosion guy. We've been watching your channel, friend. Big numbers. Big, valuable numbers.", expression: 'smug' },
        { speakerId: 'maggie', text: 'The cat alone is worth a sponsorship. Hello, kitty.', expression: 'smug' },
        { speakerId: 'donut', text: 'The cat has a TITLE, and the title has LAWYERS.', expression: 'smug' },
      ],
      goto: 'hub',
    },
    hub: {
      lines: [],
      choices: [
        { text: 'We want no trouble.', goto: 'trouble' },
        { text: 'What do you two want?', goto: 'want' },
        { text: "We're leaving now.", goto: 'leave' },
      ],
    },
    trouble: {
      lines: [
        { speakerId: 'frank', text: "Nobody WANTS trouble. Trouble is just what's left when people want the same bridge.", expression: 'smug' },
      ],
      goto: 'hub',
    },
    want: {
      lines: [
        { speakerId: 'maggie', text: 'Your pack, your gold, and your time slot. The audience follows loot, friend. We intend to inherit.', expression: 'smug' },
        { speakerId: 'frank', text: 'Not here, of course. Cameras love a bottleneck. See you somewhere narrow.', expression: 'smug' },
      ],
      goto: 'hub',
    },
    leave: {
      onEnter: [setFlag('frank:met', true)],
      lines: [
        { speakerId: 'frank', text: 'Walk safe. The corridor east pinches tight by the bridge. Terrible place to be surprised in.', expression: 'smug' },
        { speakerId: 'maggie', text: 'Give our love to the cut. Bye now.', expression: 'smug' },
        { speakerId: 'carl', text: 'Donut. They just told us exactly where.' },
      ],
      goto: 'end',
    },
  },
};

// ---------------------------------------------------------------------------
// The Meadow Lark crew (Act III, R13) — compact recruit trees
// ---------------------------------------------------------------------------

const brandonTree: DialogueTree = {
  id: 'brandon',
  entry: 'greet',
  nodes: {
    greet: {
      lines: [
        { speakerId: 'brandon', text: "Easy - friendly! You're the workshop crawler. I'm Brandon. Night shift at the Meadow Lark care home, back when homes existed." },
      ],
      goto: 'hub',
    },
    hub: {
      lines: [],
      choices: [
        { text: 'How did you all survive?', goto: 'survive', once: true },
        { text: 'What is blocking the stairs?', goto: 'stairs' },
        { text: 'Train with us. We hit it together.', goto: 'recruit', showIf: { flag: 'ally:brandon', not: true } },
        { text: 'Talk later.', goto: 'bye' },
      ],
    },
    survive: {
      lines: [
        { speakerId: 'brandon', text: 'We got our residents down the stairs and just... kept doing the job. Feed people, watch the door, stay kind. Kindness scales, it turns out.' },
      ],
      goto: 'hub',
    },
    stairs: {
      lines: [
        { speakerId: 'brandon', text: 'The stairwell to Floor Two sits off the old ring line. Something huge rolls that loop day and night. Nobody crosses the platform and comes back.', expression: 'worried' },
        { speakerId: 'brandon', text: 'Until it dies, every soul at this bridge is stuck on a floor that is closing. That is the whole problem, crawler.' },
      ],
      goto: 'hub',
    },
    recruit: {
      onEnter: [setFlag('ally:brandon', true)],
      lines: [
        { speakerId: 'brandon', text: "I hoped you'd say that. I can hold a line and I can keep heads level. Count me in. Talk to the others - they follow deeds, not speeches." },
      ],
      goto: 'hub',
    },
    bye: {
      lines: [
        { speakerId: 'brandon', text: 'Door is always open. Mind the drawbridge chain on your way.' },
      ],
      goto: 'end',
    },
  },
};

const chrisTree: DialogueTree = {
  id: 'chris',
  entry: 'greet',
  nodes: {
    greet: {
      lines: [
        { speakerId: 'chris', text: '...Chris.' },
      ],
      goto: 'hub',
    },
    hub: {
      lines: [],
      choices: [
        { text: 'What is with the metal cap?', goto: 'cap', once: true },
        { text: 'Will you fight with us?', goto: 'recruit', showIf: { flag: 'ally:chris', not: true } },
        { text: 'Be well, Chris.', goto: 'bye' },
      ],
    },
    cap: {
      lines: [
        { speakerId: 'chris', text: 'The dungeon gave me a skill. The cap keeps it... polite. You do not want the impolite version. Neither do I.', expression: 'worried' },
      ],
      goto: 'hub',
    },
    recruit: {
      onEnter: [setFlag('ally:chris', true)],
      lines: [
        { speakerId: 'chris', text: '...Yes. Stand behind me when it gets loud.' },
      ],
      goto: 'hub',
    },
    bye: {
      lines: [
        { speakerId: 'chris', text: '...Mm.' },
      ],
      goto: 'end',
    },
  },
};

const yolandaTree: DialogueTree = {
  id: 'yolanda',
  entry: 'greet',
  nodes: {
    greet: {
      lines: [
        { speakerId: 'yolanda', text: 'Sit, you look terrible. Yolanda. Thirty years of nights in scrubs - I have seen worse than you, but not by much.', expression: 'smug' },
      ],
      goto: 'hub',
    },
    hub: {
      lines: [],
      choices: [
        { text: 'Where did the bow come from?', goto: 'bow', once: true },
        { text: 'We could use you on the raid.', goto: 'recruit', showIf: { flag: 'ally:yolanda', not: true } },
        { text: 'Thanks, Yolanda.', goto: 'bye' },
      ],
    },
    bow: {
      lines: [
        { speakerId: 'yolanda', text: 'Loot box. The quiver refills itself and drags when I walk, which the audience finds HILARIOUS. Laugh once and lose a toe, crawler.', expression: 'smug' },
      ],
      goto: 'hub',
    },
    recruit: {
      onEnter: [setFlag('ally:yolanda', true)],
      lines: [
        { speakerId: 'yolanda', text: "Finally, someone with a plan instead of a prayer. I'm in. I patch who I can and pin what I can't." },
      ],
      goto: 'hub',
    },
    bye: {
      lines: [
        { speakerId: 'yolanda', text: 'Drink water. I mean it.' },
      ],
      goto: 'end',
    },
  },
};

const imaniTree: DialogueTree = {
  id: 'imani',
  entry: 'greet',
  nodes: {
    greet: {
      lines: [
        { speakerId: 'imani', text: 'Imani. You are the one the screens keep showing.', expression: 'worried' },
      ],
      goto: 'hub',
    },
    hub: {
      lines: [],
      choices: [
        { text: 'That sword has seen use.', goto: 'sword', once: true },
        { text: 'Fight beside us at the ring.', goto: 'recruit', showIf: { flag: 'ally:imani', not: true } },
        { text: 'Rest easy, Imani.', goto: 'bye' },
      ],
    },
    sword: {
      lines: [
        { speakerId: 'imani', text: 'The floor kept coming for the residents. I kept being between it and them. The number is not one I say out loud.', expression: 'worried' },
        { speakerId: 'donut', text: '...The court recognizes this one. Do not stand in her lane, Carl.' },
      ],
      goto: 'hub',
    },
    recruit: {
      onEnter: [setFlag('ally:imani', true)],
      lines: [
        { speakerId: 'imani', text: 'Yes. Point me at the thing that ends this. I will handle my lane.' },
      ],
      goto: 'hub',
    },
    bye: {
      lines: [
        { speakerId: 'imani', text: 'Sleep when it is over.' },
      ],
      goto: 'end',
    },
  },
};

const agathaTree: DialogueTree = {
  id: 'agatha',
  entry: 'greet',
  nodes: {
    greet: {
      lines: [
        { speakerId: 'agatha', text: 'You TOUCH the cart, you LOSE the hand. State your business.', expression: 'angry' },
      ],
      goto: 'hub',
    },
    hub: {
      lines: [],
      choices: [
        { text: 'What is in the cart?', goto: 'cart', once: true },
        { text: 'Why the flamingo?', goto: 'flamingo', once: true },
        { text: 'We will guard your cart during the raid.', goto: 'promise', showIf: { flag: 'agatha:cart_promised', not: true } },
        { text: 'Good day, Agatha.', goto: 'bye' },
      ],
    },
    cart: {
      lines: [
        { speakerId: 'agatha', text: 'Everything. Blankets, batteries, forty years of mine and none of yours. A life fits in a cart if you stack it right.', expression: 'angry' },
      ],
      goto: 'hub',
    },
    flamingo: {
      lines: [
        { speakerId: 'agatha', text: 'Herbert stood in my yard for thirty years and took an arrow on this floor without complaint. Show me a soldier with a better record.' },
        { speakerId: 'donut', text: 'The bird stays, Carl. The bird has EARNED it.', expression: 'smug' },
      ],
      goto: 'hub',
    },
    promise: {
      onEnter: [setFlag('agatha:cart_promised', true)],
      lines: [
        { speakerId: 'agatha', text: 'Hm. Then you are less useless than advertised. The cart, the bird, and me - at the bridge when you come back. ALL wheels attached.' },
      ],
      goto: 'hub',
    },
    bye: {
      lines: [
        { speakerId: 'agatha', text: 'Walk on. And tuck your shirt in, you are on television.' },
      ],
      goto: 'end',
    },
  },
};

export const dialogues: Record<string, DialogueTree> = {
  [mordecai.id]: mordecai,
  [donutCourt.id]: donutCourt,
  [tally.id]: tally,
  [kivvi.id]: kivvi,
  [frankMaggie.id]: frankMaggie,
  [brandonTree.id]: brandonTree,
  [chrisTree.id]: chrisTree,
  [yolandaTree.id]: yolandaTree,
  [imaniTree.id]: imaniTree,
  [agathaTree.id]: agathaTree,
};
