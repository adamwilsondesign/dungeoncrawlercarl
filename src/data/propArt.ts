/**
 * Procedural prop art registry (P17). Every entry is keyed by a drawFn name
 * referenced from PropArt { kind: 'procedural' }. Like sprite designs, these
 * are the zero-asset placeholders: a real file dropped at props/<propId>.png
 * (bundled or via the CMS) always wins over the registered draw.
 *
 * Draw onto a transparent canvas of exactly (w, h); the prop system anchors
 * the art bottom-center on the prop's baseline point and derives the default
 * hit area from the non-transparent pixels, so keep silhouettes tight.
 */

export interface PropDesign {
  w: number;
  h: number;
  draw: (ctx: CanvasRenderingContext2D) => void;
}

/** Reserved: renders nothing (legacy hotspots converted to internal props). */
export const EMPTY_PROP_ART = '__empty__';

export const propDesigns: Record<string, PropDesign> = {
  /**
   * R01 sodium streetlamp: post, crossbar head, warm lamp glow. Previously
   * baked into the street background at x178; now a real depth-sorted prop.
   */
  r01_streetlamp: {
    w: 17,
    h: 70,
    draw: (ctx) => {
      // Post with a wider mounting foot
      ctx.fillStyle = '#1a2334';
      ctx.fillRect(7, 8, 3, 60);
      ctx.fillRect(5, 66, 7, 4);
      // Crossbar head + lamp housing
      ctx.fillStyle = '#243048';
      ctx.fillRect(3, 4, 11, 3);
      ctx.fillStyle = '#ffcf8a';
      ctx.fillRect(3, 0, 11, 4);
      // Warm halo around the head
      const halo = ctx.createRadialGradient(8.5, 3, 1, 8.5, 3, 9);
      halo.addColorStop(0, 'rgba(255,207,138,0.55)');
      halo.addColorStop(1, 'rgba(255,207,138,0)');
      ctx.fillStyle = halo;
      ctx.fillRect(0, 0, 17, 14);
      // Snow crust on the head
      ctx.fillStyle = 'rgba(230,240,255,0.85)';
      ctx.fillRect(3, 0, 11, 1);
    },
  },

  /**
   * R01 staircase of light (post-collapse): the beam column with descending
   * steps. Previously painted into the post-collapse background variant.
   */
  r01_staircase: {
    w: 40,
    h: 176,
    draw: (ctx) => {
      const beam = ctx.createLinearGradient(20, 0, 20, 176);
      beam.addColorStop(0, 'rgba(255,236,170,0.10)');
      beam.addColorStop(0.55, 'rgba(255,224,140,0.55)');
      beam.addColorStop(1, 'rgba(255,210,110,0.85)');
      ctx.fillStyle = beam;
      ctx.fillRect(0, 0, 40, 176);
      ctx.fillStyle = '#ffe9b0';
      for (let i = 0; i < 6; i++) ctx.fillRect(4, 88 + i * 14, 32, 3);
      // Hot core seam down the middle
      ctx.fillStyle = 'rgba(255,248,220,0.35)';
      ctx.fillRect(17, 0, 6, 176);
    },
  },

  /**
   * R01 distant skyline (pre-collapse): the intact towers behind the street.
   * Pure decoration - the collapse beat disables it and the background swaps
   * to the rubble variant.
   */
  r01_skyline: {
    w: 106,
    h: 78,
    draw: (ctx) => {
      ctx.fillStyle = '#101a2c';
      ctx.fillRect(0, 10, 26, 68);
      ctx.fillRect(38, 0, 34, 78);
      ctx.fillRect(82, 18, 24, 60);
      // A few lit windows
      ctx.fillStyle = '#16233a';
      for (const [tx, ty] of [[6, 22], [48, 14], [58, 36], [88, 28]] as const) {
        ctx.fillRect(tx, ty, 4, 5);
      }
    },
  },
};
