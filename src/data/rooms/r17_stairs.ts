/**
 * R17 - the stairwell to Floor 2: the finale. act3_finale plays on entry
 * (loot ceremony, the crew, Agatha's cart payoff, completion achievement);
 * the STAIRS DOWN hotspot then plays act3_credits, which ends the demo and
 * unwinds to the title screen. No Floor 2 content - this is the closer.
 */

import { ifFlag, narrate, playCutscene, say } from '../script';
import type { RoomDef } from '../types';

export const r17_stairs: RoomDef = {
  id: 'r17_stairs',
  label: 'THE STAIRS DOWN',
  backgroundPath: 'backgrounds/r17_stairs.png',
  backgroundMood: 'safe',
  walkmaskPath: 'masks/r17_stairs.png',
  playerSpawn: { x: 30, y: 162, facing: 'right' },
  onEnter: [playCutscene('act3_finale')],
  exits: [
    {
      id: 'west',
      rect: { x: 0, y: 128, w: 8, h: 64 },
      targetRoom: 'r16_ring',
      targetSpawn: { x: 288, y: 162 },
      facing: 'left',
    },
  ],
  actors: [],
  hotspots: [
    {
      id: 'crew',
      name: 'THE CREW',
      rect: { x: 70, y: 100, w: 90, h: 44 },
      verbs: {
        look: [
          narrate('The night shift works the stairhead like a hospital hallway: count, steady, pass down, count again. Nobody taught them raid logistics. Nights taught them.'),
        ],
        talk: [
          say('carl', 'See you all on Two. First round of whatever Floor Two calls coffee is on me.'),
        ],
      },
    },
    {
      id: 'cart_payoff',
      name: 'THE CART',
      rect: { x: 178, y: 122, w: 34, h: 26 },
      verbs: {
        look: [
          ifFlag(
            'agatha:cart_promised',
            [narrate('The cart, mission-complete: every wheel on, blankets squared, Herbert the flamingo riding point with his arrow like a lance. Contract honored.')],
            [narrate("Agatha's cart waits at the stairhead, packed and defiant. Herbert the flamingo surveys the descent, arrow and all. He has survived worse.")],
          ),
        ],
        hand: [
          say('agatha', 'Hands OFF - no. Hm. Fine. You may steady the front end, crawler. You have earned the front end.'),
        ],
      },
    },
    {
      id: 'stairs',
      name: 'STAIRS DOWN',
      rect: { x: 246, y: 84, w: 60, h: 70 },
      verbs: {
        look: [
          narrate('The stairs to Floor Two, open at last, breathing warm air and worse promises. THE EXIT IS PROVIDED FREE OF CHARGE. WE REMAIN GENEROUS.'),
        ],
        hand: [
          narrate('One floor down. Seventeen to go. The audience leans forward all at once, everywhere, like weather.'),
          playCutscene('act3_credits'),
        ],
      },
    },
  ],
  scaleBands: [
    { yTop: 108, yBottom: 120, scale: 0.85 },
    { yTop: 184, yBottom: 200, scale: 1.0 },
  ],
  // Art brief: the earned staircase - doors open on warm light going down
  // (echoing R02), loot strewn about, the cart at the stairhead.
  placeholderArtDraw: (ctx) => {
    // The opened stairwell: warm light flooding out of the descent
    ctx.fillStyle = '#31353a';
    ctx.fillRect(244, 30, 70, 96);
    const well = ctx.createLinearGradient(0, 30, 0, 126);
    well.addColorStop(0, 'rgba(255,220,140,0.25)');
    well.addColorStop(1, 'rgba(255,200,100,0.9)');
    ctx.save();
    ctx.beginPath();
    ctx.rect(250, 36, 58, 88);
    ctx.clip();
    ctx.fillStyle = '#1c150c';
    ctx.fillRect(250, 36, 58, 88);
    ctx.fillStyle = well;
    ctx.fillRect(250, 36, 58, 88);
    // Steps descending into the glow
    for (let i = 0; i < 7; i++) {
      const t = i / 6;
      ctx.fillStyle = `rgba(40,26,12,${0.8 - t * 0.5})`;
      ctx.fillRect(254 + t * 8, 44 + i * 11, 50 - t * 16, 4);
    }
    ctx.restore();
    const spill = ctx.createRadialGradient(278, 126, 6, 278, 126, 80);
    spill.addColorStop(0, 'rgba(255,210,120,0.5)');
    spill.addColorStop(1, 'rgba(255,210,120,0)');
    ctx.fillStyle = spill;
    ctx.fillRect(198, 90, 160, 110);
    // Loot strewn across the platform: coins, a shield, an open crate
    ctx.fillStyle = '#ffd166';
    for (const [gx2, gy2] of [[126, 148], [142, 156], [118, 162], [160, 150], [200, 164]] as const) {
      ctx.fillRect(gx2, gy2, 3, 2);
    }
    ctx.fillStyle = '#7a8a9a';
    ctx.beginPath();
    ctx.ellipse(98, 150, 9, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#5c4a2a';
    ctx.fillRect(60, 140, 22, 14);
    ctx.fillStyle = '#3d2f18';
    ctx.fillRect(60, 138, 22, 4);
    // The cart, parked at the stairhead, flamingo riding point
    ctx.fillStyle = '#8a8a90';
    ctx.fillRect(176, 122, 34, 15);
    ctx.fillStyle = '#241f18';
    ctx.beginPath();
    ctx.arc(182, 138, 4, 0, Math.PI * 2);
    ctx.arc(202, 138, 4, 0, Math.PI * 2);
    ctx.fill();
    for (const [bx4, bc3] of [[178, '#c47a7a'], [188, '#7a9ac4'], [198, '#d8cdb4']] as const) {
      ctx.fillStyle = bc3;
      ctx.fillRect(bx4, 116, 9, 7);
    }
    ctx.fillStyle = '#ff8ab4';
    ctx.fillRect(196, 100, 3, 16);
    ctx.beginPath();
    ctx.ellipse(200, 100, 6, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#6b5228';
    ctx.beginPath();
    ctx.moveTo(192, 96);
    ctx.lineTo(208, 104);
    ctx.stroke();
  },
  placeholderMaskDraw: (ctx) => {
    ctx.fillStyle = '#000000';
    ctx.fillRect(172, 132, 44, 14); // the cart
    ctx.fillRect(244, 118, 66, 12); // stairhead rail
  },
};
