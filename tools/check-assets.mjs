// Vérifie que chaque fichier de l'appli est bien dans la liste ASSETS de sw.js
// (sinon il manquerait hors ligne) et que chaque entrée existe.
// Usage : node tools/check-assets.mjs
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const sw = readFileSync(join(root, 'sw.js'), 'utf8');
const listed = new Set([...sw.matchAll(/'\.\/([^']*)'/g)].map((m) => m[1]).filter(Boolean));

const walk = (dir) => readdirSync(dir).flatMap((f) => {
  const p = join(dir, f);
  return statSync(p).isDirectory() ? walk(p) : [relative(root, p).replace(/\\/g, '/')];
});
const app = [
  'index.html', 'manifest.webmanifest', 'data/seed.json',
  ...walk(join(root, 'css')), ...walk(join(root, 'icons')), ...walk(join(root, 'js')),
];

const missing = app.filter((f) => !listed.has(f));
const ghost = [...listed].filter((f) => !existsSync(join(root, f)));
if (missing.length) console.error('Absents de sw.js :', missing);
if (ghost.length) console.error('Listés dans sw.js mais introuvables :', ghost);
if (!missing.length && !ghost.length) console.log(`OK : ${listed.size} fichiers en cache.`);
process.exit(missing.length || ghost.length ? 1 : 0);
