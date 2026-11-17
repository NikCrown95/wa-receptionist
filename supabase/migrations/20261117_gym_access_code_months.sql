-- Palestra: codice di accesso dell'iscritto (lo sceglie il titolare, serve per entrare e prenotare)
-- e validità in mesi dei pacchetti (come i pacchetti dei personal trainer). Si può eseguire più volte.
alter table public.gym_members add column if not exists access_code text;
create unique index if not exists gym_members_code_uq on public.gym_members (business_id, lower(access_code)) where access_code is not null and active;
alter table public.gym_plans add column if not exists months integer;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'gym_plans_months_chk') then
    alter table public.gym_plans add constraint gym_plans_months_chk check (months is null or (months >= 1 and months <= 36));
  end if;
end $$;
