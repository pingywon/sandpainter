// Round-6 browser checks: the preset gallery, the confirm gate, undo, the Guide
// button and the version footer — driven with REAL mouse events over CDP.
//   node --experimental-websocket tools/ui_checks.mjs [url]
// Default target is the one-file build at file://…/Sandpainter.html; pass an
// http URL (the LAN copy, a local server) to run the same checks there.
import { fileURLToPath } from 'node:url';
import { launch } from './cdp.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const URL_ = process.argv[2] || `file://${ROOT}Sandpainter.html`;

let failed = 0;
const check = (name, ok, detail = '') => {
  if (!ok) failed++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`);
};

const page = await launch({ width: 1400, height: 900 });
try {
  await page.goto(URL_);
  await page.eval(`(() => { const t = document.getElementById('toast'); if (t) { t.hidden = true; t.style.display = 'none'; } })()`);

  const rectOf = (sel) => page.eval(`(() => { const e = document.querySelector(${JSON.stringify(sel)}); if (!e) return null; const r = e.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2, w: r.width, h: r.height }; })()`);
  const clickSel = async (sel) => { const r = await rectOf(sel); if (!r) throw new Error(`no element ${sel}`); await page.click(r.x, r.y); await page.sleep(120); };

  // The topbar carries a working Guide link and the new version.
  const guide = await page.eval(`(() => { const a = document.querySelector('.topbar a.pillbtn'); return a ? { href: a.getAttribute('href'), text: a.textContent } : null; })()`);
  check('Guide button sits in the top bar', !!guide && guide.href === 'Element-Guide.html' && guide.text === 'Guide', JSON.stringify(guide));
  const ver = await page.eval(`document.getElementById('ver').textContent`);
  check('footer shows v1.4.0', ver === 'Sandpainter v1.4.0', ver);

  // A real click on the rail button opens the gallery with 8 pictured cards.
  const openBtn = await page.eval(`(() => { const b = [...document.querySelectorAll('#rail .btn')].find((x) => x.textContent.includes('gallery')); const r = b.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; })()`);
  await page.click(openBtn.x, openBtn.y);
  await page.sleep(200);
  const gal = await page.eval(`(() => { const d = document.getElementById('presets'); const cards = [...d.querySelectorAll('.preset-card')]; return { open: d.open, cards: cards.length, pictured: cards.filter((c) => (c.querySelector('img').src || '').startsWith('data:image/png')).length }; })()`);
  check('rail button opens the gallery', gal.open);
  check('8 cards, every one pictured', gal.cards === 8 && gal.pictured === 8, `${gal.cards} cards, ${gal.pictured} pictured`);

  // Empty canvas: a card loads straight away, live, with its own stage settings.
  await clickSel('.preset-card[data-key="storm-box"]');
  await page.sleep(200);
  let st = await page.eval(`(() => { const S = sandpainter; let n = 0; for (const c of S.world.cells) if (c !== 0) n++; return { open: document.getElementById('presets').open, grains: n, box: S.params.box, wind: S.params.wind, paused: S.params.paused }; })()`);
  check('empty canvas: the card loads with no questions', !st.open && st.grains > 20000, `${st.grains} grains`);
  check('the scene brought its stage: closed box, wind 40, running', st.box === true && st.wind === 40 && st.paused === false, JSON.stringify(st));

  // A painted canvas is protected: the confirm appears, Keep painting backs out.
  // Start from a paused, empty world so nothing self-mutates under the comparison
  // (the storm scene's thunder deletes cells, which made grain counts drift).
  await page.eval(`(() => { const S = sandpainter; S.params.paused = true; S.world.clear(); })()`);
  const plate = await rectOf('#world');
  await page.click(plate.x, plate.y); // one real stroke on the canvas
  const before = await page.eval(`(() => { let n = 0; for (const c of sandpainter.world.cells) if (c !== 0) n++; return n; })()`);
  await page.click(openBtn.x, openBtn.y);
  await page.sleep(200);
  await clickSel('.preset-card[data-key="secret-garden"]');
  let conf = await page.eval(`(() => { const d = document.getElementById('presets'); return { open: d.open, confirm: !d.querySelector('.preset-confirm').hidden, dimmed: d.querySelector('.preset-grid').classList.contains('dimmed') }; })()`);
  check('painted canvas: the card asks first', conf.open && conf.confirm && conf.dimmed, JSON.stringify(conf));
  await page.eval(`(() => { [...document.querySelectorAll('#presets .preset-confirm button')].find((b) => b.textContent === 'Keep painting').click(); })()`);
  await page.sleep(120);
  st = await page.eval(`(() => { const d = document.getElementById('presets'); let n = 0; for (const c of sandpainter.world.cells) if (c !== 0) n++; return { confirm: !d.querySelector('.preset-confirm').hidden, grains: n }; })()`);
  check('Keep painting backs out, painting untouched', !st.confirm && st.grains === before, `${st.grains} vs ${before} grains`);

  // Replace it loads the garden; undo brings the painting straight back.
  await clickSel('.preset-card[data-key="secret-garden"]');
  await page.eval(`(() => { [...document.querySelectorAll('#presets .preset-confirm button')].find((b) => b.textContent === 'Replace it').click(); })()`);
  await page.sleep(250);
  st = await page.eval(`(() => { const S = sandpainter; return { open: document.getElementById('presets').open, box: S.params.box, wind: S.params.wind, soil: [...S.world.cells].filter((c) => c === 27 || c === 28).length }; })()`);
  check('Replace it loads the garden, stage reset to open edges + calm', !st.open && st.box === false && st.wind === 0 && st.soil > 10000, JSON.stringify(st));
  await page.eval(`sandpainter.undo()`);
  const undone = await page.eval(`(() => { let n = 0; for (const c of sandpainter.world.cells) if (c !== 0) n++; return n; })()`);
  check('undo brings the painting back', undone === before, `${undone} vs ${before} grains`);

  const errs = page.errors();
  check('no page errors', errs.length === 0, errs.length ? JSON.stringify(errs).slice(0, 200) : 'clean console');
} finally {
  await page.close();
}

if (failed) { console.log(`\n${failed} check(s) failed`); process.exit(1); }
console.log('\nall UI checks passed');
