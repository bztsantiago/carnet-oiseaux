// Dépôt de données : la seule porte d'entrée vers IndexedDB pour les écrans.
// Tout texte est normalisé (minuscules, sans accents) avant écriture.
// Un cache mémoire évite de relire la base à chaque affichage.
import { tx, req } from './idb.js';
import { makeBalade, makeObservation, makeLieu, touch, nowIso, today, hhmm, continentOf } from '../domain/models.js';
import { norm } from '../domain/normalize.js';

const STORES = ['balades', 'observations', 'lieux', 'meta'];
let cache = null;

export async function loadAll() {
  if (cache) return cache;
  const [balades, observations, lieux, meta] = await tx(STORES, 'readonly', (t) =>
    Promise.all(STORES.map((s) => req(t.objectStore(s).getAll()))));
  cache = { balades, observations, lieux, meta: Object.fromEntries(meta.map((m) => [m.key, m.value])) };
  return cache;
}

export function invalidate() { cache = null; }

const alive = (r) => !r.deletedAt;

async function putMany(store, records) {
  await tx([store], 'readwrite', (t) => { records.forEach((r) => t.objectStore(store).put(r)); });
  const c = await loadAll();
  for (const r of records) {
    const i = c[store].findIndex((x) => x.id === r.id);
    if (i >= 0) c[store][i] = r; else c[store].push(r);
  }
  return records;
}
const put = async (store, record) => (await putMany(store, [record]))[0];

export async function getMeta(key) { return (await loadAll()).meta[key]; }
export async function setMeta(key, value) {
  await tx(['meta'], 'readwrite', (t) => req(t.objectStore('meta').put({ key, value })));
  (await loadAll()).meta[key] = value;
}

// ---------- Lieux ----------
export async function lieux() {
  return (await loadAll()).lieux.filter(alive).sort((a, b) => a.nom.localeCompare(b.nom));
}
export async function findLieu(nom) {
  const n = norm(nom);
  return (await lieux()).find((l) => l.nom === n) || null;
}
export async function addLieu({ nom, pays, continent }) {
  const n = norm(nom);
  if (!n) throw new Error('Indique le nom du lieu.');
  if (!norm(pays)) throw new Error('Indique le pays du lieu.');
  if (await findLieu(n)) throw new Error('Ce lieu existe déjà.');
  return put('lieux', makeLieu({ nom: n, pays, continent: norm(continent) || continentOf(pays) }));
}

// ---------- Balades ----------
export async function balades() {
  const c = await loadAll();
  const counts = new Map();
  c.observations.forEach((o) => { if (alive(o)) counts.set(o.baladeId, (counts.get(o.baladeId) || 0) + 1); });
  return c.balades.filter(alive)
    .map((b) => ({ ...b, nb: counts.get(b.id) || 0 }))
    .sort((a, b) => (b.date + (b.debut || '')).localeCompare(a.date + (a.debut || '')));
}
export async function getBalade(id) {
  return (await loadAll()).balades.find((b) => b.id === id && alive(b)) || null;
}
export async function activeBalade() {
  const id = await getMeta('activeBaladeId');
  if (!id) return null;
  const b = await getBalade(id);
  return b && !b.fin ? b : null;
}
export async function startBalade({ date, lieu }) {
  const l = await findLieu(lieu);
  if (!l) throw new Error('Choisis ou crée un lieu.');
  const b = makeBalade({ date: date || today(), lieu: l.nom, pays: l.pays, continent: l.continent, debut: nowIso() });
  await put('balades', b);
  await setMeta('activeBaladeId', b.id);
  requestPersistence();
  return b;
}
export async function endBalade(id) {
  const b = await getBalade(id);
  if (b) await put('balades', touch({ ...b, fin: nowIso() }));
  if ((await getMeta('activeBaladeId')) === id) await setMeta('activeBaladeId', null);
}
export async function deleteBalade(id) {
  const c = await loadAll();
  const b = await getBalade(id);
  if (!b) return;
  const ts = nowIso();
  const obs = c.observations.filter((o) => o.baladeId === id && alive(o)).map((o) => ({ ...o, deletedAt: ts, updatedAt: ts }));
  await tx(['balades', 'observations'], 'readwrite', (t) => {
    t.objectStore('balades').put({ ...b, deletedAt: ts, updatedAt: ts });
    obs.forEach((o) => t.objectStore('observations').put(o));
  });
  invalidate();
  if ((await getMeta('activeBaladeId')) === id) await setMeta('activeBaladeId', null);
}

