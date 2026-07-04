/**
 * The narration boxes - P20: DOM overlay rendering at native resolution,
 * one queue, three voice channels with per-channel docking (Task 5 rules):
 * - announce: The Crawl AI broadcast - LARGE, top-center just below the nav,
 *   full-width across the play area, amber broadcast border + ON AIR tally,
 *   VT323 at 20px.
 * - notify:   interface pops - compact, top-right below the nav, cold green,
 *   VT323 at 18px, machine-fast reveal, AUTO-DISMISSES (~2.4s after the
 *   reveal) so interface chatter never demands a click; any advance input
 *   still dismisses early.
 * - describe: ambient narrator - bottom dock, parchment on dark, Pixelify
 *   at 15px. Speaker-tagged lines share the bottom dock with a gold plate.
 *
 * The queue/advance semantics are unchanged: show() resolves on dismissal,
 * the first advance completes the typewriter reveal, the second dismisses.
 * update() ticks the reveal off the game loop's clock. render() is a no-op
 * kept for call-site compatibility (nothing draws to canvas anymore).
 */

import type { VoiceChannel } from '../data/types';
import { audio } from './audio';
import { TopNav } from './iconbar';
import { el, type UiLayer } from './ui';

/** Word-wrap helper retained for canvas consumers (menu body text). */
export function wrapText(text: string, maxChars: number): string[] {
  const lines: string[] = [];
  let line = '';
  for (const word of text.split(' ')) {
    let w = word;
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

/** Elapsed-ms character reveal (pacing only; wrapping is CSS-native now). */
export class Typewriter {
  private text = '';
  private elapsedMs = 0;
  private forced = false;
  private rate = 1;

  constructor(private readonly charsPerSec = 40) {}

  set(text: string, rate = 1): void {
    this.text = text;
    this.elapsedMs = 0;
    this.forced = false;
    this.rate = rate;
  }

  update(dtMs: number): void {
    this.elapsedMs += dtMs;
  }

  get full(): string {
    return this.text;
  }

  revealedChars(): number {
    if (this.forced) return this.text.length;
    return Math.min(this.text.length, Math.floor((this.elapsedMs * this.charsPerSec * this.rate) / 1000));
  }

  revealed(): string {
    return this.text.slice(0, this.revealedChars());
  }

  get fullyRevealed(): boolean {
    return this.revealedChars() >= this.text.length;
  }

  complete(): void {
    this.forced = true;
  }

  get blinkOn(): boolean {
    return Math.floor(this.elapsedMs / 400) % 2 === 0;
  }
}

interface Message {
  text: string;
  speaker?: string;
  channel: VoiceChannel;
  resolve: () => void;
}

/** The broadcast speaker plate on every announce() box. */
export const AI_NAME = 'THE CRAWL AI';

/** notify() lingers this long after its reveal, then dismisses itself. */
const NOTIFY_LINGER_MS = 2400;

interface ChannelDom {
  box: HTMLDivElement;
  plate: HTMLSpanElement | null;
  text: HTMLDivElement;
  more: HTMLSpanElement;
}

export class NarratorBox {
  private readonly queue: Message[] = [];
  private current: Message | null = null;
  private readonly tw: Typewriter;
  private lastBlipAt = 0;
  private notifyLingerMs = 0;
  private readonly dom: Record<'announce' | 'notify' | 'describe' | 'speaker', ChannelDom>;
  private shown: ChannelDom | null = null;

  constructor(ui: UiLayer, charsPerSec = 40) {
    this.tw = new Typewriter(charsPerSec);
    const host = ui.layer('narrator');
    this.dom = {
      announce: buildBox(host, {
        css:
          `top:${TopNav.HEIGHT + 12}px;left:12px;right:12px;` +
          'background:var(--dcc-amber-bg);border:2px solid var(--dcc-amber);' +
          'box-shadow:inset 0 0 0 2px rgba(255,171,46,0.25);' +
          'font-family:var(--dcc-font-ai);font-size:20px;color:var(--dcc-amber-text)',
        plate: AI_NAME,
        plateCss: 'background:var(--dcc-amber);color:#180d02',
        onAir: true,
      }),
      notify: buildBox(host, {
        css:
          `top:${TopNav.HEIGHT + 12}px;right:12px;max-width:46%;` +
          'background:var(--dcc-notify-bg);border:1px solid var(--dcc-notify);' +
          'font-family:var(--dcc-font-ai);font-size:18px;color:var(--dcc-notify-text)',
        plate: 'SYSTEM',
        plateCss: 'background:var(--dcc-notify);color:#04140b',
        onAir: false,
      }),
      describe: buildBox(host, {
        css:
          'bottom:8px;left:8px;right:8px;' +
          'background:var(--dcc-parchment-bg);border:2px solid var(--dcc-parchment);' +
          'font-family:var(--dcc-font-ui);font-size:15px;color:var(--dcc-parchment-text)',
        plate: null,
        plateCss: '',
        onAir: false,
      }),
      speaker: buildBox(host, {
        css:
          'bottom:8px;left:8px;right:8px;' +
          'background:#0a1120;border:2px solid var(--dcc-gold);' +
          'font-family:var(--dcc-font-ui);font-size:15px;color:var(--dcc-text-primary)',
        plate: '',
        plateCss: 'background:var(--dcc-gold);color:#081018',
        onAir: false,
      }),
    };
    // Clicking any narration box advances it (same as clicking the world).
    for (const dom of Object.values(this.dom)) {
      dom.box.addEventListener('mousedown', () => this.advance());
    }
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
    this.hideShown();
    this.current = this.queue.shift() ?? null;
    this.lastBlipAt = 0;
    this.notifyLingerMs = 0;
    if (!this.current) return;
    const message = this.current;
    const kind = message.speaker ? 'speaker' : message.channel;
    const dom = this.dom[kind];
    if (message.speaker && dom.plate) dom.plate.textContent = message.speaker.toUpperCase();
    const rate = message.channel === 'notify' && !message.speaker ? 3 : 1;
    this.tw.set(message.text, rate);
    dom.text.textContent = '';
    dom.more.style.visibility = 'hidden';
    dom.box.style.display = 'block';
    this.shown = dom;
    audio.playSfx('sfx_chime');
  }

  private hideShown(): void {
    if (this.shown) {
      this.shown.box.style.display = 'none';
      this.shown = null;
    }
  }

  /** Instantly dismiss the current and all queued messages (cutscene skip). */
  skipAll(): void {
    const all = this.current ? [this.current, ...this.queue.splice(0)] : this.queue.splice(0);
    this.current = null;
    this.hideShown();
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
    const message = this.current;
    const dom = this.shown;
    if (!message || !dom) return;
    this.tw.update(dtMs);
    const revealed = this.tw.revealed();
    if (dom.text.textContent !== revealed) dom.text.textContent = revealed;
    const done = this.tw.fullyRevealed;
    dom.more.style.visibility = done ? 'visible' : 'hidden';
    // Typewriter blip: one soft tick per few revealed characters.
    if (!done && revealed.length >= this.lastBlipAt + 4) {
      this.lastBlipAt = revealed.length;
      audio.playSfx('sfx_blip');
    }
    // Interface pops dismiss themselves; chatter never demands a click.
    if (done && message.channel === 'notify' && !message.speaker) {
      this.notifyLingerMs += dtMs;
      if (this.notifyLingerMs >= NOTIFY_LINGER_MS) {
        const finished = message;
        this.next();
        finished.resolve();
      }
    }
  }

  /** Legacy no-op: narration is DOM now. */
  render(ctx: CanvasRenderingContext2D): void {
    void ctx;
  }
}

function buildBox(
  host: HTMLElement,
  spec: { css: string; plate: string | null; plateCss: string; onAir: boolean },
): ChannelDom {
  const box = el(
    'div',
    'position:absolute;display:none;padding:14px 16px 12px;pointer-events:auto;cursor:auto;' + spec.css,
  );
  let plate: HTMLSpanElement | null = null;
  if (spec.plate !== null) {
    plate = el(
      'span',
      'position:absolute;top:-12px;left:12px;padding:1px 10px;font-size:14px;' +
        'font-weight:700;letter-spacing:1px;font-family:inherit;' + spec.plateCss,
      spec.plate,
    );
    box.appendChild(plate);
  } else {
    box.appendChild(
      el(
        'span',
        'position:absolute;top:-9px;left:12px;letter-spacing:3px;color:var(--dcc-parchment);font-size:12px',
        '...',
      ),
    );
  }
  if (spec.onAir) {
    const tally = el(
      'span',
      'position:absolute;top:-12px;right:12px;display:flex;align-items:center;gap:6px;' +
        'padding:1px 10px;font-size:14px;background:var(--dcc-amber-bg);' +
        'border:1px solid var(--dcc-amber);color:var(--dcc-amber);font-family:inherit',
    );
    tally.append(
      el('span', 'width:8px;height:8px;background:var(--dcc-danger);animation:dcc-blink 0.8s infinite'),
      el('span', '', 'ON AIR'),
    );
    box.appendChild(tally);
  }
  const text = el('div', 'white-space:pre-wrap');
  const more = el(
    'span',
    'position:absolute;right:10px;bottom:2px;visibility:hidden;font-family:inherit;' +
      'animation:dcc-blink 0.8s infinite;font-size:0.9em',
    '▼',
  );
  box.append(text, more);
  host.appendChild(box);
  return { box, plate, text, more };
}
