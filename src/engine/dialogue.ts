/**
 * KQ5-style dialogue: a portrait + name-plate box for character lines
 * (reusing the narrator's Typewriter so pacing feels identical), a choice
 * menu (mouse + keyboard), and a hub-and-spoke DialogueTree player that runs
 * node side effects through the shared script runner.
 */

import type { ScriptAction } from '../data/script';
import type { CharacterDef, DialogueChoice, DialogueTree, Point } from '../data/types';
import {
  drawPixelText,
  loadImage,
  pixelTextWidth,
  PORTRAIT_SIZE,
  type LoadedImage,
} from './assets';
import { Typewriter } from './narrator';
import { checkFlagCondition, type GameState } from './state';

// ---------------------------------------------------------------------------
// DialogueBox
// ---------------------------------------------------------------------------

export interface DialogueSpeaker {
  name: string;
  color: string;
  portrait: LoadedImage;
  side: 'left' | 'right';
}

const BOX_X = 6;
const BOX_W = 308;
const BOX_H = 56;
const BOX_Y = 134;
const PAD = 6;
const LINE_H = 9;
/** Text column width beside the portrait. */
const TEXT_MAX_CHARS = Math.floor((BOX_W - PORTRAIT_SIZE - PAD * 3 - 2) / 4);
/** Wrapped text lines visible at once in line mode (bug 2: scroll the rest). */
const LINE_VISIBLE = 4;
const CHOICE_ROW_H = 9;
const CHOICE_VISIBLE = 5;
/** Story-advancing choices (advances: true) read green (bug 4). */
const CHOICE_ADVANCE = '#7de08a';
const CHOICE_ADVANCE_LIT = '#b6f7c8';

const PANEL_BG = '#0d1322';
const TEXT_COLOR = '#e6eeff';
const CHOICE_DIM = '#8fa3c4';
const CHOICE_LIT = '#ffe9a8';

export interface ChoiceView {
  text: string;
  /** Renders green: this option moves the story forward (bug 4). */
  advances: boolean;
}

type Mode =
  | { kind: 'idle' }
  | { kind: 'line'; speaker: DialogueSpeaker; resolve: () => void; scroll: number; pinned: boolean }
  | { kind: 'choices'; options: ChoiceView[]; selected: number; scroll: number; resolve: (i: number) => void };

export class DialogueBox {
  private mode: Mode = { kind: 'idle' };
  private readonly tw = new Typewriter(40);
  private lastHover: Point = { x: -1, y: -1 };

  get active(): boolean {
    return this.mode.kind !== 'idle';
  }

  /** Show one character line; resolves when the player advances past it. */
  showLine(speaker: DialogueSpeaker, text: string): Promise<void> {
    return new Promise((resolve) => {
      this.tw.set(text, TEXT_MAX_CHARS);
      this.mode = { kind: 'line', speaker, resolve, scroll: 0, pinned: false };
    });
  }

  /** Show a choice menu; resolves with the chosen option index (-2 = dismissed). */
  showChoices(options: ChoiceView[]): Promise<number> {
    return new Promise((resolve) => {
      this.mode = { kind: 'choices', options, selected: 0, scroll: 0, resolve };
    });
  }

  update(dtMs: number): void {
    if (this.mode.kind !== 'line') return;
    this.tw.update(dtMs);
    // Auto-follow the reveal to the newest line unless the player scrolled.
    if (!this.mode.pinned) {
      this.mode.scroll = Math.max(0, this.revealedLines() - LINE_VISIBLE);
    }
  }

  /** How many wrapped lines have at least one revealed character. */
  private revealedLines(): number {
    let remaining = this.tw.revealedChars();
    let count = 0;
    for (const line of this.tw.lines) {
      if (remaining <= 0) break;
      count++;
      remaining -= line.length;
    }
    return count;
  }

  private maxLineScroll(): number {
    return Math.max(0, this.tw.lines.length - LINE_VISIBLE);
  }

  /** Wheel/arrow scrolling (bug 2/3): lines pin, choices window-scroll. */
  scrollBy(delta: number): void {
    if (this.mode.kind === 'line') {
      this.mode.scroll = Math.max(0, Math.min(this.maxLineScroll(), this.mode.scroll + delta));
      this.mode.pinned = true;
      return;
    }
    if (this.mode.kind === 'choices') {
      const m = this.mode;
      const max = Math.max(0, m.options.length - CHOICE_VISIBLE);
      m.scroll = Math.max(0, Math.min(max, m.scroll + delta));
    }
  }

