-- Super dashboard: registro scadenze e contatore delle email inviate (Resend).
-- Solo tabelle nuove, nessun dato esistente viene toccato. Si puo' eseguire piu' volte.

create table if not exists public.admin_expiries (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 80),
  note text check (note is null or char_length(note) <= 160),
  due_date date not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists admin_expiries_due_idx on public.admin_expiries (due_date) where active;
alter table public.admin_expiries enable row level security;

-- una riga per ogni email partita davvero (niente indirizzi, niente testo): serve solo a contare
create table if not exists public.email_log (
  id bigint generated always as identity primary key,
  at timestamptz not null default now()
);
create index if not exists email_log_at_idx on public.email_log (at);
alter table public.email_log enable row level security;
