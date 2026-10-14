-- Boutique Gym: abbonamento mensile con limiti (ingressi al mese e a settimana), Personal 1:1 e assenze.
-- Compatibile con quello che c'è già: le colonne nuove sono facoltative, le vecchie palestre funzionano come prima.

-- 1) Limiti nel tipo di abbonamento e nella copia venduta all'iscritto (vuoto = nessun limite)
alter table public.gym_plans add column if not exists max_entries integer check (max_entries is null or max_entries > 0);
alter table public.gym_plans add column if not exists max_per_week integer check (max_per_week is null or max_per_week > 0);
alter table public.gym_member_plans add column if not exists max_entries integer;
alter table public.gym_member_plans add column if not exists max_per_week integer;

-- 2) Assenze: il titolare può segnare chi non si è presentato (l'ingresso resta usato)
alter table public.gym_bookings add column if not exists no_show boolean not null default false;

-- 3) Personal 1:1: un'ora con il trainer, nelle ore senza corso
create table if not exists public.gym_pt_bookings (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  member_id uuid not null references public.gym_members(id) on delete cascade,
  session_date date not null,
  start_time time not null,
  starts_at timestamptz not null,
  status text not null default 'confirmed' check (status in ('confirmed','cancelled')),
  used_member_plan_id uuid references public.gym_member_plans(id) on delete set null,
  no_show boolean not null default false,
  created_at timestamptz not null default now(),
  cancelled_at timestamptz
);
create unique index if not exists gym_pt_slot_uq on public.gym_pt_bookings (business_id, session_date, start_time) where status = 'confirmed';
create index if not exists gym_pt_member_idx on public.gym_pt_bookings (member_id, session_date) where status = 'confirmed';
create index if not exists gym_bookings_member_date_idx on public.gym_bookings (member_id, session_date) where status = 'confirmed';
alter table public.gym_pt_bookings enable row level security;
-- Nessuna policy pubblica: il server accede con la chiave segreta.

-- 4) Controllo dei limiti: ritorna il motivo del rifiuto oppure null
create or replace function public.gym_caps_error(p_member uuid, p_plan uuid, p_date date)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_plan record;
  v_n integer;
  v_wk date;
begin
  select * into v_plan from gym_member_plans where id = p_plan;
  if not found then return null; end if;
  if v_plan.max_per_week is not null then
    v_wk := date_trunc('week', p_date::timestamp)::date; -- lunedì della settimana
    select (select count(*) from gym_bookings b where b.member_id = p_member and b.status = 'confirmed' and b.session_date >= v_wk and b.session_date < v_wk + 7)
         + (select count(*) from gym_pt_bookings t where t.member_id = p_member and t.status = 'confirmed' and t.session_date >= v_wk and t.session_date < v_wk + 7)
      into v_n;
    if v_n >= v_plan.max_per_week then
      return 'In quella settimana ci sono già ' || v_plan.max_per_week || ' ingressi prenotati (il massimo).';
    end if;
  end if;
  if v_plan.max_entries is not null then
    select (select count(*) from gym_bookings b where b.member_id = p_member and b.status = 'confirmed' and b.session_date >= v_plan.starts_on and (v_plan.ends_on is null or b.session_date <= v_plan.ends_on))
         + (select count(*) from gym_pt_bookings t where t.member_id = p_member and t.status = 'confirmed' and t.session_date >= v_plan.starts_on and (v_plan.ends_on is null or t.session_date <= v_plan.ends_on))
      into v_n;
    if v_n >= v_plan.max_entries then
      return 'Gli ' || v_plan.max_entries || ' ingressi del mese sono già stati prenotati.';
    end if;
  end if;
  return null;
end;
$$;

-- 5) Prenotazione di una lezione: come prima, più i limiti dell'abbonamento
create or replace function public.gym_book(p_business uuid, p_member uuid, p_schedule uuid, p_date date, p_now timestamptz default now())
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sched record;
  v_course record;
  v_biz record;
  v_start timestamptz;
  v_cap integer;
  v_taken integer;
  v_plan record;
  v_id uuid;
  v_member record;
  v_err text;
