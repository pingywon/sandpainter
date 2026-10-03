/**
 * The element registry: what every element looks like and how it behaves.
 * Each update(x, y, i, world, params) runs at most once per cell per step.
 */
import { chance, rand, randInt } from './world.js';
import * as ID from './ids.js';
import {
  FLAGS, DENSITY, IGNITE,
  F_POWDER, F_LIQUID, F_GAS, F_STATIC, F_HOT, F_FUEL, F_INDESTRUCTIBLE,
} from './ids.js';
import {
  near4, near4Flag, nearHot, nearHot8, fallPowder, flowLiquid, riseGas, applyWind,
  convertNeighbour, produce, spawnFire, tryIgnite, explode, detonate,
} from './behaviors.js';

const {
  EMPTY, WALL, SAND, WATER, SALT, SALT_WATER, OIL, PLANT, FIRE, STEAM, SPOUT, WELL,
  TORCH, GUNPOWDER, WAX, MOLTEN_WAX, NITRO, NAPALM, C4, CONCRETE, SET_CONCRETE, FUSE,
  ICE, LAVA, ROCK, CRYO, METHANE, SOIL, WET_SOIL, SNOW, SEED, STEM, BLOOMS, ACID, CLONE,
  EMBER, RANDOM,
} = ID;

export const ELEMENTS = new Array(256).fill(null);

const noop = () => {};

function def(id, spec) {
  const e = {
    id,
    name: spec.name,
    group: spec.group ?? null,
    rgb: spec.rgb,
    rgb2: spec.rgb2 ?? null,
    variance: spec.variance ?? 0,
    flags: spec.flags ?? 0,
    density: spec.density ?? 0,
    ignite: spec.ignite ?? 0,
    update: spec.update ?? noop,
    initAux: spec.initAux ?? null,
    hint: spec.hint ?? '',
    key: spec.key ?? null,
  };
  ELEMENTS[id] = e;
  FLAGS[id] = e.flags;
  DENSITY[id] = e.density;
  IGNITE[id] = e.ignite;
  return e;
}

/* ============================ definitions ============================ */

def(EMPTY, { name: 'Eraser', group: 'Tools', rgb: [12, 11, 10], variance: 2, hint: 'Clears cells' });

def(WALL, {
  name: 'Wall', group: 'Solids', rgb: [98, 94, 88], variance: 7,
  flags: F_STATIC | F_INDESTRUCTIBLE, hint: 'Immovable, survives everything',
});

def(SAND, {
  name: 'Sand', group: 'Powders', rgb: [226, 196, 110], variance: 20, flags: F_POWDER, density: 2,
  hint: 'Piles up, sinks in water',
  update: (x, y, i, w, p) => { fallPowder(x, y, i, w, p, 100, 45); },
});

def(WATER, {
  name: 'Water', group: 'Liquids', rgb: [36, 108, 232], rgb2: [76, 156, 255], flags: F_LIQUID, density: 1,
  hint: 'Levels out, boils near heat, freezes near ice',
  update: (x, y, i, w, p) => {
    if (chance(55) && nearHot(x, y, i, w)) { w.set(i, STEAM); return; }
    flowLiquid(x, y, i, w, p, 8);
  },
});

def(SALT, {
  name: 'Salt', group: 'Powders', rgb: [242, 242, 238], variance: 8, flags: F_POWDER, density: 2,
  hint: 'Dissolves in water, melts ice and snow, kills plants',
  update: (x, y, i, w, p) => {
    if (chance(25)) {
      const j = near4(x, y, i, w, WATER);
      if (j !== -1) { w.set(j, SALT_WATER); w.set(i, EMPTY); return; }
    }
    if (chance(8)) {
      const j = near4(x, y, i, w, ICE);
      if (j !== -1) { w.set(j, WATER); return; }
    }
    fallPowder(x, y, i, w, p, 100, 30);
  },
});

def(SALT_WATER, {
  name: 'Salt water', rgb: [104, 168, 236], variance: 12, flags: F_LIQUID, density: 1.2,
  update: (x, y, i, w, p) => {
    if (chance(45) && nearHot(x, y, i, w)) { w.set(i, chance(30) ? SALT : STEAM); return; }
    flowLiquid(x, y, i, w, p, 8);
  },
});

