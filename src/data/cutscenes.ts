/**
 * Cutscene registry (looked up by playCutscene(id), like rooms and dialogue
 * trees). Cutscenes are plain ScriptAction[] with the cinematic actions  -
 * skippable with Esc, and once-only via the scene:<id>:played flag.
 *
 * All prose here is original writing, split across the three voice channels
 * (src/data/VOICE_BIBLE.md): announce() is The Crawl AI performing to the
 * galactic audience, notify() is the cold interface, describe() is the
 * ambient narrator riding Carl's shoulder.
 */

import {
  addViews,
  announce,
  awardAchievement,
  describe,
  despawnActor,
  disableHotspot,
  enableExit,
  enableHotspot,
  equipItem,
  facePlayer,
  fadeIn,
  fadeOut,
  giveGold,
  giveItem,
  giveXp,
  gotoRoom,
  joinParty,
  learnSkill,
  ifFlag,
  moveActor,
  musicCue,
  notify,
  quitToTitle,
  refreshBackground,
  say,
  setFlag,
  shake,
  setLetterbox,
  sfxCue,
  spawnActor,
  wait,
} from './script';
import type { CutsceneDef, SpriteSheetDef } from './types';

/** Awakened Donut (still a cat, now with opinions). Spawned mid-cutscene. */
export const donutSheet: SpriteSheetDef = {
  path: 'sprites/donut.png',
  frameW: 20,
  frameH: 16,
  mirrorLeft: true,
  anims: {
    idle_down: { frames: [0], frameMs: 400, loop: true },
    idle_up: { frames: [3], frameMs: 400, loop: true },
    idle_right: { frames: [6], frameMs: 400, loop: true },
  },
  // Same tortoiseshell as cat form, plus the post-transformation tiara.
  placeholderOutfit: {
    torso: '#e3cfa8',
    head: '#efe0c0',
    patches: ['#3a332c', '#f6f0e2', '#a2703c'],
    crown: true,
  },
};

// ---------------------------------------------------------------------------
// R01 - the collapse (opening cinematic, ~60-90s watched).
// THE REFERENCE STANDARD for length, tone, and pacing - preserved, with the
// broadcast lines moved onto The Crawl AI's channel where they belong.
// ---------------------------------------------------------------------------

const act1Intro: CutsceneDef = {
  id: 'act1_intro',
  actions: [
    fadeOut(1),
    setLetterbox(true),
    musicCue('act1_collapse_theme'),
    fadeIn(700),
    describe('SEATTLE. WINTER. 2:23 IN THE MORNING. The street is empty, the cold is personal, and every window on the block is dark except one - yours, standing open, exactly the way a cat leaves it.'),
    describe('This is Carl. Late twenties, fixes boats for a living, sleeps badly. Ten minutes ago he was on the couch. Now he is on the sidewalk in boxer shorts, a winter jacket, and a pair of pink Crocs that belong to an ex-girlfriend who is out of the country.'),
    describe('In the jacket pocket: a lighter and half a pack of cigarettes. Officially, he came down for the cat. The cigarette was going to be a bonus. He has not gotten to it, and some part of him already knows he never will.'),
    describe("So does the cat. Princess Donut: a purebred show cat, four-time regional champion, the single most pampered living creature Carl has ever met. She got out. She is HER cat. Tonight, that makes her Carl's whole world."),
    moveActor('player', 120, 165),
    say('carl', 'Donut. It is two in the morning. I am wearing foam shoes in the snow. Come down from the car.'),
    moveActor('donut_cat', 250, 118, { speed: 80 }),
    describe('The cat relocates two car lengths further away and sits, radiating the serenity of a creature with zero stake in human dignity.'),
    sfxCue('deep_rumble'),
    wait(400),
    describe('Then the ground hums. Not an earthquake - steadier than that. More like a public-address system the size of the sky, clearing its throat.'),
    musicCue('system_sting'),
    announce('GOOD MORNING, EARTH. THIS IS A COURTESY ANNOUNCEMENT. The Borant Corporation has been assigned regency over your planet, effective immediately, along with everything on it, in it, and under it. Your species filed no objection, largely because your species was not asked.'),
    announce('All surface structures have been reclassified as debris. Reclamation begins... NOW.'),
    // P16 collapse beat: shake + dust, the building dissolves out between
    // the fades (flag flips the two-state background), staircase light rises.
    musicCue('collapse_hit'),
    sfxCue('city_collapse'),
    shake(1000, 3),
    fadeOut(300),
    setFlag('r01:collapsed', true),
    refreshBackground(),
    fadeIn(350),
    sfxCue('deep_rumble'),
    shake(700, 2),
    enableHotspot('ruins'),
    enableHotspot('stairwell'),
    enableExit('stairs'),
    disableHotspot('window'),
    describe('The skyline folds. Quietly. Politely. Every building on Earth, collapsing at once into neat gravel, like the world had been asked in advance and was embarrassed about the noise. Everyone still indoors goes with them. Carl is outside because of a cat.'),
    musicCue('act1_aftermath'),
    say('carl', 'Okay. Okay. That is... the whole city.'),
    describe('Where each block used to be, a staircase of white light punches down into the earth. One per neighborhood, humming, patient. Yours is conveniently close. None of this is a coincidence.'),
    announce('SURVIVORS: the surface will be uninhabitable within hours. Beneath you, eighteen levels of habitat have been prepared for your convenience. Reach the bottom and you keep your planet. Die, and - well. We do not wish to spoil the show.'),
    announce('That is the other thing, Earth. You are a SHOW now. The galaxy is watching. Smile.'),
    say('carl', 'A show. The end of the world is a show, and the stairs are the only way off the surface.'),
    say('carl', 'Fine. Cat first. Apocalypse second.'),
    describe('That is the situation: get the cat, get to the stairs, get underground before the cold or the sky finishes the job. Everything else can be screamed about later.'),
    setFlag('act1:intro_seen', true),
    setLetterbox(false),
  ],
};

