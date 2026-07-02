/**
 * R04 — The tutorial guild (Mordecai). Act I centerpiece: the briefing tree,
 * cinematic character creation, Donut's transformation, and the onward door
 * (locked until the party is formed). onEnter reconciles cat-vs-Donut actor
 * state and the exit lock against the flags, so saves/re-entry stay correct.
 */

import { donutSheet } from '../cutscenes';
import {
  awardAchievement,
  despawnActor,
  disableExit,
  enableExit,
  ifFlag,
  narrate,
  spawnActor,
  startDialogue,
} from '../script';
import type { RoomDef } from '../types';
import { donutCatSheet } from './r01_street';

export const r04_guild: RoomDef = {
  id: 'r04_guild',
  label: 'TUTORIAL GUILD',
  backgroundPath: 'backgrounds/r04_guild.png',
  backgroundMood: 'safe',
  walkmaskPath: 'masks/r04_guild.png',
  playerSpawn: { x: 34, y: 162, facing: 'right' },
  onEnter: [
    awardAchievement('guild_member'),
    // Reconcile persistent state: transformed Donut replaces the cat, and
    // the onward door only opens for a formed party.
    ifFlag(
      'act1:donut_awake',
      [despawnActor('donut_cat'), spawnActor('donut', donutSheet, 200, 128, { facing: 'down' })],
      [],
    ),
    ifFlag('act1:party_formed', [enableExit('onward')], [disableExit('onward')]),
  ],
  exits: [
    {
      id: 'back',
      rect: { x: 0, y: 128, w: 8, h: 64 },
      targetRoom: 'r03_entrance',
      targetSpawn: { x: 288, y: 162 },
      facing: 'left',
    },
    {
      id: 'onward',
      rect: { x: 312, y: 128, w: 8, h: 64 },
      targetRoom: 'r05_act2_stub',
      targetSpawn: { x: 36, y: 160 },
      facing: 'right',
    },
  ],
  actors: [
    {
      id: 'mordecai',
      label: 'MORDECAI',
      color: '#b08a5a',
      sheet: {
        path: 'sprites/mordecai.png',
        frameW: 24,
        frameH: 32,
        mirrorLeft: true,
        anims: {
          idle_down: { frames: [0], frameMs: 400, loop: true },
          idle_up: { frames: [3], frameMs: 400, loop: true },
          idle_right: { frames: [6], frameMs: 400, loop: true },
        },
      },
      x: 120,
      y: 124,
      anim: 'idle_down',
      facing: 'down',
    },
    {
      id: 'donut_cat',
      label: 'THE CAT',
      color: '#f5f0e6',
      sheet: donutCatSheet,
      x: 200,
      y: 128,
      anim: 'idle_down',
      facing: 'down',
    },
  ],
  hotspots: [
    {
      id: 'mordecai',
      name: 'MORDECAI',
      rect: { x: 104, y: 92, w: 32, h: 34 },
      verbs: {
        look: [
          narrate('A rat-person in a patched waistcoat, whiskers gone gray at the tips. He has the posture of someone who has survived everything, including retirement.'),
        ],
        talk: [startDialogue('mordecai')],
        hand: [narrate('He bats your hand away without looking. Reflexes of a much younger rat.')],
      },
    },
    {
      id: 'cat',
      name: 'THE CAT',
      rect: { x: 186, y: 112, w: 28, h: 20 },
      verbs: {
        look: [
          narrate('She has claimed the warmest crate in the room and is asleep on it, sovereign and unbothered. Something faint glimmers over her fur.'),
        ],
        hand: [
          narrate('You reach out. One eye opens. You withdraw. Diplomacy preserved.'),
        ],
        talk: [
          narrate('She answers with a slow blink that somehow conveys LATER, PEASANT.'),
        ],
      },
    },
    {
      id: 'donut',
      name: 'PRINCESS DONUT',
      enabled: false,
      rect: { x: 186, y: 112, w: 28, h: 20 },
      verbs: {
        look: [
          narrate('Princess Donut the Queen Anne Chonk. Party member, spellcaster, self-appointed monarch. Her fur has opinions about the lighting.'),
        ],
        talk: [startDialogue('donut_court')],
        hand: [narrate('She permits exactly one chin scritch. Court is adjourned.')],
      },
    },
    {
      id: 'shelves',
      name: 'SUPPLY SHELVES',
      rect: { x: 40, y: 56, w: 52, h: 48 },
      verbs: {
        look: [
          narrate('Bandages, bottles, and a jar labeled TEETH, ASSORTED. Guild provisioning asks no questions and answers none.'),
        ],
        hand: [
          narrate('Mordecai clears his throat without turning around. You un-touch the shelf.'),
        ],
      },
    },
    {
      id: 'bunks',
      name: 'GUEST BUNK',
      rect: { x: 236, y: 60, w: 56, h: 44 },
      verbs: {
        look: [
          narrate('A bunk with one blanket and eleven previous opinions carved into the frame. SLEPT HERE, LIVED ANYWAY is the most encouraging.'),
        ],
      },
    },
    {
      id: 'onward_door',
      name: 'DOOR DEEPER',
      rect: { x: 296, y: 92, w: 24, h: 60 },
      verbs: {
        look: [
          ifFlag(
            'act1:party_formed',
            [narrate('The door to the rest of Floor One. Unbarred, now that you are a party instead of a snack.')],
            [narrate('Barred from this side. Mordecai clearly intends you to leave PREPARED, which is guild for NOT YET.')],
          ),
        ],
        hand: [
          ifFlag(
            'act1:party_formed',
            [narrate('Unbarred. Walk through when ready.')],
            [narrate('The bar does not budge. Mordecai, without looking: REGISTER FIRST. SORT THE CAT. THEN WE TALK DOORS.')],
          ),
        ],
      },
    },
  ],
  scaleBands: [
    { yTop: 104, yBottom: 116, scale: 0.8 },
    { yTop: 184, yBottom: 200, scale: 1.0 },
  ],
  placeholderMaskDraw: (ctx) => {
    ctx.fillStyle = '#000000';
    ctx.fillRect(32, 110, 64, 10); // counter by the shelves
    ctx.fillRect(180, 110, 44, 8); // Donut's crate throne
  },
};
