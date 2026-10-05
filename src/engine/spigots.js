/**
 * Four spigots along the gravity-far edge, each pouring an element at a rate 0..5.
 */
import { chance } from './world.js';
import { SAND, WATER, SALT, OIL, EMPTY } from './ids.js';
import { ELEMENTS, resolve } from './elements.js';

export const RATE_WIDTH = [0, 5, 10, 15, 20, 25];
export const SPIGOT_DEPTH = 10;
export const NUM_SPIGOTS = 4;

export class Spigots {
  constructor() {
    // All four start off: a new game is a blank page until a spigot is switched on.
    this.list = [
      { element: SAND, rate: 0 },
      { element: WATER, rate: 0 },
      { element: SALT, rate: 0 },
      { element: OIL, rate: 0 },
    ];
    this.listeners = new Set();
  }

  /** Horizontal centre of spigot k as a fraction of the width. */
  static centre(k) {
    return (k + 1) / (NUM_SPIGOTS + 1);
  }

  set(k, patch) {
    Object.assign(this.list[k], patch);
    for (const fn of this.listeners) fn(k, this.list[k]);
  }

  onChange(fn) { this.listeners.add(fn); }

  emit(world, params) {
    const { w, h, cells } = world;
    const down = params.gravity > 0;
    for (let k = 0; k < NUM_SPIGOTS; k++) {
      const s = this.list[k];
      const width = RATE_WIDTH[s.rate];
      if (width === 0) continue;
      const cx = Math.round(w * Spigots.centre(k));
      const x0 = Math.max(0, cx - (width >> 1));
      const x1 = Math.min(w - 1, x0 + width - 1);
      for (let d = 0; d < SPIGOT_DEPTH; d++) {
        const y = down ? d : h - 1 - d;
        const row = y * w;
        for (let x = x0; x <= x1; x++) {
          const i = row + x;
          if (cells[i] !== EMPTY) continue;
          if (!chance(10)) continue;
          const id = resolve(s.element);
          const e = ELEMENTS[id];
          world.set(i, id, e.initAux ? e.initAux() : 0);
        }
      }
    }
  }
}
