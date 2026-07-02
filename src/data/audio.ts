/**
 * Audio registry: original chiptune loops (authored as note-pattern data),
 * the one-shot SFX id list, cue-id mappings for the content's existing
 * musicCue()/sfxCue() calls, and per-mood room music defaults.
 *
 * Every id is addressable as audio/<id>.ogg (or .mp3/.wav) - a real file at
 * that path (bundled or Blob-override) beats the synth, mirroring the art
 * pipeline. ALL compositions here are original patterns written for this
 * demo.
 */

import type { Mood } from './types';

/** One melodic step: a MIDI note (null = rest) held for `d` sixteenth-steps. */
export interface NoteStep {
  n: number | null;
  d: number;
}

export type SynthWave = 'square' | 'triangle' | 'sawtooth' | 'noise';

export interface TrackChannel {
  wave: SynthWave;
  /** 0..1 relative channel gain. */
  volume: number;
  steps: NoteStep[];
}

export interface TrackDef {
  id: string;
  bpm: number;
  channels: TrackChannel[];
}

// --- tiny note-string parser: 'C4:2 E4 - G4:4' (default duration 2) --------

const NOTE_INDEX: Record<string, number> = {
  C: 0, 'C#': 1, D: 2, 'D#': 3, E: 4, F: 5, 'F#': 6, G: 7, 'G#': 8, A: 9, 'A#': 10, B: 11,
};

