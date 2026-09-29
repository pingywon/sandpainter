/**
 * Painting: stamps a circle of an element along a line between two points.
 */
import { EMPTY } from './ids.js';
import { ELEMENTS, resolve } from './elements.js';

export const BRUSH_SIZES = [1, 2, 4, 8, 16, 32, 64];

function stamp(world, cx, cy, menuId, size) {
  const { w, h } = world;
  if (size <= 2) {
    for (let dy = 0; dy < size; dy++) {
      const y = cy + dy;
      if (y < 0 || y >= h) continue;
      for (let dx = 0; dx < size; dx++) {
        const x = cx + dx;
        if (x < 0 || x >= w) continue;
        put(world, y * w + x, menuId);
      }
    }
    return;
  }
  const r = size / 2;
  const r2 = r * r;
  const y0 = Math.max(0, Math.floor(cy - r)), y1 = Math.min(h - 1, Math.ceil(cy + r));
  const x0 = Math.max(0, Math.floor(cx - r)), x1 = Math.min(w - 1, Math.ceil(cx + r));
  for (let y = y0; y <= y1; y++) {
    const dy = y - cy + 0.5;
    for (let x = x0; x <= x1; x++) {
      const dx = x - cx + 0.5;
      if (dx * dx + dy * dy > r2) continue;
      put(world, y * w + x, menuId);
    }
  }
}

function put(world, i, menuId) {
  if (menuId === EMPTY) { world.set(i, EMPTY, 0); return; }
  const id = resolve(menuId);
  const e = ELEMENTS[id];
  world.set(i, id, e.initAux ? e.initAux() : 0);
}

/** Paint from (x0,y0) to (x1,y1) inclusive, in world coordinates. */
export function paintLine(world, x0, y0, x1, y1, menuId, size) {
  x0 |= 0; y0 |= 0; x1 |= 0; y1 |= 0;
  const dx = Math.abs(x1 - x0), sx = x0 < x1 ? 1 : -1;
  const dy = -Math.abs(y1 - y0), sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  // Thin the stamp cadence for big brushes so long strokes stay cheap.
  const every = size >= 32 ? 4 : size >= 16 ? 2 : 1;
  let n = 0;
  for (;;) {
    if (n % every === 0) stamp(world, x0, y0, menuId, size);
    n++;
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) { err += dy; x0 += sx; }
    if (e2 <= dx) { err += dx; y0 += sy; }
  }
  if ((n - 1) % every !== 0) stamp(world, x1, y1, menuId, size);
}
