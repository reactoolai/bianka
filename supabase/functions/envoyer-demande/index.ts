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

// ---------- Gabarit des courriels (logo de l'étude, icônes, bandeau Reactool.AI) ----------
const SITE = 'https://notairealma.com';
const FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif";
const BORDEAUX = '#7A1238';
const NAVY = '#0A2540';
const CYAN = '#00B4D8';
const ICONES = [
  { nom: 'Téléphone', href: 'tel:+14186683118', img: 'phone.png' },
  { nom: 'Site web', href: SITE, img: 'web.png' },
  { nom: 'Facebook', href: FACEBOOK, img: 'facebook.png' },
  { nom: 'LinkedIn', href: LINKEDIN, img: 'linkedin.png' },
];

function gabarit(apercu: string, corps: string) {
  const icones = ICONES.map((i) =>
    `<td style="padding:0 7px"><a href="${i.href}"><img src="${SITE}/email/${i.img}" width="36" height="36" alt="${i.nom}" style="display:block;border:0"></a></td>`).join('');
  return `<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"></head>
<body style="margin:0;padding:0;background:#F8F3EE">
<div style="display:none;max-height:0;overflow:hidden;opacity:0">${esc(apercu)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F8F3EE"><tr><td align="center" style="padding:28px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px">

  <tr><td align="center" style="background:#ffffff;border-radius:18px 18px 0 0;padding:30px 24px 22px;border-bottom:3px solid ${BORDEAUX}">
    <a href="${SITE}"><img src="${SITE}/email/logo-notaires-alma.png" width="230" alt="Notaires Alma — Me Bianka Villeneuve, Me Alexandre Demers-Bergeron" style="display:block;border:0;height:auto;max-width:100%"></a>
  </td></tr>

  <tr><td style="background:#ffffff;padding:32px 34px 8px;font-family:${FONT};font-size:16px;line-height:1.65;color:#141114">
    ${corps}
  </td></tr>

  <tr><td align="center" style="background:#ffffff;padding:22px 24px 30px;border-radius:0 0 18px 18px">
    <table role="presentation" cellpadding="0" cellspacing="0" style="border-top:1px solid #EFE6DE;width:100%"><tr><td align="center" style="padding-top:24px">
      <table role="presentation" cellpadding="0" cellspacing="0"><tr>${icones}</tr></table>
      <div style="margin-top:14px;font-family:${FONT};font-size:13px;line-height:1.6;color:#6b5a62">
        <b style="color:${BORDEAUX}">Notaires Alma</b> · 401, avenue Du Pont Nord, Alma (Québec) G8B 5E1<br>
        <a href="tel:+14186683118" style="color:#6b5a62;text-decoration:none">(418) 668-3118</a> · <a href="${SITE}" style="color:${BORDEAUX};text-decoration:none">notairealma.com</a>
      </div>
    </td></tr></table>
  </td></tr>

  <tr><td style="height:18px;line-height:18px;font-size:0">&nbsp;</td></tr>

  <tr><td style="border-radius:18px;background:${NAVY};background-image:linear-gradient(135deg,${NAVY} 0%,#0F3A63 65%,${CYAN} 150%);padding:22px 26px" align="center">
    <a href="https://reactool.ai" style="text-decoration:none">
    <table role="presentation" cellpadding="0" cellspacing="0"><tr>
      <td valign="middle"><div style="width:44px;height:44px;border-radius:22px;background:rgba(255,255,255,0.12);text-align:center"><img src="https://reactool.ai/email/reactool-r-white.png" width="20" alt="" style="display:inline-block;margin-top:10px;border:0"></div></td>
      <td valign="middle" style="padding-left:12px;text-align:left;font-family:${FONT}">
        <div style="font-size:11px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:#7FDBEE">Propulsé par</div>
        <div style="font-size:20px;font-weight:800;color:#ffffff;letter-spacing:-0.01em">Reactool<span style="color:${CYAN}">.AI</span></div>
      </td>
    </tr></table></a>
    <div style="margin-top:10px;font-family:${FONT};font-size:13px;line-height:1.5;color:#9FB3C8">Des sites et des outils Web pour les entreprises d’ici, créés avec l’IA.</div>
    <div style="margin-top:8px"><a href="https://reactool.ai" style="font-family:${FONT};font-size:13px;font-weight:600;color:${CYAN};text-decoration:none">reactool.ai →</a></div>
  </td></tr>

  <tr><td align="center" style="padding:16px 16px 0;font-family:${FONT};font-size:11px;line-height:1.6;color:#a3958c">Courriel automatique envoyé depuis notairealma.com.</td></tr>
</table></td></tr></table></body></html>`;
}

