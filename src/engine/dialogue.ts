/**
 * KQ5-style dialogue - P20: DOM overlay rendering. A bottom-docked panel
 * with a pixelated portrait, gold name plate, and typewriter text (Pixelify
 * at 15px, natively scrollable when long); choice menus render as a real
 * scrollable list with chevron indicators, hover/click selection, green
 * story-advancing options, and ESC / click-outside dismissal (resolves -2,
 * routed to the tree's end node by the player).
 *
 * Keyboard input still flows through RoomScene's update (moveSelection /
 * confirm / scrollBy / cancel); DOM handles pointer interaction directly.
 */

import type { ScriptAction } from '../data/script';
import type { CharacterDef, DialogueChoice, DialogueTree, Point } from '../data/types';
import { loadImage, type LoadedImage } from './assets';
import { Typewriter } from './narrator';
import { checkFlagCondition, type GameState } from './state';
import { el, type UiLayer } from './ui';

// ---------------------------------------------------------------------------
// DialogueBox
// ---------------------------------------------------------------------------

export interface DialogueSpeaker {
  name: string;
  color: string;
  portrait: LoadedImage;
  side: 'left' | 'right';
}

export interface ChoiceView {
  text: string;
  /** Renders green: this option moves the story forward. */
  advances: boolean;
}

type Mode =
  | { kind: 'idle' }
  | { kind: 'line'; speaker: DialogueSpeaker; resolve: () => void; pinned: boolean }
  | { kind: 'choices'; options: ChoiceView[]; selected: number; resolve: (i: number) => void };

export class DialogueBox {
  private mode: Mode = { kind: 'idle' };
  private readonly tw = new Typewriter(40);

  private readonly box: HTMLDivElement;
  private readonly plate: HTMLSpanElement;
  private readonly portraitCanvas: HTMLCanvasElement;
  private readonly textWrap: HTMLDivElement;
  private readonly textEl: HTMLDivElement;
  private readonly more: HTMLSpanElement;
  private readonly choicesWrap: HTMLDivElement;
  private readonly choicesList: HTMLDivElement;
  private readonly chevronUp: HTMLDivElement;
  private readonly chevronDown: HTMLDivElement;

  constructor(ui: UiLayer) {
    this.box = el(
      'div',
      'position:absolute;left:8px;right:8px;bottom:8px;display:none;' +
        'background:var(--dcc-bg-panel);border:2px solid var(--dcc-gold);' +
        'padding:14px 16px 12px;pointer-events:auto;cursor:auto',
    );
    this.plate = el(
      'span',
      'position:absolute;top:-12px;left:12px;padding:1px 10px;font-size:14px;font-weight:700;' +
        'letter-spacing:1px;background:var(--dcc-gold);color:#081018',
    );

    const row = el('div', 'display:flex;gap:14px;align-items:flex-start');
    this.portraitCanvas = document.createElement('canvas');
    this.portraitCanvas.width = 48;
    this.portraitCanvas.height = 48;
    this.portraitCanvas.style.cssText =
      'width:96px;height:96px;image-rendering:pixelated;border:1px solid var(--dcc-border);flex:none';
    this.textWrap = el('div', 'flex:1;max-height:120px;overflow-y:auto;min-width:0');
    this.textWrap.className = 'dcc-scroll';
    this.textEl = el('div', 'font-size:15px;white-space:pre-wrap;color:var(--dcc-text-primary)');
    this.textWrap.appendChild(this.textEl);
    row.append(this.portraitCanvas, this.textWrap);

    this.more = el(
      'span',
      'position:absolute;right:12px;bottom:4px;visibility:hidden;animation:dcc-blink 0.8s infinite;' +
        'color:var(--dcc-gold);font-size:13px',
      '▼',
    );

    // Choices: a natively scrollable list with chevron indicators.
    this.choicesWrap = el('div', 'display:none;position:relative');
    this.choicesList = el('div', 'max-height:170px;overflow-y:auto;display:flex;flex-direction:column;gap:2px');
    this.choicesList.className = 'dcc-scroll';
    this.chevronUp = el(
      'div',
      'position:absolute;top:-6px;right:14px;display:none;color:var(--dcc-gold);font-size:12px',
      '▲',
    );
    this.chevronDown = el(
      'div',
      'position:absolute;bottom:-6px;right:14px;display:none;color:var(--dcc-gold);font-size:12px',
      '▼',
    );
    this.choicesList.addEventListener('scroll', () => this.updateChevrons());
    this.choicesWrap.append(this.choicesList, this.chevronUp, this.chevronDown);

    this.box.append(this.plate, row, this.choicesWrap, this.more);
    this.box.addEventListener('mousedown', (e) => {
      // Clicking the panel advances a line; choice rows handle themselves.
      if (this.mode.kind === 'line') {
        e.stopPropagation();
        this.advanceIntent();
      }
    });
    // Wheel scrolls natively inside the panel; keep it off the game input.
    this.box.addEventListener('wheel', (e) => e.stopPropagation(), { passive: true });
    ui.layer('dialogue').appendChild(this.box);
  }

