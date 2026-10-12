-- Pacchetti: un servizio con package_service_ids valorizzato è un pacchetto.
alter table public.services add column if not exists package_service_ids uuid[];