// ---------------------------------------------------------------------------
// R02 - the descent. The Crawl AI's full onboarding: this is where a player
// who has never heard of the source learns every rule of the crawl, because
// the host is contractually delighted to explain it to the new viewers.
// ---------------------------------------------------------------------------

const act1Descent: CutsceneDef = {
  id: 'act1_descent',
  actions: [
    setLetterbox(true),
    musicCue('descent_drone'),
    awardAchievement('first_steps'),
    moveActor('player', 160, 120, { speed: 30 }),
    describe('The stairs go down. And down. The cold peels away a step at a time, replaced by warm air that smells like cut stone, machine oil, and somebody else\'s business plan.'),
    notify('Neural interface installed. Crawler designation: 4,437,102. Waiver: accepted by proxy.'),
    announce("WELCOME, CRAWLER! Yes - crawler. That is your job title now. I am the Crawl AI: your host, your referee, your biggest fan, and the closest thing this facility has to management you can talk to. The waiver was signed on your behalf. It was easier for everyone."),
    announce('For our new viewers joining from seventeen star systems: here is the arrangement. The Borant Corporation holds this planet now - the dirt, the minerals, and the broadcast rights to everything that happens on the way down. Clearing a world is expensive, so Borant pays for it the way anything gets paid for anymore: with a show. THIS show - the galaxy\'s most-watched survival program, filmed live inside the largest dungeon ever constructed, starring everyone this planet had left.'),
    announce('THE RULES, once, for the cheap seats! Eighteen floors, each one bigger, stranger, and hungrier than the last. Clear the stairwell boss, take the stairs, do it again. Reach the bottom alive and you win: your life, your freedom, and a prize account that would embarrass a small navy.'),
    announce('One rule above all the others, Crawler, so listen. The stairs only go down. There is no back. There is no up. The surface you left stopped existing while you were on these steps, and each floor closes behind you on a schedule - linger too long anywhere, and the ceiling stops being a metaphor.'),
    announce('Kill things and you grow stronger - experience, levels, gear, the usual grammar. But here is the part crawlers never believe until it saves them: the AUDIENCE is the real economy down here. Entertain them and they send gifts. Real ones. Boxes with treasure inside, dropped from nowhere, addressed to you personally. Bore them and... do not bore them.'),
    announce('Safe rooms are marked and they are real - nothing hostile gets in, meals are hot, and the doors lock from your side. We are cruel, viewers, but we are not MONSTERS. The monsters are a separate department.'),
    notify('Ambient guidance enabled. Readable text and usable objects are highlighted for your convenience.'),
    say('carl', 'Down the stairs, clear the floor, keep the cat alive, do not bore the aliens. Noted. Terms and conditions: apocalyptic.'),
    fadeOut(400),
    setLetterbox(false),
    gotoRoom('r03_entrance'),
    fadeIn(400),
  ],
};

