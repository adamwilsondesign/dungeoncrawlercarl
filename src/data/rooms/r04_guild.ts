/**
 * R04 - The tutorial guild (Mordecai). Act I centerpiece: the briefing tree,
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
  setFlag,
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
    // First-visit establishing beat (P10: scene-setting for newcomers).
    ifFlag(
      'seen:r04',
      [],
      [
        setFlag('seen:r04', true),
        narrate('Inside, the guild is smaller and warmer than it has any right to be: a repurposed storeroom with a desk, a liquor shelf, a wall of maps in a language you cannot read, and a fire that has clearly been kept burning for someone like you.'),
        narrate('Behind the desk sits a broad, whiskered creature in a waistcoat - part rat, part uncle, entirely unbothered by your species. He looks up like he has been expecting you specifically, and is already tired of the paperwork.'),
      ],
    ),
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
      targetRoom: 'r05_maze',
      targetSpawn: { x: 30, y: 162 },
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
  // Art brief: the guild interior - bed, cluttered shelves, the guildmaster's
  // desk, a hearth; warmer and more lived-in than anything outside.
  placeholderArtDraw: (ctx) => {
    // Wood-plank wall paneling
    ctx.fillStyle = '#54401f';
    ctx.fillRect(0, 0, 320, 106);
    ctx.fillStyle = '#47361a';
    for (let y = 8; y < 106; y += 14) ctx.fillRect(0, y, 320, 2);
    // Supply shelves, left: boards + jars
    ctx.fillStyle = '#2e2210';
    ctx.fillRect(38, 52, 56, 54);
    ctx.fillStyle = '#6b5228';
    for (const y of [60, 76, 92]) ctx.fillRect(40, y, 52, 3);
    for (const [jx, jy, jc] of [
      [44, 52, '#a8c47a'], [56, 52, '#c48a5a'], [70, 52, '#8ab0c4'],
      [46, 68, '#c4b05a'], [62, 68, '#9a7ac4'], [78, 68, '#7ac48f'],
      [44, 84, '#c47a7a'], [66, 84, '#d8d0b0'],
    ] as const) {
      ctx.fillStyle = jc;
      ctx.fillRect(jx, jy, 7, 7);
    }
    // Hearth with a kept fire, center-left of the desk
    ctx.fillStyle = '#2a1c10';
    ctx.fillRect(140, 62, 34, 44);
    ctx.fillStyle = '#120c06';
    ctx.fillRect(146, 72, 22, 30);
    const fire = ctx.createRadialGradient(157, 96, 2, 157, 96, 22);
    fire.addColorStop(0, 'rgba(255,190,90,0.95)');
    fire.addColorStop(1, 'rgba(255,120,40,0)');
    ctx.fillStyle = fire;
    ctx.fillRect(138, 70, 38, 36);
    // The guildmaster's desk (in front of Mordecai's spot)
    ctx.fillStyle = '#3a2c14';
    ctx.fillRect(100, 112, 62, 10);
    ctx.fillStyle = '#57401d';
    ctx.fillRect(100, 110, 62, 4);
    // Guest bunk, right, with a folded blanket
    ctx.fillStyle = '#332612';
    ctx.fillRect(238, 78, 58, 26);
    ctx.fillStyle = '#6e2f2f';
    ctx.fillRect(242, 74, 50, 10);
    ctx.fillStyle = '#8a4141';
    ctx.fillRect(242, 74, 50, 3);
    // Wall maps
    ctx.fillStyle = '#c9b98a';
    ctx.fillRect(196, 44, 26, 20);
    ctx.fillRect(228, 40, 20, 16);
    ctx.strokeStyle = '#7a5f33';
    ctx.strokeRect(196.5, 44.5, 25, 19);
    ctx.strokeRect(228.5, 40.5, 19, 15);
    ctx.beginPath();
    ctx.moveTo(200, 58);
    ctx.quadraticCurveTo(210, 46, 218, 54);
    ctx.stroke();
  },
  placeholderMaskDraw: (ctx) => {
    ctx.fillStyle = '#000000';
    ctx.fillRect(32, 110, 64, 10); // counter by the shelves
    ctx.fillRect(180, 110, 44, 8); // Donut's crate throne
  },
};