  /**
   * ESC / click-outside on a choice menu dismisses it (bug 6): resolves -2,
   * which the player routes to the tree's end node. Line mode is untouched.
   */
  cancel(): boolean {
    if (this.mode.kind !== 'choices') return false;
    const { resolve } = this.mode;
    this.mode = { kind: 'idle' };
    resolve(-2);
    return true;
  }

  /** Click/space in line mode: complete reveal, then advance. */
  advanceIntent(): void {
    if (this.mode.kind !== 'line') return;
    if (!this.tw.fullyRevealed) {
      this.tw.complete();
      return;
    }
    const { resolve } = this.mode;
    this.mode = { kind: 'idle' };
    resolve();
  }

  moveSelection(delta: number): void {
    if (this.mode.kind === 'line') {
      this.scrollBy(delta);
      return;
    }
    if (this.mode.kind !== 'choices') return;
    const m = this.mode;
    m.selected = Math.max(0, Math.min(m.options.length - 1, m.selected + delta));
    if (m.selected < m.scroll) m.scroll = m.selected;
    if (m.selected >= m.scroll + CHOICE_VISIBLE) m.scroll = m.selected - CHOICE_VISIBLE + 1;
  }

  /** Enter: confirm choice, or advance a line. */
  confirm(): void {
    if (this.mode.kind === 'choices') {
      const { resolve, selected } = this.mode;
      this.mode = { kind: 'idle' };
      resolve(selected);
      return;
    }
    this.advanceIntent();
  }

  /** Update the highlighted choice from the mouse (only when it moves). */
  hover(p: Point): void {
    const moved = p.x !== this.lastHover.x || p.y !== this.lastHover.y;
    this.lastHover = { x: p.x, y: p.y };
    if (!moved || this.mode.kind !== 'choices') return;
    const row = this.rowAt(p);
    if (row !== null) this.mode.selected = row;
  }

  click(p: Point): void {
    if (this.mode.kind === 'line') {
      this.advanceIntent();
      return;
    }
    if (this.mode.kind === 'choices') {
      const row = this.rowAt(p);
      if (row !== null) {
        this.mode.selected = row;
        this.confirm();
        return;
      }
      // Click outside the panel dismisses the menu (bug 6).
      const inside =
        p.x >= BOX_X && p.x < BOX_X + BOX_W && p.y >= BOX_Y - 6 && p.y < BOX_Y + BOX_H;
      if (!inside) this.cancel();
    }
  }

  /**
   * Cutscene skip: resolve whatever is pending. A pending choice resolves
   * with -1, which the player treats as "route via the node's goto".
   */
  forceResolveAll(): void {
    if (this.mode.kind === 'line') {
      const { resolve } = this.mode;
      this.mode = { kind: 'idle' };
      resolve();
    } else if (this.mode.kind === 'choices') {
      const { resolve } = this.mode;
      this.mode = { kind: 'idle' };
      resolve(-1);
    }
  }

  /** Visible option row (absolute index) under a point, or null. */
  private rowAt(p: Point): number | null {
    if (this.mode.kind !== 'choices') return null;
    const m = this.mode;
    const y0 = BOX_Y + 8;
    if (p.x < BOX_X + 4 || p.x >= BOX_X + BOX_W - 4) return null;
    const row = Math.floor((p.y - y0) / CHOICE_ROW_H);
    if (row < 0 || row >= CHOICE_VISIBLE) return null;
    const index = m.scroll + row;
    return index < m.options.length ? index : null;
  }