function midi(name: string): number {
  const m = /^([A-G]#?)(-?\d)$/.exec(name);
  if (!m) throw new Error(`bad note "${name}"`);
  return NOTE_INDEX[m[1]] + (Number(m[2]) + 1) * 12;
}

/** Parse a compact pattern string into steps. '-' is a rest. */
export function seq(pattern: string, defaultDur = 2): NoteStep[] {
  const out: NoteStep[] = [];
  for (const tok of pattern.trim().split(/\s+/)) {
    const [head, durStr] = tok.split(':');
    const d = durStr ? Number(durStr) : defaultDur;
    out.push({ n: head === '-' ? null : midi(head), d });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Music loops (8 bars of 4/4 at 16 steps/bar unless noted). Original work.
// ---------------------------------------------------------------------------

export const MUSIC_TRACKS: Record<string, TrackDef> = {
  music_title: {
    id: 'music_title',
    bpm: 104,
    channels: [
      {
        wave: 'square',
        volume: 0.5,
        steps: seq(
          'C5:4 G4:2 A4:2 E5:4 D5:4 ' +
            'F5:4 E5:2 D5:2 C5:6 -:2 ' +
            'A4:4 C5:2 D5:2 E5:4 G5:4 ' +
            'F5:2 E5:2 D5:2 B4:2 C5:6 -:2 ' +
            'E5:4 C5:2 G4:2 A4:4 C5:4 ' +
            'D5:4 F5:2 E5:2 D5:6 -:2 ' +
            'G4:2 A4:2 C5:2 D5:2 E5:4 D5:2 C5:2 ' +
            'D5:2 C5:2 A4:2 G4:2 C5:6 -:2',
        ),
      },
      {
        wave: 'triangle',
        volume: 0.55,
        steps: seq(
          'C3:8 G2:8 A2:8 E2:8 F2:8 C3:8 G2:8 G2:8 ' +
            'A2:8 E2:8 F2:8 C3:8 D3:8 G2:8 C3:8 G2:8',
          8,
        ),
      },
    ],
  },
  music_cold: {
    id: 'music_cold',
    bpm: 72,
    channels: [
      {
        wave: 'triangle',
        volume: 0.5,
        steps: seq(
          'A4:6 E5:6 C5:4 B4:6 E4:6 -:4 ' +
            'F4:6 C5:6 A4:4 G4:6 D4:6 -:4 ' +
            'A4:6 E5:6 D5:4 C5:6 B4:6 -:4 ' +
            'E4:6 G4:6 A4:4 A4:12 -:4',
        ),
      },
      {
        wave: 'square',
        volume: 0.16,
        steps: seq('A2:16 F2:16 A2:16 E2:16 F2:16 D2:16 A2:16 E2:16', 16),
      },
    ],
  },
  music_dungeon: {
    id: 'music_dungeon',
    bpm: 88,
    channels: [
      {
        wave: 'square',
        volume: 0.34,
        steps: seq(
          'D4:4 F4:2 A4:2 G4:4 F4:4 E4:4 C4:2 E4:2 D4:8 ' +
            'D4:4 F4:2 A4:2 C5:4 A4:4 A#4:4 A4:2 G4:2 F4:8 ' +
            'G4:4 A#4:2 D5:2 C5:4 A4:4 F4:4 G4:2 E4:2 D4:8 ' +
            'E4:4 G4:2 A4:2 A#4:4 G4:4 A4:2 G4:2 F4:2 E4:2 D4:8',
        ),
      },
      {
        wave: 'triangle',
        volume: 0.5,
        steps: seq('D2:16 D2:16 A#1:16 A1:16 G1:16 D2:16 A#1:16 A1:16', 16),
      },
    ],
  },
  music_safe: {
    id: 'music_safe',
    bpm: 96,
    channels: [
      {
        wave: 'triangle',
        volume: 0.5,
        steps: seq(
          'F4:4 A4:2 C5:2 A4:4 G4:4 E4:4 G4:2 C5:2 G4:8 ' +
            'A4:4 C5:2 F5:2 E5:4 C5:4 D5:4 A#4:2 A4:2 G4:8 ' +
            'F4:4 A4:2 C5:2 D5:4 C5:4 A#4:4 A4:2 G4:2 A4:8 ' +
            'G4:4 A#4:2 A4:2 G4:4 E4:4 F4:12 -:4',
        ),
      },
      {
        wave: 'square',
        volume: 0.14,
        steps: seq('F2:16 C3:16 A#2:16 C3:16 F2:16 D2:16 A#2:16 C3:16', 16),
      },
    ],
  },
  music_workshop: {
    id: 'music_workshop',
    bpm: 120,
    channels: [
      {
        wave: 'sawtooth',
        volume: 0.22,
        steps: seq(
          'E3:2 E3:2 G3:2 E3:2 A3:2 G3:2 E3:2 D3:2 ' +
            'E3:2 E3:2 G3:2 A3:2 B3:2 A3:2 G3:2 E3:2 ' +
            'E3:2 E3:2 G3:2 E3:2 A3:2 G3:2 E3:2 D3:2 ' +
            'C3:2 C3:2 D3:2 D3:2 E3:4 D3:2 E3:2',
        ),
      },
      {
        wave: 'triangle',
        volume: 0.5,
        steps: seq('E2:8 E2:8 A1:8 B1:8 E2:8 E2:8 C2:8 D2:8', 8),
      },
      {
        wave: 'noise',
        volume: 0.1,
        steps: seq('C5:2 -:2 C5:2 -:2 C5:2 -:2 C5:1 C5:1 -:2', 2),
      },
    ],
  },
  music_boss: {
    id: 'music_boss',
    bpm: 132,
    channels: [
      {
        wave: 'sawtooth',
        volume: 0.26,
        steps: seq(
          'B2:2 B2:2 C3:2 B2:2 B2:2 F3:2 E3:2 C3:2 ' +
            'B2:2 B2:2 C3:2 B2:2 G3:2 F3:2 E3:2 C3:2 ' +
            'B2:2 B2:2 C3:2 B2:2 B2:2 F3:2 E3:2 C3:2 ' +
            'A#2:2 A#2:2 B2:2 C3:2 D3:4 C3:2 B2:2',
        ),
      },
      {
        wave: 'square',
        volume: 0.2,
        steps: seq('- - B4:4 - F5:4 - E5:2 C5:2 B4:8 - - D5:4 - C5:4 - B4:8 -:4', 4),
      },
      {
        wave: 'noise',
        volume: 0.14,
        steps: seq('C5:2 -:2 C5:1 C5:1 -:2 C5:2 -:2 C5:2 -:1 C5:1', 2),
      },
    ],
  },
  music_combat: {
    id: 'music_combat',
    bpm: 140,
    channels: [
      {
        wave: 'square',
        volume: 0.3,
        steps: seq(
          'A4:2 A4:2 C5:2 A4:2 E5:2 D5:2 C5:2 D5:2 ' +
            'A4:2 A4:2 C5:2 D5:2 E5:2 G5:2 E5:2 D5:2 ' +
            'F5:2 E5:2 D5:2 C5:2 D5:2 C5:2 B4:2 G4:2 ' +
            'A4:2 C5:2 E5:2 D5:2 C5:4 B4:2 A4:2',
        ),
      },
      {
        wave: 'triangle',
        volume: 0.5,
        steps: seq('A2:4 A2:4 G2:4 G2:4 F2:4 F2:4 E2:4 E2:4', 4),
      },
      {
        wave: 'noise',
        volume: 0.1,
        steps: seq('C5:2 -:2 C5:2 -:2', 2),
      },
    ],
  },
  music_finale: {
    id: 'music_finale',
    bpm: 100,
    channels: [
      {
        wave: 'square',
        volume: 0.42,
        steps: seq(
          'C5:4 E5:4 G5:6 E5:2 F5:4 A5:4 G5:8 ' +
            'E5:4 G5:4 C6:6 G5:2 A5:4 F5:4 G5:8 ' +
            'C5:4 E5:4 G5:6 E5:2 A5:4 F5:4 E5:4 D5:4 ' +
            'C5:4 D5:2 E5:2 G5:4 E5:4 C5:12 -:4',
        ),
      },
      {
        wave: 'triangle',
        volume: 0.55,
        steps: seq('C3:8 G2:8 F2:8 G2:8 C3:8 E2:8 F2:8 G2:8 C3:8 G2:8 F2:8 D2:8 C3:8 G2:8 C3:16', 8),
      },
    ],
  },
};

// ---------------------------------------------------------------------------
// One-shot SFX ids (synth recipes live in engine/audio.ts, keyed by these).
// ---------------------------------------------------------------------------

export const SFX_IDS = [
  'sfx_ui_click',
  'sfx_verb',
  'sfx_blip',
  'sfx_chime',
  'sfx_achievement',
  'sfx_pickup',
  'sfx_door',
  'sfx_hit',
  'sfx_miss',
  'sfx_cast',
  'sfx_explosion',
  'sfx_levelup',
  'sfx_death',
  'sfx_victory',
  'sfx_defeat',
  'sfx_rumble',
  'sfx_machine',
] as const;

export type SfxId = (typeof SFX_IDS)[number];

/** Every overridable audio id (for the CMS manifest + file overrides). */
export function allAudioIds(): string[] {
  return [...Object.keys(MUSIC_TRACKS), ...SFX_IDS];
}

// ---------------------------------------------------------------------------
// Mappings: content cue ids -> audio ids; room moods -> default music.
// ---------------------------------------------------------------------------

export const MOOD_MUSIC: Record<Mood, string> = {
  cold: 'music_cold',
  dungeon: 'music_dungeon',
  safe: 'music_safe',
  workshop: 'music_workshop',
  boss: 'music_boss',
};

/** musicCue(id) -> track (or 'stop'); unmapped ids no-op with one log. */
export const CUE_MUSIC: Record<string, string> = {
  silence: 'stop',
  act1_collapse_theme: 'music_cold',
  system_sting: 'music_boss',
  descent_drone: 'music_dungeon',
  interface_boot: 'music_safe',
  lootbox_fanfare: 'music_safe',
  premiere_fanfare: 'music_safe',
  montage_theme: 'music_workshop',
  stairs_theme: 'music_finale',
  credits_theme: 'music_finale',
};

/** sfxCue(id) -> one-shot. */
export const CUE_SFX: Record<string, SfxId> = {
  deep_rumble: 'sfx_rumble',
  city_collapse: 'sfx_explosion',
  ui_scan: 'sfx_blip',
  equip_clank: 'sfx_pickup',
  lootbox_open: 'sfx_achievement',
  broadcast_static: 'sfx_blip',
  skitter: 'sfx_miss',
  claw_shred: 'sfx_hit',
  chrome_ring: 'sfx_chime',
  trip_snap: 'sfx_explosion',
  det_cord_crack: 'sfx_explosion',
  detonation_1: 'sfx_explosion',
  detonation_2: 'sfx_explosion',
  detonation_3: 'sfx_explosion',
  ball_derail: 'sfx_explosion',
  fuse_hiss: 'sfx_cast',
  cart_roll: 'sfx_rumble',
  weights_clank: 'sfx_pickup',
  machine_roar: 'sfx_machine',
  machine_wreck: 'sfx_explosion',
  skittering: 'sfx_miss',
};
