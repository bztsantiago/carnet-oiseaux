// Accès bas niveau à IndexedDB. Les migrations sont versionnées :
// pour faire évoluer le schéma, augmenter DB_VERSION et ajouter un bloc
// `if (oldVersion < N)` dans onupgradeneeded.
const DB_NAME = 'carnet-oiseaux';
const DB_VERSION = 1;

let dbPromise;

export function openDB() {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = (event) => {
        const db = request.result;
        const oldVersion = event.oldVersion;
        if (oldVersion < 1) {
          const balades = db.createObjectStore('balades', { keyPath: 'id' });
          balades.createIndex('date', 'date');
          const obs = db.createObjectStore('observations', { keyPath: 'id' });
          obs.createIndex('baladeId', 'baladeId');
          const lieux = db.createObjectStore('lieux', { keyPath: 'id' });
          lieux.createIndex('nom', 'nom', { unique: true });
          db.createObjectStore('meta', { keyPath: 'key' });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }
  return dbPromise;
}

export function req(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// Exécute fn(transaction) et résout quand la transaction est validée.
export async function tx(stores, mode, fn) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const t = db.transaction(stores, mode);
    let result;
    Promise.resolve(fn(t)).then((v) => { result = v; }, (err) => { try { t.abort(); } catch { /* déjà terminée */ } reject(err); });
    t.oncomplete = () => resolve(result);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error || new Error('Enregistrement annulé'));
  });
}
