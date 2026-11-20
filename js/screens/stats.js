// Onglet « Stats » : graphiques calculés à la demande.
// Le calcul se fait sur le téléphone (aucune connexion). Le résultat est gardé dans la
// base (meta « statsSnapshot ») et n'est refait que sur le bouton « Actualiser ».
import { h, toast, fmtDate, fmtTime, plural } from '../ui/components.js';
import * as repo from '../db/repo.js';
import { accumulation, frequenceEspeces, diversiteParMois, bilanParLieu } from '../services/stats.js';

const KEY = 'statsSnapshot';
const SVG = 'http://www.w3.org/2000/svg';
const MOIS_LONG = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
const MOIS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];

async function compute() {
  const balades = await repo.balades();
  const obs = await repo.allObservations();
  const freq = frequenceEspeces(balades, obs);
  const horsEurope = [...new Set(balades.filter((b) => b.continent && b.continent !== 'europe').map((b) => b.pays))];
  return {
    at: new Date().toISOString(),
    counts: {
      balades: balades.length, observations: obs.length, especes: freq.length,
      lieux: new Set(balades.map((b) => b.lieu)).size,
      uneFois: freq.filter((f) => f.balades === 1).length,
    },
    accum: accumulation(balades, obs).map((a) => ({ d: a.date, l: a.lieu, c: a.cumul, n: a.nouvelles })),
    top: freq.slice(0, 15).map((f) => ({ e: f.espece, b: f.balades, t: f.taux })),
    mois: diversiteParMois(balades, obs, { exclurePays: horsEurope }).map((m) => ({ b: m.balades, e: m.especes })),
    horsEurope,
    lieux: bilanParLieu(balades, obs).slice(0, 10).map((l) => ({ l: l.lieu, p: l.pays, e: l.especes, b: l.balades })),
  };
}

export async function render(main) {
  const body = h('div', { class: 'stats' });
  const status = h('p', { class: 'muted small' });
  const btn = h('button', { class: 'btn', type: 'button' }, 'Actualiser les statistiques');

  async function show(snap) {
    const obsNow = (await repo.allObservations()).length;
    const balNow = (await repo.balades()).length;
    if (!snap) {
      status.textContent = 'Pas encore calculées.';
      body.replaceChildren(h('p', { class: 'card' }, 'Touche « Actualiser les statistiques » pour calculer les graphiques à partir de toutes tes balades.'));
      return;
    }
    const stale = snap.counts.observations !== obsNow || snap.counts.balades !== balNow;
    status.replaceChildren(
      `Calculées le ${fmtDate(snap.at.slice(0, 10), { day: 'numeric', month: 'long', year: 'numeric' })} à ${fmtTime(snap.at)}`,
      ...(stale ? [h('span', { class: 'badge badge-amber stale' }, 'nouvelles données')] : []),
    );
    body.replaceChildren(...view(snap));
  }

  btn.addEventListener('click', async () => {
    btn.disabled = true;
    try {
      const snap = await compute();
      await repo.setMeta(KEY, snap);
      await show(snap);
      toast('Statistiques à jour');
    } catch (err) {
      toast(err.message);
    } finally {
      btn.disabled = false;
    }
  });

  main.append(h('h1', {}, 'Statistiques'), status, btn, body);
  await show(await repo.getMeta(KEY));
}

function view(s) {
  const c = s.counts;
  const tile = (n, label) => h('div', { class: 'tile' }, h('b', {}, n.toLocaleString('fr-FR')), h('span', {}, label));
  const moisMax = Math.max(1, ...s.mois.map((m) => m.e));
  const best = s.mois.reduce((a, m, i) => (m.e > s.mois[a].e ? i : a), 0);
  return [
    h('div', { class: 'tiles' }, tile(c.especes, 'espèces'), tile(c.balades, 'balades'), tile(c.lieux, 'lieux')),

    section('Espèces découvertes au fil du temps',
      `Nombre total d’espèces différentes vues depuis la première balade. Touche la courbe pour le détail.`,
      accumChart(s.accum)),

    section('Les espèces les plus fréquentes',
      `Part des ${c.balades} balades où l’espèce a été notée.`,
      bars(s.top.map((t) => ({ label: t.e, value: t.t, text: `${String(t.t).replace('.', ',')} %`, title: plural(t.b, 'balade', 'balades') })), 100)),

    section('Diversité selon le mois',
      `Espèces différentes vues chaque mois, toutes années confondues${s.horsEurope.length ? ` (balades en Europe seulement, sans ${s.horsEurope.join(', ')})` : ''}. Le meilleur mois : ${MOIS_LONG[best]}.`,
      h('div', { class: 'cols', role: 'img', 'aria-label': s.mois.map((m, i) => `${MOIS[i]} ${m.e}`).join(', ') },
        ...s.mois.map((m, i) => h('div', { class: 'col', title: `${MOIS[i]} : ${plural(m.e, 'espèce', 'espèces')}, ${plural(m.b, 'balade', 'balades')}` },
          h('span', { class: 'col-val' }, m.b ? String(m.e) : '–'),
          h('span', { class: 'col-track' }, h('span', { class: 'col-fill', style: `height:${(m.e / moisMax) * 100}%` })),
          h('span', { class: 'col-lab' }, MOIS[i].slice(0, 1).toUpperCase()))))),

    section('Les lieux les plus riches',
      'Espèces différentes vues à chaque lieu (10 premiers).',
      bars(s.lieux.map((l) => ({ label: l.l, sub: `${l.p} · ${plural(l.b, 'balade', 'balades')}`, value: l.e, text: String(l.e) })))),

    h('p', { class: 'muted small' }, `${plural(c.uneFois, 'espèce n’a été vue', 'espèces n’ont été vues')} qu’une seule fois. ${c.observations.toLocaleString('fr-FR')} observations au total.`),
  ];
}