def(OIL, {
  name: 'Oil', group: 'Liquids', rgb: [128, 62, 18], rgb2: [86, 40, 12], flags: F_LIQUID | F_FUEL, density: 0.8,
  ignite: 60, hint: 'Floats on water, burns hot and long',
  update: (x, y, i, w, p) => {
    if (tryIgnite(x, y, i, w)) return;
    flowLiquid(x, y, i, w, p, 6);
  },
});

const POOL_REACH = 24;

/**
 * True if the water at j is part of a pool: supported below, and its row runs into something solid
 * (or on for POOL_REACH cells) on both sides. A falling drop, or a puddle a stream keeps topping up on
 * a plant, reaches open air at an edge and does not count, so plants cannot climb a stream.
 */
function pooled(w, j, p) {
  const W = w.w, x = j % W, y = (j / W) | 0;
  const by = y + p.gravity;
  if (by >= 0 && by < w.h) {
    const b = w.cells[j + p.gravity * W];
    if (b === EMPTY || (FLAGS[b] & F_GAS)) return false;
  }
  for (const dx of [-1, 1]) {
    for (let s = 1; s <= POOL_REACH; s++) {
      const nx = x + dx * s;
      if (nx < 0 || nx >= W) break;
      const c = w.cells[j + dx * s];
      if (c === EMPTY || (FLAGS[c] & F_GAS)) return false;
      if (!(FLAGS[c] & F_LIQUID)) break;
    }
  }
  return true;
}

/** A random 4-neighbour holding pooled water, or -1. */
function stillWater(x, y, i, w, p) {
  const W = w.w, start = randInt(4);
  for (let k = 0; k < 4; k++) {
    let j = -1;
    switch ((start + k) & 3) {
      case 0: if (x > 0) j = i - 1; break;
      case 1: if (x < W - 1) j = i + 1; break;
      case 2: if (y > 0) j = i - W; break;
      case 3: if (y < w.h - 1) j = i + W; break;
    }
    if (j === -1 || w.cells[j] !== WATER || !pooled(w, j, p)) continue;
    // Upward growth also needs water or ground above that water, so a plant stays under the surface.
    if (j === i - p.gravity * W) {
      const a = j - p.gravity * W, ay = ((j / W) | 0) - p.gravity;
      if (ay >= 0 && ay < w.h && (w.cells[a] === EMPTY || (FLAGS[w.cells[a]] & F_GAS))) continue;
    }
    return j;
  }
  return -1;
}

/** How far (in cells) growth can spread from a painted plant before it stops. */
const GROW_SPAN = 14;

def(PLANT, {
  name: 'Plant', group: 'Solids', rgb: [44, 190, 74], variance: 22, flags: F_STATIC | F_FUEL, ignite: 35,
  hint: 'Grows a patch into still water, burns, hates salt',
  update: (x, y, i, w, p) => {
    if (tryIgnite(x, y, i, w)) return;
    // Only pooled water: a plant under a falling stream would otherwise climb it to the spigot.
    // aux counts generations from a painted cell, so a sprig takes a patch, not the whole pond.
    if (w.aux[i] < GROW_SPAN && chance(45)) {
      const j = stillWater(x, y, i, w, p);
      if (j !== -1) { w.set(j, PLANT, w.aux[i] + 1); return; }
    }
    if (chance(5) && near4(x, y, i, w, SALT) !== -1) w.set(i, EMPTY);
  },
});

