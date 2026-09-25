-- Dashboard V3: persistent business closures.
-- Prepared only; apply to Supabase after explicit approval.
create table if not exists public.business_blocks (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  date date not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  created_at timestamptz not null default now(),
  constraint business_blocks_valid_range check (ends_at > starts_at)
);

create index if not exists business_blocks_business_date_idx
  on public.business_blocks (business_id, date);

alter table public.business_blocks enable row level security;

-- No public policies: dashboard/server accesses this table with the server-side Supabase secret.
