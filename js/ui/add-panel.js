// Panneau d'ajout : recherche d'espèce avec autocomplétion.
// Un toucher sur une suggestion (ou Entrée) = observation notée.
import { h, toast, vibrate } from './components.js';
import * as repo from '../db/repo.js';
import { buildIndex, record, search } from '../domain/species.js';
import { norm } from '../domain/normalize.js';

export async function addPanel({ balade, onChange, inline = false }) {
  const all = await repo.loadAll();
  const index = buildIndex(await repo.allObservations(), all.balades);
  const ctx = { lieu: balade.lieu, mois: +balade.date.slice(5, 7) };
  let entendu = false;

  const list = h('ul', { class: 'suggest', role: 'listbox', hidden: true });
  const input = h('input', {
    type: 'search', placeholder: 'Espèce…', autocomplete: 'off', autocapitalize: 'off',
    autocorrect: 'off', spellcheck: 'false', enterkeyhint: 'done', 'aria-label': 'Rechercher une espèce',
  });
  const ent = h('button', { class: 'toggle', type: 'button', 'aria-pressed': 'false' }, 'Entendu');
  const setEntendu = (v) => { entendu = v; ent.setAttribute('aria-pressed', String(v)); };
  ent.addEventListener('click', () => setEntendu(!entendu));

  const noted = async () => new Set((await repo.observationsOf(balade.id)).map((o) => o.espece));

  async function add(name) {
    const espece = norm(name);
    if (!espece) return;
    const heard = entendu; // valeur au moment du toucher, même si on rebascule pendant l'enregistrement
    try {
      await repo.addObservation(balade.id, { espece, entendu: heard });
      vibrate();
      record(index, espece, ctx.lieu, ctx.mois);
      input.value = '';
      list.hidden = true;
      if (heard) setEntendu(false);
      onChange?.();
    } catch (err) {
      toast(err.message);
    }
  }

  async function refreshList() {
    const q = norm(input.value);
    if (!q) { list.hidden = true; return; }
    const done = await noted();
    const found = search(index, q, ctx, 6);
    const items = found.map((nom) => h('li', {},
      h('button', { class: 'sugg', type: 'button', disabled: done.has(nom), onclick: () => add(nom) },
        h('span', { class: 'name' }, nom),
        done.has(nom) ? h('small', {}, 'déjà notée') : null)));
    if (!found.includes(q)) {
      items.push(h('li', {}, h('button', { class: 'sugg sugg-new', type: 'button', onclick: () => add(q) },
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

  return h('div', { class: inline ? 'add-panel inline-panel' : 'add-panel' },
    h('div', { class: 'add-row' }, list, input, ent));
}
