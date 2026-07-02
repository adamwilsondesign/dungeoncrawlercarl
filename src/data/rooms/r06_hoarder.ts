/**
 * R06 - The Hoarder's lair: the first combat-puzzle hybrid. THE BAIT: use
 * the polished hubcap (ITEM verb) on her treasure midden to set
 * 'hoarder:baited'; the encounter's phase table keeps her at 15% damage
 * taken until that flag is true. Charging in unbaited is survivable-but-
 * hopeless, with warnings first and a mid-fight hint; death restores the
 * room-entry autosave (bait resets with it - re-bait and go again).
 */

import {
  despawnActor,
  disableExit,
  disableHotspot,
  enableExit,
  ifFlag,
  moveActor,
  narrate,
  say,
  setFlag,
  sfxCue,
  startCombat,
  takeItem,
} from '../script';
import type { RoomDef, SpriteSheetDef } from '../types';

/** Big lair sprite (room actors can be any frame size; combat uses 24x32). */
const hoarderSheet: SpriteSheetDef = {
  path: 'sprites/hoarder_large.png',
  frameW: 36,
  frameH: 48,
  mirrorLeft: true,
  anims: {
    idle_down: { frames: [0], frameMs: 400, loop: true },
    idle_up: { frames: [3], frameMs: 400, loop: true },
    idle_right: { frames: [6], frameMs: 400, loop: true },
  },
};

