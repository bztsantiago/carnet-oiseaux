// Statistiques : fonctions pures (balades, observations) → chiffres.
// Elles ne lisent pas la base elles-mêmes : un futur écran « Stats » les
// appellera avec repo.balades() et repo.allObservations().
// Mêmes définitions que le tableau de bord : une sortie = une balade.

export function accumulation(balades, observations) {
  const parBalade = groupBy(observations, (o) => o.baladeId);
  const seen = new Set();
  return [...balades]
    .sort((a, b) => (a.date + (a.debut || '')).localeCompare(b.date + (b.debut || '')))
    .map((b, i) => {
      const esp = (parBalade.get(b.id) || []).map((o) => o.espece);
      let nouvelles = 0;
      esp.forEach((e) => { if (!seen.has(e)) { seen.add(e); nouvelles += 1; } });
      return { rang: i + 1, date: b.date, lieu: b.lieu, especes: esp.length, nouvelles, cumul: seen.size };
    });
}

export function frequenceEspeces(balades, observations) {
  const total = balades.length || 1;
  const parEspece = new Map();
  observations.forEach((o) => {
    if (!parEspece.has(o.espece)) parEspece.set(o.espece, new Set());
    parEspece.get(o.espece).add(o.baladeId);
  });
  return [...parEspece]
    .map(([espece, s]) => ({ espece, balades: s.size, taux: Math.round((s.size / total) * 1000) / 10 }))
    .sort((a, b) => b.balades - a.balades || a.espece.localeCompare(b.espece));
}

export function diversiteParMois(balades, observations, { exclurePays = [] } = {}) {
  const ok = balades.filter((b) => !exclurePays.includes(b.pays));
  const parBalade = groupBy(observations, (o) => o.baladeId);
  return Array.from({ length: 12 }, (_, i) => {
    const mois = i + 1;
    const bs = ok.filter((b) => +b.date.slice(5, 7) === mois);
    const esp = new Set(bs.flatMap((b) => (parBalade.get(b.id) || []).map((o) => o.espece)));
    return { mois, balades: bs.length, especes: esp.size };
  });
}

export function bilanParLieu(balades, observations) {
  const parBalade = groupBy(observations, (o) => o.baladeId);
  const parLieu = groupBy(balades, (b) => b.lieu);
  return [...parLieu].map(([lieu, bs]) => {
    const obs = bs.flatMap((b) => parBalade.get(b.id) || []);
    return {
      lieu, pays: bs[0].pays, balades: bs.length,
      especes: new Set(obs.map((o) => o.espece)).size,
      moyenne: Math.round((obs.length / bs.length) * 10) / 10,
    };
  }).sort((a, b) => b.especes - a.especes);
}

function groupBy(list, key) {
  const m = new Map();
  list.forEach((x) => { const k = key(x); if (!m.has(k)) m.set(k, []); m.get(k).push(x); });
  return m;
}
