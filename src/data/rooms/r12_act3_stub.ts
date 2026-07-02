/**
 * R12 — Act III placeholder so Act II is self-contained. P9 replaces this
 * with Meadow Lark / the gym / the Ball.
 */

import { narrate, say } from '../script';
import type { RoomDef } from '../types';

export const r12_act3_stub: RoomDef = {
  id: 'r12_act3_stub',
  label: 'TO BE CONTINUED',
  backgroundPath: 'backgrounds/r12_act3_stub.png',
  backgroundMood: 'boss',
  walkmaskPath: 'masks/r12_act3_stub.png',
  playerSpawn: { x: 36, y: 160, facing: 'right' },
  onEnter: [
    narrate('ACT THREE IS IN DRESS REHEARSAL: MEADOW LARK, THE GYM, AND A BALL YOU ARE UNDERDRESSED FOR. THE DUNGEON WILL SEND AN INVITATION.'),
  ],
  exits: [
    {
      id: 'back',
      rect: { x: 0, y: 128, w: 8, h: 64 },
      targetRoom: 'r11_aftermath',
      targetSpawn: { x: 288, y: 162 },
      facing: 'left',
    },
  ],
  actors: [],
  hotspots: [
    {
      id: 'barrier',
      name: 'VELVET ROPE',
      rect: { x: 180, y: 60, w: 100, h: 90 },
      verbs: {
        look: [
          narrate('A velvet rope across the road, absurdly plush for a dungeon. Beyond it: string music, tuning. Something is rehearsing an entrance.'),
        ],
        hand: [
          say('donut', 'Do not touch the rope, Carl. One of us belongs on the guest list and it is neither of your hands.'),
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
