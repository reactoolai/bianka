/*
  # Notaires Alma — schéma initial

  1. Tables
    - `staff`        : membres du personnel autorisés dans l'admin (lien vers auth.users)
    - `rendez_vous`  : demandes de rendez-vous envoyées depuis le site
    - `messages`     : messages du formulaire de contact

  2. Sécurité (RLS)
    - Le public (anon) peut seulement INSÉRER une demande, avec consentement obligatoire.
      Il ne peut ni lire, ni modifier, ni supprimer.
    - Seul le personnel inscrit dans `staff` peut lire, modifier et supprimer.

  3. Loi 25
    - Le texte et la date du consentement sont conservés avec chaque demande.
    - `purger_demandes_expirees()` supprime les demandes non converties de plus de 12 mois.
*/

-- ---------- Personnel ----------
create table if not exists public.staff (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  nom        text not null,
  role       text not null default 'reception' check (role in ('admin', 'notaire', 'reception')),
  notaire    text check (notaire in ('bianka', 'alexandre')),
  created_at timestamptz not null default now()
);
alter table public.staff enable row level security;

create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.staff where user_id = auth.uid());
$$;

create policy "Le personnel voit le personnel"
  on public.staff for select to authenticated
  using (public.is_staff());

-- ---------- Rendez-vous ----------
create table if not exists public.rendez_vous (
  id                  uuid primary key default gen_random_uuid(),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  notaire             text not null check (notaire in ('bianka', 'alexandre', 'indifferent')),
  motif               text not null check (char_length(motif) between 1 and 120),
  moment              text check (char_length(moment) <= 60),
  message             text check (char_length(message) <= 800),
  nom                 text not null check (char_length(nom) between 2 and 120),
  telephone           text not null check (char_length(telephone) between 7 and 30),
  courriel            text not null check (courriel ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' and char_length(courriel) <= 160),
  consent_traitement  boolean not null check (consent_traitement = true),
  consent_infolettre  boolean not null default false,
  consent_texte       text not null,
  consent_at          timestamptz not null default now(),
  statut              text not null default 'nouveau'
                        check (statut in ('nouveau', 'a_rappeler', 'confirme', 'termine', 'annule')),
  date_rdv            timestamptz,
  notes_internes      text,
  mandat_ouvert       boolean not null default false
);
alter table public.rendez_vous enable row level security;
create index if not exists rendez_vous_created_idx on public.rendez_vous (created_at desc);
create index if not exists rendez_vous_statut_idx on public.rendez_vous (statut);

create policy "Le public peut envoyer une demande"
  on public.rendez_vous for insert to anon, authenticated
  with check (
    consent_traitement = true
    and statut = 'nouveau'
    and date_rdv is null
    and notes_internes is null
    and mandat_ouvert = false
  );

create policy "Le personnel lit les demandes"
  on public.rendez_vous for select to authenticated using (public.is_staff());
create policy "Le personnel modifie les demandes"
  on public.rendez_vous for update to authenticated using (public.is_staff()) with check (public.is_staff());
create policy "Le personnel supprime les demandes"
  on public.rendez_vous for delete to authenticated using (public.is_staff());

-- ---------- Messages ----------
create table if not exists public.messages (
  id                 uuid primary key default gen_random_uuid(),
  created_at         timestamptz not null default now(),
  nom                text not null check (char_length(nom) between 2 and 120),
  courriel           text not null check (courriel ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' and char_length(courriel) <= 160),
  message            text not null check (char_length(message) between 1 and 1000),
  consent_traitement boolean not null check (consent_traitement = true),
  consent_texte      text not null,
  consent_at         timestamptz not null default now(),
  statut             text not null default 'nouveau' check (statut in ('nouveau', 'traite', 'archive')),
  notes_internes     text
);
alter table public.messages enable row level security;
create index if not exists messages_created_idx on public.messages (created_at desc);

create policy "Le public peut envoyer un message"
  on public.messages for insert to anon, authenticated
  with check (consent_traitement = true and statut = 'nouveau' and notes_internes is null);
create policy "Le personnel lit les messages"
  on public.messages for select to authenticated using (public.is_staff());
create policy "Le personnel modifie les messages"
  on public.messages for update to authenticated using (public.is_staff()) with check (public.is_staff());
create policy "Le personnel supprime les messages"
  on public.messages for delete to authenticated using (public.is_staff());

-- ---------- Mise à jour automatique de updated_at ----------
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

drop trigger if exists rendez_vous_touch on public.rendez_vous;
create trigger rendez_vous_touch before update on public.rendez_vous
  for each row execute function public.touch_updated_at();

-- ---------- Loi 25 : destruction après 12 mois ----------
create or replace function public.purger_demandes_expirees()
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.rendez_vous where mandat_ouvert = false and created_at < now() - interval '12 months';
  delete from public.messages    where created_at < now() - interval '12 months';
$$;
revoke all on function public.purger_demandes_expirees() from public, anon, authenticated;

-- ---------- Temps réel pour l'admin ----------
do $$ begin
  alter publication supabase_realtime add table public.rendez_vous, public.messages;
exception when others then null; end $$;
