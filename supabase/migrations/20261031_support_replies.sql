-- Assistenza: risposta scritta dell'admin alle richieste dei titolari
alter table public.support_requests add column if not exists reply text;
alter table public.support_requests add column if not exists replied_at timestamptz;
alter table public.support_requests add column if not exists reply_edited_at timestamptz;
alter table public.support_requests add column if not exists replied_by text;
create index if not exists support_requests_business_idx on public.support_requests (business_id, created_at desc);