// ---------------------------------------------------------------------------
// R03 - the digging machine (P15 set-piece: stakes beat before the guild)
// ---------------------------------------------------------------------------

const act1Diggers: CutsceneDef = {
  id: 'act1_diggers',
  actions: [
    setLetterbox(true),
    musicCue('silence'),
    sfxCue('machine_roar'),
    describe('The far end of the corridor lights up orange. Something is coming around the bend - iron wheels studded with digging spikes, steam screaming out of every seam, chewing the floor as it rolls.'),
    describe('Riding its wake: goblins. Small, green, armed with scrap, and visibly delighted. One of them points at you and says something that needs no translation.'),
    say('carl', 'A steamroller. They built a steamroller with teeth, and it is pointed at me, and I am in my underwear.'),
    musicCue('system_sting'),
    announce("Crawlers and viewers - the season's FIRST REAL BLOODSPORT! One unarmed human in novelty footwear. One dig engine, lovingly assembled by clan artisans. The odds board is open and, I will be honest with you, folks, insulting."),
    describe('The machine is too wide to dodge and too dumb to aim. The goblins are neither. Deal with the escorts before the driver lines up a second pass.'),
    setFlag('act1:diggers_seen', true),
    setLetterbox(false),
  ],
};

const act1MachineWreck: CutsceneDef = {
  id: 'act1_machine_wreck',
  actions: [
    setLetterbox(true),
    sfxCue('machine_roar'),
    describe('The escorts are down - and the machine keeps going. Nobody is steering it now. It clips a support column, ricochets, and takes the long wall at full boil.'),
    sfxCue('machine_wreck'),
    fadeOut(90),
    fadeIn(160),
    describe('Spikes shear off in a fan of sparks. The boiler lets go with a sound like a kicked cathedral. What remains grinds itself into the corner, twitches once, and dies as steam.'),
    say('carl', 'Their own machine. I did not even touch it. I want that noted somewhere official.'),
    announce('NOTED, Crawler! Cause of destruction: unsupervised enthusiasm. Viewers, he stood still while a war machine committed suicide in front of him, and our style judges are FURIOUS that it worked. The audience awards points anyway. They like a survivor with luck he did not earn - it suggests more is coming.'),
    awardAchievement('traffic_incident'),
    enableExit('guild'),
    disableHotspot('commotion'),
    setLetterbox(false),
  ],
};

// ---------------------------------------------------------------------------
// R04 - the registration ritual. The demo dramatizes the stat menu: the
// Crawl AI performs the scan to the audience, the interface files the
// paperwork, and the ratings board gets its talk-show debut.
// ---------------------------------------------------------------------------

