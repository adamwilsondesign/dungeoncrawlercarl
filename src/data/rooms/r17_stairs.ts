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
  placeholderMaskDraw: (ctx) => {
    ctx.fillStyle = '#000000';
    ctx.fillRect(172, 132, 44, 14); // the cart
    ctx.fillRect(244, 118, 66, 12); // stairhead rail
  },
};
