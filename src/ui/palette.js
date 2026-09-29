/** The element tray: grouped swatches on the left. */
import { RANDOM } from '../engine/ids.js';
import { ELEMENTS, TRAY, GROUPS, elementName, elementHint, elementCss } from '../engine/elements.js';

export const QUICK_KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];

function groupOf(id) {
  if (id === RANDOM) return 'Tools';
  return ELEMENTS[id].group;
}

export function buildTray(root, app) {
  root.innerHTML = '';
  const buttons = new Map();
  let keyIdx = 0;

  GROUPS.forEach((group, gi) => {
    const ids = TRAY.filter((id) => groupOf(id) === group);
    if (!ids.length) return;
    const section = document.createElement('section');
    section.className = 'group';
    section.style.setProperty('--i', gi);
    const h = document.createElement('h2');
    h.textContent = group;
    section.append(h);
    const grid = document.createElement('div');
    grid.className = 'swatches';
    for (const id of ids) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'swatch';
      b.dataset.id = id;
      b.setAttribute('aria-pressed', String(id === app.params.element));
      b.title = elementHint(id);
      const chip = document.createElement('i');
      chip.className = 'chip';
      chip.style.background = elementCss(id);
      const name = document.createElement('span');
      name.className = 'name';
      name.textContent = elementName(id);
      b.append(chip, name);
      if (keyIdx < QUICK_KEYS.length) {
        const k = document.createElement('kbd');
        k.textContent = QUICK_KEYS[keyIdx];
        b.append(k);
        b.dataset.key = QUICK_KEYS[keyIdx];
        keyIdx++;
      }
      b.addEventListener('click', () => app.setElement(id));
      buttons.set(id, b);
      grid.append(b);
    }
    section.append(grid);
    root.append(section);
  });

  app.on('element', (id) => {
    for (const [eid, b] of buttons) b.setAttribute('aria-pressed', String(eid === id));
    const active = buttons.get(id);
    if (active) active.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  });

  return buttons;
}

/** Ids of the first nine tray elements, in key order. */
export function quickPickIds() {
  const ordered = [];
  for (const group of GROUPS) {
    for (const id of TRAY) if (groupOf(id) === group) ordered.push(id);
  }
  return ordered.slice(0, QUICK_KEYS.length);
}