const act1CharacterCreation: CutsceneDef = {
  id: 'act1_character_creation',
  actions: [
    setLetterbox(true),
    musicCue('interface_boot'),
    sfxCue('ui_scan'),
    announce('REGISTRATION TIME, folks - my favorite segment! One unsorted survivor goes in, one licensed contestant comes out. Hold still, Crawler. The scan is painless, which we mention because almost nothing else here is.'),
    facePlayer('down'),
    describe('Light crawls over you, cataloguing. It reads your teeth, your debts, your search history. It lingers, judgmentally, at ankle height.'),
    announce('Let us see what the box of you contains! Species: human. Trade: marine repair technician - wiring, pumps, engines, the parts of a boat that kill you if you guess. Prior service: coast guard. Current status: insomniac. Notable assets: good hands, worse temper, and a documented history of finishing things he starts, mostly out of spite. Footwear: FLAGGED FOR AUDIENCE ENGAGEMENT.'),
    say('carl', 'The shoes are temporary.'),
    announce('The footage is forever, Crawler. Now - the class. Viewers, this is the moment! The system weighs a soul, checks the merchandise forecasts, and stamps a destiny.'),
    notify('Species: human. Class assigned: SURVIVOR (PROVISIONAL). Classification pending further observation.'),
    announce('PROVISIONAL, folks! It means the system has not decided what he is yet. Neither has he. The audience ADORES a mystery box - the betting pools are already open on what he becomes.'),
    setFlag('carl:registered', true),
    setFlag('carl:class', 'SURVIVOR (PROVISIONAL)'),
    notify('Starter equipment authorized: 1 blunt instrument, 1 jacket (pre-owned), 1 pair fingerless gloves.'),
    giveItem('rusty_cudgel'),
    giveItem('carls_jacket'),
    giveItem('fingerless_gloves'),
    equipItem('carl', 'rusty_cudgel'),
    equipItem('carl', 'carls_jacket'),
    equipItem('carl', 'fingerless_gloves'),
    sfxCue('equip_clank'),
    notify('Equipment bound. Loadout may be changed from the pack at any time.'),
    // The ratings board: the talk-show segment where the metrics debut.
    announce('And NOW - while he is standing still and cannot stop me - his RATINGS BOARD! Every crawler gets one, viewers. Four numbers that measure not whether he lives, but whether he is worth watching while he tries.'),
    announce("GRIT: how he holds when it goes wrong - debuting strong, the man is wearing pajamas in a dungeon and has not wept once. FLAIR: style of play - low, but the Crocs are carrying it. CARNAGE: self-explanatory - untested, promising temper. CHARM: audience warmth - and OH, viewers, the early numbers say you like him. You absolute romantics."),
    notify('Ratings profile initialized: GRIT, FLAIR, CARNAGE, CHARM. Baseline recorded. Gift eligibility: active.'),
    announce('Keep those numbers moving, Crawler. The audience feeds the interesting ones. It is not a threat. It is a BUSINESS MODEL.'),
    setFlag('carl:ratings_seen', true),
    announce('Equipment bound, ratings live, paperwork filed. You are now, legally speaking, an adventurer. Condolences.'),
    setLetterbox(false),
  ],
};

// ---------------------------------------------------------------------------
// R04 - Donut's transformation (the Act I hinge - given room to land)
// ---------------------------------------------------------------------------

const act1DonutTransformation: CutsceneDef = {
  id: 'act1_donut_transformation',
  actions: [
    setLetterbox(true),
    musicCue('lootbox_fanfare'),
    announce('HOLD EVERYTHING. Unclaimed reward detected in the guild, and viewers, you are going to want to sit down for this one. A VIEWER GIFT has arrived - the audience sends presents to contestants it likes, Crawler, and somebody out there has been watching this feed very, very closely.'),
    notify('Viewer gift received. Class: LEGENDARY. Recipient: not you.'),
    announce('That is right, folks - it is not addressed to the human. Recipient: THE CAT. The system does not make mistakes. The system is as surprised as you are.'),
    describe('A box that was not there before sits on the crate beside her, wrapped in light, patient as an unexploded thing. The cat opens one eye, considers it, and - because she is a cat - touches it anyway.'),
    sfxCue('lootbox_open'),
    fadeOut(180),
    fadeIn(220),
    announce('THERE IT IS! Viewers, what you are watching is a full sapience event, live on camera - rarer than a resurrection and twice as expensive. Whoever sent this gift, the production office would like a word, and the merchandising department would like SEVERAL.'),
    describe('Light pours over the cat. Her fur goes incandescent. Somewhere, a stat called CHARISMA breaks something it should not be able to reach. And then - she stands up wrong. On purpose. Like she has been waiting years for the room to be worth it.'),
    notify('Subject: PRINCESS DONUT. Race: sapient feline. Class: MAGE. Charisma: recalculating. Recalculating. Cap raised.'),
    despawnActor('donut_cat'),
    spawnActor('donut', donutSheet, 200, 128, { facing: 'down' }),
    disableHotspot('cat'),
    enableHotspot('donut'),
    say('donut', '...Mrow?'),
    say('donut', 'No. Wait. I can DO the mouth thing.'),
    say('donut', 'Words. These are WORDS, Carl. I have been listening to you waste them for three years and now I have my own.'),
    say('donut', 'I require an audience with whoever is in charge, a warm lap, and an apology. In that order.'),
    describe('Carl does not say anything. There is no procedure for this. The cat he chased across a frozen street is looking at him with the same eyes as always, and the eyes have someone new behind them - or someone who was always there, finally allowed to speak.'),
    say('carl', 'You can talk. The cat can talk.'),
    say('donut', 'The CAT is a champion purebred and you will use my full title. Princess Donut the Queen Anne Chonk. It is on my certificate.'),
    say('carl', '...It is on her certificate. That is true. I framed it.'),
    announce('PARTY FORMED, ladies and gentlebeings: THE ROYAL COURT OF PRINCESS DONUT! Party leader: disputed. The audience has already picked a favorite, and Crawler - it is not you. It was never going to be you.'),
    notify('Party registered: THE ROYAL COURT OF PRINCESS DONUT. Members: 2. Shared experience pool: active.'),
    joinParty('donut'),
    setFlag('act1:donut_awake', true),
    setFlag('act1:party_formed', true),
    setFlag('party:name', 'THE ROYAL COURT OF PRINCESS DONUT'),
    awardAchievement('royal_court'),
    notify('Skill unlocked: MAGIC MISSILE (PRINCESS DONUT).'),
    say('donut', 'Also I know MAGIC MISSILE now. Do try to keep up.'),
    setLetterbox(false),
  ],
};

