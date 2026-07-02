/**
 * R10 - the workshop interior: the chain-reaction puzzle (the demo's
 * centerpiece). Recipe: fuse_wick + black_powder -> powder_charge;
 * powder_charge + chopper_grease -> primed_charge (combines system); then
 * PLACE: primed_charge on the coal cart, HAND the cart to roll it down the
 * rail to the boss door, flint_striker on the delivered cart -> DETONATION.
 * Funny recoverable deaths: striker on the keg wall, striker on the primed
 * cart before delivery, striker+powder combines in the inventory.
 * The head-on option (HAND the iron door, twice) is the overwhelming
 * steer-to-death encounter. onEnter reconciles every stage for saves.
 */

import {
  awardAchievement,
  disableExit,
  disableHotspot,
  enableExit,
  enableHotspot,
  giveGold,
  giveItem,
  ifFlag,
  killPlayer,
  moveActor,
  narrate,
  playCutscene,
  say,
  setFlag,
  sfxCue,
  startCombat,
  takeItem,
  walkPlayerTo,
} from '../script';
import type { RoomDef } from '../types';

export const r10_workshop: RoomDef = {
  id: 'r10_workshop',
  label: 'THE WORKSHOP',
  backgroundPath: 'backgrounds/r10_workshop.png',
  backgroundMood: 'workshop',
  walkmaskPath: 'masks/r10_workshop.png',
  playerSpawn: { x: 30, y: 162, facing: 'right' },
  onEnter: [
    ifFlag(
      'chieftain:detonated',
      [
        disableHotspot('boss_door'),
        disableHotspot('cart'),
        disableHotspot('cart_door'),
        disableHotspot('kegs'),
        enableExit('east'),
        ifFlag('r10.strongbox_looted', [disableHotspot('strongbox')], []),
      ],
      [
        disableExit('east'),
        disableHotspot('strongbox'),
        ifFlag(
          'r10.cart_placed',
          [disableHotspot('cart')],
          [disableHotspot('cart_door')],
        ),
      ],
    ),
  ],
  exits: [
    {
      id: 'west',
      rect: { x: 0, y: 128, w: 8, h: 64 },
      targetRoom: 'r09_approach',
      targetSpawn: { x: 288, y: 162 },
      facing: 'left',
    },
    {
      id: 'east',
      rect: { x: 312, y: 128, w: 8, h: 64 },
      targetRoom: 'r11_aftermath',
      targetSpawn: { x: 30, y: 162 },
      facing: 'right',
    },
  ],
  actors: [],
  hotspots: [
    {
      id: 'kegs',
      name: 'POWDER KEGS',
      rect: { x: 36, y: 84, w: 56, h: 52 },
      verbs: {
        look: [
          narrate('Kegs to the rafters, stenciled NO SPARK, NO FLAME, NO EXCEPTIONS. Enough powder to promote this floor to the one above it.'),
        ],
        hand: [
          ifFlag(
            'r10.keg_taken',
            [narrate('One keg is a plan. Two kegs is a confession. You leave the rest.')],
            [
              walkPlayerTo(70, 146),
              setFlag('r10.keg_taken', true),
              narrate('You lift a carry-size keg with the tenderness of a man holding his own obituary.'),
              giveItem('black_powder'),
            ],
          ),
        ],
        item: {
          flint_striker: [
            narrate('You raise the striker to the keg wall for a closer look. In a powder room. THE AUDIENCE COVERS ITS EARS.'),
            sfxCue('detonation_1'),
            killPlayer('CAUSE OF DEATH: READING THE STENCIL AFTERWARD. It said NO EXCEPTIONS, Crawler. You were not one.'),
          ],
          default: [
            narrate('The kegs decline your offering. They have one job and one diet.'),
          ],
        },
      },
    },
    {
      id: 'cart',
      name: 'COAL CART',
      rect: { x: 150, y: 118, w: 42, h: 30 },
      verbs: {
        look: [
          ifFlag(
            'r10.cart_primed',
            [narrate('The cart sits on the delivery rail, charge nested in the coal like a very committed egg. The rail runs straight to the iron door.')],
            [narrate('A coal cart on the delivery rail. The rail runs the length of the shop and dead-ends at the boss door. He hates waiting for coal, Kivvi said.')],
          ),
        ],
        hand: [
          ifFlag(
            'r10.cart_primed',
            [
              walkPlayerTo(170, 156),
              setFlag('r10.cart_placed', true),
              setFlag('r10.cart_primed', false),
              disableHotspot('cart'),
              enableHotspot('cart_door'),
              sfxCue('cart_roll'),
              narrate('You lean into the cart. It rolls the rail like it has been rehearsing, and parks against the iron door with a polite, damning clunk.'),
              say('donut', 'Delivery placed, Carl. Now the part where we are ELSEWHERE.'),
            ],
            [
              narrate('You shove the cart a foot and stop. Unloaded effort. If this cart is going to his door, it should be carrying more than coal.'),
            ],
          ),
        ],
        item: {
          primed_charge: [
            walkPlayerTo(170, 156),
            takeItem('primed_charge'),
            setFlag('r10.cart_primed', true),
            awardAchievement('chemist'),
            narrate('You bed the primed charge deep in the coal, fuse trailing off the back like a pull cord. It looks like a delivery. It is.'),
          ],
          powder_charge: [
            narrate('You hover the bare charge over the coal, then reconsider. Naked powder burns fast and rude - it would fizzle or flash. It wants something slow and hot on it first.'),
          ],
          black_powder: [
            narrate('A whole keg, loose on a coal pile, no fuse. Even the audience is shaking its collective head. Build it properly, Crawler.'),
          ],
          flint_striker: [
            ifFlag(
              'r10.cart_primed',
              [
                narrate('You spark the fuse while the cart is parked next to you. The delivery arrives at YOUR address.'),
                sfxCue('detonation_1'),
                killPlayer('CAUSE OF DEATH: STANDING AT THE WRONG END OF LOGISTICS. Ship it FIRST, Crawler. Then light it.'),
              ],
              [narrate('You could ignite the coal. Give it an afternoon and a bellows and it might glow. The dungeon admires the patience, not the plan.')],
            ),
          ],
          default: [
            narrate('The cart hauls coal and consequences. That is neither.'),
          ],
        },
      },
    },
    {
      id: 'cart_door',
      name: 'DELIVERED CART',
      rect: { x: 262, y: 106, w: 40, h: 34 },
      verbs: {
        look: [
          narrate('The cart sits flush against the iron door, fuse trailing back along the rail. One spark, one signature. He always signs personally.'),
        ],
        hand: [
          narrate('It is exactly where it needs to be. Touch nothing. Spark something.'),
        ],
        item: {
          flint_striker: [
            walkPlayerTo(240, 162),
            narrate('You crouch at the end of the fuse, strike once, and walk away like a professional. Never run. Running spoils the shot.'),
            moveActor('player', 60, 166, { speed: 80 }),
            playCutscene('act2_detonation'),
          ],
          default: [
            narrate('The delivery is complete. It is waiting on one very specific signature.'),
          ],
        },
      },
    },
    {
      id: 'fuel_line',
      name: 'FUEL LINE',
      rect: { x: 100, y: 60, w: 120, h: 12 },
      verbs: {
        look: [
          narrate('A copper fuel line feeds the forge, bracketed along the wall - and right past the boss door. Whoever plumbed this shop loved convenience more than tomorrow.'),
        ],
        hand: [
          narrate('The line is hot, pressurized, and load-bearing to your plan. You leave it exactly as wrong as you found it.'),
        ],
      },
    },
    {
      id: 'forge',
      name: 'THE FORGE',
      rect: { x: 226, y: 76, w: 34, h: 40 },
      verbs: {
        look: [
          narrate('The clan forge, banked and breathing. It eats the fuel line all day and complains anyway. Industrial. Ancestral. Extremely flammable-adjacent.'),
        ],
        hand: [
          narrate('You hold a palm to the forge and retract it with your eyebrows intact. Barely. The dungeon logs a WISDOM check: passed, narrowly.'),
        ],
      },
    },
    {
      id: 'boss_door',
      name: 'IRON DOOR',
      rect: { x: 296, y: 88, w: 24, h: 60 },
      verbs: {
        look: [
          narrate('An iron door with hinges like knuckles. Behind it, something walks in circles and hums war songs off-key. The coal rail dead-ends against it.'),
        ],
        talk: [
          narrate('You knock. The humming stops. A voice like a rockslide says one word: DELIVERY? You decline to answer. It resumes humming.'),
        ],
        hand: [
          ifFlag(
            'chieftain:warned',
            [
              narrate('Very well. THE DUNGEON LOGS THIS AS PERFORMANCE ART.'),
              startCombat('war_chieftain_lair'),
            ],
            [
              setFlag('chieftain:warned', true),
              narrate('Your hand is on the latch. WARNING: THE OCCUPANT BENCH-PRESSES CARTS. POLLING SUGGESTS: BE THE DELIVERY, NOT THE MEAL.'),
              say('donut', 'Carl. The room is FULL of powder and you own a spark. Must the cat draw a diagram.'),
            ],
          ),
        ],
      },
    },
    {
      id: 'strongbox',
      name: 'SCORCHED STRONGBOX',
      rect: { x: 200, y: 128, w: 32, h: 24 },
      verbs: {
        look: [
          narrate("The chieftain's strongbox, blown clear and barely dented. Built to survive him. It did, technically."),
        ],
        hand: [
          ifFlag(
            'r10.strongbox_looted',
            [narrate('Empty. You checked twice. The audience saw both times.')],
            [
              walkPlayerTo(214, 160),
              setFlag('r10.strongbox_looted', true),
              narrate('Inside: clan payroll, a machinist-grade wrench, and a set of fitted claw caps sized for no goblin that ever lived.'),
              giveGold(60),
              giveItem('goblin_wrench'),
              giveItem('chrome_talons'),
              giveItem('coal_chunk'),
              giveItem('coal_chunk'),
              say('donut', 'Fitted TALONS. At last, this floor produces a tribute worthy of the court. Equip me, Carl. Gently.'),
            ],
          ),
        ],
      },
    },
  ],
  scaleBands: [
    { yTop: 108, yBottom: 120, scale: 0.85 },
    { yTop: 184, yBottom: 200, scale: 1.0 },
  ],
  // Art brief: the forge workshop - keg wall, coal-cart rail dead-ending at
  // the iron door, fuel line, forge fire and welding sparks. Everything
  // here is the puzzle's stage.
  placeholderArtDraw: (ctx) => {
    // Keg wall, left: stacked barrels with warning bands
    for (let row = 0; row < 3; row++) {
      for (let col = 0; col < 3 - (row % 2); col++) {
        const kx = 36 + col * 20 + (row % 2) * 10;
        const ky = 96 - row * 18;
        ctx.fillStyle = '#4a3418';
        ctx.beginPath();
        ctx.roundRect(kx, ky, 17, 17, 3);
        ctx.fill();
        ctx.fillStyle = '#c43a3a';
        ctx.fillRect(kx, ky + 6, 17, 4);
        ctx.fillStyle = '#241a0c';
        ctx.fillRect(kx, ky + 2, 17, 1);
        ctx.fillRect(kx, ky + 13, 17, 1);
      }
    }
    // Fuel line along the wall, bracketed, running toward the boss door
    ctx.fillStyle = '#8f5a2a';
    ctx.fillRect(100, 62, 196, 4);
    ctx.fillStyle = '#5c3a18';
    for (let x = 108; x < 296; x += 24) ctx.fillRect(x, 60, 3, 8);
    // The forge: banked fire under a hood
    ctx.fillStyle = '#241c14';
    ctx.fillRect(224, 70, 38, 46);
    ctx.fillStyle = '#171009';
    ctx.fillRect(228, 90, 30, 22);
    const forge = ctx.createRadialGradient(243, 106, 2, 243, 106, 24);
    forge.addColorStop(0, 'rgba(255,190,80,0.95)');
    forge.addColorStop(0.5, 'rgba(255,110,40,0.6)');
    forge.addColorStop(1, 'rgba(255,110,40,0)');
    ctx.fillStyle = forge;
    ctx.fillRect(220, 84, 46, 34);
    // Welding sparks
    ctx.fillStyle = '#ffe9a8';
    for (const [px2, py2] of [[250, 78], [256, 84], [246, 70], [262, 74]] as const) {
      ctx.fillRect(px2, py2, 2, 2);
    }
    // The rail: from the cart across the floor to the iron door
    ctx.fillStyle = '#3a3230';
    ctx.fillRect(150, 138, 160, 3);
    ctx.fillRect(150, 145, 160, 3);
    ctx.fillStyle = '#2a2422';
    for (let x = 154; x < 308; x += 12) ctx.fillRect(x, 136, 3, 14);
    // The coal cart on the rail
    ctx.fillStyle = '#43362a';
    ctx.fillRect(152, 118, 40, 22);
    ctx.fillStyle = '#16130f';
    ctx.beginPath();
    ctx.ellipse(172, 118, 18, 6, 0, Math.PI, 0);
    ctx.fill();
    ctx.fillStyle = '#241f18';
    ctx.beginPath();
    ctx.arc(160, 142, 5, 0, Math.PI * 2);
    ctx.arc(184, 142, 5, 0, Math.PI * 2);
    ctx.fill();
    // The iron door, right: hinges like knuckles, rail dead-ends against it
    ctx.fillStyle = '#33302e';
    ctx.fillRect(294, 76, 26, 76);
    ctx.fillStyle = '#26221f';
    ctx.fillRect(298, 80, 18, 68);
    ctx.fillStyle = '#4a4542';
    for (const hy of [88, 110, 132]) ctx.fillRect(294, hy, 8, 6);
  },
  placeholderMaskDraw: (ctx) => {
    ctx.fillStyle = '#000000';
    ctx.fillRect(30, 108, 66, 28); // keg wall footprint
    ctx.fillRect(222, 108, 42, 10); // forge apron
  },
};
