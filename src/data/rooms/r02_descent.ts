/**
 * R02 — The staircase of light. Transitional: the descent cutscene plays and
 * hands off to R03. A fallback exit exists in case the scene was already
 * played (no dead ends, ever).
 */

import { playCutscene } from '../script';
import type { RoomDef } from '../types';

export const r02_descent: RoomDef = {
  id: 'r02_descent',
  label: 'THE DESCENT',
  backgroundPath: 'backgrounds/r02_descent.png',
  backgroundMood: 'cold',
  walkmaskPath: 'masks/r02_descent.png',
  playerSpawn: { x: 160, y: 130, facing: 'down' },
  onEnter: [playCutscene('act1_descent')],
  exits: [
    // Fallback if the cutscene has already played: walk down and out.
    {
      id: 'down',
      rect: { x: 120, y: 192, w: 80, h: 8 },
      targetRoom: 'r03_entrance',
      targetSpawn: { x: 36, y: 160 },
      facing: 'right',
    },
  ],
  actors: [],
  hotspots: [
    {
      id: 'steps',
      name: 'THE STAIRS',
      rect: { x: 100, y: 40, w: 120, h: 70 },
      verbs: {
        look: [
          {
            type: 'narrate',
            text: 'Light shaped into steps. They only render in the downward direction. Subtle, this place is not.',
          },
        ],
      },
    },
  ],
  scaleBands: [
    { yTop: 40, yBottom: 60, scale: 0.7 },
    { yTop: 180, yBottom: 200, scale: 1.0 },
  ],
  placeholderMaskDraw: (ctx) => {
    // A narrow shaft of walkable light down the middle
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 110, 100, 90);
    ctx.fillRect(220, 110, 100, 90);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(120, 40, 80, 160);
  },
};
