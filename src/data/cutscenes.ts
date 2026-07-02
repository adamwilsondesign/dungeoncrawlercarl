/**
 * Cutscene registry (looked up by playCutscene(id), like rooms and dialogue
 * trees). Cutscenes are plain ScriptAction[] with the cinematic actions —
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
  moveActor,
  musicCue,
  narrate,
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
};

// ---------------------------------------------------------------------------
// R01 — the collapse (opening cinematic, ~60-90s watched)
// ---------------------------------------------------------------------------

const act1Intro: CutsceneDef = {
  id: 'act1_intro',
  actions: [
    fadeOut(1),
    setLetterbox(true),
    musicCue('act1_collapse_theme'),
    fadeIn(700),
    narrate('SEATTLE. 2:23 AM. Nine degrees below comfortable. Nobody sensible is outside.'),
    narrate("Carl is outside. Boxer shorts. Winter jacket. His ex's pink Crocs. The cat got out again, and the cat is her cat, which makes it his problem."),
    moveActor('player', 120, 165),
    say('carl', 'Donut. It is two in the morning. I am wearing foam shoes. Come down.'),
    moveActor('donut_cat', 250, 118, { speed: 80 }),
    narrate('The cat relocates two car lengths further away and sits, radiating the serenity of a creature with zero stake in human dignity.'),
    sfxCue('deep_rumble'),
    wait(400),
    narrate('Then the ground hums. Not an earthquake. A throat being cleared.'),
    musicCue('system_sting'),
    narrate('GOOD MORNING, EARTH. THIS PLANET HAS BEEN RECERTIFIED FOR DEVELOPMENT. YOUR STRUCTURES WERE FILED AS DEBRIS. FILING IS NOW COMPLETE.'),
    sfxCue('city_collapse'),
    fadeOut(200),
    fadeIn(250),
    narrate('The skyline folds. Quietly. Politely. Like the buildings had been asked in advance and were embarrassed about the noise.'),
    say('carl', 'Okay.'),
    narrate('Where each block used to be, a staircase of white light punches down into the earth. One per neighborhood. Yours is conveniently close.'),
    narrate('SURFACE CONDITIONS WILL BECOME UNSUITABLE FOR RESIDENTS. THE STAIRS ARE PROVIDED FREE OF CHARGE. WE ARE TOLD THIS IS GENEROUS.'),
    say('carl', 'Right. Cat first. Existential dread second.'),
    setFlag('act1:intro_seen', true),
    setLetterbox(false),
  ],
};

// ---------------------------------------------------------------------------
// R02 — the descent (short transitional cinematic)
// ---------------------------------------------------------------------------

const act1Descent: CutsceneDef = {
  id: 'act1_descent',
  actions: [
    setLetterbox(true),
    musicCue('descent_drone'),
    awardAchievement('first_steps'),
    moveActor('player', 160, 120, { speed: 30 }),
    narrate('The stairs go down. The cold peels away a step at a time, replaced by warm air that smells like stone, oil, and a business plan.'),
    narrate('WELCOME, CRAWLER. YOU ARE ENTRANT 4,437,102. YOUR WAIVER WAS SIGNED ON YOUR BEHALF. IT WAS EASIER FOR EVERYONE.'),
    narrate('NOW ENTERING: FLOOR ONE. EIGHTEEN LEVELS BELOW YOU. ONE RULE ABOVE ALL: THE STAIRS ONLY GO DOWN.'),
    say('carl', 'Noted. Terms and conditions: apocalyptic.'),
    fadeOut(400),
    setLetterbox(false),
    gotoRoom('r03_entrance'),
    fadeIn(400),
  ],
};

// ---------------------------------------------------------------------------
// R04 — cinematic character creation (the demo dramatizes the stat menu)
// ---------------------------------------------------------------------------

const act1CharacterCreation: CutsceneDef = {
  id: 'act1_character_creation',
  actions: [
    setLetterbox(true),
    musicCue('interface_boot'),
    sfxCue('ui_scan'),
    narrate('REGISTERING CRAWLER. HOLD STILL. THIS SCAN IS PAINLESS, WHICH WE MENTION BECAUSE MOST THINGS HERE ARE NOT.'),
    facePlayer('down'),
    narrate('SPECIES: HUMAN. BUILD: FORMER LINE COOK, CURRENT INSOMNIAC. FOOTWEAR: FLAGGED FOR AUDIENCE ENGAGEMENT.'),
    say('carl', 'The shoes are temporary.'),
    narrate('CLASS ASSIGNED: SURVIVOR, PROVISIONAL. IT MEANS THE SYSTEM HAS NOT DECIDED WHAT YOU ARE YET. NEITHER HAVE YOU.'),
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
// R04 — Donut's transformation (the Act I hinge)
// ---------------------------------------------------------------------------

const act1DonutTransformation: CutsceneDef = {
  id: 'act1_donut_transformation',
  actions: [
    setLetterbox(true),
    musicCue('lootbox_fanfare'),
    narrate('UNCLAIMED REWARD DETECTED. RECIPIENT: THE CAT. THE SYSTEM DOES NOT MAKE MISTAKES. THE SYSTEM IS AS SURPRISED AS YOU ARE.'),
    sfxCue('lootbox_open'),
    fadeOut(180),
    fadeIn(220),
    narrate('Light pours over the cat. Her fur goes incandescent. Somewhere, a stat called CHARISMA breaks something it should not be able to reach.'),
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
// R07 — the show premiere (the Views counter becomes meaningful)
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
// R08 — Donut learns to fight with claws
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
// R10 — THE DETONATION (Act II's showpiece; also the War Chieftain's death.
// Puzzle-as-kill, option (a): no cleanup fight — rewards granted here.)
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
// R11 — the aftermath (tonal beat: the System gloats, the room does not)
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

export const cutscenes: Record<string, CutsceneDef> = {
  [act1Intro.id]: act1Intro,
  [act1Descent.id]: act1Descent,
  [act1CharacterCreation.id]: act1CharacterCreation,
  [act1DonutTransformation.id]: act1DonutTransformation,
  [act2Premiere.id]: act2Premiere,
  [act2DonutClaws.id]: act2DonutClaws,
  [act2Detonation.id]: act2Detonation,
  [act2Aftermath.id]: act2Aftermath,
};
