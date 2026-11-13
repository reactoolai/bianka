import { h, chip, fmtAgo, fmtDateTime, NOTAIRES, STATUTS_RDV } from '../ui.js';

export default {
  id: 'apercu',
  label: 'Aperçu',
  icon: 'M4 4h7v7H4z M13 4h7v4h-7z M13 10h7v10h-7z M4 13h7v7H4z',

  async render(ctx) {
    const [rdv, msgs] = await Promise.all([ctx.store.list('rendez_vous'), ctx.store.list('messages')]);
    const now = Date.now();
    const nouveaux = rdv.filter((r) => r.statut === 'nouveau');
    const rappeler = rdv.filter((r) => r.statut === 'a_rappeler');
    const avenir = rdv.filter((r) => r.statut === 'confirme' && r.date_rdv && new Date(r.date_rdv) >= now)
      .sort((a, b) => new Date(a.date_rdv) - new Date(b.date_rdv));
    const msgNew = msgs.filter((m) => m.statut === 'nouveau');
    const mois = rdv.filter((r) => now - new Date(r.created_at) < 30 * 86400000);

    const kpi = (n, label, target) => h('button', { class: 'kpi', type: 'button', onclick: () => ctx.go(target) },
      h('strong', {}, String(n)), h('span', {}, label));

    const parNotaire = Object.keys(NOTAIRES).map((k) => ({ k, n: mois.filter((r) => r.notaire === k).length }));
    const max = Math.max(1, ...parNotaire.map((x) => x.n));
    const motifs = Object.entries(mois.reduce((a, r) => ({ ...a, [r.motif]: (a[r.motif] || 0) + 1 }), {})).sort((a, b) => b[1] - a[1]).slice(0, 5);

    const hello = new Date().getHours() < 12 ? 'Bonjour' : 'Bon après-midi';
    return h('section', {},
      h('header', { class: 'page-head' }, h('div', {}, h('p', { class: 'script-adm' }, `${hello},`), h('h1', {}, ctx.user.nom || 'l’équipe'))),
      h('div', { class: 'kpis' },
        kpi(nouveaux.length, 'nouvelles demandes', 'rendez-vous'),
        kpi(rappeler.length, 'à rappeler', 'rendez-vous'),
        kpi(avenir.length, 'rendez-vous à venir', 'rendez-vous'),
        kpi(msgNew.length, 'messages non traités', 'messages')),
      h('div', { class: 'grid-2' },
        h('div', { class: 'card' }, h('h2', {}, 'À traiter'),
          ...([...nouveaux, ...rappeler].slice(0, 6).map((r) => h('div', { class: 'line' },
            h('span', {}, h('b', {}, r.nom), h('small', {}, ` · ${r.motif} · ${NOTAIRES[r.notaire]}`)),
            h('span', { class: 'line__end' }, chip(STATUTS_RDV, r.statut), h('small', {}, fmtAgo(r.created_at)))))),
          (nouveaux.length + rappeler.length === 0) ? h('p', { class: 'empty' }, 'Tout est à jour.') : null),
        h('div', { class: 'card' }, h('h2', {}, 'Prochains rendez-vous'),
          ...avenir.slice(0, 6).map((r) => h('div', { class: 'line' },
            h('span', {}, h('b', {}, fmtDateTime(r.date_rdv)), h('small', {}, ` · ${r.nom}`)),
            h('span', { class: 'line__end' }, h('small', {}, NOTAIRES[r.notaire])))),
          avenir.length ? null : h('p', { class: 'empty' }, 'Aucun rendez-vous confirmé à venir.'))),
      h('div', { class: 'grid-2' },
        h('div', { class: 'card' }, h('h2', {}, 'Demandes des 30 derniers jours, par notaire'),
          ...parNotaire.map((x) => h('div', { class: 'bar' }, h('span', {}, NOTAIRES[x.k]),
            h('span', { class: 'bar__track' }, h('span', { class: 'bar__fill', style: `width:${(x.n / max) * 100}%` })), h('b', {}, String(x.n))))),
        h('div', { class: 'card' }, h('h2', {}, 'Motifs les plus fréquents (30 jours)'),
          ...(motifs.length ? motifs.map(([m, n]) => h('div', { class: 'line' }, h('span', {}, m), h('b', {}, String(n)))) : [h('p', { class: 'empty' }, 'Pas encore de données.')]))));
  },
};
