// Une ligne d'observation : nom (modifiable au toucher), heure, « entendu »,
// suppression avec possibilité d'annuler.
import { h, toast } from './components.js';
import * as repo from '../db/repo.js';

export function obsItem(o, onChange) {
  const nameBtn = h('button', { class: 'item-name', type: 'button', 'aria-label': `Modifier ${o.espece}` },
    h('span', { class: 'title name' }, o.espece));
  nameBtn.style.cssText = 'all:unset;cursor:pointer;display:block';

  const meta = h('div', { class: 'muted small' },
    [o.heure, o.remarques === 'entendu' ? null : o.remarques].filter(Boolean).join(' · '));
  const grow = h('div', { class: 'grow' }, nameBtn, o.heure || (o.remarques && o.remarques !== 'entendu') ? meta : null);

  const earBtn = h('button', {
    class: o.remarques === 'entendu' ? 'badge badge-amber' : 'badge', type: 'button',
    'aria-pressed': String(o.remarques === 'entendu'), 'aria-label': 'Entendu',
    style: 'border:0;font:inherit;font-size:.78rem;min-height:36px;padding:0 10px',
    onclick: async () => {
      await repo.updateObservation(o.id, { remarques: o.remarques === 'entendu' ? '' : 'entendu' });
      onChange?.();
    },
  }, o.remarques === 'entendu' ? 'entendu' : 'vu');

  const del = h('button', {
    class: 'icon-btn', type: 'button', 'aria-label': `Supprimer ${o.espece}`,
    onclick: async () => {
      await repo.deleteObservation(o.id);
      onChange?.();
      toast(`Supprimée : ${o.espece}`, {
        action: 'Annuler',
        onAction: async () => { await repo.restoreObservation(o.id); onChange?.(); },
      });
    },
  }, '×');

  const li = h('li', { class: 'item' }, grow, earBtn, del);

  nameBtn.addEventListener('click', () => {
    const input = h('input', { class: 'edit-input', value: o.espece, autocapitalize: 'off', spellcheck: 'false', 'aria-label': 'Nom de l’espèce' });
    let done = false;
    const save = async () => {
      if (done) return;
      done = true;
      if (input.value.trim() && input.value !== o.espece) {
        try { await repo.updateObservation(o.id, { espece: input.value }); } catch (err) { toast(err.message); }
      }
      onChange?.();
    };
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); input.blur(); }
      if (e.key === 'Escape') { done = true; onChange?.(); }
    });
    input.addEventListener('blur', save);
    grow.replaceChildren(input);
    input.focus();
    input.select();
  });

  return li;
}
