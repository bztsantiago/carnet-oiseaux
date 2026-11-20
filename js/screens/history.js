// Historique : toutes les balades, de la plus récente à la plus ancienne.
import { h, fmtDate, plural } from '../ui/components.js';
import * as repo from '../db/repo.js';
import { norm } from '../domain/normalize.js';

export async function render(main) {
  const balades = await repo.balades();
  const active = await repo.activeBalade();
  const filter = h('input', { type: 'search', placeholder: 'Filtrer par lieu ou pays', autocomplete: 'off', autocapitalize: 'off', 'aria-label': 'Filtrer les balades' });
  const list = h('ul', { class: 'list' });
  const count = h('p', { class: 'muted small' });

  function draw() {
    const q = norm(filter.value);
    const shown = q ? balades.filter((b) => b.lieu.includes(q) || b.pays.includes(q)) : balades;
    count.textContent = plural(shown.length, 'balade', 'balades');
    let year = null;
    const items = [];
    for (const b of shown) {
      const y = b.date.slice(0, 4);
      if (y !== year) { year = y; items.push(h('li', {}, h('h2', { style: 'margin:.8em 0 .2em' }, y))); }
      items.push(h('li', {}, h('a', { class: 'item', href: `#/balade/${b.id}` },
        h('div', { class: 'grow' },
          h('div', { class: 'title name' }, b.lieu),
          h('div', { class: 'muted small' }, `${fmtDate(b.date)} · ${b.pays}`)),
        active && active.id === b.id ? h('span', { class: 'badge badge-amber' }, 'en cours') : null,
        h('span', { class: 'count' }, b.nb))));
    }
    list.replaceChildren(...items);
  }
  filter.addEventListener('input', draw);

  main.append(h('h1', {}, 'Historique'), filter, count, list);
  draw();
}
