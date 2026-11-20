// Détail d'une balade : liste modifiable, ajout d'une espèce oubliée, suppression.
import { h, toast, confirmDialog, fmtDate, fmtTime, plural } from '../ui/components.js';
import * as repo from '../db/repo.js';
import { addPanel } from '../ui/add-panel.js';
import { obsItem } from '../ui/obs-item.js';
import { go } from '../router.js';

export async function render(main, id) {
  const b = await repo.getBalade(id);
  if (!b) {
    main.append(h('h1', {}, 'Balade introuvable'), h('a', { class: 'btn', href: '#/historique' }, 'Retour à l’historique'));
    return;
  }
  const active = await repo.activeBalade();
  const isActive = active && active.id === b.id;

  const meta = h('p', { class: 'muted small' });
  const list = h('ul', { class: 'list' });
  async function refresh() {
    const obs = await repo.observationsOf(b.id);
    const horaires = b.debut ? `${fmtTime(b.debut)}${b.fin ? ` – ${fmtTime(b.fin)}` : ''}` : null;
    meta.textContent = [b.pays, horaires, plural(obs.length, 'espèce', 'espèces')].filter(Boolean).join(' · ');
    list.replaceChildren(...obs.sort((x, y) => x.espece.localeCompare(y.espece)).map((o) => obsItem(o, refresh)));
  }

  const panelSlot = h('div');
  const addBtn = h('button', {
    class: 'btn btn-ghost', type: 'button',
    onclick: async () => {
      addBtn.hidden = true;
      panelSlot.replaceChildren(await addPanel({ balade: b, onChange: refresh, inline: true }));
      panelSlot.querySelector('input')?.focus();
    },
  }, '+ Ajouter une espèce oubliée');

  const delBtn = h('button', {
    class: 'btn btn-ghost', type: 'button', style: 'color:var(--danger)',
    onclick: async () => {
      const n = (await repo.observationsOf(b.id)).length;
      if (!(await confirmDialog(`Supprimer cette balade et ses ${n} observations ?`, 'Supprimer', { danger: true }))) return;
      await repo.deleteBalade(b.id);
      toast('Balade supprimée');
      go('#/historique');
    },
  }, 'Supprimer la balade');

  main.append(
    h('a', { href: '#/historique', class: 'muted small', style: 'text-decoration:none' }, '‹ Historique'),
    h('h1', { class: 'name' }, b.lieu),
    h('p', {}, fmtDate(b.date, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })),
    meta,
    isActive ? h('a', { class: 'btn', href: '#/', style: 'margin:12px 0' }, 'Reprendre la balade en cours') : null,
    h('p', { class: 'muted small' }, 'Touche un nom pour le corriger, « vu / entendu » pour basculer.'),
    list,
    h('div', { class: 'stack', style: 'margin-top:16px' }, addBtn, panelSlot, delBtn),
  );
  await refresh();
}
