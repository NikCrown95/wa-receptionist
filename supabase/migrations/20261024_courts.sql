-- Campi sportivi (tennis per primo): campi, orari e prenotazioni, separati dal resto della dashboard.
-- Un'attivita' "centro_sportivo" ha piu' campi; ogni campo ha la sua durata di slot e un prezzo facoltativo.
-- La prenotazione e' di una persona (referente) che indica quanti giocatori sono soci.
create extension if not exists btree_gist;

create table if not exists public.courts (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  name text not null,
  sport text not null default 'tennis' check (sport in ('tennis','padel','calcio','altro')),
  surface text,
  indoor boolean not null default false,
  slot_min integer not null default 60 check (slot_min between 30 and 240),
  price_eur numeric(8,2) check (price_eur is null or price_eur >= 0),
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists courts_business_idx on public.courts (business_id, sort_order);

-- Orari di apertura di ogni campo (weekday 1=lunedi ... 7=domenica); piu' righe per lo stesso giorno = pausa.
create table if not exists public.court_hours (
  id uuid primary key default gen_random_uuid(),
  court_id uuid not null references public.courts(id) on delete cascade,
  weekday integer not null check (weekday between 1 and 7),
  opens time not null,
  closes time not null,
  constraint court_hours_order check (opens < closes)
);
create index if not exists court_hours_court_idx on public.court_hours (court_id, weekday);

create table if not exists public.court_bookings (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  court_id uuid not null references public.courts(id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status text not null default 'confirmed' check (status in ('confirmed','cancelled')),
  first_name text not null,
  last_name text not null,
  phone text not null,
  email text,
  players integer check (players is null or players between 1 and 22),
  members integer check (members is null or members >= 0),
  fit_declared boolean not null default false,
  price_eur numeric(8,2),
  channel text not null default 'web' check (channel in ('web','chat','manual')),
  notes text,
  created_at timestamptz not null default now(),
  cancelled_at timestamptz,
  cancelled_by text,
  constraint court_bookings_time check (ends_at > starts_at),
  constraint court_bookings_members_le_players check (members is null or players is null or members <= players),
  -- un campo non puo' avere due prenotazioni confermate nello stesso momento
  constraint court_bookings_no_overlap exclude using gist (court_id with =, tstzrange(starts_at, ends_at) with &&) where (status = 'confirmed')
);
create index if not exists court_bookings_biz_day_idx on public.court_bookings (business_id, starts_at);
create index if not exists court_bookings_phone_idx on public.court_bookings (business_id, phone);

alter table public.courts enable row level security;
alter table public.court_hours enable row level security;
alter table public.court_bookings enable row level security;
-- Nessuna policy pubblica: il server accede con la chiave segreta.
