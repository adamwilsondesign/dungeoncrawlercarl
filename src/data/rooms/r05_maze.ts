/**
 * R05 — The maze, west half. First real combat (mandatory fight #1 gates the
 * east door), a gold pickup, and LOOK/HAND gags. Autosave on entry as always.
 */

import {
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
  placeholderMaskDraw: (ctx) => {
    ctx.fillStyle = '#000000';
    ctx.fillRect(60, 110, 44, 18); // rubble bay
    ctx.fillRect(190, 110, 44, 10); // fallen beam
    ctx.fillRect(0, 176, 26, 24);
  },
};
