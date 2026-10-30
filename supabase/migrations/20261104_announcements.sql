-- Annunci dalla super dashboard a tutte le attivita': compaiono nel pannello Avvisi di Lia (icona con la "a")
create table if not exists public.announcements (
  id uuid primary key default gen_random_uuid(),
  kind text not null default 'notice' check (kind in ('maintenance','news','notice')),
  title text,
  message text not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  active boolean not null default true,
  created_by text
);
create index if not exists announcements_live_idx on public.announcements (active, expires_at desc);
alter table public.announcements enable row level security;
