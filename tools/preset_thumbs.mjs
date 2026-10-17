// Photographs every preset mid-action in the real game and saves the raw frames.
//   python3 tools/build_standalone.py                      (the page it drives)
//   node --experimental-websocket tools/preset_thumbs.mjs  (Node 22+: no flag needed)
//   python3 tools/finish_thumbs.py                         (shrink + quantize + thumbs.js)
// Raw frames land in docs/screenshots/raw-preset-<key>.png at the canvas's native 640x480.
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { launch } from './cdp.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const OUT = `${ROOT}docs/screenshots`;
mkdirSync(OUT, { recursive: true });

const { PRESETS } = await import(`file://${ROOT}src/presets/scenes.js`);

// Photo-call staging only: a nudge the player would give within seconds anyway,
// so the card shows the scene's best moment. The preset itself ships unlit.
const EXTRA = {
  'oil-strike': 'S.paint(180, 302, 440, 302, 8, 2); S.tick(22);',
};

const page = await launch({ width: 1400, height: 900 });
try {
  await page.goto(`file://${ROOT}Sandpainter.html`);
  for (const sc of PRESETS) {
    const info = await page.eval(`(() => {
      const S = sandpainter;
      S.loadPreset('${sc.key}');
      S.params.paused = true;
      S.tick(${sc.ticks});
      ${EXTRA[sc.key] || ''}
      const t = document.getElementById('toast'); if (t) { t.hidden = true; t.style.display = 'none'; }
      let n = 0; for (const c of S.world.cells) if (c !== 0) n++;
      return { grains: n };
    })()`);
    await page.sleep(250);
    const box = await page.eval(`(() => { const r = document.getElementById('world').getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height }; })()`);
    await page.shot(`${OUT}/raw-preset-${sc.key}.png`, box, 640 / box.width);
    console.log(`raw-preset-${sc.key}.png`.padEnd(34), JSON.stringify(info));
  }
  const errs = page.errors();
  if (errs.length) { console.error('PAGE ERRORS:', JSON.stringify(errs).slice(0, 500)); process.exit(1); }
} finally {
  await page.close();
}
