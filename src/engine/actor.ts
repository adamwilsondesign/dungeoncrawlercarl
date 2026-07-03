/**
 * Actors: sprite-sheet animated characters with a logical position
 * (x = horizontal center, y = feet baseline), a facing, and depth scaling
 * applied at draw time. Animation is elapsed-ms based so playback speed is
 * independent of monitor refresh rate.
 */

import type { AnimDef, Facing, Point, SpriteSheetDef } from '../data/types';
import { drawPixelText, placeholderActorLabel, type LoadedImage } from './assets';

export interface ActorInit {
  id: string;
  label: string;
  sheet: SpriteSheetDef;
  image: LoadedImage;
  x: number;
  y: number;
  facing: Facing;
}

export class Actor {
  readonly id: string;
  readonly label: string;
  readonly sheet: SpriteSheetDef;
  x: number;
  y: number;
  facing: Facing;

  private readonly image: LoadedImage;
  private animName = '';
  private elapsedMs = 0;

  constructor(init: ActorInit) {
    this.id = init.id;
    this.label = init.label;
    this.sheet = init.sheet;
    this.image = init.image;
    this.x = init.x;
    this.y = init.y;
    this.facing = init.facing;
  }

  get feet(): Point {
    return { x: this.x, y: this.y };
  }

  /** Left-facing actors reuse the right-facing anims mirrored horizontally. */
  private get mirrored(): boolean {
    return this.facing === 'left' && this.sheet.mirrorLeft === true;
  }

  /** Switch animation by exact name; restarting is skipped when unchanged. */
  setAnim(name: string): void {
    if (name === this.animName) return;
    if (!(name in this.sheet.anims)) {
      const fallback = Object.keys(this.sheet.anims)[0];
      if (fallback === undefined || fallback === this.animName) return;
      name = fallback;
    }
    this.animName = name;
    this.elapsedMs = 0;
  }

  /** Pick the directional variant of a base anim ('walk' | 'idle') from facing. */
  play(base: 'walk' | 'idle'): void {
    const dir = this.mirrored ? 'right' : this.facing;
    const name = `${base}_${dir}`;
    this.setAnim(name in this.sheet.anims ? name : `${base}_down`);
  }

  update(dtMs: number): void {
    this.elapsedMs += dtMs;
  }

  private currentAnim(): AnimDef | undefined {
    return this.sheet.anims[this.animName];
  }

  private currentFrame(): number {
    const anim = this.currentAnim();
    if (!anim || anim.frames.length === 0) return 0;
    const step = Math.floor(this.elapsedMs / anim.frameMs);
    const idx = anim.loop ? step % anim.frames.length : Math.min(step, anim.frames.length - 1);
    return anim.frames[idx];
  }

  /** Draw at the given depth scale, feet anchored at (x, y). */
  draw(ctx: CanvasRenderingContext2D, scale: number): void {
    const { frameW, frameH } = this.sheet;
    const frame = this.currentFrame();
    const cols = Math.max(1, Math.floor(this.image.width / frameW));
    const sx = (frame % cols) * frameW;
    const sy = Math.floor(frame / cols) * frameH;
    const dw = Math.max(1, Math.round(frameW * scale));
    const dh = Math.max(1, Math.round(frameH * scale));
    const dx = Math.round(this.x - dw / 2);
    const dy = Math.round(this.y - dh);

    if (this.mirrored) {
      ctx.save();
      ctx.translate(dx + dw, dy);
      ctx.scale(-1, 1);
      ctx.drawImage(this.image, sx, sy, frameW, frameH, 0, 0, dw, dh);
      ctx.restore();
    } else {
      ctx.drawImage(this.image, sx, sy, frameW, frameH, dx, dy, dw, dh);
    }

    // Placeholder sheets carry a short label; render it beneath the actor at
    // screen scale so it stays crisp at any depth and never mirrors.
    // Bug-1 hardening: the on-sprite tag is ALWAYS the actor's display
    // label, never whatever string got baked into the cached placeholder
    // sheet (the CMS once poisoned that cache with asset paths).
    const label = placeholderActorLabel(this.image) !== undefined ? this.label : undefined;
    if (label !== undefined) {
      const lx = Math.round(this.x);
      const ly = Math.min(Math.round(this.y) + 2, 194);
      drawPixelText(ctx, label, lx + 1, ly + 1, 'rgba(0,0,0,0.7)', 1, 'center');
      drawPixelText(ctx, label, lx, ly, '#ffffff', 1, 'center');
    }
  }
}
