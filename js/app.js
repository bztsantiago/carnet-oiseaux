// Démarrage : base locale, import initial, navigation, mode hors ligne.
import { route, start } from './router.js';
import { ensureSeed } from './db/seed.js';
import { h, toast } from './ui/components.js';
import * as walk from './screens/walk.js';
import * as startScreen from './screens/start.js';
import * as history from './screens/history.js';
import * as balade from './screens/balade.js';
import * as lieux from './screens/lieux.js';
import * as exportScreen from './screens/export.js';

route(/^#\/?$/, walk.render, 'balade');
route(/^#\/demarrer$/, startScreen.render, 'balade');
route(/^#\/historique$/, history.render, 'historique');
route(/^#\/balade\/([^/]+)$/, balade.render, 'historique');
route(/^#\/lieux$/, lieux.render, 'lieux');
route(/^#\/exporter$/, exportScreen.render, 'exporter');

// Masque les onglets quand le clavier est ouvert, pour garder la place au panneau d'ajout.
const isText = (el) => el && (el.tagName === 'INPUT' && !['date', 'checkbox', 'radio', 'button', 'submit'].includes(el.type));
document.addEventListener('focusin', (e) => { if (isText(e.target)) document.body.classList.add('kbd'); });
document.addEventListener('focusout', () => setTimeout(() => {
  if (!isText(document.activeElement)) document.body.classList.remove('kbd');
}, 50));

function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  const hadController = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.register('./sw.js').catch((err) => console.warn('Service worker non enregistré', err));
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (hadController) toast('Nouvelle version installée.', { action: 'Recharger', onAction: () => location.reload(), duration: 15000 });
  });
}

(async function boot() {
  const main = document.getElementById('app');
  try {
    const imported = await ensureSeed();
    start();
    if (imported) toast('Tes observations historiques ont été importées.');
  } catch (err) {
    console.error(err);
    main.replaceChildren(h('h1', {}, 'Impossible de démarrer'), h('p', {}, err.message));
  }
  registerServiceWorker();
})();
