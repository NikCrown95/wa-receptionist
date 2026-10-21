-- Logo dell'attività: un'unica immagine usata come foto del profilo e nella pagina di prenotazione.
-- L'immagine (già ridotta a 256x256 dal telefono/iPad) sta in una tabella a parte, così le letture normali delle attività restano leggere.
alter table public.businesses add column if not exists logo_v integer not null default 0;

create table if not exists public.business_logos (
  business_id uuid primary key references public.businesses(id) on delete cascade,
  mime text not null,
  data text not null,
  updated_at timestamptz not null default now()
);
alter table public.business_logos enable row level security;
