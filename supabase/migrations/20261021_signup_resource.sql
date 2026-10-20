-- Registrazione: il nuovo account nasce con la sua attività di base (la "risorsa").
-- Senza, Impostazioni, Disponibilità e la pagina di prenotazione rispondono "Nessuna risorsa attiva configurata".
-- Le palestre non hanno una risorsa propria (lezioni e abbonamenti stanno nelle loro tabelle), quindi per loro non si crea.
-- La prova gratuita resta quella di app_settings.trial_days (14 giorni); se manca il valore si usano 14 giorni, non 30.
-- Si può eseguire più volte.

create or replace function public.signup_confirm(p_token_hash text)
 returns table(business_id uuid, agenda_token text, business_name text)
 language plpgsql
 security definer
 set search_path to 'public', 'extensions'
as $function$
declare rec public.pending_signups%rowtype; bid uuid; pid uuid; tdays int;
begin
  select * into rec from public.pending_signups where token_hash=p_token_hash and expires_at>now() for update;
  if not found then return; end if;
  if exists(select 1 from public.business_users where email=rec.email) then
    delete from public.pending_signups where id=rec.id; return;
  end if;
  select id into pid from public.plans where name='Base+Lia' limit 1;
  if pid is null then raise exception 'plan_missing'; end if;
  select coalesce(nullif(value,'')::int, 14) into tdays from public.app_settings where key='trial_days';
  if tdays is null or tdays < 1 or tdays > 365 then tdays := 14; end if;
  insert into public.businesses(name,slug,business_type,timezone,owner_phone,active)
  values (rec.name,rec.slug,rec.business_type,'Europe/Rome',rec.phone,true) returning id into bid;
  if lower(coalesce(rec.business_type,'')) <> 'palestra' then
    insert into public.resources(business_id,name,active,is_staff,is_owner,sort_order)
    values (bid,rec.name,true,false,false,0);
  end if;
  insert into public.subscriptions(business_id,plan_id,status,started_at,trial_ends_at)
  values (bid,pid,'trial',now(),now()+make_interval(days => tdays));
  insert into public.business_users(business_id,email,password_hash) values (bid,rec.email,rec.password_hash);
  insert into public.audit_logs(actor,action,business_id,details)
  values ('signup','create_client',bid,jsonb_build_object('name',rec.name,'plan','ai','status','trial','type',rec.business_type,'source','signup'));
  if rec.ref_code is not null then perform public.referral_attach(bid, rec.ref_code, rec.phone); end if;
  delete from public.pending_signups where id=rec.id;
  return query select b.id,b.agenda_token,b.name from public.businesses b where b.id=bid;
end $function$;
