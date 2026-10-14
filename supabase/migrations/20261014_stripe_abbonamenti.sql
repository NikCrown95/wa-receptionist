-- Abbonamenti con Stripe: prova gratuita di 14 giorni, 3 giorni di tolleranza, collegamento con Stripe.

-- Prova gratuita: 14 giorni (letto da signup_confirm)
insert into public.app_settings(key, value, updated_at) values ('trial_days', '14', now())
on conflict (key) do update set value = excluded.value, updated_at = now();

-- Tolleranza dopo la scadenza: 3 giorni (prima 5)
alter table public.subscriptions alter column grace_days set default 3;
update public.subscriptions set grace_days = 3 where grace_days = 5;

-- Collegamento con Stripe
alter table public.subscriptions add column if not exists stripe_customer_id text;
alter table public.subscriptions add column if not exists stripe_subscription_id text;
alter table public.subscriptions add column if not exists cancel_at_period_end boolean not null default false;
create unique index if not exists subscriptions_stripe_sub_idx on public.subscriptions (stripe_subscription_id) where stripe_subscription_id is not null;
create index if not exists subscriptions_stripe_customer_idx on public.subscriptions (stripe_customer_id) where stripe_customer_id is not null;

-- Eventi gia' ricevuti da Stripe (ogni evento si elabora una sola volta)
create table if not exists public.stripe_events (
  id text primary key,
  type text not null,
  received_at timestamptz not null default now()
);
alter table public.stripe_events enable row level security;
