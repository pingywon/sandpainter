/** The preset gallery: a dialog of thumbnail cards, one per showcase scene. */
import { PRESETS } from '../presets/scenes.js';
import { THUMBS } from '../presets/thumbs.js';

export function buildPresetsDialog(app) {
  const dlg = document.createElement('dialog');
  dlg.className = 'help presets';
  dlg.id = 'presets';

  const form = document.createElement('form');
  form.method = 'dialog';
  const h = document.createElement('h2');
  h.textContent = 'Presets';
  const intro = document.createElement('p');
  intro.textContent = 'Eight ready-made scenes, already in motion the moment they land. Undo brings your own painting back.';

  const grid = document.createElement('div');
  grid.className = 'preset-grid';
  for (const sc of PRESETS) {
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'preset-card';
    card.dataset.key = sc.key;
    const img = document.createElement('img');
    img.alt = `${sc.name} preview`;
    img.width = 160; img.height = 120;
    if (THUMBS[sc.key]) img.src = THUMBS[sc.key];
    const name = document.createElement('b');
    name.textContent = sc.name;
    const teaser = document.createElement('span');
    teaser.textContent = sc.teaser;
    card.append(img, name, teaser);
    card.addEventListener('click', () => pick(sc));
    grid.append(card);
  }

  // The gentle gate: loading over a painting asks first. An empty canvas just loads.
  const confirm = document.createElement('div');
  confirm.className = 'preset-confirm';
  confirm.hidden = true;
  const confirmText = document.createElement('p');
  const confirmRow = document.createElement('div');
  confirmRow.className = 'row';
  const yes = document.createElement('button');
  yes.type = 'button';
  yes.className = 'btn';
  yes.textContent = 'Replace it';
  const no = document.createElement('button');
  no.type = 'button';
  no.className = 'btn';
  no.textContent = 'Keep painting';
  confirmRow.append(yes, no);
  confirm.append(confirmText, confirmRow);

  const close = document.createElement('button');
  close.className = 'btn wide';
  close.value = 'close';
  close.textContent = 'Back to painting';

  form.append(h, intro, grid, confirm, close);
  dlg.append(form);
  document.body.append(dlg);

  let pending = null;
  function pick(sc) {
    if (app.worldEmpty()) { doLoad(sc); return; }
    pending = sc;
    confirmText.textContent = `Replace your painting with “${sc.name}”? Undo brings it back.`;
    confirm.hidden = false;
    grid.classList.add('dimmed');
  }
  function resetConfirm() {
    pending = null;
    confirm.hidden = true;
    grid.classList.remove('dimmed');
  }
  function doLoad(sc) {
    resetConfirm();
    dlg.close();
    app.loadPreset(sc.key);
    app.toast(`${sc.name} — undo brings your painting back`);
  }
  yes.addEventListener('click', () => { if (pending) doLoad(pending); });
  no.addEventListener('click', resetConfirm);
  dlg.addEventListener('close', resetConfirm);

  return { open() { resetConfirm(); dlg.showModal(); } };
}
