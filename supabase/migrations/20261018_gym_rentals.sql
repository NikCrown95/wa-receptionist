-- Affitto sala: un'ora della palestra data in subaffitto a chi tiene corsi (prenotazione pubblica, senza iscrizione)
create table if not exists public.gym_rentals (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  session_date date not null,
  start_time time not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  first_name text not null,
  last_name text not null,
  phone text not null,
  email text not null,
  price_eur numeric(8,2),
  status text not null default 'confirmed' check (status in ('confirmed','cancelled')),
  created_at timestamptz not null default now(),
  cancelled_at timestamptz,
  cancelled_by text
);
create unique index if not exists gym_rental_slot_uq on public.gym_rentals (business_id, starts_at) where status = 'confirmed';
create index if not exists gym_rental_biz_idx on public.gym_rentals (business_id, session_date) where status = 'confirmed';
alter table public.gym_rentals enable row level security;
-- Nessuna policy pubblica: il server accede con la chiave segreta.

alter table public.notification_events drop constraint if exists notification_events_event_type_check;
alter table public.notification_events
  add constraint notification_events_event_type_check
  check (event_type in ('booked','cancelled','weekly_recap','closures_reminder','feedback_ask','rental_booked','rental_cancelled'));
