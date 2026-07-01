/**
 * Game shell: owns the renderer, input, and a scene stack, and runs a
 * fixed-timestep (60Hz) update loop with an accumulator. Rendering happens
 * once per requestAnimationFrame; updates always advance by a constant step
 * so simulation speed is identical at any monitor refresh rate.
 */

import { Input } from './input';
import { Renderer } from './renderer';

export interface Scene {
  update(dtMs: number): void;
  render(ctx: CanvasRenderingContext2D): void;
  /** Called instead of update() while another scene is on top (e.g. toast anims). */
  updatePassive?(dtMs: number): void;
}

const STEP_MS = 1000 / 60;
/** Cap a single frame's simulated time so a background tab doesn't spiral. */
const MAX_FRAME_MS = 250;

export class Game {
  readonly renderer: Renderer;
  readonly input: Input;
  /** Rendered frames per second, updated once per second. */
  fps = 0;

  private readonly scenes: Scene[] = [];
  private lastTime = 0;
  private accumulator = 0;
  private frameCount = 0;
  private fpsElapsed = 0;
  private running = false;

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new Renderer(canvas);
    this.input = new Input(canvas, (x, y) => this.renderer.toLogical(x, y));
  }

  pushScene(scene: Scene): void {
    this.scenes.push(scene);
  }

  popScene(): Scene | undefined {
    return this.scenes.pop();
  }

  replaceScene(scene: Scene): void {
    this.scenes.pop();
    this.scenes.push(scene);
  }

  /** True when this scene is receiving input (top of the stack). */
  isTop(scene: Scene): boolean {
    return this.scenes[this.scenes.length - 1] === scene;
  }

  /** Pop scenes until the given scene is on top (no-op if absent). */
  popTo(scene: Scene): void {
    if (!this.scenes.includes(scene)) return;
    while (this.scenes.length > 0 && !this.isTop(scene)) this.scenes.pop();
  }

  /** Replace the whole stack with a single scene. */
  resetTo(scene: Scene): void {
    this.scenes.length = 0;
    this.scenes.push(scene);
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    requestAnimationFrame(this.frame);
  }

  private readonly frame = (now: number): void => {
    if (this.lastTime === 0) this.lastTime = now;
    const delta = Math.min(now - this.lastTime, MAX_FRAME_MS);
    this.lastTime = now;
    this.accumulator += delta;

    let stepped = false;
    while (this.accumulator >= STEP_MS) {
      const top = this.scenes[this.scenes.length - 1];
      top?.update(STEP_MS);
      for (const s of this.scenes) {
        if (s !== top) s.updatePassive?.(STEP_MS);
      }
      this.accumulator -= STEP_MS;
      stepped = true;
    }
    if (stepped) this.input.endFrame();

    const ctx = this.renderer.ctx;
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, this.renderer.buffer.width, this.renderer.buffer.height);
    for (const s of this.scenes) s.render(ctx);
    this.renderer.present();

    this.frameCount++;
    this.fpsElapsed += delta;
    if (this.fpsElapsed >= 1000) {
      this.fps = Math.round((this.frameCount * 1000) / this.fpsElapsed);
      this.frameCount = 0;
      this.fpsElapsed = 0;
    }

    requestAnimationFrame(this.frame);
  };
}
