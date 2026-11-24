/*
  Fonction serveur : reçoit une demande du site (rendez-vous ou contact),
  bloque les robots, l'enregistre dans la base et l'envoie par courriel (Resend).

  Secret requis (Bolt › Database › Secrets, ou Supabase › Edge Functions › Secrets) :
    RESEND_API_KEY   clé API Resend (domaine reactool.ai vérifié)
  Fournis automatiquement par Supabase :
    SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
*/
import { createClient } from 'npm:@supabase/supabase-js@2';

const FROM = 'Notaires Alma <notairesalma@reactool.ai>';
const TO = ['bvilleneuve@notarius.net'];
const CC_RDV = ['alexandredemersbergeron@notarius.net'];
const FACEBOOK = 'https://www.facebook.com/profile.php?id=100063607535924';
const LINKEDIN = 'https://www.linkedin.com/in/bianka-villeneuve-notaire-708ba864/';
const ORIGINS = ['https://notairealma.com', 'https://www.notairealma.com', 'http://localhost:5191'];

const MIN_MS = 3000; // un humain met plus de 3 secondes à remplir le formulaire
const MAX_PAR_HEURE = 5; // par adresse IP (au mieux, mémoire de la fonction)
const hits = new Map<string, number[]>();

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const LIENS_RE = /(https?:\/\/|www\.)/gi;

function cors(origin: string | null) {
  const allow = origin && (ORIGINS.includes(origin) || origin.endsWith('.bolt.host')) ? origin : ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    Vary: 'Origin',
  };
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
const str = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

function tropDeLiens(...textes: string[]) {
  return textes.join(' ').match(LIENS_RE)?.length ?? 0;
}

function limite(ip: string) {
  const now = Date.now();
  const recent = (hits.get(ip) || []).filter((t) => now - t < 3600_000);
  recent.push(now);
  hits.set(ip, recent);
  return recent.length > MAX_PAR_HEURE;
}

// Courriel de confirmation envoyé au client (contenu fixe : on ne recopie pas son message).
function confirmation(type: string, nom: string, motif: string) {
  const prenom = nom.split(/\s+/)[0];
  const objet = type === 'rendez_vous' ? `votre demande de rendez-vous${motif ? ` (${motif})` : ''}` : 'votre message';
  const sujet = type === 'rendez_vous' ? 'Nous avons bien reçu votre demande de rendez-vous — Notaires Alma' : 'Nous avons bien reçu votre message — Notaires Alma';
  const html = `<div style="background:#F8F3EE;padding:32px 16px;font-family:Arial,sans-serif;color:#141114">
<div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #e6dcd3">
<div style="background:#141114;padding:24px 28px"><p style="margin:0;font-family:Georgia,serif;font-size:22px;letter-spacing:3px;color:#ffffff">NOTAIRES <span style="color:#F0A9C4">ALMA</span></p>
<p style="margin:4px 0 0;font-size:12px;color:#B49872">Me Bianka Villeneuve · Me Alexandre Demers-Bergeron</p></div>
<div style="padding:28px;font-size:15px;line-height:1.6">
<p style="margin:0 0 14px">Bonjour ${esc(prenom)},</p>
<p style="margin:0 0 14px">Merci! Nous avons bien reçu ${esc(objet)}.</p>
<p style="margin:0 0 14px">Notre équipe en prend connaissance et vous reviendra très bientôt${type === 'rendez_vous' ? ' pour confirmer la date et l’heure de votre rendez-vous' : ''}.</p>
<p style="margin:0 0 14px">Pour toute question d’ici là, appelez-nous au <a href="tel:+14186683118" style="color:#7A1238;font-weight:bold">(418) 668-3118</a> ou répondez simplement à ce courriel.</p>
<p style="margin:22px 0 0">Au plaisir,<br><b>L’équipe de Notaires Alma</b><br><span style="color:#666;font-size:13px">401, avenue Du Pont Nord, Alma (Québec) G8B 5E1</span></p></div>
<div style="border-top:1px solid #eee;padding:18px 28px;font-size:13px;color:#666">
<a href="https://notairealma.com" style="color:#7A1238">notairealma.com</a> &nbsp;·&nbsp; <a href="${FACEBOOK}" style="color:#7A1238">Facebook</a> &nbsp;·&nbsp; <a href="${LINKEDIN}" style="color:#7A1238">LinkedIn</a></div></div>
<p style="max-width:560px;margin:16px auto 0;text-align:center;font-size:11px;color:#999">Courriel automatique envoyé à la suite de votre demande sur notairealma.com.<br>Propulsé par <a href="https://reactool.ai" style="color:#999">Reactool.AI</a></p></div>`;
  const text = `Bonjour ${prenom},\n\nMerci! Nous avons bien reçu ${objet}.\nNotre équipe en prend connaissance et vous reviendra très bientôt${type === 'rendez_vous' ? ' pour confirmer la date et l’heure de votre rendez-vous' : ''}.\n\nPour toute question : (418) 668-3118, ou répondez à ce courriel.\n\nAu plaisir,\nL’équipe de Notaires Alma\n401, avenue Du Pont Nord, Alma (Québec) G8B 5E1\n\nnotairealma.com · Facebook : ${FACEBOOK} · LinkedIn : ${LINKEDIN}\n\nPropulsé par Reactool.AI`;
  return { sujet, html, text };
}

