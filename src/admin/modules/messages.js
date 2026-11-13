import { h, chip, drawer, closeDrawer, toast, fmtAgo, fmtDateTime, STATUTS_MSG } from '../ui.js';

export default {
  id: 'messages',
  label: 'Messages',
  icon: 'M4 6h16v12H4z M4 7l8 6 8-6',
  table: 'messages',
  badge: (rows) => rows.filter((r) => r.statut === 'nouveau').length,

  async render(ctx) {
    let rows = await ctx.store.list('messages');
    let showArchived = false;
    const list = h('div', { class: 'msg-list' });

    const paint = () => {
      const items = rows.filter((r) => showArchived || r.statut !== 'archive');
      list.replaceChildren(...(items.length ? items.map((r) => h('button', { type: 'button', class: `msg ${r.statut === 'nouveau' ? 'is-new' : ''}`, onclick: () => open(r) },
        h('span', { class: 'msg__top' }, h('b', {}, r.nom), h('small', {}, fmtAgo(r.created_at))),
        h('span', { class: 'msg__text' }, r.message),
        chip(STATUTS_MSG, r.statut))) : [h('p', { class: 'empty' }, 'Aucun message.')]));
    };

    const open = (r) => {
      const statut = h('select', {}, ...Object.entries(STATUTS_MSG).map(([k, v]) => h('option', { value: k, selected: r.statut === k }, v.label)));
      const notes = h('textarea', { rows: '3', placeholder: 'Visible uniquement par l’équipe' });
      notes.value = r.notes_internes || '';
      const save = async () => {
        const patch = { statut: statut.value, notes_internes: notes.value.trim() || null };
        try { await ctx.store.update('messages', r.id, patch); Object.assign(r, patch); paint(); ctx.refreshBadges(); closeDrawer(); toast('Message mis à jour'); }
        catch (e) { console.error(e); toast('Erreur d’enregistrement'); }
      };
      const del = async () => {
        if (!confirm(`Supprimer définitivement le message de ${r.nom} ?`)) return;
        try { await ctx.store.remove('messages', r.id); rows = rows.filter((x) => x.id !== r.id); paint(); ctx.refreshBadges(); closeDrawer(); toast('Message supprimé'); }
        catch (e) { console.error(e); toast('Erreur : suppression impossible'); }
      };
      drawer(r.nom, [
        h('div', { class: 'quick' }, h('a', { class: 'btn-adm btn-adm--dark', href: `mailto:${r.courriel}?subject=${encodeURIComponent('Votre message à Notaires Alma')}` }, `Répondre à ${r.courriel}`)),
        h('dl', { class: 'dl' },
          h('dt', {}, 'Reçu'), h('dd', {}, fmtDateTime(r.created_at)),
          h('dt', {}, 'Message'), h('dd', { class: 'pre' }, r.message),
          h('dt', {}, 'Consentement'), h('dd', {}, `Donné le ${fmtDateTime(r.consent_at)}`)),
        h('div', { class: 'form-adm' }, h('label', {}, 'Statut', statut), h('label', {}, 'Notes internes', notes)),
        h('div', { class: 'drawer__actions' },
          h('button', { class: 'btn-adm btn-adm--dark', type: 'button', onclick: save }, 'Enregistrer'),
          h('button', { class: 'btn-adm btn-adm--danger', type: 'button', onclick: del }, 'Supprimer')),
      ]);
    };

    ctx.onLeave(ctx.store.subscribe('messages', (n) => { rows.unshift(n); paint(); ctx.refreshBadges(); toast(`Nouveau message : ${n.nom}`); }));
    paint();
    return h('section', {},
      h('header', { class: 'page-head' }, h('h1', {}, 'Messages'),
        h('label', { class: 'inline' }, h('input', { type: 'checkbox', onchange: (e) => { showArchived = e.target.checked; paint(); } }), 'Afficher les archivés')),
      list);
  },
};
