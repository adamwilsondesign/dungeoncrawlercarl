/**
 * R02 - The staircase of light. Transitional: the descent cutscene plays and
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
  // Art brief: the wrought-iron staircase - a shaft of radiant gold rising
  // out of the dark, wide carved steps descending toward a huge door below.
  placeholderArtDraw: (ctx) => {
    // Golden light wells up from below and swallows the cold
    const glow = ctx.createLinearGradient(0, 0, 0, 200);
    glow.addColorStop(0, 'rgba(8,10,20,0.9)');
    glow.addColorStop(0.4, 'rgba(120,80,30,0.55)');
    glow.addColorStop(1, 'rgba(255,196,96,0.9)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, 320, 200);
    const core = ctx.createRadialGradient(160, 190, 10, 160, 190, 150);
    core.addColorStop(0, 'rgba(255,232,160,0.8)');
    core.addColorStop(1, 'rgba(255,232,160,0)');
    ctx.fillStyle = core;
    ctx.fillRect(0, 40, 320, 160);
    // The stairs: perspective steps narrowing upward, iron rails silhouetted
    for (let i = 0; i < 11; i++) {
      const t = i / 10;
      const w = 70 + t * 190;
      const y = 44 + i * 14;
      ctx.fillStyle = `rgba(30,20,12,${0.85 - t * 0.35})`;
      ctx.fillRect(160 - w / 2, y, w, 5);
      ctx.fillStyle = `rgba(255,214,120,${0.25 + t * 0.3})`;
      ctx.fillRect(160 - w / 2, y + 5, w, 2);
    }
    // Wrought-iron balusters with carved-motif knots
    ctx.fillStyle = '#1c1208';
    for (let i = 0; i < 6; i++) {
      const t = i / 5;
      const y = 48 + i * 26;
      const off = 44 + t * 96;
      ctx.fillRect(160 - off, y, 3, 26);
      ctx.fillRect(160 + off - 3, y, 3, 26);
      ctx.fillRect(160 - off - 2, y + 8, 7, 3);
      ctx.fillRect(160 + off - 5, y + 8, 7, 3);
    }
    // The hulking carved door, far below at the vanishing point
    ctx.fillStyle = '#3a2410';
    ctx.fillRect(126, 20, 68, 34);
    ctx.fillStyle = '#573717';
    ctx.fillRect(130, 24, 60, 30);
    ctx.fillStyle = '#7a5424';
    ctx.fillRect(158, 24, 4, 30);
    ctx.fillRect(134, 32, 52, 2);
  },
  placeholderMaskDraw: (ctx) => {
    // A narrow shaft of walkable light down the middle
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 110, 100, 90);
    ctx.fillRect(220, 110, 100, 90);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(120, 40, 80, 160);
  },
};
