// Règle unique de stockage : minuscules, sans accents, espaces propres.
// Toute donnée texte passe par norm() avant d'être enregistrée.
export function norm(value) {
  if (value == null) return '';
  return String(value)
    .replace(/œ/gi, 'oe')
    .replace(/æ/gi, 'ae')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[’‘`´]/g, "'")
    .toLowerCase()
    .replace(/\s*-\s*/g, '-')
    .replace(/\s+/g, ' ')
    .trim();
}