begin
  select * into v_member from gym_members where id = p_member and business_id = p_business and active;
  if not found then return jsonb_build_object('ok', false, 'code', 'member', 'message', 'Iscritto non trovato.'); end if;

  select s.* into v_sched from gym_schedule s where s.id = p_schedule and s.business_id = p_business and s.active;
  if not found then return jsonb_build_object('ok', false, 'code', 'schedule', 'message', 'Lezione non trovata.'); end if;
  select * into v_course from gym_courses where id = v_sched.course_id and active;
  if not found then return jsonb_build_object('ok', false, 'code', 'schedule', 'message', 'Corso non disponibile.'); end if;
  select timezone into v_biz from businesses where id = p_business;

  if extract(isodow from p_date)::int <> v_sched.weekday then
    return jsonb_build_object('ok', false, 'code', 'date', 'message', 'Data non valida per questa lezione.');
  end if;
  v_start := (p_date + v_sched.starts_at_time) at time zone coalesce(v_biz.timezone, 'Europe/Rome');
  if v_start <= p_now then return jsonb_build_object('ok', false, 'code', 'past', 'message', 'Questa lezione è già iniziata.'); end if;
  if exists (select 1 from gym_cancelled_sessions where schedule_id = p_schedule and session_date = p_date) then
    return jsonb_build_object('ok', false, 'code', 'cancelled', 'message', 'Questa lezione è stata annullata.');
  end if;

  -- una prenotazione alla volta per lezione e per iscritto (evita sovrapposizioni tra più richieste)
  perform pg_advisory_xact_lock(hashtextextended(p_schedule::text || p_date::text, 0));
  perform pg_advisory_xact_lock(hashtextextended(p_member::text, 1));

  if exists (select 1 from gym_bookings where member_id = p_member and schedule_id = p_schedule and session_date = p_date and status = 'confirmed') then
    return jsonb_build_object('ok', false, 'code', 'already', 'message', 'Sei già prenotato a questa lezione.');
  end if;

  v_cap := coalesce(v_sched.capacity, v_course.capacity);
  select count(*) into v_taken from gym_bookings where schedule_id = p_schedule and session_date = p_date and status = 'confirmed';
  if v_taken >= v_cap then return jsonb_build_object('ok', false, 'code', 'full', 'message', 'Lezione al completo.'); end if;

  select * into v_plan from gym_member_plans
   where member_id = p_member and not cancelled
     and v_course.category = any(covers)
     and starts_on <= p_date
     and ((kind = 'time' and ends_on >= p_date) or (kind = 'entries' and entries_left > 0 and (ends_on is null or ends_on >= p_date)))
   order by (kind = 'time') desc, ends_on nulls last
   limit 1
   for update;
  if not found then
    if exists (select 1 from gym_member_plans where member_id = p_member and not cancelled and not (v_course.category = any(covers))
               and starts_on <= p_date and ((kind='time' and ends_on >= p_date) or (kind='entries' and entries_left > 0))) then
      return jsonb_build_object('ok', false, 'code', 'not_included', 'message', 'Il tuo abbonamento non include questo corso.');
    end if;
    if exists (select 1 from gym_member_plans where member_id = p_member and not cancelled and kind = 'entries' and entries_left <= 0) then
      return jsonb_build_object('ok', false, 'code', 'no_entries', 'message', 'Hai finito gli ingressi.');
    end if;
    return jsonb_build_object('ok', false, 'code', 'expired', 'message', 'Abbonamento scaduto o non attivo per quel giorno.');
  end if;

  v_err := gym_caps_error(p_member, v_plan.id, p_date);
  if v_err is not null then return jsonb_build_object('ok', false, 'code', 'limit', 'message', v_err); end if;

  if v_plan.kind = 'entries' then
    update gym_member_plans set entries_left = entries_left - 1 where id = v_plan.id;
  end if;

  insert into gym_bookings (business_id, member_id, schedule_id, session_date, starts_at, used_member_plan_id, entry_used)
  values (p_business, p_member, p_schedule, p_date, v_start, v_plan.id, v_plan.kind = 'entries')
  returning id into v_id;

  return jsonb_build_object('ok', true, 'id', v_id, 'starts_at', v_start, 'plan_name', v_plan.plan_name, 'entry_used', v_plan.kind = 'entries',
                            'entries_left', case when v_plan.kind = 'entries' then v_plan.entries_left - 1 else null end);
end;
$$;

