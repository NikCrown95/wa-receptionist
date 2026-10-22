-- Sconti e promozioni: prezzo scontato per un servizio in un periodo.
create table if not exists public.promotions (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  service_id uuid not null references public.services(id) on delete cascade,
  promo_price_eur numeric(10,2) not null check (promo_price_eur >= 0),
  starts_on date not null,
  ends_on date not null,
  created_at timestamptz not null default now(),
  constraint promotions_valid_range check (ends_on >= starts_on)
);

create index if not exists promotions_business_end_idx
  on public.promotions (business_id, ends_on);

alter table public.promotions enable row level security;
-- Nessuna policy pubblica: ci accede solo il server con la chiave segreta.

-- Prezzo realmente applicato alla prenotazione (serve a incassi e statistiche).
alter table public.appointments add column if not exists promo_price_eur numeric(10,2);
