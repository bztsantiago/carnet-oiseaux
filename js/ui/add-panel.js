// Panneau d'ajout rapide : pastilles d'espèces probables + recherche avec
// autocomplétion. Un toucher sur une pastille ou une suggestion = observation notée.
import { h, toast, vibrate } from './components.js';
import * as repo from '../db/repo.js';
import { buildIndex, record, suggestions, search } from '../domain/species.js';
import { norm } from '../domain/normalize.js';

export async function addPanel({ balade, onChange, inline = false }) {
  const all = await repo.loadAll();
  const index = buildIndex(await repo.allObservations(), all.balades);
  const ctx = { lieu: balade.lieu, mois: +balade.date.slice(5, 7) };
  let entendu = false;

  const chips = h('div', { class: 'chips', 'aria-label': 'Espèces probables' });
  const list = h('ul', { class: 'suggest', role: 'listbox', hidden: true });
  const input = h('input', {
    type: 'search', placeholder: 'Espèce…', autocomplete: 'off', autocapitalize: 'off',
    autocorrect: 'off', spellcheck: 'false', enterkeyhint: 'done', 'aria-label': 'Rechercher une espèce',
  });
  const ent = h('button', { class: 'toggle', type: 'button', 'aria-pressed': 'false' }, 'Entendu');
  const setEntendu = (v) => { entendu = v; ent.setAttribute('aria-pressed', String(v)); };
  ent.addEventListener('click', () => setEntendu(!entendu));

  const noted = async () => new Set((await repo.observationsOf(balade.id)).map((o) => o.espece));

  async function add(name, fromSearch = false) {
    const espece = norm(name);
    if (!espece) return;
    const heard = entendu; // valeur au moment du toucher, même si on rebascule pendant l'enregistrement
    try {
      const o = await repo.addObservation(balade.id, { espece, entendu: heard });
      vibrate();
      record(index, espece, ctx.lieu, ctx.mois);
      toast(`Notée : ${espece}${heard ? ' (entendu)' : ''}`, {
        action: 'Annuler',
        onAction: async () => { await repo.deleteObservation(o.id); await refreshChips(); onChange?.(); },
      });
      if (fromSearch) { input.value = ''; list.hidden = true; }
      if (heard) setEntendu(false);
      await refreshChips();
      onChange?.();
    } catch (err) {
      toast(err.message);
    }
  }

  async function refreshChips() {
    const done = await noted();
    chips.replaceChildren(...suggestions(index, ctx, done, 8).map((nom) =>
      h('button', { class: 'chip name', type: 'button', onclick: () => add(nom) }, nom)));
  }

  async function refreshList() {
    const q = norm(input.value);
    if (!q) { list.hidden = true; return; }
    const done = await noted();
    const found = search(index, q, ctx, 6);
    const items = found.map((nom) => h('li', {},
      h('button', { class: 'sugg', type: 'button', disabled: done.has(nom), onclick: () => add(nom, true) },
        h('span', { class: 'name' }, nom),
        done.has(nom) ? h('small', {}, 'déjà notée') : null)));
    if (!found.includes(q)) {
      items.push(h('li', {}, h('button', { class: 'sugg sugg-new', type: 'button', onclick: () => add(q, true) },
        '+ Nouvelle espèce : ', h('b', {}, q))));
    }
    list.replaceChildren(...items);
    list.hidden = false;
  }

  input.addEventListener('input', refreshList);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      list.querySelector('button:not([disabled])')?.click();
    } else if (e.key === 'Escape') {
      input.value = ''; list.hidden = true;
    }
  });

  await refreshChips();
  return h('div', { class: inline ? 'add-panel inline-panel' : 'add-panel' },
    chips,
    h('div', { class: 'add-row' }, list, input, ent));
}
