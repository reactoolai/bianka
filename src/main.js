import './style.css';

const CONFIG = { autoplay: true, slideDelay: 6000 };
const CAPTIONS = ['Le bureau · 401, avenue Du Pont Nord', 'Me Villeneuve & Me Demers-Bergeron', 'L\u2019\u00e9quipe du bureau'];
const EASE = 'cubic-bezier(.22,1,.36,1)';

const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const ref = (n) => document.querySelector(`[data-ref="${n}"]`);
const rootStyle = document.documentElement.style;

const state = { page: 'accueil', slide: 0, prev: 2, scrolled: false, menu: false, sent: false, narrow: false, stack: false, curtain: 0 };
let pending = [];
let hDist = 0;
let timer = null;

function vals() {
  const { page, slide, prev, scrolled, menu, sent, narrow, stack, curtain } = state;
  const v = {
    isHome: page === 'accueil', isBianka: page === 'bianka', isAlex: page === 'alexandre',
    navBg: scrolled || menu ? 'rgba(28,31,38,.88)' : 'rgba(28,31,38,0)',
    navLine: scrolled ? 'rgba(245,242,236,.08)' : 'rgba(245,242,236,0)',
    navPad: scrolled ? '16px clamp(20px,4vw,56px)' : '22px clamp(20px,4vw,56px)',
    wide: !narrow, narrow, menuOpen: narrow && menu, menuLabel: menu ? 'Fermer' : 'Menu',
    curtainT: curtain === 1 ? 'translateY(0)' : curtain === 2 ? 'translateY(-100%)' : 'translateY(100%)',
    curtainTr: curtain === 0 ? 'none' : 'transform .6s cubic-bezier(.76,0,.24,1)',
    heroCols: stack ? 'minmax(0,1fr)' : narrow ? 'minmax(0,1.1fr) minmax(0,.9fr)' : 'minmax(0,1.15fr) minmax(0,.85fr)',
    cardOffset: narrow ? '0px' : '100px',
    slideCaption: CAPTIONS[slide],
    hPos: narrow ? 'relative' : 'sticky', hHeight: narrow ? 'auto' : '100vh',
    trackW: narrow ? '100%' : 'max-content',
    cardW: narrow ? '100%' : 'clamp(340px,30vw,460px)', cardH: narrow ? 'auto' : 'min(60vh,580px)',
    notSent: !sent, sent,
  };
  for (let i = 0; i < 3; i++) {
    const act = slide === i, pv = prev === i && !act;
    v['z' + i] = act ? 2 : pv ? 1 : 0;
    v['c' + i] = act || pv ? 'inset(0 0 0 0)' : 'inset(100% 0 0 0)';
    v['ct' + i] = act ? 'clip-path 1.2s cubic-bezier(.76,0,.24,1)' : 'none';
    v['s' + i] = act ? 1 : 1.12;
    v['o' + i] = act ? 1 : 0.4;
    v['w' + i] = act ? '40px' : '14px';
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

/* ---------- Slideshow ---------- */
function startTimer() {
  clearInterval(timer);
  if (CONFIG.autoplay) timer = setInterval(() => setState({ prev: state.slide, slide: (state.slide + 1) % 3 }), CONFIG.slideDelay);
}
function goSlide(i) { if (i !== state.slide) { setState({ prev: state.slide, slide: i }); startTimer(); } }

/* ---------- Scroll reveals (subtle) ---------- */
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
      if (im) {
        im.style.scale = '1.15';
        if (!im._tr) { im._tr = true; im.style.transition = (im.style.transition ? im.style.transition + ',' : '') + `scale 1.5s ${EASE} ${d}ms`; }
      }
      el._tr = `clip-path 1.2s ${EASE} ${d}ms`;
    } else if (t === 'mask') {
      el.style.transform = 'translateY(105%)';
      el._tr = `transform 1s ${EASE} ${d}ms`;
    } else {
      el.style.opacity = '0'; el.style.transform = 'translateY(28px)';
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
function resetReveal(container) {
  if (!container) return;
  $$('[data-reveal]', container).forEach((el) => { el._rv = undefined; });
  $$('[data-count]', container).forEach((el) => { el._counted = false; });
}
function count(el) {
  if (el._counted) return; el._counted = true;
  const end = +el.dataset.count, t0 = performance.now();
  const step = (t) => { const p = Math.min(1, (t - t0) / 1600); el.textContent = Math.round(end * (1 - Math.pow(1 - p, 4))); if (p < 1) requestAnimationFrame(step); };
  requestAnimationFrame(step);
}

/* ---------- Scroll: parallax, fill text, horizontal scroll ---------- */
function measure() {
  const o = ref('hRef'), t = ref('trackRef');
  if (o && t) {
    if (state.narrow || state.page !== 'accueil') { o.style.height = 'auto'; t.style.transform = 'none'; hDist = 0; }
    else { hDist = Math.max(0, t.scrollWidth - window.innerWidth); o.style.height = (window.innerHeight + hDist) + 'px'; }
  }
  tick();
}
function tick() {
  const y = window.scrollY, vh = window.innerHeight;
  const cw = document.documentElement.clientWidth || window.innerWidth;
  const n = cw < 980, st = cw < 640;
  if (n !== state.narrow || st !== state.stack) { setState({ narrow: n, stack: st, menu: n ? state.menu : false }); measure(); return; }
  const sc = y > 30; if (sc !== state.scrolled) setState({ scrolled: sc });
  checkReveal();
  if (state.page !== 'accueil') return;
  const hi = ref('heroImgRef'); if (hi) hi.style.transform = `translate3d(0,${Math.min(y, vh) * 0.06}px,0)`;
  const ir = ref('introRef'), f = ref('fillRef');
  if (ir && f) { const r = ir.getBoundingClientRect(); const pr = Math.min(1, Math.max(0, (vh * 0.85 - r.top) / (r.height + vh * 0.25))); f.style.backgroundSize = `${(pr * 100).toFixed(1)}% 100%, 100% 100%`; }
  const o = ref('hRef'), t = ref('trackRef'), bar = ref('hBarRef');
  if (o && t && !state.narrow && hDist) {
    const pr = Math.min(1, Math.max(0, -o.getBoundingClientRect().top / hDist));
    t.style.transform = `translate3d(${-pr * hDist}px,0,0)`;
    if (bar) bar.style.transform = `scaleX(${pr})`;
  }
}

/* ---------- Page navigation ---------- */
const PAGE_KEY = { accueil: 'isHome', bianka: 'isBianka', alexandre: 'isAlex' };
function go(page, anchor) {
  const scroll = (smooth) => {
    if (anchor) { const el = document.getElementById(anchor); if (el) window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 60, behavior: smooth ? 'smooth' : 'instant' }); }
    else window.scrollTo({ top: 0, behavior: 'instant' });
  };
  setState({ menu: false });
  const target = anchor === 'nous-joindre' ? state.page : page;
  if (target === state.page) { scroll(true); return; }
  setState({ curtain: 1 });
  setTimeout(() => {
    resetReveal(document.querySelector(`[data-if="${PAGE_KEY[target]}"]`));
    setState({ page: target });
    history.replaceState(null, '', target === 'accueil' ? location.pathname + location.search : '#/' + target);
    setTimeout(() => {
      scroll(false); setupReveal(); measure();
      setState({ curtain: 2 });
      setTimeout(() => setState({ curtain: 0 }), 700);
    }, 80);
  }, 620);
}