-- 6) Prenotazione del Personal 1:1 (un'ora, solo nelle ore senza lezione)
create or replace function public.gym_pt_book(p_business uuid, p_member uuid, p_date date, p_time time, p_now timestamptz default now())
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_member record;
  v_biz record;
  v_start timestamptz;
  v_plan record;
  v_id uuid;
  v_err text;
begin
  select * into v_member from gym_members where id = p_member and business_id = p_business and active;
  if not found then return jsonb_build_object('ok', false, 'code', 'member', 'message', 'Iscritto non trovato.'); end if;
  select timezone into v_biz from businesses where id = p_business;
  v_start := (p_date + p_time) at time zone coalesce(v_biz.timezone, 'Europe/Rome');
  if v_start <= p_now then return jsonb_build_object('ok', false, 'code', 'past', 'message', 'Quest''ora è già passata.'); end if;

  if exists (select 1 from gym_schedule s join gym_courses c on c.id = s.course_id
              where s.business_id = p_business and s.active and c.active and s.weekday = extract(isodow from p_date)::int
                and s.starts_at_time < p_time + interval '1 hour'
                and s.starts_at_time + make_interval(mins => c.duration_min) > p_time) then
    return jsonb_build_object('ok', false, 'code', 'busy', 'message', 'In quell''ora c''è una lezione.');
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_business::text || p_date::text || p_time::text, 2));
  perform pg_advisory_xact_lock(hashtextextended(p_member::text, 1));

  if exists (select 1 from gym_pt_bookings where business_id = p_business and session_date = p_date and start_time = p_time and status = 'confirmed') then
    return jsonb_build_object('ok', false, 'code', 'taken', 'message', 'Quest''ora è già prenotata.');
  end if;

  select * into v_plan from gym_member_plans
   where member_id = p_member and not cancelled
     and 'personal' = any(covers)
     and starts_on <= p_date
     and ((kind = 'time' and ends_on >= p_date) or (kind = 'entries' and entries_left > 0 and (ends_on is null or ends_on >= p_date)))
   order by (kind = 'time') desc, ends_on nulls last
   limit 1
   for update;
  if not found then
    if exists (select 1 from gym_member_plans where member_id = p_member and not cancelled and starts_on <= p_date
               and ((kind='time' and ends_on >= p_date) or (kind='entries' and entries_left > 0))) then
      return jsonb_build_object('ok', false, 'code', 'not_included', 'message', 'Il tuo abbonamento non include il Personal 1:1.');
    end if;
    return jsonb_build_object('ok', false, 'code', 'expired', 'message', 'Abbonamento scaduto o non attivo per quel giorno.');
  end if;

  v_err := gym_caps_error(p_member, v_plan.id, p_date);
  if v_err is not null then return jsonb_build_object('ok', false, 'code', 'limit', 'message', v_err); end if;

  if v_plan.kind = 'entries' then
    update gym_member_plans set entries_left = entries_left - 1 where id = v_plan.id;
  end if;

  insert into gym_pt_bookings (business_id, member_id, session_date, start_time, starts_at, used_member_plan_id)
  values (p_business, p_member, p_date, p_time, v_start, v_plan.id)
  returning id into v_id;

  return jsonb_build_object('ok', true, 'id', v_id, 'starts_at', v_start, 'plan_name', v_plan.plan_name);
end;
$$;

create or replace function public.gym_pt_cancel(p_business uuid, p_member uuid, p_booking uuid, p_cutoff_min integer default 180, p_now timestamptz default now(), p_by_owner boolean default false)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_b record;
begin
  select * into v_b from gym_pt_bookings where id = p_booking and business_id = p_business and status = 'confirmed' for update;
  if not found then return jsonb_build_object('ok', false, 'message', 'Prenotazione non trovata o già disdetta.'); end if;
  if not p_by_owner and v_b.member_id <> p_member then return jsonb_build_object('ok', false, 'message', 'Prenotazione non trovata.'); end if;
  if not p_by_owner and v_b.starts_at - make_interval(mins => p_cutoff_min) < p_now then
    return jsonb_build_object('ok', false, 'code', 'late', 'message', 'Troppo tardi per disdire: la disdetta è possibile fino a ' ||
      case when p_cutoff_min % 60 = 0 then (p_cutoff_min / 60)::text || ' ore' else p_cutoff_min::text || ' minuti' end || ' prima.');
  end if;
  update gym_pt_bookings set status = 'cancelled', cancelled_at = p_now where id = p_booking;
  if v_b.used_member_plan_id is not null then
    update gym_member_plans set entries_left = least(coalesce(entries_total, entries_left + 1), entries_left + 1)
     where id = v_b.used_member_plan_id and kind = 'entries';
  end if;
  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.gym_caps_error(uuid, uuid, date) from public, anon, authenticated;
revoke all on function public.gym_book(uuid, uuid, uuid, date, timestamptz) from public, anon, authenticated;
revoke all on function public.gym_pt_book(uuid, uuid, date, time, timestamptz) from public, anon, authenticated;
revoke all on function public.gym_pt_cancel(uuid, uuid, uuid, integer, timestamptz, boolean) from public, anon, authenticated;
