/**
 * r00_test — engine proving ground: irregular walkable area, a blocked pillar
 * mid-room, a narrow corridor along the right that climbs above the floor
 * line, looping edge exits, one NPC, and 0.6→1.0 depth scale bands.
 */

import type { RoomDef, SpriteSheetDef } from '../types';

const npcSheet: SpriteSheetDef = {
  path: 'sprites/npc.png',
  frameW: 24,
  frameH: 32,
  mirrorLeft: true,
  anims: {
    idle_down: { frames: [0], frameMs: 400, loop: true },
    idle_up: { frames: [3], frameMs: 400, loop: true },
    idle_right: { frames: [6], frameMs: 400, loop: true },
  },
};

export const r00_test: RoomDef = {
  id: 'r00_test',
  label: 'TEST CHAMBER',
  backgroundPath: 'backgrounds/r00_test.png',
  backgroundMood: 'dungeon',
  walkmaskPath: 'masks/r00_test.png',
  playerSpawn: { x: 160, y: 185, facing: 'up' },
  exits: [
    // Left edge → reappear near the right edge (loops back into this room)
    {
      rect: { x: 0, y: 128, w: 8, h: 60 },
      targetRoom: 'r00_test',
      targetSpawn: { x: 290, y: 165 },
      facing: 'left',
    },
    // Right edge → reappear near the left edge
    {
      rect: { x: 312, y: 128, w: 8, h: 60 },
      targetRoom: 'r00_test',
      targetSpawn: { x: 30, y: 165 },
      facing: 'right',
    },
  ],
  actors: [
    {
      id: 'npc',
      label: 'NPC',
      color: '#4ec9a4',
      sheet: npcSheet,
      x: 96,
      y: 122,
      anim: 'idle_down',
      facing: 'down',
    },
  ],
  scaleBands: [
    { yTop: 56, yBottom: 66, scale: 0.6 },
    { yTop: 184, yBottom: 200, scale: 1.0 },
  ],
  placeholderMaskDraw: (ctx) => {
    // Irregular top edge: stair-stepped bites out of the walkable area
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 110, 40, 12);
    ctx.fillRect(200, 110, 56, 8);
    ctx.fillRect(64, 110, 20, 5);
    // Clipped bottom-left corner
    ctx.fillRect(0, 178, 24, 22);
    // Blocked pillar in the middle of the floor
    ctx.fillRect(140, 128, 44, 34);
    // Narrow walkable corridor along the right, climbing above the floor line
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(296, 60, 18, 56);
  },
};