// ---------------------------------------------------------------------------
// R07 - the show premiere. Opening night: the moment Carl understands, all
// the way down, that he is on television.
// ---------------------------------------------------------------------------

const act2Premiere: CutsceneDef = {
  id: 'act2_premiere',
  actions: [
    setLetterbox(true),
    musicCue('premiere_fanfare'),
    sfxCue('broadcast_static'),
    describe('Every screen in the restaurant blinks on at once. So does something behind your eyes - a small, bright counter that was always going to be there, waiting for its cue.'),
    notify('Your episode is now airing. Distribution: 17 systems. View counter: enabled.'),
    announce("IT IS OPENING NIGHT, LADIES AND GENTLEBEINGS! Live from Floor One, the show you voted onto the main feed: a boat mechanic in his ex's Crocs, a purebred princess with a spell list, and a floor that wants them both creatively dead. I have hosted nine seasons of this program and I am telling you - I have a FEELING about these two."),
    addViews(1412),
    announce('Tonight\'s premiere is brought to you by MoonBurger - MoonBurger: it is technically food - and by viewers like YOU, whose gifts keep our contestants alive, armed, and legally obligated to be interesting.'),
    addViews(2304),
    wait(400),
    say('donut', 'Carl. CARL. Do you see the number. The number is GOING UP. They can SEE me.'),
    say('donut', 'Sit up straight. Angle your jaw. We are a PREMIERE, Carl, not a documentary about posture failure.'),
    say('carl', 'They can see everything, Donut. That is the problem.'),
    describe('He says it lightly, and then it lands on him, all at once and quietly: the eyes. Millions of them, then more, arriving in blocks of a thousand while he stands in a plastic booth in a dead restaurant. Every fight, every mistake, every word to the cat - programming. He goes very still.'),
    addViews(1871),
    announce('And look at that engagement, folks! He just went quiet on camera and the numbers CLIMBED. Contemplation polls, who knew! The whales are circling already - our top-tier subscribers, Crawler, the ones whose gifts arrive in crates. Give them a reason.'),
    notify('Audience milestone reached. Viewer gift queue: 1 pending.'),
    giveGold(25),
    say('donut', 'Gifts, Carl. GIFTS. The audience pays tribute, as is right and proper. Naturally most of it is for me.'),
    describe('The counter climbs while you stand still. Standing still, it turns out, polls well when a cat is present.'),
    say('donut', 'Chin up, Carl. We have a demographic now.'),
    setFlag('act2:premiere_seen', true),
    awardAchievement('prime_time'),
    setLetterbox(false),
  ],
};

// ---------------------------------------------------------------------------
// R08 - Donut learns to fight with claws
// ---------------------------------------------------------------------------