def(FIRE, {
  name: 'Fire', group: 'Energy', rgb: [255, 70, 8], rgb2: [255, 222, 70], flags: F_GAS | F_HOT,
  hint: 'Rises, dies unless fed',
  initAux: () => 12 + randInt(20),
  update: (x, y, i, w, p) => {
    if (chance(80)) {
      let j = near4(x, y, i, w, WATER);
      if (j === -1) j = near4(x, y, i, w, SALT_WATER);
      if (j !== -1) { w.set(j, STEAM); w.set(i, EMPTY); return; }
    }
    w.shade[i] = randInt(8);
    // aux >= 128: a pinned flame (a burning fuse) that holds still for a few steps, then rises.
    if (w.aux[i] >= 128) {
      if (w.aux[i] === 128) w.set(i, FIRE, 4 + randInt(6));
      else w.aux[i]--;
      return;
    }
    const fuel = near4Flag(x, y, i, w, F_FUEL);
    const fed = fuel !== -1;
    if (fed) {
      if (w.aux[i] < 18) w.aux[i] = 18 + randInt(8);
      // Spread into the fuel directly, so a flame never rises away before catching.
      const pct = IGNITE[w.cells[fuel]];
      if (pct > 0 && chance(pct)) { spawnFire(w, fuel); w.stamp[fuel] = w.parity; }
    } else {
      if (w.aux[i] === 0 || chance(10)) { w.set(i, EMPTY); return; }
      w.aux[i]--;
    }
    if (fed && chance(90)) return; // linger on fuel so it keeps burning
    riseGas(x, y, i, w, p, 55, 0);
  },
});

def(EMBER, {
  name: 'Ember', rgb: [170, 36, 4], rgb2: [255, 150, 40], flags: F_GAS | F_HOT,
  update: (x, y, i, w, p) => {
    w.shade[i] = randInt(8);
    if (w.aux[i] === 0) { w.set(i, EMPTY); return; }
    w.aux[i]--;
    if (near4(x, y, i, w, WATER) !== -1) { w.set(i, EMPTY); return; }
    if (chance(70)) riseGas(x, y, i, w, p, 70, 0);
  },
});

def(STEAM, {
  name: 'Steam', rgb: [196, 212, 228], variance: 14, flags: F_GAS, density: 0,
  update: (x, y, i, w, p) => {
    if (near4(x, y, i, w, CRYO) !== -1 || near4(x, y, i, w, ICE) !== -1) { w.set(i, WATER); return; }
    const moved = riseGas(x, y, i, w, p, 45, 30);
    if (!moved) { if (chance(1.5)) w.set(i, WATER); }
    else if (chance(0.15)) w.set(i, WATER);
  },
});

def(SPOUT, {
  name: 'Spout', group: 'Producers', rgb: [118, 190, 250], variance: 5, flags: F_STATIC,
  hint: 'Endless water', update: (x, y, i, w) => { produce(x, y, i, w, WATER, 6); },
});

def(WELL, {
  name: 'Well', group: 'Producers', rgb: [138, 22, 38], variance: 6, flags: F_STATIC,
  hint: 'Endless oil', update: (x, y, i, w) => { produce(x, y, i, w, OIL, 8); },
});

def(TORCH, {
  name: 'Torch', group: 'Producers', rgb: [210, 48, 0], rgb2: [255, 130, 24], flags: F_STATIC | F_HOT,
  hint: 'Endless fire',
  update: (x, y, i, w) => {
    w.shade[i] = randInt(8);
    if (chance(25)) {
      const j = near4(x, y, i, w, EMPTY);
      if (j !== -1) { spawnFire(w, j); w.stamp[j] = w.parity; }
    }
  },
});

def(GUNPOWDER, {
  name: 'Gunpowder', group: 'Powders', rgb: [150, 150, 128], variance: 20, flags: F_POWDER, density: 2,
  hint: 'Pops when it meets fire',
  update: (x, y, i, w, p) => {
    if (nearHot(x, y, i, w)) { explode(w, x, y, 6); return; }
    fallPowder(x, y, i, w, p, 100, 40);
  },
});

def(WAX, {
  name: 'Wax', group: 'Solids', rgb: [238, 226, 206], variance: 6, flags: F_STATIC | F_FUEL,
  hint: 'Melts and drips near flame',
  update: (x, y, i, w) => {
    if (chance(6) && nearHot(x, y, i, w)) w.set(i, MOLTEN_WAX);
  },
});

def(MOLTEN_WAX, {
  name: 'Molten wax', rgb: [246, 234, 200], variance: 6, flags: F_LIQUID | F_FUEL, density: 0.9, ignite: 8,
  update: (x, y, i, w, p) => {
    if (tryIgnite(x, y, i, w)) return;
    if (chance(1.5) && !nearHot(x, y, i, w)) {
      const ny = y + p.gravity;
      if (ny < 0 || ny >= w.h || w.cells[i + p.gravity * w.w] !== EMPTY) { w.set(i, WAX); return; }
    }
    flowLiquid(x, y, i, w, p, 2, 70);
  },
});