  render(ctx: CanvasRenderingContext2D): void {
    if (this.mode.kind === 'idle') return;

    const accent = this.mode.kind === 'line' ? this.mode.speaker.color : CHOICE_LIT;
    ctx.fillStyle = PANEL_BG;
    ctx.fillRect(BOX_X, BOX_Y, BOX_W, BOX_H);
    ctx.strokeStyle = accent;
    ctx.lineWidth = 1;
    ctx.strokeRect(BOX_X + 0.5, BOX_Y + 0.5, BOX_W - 1, BOX_H - 1);
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    ctx.fillRect(BOX_X + 1, BOX_Y + 1, BOX_W - 2, 1);

    if (this.mode.kind === 'line') {
      const { speaker } = this.mode;
      const onLeft = speaker.side !== 'right';
      const px = onLeft ? BOX_X + 4 : BOX_X + BOX_W - PORTRAIT_SIZE - 4;
      const tx = onLeft ? BOX_X + PORTRAIT_SIZE + PAD + 4 : BOX_X + PAD;

      ctx.drawImage(speaker.portrait, px, BOX_Y + 4, PORTRAIT_SIZE, PORTRAIT_SIZE);
      ctx.strokeStyle = speaker.color;
      ctx.strokeRect(px + 0.5, BOX_Y + 4.5, PORTRAIT_SIZE - 1, PORTRAIT_SIZE - 1);

      // Name plate on the top border, portrait side
      const plateW = pixelTextWidth(speaker.name) + 6;
      const plateX = onLeft ? BOX_X + 4 : BOX_X + BOX_W - plateW - 4;
      ctx.fillStyle = speaker.color;
      ctx.fillRect(plateX, BOX_Y - 6, plateW, 12);
      drawPixelText(ctx, speaker.name, plateX + 3, BOX_Y - 4, '#081018');

      const scroll = this.mode.scroll;
      this.tw.drawText(ctx, tx, BOX_Y + 10, LINE_H, TEXT_COLOR, scroll, LINE_VISIBLE);
      // Scroll indicators (bug 2): triangles when clipped above/below.
      const arrowX = onLeft ? BOX_X + BOX_W - 10 : BOX_X + 4;
      if (scroll > 0) this.drawArrow(ctx, arrowX, BOX_Y + 8, 'up', speaker.color);
      if (scroll < this.maxLineScroll()) {
        this.drawArrow(ctx, arrowX, BOX_Y + BOX_H - 14, 'down', speaker.color);
      }

      if (this.tw.fullyRevealed && this.tw.blinkOn) {
        const ax = onLeft ? BOX_X + BOX_W - 9 : BOX_X + 6;
        const ay = BOX_Y + BOX_H - 6;
        ctx.fillStyle = speaker.color;
        ctx.fillRect(ax, ay, 5, 1);
        ctx.fillRect(ax + 1, ay + 1, 3, 1);
        ctx.fillRect(ax + 2, ay + 2, 1, 1);
      }
      return;
    }

    // Choice menu
    const m = this.mode;
    const y0 = BOX_Y + 8;
    for (let row = 0; row < CHOICE_VISIBLE; row++) {
      const index = m.scroll + row;
      if (index >= m.options.length) break;
      const option = m.options[index];
      const selected = index === m.selected;
      const y = y0 + row * CHOICE_ROW_H;
      if (selected) {
        ctx.fillStyle = option.advances ? 'rgba(125,224,138,0.12)' : 'rgba(255,233,168,0.12)';
        ctx.fillRect(BOX_X + 4, y - 1, BOX_W - 8, CHOICE_ROW_H);
        drawPixelText(ctx, '>', BOX_X + 8, y, option.advances ? CHOICE_ADVANCE_LIT : CHOICE_LIT);
      }
      const color = option.advances
        ? selected
          ? CHOICE_ADVANCE_LIT
          : CHOICE_ADVANCE
        : selected
          ? CHOICE_LIT
          : CHOICE_DIM;
      drawPixelText(ctx, option.text, BOX_X + 16, y, color);
    }
    // Explicit scroll affordance (bug 3): triangles when options overflow.
    if (m.scroll > 0) this.drawArrow(ctx, BOX_X + BOX_W - 10, y0, 'up', CHOICE_LIT);
    if (m.scroll + CHOICE_VISIBLE < m.options.length) {
      this.drawArrow(ctx, BOX_X + BOX_W - 10, y0 + (CHOICE_VISIBLE - 1) * CHOICE_ROW_H + 2, 'down', CHOICE_LIT);
    }
  }

  /** Tiny 5px triangle glyph used by both scroll affordances. */
  private drawArrow(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    dir: 'up' | 'down',
    color: string,
  ): void {
    ctx.fillStyle = color;
    for (let i = 0; i < 3; i++) {
      const w = dir === 'up' ? i * 2 + 1 : 5 - i * 2;
      const off = dir === 'up' ? 2 - i : i;
      ctx.fillRect(x + off, y + i, Math.max(1, w), 1);
    }
  }
}

