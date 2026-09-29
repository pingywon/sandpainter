/**
 * Shared movement and reaction rules that element update functions compose.
 * Every function takes (x, y, i, world, params) and returns true when it
 * changed the cell, so callers can chain them with `||`.
 */
import { chance, rand, randInt } from './world.js';
import {
  EMPTY, FIRE, EMBER, DENSITY, FLAGS, IGNITE,
  F_LIQUID, F_GAS, F_HOT, F_FUEL, F_INDESTRUCTIBLE,
} from './ids.js';

/* ---------- neighbour queries ---------- */

/** Index of a 4-neighbour holding `id`, or -1. */
export function near4(x, y, i, w, id) {
  const c = w.cells, W = w.w;
  if (x > 0 && c[i - 1] === id) return i - 1;
  if (x < W - 1 && c[i + 1] === id) return i + 1;
  if (y > 0 && c[i - W] === id) return i - W;
  if (y < w.h - 1 && c[i + W] === id) return i + W;
  return -1;
}

/** Index of an 8-neighbour holding `id`, or -1. */
export function near8(x, y, i, w, id) {
  const c = w.cells, W = w.w;
  const x0 = x > 0, x1 = x < W - 1, y0 = y > 0, y1 = y < w.h - 1;
  if (x0 && c[i - 1] === id) return i - 1;
  if (x1 && c[i + 1] === id) return i + 1;
  if (y0) {
    if (c[i - W] === id) return i - W;
    if (x0 && c[i - W - 1] === id) return i - W - 1;
    if (x1 && c[i - W + 1] === id) return i - W + 1;
  }
  if (y1) {
    if (c[i + W] === id) return i + W;
    if (x0 && c[i + W - 1] === id) return i + W - 1;
    if (x1 && c[i + W + 1] === id) return i + W + 1;
  }
  return -1;
}

/** Index of a 4-neighbour whose flags include `flag`, or -1. */
export function near4Flag(x, y, i, w, flag) {
  const c = w.cells, W = w.w;
  if (x > 0 && (FLAGS[c[i - 1]] & flag)) return i - 1;
  if (x < W - 1 && (FLAGS[c[i + 1]] & flag)) return i + 1;
  if (y > 0 && (FLAGS[c[i - W]] & flag)) return i - W;
  if (y < w.h - 1 && (FLAGS[c[i + W]] & flag)) return i + W;
  return -1;
}

export function nearHot(x, y, i, w) {
  return near4Flag(x, y, i, w, F_HOT) !== -1;
}

/** True if any of the 8 neighbours is hot (used by fuses so a rising flame still counts). */
export function nearHot8(x, y, i, w) {
  const c = w.cells, W = w.w;
  const x0 = x > 0, x1 = x < W - 1, y0 = y > 0, y1 = y < w.h - 1;
  if (x0 && (FLAGS[c[i - 1]] & F_HOT)) return true;
  if (x1 && (FLAGS[c[i + 1]] & F_HOT)) return true;
  if (y0) {
    if (FLAGS[c[i - W]] & F_HOT) return true;
    if (x0 && (FLAGS[c[i - W - 1]] & F_HOT)) return true;
    if (x1 && (FLAGS[c[i - W + 1]] & F_HOT)) return true;
  }
  if (y1) {
    if (FLAGS[c[i + W]] & F_HOT) return true;
    if (x0 && (FLAGS[c[i + W - 1]] & F_HOT)) return true;
    if (x1 && (FLAGS[c[i + W + 1]] & F_HOT)) return true;
  }
  return false;
}

/** Index of a random EMPTY 4-neighbour, or -1. */
export function emptyNeighbour(x, y, i, w) {
  const c = w.cells, W = w.w;
  const start = randInt(4);
  for (let k = 0; k < 4; k++) {
    switch ((start + k) & 3) {
      case 0: if (x > 0 && c[i - 1] === EMPTY) return i - 1; break;
      case 1: if (x < W - 1 && c[i + 1] === EMPTY) return i + 1; break;
      case 2: if (y > 0 && c[i - W] === EMPTY) return i - W; break;
      case 3: if (y < w.h - 1 && c[i + W] === EMPTY) return i + W; break;
    }
  }
  return -1;
}

/* ---------- movement ---------- */

