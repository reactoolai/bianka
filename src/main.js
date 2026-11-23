import './style.css';
import { initForms } from './forms.js';

document.documentElement.classList.add('js');

// Menu mobile
const toggle = document.querySelector('[data-menu-toggle]');
const nav = document.getElementById('menu-principal');
if (toggle && nav) {
  toggle.addEventListener('click', () => {
    const open = toggle.getAttribute('aria-expanded') === 'true';
    toggle.setAttribute('aria-expanded', String(!open));
    nav.classList.toggle('is-open', !open);
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && nav.classList.contains('is-open')) {
      toggle.setAttribute('aria-expanded', 'false');
      nav.classList.remove('is-open');
      toggle.focus();
    }
  });
}

// Apparition au défilement
const items = document.querySelectorAll('[data-reveal]');
if ('IntersectionObserver' in window) {
  const io = new IntersectionObserver((entries) => {
    entries.forEach((en) => {
      if (en.isIntersecting) { en.target.classList.add('is-in'); io.unobserve(en.target); }
    });
  }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
  items.forEach((el) => io.observe(el));
} else {
  items.forEach((el) => el.classList.add('is-in'));
}

// FAQ : filtres par sujet
const faq = document.querySelector('[data-faq]');
const filters = document.querySelector('[data-faq-filters]');
if (faq && filters) {
  const all = [...faq.querySelectorAll('details')];
  const cats = ['Tout', ...new Set(all.map((d) => d.dataset.cat))];
  cats.forEach((c) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.setAttribute('aria-pressed', String(c === 'Tout'));
    const n = c === 'Tout' ? all.length : all.filter((d) => d.dataset.cat === c).length;
    b.innerHTML = `${c} <span>${n}</span>`;
    b.addEventListener('click', () => {
      filters.querySelectorAll('button').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
      all.forEach((d) => { d.hidden = c !== 'Tout' && d.dataset.cat !== c; });
    });
    filters.appendChild(b);
  });
}

// Année courante
document.querySelectorAll('[data-year]').forEach((el) => { el.textContent = new Date().getFullYear(); });

initForms();

// Carte (page Contact) : Leaflet chargé seulement à l'approche de la carte
const mapEl = document.querySelector('[data-map]');
if (mapEl) {
  const load = () => import('./map.js').then((m) => m.initMap(mapEl));
  if ('IntersectionObserver' in window) {
    const mo = new IntersectionObserver((en) => { if (en[0].isIntersecting) { mo.disconnect(); load(); } }, { rootMargin: '400px' });
    mo.observe(mapEl);
  } else load();
}
