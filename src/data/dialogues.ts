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

export const dialogues: Record<string, DialogueTree> = {
  [mordecai.id]: mordecai,
  [donutCourt.id]: donutCourt,
  [tally.id]: tally,
  [kivvi.id]: kivvi,
};
