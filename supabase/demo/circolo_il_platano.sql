-- Circolo finto per provare la verticale "campi": "Circolo Tennis Il Platano", 4 campi, affiliato FIT.
-- Tutti i dati sono inventati (nomi, telefoni 320 000 xxxx, email @example.com).
-- Si esegue una volta sola (se il circolo esiste gia' non fa nulla). Per rifarlo da capo:
--   delete from public.businesses where slug = 'circolo-tennis-il-platano';
do $$
declare
  v_biz uuid;
  v_plan uuid;
  c record;
  v_day date;
  v_h integer;
  v_wd integer;
  v_open integer; v_close integer;
  v_p numeric; v_hours integer; v_i integer;
  v_start timestamptz; v_end timestamptz;
  v_person integer; v_players integer; v_members integer; v_member_ref boolean;
  v_price numeric; v_status text; v_created timestamptz;
  v_chan text; v_r numeric;
  firsts text[] := array['Marco','Luca','Giulia','Francesca','Andrea','Matteo','Sara','Elena','Davide','Paolo','Chiara','Simone','Alessandro','Martina','Federico','Valentina','Stefano','Laura','Roberto','Silvia','Giorgio','Anna','Claudio','Irene','Fabio','Elisa','Daniele','Monica','Riccardo','Beatrice'];
  lasts text[] := array['Rossi','Bianchi','Conti','Villa','Neri','Greco','Fabbri','Moro','Riva','Leone','Costa','Ferri','Galli','Poli','Sala','Gatti','Mazza','Pace','Serra','Longo','Marino','Basile','Orlando','Ferraro','Barone','Testa','Monti','Fiore','Caruso','Valenti'];
  n_people constant integer := 48;   -- le prime 28 persone sono soci
  taken_person_day text[] := '{}';
  busy_until timestamptz;
begin
  if exists (select 1 from public.businesses where slug = 'circolo-tennis-il-platano') then
    raise notice 'Il circolo esiste gia'': non cambio nulla.';
    return;
  end if;
  perform setseed(0.37);

  insert into public.businesses (name, slug, business_type, timezone, public_tagline, public_phone, address, team_mode, max_advance_days, min_notice_min, cancel_limit_hours, onboarded_at, booking_rules)
  values ('Circolo Tennis Il Platano', 'circolo-tennis-il-platano', 'centro_sportivo', 'Europe/Rome', 'Tennis a Carmagnola', '011 000 0000', 'Via dei Platani 12, Carmagnola (TO)', 'solo', 14, 60, 24, now(),
          '{"courts":{"sport":"tennis","fit":true,"open_to":"all","member_daily_limit_min":60}}'::jsonb)
  returning id into v_biz;

  select id into v_plan from public.plans where name = 'Base+Lia' limit 1;
  insert into public.subscriptions (business_id, plan_id, status, started_at, trial_ends_at)
  values (v_biz, v_plan, 'trial', now(), now() + interval '60 days');

  insert into public.courts (business_id, name, sport, surface, indoor, slot_min, price_eur, sort_order) values
    (v_biz, 'Campo 1', 'tennis', 'Terra rossa', true, 60, 28.00, 1),
    (v_biz, 'Campo 2', 'tennis', 'Terra rossa', false, 60, 16.00, 2),
    (v_biz, 'Campo 3', 'tennis', 'Cemento', false, 60, 14.00, 3),
    (v_biz, 'Campo 4', 'tennis', 'Terra rossa', false, 60, 16.00, 4);

  -- orari: lunedi-venerdi 08-22, sabato e domenica 08-20, uguali per tutti i campi
  insert into public.court_hours (court_id, weekday, opens, closes)
  select ct.id, d, '08:00', case when d <= 5 then '22:00'::time else '20:00'::time end
  from public.courts ct, generate_series(1, 7) d where ct.business_id = v_biz;

  -- prenotazioni inventate: due settimane indietro e due avanti
  for c in select id, price_eur, indoor from public.courts where business_id = v_biz order by sort_order loop
    busy_until := '-infinity';
    for v_day in select generate_series(current_date - 14, current_date + 14, interval '1 day')::date loop
      v_wd := extract(isodow from v_day)::integer;
      v_open := 8; v_close := case when v_wd <= 5 then 22 else 20 end;
      for v_h in v_open .. v_close - 1 loop
        v_start := (v_day + make_time(v_h, 0, 0)) at time zone 'Europe/Rome';
        continue when v_start < busy_until;
        -- probabilita' di trovare il campo occupato
        if v_wd <= 5 then
          v_p := case when v_h < 12 then 0.14 when v_h < 15 then 0.08 when v_h < 18 then 0.28 else 0.68 end;
        else
          v_p := case when v_h < 9 then 0.20 when v_h < 13 then 0.62 when v_h < 16 then 0.32 else 0.55 end;
        end if;
        if c.indoor then v_p := least(v_p * 1.3, 0.92); end if;
        -- piu' avanti nel tempo si prenota meno
        if v_day > current_date then v_p := v_p * greatest(0.25, 0.85 - (v_day - current_date) * 0.045); end if;
        continue when random() >= v_p;

        v_status := 'confirmed';
        -- scelta del referente: un socio o un non socio; un socio al massimo un'ora al giorno
        v_person := 1 + floor(random() * n_people)::integer;
        v_member_ref := v_person <= 28;
        if v_member_ref and (v_person || '|' || v_day) = any(taken_person_day) then
          v_person := 29 + floor(random() * (n_people - 28))::integer; v_member_ref := false;
        end if;
        v_hours := 1;
        if not v_member_ref and random() < 0.14 and v_h + 2 <= v_close then v_hours := 2; end if;
        if v_member_ref then taken_person_day := taken_person_day || (v_person || '|' || v_day); end if;
        v_end := v_start + make_interval(hours => v_hours);
        busy_until := v_end;

        v_players := case when random() < 0.32 then 4 else 2 end;
        if v_member_ref then v_members := 1 + floor(random() * v_players)::integer;
        else v_members := case when random() < 0.18 then 1 else 0 end; end if;
        v_price := case when v_members >= v_players then 0 else c.price_eur * v_hours end;
        v_r := random();
        v_chan := case when v_r < 0.55 then 'web' when v_r < 0.90 then 'chat' else 'manual' end;
        if v_day < current_date and random() < 0.04 then v_status := 'cancelled'; end if;
        v_created := least(v_start - make_interval(hours => 2 + floor(random() * 90)::integer), now() - make_interval(mins => 5 + floor(random() * 600)::integer));

        insert into public.court_bookings (business_id, court_id, starts_at, ends_at, status, first_name, last_name, phone, email, players, members, fit_declared, price_eur, channel, created_at, cancelled_at, cancelled_by)
        values (v_biz, c.id, v_start, v_end, v_status, firsts[1 + (v_person % 30)], lasts[1 + ((v_person * 7) % 30)],
                '+39 320 000 ' || lpad((1000 + v_person)::text, 4, '0'),
                lower(firsts[1 + (v_person % 30)] || '.' || lasts[1 + ((v_person * 7) % 30)]) || '@example.com',
                v_players, v_members, true, v_price, v_chan, v_created,
                case when v_status = 'cancelled' then v_start - interval '1 day' end,
                case when v_status = 'cancelled' then 'cliente' end);
      end loop;
    end loop;
  end loop;
end $$;
