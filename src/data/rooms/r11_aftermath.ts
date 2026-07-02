/**
 * R11 - the aftermath. The tonal contrast beat: the System AI gloats, the
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
  // Art brief: the workshop, after - ash grays, dying embers, drifting
  // smoke, the scorch shadow, one intact bench. Restraint.
  placeholderArtDraw: (ctx) => {
    // Ash-out: mute everything toward gray
    ctx.fillStyle = 'rgba(60,58,54,0.55)';
    ctx.fillRect(0, 0, 320, 200);
    // Collapsed roof beams
    ctx.fillStyle = '#211d19';
    ctx.beginPath();
    ctx.moveTo(210, 10);
    ctx.lineTo(222, 8);
    ctx.lineTo(268, 96);
    ctx.lineTo(256, 100);
    ctx.closePath();
    ctx.fill();
    ctx.fillRect(24, 44, 60, 6);
    // The scorch shadow printed on the wall
    ctx.fillStyle = 'rgba(16,14,12,0.8)';
    ctx.beginPath();
    ctx.ellipse(80, 96, 15, 26, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(80, 66, 8, 9, 0, 0, Math.PI * 2);
    ctx.fill();
    // Dying embers in the wreck line
    for (const [ex2, ey2] of [[150, 120], [186, 116], [230, 122], [204, 126], [122, 124]] as const) {
      const g = ctx.createRadialGradient(ex2, ey2, 0, ex2, ey2, 7);
      g.addColorStop(0, 'rgba(255,120,50,0.8)');
      g.addColorStop(1, 'rgba(255,120,50,0)');
      ctx.fillStyle = g;
      ctx.fillRect(ex2 - 7, ey2 - 7, 14, 14);
      ctx.fillStyle = '#ff8a4a';
      ctx.fillRect(ex2, ey2, 2, 1);
    }
    // Kivvi's bench: intact, tools laid out, the half-built chopper on blocks
    ctx.fillStyle = '#3d3226';
    ctx.fillRect(138, 122, 56, 6);
    ctx.fillStyle = '#2e2418';
    ctx.fillRect(142, 128, 4, 12);
    ctx.fillRect(186, 128, 4, 12);
    ctx.fillStyle = '#8f5a2a';
    ctx.beginPath();
    ctx.ellipse(166, 116, 14, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#b0b4ba';
    ctx.fillRect(146, 119, 8, 2);
    ctx.fillRect(158, 119, 5, 2);
    // Smoke drifting up in slow columns
    ctx.fillStyle = 'rgba(120,116,110,0.25)';
    for (const [sx2, sw2] of [[160, 16], [236, 12], [96, 10]] as const) {
      ctx.beginPath();
      ctx.ellipse(sx2, 60, sw2 / 2, 46, 0.2, 0, Math.PI * 2);
      ctx.fill();
    }
  },
  placeholderMaskDraw: (ctx) => {
    ctx.fillStyle = '#000000';
    ctx.fillRect(134, 118, 64, 24); // the bench and bike
  },
};
