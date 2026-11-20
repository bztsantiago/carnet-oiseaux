// Synchronisation : indépendante du service distant.
// Un « adaptateur » fournit deux fonctions :
//   push({lieux, balades, observations}) → envoie les lignes modifiées
//   pull(sinceIso) → renvoie {lieux, balades, observations} modifiés depuis cette date
// Aucun adaptateur n'est branché pour l'instant : l'appli reste 100 % locale.
// Pour Supabase, voir supabase.js et le README.
import * as repo from '../../db/repo.js';
import { nowIso } from '../../domain/models.js';

let adapter = null;

export function setAdapter(a) { adapter = a; }
export function isEnabled() { return !!adapter; }

export async function syncNow() {
  if (!adapter) return { status: 'off' };
  if (!navigator.onLine) return { status: 'offline' };
  const startedAt = nowIso();
  const changes = await repo.pendingChanges();
  const pushed = changes.lieux.length + changes.balades.length + changes.observations.length;
  if (pushed) {
    await adapter.push(changes);
    await repo.markSynced(changes, startedAt);
  }
  const since = (await repo.getMeta('lastPull')) || '1970-01-01T00:00:00.000Z';
  const remote = await adapter.pull(since);
  await repo.mergeRemote(remote);
  await repo.setMeta('lastPull', startedAt);
  return { status: 'ok', pushed };
}
