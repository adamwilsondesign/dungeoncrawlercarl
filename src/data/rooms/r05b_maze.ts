/**
 * R05b - The maze, east half. Mandatory fight #2 gates the way to the
 * Hoarder; the demolition crate holds Carl's dynamite; the hubcap is the
 * Hoarder bait; the humming nest is the optional, repeatable over-level
 * fight.
 */

import {
  disableExit,
  disableHotspot,
  enableExit,
  giveItem,
  ifFlag,
  narrate,
  say,
  setFlag,
  startCombat,
  walkPlayerTo,
} from '../script';
import type { RoomDef } from '../types';

export const r05b_maze: RoomDef = {
  id: 'r05b_maze',
  label: 'THE MAZE - LEVEL 1',
  backgroundPath: 'backgrounds/r05b_maze.png',
  backgroundMood: 'dungeon',
  walkmaskPath: 'masks/r05b_maze.png',
  playerSpawn: { x: 30, y: 162, facing: 'right' },
  onEnter: [
    ifFlag(
      'combat:maze_pack:result',
      [enableExit('east'), disableHotspot('mob2')],
      [disableExit('east')],
      'victory',
    ),
  ],
  exits: [
    {
      id: 'west',
      rect: { x: 0, y: 128, w: 8, h: 64 },
      targetRoom: 'r05_maze',
      targetSpawn: { x: 288, y: 162 },
      facing: 'left',
    },
    {
      id: 'east',
      rect: { x: 312, y: 128, w: 8, h: 64 },
      targetRoom: 'r06_hoarder',
      targetSpawn: { x: 30, y: 162 },
      facing: 'right',
    },
  ],
  actors: [],
  hotspots: [
    {
      id: 'crate',
      name: 'DEMOLITION CRATE',
      rect: { x: 52, y: 96, w: 30, h: 32 },
      verbs: {
        look: [
          ifFlag(
            'r05b.crate_looted',
            [narrate('The crate is empty. The stenciled skull looks disappointed in you both.')],
            [narrate('A mining crate stenciled DANGER: PERSUASION. Somebody left the good stuff behind. Somebody was not thinking clearly.')],
          ),
        ],
        hand: [
          ifFlag(
            'r05b.crate_looted',
            [narrate('You already liberated the contents. The crate has nothing left but structural regret.')],
            [
              walkPlayerTo(66, 140),
              setFlag('r05b.crate_looted', true),
              narrate('Inside: two sticks of honest dynamite. Carl smiles for the first time all apocalypse. The audience notices.'),
              giveItem('dynamite'),
              giveItem('dynamite'),
            ],
          ),
        ],
      },
    },
    {
      id: 'hubcap',
      name: 'GLINTING HUBCAP',
      rect: { x: 148, y: 136, w: 26, h: 16 },
      verbs: {
        look: [
          ifFlag(
            'r05b.hubcap_taken',
            [narrate('Just floor now. Less glamorous.')],
            [narrate('A chrome hubcap, mirror-bright against all odds. Worthless to you. To anything that HOARDS, this is the crown jewels.')],
          ),
        ],
        hand: [
          ifFlag(
            'r05b.hubcap_taken',
            [narrate('Already pocketed. It barely fits. You manage.')],
            [
              walkPlayerTo(160, 164),
              setFlag('r05b.hubcap_taken', true),
              giveItem('polished_hubcap'),
              say('donut', 'Carry it carefully, Carl. Shiny objects are currency to the dim. I read that in your face just now.'),
            ],
          ),
        ],
      },
    },
    {
      id: 'mob2',
      name: 'RUSTLING HEAP',
      rect: { x: 250, y: 96, w: 46, h: 56 },
      verbs: {
        look: [
          narrate('The heap between you and the east tunnel is breathing. Several breaths, none synchronized. They know you are here.'),
        ],
        hand: [
          narrate('You kick the heap. Diplomatically.'),
          startCombat('maze_pack'),
        ],
      },
    },
    {
      id: 'nest',
      name: 'HUMMING NEST',
      rect: { x: 118, y: 60, w: 44, h: 36 },
      verbs: {
        look: [
          narrate('A wall nest, humming with heat. Entirely avoidable. The dungeon marks it OPTIONAL, in the tone of a dare.'),
        ],
        hand: [
          narrate('You reach into the OPTIONAL hole.'),
          startCombat('maze_nest'),
        ],
      },
    },
  ],
  scaleBands: [
    { yTop: 108, yBottom: 120, scale: 0.8 },
    { yTop: 184, yBottom: 200, scale: 1.0 },
  ],
  // Art brief: east maze - same claustrophobic tunnels, the demolition
  // crate's stenciled warning, the nest's heat glow, the shining hubcap.
  placeholderArtDraw: (ctx) => {
    ctx.fillStyle = '#241c14';
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(320, 0);
    ctx.lineTo(320, 30);
    ctx.quadraticCurveTo(210, 18, 120, 28);
    ctx.quadraticCurveTo(50, 36, 0, 24);
    ctx.closePath();
    ctx.fill();
    // The demolition crate on its ledge
    ctx.fillStyle = '#5c4a2a';
    ctx.fillRect(52, 98, 30, 30);
    ctx.strokeStyle = '#2e2410';
    ctx.strokeRect(52.5, 98.5, 29, 29);
    ctx.beginPath();
    ctx.moveTo(52, 98);
    ctx.lineTo(82, 128);
    ctx.moveTo(82, 98);
    ctx.lineTo(52, 128);
    ctx.stroke();
    ctx.fillStyle = '#c43a3a';
    ctx.fillRect(58, 108, 18, 9);
    // The humming nest: a wall hole ringed in scorch with an ember glow
    const nest = ctx.createRadialGradient(140, 78, 2, 140, 78, 26);
    nest.addColorStop(0, 'rgba(255,140,60,0.7)');
    nest.addColorStop(1, 'rgba(255,140,60,0)');
    ctx.fillStyle = nest;
    ctx.fillRect(112, 52, 56, 52);
    ctx.fillStyle = '#100a06';
    ctx.beginPath();
    ctx.ellipse(140, 78, 15, 11, 0, 0, Math.PI * 2);
    ctx.fill();
    // The glinting hubcap on the floor
    ctx.fillStyle = '#c9ccd4';
    ctx.beginPath();
    ctx.ellipse(161, 144, 11, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#f2f4f8';
    ctx.beginPath();
    ctx.ellipse(158, 143, 4, 1.5, 0, 0, Math.PI * 2);
    ctx.fill();
    // The rustling heap blocking the east passage
    ctx.fillStyle = '#332a1c';
    ctx.beginPath();
    ctx.ellipse(272, 130, 34, 22, 0, Math.PI, 0);
    ctx.fill();
    ctx.fillStyle = '#3f3422';
    ctx.beginPath();
    ctx.ellipse(258, 132, 14, 12, 0, Math.PI, 0);
    ctx.fill();
  },
  placeholderMaskDraw: (ctx) => {
    ctx.fillStyle = '#000000';
    ctx.fillRect(40, 110, 50, 20); // crate ledge
    ctx.fillRect(140, 110, 40, 16); // collapsed shelf over the hubcap
    ctx.fillRect(230, 176, 90, 24);
  },
};
