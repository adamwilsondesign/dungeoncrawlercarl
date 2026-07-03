/**
 * The narration message boxes, placed where the KQ5 narrator lived (bottom
 * third). One queue, three distinct voice channels (see
 * src/data/VOICE_BIBLE.md):
 * - announce: JUBILEE's live broadcast - widest box, amber, ON AIR tally.
 * - notify:   dungeon-interface pops - compact, right-anchored, cold green,
 *             machine-fast typewriter.
 * - describe: the ambient narrator - full-width, muted bone, no plate.
 * Externally-tagged speaker lines keep their classic gold plate styling.
 *
 * Typewriter reveal at a configurable chars/sec (elapsed-ms based); the
 * first advance completes the reveal, the second dismisses. show() resolves
 * on dismissal so the script runner can await it; queued messages play
 * back-to-back. The Typewriter + wrapText helpers are shared with the
 * dialogue box so all channels feel identical to drive.
 */

import type { VoiceChannel } from '../data/types';
import { drawPixelText, pixelTextWidth } from './assets';
import { audio } from './audio';
import { LOGICAL_W } from './renderer';

export function wrapText(text: string, maxChars: number): string[] {
  const lines: string[] = [];
  let line = '';
  for (const word of text.split(' ')) {
    let w = word;
    // Hard-break words that are longer than a full line.
    while (w.length > maxChars) {
      if (line) {
        lines.push(line);
        line = '';
      }
      lines.push(w.slice(0, maxChars));
      w = w.slice(maxChars);
    }
    if (!line) line = w;
    else if (line.length + 1 + w.length <= maxChars) line = `${line} ${w}`;
    else {
      lines.push(line);
      line = w;
    }
  }
  if (line) lines.push(line);
  return lines;
}

/** Elapsed-ms character reveal shared by narrator and dialogue boxes. */
export class Typewriter {
  private wrapped: string[] = [];
  private totalChars = 0;
  private elapsedMs = 0;
  private forced = false;
  private rate = 1;

  constructor(private readonly charsPerSec = 40) {}

  /** rate scales the reveal speed (the notify channel spits like a machine). */
  set(text: string, maxChars: number, rate = 1): void {
    this.wrapped = wrapText(text, maxChars);
    this.totalChars = this.wrapped.reduce((n, l) => n + l.length, 0);
    this.elapsedMs = 0;
    this.forced = false;
    this.rate = rate;
  }

  update(dtMs: number): void {
    this.elapsedMs += dtMs;
  }

  get lines(): readonly string[] {
    return this.wrapped;
  }

  revealedChars(): number {
    if (this.forced) return this.totalChars;
    return Math.min(
      this.totalChars,
      Math.floor((this.elapsedMs * this.charsPerSec * this.rate) / 1000),
    );
  }

  get fullyRevealed(): boolean {
    return this.revealedChars() >= this.totalChars;
  }

  /** Skip to the end of the reveal (first advance click). */
  complete(): void {
    this.forced = true;
  }

  /** Blink phase for the advance indicator. */
  get blinkOn(): boolean {
    return Math.floor(this.elapsedMs / 400) % 2 === 0;
  }

  /** Draw the revealed portion, one wrapped line at a time. */
  drawText(ctx: CanvasRenderingContext2D, x: number, y: number, lineH: number, color: string): void {
    let remaining = this.revealedChars();
    for (let i = 0; i < this.wrapped.length && remaining > 0; i++) {
      const line = this.wrapped[i];
      drawPixelText(ctx, line.slice(0, remaining), x, y + i * lineH, color);
      remaining -= line.length;
    }
  }
}

interface Message {
  text: string;
  /** Speaker tag for externally-tagged lines; overrides the channel plate. */
  speaker?: string;
  channel: VoiceChannel;
  resolve: () => void;
}

const BOX_BOTTOM = 192;
const PAD = 6;
const LINE_H = 7;

/** The dungeon AI's broadcast persona (plate name on every announce() box). */
export const AI_NAME = 'JUBILEE';

interface ChannelStyle {
  /** Horizontal margin from the screen edges. */
  margin: number;
  /** Fraction of the available width the panel occupies. */
  widthFrac: number;
  /** Which edge a sub-full-width panel hugs. */
  align: 'left' | 'right';
  bg: string;
  accent: string;
  text: string;
  /** Plate text; null = plateless (describe gets a small ellipsis nub). */
  plate: string | null;
  /** Typewriter speed multiplier. */
  rate: number;
  /** Broadcast dressing: blinking ON AIR tally + double border. */
  onAir: boolean;
}

const CHANNEL_STYLES: Record<VoiceChannel, ChannelStyle> = {
  // Live-broadcast game show: widest box, warm amber, ON AIR tally.
  announce: {
    margin: 3,
    widthFrac: 1,
    align: 'left',
    bg: '#1a0e03',
    accent: '#ffab2e',
    text: '#ffe9c9',
    plate: AI_NAME,
    rate: 1,
    onAir: true,
  },
  // Dungeon interface: compact right-anchored toast, cold green, machine-fast.
  notify: {
    margin: 6,
    widthFrac: 0.62,
    align: 'right',
    bg: '#03130c',
    accent: '#57e6a8',
    text: '#c9f5e2',
    plate: 'SYSTEM',
    rate: 3,
    onAir: false,
  },
  // Ambient narrator: classic full-width box in parchment/bone, no plate.
  describe: {
    margin: 6,
    widthFrac: 1,
    align: 'left',
    bg: '#141109',
    accent: '#b3a68a',
    text: '#e6ddc4',
    plate: null,
    rate: 1,
    onAir: false,
  },
};