const nav = (pg, a) => (e) => { e.preventDefault(); go(pg, a); };
const actions = {
  goHome: nav('accueil'), goBianka: nav('bianka'), goAlex: nav('alexandre'),
  navEquipe: nav('accueil', 'equipe'), navServices: nav('accueil', 'services'), navPerso: nav('accueil', 'services-personnalises'),
  navEng: nav('accueil', 'engagement'), navContact: nav('accueil', 'nous-joindre'),
  toggleMenu: () => setState({ menu: !state.menu }),
  toTop: (e) => { e.preventDefault(); window.scrollTo({ top: 0, behavior: 'smooth' }); },
  go0: () => goSlide(0), go1: () => goSlide(1), go2: () => goSlide(2),
};

/* ---------- Init ---------- */
document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-action]');
  if (el && actions[el.dataset.action]) actions[el.dataset.action](e);
});
$$('[data-submit]').forEach((f) => f.addEventListener('submit', (e) => {
  e.preventDefault();
  setState({ sent: true });
}));

const h = (location.hash || '').replace('#/', '');
if (h === 'bianka' || h === 'alexandre') state.page = h;

let raf = null;
window.addEventListener('scroll', () => { if (raf) return; raf = requestAnimationFrame(() => { raf = null; tick(); }); }, { passive: true });
window.addEventListener('resize', measure);

render();
tick();
startTimer();
setupReveal();
measure();
if (document.fonts) document.fonts.ready.then(measure);
window.addEventListener('load', measure);
setInterval(tick, 400);
