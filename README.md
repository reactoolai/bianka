# Notaires Alma — site Vite + admin

Me Bianka Villeneuve & Me Alexandre Demers-Bergeron, notaires — 401, avenue Du Pont Nord, Alma.

## Démarrer
```
npm install
npm run dev
```
Production : `npm run build` → `dist/`.

## Structure
- `*.html` — une page par fichier (accueil, bianka, alexandre, equipe, services, rendez-vous, faq, contact, confidentialite)
- `partials/nav.html`, `partials/footer.html` — menu et pied de page partagés, insérés par `vite.config.js`
  (`<!-- @nav bianka -->` marque la page courante, `<!-- @footer -->`)
- `src/style.css` — identité (brun d’encre + or plume, Archivo / Inter Tight / Cinzel / Herr Von Muellerhoff, polices auto-hébergées)
- `src/forms.js` — envoi des formulaires (Supabase, ou courriel pré-rempli si Supabase n’est pas branché)
- `admin.html` + `src/admin/` — tableau de bord de l’étude

## Base de données (Supabase)
1. Dans Bolt, connecter Supabase (région **Canada – ca-central-1** de préférence, Loi 25).
   Bolt crée le fichier `.env` avec `VITE_SUPABASE_URL` et `VITE_SUPABASE_ANON_KEY` (voir `.env.example`).
2. Appliquer la migration `supabase/migrations/20261112000000_notaires_alma_init.sql`.
3. Créer les comptes du personnel : Supabase → Authentication → Add user, puis dans le SQL Editor :
   ```sql
   insert into public.staff (user_id, nom, role, notaire)
   select id, 'Me Bianka Villeneuve', 'admin', 'bianka' from auth.users where email = 'bvilleneuve@notarius.net';
   ```
4. (Recommandé) Planifier la purge Loi 25 avec pg_cron : `select cron.schedule('purge-12-mois', '0 3 * * *', 'select public.purger_demandes_expirees()');`

Sécurité : le public peut seulement **insérer** une demande (avec consentement obligatoire) ; seule une personne inscrite dans `staff` peut lire, modifier ou supprimer.

## Admin — ajouter une section
1. Créer `src/admin/modules/ma-section.js` sur le modèle de `messages.js` (`id`, `label`, `icon`, `render(ctx)`).
2. L’ajouter à la liste `MODULES` dans `src/admin/admin.js`.
3. Si elle a besoin d’une table, ajouter une migration dans `supabase/migrations/`.

Sans Supabase, `/admin.html` propose un **mode démo** avec des données fictives.
