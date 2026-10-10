/**
 * Bootstrap: builds the world, wires pointer painting, runs the frame loop,
 * and exposes a small `app` API that the UI modules talk to.
 */
import { VERSION } from './version.js';
import { World, W, H } from './engine/world.js';
import { SAND, EMPTY } from './engine/ids.js';
import { elementName, elementHint } from './engine/elements.js';
import { step } from './engine/simulation.js';
import { Spigots } from './engine/spigots.js';
import { BRUSH_SIZES, paintLine } from './engine/brush.js';
import { History } from './engine/history.js';
import * as storage from './engine/storage.js';
import { Renderer, Cursor } from './render/renderer.js';
import { buildTray } from './ui/palette.js';
import { buildRail } from './ui/controls.js';
import { buildSpigotBar } from './ui/spigotBar.js';
import { bindShortcuts } from './ui/shortcuts.js';

export const SPEEDS = [0.25, 0.5, 1, 2, 4];

const world = new World(W, H);
const spigots = new Spigots();
const history = new History(10);
const worldCanvas = document.getElementById('world');
const cursorCanvas = document.getElementById('cursor');
const plate = document.getElementById('plate');
const renderer = new Renderer(worldCanvas, world);
const cursor = new Cursor(cursorCanvas);

function storedColours() {
  try { return localStorage.getItem('sandpainter-colours') === 'mixed' ? 'mixed' : 'classic'; }
  catch { return 'classic'; }
}

const params = {
  element: SAND,
  brush: 2,          // index into BRUSH_SIZES: 4 px, the original game's default
  speed: 1,
  gravity: 1,
  wind: 0,
  box: false,        // false: things fall off the bottom and float off the top, like the original
  paused: false,
  tool: 'free',      // 'free' drags a stroke; 'line' drags a straight line, painted on release
  colours: storedColours(), // 'classic': one flat colour per element, like the original. 'mixed': shaded.
};

/* ---------------- tiny event bus ---------------- */
const listeners = new Map();
function on(evt, fn) {
  if (!listeners.has(evt)) listeners.set(evt, new Set());
  listeners.get(evt).add(fn);
}
function emit(evt, data) {
  const set = listeners.get(evt);
  if (set) for (const fn of set) fn(data);
}

let stepRequest = false;
let needsDraw = true;
/** Mark the world canvas stale; the frame loop repaints it once, instead of every refresh. */
function touch() { needsDraw = true; }

/* ---------------- zoom ----------------
 * The world stays one 640x480 bitmap; zoom stretches it with CSS inside the
 * overflow-hidden plate. (vx, vy) is the world cell at the plate's top-left. */
const ZOOM_MAX = 8;
const view = { z: 1, vx: 0, vy: 0 };
function applyView() {
  const vw = world.w / view.z, vh = world.h / view.z;
  view.z = Math.max(1, Math.min(ZOOM_MAX, view.z));
  view.vx = Math.max(0, Math.min(world.w - vw, view.vx));
  view.vy = Math.max(0, Math.min(world.h - vh, view.vy));
  const st = worldCanvas.style;
  st.width = `${view.z * 100}%`;
  st.height = `${view.z * 100}%`;
  st.left = `${(-view.vx / world.w) * view.z * 100}%`;
  st.top = `${(-view.vy / world.h) * view.z * 100}%`;
  cursor.setView(view.vx, view.vy, view.z);
  emit('view', view.z);
}
/** Zoom by factor f, keeping the world point (wx, wy) under the same screen spot. */
function zoomAt(f, wx, wy) {
  const z0 = view.z;
  const z1 = Math.max(1, Math.min(ZOOM_MAX, z0 * f));
  if (z1 === z0) return;
  view.vx = wx - (wx - view.vx) * (z0 / z1);
  view.vy = wy - (wy - view.vy) * (z0 / z1);
  view.z = z1;
  applyView();
}

