-- Modulo Palestra: iscritti, abbonamenti, corsi a orari fissi, prenotazioni con controllo dell'abbonamento.
-- Il controllo di idoneità e dei posti sta nella funzione gym_book (una sola operazione atomica).

-- Tipi di abbonamento / pacchetto ingressi / extra (es. Hyrox) definiti dal titolare.
create table if not exists public.gym_plans (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  name text not null,
  kind text not null check (kind in ('time','entries')),
  days integer check (days is null or days > 0),
  entries integer check (entries is null or entries > 0),
  price_eur numeric(8,2),
  covers text[] not null default array['corsi','circuiti'],
  active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint gym_plans_shape check ((kind = 'time' and days is not null) or (kind = 'entries' and entries is not null))
);
create index if not exists gym_plans_business_idx on public.gym_plans (business_id);

create table if not exists public.gym_members (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  first_name text not null,
  last_name text not null,
  phone text not null,
  phone_key text not null,
  notes text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create unique index if not exists gym_members_phone_uq on public.gym_members (business_id, phone_key);

-- Abbonamento sottoscritto da un iscritto (copia di nome e coperture, così resta valido anche se il tipo cambia).
create table if not exists public.gym_member_plans (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  member_id uuid not null references public.gym_members(id) on delete cascade,
  plan_id uuid references public.gym_plans(id) on delete set null,
  plan_name text not null,
  kind text not null check (kind in ('time','entries')),
  covers text[] not null,
  starts_on date not null,
  ends_on date,
  entries_total integer,
  entries_left integer,
  price_paid numeric(8,2),
  cancelled boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists gym_member_plans_member_idx on public.gym_member_plans (member_id);
create index if not exists gym_member_plans_business_idx on public.gym_member_plans (business_id, ends_on);

create table if not exists public.gym_courses (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  name text not null,
  category text not null default 'corsi',
  description text,
  duration_min integer not null default 60 check (duration_min between 10 and 240),
  capacity integer not null default 12 check (capacity between 1 and 200),
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists gym_courses_business_idx on public.gym_courses (business_id);

-- Programma settimanale: ogni riga è una lezione che si ripete (weekday 1=lunedì … 7=domenica).
create table if not exists public.gym_schedule (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  course_id uuid not null references public.gym_courses(id) on delete cascade,
  weekday integer not null check (weekday between 1 and 7),
  starts_at_time time not null,
  capacity integer check (capacity is null or capacity between 1 and 200),
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists gym_schedule_business_idx on public.gym_schedule (business_id, weekday);

-- Lezione di un giorno annullata dal titolare.
create table if not exists public.gym_cancelled_sessions (
  schedule_id uuid not null references public.gym_schedule(id) on delete cascade,
  session_date date not null,
  business_id uuid not null references public.businesses(id) on delete cascade,
  reason text,
  created_at timestamptz not null default now(),
  primary key (schedule_id, session_date)
);

create table if not exists public.gym_bookings (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  member_id uuid not null references public.gym_members(id) on delete cascade,
  schedule_id uuid not null references public.gym_schedule(id) on delete cascade,
  session_date date not null,
  starts_at timestamptz not null,
  status text not null default 'confirmed' check (status in ('confirmed','cancelled')),
  used_member_plan_id uuid references public.gym_member_plans(id) on delete set null,
  entry_used boolean not null default false,
  created_at timestamptz not null default now(),
  cancelled_at timestamptz
);
create unique index if not exists gym_bookings_one_per_member
  on public.gym_bookings (member_id, schedule_id, session_date) where status = 'confirmed';
create index if not exists gym_bookings_session_idx on public.gym_bookings (schedule_id, session_date) where status = 'confirmed';
create index if not exists gym_bookings_business_day_idx on public.gym_bookings (business_id, session_date);

alter table public.gym_plans enable row level security;
alter table public.gym_members enable row level security;
alter table public.gym_member_plans enable row level security;
alter table public.gym_courses enable row level security;
alter table public.gym_schedule enable row level security;
alter table public.gym_cancelled_sessions enable row level security;
alter table public.gym_bookings enable row level security;
-- Nessuna policy pubblica: il server accede con la chiave segreta.

-- Prenotazione atomica. Restituisce {ok:true,...} oppure {ok:false,code,message}.
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

  -- un solo prenotatore alla volta per lezione
  perform pg_advisory_xact_lock(hashtextextended(p_schedule::text || p_date::text, 0));

  if exists (select 1 from gym_bookings where member_id = p_member and schedule_id = p_schedule and session_date = p_date and status = 'confirmed') then
    return jsonb_build_object('ok', false, 'code', 'already', 'message', 'Sei già prenotato a questa lezione.');
  end if;

  v_cap := coalesce(v_sched.capacity, v_course.capacity);
  select count(*) into v_taken from gym_bookings where schedule_id = p_schedule and session_date = p_date and status = 'confirmed';
  if v_taken >= v_cap then return jsonb_build_object('ok', false, 'code', 'full', 'message', 'Lezione al completo.'); end if;

  -- abbonamento valido alla data della lezione che copre la categoria del corso (prima quelli a tempo, poi gli ingressi)
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

-- Disdetta: l'ingresso torna indietro se la disdetta è nei tempi (p_cutoff_min minuti prima dell'inizio).
create or replace function public.gym_cancel(p_business uuid, p_member uuid, p_booking uuid, p_cutoff_min integer default 180, p_now timestamptz default now(), p_by_owner boolean default false)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_b record;
  v_refund boolean := false;
begin
  select * into v_b from gym_bookings where id = p_booking and business_id = p_business and status = 'confirmed' for update;
  if not found then return jsonb_build_object('ok', false, 'message', 'Prenotazione non trovata o già disdetta.'); end if;
  if not p_by_owner and v_b.member_id <> p_member then return jsonb_build_object('ok', false, 'message', 'Prenotazione non trovata.'); end if;
  if not p_by_owner and v_b.starts_at - make_interval(mins => p_cutoff_min) < p_now then
    return jsonb_build_object('ok', false, 'code', 'late', 'message', 'Troppo tardi per disdire: la disdetta è possibile fino a ' ||
      case when p_cutoff_min % 60 = 0 then (p_cutoff_min / 60)::text || ' ore' else p_cutoff_min::text || ' minuti' end || ' prima.');
  end if;
  update gym_bookings set status = 'cancelled', cancelled_at = p_now where id = p_booking;
  if v_b.entry_used and v_b.used_member_plan_id is not null then
    update gym_member_plans set entries_left = least(coalesce(entries_total, entries_left + 1), entries_left + 1) where id = v_b.used_member_plan_id;
    v_refund := true;
  end if;
  return jsonb_build_object('ok', true, 'refunded', v_refund);
end;
$$;

revoke all on function public.gym_book(uuid, uuid, uuid, date, timestamptz) from public, anon, authenticated;
revoke all on function public.gym_cancel(uuid, uuid, uuid, integer, timestamptz, boolean) from public, anon, authenticated;
