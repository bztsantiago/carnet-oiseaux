// Exporter : fichier Excel de toutes les balades, à télécharger.
import { h, toast, fmtDate, plural } from '../ui/components.js';
import * as repo from '../db/repo.js';
import { buildWorkbook } from '../services/export-xlsx.js';
import { today } from '../domain/models.js';

export async function render(main) {
  const c = await repo.loadAll();
  const balades = await repo.balades();
  const obs = await repo.allObservations();
  const last = await repo.getMeta('lastExport');
  const status = h('p', { class: 'muted small' }, last ? `Dernier export : ${fmtDate(last.slice(0, 10))}` : 'Aucun export pour l’instant.');

  const make = () => {
    const { blob, count } = buildWorkbook(c.balades, c.observations);
    const name = `observations_oiseaux_${today()}.xlsx`;
    return { blob, count, name };
  };
  const done = async (count) => {
    const at = new Date().toISOString();
    await repo.setMeta('lastExport', at);
    status.textContent = `Dernier export : ${fmtDate(at.slice(0, 10))}`;
    toast(`Fichier créé : ${plural(count, 'ligne', 'lignes')}`);
  };

  const downloadBtn = h('button', {
    class: 'btn btn-xl', type: 'button',
    onclick: async () => {
      const { blob, count, name } = make();
      const url = URL.createObjectURL(blob);
      const a = h('a', { href: url, download: name });
      document.body.append(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 30000);
      await done(count);
    },
  }, 'Exporter en Excel');

  main.append(
    h('h1', {}, 'Exporter'),
    h('p', {}, `${plural(balades.length, 'balade', 'balades')} · ${plural(obs.length, 'observation', 'observations')}`),
    h('p', { class: 'muted small' }, 'Une ligne par observation, avec les colonnes de ton classeur : Date, Lieu, Espèce, Pays, Nom scientifique, Remarques, Continent, puis l’heure.'),
    h('div', { class: 'stack', style: 'margin:18px 0' }, downloadBtn),
    status,
    h('div', { class: 'card', style: 'margin-top:18px' },
      h('p', { class: 'small' }, 'Tes données ne sont enregistrées que sur ce téléphone. Exporte de temps en temps pour garder une copie de sauvegarde.')),
  );
}
