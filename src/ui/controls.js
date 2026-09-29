/** The right-hand controls rail. */
import { BRUSH_SIZES } from '../engine/brush.js';
import { SLOTS, info } from '../engine/storage.js';

function section(title, hintText) {
  const s = document.createElement('section');
  s.className = 'ctl';
  const h = document.createElement('h2');
  h.textContent = title;
  if (hintText) {
    const k = document.createElement('kbd');
    k.textContent = hintText;
    h.append(k);
  }
  s.append(h);
  return s;
}

function segmented(values, labels, current, onPick, ariaLabel) {
  const wrap = document.createElement('div');
  wrap.className = 'seg';
  wrap.setAttribute('role', 'group');
  wrap.setAttribute('aria-label', ariaLabel);
  const buttons = values.map((v, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = labels[i];
    b.setAttribute('aria-pressed', String(v === current));
    b.addEventListener('click', () => onPick(v, i));
    wrap.append(b);
    return b;
  });
  return { wrap, set(v) { buttons.forEach((b, i) => b.setAttribute('aria-pressed', String(values[i] === v))); } };
}

function button(label, onClick, cls = '') {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = `btn ${cls}`.trim();
  b.innerHTML = label;
  b.addEventListener('click', onClick);
  return b;
}

function when(t) {
  if (t == null) return 'empty';
  const d = new Date(t);
  const today = new Date();
  const sameDay = d.toDateString() === today.toDateString();
  return sameDay
    ? d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

export function buildRail(root, app, speeds) {
  root.innerHTML = '';
  const p = app.params;

  /* Brush */
  const sb = section('Brush', '[ ]');
  const brush = segmented(BRUSH_SIZES.map((_, i) => i), BRUSH_SIZES.map(String), p.brush, (v) => app.setBrush(v), 'Brush size');
  sb.append(brush.wrap);
  app.on('brush', (i) => brush.set(i));

  /* Speed */
  const ss = section('Speed', '- +');
  const speed = segmented(speeds, ['¼', '½', '1', '2', '4'], p.speed, (v) => app.setSpeed(v), 'Simulation speed');
  ss.append(speed.wrap);
  app.on('speed', (v) => speed.set(v));

  /* Time */
  const st = section('Time', 'space ·');
  const row = document.createElement('div');
  row.className = 'row';
  const pause = button('<span class="glyph">❚❚</span> Pause', () => app.togglePause(), 'wide');
  pause.dataset.paused = 'false';
  const stepB = button('<span class="glyph">›</span> Step', () => app.stepOnce());
  row.append(pause, stepB);
  st.append(row);
  app.on('paused', (v) => {
    pause.dataset.paused = String(v);
    pause.innerHTML = v ? '<span class="glyph">▶</span> Play' : '<span class="glyph">❚❚</span> Pause';
  });

  /* Edit */
  const se = section('Edit', 'ctrl z');
  const row2 = document.createElement('div');
  row2.className = 'row';
  const undo = button('Undo', () => app.undo());
  undo.disabled = !app.history.canUndo;
  app.history.onChange((can) => { undo.disabled = !can; });
  const clear = button('Clear', () => requestClear(), 'danger');
  row2.append(undo, clear);
  se.append(row2);

  let armed = null;
  function requestClear() {
    if (armed) { clearTimeout(armed); armed = null; clear.textContent = 'Clear'; clear.classList.remove('armed'); app.clear(); return; }
    clear.textContent = 'Sure?';
    clear.classList.add('armed');
    armed = setTimeout(() => { armed = null; clear.textContent = 'Clear'; clear.classList.remove('armed'); }, 1800);
  }
  app.on('request-clear', requestClear);

  /* Gravity + wind */
  const sg = section('Forces', 'g');
  const grav = button('<span class="glyph">▼</span> Gravity down', () => app.flipGravity(), 'wide');
  app.on('gravity', (g) => {
    grav.innerHTML = g > 0 ? '<span class="glyph">▼</span> Gravity down' : '<span class="glyph">▲</span> Gravity up';
  });
  const edgeLabel = (box) => (box ? '<span class="glyph">▣</span> Closed box' : '<span class="glyph">⤓</span> Edges open');
  const edges = button(edgeLabel(false), () => app.toggleBox(), 'wide');
  edges.title = 'Open: things fall off the bottom and float off the top, like the original game. Closed box: the edges hold everything in. (B)';
  app.on('box', (box) => { edges.innerHTML = edgeLabel(box); });
  const windRow = document.createElement('div');
  windRow.className = 'wind';
  const windLabel = document.createElement('label');
  windLabel.textContent = 'Wind';
  windLabel.htmlFor = 'wind';
  const wind = document.createElement('input');
  wind.type = 'range'; wind.id = 'wind'; wind.min = '-100'; wind.max = '100'; wind.step = '1'; wind.value = '0';
  const windVal = document.createElement('output');
  windVal.htmlFor = 'wind';
  windVal.textContent = 'calm';
  wind.addEventListener('input', () => {
    let v = Number(wind.value);
    if (Math.abs(v) < 8) v = 0;
    app.setWind(v);
  });
  wind.addEventListener('dblclick', () => app.setWind(0));
  app.on('wind', (v) => {
    wind.value = String(v);
    windVal.textContent = v === 0 ? 'calm' : `${v > 0 ? '→' : '←'} ${Math.abs(v)}`;
    windRow.classList.toggle('active', v !== 0);
  });
  windRow.append(windLabel, wind, windVal);
  sg.append(grav, edges, windRow);

  /* Scenes */
  const sc = section('Scenes');
  const slotEls = [];
  for (const slot of SLOTS) {
    const r = document.createElement('div');
    r.className = 'slot';
    const name = document.createElement('span');
    name.className = 'slot-name';
    name.textContent = `Slot ${slot}`;
    const time = document.createElement('span');
    time.className = 'slot-time';
    const saveB = button('Save', () => app.save(slot), 'mini');
    const loadB = button('Load', () => app.load(slot), 'mini');
    r.append(name, time, saveB, loadB);
    sc.append(r);
    slotEls.push({ slot, time, loadB });
  }
  function refreshSlots() {
    for (const s of slotEls) {
      const t = info(s.slot);
      s.time.textContent = when(t);
      s.loadB.disabled = t == null;
    }
  }
  refreshSlots();
  app.on('saved', ({ slot, ok }) => { refreshSlots(); app.toast(ok ? `Saved to slot ${slot}` : 'Could not save (storage blocked?)'); });
  app.on('loaded', ({ slot, ok }) => { app.toast(ok ? `Loaded slot ${slot}` : 'Nothing in that slot'); });

  /* Export */
  const sx = section('Export');
  const png = button('Download PNG', () => app.exportPng(), 'wide');
  sx.append(png);

  root.append(sb, ss, st, se, sg, sc, sx);
}
