// Runs the engine headless on small scenes and checks the less obvious claims
// made in Element-Guide.html. Run: node tools/engine_checks.mjs
const SRC = new URL('../src/engine/', import.meta.url).href;
const { World } = await import(SRC + 'world.js');
const ID = await import(SRC + 'ids.js');
const { step } = await import(SRC + 'simulation.js');
const { Spigots } = await import(SRC + 'spigots.js');

const W = 120, H = 90;
function scene() {
  const w = new World(W, H);
  const sp = new Spigots();
  sp.list.forEach((s) => { s.rate = 0; });
  const s = { w, sp, p: { element: 0, brush: 3, speed: 1, gravity: 1, wind: 0, paused: false } };
  rect(w, 0, H - 1, W - 1, H - 1, ID.WALL);
  return s;
}
function rect(w, x0, y0, x1, y1, id, aux = 0) {
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) w.set(y * W + x, id, aux);
}
function count(w, ...ids) {
  let n = 0;
  for (let i = 0; i < w.n; i++) if (ids.includes(w.cells[i])) n++;
  return n;
}
function meanY(w, id) {
  let t = 0, n = 0;
  for (let i = 0; i < w.n; i++) if (w.cells[i] === id) { t += (i / W) | 0; n++; }
  return n ? t / n : NaN;
}
const run = (s, n, each) => { for (let k = 0; k < n; k++) { step(s.w, s.p, s.sp); if (each) each(); } };

