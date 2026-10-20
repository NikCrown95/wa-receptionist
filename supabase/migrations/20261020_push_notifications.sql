-- Notifiche push sul telefono del titolare: un dispositivo = una riga.
create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now()
);
create index if not exists push_subscriptions_business_idx on public.push_subscriptions (business_id);
alter table public.push_subscriptions enable row level security;
