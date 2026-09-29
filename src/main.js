/**
 * Bootstrap: builds the world, wires pointer painting, runs the frame loop,
 * and exposes a small `app` API that the UI modules talk to.
 */
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

const params = {
  element: SAND,
  brush: 3,          // index into BRUSH_SIZES
  speed: 1,
  gravity: 1,
  wind: 0,
  paused: false,
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
  togglePause() { params.paused = !params.paused; emit('paused', params.paused); },
  stepOnce() { if (!params.paused) { params.paused = true; emit('paused', true); } stepRequest = true; },
  undo() { if (history.pop(world)) emit('undo'); },
  clear() { history.push(world); world.clear(); emit('clear'); },
  flipGravity() { params.gravity = -params.gravity; emit('gravity', params.gravity); },
  setWind(v) { params.wind = Math.max(-100, Math.min(100, v | 0)); emit('wind', params.wind); },
  save(slot) { const ok = storage.save(slot, world); emit('saved', { slot, ok }); return ok; },
  load(slot) {
    history.push(world);
    const ok = storage.load(slot, world);
    if (!ok) history.pop(world);
    emit('loaded', { slot, ok });
    return ok;
  },
  exportPng() { openSnapshot(); },
  hasAutosave() { return storage.info('auto') !== null; },
  toast(msg, actions) { showToast(msg, actions); },
  /** Run n simulation steps synchronously (used by tests and the step button). */
  tick(n = 1) { for (let k = 0; k < n; k++) step(world, params, spigots); },
  paint(x0, y0, x1, y1, id, size = BRUSH_SIZES[params.brush]) { paintLine(world, x0, y0, x1, y1, id, size); },
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

plate.addEventListener('pointerdown', (ev) => {
  // The toast sits inside the plate; capturing its presses would paint under it and swallow its button clicks.
  if (ev.target.closest('#toast')) return;
  if (ev.button !== 0 && ev.button !== 2) return;
  ev.preventDefault();
  if (!toastEl.hidden) hideToast();
  plate.setPointerCapture(ev.pointerId);
  painting = true;
  erasing = ev.button === 2 || ev.shiftKey;
  history.push(world);
  const [x, y] = toWorld(ev);
  last = [x, y];
  const id = erasing ? EMPTY : params.element;
  paintLine(world, x, y, x, y, id, app.brushSize);
  cursor.set(x, y, app.brushSize, true);
});

plate.addEventListener('pointermove', (ev) => {
  const [x, y] = toWorld(ev);
  cursor.set(x, y, app.brushSize, true);
  if (!painting) return;
  const id = erasing ? EMPTY : params.element;
  paintLine(world, last[0], last[1], x, y, id, app.brushSize);
  last = [x, y];
});

function endStroke(ev) {
  if (!painting) return;
  painting = false;
  last = null;
  try { plate.releasePointerCapture(ev.pointerId); } catch { /* already released */ }
}
plate.addEventListener('pointerup', endStroke);
plate.addEventListener('pointercancel', endStroke);
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

function frame(now) {
  if (!params.paused) {
    acc += params.speed;
    while (acc >= 1) { step(world, params, spigots); acc -= 1; }
  } else if (stepRequest) {
    step(world, params, spigots);
    stepRequest = false;
  }
  renderer.draw();
  cursor.draw(accent);

  frames++;
  if (now - lastFps >= 500) {
    const fps = Math.round((frames * 1000) / (now - lastFps));
    fpsEl.textContent = `${fps} fps`;
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
  brush.textContent = `brush ${app.brushSize}`;
  statusEl.append(name, hint, brush);
}
on('element', renderStatus);
on('brush', renderStatus);

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
