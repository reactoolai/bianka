/* Petits outils d'interface pour l'admin.
   Tout le contenu venant de la base passe par textContent (jamais innerHTML) : pas d'injection. */

export function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'style') el.style.cssText = v;
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (v === true) el.setAttribute(k, '');
    else el.setAttribute(k, v);
  }
  for (const c of children.flat()) {
    if (c == null || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return el;
}

const dtf = new Intl.DateTimeFormat('fr-CA', { dateStyle: 'medium', timeStyle: 'short' });
const df = new Intl.DateTimeFormat('fr-CA', { dateStyle: 'medium' });
export const fmtDateTime = (d) => (d ? dtf.format(new Date(d)) : '—');
export const fmtDate = (d) => (d ? df.format(new Date(d)) : '—');
export function fmtAgo(d) {
  const s = (Date.now() - new Date(d).getTime()) / 1000;
  if (s < 60) return 'à l’instant';
  if (s < 3600) return `il y a ${Math.floor(s / 60)} min`;
  if (s < 86400) return `il y a ${Math.floor(s / 3600)} h`;
  if (s < 86400 * 7) return `il y a ${Math.floor(s / 86400)} j`;
  return fmtDate(d);
}
// <input type="datetime-local"> ⇄ ISO
export function toLocalInput(iso) {
  if (!iso) return '';
  const d = new Date(iso); const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}
export const fromLocalInput = (v) => (v ? new Date(v).toISOString() : null);

export const NOTAIRES = { bianka: 'Me Villeneuve', alexandre: 'Me Demers-Bergeron', indifferent: 'Premier disponible' };

export const STATUTS_RDV = {
  nouveau: { label: 'Nouveau', tone: 'new' },
  a_rappeler: { label: 'À rappeler', tone: 'warn' },
  confirme: { label: 'Confirmé', tone: 'ok' },
  termine: { label: 'Terminé', tone: 'done' },
  annule: { label: 'Annulé', tone: 'off' },
};
export const STATUTS_MSG = {
  nouveau: { label: 'Nouveau', tone: 'new' },
  traite: { label: 'Traité', tone: 'ok' },
  archive: { label: 'Archivé', tone: 'off' },
};
export function chip(map, value) {
  const s = map[value] || { label: value, tone: 'off' };
  return h('span', { class: `chip chip--${s.tone}` }, s.label);
}

export function toast(msg) {
  let box = document.querySelector('.toasts');
  if (!box) { box = h('div', { class: 'toasts', role: 'status' }); document.body.append(box); }
  const t = h('div', { class: 'toast' }, msg);
  box.append(t);
  setTimeout(() => t.classList.add('is-out'), 3200);
  setTimeout(() => t.remove(), 3700);
}

export function drawer(title, content, { onClose } = {}) {
  closeDrawer();
  const panel = h('aside', { class: 'drawer', role: 'dialog', 'aria-modal': 'true', 'aria-label': title, tabindex: '-1' },
    h('header', { class: 'drawer__head' },
      h('h2', {}, title),
      h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Fermer', onclick: () => closeDrawer(onClose) }, '✕')),
    h('div', { class: 'drawer__body' }, content));
  const scrim = h('div', { class: 'scrim', onclick: () => closeDrawer(onClose) });
  document.body.append(scrim, panel);
  const onKey = (e) => { if (e.key === 'Escape') closeDrawer(onClose); };
  document.addEventListener('keydown', onKey);
  panel._off = () => document.removeEventListener('keydown', onKey);
  requestAnimationFrame(() => { panel.classList.add('is-open'); scrim.classList.add('is-open'); panel.focus(); });
  return panel;
}
export function closeDrawer(cb) {
  const p = document.querySelector('.drawer'); const s = document.querySelector('.scrim');
  if (!p) return;
  p._off?.(); p.remove(); s?.remove();
  cb?.();
}

export function downloadCsv(filename, rows, columns) {
  const esc = (v) => {
    const s = v == null ? '' : String(v);
    // évite l'injection de formules dans Excel
    const safe = /^[=+\-@]/.test(s) ? `'${s}` : s;
    return `"${safe.replace(/"/g, '""')}"`;
  };
  const lines = [columns.map((c) => esc(c.label)).join(';')]
    .concat(rows.map((r) => columns.map((c) => esc(c.get(r))).join(';')));
  const blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
  const a = h('a', { href: URL.createObjectURL(blob), download: filename });
  document.body.append(a); a.click(); a.remove();
}

export const plume = () => {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', '0 0 420 150'); svg.setAttribute('aria-hidden', 'true'); svg.setAttribute('class', 'brand__plume');
  svg.innerHTML = '<defs><linearGradient id="adm-plume-grad" x1="0" y1="0" x2="1" y2="0.25"><stop offset="0" stop-color="#D23A78"/><stop offset=".45" stop-color="#9E0D47"/><stop offset=".78" stop-color="#4A0820"/><stop offset="1" stop-color="#0E0A0C"/></linearGradient></defs>'
    + '<path fill="url(#adm-plume-grad)" d="M62 112 C70 86 92 62 128 46 L122 34 C150 28 182 26 214 32 L232 20 C236 30 238 34 240 38 C300 50 364 74 414 104 C384 98 352 96 320 97 L330 106 C300 104 270 104 240 105 L250 113 C204 112 160 112 120 113 C96 114 78 114 62 112 Z"/>'
    + '<path fill="none" stroke="#FBE3EC" stroke-opacity=".8" stroke-width="2" stroke-linecap="round" d="M66 111 C160 98 280 92 412 104"/>'
    + '<g transform="translate(64 112) rotate(158)"><path fill="#141114" stroke="#B49872" stroke-width="1.2" d="M0 -8 L44 -5 C50 -3 54 0 62 0 C54 0 50 3 44 5 L0 8 Z"/></g>';
  return svg;
};
