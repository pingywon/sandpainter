/** Keyboard bindings. Ignored while typing in a form control or when a dialog is open. */
import { EMPTY, RANDOM } from '../engine/ids.js';
import { BRUSH_SIZES } from '../engine/brush.js';
import { quickPickIds } from './palette.js';

export function bindShortcuts(app, speeds) {
  const quick = quickPickIds();
  window.addEventListener('keydown', (e) => {
    const t = e.target;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'SELECT' || t.tagName === 'TEXTAREA')) return;
    if (document.querySelector('dialog[open]')) return;
    const p = app.params;
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); app.undo(); return; }
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    switch (e.key) {
      case ' ': e.preventDefault(); app.togglePause(); break;
      case '.': app.stepOnce(); break;
      case '[': app.setBrush(p.brush - 1); break;
      case ']': app.setBrush(p.brush + 1); break;
      case 'e': case 'E': app.setElement(EMPTY); break;
      case 'r': case 'R': app.setElement(RANDOM); break;
      case 'g': case 'G': app.flipGravity(); break;
      case 'b': case 'B': app.toggleBox(); break;
      case 'c': case 'C': app.emit('request-clear'); break;
      case 'l': case 'L': app.setTool(p.tool === 'line' ? 'free' : 'line'); break;
      case 'k': case 'K': app.toggleColours(); break;
      case 'Escape': app.emit('cancel-stroke'); break;
      case '-': case '_': app.setSpeed(speeds[Math.max(0, speeds.indexOf(p.speed) - 1)]); break;
      case '=': case '+': app.setSpeed(speeds[Math.min(speeds.length - 1, speeds.indexOf(p.speed) + 1)]); break;
      case '?': document.getElementById('help')?.showModal(); break;
      default: {
        const n = Number(e.key);
        if (n >= 1 && n <= quick.length) app.setElement(quick[n - 1]);
      }
    }
  });
  return { sizes: BRUSH_SIZES };
}
