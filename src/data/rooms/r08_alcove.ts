/**
 * R08 - a quiet alcove off the main tunnel: a fallen crawler (somber beat,
 * riot vest loot) and the scurrier ambush that becomes Donut's claw-skill
 * cutscene. Tonal cooldown between the Hoarder and whatever Act II Part 2
 * brings.
 */

import { giveItem, ifFlag, narrate, playCutscene, say, setFlag, walkPlayerTo } from '../script';
import type { RoomDef } from '../types';

export const r08_alcove: RoomDef = {
  id: 'r08_alcove',
  label: 'A QUIET CORNER',
  backgroundPath: 'backgrounds/r08_alcove.png',
  backgroundMood: 'dungeon',
  walkmaskPath: 'masks/r08_alcove.png',
  playerSpawn: { x: 30, y: 162, facing: 'right' },
  onEnter: [],
  exits: [
    {
      id: 'west',
      rect: { x: 0, y: 128, w: 8, h: 64 },
      targetRoom: 'r07_moonburger',
      targetSpawn: { x: 288, y: 162 },
      facing: 'left',
    },
    {
      id: 'east',
      rect: { x: 312, y: 128, w: 8, h: 64 },
      targetRoom: 'r09_approach',
      targetSpawn: { x: 30, y: 162 },
      facing: 'right',
    },
  ],
  actors: [],
  hotspots: [
    {
      id: 'crawler',
      name: 'FALLEN CRAWLER',
      rect: { x: 120, y: 108, w: 44, h: 34 },
      verbs: {
        look: [
          narrate('A crawler who stopped here and stayed. Riot gear, city-issue. No wounds you can see. Some doors close from the inside.'),
          say('carl', 'We are not going to end up like this. Either of us.'),
        ],
        hand: [
          ifFlag(
            'r08.vest_taken',
            [narrate('You already took what could still be useful. The rest belongs to them.')],
            [
              walkPlayerTo(140, 158),
              narrate('You work the riot vest free, as gently as the word LOOTING allows. They will not need it. You badly might.'),
              giveItem('riot_vest'),
              setFlag('r08.vest_taken', true),
              say('donut', 'Say a word over them, Carl. A short one. We are on a schedule, but we are not ANIMALS.'),
            ],
          ),
        ],
      },
    },
    {
      id: 'scurrier',
      name: 'GREASY SHADOW',
      rect: { x: 214, y: 128, w: 34, h: 26 },
      verbs: {
        look: [
          ifFlag(
            'act2:claws_learned',
            [narrate('A grease stain in the shape of a former problem. The Princess does thorough work.')],
            [narrate('Something low and greasy is wedged behind the debris, watching you. It has the patience of a bad idea.')],
          ),
        ],
        hand: [
          // Once-guarded by scene:act2_donut_claws:played; after that,
          // the fallback line below plays instead of the cutscene.
          ifFlag(
            'act2:claws_learned',
            [narrate('Nothing left to poke. The alcove has been aggressively moisturized.')],
            [playCutscene('act2_donut_claws')],
          ),
        ],
      },
    },
    {
      id: 'shrine',
      name: 'STACKED STONES',
      rect: { x: 58, y: 92, w: 26, h: 30 },
      verbs: {
        look: [
          narrate('Someone balanced nine flat stones into a little tower. A marker, a memorial, or just proof a person was calm here once.'),
        ],
        hand: [
          narrate('You add a tenth stone. It holds. THE DUNGEON DECLINES TO MOCK THIS ONE.'),
        ],
      },
    },
  ],
  scaleBands: [
    { yTop: 108, yBottom: 120, scale: 0.8 },
    { yTop: 184, yBottom: 200, scale: 1.0 },
  ],
  placeholderMaskDraw: (ctx) => {
    ctx.fillStyle = '#000000';
    ctx.fillRect(50, 104, 44, 18); // stone cairn ledge
    ctx.fillRect(210, 108, 60, 20); // debris pile
  },
};
