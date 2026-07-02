/**
 * Procedural WebAudio chiptune engine, on the art system's philosophy: all
 * sound is synthesized in code from the note-pattern registry, and any real
 * file wins with zero code changes. Resolution per id:
 *   Blob override (audio/<id>.ogg via the CMS) -> bundled file
 *   (src/assets/audio/<id>.ogg|mp3|wav) -> synth.
 *
 * Autoplay policy: the AudioContext is created/resumed on the FIRST user
 * gesture (pointer or key); cues before that are remembered, not dropped.
 * Music loops are scheduled with a look-ahead timer for seamless repeats,
 * and track changes crossfade over ~1s.
 */

import {
  CUE_MUSIC,
  CUE_SFX,
  MOOD_MUSIC,
  MUSIC_TRACKS,
  type SfxId,
  type TrackDef,
} from '../data/audio';
import type { Mood } from '../data/types';
import { overrideUrl } from './assets';

/** Bundled real audio files (drop-in overrides), keyed like the art glob. */
const audioManifest = import.meta.glob<string>('../assets/audio/*.{ogg,mp3,wav}', {
  eager: true,
  query: '?url',
  import: 'default',
});

function bundledAudioUrl(id: string): string | undefined {
  for (const ext of ['ogg', 'mp3', 'wav']) {
    const hit = audioManifest[`../assets/audio/${id}.${ext}`];
    if (hit) return hit;
  }
  return undefined;
}

/** Blob overrides use the full asset id: audio/<id>.<ext>. */
function overrideAudioUrl(id: string): string | undefined {
  for (const ext of ['ogg', 'mp3', 'wav']) {
    const hit = overrideUrl(`audio/${id}.${ext}`);
    if (hit) return hit;
  }
  return undefined;
}

const VOL_KEYS = { master: 'dcc_vol_master', music: 'dcc_vol_music', sfx: 'dcc_vol_sfx' } as const;

function loadVol(key: string, fallback: number): number {
  const raw = localStorage.getItem(key);
  const v = raw === null ? NaN : Number(raw);
  return Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : fallback;
}

const midiHz = (n: number): number => 440 * Math.pow(2, (n - 69) / 12);
const LOOKAHEAD_S = 0.35;
const TICK_MS = 120;
const XFADE_S = 1.0;

interface PlayingTrack {
  id: string;
  gain: GainNode;
  stop: () => void;
}

