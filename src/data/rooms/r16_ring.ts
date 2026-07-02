/**
 * R16 — the ring corridor: THE BALL, the borough boss, in two phases.
 * PHASE 1 (derail puzzle, timing + placement): LOOK the Ball to learn its
 * lap rhythm (r16.timed), combine barbell + det_cord (from the maintenance
 * chest) into the rigged barbell, place it on THE BEND (not the straight -
 * funny non-death failure), then striker on the bend. Striker without the
 * timing knowledge = flattened (recoverable death). The correct sequence
 * plays act3_derail (sets ball:derailed) and rolls straight into PHASE 2:
 * the six-fighter raid encounter, gated vulnerable by the phase table.
 * Challenging it head-on while it rolls is the warned/insist steer-to-death.
 */

import {
  despawnActor,
  disableExit,
  disableHotspot,
  enableExit,
  giveItem,
  ifFlag,
  killPlayer,
  narrate,
  playCutscene,
  say,
  setFlag,
  startCombat,
  takeItem,
  walkPlayerTo,
} from '../script';
import type { RoomDef, SpriteSheetDef } from '../types';

/** The Ball, parked on its rail arc (a big placeholder blob that circles). */
const ballSheet: SpriteSheetDef = {
  path: 'sprites/ball_room.png',
  frameW: 40,
  frameH: 40,
  mirrorLeft: true,
  anims: {
    idle_down: { frames: [0], frameMs: 400, loop: true },
    idle_up: { frames: [3], frameMs: 400, loop: true },
    idle_right: { frames: [6], frameMs: 400, loop: true },
  },
};