/** Externally-tagged speaker lines keep the classic gold narrator styling. */
const SPEAKER_STYLE: ChannelStyle = {
  margin: 6,
  widthFrac: 1,
  align: 'left',
  bg: '#0a1120',
  accent: '#ffd166',
  text: '#d8ecff',
  plate: null, // plate text comes from the message's speaker tag
  rate: 1,
  onAir: false,
};

function styleFor(message: Message): ChannelStyle {
  return message.speaker ? SPEAKER_STYLE : CHANNEL_STYLES[message.channel];
}

function boxWidth(style: ChannelStyle): number {
  return Math.round((LOGICAL_W - style.margin * 2) * style.widthFrac);
}

export class NarratorBox {
  private readonly queue: Message[] = [];
  private current: Message | null = null;
  private readonly tw: Typewriter;
  private lastBlipAt = 0;

  constructor(charsPerSec = 40) {
    this.tw = new Typewriter(charsPerSec);
  }

  get active(): boolean {
    return this.current !== null;
  }

  /** Enqueue a message on a voice channel; resolves when dismissed. */
  show(text: string, speaker?: string, channel: VoiceChannel = 'describe'): Promise<void> {
    // Mirrored to the console for tooling, like the combat log.
    console.info(`[narrate:${speaker ? `say:${speaker}` : channel}] ${text.slice(0, 70)}`);
    return new Promise((resolve) => {
      this.queue.push({ text, speaker, channel, resolve });
      if (!this.current) this.next();
    });
  }

  private next(): void {
    this.current = this.queue.shift() ?? null;
    this.lastBlipAt = 0;
    if (this.current) {
      const style = styleFor(this.current);
      const maxChars = Math.floor((boxWidth(style) - PAD * 2) / 4);
      this.tw.set(this.current.text, maxChars, style.rate);
      audio.playSfx('sfx_chime');
    }
  }

  /** Instantly dismiss the current and all queued messages (cutscene skip). */
  skipAll(): void {
    const all = this.current ? [this.current, ...this.queue.splice(0)] : this.queue.splice(0);
    this.current = null;
    for (const message of all) message.resolve();
  }

  /** First advance completes the typewriter reveal; second dismisses. */
  advance(): void {
    if (!this.current) return;
    if (!this.tw.fullyRevealed) {
      this.tw.complete();
      return;
    }
    const finished = this.current;
    this.next();
    finished.resolve();
  }

  update(dtMs: number): void {
    if (!this.current) return;
    this.tw.update(dtMs);
    // Typewriter blip: one soft tick per few revealed characters.
    const revealed = this.tw.revealedChars();
    if (revealed >= this.lastBlipAt + 4 && !this.tw.fullyRevealed) {
      this.lastBlipAt = revealed;
      audio.playSfx('sfx_blip');
    }
  }

  render(ctx: CanvasRenderingContext2D): void {
    if (!this.current) return;
    const style = styleFor(this.current);
    const { accent } = style;
    const w = boxWidth(style);
    const plate = this.current.speaker ? this.current.speaker.toUpperCase() : style.plate;

    const h = 9 + this.tw.lines.length * LINE_H + PAD + (style.onAir ? 2 : 0);
    const x = style.align === 'right' ? LOGICAL_W - style.margin - w : style.margin;
    const y = BOX_BOTTOM - h;

    // Panel with accent border and an inner shadow line
    ctx.fillStyle = style.bg;
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = accent;
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    ctx.fillRect(x + 1, y + 1, w - 2, 1);
    if (style.onAir) {
      // Broadcast dressing: a second inner border line
      ctx.strokeStyle = 'rgba(255,171,46,0.35)';
      ctx.strokeRect(x + 2.5, y + 2.5, w - 5, h - 5);
    }

    if (plate) {
      // Plate tag overlapping the top border
      const tagW = pixelTextWidth(plate) + 6;
      ctx.fillStyle = accent;
      ctx.fillRect(x + 6, y - 4, tagW, 9);
      drawPixelText(ctx, plate, x + 9, y - 2, '#04121a');
    } else {
      // Plateless ambient narration: a small ellipsis nub on the border
      ctx.fillStyle = accent;
      for (let i = 0; i < 3; i++) ctx.fillRect(x + 8 + i * 4, y - 1, 2, 2);
    }

    if (style.onAir) {
      // Blinking broadcast tally on the right of the top border
      const label = 'ON AIR';
      const labelW = pixelTextWidth(label);
      const tx = x + w - labelW - 14;
      ctx.fillStyle = style.bg;
      ctx.fillRect(tx - 4, y - 4, labelW + 16, 9);
      ctx.strokeStyle = accent;
      ctx.strokeRect(tx - 3.5, y - 3.5, labelW + 15, 8);
      drawPixelText(ctx, label, tx + 6, y - 2, accent);
      ctx.fillStyle = this.tw.blinkOn ? '#ff4d4d' : '#5a1717';
      ctx.fillRect(tx, y - 1, 3, 3);
    }

    this.tw.drawText(ctx, x + PAD, y + 8 + (style.onAir ? 1 : 0), LINE_H, style.text);

    // Blinking advance indicator once fully revealed
    if (this.tw.fullyRevealed && this.tw.blinkOn) {
      const ax = x + w - 9;
      const ay = y + h - 6;
      ctx.fillStyle = accent;
      ctx.fillRect(ax, ay, 5, 1);
      ctx.fillRect(ax + 1, ay + 1, 3, 1);
      ctx.fillRect(ax + 2, ay + 2, 1, 1);
    }
  }
}