export const app = {
  world, params, spigots, history, renderer, cursor, canvas: worldCanvas,
  on, emit,
  get brushSize() { return BRUSH_SIZES[params.brush]; },
  setElement(id) { params.element = id; emit('element', id); },
  setBrush(idx) {
    params.brush = Math.max(0, Math.min(BRUSH_SIZES.length - 1, idx));
    emit('brush', params.brush);
  },
  setSpeed(v) { params.speed = v; emit('speed', v); },
  setTool(t) { params.tool = t; emit('tool', t); },
  get zoom() { return view.z; },
  zoomIn() { zoomAt(2, view.vx + world.w / view.z / 2, view.vy + world.h / view.z / 2); },
  zoomOut() { zoomAt(0.5, view.vx + world.w / view.z / 2, view.vy + world.h / view.z / 2); },
  zoomReset() { view.z = 1; view.vx = 0; view.vy = 0; applyView(); },
  toggleFullscreen() {
    if (document.fullscreenElement) document.exitFullscreen();
    else document.documentElement.requestFullscreen().catch(() => { showToast('Full screen is blocked here'); });
  },
  toggleColours() {
    params.colours = params.colours === 'classic' ? 'mixed' : 'classic';
    renderer.setFlat(params.colours === 'classic');
    try { localStorage.setItem('sandpainter-colours', params.colours); } catch { /* storage blocked */ }
    touch();
    emit('colours', params.colours);
  },
  togglePause() { params.paused = !params.paused; emit('paused', params.paused); },
  stepOnce() { if (!params.paused) { params.paused = true; emit('paused', true); } stepRequest = true; },
  undo() { if (history.pop(world)) { touch(); emit('undo'); } },
  clear() { history.push(world); world.clear(); touch(); emit('clear'); },
  flipGravity() { params.gravity = -params.gravity; emit('gravity', params.gravity); },
  toggleBox() { params.box = !params.box; emit('box', params.box); },
  setWind(v) { params.wind = Math.max(-100, Math.min(100, v | 0)); emit('wind', params.wind); },
  save(slot) { const ok = storage.save(slot, world); emit('saved', { slot, ok }); return ok; },
  load(slot) {
    history.push(world);
    const ok = storage.load(slot, world);
    if (!ok) history.pop(world);
    touch();
    emit('loaded', { slot, ok });
    return ok;
  },
  exportPng() { openSnapshot(); },
  hasAutosave() { return storage.info('auto') !== null; },
  toast(msg, actions) { showToast(msg, actions); },
  /** Run n simulation steps synchronously (used by tests and the step button). */
  tick(n = 1) { for (let k = 0; k < n; k++) step(world, params, spigots); touch(); },
  paint(x0, y0, x1, y1, id, size = BRUSH_SIZES[params.brush]) { paintLine(world, x0, y0, x1, y1, id, size); touch(); },
};

/* ---------------- pointer painting ---------------- */
let painting = false;
let erasing = false;
let last = null;

function toWorld(ev) {
  const r = worldCanvas.getBoundingClientRect();
  const x = ((ev.clientX - r.left) / r.width) * world.w;
  const y = ((ev.clientY - r.top) / r.height) * world.h;
  return [Math.floor(x), Math.floor(y)];
}

plate.addEventListener('contextmenu', (e) => e.preventDefault());

let panning = null; // [lastClientX, lastClientY] during a middle-button drag

plate.addEventListener('wheel', (ev) => {
  ev.preventDefault();
  const [wx, wy] = toWorld(ev);
  zoomAt(ev.deltaY < 0 ? 1.25 : 0.8, wx, wy);
}, { passive: false });

plate.addEventListener('pointerdown', (ev) => {
  // The toast and paused badge sit inside the plate; capturing their presses would paint under them and swallow the clicks.
  if (ev.target.closest('#toast, #pausedBadge')) return;
  if (ev.button === 1) {
    // Middle button drags the view around while zoomed in.
    ev.preventDefault();
    plate.setPointerCapture(ev.pointerId);
    panning = [ev.clientX, ev.clientY];
    return;
  }
  if (ev.button !== 0 && ev.button !== 2) return;
  ev.preventDefault();
  if (!toastEl.hidden) hideToast();
  plate.setPointerCapture(ev.pointerId);
  painting = true;
  erasing = ev.button === 2 || ev.shiftKey;
  const [x, y] = toWorld(ev);
  last = [x, y];
  cursor.set(x, y, app.brushSize, true);
  if (params.tool === 'line') {
    // Anchor only; the line paints on release, with a preview in the meantime.
    cursor.from = [x, y];
    return;
  }
  history.push(world);
  const id = erasing ? EMPTY : params.element;
  paintLine(world, x, y, x, y, id, app.brushSize);
  touch();
});