  get active(): boolean {
    return this.mode.kind !== 'idle';
  }

  /** Show one character line; resolves when the player advances past it. */
  showLine(speaker: DialogueSpeaker, text: string): Promise<void> {
    return new Promise((resolve) => {
      this.tw.set(text);
      this.mode = { kind: 'line', speaker, resolve, pinned: false };
      this.plate.textContent = speaker.name;
      this.plate.style.background = speaker.color;
      this.box.style.borderColor = speaker.color;
      const ctx = this.portraitCanvas.getContext('2d');
      if (ctx) {
        ctx.imageSmoothingEnabled = false;
        ctx.clearRect(0, 0, 48, 48);
        ctx.drawImage(speaker.portrait, 0, 0, 48, 48);
      }
      this.portraitCanvas.style.display = 'block';
      this.portraitCanvas.style.order = speaker.side === 'right' ? '2' : '0';
      this.textEl.textContent = '';
      this.textWrap.style.display = 'block';
      this.choicesWrap.style.display = 'none';
      this.more.style.visibility = 'hidden';
      this.box.style.display = 'block';
    });
  }

  /** Show a choice menu; resolves with the chosen index (-2 = dismissed). */
  showChoices(options: ChoiceView[]): Promise<number> {
    return new Promise((resolve) => {
      this.mode = { kind: 'choices', options, selected: 0, resolve };
      this.plate.textContent = 'CHOOSE';
      this.plate.style.background = 'var(--dcc-gold)';
      this.box.style.borderColor = 'var(--dcc-gold)';
      this.portraitCanvas.style.display = 'none';
      this.textWrap.style.display = 'none';
      this.more.style.visibility = 'hidden';
      this.choicesList.replaceChildren();
      options.forEach((option, i) => {
        const rowEl = el(
          'div',
          'padding:5px 10px;font-size:15px;cursor:pointer;border-left:3px solid transparent;' +
            (option.advances ? 'color:var(--dcc-green)' : 'color:var(--dcc-text-muted)'),
          option.text,
        );
        rowEl.dataset.choice = String(i);
        rowEl.addEventListener('mouseenter', () => {
          if (this.mode.kind === 'choices') {
            this.mode.selected = i;
            this.refreshChoiceHighlight();
          }
        });
        rowEl.addEventListener('mousedown', (e) => {
          e.stopPropagation();
          if (this.mode.kind === 'choices') {
            this.mode.selected = i;
            this.confirm();
          }
        });
        this.choicesList.appendChild(rowEl);
      });
      this.choicesWrap.style.display = 'block';
      this.box.style.display = 'block';
      this.choicesList.scrollTop = 0;
      this.refreshChoiceHighlight();
      this.updateChevrons();
    });
  }

