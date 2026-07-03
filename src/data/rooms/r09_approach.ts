/**
 * R09 - the workshop approach: recon and parley. Kivvi the goblin engineer
 * seeds the chain-reaction puzzle (kegs + fuel line + the coal rail past the
 * boss door) and hands out the flint striker; the yard supplies the fuse
 * wick and grease. The patrol skirmish is optional - fight it or have Kivvi
 * whistle it off via dialogue.
 */

import {
  announce,
  describe,
  disableHotspot,
  giveItem,
  ifFlag,
  narrate,
  say,
  setFlag,
  startCombat,
  startDialogue,
  walkPlayerTo,
} from '../script';
import type { RoomDef, SpriteSheetDef } from '../types';

const kivviSheet: SpriteSheetDef = {
  path: 'sprites/kivvi.png',
  frameW: 18,
  frameH: 22,
  mirrorLeft: true,
  anims: {
    idle_down: { frames: [0], frameMs: 400, loop: true },
    idle_up: { frames: [3], frameMs: 400, loop: true },
    idle_right: { frames: [6], frameMs: 400, loop: true },
  },
};

export const r09_approach: RoomDef = {
  id: 'r09_approach',
  label: 'COPPER CHOPPER YARD',
  backgroundPath: 'backgrounds/r09_approach.png',
  backgroundMood: 'workshop',
  walkmaskPath: 'masks/r09_approach.png',
  playerSpawn: { x: 30, y: 162, facing: 'right' },
  onEnter: [
    // First-visit establishing beat (P10: Act II part 2 opens here).
    ifFlag(
      'seen:r09',
      [],
      [
        setFlag('seen:r09', true),
        describe('The tunnel opens onto a yard of noise and copper: steam-bikes on blocks, tool racks, chimney smoke. Goblins - a whole working clan of them - and beyond the yard, a workshop the size of a church, breathing forge-light through its seams.'),
        announce("You have reached goblin country, Crawler, which means it is time to introduce this district's headliner: THE WAR CHIEFTAIN! Undefeated. Unsubtle. Nine hundred pounds of clan royalty who personally signs for every delivery and personally flattens every visitor. The betting line on a frontal assault is so lopsided we have stopped printing it."),
        describe('He is between you and everything east of here. The patrols have not seen you yet. The engineer at the bench has, and has not raised an alarm. Interesting.'),
      ],
    ),
    // Reconcile the optional patrol: gone if fought, gone if Kivvi covered.
    ifFlag('combat:goblin_patrol:result', [disableHotspot('patrol')], [], 'victory'),
    ifFlag('goblin:covered', [disableHotspot('patrol')], []),
  ],
  exits: [
    {
      id: 'west',
      rect: { x: 0, y: 128, w: 8, h: 64 },
      targetRoom: 'r08_alcove',
      targetSpawn: { x: 288, y: 162 },
      facing: 'left',
    },
    {
      id: 'east',
      rect: { x: 312, y: 128, w: 8, h: 64 },
      targetRoom: 'r10_workshop',
      targetSpawn: { x: 30, y: 162 },
      facing: 'right',
    },
  ],
  actors: [
    {
      id: 'kivvi',
      label: 'KIVVI',
      color: '#9ec46a',
      sheet: kivviSheet,
      x: 176,
      y: 140,
      anim: 'idle_down',
      facing: 'down',
    },
  ],
  hotspots: [
    {
      id: 'kivvi',
      name: 'GOBLIN ENGINEER',
      rect: { x: 166, y: 118, w: 22, h: 26 },
      verbs: {
        look: [
          narrate('A goblin in a work apron, pierced everywhere piercings fit, elbow-deep in a copper engine. She is the only calm thing in the yard.'),
        ],
        talk: [startDialogue('kivvi')],
        hand: [
          say('kivvi', 'Tk! Hands are for YOUR machine, tall thing. Get one.'),
        ],
      },
    },
    {
      id: 'choppers',
      name: 'COPPER CHOPPERS',
      rect: { x: 40, y: 96, w: 70, h: 44 },
      verbs: {
        look: [
          narrate('Goblin steam-bikes, all copper pipe and menace, each with a waxed starter wick coiled on the flank. Pull cord, get fire. Noted.'),
        ],
        hand: [
          ifFlag(
            'r09.wick_taken',
            [narrate('The remaining wicks belong to bikes whose owners are armed. One was plenty.')],
            [
              walkPlayerTo(80, 150),
              setFlag('r09.wick_taken', true),
              narrate('You unspool a starter wick from the nearest chopper. Long, waxed, eager. The bike will forgive you. The owner is another matter.'),
              giveItem('fuse_wick'),
            ],
          ),
        ],
      },
    },
    {
      id: 'drip_pan',
      name: 'DRIP PAN',
      rect: { x: 118, y: 146, w: 30, h: 14 },
      verbs: {
        look: [
          narrate('A pan of engine grease under the lube rack, thick enough to stand a spoon in. Slow-burning, the label brags. SLOW-BURNING is a property.'),
        ],
        hand: [
          ifFlag(
            'r09.grease_taken',
            [narrate('You scraped the pan already. The residue has lawyered up.')],
            [
              walkPlayerTo(132, 166),
              setFlag('r09.grease_taken', true),
              narrate('You decant a tin of chopper grease, to the exact brim. A boat mechanic pours clean or not at all.'),
              giveItem('chopper_grease'),
            ],
          ),
        ],
      },
    },
    {
      id: 'patrol',
      name: 'GOBLIN PATROL',
      rect: { x: 236, y: 92, w: 50, h: 52 },
      verbs: {
        look: [
          narrate('Three goblins on a loop between you and the shop, spears taller than they are. Jumpy, not sharp. There may be a way around a fight.'),
        ],
        hand: [
          narrate('You step into the patrol path and wave. Goblin diplomacy recognizes exactly one gesture, and that is not it.'),
          startCombat('goblin_patrol'),
        ],
      },
    },
    {
      id: 'workshop_door',
      name: 'WORKSHOP GATE',
      rect: { x: 296, y: 90, w: 24, h: 62 },
      verbs: {
        look: [
          narrate('The workshop proper: forge-light through the seams, coal smoke off the roof, and stacked powder kegs visible through the gate. A building holding its breath.'),
        ],
      },
    },
  ],
  scaleBands: [
    { yTop: 108, yBottom: 120, scale: 0.8 },
    { yTop: 184, yBottom: 200, scale: 1.0 },
  ],
  // Art brief: the chopper yard - mismatched-copper steam bikes, a coal
  // stack to the ceiling, smoke haze, the workshop gate glowing at right.
  placeholderArtDraw: (ctx) => {
    // Coal stack reaching the ceiling, mid-left backdrop
    ctx.fillStyle = '#16130f';
    ctx.beginPath();
    ctx.moveTo(120, 106);
    ctx.lineTo(134, 8);
    ctx.lineTo(158, 4);
    ctx.lineTo(174, 106);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#241f18';
    for (const [cx2, cy2] of [[136, 30], [150, 18], [144, 56], [158, 44], [138, 80], [160, 74]] as const) {
      ctx.beginPath();
      ctx.arc(cx2, cy2, 5, 0, Math.PI * 2);
      ctx.fill();
    }
    // Parked copper choppers: two fat-piped bikes, different patinas
    const chopper = (bx: number, body: string, patina: string): void => {
      ctx.fillStyle = body;
      ctx.beginPath();
      ctx.ellipse(bx + 20, 116, 20, 8, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = patina;
      ctx.fillRect(bx + 6, 100, 8, 14);
      ctx.fillRect(bx + 26, 96, 6, 18);
      ctx.fillStyle = '#241a10';
      ctx.beginPath();
      ctx.arc(bx + 6, 122, 6, 0, Math.PI * 2);
      ctx.arc(bx + 34, 122, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = body;
      ctx.fillRect(bx + 14, 92, 3, 10);
    };
    chopper(38, '#b06a3a', '#5f8a70');
    chopper(78, '#8f5228', '#74a184');
    // Strewn engineering supplies: cogs, wire spools, a powder sack
    ctx.fillStyle = '#c9a05a';
    ctx.beginPath();
    ctx.arc(126, 148, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#7a5638';
    ctx.fillRect(196, 150, 10, 7);
    ctx.fillStyle = '#8f8f96';
    ctx.beginPath();
    ctx.arc(214, 154, 4, 0, Math.PI * 2);
    ctx.fill();
    // The workshop gate: forge light through the seams, far right
    ctx.fillStyle = '#2a2018';
    ctx.fillRect(294, 84, 26, 68);
    const seam = ctx.createLinearGradient(294, 0, 320, 0);
    seam.addColorStop(0, 'rgba(255,140,50,0)');
    seam.addColorStop(1, 'rgba(255,140,50,0.5)');
    ctx.fillStyle = seam;
    ctx.fillRect(294, 84, 26, 68);
    ctx.fillStyle = '#ff9a4a';
    ctx.fillRect(306, 88, 2, 60);
    // Smoke drifting off the yard
    ctx.fillStyle = 'rgba(40,32,26,0.4)';
    for (const [mx2, my2, mw2] of [[60, 40, 70], [150, 26, 90], [240, 48, 60]] as const) {
      ctx.beginPath();
      ctx.ellipse(mx2, my2, mw2 / 2, 8, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  },
  placeholderMaskDraw: (ctx) => {
    ctx.fillStyle = '#000000';
    ctx.fillRect(36, 106, 80, 24); // parked choppers
    ctx.fillRect(112, 118, 44, 10); // lube rack
  },
};