function section(title, caption, content) {
  return h('section', { class: 'chart' }, h('h2', {}, title), h('p', { class: 'muted small' }, caption), content);
}

// Barres horizontales avec la valeur écrite au bout.
function bars(rows, max = Math.max(1, ...rows.map((r) => r.value))) {
  return h('ul', { class: 'bars' }, ...rows.map((r) => h('li', { class: 'bar-row', title: r.title || null },
    h('span', { class: 'bar-label' }, h('span', { class: 'name' }, r.label), r.sub ? h('small', {}, r.sub) : null),
    h('span', { class: 'bar-track' }, h('span', { class: 'bar-fill', style: `width:${Math.max(1.5, (r.value / max) * 100)}%` })),
    h('span', { class: 'bar-val' }, r.text))));
}

// Courbe d'accumulation des espèces, axe des dates, détail au toucher.
function accumChart(points) {
  if (points.length < 2) return h('p', { class: 'muted' }, 'Il faut au moins deux balades.');
  const W = 340, H = 190, L = 34, R = 14, T = 12, B = 24;
  const t = (d) => Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10));
  const t0 = t(points[0].d), t1 = t(points.at(-1).d);
  const yMax = niceMax(points.at(-1).c);
  const x = (d) => L + ((t(d) - t0) / Math.max(1, t1 - t0)) * (W - L - R);
  const y = (v) => T + (1 - v / yMax) * (H - T - B);
  const el = (tag, attrs, text) => {
    const n = document.createElementNS(SVG, tag);
    Object.entries(attrs).forEach(([k, v]) => n.setAttribute(k, v));
    if (text != null) n.textContent = text;
    return n;
  };

  const svg = el('svg', { viewBox: `0 0 ${W} ${H}`, class: 'line-chart', role: 'img',
    'aria-label': `De ${points[0].c} à ${points.at(-1).c} espèces entre ${points[0].d} et ${points.at(-1).d}` });
  const step = yMax / 4;
  for (let v = 0; v <= yMax; v += step) {
    svg.append(el('line', { x1: L, x2: W - R, y1: y(v), y2: y(v), class: v ? 'grid' : 'axis' }));
    svg.append(el('text', { x: L - 6, y: y(v) + 4, 'text-anchor': 'end', class: 'tick' }, String(v)));
  }
  const y0 = +points[0].d.slice(0, 4), y1 = +points.at(-1).d.slice(0, 4);
  for (let yr = y0 + 1; yr <= y1; yr++) {
    const xx = x(`${yr}-01-01`);
    svg.append(el('line', { x1: xx, x2: xx, y1: H - B, y2: H - B + 4, class: 'axis' }));
    svg.append(el('text', { x: xx, y: H - 6, 'text-anchor': 'middle', class: 'tick' }, String(yr)));
  }
  // Escalier : le total ne change qu'à chaque balade.
  let d = `M${x(points[0].d)},${y(points[0].c)}`;
  points.slice(1).forEach((p) => { d += `H${x(p.d)}V${y(p.c)}`; });
  svg.append(el('path', { d: `${d}V${y(0)}H${x(points[0].d)}Z`, class: 'area' }));
  svg.append(el('path', { d, class: 'line' }));
  const last = points.at(-1);
  svg.append(el('text', { x: x(last.d) - 4, y: y(last.c) - 6, 'text-anchor': 'end', class: 'end-label' }, `${last.c} espèces`));

  const cross = el('line', { y1: T, y2: H - B, class: 'cross', visibility: 'hidden' });
  const dot = el('circle', { r: 4.5, class: 'dot', visibility: 'hidden' });
  svg.append(cross, dot);
  const readout = h('p', { class: 'readout small' }, 'Touche la courbe pour voir une balade.');

  const pick = (ev) => {
    const box = svg.getBoundingClientRect();
    const px = ((ev.clientX - box.left) / box.width) * W;
    let best = points[0];
    for (const p of points) if (Math.abs(x(p.d) - px) < Math.abs(x(best.d) - px)) best = p;
    const bx = x(best.d), by = y(best.c);
    cross.setAttribute('x1', bx); cross.setAttribute('x2', bx);
    dot.setAttribute('cx', bx); dot.setAttribute('cy', by);
    cross.setAttribute('visibility', 'visible'); dot.setAttribute('visibility', 'visible');
    readout.replaceChildren(
      h('b', {}, fmtDate(best.d, { day: 'numeric', month: 'short', year: 'numeric' })), ' · ',
      h('span', { class: 'name' }, best.l), ` · ${best.c} espèces`,
      ...(best.n ? [h('span', { class: 'badge' }, `+${best.n} nouvelle${best.n > 1 ? 's' : ''}`)] : []));
  };
  svg.addEventListener('pointerdown', pick);
  svg.addEventListener('pointermove', (ev) => { if (ev.pointerType === 'mouse' || ev.buttons) pick(ev); });

  return h('div', { class: 'line-wrap' }, svg, readout);
}

function niceMax(v) {
  const steps = [20, 40, 60, 80, 100, 120, 160, 200, 240, 300, 400, 500, 600, 800, 1000];
  return steps.find((s) => s >= v) || Math.ceil(v / 200) * 200;
}
