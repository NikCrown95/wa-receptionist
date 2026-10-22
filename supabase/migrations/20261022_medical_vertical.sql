-- Verticale sanitaria (dentisti, fisioterapisti, studi medici) - 22 ottobre 2026
-- 1) consenso esplicito del paziente, registrato con data e versione dell'informativa
-- 2) conservazione piu' breve: dati personali anonimizzati dopo 12 mesi (le altre attivita': 24)
-- 3) la pulizia automatica ora toglie anche l'email dei clienti (prima restava)

alter table public.appointments add column if not exists privacy_consent_at timestamptz;
alter table public.appointments add column if not exists privacy_consent_version text;

create or replace function public.retention_cleanup(p_dry boolean default false)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  n_chat int; n_app int; n_notes int; n_cn int; n_ev int; n_pend int; n_tok int;
  med text[] := array['dentista','studio medico','fisioterapista'];
begin
  if p_dry then
    select count(*) into n_chat from chat_messages where created_at < now() - interval '90 days';
    select count(*) into n_app from appointments a
      where a.customer_phone <> '' and a.starts_at < now() - (case when exists (select 1 from businesses b where b.id = a.business_id and lower(trim(b.business_type)) = any (med)) then interval '12 months' else interval '24 months' end);
    select count(*) into n_notes from appointment_notes where appointment_id in (
      select a.id from appointments a where a.starts_at < now() - (case when exists (select 1 from businesses b where b.id = a.business_id and lower(trim(b.business_type)) = any (med)) then interval '12 months' else interval '24 months' end));
    select count(*) into n_cn from customer_notes c
      where c.updated_at < now() - (case when exists (select 1 from businesses b where b.id = c.business_id and lower(trim(b.business_type)) = any (med)) then interval '12 months' else interval '24 months' end);
    select count(*) into n_ev from notification_events e
      where e.customer_name is not null and e.created_at < now() - (case when exists (select 1 from businesses b where b.id = e.business_id and lower(trim(b.business_type)) = any (med)) then interval '12 months' else interval '24 months' end);
    select count(*) into n_pend from pending_signups where expires_at < now() - interval '7 days';
    select count(*) into n_tok from auth_tokens where expires_at < now() - interval '30 days';
  else
    delete from chat_messages where created_at < now() - interval '90 days';
    get diagnostics n_chat = row_count;
    delete from appointment_notes where appointment_id in (
      select a.id from appointments a where a.starts_at < now() - (case when exists (select 1 from businesses b where b.id = a.business_id and lower(trim(b.business_type)) = any (med)) then interval '12 months' else interval '24 months' end));
    get diagnostics n_notes = row_count;
    update appointments a set customer_name = 'Cliente rimosso', customer_phone = '', customer_address = null, customer_email = null, notes = null, contact_id = null
      where a.customer_phone <> '' and a.starts_at < now() - (case when exists (select 1 from businesses b where b.id = a.business_id and lower(trim(b.business_type)) = any (med)) then interval '12 months' else interval '24 months' end);
    get diagnostics n_app = row_count;
    delete from customer_notes c
      where c.updated_at < now() - (case when exists (select 1 from businesses b where b.id = c.business_id and lower(trim(b.business_type)) = any (med)) then interval '12 months' else interval '24 months' end);
    get diagnostics n_cn = row_count;
    update notification_events e set customer_name = null
      where e.customer_name is not null and e.created_at < now() - (case when exists (select 1 from businesses b where b.id = e.business_id and lower(trim(b.business_type)) = any (med)) then interval '12 months' else interval '24 months' end);
    get diagnostics n_ev = row_count;
    delete from pending_signups where expires_at < now() - interval '7 days';
    get diagnostics n_pend = row_count;
    delete from auth_tokens where expires_at < now() - interval '30 days';
    get diagnostics n_tok = row_count;
  end if;
  return jsonb_build_object('dry', p_dry, 'chat_messages', n_chat, 'appointments_anonymized', n_app, 'appointment_notes', n_notes, 'customer_notes', n_cn, 'notification_events', n_ev, 'pending_signups', n_pend, 'auth_tokens', n_tok);
end $$;
revoke all on function public.retention_cleanup(boolean) from public, anon, authenticated;
grant execute on function public.retention_cleanup(boolean) to service_role;
