-- Abbonamento e pacchetto Personal separati: i limiti di un piano contano solo le prenotazioni che gli appartengono
create or replace function public.gym_caps_error(p_member uuid, p_plan uuid, p_date date)
returns text language plpgsql security definer set search_path to 'public' as $function$
declare v_plan record; v_n integer; v_wk date; v_pt boolean; v_cl boolean;
begin
  select * into v_plan from gym_member_plans where id = p_plan;
  if not found then return null; end if;
  v_pt := 'personal' = any(v_plan.covers);
  v_cl := exists (select 1 from unnest(v_plan.covers) c where c <> 'personal') or coalesce(array_length(v_plan.covers, 1), 0) = 0;
  if v_plan.max_per_week is not null then
    v_wk := date_trunc('week', p_date::timestamp)::date;
    select (select case when v_cl then count(*) else 0 end from gym_bookings b where b.member_id = p_member and b.status = 'confirmed' and b.session_date >= v_wk and b.session_date < v_wk + 7)
         + (select case when v_pt then count(*) else 0 end from gym_pt_bookings t where t.member_id = p_member and t.status = 'confirmed' and t.session_date >= v_wk and t.session_date < v_wk + 7) into v_n;
    if v_n >= v_plan.max_per_week then
      return 'In quella settimana ci sono già ' || v_plan.max_per_week || ' ingressi prenotati (il massimo).';
    end if;
  end if;
  if v_plan.max_entries is not null then
    select (select case when v_cl then count(*) else 0 end from gym_bookings b where b.member_id = p_member and b.status = 'confirmed' and b.session_date >= v_plan.starts_on and (v_plan.ends_on is null or b.session_date <= v_plan.ends_on))
         + (select case when v_pt then count(*) else 0 end from gym_pt_bookings t where t.member_id = p_member and t.status = 'confirmed' and t.session_date >= v_plan.starts_on and (v_plan.ends_on is null or t.session_date <= v_plan.ends_on)) into v_n;
    if v_n >= v_plan.max_entries then
      return 'Gli ' || v_plan.max_entries || ' ingressi del mese sono già stati prenotati.';
    end if;
  end if;
  return null;
end; $function$;
