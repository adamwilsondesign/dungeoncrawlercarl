/**
 * R01 — Frozen Seattle street, minutes after the collapse. Opening cutscene
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
