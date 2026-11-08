-- Email al titolare per ogni nuova prenotazione e disdetta del cliente: facoltativa, spenta di default.
alter table public.businesses add column if not exists notify_email boolean not null default false;
