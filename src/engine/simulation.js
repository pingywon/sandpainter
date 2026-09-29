/**
 * Runs one simulation step: emits from spigots, then visits every non-empty
 * cell once, from the far side of gravity toward the near side, alternating
 * the x sweep each frame so nothing drifts left or right by accident.
 */
import { ELEMENTS } from './elements.js';

export function step(world, params, spigots) {
  world.parity ^= 1;
  world.frame++;
  const P = world.parity;
  spigots.emit(world, params);

  const { w, h, cells, stamp } = world;
  const down = params.gravity > 0;
  const flip = (world.frame & 1) === 1;

  for (let yy = 0; yy < h; yy++) {
    const y = down ? h - 1 - yy : yy;
    const row = y * w;
    if (!flip) {
      for (let x = 0; x < w; x++) {
        const i = row + x;
        const id = cells[i];
        if (id === 0 || stamp[i] === P) continue;
        stamp[i] = P;
        ELEMENTS[id].update(x, y, i, world, params);
      }
    } else {
      for (let x = w - 1; x >= 0; x--) {
        const i = row + x;
        const id = cells[i];
        if (id === 0 || stamp[i] === P) continue;
        stamp[i] = P;
        ELEMENTS[id].update(x, y, i, world, params);
      }
    }
  }
}
