/**
 * R15 - the training floor: the montage cutscene plays on entry (Views
 * spike + the raid-readiness level bump via giveXp), then a rest booth and
 * a couple of warm gags before the ring. Safe room conventions apply.
 */

import { autosave, describe, ifFlag, narrate, notify, playCutscene, say } from '../script';
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
          describe('The raid sleeps in shifts around you. Nobody says tomorrow out loud. Outside the light, a cigarette glows once, briefly - Carl, taking five minutes that belong to nobody, not even the feed. He counts the pack. Three left. He is rationing them against the floors.'),
          notify('Progress recorded. Checkpoint: TRAINING FLOOR.'),
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
  // Art brief: the cleared training floor - brighter, purposeful; mats,
  // the raid chalkboard, the wounded heavy bag, stacked gear.
  placeholderArtDraw: (ctx) => {
    // All strips live now: the crew re-lamped the place
    for (const fx of [60, 150, 240]) {
      ctx.fillStyle = '#f0ead2';
      ctx.fillRect(fx, 8, 44, 5);
      const g = ctx.createRadialGradient(fx + 22, 10, 4, fx + 22, 10, 70);
      g.addColorStop(0, 'rgba(255,240,200,0.30)');
      g.addColorStop(1, 'rgba(255,240,200,0)');
      ctx.fillStyle = g;
      ctx.fillRect(fx - 48, 0, 140, 120);
    }
    // The raid board: the ring, the X on the bend, six arrows
    ctx.fillStyle = '#1e2a22';
    ctx.fillRect(52, 46, 62, 40);
    ctx.strokeStyle = '#5c4a2a';
    ctx.strokeRect(51.5, 45.5, 63, 41);
    ctx.strokeStyle = '#d8e0d0';
    ctx.beginPath();
    ctx.arc(83, 66, 13, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(92, 58);
    ctx.lineTo(98, 52);
    ctx.moveTo(98, 58);
    ctx.lineTo(92, 52);
    ctx.stroke();
    for (const [ax2, ay2] of [[62, 54], [62, 76], [74, 82], [96, 76], [102, 66], [74, 50]] as const) {
      ctx.fillStyle = '#ffd166';
      ctx.fillRect(ax2, ay2, 4, 2);
    }
    // The heavy bag, leaking sand from its lost argument with Chris
    ctx.fillStyle = '#6b3a2c';
    ctx.beginPath();
    ctx.roundRect(152, 86, 20, 44, 8);
    ctx.fill();
    ctx.strokeStyle = '#41221a';
    ctx.beginPath();
    ctx.moveTo(162, 60);
    ctx.lineTo(162, 86);
    ctx.stroke();
    ctx.fillStyle = '#c9b98a';
    ctx.beginPath();
    ctx.moveTo(158, 130);
    ctx.quadraticCurveTo(160, 140, 154, 148);
    ctx.lineTo(170, 148);
    ctx.quadraticCurveTo(166, 138, 166, 130);
    ctx.closePath();
    ctx.fill();
    // Blue training mats
    ctx.fillStyle = '#3a6a94';
    ctx.fillRect(196, 140, 60, 26);
    ctx.fillStyle = '#2e567a';
    ctx.fillRect(196, 140, 60, 4);
    ctx.fillRect(226, 140, 2, 26);
    // Stacked gear for the raid: packs and Yolanda's quiver
    ctx.fillStyle = '#5c4a2a';
    ctx.fillRect(268, 108, 14, 12);
    ctx.fillRect(284, 112, 12, 10);
    ctx.fillStyle = '#7a5638';
    ctx.fillRect(274, 96, 8, 16);
    ctx.fillStyle = '#d8cdb4';
    for (let i = 0; i < 4; i++) ctx.fillRect(275 + i * 2, 90, 1, 7);
  },
  placeholderMaskDraw: (ctx) => {
    ctx.fillStyle = '#000000';
    ctx.fillRect(144, 116, 36, 14); // bag stand
  },
};