Deno.serve(async (req) => {
  const headers = { ...cors(req.headers.get('origin')), 'Content-Type': 'application/json' };
  if (req.method === 'OPTIONS') return new Response('ok', { headers });
  if (req.method !== 'POST') return new Response(JSON.stringify({ error: 'method' }), { status: 405, headers });

  const ok = () => new Response(JSON.stringify({ ok: true }), { headers });
  const refus = (code: string, status = 400) => new Response(JSON.stringify({ error: code }), { status, headers });

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return refus('json'); }

  // --- Anti-robots : on répond « ok » sans rien envoyer, pour ne rien apprendre au robot.
  if (str(body.site_web, 200)) return ok();
  const ms = Number(body.duree_ms);
  if (!Number.isFinite(ms) || ms < MIN_MS) return ok();
  const ip = (req.headers.get('x-forwarded-for') || '').split(',')[0].trim() || 'inconnu';
  if (limite(ip)) return refus('trop', 429);

  const type = body.type === 'messages' ? 'messages' : 'rendez_vous';
  const nom = str(body.nom, 120);
  const courriel = str(body.courriel, 160);
  const message = str(body.message, type === 'messages' ? 1000 : 800);
  const consent = body.consent_traitement === true;
  const consentTexte = str(body.consent_texte, 600);
  if (nom.length < 2 || !EMAIL_RE.test(courriel) || !consent) return refus('champs');
  if (tropDeLiens(nom, message) > 2) return ok();

  let ligne: Record<string, unknown>;
  let sujet: string;
  let motifClient = '';
  let lignes: [string, string][];
  if (type === 'rendez_vous') {
    const motif = str(body.motif, 120);
    const moment = str(body.moment, 60);
    const telephone = str(body.telephone, 30);
    const notaire = ['bianka', 'alexandre', 'indifferent'].includes(body.notaire as string) ? (body.notaire as string) : 'indifferent';
    if (!motif || !/^[0-9 ()+.\-]{7,30}$/.test(telephone)) return refus('champs');
    motifClient = motif;
    ligne = { notaire, motif, moment: moment || null, message: message || null, nom, telephone, courriel,
      consent_traitement: true, consent_infolettre: body.consent_infolettre === true, consent_texte: consentTexte };
    sujet = `Demande de rendez-vous — ${motif} — ${nom}`;
    lignes = [['Motif', motif], ['Moment préféré', moment || '—'], ['Nom', nom], ['Téléphone', telephone], ['Courriel', courriel],
      ['Message', message || '—'], ['Infolettre', body.consent_infolettre === true ? 'Oui' : 'Non']];
  } else {
    if (!message) return refus('champs');
    ligne = { nom, courriel, message, consent_traitement: true, consent_texte: consentTexte };
    sujet = `Message du site — ${nom}`;
    lignes = [['Nom', nom], ['Courriel', courriel], ['Message', message]];
  }

  // Copie de sauvegarde dans la base (si la table existe ; un échec n'empêche pas le courriel).
  try {
    const url = Deno.env.get('SUPABASE_URL');
    let key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!key) { try { key = JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') || '{}').default; } catch { /* rien */ } }
    if (url && key) {
      const { error } = await createClient(url, key).from(type).insert(ligne);
      if (error) console.error('insert', error.message);
    }
  } catch (e) { console.error('insert', e); }

  const resendKey = Deno.env.get('RESEND_API_KEY');
  if (!resendKey) { console.error('RESEND_API_KEY manquant'); return refus('config', 500); }

  const html = `<div style="font-family:Arial,sans-serif;font-size:15px;color:#141114">
<h2 style="margin:0 0 16px;color:#7A1238">${esc(sujet)}</h2>
<table cellpadding="6" style="border-collapse:collapse">${lignes.map(([k, v]) =>
    `<tr><td style="vertical-align:top;color:#666;white-space:nowrap"><b>${esc(k)}</b></td><td style="white-space:pre-wrap">${esc(v)}</td></tr>`).join('')}</table>
<p style="margin-top:20px;color:#666;font-size:13px">Envoyé depuis notairealma.com. Consentement (Loi 25) donné : « ${esc(consentTexte)} ».<br>Répondez directement à ce courriel pour écrire à ${esc(nom)}.</p>
<p style="color:#999;font-size:11px">Propulsé par <a href="https://reactool.ai" style="color:#999">Reactool.AI</a></p></div>`;
  const text = lignes.map(([k, v]) => `${k} : ${v}`).join('\n') + `\n\nConsentement (Loi 25) donné.`;

  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: FROM, to: TO, cc: type === 'rendez_vous' ? CC_RDV : undefined,
      reply_to: courriel, subject: sujet, html, text }),
  });
  if (!r.ok) { console.error('resend', r.status, await r.text()); return refus('envoi', 502); }

  // Accusé de réception au client (un échec ici n'annule pas la demande déjà transmise).
  try {
    const c = confirmation(type, nom, motifClient);
    const rc = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: FROM, to: [courriel], reply_to: TO[0], subject: c.sujet, html: c.html, text: c.text }),
    });
    if (!rc.ok) console.error('confirmation', rc.status, await rc.text());
  } catch (e) { console.error('confirmation', e); }
  return ok();
});
