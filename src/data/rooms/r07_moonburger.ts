/**
 * R07 - MoonBurger safe room: Tally the Bopca attendant, the REST booth
 * (heal-by-fiat narration + autosave checkpoint), and the show-premiere
 * cutscene that switches on the Views counter. No combat can start here.
 */

import { autosave, narrate, playCutscene, say, startDialogue } from '../script';
import type { RoomDef, SpriteSheetDef } from '../types';

/** Tally is small - about knee-height on Carl. */
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
      color: '#9a8f72',
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
  // Art brief: an intact fast-food restaurant transplanted whole into the
  // dungeon - cheerful reds and yellows, menu screens, big windows that
  // look out on solid rock, booths, and a playground ball pit.
  placeholderArtDraw: (ctx) => {
    // Clean interior walls + checker tile floor
    ctx.fillStyle = '#e8ddc6';
    ctx.fillRect(0, 0, 320, 106);
    ctx.fillStyle = '#c43a3a';
    ctx.fillRect(0, 0, 320, 10);
    ctx.fillRect(0, 100, 320, 6);
    for (let y = 110; y < 200; y += 12) {
      for (let x = (y / 12) % 2 === 0 ? 0 : 12; x < 320; x += 24) {
        ctx.fillStyle = 'rgba(255,244,224,0.16)';
        ctx.fillRect(x, y, 12, 12);
      }
    }
    // Windows showing SOLID WALL beyond
    for (const wx of [16, 254]) {
      ctx.fillStyle = '#3a3128';
      ctx.fillRect(wx, 24, 44, 56);
      ctx.fillStyle = '#2c251e';
      for (let i = 0; i < 5; i++) ctx.fillRect(wx + 4, 30 + i * 10, 36, 4);
      ctx.strokeStyle = '#b0342f';
      ctx.strokeRect(wx + 0.5, 24.5, 43, 55);
    }
    // Service counter + three glowing menu screens
    ctx.fillStyle = '#b0342f';
    ctx.fillRect(66, 96, 108, 22);
    ctx.fillStyle = '#d8cdb4';
    ctx.fillRect(66, 92, 108, 6);
    for (let i = 0; i < 3; i++) {
      const mx = 72 + i * 34;
      ctx.fillStyle = '#141824';
      ctx.fillRect(mx, 34, 30, 22);
      ctx.fillStyle = '#ffd166';
      ctx.fillRect(mx + 3, 38, 24, 3);
      ctx.fillStyle = '#ff9a5a';
      ctx.fillRect(mx + 3, 44, 18, 3);
      ctx.fillStyle = '#8fd4a8';
      ctx.fillRect(mx + 3, 50, 21, 2);
      ctx.strokeStyle = '#ffcf6a';
      ctx.strokeRect(mx + 0.5, 34.5, 29, 21);
    }
    // Crescent-moon brand sign
    ctx.fillStyle = '#ffd166';
    ctx.beginPath();
    ctx.arc(196, 22, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#e8ddc6';
    ctx.beginPath();
    ctx.arc(200, 20, 8, 0, Math.PI * 2);
    ctx.fill();
    // Booth row, right
    ctx.fillStyle = '#a82c2c';
    ctx.fillRect(232, 100, 66, 8);
    ctx.fillRect(232, 116, 66, 8);
    ctx.fillStyle = '#d8cdb4';
    ctx.fillRect(240, 108, 50, 8);
    // Playground corner: slide + ball pit
    ctx.fillStyle = '#3a7ac4';
    ctx.beginPath();
    ctx.moveTo(6, 64);
    ctx.lineTo(22, 64);
    ctx.lineTo(50, 100);
    ctx.lineTo(34, 100);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#2c5c94';
    ctx.fillRect(6, 56, 16, 10);
    ctx.fillStyle = '#1c2a3a';
    ctx.fillRect(28, 100, 34, 10);
    for (const [bx2, by2, bc] of [
      [32, 100, '#ff6a6a'], [39, 102, '#ffd166'], [46, 100, '#5ad48f'],
      [52, 103, '#6a9aff'], [57, 100, '#ff9a5a'], [36, 105, '#c98aff'],
    ] as const) {
      ctx.fillStyle = bc;
      ctx.beginPath();
      ctx.arc(bx2, by2 + 3, 3, 0, Math.PI * 2);
      ctx.fill();
    }
  },
  placeholderMaskDraw: (ctx) => {
    ctx.fillStyle = '#000000';
    ctx.fillRect(40, 96, 130, 26); // service counter
    ctx.fillRect(230, 110, 70, 18); // booth block
  },
};
