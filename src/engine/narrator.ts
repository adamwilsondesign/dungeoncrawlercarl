/**
 * The AI narrator message box — the DCC "System AI" voice channel, placed
 * where the KQ5 narrator lived (bottom third). Typewriter reveal at a
 * configurable chars/sec (elapsed-ms based); the first advance completes the
 * reveal, the second dismisses. show() resolves on dismissal so the script
 * runner can await it; queued messages play back-to-back.
 */

import { drawPixelText, pixelTextWidth } from './assets';
import { LOGICAL_W } from './renderer';

interface Message {
  text: string;
  /** Speaker tag for say() lines; undefined = the SYSTEM narrator. */
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

function wrapText(text: string): string[] {
  const lines: string[] = [];
  let line = '';
  for (const word of text.split(' ')) {
    let w = word;
    // Hard-break words that are longer than a full line.
    while (w.length > MAX_CHARS) {
      if (line) {
        lines.push(line);
        line = '';
      }
      lines.push(w.slice(0, MAX_CHARS));
      w = w.slice(MAX_CHARS);
    }
    if (!line) line = w;
    else if (line.length + 1 + w.length <= MAX_CHARS) line = `${line} ${w}`;
    else {
      lines.push(line);
      line = w;
    }
  }
  if (line) lines.push(line);
  return lines;
}

export class NarratorBox {
  private readonly queue: Message[] = [];
  private current: Message | null = null;
  private lines: string[] = [];
  private totalChars = 0;
  private elapsedMs = 0;
  private forceComplete = false;

  constructor(private readonly charsPerSec = 40) {}

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
    this.elapsedMs = 0;
    this.forceComplete = false;
    if (this.current) {
      this.lines = wrapText(this.current.text);
      this.totalChars = this.lines.reduce((n, l) => n + l.length, 0);
    }
  }

  private revealedChars(): number {
    if (this.forceComplete) return this.totalChars;
    return Math.min(this.totalChars, Math.floor((this.elapsedMs * this.charsPerSec) / 1000));
  }

  get fullyRevealed(): boolean {
    return this.revealedChars() >= this.totalChars;
  }

  /** First advance completes the typewriter reveal; second dismisses. */
  advance(): void {
    if (!this.current) return;
    if (!this.fullyRevealed) {
      this.forceComplete = true;
      return;
    }
    const finished = this.current;
    this.next();
    finished.resolve();
  }

  update(dtMs: number): void {
    if (this.current) this.elapsedMs += dtMs;
  }

  render(ctx: CanvasRenderingContext2D): void {
    if (!this.current) return;
    const accent = this.current.speaker ? SPEAKER_ACCENT : SYSTEM_ACCENT;
    const tag = (this.current.speaker ?? 'SYSTEM').toUpperCase();

    const h = 9 + this.lines.length * LINE_H + PAD;
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

    // Revealed text
    let remaining = this.revealedChars();
    for (let i = 0; i < this.lines.length && remaining > 0; i++) {
      const line = this.lines[i];
      const shown = line.slice(0, remaining);
      drawPixelText(ctx, shown, x + PAD, y + 8 + i * LINE_H, TEXT_COLOR);
      remaining -= line.length;
    }

    // Blinking advance indicator once fully revealed
    if (this.fullyRevealed && Math.floor(this.elapsedMs / 400) % 2 === 0) {
      const ax = x + BOX_W - 9;
      const ay = y + h - 6;
      ctx.fillStyle = accent;
      ctx.fillRect(ax, ay, 5, 1);
      ctx.fillRect(ax + 1, ay + 1, 3, 1);
      ctx.fillRect(ax + 2, ay + 2, 1, 1);
    }
  }
}
