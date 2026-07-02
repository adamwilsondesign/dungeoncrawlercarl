/**
 * R09 — Act II Part 2 placeholder so this build is self-contained. P8
 * replaces this with the workshop / War Chieftain arc opening.
 */

import { narrate, say } from '../script';
import type { RoomDef } from '../types';

export const r09_act2b_stub: RoomDef = {
  id: 'r09_act2b_stub',
  label: 'TO BE CONTINUED',
  backgroundPath: 'backgrounds/r09_act2b_stub.png',
  backgroundMood: 'boss',
  walkmaskPath: 'masks/r09_act2b_stub.png',
  playerSpawn: { x: 36, y: 160, facing: 'right' },
  onEnter: [
    narrate('THE NEXT NEIGHBORHOOD IS STILL BEING DRESSED FOR BROADCAST. RETURN SOON. THE WAR CHIEFTAIN IS PRACTICING HIS ENTRANCE.'),
  ],
  exits: [
    {
      id: 'back',
      rect: { x: 0, y: 128, w: 8, h: 64 },
      targetRoom: 'r08_alcove',
      targetSpawn: { x: 288, y: 162 },
      facing: 'left',
    },
  ],
  actors: [],
  hotspots: [
    {
      id: 'barrier',
      name: 'BROADCAST CURTAIN',
      rect: { x: 180, y: 60, w: 100, h: 90 },
      verbs: {
        look: [
          narrate('A wall of studio curtain and stage weights. Behind it, hammering, war drums, and a director counting to three over and over.'),
        ],
        hand: [
          say('donut', 'Do not peek, Carl. We will see it when it is READY. A premiere spoiled is a premiere ruined.'),
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
