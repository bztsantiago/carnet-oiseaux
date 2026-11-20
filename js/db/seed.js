// Import des observations historiques au premier lancement.
// SEED_VERSION n'augmente que si data/seed.json change ; l'import ne se refait
// jamais pour une même version. Les identifiants « seed-… » sont fixes.
import { tx } from './idb.js';
import { getMeta, invalidate } from './repo.js';

const SEED_VERSION = 1;

export async function ensureSeed() {
  if ((await getMeta('seedVersion')) >= SEED_VERSION) return false;
  const res = await fetch('./data/seed.json');
  if (!res.ok) throw new Error('Données initiales introuvables');
  const data = await res.json();
  await tx(['lieux', 'balades', 'observations', 'meta'], 'readwrite', (t) => {
    for (const store of ['lieux', 'balades', 'observations']) {
      const os = t.objectStore(store);
      data[store].forEach((r) => os.put(r));
    }
    t.objectStore('meta').put({ key: 'seedVersion', value: SEED_VERSION });
  });
  invalidate();
  return true;
}
