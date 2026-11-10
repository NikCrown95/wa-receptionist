-- Cassaforte della super dashboard: contiene solo testo cifrato nel browser (AES-256-GCM).
-- Il server e Supabase non vedono mai password ne' contenuto in chiaro.
create table if not exists public.admin_vault (
  id text primary key default 'main',
  blob text not null,
  version integer not null default 1,
  updated_at timestamptz not null default now(),
  updated_by text
);
alter table public.admin_vault enable row level security;
revoke all on public.admin_vault from anon, authenticated;
