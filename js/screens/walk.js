// Onglet « Balade » : accueil (démarrer) ou balade en cours (ajout rapide).
import { h, toast, confirmDialog, fmtDate, fmtTime, plural } from '../ui/components.js';
import * as repo from '../db/repo.js';
import { addPanel } from '../ui/add-panel.js';
import { obsItem } from '../ui/obs-item.js';
import { onLeave, go } from '../router.js';

export async function render(main) {
  const balade = await repo.activeBalade();
  if (balade) return renderActive(main, balade);
  return renderHome(main);
}

async function renderHome(main) {
  const balades = await repo.balades();
  const obs = await repo.allObservations();
  const especes = new Set(obs.map((o) => o.espece)).size;
  const tile = (n, label) => h('div', { class: 'tile' }, h('b', {}, n.toLocaleString('fr-FR')), h('span', {}, label));
  const last = balades[0];
  main.append(
    h('h1', {}, 'Carnet ornitho'),
    h('div', { class: 'tiles' }, tile(balades.length, 'balades'), tile(especes, 'espèces'), tile(obs.length, 'observations')),
    h('a', { class: 'btn btn-xl', href: '#/demarrer' }, 'Démarrer une balade'),
    last ? h('h2', {}, 'Dernière balade') : null,
    last ? h('a', { class: 'item', href: `#/balade/${last.id}` },
      h('div', { class: 'grow' },
        h('div', { class: 'title name' }, last.lieu),
        h('div', { class: 'muted small' }, `${fmtDate(last.date)} · ${last.pays}`)),
      h('span', { class: 'count' }, plural(last.nb, 'espèce', 'espèces'))) : null,
  );
}

async function renderActive(main, b) {
  document.body.classList.add('has-dock');
  onLeave(() => document.body.classList.remove('has-dock'));

  const meta = h('p', { class: 'muted small' });
  const list = h('ul', { class: 'list' });
  const empty = h('p', { class: 'muted' }, 'Tape le nom d’une espèce en bas de l’écran.');

  async function refresh() {
    const obs = await repo.observationsOf(b.id);
    const since = b.debut ? `depuis ${fmtTime(b.debut)}` : fmtDate(b.date);
    meta.textContent = [b.pays, since, plural(obs.length, 'espèce', 'espèces')].filter(Boolean).join(' · ');
    empty.hidden = obs.length > 0;
    list.replaceChildren(...obs.map((o) => obsItem(o, refresh)));
  }

  const endBtn = h('button', {
    class: 'btn btn-ghost btn-sm', type: 'button',
    onclick: async () => {
      if (!(await confirmDialog('Terminer cette balade ?', 'Terminer'))) return;
      await repo.endBalade(b.id);
      toast('Balade terminée');
      go(`#/balade/${b.id}`);
    },
  }, 'Terminer');

  const panel = await addPanel({ balade: b, onChange: refresh });
  const dock = h('div', { class: 'dock' }, h('div', { class: 'dock-inner' }, panel));
  const section = h('section', { class: 'walk' },
    h('div', { class: 'walk-head' },
      h('div', { class: 'grow' }, h('p', { class: 'muted small' }, 'Balade en cours'), h('h1', { class: 'name' }, b.lieu), meta),
      endBtn),
    empty, list, dock);
  main.append(section);

  // Laisse de la place sous la liste pour le panneau d'ajout fixé en bas.
  const ro = new ResizeObserver(() => { section.style.paddingBottom = `${dock.offsetHeight + 8}px`; });
  ro.observe(dock);
  onLeave(() => ro.disconnect());

  await refresh();
}
