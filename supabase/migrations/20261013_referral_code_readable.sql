-- Codice invito leggibile (es. "barbiere-corso-k7x") per le nuove attivita'.
-- Quelle esistenti tengono il loro codice, cosi' i link gia' condivisi continuano a funzionare.
create or replace function public.businesses_readable_referral_code() returns trigger
language plpgsql as $$
declare base text; c text; n int := 0;
begin
  base := lower(coalesce(new.name, ''));
  base := translate(base, 'àáâãäåèéêëìíîïòóôõöùúûüç', 'aaaaaaeeeeiiiiooooouuuuc');
  base := regexp_replace(base, '[^a-z0-9]+', '-', 'g');
  base := regexp_replace(base, '^-+|-+$', '', 'g');
  base := left(base, 18);
  base := regexp_replace(base, '-+$', '', 'g');
  if length(base) < 3 then base := 'attivita'; end if;
  loop
    c := base || '-' || substr(md5(random()::text || clock_timestamp()::text), 1, 3 + (n / 5));
    exit when not exists (select 1 from public.businesses where referral_code = c)
          and not exists (select 1 from public.referral_partners where code = c);
    n := n + 1;
  end loop;
  new.referral_code := c;
  return new;
end $$;

drop trigger if exists businesses_readable_referral_code on public.businesses;
create trigger businesses_readable_referral_code before insert on public.businesses
for each row execute function public.businesses_readable_referral_code();
