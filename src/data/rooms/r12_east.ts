/**
 * R12 — the east corridors: Frank & Maggie's confrontation and the
 * reverse-trap. The pair telegraph their ambush at the narrow cut; the
 * player reuses the R10 explosive grammar (trip cord + powder pouch ->
 * tripline charge, placed at the chokepoint) and springs it on THEM via
 * the act3_trap cutscene. Proceeding unprotected after the threat is a
 * recoverable death. The east exit opens only after the trap resolves.
 */

import {
  despawnActor,
  disableExit,
  enableExit,
  giveItem,
  ifFlag,
  killPlayer,
  narrate,
  playCutscene,
  setFlag,
  startDialogue,
  takeItem,
  walkPlayerTo,
} from '../script';
import type { RoomDef, SpriteSheetDef } from '../types';

const crawlerSheet = (path: string): SpriteSheetDef => ({
  path,
  frameW: 24,
  frameH: 32,
  mirrorLeft: true,
  anims: {
    idle_down: { frames: [0], frameMs: 400, loop: true },
    idle_up: { frames: [3], frameMs: 400, loop: true },
    idle_right: { frames: [6], frameMs: 400, loop: true },
  },
});

export const r12_east: RoomDef = {
  id: 'r12_east',
  label: 'EAST CORRIDORS',
  backgroundPath: 'backgrounds/r12_east.png',
  backgroundMood: 'dungeon',
  walkmaskPath: 'masks/r12_east.png',
  playerSpawn: { x: 30, y: 162, facing: 'right' },
  onEnter: [
    // The pair leave for their ambush spot once threatened; the exit stays
    // shut until the trap beat resolves them.
    ifFlag('frank:met', [despawnActor('frank'), despawnActor('maggie')], []),
    ifFlag('scene:act3_trap:played', [enableExit('east')], [disableExit('east')]),
  ],
  exits: [
    {
      id: 'west',
      rect: { x: 0, y: 128, w: 8, h: 64 },
      targetRoom: 'r11_aftermath',
      targetSpawn: { x: 288, y: 162 },
      facing: 'left',
    },
    {
      id: 'east',
      rect: { x: 312, y: 128, w: 8, h: 64 },
      targetRoom: 'r13_meadowlark',
      targetSpawn: { x: 30, y: 162 },
      facing: 'right',
    },
  ],
  actors: [
    {
      id: 'frank',
      label: 'FRANK Q',
      color: '#a05a5a',
      sheet: crawlerSheet('sprites/frank_q.png'),
      x: 190,
      y: 132,
      anim: 'idle_down',
      facing: 'down',
    },
    {
      id: 'maggie',
      label: 'MAGGIE MY',
      color: '#c47a9e',
      sheet: crawlerSheet('sprites/maggie_my.png'),
      x: 214,
      y: 138,
      anim: 'idle_down',
      facing: 'down',
    },
  ],
  hotspots: [
    {
      id: 'pair',
      name: 'TWO CRAWLERS',
      rect: { x: 182, y: 104, w: 46, h: 40 },
      verbs: {
        look: [
          ifFlag(
            'frank:met',
            [narrate('Gone. People who announce where they will ambush you are either stupid or certain. Assume certain.')],
            [narrate('Two crawlers, well-fed and well-armed, watching you the way a ledger watches a debt. Matching smiles. Nothing else about them matches.')],
          ),
        ],
        talk: [
          ifFlag(
            'frank:met',
            [narrate('They are gone east. You know exactly where they are waiting. That was the point of the conversation.')],
            [startDialogue('frank_maggie')],
          ),
        ],
      },
    },
    {
      id: 'cache',
      name: "MINER'S CACHE",
      rect: { x: 62, y: 132, w: 28, h: 20 },
      verbs: {
        look: [
          narrate('A dead miner\'s belt kit, tucked in a wall nook. The floor keeps stocking these. The floor knows its audience.'),
        ],
        hand: [
          ifFlag(
            'r12.cache_taken',
            [narrate('The nook has nothing left but dust with a history.')],
            [
              walkPlayerTo(78, 158),
              setFlag('r12.cache_taken', true),
              narrate('You take the powder pouch. Your hands do the math before you ask them to. R10 changed you.'),
              giveItem('powder_pouch'),
            ],
          ),
        ],
      },
    },
    {
      id: 'sign',
      name: 'FALLEN SIGN',
      rect: { x: 128, y: 96, w: 44, h: 22 },
      verbs: {
        look: [
          narrate('A collapsed transit sign, still cabled to the wall. MEADOW LARK - NEXT RIGHT, it says, under forty years of grime and one new arrow of blood. Encouraging.'),
        ],
        hand: [
          ifFlag(
            'r12.cord_taken',
            [narrate('You stripped the useful cable already. The sign continues to point, undaunted.')],
            [
              walkPlayerTo(150, 150),
              setFlag('r12.cord_taken', true),
              narrate('You strip a length of braided cable from the mount. Ankle height, tension, narrow space. The recipe writes itself now.'),
              giveItem('trip_cord'),
            ],
          ),
        ],
      },
    },
    {
      id: 'chokepoint',
      name: 'NARROW CUT',
      rect: { x: 258, y: 96, w: 46, h: 56 },
      verbs: {
        look: [
          ifFlag(
            'r12.trap_set',
            [narrate('The cut, now with a welcome mat strung at ankle height. It looks like nothing. That is the compliment.')],
            [narrate('The corridor pinches to shoulder width before the bridge - the only way east. A terrible place to be surprised in. Somebody said so, smiling.')],
          ),
        ],
        hand: [
          ifFlag(
            'r12.trap_set',
            [
              // Walking the cut with the trap armed: spring it on THEM.
              playCutscene('act3_trap'),
            ],
            [
              ifFlag(
                'frank:met',
                [
                  narrate('You start into the cut with nothing prepared. The footsteps behind you are polite enough to wait for the narrow part.'),
                  killPlayer('CAUSE OF DEATH: WALKING INTO THE ADVERTISED AMBUSH. They TOLD you where, Crawler. Set a welcome mat next time.'),
                ],
                [
                  narrate('The cut runs east toward the bridge. Something about it makes your neck itch. Perhaps ask the locals before threading a needle.'),
                ],
              ),
            ],
          ),
        ],
        item: {
          tripline_charge: [
            walkPlayerTo(270, 158),
            takeItem('tripline_charge'),
            setFlag('r12.trap_set', true),
            narrate('You string the tripline at ankle height and pack the charge at the anchor stone. Invisible at a walk. Educational at a run.'),
          ],
          default: [
            narrate('The cut needs a TRAP, not a donation. Think like the people hunting you.'),
          ],
        },
      },
    },
  ],
  scaleBands: [
    { yTop: 108, yBottom: 120, scale: 0.8 },
    { yTop: 184, yBottom: 200, scale: 1.0 },
  ],
  placeholderMaskDraw: (ctx) => {
    ctx.fillStyle = '#000000';
    ctx.fillRect(56, 108, 40, 20); // wall nook shelf
    ctx.fillRect(122, 108, 56, 8); // sign mount
  },
};
