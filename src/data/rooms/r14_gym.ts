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
  placeholderMaskDraw: (ctx) => {
    ctx.fillStyle = '#000000';
    ctx.fillRect(56, 108, 46, 22); // locker bank
    ctx.fillRect(122, 116, 66, 8); // treadmill row
  },
};
