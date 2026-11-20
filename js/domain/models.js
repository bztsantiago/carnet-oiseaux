import { norm } from './normalize.js';

export const nowIso = () => new Date().toISOString();

export const uuid = () =>
  (crypto.randomUUID ? crypto.randomUUID() : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 3) | 8).toString(16);
  }));

// Champs communs, prévus pour la synchronisation future (Supabase) :
// identifiant créé sur l'appareil, dates de création / modification,
// suppression « douce » (deletedAt) et date du dernier envoi (syncedAt).
function base() {
  const t = nowIso();
  return { id: uuid(), createdAt: t, updatedAt: t, deletedAt: null, syncedAt: null };
}

export const touch = (record) => ({ ...record, updatedAt: nowIso() });

export function makeLieu({ nom, pays, continent }) {
  return { ...base(), nom: norm(nom), pays: norm(pays), continent: norm(continent) };
}

export function makeBalade({ date, lieu, pays, continent, debut = null, fin = null }) {
  return { ...base(), date, lieu: norm(lieu), pays: norm(pays), continent: norm(continent), debut, fin };
}

export function makeObservation({ baladeId, espece, nomScientifique = '', remarques = '', heure = '' }) {
  return {
    ...base(),
    baladeId,
    espece: norm(espece),
    nomScientifique: norm(nomScientifique),
    remarques: norm(remarques),
    heure,
  };
}

const pad = (n) => String(n).padStart(2, '0');
export const today = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
export const hhmm = (d = new Date()) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;

export const CONTINENTS = ['europe', 'asie', 'afrique', 'amerique du nord', 'amerique du sud', 'oceanie', 'antarctique'];

const E = 'europe', AS = 'asie', AF = 'afrique', AN = 'amerique du nord', ASU = 'amerique du sud', O = 'oceanie';
export const PAYS_CONTINENT = {
  france: E, belgique: E, suisse: E, 'pays-bas': E, italie: E, espagne: E, portugal: E, allemagne: E,
  luxembourg: E, 'royaume-uni': E, irlande: E, autriche: E, norvege: E, suede: E, finlande: E,
  danemark: E, islande: E, pologne: E, grece: E, croatie: E, slovenie: E, roumanie: E, hongrie: E,
  tchequie: E, slovaquie: E, bulgarie: E, estonie: E, lettonie: E, lituanie: E, malte: E, monaco: E,
  indonesie: AS, japon: AS, chine: AS, inde: AS, thailande: AS, vietnam: AS, malaisie: AS,
  philippines: AS, cambodge: AS, laos: AS, 'sri lanka': AS, nepal: AS, turquie: AS, israel: AS,
  jordanie: AS, oman: AS, 'emirats arabes unis': AS, 'coree du sud': AS, mongolie: AS, singapour: AS,
  maroc: AF, tunisie: AF, algerie: AF, senegal: AF, kenya: AF, tanzanie: AF, 'afrique du sud': AF,
  madagascar: AF, egypte: AF, namibie: AF, botswana: AF, ouganda: AF, ethiopie: AF, gambie: AF,
  canada: AN, 'etats-unis': AN, mexique: AN, 'costa rica': AN, panama: AN, guatemala: AN, cuba: AN,
  bresil: ASU, argentine: ASU, chili: ASU, perou: ASU, colombie: ASU, equateur: ASU, bolivie: ASU,
  guyane: ASU, venezuela: ASU, uruguay: ASU, paraguay: ASU,
  australie: O, 'nouvelle-zelande': O, 'nouvelle-caledonie': O, 'polynesie francaise': O,
};
export const continentOf = (pays) => PAYS_CONTINENT[norm(pays)] || '';
