import { h, chip, drawer, closeDrawer, toast, downloadCsv, fmtAgo, fmtDateTime, toLocalInput, fromLocalInput, NOTAIRES, STATUTS_RDV } from '../ui.js';

export default {
  id: 'rendez-vous',
  label: 'Rendez-vous',
  icon: 'M7 3v3M17 3v3M4 9h16M5 6h14v14H5z',
  table: 'rendez_vous',
  badge: (rows) => rows.filter((r) => r.statut === 'nouveau').length,

  async render(ctx) {
    const state = { q: '', statut: 'actifs', notaire: 'tous' };
    let rows = await ctx.store.list('rendez_vous');

    const tbody = h('tbody');
    const count = h('span', { class: 'muted' });

    const filtered = () => rows.filter((r) => {
      if (state.statut === 'actifs' && ['termine', 'annule'].includes(r.statut)) return false;
      if (!['actifs', 'tous'].includes(state.statut) && r.statut !== state.statut) return false;
      if (state.notaire !== 'tous' && r.notaire !== state.notaire) return false;
      if (state.q) {
        const s = `${r.nom} ${r.courriel} ${r.telephone} ${r.motif}`.toLowerCase();
        if (!s.includes(state.q.toLowerCase())) return false;
      }
      return true;
    });

    const paint = () => {
      const list = filtered();
      count.textContent = `${list.length} demande${list.length > 1 ? 's' : ''}`;
      tbody.replaceChildren(...(list.length ? list.map((r) => h('tr', { class: r.statut === 'nouveau' ? 'is-new' : '' },
        h('td', {}, h('button', { class: 'row-link', type: 'button', onclick: () => open(r) }, r.nom), h('small', {}, fmtAgo(r.created_at))),
        h('td', {}, NOTAIRES[r.notaire]),
        h('td', {}, r.motif),
        h('td', { class: 'hide-sm' }, r.moment || '—'),
        h('td', {}, chip(STATUTS_RDV, r.statut)),
        h('td', { class: 'hide-sm' }, r.date_rdv ? fmtDateTime(r.date_rdv) : '—'),
      )) : [h('tr', {}, h('td', { colspan: '6', class: 'empty' }, 'Aucune demande pour ces filtres.'))]));
    };

    const open = (r) => {
      const statut = h('select', { name: 'statut' }, ...Object.entries(STATUTS_RDV).map(([k, v]) => h('option', { value: k, selected: r.statut === k }, v.label)));
      const date = h('input', { type: 'datetime-local', value: toLocalInput(r.date_rdv) });
      const notaire = h('select', {}, ...Object.entries(NOTAIRES).map(([k, v]) => h('option', { value: k, selected: r.notaire === k }, v)));
      const notes = h('textarea', { rows: '4', placeholder: 'Visible uniquement par l’équipe' });
      notes.value = r.notes_internes || '';
      const mandat = h('input', { type: 'checkbox', checked: r.mandat_ouvert });

      const save = async () => {
        const patch = { statut: statut.value, date_rdv: fromLocalInput(date.value), notaire: notaire.value, notes_internes: notes.value.trim() || null, mandat_ouvert: mandat.checked };
        try { await ctx.store.update('rendez_vous', r.id, patch); Object.assign(r, patch); paint(); ctx.refreshBadges(); closeDrawer(); toast('Demande mise à jour'); }
        catch (e) { console.error(e); toast('Erreur : la mise à jour n’a pas été enregistrée'); }
      };
      const del = async () => {
        if (!confirm(`Supprimer définitivement la demande de ${r.nom} ? (demande de suppression Loi 25)`)) return;
        try { await ctx.store.remove('rendez_vous', r.id); rows = rows.filter((x) => x.id !== r.id); paint(); ctx.refreshBadges(); closeDrawer(); toast('Demande supprimée'); }
        catch (e) { console.error(e); toast('Erreur : suppression impossible'); }
      };

      drawer(r.nom, [
        h('div', { class: 'quick' },
          h('a', { class: 'btn-adm btn-adm--dark', href: `tel:${r.telephone.replace(/[^0-9+]/g, '')}` }, `Appeler · ${r.telephone}`),
          h('a', { class: 'btn-adm', href: `mailto:${r.courriel}` }, 'Écrire')),
        h('dl', { class: 'dl' },
          h('dt', {}, 'Reçue'), h('dd', {}, fmtDateTime(r.created_at)),
          h('dt', {}, 'Motif'), h('dd', {}, r.motif),
          h('dt', {}, 'Moment préféré'), h('dd', {}, r.moment || '—'),
          h('dt', {}, 'Courriel'), h('dd', {}, r.courriel),
          h('dt', {}, 'Message'), h('dd', { class: 'pre' }, r.message || '—'),
          h('dt', {}, 'Consentement'), h('dd', {}, `Donné le ${fmtDateTime(r.consent_at)}${r.consent_infolettre ? ' · accepte l’infolettre' : ''}`)),
        h('div', { class: 'form-adm' },
          h('label', {}, 'Statut', statut),
          h('label', {}, 'Notaire', notaire),
          h('label', {}, 'Date et heure du rendez-vous', date),
          h('label', {}, 'Notes internes', notes),
          h('label', { class: 'inline' }, mandat, 'Mandat ouvert (conserver au-delà de 12 mois)')),
        h('div', { class: 'drawer__actions' },
          h('button', { class: 'btn-adm btn-adm--dark', type: 'button', onclick: save }, 'Enregistrer'),
          h('button', { class: 'btn-adm btn-adm--danger', type: 'button', onclick: del }, 'Supprimer')),
      ]);
    };

    const exportCsv = () => downloadCsv(`rendez-vous-${new Date().toISOString().slice(0, 10)}.csv`, filtered(), [
      { label: 'Reçue le', get: (r) => fmtDateTime(r.created_at) },
      { label: 'Nom', get: (r) => r.nom }, { label: 'Téléphone', get: (r) => r.telephone }, { label: 'Courriel', get: (r) => r.courriel },
      { label: 'Notaire', get: (r) => NOTAIRES[r.notaire] }, { label: 'Motif', get: (r) => r.motif }, { label: 'Moment', get: (r) => r.moment },
      { label: 'Statut', get: (r) => STATUTS_RDV[r.statut]?.label }, { label: 'Date RDV', get: (r) => (r.date_rdv ? fmtDateTime(r.date_rdv) : '') },
      { label: 'Infolettre', get: (r) => (r.consent_infolettre ? 'oui' : 'non') },
    ]);

    const unsub = ctx.store.subscribe('rendez_vous', (n) => { rows.unshift(n); paint(); ctx.refreshBadges(); toast(`Nouvelle demande : ${n.nom}`); });
    ctx.onLeave(unsub);

    const search = h('input', { type: 'search', placeholder: 'Rechercher un nom, un courriel…', 'aria-label': 'Rechercher', oninput: (e) => { state.q = e.target.value; paint(); } });
    const fStatut = h('select', { 'aria-label': 'Filtrer par statut', onchange: (e) => { state.statut = e.target.value; paint(); } },
      h('option', { value: 'actifs' }, 'En cours'), h('option', { value: 'tous' }, 'Tous les statuts'),
      ...Object.entries(STATUTS_RDV).map(([k, v]) => h('option', { value: k }, v.label)));
    const fNotaire = h('select', { 'aria-label': 'Filtrer par notaire', onchange: (e) => { state.notaire = e.target.value; paint(); } },
      h('option', { value: 'tous' }, 'Tous les notaires'), ...Object.entries(NOTAIRES).map(([k, v]) => h('option', { value: k }, v)));

    paint();
    return h('section', {},
      h('header', { class: 'page-head' }, h('div', {}, h('h1', {}, 'Rendez-vous'), count),
        h('button', { class: 'btn-adm', type: 'button', onclick: exportCsv }, 'Exporter (CSV)')),
      h('div', { class: 'toolbar' }, search, fStatut, fNotaire),
      h('div', { class: 'table-wrap' }, h('table', { class: 'tbl' },
        h('thead', {}, h('tr', {}, h('th', {}, 'Client'), h('th', {}, 'Notaire'), h('th', {}, 'Motif'), h('th', { class: 'hide-sm' }, 'Moment'), h('th', {}, 'Statut'), h('th', { class: 'hide-sm' }, 'Rendez-vous'))),
        tbody)));
  },
};
