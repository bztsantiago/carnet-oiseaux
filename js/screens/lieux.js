// Lieux : liste des lieux connus et ajout d'un nouveau lieu.
import { h, toast, field, plural } from '../ui/components.js';
import * as repo from '../db/repo.js';
import { norm } from '../domain/normalize.js';
import { lieuExtraFields } from '../ui/lieu-form.js';
import { run } from '../router.js';

export async function render(main) {
  const lieux = await repo.lieux();
  const balades = await repo.balades();
  const usage = new Map();
  balades.forEach((b) => usage.set(b.lieu, (usage.get(b.lieu) || 0) + 1));

  const nom = h('input', { id: 'lieu-nom', autocomplete: 'off', autocapitalize: 'off', spellcheck: 'false', placeholder: 'ex. etang de virelles' });
  const extra = lieuExtraFields(lieux.map((l) => l.pays), 'lieux');
  const submit = h('button', { class: 'btn', type: 'submit' }, 'Ajouter le lieu');
  const form = h('form', { class: 'card stack', novalidate: true }, field('Nom du lieu', nom), ...extra.elements, submit);
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      const l = await repo.addLieu({ nom: nom.value, pays: extra.pays.value, continent: extra.continent.value });
      toast(`Lieu ajouté : ${l.nom}`);
      run();
    } catch (err) {
      toast(err.message);
    }
  });

  const filter = h('input', { type: 'search', placeholder: 'Filtrer', autocomplete: 'off', autocapitalize: 'off', 'aria-label': 'Filtrer les lieux' });
  const list = h('ul', { class: 'list' });
  function draw() {
    const q = norm(filter.value);
    const shown = lieux.filter((l) => !q || l.nom.includes(q) || l.pays.includes(q));
    list.replaceChildren(...shown.map((l) => h('li', { class: 'item' },
      h('div', { class: 'grow' },
        h('div', { class: 'title name' }, l.nom),
        h('div', { class: 'muted small' }, [l.pays, l.continent].filter(Boolean).join(' · '))),
      h('span', { class: 'muted small' }, plural(usage.get(l.nom) || 0, 'balade', 'balades')))));
  }
  filter.addEventListener('input', draw);

  main.append(
    h('h1', {}, 'Lieux'),
    h('h2', {}, 'Nouveau lieu'), form,
    h('h2', {}, `${plural(lieux.length, 'lieu connu', 'lieux connus')}`), filter,
    h('div', { style: 'height:10px' }), list,
  );
  draw();
}
