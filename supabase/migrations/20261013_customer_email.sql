-- Email del cliente (facoltativa) e promemoria inviato.
-- Da eseguire nell'editor SQL di Supabase PRIMA di pubblicare la funzione.
alter table appointments
  add column if not exists customer_email text,
  add column if not exists reminder_sent_at timestamptz;

-- Indice per trovare in fretta i promemoria ancora da mandare.
create index if not exists appointments_reminder_todo_idx
  on appointments (starts_at)
  where status = 'confirmed' and customer_email is not null and reminder_sent_at is null;
