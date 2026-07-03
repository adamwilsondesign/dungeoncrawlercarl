/**
 * R01 - Frozen Seattle street, in TWO STATES. The room opens PRE-COLLAPSE
 * (intact apartment building, upright tree, no staircase); the intro
 * cutscene's collapse beat sets 'r01:collapsed' and live-swaps to the
 * POST-COLLAPSE background (rubble field, broken tree, staircase of light).
 * Drop-in art: backgrounds/r01_street.png (pre) and
 * backgrounds/r01_street_post.png (post) - both are CMS slots.
 */

import {
  announce,
  awardAchievement,
  describe,
  disableExit,
  disableHotspot,
  disableProp,
  enableExit,
  enableHotspot,
  enableProp,
  moveActor,
  narrate,
  say,
  setFlag,
  ifFlag,
  playCutscene,
  walkPlayerTo,
} from '../script';
import type { MoodPalette, RoomDef, SpriteSheetDef } from '../types';

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

/**
 * Shared street furniture: sodium light pool on the ground, falling snow.
 * The lamp POST itself is a prop now (P17: props/r01_streetlamp.png) so Carl
 * depth-sorts against it; only its ambient glow stays in the background.
 */
const drawStreetCommon = (ctx: CanvasRenderingContext2D): void => {
  const lamp = ctx.createRadialGradient(180, 150, 4, 180, 150, 60);
  lamp.addColorStop(0, 'rgba(255,170,80,0.30)');
  lamp.addColorStop(1, 'rgba(255,170,80,0)');
  ctx.fillStyle = lamp;
  ctx.fillRect(120, 100, 120, 100);
  // Snow: sparse falling flecks + ground dusting
  ctx.fillStyle = 'rgba(230,240,255,0.8)';
  for (let i = 0; i < 40; i++) {
    ctx.fillRect((i * 53) % 320, (i * 37 + (i % 5) * 11) % 150, 1, 1);
  }
  ctx.fillStyle = 'rgba(230,240,255,0.12)';
  ctx.fillRect(0, 112, 320, 88);
};

/** PRE-COLLAPSE: the block still standing, minutes before the announcement. */
const drawPreCollapse = (ctx: CanvasRenderingContext2D, pal: MoodPalette): void => {
  void pal;
  // Intact apartment building, left: full silhouette with a flat parapet
  ctx.fillStyle = '#141e30';
  ctx.fillRect(8, 22, 92, 90);
  ctx.fillStyle = '#0e1626';
  ctx.fillRect(4, 18, 100, 6); // parapet cap
  // (The distant towers are the 'skyline' decoration prop - P17.)
  // Window grid, all dark except two: the lit first-floor window and CARL'S
  // OWN window standing open on the third floor (the cat's exit route).
  ctx.fillStyle = '#0a1220';
  for (const wy of [32, 46, 62, 76]) {
    for (const wx of [22, 42, 60, 78]) ctx.fillRect(wx, wy, 10, 12);
  }
  ctx.fillStyle = '#ffcf7a';
  ctx.fillRect(22, 88, 10, 12); // Mrs. Parsons, still up
  ctx.fillStyle = '#060a12';
  ctx.fillRect(60, 46, 10, 12); // the open window
  ctx.fillStyle = '#2c3a52';
  ctx.fillRect(59, 45, 12, 2); // raised sash
  // Bare winter tree, upright, between sidewalk and building
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
  drawStreetCommon(ctx);
};

