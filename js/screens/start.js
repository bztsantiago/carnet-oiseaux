// Démarrer une balade : date du jour, lieu choisi parmi les anciens ou créé à la volée.
import { h, toast, field } from '../ui/components.js';
import * as repo from '../db/repo.js';
import { today } from '../domain/models.js';
import { norm } from '../domain/normalize.js';
import { lieuExtraFields } from '../ui/lieu-form.js';
import { go } from '../router.js';

export async function render(main) {
  if (await repo.activeBalade()) { go('#/'); return; }

  const lieux = await repo.lieux();
  const balades = await repo.balades();
  const usage = new Map();
  balades.forEach((b) => usage.set(b.lieu, (usage.get(b.lieu) || 0) + 1));
  const recents = [...new Set(balades.map((b) => b.lieu))].slice(0, 5);
  let chosen = null;

  const date = h('input', { type: 'date', id: 'date', value: today(), max: today() });
  const lieuInput = h('input', {
    type: 'search', id: 'lieu', placeholder: 'Chercher ou créer un lieu', autocomplete: 'off',
    autocapitalize: 'off', spellcheck: 'false', enterkeyhint: 'done',
  });
  const suggTitle = h('p', { class: 'muted small' });
  const sugg = h('ul', { class: 'list' });
  const extra = lieuExtraFields(lieux.map((l) => l.pays), 'nouveau');
  const newName = h('b', { class: 'name' });
  const newBox = h('div', { class: 'card stack', hidden: true }, h('p', {}, 'Nouveau lieu : ', newName), ...extra.elements);
  const submit = h('button', { class: 'btn btn-xl', type: 'submit', disabled: true }, 'C’est parti');

  function lieuButton(l) {
    const n = usage.get(l.nom) || 0;
    return h('li', {}, h('button', {
      class: 'item', type: 'button',
      onclick: () => { lieuInput.value = l.nom; update(); submit.focus(); },
    },
    h('div', { class: 'grow' },
      h('div', { class: 'title name' }, l.nom),
      h('div', { class: 'muted small' }, [l.pays, n ? `${n} balade${n > 1 ? 's' : ''}` : null].filter(Boolean).join(' · ')))));
  }

  function update() {
    const q = norm(lieuInput.value);
    chosen = lieux.find((l) => l.nom === q) || null;
    let shown;
    if (!q) {
      shown = recents.map((n) => lieux.find((l) => l.nom === n)).filter(Boolean);
      suggTitle.textContent = shown.length ? 'Lieux récents' : '';
    } else {
      shown = lieux.filter((l) => l !== chosen && (l.nom.includes(q) || l.pays.startsWith(q)))
        .sort((a, b) => (b.nom.startsWith(q) - a.nom.startsWith(q)) || (usage.get(b.nom) || 0) - (usage.get(a.nom) || 0))
        .slice(0, 6);
      suggTitle.textContent = shown.length ? 'Lieux connus' : '';
    }
    sugg.replaceChildren(...shown.map(lieuButton));
    newBox.hidden = !q || !!chosen;
    newName.textContent = q;
    submit.disabled = !q || (!chosen && !norm(extra.pays.value));
    submit.textContent = chosen || !q ? 'C’est parti' : 'Créer le lieu et partir';
  }

  lieuInput.addEventListener('input', update);
  extra.pays.addEventListener('input', update);

  const form = h('form', { class: 'stack', novalidate: true },
    field('Date', date),
    field('Lieu', lieuInput),
    suggTitle, sugg, newBox, submit);
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      let lieu = chosen;
      if (!lieu) lieu = await repo.addLieu({ nom: lieuInput.value, pays: extra.pays.value, continent: extra.continent.value });
      await repo.startBalade({ date: date.value || today(), lieu: lieu.nom });
      go('#/');
    } catch (err) {
      toast(err.message);
    }
  });

  main.append(h('h1', {}, 'Nouvelle balade'), form);
  update();
}
