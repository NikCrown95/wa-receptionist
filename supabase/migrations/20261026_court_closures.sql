-- Chiusure e indisponibilita' straordinarie dei campi (tornei, manutenzione, pioggia...).
-- court_id vuoto = vale per tutti i campi del circolo. Senza orario = tutto il giorno.
create table if not exists public.court_closures (
  id          uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  court_id    uuid references public.courts(id) on delete cascade,
  starts_on   date not null,
  ends_on     date not null,
  from_time   time,
  to_time     time,
  reason      text,
  created_at  timestamptz not null default now(),
  constraint court_closures_dates check (ends_on >= starts_on),
  constraint court_closures_times check ((from_time is null) = (to_time is null) and (to_time is null or to_time > from_time))
);
create index if not exists court_closures_biz_idx on public.court_closures (business_id, starts_on, ends_on);
alter table public.court_closures enable row level security;
