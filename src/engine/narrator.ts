/**
 * The AI narrator message box — the DCC "System AI" voice channel, placed
 * where the KQ5 narrator lived (bottom third). Typewriter reveal at a
 * configurable chars/sec (elapsed-ms based); the first advance completes the
 * reveal, the second dismisses. show() resolves on dismissal so the script
 * runner can await it; queued messages play back-to-back.
 *
 * The Typewriter + wrapText helpers are shared with the dialogue box so both
 * channels feel identical.
 */

import { drawPixelText, pixelTextWidth } from './assets';
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

  constructor(private readonly charsPerSec = 40) {}

  set(text: string, maxChars: number): void {
    this.wrapped = wrapText(text, maxChars);
    this.totalChars = this.wrapped.reduce((n, l) => n + l.length, 0);
    this.elapsedMs = 0;
    this.forced = false;
  }

  update(dtMs: number): void {
    this.elapsedMs += dtMs;
  }

  get lines(): readonly string[] {
    return this.wrapped;
  }

  revealedChars(): number {
    if (this.forced) return this.totalChars;
    return Math.min(this.totalChars, Math.floor((this.elapsedMs * this.charsPerSec) / 1000));
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
  /** Speaker tag for externally-tagged lines; undefined = the SYSTEM narrator. */
  speaker?: string;
  resolve: () => void;
}

const MARGIN = 6;
const BOX_W = LOGICAL_W - MARGIN * 2;
const BOX_BOTTOM = 192;
const PAD = 6;
const LINE_H = 7;
const MAX_CHARS = Math.floor((BOX_W - PAD * 2) / 4);

const SYSTEM_ACCENT = '#3fd9ff';
const SPEAKER_ACCENT = '#ffd166';
const PANEL_BG = '#0a1120';
const TEXT_COLOR = '#d8ecff';

export class NarratorBox {
  private readonly queue: Message[] = [];
  private current: Message | null = null;
  private readonly tw: Typewriter;

  constructor(charsPerSec = 40) {
    this.tw = new Typewriter(charsPerSec);
  }

  get active(): boolean {
    return this.current !== null;
  }

  /** Enqueue a message; resolves when the player dismisses it. */
  show(text: string, speaker?: string): Promise<void> {
    return new Promise((resolve) => {
      this.queue.push({ text, speaker, resolve });
      if (!this.current) this.next();
    });
  }

  private next(): void {
    this.current = this.queue.shift() ?? null;
    if (this.current) this.tw.set(this.current.text, MAX_CHARS);
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
    if (this.current) this.tw.update(dtMs);
  }

  render(ctx: CanvasRenderingContext2D): void {
    if (!this.current) return;
    const accent = this.current.speaker ? SPEAKER_ACCENT : SYSTEM_ACCENT;
    const tag = (this.current.speaker ?? 'SYSTEM').toUpperCase();

    const h = 9 + this.tw.lines.length * LINE_H + PAD;
    const x = MARGIN;
    const y = BOX_BOTTOM - h;

    // Panel with accent border and an inner shadow line
    ctx.fillStyle = PANEL_BG;
    ctx.fillRect(x, y, BOX_W, h);
    ctx.strokeStyle = accent;
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 0.5, y + 0.5, BOX_W - 1, h - 1);
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    ctx.fillRect(x + 1, y + 1, BOX_W - 2, 1);

    // Speaker tag overlapping the top border
    const tagW = pixelTextWidth(tag) + 6;
    ctx.fillStyle = accent;
    ctx.fillRect(x + 6, y - 4, tagW, 9);
    drawPixelText(ctx, tag, x + 9, y - 2, '#04121a');

    this.tw.drawText(ctx, x + PAD, y + 8, LINE_H, TEXT_COLOR);

    // Blinking advance indicator once fully revealed
    if (this.tw.fullyRevealed && this.tw.blinkOn) {
      const ax = x + BOX_W - 9;
      const ay = y + h - 6;
      ctx.fillStyle = accent;
      ctx.fillRect(ax, ay, 5, 1);
      ctx.fillRect(ax + 1, ay + 1, 3, 1);
      ctx.fillRect(ax + 2, ay + 2, 1, 1);
    }
  }
}
