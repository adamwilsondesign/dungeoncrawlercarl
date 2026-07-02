/**
 * Cutscene registry (looked up by playCutscene(id), like rooms and dialogue
 * trees). Cutscenes are plain ScriptAction[] with the cinematic actions  -
 * skippable with Esc, and once-only via the scene:<id>:played flag.
 *
 * All prose here is original writing in the demo's house voice.
 */

import {
  addViews,
  awardAchievement,
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
  narrate,
  quitToTitle,
  say,
  setFlag,
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
// R01 - the collapse (opening cinematic, ~60-90s watched)
// ---------------------------------------------------------------------------

const act1Intro: CutsceneDef = {
  id: 'act1_intro',
  actions: [
    fadeOut(1),
    setLetterbox(true),
    musicCue('act1_collapse_theme'),
    fadeIn(700),
    narrate('SEATTLE. WINTER. 2:23 IN THE MORNING. The street is empty, the cold is personal, and every window on the block is dark except one - yours, standing open, exactly the way a cat leaves it.'),
    narrate('This is Carl. Late twenties, works with his hands, sleeps badly. Ten minutes ago he was on the couch. Now he is on the sidewalk in boxer shorts, a winter jacket, and a pair of pink Crocs that belong to an ex-girlfriend who is out of the country.'),
    narrate("So does the cat. Princess Donut: a purebred show cat, four-time regional champion, the single most pampered living creature Carl has ever met. She got out. She is HER cat. Tonight, that makes her Carl's whole world."),
    moveActor('player', 120, 165),
    say('carl', 'Donut. It is two in the morning. I am wearing foam shoes in the snow. Come down from the car.'),
    moveActor('donut_cat', 250, 118, { speed: 80 }),
    narrate('The cat relocates two car lengths further away and sits, radiating the serenity of a creature with zero stake in human dignity.'),
    sfxCue('deep_rumble'),
    wait(400),
    narrate('Then the ground hums. Not an earthquake - steadier than that. More like a public-address system the size of the sky, clearing its throat.'),
    musicCue('system_sting'),
    narrate('GOOD MORNING, EARTH. THIS IS A COURTESY ANNOUNCEMENT. YOUR PLANET HAS BEEN PURCHASED FOR MINERAL DEVELOPMENT BY THE VALTAY SYNDICATE. YOUR SPECIES FILED NO OBJECTION, LARGELY BECAUSE YOUR SPECIES WAS NOT ASKED.'),
    narrate('ALL SURFACE STRUCTURES HAVE BEEN RECLASSIFIED AS DEBRIS. RECLAMATION BEGINS... NOW.'),
    sfxCue('city_collapse'),
    fadeOut(200),
    fadeIn(250),
    narrate('The skyline folds. Quietly. Politely. Every building on Earth, collapsing at once into neat gravel, like the world had been asked in advance and was embarrassed about the noise. Everyone still indoors goes with them. Carl is outside because of a cat.'),
    say('carl', 'Okay. Okay. That is... the whole city.'),
    narrate('Where each block used to be, a staircase of white light punches down into the earth. One per neighborhood, humming, patient. Yours is conveniently close. None of this is a coincidence.'),
    narrate('SURVIVORS: THE SURFACE WILL BE UNINHABITABLE WITHIN HOURS. BENEATH YOU, EIGHTEEN LEVELS OF HABITAT HAVE BEEN PREPARED FOR YOUR CONVENIENCE. REACH THE BOTTOM AND YOU KEEP YOUR PLANET. DIE, AND - WELL. THE DUNGEON DOES NOT WISH TO SPOIL THE SHOW.'),
    narrate('THAT IS THE OTHER THING, EARTH. YOU ARE A SHOW NOW. THE GALAXY IS WATCHING. SMILE.'),
    say('carl', 'A show. The end of the world is a show, and the stairs are the only way off the surface.'),
    say('carl', 'Fine. Cat first. Apocalypse second.'),
    narrate('That is the situation, Crawler: get the cat, get to the stairs, get underground before the cold or the sky finishes the job. Everything else can be screamed about later.'),
    setFlag('act1:intro_seen', true),
    setLetterbox(false),
  ],
};

// ---------------------------------------------------------------------------
// R02 - the descent (short transitional cinematic)
// ---------------------------------------------------------------------------

const act1Descent: CutsceneDef = {
  id: 'act1_descent',
  actions: [
    setLetterbox(true),
    musicCue('descent_drone'),
    awardAchievement('first_steps'),
    moveActor('player', 160, 120, { speed: 30 }),
    narrate('The stairs go down. And down. The cold peels away a step at a time, replaced by warm air that smells like cut stone, machine oil, and somebody else\'s business plan.'),
    narrate('WELCOME, CRAWLER. YES - CRAWLER. THAT IS YOUR JOB TITLE NOW. YOU ARE ENTRANT 4,437,102 IN THIS SEASON OF THE GALAXY\'S MOST-WATCHED SURVIVAL PROGRAM. YOUR WAIVER WAS SIGNED ON YOUR BEHALF. IT WAS EASIER FOR EVERYONE.'),
    narrate('THE RULES, ONCE, FOR THE CHEAP SEATS: EIGHTEEN FLOORS. EACH ONE BIGGER, STRANGER, AND HUNGRIER THAN THE LAST. CLEAR A FLOOR AND THE STAIRS TO THE NEXT ONE OPEN. REACH THE BOTTOM ALIVE AND YOU WIN - YOUR LIFE, YOUR FREEDOM, AND A TRULY OBSCENE AMOUNT OF PRIZE MONEY.'),
    narrate('ONE RULE ABOVE ALL THE OTHERS, CRAWLER, SO LISTEN: THE STAIRS ONLY GO DOWN. THERE IS NO BACK. THERE IS NO UP. THE SURFACE YOU LEFT NO LONGER EXISTS IN ANY FORM YOU WOULD RECOGNIZE.'),
    narrate('KILL THINGS AND YOU GROW STRONGER. ENTERTAIN THE AUDIENCE AND THEY WILL SEND YOU GIFTS. BORE THEM AND... DO NOT BORE THEM.'),
    say('carl', 'Down the stairs, clear the floor, keep the cat alive, do not bore the aliens. Noted. Terms and conditions: apocalyptic.'),
    fadeOut(400),
    setLetterbox(false),
    gotoRoom('r03_entrance'),
    fadeIn(400),
  ],
};

// ---------------------------------------------------------------------------
// R04 - cinematic character creation (the demo dramatizes the stat menu)
// ---------------------------------------------------------------------------

const act1CharacterCreation: CutsceneDef = {
  id: 'act1_character_creation',
  actions: [
    setLetterbox(true),
    musicCue('interface_boot'),
    sfxCue('ui_scan'),
    narrate('REGISTERING CRAWLER. HOLD STILL. THIS SCAN IS PAINLESS, WHICH WE MENTION BECAUSE MOST THINGS HERE ARE NOT.'),
    facePlayer('down'),
    narrate('Light crawls over you, cataloguing. It reads your teeth, your debts, your search history. It lingers, judgmentally, at ankle height.'),
    narrate('SPECIES: HUMAN. BUILD: FORMER LINE COOK, CURRENT INSOMNIAC. NOTABLE ASSETS: GOOD HANDS, WORSE TEMPER. FOOTWEAR: FLAGGED FOR AUDIENCE ENGAGEMENT.'),
    say('carl', 'The shoes are temporary.'),
    narrate('THE FOOTAGE IS FOREVER, CRAWLER. CLASS ASSIGNED: SURVIVOR, PROVISIONAL. IT MEANS THE SYSTEM HAS NOT DECIDED WHAT YOU ARE YET. NEITHER HAVE YOU. THE AUDIENCE ENJOYS A MYSTERY.'),
    setFlag('carl:registered', true),
    setFlag('carl:class', 'SURVIVOR (PROVISIONAL)'),
    narrate('STARTER KIT APPROVED. CONTENTS: ONE BLUNT INSTRUMENT, ONE JACKET YOU ALREADY OWNED, ONE PAIR OF GLOVES MISSING THE IMPORTANT HALVES.'),
    giveItem('rusty_cudgel'),
    giveItem('carls_jacket'),
    giveItem('fingerless_gloves'),
    equipItem('carl', 'rusty_cudgel'),
    equipItem('carl', 'carls_jacket'),
    equipItem('carl', 'fingerless_gloves'),
    sfxCue('equip_clank'),
    narrate('EQUIPMENT BOUND. YOU ARE NOW, LEGALLY SPEAKING, AN ADVENTURER. CONDOLENCES.'),
    setLetterbox(false),
  ],
};

// ---------------------------------------------------------------------------
// R04 - Donut's transformation (the Act I hinge)
// ---------------------------------------------------------------------------

const act1DonutTransformation: CutsceneDef = {
  id: 'act1_donut_transformation',
  actions: [
    setLetterbox(true),
    musicCue('lootbox_fanfare'),
    narrate('UNCLAIMED REWARD DETECTED. A VIEWER GIFT, CRAWLER - THE AUDIENCE SENDS PRESENTS TO CONTESTANTS IT LIKES. THIS ONE IS NOT ADDRESSED TO YOU.'),
    narrate('RECIPIENT: THE CAT. THE SYSTEM DOES NOT MAKE MISTAKES. THE SYSTEM IS AS SURPRISED AS YOU ARE.'),
    sfxCue('lootbox_open'),
    fadeOut(180),
    fadeIn(220),
    narrate('Light pours over the cat. Her fur goes incandescent. Somewhere, a stat called CHARISMA breaks something it should not be able to reach. And then - she stands up wrong. On purpose. Like she has been waiting years for the room to be worth it.'),
    despawnActor('donut_cat'),
    spawnActor('donut', donutSheet, 200, 128, { facing: 'down' }),
    disableHotspot('cat'),
    enableHotspot('donut'),
    say('donut', '...Mrow?'),
    say('donut', 'No. Wait. I can DO the mouth thing.'),
    say('donut', 'Carl. CARL. I require an audience with whoever is in charge, a warm lap, and an apology in that order.', ),
    say('carl', 'You can talk. The cat can talk.'),
    say('donut', 'The CAT is a champion purebred and you will use my full title. Princess Donut the Queen Anne Chonk. It is on my certificate.'),
    narrate('PARTY FORMED: THE ROYAL COURT OF PRINCESS DONUT. PARTY LEADER: DISPUTED. THE AUDIENCE HAS ALREADY PICKED A FAVORITE. IT IS NOT CARL.'),
    joinParty('donut'),
    setFlag('act1:donut_awake', true),
    setFlag('act1:party_formed', true),
    setFlag('party:name', 'THE ROYAL COURT OF PRINCESS DONUT'),
    awardAchievement('royal_court'),
    say('donut', 'Also I know MAGIC MISSILE now. Do try to keep up.'),
    setLetterbox(false),
  ],
};

// ---------------------------------------------------------------------------
// R07 - the show premiere (the Views counter becomes meaningful)
// ---------------------------------------------------------------------------

const act2Premiere: CutsceneDef = {
  id: 'act2_premiere',
  actions: [
    setLetterbox(true),
    musicCue('premiere_fanfare'),
    sfxCue('broadcast_static'),
    narrate('Every screen in the restaurant blinks on at once. So does something behind your eyes. ATTENTION: YOUR EPISODE IS NOW AIRING.'),
    addViews(1412),
    narrate('CONGRATULATIONS, CRAWLERS. YOU ARE ENTERTAINMENT NOW. SEVENTEEN SYSTEMS RECEIVE THIS FEED. BE INTERESTING OR BE BRIEF.'),
    addViews(2304),
    wait(400),
    say('donut', 'Carl. CARL. Do you see the number. The number is GOING UP. They can SEE me.'),
    say('carl', 'They can see everything, Donut. That is the problem.'),
    addViews(1871),
    narrate('The counter climbs while you stand still. Standing still, it turns out, polls well when a cat is present.'),
    say('donut', 'Naturally. Chin up, Carl. We have a demographic now.'),
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
    narrate('Something greasy bolts out from under the fallen crawler and heads straight for Carl.'),
    spawnActor('donut', donutSheet, 120, 150, { facing: 'right' }),
    moveActor('donut', 200, 154, { speed: 140 }),
    sfxCue('claw_shred'),
    narrate('A pink blur crosses the alcove. There is a brief, comprehensive sound. The greasy thing stops existing as a single object.'),
    say('donut', 'I have KNIVES, Carl. I have ALWAYS had knives. I simply never needed to know it before now.'),
    say('carl', 'You did that for me.'),
    say('donut', 'I did that AT you. The protecting was incidental. ...Are you hurt?'),
    learnSkill('donut', 'claw_flurry'),
    narrate('SKILL REGISTERED: CLAW FLURRY. THE PRINCESS IS ARMED. THE AUDIENCE IS DELIGHTED. THE RATS ARE NOT.'),
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
    narrate('The fuse takes the spark and runs with it, hissing down the rail like a rumor. Somewhere behind the iron door, a very large fist knocks twice.'),
    say('carl', 'Delivery.'),
    wait(500),
    sfxCue('detonation_1'),
    fadeOut(80),
    fadeIn(120),
    narrate('The cart goes first. Then the doorway. Then the concept of the doorway.'),
    sfxCue('detonation_2'),
    fadeOut(60),
    fadeIn(100),
    narrate('The kegs answer each other across the shop, call and response, a choir with one hymn. The forge line catches last and sings the high note.'),
    sfxCue('detonation_3'),
    fadeOut(120),
    wait(400),
    fadeIn(300),
    narrate('Silence. Real silence, the kind this floor does not stock. The workshop is a room-shaped memory. The boss floor is a skylight.'),
    setFlag('chieftain:detonated', true),
    narrate('NEIGHBORHOOD BOSS ELIMINATED: THE WAR CHIEFTAIN. METHOD: LOGISTICS. THE KILL IS CREDITED, REVIEWED, AND - OH, THE NUMBERS. LOOK AT THE NUMBERS.'),
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
// R11 - the aftermath (tonal beat: the System gloats, the room does not)
// ---------------------------------------------------------------------------

const act2Aftermath: CutsceneDef = {
  id: 'act2_aftermath',
  actions: [
    setLetterbox(true),
    musicCue('silence'),
    narrate('Smoke stands in the yard like it is waiting for someone. The choppers are on their sides. Nothing chitters.'),
    moveActor('player', 140, 160, { speed: 30 }),
    narrate('ACHIEVEMENT UNLOCKED: WHOLESALE! Retail violence is for lesser crawlers - you went WHOLESALE! Confetti is en route from a neighboring system!'),
    awardAchievement('wholesale'),
    addViews(2213),
    narrate('The counter climbs anyway. It always climbs.'),
    wait(600),
    narrate("Kivvi's bench is empty. Her wrench is where wrenches go. Nothing else is where it goes."),
    say('carl', 'She said one spark. She told me exactly what would happen. I did it anyway.'),
    say('donut', '...You will carry this one, Carl. Set it down somewhere it can not reach the others.'),
    wait(600),
    narrate('THE AUDIENCE IS QUIET TOO, CRAWLER. DO NOT MISTAKE IT FOR MERCY. THEY ARE MEMORIZING YOU.'),
    setFlag('act2:aftermath_seen', true),
    setLetterbox(false),
  ],
};

// ---------------------------------------------------------------------------
// R12 - the reverse-trap pays off (restraint: the System confirms nothing)
// ---------------------------------------------------------------------------

const act3Trap: CutsceneDef = {
  id: 'act3_trap',
  actions: [
    setLetterbox(true),
    musicCue('silence'),
    narrate('You step into the narrow cut, loud on purpose. Behind you: two sets of footsteps that were always going to be there.'),
    say('maggie', 'Told you. Somewhere narrow.'),
    sfxCue('trip_snap'),
    fadeOut(90),
    fadeIn(160),
    narrate('The tripline answers before you do. Dust. Ringing. Then the corridor is very still.'),
    wait(500),
    narrate('When it settles, the cut is empty behind you. Two packs lie where their owners chose to leave them. THE FOOTAGE IS RATED: HANDLED.'),
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
    narrate('TRAINING ARC DETECTED. THE AUDIENCE HAS BEEN WAITING FOR THIS EPISODE ALL SEASON.'),
    sfxCue('weights_clank'),
    narrate('Brandon calls lifts like med rounds. Yolanda pins bottle caps at forty paces. Chris breaks a heavy bag with his hat. Everyone pretends that was normal.'),
    fadeOut(150),
    fadeIn(200),
    narrate("Imani and Donut spar. It ends in four seconds. Donut awards herself the win on style. Imani allows it, which is how you know who won."),
    say('donut', 'We are calling that a draw, and I am calling myself the winner of the draw.'),
    fadeOut(150),
    fadeIn(200),
    narrate('Days compress the way they only do on camera. Calluses, drills, one shared pot of terrible coffee. A crew, assembling itself around a cook.'),
    addViews(6821),
    giveXp(350),
    narrate('THE DUNGEON CERTIFIES: RAID READINESS ACHIEVED. MERCHANDISE PENDING.'),
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
    narrate('You count the lap under your breath. Wide on the bend. Twelve seconds. You squeeze the striker on ten.'),
    sfxCue('det_cord_crack'),
    fadeOut(80),
    fadeIn(120),
    narrate('The rigged barbell fires as the mass leans into the bend. Iron meets momentum. Momentum files a complaint.'),
    sfxCue('ball_derail'),
    fadeOut(120),
    fadeIn(250),
    narrate('THE BALL leaves the rail, chews through a pillar, and comes to rest in a shrieking tangle. Pieces of it stand up. IT is trying to.'),
    setFlag('ball:derailed', true),
    addViews(12406),
    narrate('BOROUGH BOSS DERAILED. VULNERABILITY WINDOW: OPEN. THE DUNGEON SUGGESTS YOU HURRY. IT SUGGESTS THIS SINCERELY, FOR ONCE.'),
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
    narrate('The stairwell doors grind open for the first time in a season. Light from below. Warmer than the light up here. Probably a trick.'),
    narrate('LOOT CEREMONY. THE DUNGEON DISTRIBUTES: GOLD, GEAR, AND THE STATISTICAL LIKELIHOOD OF SURVIVING FLOOR TWO. TWO OF THESE ARE REAL.'),
    giveGold(100),
    addViews(9114),
    narrate('The Meadow Lark residents file toward the stairs in twos, night-shifters at the rails. Brandon counts heads. Yolanda counts them again.'),
    ifFlag(
      'agatha:cart_promised',
      [
        narrate('Agatha arrives last, cart intact, every wheel attached, Herbert the flamingo riding point with his arrow at a jaunty angle.'),
        say('agatha', 'All wheels. Hm. Contract honored, crawler. You may push it down the stairs. CAREFULLY.'),
      ],
      [
        narrate('Agatha muscles her cart past you without a word. Herbert the flamingo watches you go by, arrow and all, unimpressed.'),
      ],
    ),
    say('brandon', 'Whatever is down there, it has not met a night shift. See you on Two, Carl.'),
    wait(400),
    say('carl', 'Donut. We got them to the stairs. All of them that were left to get.'),
    say('donut', 'Then carry the ones we did not, and walk. Royalty does not linger at exits. It makes them look guilty.'),
    narrate('CRAWLERS. THE AUDIENCE IS ENORMOUS NOW, AND THE FLOORS ONLY GET HUNGRIER. DESCEND WHEN READY. WE WILL BE WATCHING. WE ARE ALWAYS WATCHING.'),
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
    narrate('END OF PART ONE - THE FIRST FLOOR.'),
    narrate('DUNGEON CRAWLER CARL: THE FIRST FLOOR. A fan-made adventure demo. All art: placeholder, lovingly generated at runtime.'),
    narrate('Starring: a cook, a cat, and the worst game show in the galaxy.'),
    narrate('THANK YOU FOR CRAWLING. THE DUNGEON WILL REMEMBER YOU FONDLY, WHICH SHOULD WORRY YOU.'),
    quitToTitle(),
  ],
};

export const cutscenes: Record<string, CutsceneDef> = {
  [act1Intro.id]: act1Intro,
  [act1Descent.id]: act1Descent,
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
