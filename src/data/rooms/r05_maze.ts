/**
 * R05 - The maze, west half. First real combat (mandatory fight #1 gates the
 * east door), a gold pickup, and LOOK/HAND gags. Autosave on entry as always.
 */

import {
  announce,
  describe,
  disableExit,
  disableHotspot,
  enableExit,
  giveGold,
  ifFlag,
  narrate,
  setFlag,
  startCombat,
  walkPlayerTo,
} from '../script';
import type { RoomDef } from '../types';

export const r05_maze: RoomDef = {
  id: 'r05_maze',
  label: 'THE MAZE - LEVEL 1',
  backgroundPath: 'backgrounds/r05_maze.png',
  backgroundMood: 'dungeon',
  walkmaskPath: 'masks/r05_maze.png',
  playerSpawn: { x: 30, y: 162, facing: 'right' },
  onEnter: [
    // First-visit establishing beat (P10: Act II opens here).
    ifFlag(
      'seen:r05',
      [],
      [
        setFlag('seen:r05', true),
        describe('Past the guild door, the dungeon stops pretending to be a hallway. This is the maze: mine tunnels braided into mine tunnels, chalk marks from crawlers who came through ahead of you, and a darkness up ahead with a texture to it.'),
        describe('This is the part Mordecai warned you about. Things live in the walls out here, and the way east goes through them, not around.'),
        announce('And we are OUT of the tutorial, folks! Party of two, fresh gear, first real corridor. The audience has been very patient through the paperwork, Crawler. Weapons out. The show has been waiting for this.'),
      ],
    ),
    // Reconcile on re-entry/load: the east door opens once the rats are dealt with.
    ifFlag(
      'combat:maze_rats:result',
      [enableExit('east'), disableHotspot('mob1')],
      [disableExit('east')],
      'victory',
    ),
  ],
  exits: [
    {
      id: 'west',
      rect: { x: 0, y: 128, w: 8, h: 64 },
      targetRoom: 'r04_guild',
      targetSpawn: { x: 288, y: 162 },
      facing: 'left',
    },
    {
      id: 'east',
      rect: { x: 312, y: 128, w: 8, h: 64 },
      targetRoom: 'r05b_maze',
      targetSpawn: { x: 30, y: 162 },
      facing: 'right',
    },
  ],
  actors: [],
  hotspots: [
    {
      id: 'chalk',
      name: 'CHALK ARROWS',
      rect: { x: 44, y: 60, w: 60, h: 40 },
      verbs: {
        look: [
          narrate('Chalk arrows on the wall. Three point east. One points straight down and is underlined twice. Crawler humor, or crawler honesty.'),
        ],
        hand: [
          narrate('You rub one out and immediately feel worse. You draw it back.'),
        ],
      },
    },
    {
      id: 'drain',
      name: 'STORM DRAIN',
      rect: { x: 138, y: 140, w: 28, h: 18 },
      verbs: {
        look: [
          ifFlag(
            'r05.drain_looted',
            [narrate('The drain has given all it intends to give.')],
            [narrate('A storm drain, oddly clean. Something metallic glints between the bars. The dungeon rarely leaves change on the floor by accident.')],
          ),
        ],
        hand: [
          ifFlag(
            'r05.drain_looted',
            [narrate('Nothing left but a smell with seniority.')],
            [
              walkPlayerTo(152, 168),
              setFlag('r05.drain_looted', true),
              narrate('You fish two fingers past the grate, regretting each knuckle.'),
              giveGold(25),
            ],
          ),
        ],
      },
    },
    {
      id: 'mob1',
      name: 'SCRATCHING DARK',
      rect: { x: 250, y: 96, w: 46, h: 56 },
      verbs: {
        look: [
          narrate('The east passage is occupied. The scratching has rhythm, numbers, and opinions about your route. No way around it, only through.'),
        ],
        hand: [
          narrate('You knock politely on the dark. The dark accepts.'),
          startCombat('maze_rats'),
        ],
      },
    },
    {
      id: 'mural',
      name: 'OLD MURAL',
      rect: { x: 190, y: 56, w: 52, h: 40 },
      verbs: {
        look: [
          narrate('A faded mural of smiling miners handing gems to a smiling suit. Someone has scratched the suit a new face. An improvement.'),
        ],
      },
    },
  ],
  scaleBands: [
    { yTop: 108, yBottom: 120, scale: 0.8 },
    { yTop: 184, yBottom: 200, scale: 1.0 },
  ],
  // Art brief: maze corridors - lower rough ceiling, branch mouths, survivor
  // spray-paint arrows, deeper shadow than the entrance halls.
  placeholderArtDraw: (ctx) => {
    // Low rough ceiling pressing down
    ctx.fillStyle = '#241c14';
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(320, 0);
    ctx.lineTo(320, 24);
    ctx.quadraticCurveTo(230, 40, 150, 30);
    ctx.quadraticCurveTo(60, 22, 0, 36);
    ctx.closePath();
    ctx.fill();
    // Branch mouths: dark side passages breaking the wall
    for (const [bx, bw] of [[36, 30], [150, 26], [242, 34]] as const) {
      const mouth = ctx.createLinearGradient(bx, 0, bx, 108);
      mouth.addColorStop(0, '#0c0a06');
      mouth.addColorStop(1, '#1c150e');
      ctx.fillStyle = mouth;
      ctx.beginPath();
      ctx.moveTo(bx, 108);
      ctx.lineTo(bx + 4, 46);
      ctx.quadraticCurveTo(bx + bw / 2, 34, bx + bw - 4, 46);
      ctx.lineTo(bx + bw, 108);
      ctx.closePath();
      ctx.fill();
    }
    // Survivor chalk/spray arrows
    ctx.fillStyle = '#e8e2d0';
    ctx.fillRect(96, 66, 14, 3);
    ctx.beginPath();
    ctx.moveTo(110, 62);
    ctx.lineTo(116, 67.5);
    ctx.lineTo(110, 73);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#d8b06a';
    ctx.fillRect(206, 70, 3, 12);
    ctx.beginPath();
    ctx.moveTo(202, 82);
    ctx.lineTo(207.5, 88);
    ctx.lineTo(213, 82);
    ctx.closePath();
    ctx.fill();
    // Deep shadow pooling on the floor edges
    const shadow = ctx.createLinearGradient(0, 110, 0, 200);
    shadow.addColorStop(0, 'rgba(0,0,0,0)');
    shadow.addColorStop(1, 'rgba(0,0,0,0.35)');
    ctx.fillStyle = shadow;
    ctx.fillRect(0, 110, 320, 90);
  },
  placeholderMaskDraw: (ctx) => {
    ctx.fillStyle = '#000000';
    ctx.fillRect(60, 110, 44, 18); // rubble bay
    ctx.fillRect(190, 110, 44, 10); // fallen beam
    ctx.fillRect(0, 176, 26, 24);
  },
};