const P = (t: string) => `<p style="margin:0 0 16px">${t}</p>`;

// Courriel de confirmation envoyé au client (contenu fixe : on ne recopie pas son message).
function confirmation(type: string, nom: string, motif: string) {
  const prenom = nom.split(/\s+/)[0];
  const rdv = type === 'rendez_vous';
  const objet = rdv ? `votre demande de rendez-vous${motif ? ` (${motif})` : ''}` : 'votre message';
  const sujet = rdv ? 'Nous avons bien reçu votre demande de rendez-vous — Notaires Alma' : 'Nous avons bien reçu votre message — Notaires Alma';
  const suite = rdv ? ' pour confirmer la date et l’heure de votre rendez-vous' : '';
  const corps = `<div style="font-size:12px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:${BORDEAUX};margin-bottom:8px">Demande bien reçue</div>
<div style="font-size:26px;line-height:1.25;font-weight:800;color:#141114;margin-bottom:22px">Merci, ${esc(prenom)}!</div>
${P(`Nous avons bien reçu ${esc(objet)}.`)}
${P(`Notre équipe en prend connaissance et vous reviendra très bientôt${suite}.`)}
${P(`Pour toute question d’ici là, appelez-nous au <a href="tel:+14186683118" style="color:${BORDEAUX};font-weight:700;text-decoration:none">(418) 668-3118</a> ou répondez simplement à ce courriel.`)}
<p style="margin:24px 0 0">Au plaisir,<br><b>L’équipe de Notaires Alma</b><br><span style="font-size:14px;color:#6b5a62">Me Bianka Villeneuve · Me Alexandre Demers-Bergeron</span></p>`;
  const text = `Merci, ${prenom}!\n\nNous avons bien reçu ${objet}.\nNotre équipe en prend connaissance et vous reviendra très bientôt${suite}.\n\nPour toute question : (418) 668-3118, ou répondez à ce courriel.\n\nAu plaisir,\nL’équipe de Notaires Alma\n401, avenue Du Pont Nord, Alma (Québec) G8B 5E1\nnotairealma.com\nFacebook : ${FACEBOOK}\nLinkedIn : ${LINKEDIN}\n\nPropulsé par Reactool.AI — https://reactool.ai`;
  return { sujet, html: gabarit(`Nous avons bien reçu ${objet}.`, corps), text };
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

  const lignesHtml = lignes.map(([k, v]) =>
    `<tr><td style="padding:9px 12px 9px 0;vertical-align:top;color:#6b5a62;font-size:14px;white-space:nowrap;border-bottom:1px solid #F2EBE5"><b>${esc(k)}</b></td><td style="padding:9px 0;font-size:15px;white-space:pre-wrap;border-bottom:1px solid #F2EBE5">${esc(v)}</td></tr>`).join('');
  const html = gabarit(sujet, `<div style="font-size:12px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:${BORDEAUX};margin-bottom:8px">${type === 'rendez_vous' ? 'Nouvelle demande de rendez-vous' : 'Nouveau message du site'}</div>
<div style="font-size:24px;line-height:1.25;font-weight:800;color:#141114;margin-bottom:18px">${esc(nom)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse">${lignesHtml}</table>
<p style="margin:20px 0 0;font-size:13px;color:#6b5a62">Répondez directement à ce courriel pour écrire à ${esc(nom)}. Consentement (Loi 25) donné : « ${esc(consentTexte)} ».</p>`);
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