def(NITRO, {
  name: 'Nitro', group: 'Liquids', rgb: [24, 164, 64], variance: 14, flags: F_LIQUID, density: 1.1,
  hint: 'Volatile liquid, big blast',
  update: (x, y, i, w, p) => {
    if (nearHot(x, y, i, w)) { detonate(w, x, y, 12); return; }
    flowLiquid(x, y, i, w, p, 6);
  },
});

/** Open air or a gas (not a flame) that burning napalm can push a flame into. */
function catchable(c) {
  return c === EMPTY || ((FLAGS[c] & F_GAS) !== 0 && c !== FIRE && c !== EMBER);
}

def(NAPALM, {
  name: 'Napalm', group: 'Liquids', rgb: [255, 100, 20], rgb2: [255, 196, 64], flags: F_LIQUID | F_FUEL, density: 0.9,
  hint: 'Burning oil: flows like oil, already on fire',
  update: (x, y, i, w, p) => {
    w.shade[i] = randInt(8);
    // Cryo puts it out, leaving plain oil.
    if (near4(x, y, i, w, CRYO) !== -1) { w.set(i, OIL); return; }
    // Always alight: flames lick up into open air, or into a gas beside it, which is how it sets methane off.
    if (chance(20)) {
      const W = w.w, a = i - p.gravity * W, ay = y - p.gravity;
      if (ay >= 0 && ay < w.h && catchable(w.cells[a])) spawnFire(w, a);
      else {
        const dx = rand() < 0.5 ? -1 : 1, nx = x + dx;
        if (nx >= 0 && nx < W && catchable(w.cells[i + dx])) spawnFire(w, i + dx);
      }
    }
    // Now and then a ball of flame rolls up off the surface, like burning oil.
    if (chance(0.5)) {
      const W = w.w, up = -p.gravity, a = i + up * W;
      if (y + up >= 0 && y + up < w.h && catchable(w.cells[a])) {
        const cy = y + up * (2 + randInt(3)), r = 1 + randInt(3);
        for (let dy = -r; dy <= r; dy++) {
          for (let dx = -r; dx <= r; dx++) {
            const xx = x + dx, yy = cy + dy;
            if (dx * dx + dy * dy > r * r || xx < 0 || xx >= W || yy < 0 || yy >= w.h) continue;
            if (catchable(w.cells[yy * W + xx])) w.set(yy * W + xx, FIRE, 8 + randInt(14));
          }
        }
      }
    }
    // It slowly burns away, ending as one last flame.
    if (chance(0.3)) { spawnFire(w, i); return; }
    flowLiquid(x, y, i, w, p, 5);
  },
});

def(C4, {
  name: 'C-4', group: 'Solids', rgb: [240, 230, 150], variance: 6, flags: F_STATIC,
  hint: 'Stable until lit, then a crater',
  update: (x, y, i, w) => { if (nearHot(x, y, i, w)) detonate(w, x, y, 22); },
});

def(CONCRETE, {
  name: 'Concrete', group: 'Powders', rgb: [172, 172, 170], variance: 12, flags: F_POWDER, density: 2.5,
  hint: 'Pours, then sets solid',
  update: (x, y, i, w, p) => {
    if (fallPowder(x, y, i, w, p, 100, 50)) return;
    if (w.aux[i] >= 40) { w.set(i, SET_CONCRETE); return; }
    w.aux[i]++;
  },
});

def(SET_CONCRETE, { name: 'Set concrete', rgb: [128, 128, 126], variance: 8, flags: F_STATIC });

def(FUSE, {
  name: 'Fuse', group: 'Solids', rgb: [222, 176, 202], variance: 8, flags: F_STATIC | F_FUEL,
  hint: 'Carries a flame along its length',
  update: (x, y, i, w) => { if (nearHot8(x, y, i, w)) w.set(i, FIRE, 128 + 3 + randInt(3)); },
});

def(ICE, {
  name: 'Ice', group: 'Solids', rgb: [168, 228, 255], variance: 12, flags: F_STATIC,
  hint: 'Freezes touching water, melts near heat',
  update: (x, y, i, w) => {
    if (chance(25) && nearHot(x, y, i, w)) { w.set(i, WATER); return; }
    convertNeighbour(x, y, i, w, WATER, ICE, 1.5);
  },
});

