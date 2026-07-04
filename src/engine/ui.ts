/**
 * The DOM UI layer (P20). The game canvas stays a crunchy 320x200 buffer at
 * integer upscale; UI TEXT renders on this absolutely-positioned HTML layer
 * above it, at native display resolution, so type is crisp while the world
 * stays pixel art.
 *
 * Composition: one fixed root tracks the canvas playfield rect (kept in sync
 * via Renderer.onLayoutChange). The root and its sub-layers are
 * pointer-events:none; only interactive elements opt back in - so world
 * clicks fall through to the canvas everywhere else, and keyboard input
 * keeps flowing through the game's window-level Input as before.
 *
 * Sub-layer stack (z within the root): nav < toasts < narrator < dialogue <
 * screens (party/inventory) < menus (modal list menus). Full-screen scenes
 * (CMS, editor) keep their own document-level overlays above everything.
 *
 * Design tokens live in the injected stylesheet below as CSS custom
 * properties; every DOM surface uses them.
 */

import type { Renderer } from './renderer';

export const UI_TOKENS_CSS = `
:root {
  --dcc-bg-primary: #080b14;
  --dcc-bg-panel: #0d1322;
  --dcc-bg-inset: #131a26;
  --dcc-border: #39465e;
  --dcc-border-accent: #3fd9ff;
  --dcc-text-primary: #e6eeff;
  --dcc-text-muted: #8fa3c4;
  --dcc-text-dim: #5c7090;
  --dcc-gold: #ffd166;
  --dcc-cyan: #3fd9ff;
  --dcc-danger: #ff6e6e;
  --dcc-green: #7de08a;
  --dcc-amber: #ffab2e;
  --dcc-amber-text: #ffe9c9;
  --dcc-amber-bg: #1a0e03;
  --dcc-notify: #57e6a8;
  --dcc-notify-text: #c9f5e2;
  --dcc-notify-bg: #06180f;
  --dcc-parchment: #b3a68a;
  --dcc-parchment-text: #e6ddc4;
  --dcc-parchment-bg: #141109;
  --dcc-font-ui: 'Pixelify Sans', monospace;
  --dcc-font-ai: 'VT323', monospace;
}
.dcc-ui, .dcc-ui * {
  box-sizing: border-box;
  font-smooth: never;
  -webkit-font-smoothing: none;
  text-rendering: geometricPrecision;
}
.dcc-ui {
  font-family: var(--dcc-font-ui);
  color: var(--dcc-text-primary);
  line-height: 1.4;
  user-select: none;
}
.dcc-panel {
  background: var(--dcc-bg-panel);
  border: 2px solid var(--dcc-border-accent);
}
.dcc-btn {
  font-family: var(--dcc-font-ui);
  font-size: 14px;
  color: var(--dcc-text-primary);
  background: var(--dcc-bg-inset);
  border: 1px solid var(--dcc-border);
  padding: 4px 12px;
  cursor: pointer;
  pointer-events: auto;
}
.dcc-btn:hover { border-color: var(--dcc-border-accent); color: var(--dcc-cyan); }
.dcc-close {
  font-family: var(--dcc-font-ui);
  font-size: 16px;
  color: var(--dcc-danger);
  background: var(--dcc-bg-inset);
  border: 1px solid var(--dcc-border);
  width: 32px;
  height: 32px;
  cursor: pointer;
  pointer-events: auto;
  line-height: 1;
}
.dcc-close:hover { border-color: var(--dcc-danger); }
.dcc-title {
  font-size: 28px;
  font-weight: 700;
  color: var(--dcc-cyan);
  letter-spacing: 1px;
}
.dcc-section {
  font-size: 16px;
  font-weight: 700;
  color: var(--dcc-cyan);
  margin: 16px 0 8px;
}
.dcc-muted { color: var(--dcc-text-muted); }
.dcc-dim { color: var(--dcc-text-dim); font-size: 12px; }
.dcc-gold { color: var(--dcc-gold); }
@keyframes dcc-blink { 0%, 55% { opacity: 1; } 56%, 100% { opacity: 0.15; } }
@keyframes dcc-slide-in { from { transform: translateX(24px); opacity: 0; } to { transform: none; opacity: 1; } }
.dcc-scroll { overflow-y: auto; scrollbar-width: thin; scrollbar-color: var(--dcc-border) transparent; }
.dcc-scroll::-webkit-scrollbar { width: 8px; }
.dcc-scroll::-webkit-scrollbar-thumb { background: var(--dcc-border); }
`;

export type UiLayerName = 'nav' | 'toasts' | 'narrator' | 'dialogue' | 'screens' | 'menus';

const LAYER_Z: Record<UiLayerName, number> = {
  nav: 10,
  toasts: 20,
  narrator: 30,
  dialogue: 40,
  screens: 50,
  menus: 60,
};

export class UiLayer {
  readonly root: HTMLDivElement;
  private readonly layers = new Map<UiLayerName, HTMLDivElement>();
  private readonly renderer: Renderer;

  constructor(renderer: Renderer) {
    this.renderer = renderer;
    const style = document.createElement('style');
    style.textContent = UI_TOKENS_CSS;
    document.head.appendChild(style);

    this.root = document.createElement('div');
    this.root.className = 'dcc-ui';
    this.root.style.cssText =
      'position:fixed;pointer-events:none;overflow:visible;z-index:20';
    document.body.appendChild(this.root);

    for (const name of Object.keys(LAYER_Z) as UiLayerName[]) {
      const layer = document.createElement('div');
      layer.style.cssText = `position:absolute;inset:0;pointer-events:none;z-index:${LAYER_Z[name]}`;
      this.layers.set(name, layer);
      this.root.appendChild(layer);
    }

    renderer.onLayoutChange = () => this.trackPlayfield();
    this.trackPlayfield();
  }

  /** Keep the root glued to the canvas playfield rect (CSS px). */
  private trackPlayfield(): void {
    const r = this.renderer.layoutCss();
    this.root.style.left = `${r.x}px`;
    this.root.style.top = `${r.y}px`;
    this.root.style.width = `${r.w}px`;
    this.root.style.height = `${r.h}px`;
  }

  layer(name: UiLayerName): HTMLDivElement {
    const layer = this.layers.get(name);
    if (!layer) throw new Error(`unknown ui layer "${name}"`);
    return layer;
  }

  /** CSS px per logical px (world-anchored DOM elements: radial label). */
  get scale(): number {
    return this.renderer.layoutCss().scale;
  }
}

let activeLayer: UiLayer | null = null;

/** Create the singleton layer at boot (main.ts), before any scene exists. */
export function initUi(renderer: Renderer): UiLayer {
  activeLayer = new UiLayer(renderer);
  return activeLayer;
}

/** The boot-created layer; components grab it instead of threading params. */
export function getUi(): UiLayer {
  if (!activeLayer) throw new Error('UiLayer not initialized (call initUi at boot)');
  return activeLayer;
}

/** Tiny element helper shared by the DOM UI components. */
export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  css: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  node.style.cssText = css;
  if (text !== undefined) node.textContent = text;
  return node;
}
