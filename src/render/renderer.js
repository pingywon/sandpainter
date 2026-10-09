/**
 * Maps (element, shade) to pixels. Palette is precomputed once; each frame is a
 * single tight loop over the grid into a Uint32 view of the ImageData buffer.
 */
import { ELEMENTS } from '../engine/elements.js';

const SHADES = 8;

function clamp(v) { return v < 0 ? 0 : v > 255 ? 255 : v | 0; }

function abgr(r, g, b) {
  return ((255 << 24) | (clamp(b) << 16) | (clamp(g) << 8) | clamp(r)) >>> 0;
}

/** flat: one colour per element, like the original game. Otherwise shades mix rgb→rgb2 or jitter by variance. */
export function buildPalette(flat = false) {
  const pal = new Uint32Array(256 * SHADES);
  for (let id = 0; id < 256; id++) {
    const e = ELEMENTS[id];
    if (!e) continue;
    const [r, g, b] = e.rgb;
    for (let s = 0; s < SHADES; s++) {
      let c;
      if (flat) {
        c = abgr(r, g, b);
      } else if (e.rgb2) {
        const t = s / (SHADES - 1);
        const [r2, g2, b2] = e.rgb2;
        c = abgr(r + (r2 - r) * t, g + (g2 - g) * t, b + (b2 - b) * t);
      } else {
        const f = (s / (SHADES - 1) - 0.5) * 2 * e.variance;
        c = abgr(r + f, g + f, b + f);
      }
      pal[id * SHADES + s] = c;
    }
  }
  return pal;
}

export class Renderer {
  constructor(canvas, world) {
    this.canvas = canvas;
    this.world = world;
    canvas.width = world.w;
    canvas.height = world.h;
    this.ctx = canvas.getContext('2d', { alpha: false });
    this.img = this.ctx.createImageData(world.w, world.h);
    this.buf = new Uint32Array(this.img.data.buffer);
    this.pal = buildPalette();
  }

  /** Switch between the original's single flat colour per element and the mixed look. */
  setFlat(flat) {
    this.pal = buildPalette(flat);
  }

  draw() {
    const { cells, shade, n } = this.world;
    const buf = this.buf, pal = this.pal;
    for (let i = 0; i < n; i++) {
      buf[i] = pal[(cells[i] << 3) | shade[i]];
    }
    this.ctx.putImageData(this.img, 0, 0);
  }
}

/**
 * The brush ring drawn on a transparent canvas laid over the world canvas.
 * Sized to the on-screen box times devicePixelRatio so the ring stays crisp.
 */
export class Cursor {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.x = -1; this.y = -1;
    this.size = 4;
    this.scale = 1;
    this.visible = false;
    this.from = null; // [x, y] anchor of a line-tool drag; a preview line is drawn to the cursor
    this.vx = 0; this.vy = 0; this.z = 1; // zoom view: world cell at the plate's top-left, zoom factor
  }

  /** Follow the zoom view so the ring sits on the right cell at any zoom. */
  setView(vx, vy, z) {
    this.vx = vx; this.vy = vy; this.z = z;
  }

  resize(cssW, cssH, worldW) {
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = Math.round(cssW * dpr);
    this.canvas.height = Math.round(cssH * dpr);
    this.dpr = dpr;
    this.scale = (cssW * dpr) / worldW; // device pixels per world cell
  }

  /** x, y in world cells. */
  set(x, y, size, visible = true) {
    this.x = x; this.y = y; this.size = size; this.visible = visible;
  }

  draw(accent) {
    const c = this.ctx, cv = this.canvas;
    c.clearRect(0, 0, cv.width, cv.height);
    if (!this.visible) return;
    const s = this.scale * this.z;
    const sx = (x) => (x - this.vx) * s;
    const sy = (y) => (y - this.vy) * s;
    if (this.from) {
      // Line-tool preview: a ghost of the stroke that painting will make on release.
      const half = this.size <= 2 ? this.size / 2 : 0;
      c.save();
      c.lineCap = 'round';
      c.globalAlpha = 0.5;
      c.lineWidth = Math.max(this.size * s, 1.5);
      c.strokeStyle = accent;
      c.beginPath();
      c.moveTo(sx(this.from[0] + half), sy(this.from[1] + half));
      c.lineTo(sx(this.x + half), sy(this.y + half));
      c.stroke();
      c.restore();
    }
    const r = Math.max(this.size * s / 2, 2.5);
    const px = sx(this.x + (this.size <= 2 ? this.size / 2 : 0));
    const py = sy(this.y + (this.size <= 2 ? this.size / 2 : 0));
    c.lineWidth = Math.max(1, this.dpr);
    c.strokeStyle = 'rgba(0,0,0,0.55)';
    c.beginPath(); c.arc(px, py, r + 1, 0, Math.PI * 2); c.stroke();
    c.strokeStyle = accent;
    c.beginPath(); c.arc(px, py, r, 0, Math.PI * 2); c.stroke();
    if (r > 6) {
      c.fillStyle = accent;
      c.fillRect(px - 1, py - 1, 2, 2);
    }
  }
}
