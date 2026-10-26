-- Orari propri del campo: se true il campo non segue gli orari del circolo
alter table public.courts add column if not exists custom_hours boolean not null default false;
