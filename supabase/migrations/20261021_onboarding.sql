-- Percorso guidato dopo la registrazione.
--  service_areas : città dove l'attività va a domicilio (vuoto = nessun limite)
--  onboarded_at  : quando ha finito il percorso guidato (vuoto = deve ancora farlo)
-- Gli account già esistenti risultano già "fatti", così non vedono il percorso.
-- Si può eseguire più volte: la data fissa evita di marcare come "fatti" gli account nuovi.

alter table public.businesses add column if not exists service_areas text[] not null default '{}';
alter table public.businesses add column if not exists onboarded_at timestamptz;

update public.businesses
   set onboarded_at = coalesce(created_at, now())
 where onboarded_at is null
   and created_at < timestamptz '2026-10-21 12:00:00+00';
