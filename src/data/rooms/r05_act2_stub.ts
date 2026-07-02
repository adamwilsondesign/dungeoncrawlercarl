/**
 * R05 — Act II placeholder so Act I is self-contained and testable. P7
 * replaces this with the real Act II opening.
 */

import { narrate, say } from '../script';
import type { RoomDef } from '../types';

export const r05_act2_stub: RoomDef = {
  id: 'r05_act2_stub',
  label: 'TO BE CONTINUED',
  backgroundPath: 'backgrounds/r05_act2_stub.png',
  backgroundMood: 'boss',
  walkmaskPath: 'masks/r05_act2_stub.png',
  playerSpawn: { x: 36, y: 160, facing: 'right' },
  onEnter: [
    narrate('ACT TWO IS STILL BEING EXCAVATED. THE DUNGEON APOLOGIZES FOR THE DUST AND FOR NOTHING ELSE.'),
  ],
  exits: [
    {
      id: 'back',
      rect: { x: 0, y: 128, w: 8, h: 64 },
      targetRoom: 'r04_guild',
      targetSpawn: { x: 288, y: 162 },
      facing: 'left',
    },
  ],
  actors: [],
  hotspots: [
    {
      id: 'barrier',
      name: 'CONSTRUCTION BARRIER',
      rect: { x: 180, y: 60, w: 100, h: 90 },
      verbs: {
        look: [
          narrate('A wall of caution tape and implication. Beyond it: the rest of Floor One, arriving in the next update.'),
        ],
        hand: [
          say('donut', 'Leave it, Carl. Even I cannot boss a loading screen.'),
        ],
      },
    },
  ],
  scaleBands: [{ yTop: 184, yBottom: 200, scale: 1.0 }],
  placeholderMaskDraw: (ctx) => {
    ctx.fillStyle = '#000000';
    ctx.fillRect(180, 110, 140, 50);
  },
};