const act2DonutClaws: CutsceneDef = {
  id: 'act2_donut_claws',
  actions: [
    setLetterbox(true),
    sfxCue('skitter'),
    describe('Something greasy bolts out from under the fallen crawler and heads straight for Carl.'),
    spawnActor('donut', donutSheet, 120, 150, { facing: 'right' }),
    moveActor('donut', 200, 154, { speed: 140 }),
    sfxCue('claw_shred'),
    describe('A pink blur crosses the alcove. There is a brief, comprehensive sound. The greasy thing stops existing as a single object.'),
    say('donut', 'I have KNIVES, Carl. I have ALWAYS had knives. I simply never needed to know it before now.'),
    say('carl', 'You did that for me.'),
    say('donut', 'I did that AT you. The protecting was incidental. ...Are you hurt?'),
    learnSkill('donut', 'claw_flurry'),
    notify('Skill registered: CLAW FLURRY (PRINCESS DONUT).'),
    announce('The Princess is ARMED, viewers! The rats of this floor have filed a formal complaint. The complaint has been eaten.'),
    setFlag('act2:claws_learned', true),
    moveActor('donut', 120, 150, { speed: 100 }),
    despawnActor('donut'),
    setLetterbox(false),
  ],
};

// ---------------------------------------------------------------------------
// R10 - THE DETONATION (Act II's showpiece; also the War Chieftain's death.
// Puzzle-as-kill, option (a): no cleanup fight - rewards granted here.)
// ---------------------------------------------------------------------------

const act2Detonation: CutsceneDef = {
  id: 'act2_detonation',
  actions: [
    setLetterbox(true),
    musicCue('silence'),
    sfxCue('fuse_hiss'),
    describe('The fuse takes the spark and runs with it, hissing down the rail like a rumor. Somewhere behind the iron door, a very large fist knocks twice.'),
    say('carl', 'Delivery.'),
    wait(500),
    sfxCue('detonation_1'),
    fadeOut(80),
    fadeIn(120),
    describe('The cart goes first. Then the doorway. Then the concept of the doorway.'),
    sfxCue('detonation_2'),
    fadeOut(60),
    fadeIn(100),
    describe('The kegs answer each other across the shop, call and response, a choir with one hymn. The forge line catches last and sings the high note.'),
    sfxCue('detonation_3'),
    fadeOut(120),
    wait(400),
    fadeIn(300),
    describe('Silence. Real silence, the kind this floor does not stock. The workshop is a room-shaped memory. The boss floor is a skylight.'),
    setFlag('chieftain:detonated', true),
    notify('Neighborhood boss eliminated: THE WAR CHIEFTAIN. Method: indirect. Kill credited.'),
    announce('OH. OH, VIEWERS. He mailed a bomb to a boss and the boss SIGNED FOR IT. Nine seasons, people. Nine seasons, and I have never seen the kill screen say LOGISTICS before. The clip is already the most-shared footage in three systems and the numbers - LOOK at the numbers!'),
    addViews(31207),
    giveXp(300),
    giveGold(120),
    awardAchievement('regime_change'),
    say('donut', 'Carl. You detonated a POSTCODE. I have never been prouder or further from wanting to be held.'),
    say('carl', 'The rail did the work. I just signed the manifest.'),
    disableHotspot('boss_door'),
    disableHotspot('cart_door'),
    disableHotspot('kegs'),
    enableHotspot('strongbox'),
    enableExit('east'),
    setLetterbox(false),
  ],
};

// ---------------------------------------------------------------------------
// R11 - the aftermath (tonal beat: the host gloats, the room does not)
// ---------------------------------------------------------------------------

