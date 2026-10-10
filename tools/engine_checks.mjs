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
  // Watering a dry pile from above is enough: soil drinks fast, moisture seeps through, seeds sprout.
  const s = scene();
  rect(s.w, 40, 78, 80, 88, ID.SOIL);
  for (let x = 44; x <= 76; x += 4) s.w.set(77 * W + x, ID.SEED);
  run(s, 400, () => { for (let x = 55; x <= 65; x++) if (Math.random() < 0.25 && s.w.cells[2 * W + x] === 0) s.w.set(2 * W + x, ID.WATER); });
  run(s, 1200);
  check('watering a dry soil pile grows flowers', count(s.w, ...ID.BLOOMS) > 0,
    `stems ${count(s.w, ID.STEM)}, bloom cells ${count(s.w, ...ID.BLOOMS)}`);
}
{
  // A too-thick blanket of seed still flowers, and the spare seed crumbles away.
  const s = scene();
  rect(s.w, 20, 84, 99, 88, ID.WET_SOIL);
  rect(s.w, 30, 79, 89, 83, ID.SEED);
  const n0 = count(s.w, ID.SEED);
  run(s, 2500);
  check('a thick blanket of seed still flowers, the spare crumbles away',
    count(s.w, ...ID.BLOOMS) > 20 && count(s.w, ID.SEED) < n0 * 0.2,
    `seed ${n0} -> ${count(s.w, ID.SEED)}, bloom cells ${count(s.w, ...ID.BLOOMS)}, stems ${count(s.w, ID.STEM)}`);
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
  // A sprig takes a patch of the fresh side, never touches the salt side, and leaves most of the pond.
  check('plant drinks a patch of fresh water but no salt water',
    count(s.w, ID.PLANT) > 80 && count(s.w, ID.WATER) > w0 * 0.5 && count(s.w, ID.SALT_WATER) > sw0 * 0.9,
    `plant ${count(s.w, ID.PLANT)}, fresh water ${w0} -> ${count(s.w, ID.WATER)}, salt water ${sw0} -> ${count(s.w, ID.SALT_WATER)}`);
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
  const p1 = count(s.w, ID.PLANT);
  run(s, 300);
  // Growth spreads about GROW_SPAN cells from the planted sprig, then stops for good.
  check('a plant takes a patch of a pond, then stops', p1 > 100 && p1 < w0 * 0.25 && count(s.w, ID.PLANT) === p1,
    `plant ${p1} of ${w0} pond cells, ${count(s.w, ID.PLANT)} after 300 more steps`);
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
  run(u, 200);
  check('napalm is already burning: it sets off methane with no spark', count(u.w, ID.METHANE) < u0 * 0.1, `methane ${u0} -> ${count(u.w, ID.METHANE)}`);
}
{
  const s = scene();
  rect(s.w, 0, 60, 119, 88, ID.WATER);
  rect(s.w, 20, 54, 100, 59, ID.NAPALM);
  const n0 = count(s.w, ID.NAPALM);
  let fire = 0;
  run(s, 150, () => { fire = Math.max(fire, count(s.w, ID.FIRE)); });
  check('napalm on water keeps burning (water cannot put it out)', count(s.w, ID.NAPALM) > n0 * 0.4 && fire > 20,
    `napalm ${n0} -> ${count(s.w, ID.NAPALM)}, most flames seen ${fire}`);
  const c = scene();
  rect(c.w, 30, 70, 90, 88, ID.NAPALM);
  rect(c.w, 30, 60, 90, 69, ID.CRYO);
  const c0 = count(c.w, ID.NAPALM);
  run(c, 60);
  // It turns back into oil, which the flames still around can light again, so only the napalm is counted.
  check('cryo puts napalm out', count(c.w, ID.NAPALM) < c0 * 0.1, `napalm ${c0} -> ${count(c.w, ID.NAPALM)}, oil ${count(c.w, ID.OIL)}`);
}
{
  const s = scene();
  rect(s.w, 40, 50, 80, 80, ID.C4);
  const c0 = count(s.w, ID.C4);
  s.w.set(50 * W + 39, ID.FIRE, 20);
  run(s, 2);
  check('a block of C-4 goes off all at once', count(s.w, ID.C4) === 0, `C-4 ${c0} -> ${count(s.w, ID.C4)} two steps after lighting one corner`);
  const n = scene();
  rect(n.w, 10, 70, 110, 88, ID.NITRO);
  const m0 = count(n.w, ID.NITRO);
  n.w.set(69 * W + 10, ID.FIRE, 20);
  run(n, 2);
  // A drop that has split off the pool is not part of it, so a stray cell or two may be left.
  check('a pool of nitro goes off all at once', count(n.w, ID.NITRO) <= m0 * 0.02, `nitro ${m0} -> ${count(n.w, ID.NITRO)} two steps after lighting one end`);
}
{
  const s = scene();
  rect(s.w, 50, 40, 70, 50, ID.CLONE);
  rect(s.w, 55, 30, 65, 36, ID.SAND);
  const s0 = count(s.w, ID.SAND);
  run(s, 600);
  check('a clone with sand dropped on top pours sand', count(s.w, ID.SAND) > s0 * 5, `sand ${s0} -> ${count(s.w, ID.SAND)}`);
}