def(LAVA, {
  name: 'Lava', group: 'Liquids', rgb: [222, 58, 18], rgb2: [255, 176, 52], flags: F_LIQUID | F_HOT, density: 3,
  hint: 'Ignites, boils water, cools to rock',
  update: (x, y, i, w, p) => {
    w.shade[i] = randInt(8);
    if (chance(60)) {
      let j = near4(x, y, i, w, WATER);
      if (j === -1) j = near4(x, y, i, w, SALT_WATER);
      if (j !== -1) { w.set(j, STEAM); w.set(i, ROCK); return; }
    }
    // Sparks off the surface: methane or fuel drifting just above lava catches, not only what touches it.
    if (chance(0.4)) {
      const ay = y - p.gravity, a = i - p.gravity * w.w;
      if (ay >= 0 && ay < w.h && w.cells[a] === EMPTY) w.set(a, EMBER, 3 + randInt(5));
    }
    // Free fall at full speed; only spreading and sinking stay sluggish.
    const ny = y + p.gravity;
    if (ny >= 0 && ny < w.h && w.cells[i + p.gravity * w.w] === EMPTY) { w.move(i, i + p.gravity * w.w); return; }
    flowLiquid(x, y, i, w, p, 2, 35);
  },
});

def(ROCK, {
  name: 'Rock', rgb: [72, 46, 22], variance: 16, flags: F_POWDER, density: 3,
  update: (x, y, i, w, p) => { fallPowder(x, y, i, w, p, 60, 60); },
});

def(CRYO, {
  name: 'Cryo', group: 'Liquids', rgb: [0, 196, 255], rgb2: [156, 240, 255], flags: F_LIQUID, density: 1,
  hint: 'Freezes water, quenches fire, hardens lava',
  update: (x, y, i, w, p) => {
    let j = near4(x, y, i, w, WATER);
    if (j !== -1 && chance(35)) { w.set(j, ICE); if (chance(30)) { w.set(i, EMPTY); return; } }
    j = near4(x, y, i, w, LAVA);
    if (j !== -1) { w.set(j, ROCK); if (chance(50)) { w.set(i, EMPTY); return; } }
    j = near4Flag(x, y, i, w, F_HOT);
    if (j !== -1 && chance(80)) { w.set(j, EMPTY); w.set(i, chance(40) ? STEAM : CRYO); if (w.cells[i] === STEAM) return; }
    if (chance(0.4)) { w.set(i, EMPTY); return; }
    flowLiquid(x, y, i, w, p, 7);
  },
});

def(METHANE, {
  name: 'Methane', group: 'Energy', rgb: [142, 142, 154], variance: 10, flags: F_GAS,
  hint: 'Drifting gas, explosive',
  update: (x, y, i, w, p) => {
    if (nearHot(x, y, i, w)) { explode(w, x, y, 4); return; }
    riseGas(x, y, i, w, p, 55, 30);
  },
});

def(SOIL, {
  name: 'Soil', group: 'Powders', rgb: [122, 76, 36], variance: 16, flags: F_POWDER, density: 2,
  hint: 'Soaks up water, seeds grow in it when wet',
  update: (x, y, i, w, p) => {
    if (chance(20)) {
      const j = near4(x, y, i, w, WATER);
      if (j !== -1) { w.set(j, EMPTY); w.set(i, WET_SOIL); return; }
    }
    fallPowder(x, y, i, w, p, 80, 40);
  },
});

def(WET_SOIL, {
  name: 'Wet soil', rgb: [70, 38, 14], variance: 10, flags: F_POWDER, density: 2.2,
  update: (x, y, i, w, p) => {
    if (chance(10) && nearHot(x, y, i, w)) { w.set(i, SOIL); return; }
    fallPowder(x, y, i, w, p, 30, 40);
  },
});