// ---------- Observations ----------
export async function observationsOf(baladeId) {
  return (await loadAll()).observations
    .filter((o) => o.baladeId === baladeId && alive(o))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
export async function allObservations() {
  const c = await loadAll();
  const ok = new Set(c.balades.filter(alive).map((b) => b.id));
  return c.observations.filter((o) => alive(o) && ok.has(o.baladeId));
}
export class AlreadyNoted extends Error {}

export async function addObservation(baladeId, { espece, entendu = false }) {
  const b = await getBalade(baladeId);
  if (!b) throw new Error('Balade introuvable.');
  const e = norm(espece);
  if (!e) throw new Error('Indique une espèce.');
  if ((await observationsOf(baladeId)).some((o) => o.espece === e)) throw new AlreadyNoted(`${e} est déjà notée.`);
  const live = !b.fin && b.date === today();
  return put('observations', makeObservation({ baladeId, espece: e, remarques: entendu ? 'entendu' : '', heure: live ? hhmm() : '' }));
}
export async function updateObservation(id, patch) {
  const c = await loadAll();
  const o = c.observations.find((x) => x.id === id);
  if (!o) throw new Error('Observation introuvable.');
  const next = { ...o };
  if ('espece' in patch) {
    const e = norm(patch.espece);
    if (!e) throw new Error('Indique une espèce.');
    if (e !== o.espece && (await observationsOf(o.baladeId)).some((x) => x.espece === e)) throw new AlreadyNoted(`${e} est déjà notée.`);
    next.espece = e;
  }
  if ('remarques' in patch) next.remarques = norm(patch.remarques);
  return put('observations', touch(next));
}
export async function deleteObservation(id) {
  const o = (await loadAll()).observations.find((x) => x.id === id);
  if (o) await put('observations', { ...o, deletedAt: nowIso(), updatedAt: nowIso() });
}
export async function restoreObservation(id) {
  const o = (await loadAll()).observations.find((x) => x.id === id);
  if (o) await put('observations', { ...o, deletedAt: null, updatedAt: nowIso() });
}

// ---------- Synchronisation (utilisé par services/sync) ----------
const PENDING = (r) => !r.syncedAt || r.updatedAt > r.syncedAt;
export async function pendingChanges() {
  const c = await loadAll();
  return { lieux: c.lieux.filter(PENDING), balades: c.balades.filter(PENDING), observations: c.observations.filter(PENDING) };
}
export async function markSynced(changes, at) {
  for (const store of ['lieux', 'balades', 'observations']) {
    if (changes[store]?.length) await putMany(store, changes[store].map((r) => ({ ...r, syncedAt: at })));
  }
}
// Fusion « la modification la plus récente l'emporte ».
export async function mergeRemote(remote) {
  const c = await loadAll();
  for (const store of ['lieux', 'balades', 'observations']) {
    const incoming = (remote[store] || []).filter((r) => {
      const local = c[store].find((x) => x.id === r.id);
      return !local || r.updatedAt > local.updatedAt;
    }).map((r) => ({ ...r, syncedAt: r.updatedAt }));
    if (incoming.length) await putMany(store, incoming);
  }
}

// Demande au navigateur de ne pas effacer les données quand le stockage se remplit.
export function requestPersistence() {
  try { navigator.storage?.persist?.(); } catch { /* non disponible */ }
}
