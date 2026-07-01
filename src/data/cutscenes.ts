/**
 * Cutscene registry (looked up by playCutscene(id), like rooms and dialogue
 * trees). Cutscenes are plain ScriptAction[] with the cinematic actions —
 * skippable with Esc, and once-only via the scene:<id>:played flag.
 */

import {
  fadeIn,
  fadeOut,
  moveActor,
  musicCue,
  narrate,
  say,
  setFlag,
  setLetterbox,
  sfxCue,
} from './script';
import type { CutsceneDef } from './types';

const r00Intro: CutsceneDef = {
  id: 'r00_intro',
  actions: [
    fadeOut(150),
    setLetterbox(true),
    musicCue('theme_floor_one'),
    fadeIn(400),
    narrate('FLOOR ONE. Current population: one crawler, one nervous man, one extremely opinionated cat.'),
    moveActor('player', 160, 150),
    say('donut', 'Try not to die in the tutorial, Carl. Think of the optics.'),
    sfxCue('npc_shuffle'),
    moveActor('npc', 120, 122),
    narrate('The survivor shuffles sideways, the universal dungeon gesture for PLEASE HAUNT SOMEONE ELSE.'),
    narrate('The dungeon notes your arrival with interest. WELCOME, CRAWLER. Do try to be entertaining.'),
    setFlag('r00.intro_seen', true),
    setLetterbox(false),
  ],
};

export const cutscenes: Record<string, CutsceneDef> = {
  [r00Intro.id]: r00Intro,
};