export const r16_ring: RoomDef = {
  id: 'r16_ring',
  label: 'THE RING',
  backgroundPath: 'backgrounds/r16_ring.png',
  backgroundMood: 'boss',
  walkmaskPath: 'masks/r16_ring.png',
  playerSpawn: { x: 30, y: 162, facing: 'right' },
  onEnter: [
    ifFlag(
      'combat:ball_ring:result',
      [
        despawnActor('ball'),
        disableHotspot('ball'),
        disableHotspot('the_bend'),
        disableHotspot('the_straight'),
        enableExit('east'),
      ],
      [disableExit('east')],
      'victory',
    ),
  ],
  exits: [
    {
      id: 'west',
      rect: { x: 0, y: 128, w: 8, h: 64 },
      targetRoom: 'r15_training',
      targetSpawn: { x: 288, y: 162 },
      facing: 'left',
    },
    {
      id: 'east',
      rect: { x: 312, y: 128, w: 8, h: 64 },
      targetRoom: 'r17_stairs',
      targetSpawn: { x: 30, y: 162 },
      facing: 'right',
    },
  ],
  actors: [
    {
      id: 'ball',
      label: 'THE BALL',
      color: '#c8b8d8',
      sheet: ballSheet,
      x: 170,
      y: 96,
      anim: 'idle_down',
      facing: 'down',
    },
  ],
  hotspots: [
    {
      id: 'ball',
      name: 'THE BALL',
      rect: { x: 146, y: 64, w: 48, h: 44 },
      verbs: {
        look: [
          ifFlag(
            'r16.timed',
            [narrate('Twelve seconds a lap, wide on the bend, every time. You have its rhythm in your pulse now. Rhythm is a weakness with a schedule.')],
            [
              setFlag('r16.timed', true),
              narrate('A rolling fusion of tuskling knights and ladies, thundering the ring loop. You count: twelve seconds a lap. It leans WIDE on the bend. Noted. Counted. Owned.'),
            ],
          ),
        ],
        talk: [
          narrate('You address the Ball. Forty fused faces briefly agree to ignore you. It is the closest thing to mercy this floor has offered.'),
        ],
        hand: [
          ifFlag(
            'ball:warned',
            [
              narrate('AS YOU INSIST. THE DUNGEON LOGS THIS AS A SPEED-DATING EVENT.'),
              startCombat('ball_ring'),
            ],
            [
              setFlag('ball:warned', true),
              narrate('You square up to a rolling building. WARNING: IT LAPS THE RING IN TWELVE SECONDS. YOU LAP NOTHING. PERHAPS ENGINEER SOMETHING FIRST.'),
              say('donut', 'Carl. We DERAIL trains. We do not ARM-WRESTLE them. The plan, as drilled.'),
            ],
          ),
        ],
      },
    },
    {
      id: 'chest',
      name: 'MAINTENANCE CHEST',
      rect: { x: 44, y: 128, w: 30, h: 22 },
      verbs: {
        look: [
          ifFlag(
            'r16.chest_looted',
            [narrate('Empty, save for a manual titled RAIL SAFETY, unread since before the rail was a monster habitat.')],
            [narrate('A transit maintenance chest, stenciled DEMOLITION - AUTHORIZED CREWS. You have never felt more authorized in your life.')],
          ),
        ],
        hand: [
          ifFlag(
            'r16.chest_looted',
            [narrate('Nothing left but the manual. You leave it for the next authorized crew.')],
            [
              walkPlayerTo(60, 156),
              setFlag('r16.chest_looted', true),
              narrate('Inside: a coil of det cord, fast and total. Between this and the barbell, you are one idea away from a derailment kit.'),
              giveItem('det_cord'),
            ],
          ),
        ],
      },
    },
    {
      id: 'the_bend',
      name: 'THE BEND',
      rect: { x: 214, y: 108, w: 48, h: 28 },
      verbs: {
        look: [
          ifFlag(
            'r16.rigged',
            [narrate('The rigged barbell sits chocked across the bend, cord capped and waiting. It leans WIDE here. Physics has already signed off on the rest.')],
            [narrate('The rail arcs hard here - the one place the Ball leans wide and blind. If something heavy were wedged across this bend at the right moment...')],
          ),
        ],
        item: {
          rigged_barbell: [
            walkPlayerTo(230, 152),
            takeItem('rigged_barbell'),
            setFlag('r16.rigged', true),
            narrate('You chock the rigged barbell across the bend, cord trailing to cover. Now it is a question of WHEN, and you already counted the answer.'),
          ],
          flint_striker: [
            ifFlag(
              'r16.rigged',
              [
                ifFlag(
                  'r16.timed',
                  [
                    playCutscene('act3_derail'),
                    startCombat('ball_ring'),
                  ],
                  [
                    narrate('You spark the cord on instinct instead of arithmetic. The Ball arrives at the bend a full lap of physics ahead of your plan.'),
                    killPlayer('CAUSE OF DEATH: FREESTYLE TIMING. Count the laps first, Crawler. The Ball counts YOU either way.'),
                  ],
                ),
              ],
              [narrate('Sparks on bare rail. Pretty. Pointless. The bend needs something HEAVY on it first.')],
            ),
          ],
          barbell: [
            narrate('Bare iron would slow it for half a heartbeat. This wants the FULL recipe - iron AND ignition, married properly. You know a workshop grammar for that.'),
          ],
          default: [narrate('The bend is a physics problem. That is not a physics answer.')],
        },
        hand: [
          narrate('You stand ON the bend of an active monster rail, briefly. Even the audience inhales. You step back off.'),
        ],
      },
    },
    {
      id: 'the_straight',
      name: 'THE STRAIGHT',
      rect: { x: 96, y: 112, w: 52, h: 22 },
      verbs: {
        look: [
          narrate('The long straight: full speed, dead level, nowhere blind. Anything placed here gets a physics lesson, free of charge.'),
        ],
        item: {
          rigged_barbell: [
            walkPlayerTo(116, 152),
            narrate('You set the rig on the straight. The Ball bats it into the far wall at full speed without deviating a degree. You retrieve your barbell from the crater, humbled.'),
          ],
          default: [narrate('The straight is where plans go to get flattened. Try the place where physics blinks.')],
        },
      },
    },
    {
      id: 'platform',
      name: 'OLD PLATFORM',
      rect: { x: 250, y: 60, w: 60, h: 36 },
      verbs: {
        look: [
          narrate('A subway-style platform, benches still bolted down. Beyond it, the stairwell doors - shut, patient, waiting for the ring to be quiet.'),
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
    ctx.fillRect(40, 108, 44, 18); // chest plinth
    ctx.fillRect(96, 100, 170, 10); // the rail line itself
  },
};
