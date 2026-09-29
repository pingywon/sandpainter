/** The four spigot chips that sit above the canvas, aligned with where they pour. */
import { Spigots, RATE_WIDTH } from '../engine/spigots.js';
import { SPIGOT_OPTIONS, elementName, elementCss } from '../engine/elements.js';

export function buildSpigotBar(root, app) {
  root.innerHTML = '';
  const chips = [];
  app.spigots.list.forEach((s, k) => {
    const chip = document.createElement('div');
    chip.className = 'spigot';
    chip.style.setProperty('--x', `${Spigots.centre(k) * 100}%`);

    const dot = document.createElement('i');
    dot.className = 'chip';
    dot.style.background = elementCss(s.element);

    const label = document.createElement('label');
    label.className = 'sr-only';
    label.textContent = `Spigot ${k + 1} element`;
    const sel = document.createElement('select');
    sel.setAttribute('aria-label', `Spigot ${k + 1} element`);
    for (const id of SPIGOT_OPTIONS) {
      const o = document.createElement('option');
      o.value = id;
      o.textContent = elementName(id);
      if (id === s.element) o.selected = true;
      sel.append(o);
    }
    sel.addEventListener('change', () => app.spigots.set(k, { element: Number(sel.value) }));

    const rate = document.createElement('div');
    rate.className = 'rate';
    rate.setAttribute('role', 'group');
    rate.setAttribute('aria-label', `Spigot ${k + 1} flow`);
    const bars = [];
    for (let r = 0; r < RATE_WIDTH.length; r++) {
      const b = document.createElement('button');
      b.type = 'button';
      if (r === 0) {
        b.className = 'off';
        b.textContent = 'off';
        b.title = 'Stop this spigot (click any bar to start it again)';
        b.setAttribute('aria-label', `Turn spigot ${k + 1} off`);
      } else {
        b.className = 'bar';
        b.style.setProperty('--n', r);
        b.title = `Pour at strength ${r} of ${RATE_WIDTH.length - 1}`;
        b.setAttribute('aria-label', `Spigot ${k + 1} strength ${r}`);
      }
      b.addEventListener('click', () => app.spigots.set(k, { rate: r }));
      bars.push(b);
      rate.append(b);
    }
    const head = document.createElement('div');
    head.className = 'spigot-head';
    head.append(dot, sel);
    chip.append(head, rate);
    root.append(chip);
    chips.push({ chip, dot, sel, bars });
    paint(k, s);
  });

  function paint(k, s) {
    const c = chips[k];
    c.dot.style.background = elementCss(s.element);
    c.sel.value = String(s.element);
    c.bars.forEach((b, r) => b.classList.toggle('on', r > 0 && r <= s.rate));
    c.bars[0].setAttribute('aria-pressed', String(s.rate === 0));
    c.chip.classList.toggle('off', s.rate === 0);
  }
  app.spigots.onChange(paint);
}
