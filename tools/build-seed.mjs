// Régénère data/seed.json à partir d'un CSV « date,lieu,pays,espece,entendu ».
// Usage : node tools/build-seed.mjs data/source/observations_nettoyees.csv
// Pensez ensuite à augmenter SEED_VERSION dans js/db/seed.js et VERSION dans sw.js.
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { norm } from '../js/domain/normalize.js';
import { continentOf } from '../js/domain/models.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = process.argv[2] || join(root, 'data/source/observations_nettoyees.csv');
const STAMP = '2026-11-20T00:00:00.000Z';

function parseCsv(text) {
  const rows = [];
  let row = [], cell = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') { row.push(cell); cell = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(cell); rows.push(row); row = []; cell = '';
    } else cell += ch;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows.filter((r) => r.some((c) => c !== ''));
}

const [header, ...lines] = parseCsv(readFileSync(src, 'utf8'));
const col = Object.fromEntries(header.map((h, i) => [norm(h), i]));
const base = (id) => ({ id, createdAt: STAMP, updatedAt: STAMP, deletedAt: null, syncedAt: null });
const pad = (n, w) => String(n).padStart(w, '0');

const lieux = new Map(), balades = new Map(), observations = [];
const seen = new Set();
for (const r of lines) {
  const date = r[col.date].trim();
  const lieu = norm(r[col.lieu]);
  const pays = norm(r[col.pays]);
  const espece = norm(r[col.espece]);
  if (!date || !lieu || !espece) continue;
  const continent = continentOf(pays);
  if (!lieux.has(lieu)) lieux.set(lieu, { ...base(`seed-l-${pad(lieux.size + 1, 3)}`), nom: lieu, pays, continent });
  const key = `${date}|${lieu}`;
  if (!balades.has(key)) balades.set(key, { ...base(`seed-b-${pad(balades.size + 1, 3)}`), date, lieu, pays, continent, debut: null, fin: null });
  const b = balades.get(key);
  if (seen.has(`${b.id}|${espece}`)) continue;
  seen.add(`${b.id}|${espece}`);
  observations.push({
    ...base(`seed-o-${pad(observations.length + 1, 4)}`),
    baladeId: b.id, espece, nomScientifique: '',
    remarques: norm(r[col.entendu]) === 'oui' ? 'entendu' : '', heure: '',
  });
}

const out = { version: 1, lieux: [...lieux.values()], balades: [...balades.values()], observations };
writeFileSync(join(root, 'data/seed.json'), JSON.stringify(out));
console.log(`seed.json : ${out.lieux.length} lieux, ${out.balades.length} balades, ${out.observations.length} observations`);
const noContinent = out.lieux.filter((l) => !l.continent).map((l) => l.pays);
if (noContinent.length) console.warn('Pays sans continent connu :', [...new Set(noContinent)]);
