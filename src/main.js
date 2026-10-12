import './style.css';

const CONFIG = { autoplay: true, slideDelay: 6500 };
const CAPTIONS = ['Le bureau \u00b7 401, avenue Du Pont Nord', 'Me Villeneuve & Me Demers-Bergeron', 'L\u2019\u00e9quipe du bureau'];
const EASE = 'cubic-bezier(.3,1,.4,1)';

const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const ref = (n) => document.querySelector(`[data-ref="${n}"]`);
const rootStyle = document.documentElement.style;

const state = { slide: 0, prev: 2, scrolled: false, menu: false, sent: false, narrow: false };
let pending = [];
let timer = null;

function vals() {
  const { slide, prev, scrolled, menu, sent, narrow } = state;
  const v = {
    navBg: scrolled || menu ? 'rgba(245,240,230,.93)' : 'rgba(245,240,230,0)',
    navLine: scrolled ? 'rgba(35,37,48,.08)' : 'rgba(35,37,48,0)',
    navPad: scrolled ? '16px clamp(20px,4vw,56px)' : '22px clamp(20px,4vw,56px)',
    wide: !narrow, narrow, menuOpen: narrow && menu, menuLabel: menu ? 'Fermer' : 'Menu',
    heroCols: narrow ? 'minmax(0,1fr)' : 'minmax(0,1.1fr) minmax(0,0.9fr)',
    slideCaption: CAPTIONS[slide],
    notSent: !sent, sent,
  };
  for (let i = 0; i < 3; i++) {
    const act = slide === i, pv = prev === i && !act;
    v['z' + i] = act ? 2 : pv ? 1 : 0;
    v['c' + i] = act || pv ? 'inset(0 0 0 0)' : 'inset(100% 0 0 0)';
    v['ct' + i] = act ? 'clip-path 1.4s cubic-bezier(.76,0,.24,1)' : 'none';
    v['s' + i] = act ? 1 : 1.1;
    v['o' + i] = act ? 1 : 0.3;
    v['w' + i] = act ? '32px' : '10px';
  }
  return v;
}

function render() {
  const v = vals();
  for (const [k, val] of Object.entries(v)) if (typeof val !== 'boolean') rootStyle.setProperty('--' + k, String(val));
  $$('[data-if]').forEach((el) => { el.style.display = v[el.dataset.if] ? 'contents' : 'none'; });
  $$('[data-text]').forEach((el) => { el.textContent = v[el.dataset.text]; });
}

function setState(patch) { Object.assign(state, patch); render(); }

function startTimer() {
  clearInterval(timer);
  if (CONFIG.autoplay && document.querySelector('.hero-slides')) {
    timer = setInterval(() => setState({ prev: state.slide, slide: (state.slide + 1) % 3 }), CONFIG.slideDelay);
  }
}
function goSlide(i) { if (i !== state.slide) { setState({ prev: state.slide, slide: i }); startTimer(); } }

function setupReveal() {
  pending = pending.filter((el) => el.isConnected);
  $$('[data-reveal]').forEach((el) => {
    if (el._rv) return;
    el._rv = 'pending';
    const d = +(el.dataset.delay || 0), t = el.dataset.reveal;
    el.style.transition = 'none';
    if (t === 'img') {
      el.style.clipPath = 'inset(100% 0 0 0)';
      const im = el.querySelector('img');
      if (im) { im.style.scale = '1.15'; if (!im._tr) { im._tr = true; im.style.transition = `scale 1.6s ${EASE} ${d}ms`; } }
      el._tr = `clip-path 1.3s ${EASE} ${d}ms`;
    } else if (t === 'mask') {
      el.style.transform = 'translateY(105%)';
      el._tr = `transform 1.05s ${EASE} ${d}ms`;
    } else {
      el.style.opacity = '0'; el.style.transform = 'translateY(24px)';
      el._tr = `opacity .9s ${EASE} ${d}ms, transform .9s ${EASE} ${d}ms`;
    }
    pending.push(el);
  });
  requestAnimationFrame(() => requestAnimationFrame(checkReveal));
}
function showEl(el) {
  el.style.transition = el._tr || '';
  if (el.dataset.reveal === 'img') { el.style.clipPath = 'inset(0 0 0 0)'; const im = el.querySelector('img'); if (im) im.style.scale = '1'; }
  else { el.style.opacity = '1'; el.style.transform = 'none'; }
  if (el.hasAttribute('data-count')) count(el);
  $$('[data-count]', el).forEach(count);
  el._rv = 'done';
}
function checkReveal() {
  if (!pending.length) return;
  const vh = window.innerHeight;
  pending = pending.filter((el) => {
    if (!el.isConnected) return false;
    if (!el.getClientRects().length) return true;
    const t = el.dataset.reveal;
    const target = (t === 'img' || t === 'mask') && el.parentElement ? el.parentElement : el;
    if (target.getBoundingClientRect().top < vh * 0.92) { showEl(el); return false; }
    return true;
  });
}
function count(el) {
  if (el._counted) return; el._counted = true;
  const end = +el.dataset.count, t0 = performance.now();
  const step = (t) => { const p = Math.min(1, (t - t0) / 1600); el.textContent = Math.round(end * (1 - Math.pow(1 - p, 4))); if (p < 1) requestAnimationFrame(step); };
  requestAnimationFrame(step);
}

function tick() {
  const y = window.scrollY, vh = window.innerHeight;
  const cw = document.documentElement.clientWidth || window.innerWidth;
  const n = cw < 980;
  if (n !== state.narrow) { setState({ narrow: n, menu: n ? state.menu : false }); return; }
  const sc = y > 30; if (sc !== state.scrolled) setState({ scrolled: sc });
  checkReveal();
  const ir = ref('introRef'), f = ref('fillRef');
  if (ir && f) { const r = ir.getBoundingClientRect(); const pr = Math.min(1, Math.max(0, (vh * 0.85 - r.top) / (r.height + vh * 0.25))); f.style.backgroundSize = `${(pr * 100).toFixed(1)}% 100%, 100% 100%`; }
}

const actions = {
  toggleMenu: () => setState({ menu: !state.menu }),
  toTop: (e) => { e.preventDefault(); window.scrollTo({ top: 0, behavior: 'smooth' }); },
  go0: () => goSlide(0), go1: () => goSlide(1), go2: () => goSlide(2),
};

document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-action]');
  if (el && actions[el.dataset.action]) actions[el.dataset.action](e);
});

document.addEventListener('click', (e) => {
  const a = e.target.closest('a[href^="#"]:not([data-action])');
  if (a && a.getAttribute('href').length > 1) {
    const id = a.getAttribute('href').slice(1);
    const el = document.getElementById(id);
    if (el) { e.preventDefault(); window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 60, behavior: 'smooth' }); }
  }
});

$$('[data-submit]').forEach((f) => f.addEventListener('submit', (e) => {
  e.preventDefault();
  setState({ sent: true });
}));

let raf = null;
window.addEventListener('scroll', () => { if (raf) return; raf = requestAnimationFrame(() => { raf = null; tick(); }); }, { passive: true });
window.addEventListener('resize', tick);

render();
tick();
startTimer();
setupReveal();
if (document.fonts) document.fonts.ready.then(tick);
window.addEventListener('load', tick);
