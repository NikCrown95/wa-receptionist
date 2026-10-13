-- Stato "no_show" (cliente non presentato) ammesso sugli appuntamenti
alter table public.appointments drop constraint if exists appointments_status_check;
alter table public.appointments add constraint appointments_status_check
  check (status = any (array['confirmed'::text, 'cancelled'::text, 'no_show'::text]));
