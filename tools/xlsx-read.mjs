// Lecture minimale d'un .xlsx (première feuille) sans dépendance : ZIP + XML.
// Gère les textes en ligne (export de l'appli) et partagés (fichier réenregistré par Excel).
import { readFileSync } from 'node:fs';
import { inflateRawSync } from 'node:zlib';

function unzip(buf) {
  let eocd = buf.length - 22;
  while (eocd >= 0 && buf.readUInt32LE(eocd) !== 0x06054b50) eocd--;
  if (eocd < 0) throw new Error('Fichier .xlsx illisible');
  const count = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16);
  const files = {};
  for (let i = 0; i < count; i++) {
    const method = buf.readUInt16LE(p + 10);
    const size = buf.readUInt32LE(p + 20);
    const nameLen = buf.readUInt16LE(p + 28);
    const extraLen = buf.readUInt16LE(p + 30);
    const commentLen = buf.readUInt16LE(p + 32);
    const local = buf.readUInt32LE(p + 42);
    const name = buf.toString('utf8', p + 46, p + 46 + nameLen);
    const start = local + 30 + buf.readUInt16LE(local + 26) + buf.readUInt16LE(local + 28);
    const raw = buf.subarray(start, start + size);
    files[name] = (method === 8 ? inflateRawSync(raw) : raw).toString('utf8');
    p += 46 + nameLen + extraLen + commentLen;
  }
  return files;
}

const unescape = (s) => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
  .replace(/&apos;/g, "'").replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n)).replace(/&amp;/g, '&');
const texts = (xml) => [...xml.matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((m) => unescape(m[1])).join('');

// → tableau de lignes ; chaque ligne est un objet { A: valeur, B: valeur, … }.
export function readSheet(path) {
  const files = unzip(readFileSync(path));
  const shared = files['xl/sharedStrings.xml']
    ? [...files['xl/sharedStrings.xml'].matchAll(/<si>([\s\S]*?)<\/si>/g)].map((m) => texts(m[1]))
    : [];
  const sheet = files['xl/worksheets/sheet1.xml'];
  if (!sheet) throw new Error('Première feuille introuvable');
  const rows = [];
  for (const row of sheet.matchAll(/<row[^>]*>([\s\S]*?)<\/row>/g)) {
    const r = {};
    for (const c of row[1].matchAll(/<c r="([A-Z]+)\d+"([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const [, col, attrs, body = ''] = c;
      const type = attrs.match(/t="(\w+)"/)?.[1];
      const v = body.match(/<v>([\s\S]*?)<\/v>/)?.[1];
      if (type === 'inlineStr') r[col] = texts(body);
      else if (type === 's') r[col] = shared[+v] ?? '';
      else if (v != null) r[col] = type === 'str' ? unescape(v) : Number(v);
    }
    rows.push(r);
  }
  return rows;
}
