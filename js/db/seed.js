// Import des observations de base (data/seed.json).
// SEED_VERSION augmente quand seed.json change. À chaque nouvelle version, les anciennes
// lignes « seed-… » sont remplacées. Ce qui a été saisi dans l'appli est gardé, sauf ce
// que le nouveau fichier contient déjà (même date, lieu et espèce) : c'est le cas quand
// seed.json a été refait à partir d'un export de l'appli.
import { tx, req } from './idb.js';
import { getMeta, invalidate } from './repo.js';
import { uuid } from '../domain/models.js';

const SEED_VERSION = 2;
const STORES = ['lieux', 'balades', 'observations', 'meta'];
const isSeed = (r) => String(r.id).startsWith('seed-');

export async function ensureSeed() {
  if (((await getMeta('seedVersion')) || 0) >= SEED_VERSION) return false;
  const res = await fetch('./data/seed.json', { cache: 'no-cache' });
  if (!res.ok) throw new Error('Données initiales introuvables');
  const data = await res.json();

  const [lieux, balades, observations, meta] = await tx(STORES, 'readonly', (t) =>
    Promise.all(STORES.map((s) => req(t.objectStore(s).getAll()))));
  const activeId = meta.find((m) => m.key === 'activeBaladeId')?.value || null;
  const plan = planReplacement(data, { lieux, balades, observations }, activeId);

  await tx(STORES, 'readwrite', (t) => {
    const os = (s) => t.objectStore(s);
    for (const [store, ids] of Object.entries(plan.remove)) ids.forEach((id) => os(store).delete(id));
    for (const [store, records] of Object.entries(plan.put)) records.forEach((r) => os(store).put(r));
    if (activeId !== plan.activeId) os('meta').put({ key: 'activeBaladeId', value: plan.activeId });
    os('meta').put({ key: 'seedVersion', value: SEED_VERSION });
  });
  invalidate();
  return true;
}

// Calcul pur : ce qu'il faut supprimer et écrire pour passer à la nouvelle version.
export function planReplacement(data, old, activeId) {
  const key = (b) => `${b.date}|${b.lieu}`;
  const newBalade = new Map(data.balades.map((b) => [key(b), b]));
  const newObs = new Set(data.observations.map((o) => `${o.baladeId}|${o.espece}`));
  const oldBalade = new Map(old.balades.map((b) => [b.id, b]));

  const remove = { lieux: [], balades: [], observations: [] };
  const put = { lieux: [], balades: [], observations: [] };
  const renamed = new Map(); // ancienne balade « seed » gardée → nouvel identifiant

  // Ancienne balade → balade du nouveau fichier (même date et lieu), ou identifiant à garder.
  const target = (baladeId) => {
    const b = oldBalade.get(baladeId);
    if (!b) return baladeId;
    const nb = newBalade.get(key(b));
    if (nb) return nb.id;
    if (!isSeed(b)) return b.id;
    if (!renamed.has(b.id)) {
      renamed.set(b.id, uuid());
      put.balades.push({ ...b, id: renamed.get(b.id) });
    }
    return renamed.get(b.id);
  };

  for (const o of old.observations) {
    if (isSeed(o)) { remove.observations.push(o.id); continue; }
    const to = target(o.baladeId);
    if (newObs.has(`${to}|${o.espece}`) && !o.deletedAt) remove.observations.push(o.id);
    else if (to !== o.baladeId) put.observations.push({ ...o, baladeId: to });
  }
  const nextActive = activeId ? target(activeId) : null;

  // Anciennes balades « seed » et balades saisies que le nouveau fichier contient déjà.
  for (const b of old.balades) {
    if (isSeed(b) || newBalade.has(key(b))) remove.balades.push(b.id);
  }

  const keptNames = new Set(old.lieux.filter((l) => !isSeed(l)).map((l) => l.nom));
  remove.lieux = old.lieux.filter(isSeed).map((l) => l.id);
  put.lieux = data.lieux.filter((l) => !keptNames.has(l.nom));
  put.balades.push(...data.balades);
  put.observations.push(...data.observations);
  return { remove, put, activeId: nextActive };
}