/** Can `id` push into the cell holding `target`? Empty always; fluids if we are denser. */
function canSink(id, target) {
  if (target === EMPTY) return true;
  const f = FLAGS[target];
  if (f & F_GAS) return true;
  if (f & F_LIQUID) return DENSITY[target] < DENSITY[id];
  return false;
}

function shove(w, i, j) {
  if (w.cells[j] === EMPTY) w.move(i, j);
  else w.swap(i, j);
}

/** Random sideways push proportional to wind. Returns true if moved. */
export function applyWind(x, y, i, w, p, factor) {
  const wind = p.wind;
  if (wind === 0) return false;
  if (!chance(Math.abs(wind) * factor)) return false;
  const dx = wind > 0 ? 1 : -1;
  const nx = x + dx;
  if (nx < 0 || nx >= w.w) return false;
  const j = i + dx;
  if (w.cells[j] === EMPTY) { w.move(i, j); return true; }
  return false;
}

/**
 * Powder gravity: straight down (in gravity direction), sinking through lighter
 * fluids, then diagonally. `slide` = percent chance to try the diagonal.
 */
export function fallPowder(x, y, i, w, p, slide = 100, sinkChance = 40) {
  const id = w.cells[i];
  const gy = p.gravity;
  const ny = y + gy;
  const W = w.w;
  if (p.wind !== 0 && applyWind(x, y, i, w, p, 0.25)) return true;
  if (ny < 0 || ny >= w.h) return false;
  const below = i + gy * W;
  const b = w.cells[below];
  if (b === EMPTY) { w.move(i, below); return true; }
  if (canSink(id, b)) {
    if (chance(sinkChance)) { w.swap(i, below); return true; }
    return false;
  }
  if (!chance(slide)) return false;
  const dir = rand() < 0.5 ? -1 : 1;
  for (let k = 0; k < 2; k++) {
    const dx = k === 0 ? dir : -dir;
    const nx = x + dx;
    if (nx < 0 || nx >= W) continue;
    const j = below + dx;
    const t = w.cells[j];
    if (t === EMPTY) { w.move(i, j); return true; }
    if (canSink(id, t) && chance(sinkChance)) { w.swap(i, j); return true; }
  }
  return false;
}

/**
 * Liquid: fall, sink through lighter liquids, diagonal, then disperse sideways
 * up to `spread` cells. `mobility` = percent chance to attempt any move (lava is sluggish).
 */
export function flowLiquid(x, y, i, w, p, spread = 4, mobility = 100) {
  if (mobility < 100 && !chance(mobility)) return false;
  const id = w.cells[i];
  const gy = p.gravity;
  const ny = y + gy;
  const W = w.w;
  if (ny >= 0 && ny < w.h) {
    const below = i + gy * W;
    const b = w.cells[below];
    if (b === EMPTY) { w.move(i, below); return true; }
    if (canSink(id, b) && chance(b && (FLAGS[b] & F_GAS) ? 60 : 30)) { w.swap(i, below); return true; }
    const dir = rand() < 0.5 ? -1 : 1;
    for (let k = 0; k < 2; k++) {
      const dx = k === 0 ? dir : -dir;
      const nx = x + dx;
      if (nx < 0 || nx >= W) continue;
      const j = below + dx;
      const t = w.cells[j];
      if (t === EMPTY) { w.move(i, j); return true; }
      if (canSink(id, t) && chance(20)) { w.swap(i, j); return true; }
    }
  }
  // sideways dispersion, biased by wind
  let dir;
  if (p.wind !== 0 && chance(Math.abs(p.wind) * 0.6)) dir = p.wind > 0 ? 1 : -1;
  else dir = rand() < 0.5 ? -1 : 1;
  for (let k = 0; k < 2; k++) {
    const dx = k === 0 ? dir : -dir;
    let last = -1;
    for (let s = 1; s <= spread; s++) {
      const nx = x + dx * s;
      if (nx < 0 || nx >= W) break;
      const j = i + dx * s;
      const t = w.cells[j];
      if (t === EMPTY) { last = j; continue; }
      if (FLAGS[t] & F_GAS) { last = j; continue; }
      break;
    }
    if (last !== -1) { shove(w, i, last); return true; }
  }
  return false;
}

