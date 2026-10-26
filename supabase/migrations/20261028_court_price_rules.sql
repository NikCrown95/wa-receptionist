-- Prezzi per fascia oraria: elenco di regole {days:[1-7], from, to, member, guest} per campo
alter table public.courts add column if not exists price_rules jsonb;
