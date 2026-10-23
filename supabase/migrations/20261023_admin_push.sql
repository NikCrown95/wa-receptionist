-- Notifiche push sul telefono dell'admin (super dashboard): un dispositivo = una riga.
create table if not exists public.admin_push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  actor text,
  user_agent text,
  created_at timestamptz not null default now()
);
alter table public.admin_push_subscriptions enable row level security;
