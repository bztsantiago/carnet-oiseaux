// Index des espèces pour l'autocomplétion et les pastilles de suggestion.
// Le classement favorise les espèces déjà vues à ce lieu et à cette saison.
import { norm } from './normalize.js';

export function buildIndex(observations, balades) {
  const byId = new Map(balades.map((b) => [b.id, b]));
  const map = new Map();
  for (const o of observations) {
    const b = byId.get(o.baladeId);
    if (!b) continue;
    record(map, o.espece, b.lieu, +b.date.slice(5, 7));
  }
  return { map, list: () => Array.from(map.values()) };
}

export function record(index, espece, lieu, mois) {
  const map = index.map || index;
  let s = map.get(espece);
  if (!s) { s = { nom: espece, total: 0, lieux: new Map(), mois: new Array(13).fill(0) }; map.set(espece, s); }
  s.total += 1;
  s.lieux.set(lieu, (s.lieux.get(lieu) || 0) + 1);
  s.mois[mois] += 1;
}

function score(s, ctx) {
  const m = ctx.mois;
  const prev = m === 1 ? 12 : m - 1;
  const next = m === 12 ? 1 : m + 1;
  const saison = s.mois[m] + 0.5 * (s.mois[prev] + s.mois[next]);
  return (s.lieux.get(ctx.lieu) || 0) * 4 + saison * 1.5 + s.total * 0.3;
}

export function suggestions(index, ctx, exclude, n = 8) {
  return index.list()
    .filter((s) => !exclude.has(s.nom))
    .sort((a, b) => score(b, ctx) - score(a, ctx) || a.nom.localeCompare(b.nom))
    .slice(0, n)
    .map((s) => s.nom);
}

const split = (s) => s.split(/[ \-']+/).filter(Boolean);

export function search(index, query, ctx, n = 6) {
  const q = norm(query);
  if (!q) return [];
  const words = split(q);
  const found = [];
  for (const s of index.list()) {
    const parts = split(s.nom);
    let rank;
    if (s.nom.startsWith(q)) rank = 0;
    else if (words.every((w) => parts.some((p) => p.startsWith(w)))) rank = 1;
    else if (s.nom.includes(q)) rank = 2;
    else continue;
    found.push([rank, s]);
  }
  return found
    .sort((a, b) => a[0] - b[0] || score(b[1], ctx) - score(a[1], ctx) || a[1].nom.localeCompare(b[1].nom))
    .slice(0, n)
    .map((r) => r[1].nom);
}