const act2Aftermath: CutsceneDef = {
  id: 'act2_aftermath',
  actions: [
    setLetterbox(true),
    musicCue('silence'),
    describe('Smoke stands in the yard like it is waiting for someone. The choppers are on their sides. Nothing chitters.'),
    moveActor('player', 140, 160, { speed: 30 }),
    announce('ACHIEVEMENT UNLOCKED: WHOLESALE! Retail violence is for lesser crawlers, folks - this one went WHOLESALE! Confetti is en route from a neighboring system!'),
    awardAchievement('wholesale'),
    addViews(2213),
    describe('The counter climbs anyway. It always climbs.'),
    wait(600),
    describe("Kivvi's bench is empty. Her wrench is where wrenches go. Nothing else is where it goes."),
    say('carl', 'She said one spark. She told me exactly what would happen. I did it anyway.'),
    say('donut', '...You will carry this one, Carl. Set it down somewhere it can not reach the others.'),
    wait(600),
    describe('Carl finds the half-pack in his jacket, taps one out, and smokes his first cigarette of the apocalypse standing in the wreckage of his best idea. It tastes like the yard smells. He finishes it anyway, because some rituals are load-bearing.'),
    announce('The audience is quiet too, Crawler. Do not mistake it for mercy. They are memorizing you.'),
    setFlag('act2:aftermath_seen', true),
    setLetterbox(false),
  ],
};

// ---------------------------------------------------------------------------
// R12 - the reverse-trap pays off (restraint: the host confirms almost nothing)
// ---------------------------------------------------------------------------

const act3Trap: CutsceneDef = {
  id: 'act3_trap',
  actions: [
    setLetterbox(true),
    musicCue('silence'),
    describe('You step into the narrow cut, loud on purpose. Behind you: two sets of footsteps that were always going to be there.'),
    say('maggie', 'Told you. Somewhere narrow.'),
    sfxCue('trip_snap'),
    fadeOut(90),
    fadeIn(160),
    describe('The tripline answers before you do. Dust. Ringing. Then the corridor is very still.'),
    wait(500),
    describe('When it settles, the cut is empty behind you. Two packs lie where their owners chose to leave them.'),
    notify('Hostile crawlers: resolved. Footage rating: HANDLED.'),
    say('carl', 'They followed us into a bottleneck they picked. I just got there first.'),
    say('donut', 'You are learning the floor, Carl. I am choosing not to examine how quickly.'),
    giveXp(150),
    giveGold(40),
    awardAchievement('return_to_sender'),
    enableExit('east'),
    setLetterbox(false),
  ],
};

// ---------------------------------------------------------------------------
// R15 - the training montage (game-show flair; the crew becomes a unit)
// ---------------------------------------------------------------------------

const act3Montage: CutsceneDef = {
  id: 'act3_montage',
  actions: [
    setLetterbox(true),
    musicCue('montage_theme'),
    announce('TRAINING ARC DETECTED! Viewers, the audience has been demanding this episode all season, and the production office reads its mail. Roll the music.'),
    sfxCue('weights_clank'),
    describe('Brandon calls lifts like med rounds. Yolanda pins bottle caps at forty paces. Chris breaks a heavy bag with his hat. Everyone pretends that was normal.'),
    fadeOut(150),
    fadeIn(200),
    describe("Imani and Donut spar. It ends in four seconds. Donut awards herself the win on style. Imani allows it, which is how you know who won."),
    say('donut', 'We are calling that a draw, and I am calling myself the winner of the draw.'),
    fadeOut(150),
    fadeIn(200),
    describe('Days compress the way they only do on camera. Calluses, drills, one shared pot of terrible coffee. A crew, assembling itself around a repairman.'),
    addViews(6821),
    giveXp(350),
    notify('Certification: raid readiness achieved. Party synergy: registered.'),
    announce('The dungeon certifies this crew RAID READY, folks - and the merchandise is PENDING. Night-shift jerseys. I have seen the mockups. They are beautiful.'),
    say('carl', 'We go at the ring tomorrow. Everyone sleeps tonight. That is the whole speech.'),
    setFlag('raid:trained', true),
    setLetterbox(false),
  ],
};

// ---------------------------------------------------------------------------
// R16 - the derail (phase 1 payoff; combat starts from the hotspot script)
// ---------------------------------------------------------------------------

