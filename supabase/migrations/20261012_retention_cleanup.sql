-- Cancellazione automatica dei dati personali (chat 90 giorni, dati clienti 24 mesi, registrazioni non confermate 7 giorni)
create or replace function public.retention_cleanup(p_dry boolean default false)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  n_chat int; n_app int; n_notes int; n_cn int; n_ev int; n_pend int; n_tok int;
begin
  if p_dry then
    select count(*) into n_chat from chat_messages where created_at < now() - interval '90 days';
    select count(*) into n_app from appointments where starts_at < now() - interval '24 months' and customer_phone <> '';
    select count(*) into n_notes from appointment_notes where appointment_id in (select id from appointments where starts_at < now() - interval '24 months');
    select count(*) into n_cn from customer_notes where updated_at < now() - interval '24 months';
    select count(*) into n_ev from notification_events where created_at < now() - interval '24 months' and customer_name is not null;
    select count(*) into n_pend from pending_signups where expires_at < now() - interval '7 days';
    select count(*) into n_tok from auth_tokens where expires_at < now() - interval '30 days';
  else
    delete from chat_messages where created_at < now() - interval '90 days';
    get diagnostics n_chat = row_count;
    delete from appointment_notes where appointment_id in (select id from appointments where starts_at < now() - interval '24 months');
    get diagnostics n_notes = row_count;
    update appointments set customer_name = 'Cliente rimosso', customer_phone = '', customer_address = null, notes = null, contact_id = null
      where starts_at < now() - interval '24 months' and customer_phone <> '';
    get diagnostics n_app = row_count;
    delete from customer_notes where updated_at < now() - interval '24 months';
    get diagnostics n_cn = row_count;
    update notification_events set customer_name = null where created_at < now() - interval '24 months' and customer_name is not null;
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
