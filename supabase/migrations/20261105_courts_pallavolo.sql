-- Pallavolo come sport a se' nei centri sportivi (prima finiva in "altro").
alter table public.courts drop constraint if exists courts_sport_check;
alter table public.courts add constraint courts_sport_check check (sport in ('tennis','padel','calcio','pallavolo','altro'));
