/**
 * R11 — the aftermath. The tonal contrast beat: the System AI gloats, the
 * scene itself sits heavy. Short, restrained, no looting here. East leads
 * to the Act III stub so Act II is self-contained.
 */

import { ifFlag, narrate, playCutscene, say } from '../script';
import type { RoomDef } from '../types';

export const r11_aftermath: RoomDef = {
  id: 'r11_aftermath',
  label: 'AFTER',
  backgroundPath: 'backgrounds/r11_aftermath.png',
  backgroundMood: 'dungeon',
  walkmaskPath: 'masks/r11_aftermath.png',
  playerSpawn: { x: 30, y: 162, facing: 'right' },
  onEnter: [playCutscene('act2_aftermath')],
  exits: [
    {
      id: 'west',
      rect: { x: 0, y: 128, w: 8, h: 64 },
      targetRoom: 'r10_workshop',
      targetSpawn: { x: 288, y: 162 },
      facing: 'left',
    },
    {
      id: 'east',
      rect: { x: 312, y: 128, w: 8, h: 64 },
      targetRoom: 'r12_east',
      targetSpawn: { x: 30, y: 162 },
      facing: 'right',
    },
  ],
  actors: [],
  hotspots: [
    {
      id: 'bench',
      name: 'ABANDONED BENCH',
      rect: { x: 140, y: 110, w: 52, h: 30 },
      verbs: {
        look: [
          narrate('A half-finished chopper up on blocks, tools laid out in working order. Whoever set them down expected to pick them up.'),
        ],
        hand: [
          say('carl', 'Not this one. Leave it how she left it.'),
        ],
      },
    },
    {
      id: 'scorch',
      name: 'SCORCH SHADOW',
      rect: { x: 60, y: 80, w: 40, h: 50 },
      verbs: {
        look: [
          narrate('The blast printed the wall with the shapes of things that were standing in front of it. The dungeon offers no caption. First time for everything.'),
        ],
      },
    },
    {
      id: 'road',
      name: 'THE ROAD ON',
      rect: { x: 260, y: 92, w: 50, h: 56 },
      verbs: {
        look: [
          ifFlag(
            'act2:aftermath_seen',
            [narrate('The road bends east toward torchlight and, the map insists, a district called MEADOW LARK. The floor is not done with you.')],
            [narrate('The road continues east.')],
          ),
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
    ctx.fillRect(134, 118, 64, 24); // the bench and bike
  },
};
