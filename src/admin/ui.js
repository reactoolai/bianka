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
  svg.setAttribute('viewBox', '0 0 220 640'); svg.setAttribute('aria-hidden', 'true');
  svg.innerHTML = '<g transform="rotate(18 110 320)" fill="none" stroke-linecap="round"><path fill="#A8904C" d="M101 500 C46 452 26 330 52 222 C70 146 108 72 150 14 C182 92 196 196 176 306 C162 384 136 448 104 492 Z"/><path stroke="#2E2B25" stroke-width="9" d="M101 495 C103 380 110 250 150 14 M50 356 l34 -10 M174 232 l-34 16 M168 328 l-28 12"/><path stroke="#A8904C" stroke-width="10" d="M96 632 C97 580 99 540 101 495"/></g>';
  return svg;
};