def(SNOW, {
  name: 'Snow', group: 'Powders', rgb: [246, 248, 255], variance: 5, flags: F_POWDER, density: 0.5,
  hint: 'Drifts down, melts near warmth or salt',
  update: (x, y, i, w, p) => {
    if (chance(60) && nearHot(x, y, i, w)) { w.set(i, WATER); return; }
    if (chance(15) && near4(x, y, i, w, SALT) !== -1) { w.set(i, WATER); return; }
    if (chance(8) && near4(x, y, i, w, WATER) !== -1) { w.set(i, WATER); return; }
    if (chance(0.03)) { w.set(i, WATER); return; }
    if (chance(25)) {
      const dx = chance(50) ? -1 : 1;
      const nx = x + dx;
      if (nx >= 0 && nx < w.w && w.cells[i + dx] === EMPTY) { w.move(i, i + dx); return; }
    }
    if (chance(70)) fallPowder(x, y, i, w, p, 100, 0);
  },
});

def(SEED, {
  name: 'Seed', group: 'Powders', rgb: [184, 142, 62], variance: 16, flags: F_POWDER | F_FUEL, density: 1.5, ignite: 40,
  hint: 'Sprouts a flower when it lands on wet soil',
  update: (x, y, i, w, p) => {
    if (tryIgnite(x, y, i, w)) return;
    const ny = y + p.gravity;
    if (ny >= 0 && ny < w.h && w.cells[i + p.gravity * w.w] === WET_SOIL && chance(6)) {
      w.set(i, STEM, 6 + randInt(9));
      return;
    }
    fallPowder(x, y, i, w, p, 100, 40);
  },
});

function bloom(w, j, x, y, p) {
  const id = BLOOMS[randInt(BLOOMS.length)];
  w.set(j, id);
  const W = w.w;
  if (x > 0 && w.cells[j - 1] === EMPTY) w.set(j - 1, id);
  if (x < W - 1 && w.cells[j + 1] === EMPTY) w.set(j + 1, id);
  const ny = y - p.gravity;
  if (ny >= 0 && ny < w.h && w.cells[j - p.gravity * W] === EMPTY) w.set(j - p.gravity * W, id);
}

def(STEM, {
  name: 'Stem', rgb: [62, 142, 52], variance: 12, flags: F_STATIC | F_FUEL, ignite: 30,
  initAux: () => 5 + randInt(8),
  update: (x, y, i, w, p) => {
    if (tryIgnite(x, y, i, w)) return;
    const a = w.aux[i];
    if (a === 0) return;
    const ny = y - p.gravity;
    if (ny < 0 || ny >= w.h) { w.aux[i] = 0; return; }
    const j = i - p.gravity * w.w;
    const above = w.cells[j];
    if (above !== EMPTY && above !== WATER) { if (chance(5)) w.aux[i] = 0; return; }
    if (!chance(12)) return;
    if (a === 1) bloom(w, j, x, ny, p);
    else w.set(j, STEM, a - 1);
    w.stamp[j] = w.parity;
    w.aux[i] = 0;
  },
});

const bloomSpec = (name, rgb) => ({
  name, rgb, variance: 22, flags: F_STATIC | F_FUEL, ignite: 45,
  update: (x, y, i, w) => { tryIgnite(x, y, i, w); },
});
def(BLOOMS[0], bloomSpec('Bloom', [255, 108, 172]));
def(BLOOMS[1], bloomSpec('Bloom', [255, 212, 64]));
def(BLOOMS[2], bloomSpec('Bloom', [182, 112, 255]));
def(BLOOMS[3], bloomSpec('Bloom', [255, 122, 82]));
def(BLOOMS[4], bloomSpec('Bloom', [206, 224, 255]));

def(ACID, {
  name: 'Acid', group: 'Liquids', rgb: [136, 255, 40], rgb2: [222, 255, 128], flags: F_LIQUID, density: 1.05,
  hint: 'Eats through almost anything',
  update: (x, y, i, w, p) => {
    const c = w.cells, W = w.w;
    const start = randInt(4);
    for (let k = 0; k < 4; k++) {
      let j = -1;
      switch ((start + k) & 3) {
        case 0: if (x > 0) j = i - 1; break;
        case 1: if (x < W - 1) j = i + 1; break;
        case 2: if (y > 0) j = i - W; break;
        case 3: if (y < w.h - 1) j = i + W; break;
      }
      if (j === -1) continue;
      const t = c[j];
      if (t === EMPTY || t === ACID || t === WATER || (FLAGS[t] & F_INDESTRUCTIBLE)) continue;
      if (chance(30)) {
        w.set(j, EMPTY);
        if (chance(40)) { w.set(i, EMPTY); return; }
      }
      break;
    }
    if (chance(4) && near4(x, y, i, w, WATER) !== -1) { w.set(i, WATER); return; }
    flowLiquid(x, y, i, w, p, 6);
  },
});