/** Gas: rise against gravity, drifting sideways; bubbles through liquids and powders. */
export function riseGas(x, y, i, w, p, drift = 40, through = 25) {
  const gy = -p.gravity;
  const W = w.w;
  const ny = y + gy;
  if (p.wind !== 0 && applyWind(x, y, i, w, p, 0.8)) return true;
  if (ny >= 0 && ny < w.h) {
    const above = i + gy * W;
    const a = w.cells[above];
    const dir = rand() < 0.5 ? -1 : 1;
    if (chance(drift)) {
      const nx = x + dir;
      if (nx >= 0 && nx < W) {
        const j = above + dir;
        if (w.cells[j] === EMPTY) { w.move(i, j); return true; }
      }
    }
    if (a === EMPTY) { w.move(i, above); return true; }
    const f = FLAGS[a];
    if ((f & (F_LIQUID | 1)) && !(f & F_GAS) && chance(through)) { w.swap(i, above); return true; }
    const nx = x + dir;
    if (nx >= 0 && nx < W) {
      const j = above + dir;
      if (w.cells[j] === EMPTY) { w.move(i, j); return true; }
    }
  }
  // blocked: wander sideways
  if (chance(drift)) {
    const dx = rand() < 0.5 ? -1 : 1;
    const nx = x + dx;
    if (nx >= 0 && nx < W && w.cells[i + dx] === EMPTY) { w.move(i, i + dx); return true; }
  }
  return false;
}

/* ---------- reactions ---------- */

/** Replace a 4-neighbour of type `from` with `to` with `pct` chance. Returns the index or -1. */
export function convertNeighbour(x, y, i, w, from, to, pct, aux = 0) {
  if (!chance(pct)) return -1;
  const j = near4(x, y, i, w, from);
  if (j !== -1) w.set(j, to, aux);
  return j;
}

/** Emit `id` into a random empty 4-neighbour with `pct` chance. */
export function produce(x, y, i, w, id, pct, aux = 0) {
  if (!chance(pct)) return false;
  const j = emptyNeighbour(x, y, i, w);
  if (j === -1) return false;
  w.set(j, id, aux);
  w.stamp[j] = w.parity;
  return true;
}

export function spawnFire(w, i) {
  w.set(i, FIRE, 12 + randInt(20));
}

/** Catch fire if touching something hot; uses the element's IGNITE chance. */
export function tryIgnite(x, y, i, w) {
  const id = w.cells[i];
  const pct = IGNITE[id];
  if (pct === 0) return false;
  if (!chance(pct)) return false;
  if (!nearHot(x, y, i, w)) return false;
  spawnFire(w, i);
  return true;
}

/**
 * Circular blast. Inner cells become fire or empty, rim cells become embers,
 * indestructible cells survive.
 */
export function explode(w, cx, cy, r) {
  const W = w.w, H = w.h, c = w.cells;
  const r2 = r * r;
  const y0 = Math.max(0, cy - r), y1 = Math.min(H - 1, cy + r);
  const x0 = Math.max(0, cx - r), x1 = Math.min(W - 1, cx + r);
  for (let y = y0; y <= y1; y++) {
    const dy = y - cy;
    for (let x = x0; x <= x1; x++) {
      const dx = x - cx;
      const d2 = dx * dx + dy * dy;
      if (d2 > r2) continue;
      const i = y * W + x;
      if (FLAGS[c[i]] & F_INDESTRUCTIBLE) continue;
      const t = d2 / r2;
      if (t > 0.72) {
        if (c[i] === EMPTY || (FLAGS[c[i]] & (F_LIQUID | F_GAS))) {
          if (rand() < 0.6) w.set(i, EMBER, 4 + randInt(14));
        }
        continue;
      }
      if (rand() < 0.55 - t * 0.4) w.set(i, FIRE, 6 + randInt(18));
      else if (rand() < 0.35) w.set(i, EMBER, 6 + randInt(16));
      else w.set(i, EMPTY, 0);
      w.stamp[i] = w.parity;
    }
  }
}

/** Grow into adjacent `food` cells (plant into water). */
export function grow(x, y, i, w, food, pct) {
  return convertNeighbour(x, y, i, w, food, w.cells[i], pct) !== -1;
}

export { F_FUEL };
