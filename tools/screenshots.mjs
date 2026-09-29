// Stages scenes in the real game (Sandpainter.html) and saves docs/screenshots/*.png.
//   python3 tools/build_standalone.py
//   node --experimental-websocket tools/screenshots.mjs      (Node 22+: no flag needed)
//   node --experimental-websocket tools/screenshots.mjs 04 09   (only the named shots)
// Each scene runs through the app API (paint/tick) while paused, then the canvas is captured.
// `zoom` crops a world-space box at 2x; the canvas is pixelated, so it stays crisp.
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { launch } from './cdp.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const GAME = `file://${ROOT}Sandpainter.html`;
const OUT = `${ROOT}docs/screenshots`;
mkdirSync(OUT, { recursive: true });
const ONLY = process.argv.slice(2);
const wanted = (name) => !ONLY.length || ONLY.some((o) => name.startsWith(o));

// Ids mirror src/engine/ids.js.
const PRE = `
const S = sandpainter;
const I = { EMPTY: 0, WALL: 1, SAND: 2, WATER: 3, SALT: 4, OIL: 6, PLANT: 7, FIRE: 8, TORCH: 12, GUNPOWDER: 13,
  WAX: 14, NITRO: 16, C4: 18, ICE: 22, LAVA: 23, ROCK: 24, CRYO: 25, SOIL: 27, SNOW: 29, SEED: 30, STEM: 31, CLONE: 38 };
S.params.paused = true;
if (!S.params.box) S.toggleBox();
S.world.clear();
for (let k = 0; k < 4; k++) S.spigots.set(k, { rate: 0 });
const W = S.world.w;
const rect = (x0, y0, x1, y1, id) => { for (let y = y0; y <= y1; y += 2) S.paint(x0, y, x1, y, id, 2); };
const count = (...ids) => { let n = 0; for (const c of S.world.cells) if (ids.includes(c)) n++; return n; };
const pour = (k, id, rate) => S.spigots.set(k, { element: id, rate });
const surface = (x, id) => { let y = 0; while (y < S.world.h - 1 && S.world.cells[y * W + x] !== id) y++; return y; };
rect(0, 472, 639, 479, I.WALL);
`;

const SCENES = [
  {
    name: '02-oil-fire',
    js: `
      rect(70, 300, 79, 471, I.WALL); rect(560, 300, 569, 471, I.WALL);
      rect(80, 360, 559, 470, I.WATER); rect(80, 318, 559, 340, I.OIL);
      S.tick(250);
      const y = surface(100, I.OIL);
      const o0 = count(I.OIL);
      S.paint(84, y + 1, 110, y + 1, I.FIRE, 3);
      let n = 0;
      while (n < 1500 && count(I.OIL) > o0 * 0.5) { S.tick(1); n++; }
      ({ ticks: n, fire: count(I.FIRE), oil: count(I.OIL), oilStart: o0 });`,
  },
  {
    name: '03-volcano',
    js: `
      rect(0, 300, 639, 470, I.WATER);
      pour(1, I.LAVA, 4); pour(2, I.LAVA, 3);
      S.tick(1300);
      ({ rock: count(I.ROCK), lava: count(I.LAVA), steam: count(9) });`,
  },
  {
    name: '04-garden',
    zoom: { x: 0, y: 375, w: 320, h: 105 },
    js: `
      rect(0, 420, 639, 470, I.SOIL);
      S.paint(0, 419, 639, 419, I.WATER, 1);
      S.tick(300);
      for (let x = 6; x < 636; x += 11) S.paint(x, 400, x, 400, I.SEED, 2);
      S.tick(2200);
      ({ water: count(I.WATER), stems: count(I.STEM), blooms: count(32, 33, 34, 35, 36) });`,
  },
  {
    name: '05-chain-reaction',
    js: `
      rect(0, 400, 639, 470, I.SAND);
      rect(440, 350, 500, 398, I.C4);
      rect(30, 396, 439, 399, I.GUNPOWDER);
      rect(520, 380, 620, 398, I.NITRO);
      S.paint(30, 396, 33, 396, I.FIRE, 3);
      const c0 = count(I.C4);
      let n = 0;
      while (n < 1500 && count(I.C4) >= c0) { S.tick(1); n++; }
      S.tick(4);
      ({ ticksToC4: n, c4Left: count(I.C4), fire: count(I.FIRE, 39) });`,
  },
  {
    name: '14-napalm',
    zoom: { x: 120, y: 250, w: 400, h: 110 },
    js: `
      rect(0, 330, 639, 470, I.WATER);
      rect(90, 312, 550, 329, 17);
      S.tick(260);
      ({ napalm: count(17), fire: count(I.FIRE) });`,
  },
  {
    name: '06-clone-fountains',
    js: `
      const xs = [128, 256, 384, 512], els = [I.LAVA, I.WATER, I.SAND, I.SNOW];
      xs.forEach((x, k) => { rect(x - 8, 40, x + 8, 50, I.CLONE); rect(x - 4, 30, x + 4, 36, els[k]); });
      rect(200, 300, 320, 306, I.WALL);
      S.tick(1200);
      ({ lava: count(I.LAVA), water: count(I.WATER), sand: count(I.SAND), snow: count(I.SNOW), rock: count(I.ROCK) });`,
  },
  {
    name: '07-deep-freeze',
    js: `
      rect(0, 260, 639, 470, I.WATER);
      pour(0, I.CRYO, 4); pour(3, I.CRYO, 4); pour(1, I.SNOW, 5); pour(2, I.SNOW, 5);
      for (let x = 60; x < 600; x += 80) S.paint(x, 460, x, 460, I.ICE, 5);
      S.tick(700);
      ({ ice: count(I.ICE), water: count(I.WATER) });`,
  },
  {
    name: '08-candle',
    zoom: { x: 200, y: 200, w: 240, h: 280 },
    js: `
      rect(150, 446, 490, 471, I.WALL);
      rect(290, 440, 350, 444, I.TORCH);
      rect(292, 250, 348, 438, I.WAX);
      S.tick(900);
      ({ wax: count(I.WAX), molten: count(15), fire: count(I.FIRE) });`,
  },
  {
    name: '09-upside-down',
    zoom: { x: 0, y: 0, w: 320, h: 120 },
    js: `
      rect(0, 420, 639, 470, I.SOIL);
      S.flipGravity();
      S.tick(600);
      S.paint(0, 240, 639, 240, I.WATER, 1);
      S.tick(400);
      for (let x = 6; x < 636; x += 11) S.paint(x, 240, x, 240, I.SEED, 2);
      S.tick(2400);
      ({ stems: count(I.STEM), blooms: count(32, 33, 34, 35, 36) });`,
  },
];

