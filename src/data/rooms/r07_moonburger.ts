/**
 * R07 — MoonBurger safe room: Tally the Bopca attendant, the REST booth
 * (heal-by-fiat narration + autosave checkpoint), and the show-premiere
 * cutscene that switches on the Views counter. No combat can start here.
 */

import { autosave, narrate, playCutscene, say, startDialogue } from '../script';
import type { RoomDef, SpriteSheetDef } from '../types';

/** Tally is small — about knee-height on Carl. */
const tallySheet: SpriteSheetDef = {
  path: 'sprites/tally.png',
  frameW: 18,
  frameH: 20,
  mirrorLeft: true,
  anims: {
    idle_down: { frames: [0], frameMs: 400, loop: true },
    idle_up: { frames: [3], frameMs: 400, loop: true },
    idle_right: { frames: [6], frameMs: 400, loop: true },
  },
};

export const r07_moonburger: RoomDef = {
  id: 'r07_moonburger',
  label: 'MOONBURGER - SAFE ROOM',
  backgroundPath: 'backgrounds/r07_moonburger.png',
  backgroundMood: 'safe',
  walkmaskPath: 'masks/r07_moonburger.png',
  playerSpawn: { x: 30, y: 162, facing: 'right' },
  onEnter: [
    // Once-guarded by scene:act2_premiere:played; replays are no-ops.
    playCutscene('act2_premiere'),
  ],
  exits: [
    {
      id: 'west',
      rect: { x: 0, y: 128, w: 8, h: 64 },
      targetRoom: 'r06_hoarder',
      targetSpawn: { x: 288, y: 162 },
      facing: 'left',
    },
    {
      id: 'east',
      rect: { x: 312, y: 128, w: 8, h: 64 },
      targetRoom: 'r08_alcove',
      targetSpawn: { x: 30, y: 162 },
      facing: 'right',
    },
  ],
  actors: [
    {
      id: 'tally',
      label: 'TALLY',
      color: '#8fd4a8',
      sheet: tallySheet,
      x: 176,
      y: 138,
      anim: 'idle_down',
      facing: 'down',
    },
  ],
  hotspots: [
    {
      id: 'tally',
      name: 'TALLY',
      rect: { x: 166, y: 118, w: 22, h: 24 },
      verbs: {
        look: [
          narrate('A Bopca: three feet of apron, name tag, and professional welcome. The name tag says TALLY. The smile says it means it.'),
        ],
        talk: [startDialogue('tally')],
        hand: [
          say('tally', 'Oh! A handshake! We are told to discourage touching, but a handshake is DIPLOMACY. Firm grip, sir.'),
        ],
      },
    },
    {
      id: 'booth',
      name: 'REST BOOTH',
      rect: { x: 236, y: 106, w: 56, h: 42 },
      verbs: {
        look: [
          narrate('A corner booth with clean cushions and a RESERVED FOR SURVIVORS placard. It is the safest furniture within eighteen floors.'),
        ],
        hand: [
          narrate('You fold into the booth. The party breathes. Wounds close with a sound like an apology. PROGRESS RECORDED.'),
          autosave(),
          say('donut', 'Wake me if anything interesting survives long enough to reach the door.'),
        ],
      },
    },
    {
      id: 'menu_board',
      name: 'MENU BOARD',
      rect: { x: 60, y: 52, w: 74, h: 40 },
      verbs: {
        look: [
          narrate('MOONBURGER. MOONFRIES. THE GRAVITY SHAKE. Every photo is lit like a shrine. None of the machines behind the counter are on.'),
        ],
        hand: [
          narrate('You point at the Gravity Shake. Somewhere, a corporate ledger notes your interest and files it under UNMET DEMAND.'),
        ],
      },
    },
    {
      id: 'terminal',
      name: 'SHOP TERMINAL',
      rect: { x: 142, y: 58, w: 26, h: 44 },
      verbs: {
        look: [
          narrate('A vending terminal wrapped in COMING ONLINE tape. The screen shows a progress bar that has learned to live at 97 percent.'),
        ],
        hand: [
          narrate('You tap the screen. The progress bar flinches to 98, thinks better of it, and returns to 97. Character development.'),
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
    ctx.fillRect(40, 96, 130, 26); // service counter
    ctx.fillRect(230, 110, 70, 18); // booth block
  },
};