def(CLONE, {
  name: 'Clone', group: 'Producers', rgb: [226, 190, 255], variance: 6, flags: F_STATIC | F_INDESTRUCTIBLE,
  hint: 'Drop something on it: it pours that out forever',
  update: (x, y, i, w, p) => {
    const a = w.aux[i];
    if (a === 0) {
      const j = near4Flag(x, y, i, w, F_POWDER | F_LIQUID | F_GAS);
      if (j !== -1 && w.cells[j] !== CLONE) { w.aux[i] = w.cells[j]; return; }
      // Learn from a neighbouring clone cell, so the whole block pours, not just the cells that were touched.
      const W = w.w;
      const n = [x > 0 ? i - 1 : -1, x < W - 1 ? i + 1 : -1, y > 0 ? i - W : -1, y < w.h - 1 ? i + W : -1];
      for (const k of n) if (k !== -1 && w.cells[k] === CLONE && w.aux[k] !== 0) { w.aux[i] = w.aux[k]; return; }
      return;
    }
    const e = ELEMENTS[a];
    // Pour out of the bottom (the top for a gas), gently, like a spout: pouring from every side flooded the screen.
    const dir = (FLAGS[a] & F_GAS) ? -p.gravity : p.gravity, ny = y + dir, j = i + dir * w.w;
    if (ny >= 0 && ny < w.h && w.cells[j] === EMPTY && chance(5)) w.set(j, a, e && e.initAux ? e.initAux() : 0);
  },
});

/* ============================ menus ============================ */

/** Elements that appear in the painting tray, in display order. */
export const TRAY = [
  SAND, SALT, GUNPOWDER, CONCRETE, SOIL, SNOW, SEED,
  WATER, OIL, NITRO, NAPALM, LAVA, CRYO, ACID,
  WALL, PLANT, WAX, C4, FUSE, ICE,
  FIRE, METHANE,
  SPOUT, WELL, TORCH, CLONE,
  RANDOM, EMPTY,
];

export const GROUPS = ['Powders', 'Liquids', 'Solids', 'Energy', 'Producers', 'Tools'];

/** Elements a spigot may pour. */
export const SPIGOT_OPTIONS = [
  SAND, WATER, SALT, OIL, GUNPOWDER, NITRO, NAPALM, CONCRETE, LAVA, CRYO, SNOW, ACID, SEED, SOIL, RANDOM,
];

/** Pool used by RANDOM (brush and spigot). */
const RANDOM_POOL = [
  SAND, WATER, SALT, OIL, GUNPOWDER, NITRO, NAPALM, CONCRETE, LAVA, CRYO, SNOW, ACID, SEED, SOIL, METHANE, PLANT, WAX, ICE,
];

export function randomElement() {
  return RANDOM_POOL[randInt(RANDOM_POOL.length)];
}

/** Resolve a menu id (which may be RANDOM) to a concrete element id. */
export function resolve(id) {
  return id === RANDOM ? randomElement() : id;
}

export function elementName(id) {
  if (id === RANDOM) return 'Random';
  const e = ELEMENTS[id];
  return e ? e.name : '?';
}

export function elementHint(id) {
  if (id === RANDOM) return 'A different element for every cell';
  const e = ELEMENTS[id];
  return e ? e.hint : '';
}

export function elementCss(id) {
  if (id === RANDOM) return 'linear-gradient(135deg,#e2c46e,#246ce8 40%,#de3a12 70%,#88ff28)';
  const e = ELEMENTS[id];
  if (!e) return '#000';
  if (id === EMPTY) return '#2a2825';
  const [r, g, b] = e.rgb;
  if (e.rgb2) {
    const [r2, g2, b2] = e.rgb2;
    return `linear-gradient(135deg, rgb(${r},${g},${b}), rgb(${r2},${g2},${b2}))`;
  }
  return `rgb(${r},${g},${b})`;
}
