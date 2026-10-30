-- Modalita' offerte dall'attivita', scelte in registrazione: online e prenotazione a mezz'ore.
-- (a domicilio e' gia' deciso dalle zone/servizi a domicilio; in sede c'e' sempre)
alter table public.businesses add column if not exists offers_online boolean not null default false;
alter table public.businesses add column if not exists half_hour_ok boolean not null default false;
-- chi le usa gia' le mantiene
update public.businesses b set offers_online = true
  where exists (select 1 from public.services s where s.business_id = b.id and s.mode = 'online' and s.active);
update public.businesses b set half_hour_ok = true
  where exists (select 1 from public.services s where s.business_id = b.id and s.half_hour and s.active);
