/**
 * r00_test - engine proving ground: irregular walkable area, a blocked pillar
 * mid-room, a narrow corridor along the right that climbs above the floor
 * line, looping edge exits, one NPC, 0.6→1.0 depth scale bands, and a set of
 * hotspots exercising the full P2 interface surface (LOOK-only, two-verb
 * flag-driven state change, flag-enabled hotspot, polygon hit-testing,
 * multi-box narration, and NPC talk).
 */

import {
  announce,
  awardAchievement,
  describe,
  enableHotspot,
  facePlayer,
  giveItem,
  ifFlag,
  killPlayer,
  narrate,
  notify,
  playCutscene,
  say,
  setFlag,
  sfxCue,
  startCombat,
  startDialogue,
  takeItem,
  wait,
  walkPlayerTo,
} from '../script';
import type { RoomDef, SpriteSheetDef } from '../types';

const npcSheet: SpriteSheetDef = {
  path: 'sprites/npc.png',
  frameW: 24,
  frameH: 32,
  mirrorLeft: true,
  anims: {
    idle_down: { frames: [0], frameMs: 400, loop: true },
    idle_up: { frames: [3], frameMs: 400, loop: true },
    idle_right: { frames: [6], frameMs: 400, loop: true },
  },
};

export const r00_test: RoomDef = {
  id: 'r00_test',
  label: 'TEST CHAMBER',
  backgroundPath: 'backgrounds/r00_test.png',
  backgroundMood: 'dungeon',
  walkmaskPath: 'masks/r00_test.png',
  playerSpawn: { x: 160, y: 185, facing: 'up' },
  onEnter: [playCutscene('r00_intro')],
  exits: [
    // Left edge → reappear near the right edge (loops back into this room)
    {
      id: 'west',
      rect: { x: 0, y: 128, w: 8, h: 60 },
      targetRoom: 'r00_test',
      targetSpawn: { x: 290, y: 165 },
      facing: 'left',
    },
    // Right edge → reappear near the left edge
    {
      id: 'east',
      rect: { x: 312, y: 128, w: 8, h: 60 },
      targetRoom: 'r00_test',
      targetSpawn: { x: 30, y: 165 },
      facing: 'right',
    },
  ],
  actors: [
    {
      id: 'npc',
      label: 'NPC',
      color: '#4ec9a4',
      sheet: npcSheet,
      x: 96,
      y: 122,
      anim: 'idle_down',
      facing: 'down',
    },
  ],
  hotspots: [
    // LOOK-only hotspot
    {
      id: 'scrawl',
      name: 'SCRAWLED WARNING',
      rect: { x: 208, y: 56, w: 48, h: 44 },
      verbs: {
        look: [
          narrate(
            "Someone scratched a single word into the stone: 'DON'T.' Don't what? Unclear. They stopped writing rather abruptly.",
          ),
        ],
      },
    },
    // Two-verb hotspot: LOOK hints, HAND flips a flag and enables the hatch
    {
      id: 'lever',
      name: 'RUSTY LEVER',
      rect: { x: 44, y: 88, w: 20, h: 26 },
      verbs: {
        look: [
          narrate(
            "A rusty lever bolted to the wall. A helpful plaque reads 'PULL ME.' The dungeon has never once lied to you. Today.",
          ),
        ],
        hand: [
          ifFlag(
            'r00.lever_pulled',
            [narrate('The lever is already down. Pulling harder will not impress anyone.')],
            [
              walkPlayerTo(54, 118),
              facePlayer('up'),
              narrate('CLUNK. Somewhere under the floor, machinery grinds into motion.'),
              setFlag('r00.lever_pulled', true),
              awardAchievement('lever_puller'),
              enableHotspot('hatch'),
              wait(300),
              narrate('A floor hatch unseals to the east. That was almost certainly a good idea.'),
            ],
          ),
        ],
      },
    },
    // Disabled at room start; the lever enables it. Also the item-use puzzle:
    // the NPC's rusty key unlocks it; anything else gets the default line.
    {
      id: 'hatch',
      name: 'FLOOR HATCH',
      enabled: false,
      rect: { x: 100, y: 148, w: 32, h: 20 },
      verbs: {
        look: [
          ifFlag(
            'r00.hatch_unlocked',
            [narrate('The hatch sits unlocked. It radiates smug potential energy.')],
            [narrate('A freshly unsealed floor hatch, held shut by a lock with a familiar rusty tint.')],
          ),
        ],
        hand: [
          walkPlayerTo(116, 172),
          facePlayer('up'),
          narrate('You give the hatch a confident tug. Locked. You do collect some premium hatch-adjacent debris.'),
          giveItem('pocket_lint'),
          awardAchievement('hatch_toucher'),
        ],
        item: {
          rusty_key: [
            walkPlayerTo(116, 172),
            facePlayer('up'),
            narrate('The rusty key grinds into the rusty lock. A match made in tetanus.'),
            takeItem('rusty_key'),
            setFlag('r00.hatch_unlocked', true),
            narrate('CLICK. The hatch is unlocked. It stays closed anyway. Floor two is a later problem.'),
          ],
          default: [
            narrate('You jam it against the hatch hopefully. The lock is unmoved by improvisation.'),
          ],
        },
      },
    },
    // Polygon hotspot over the pillar, with a multi-box LOOK sequence
    {
      id: 'obelisk',
      name: 'CRACKED OBELISK',
      polygon: [
        { x: 162, y: 112 },
        { x: 184, y: 132 },
        { x: 178, y: 162 },
        { x: 146, y: 162 },
        { x: 140, y: 132 },
      ],
      verbs: {
        look: [
          narrate(
            'An obelisk of black stone, cracked down the middle. It is warm to look at. That should not be possible.',
          ),
          narrate('The crack pulses faintly, like something inside is breathing. Slowly. Patiently.'),
          narrate('You get the distinct feeling it will matter later. The dungeon loves foreshadowing.'),
        ],
        hand: [
          narrate(
            'You touch the obelisk. It is exactly as warm as a sleeping animal. You stop touching the obelisk.',
          ),
          say('donut', 'Carl. Stop petting the ominous monolith. You do not know where it has been.'),
        ],
      },
    },
    // Combat kit: a one-time supply cache (weapon, armor, bombs, salves)
    {
      id: 'crate',
      name: 'SUPPLY CACHE',
      rect: { x: 196, y: 150, w: 26, h: 16 },
      verbs: {
        look: [
          narrate('A crate stamped COMPLIMENTARY. In this dungeon that word does a lot of ominous lifting.'),
        ],
        hand: [
          ifFlag(
            'r00.crate_looted',
            [narrate('The crate is empty. The generosity was a one-time promotional event.')],
            [
              walkPlayerTo(209, 172),
              setFlag('r00.crate_looted', true),
              narrate('The crate pops open. The dungeon has provided a starter kit and, implicitly, a threat.'),
              giveItem('rusty_cudgel'),
              giveItem('scrap_plate'),
              giveItem('goblin_bomb'),
              giveItem('goblin_bomb'),
              giveItem('healing_salve'),
            ],
          ),
        ],
      },
    },
    // Mob encounter trigger (proves startCombat from a hotspot)
    {
      id: 'nest',
      name: 'SKITTERING NEST',
      rect: { x: 100, y: 56, w: 40, h: 34 },
      verbs: {
        look: [
          narrate('A hole in the wall, rustling with intent. Poking it would be a commitment.'),
        ],
        hand: [
          narrate('You poke the nest. The rustling stops. That is worse.'),
          startCombat('scrap_pit'),
        ],
      },
    },
    // Boss encounter trigger (proves the phase hook)
    {
      id: 'junk_heap',
      name: 'JUNK HEAP',
      rect: { x: 272, y: 150, w: 30, h: 16 },
      verbs: {
        look: [
          narrate('A pile of scrap arranged with suspicious anatomical ambition.'),
        ],
        hand: [
          narrate('You pat the junk heap. The junk heap pats back.'),
          startCombat('junk_golem_lair'),
        ],
      },
    },
    // Death demo: HAND the obviously lethal thing (KQ5 tradition)
    {
      id: 'conduit',
      name: 'SPARKING CONDUIT',
      rect: { x: 260, y: 64, w: 26, h: 40 },
      verbs: {
        look: [
          narrate('A power conduit, arcing merrily. It is labeled DO NOT TOUCH in four languages and one pictogram of a skeleton.'),
        ],
        hand: [
          walkPlayerTo(272, 118),
          facePlayer('up'),
          narrate('You reach for the sparking conduit, bare-handed. Somewhere, an audience leans forward.'),
          sfxCue('zap_big'),
          killPlayer(
            'You grabbed the clearly electrified conduit. Cause of death: curiosity, conducted. The dungeon awards style points: zero.',
          ),
        ],
      },
    },
    // NPC talk hotspot: full dialogue tree (see data/dialogues.ts)
    {
      id: 'npc',
      name: 'NERVOUS SURVIVOR',
      rect: { x: 82, y: 92, w: 28, h: 32 },
      verbs: {
        look: [narrate('Another crawler. Still alive, which around here counts as a personality.')],
        talk: [startDialogue('npc_survivor')],
      },
    },
    // Voice sampler: one hotspot that demos all three narration channels
    // (announce/notify/describe) for evaluation. See src/data/VOICE_BIBLE.md.
    {
      id: 'test_card',
      name: 'BROADCAST TEST CARD',
      rect: { x: 26, y: 156, w: 26, h: 20 },
      verbs: {
        look: [
          describe(
            'A dusty color-bar test card, propped where nobody sane would broadcast from. Someone has drawn a smiley face on it. The smile has too many teeth.',
          ),
        ],
        hand: [
          walkPlayerTo(52, 176),
          facePlayer('left'),
          announce(
            "WELCOME BACK to the only show where the intermission can eat you! I'm JUBILEE, your host, your judge, and legally your landlord. Say hi to Crawler 4,122, folks - he just touched the test card like it owed him money.",
          ),
          announce(
            'For our new viewers at home: everything on this floor is a prop, a prize, or a predator. Sometimes all three! Audience participation is mandatory and, per the waiver you did not read, retroactive.',
          ),
          announce(
            'Sponsor break! This dismemberment is brought to you by MoonBurger. MoonBurger: it is technically food.',
          ),
          notify('Broadcast diagnostic complete. Channels: 3 of 3 responding.'),
          notify('Viewership +12. Retention: acceptable. Continue producing content.'),
          notify('Reminder: unspent achievement rewards expire at floor close.'),
          describe(
            'The test card hums with the specific static of a camera that never blinks. Carl wipes his hand on his jacket. It does not help with the feeling.',
          ),
          describe(
            'Somewhere overhead, something enormous shifts to get a better view. The dust that falls is the politest thing this dungeon has done all day.',
          ),
          describe(
            'He decides, not for the first time, that being interesting is the most dangerous job on Earth. Then he goes back to being interesting.',
          ),
        ],
      },
    },
  ],
  scaleBands: [
    { yTop: 56, yBottom: 66, scale: 0.6 },
    { yTop: 184, yBottom: 200, scale: 1.0 },
  ],
  placeholderMaskDraw: (ctx) => {
    // Irregular top edge: stair-stepped bites out of the walkable area
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 110, 40, 12);
    ctx.fillRect(200, 110, 56, 8);
    ctx.fillRect(64, 110, 20, 5);
    // Clipped bottom-left corner
    ctx.fillRect(0, 178, 24, 22);
    // Blocked pillar in the middle of the floor
    ctx.fillRect(140, 128, 44, 34);
    // Narrow walkable corridor along the right, climbing above the floor line
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(296, 60, 18, 56);
  },
};
