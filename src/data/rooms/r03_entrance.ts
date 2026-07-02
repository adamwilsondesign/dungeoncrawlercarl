/**
 * R03 - Floor 1 entrance corridor: the diegetic verb tutorial. LOOK gags,
 * a HAND puzzlelet (jammed locker), a trivially easy first fight, and the
 * way to the guild. Autosave fires on entry like every room.
 */

import {
  giveItem,
  ifFlag,
  narrate,
  say,
  setFlag,
  startCombat,
  walkPlayerTo,
  facePlayer,
} from '../script';
import type { RoomDef } from '../types';

export const r03_entrance: RoomDef = {
  id: 'r03_entrance',
  label: 'FLOOR 1',
  backgroundPath: 'backgrounds/r03_entrance.png',
  backgroundMood: 'dungeon',
  walkmaskPath: 'masks/r03_entrance.png',
  playerSpawn: { x: 36, y: 160, facing: 'right' },
  onEnter: [
    // First-visit establishing beat (P10: scene-setting for newcomers).
    ifFlag(
      'seen:r03',
      [],
      [
        setFlag('seen:r03', true),
        narrate('The bottom of the stairs opens into a corridor that was never meant to fool anyone: poured stone, fresh tool marks, cables stapled along the ceiling like the level was finished on a deadline. Somewhere far off, water drips with great patience.'),
        narrate('Other staircases fed this floor too. Distant doors. Footsteps. One long argument, already going. Millions of survivors came down tonight, and the corridor swallows the sound of every one of them.'),
        narrate('At the end of the hall, a painted lantern sign glows over a door: GUILD. The first thing on this floor that wants you to walk in. That deserves suspicion. Or hope. Down here they come as a set.'),
      ],
    ),
  ],
  exits: [
    {
      id: 'guild',
      rect: { x: 312, y: 128, w: 8, h: 64 },
      targetRoom: 'r04_guild',
      targetSpawn: { x: 34, y: 162 },
      facing: 'right',
    },
  ],
  actors: [],
  hotspots: [
    {
      id: 'graffiti',
      name: 'WALL GRAFFITI',
      rect: { x: 40, y: 56, w: 70, h: 44 },
      verbs: {
        look: [
          narrate("Scratched into the stone: DAY 1: THIS IS FINE. Below it, different handwriting: DAY 2 WAS NOT. The rest is claw marks."),
        ],
        hand: [
          narrate('You add nothing. History has enough contributors down here.'),
        ],
      },
    },
    {
      id: 'corpse',
      name: 'FORMER CRAWLER',
      rect: { x: 132, y: 128, w: 34, h: 26 },
      verbs: {
        look: [
          narrate('A very former crawler, weeks gone, posed mid-sprint. Whatever they were running from was faster. LESSON ONE IS FREE, says the room.'),
        ],
        hand: [
          ifFlag(
            'r03.corpse_looted',
            [narrate('You already checked the pockets. Twice would be rude.')],
            [
              walkPlayerTo(150, 162),
              setFlag('r03.corpse_looted', true),
              narrate('You check the pockets, apologizing the whole time. One ration survived them.'),
              giveItem('stale_biscuit'),
            ],
          ),
        ],
      },
    },
    {
      id: 'sign',
      name: 'WELCOME SIGN',
      rect: { x: 208, y: 52, w: 48, h: 40 },
      verbs: {
        look: [
          narrate('An official placard: FLOOR ONE. DIFFICULTY: INTRODUCTORY. Someone has crossed out INTRODUCTORY and written LIAR.'),
        ],
      },
    },
    // HAND puzzlelet: the jammed supply locker
    {
      id: 'locker',
      name: 'JAMMED LOCKER',
      rect: { x: 262, y: 96, w: 24, h: 34 },
      verbs: {
        look: [
          ifFlag(
            'r03.locker_pried',
            [narrate('The locker hangs open, thoroughly liberated.')],
            [narrate('A supply locker, dented shut. The dent is fist-shaped. The fist is not around. A good pull might do it.')],
          ),
        ],
        hand: [
          ifFlag(
            'r03.locker_pried',
            [narrate('Empty. You took the good news already.')],
            [
              walkPlayerTo(272, 136),
              facePlayer('up'),
              narrate('You brace a Croc against the wall and HEAVE. The door surrenders with a noise like applause. The dungeon loves property damage.'),
              setFlag('r03.locker_pried', true),
              giveItem('healing_salve'),
            ],
          ),
        ],
      },
    },
    // Unmissable-easy first fight
    {
      id: 'mite',
      name: 'TWITCHING DUST',
      rect: { x: 178, y: 132, w: 30, h: 24 },
      verbs: {
        look: [
          narrate('A fist-sized ball of lint is stalking you. It believes it is being stealthy. This is the dungeon letting you warm up.'),
        ],
        hand: [
          say('carl', 'Sure. Start me on the tutorial monster.'),
          startCombat('first_blood'),
        ],
      },
    },
    {
      id: 'guild_door',
      name: 'GUILD DOOR',
      rect: { x: 292, y: 92, w: 28, h: 60 },
      verbs: {
        look: [
          narrate('A door with a lantern and a hand-painted sign: TUTORIAL GUILD. ASK FOR MORDECAI. NO REFUNDS. The friendliest thing on the floor.'),
        ],
      },
    },
  ],
  scaleBands: [
    { yTop: 108, yBottom: 120, scale: 0.8 },
    { yTop: 184, yBottom: 200, scale: 1.0 },
  ],
  placeholderMaskDraw: (ctx) => {
    // Corridor narrows around debris
    ctx.fillStyle = '#000000';
    ctx.fillRect(120, 110, 60, 16); // debris shelf above the corpse
    ctx.fillRect(0, 180, 60, 20);
    ctx.fillRect(230, 110, 26, 10);
  },
};