  private refreshChoiceHighlight(): void {
    if (this.mode.kind !== 'choices') return;
    const selected = this.mode.selected;
    const options = this.mode.options;
    [...this.choicesList.children].forEach((node, i) => {
      if (!(node instanceof HTMLElement)) return;
      const advances = options[i]?.advances === true;
      const on = i === selected;
      node.style.background = on ? 'rgba(255,233,168,0.10)' : 'transparent';
      node.style.borderLeftColor = on ? (advances ? 'var(--dcc-green)' : 'var(--dcc-gold)') : 'transparent';
      node.style.color = advances
        ? on
          ? '#b6f7c8'
          : 'var(--dcc-green)'
        : on
          ? 'var(--dcc-gold)'
          : 'var(--dcc-text-muted)';
    });
  }

  private updateChevrons(): void {
    const list = this.choicesList;
    const scrollable = list.scrollHeight > list.clientHeight + 1;
    this.chevronUp.style.display = scrollable && list.scrollTop > 2 ? 'block' : 'none';
    this.chevronDown.style.display =
      scrollable && list.scrollTop + list.clientHeight < list.scrollHeight - 2 ? 'block' : 'none';
  }

  update(dtMs: number): void {
    if (this.mode.kind !== 'line') return;
    this.tw.update(dtMs);
    const revealed = this.tw.revealed();
    if (this.textEl.textContent !== revealed) {
      this.textEl.textContent = revealed;
      if (!this.mode.pinned) this.textWrap.scrollTop = this.textWrap.scrollHeight;
    }
    this.more.style.visibility = this.tw.fullyRevealed ? 'visible' : 'hidden';
  }

  /** Click/space in line mode: complete reveal, then advance. */
  advanceIntent(): void {
    if (this.mode.kind !== 'line') return;
    if (!this.tw.fullyRevealed) {
      this.tw.complete();
      return;
    }
    const { resolve } = this.mode;
    this.hide();
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
    this.refreshChoiceHighlight();
    const node = this.choicesList.children[m.selected];
    if (node instanceof HTMLElement) node.scrollIntoView({ block: 'nearest' });
    this.updateChevrons();
  }

  /** Wheel/arrow scrolling: lines pin, choices scroll the native list. */
  scrollBy(delta: number): void {
    if (this.mode.kind === 'line') {
      this.mode.pinned = true;
      this.textWrap.scrollTop += delta * 21;
      return;
    }
    if (this.mode.kind === 'choices') {
      this.choicesList.scrollTop += delta * 27;
      this.updateChevrons();
    }
  }

  /** Enter: confirm choice, or advance a line. */
  confirm(): void {
    if (this.mode.kind === 'choices') {
      const { resolve, selected } = this.mode;
      this.hide();
      resolve(selected);
      return;
    }
    this.advanceIntent();
  }

  /**
   * ESC / click-outside on a choice menu dismisses it: resolves -2, which
   * the player routes to the tree's end node. Line mode is untouched.
   */
  cancel(): boolean {
    if (this.mode.kind !== 'choices') return false;
    const { resolve } = this.mode;
    this.hide();
    resolve(-2);
    return true;
  }

  /**
   * Canvas clicks while the box is up: a line advances; a choice menu
   * treats any click that reached the canvas as click-outside (the DOM box
   * swallows clicks that land on it) and dismisses.
   */
  click(p: Point): void {
    void p;
    if (this.mode.kind === 'line') this.advanceIntent();
    else if (this.mode.kind === 'choices') this.cancel();
  }

  /** Mouse-move hover is handled natively by the DOM rows. */
  hover(p: Point): void {
    void p;
  }

  /**
   * Cutscene skip: resolve whatever is pending. A pending choice resolves
   * with -1, which the player treats as "route via the node's goto".
   */
  forceResolveAll(): void {
    if (this.mode.kind === 'line') {
      const { resolve } = this.mode;
      this.hide();
      resolve();
    } else if (this.mode.kind === 'choices') {
      const { resolve } = this.mode;
      this.hide();
      resolve(-1);
    }
  }

  private hide(): void {
    this.mode = { kind: 'idle' };
    this.box.style.display = 'none';
    this.choicesList.replaceChildren();
  }

  /** Legacy no-op: the box is DOM now. */
  render(ctx: CanvasRenderingContext2D): void {
    void ctx;
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
          // ESC / click-outside dismissal: leave via the end node.
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