export const r06_hoarder: RoomDef = {
  id: 'r06_hoarder',
  label: "THE HOARDER'S LAIR",
  backgroundPath: 'backgrounds/r06_hoarder.png',
  backgroundMood: 'boss',
  walkmaskPath: 'masks/r06_hoarder.png',
  playerSpawn: { x: 30, y: 162, facing: 'right' },
  onEnter: [
    ifFlag(
      'combat:hoarder_lair:result',
      [despawnActor('hoarder'), disableHotspot('hoarder'), enableExit('east')],
      [disableExit('east')],
      'victory',
    ),
  ],
  exits: [
    {
      id: 'west',
      rect: { x: 0, y: 128, w: 8, h: 64 },
      targetRoom: 'r05b_maze',
      targetSpawn: { x: 288, y: 162 },
      facing: 'left',
    },
    {
      id: 'east',
      rect: { x: 312, y: 128, w: 8, h: 64 },
      targetRoom: 'r07_moonburger',
      targetSpawn: { x: 30, y: 162 },
      facing: 'right',
    },
  ],
  actors: [
    {
      id: 'hoarder',
      label: 'THE HOARDER',
      color: '#7a9a5a',
      sheet: hoarderSheet,
      x: 200,
      y: 130,
      anim: 'idle_down',
      facing: 'down',
    },
  ],
  hotspots: [
    {
      id: 'hoarder',
      name: 'THE HOARDER',
      rect: { x: 178, y: 82, w: 46, h: 52 },
      verbs: {
        look: [
          narrate('A troll built like a landfill with a grudge. Her eyes never leave the treasure pile. Never. That is worth remembering.'),
        ],
        talk: [
          say('carl', 'Evening. We just need to pass through.'),
          narrate('She grades you at a glance: not shiny, not edible, not urgent. The audit ends. You have never mattered less to anyone.'),
        ],
        hand: [
          ifFlag(
            'hoarder:baited',
            [
              narrate('Her whole world is the hubcap now. Nothing else on this floor exists to her. Strike.'),
              startCombat('hoarder_lair'),
            ],
            [
              ifFlag(
                'hoarder:warned',
                [
                  narrate('Very well. THE DUNGEON LOGS THIS AS INFORMED CONSENT.'),
                  startCombat('hoarder_lair'),
                ],
                [
                  setFlag('hoarder:warned', true),
                  narrate('You square up. She does not even turn. WARNING: FRONTAL ASSAULT POLLS AT TWO PERCENT SURVIVAL. Perhaps study what she loves first.'),
                  say('donut', 'Carl. The pile. She guards the PILE. Even you can finish this thought.'),
                ],
              ),
            ],
          ),
        ],
      },
    },
    {
      id: 'midden',
      name: 'TREASURE MIDDEN',
      rect: { x: 236, y: 100, w: 60, h: 46 },
      verbs: {
        look: [
          narrate('Her hoard: bottle caps, wire, one bowling trophy, arranged with terrifying love. There is an obvious gap, hubcap-shaped, near the top.'),
        ],
        hand: [
          narrate('You reach toward the pile. The temperature of her attention drops forty degrees. You withdraw with all fingers, this time.'),
        ],
        item: {
          polished_hubcap: [
            moveActor('player', 232, 156),
            sfxCue('chrome_ring'),
            narrate('You skim the hubcap onto the midden. It lands with a ringing note, catching every light in the lair at once.'),
            takeItem('polished_hubcap'),
            setFlag('hoarder:baited', true),
            moveActor('hoarder', 236, 126, { speed: 40 }),
            narrate('She turns. All of her turns. The new treasure must be counted, weighed, adored. Her back has never been more available.'),
            say('donut', 'NOW, Carl. Before she names it.'),
          ],
          default: [
            narrate('You could throw it, but she would not care. Only true SHINE moves her. THE DUNGEON SUGGESTS INVENTORY REVIEW.'),
          ],
        },
      },
    },
    {
      id: 'piles',
      name: 'GARBAGE DUNES',
      rect: { x: 36, y: 56, w: 110, h: 60 },
      verbs: {
        look: [
          narrate('Dunes of compressed trash, sorted by a system only she understands. Category one appears to be MINE. So do the others.'),
        ],
        hand: [
          narrate('Everything here is inventoried. She would know. You keep your hands to your own garbage.'),
        ],
      },
    },
  ],
  scaleBands: [
    { yTop: 100, yBottom: 114, scale: 0.85 },
    { yTop: 184, yBottom: 200, scale: 1.0 },
  ],
  // Art brief: the inside of a giant dumpster - trash mountains toward the
  // ceiling, ripped bags, the curated treasure midden, lurid boss-light.
  placeholderArtDraw: (ctx) => {
    // Steel dumpster walls with vertical ribs
    ctx.fillStyle = '#2e3230';
    ctx.fillRect(0, 0, 320, 106);
    ctx.fillStyle = '#262a28';
    for (let x = 12; x < 320; x += 34) ctx.fillRect(x, 0, 4, 106);
    // Trash mountains stacked toward the ceiling
    const heap = (cx: number, w: number, top: number, base: string): void => {
      ctx.fillStyle = base;
      ctx.beginPath();
      ctx.moveTo(cx - w / 2, 112);
      ctx.quadraticCurveTo(cx - w * 0.2, top, cx, top + 4);
      ctx.quadraticCurveTo(cx + w * 0.25, top - 4, cx + w / 2, 112);
      ctx.closePath();
      ctx.fill();
    };
    heap(60, 130, 26, '#3d4426');
    heap(140, 110, 44, '#46422a');
    heap(96, 90, 60, '#52481f');
    // Ripped bags + junk glints on the heaps
    for (const [gx, gy, gc] of [
      [44, 70, '#1c2014'], [78, 52, '#20241a'], [120, 74, '#1e2216'],
      [58, 94, '#c4c9a0'], [102, 86, '#b0a068'], [140, 92, '#8f9a78'],
    ] as const) {
      ctx.fillStyle = gc;
      ctx.beginPath();
      ctx.ellipse(gx, gy, 9, 6, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    // The treasure midden: her curated pile, glinting
    ctx.fillStyle = '#4a3e1e';
    ctx.beginPath();
    ctx.moveTo(236, 146);
    ctx.quadraticCurveTo(256, 92, 268, 100);
    ctx.quadraticCurveTo(292, 92, 296, 146);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#ffd166';
    for (const [tx2, ty2] of [[254, 112], [270, 104], [282, 122], [262, 130], [246, 126]] as const) {
      ctx.fillRect(tx2, ty2, 4, 3);
    }
    ctx.fillStyle = '#e8e4d8';
    ctx.fillRect(274, 112, 5, 4);
    // A hubcap-shaped vacancy near the top
    ctx.strokeStyle = '#2a2210';
    ctx.beginPath();
    ctx.ellipse(268, 100, 7, 3, 0, 0, Math.PI * 2);
    ctx.stroke();
  },
  placeholderMaskDraw: (ctx) => {
    ctx.fillStyle = '#000000';
    ctx.fillRect(30, 110, 120, 14); // garbage dunes
    ctx.fillRect(236, 110, 84, 20); // the midden mound
  },
};
