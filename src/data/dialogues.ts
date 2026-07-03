/**
 * Dialogue tree registry (looked up by startDialogue(treeId), like rooms).
 * Hub-and-spoke Sierra model: intro lines, then a topic menu whose options
 * come and go with flags ('showIf') or after being asked ('once').
 *
 * All lines are original writing. Characters keep their own voices - the
 * three narration channels (VOICE_BIBLE.md) are for the boxes, not for
 * people. Mordecai is the tutorial: his tree carries most of the floor's
 * practical knowledge, one weary topic at a time.
 */

import { disableHotspot, enableExit, giveItem, playCutscene, setFlag } from './script';
import type { DialogueTree } from './types';

// ---------------------------------------------------------------------------
// Mordecai - the tutorial guildmaster (Act I centerpiece)
// ---------------------------------------------------------------------------

const mordecai: DialogueTree = {
  id: 'mordecai',
  entry: 'greet',
  nodes: {
    greet: {
      lines: [
        { speakerId: 'mordecai', text: 'Come in. Close the door. Touch nothing that glows.' },
        { speakerId: 'mordecai', text: 'My name is Mordecai. I am your guild manager - every new crawler gets assigned one, and you got me. I have worked this dungeon longer than your species has had this problem. Sit. Ask your questions. All of them. The people who ask questions live longer.', expression: 'worried' },
      ],
      goto: 'hub',
    },
    hub: {
      lines: [],
      choices: [
        { text: 'What exactly is happening to us?', goto: 'crawl' },
        { text: 'Who is running this? Why?', goto: 'syndicate' },
        { text: 'How do loot and levels work?', goto: 'loot' },
        { text: 'What is this ratings board I have?', goto: 'ratings', showIf: { flag: 'carl:ratings_seen' } },
        { text: 'Where is it safe to rest?', goto: 'saferooms' },
        { text: 'What should we avoid on this floor?', goto: 'advice' },
        { text: 'What ARE the bosses down here?', goto: 'bosses', once: true },
        { text: 'Are you a prisoner too?', goto: 'aside', once: true },
        { text: 'Get me registered.', goto: 'register', showIf: { flag: 'carl:registered', not: true } },
        { text: 'About the cat...', goto: 'cat', showIf: { flag: 'carl:registered' }, once: true },
        { text: "We're heading out.", goto: 'warning', showIf: { flag: 'act1:party_formed' } },
        { text: 'That is all for now.', goto: 'bye' },
      ],
    },
    crawl: {
      lines: [
        { speakerId: 'mordecai', text: 'The plain version. A mining syndicate bought your planet. To take the minerals, they have to clear the current tenants - that is you - and interstellar law says tenants must be given a way out. This is the way out. Eighteen floors, straight down.' },
        { speakerId: 'mordecai', text: 'Every floor is a world of its own - monsters, bosses, locked stairwells. Clear the stairwell boss, take the stairs, do it again. Anyone who reaches the bottom alive walks away free, rich, and famous in places you have never heard of.' },
        { speakerId: 'mordecai', text: 'And because clearing a planet is expensive, they film it. You are on the show now - the whole galaxy watches crawlers die for entertainment. The audience is not a joke, Carl. Their attention is food, money, and survival. Remember that.', expression: 'worried' },
        { speakerId: 'mordecai', text: 'One more thing, because the voice upstairs says it fast and cheerful and hopes you miss it: the floors CLOSE. Each one is on a timer. Move like a tourist and the ceiling settles the argument. Do not sprint - but do not homestead, either.', expression: 'worried' },
        { speakerId: 'mordecai', text: 'Nobody expects you to reach the bottom. Almost nobody does. But floor by floor? Floor by floor is possible. That is the only size of hope I deal in.', expression: 'worried' },
      ],
      goto: 'hub',
    },
    syndicate: {
      lines: [
        { speakerId: 'mordecai', text: 'Three layers, top to bottom. The Valtay Syndicate holds your planetary license - miners, lawyers, worse. They own the dirt. They could not care less what happens above the ore line.' },
        { speakerId: 'mordecai', text: 'The show itself is a Borant Corporation production. Borant runs the crawl: builds the seasons, sells the sponsorships, sets the prize pool. The show pays for the dig, the dig pays for the show. Tidy arrangement, if you are not the dirt.' },
        { speakerId: 'mordecai', text: 'My opinion of Borant. Hm. They are cheap, Carl. Cheap in the way that kills people - understaffed floors, recycled monsters, safety rules written by the marketing department. Everything down here that works, works because somebody like me shims it up nightly.', expression: 'worried' },
        { speakerId: 'mordecai', text: 'And under all of it, the one you will actually hear: the dungeon AI. The game-show voice. It builds the floors, counts the kills, narrates your worst moments to an audience of billions. It answers to Borant. Mostly. Lately it laughs at strange times, and I do not know what that means yet.', expression: 'worried' },
        { speakerId: 'mordecai', text: 'Do not try to fight the system itself. Not yet. Learn it first. Systems have seams.' },
      ],
      goto: 'hub',
    },
    loot: {
      lines: [
        { speakerId: 'mordecai', text: 'Everything you kill, open, or amuse feeds you. Kills give experience - enough experience, you level, and a level makes the whole party tougher, faster, harder to kill. Levels are life expectancy. Take them seriously.' },
        { speakerId: 'mordecai', text: 'Gear goes in three places: a weapon in your hand, armor on your body, a trinket for the little edges. Open your pack, click a thing, put it on. Check it after every fight - the floor drops better than it looks like it should.' },
        { speakerId: 'mordecai', text: 'Then there are the boxes. Loot boxes drop from the ceiling of reality itself: rewards for milestones, and GIFTS - actual presents from actual viewers who liked what you did. Open every one. Some of them change lives. You will see what I mean before you leave this room, if I am reading your cat right.', expression: 'worried' },
      ],
      goto: 'hub',
    },
    ratings: {
      lines: [
        { speakerId: 'mordecai', text: 'So it showed you the board. Grit, flair, carnage, charm - the labels change season to season, but it is always the same four questions: do you hold, do you shine, do you hurt things memorably, and do they LIKE you.' },
        { speakerId: 'mordecai', text: 'Understand what the numbers are FOR. The audience spends money on crawlers they rate. Gifts, boxes, buffs, sponsorships. High ratings have kept people alive through floors that should have eaten them - and low ratings get you deprioritized. Fewer camera drones. Fewer gifts. Quieter deaths.', expression: 'worried' },
        { speakerId: 'mordecai', text: 'My advice, and it is ugly: perform. Not lies - the audience smells lies - but do not waste your good moments off camera, because there is no off camera. Be worth the watching. It is rent, Carl. Down here, attention is rent.' },
      ],
      goto: 'hub',
    },
    saferooms: {
      lines: [
        { speakerId: 'mordecai', text: 'Safe rooms. Marked doors - a guild like this one, an inn, sometimes a whole restaurant the dungeon dragged down for set dressing. The rule inside is absolute: nothing hostile enters. Not monsters, not other crawlers with intentions, nothing. The rule has never once broken. Even the dungeon respects its own furniture.' },
        { speakerId: 'mordecai', text: 'Sleep in them. Eat in them. Your progress records while you rest - if the worst happens later, it rewinds you to the last safe moment. Dying down here is a setback, not always an ending. The dungeon enjoys second chances. They rate well.', expression: 'worried' },
        { speakerId: 'mordecai', text: 'And in the bigger safe rooms, look for the doors with YOUR name on them. Personal spaces - a private room the dungeon stamps out for each registered crawler. Yours, legally. Decorate it, stash in it, cry in it, nobody sees inside. In a place with a billion cameras, one door that closes is worth more than gear. Use it.', expression: 'worried' },
      ],
      goto: 'hub',
    },
    advice: {
      lines: [
        { speakerId: 'mordecai', text: 'Look at everything before you touch it. Touch carefully. Talk to whatever talks back - half of what saves your life down here is a conversation you almost skipped. The dungeon even highlights what matters, if you pay attention. It wants you interacting. Interacting is content.' },
        { speakerId: 'mordecai', text: 'This floor specifically. The maze east of here has teeth in the walls - fight what blocks the road, skip what does not. There is a troll matron in the garbage district you should NOT fight fair, a goblin clan that respects machines more than blood, and past all of it, a stairwell boss that has killed everything sent at it for a season. In between: two crawlers who hunt other crawlers. Worse than the monsters, those. The monsters are honest.', expression: 'worried' },
        { speakerId: 'mordecai', text: 'When a fight looks impossible, it usually is. The floor builds puzzles into its monsters - a boss that cannot be beaten head-on can almost always be beaten some other way. Look at what it loves. Look at where it sleeps. Think like a trap-maker.', expression: 'worried' },
      ],
      goto: 'hub',
    },
    bosses: {
      lines: [
        { speakerId: 'mordecai', text: '...You asked, so I will say it plain, and then we will not linger on it. Not all of the monsters were built. The floors were seeded from what was here when the dungeon grew - the animals, the vermin. And for the big ones, the named ones, the BOSSES... sometimes the dungeon starts with a person.', expression: 'worried' },
        { speakerId: 'mordecai', text: 'It finds someone whose shape already fits - some hunger, some habit, some grief with a handle on it - and it grows the monster around them like a shell around a grain of grit. The troll in the garbage district. Ask yourself why she counts her pile all night. Ask what she was counting before.', expression: 'worried' },
        { speakerId: 'mordecai', text: 'Kill them anyway. I mean that, Carl. Whatever they were, what is left wants you dead, and pity gets crawlers killed at exactly the wrong moment. But know what you are walking past. The audience is not told. The audience would only rate it.', expression: 'worried' },
      ],
      goto: 'hub',
    },
    aside: {
      lines: [
        { speakerId: 'mordecai', text: 'A contractor. Which is a prisoner with a title. I was a crawler once, on a world you have never heard of, and this job is what surviving bought me.', expression: 'worried' },
        { speakerId: 'mordecai', text: 'Why am I still here, nine seasons on. Because the alternative is retirement in a Borant habitat cube, and because - hm. Because every season there are two or three like you. Ones who ask questions. Ones who might actually walk down all eighteen. Somebody has to stand at the top of the stairs and give them a fair start. It is the only part of this machine I can point in a decent direction.', expression: 'worried' },
        { speakerId: 'mordecai', text: 'I have managed nine seasons of crawlers, Carl. I remember every one of them. Make yourself easy to remember for the right reasons.' },
      ],
      goto: 'hub',
    },
    register: {
      onEnter: [playCutscene('act1_character_creation')],
      lines: [
        { speakerId: 'mordecai', text: 'There. Registered, classed, and equipped. Now, the parts the voice upstairs performed instead of explaining. SURVIVOR, PROVISIONAL is not an insult - it is the system admitting it cannot predict you. Unpredictable rates well. Unpredictable also gets special attention. Both edges cut.', expression: 'worried' },
        { speakerId: 'mordecai', text: 'The starter gear is junk, but it is junk between you and the teeth, and that is the whole history of armor. Keep the jacket. Sentimental items pick up strange enchantments down here, and the audience already likes it. You look almost dangerous.' },
      ],
      goto: 'hub',
    },
    cat: {
      onEnter: [playCutscene('act1_donut_transformation')],
      lines: [
        { speakerId: 'mordecai', text: 'A viewer gift did that. Somebody out there - somebody with real money - liked her, and now she is awake, talking, and, I want to be accurate here, outranks you. In thirty years of guild work I have never seen it happen this fast.', expression: 'worried' },
        { speakerId: 'mordecai', text: 'Understand what you just watched, because it matters: the audience reached into the dungeon and CHANGED something, because it was entertained. That is the power you are performing for. It cuts both ways, always.', expression: 'worried' },
        { speakerId: 'mordecai', text: 'Take care of her, Carl. A party of two survives what a party of one does not. That is arithmetic, not sentiment.' },
      ],
      goto: 'hub',
    },
    warning: {
      onEnter: [enableExit('onward'), setFlag('act1:briefed', true)],
      lines: [
        { speakerId: 'mordecai', text: 'Then hear the quiet version, once. This floor is a machine for making stories out of people. Be the teller, not the material.', expression: 'worried' },
        { speakerId: 'mordecai', text: 'The door on the right goes deeper - the maze first, then the neighborhoods, and somewhere past them the stairs down. The stairwell is boss-guarded. They always are. You will not be ready when you find it. Go anyway, carefully.' },
        { speakerId: 'mordecai', text: 'Come back if you are hurt or lost. That is not politeness. That is what I am for.' },
        { speakerId: 'donut', text: 'We thank you for your service, rat person. You may bow at your convenience.', expression: 'smug' },
      ],
      goto: 'end',
    },
    bye: {
      lines: [
        { speakerId: 'mordecai', text: 'Go on. And Carl - eat something. Sleep when you can. The dungeon takes the tired ones first.' },
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
// Tally - the MoonBurger safe-room attendant (polite, cheerful, rule-bound)
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
        { text: 'What is the door with my name on it?', goto: 'personal', once: true },
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
    personal: {
      lines: [
        { speakerId: 'tally', text: 'You noticed! That is your PERSONAL SPACE, sir. Every registered crawler gets one, in every safe room, and it is always the same room inside - the dungeon carries it along for you, like luggage that never gets lost.' },
        { speakerId: 'tally', text: 'Inside is yours alone. No cameras, no feed, no audience - the only unbroadcast square footage on the planet, if you do not count the insides of monsters. Crawlers decorate them. Some keep armories. One gentleman grows tomatoes. We do not judge here at MoonBurger.' },
        { speakerId: 'tally', text: 'The princess has one too, of course. Hers is... I am told there is a CHAISE. I am told it is LOAD-BEARING. I have said too much.', expression: 'smug' },
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
        { speakerId: 'tally', text: 'A word from a fan, sir, if I may: when the numbers go up, gifts follow, and gifts have kept better crawlers than you alive. Wave at the drones occasionally. It costs nothing and it buys dinners.' },
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
// Kivvi - the pierced goblin engineer (Act II part 2 parley)
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
// Frank & Maggie - hostile crawlers (Act III, R12). Talk turns to threat.
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
// The Meadow Lark crew (Act III, R13). Eldercare workers, not adventurers -
// they were on shift when the world ended, and they did not leave their
// people. The trees carry that as shape, not speeches.
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
        { text: 'Tell me about the residents.', goto: 'residents', once: true },
        { text: 'What is blocking the stairs?', goto: 'stairs' },
        { text: 'Train with us. We hit it together.', goto: 'recruit', showIf: { flag: 'ally:brandon', not: true } },
        { text: 'Talk later.', goto: 'bye' },
      ],
    },
    survive: {
      lines: [
        { speakerId: 'brandon', text: 'Honestly? We were at work. The announcement came at 2 AM - that is the middle of our shift. Four staff, twenty-two residents, one building turning to gravel around us. There was a staircase in the parking lot. So we did what a night shift does: we made a list, and we got everyone on it down the stairs.' },
        { speakerId: 'brandon', text: 'People keep calling it brave. It was not brave, it was ROUNDS. Check beds, count heads, keep moving. We just... never stopped doing the job. Feed people, watch the door, stay kind. Kindness scales, it turns out.' },
      ],
      goto: 'hub',
    },
    residents: {
      lines: [
        { speakerId: 'brandon', text: 'Twenty-two came down. Nineteen are still with us, and I will give you a minute with that number, because we had it a lot longer.', expression: 'worried' },
        { speakerId: 'brandon', text: 'They are not cargo, crawler - do not make that mistake in camp. Edna runs the card table and the black market in sugar packets. Mr. Okafor fixes anything with a hinge. Half our defense plans came out of a ninety-year-old who did two wars and does not sleep much. We keep them alive. They keep us PEOPLE.' },
      ],
      goto: 'hub',
    },
    stairs: {
      lines: [
        { speakerId: 'brandon', text: 'The stairwell to Floor Two sits off the old ring line. Something huge rolls that loop day and night. Nobody crosses the platform and comes back.', expression: 'worried' },
        { speakerId: 'brandon', text: 'Until it dies, every soul at this bridge is stuck on a floor that is closing. That is the whole problem, crawler. We can hold this camp forever. We cannot hold the CLOCK.' },
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
        { text: 'What did you do before?', goto: 'before', once: true },
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
    before: {
      lines: [
        { speakerId: 'chris', text: 'Overnight orderly. Fourteen years. You learn to lift people without hurting them. You learn to be calm first, so they can borrow it.', expression: 'worried' },
        { speakerId: 'chris', text: '...The lifting transferred. Working on the calm.' },
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
        { text: 'Thirty years of nights?', goto: 'nights', once: true },
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
    nights: {
      lines: [
        { speakerId: 'yolanda', text: 'Thirty years. Do you know what the night shift IS, crawler? It is being the only one awake while everyone you are responsible for is at their most fragile. Watching breathing. Catching falls before they happen. Making the call at 3 AM nobody wants to make.' },
        { speakerId: 'yolanda', text: 'Then the world ended at 2:23 in the morning, ON MY SHIFT, and suddenly everybody wanted to know how we all stayed so calm. Baby, this IS the job. The monsters are just a rash with legs.', expression: 'smug' },
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
        { text: 'You seem young for all this.', goto: 'young', once: true },
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
    young: {
      lines: [
        { speakerId: 'imani', text: 'Nineteen. Second year as an aide - I took nights because it paid for classes. I was doing the 2 AM turns when the sky started talking.', expression: 'worried' },
        { speakerId: 'imani', text: 'Miss Edna held my hand on the stairs. She said, you get me down these steps and I will teach you canasta. She is still teaching me. I am still terrible. That is the arrangement, and it is why I am still standing up straight.', expression: 'worried' },
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
        { speakerId: 'agatha', text: 'The night-shift children think I do not hear them worry about the weight. I hear everything. The cart comes down all eighteen floors, crawler, or I do not. Those are the terms I have offered the dungeon. It has not argued yet.', expression: 'angry' },
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
