/**
 * R01 - Frozen Seattle street, minutes after the collapse. Opening cutscene
 * plays on entry (New Game), then the player gets LOOK/HAND practice and the
 * staircase down. One-way: the stairs are the only exit.
 */

import {
  awardAchievement,
  moveActor,
  narrate,
  say,
  setFlag,
  ifFlag,
  playCutscene,
  walkPlayerTo,
} from '../script';
import type { RoomDef, SpriteSheetDef } from '../types';

/** Donut in cat form (pre-transformation). */
export const donutCatSheet: SpriteSheetDef = {
  path: 'sprites/donut_cat.png',
  frameW: 20,
  frameH: 16,
  mirrorLeft: true,
  anims: {
    idle_down: { frames: [0], frameMs: 400, loop: true },
    idle_up: { frames: [3], frameMs: 400, loop: true },
    idle_right: { frames: [6], frameMs: 400, loop: true },
  },
  // Tortoiseshell Persian: cream base mottled black / white / caramel.
  placeholderOutfit: {
    torso: '#e3cfa8',
    head: '#efe0c0',
    patches: ['#3a332c', '#f6f0e2', '#a2703c'],
  },
};

export const r01_street: RoomDef = {
  id: 'r01_street',
  label: 'SEATTLE - 2:23 AM',
  backgroundPath: 'backgrounds/r01_street.png',
  backgroundMood: 'cold',
  walkmaskPath: 'masks/r01_street.png',
  playerSpawn: { x: 160, y: 175, facing: 'down' },
  onEnter: [playCutscene('act1_intro')],
  exits: [
    // The staircase of light, stage right. One way. Obviously.
    {
      id: 'stairs',
      rect: { x: 306, y: 128, w: 14, h: 64 },
      targetRoom: 'r02_descent',
      targetSpawn: { x: 160, y: 60 },
      facing: 'down',
    },
  ],
  actors: [
    {
      id: 'donut_cat',
      label: 'THE CAT',
      color: '#f5f0e6',
      sheet: donutCatSheet,
      x: 222,
      y: 120,
      anim: 'idle_down',
      facing: 'down',
    },
  ],
  hotspots: [
    {
      id: 'ruins',
      name: 'FORMER SKYLINE',
      rect: { x: 0, y: 30, w: 200, h: 74 },
      verbs: {
        look: [
          narrate('Your city, refiled as gravel. The dust is still deciding where to settle. Somewhere under there is your apartment and, worse, your good boots.'),
        ],
        hand: [
          narrate('You pat a fallen skyscraper. It does not pat back. THE DEBRIS IS NOT A COLLECTIBLE, CRAWLER.'),
        ],
      },
    },
    {
      id: 'reflection',
      name: 'YOUR REFLECTION',
      rect: { x: 216, y: 60, w: 34, h: 44 },
      verbs: {
        look: [
          narrate('A surviving shop window shows the whole outfit: boxers, jacket, bare legs, pink Crocs. HUMANITY SENDS ITS CHAMPION.'),
          awardAchievement('fashion_victim'),
        ],
        hand: [
          narrate('You adjust the jacket. The Crocs remain the loudest thing in the apocalypse.'),
        ],
      },
    },
    {
      id: 'cat',
      name: 'THE CAT',
      rect: { x: 236, y: 100, w: 28, h: 22 },
      verbs: {
        look: [
          narrate("Miss Beatrice's cat. Show-quality, allegedly. She watches the end of the world like it is beneath her. It probably is."),
        ],
        hand: [
          walkPlayerTo(240, 132),
          narrate('You lunge. She flows out of reach like expensive smoke and resettles, offended.'),
          moveActor('donut_cat', 268, 122, { speed: 90 }),
          say('carl', 'Fine. New plan. You follow ME down the glowing death stairs.'),
          setFlag('r01.cat_chased', true),
        ],
        talk: [
          say('carl', 'Donut. Stairs. Now. I will carry you past the scary light.'),
          narrate('She blinks once, slowly - feline for WE GO WHEN I SAY. She will follow. On her schedule.'),
        ],
      },
    },
    {
      id: 'stairwell',
      name: 'STAIRCASE OF LIGHT',
      rect: { x: 284, y: 96, w: 36, h: 96 },
      verbs: {
        look: [
          ifFlag(
            'r01.cat_chased',
            [narrate('White light, going down, humming like a fridge full of bees. The cat is already sitting on the top step. Of course she is.')],
            [narrate('White light, going down. It hums. THE STAIRS CLOSE AT DAWN, says nothing and everything about your options.')],
          ),
        ],
        hand: [
          narrate('The light is warm. That is somehow worse. Walking in is the only way to test it further.'),
        ],
      },
    },
  ],
  scaleBands: [
    { yTop: 100, yBottom: 112, scale: 0.75 },
    { yTop: 184, yBottom: 200, scale: 1.0 },
  ],
  // Art brief: frozen Seattle street post-collapse - apartment ruin + bare
  // tree, sodium streetlight pools, rubble, the staircase of light far right.
  placeholderArtDraw: (ctx, pal) => {
    // Collapsed apartment block, left: a broken silhouette against the night
    ctx.fillStyle = '#141e30';
    ctx.fillRect(8, 26, 92, 84);
    ctx.fillStyle = '#0e1626';
    ctx.beginPath();
    ctx.moveTo(8, 26);
    ctx.lineTo(46, 14);
    ctx.lineTo(100, 30);
    ctx.lineTo(100, 44);
    ctx.lineTo(8, 40);
    ctx.closePath();
    ctx.fill();
    // Mrs. Parsons' first-floor window, still lit; one dark open window above
    ctx.fillStyle = '#ffcf7a';
    ctx.fillRect(22, 88, 10, 12);
    ctx.fillStyle = '#060a12';
    ctx.fillRect(60, 46, 10, 12);
    for (const wx of [22, 42, 78]) {
      ctx.fillStyle = '#0a1220';
      ctx.fillRect(wx, 62, 10, 12);
    }
    // Bare winter tree between sidewalk and building
    ctx.strokeStyle = '#241c14';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(120, 110);
    ctx.lineTo(118, 70);
    ctx.moveTo(118, 84);
    ctx.lineTo(104, 62);
    ctx.moveTo(118, 76);
    ctx.lineTo(132, 56);
    ctx.moveTo(119, 92);
    ctx.lineTo(134, 78);
    ctx.stroke();
    ctx.lineWidth = 1;
    // Sodium streetlight pool mid-street
    const lamp = ctx.createRadialGradient(180, 150, 4, 180, 150, 60);
    lamp.addColorStop(0, 'rgba(255,170,80,0.30)');
    lamp.addColorStop(1, 'rgba(255,170,80,0)');
    ctx.fillStyle = lamp;
    ctx.fillRect(120, 100, 120, 100);
    ctx.fillStyle = '#1a2334';
    ctx.fillRect(178, 60, 3, 60);
    ctx.fillStyle = '#ffcf8a';
    ctx.fillRect(174, 56, 11, 4);
    // Rubble field where the block used to be
    void pal;
    ctx.fillStyle = '#22334a';
    for (const [rx, ry, rw2, rh2] of [
      [96, 112, 60, 12],
      [4, 112, 52, 22],
      [140, 118, 26, 8],
      [210, 120, 30, 9],
    ] as const) {
      ctx.beginPath();
      ctx.moveTo(rx, ry + rh2);
      ctx.lineTo(rx + rw2 * 0.3, ry);
      ctx.lineTo(rx + rw2 * 0.7, ry + rh2 * 0.4);
      ctx.lineTo(rx + rw2, ry + rh2);
      ctx.closePath();
      ctx.fill();
    }
    // The staircase of light, punching up through the ground at far right
    const beam = ctx.createLinearGradient(284, 0, 284, 200);
    beam.addColorStop(0, 'rgba(255,236,170,0.10)');
    beam.addColorStop(0.55, 'rgba(255,224,140,0.55)');
    beam.addColorStop(1, 'rgba(255,210,110,0.85)');
    ctx.fillStyle = beam;
    ctx.fillRect(280, 20, 40, 180);
    ctx.fillStyle = '#ffe9b0';
    for (let i = 0; i < 6; i++) ctx.fillRect(284, 108 + i * 14, 32, 3);
  },
  placeholderMaskDraw: (ctx) => {
    // Rubble piles narrow the street
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 110, 56, 26);
    ctx.fillRect(96, 110, 60, 14);
    ctx.fillRect(0, 170, 30, 30);
    // Walkable approach to the staircase glow
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(284, 96, 36, 20);
  },
};
