-- Personal trainer: i pacchetti sono servizi con un numero di ingressi; ogni iscritto ha i suoi pacchetti (pt_packs)
-- e ogni lezione prenotata scala un ingresso (appointments.pt_pack_id).
alter table services add column if not exists entries integer;
create table if not exists pt_packs (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  customer_name text not null,
  customer_phone text not null,
  service_id uuid references services(id) on delete set null,
  pack_name text not null,
  entries_total integer not null check (entries_total >= 1),
  price_eur numeric,
  created_at timestamptz not null default now()
);
create index if not exists pt_packs_business_phone_idx on pt_packs (business_id, customer_phone);
alter table pt_packs enable row level security;
alter table appointments add column if not exists pt_pack_id uuid references pt_packs(id) on delete set null;
create index if not exists appointments_pt_pack_idx on appointments (pt_pack_id) where pt_pack_id is not null;
