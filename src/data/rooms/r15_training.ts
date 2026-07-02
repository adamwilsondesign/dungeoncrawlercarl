/**
 * R15 - the training floor: the montage cutscene plays on entry (Views
 * spike + the raid-readiness level bump via giveXp), then a rest booth and
 * a couple of warm gags before the ring. Safe room conventions apply.
 */

import { autosave, ifFlag, narrate, playCutscene, say } from '../script';
import type { RoomDef } from '../types';

export const r15_training: RoomDef = {
  id: 'r15_training',
  label: 'TRAINING',
  backgroundPath: 'backgrounds/r15_training.png',
  backgroundMood: 'safe',
  walkmaskPath: 'masks/r15_training.png',
  playerSpawn: { x: 30, y: 162, facing: 'right' },
  onEnter: [playCutscene('act3_montage')],
  exits: [
    {
      id: 'west',
      rect: { x: 0, y: 128, w: 8, h: 64 },
      targetRoom: 'r14_gym',
      targetSpawn: { x: 288, y: 162 },
      facing: 'left',
    },
    {
      id: 'east',
      rect: { x: 312, y: 128, w: 8, h: 64 },
      targetRoom: 'r16_ring',
      targetSpawn: { x: 30, y: 162 },
      facing: 'right',
    },
  ],
  actors: [],
  hotspots: [
    {
      id: 'chalkboard',
      name: 'RAID BOARD',
      rect: { x: 52, y: 60, w: 60, h: 36 },
      verbs: {
        look: [
          ifFlag(
            'raid:trained',
            [narrate("Brandon's chalk plan: the ring drawn as a circle, an X on the bend, six arrows converging, and one small crown labeled HER MAJESTY, DO NOT ASSIGN.")],
            [narrate('A chalkboard awaiting a plan.')],
          ),
        ],
      },
    },
    {
      id: 'heavy_bag',
      name: 'HEAVY BAG',
      rect: { x: 150, y: 84, w: 24, h: 48 },
      verbs: {
        look: [
          narrate('The heavy bag Chris headbutted. The seam surrendered. The sand is still leaving quietly, like an audience after a bad show.'),
        ],
        hand: [
          narrate('You throw two honest hooks. The bag accepts them the way the floor has accepted everything: by leaking slightly.'),
        ],
      },
    },
    {
      id: 'booth',
      name: 'REST MATS',
      rect: { x: 240, y: 146, w: 48, h: 26 },
      verbs: {
        look: [
          narrate('Stacked gym mats and clean blankets: the last soft place before the ring. Yolanda inspected it. It passed, narrowly.'),
        ],
        hand: [
          narrate('The raid sleeps in shifts around you. Nobody says tomorrow out loud. PROGRESS RECORDED.'),
          autosave(),
          say('donut', 'Tomorrow we are heroes, Carl. Tonight I require the warm corner of the mat. Move.'),
        ],
      },
    },
  ],
  scaleBands: [
    { yTop: 108, yBottom: 120, scale: 0.85 },
    { yTop: 184, yBottom: 200, scale: 1.0 },
  ],
  placeholderMaskDraw: (ctx) => {
    ctx.fillStyle = '#000000';
    ctx.fillRect(144, 116, 36, 14); // bag stand
  },
};
