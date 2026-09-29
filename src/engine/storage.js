/**
 * Save / load scenes to localStorage (run-length encoded) and PNG export.
 * Every storage access is wrapped so a blocked or full store never breaks the app.
 */
const PREFIX = 'sandpainter.slot.';
export const AUTOSAVE_KEY = 'sandpainter.autosave';
export const SLOTS = [1, 2, 3];

function rle(bytes) {
  const out = [];
  let i = 0;
  const n = bytes.length;
  while (i < n) {
    const v = bytes[i];
    let run = 1;
    while (i + run < n && bytes[i + run] === v && run < 255) run++;
    out.push(v, run);
    i += run;
  }
  return Uint8Array.from(out);
}

function unrle(bytes, n) {
  const out = new Uint8Array(n);
  let o = 0;
  for (let i = 0; i < bytes.length && o < n; i += 2) {
    const v = bytes[i], run = bytes[i + 1];
    out.fill(v, o, Math.min(n, o + run));
    o += run;
  }
  return out;
}

function toB64(bytes) {
  let s = '';
  const CH = 0x8000;
  for (let i = 0; i < bytes.length; i += CH) {
    s += String.fromCharCode.apply(null, bytes.subarray(i, i + CH));
  }
  return btoa(s);
}

function fromB64(s) {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export function encode(world) {
  return JSON.stringify({
    v: 1, t: Date.now(), w: world.w, h: world.h,
    cells: toB64(rle(world.cells)),
    aux: toB64(rle(world.aux)),
  });
}

export function decode(json, world) {
  const d = JSON.parse(json);
  if (!d || d.v !== 1 || d.w !== world.w || d.h !== world.h) return false;
  world.cells.set(unrle(fromB64(d.cells), world.n));
  world.aux.set(unrle(fromB64(d.aux), world.n));
  world.randomizeShade();
  return true;
}

function keyFor(slot) { return slot === 'auto' ? AUTOSAVE_KEY : PREFIX + slot; }

export function save(slot, world) {
  try {
    localStorage.setItem(keyFor(slot), encode(world));
    return true;
  } catch (e) {
    console.warn('save failed', e);
    return false;
  }
}

export function load(slot, world) {
  try {
    const s = localStorage.getItem(keyFor(slot));
    if (!s) return false;
    return decode(s, world);
  } catch (e) {
    console.warn('load failed', e);
    return false;
  }
}

/** Timestamp (ms) of a saved slot, or null. */
export function info(slot) {
  try {
    const s = localStorage.getItem(keyFor(slot));
    if (!s) return null;
    const t = JSON.parse(s).t;
    return typeof t === 'number' ? t : null;
  } catch { return null; }
}

/** Render the canvas to a PNG blob plus an object URL and a suggested filename. */
export function snapshot(canvas, name = 'sandpainter') {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  return new Promise((resolve) => {
    canvas.toBlob((blob) => {
      if (!blob) { resolve(null); return; }
      resolve({ blob, url: URL.createObjectURL(blob), filename: `${name}-${stamp}.png` });
    }, 'image/png');
  });
}

/** Copy a PNG blob to the clipboard. Resolves false where the browser refuses. */
export async function copyPng(blob) {
  try {
    if (!navigator.clipboard || !window.ClipboardItem) return false;
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
    return true;
  } catch { return false; }
}
