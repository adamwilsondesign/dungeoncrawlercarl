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
  // Art brief: a quiet corner of the tunnels - softer, dimmer green light,
  // the fallen crawler under a blanket shape, scattered gear, the cairn.
  placeholderArtDraw: (ctx) => {
    // Dim the whole alcove; the lichen glow is gentler here
    ctx.fillStyle = 'rgba(10,12,10,0.30)';
    ctx.fillRect(0, 0, 320, 200);
    // The stacked-stone cairn
    ctx.fillStyle = '#4a4238';
    for (const [sx2, sy2, sw2] of [
      [62, 116, 18], [64, 110, 14], [66, 104, 10], [68, 99, 7], [69, 95, 5],
    ] as const) {
      ctx.fillRect(sx2, sy2, sw2, 6);
      ctx.fillStyle = '#3a332b';
      ctx.fillRect(sx2, sy2 + 4, sw2, 2);
      ctx.fillStyle = '#4a4238';
    }
    // The fallen crawler: a still shape under riot gear, treated gently
    ctx.fillStyle = '#2c3138';
    ctx.beginPath();
    ctx.ellipse(142, 132, 26, 9, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#3a414a';
    ctx.beginPath();
    ctx.ellipse(132, 128, 12, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    // Scattered pack + helmet
    ctx.fillStyle = '#33402c';
    ctx.fillRect(170, 128, 12, 9);
    ctx.fillStyle = '#454f57';
    ctx.beginPath();
    ctx.arc(190, 134, 5, Math.PI, 0);
    ctx.fill();
    // The debris pile hiding the scurrier
    ctx.fillStyle = '#31281c';
    ctx.beginPath();
    ctx.ellipse(238, 136, 30, 14, 0, Math.PI, 0);
    ctx.fill();
    ctx.fillStyle = '#3d3222';
    ctx.fillRect(222, 124, 20, 5);
    ctx.fillRect(240, 118, 5, 12);
  },
  placeholderMaskDraw: (ctx) => {
    ctx.fillStyle = '#000000';
    ctx.fillRect(50, 104, 44, 18); // stone cairn ledge
    ctx.fillRect(210, 108, 60, 20); // debris pile
  },
};
