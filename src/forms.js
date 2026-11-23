/* Formulaires publics : rendez-vous et contact.
   - Avec Supabase : enregistrement sécurisé (insertion seulement, RLS).
   - Sans Supabase : ouvre un courriel pré-rempli vers l'étude (repli). */
import { supabase, supabaseReady } from './lib/supabase.js';

const ETUDE_COURRIEL = 'bvilleneuve@notarius.net';
const NOTAIRES = {
  bianka: 'Me Bianka Villeneuve',
  alexandre: 'Me Alexandre Demers-Bergeron',
  indifferent: 'le premier notaire disponible',
};

function fieldsOf(form) {
  const fd = new FormData(form);
  const v = (k) => (fd.get(k) || '').toString().trim();
  return { fd, v };
}

function consentText(form) {
  const box = form.querySelector('input[name="consent_traitement"]');
  return box?.closest('label')?.textContent.replace(/\s+/g, ' ').trim() || '';
}

function buildPayload(table, form) {
  const { fd, v } = fieldsOf(form);
  if (table === 'rendez_vous') {
    return {
      notaire: v('notaire'),
      motif: v('motif'),
      moment: v('moment') || null,
      message: v('message') || null,
      nom: v('nom'),
      telephone: v('telephone'),
      courriel: v('courriel'),
      consent_traitement: fd.get('consent_traitement') === 'on',
      consent_infolettre: fd.get('consent_infolettre') === 'on',
      consent_texte: consentText(form),
    };
  }
  return {
    nom: v('nom'),
    courriel: v('courriel'),
    message: v('message'),
    consent_traitement: fd.get('consent_traitement') === 'on',
    consent_texte: consentText(form),
  };
}

function mailtoFallback(table, p) {
  const subject = table === 'rendez_vous'
    ? `Demande de rendez-vous — ${p.motif} — ${NOTAIRES[p.notaire] || ''}`
    : `Message du site — ${p.nom}`;
  const body = table === 'rendez_vous'
    ? `Notaire : ${NOTAIRES[p.notaire]}\nMotif : ${p.motif}\nMoment préféré : ${p.moment || '—'}\n\n${p.message || ''}\n\nNom : ${p.nom}\nTéléphone : ${p.telephone}\nCourriel : ${p.courriel}\n\nConsentement Loi 25 donné.`
    : `${p.message}\n\nNom : ${p.nom}\nCourriel : ${p.courriel}\n\nConsentement Loi 25 donné.`;
  window.location.href = `mailto:${ETUDE_COURRIEL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

function prefill(form) {
  const q = new URLSearchParams(location.search);
  const n = q.get('notaire');
  const hid = form.querySelector('input[type="hidden"][name="notaire"]');
  if (n && hid && NOTAIRES[n]) hid.value = n;
  const m = q.get('motif');
  if (m) {
    const sel = form.querySelector('select[name="motif"]');
    if (sel && [...sel.options].some((o) => o.value === m || o.text === m)) sel.value = m;
  }
}

export function initForms() {
  document.querySelectorAll('form[data-form]').forEach((form) => {
    const table = form.dataset.form;
    const box = form.parentElement;
    const done = box.querySelector('[data-done]');
    const errorEl = form.querySelector('[data-error]');
    const btn = form.querySelector('button[type="submit"]');
    prefill(form);

    const showError = (msg) => { errorEl.textContent = msg; errorEl.hidden = !msg; };

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      showError('');
      if (form.querySelector('input[name="site_web"]')?.value) return; // robot
      if (!form.checkValidity()) {
        const first = form.querySelector(':invalid');
        first?.focus();
        if (first?.name === 'notaire') showError('Veuillez choisir un notaire.');
        else if (first?.name === 'consent_traitement') showError('Veuillez cocher le consentement pour envoyer votre demande.');
        else showError('Veuillez remplir les champs obligatoires (*).');
        form.querySelectorAll('input, select, textarea').forEach((el) => el.classList.add('touched'));
        return;
      }
      const payload = buildPayload(table, form);

      if (!supabaseReady) {
        mailtoFallback(table, payload);
        return;
      }
      btn.disabled = true;
      const label = btn.innerHTML;
      btn.textContent = 'Envoi en cours…';
      const { error } = await supabase.from(table).insert(payload);
      btn.disabled = false;
      btn.innerHTML = label;
      if (error) {
        console.error(error);
        showError('L’envoi n’a pas fonctionné. Réessayez ou appelez-nous au (418) 668-3118.');
        return;
      }
      if (table === 'rendez_vous') {
        const t = done.querySelector('[data-done-text]');
        if (t) t.textContent = 'Votre demande a bien été transmise. Nous vous contacterons sous peu pour confirmer la date et l’heure.';
      }
      form.reset();
      form.hidden = true;
      done.hidden = false;
      done.focus();
    });
  });
}