{
  // Open edges (the default, like the original): no floor means things fall off the bottom.
  const make = (box) => {
    const w = new World(W, H); const sp = new Spigots(); sp.list.forEach((q) => { q.rate = 0; });
    return { w, sp, p: { element: 0, brush: 3, speed: 1, gravity: 1, wind: 0, box, paused: false } };
  };
  const open = make(false), boxed = make(true);
  rect(open.w, 40, 10, 80, 30, ID.SAND); rect(boxed.w, 40, 10, 80, 30, ID.SAND);
  const s0 = count(open.w, ID.SAND);
  run(open, 400); run(boxed, 400);
  check('with open edges sand falls off the bottom; in a closed box it piles up',
    count(open.w, ID.SAND) === 0 && count(boxed.w, ID.SAND) === s0, `open ${count(open.w, ID.SAND)}, closed box ${count(boxed.w, ID.SAND)} of ${s0}`);
}
{
  // Lava free-falls at full speed now; only spreading and sinking stay sluggish.
  const s = scene();
  s.p.box = true;
  s.w.set(2 * W + 60, ID.LAVA);
  let t = 0;
  while (t < 300) {
    run(s, 1); t++;
    let done = false;
    for (let x = 0; x < W; x++) if (s.w.cells[88 * W + x] === ID.LAVA) { done = true; break; }
    if (done) break;
  }
  check('lava falls through open air at full speed', t >= 80 && t <= 110, `86-px drop took ${t} steps`);
}
{
  const sp = new Spigots();
  check('a new game starts with every spigot off', sp.list.every((q) => q.rate === 0),
    `rates ${sp.list.map((q) => q.rate).join(',')}`);
}
{
  // Liquids level out: oil poured onto water in a basin ends up as a flat layer, not a heap.
  const s = scene();
  rect(s.w, 10, 40, 11, 88, ID.WALL); rect(s.w, 108, 40, 109, 88, ID.WALL);
  rect(s.w, 12, 70, 107, 88, ID.WATER);
  run(s, 500, () => { for (let x = 58; x <= 62; x++) if (s.w.cells[5 * W + x] === 0 && Math.random() < 0.3) s.w.set(5 * W + x, ID.OIL); });
  run(s, 300);
  let top = H, low = 0;
  for (let x = 14; x <= 105; x++) {
    let y = 0; while (y < H && s.w.cells[y * W + x] !== ID.OIL) y++;
    if (y < H) { top = Math.min(top, y); low = Math.max(low, y); }
  }
  check('oil poured onto water spreads out flat', low - top <= 3, `oil surface varies by ${low - top} px across the basin`);
}

if (failed) {
  console.log(`\n${failed} check(s) failed: the element guide needs updating`);
  process.exit(1);
}
console.log('\nall checks passed');
