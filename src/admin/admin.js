/* Tableau de bord — Notaires Alma
   Pour ajouter une section : créer un fichier dans ./modules/ (voir rendez-vous.js)
   puis l'ajouter à la liste MODULES ci-dessous. */
import '../style.css';
import './admin.css';
import { supabase, supabaseReady } from '../lib/supabase.js';
import { supabaseStore, demoStore } from './store.js';
import { h, plume, toast, closeDrawer } from './ui.js';
import apercu from './modules/apercu.js';
import rendezVous from './modules/rendez-vous.js';
import messages from './modules/messages.js';

const MODULES = [apercu, rendezVous, messages];

const app = document.getElementById('app');
let session = { store: null, user: null };
let leaveFns = [];

const icon = (d) => {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24'); svg.setAttribute('aria-hidden', 'true');
  const p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  p.setAttribute('d', d); svg.append(p); return svg;
};
const brand = () => h('div', { class: 'adm-brand' }, h('span', { class: 'brand__mark' }, plume()),
  h('span', { class: 'brand__text' }, h('span', { class: 'brand__sub' }, 'Administration'), h('span', { class: 'brand__name' }, 'NOTAIRES ', h('span', {}, 'ALMA'))));

/* ---------- Connexion ---------- */
function loginScreen(message = '') {
  closeDrawer();
  const email = h('input', { type: 'email', required: true, autocomplete: 'username' });
  const pass = h('input', { type: 'password', required: true, autocomplete: 'current-password' });
  const err = h('p', { class: 'form-error', role: 'alert', hidden: !message }, message);
  const submit = async (e) => {
    e.preventDefault(); err.hidden = true;
    const { error } = await supabase.auth.signInWithPassword({ email: email.value.trim(), password: pass.value });
    if (error) { err.textContent = 'Courriel ou mot de passe incorrect.'; err.hidden = false; }
  };
  const forgot = async () => {
    if (!email.value) { err.textContent = 'Entrez d’abord votre courriel.'; err.hidden = false; return; }
    await supabase.auth.resetPasswordForEmail(email.value.trim(), { redirectTo: `${location.origin}/admin.html` });
    toast('Si ce courriel est autorisé, un lien de réinitialisation a été envoyé.');
  };
  app.replaceChildren(h('main', { class: 'login' },
    h('div', { class: 'login__card' }, brand(),
      supabaseReady
        ? h('form', { class: 'form-adm', onsubmit: submit },
            h('h1', {}, 'Connexion'),
            h('label', {}, 'Courriel', email), h('label', {}, 'Mot de passe', pass), err,
            h('button', { class: 'btn-adm btn-adm--dark', type: 'submit' }, 'Se connecter'),
            h('button', { class: 'link-btn', type: 'button', onclick: forgot }, 'Mot de passe oublié ?'))
        : h('div', { class: 'form-adm' },
            h('h1', {}, 'Base de données à connecter'),
            h('p', { class: 'muted' }, 'Supabase n’est pas encore branché à ce site. Une fois connecté dans Bolt, les demandes du site apparaîtront ici.'),
            h('button', { class: 'btn-adm btn-adm--dark', type: 'button', onclick: () => start(demoStore(), { nom: 'Mode démo' }) }, 'Voir la démo (données fictives)')),
      h('p', { class: 'login__foot' }, h('a', { href: '/' }, '← Retour au site')))));
}

function newPasswordScreen() {
  const pass = h('input', { type: 'password', required: true, minlength: '10', autocomplete: 'new-password' });
  const submit = async (e) => {
    e.preventDefault();
    const { error } = await supabase.auth.updateUser({ password: pass.value });
    if (error) toast('Erreur : ' + error.message); else { toast('Mot de passe mis à jour'); boot(); }
  };
  app.replaceChildren(h('main', { class: 'login' }, h('div', { class: 'login__card' }, brand(),
    h('form', { class: 'form-adm', onsubmit: submit }, h('h1', {}, 'Nouveau mot de passe'),
      h('label', {}, 'Mot de passe (10 caractères minimum)', pass),
      h('button', { class: 'btn-adm btn-adm--dark', type: 'submit' }, 'Enregistrer')))));
}

/* ---------- Coquille ---------- */
function start(store, user) {
  session = { store, user };
  const nav = h('nav', { class: 'adm-nav', 'aria-label': 'Sections' });
  const main = h('main', { class: 'adm-main', id: 'adm-main', tabindex: '-1' });
  const badges = {};

  MODULES.forEach((m) => {
    badges[m.id] = h('span', { class: 'badge', hidden: true });
    nav.append(h('a', { href: `#${m.id}`, 'data-id': m.id }, icon(m.icon), h('span', {}, m.label), badges[m.id]));
  });

  const refreshBadges = async () => {
    for (const m of MODULES) {
      if (!m.badge || !m.table) continue;
      try { const n = m.badge(await store.list(m.table)); badges[m.id].textContent = n; badges[m.id].hidden = !n; } catch { /* ignore */ }
    }
  };

  const logout = async () => { if (!store.demo) await supabase.auth.signOut(); loginScreen(); };

  app.replaceChildren(h('div', { class: 'adm-shell' },
    h('aside', { class: 'adm-side' }, brand(), nav,
      h('div', { class: 'adm-side__foot' },
        store.demo ? h('p', { class: 'demo-flag' }, 'Mode démo — données fictives') : null,
        h('p', {}, user.nom || ''),
        h('button', { class: 'link-btn link-btn--light', type: 'button', onclick: logout }, 'Se déconnecter'),
        h('a', { href: '/', class: 'link-btn link-btn--light' }, 'Voir le site ↗'))),
    main));

  const route = async () => {
    leaveFns.forEach((f) => f?.()); leaveFns = [];
    closeDrawer();
    const id = location.hash.slice(1) || MODULES[0].id;
    const mod = MODULES.find((m) => m.id === id) || MODULES[0];
    nav.querySelectorAll('a').forEach((a) => a.toggleAttribute('aria-current', a.dataset.id === mod.id));
    main.replaceChildren(h('p', { class: 'muted loading' }, 'Chargement…'));
    try {
      const view = await mod.render({
        store, user,
        go: (target) => { location.hash = target; },
        refreshBadges,
        onLeave: (fn) => leaveFns.push(fn),
      });
      main.replaceChildren(view);
    } catch (e) {
      console.error(e);
      main.replaceChildren(h('p', { class: 'form-error' }, 'Impossible de charger cette section. Vérifiez la connexion à la base de données.'));
    }
  };
  window.onhashchange = route;
  route();
  refreshBadges();
}

/* ---------- Démarrage ---------- */
async function boot() {
  if (!supabaseReady) { loginScreen(); return; }
  const { data: { session: s } } = await supabase.auth.getSession();
  if (!s) { loginScreen(); return; }
  const { data: staff } = await supabase.from('staff').select('nom, role, notaire').eq('user_id', s.user.id).maybeSingle();
  if (!staff) {
    await supabase.auth.signOut();
    loginScreen('Ce compte n’a pas accès à l’administration.');
    return;
  }
  start(supabaseStore(), staff);
}

if (supabaseReady) {
  supabase.auth.onAuthStateChange((event) => {
    if (event === 'PASSWORD_RECOVERY') newPasswordScreen();
    else if (event === 'SIGNED_IN' && !session.store) boot();
    else if (event === 'SIGNED_OUT') { session = { store: null, user: null }; }
  });
}
boot();
