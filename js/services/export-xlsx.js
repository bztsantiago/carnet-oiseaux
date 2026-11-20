// Export Excel : toutes les balades, une ligne par observation,
// mêmes colonnes que le classeur d'origine (+ l'heure en fin de ligne).
import { writeXlsx, excelDate } from '../lib/xlsx-writer.js';

export const COLUMNS = [
  { header: 'Date', type: 'date', width: 12 },
  { header: 'Lieu', width: 32 },
  { header: 'Espèce', width: 28 },
  { header: 'Pays', width: 14 },
  { header: 'Nom scientifique', width: 22 },
  { header: 'Remarques', width: 14 },
  { header: 'Continent', width: 16 },
  { header: 'Heure', width: 8 },
];

// Fonction pure : balades + observations → lignes du tableur.
export function buildRows(balades, observations) {
  const byId = new Map(balades.filter((b) => !b.deletedAt).map((b) => [b.id, b]));
  return observations
    .filter((o) => !o.deletedAt && byId.has(o.baladeId))
    .map((o) => ({ o, b: byId.get(o.baladeId) }))
    .sort((x, y) => x.b.date.localeCompare(y.b.date)
      || (x.b.debut || '').localeCompare(y.b.debut || '')
      || x.b.lieu.localeCompare(y.b.lieu)
      || x.o.createdAt.localeCompare(y.o.createdAt)
      || x.o.id.localeCompare(y.o.id))
    .map(({ o, b }) => [excelDate(b.date), b.lieu, o.espece, b.pays, o.nomScientifique, o.remarques, b.continent, o.heure]);
}

export function buildWorkbook(balades, observations) {
  const rows = buildRows(balades, observations);
  return { blob: writeXlsx({ sheetName: 'Données', columns: COLUMNS, rows }), count: rows.length };
}
