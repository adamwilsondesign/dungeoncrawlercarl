/**
 * R13 - Meadow Lark: the drawbridge encampment and the recruitment hub. No
 * combat. Five named crew members with dialogue trees; the drawbridge gate
 * musters the raid once all four fighters are committed (nested ifFlag
 * chain -> raid:formed + achievement + east exit opens). Rest booth echoes
 * the MoonBurger conventions (narrative heal + autosave checkpoint).
 */

import {
  autosave,
  awardAchievement,
  disableExit,
  enableExit,
  ifFlag,
  narrate,
  say,
  setFlag,
  startDialogue,
} from '../script';
import type { ActorDef, RoomDef, SpriteSheetDef } from '../types';

const person = (
  id: string,
  label: string,
  color: string,
  sprite: string,
  x: number,
  y: number,
  frameW = 24,
  frameH = 32,
): ActorDef => {
  const sheet: SpriteSheetDef = {
    path: sprite,
    frameW,
    frameH,
    mirrorLeft: true,
    anims: {
      idle_down: { frames: [0], frameMs: 400, loop: true },
      idle_up: { frames: [3], frameMs: 400, loop: true },
      idle_right: { frames: [6], frameMs: 400, loop: true },
    },
  };
  return { id, label, color, sheet, x, y, anim: 'idle_down', facing: 'down' };
};

