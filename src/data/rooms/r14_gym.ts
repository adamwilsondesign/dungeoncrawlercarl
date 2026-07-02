/**
 * R14 - the gym lobby: two mandatory troglodyte fights (each with a
 * different pair of allies riding along via partyOverride, proving 4-member
 * combat) and the gym-gear loot that feeds both Carl's weapon upgrade and
 * the Ball derail kit (the barbell).
 */

import {
  disableExit,
  disableHotspot,
  enableExit,
  giveItem,
  ifFlag,
  narrate,
  setFlag,
  startCombat,
  walkPlayerTo,
} from '../script';
import type { RoomDef } from '../types';

export const r14_gym: RoomDef = {
  id: 'r14_gym',
  label: 'THE GYM',
  backgroundPath: 'backgrounds/r14_gym.png',
  backgroundMood: 'workshop',
  walkmaskPath: 'masks/r14_gym.png',
  playerSpawn: { x: 30, y: 162, facing: 'right' },
  onEnter: [
    ifFlag('combat:gym_lobby:result', [disableHotspot('mob1')], [], 'victory'),
    ifFlag(
      'combat:gym_racks:result',
      [disableHotspot('mob2'), enableExit('east')],
      [disableExit('east')],
      'victory',
    ),
  ],
  exits: [
    {
      id: 'west',
      rect: { x: 0, y: 128, w: 8, h: 64 },
      targetRoom: 'r13_meadowlark',
      targetSpawn: { x: 288, y: 162 },
      facing: 'left',
    },
    {
      id: 'east',
      rect: { x: 312, y: 128, w: 8, h: 64 },
      targetRoom: 'r15_training',
      targetSpawn: { x: 30, y: 162 },
      facing: 'right',
    },
  ],
  actors: [],
  hotspots: [
    {
      id: 'sign',
      name: 'GYM SIGN',
      rect: { x: 40, y: 56, w: 70, h: 26 },
      verbs: {
        look: [
          narrate("PUMP CITY - 24 HOURS, reads the sign, over a mural of a man high-fiving a kettlebell. The 24 HOURS part, at least, survived the apocalypse."),
        ],
      },
    },
    {
      id: 'mob1',
      name: 'CARDIO FLOOR',
      rect: { x: 128, y: 92, w: 56, h: 48 },
      verbs: {
        look: [
          narrate('Troglodytes have colonized the treadmill row. One is ON a treadmill, furious, going nowhere. The rest noticed you before you noticed them.'),
        ],
        hand: [
          narrate('You step onto the cardio floor. Gym etiquette is enforced immediately.'),
          startCombat('gym_lobby'),
        ],
      },
    },
    {
      id: 'mob2',
      name: 'SQUAT RACKS',
      rect: { x: 236, y: 88, w: 54, h: 52 },
      verbs: {
        look: [
          narrate('The rack cave: bigger trogs, and a howler pacing the top of the cage like a foreman. They are between you and the training floor. Naturally.'),
        ],
        hand: [
          narrate('You walk into the racks like you have a booking. The foreman howls the objection.'),
          startCombat('gym_racks'),
        ],
      },
    },
    {
      id: 'lockers',
      name: 'STAFF LOCKERS',
      rect: { x: 62, y: 128, w: 34, h: 26 },
      verbs: {
        look: [
          ifFlag(
            'r14.lockers_looted',
            [narrate('The lockers stand open and empty, except for a protein shaker nobody will ever wash now.')],
            [narrate('Staff lockers, trog-dented but shut. Gyms keep their best iron close. So do you, lately.')],
          ),
        ],
        hand: [
          ifFlag(
            'r14.lockers_looted',
            [narrate('Cleaned out. The shaker stays where it fell, as a warning.')],
            [
              walkPlayerTo(80, 158),
              setFlag('r14.lockers_looted', true),
              narrate('Inside: a kettlebell on a wrist strap, a lifting belt, and a competition barbell in its rack sleeve. The dungeon files all three as WEAPONS. So do you.'),
              giveItem('kettle_crusher'),
              giveItem('weight_belt'),
              giveItem('barbell'),
            ],
          ),
        ],
      },
    },
  ],
  scaleBands: [
    { yTop: 108, yBottom: 120, scale: 0.85 },
    { yTop: 184, yBottom: 200, scale: 1.0 },
  ],
  // Art brief: a transplanted fitness center gone feral - dead fluorescent
  // strips, treadmill row, squat racks, lockers, weights everywhere, trog
  // green creeping up the walls.
  placeholderArtDraw: (ctx) => {
    // Fluorescent strips: one live, the rest dead
    for (const [fx, live] of [[60, false], [150, true], [240, false]] as const) {
      ctx.fillStyle = live ? '#e8f0e0' : '#3a4038';
      ctx.fillRect(fx, 8, 44, 5);
      if (live) {
        const g = ctx.createRadialGradient(fx + 22, 10, 4, fx + 22, 10, 60);
        g.addColorStop(0, 'rgba(230,240,220,0.30)');
        g.addColorStop(1, 'rgba(230,240,220,0)');
        ctx.fillStyle = g;
        ctx.fillRect(fx - 40, 0, 124, 110);
      }
    }
    // Mirror wall panel, cracked
    ctx.fillStyle = '#4a5450';
    ctx.fillRect(112, 30, 96, 56);
    ctx.strokeStyle = '#2e3634';
    ctx.strokeRect(112.5, 30.5, 95, 55);
    ctx.beginPath();
    ctx.moveTo(140, 30);
    ctx.lineTo(158, 58);
    ctx.lineTo(150, 86);
    ctx.moveTo(158, 58);
    ctx.lineTo(178, 66);
    ctx.stroke();
    // Trog infestation: green growth creeping from the corners
    for (const [tx3, ty3, tr2] of [[8, 96, 20], [306, 90, 24], [230, 20, 16]] as const) {
      const g = ctx.createRadialGradient(tx3, ty3, 2, tx3, ty3, tr2 * 2);
      g.addColorStop(0, 'rgba(110,180,90,0.5)');
      g.addColorStop(1, 'rgba(110,180,90,0)');
      ctx.fillStyle = g;
      ctx.fillRect(tx3 - tr2 * 2, ty3 - tr2 * 2, tr2 * 4, tr2 * 4);
    }
    // Locker bank
    ctx.fillStyle = '#37505c';
    ctx.fillRect(58, 78, 40, 50);
    ctx.fillStyle = '#2a3e48';
    for (let i = 0; i < 4; i++) ctx.fillRect(60 + i * 10, 80, 8, 46);
    ctx.fillStyle = '#8fa3b0';
    for (let i = 0; i < 4; i++) ctx.fillRect(63 + i * 10, 96, 2, 4);
    // Treadmill row
    for (let i = 0; i < 3; i++) {
      const mx3 = 128 + i * 22;
      ctx.fillStyle = '#2c3230';
      ctx.fillRect(mx3, 108, 16, 16);
      ctx.fillStyle = '#1c2220';
      ctx.fillRect(mx3 + 2, 112, 12, 10);
      ctx.fillStyle = '#37403c';
      ctx.fillRect(mx3, 104, 3, 8);
    }
    // Squat rack cage
    ctx.strokeStyle = '#5a5248';
    ctx.lineWidth = 2;
    ctx.strokeRect(240, 92, 46, 44);
    ctx.beginPath();
    ctx.moveTo(240, 108);
    ctx.lineTo(286, 108);
    ctx.stroke();
    ctx.lineWidth = 1;
    // Scattered iron: dumbbells, plates, a medicine ball
    ctx.fillStyle = '#3a3a40';
    for (const [dx2, dy2] of [[120, 152], [176, 164], [220, 150], [86, 166], [254, 168]] as const) {
      ctx.fillRect(dx2, dy2, 12, 3);
      ctx.fillRect(dx2 - 2, dy2 - 2, 4, 7);
      ctx.fillRect(dx2 + 10, dy2 - 2, 4, 7);
    }
    ctx.fillStyle = '#6b4a3a';
    ctx.beginPath();
    ctx.arc(150, 176, 7, 0, Math.PI * 2);
    ctx.fill();
  },
  placeholderMaskDraw: (ctx) => {
    ctx.fillStyle = '#000000';
    ctx.fillRect(56, 108, 46, 22); // locker bank
    ctx.fillRect(122, 116, 66, 8); // treadmill row
  },
};
