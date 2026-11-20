// Petits outils d'interface, sans framework.

// h('button', {class: 'btn', onclick}, 'Texte') → élément DOM.
export function h(tag, attrs, ...children) {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs || {})) {
    if (value == null || value === false) continue;
    if (key.startsWith('on') && typeof value === 'function') el.addEventListener(key.slice(2), value);
    else if (key === 'class') el.className = value;
    else if (typeof value === 'boolean') el[key] = value;
    else el.setAttribute(key, value);
  }
  for (const child of children.flat()) {
    if (child == null || child === false) continue;
    el.append(child.nodeType ? child : document.createTextNode(String(child)));
  }
  return el;
}

let toastTimer;
export function toast(message, { action, onAction, duration = 4500 } = {}) {
  const box = document.getElementById('toast');
  box.replaceChildren(h('span', {}, message));
  if (action) {
    box.append(h('button', {
      class: 'toast-btn', type: 'button',
      onclick: () => { box.hidden = true; clearTimeout(toastTimer); onAction(); },
    }, action));
  }
  box.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { box.hidden = true; }, duration);
}

export function confirmDialog(message, okLabel = 'Confirmer', { danger = false } = {}) {
  return new Promise((resolve) => {
    const d = document.getElementById('dialog');
    const close = (v) => { d.close(); resolve(v); };
    d.replaceChildren(
      h('p', {}, message),
      h('div', { class: 'row' },
        h('button', { class: 'btn btn-ghost', type: 'button', onclick: () => close(false) }, 'Annuler'),
        h('button', { class: danger ? 'btn btn-danger' : 'btn', type: 'button', onclick: () => close(true) }, okLabel)),
    );
    d.onclose = () => resolve(false);
    d.showModal();
  });
}

export function field(label, control) {
  return h('label', { class: 'field' }, label, control);
}

export function fmtDate(isoDate, opts = { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' }) {
  const [y, m, d] = isoDate.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('fr-FR', opts);
}

export function fmtTime(isoDateTime) {
  return new Date(isoDateTime).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

export const plural = (n, one, many) => `${n} ${n > 1 ? many : one}`;

export function vibrate() {
  try { navigator.vibrate?.(25); } catch { /* non disponible */ }
}
