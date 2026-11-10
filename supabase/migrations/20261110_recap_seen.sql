-- Pannello di Lia: avvisi letti, condivisi tra tutti i dispositivi del titolare (chiave -> timestamp in ms).
alter table public.businesses add column if not exists recap_seen jsonb not null default '{}'::jsonb;
