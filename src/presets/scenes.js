/**
 * The eight showcase presets: hand-built scenes that load live mid-game.
 * Each entry paints its landscape straight into the world and names the stage
 * settings it needs (closed box, wind). Speed and colour mode stay the player's.
 * `ticks` is the moment the thumbnail tool photographs (tools/preset_thumbs.mjs).
 */
import * as ID from '../engine/ids.js';
import { chance } from '../engine/world.js';

function fill(w, x0, y0, x1, y1, id, aux = 0) {
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) w.set(y * w.w + x, id, aux);
}

/** Sprinkle `id` over a rectangle, pct percent of cells. */
function scatter(w, x0, y0, x1, y1, id, pct, aux = 0) {
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    if (chance(pct)) w.set(y * w.w + x, id, aux);
  }
}

/** A filled triangle: straight slopes from a peak down to a base row (a cone). */
function cone(w, cx, peakY, baseY, peakHalf, baseHalf, id) {
  for (let y = peakY; y <= baseY; y++) {
    const t = (y - peakY) / (baseY - peakY);
    const half = Math.round(peakHalf + (baseHalf - peakHalf) * t);
    fill(w, cx - half, y, cx + half, y, id);
  }
}

export const PRESETS = [
  {
    key: 'oil-strike',
    name: 'Oil Strike',
    teaser: 'The drill hits the motherlode.',
    settings: { box: false, wind: 0 },
    ticks: 1900,
    build(w) {
      fill(w, 0, 444, 639, 479, ID.WALL);                 // bedrock
      fill(w, 0, 360, 639, 443, ID.SOIL);                 // deep ground
      fill(w, 0, 320, 639, 359, ID.SAND);                 // topsoil
      // Sand berms left and right make the middle a valley, so the strike pools deep.
      for (const [x0, x1, top] of [[0, 50, 266], [50, 90, 284], [90, 125, 302],
        [515, 550, 302], [550, 590, 284], [590, 639, 266]]) {
        fill(w, x0, top, x1, 319, ID.SAND);
      }
      for (const cx of [200, 320, 440]) {
        fill(w, cx - 10, 432, cx + 10, 443, ID.WELL);     // three buried wells
      }
      // A skeletal derrick over the middle well.
      fill(w, 300, 240, 302, 319, ID.WALL);
      fill(w, 338, 240, 340, 319, ID.WALL);
      fill(w, 300, 240, 340, 242, ID.WALL);
      // A torch on a post in the valley: once the pool rises to it, the strike lights up.
      fill(w, 480, 302, 486, 319, ID.WALL);
      fill(w, 480, 294, 486, 301, ID.TORCH);
    },
  },
  {
    key: 'volcano',
    name: 'Volcano Island',
    teaser: 'The island grows itself.',
    settings: { box: true, wind: 0 },
    ticks: 1400,
    build(w) {
      fill(w, 0, 380, 639, 479, ID.WATER);                // the sea
      cone(w, 320, 195, 460, 18, 150, ID.SET_CONCRETE);   // the mountain
      fill(w, 306, 195, 334, 250, ID.EMPTY);              // the crater bowl
      fill(w, 310, 220, 330, 250, ID.LAVA);               // already simmering
      // A floating sky island drips endless lava into the crater; the bowl
      // overflows, rivers run the slopes, and the sea turns them to rock.
      fill(w, 296, 140, 344, 150, ID.SET_CONCRETE);
      fill(w, 304, 151, 336, 155, ID.CLONE, ID.LAVA);
    },
  },
  {
    key: 'secret-garden',
    name: 'Secret Garden',
    teaser: 'Rain falls, flowers follow.',
    settings: { box: false, wind: 0 },
    ticks: 1800,
    build(w) {
      fill(w, 0, 456, 639, 479, ID.WALL);                 // ground
      fill(w, 2, 456, 6, 479, ID.EMPTY);                  // drains, so the rain
      fill(w, 633, 456, 637, 479, ID.EMPTY);              // never floods the garden
      fill(w, 14, 420, 625, 455, ID.SOIL);                // the main bed
      scatter(w, 10, 414, 630, 419, ID.SEED, 22);
      // Two hanging terraces.
      fill(w, 60, 340, 260, 344, ID.WALL);
      fill(w, 70, 312, 250, 339, ID.SOIL);
      scatter(w, 75, 306, 245, 311, ID.SEED, 22);
      fill(w, 380, 290, 580, 294, ID.WALL);
      fill(w, 390, 262, 570, 289, ID.SOIL);
      scatter(w, 395, 256, 565, 261, ID.SEED, 22);
      // Spout clouds drizzle on each bed.
      fill(w, 120, 80, 170, 88, ID.SPOUT);
      fill(w, 430, 40, 490, 48, ID.SPOUT);
      fill(w, 540, 150, 580, 156, ID.SPOUT);
    },
  },
  {
    key: 'demolition',
    name: 'Demolition Day',
    teaser: 'Drop fire on the fuse post. When ready.',
    settings: { box: false, wind: 0 },
    ticks: 60,
    build(w) {
      fill(w, 0, 456, 639, 479, ID.WALL);                 // ground
      // The doomed castle: two towers and a curtain wall.
      for (const cx of [255, 385]) {
        fill(w, cx - 24, 300, cx + 24, 455, ID.SET_CONCRETE);
        fill(w, cx - 28, 288, cx + 28, 300, ID.SET_CONCRETE);
        for (let bx = cx - 28; bx <= cx + 28; bx += 14) fill(w, bx, 276, bx + 6, 287, ID.SET_CONCRETE); // battlements
        fill(w, cx - 12, 416, cx + 12, 444, ID.C4);        // the basement charge
      }
      fill(w, 279, 380, 361, 455, ID.SET_CONCRETE);        // curtain wall
      fill(w, 300, 400, 340, 428, ID.C4);                  // the big center charge
      fill(w, 296, 445, 344, 448, ID.SET_CONCRETE);        // a sill keeps the kegs shelved
      fill(w, 296, 429, 344, 444, ID.GUNPOWDER);           // kegs under the charge
      fill(w, 312, 449, 328, 455, ID.EMPTY);               // the gate (lets the fuse in)
      // The fuse: from the kegs, out the gate, along the ground, up a post.
      fill(w, 320, 445, 322, 455, ID.FUSE);
      fill(w, 322, 453, 560, 455, ID.FUSE);
      fill(w, 558, 420, 560, 453, ID.FUSE);
      fill(w, 554, 414, 564, 419, ID.WALL);                // the post cap marks the lighting spot
      fill(w, 556, 408, 562, 413, ID.FUSE);                // the tip, in the open, waiting
    },
  },
  {
    key: 'candle-shrine',
    name: 'Candle Shrine',
    teaser: 'Wax melts. Ice endures. Mostly.',
    settings: { box: false, wind: 0 },
    ticks: 1200,
    build(w) {
      fill(w, 0, 456, 639, 479, ID.WALL);                 // the altar floor
      fill(w, 160, 448, 480, 455, ID.SET_CONCRETE);       // a low plinth
      const candles = [[208, 360], [318, 300], [428, 360]]; // [center x, flame height]
      for (const [cx, top] of candles) {
        fill(w, cx - 9, top, cx + 9, 447, ID.WAX);
        fill(w, cx - 4, top - 7, cx + 4, top - 1, ID.TORCH); // an eternal flame
      }
      // Ice pillars flank the shrine, slowly losing to the warmth.
      fill(w, 100, 360, 124, 455, ID.ICE);
      fill(w, 512, 360, 536, 455, ID.ICE);
    },
  },
  {
    key: 'frozen-falls',
    name: 'Frozen Falls',
    teaser: 'Everything freezes mid-fall.',
    settings: { box: false, wind: 0 },
    ticks: 1400,
    build(w) {
      fill(w, 0, 456, 639, 479, ID.WALL);                 // valley floor
      fill(w, 2, 456, 6, 479, ID.EMPTY);                  // drains keep the valley
      fill(w, 633, 456, 637, 479, ID.EMPTY);              // from flooding
      // Three descending cliff shelves.
      fill(w, 0, 140, 200, 148, ID.WALL);
      fill(w, 120, 260, 360, 268, ID.WALL);
      fill(w, 280, 380, 560, 388, ID.WALL);
      // The river source, embedded at the top of the cliff.
      fill(w, 4, 130, 70, 139, ID.SPOUT);
      // Cryo waits where the falls land.
      fill(w, 290, 250, 356, 259, ID.CRYO);
      fill(w, 480, 370, 556, 379, ID.CRYO);
      // A salt drift eats its own channel through whatever freezes.
      fill(w, 300, 370, 348, 379, ID.SALT);
      // A snow cloud drifts over the far side.
      fill(w, 584, 60, 624, 66, ID.CLONE, ID.SNOW);
    },
  },
  {
    key: 'clone-factory',
    name: 'Clone Factory',
    teaser: 'Feed it once, it pours forever.',
    settings: { box: false, wind: 0 },
    ticks: 900,
    build(w) {
      fill(w, 0, 456, 639, 479, ID.WALL);                 // shop floor
      // Four open-top bins, each with its own tireless pourer above.
      const bins = [
        [40, 160, ID.SAND], [196, 316, ID.WATER], [352, 472, ID.LAVA], [508, 628, ID.SNOW],
      ];
      for (const [x0, x1, idl] of bins) {
        fill(w, x0, 330, x0 + 5, 455, ID.WALL);
        fill(w, x1 - 5, 330, x1, 455, ID.WALL);
        const cx = (x0 + x1) >> 1;
        fill(w, cx - 12, 120, cx + 12, 129, ID.CLONE, idl);
      }
      // Up top, a methane maker under a torch: an endless little thunderstorm.
      fill(w, 300, 60, 340, 64, ID.CLONE, ID.METHANE);
      fill(w, 308, 8, 332, 20, ID.TORCH);
    },
  },
  {
    key: 'storm-box',
    name: 'Storm in a Box',
    teaser: 'Weather that never settles.',
    settings: { box: true, wind: 40 },
    ticks: 1100,
    build(w) {
      // A sealed world with its own water cycle: a hot rock boils the pond,
      // steam rains back off the ceiling, and the wind feeds gas to a sky
      // flame that thunders. It never settles.
      fill(w, 0, 442, 639, 479, ID.WATER);                // the pond
      fill(w, 294, 436, 346, 456, ID.TORCH);              // the boiler, standing in it
      fill(w, 290, 457, 350, 479, ID.SET_CONCRETE);       // on a stone footing
      // A lava cove behind a dam: rain turns its surface to growing rock.
      fill(w, 0, 420, 150, 479, ID.LAVA);
      fill(w, 151, 400, 168, 479, ID.SET_CONCRETE);
      // The gasworks: methane made top-left, the wind walks it into the sky flame.
      fill(w, 20, 10, 70, 14, ID.CLONE, ID.METHANE);
      fill(w, 560, 6, 600, 22, ID.TORCH);
    },
  },
];

export function presetByKey(key) {
  return PRESETS.find((s) => s.key === key) || null;
}
