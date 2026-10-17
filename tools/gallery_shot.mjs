// One-off: photograph the open preset gallery in dark and light themes.
//   node --experimental-websocket tools/gallery_shot.mjs <outdir>
import { fileURLToPath } from 'node:url';
import { launch } from './cdp.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const OUT = process.argv[2] || '.';
const PHONE = process.argv.includes('--phone');
const GUIDE = process.argv.includes('--guide');

if (GUIDE) {
  const p = await launch({ width: 1280, height: 1600 });
  try {
    await p.goto(`file://${ROOT}Element-Guide.html`);
    await p.eval(`document.getElementById('presets').scrollIntoView()`);
    await p.sleep(400);
    await p.shot(`${OUT}/guide-presets.png`);
  } finally { await p.close(); }
} else if (PHONE) {
  const p = await launch({ width: 390, height: 844 });
  try {
    await p.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
    await p.goto(`file://${ROOT}Sandpainter.html`);
    await p.eval(`(() => { const t = document.getElementById('toast'); if (t) { t.hidden = true; t.style.display = 'none'; } })()`);
    await p.shot(`${OUT}/phone-game.png`);
    await p.eval(`sandpainter.openPresets()`);
    await p.sleep(400);
    const info = await p.eval(`(() => {
      const d = document.getElementById('presets');
      const r = d.getBoundingClientRect();
      const card = d.querySelector('.preset-card').getBoundingClientRect();
      return { fits: r.right <= 390 && r.left >= 0, cardW: Math.round(card.width), cardH: Math.round(card.height),
        sideways: document.documentElement.scrollWidth <= 390 };
    })()`);
    console.log('phone gallery', JSON.stringify(info));
    await p.shot(`${OUT}/phone-gallery.png`);
  } finally { await p.close(); }
} else {
  for (const dark of [true, false]) {
    const p = await launch({ width: 1400, height: 900, dark });
    try {
      await p.goto(`file://${ROOT}Sandpainter.html`);
      await p.eval(`(() => { const t = document.getElementById('toast'); if (t) { t.hidden = true; t.style.display = 'none'; } sandpainter.openPresets(); })()`);
      await p.sleep(400);
      await p.shot(`${OUT}/gallery-${dark ? 'dark' : 'light'}.png`);
    } finally { await p.close(); }
  }
}
console.log('done');
