-- Tempo per spostarsi (minuti) per chi lavora a domicilio. 0 = nessuno.
alter table public.businesses add column if not exists travel_min integer not null default 0;
