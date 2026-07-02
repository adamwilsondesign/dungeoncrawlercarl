/**
 * R16 - the ring corridor: THE BALL, the borough boss, in two phases.
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
  // Pink fused mass studded with steel plate (matches the combatant anchor).
  placeholderOutfit: { torso: '#e8a4b0', head: '#e8a4b0', patches: ['#8f939c', '#d8dbe0', '#c87884'] },
};

export const r16_ring: RoomDef = {
  id: 'r16_ring',
  label: 'THE RING',
  backgroundPath: 'backgrounds/r16_ring.png',
  backgroundMood: 'boss',
  walkmaskPath: 'masks/r16_ring.png',
  playerSpawn: { x: 30, y: 162, facing: 'right' },
  onEnter: [
    // First-visit establishing beat (P10: the final boss arena).
    ifFlag(
      'seen:r16',
      [],
      [
        setFlag('seen:r16', true),
        narrate('You feel it before you see it: a rhythm in the floor, like a train that never arrives. The tunnel opens onto an old transit ring - a platform, a rail loop, and the stairwell doors on the far side, shut tight.'),
        narrate('Then it comes around the curve. THE BALL: a rolling fortress of fused armor, tusks, and momentum, lapping the ring without slowing. This is the borough boss. It has been circling between these people and the stairs for a season. Nothing that fast can be fought. So it will have to be stopped.'),
      ],
    ),
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
      color: '#e8a4b0',
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
  // Art brief: a subway-like ring - tiled platform wall, harsh strip
  // lights, the curving rail trench, the shut stairwell doors beyond.
  placeholderArtDraw: (ctx) => {
    // Tiled platform wall over the stone
    ctx.fillStyle = '#5a5e62';
    ctx.fillRect(0, 26, 320, 80);
    ctx.fillStyle = '#4a4e52';
    for (let y = 30; y < 104; y += 12) {
      ctx.fillRect(0, y, 320, 1);
      for (let x = (y / 12) % 2 === 0 ? 10 : 0; x < 320; x += 20) ctx.fillRect(x, y - 11, 1, 11);
    }
    // Warning stripe along the platform edge
    ctx.fillStyle = '#c9b23a';
    ctx.fillRect(0, 106, 320, 4);
    ctx.fillStyle = '#141414';
    for (let x = 0; x < 320; x += 16) ctx.fillRect(x, 106, 8, 4);
    // Harsh strip lights
    for (const fx of [40, 130, 220, 296]) {
      ctx.fillStyle = '#e0e6ea';
      ctx.fillRect(fx, 10, 36, 4);
      const g = ctx.createRadialGradient(fx + 18, 12, 4, fx + 18, 12, 50);
      g.addColorStop(0, 'rgba(220,230,240,0.30)');
      g.addColorStop(1, 'rgba(220,230,240,0)');
      ctx.fillStyle = g;
      ctx.fillRect(fx - 32, 0, 100, 100);
    }
    // The rail trench curving through the room (the loop)
    ctx.fillStyle = '#22262a';
    ctx.beginPath();
    ctx.moveTo(90, 110);
    ctx.quadraticCurveTo(200, 132, 320, 118);
    ctx.lineTo(320, 138);
    ctx.quadraticCurveTo(200, 152, 90, 130);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#6b6e72';
    for (const off of [4, 12]) {
      ctx.beginPath();
      ctx.moveTo(92, 114 + off);
      ctx.quadraticCurveTo(200, 136 + off, 320, 122 + off);
      ctx.stroke();
    }
    // Scuffed impact marks where it leans wide on the bend
    ctx.fillStyle = 'rgba(180,150,140,0.35)';
    ctx.beginPath();
    ctx.ellipse(238, 122, 26, 6, -0.06, 0, Math.PI * 2);
    ctx.fill();
    // The stairwell doors on the far platform, shut tight
    ctx.fillStyle = '#31353a';
    ctx.fillRect(262, 40, 44, 62);
    ctx.fillStyle = '#26292e';
    ctx.fillRect(266, 44, 17, 58);
    ctx.fillRect(285, 44, 17, 58);
    ctx.fillStyle = '#c9b23a';
    ctx.fillRect(266, 68, 36, 3);
  },
  placeholderMaskDraw: (ctx) => {
    ctx.fillStyle = '#000000';
    ctx.fillRect(40, 108, 44, 18); // chest plinth
    ctx.fillRect(96, 100, 170, 10); // the rail line itself
  },
};
