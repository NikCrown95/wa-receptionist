-- Codice invito = nome dell'attivita' (es. "barbiere-mario"). Se e' gia' preso si aggiunge -2, -3...
-- Vale per le nuove attivita' e riscrive i codici casuali (8 caratteri esadecimali) delle esistenti.
-- I codici gia' leggibili (es. boutique-gym-a8c) restano come sono.
create or replace function public.referral_slug(p_name text) returns text
language plpgsql immutable as $$
declare base text;
begin
  base := lower(coalesce(p_name, ''));
  base := translate(base, 'àáâãäåèéêëìíîïòóôõöùúûüç', 'aaaaaaeeeeiiiiooooouuuuc');
  base := regexp_replace(base, '[^a-z0-9]+', '-', 'g');
  base := regexp_replace(base, '^-+|-+$', '', 'g');
  base := left(base, 24);
  base := regexp_replace(base, '-+$', '', 'g');
  if length(base) < 3 then base := 'attivita'; end if;
  return base;
end $$;

create or replace function public.referral_code_free(p_base text) returns text
language plpgsql as $$
declare c text := p_base; n int := 1;
begin
  while exists (select 1 from public.businesses where referral_code = c)
     or exists (select 1 from public.referral_partners where code = c) loop
    n := n + 1;
    c := p_base || '-' || n;
  end loop;
  return c;
end $$;

create or replace function public.businesses_readable_referral_code() returns trigger
language plpgsql as $$
begin
  new.referral_code := public.referral_code_free(public.referral_slug(new.name));
  return new;
end $$;

do $$
declare r record;
begin
  for r in select id, name from public.businesses where referral_code ~ '^[0-9a-f]{8}$' order by name, id loop
    update public.businesses set referral_code = public.referral_code_free(public.referral_slug(r.name)) where id = r.id;
  end loop;
end $$;