// ---------------------------------------------------------------------------
// DialoguePlayer
// ---------------------------------------------------------------------------

function onceKey(treeId: string, nodeId: string, choiceIndex: number): string {
  return `dlg:${treeId}:${nodeId}:choice${choiceIndex}`;
}

export interface DialoguePlayerDeps {
  trees: Record<string, DialogueTree>;
  characters: Record<string, CharacterDef>;
  state: GameState;
  box: DialogueBox;
  runScript: (actions: readonly ScriptAction[]) => Promise<void>;
  /** Room-actor fallback for speakers missing from the character registry. */
  fallbackCharacter: (id: string) => { name: string; color: string } | null;
  /** True while a cutscene is being fast-forwarded: lines are skipped. */
  isSkipping: () => boolean;
}

export class DialoguePlayer {
  constructor(private readonly deps: DialoguePlayerDeps) {}

  /** One-line dialogue (the say() action). */
  async say(speakerId: string, text: string, expression = 'neutral'): Promise<void> {
    if (this.deps.isSkipping()) return;
    const speaker = await this.speakerView(speakerId, expression);
    await this.deps.box.showLine(speaker, text);
  }

  /** Play a tree from its entry node until a route hits 'end'. */
  async play(treeId: string): Promise<void> {
    const { trees, state, box } = this.deps;
    const tree = trees[treeId];
    if (!tree) {
      console.warn(`[dialogue] unknown tree "${treeId}"`);
      return;
    }

    let nodeId = tree.entry;
    let guard = 0;
    while (nodeId !== 'end') {
      if (++guard > 200) {
        console.warn(`[dialogue] "${treeId}" exceeded 200 node visits — bailing out`);
        return;
      }
      const node = tree.nodes[nodeId];
      if (!node) {
        console.warn(`[dialogue] "${treeId}" has no node "${nodeId}"`);
        return;
      }

      if (node.onEnter) await this.deps.runScript(node.onEnter);
      for (const line of node.lines) {
        await this.say(line.speakerId, line.text, line.expression ?? 'neutral');
      }

      const visible = (node.choices ?? [])
        .map((choice, index) => ({ choice, index }))
        .filter(({ choice, index }) => this.choiceVisible(tree.id, nodeId, choice, index));

      // Skip mode never presents choices; route via the node's goto.
      if (visible.length > 0 && !this.deps.isSkipping()) {
        const picked = await box.showChoices(
          visible.map((v) => ({ text: v.choice.text, advances: v.choice.advances === true })),
        );
        if (picked === -2) {
          // ESC / click-outside dismissal (bug 6): leave via the end node.
          nodeId = 'end';
          continue;
        }
        if (picked < 0) {
          // Force-resolved mid-menu by a cutscene skip.
          nodeId = node.goto ?? 'end';
          continue;
        }
        const { choice, index } = visible[picked];
        if (choice.once) state.setFlag(onceKey(tree.id, nodeId, index), true);
        nodeId = choice.goto;
      } else {
        nodeId = node.goto ?? 'end';
      }
    }
  }

  private choiceVisible(
    treeId: string,
    nodeId: string,
    choice: DialogueChoice,
    index: number,
  ): boolean {
    const { state } = this.deps;
    if (choice.showIf && !checkFlagCondition(state, choice.showIf)) return false;
    if (choice.once && state.getFlag(onceKey(treeId, nodeId, index))) return false;
    return true;
  }

  private async speakerView(id: string, expression: string): Promise<DialogueSpeaker> {
    const def = this.deps.characters[id];
    const fallback = def ? null : this.deps.fallbackCharacter(id);
    const name = def?.name ?? fallback?.name ?? id.toUpperCase();
    const color = def?.color ?? fallback?.color ?? '#9aa7b8';
    const expressions = def?.portrait.expressions ?? ['neutral'];
    const expr = expressions.includes(expression) ? expression : 'neutral';
    const portrait = await loadImage(`ui/portrait_${id}_${expr}.png`, {
      kind: 'portrait',
      label: name,
      color,
      expression: expr,
    });
    return { name, color, portrait, side: def?.portraitSide ?? 'left' };
  }
}