const act3Derail: CutsceneDef = {
  id: 'act3_derail',
  actions: [
    setLetterbox(true),
    musicCue('silence'),
    describe('You count the lap under your breath. Wide on the bend. Twelve seconds. You squeeze the striker on ten.'),
    sfxCue('det_cord_crack'),
    fadeOut(80),
    fadeIn(120),
    describe('The rigged barbell fires as the mass leans into the bend. Iron meets momentum. Momentum files a complaint.'),
    sfxCue('ball_derail'),
    fadeOut(120),
    fadeIn(250),
    describe('THE BALL leaves the rail, chews through a pillar, and comes to rest in a shrieking tangle. Pieces of it stand up. IT is trying to.'),
    setFlag('ball:derailed', true),
    addViews(12406),
    announce('THE BALL IS DOWN! A season of laps, viewers, ended by a barbell and a man who can COUNT! The borough boss is derailed and dazed and the window is OPEN - hurry, Crawler. I suggest this sincerely, for once.'),
    notify('Boss vulnerability window: OPEN.'),
    say('brandon', 'NOW! Lanes like we drilled - go, go!'),
    setLetterbox(false),
  ],
};

// ---------------------------------------------------------------------------
// R17 - the finale: loot ceremony, the crew, the stairs, Donut and Carl
// ---------------------------------------------------------------------------

const act3Finale: CutsceneDef = {
  id: 'act3_finale',
  actions: [
    setLetterbox(true),
    musicCue('stairs_theme'),
    describe('The stairwell doors grind open for the first time in a season. Light from below. Warmer than the light up here. Probably a trick.'),
    announce('LOOT CEREMONY, ladies and gentlebeings! The dungeon distributes: gold, gear, and the statistical likelihood of surviving Floor Two. Two of these are real.'),
    giveGold(100),
    addViews(9114),
    describe('The Meadow Lark residents file toward the stairs in twos, night-shifters at the rails. Brandon counts heads. Yolanda counts them again.'),
    ifFlag(
      'agatha:cart_promised',
      [
        describe('Agatha arrives last, cart intact, every wheel attached, Herbert the flamingo riding point with his arrow at a jaunty angle.'),
        say('agatha', 'All wheels. Hm. Contract honored, crawler. You may push it down the stairs. CAREFULLY.'),
      ],
      [
        describe('Agatha muscles her cart past you without a word. Herbert the flamingo watches you go by, arrow and all, unimpressed.'),
      ],
    ),
    say('brandon', 'Whatever is down there, it has not met a night shift. See you on Two, Carl.'),
    wait(400),
    say('carl', 'Donut. We got them to the stairs. All of them that were left to get.'),
    say('donut', 'Then carry the ones we did not, and walk. Royalty does not linger at exits. It makes them look guilty.'),
    announce('Crawlers - the audience is ENORMOUS now. Millions on this feed alone, gift queues backed up across three systems, and the floors below only get hungrier for all of it. Descend when ready. We will be watching. We are ALWAYS watching.'),
    awardAchievement('first_floor'),
    setFlag('act3:finale_seen', true),
    setLetterbox(false),
  ],
};

// The credits card: plays from the stairs hotspot, then unwinds to title.
const act3Credits: CutsceneDef = {
  id: 'act3_credits',
  actions: [
    setLetterbox(true),
    musicCue('credits_theme'),
    fadeOut(700),
    announce('END OF PART ONE - THE FIRST FLOOR.'),
    describe('DUNGEON CRAWLER CARL: THE FIRST FLOOR. A fan-made adventure demo. All art: placeholder, lovingly generated at runtime.'),
    describe('Starring: a repairman, a cat, and the worst game show in the galaxy.'),
    announce('Thank you for crawling. The dungeon will remember you fondly, which should worry you.'),
    quitToTitle(),
  ],
};

export const cutscenes: Record<string, CutsceneDef> = {
  [act1Intro.id]: act1Intro,
  [act1Descent.id]: act1Descent,
  [act1Diggers.id]: act1Diggers,
  [act1MachineWreck.id]: act1MachineWreck,
  [act1CharacterCreation.id]: act1CharacterCreation,
  [act1DonutTransformation.id]: act1DonutTransformation,
  [act2Premiere.id]: act2Premiere,
  [act2DonutClaws.id]: act2DonutClaws,
  [act2Detonation.id]: act2Detonation,
  [act2Aftermath.id]: act2Aftermath,
  [act3Trap.id]: act3Trap,
  [act3Montage.id]: act3Montage,
  [act3Derail.id]: act3Derail,
  [act3Finale.id]: act3Finale,
  [act3Credits.id]: act3Credits,
};
