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
  let lignes: [string, string][];
  if (type === 'rendez_vous') {
    const motif = str(body.motif, 120);
    const moment = str(body.moment, 60);
    const telephone = str(body.telephone, 30);
    const notaire = ['bianka', 'alexandre', 'indifferent'].includes(body.notaire as string) ? (body.notaire as string) : 'indifferent';
    if (!motif || !/^[0-9 ()+.\-]{7,30}$/.test(telephone)) return refus('champs');
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
<p style="margin-top:20px;color:#666;font-size:13px">Envoyé depuis notairealma.com. Consentement (Loi 25) donné : « ${esc(consentTexte)} ».<br>Répondez directement à ce courriel pour écrire à ${esc(nom)}.</p></div>`;
  const text = lignes.map(([k, v]) => `${k} : ${v}`).join('\n') + `\n\nConsentement (Loi 25) donné.`;

  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: FROM, to: TO, cc: type === 'rendez_vous' ? CC_RDV : undefined,
      reply_to: courriel, subject: sujet, html, text }),
  });
  if (!r.ok) { console.error('resend', r.status, await r.text()); return refus('envoi', 502); }
  return ok();
});
