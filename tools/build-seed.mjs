// Régénère data/seed.json à partir d'un fichier Excel au format de l'export de l'appli
// (colonnes Date, Lieu, Espèce, Pays, Nom scientifique, Remarques, Continent, Heure).
// Usage : node tools/build-seed.mjs data/source/observations.xlsx
// Pensez ensuite à augmenter SEED_VERSION dans js/db/seed.js et VERSION dans sw.js.
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { norm } from '../js/domain/normalize.js';
import { continentOf } from '../js/domain/models.js';
import { readSheet } from './xlsx-read.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = process.argv[2] || join(root, 'data/source/observations.xlsx');
const STAMP = new Date().toISOString().slice(0, 10) + 'T00:00:00.000Z';

const [header, ...lines] = readSheet(src);
const col = Object.fromEntries(Object.entries(header).map(([letter, label]) => [norm(label), letter]));
for (const need of ['date', 'lieu', 'espece', 'pays']) {
  if (!col[need]) throw new Error(`Colonne « ${need} » absente de ${src}`);
}
const get = (r, name) => (col[name] ? r[col[name]] ?? '' : '');
const base = (id) => ({ id, createdAt: STAMP, updatedAt: STAMP, deletedAt: null, syncedAt: null });
const pad = (n, w) => String(n).padStart(w, '0');

function isoDate(v) {
  if (typeof v === 'number') return new Date(Date.UTC(1899, 11, 30) + Math.round(v) * 86400000).toISOString().slice(0, 10);
  const s = String(v).trim();
  const fr = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  return fr ? `${fr[3]}-${fr[2].padStart(2, '0')}-${fr[1].padStart(2, '0')}` : s.slice(0, 10);
}
function hhmm(v) {
  if (typeof v === 'number') { const m = Math.round(v * 1440) % 1440; return `${pad(Math.floor(m / 60), 2)}:${pad(m % 60, 2)}`; }
  return String(v).trim();
}

const rows = lines
  .map((r) => ({
    date: isoDate(get(r, 'date')), lieu: norm(get(r, 'lieu')), espece: norm(get(r, 'espece')),
    pays: norm(get(r, 'pays')), continent: norm(get(r, 'continent')),
    nomScientifique: norm(get(r, 'nom scientifique')), remarques: norm(get(r, 'remarques')), heure: hhmm(get(r, 'heure')),
  }))
  .filter((r) => /^\d{4}-\d{2}-\d{2}$/.test(r.date) && r.lieu && r.espece)
  .sort((a, b) => (a.date + a.heure).localeCompare(b.date + b.heure));

const lieux = new Map(), balades = new Map(), observations = [];
const seen = new Set();
let doublons = 0;
for (const r of rows) {
  const continent = r.continent || continentOf(r.pays);
  if (!lieux.has(r.lieu)) lieux.set(r.lieu, { ...base(`seed-l-${pad(lieux.size + 1, 3)}`), nom: r.lieu, pays: r.pays, continent });
  const key = `${r.date}|${r.lieu}`;
  if (!balades.has(key)) balades.set(key, { ...base(`seed-b-${pad(balades.size + 1, 3)}`), date: r.date, lieu: r.lieu, pays: r.pays, continent, debut: null, fin: null });
  const b = balades.get(key);
  if (seen.has(`${b.id}|${r.espece}`)) { doublons++; continue; }
  seen.add(`${b.id}|${r.espece}`);
  observations.push({
    ...base(`seed-o-${pad(observations.length + 1, 4)}`),
    baladeId: b.id, espece: r.espece, nomScientifique: r.nomScientifique, remarques: r.remarques, heure: r.heure,
  });
}

const out = { lieux: [...lieux.values()], balades: [...balades.values()], observations };
writeFileSync(join(root, 'data/seed.json'), JSON.stringify(out));
console.log(`seed.json : ${out.lieux.length} lieux, ${out.balades.length} balades, ${out.observations.length} observations`
  + `, ${new Set(observations.map((o) => o.espece)).size} espèces${doublons ? ` (${doublons} doublons ignorés)` : ''}`);
const noContinent = out.lieux.filter((l) => !l.continent).map((l) => l.pays);
if (noContinent.length) console.warn('Pays sans continent connu :', [...new Set(noContinent)]);
