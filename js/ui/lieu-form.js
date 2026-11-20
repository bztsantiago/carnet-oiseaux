// Champs « pays » et « continent » d'un nouveau lieu, partagés par
// l'écran Démarrer et l'écran Lieux. Le continent se remplit tout seul
// pour les pays connus.
import { h, field } from './components.js';
import { CONTINENTS, PAYS_CONTINENT, continentOf } from '../domain/models.js';

export function lieuExtraFields(existingPays = [], idPrefix = 'nouveau') {
  const options = [...new Set([...existingPays, ...Object.keys(PAYS_CONTINENT)])].sort();
  const listId = `${idPrefix}-pays-liste`;
  const pays = h('input', { id: `${idPrefix}-pays`, list: listId, autocomplete: 'off', autocapitalize: 'off', spellcheck: 'false', placeholder: 'ex. france' });
  const datalist = h('datalist', { id: listId }, ...options.map((p) => h('option', { value: p })));
  const continent = h('select', { id: `${idPrefix}-continent` },
    h('option', { value: '' }, '—'), ...CONTINENTS.map((c) => h('option', { value: c }, c)));
  pays.addEventListener('input', () => { const c = continentOf(pays.value); if (c) continent.value = c; });
  return {
    pays, continent,
    elements: [field('Pays', pays), datalist, field('Continent', continent)],
  };
}
