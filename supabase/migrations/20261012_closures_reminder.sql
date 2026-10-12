-- Promemoria del lunedi' per chiusure, ferie e assenze (notifica "closures_reminder" nella campanella).
-- Da incollare nello SQL editor di Supabase.

alter table public.notification_events drop constraint if exists notification_events_event_type_check;
alter table public.notification_events
  add constraint notification_events_event_type_check
  check (event_type in ('booked', 'cancelled', 'weekly_recap', 'closures_reminder'));

-- Un solo promemoria per attivita' e per settimana
create unique index if not exists notification_events_closures_reminder_uniq
  on public.notification_events (business_id, ((meta ->> 'week')))
  where event_type = 'closures_reminder';
