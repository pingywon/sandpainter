/**
 * World: the cell grid and nothing else.
 *
 * Four parallel byte arrays, one entry per cell:
 *   cells  – element id (0 = EMPTY)
 *   shade  – 0..7 colour jitter, re-rolled when a particle moves
 *   aux    – per-cell scratch byte (fire life, concrete rest timer, stem growth, clone target…)
 *   stamp  – frame parity; a cell whose stamp equals the current parity was already updated
 *   born   – low 16 bits of the frame a cell was last created by set(); lets heat checks
 *            ignore a flame lit this same step, so reactions spread one cell per step
 */
export const W = 640;
export const H = 480;

let seed = (Math.random() * 0xffffffff) >>> 0 || 1;
/** Fast xorshift32 in [0, 1). */
export function rand() {
  seed ^= seed << 13;
  seed ^= seed >>> 17;
  seed ^= seed << 5;
  return (seed >>> 0) / 4294967296;
}
/** True with probability p percent. */
export function chance(p) {
  return rand() * 100 < p;
}
export function randInt(n) {
  return (rand() * n) | 0;
}

export class World {
  constructor(w = W, h = H) {
    this.w = w;
    this.h = h;
    this.n = w * h;
    this.cells = new Uint8Array(this.n);
    this.shade = new Uint8Array(this.n);
    this.aux = new Uint8Array(this.n);
    this.stamp = new Uint8Array(this.n);
    this.born = new Uint16Array(this.n);
    this.parity = 0;
    this.frame = 0;
    this.randomizeShade();
  }

  randomizeShade() {
    const s = this.shade;
    for (let i = 0; i < this.n; i++) s[i] = randInt(8);
  }

  clear() {
    this.cells.fill(0);
    this.aux.fill(0);
    this.randomizeShade();
  }

  idx(x, y) {
    return y * this.w + x;
  }

  inb(x, y) {
    return x >= 0 && y >= 0 && x < this.w && y < this.h;
  }

  /**
   * Place element `id` at index i with a fresh shade and aux value. The cell counts as
   * updated this step, so something a reaction creates ahead of the sweep does not act again.
   */
  set(i, id, aux = 0) {
    this.cells[i] = id;
    this.aux[i] = aux;
    this.shade[i] = randInt(8);
    this.stamp[i] = this.parity;
    this.born[i] = this.frame & 0xffff;
  }

  /** True if the cell at i was created during the current step. */
  fresh(i) {
    return this.born[i] === (this.frame & 0xffff);
  }

  /** Move the particle at i to j (j must be EMPTY). Marks j as updated this frame. */
  move(i, j) {
    this.cells[j] = this.cells[i];
    this.aux[j] = this.aux[i];
    this.born[j] = this.born[i];
    this.shade[j] = randInt(8);
    this.cells[i] = 0;
    this.aux[i] = 0;
    this.stamp[j] = this.parity;
  }

  /** Swap two cells (used for density sinking / floating). Marks j as updated. */
  swap(i, j) {
    const c = this.cells, a = this.aux, s = this.shade, b = this.born;
    const tc = c[i], ta = a[i], tb = b[i];
    c[i] = c[j]; a[i] = a[j]; b[i] = b[j]; s[i] = randInt(8);
    c[j] = tc; a[j] = ta; b[j] = tb; s[j] = randInt(8);
    this.stamp[j] = this.parity;
  }

  snapshot() {
    return {
      cells: this.cells.slice(),
      aux: this.aux.slice(),
      shade: this.shade.slice(),
    };
  }

  restore(snap) {
    this.cells.set(snap.cells);
    this.aux.set(snap.aux);
    this.shade.set(snap.shade);
  }
}