async function canvasBox(page) {
  return page.eval(`(() => { const r = document.getElementById('world').getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height }; })()`);
}

async function run(name, fn, opts) {
  if (!wanted(name)) return;
  const page = await launch(opts);
  try {
    await page.goto(GAME);
    const info = await fn(page);
    const errs = page.errors();
    console.log(name.padEnd(20), JSON.stringify(info ?? {}), errs.length ? `ERRORS: ${JSON.stringify(errs).slice(0, 300)}` : '');
  } finally {
    await page.close();
  }
}

await run('01-overview', async (p) => {
  await p.eval(PRE + `
    rect(30, 330, 37, 471, I.WALL); rect(300, 330, 307, 471, I.WALL);
    rect(340, 330, 347, 471, I.WALL); rect(610, 330, 617, 471, I.WALL);
    rect(38, 400, 299, 470, I.WATER);
    for (let x = 50; x < 290; x += 40) S.paint(x, 468, x, 468, I.PLANT, 4);
    rect(348, 420, 609, 470, I.WATER);
    pour(0, I.SAND, 2); pour(1, I.WATER, 1); pour(2, I.SALT, 2); pour(3, I.OIL, 3);
    S.tick(700);
    S.paint(590, 330, 600, 330, I.TORCH, 4);
    S.tick(60);
    S.setElement(I.LAVA);
    S.params.paused = false;`);
  await p.sleep(900);
  await p.shot(`${OUT}/01-overview.png`);
}, { width: 1400, height: 900 });

for (const sc of SCENES) {
  await run(sc.name, async (p) => {
    const info = await p.eval(PRE + sc.js);
    await p.sleep(400);
    const box = await canvasBox(p);
    if (sc.zoom) {
      const sx = box.width / 640, sy = box.height / 480;
      const z = sc.zoom;
      await p.shot(`${OUT}/${sc.name}.png`, { x: box.x + z.x * sx, y: box.y + z.y * sy, width: z.w * sx, height: z.h * sy }, 2);
    } else {
      await p.shot(`${OUT}/${sc.name}.png`, box);
    }
    return info;
  }, { width: 1400, height: 900 });
}

await run('10-help', async (p) => {
  await p.eval(PRE + `pour(0, I.SAND, 2); pour(1, I.WATER, 2); pour(2, I.SALT, 2); pour(3, I.OIL, 2); S.tick(300);
    document.getElementById('help').showModal();`);
  await p.sleep(600);
  await p.shot(`${OUT}/10-help.png`);
}, { width: 1400, height: 900 });

await run('11-element-guide', async (p) => {
  await p.goto(`file://${ROOT}Element-Guide.html`);
  await p.eval(`document.getElementById('elements').scrollIntoView()`);
  await p.sleep(400);
  await p.shot(`${OUT}/11-element-guide.png`);
}, { width: 1280, height: 1500 });

await run('13-paused', async (p) => {
  await p.eval(PRE + `pour(0, I.SAND, 2); pour(1, I.WATER, 2); pour(2, I.SALT, 2); pour(3, I.OIL, 2);
    rect(40, 380, 600, 470, I.WATER); S.tick(400); S.params.paused = false; S.togglePause();`);
  await p.sleep(900);
  await p.shot(`${OUT}/13-paused.png`);
}, { width: 1400, height: 900 });

await run('12-phone', async (p) => {
  await p.eval(PRE + `rect(0, 380, 639, 470, I.WATER); rect(0, 360, 639, 378, I.OIL);
    pour(0, I.SAND, 3); pour(1, I.LAVA, 2); pour(2, I.SNOW, 4); pour(3, I.SEED, 2); S.tick(350);
    S.spigots.set(3, { rate: 0 }); S.params.paused = false;`);
  await p.sleep(800);
  await p.shot(`${OUT}/12-phone.png`);
}, { width: 390, height: 844 });