plate.addEventListener('pointermove', (ev) => {
  if (panning) {
    const r = worldCanvas.getBoundingClientRect();
    view.vx -= (ev.clientX - panning[0]) * (world.w / r.width);
    view.vy -= (ev.clientY - panning[1]) * (world.h / r.height);
    panning = [ev.clientX, ev.clientY];
    applyView();
    return;
  }
  const [x, y] = toWorld(ev);
  cursor.set(x, y, app.brushSize, true);
  if (!painting) return;
  if (params.tool === 'line') { last = [x, y]; return; }
  const id = erasing ? EMPTY : params.element;
  paintLine(world, last[0], last[1], x, y, id, app.brushSize);
  touch();
  last = [x, y];
});

function endStroke(ev, cancelled = false) {
  if (panning) {
    panning = null;
    try { plate.releasePointerCapture(ev.pointerId); } catch { /* already released */ }
    return;
  }
  if (!painting) return;
  painting = false;
  if (cursor.from) {
    if (!cancelled && last) {
      history.push(world);
      const id = erasing ? EMPTY : params.element;
      paintLine(world, cursor.from[0], cursor.from[1], last[0], last[1], id, app.brushSize);
      touch();
    }
    cursor.from = null;
  }
  last = null;
  try { plate.releasePointerCapture(ev.pointerId); } catch { /* already released */ }
}
plate.addEventListener('pointerup', endStroke);
plate.addEventListener('pointercancel', (ev) => endStroke(ev, true));
// Escape drops an in-progress line without painting it.
on('cancel-stroke', () => { if (painting) { painting = false; cursor.from = null; last = null; } });
plate.addEventListener('pointerleave', () => { if (!painting) cursor.set(-1, -1, app.brushSize, false); });

/* ---------------- sizing ---------------- */
const spigotBar = document.getElementById('spigotBar');
function fit() {
  const r = worldCanvas.getBoundingClientRect();
  cursor.resize(r.width, r.height, world.w);
  spigotBar.style.setProperty('--plate-w', `${r.width}px`);
}
new ResizeObserver(fit).observe(plate);
fit();

/* ---------------- frame loop ---------------- */
let acc = 0;
let lastFrame = 0;
/* The world steps 30 times a second at speed 1, whatever the screen's refresh rate.
 * That is half the original's pace: the old full speed felt too fast, so it is now speed 2. */
const STEP_MS = 1000 / 30;
let frames = 0;
let lastFps = performance.now();
const fpsEl = document.getElementById('fps');
const cellsEl = document.getElementById('cells');
const accent = getComputedStyle(document.documentElement).getPropertyValue('--amber').trim() || '#f5a524';

function countCells() {
  const c = world.cells;
  let n = 0;
  for (let i = 0; i < c.length; i++) if (c[i] !== 0) n++;
  return n;
}

/*
 * Hybrid scheduler: requestAnimationFrame when the browser gives it to us,
 * otherwise a timer keeps the world moving (throttled tabs, embedded panes).
 */
let rafId = 0;
let timerId = 0;
function schedule() {
  rafId = requestAnimationFrame(run);
  timerId = setTimeout(run, 45);
}
function run() {
  cancelAnimationFrame(rafId);
  clearTimeout(timerId);
  frame(performance.now());
  schedule();
}

const pausedBadge = document.getElementById('pausedBadge');
pausedBadge.addEventListener('click', () => app.togglePause());
on('paused', (v) => {
  plate.classList.toggle('is-paused', v);
  pausedBadge.hidden = !v;
  fpsEl.textContent = v ? 'paused' : '— fps';
});

function frame(now) {
  const dt = lastFrame ? Math.min(now - lastFrame, 250) : STEP_MS;
  lastFrame = now;
  if (!params.paused) {
    // Capped so a slow machine or a background tab slows the world down instead of piling up steps.
    acc = Math.min(acc + (dt / STEP_MS) * params.speed, 4 * Math.max(1, params.speed));
    while (acc >= 1) {
      step(world, params, spigots);
      // A held, motionless button keeps pouring: the brush acts as a spigot sized to itself.
      // Freehand only - a line-tool drag (cursor.from set) paints nothing until release.
      if (painting && !cursor.from && last) {
        paintLine(world, last[0], last[1], last[0], last[1], erasing ? EMPTY : params.element, app.brushSize);
      }
      acc -= 1;
      needsDraw = true;
    }
  } else if (stepRequest) {
    step(world, params, spigots);
    stepRequest = false;
    needsDraw = true;
  }
  // Repaint only when the world changed: a 144 Hz screen otherwise redraws the same 307k cells 144 times a second.
  if (needsDraw) { renderer.draw(); needsDraw = false; }
  cursor.draw(accent);

  frames++;
  if (now - lastFps >= 500) {
    const fps = Math.round((frames * 1000) / (now - lastFps));
    fpsEl.textContent = params.paused ? 'paused' : `${fps} fps`;
    cellsEl.textContent = `${countCells().toLocaleString()} grains`;
    frames = 0;
    lastFps = now;
  }
}

