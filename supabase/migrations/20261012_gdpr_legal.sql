-- Dati legali dell'attività (informativa privacy) e registro accettazione termini
alter table businesses add column if not exists legal_name text;
alter table businesses add column if not exists vat_number text;
alter table businesses add column if not exists privacy_email text;
create table if not exists public.terms_acceptances (
  id bigint generated always as identity primary key,
  email text not null,
  version text not null,
  accepted_at timestamptz not null default now()
);
alter table public.terms_acceptances enable row level security;
create index if not exists terms_acceptances_email_idx on public.terms_acceptances (email);