/** POST-COLLAPSE: the building is GONE; rubble + the staircase of light. */
const drawPostCollapse = (ctx: CanvasRenderingContext2D, pal: MoodPalette): void => {
  void pal;
  // Rubble field where the block used to be: heaped gravel, no silhouette
  ctx.fillStyle = '#1a2438';
  ctx.beginPath();
  ctx.moveTo(4, 112);
  ctx.quadraticCurveTo(30, 78, 56, 96);
  ctx.quadraticCurveTo(78, 72, 100, 100);
  ctx.lineTo(104, 112);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#22334a';
  for (const [rx, ry, rw2, rh2] of [
    [10, 96, 34, 16],
    [52, 88, 30, 18],
    [80, 100, 26, 12],
    [96, 112, 60, 12],
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
  // Rebar + one surviving door frame poking out of the heap
  ctx.strokeStyle = '#3a2c1c';
  ctx.beginPath();
  ctx.moveTo(36, 92);
  ctx.lineTo(40, 78);
  ctx.moveTo(62, 86);
  ctx.lineTo(60, 72);
  ctx.stroke();
  // Dust haze still settling over the rubble
  const haze = ctx.createLinearGradient(0, 60, 0, 116);
  haze.addColorStop(0, 'rgba(150,150,160,0)');
  haze.addColorStop(1, 'rgba(150,150,160,0.16)');
  ctx.fillStyle = haze;
  ctx.fillRect(0, 60, 160, 56);
  // The tree: snapped to a stump, trunk toppled across the sidewalk
  ctx.strokeStyle = '#241c14';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(120, 110);
  ctx.lineTo(119, 96); // stump
  ctx.moveTo(121, 98);
  ctx.lineTo(150, 108); // fallen trunk
  ctx.moveTo(138, 104);
  ctx.lineTo(144, 96); // one broken limb
  ctx.stroke();
  ctx.lineWidth = 1;
  drawStreetCommon(ctx);
  // (The staircase of light is the 'stairwell' prop now - P17 - so Carl
  // depth-sorts against the beam instead of walking "over" painted light.)
};

export const r01_street: RoomDef = {
  id: 'r01_street',
  label: 'SEATTLE - 2:23 AM',
  backgroundPath: 'backgrounds/r01_street.png',
  backgroundMood: 'cold',
  // The collapse beat flips this flag mid-cutscene (refreshBackground swaps
  // the art live); saves loaded after the beat resolve it at room load.
  altBackgrounds: [
    {
      flag: 'r01:collapsed',
      path: 'backgrounds/r01_street_post.png',
      label: 'SEATTLE - AFTER',
      draw: drawPostCollapse,
    },
  ],
  walkmaskPath: 'masks/r01_street.png',
  playerSpawn: { x: 160, y: 175, facing: 'down' },
  onEnter: [
    // Reconcile the two-state street: post-collapse interactables (rubble,
    // staircase) only exist after the flag; the intact window and skyline
    // only before. enableProp/enableHotspot share one store, so the mix
    // here is cosmetic - props and hotspots reconcile identically.
    ifFlag(
      'r01:collapsed',
      [enableProp('stairwell'), disableProp('skyline'), enableHotspot('ruins'), enableExit('stairs'), disableHotspot('window')],
      [disableProp('stairwell'), enableProp('skyline'), disableHotspot('ruins'), disableExit('stairs'), enableHotspot('window')],
    ),
    playCutscene('act1_intro'),
  ],
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
      // Pre-collapse only: the building is still there, and so is the way
      // the cat got out. Disabled the moment the block stops existing.
      id: 'window',
      name: 'YOUR OPEN WINDOW',
      rect: { x: 56, y: 42, w: 18, h: 20 },
      verbs: {
        look: [
          narrate('Third floor, sash up, curtain breathing in the cold. That is your window, open exactly one cat-width. The heating bill files a complaint.'),
        ],
        hand: [
          narrate('It is thirty feet up. You already climbed down once tonight; the fire escape has heard enough from you.'),
        ],
      },
    },
    {
      id: 'ruins',
      name: 'FORMER SKYLINE',
      rect: { x: 0, y: 30, w: 200, h: 74 },
      verbs: {
        look: [
          narrate('Your city, refiled as gravel. The dust is still deciding where to settle. Somewhere under there is your apartment and, worse, your good boots.'),
        ],
        hand: [
          describe('You pat a fallen skyscraper. It does not pat back.'),
          announce('The debris is not a collectible, Crawler. Everything under it is, technically, but we do not recommend the excavation.'),
        ],
      },
    },
    {
      id: 'reflection',
      name: 'YOUR REFLECTION',
      rect: { x: 216, y: 60, w: 34, h: 44 },
      verbs: {
        look: [
          describe('A surviving shop window shows the whole outfit: boxers, jacket, bare legs, pink Crocs.'),
          announce('And there he is, viewers - humanity sends its champion! The wardrobe department swears it had nothing to do with this.'),
          awardAchievement('fashion_victim'),
        ],
        hand: [
          describe('You adjust the jacket. The Crocs remain the loudest thing in the apocalypse.'),
          describe('His hand finds the half-pack of cigarettes in the inside pocket and stops there a moment. Not now. Later, maybe, when the world is done ending. It is a strange thing to save for a special occasion, but it is his.'),
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
  ],
  // P17 demonstration props: real composited assets with baselines, own art
  // (procedural placeholders; paintable at props/<id>.png via the CMS),
  // depth-sorting against Carl, and walk blockers the A* routes around.
  props: [
    {
      // The staircase of light, now a real object in the scene. Same id as
      // the old hotspot, so the intro cutscene's enableHotspot('stairwell')
      // and every save keep working untouched. Starts hidden: it only
      // exists after the collapse (onEnter below reconciles saves).
      id: 'stairwell',
      name: 'STAIRCASE OF LIGHT',
      art: { kind: 'procedural', drawFn: 'r01_staircase' },
      x: 302,
      y: 196, // baseline at the beam's foot: Carl slips BEHIND the light
      enabled: false,
      // A sliver of solid light at the beam's left base; the exit approach
      // (x >= 288) stays open, but Carl cannot walk through the beam edge.
      blocker: { x: -20, y: -10, w: 5, h: 10 },
      verbs: {
        look: [
          ifFlag(
            'r01.cat_chased',
            [narrate('White light, going down, humming like a fridge full of bees. The cat is already sitting on the top step. Of course she is.')],
            [
              describe('White light, going down. It hums, patient as a meter running.'),
              announce('The stairs close at dawn, Crawler. We mention this once, free of charge, because the audience hates a slow start.'),
            ],
          ),
        ],
        hand: [
          narrate('The light is warm. That is somehow worse. Walking in is the only way to test it further.'),
        ],
      },
    },
    {
      // The sodium streetlamp, pulled out of the background painting. Carl
      // walks behind it above the base line, in front below it, and paths
      // around its post. def.scale compensates the depth band at y=126 so
      // the art keeps its authored pixel size.
      id: 'streetlamp',
      name: 'STREETLAMP',
      art: { kind: 'procedural', drawFn: 'r01_streetlamp' },
      x: 179,
      y: 126,
      scale: 1.25,
      blocker: { x: -4, y: -5, w: 8, h: 5 },
      verbs: {
        look: [
          describe('One sodium lamp, still on, still faithful. It lights six feet of snow and the end of the world equally.'),
        ],
        hand: [
          describe('You put a hand on the cold post. It hums with the same patience as everything else tonight. Solid. Unlike the city.'),
        ],
      },
    },
    {
      // Decoration: the distant intact skyline. Art, depth, zero
      // interaction - it never hovers, highlights, or takes verbs. The
      // collapse beat disables it as the rubble background swaps in.
      id: 'skyline',
      art: { kind: 'procedural', drawFn: 'r01_skyline' },
      x: 263,
      y: 108,
      scale: 4 / 3, // cancels the 0.75 depth band: authored pixels 1:1
      zOverride: 0, // distant: always behind every actor and prop
      decoration: true,
    },
  ],
  scaleBands: [
    { yTop: 100, yBottom: 112, scale: 0.75 },
    { yTop: 184, yBottom: 200, scale: 1.0 },
  ],
  // Art brief: frozen Seattle street, PRE-collapse (the base background).
  // The post-collapse variant lives in altBackgrounds above.
  placeholderArtDraw: drawPreCollapse,
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
