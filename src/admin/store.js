/* Couche de données de l'admin.
   Même interface pour Supabase (réel) et pour la démo (données fictives en mémoire),
   pour que chaque module fonctionne sans savoir d'où viennent les données. */
import { supabase } from '../lib/supabase.js';

export function supabaseStore() {
  return {
    demo: false,
    async list(table, { limit = 500 } = {}) {
      const { data, error } = await supabase.from(table).select('*').order('created_at', { ascending: false }).limit(limit);
      if (error) throw error;
      return data;
    },
    async update(table, id, patch) {
      const { error } = await supabase.from(table).update(patch).eq('id', id);
      if (error) throw error;
    },
    async remove(table, id) {
      const { error } = await supabase.from(table).delete().eq('id', id);
      if (error) throw error;
    },
    subscribe(table, onInsert) {
      const ch = supabase.channel(`adm-${table}`)
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table }, (p) => onInsert(p.new))
        .subscribe();
      return () => supabase.removeChannel(ch);
    },
  };
}

export function demoStore() {
  const day = 86400000; const now = Date.now();
  const iso = (ms) => new Date(ms).toISOString();
  const consent = 'J’accepte que Notaires Alma recueille mes nom, téléphone, courriel et la description de ma demande dans le seul but de fixer un rendez-vous et de me recontacter.';
  const db = {
    rendez_vous: [
      { id: 'd1', created_at: iso(now - 2 * 3600e3), notaire: 'bianka', motif: 'Testament', moment: 'En matinée', message: 'Nous venons d’avoir notre deuxième enfant et voulons revoir nos testaments.', nom: 'Marie-Ève Gagnon', telephone: '418 555-0142', courriel: 'me.gagnon@exemple.ca', consent_traitement: true, consent_infolettre: true, consent_texte: consent, consent_at: iso(now - 2 * 3600e3), statut: 'nouveau', date_rdv: null, notes_internes: null, mandat_ouvert: false },
      { id: 'd2', created_at: iso(now - 7 * 3600e3), notaire: 'alexandre', motif: 'Achat ou vente d’une propriété', moment: 'En après-midi', message: 'Promesse d’achat acceptée hier, signature prévue le mois prochain.', nom: 'Jonathan Bouchard', telephone: '418 555-0177', courriel: 'j.bouchard@exemple.ca', consent_traitement: true, consent_infolettre: false, consent_texte: consent, consent_at: iso(now - 7 * 3600e3), statut: 'nouveau', date_rdv: null, notes_internes: null, mandat_ouvert: false },
      { id: 'd3', created_at: iso(now - 1.2 * day), notaire: 'indifferent', motif: 'Mandat de protection', moment: 'Peu importe', message: '', nom: 'Réjean Tremblay', telephone: '418 555-0108', courriel: 'r.tremblay@exemple.ca', consent_traitement: true, consent_infolettre: false, consent_texte: consent, consent_at: iso(now - 1.2 * day), statut: 'a_rappeler', date_rdv: null, notes_internes: 'Laissé un message vocal mardi.', mandat_ouvert: false },
      { id: 'd4', created_at: iso(now - 3 * day), notaire: 'bianka', motif: 'Union de fait / union parentale', moment: 'En matinée', message: 'Bébé prévu en mars, on veut comprendre l’union parentale.', nom: 'Audrey Simard', telephone: '418 555-0193', courriel: 'audrey.s@exemple.ca', consent_traitement: true, consent_infolettre: true, consent_texte: consent, consent_at: iso(now - 3 * day), statut: 'confirme', date_rdv: iso(now + 2 * day + 3600e3), notes_internes: 'Apporter les pièces d’identité des deux conjoints.', mandat_ouvert: false },
      { id: 'd5', created_at: iso(now - 5 * day), notaire: 'alexandre', motif: 'Hypothèque ou refinancement', moment: 'Peu importe', message: '', nom: 'Patrick Lavoie', telephone: '418 555-0121', courriel: 'p.lavoie@exemple.ca', consent_traitement: true, consent_infolettre: false, consent_texte: consent, consent_at: iso(now - 5 * day), statut: 'confirme', date_rdv: iso(now + 4 * day), notes_internes: null, mandat_ouvert: true },
      { id: 'd6', created_at: iso(now - 12 * day), notaire: 'bianka', motif: 'Succession', moment: 'En après-midi', message: 'Décès de mon père le mois dernier.', nom: 'Nathalie Côté', telephone: '418 555-0166', courriel: 'n.cote@exemple.ca', consent_traitement: true, consent_infolettre: false, consent_texte: consent, consent_at: iso(now - 12 * day), statut: 'termine', date_rdv: iso(now - 6 * day), notes_internes: 'Dossier de succession ouvert.', mandat_ouvert: true },
      { id: 'd7', created_at: iso(now - 20 * day), notaire: 'indifferent', motif: 'Entreprise', moment: 'Peu importe', message: '', nom: 'Kevin Harvey', telephone: '418 555-0150', courriel: 'k.harvey@exemple.ca', consent_traitement: true, consent_infolettre: false, consent_texte: consent, consent_at: iso(now - 20 * day), statut: 'annule', date_rdv: null, notes_internes: 'A trouvé un notaire à Chicoutimi.', mandat_ouvert: false },
    ],
    messages: [
      { id: 'm1', created_at: iso(now - 5 * 3600e3), nom: 'Sylvie Girard', courriel: 's.girard@exemple.ca', message: 'Bonjour, est-ce que vous faites les vérifications de testament olographe ?', consent_traitement: true, consent_texte: consent, consent_at: iso(now - 5 * 3600e3), statut: 'nouveau', notes_internes: null },
      { id: 'm2', created_at: iso(now - 2 * day), nom: 'Luc Fortin', courriel: 'luc.fortin@exemple.ca', message: 'Quels sont vos tarifs pour un mandat de protection pour un couple ?', consent_traitement: true, consent_texte: consent, consent_at: iso(now - 2 * day), statut: 'traite', notes_internes: 'Rappelé le 10.' },
    ],
  };
  return {
    demo: true,
    async list(table) { return structuredClone(db[table] || []); },
    async update(table, id, patch) { const r = db[table].find((x) => x.id === id); Object.assign(r, patch); },
    async remove(table, id) { db[table] = db[table].filter((x) => x.id !== id); },
    subscribe() { return () => {}; },
  };
}
