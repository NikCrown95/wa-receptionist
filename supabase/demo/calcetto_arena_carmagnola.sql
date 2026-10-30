-- Centro sportivo finto per provare il calcio: "Calcetto Arena Carmagnola", 4 campi (a 5, a 7, a 11).
-- Tutti i dati sono inventati (nomi, telefoni 320 000 xxxx, email @example.com).
-- Si esegue una volta sola (se l'attivita' esiste gia' non fa nulla). Per rifarlo da capo:
--   delete from public.businesses where slug = 'calcetto-arena-carmagnola';
do $$
declare
  v_biz uuid; v_plan uuid; c record;
  v_day date; v_wd integer; v_open integer; v_close integer; v_t integer;
  v_start timestamptz; v_end timestamptz; v_p numeric; v_person integer;
  v_status text; v_chan text; v_r numeric; v_created timestamptz; v_hr numeric;
  firsts text[] := array['Marco','Luca','Giulia','Francesca','Andrea','Matteo','Sara','Elena','Davide','Paolo','Chiara','Simone','Alessandro','Martina','Federico','Valentina','Stefano','Laura','Roberto','Silvia','Giorgio','Anna','Claudio','Irene','Fabio','Elisa','Nicola','Giada','Daniele','Marta'];
  lasts text[] := array['Rossi','Bianchi','Conti','Villa','Neri','Greco','Fabbri','Moro','Riva','Leone','Costa','Ferri','Galli','Poli','Sala','Gatti','Mazza','Pace','Serra','Longo','Marino','Basile','Orlando','Ferraro','Barone','Testa','Monti','Fiore','Caruso','Rizzo'];
begin
  if exists (select 1 from public.businesses where slug = 'calcetto-arena-carmagnola') then
    raise notice 'Esiste gia'': non cambio nulla.';
    return;
  end if;
  perform setseed(0.41);

  insert into public.businesses (name, slug, business_type, timezone, public_tagline, public_phone, address, team_mode, max_advance_days, min_notice_min, cancel_limit_hours, onboarded_at, booking_rules)
  values ('Calcetto Arena Carmagnola', 'calcetto-arena-carmagnola', 'centro_sportivo', 'Europe/Rome', 'Calcio a 5, a 7 e a 11', '011 000 0001', 'Via dello Sport 8, Carmagnola (TO)', 'solo', 14, 60, 24, now(),
          '{"courts":{"sport":"calcio","fit":false,"medical":"none","open_to":"all"}}'::jsonb)
  returning id into v_biz;

  select id into v_plan from public.plans where name = 'Base+Lia' limit 1;
  insert into public.subscriptions (business_id, plan_id, status, started_at, trial_ends_at)
  values (v_biz, v_plan, 'trial', now(), now() + interval '60 days');

  insert into public.courts (business_id, name, sport, surface, indoor, slot_min, price_member_eur, price_guest_eur, sort_order) values
    (v_biz, 'Campo 1 · a 5', 'calcio', 'Erba sintetica', true, 60, null, 45, 1),
    (v_biz, 'Campo 2 · a 5', 'calcio', 'Erba sintetica', false, 60, null, 40, 2),
    (v_biz, 'Campo 3 · a 7', 'calcio', 'Erba sintetica', false, 60, null, 70, 3),
    (v_biz, 'Campo 4 · a 11', 'calcio', 'Erba naturale', false, 90, null, 120, 4);

  -- orari uguali per tutti i campi: lunedi-venerdi 15:00-23:00, sabato e domenica 9:00-23:00
  insert into public.court_hours (court_id, weekday, opens, closes)
  select ct.id, d, case when d <= 5 then '15:00'::time else '09:00'::time end, case when d <= 5 then '23:00'::time else '23:00'::time end
  from public.courts ct, generate_series(1, 7) d where ct.business_id = v_biz;

  -- prenotazioni inventate: due settimane indietro e due avanti, solo il referente (nessun giocatore, socio o certificato)
  for c in select id, price_guest_eur, slot_min from public.courts where business_id = v_biz order by sort_order loop
    for v_day in select generate_series(current_date - 14, current_date + 14, interval '1 day')::date loop
      v_wd := extract(isodow from v_day)::integer;
      v_open := case when v_wd <= 5 then 15 else 9 end; v_close := case when v_wd <= 5 then 23 else 23 end;
      for v_t in select generate_series(v_open * 60, v_close * 60 - c.slot_min, c.slot_min) loop
        v_start := (v_day + make_interval(mins => v_t)) at time zone 'Europe/Rome';
        v_hr := v_t / 60.0;
        if v_wd <= 5 then v_p := case when v_hr < 17 then 0.10 when v_hr < 19 then 0.30 else 0.78 end;
        else v_p := case when v_hr < 12 then 0.30 when v_hr < 17 then 0.55 else 0.72 end; end if;
        if v_day > current_date then v_p := v_p * greatest(0.25, 0.85 - (v_day - current_date) * 0.045); end if;
        continue when random() >= v_p;
        v_person := 1 + floor(random() * 40)::integer;
        v_end := v_start + make_interval(mins => c.slot_min);
        v_status := 'confirmed';
        v_r := random();
        v_chan := case when v_r < 0.55 then 'web' when v_r < 0.90 then 'chat' else 'manual' end;
        if v_day < current_date and random() < 0.04 then v_status := 'cancelled'; end if;
        v_created := least(v_start - make_interval(hours => 2 + floor(random() * 90)::integer), now() - make_interval(mins => 5 + floor(random() * 600)::integer));
        insert into public.court_bookings (business_id, court_id, starts_at, ends_at, status, first_name, last_name, phone, email, players, members, fit_declared, price_eur, channel, created_at, cancelled_at, cancelled_by)
        values (v_biz, c.id, v_start, v_end, v_status, firsts[1 + (v_person % 30)], lasts[1 + ((v_person * 7) % 30)],
                '+39 320 000 ' || lpad((2000 + v_person)::text, 4, '0'),
                lower(firsts[1 + (v_person % 30)] || '.' || lasts[1 + ((v_person * 7) % 30)]) || '@example.com',
                null, null, false, c.price_guest_eur, v_chan, v_created,
                case when v_status = 'cancelled' then v_start - interval '1 day' end,
                case when v_status = 'cancelled' then 'cliente' end);
      end loop;
    end loop;
  end loop;
end $$;