let failed = 0;
function check(name, ok, detail) {
  if (!ok) failed++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}  (${detail})`);
}

{
  const s = scene();
  rect(s.w, 0, 70, 119, 88, ID.LAVA);
  rect(s.w, 40, 60, 80, 66, ID.SAND);
  run(s, 400);
  check('sand floats on lava', meanY(s.w, ID.SAND) < meanY(s.w, ID.LAVA),
    `sand y=${meanY(s.w, ID.SAND).toFixed(1)}, lava y=${meanY(s.w, ID.LAVA).toFixed(1)}`);
}
{
  const s = scene();
  rect(s.w, 30, 80, 90, 88, ID.WALL);
  rect(s.w, 50, 70, 70, 79, ID.C4);
  rect(s.w, 40, 40, 80, 60, ID.ACID);
  const c4 = count(s.w, ID.C4);
  let hot = 0;
  run(s, 600, () => { hot = Math.max(hot, count(s.w, ID.FIRE, ID.EMBER)); });
  check('acid dissolves C-4 with no explosion', count(s.w, ID.C4) < c4 && hot === 0,
    `C-4 ${c4} -> ${count(s.w, ID.C4)}, most fire/ember cells seen ${hot}`);
}
{
  const s = scene();
  rect(s.w, 50, 40, 70, 60, ID.WALL);
  rect(s.w, 53, 43, 67, 57, ID.EMPTY);
  rect(s.w, 59, 49, 61, 51, ID.C4);
  const behind = 50 * W + 73;
  s.w.set(behind, ID.ICE);
  s.w.set(51 * W + 60, ID.FIRE, 20);
  run(s, 3);
  check('a wall survives a blast but does not shield what is behind it',
    s.w.cells[behind] !== ID.ICE && count(s.w, ID.WALL) > 0, `ice behind the wall is now id ${s.w.cells[behind]}`);
}
{
  const s = scene();
  rect(s.w, 0, 45, 119, 59, ID.SALT_WATER);
  rect(s.w, 0, 60, 119, 74, ID.WATER);
  run(s, 1500);
  check('salt water sinks under fresh water', meanY(s.w, ID.SALT_WATER) > meanY(s.w, ID.WATER),
    `salt water y=${meanY(s.w, ID.SALT_WATER).toFixed(1)}, fresh y=${meanY(s.w, ID.WATER).toFixed(1)}`);
}
for (const [soil, want] of [[ID.WET_SOIL, true], [ID.SOIL, false]]) {
  const s = scene();
  rect(s.w, 0, 80, 119, 88, soil);
  for (let x = 10; x < 110; x += 10) s.w.set(79 * W + x, ID.SEED);
  run(s, 800);
  const blooms = count(s.w, ...ID.BLOOMS);
  check(`seeds on ${want ? 'wet' : 'dry'} soil ${want ? 'flower' : 'stay seeds'}`, want ? blooms > 0 : count(s.w, ID.STEM) === 0,
    `stems ${count(s.w, ID.STEM)}, bloom cells ${blooms}`);
}
{
  let booms = 0;
  for (let t = 0; t < 10; t++) {
    const s = scene();
    rect(s.w, 0, 40, 119, 80, ID.WATER);
    rect(s.w, 0, 81, 119, 88, ID.NITRO);
    rect(s.w, 55, 20, 65, 25, ID.LAVA);
    const n0 = count(s.w, ID.NITRO);
    run(s, 600);
    if (count(s.w, ID.NITRO) < n0 - 20) booms++;
  }
  check('lava dropped into a pond rarely reaches nitro on the bottom', booms <= 2, `${booms}/10 trials exploded`);
  const s = scene();
  rect(s.w, 0, 40, 119, 80, ID.WATER);
  rect(s.w, 0, 81, 119, 88, ID.NITRO);
  const n0 = count(s.w, ID.NITRO);
  rect(s.w, 58, 82, 60, 84, ID.LAVA);
  run(s, 10);
  check('lava painted onto nitro explodes', count(s.w, ID.NITRO) < n0 - 20, `nitro ${n0} -> ${count(s.w, ID.NITRO)}`);
}
{
  const s = scene();
  rect(s.w, 0, 70, 59, 88, ID.WATER);
  rect(s.w, 60, 70, 119, 88, ID.SALT_WATER);
  s.w.set(88 * W + 20, ID.PLANT);
  s.w.set(88 * W + 100, ID.PLANT);
  const sw0 = count(s.w, ID.SALT_WATER), w0 = count(s.w, ID.WATER);
  run(s, 300);
  // Plants stop one row under the surface, so a little fresh water is always left on top.
  check('plant drinks fresh water but not salt water', count(s.w, ID.WATER) < w0 * 0.15 && count(s.w, ID.SALT_WATER) > sw0 * 0.9,
    `fresh water left ${count(s.w, ID.WATER)}, salt water ${sw0} -> ${count(s.w, ID.SALT_WATER)}`);
}
{
  const s = scene();
  rect(s.w, 58, 88, 60, 88, ID.TORCH);
  rect(s.w, 50, 60, 70, 70, ID.CRYO);
  run(s, 300);
  check('cryo erases torches', count(s.w, ID.TORCH) === 0, `torch cells left ${count(s.w, ID.TORCH)}`);
}
{
  const s = scene();
  rect(s.w, 0, 84, 119, 88, ID.LAVA);
  rect(s.w, 40, 70, 80, 80, ID.ACID);
  const l0 = count(s.w, ID.LAVA);
  run(s, 400);
  check('acid eats lava', count(s.w, ID.LAVA) < l0, `lava ${l0} -> ${count(s.w, ID.LAVA)}`);
}
{
  const s = scene();
  rect(s.w, 0, 0, 119, 0, ID.WALL);
  rect(s.w, 20, 60, 100, 70, ID.STEAM);
  let water = 0;
  run(s, 400, () => { water = Math.max(water, count(s.w, ID.WATER)); });
  check('steam turns back into water', water > 50, `most water cells seen ${water}`);
}

// Reactions spread one cell per step: nothing may cross a whole row within a single step.
{
  const s = scene();
  rect(s.w, 0, 60, 119, 60, ID.FUSE);
  s.w.set(59 * W, ID.FIRE, 20);
  let t = 0;
  while (count(s.w, ID.FUSE) > 0 && t < 400) { run(s, 1); t++; }
  check('a fuse burns one pixel per step', t >= 100 && t <= 140, `120-px fuse took ${t} steps`);
}
{
  // A three-cell flame: a single spark can fizzle, which is fine in play but makes a flaky check.
  const oil = () => {
    const s = scene();
    rect(s.w, 0, 70, 119, 88, ID.WATER);
    rect(s.w, 0, 66, 119, 69, ID.OIL);
    rect(s.w, 1, 65, 3, 65, ID.FIRE, 20);
    return s;
  };
  // Fire is random: well under 1% of slicks go out part-way, so light three and want two.
  const results = [];
  for (let k = 0; k < 3; k++) {
    const s = oil();
    const o0 = count(s.w, ID.OIL);
    let t = 0;
    while (count(s.w, ID.OIL) > o0 / 2 && t < 800) { run(s, 1); t++; }
    run(s, 800 - t);
    results.push({ ok: count(s.w, ID.OIL) < o0 * 0.3 && t >= 40, burned: Math.round(100 - (100 * count(s.w, ID.OIL)) / o0), t });
  }
  check('an oil slick keeps burning, one step at a time', results.filter((r) => r.ok).length >= 2,
    results.map((r) => `${r.burned}% burned, half after ${r.t} steps`).join('; '));
}
{
  const s = scene();
  rect(s.w, 50, 85, 70, 88, ID.PLANT);
  let worst = 0;
  run(s, 3000, () => {
    for (let x = 58; x <= 62; x++) if (Math.random() < 0.3 && s.w.cells[2 * W + x] === 0) s.w.set(2 * W + x, ID.WATER);
  });
  let lake = H;
  for (let y = 0; y < H && lake === H; y++) {
    let n = 0;
    for (let x = 0; x < 30; x++) { const c = s.w.cells[y * W + x]; if (c === ID.WATER || c === ID.PLANT) n++; }
    if (n > 20) lake = y;
  }
  let top = H;
  for (let y = 0; y < H && top === H; y++) for (let x = 0; x < W; x++) if (s.w.cells[y * W + x] === ID.PLANT) { top = y; break; }
  worst = lake - top;
  check('a plant under a falling stream stays under the water line', worst <= 2, `plant top y=${top}, water line y=${lake}`);
}
{
  const s = scene();
  rect(s.w, 0, 50, 119, 88, ID.WATER);
  s.w.set(88 * W + 60, ID.PLANT);
  const w0 = count(s.w, ID.WATER);
  run(s, 600);
  check('a plant still fills a pond', count(s.w, ID.PLANT) > w0 * 0.8, `plant ${count(s.w, ID.PLANT)} of ${w0} pond cells`);
}
{
  const s = scene();
  rect(s.w, 0, 75, 119, 88, ID.LAVA);
  rect(s.w, 30, 50, 90, 72, ID.METHANE);
  const m0 = count(s.w, ID.METHANE);
  run(s, 200);
  check('methane drifting just above lava goes up', count(s.w, ID.METHANE) < m0 * 0.1, `methane ${m0} -> ${count(s.w, ID.METHANE)}`);
}
{
  const s = scene();
  rect(s.w, 30, 75, 90, 88, ID.NAPALM);
  rect(s.w, 25, 75, 29, 88, ID.WALL); rect(s.w, 91, 75, 95, 88, ID.WALL);
  rect(s.w, 30, 50, 90, 71, ID.METHANE);
  rect(s.w, 40, 74, 80, 74, ID.FIRE, 20);
  const m0 = count(s.w, ID.METHANE);
  run(s, 200);
  check('burning napalm sets off methane above it', count(s.w, ID.METHANE) < m0 * 0.1, `methane ${m0} -> ${count(s.w, ID.METHANE)}`);
  const u = scene();
  rect(u.w, 30, 75, 90, 88, ID.NAPALM);
  rect(u.w, 30, 60, 90, 74, ID.METHANE);
  const u0 = count(u.w, ID.METHANE);
  run(u, 100);
  check('unlit napalm does not set off methane (it needs a flame)', count(u.w, ID.METHANE) >= u0 * 0.9, `methane ${u0} -> ${count(u.w, ID.METHANE)}`);
}
{
  const s = scene();
  rect(s.w, 50, 40, 70, 50, ID.CLONE);
  rect(s.w, 55, 30, 65, 36, ID.SAND);
  const s0 = count(s.w, ID.SAND);
  run(s, 600);
  check('a clone with sand dropped on top pours sand', count(s.w, ID.SAND) > s0 * 5, `sand ${s0} -> ${count(s.w, ID.SAND)}`);
}

if (failed) {
  console.log(`\n${failed} check(s) failed: the element guide needs updating`);
  process.exit(1);
}
console.log('\nall checks passed');