export class AudioEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private musicBus: GainNode | null = null;
  private sfxBus: GainNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private current: PlayingTrack | null = null;
  private currentId: string | null = null;
  private pendingMusic: string | null = null;
  private previousMusic: string | null = null;
  private readonly fileBuffers = new Map<string, Promise<AudioBuffer | null>>();
  private readonly warned = new Set<string>();

  volumes = {
    master: loadVol(VOL_KEYS.master, 0.8),
    music: loadVol(VOL_KEYS.music, 0.7),
    sfx: loadVol(VOL_KEYS.sfx, 0.8),
  };

  /** Install one-time gesture listeners; call once at boot. */
  installUnlock(): void {
    const unlock = (): void => {
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
      this.ensureContext();
    };
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);
  }

  private ensureContext(): AudioContext | null {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      return this.ctx;
    }
    try {
      this.ctx = new AudioContext();
    } catch {
      return null;
    }
    this.master = this.ctx.createGain();
    this.master.gain.value = this.volumes.master;
    this.master.connect(this.ctx.destination);
    this.musicBus = this.ctx.createGain();
    this.musicBus.gain.value = this.volumes.music;
    this.musicBus.connect(this.master);
    this.sfxBus = this.ctx.createGain();
    this.sfxBus.gain.value = this.volumes.sfx;
    this.sfxBus.connect(this.master);
    const len = this.ctx.sampleRate;
    this.noiseBuffer = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = this.noiseBuffer.getChannelData(0);
    let s = 22222;
    for (let i = 0; i < len; i++) {
      s = (s * 1664525 + 1013904223) >>> 0;
      data[i] = (s / 0xffffffff) * 2 - 1;
    }
    console.info('[audio] context unlocked');
    if (this.pendingMusic) {
      const id = this.pendingMusic;
      this.pendingMusic = null;
      // The queued id was recorded as current when it was requested; clear
      // it so the same-id guard doesn't swallow the deferred start.
      this.currentId = null;
      this.playMusic(id);
    }
    return this.ctx;
  }

  setVolume(kind: keyof typeof VOL_KEYS, v: number): void {
    const clamped = Math.max(0, Math.min(1, v));
    this.volumes[kind] = clamped;
    localStorage.setItem(VOL_KEYS[kind], String(clamped));
    if (kind === 'master' && this.master) this.master.gain.value = clamped;
    if (kind === 'music' && this.musicBus) this.musicBus.gain.value = clamped;
    if (kind === 'sfx' && this.sfxBus) this.sfxBus.gain.value = clamped;
  }

  // --- Music ---------------------------------------------------------------

  /** Crossfade to a track id ('stop' fades out). Same-id calls no-op. */
  playMusic(id: string): void {
    if (id === this.currentId) return;
    const ctx = this.ctx;
    if (!ctx || !this.musicBus) {
      this.pendingMusic = id;
      this.currentId = id;
      return;
    }
    this.previousMusic = this.currentId;
    this.currentId = id;
    const old = this.current;
    if (old) {
      old.gain.gain.setTargetAtTime(0, ctx.currentTime, XFADE_S / 3);
      setTimeout(() => old.stop(), XFADE_S * 1200);
      this.current = null;
    }
    if (id === 'stop') {
      console.info('[audio] music -> stop');
      return;
    }
    const gain = ctx.createGain();
    gain.gain.value = 0;
    gain.gain.setTargetAtTime(1, ctx.currentTime, XFADE_S / 3);
    gain.connect(this.musicBus);
    const fileUrl = overrideAudioUrl(id) ?? bundledAudioUrl(id);
    if (fileUrl) {
      console.info(`[audio] music -> ${id} (file)`);
      this.current = this.startFileLoop(ctx, id, fileUrl, gain);
    } else {
      const track = MUSIC_TRACKS[id];
      if (!track) {
        this.warnOnce(`unknown music id "${id}"`);
        return;
      }
      console.info(`[audio] music -> ${id} (synth)`);
      this.current = this.startSynthLoop(ctx, track, gain);
    }
  }

  /** Play by room mood/override (room entry). */
  playRoomMusic(mood: Mood, musicId?: string): void {
    this.playMusic(musicId ?? MOOD_MUSIC[mood]);
  }

  /** Combat pushes its theme; restore returns to whatever preceded it. */
  restorePreviousMusic(): void {
    if (this.previousMusic) this.playMusic(this.previousMusic);
  }

  private startFileLoop(ctx: AudioContext, id: string, url: string, gain: GainNode): PlayingTrack {
    let stopped = false;
    let source: AudioBufferSourceNode | null = null;
    void this.loadFile(ctx, id, url).then((buffer) => {
      if (!buffer || stopped) return;
      source = ctx.createBufferSource();
      source.buffer = buffer;
      source.loop = true;
      source.connect(gain);
      source.start();
    });
    return {
      id,
      gain,
      stop: () => {
        stopped = true;
        try {
          source?.stop();
        } catch {
          /* already stopped */
        }
        gain.disconnect();
      },
    };
  }

  private loadFile(ctx: AudioContext, id: string, url: string): Promise<AudioBuffer | null> {
    const cached = this.fileBuffers.get(id + url);
    if (cached) return cached;
    const promise = fetch(url)
      .then((r) => r.arrayBuffer())
      .then((buf) => ctx.decodeAudioData(buf))
      .catch(() => {
        this.warnOnce(`audio file for "${id}" failed to decode; falling back to synth`);
        return null;
      });
    this.fileBuffers.set(id + url, promise);
    return promise;
  }

  /** Look-ahead scheduler over the note-pattern channels; loops seamlessly. */
  private startSynthLoop(ctx: AudioContext, track: TrackDef, gain: GainNode): PlayingTrack {
    const stepDur = 60 / track.bpm / 4; // one sixteenth
    const channels = track.channels.map((ch) => ({
      ch,
      totalSteps: ch.steps.reduce((a, s) => a + s.d, 0),
      cursor: 0, // step index within the channel pattern
      nextTime: ctx.currentTime + 0.05,
    }));
    let alive = true;
    const timer = window.setInterval(() => {
      if (!alive) return;
      const horizon = ctx.currentTime + LOOKAHEAD_S;
      for (const st of channels) {
        while (st.nextTime < horizon) {
          const step = st.ch.steps[st.cursor];
          const dur = step.d * stepDur;
          if (step.n !== null) this.scheduleNote(ctx, gain, st.ch.wave, st.ch.volume, step.n, st.nextTime, dur);
          st.nextTime += dur;
          st.cursor = (st.cursor + 1) % st.ch.steps.length;
        }
      }
    }, TICK_MS);
    return {
      id: track.id,
      gain,
      stop: () => {
        alive = false;
        window.clearInterval(timer);
        gain.disconnect();
      },
    };
  }

  private scheduleNote(
    ctx: AudioContext,
    out: GainNode,
    wave: TrackDef['channels'][number]['wave'],
    volume: number,
    note: number,
    when: number,
    dur: number,
  ): void {
    const env = ctx.createGain();
    env.connect(out);
    const attack = 0.008;
    const release = Math.min(0.08, dur * 0.3);
    env.gain.setValueAtTime(0, when);
    env.gain.linearRampToValueAtTime(volume, when + attack);
    env.gain.setValueAtTime(volume, when + dur - release);
    env.gain.linearRampToValueAtTime(0.0001, when + dur);
    if (wave === 'noise') {
      if (!this.noiseBuffer) return;
      const src = ctx.createBufferSource();
      src.buffer = this.noiseBuffer;
      const filter = ctx.createBiquadFilter();
      filter.type = 'highpass';
      filter.frequency.value = 3000;
      src.connect(filter);
      filter.connect(env);
      src.start(when, Math.random(), dur);
      src.stop(when + dur);
    } else {
      const osc = ctx.createOscillator();
      osc.type = wave;
      osc.frequency.value = midiHz(note);
      osc.connect(env);
      osc.start(when);
      osc.stop(when + dur + 0.02);
    }
  }

  // --- SFX -------------------------------------------------------------------

  playSfx(id: SfxId): void {
    const ctx = this.ctx;
    if (!ctx || !this.sfxBus) return; // pre-gesture: drop one-shots silently
    const fileUrl = overrideAudioUrl(id) ?? bundledAudioUrl(id);
    if (fileUrl) {
      void this.loadFile(ctx, id, fileUrl).then((buffer) => {
        if (!buffer || !this.sfxBus) return;
        const src = ctx.createBufferSource();
        src.buffer = buffer;
        src.connect(this.sfxBus);
        src.start();
      });
      return;
    }
    this.synthSfx(ctx, this.sfxBus, id);
  }

  /** One-shot synth recipes: tiny node graphs per effect id. */
  private synthSfx(ctx: AudioContext, out: GainNode, id: SfxId): void {
    const t = ctx.currentTime;
    const tone = (
      wave: OscillatorType,
      f0: number,
      f1: number,
      dur: number,
      vol: number,
      delay = 0,
    ): void => {
      const osc = ctx.createOscillator();
      const env = ctx.createGain();
      osc.type = wave;
      osc.frequency.setValueAtTime(f0, t + delay);
      osc.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + delay + dur);
      env.gain.setValueAtTime(vol, t + delay);
      env.gain.exponentialRampToValueAtTime(0.001, t + delay + dur);
      osc.connect(env);
      env.connect(out);
      osc.start(t + delay);
      osc.stop(t + delay + dur + 0.02);
    };
    const noise = (dur: number, vol: number, freq: number, delay = 0): void => {
      if (!this.noiseBuffer) return;
      const src = ctx.createBufferSource();
      src.buffer = this.noiseBuffer;
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = freq;
      const env = ctx.createGain();
      env.gain.setValueAtTime(vol, t + delay);
      env.gain.exponentialRampToValueAtTime(0.001, t + delay + dur);
      src.connect(filter);
      filter.connect(env);
      env.connect(out);
      src.start(t + delay, Math.random(), dur);
      src.stop(t + delay + dur);
    };
    switch (id) {
      case 'sfx_ui_click':
        tone('square', 880, 660, 0.05, 0.25);
        break;
      case 'sfx_verb':
        tone('square', 520, 780, 0.06, 0.22);
        break;
      case 'sfx_blip':
        tone('square', 1200, 1100, 0.02, 0.1);
        break;
      case 'sfx_chime':
        tone('triangle', 880, 880, 0.18, 0.3);
        tone('triangle', 1320, 1320, 0.24, 0.22, 0.09);
        break;
      case 'sfx_achievement':
        tone('square', 660, 660, 0.09, 0.25);
        tone('square', 880, 880, 0.09, 0.25, 0.09);
        tone('square', 1320, 1320, 0.2, 0.28, 0.18);
        break;
      case 'sfx_pickup':
        tone('triangle', 500, 950, 0.09, 0.3);
        break;
      case 'sfx_door':
        noise(0.22, 0.25, 900);
        tone('triangle', 180, 90, 0.22, 0.25);
        break;
      case 'sfx_hit':
        noise(0.1, 0.4, 2400);
        tone('square', 220, 90, 0.1, 0.3);
        break;
      case 'sfx_miss':
        noise(0.09, 0.18, 4000);
        break;
      case 'sfx_cast':
        tone('sawtooth', 300, 1400, 0.22, 0.2);
        break;
      case 'sfx_explosion':
        noise(0.7, 0.55, 700);
        tone('sine', 120, 35, 0.7, 0.5);
        break;
      case 'sfx_levelup':
        tone('square', 523, 523, 0.09, 0.26);
        tone('square', 659, 659, 0.09, 0.26, 0.09);
        tone('square', 784, 784, 0.09, 0.26, 0.18);
        tone('square', 1046, 1046, 0.24, 0.3, 0.27);
        break;
      case 'sfx_death':
        tone('sawtooth', 400, 60, 0.8, 0.3);
        noise(0.5, 0.2, 500, 0.1);
        break;
      case 'sfx_victory':
        tone('square', 587, 587, 0.1, 0.26);
        tone('square', 784, 784, 0.1, 0.26, 0.1);
        tone('square', 880, 880, 0.26, 0.3, 0.2);
        break;
      case 'sfx_defeat':
        tone('triangle', 440, 415, 0.2, 0.28);
        tone('triangle', 415, 330, 0.3, 0.28, 0.2);
        tone('triangle', 330, 220, 0.45, 0.3, 0.5);
        break;
      case 'sfx_rumble':
        noise(0.9, 0.3, 220);
        tone('sine', 70, 45, 0.9, 0.4);
        break;
      case 'sfx_machine':
        noise(1.1, 0.35, 480);
        tone('sawtooth', 90, 140, 1.1, 0.22);
        tone('square', 45, 60, 1.1, 0.25);
        break;
    }
  }

  // --- Cue-id plumbing (the P4 musicCue/sfxCue stubs) -----------------------

  musicCue(cueId: string): void {
    const mapped = CUE_MUSIC[cueId];
    if (!mapped) {
      this.warnOnce(`unmapped musicCue "${cueId}"`);
      return;
    }
    this.playMusic(mapped);
  }

  sfxCue(cueId: string): void {
    const mapped = CUE_SFX[cueId];
    if (!mapped) {
      this.warnOnce(`unmapped sfxCue "${cueId}"`);
      return;
    }
    this.playSfx(mapped);
  }

  private warnOnce(msg: string): void {
    if (this.warned.has(msg)) return;
    this.warned.add(msg);
    console.info(`[audio] ${msg}`);
  }
}

/** The one engine instance; imported anywhere a cue fires. */
export const audio = new AudioEngine();
