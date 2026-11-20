// Navigation par ancre (#/…) : fonctionne hors ligne et sur GitHub Pages.
import { h } from './ui/components.js';

const routes = [];
let cleanups = [];
let running = 0;

export function route(pattern, render, tab) { routes.push({ pattern, render, tab }); }

// Une fonction à appeler quand on quitte l'écran (minuteurs, observateurs…).
export function onLeave(fn) { cleanups.push(fn); }

export function go(hash) {
  if (location.hash === hash) run(); else location.hash = hash;
}

export async function run() {
  const ticket = ++running;
  cleanups.forEach((fn) => { try { fn(); } catch { /* ignore */ } });
  cleanups = [];
  const hash = location.hash || '#/';
  const main = document.getElementById('app');
  for (const r of routes) {
    const m = hash.match(r.pattern);
    if (!m) continue;
    document.querySelectorAll('.tabs a').forEach((a) => a.classList.toggle('on', a.dataset.tab === r.tab));
    const frag = document.createElement('div');
    try {
      await r.render(frag, ...m.slice(1).map(decodeURIComponent));
    } catch (err) {
      console.error(err);
      frag.replaceChildren(h('h1', {}, 'Oups'), h('p', {}, `Cet écran n'a pas pu s'afficher : ${err.message}`));
    }
    if (ticket !== running) return; // une autre navigation a eu lieu entre-temps
    main.replaceChildren(...frag.childNodes);
    window.scrollTo(0, 0);
    return;
  }
  location.hash = '#/';
}

export function start() {
  window.addEventListener('hashchange', run);
  run();
}