export const r13_meadowlark: RoomDef = {
  id: 'r13_meadowlark',
  label: 'MEADOW LARK',
  backgroundPath: 'backgrounds/r13_meadowlark.png',
  backgroundMood: 'safe',
  walkmaskPath: 'masks/r13_meadowlark.png',
  playerSpawn: { x: 30, y: 162, facing: 'right' },
  onEnter: [
    // First-visit establishing beat (P10: Act III's hub opens here).
    ifFlag(
      'seen:r13',
      [],
      [
        setFlag('seen:r13', true),
        narrate('The corridor ends at a moat, a raised drawbridge, and - of all the things this floor could have built - a camp that smells like soup. Cook fires. Laundry lines. Someone laughing, on purpose, out loud.'),
        narrate('This is Meadow Lark: a whole elderly-care home\'s worth of survivors, brought down the stairs by the night-shift workers who refused to leave them. They have held this bridge since the first night. The stairs to Floor Two are somewhere past it - and something out there is keeping every one of these people penned in.'),
      ],
    ),
    ifFlag('raid:formed', [enableExit('east')], [disableExit('east')]),
  ],
  exits: [
    {
      id: 'west',
      rect: { x: 0, y: 128, w: 8, h: 64 },
      targetRoom: 'r12_east',
      targetSpawn: { x: 288, y: 162 },
      facing: 'left',
    },
    {
      id: 'east',
      rect: { x: 312, y: 128, w: 8, h: 64 },
      targetRoom: 'r14_gym',
      targetSpawn: { x: 30, y: 162 },
      facing: 'right',
    },
  ],
  actors: [
    person('brandon', 'BRANDON', '#5a8ac4', 'sprites/brandon_an.png', 150, 128),
    person('chris', 'CHRIS', '#8a92a8', 'sprites/chris_andrews.png', 196, 120),
    person('yolanda', 'YOLANDA', '#c4785a', 'sprites/yolanda_martinez.png', 108, 140, 22, 28),
    person('imani', 'IMANI', '#7a5ac4', 'sprites/imani_c.png', 236, 134, 20, 32),
    person('agatha', 'AGATHA', '#c4b05a', 'sprites/agatha.png', 66, 128, 22, 28),
  ],
  hotspots: [
    {
      id: 'brandon',
      name: 'BRANDON AN',
      rect: { x: 140, y: 100, w: 24, h: 30 },
      verbs: {
        look: [narrate('The spokesman: steady hands, tired eyes, a lanyard he never took off. The camp orbits him without him asking it to.')],
        talk: [startDialogue('brandon')],
      },
    },
    {
      id: 'chris',
      name: 'CHRIS ANDREWS',
      rect: { x: 186, y: 92, w: 24, h: 30 },
      verbs: {
        look: [narrate('Quiet man, metal skullcap, no weapon anywhere on him. The trogs give this camp a wide berth. You suspect these facts are related.')],
        talk: [startDialogue('chris')],
      },
    },
    {
      id: 'yolanda',
      name: 'YOLANDA MARTINEZ',
      rect: { x: 98, y: 114, w: 24, h: 28 },
      verbs: {
        look: [narrate('Scrubs, sensible shoes, a bow taller than she is, and a quiver so overloaded it nearly drags. She dares you to comment. You do not.')],
        talk: [startDialogue('yolanda')],
      },
    },
    {
      id: 'imani',
      name: 'IMANI C',
      rect: { x: 226, y: 106, w: 22, h: 30 },
      verbs: {
        look: [narrate('Young, rail-thin, scrubs under a cloak that eats the light, longsword worn like it grew there. The camp is gentle with her. The floor was not.')],
        talk: [startDialogue('imani')],
      },
    },
    {
      id: 'agatha',
      name: 'AGATHA',
      rect: { x: 54, y: 102, w: 26, h: 28 },
      verbs: {
        look: [narrate('Seventy if a day, scarves beyond census, red trapper hat. Her shopping cart is packed like a museum of a life, crowned by a pink flamingo with an arrow through it.')],
        talk: [startDialogue('agatha')],
        hand: [say('agatha', 'HAND. I see a HAND near my cart. Reconsider the hand.')],
      },
    },
    {
      id: 'cart',
      name: 'THE CART',
      rect: { x: 40, y: 128, w: 30, h: 22 },
      verbs: {
        look: [narrate('Blankets, jar candles, a chess set, one pink flamingo (wounded, dignified). It is a barricade, a pantry, and a memory palace on four good wheels.')],
        hand: [say('agatha', 'WHEELS STAY ON THE GROUND AND HANDS STAY OFF THE CART. This is camp law, crawler.')],
      },
    },
    {
      id: 'residents',
      name: 'RESIDENTS',
      rect: { x: 120, y: 158, w: 80, h: 24 },
      verbs: {
        look: [narrate('A dozen elderly survivors around a cook fire, bundled and bickering over a card game with invented rules. Somebody kept all of them alive. On purpose. Nightly.')],
        talk: [narrate('You get three hellos, one wolf whistle, and a firm correction about where you are standing. It is the warmest room on this floor.')],
      },
    },
    {
      id: 'booth',
      name: 'REST CORNER',
      rect: { x: 262, y: 150, w: 40, h: 26 },
      verbs: {
        look: [narrate('Folded blankets by the fire wall, reserved for guests. On this floor, that word is a miracle of civil engineering.')],
        hand: [
          narrate('You sleep an honest sleep between watch shifts. Wounds knit. The night shift keeps the night. PROGRESS RECORDED.'),
          autosave(),
          say('donut', 'Wake me only for meals or coronations.'),
        ],
      },
    },
    {
      id: 'gate',
      name: 'DRAWBRIDGE GATE',
      rect: { x: 288, y: 92, w: 32, h: 56 },
      verbs: {
        look: [
          ifFlag(
            'raid:formed',
            [narrate('The bridge is down for the raid. Past it: the gym, the ring, and the thing that rolls between everyone here and the stairs.')],
            [narrate('The drawbridge to the gym district. Brandon keeps it up: the stairs beyond are boss-guarded, and nobody crosses alone. A crew could.')],
          ),
        ],
        hand: [
          ifFlag(
            'raid:formed',
            [narrate('The bridge is already down. The raid is waiting on its cook.')],
            [
              ifFlag(
                'ally:brandon',
                [
                  ifFlag(
                    'ally:chris',
                    [
                      ifFlag(
                        'ally:yolanda',
                        [
                          ifFlag(
                            'ally:imani',
                            [
                              setFlag('raid:formed', true),
                              awardAchievement('night_shift'),
                              narrate('Brandon drops the bridge. Four night-shifters fall in behind a cook and a cat. RAID REGISTERED: THE ROYAL COURT AND THE NIGHT SHIFT.'),
                              say('donut', 'Adequate. We march at MY pace, which is a saunter.'),
                              enableExit('east'),
                            ],
                            [narrate('Imani has not committed. The raid needs her lane covered - talk to her.')],
                          ),
                        ],
                        [narrate('Yolanda has not signed on. The raid needs a medic who shoots back - talk to her.')],
                      ),
                    ],
                    [narrate('Chris is not in yet. The raid wants whatever is under that cap - talk to him.')],
                  ),
                ],
                [narrate('The bridge stays up until a crew exists. Start with Brandon - the camp follows his lead.')],
              ),
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
  placeholderMaskDraw: (ctx) => {
    ctx.fillStyle = '#000000';
    ctx.fillRect(36, 118, 40, 16); // the cart
    ctx.fillRect(116, 146, 90, 10); // cook fire circle
  },
};
