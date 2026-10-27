-- Modalita' dei servizi (in sede / a domicilio / online), prezzo per modalita' e prenotazione a mezz'ore.
-- Ogni modalita' di un servizio e' una riga; le righe dello stesso servizio hanno lo stesso group_id.
alter table public.services add column if not exists mode text;
alter table public.services add column if not exists group_id uuid;
alter table public.services add column if not exists half_hour boolean not null default false;
create index if not exists services_group_idx on public.services (business_id, group_id);