/* ---------------- status + toast ---------------- */
const statusEl = document.getElementById('status');
function renderStatus() {
  const id = params.element;
  statusEl.innerHTML = '';
  const name = document.createElement('b');
  name.textContent = elementName(id);
  const hint = document.createElement('span');
  hint.textContent = elementHint(id);
  const brush = document.createElement('em');
  brush.textContent = `${params.tool === 'line' ? 'line · ' : ''}brush ${app.brushSize}`;
  statusEl.append(name, hint, brush);
}
on('element', renderStatus);
on('brush', renderStatus);
on('tool', renderStatus);

const toastEl = document.getElementById('toast');
let toastTimer = null;
function showToast(msg, actions = []) {
  clearTimeout(toastTimer);
  toastEl.innerHTML = '';
  const span = document.createElement('span');
  span.textContent = msg;
  toastEl.append(span);
  for (const a of actions) {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = a.label;
    b.addEventListener('click', () => { a.run(); hideToast(); });
    toastEl.append(b);
  }
  toastEl.hidden = false;
  requestAnimationFrame(() => toastEl.classList.add('show'));
  toastTimer = setTimeout(hideToast, actions.length ? 12000 : 2200);
}
function hideToast() {
  toastEl.classList.remove('show');
  toastTimer = setTimeout(() => { toastEl.hidden = true; }, 250);
}

/* ---------------- snapshot dialog ---------------- */
const shot = document.getElementById('shot');
const shotImg = document.getElementById('shotImg');
const shotDownload = document.getElementById('shotDownload');
const shotCopy = document.getElementById('shotCopy');
let shotData = null;
async function openSnapshot() {
  renderer.draw();
  const data = await storage.snapshot(worldCanvas);
  if (!data) { showToast('Could not render a snapshot'); return; }
  if (shotData) URL.revokeObjectURL(shotData.url);
  shotData = data;
  shotImg.src = data.url;
  shot.showModal();
}
function flash(btn, text, restore) {
  btn.textContent = text;
  setTimeout(() => { btn.textContent = restore; }, 1800);
}
shotDownload.addEventListener('click', async () => {
  if (!shotData) return;
  // Inside the claude.ai viewer, saves go through the downloads capability; elsewhere a plain download link works.
  const dl = window.claude && typeof window.claude.use === 'function' ? await window.claude.use('downloads') : null;
  if (dl) {
    try {
      await dl.save({ filename: shotData.filename, data: shotData.blob });
      flash(shotDownload, 'Saved', 'Download PNG');
    } catch (e) {
      flash(shotDownload, e && e.code === 'declined' ? 'Download PNG' : 'Save unavailable here', 'Download PNG');
    }
    return;
  }
  const a = document.createElement('a');
  a.href = shotData.url;
  a.download = shotData.filename;
  document.body.append(a);
  a.click();
  a.remove();
  flash(shotDownload, 'Saved', 'Download PNG');
});
shotCopy.addEventListener('click', async () => {
  if (!shotData) return;
  const ok = await storage.copyPng(shotData.blob);
  flash(shotCopy, ok ? 'Copied' : 'Copy blocked here', 'Copy image');
});

/* ---------------- boot ---------------- */
document.getElementById('ver').textContent = `Sandpainter v${VERSION}`;
on('box', (b) => plate.classList.toggle('boxed', b));
applyView();
renderer.setFlat(params.colours === 'classic');
buildTray(document.getElementById('tray'), app);
buildSpigotBar(spigotBar, app);
buildRail(document.getElementById('rail'), app, SPEEDS);
bindShortcuts(app, SPEEDS);
renderStatus();

window.addEventListener('pagehide', () => { storage.save('auto', world); });
if (app.hasAutosave()) {
  showToast('Restore your last session?', [
    { label: 'Restore', run: () => app.load('auto') },
    { label: 'Fresh', run: () => {} },
  ]);
}

window.sandpainter = app;
schedule();
