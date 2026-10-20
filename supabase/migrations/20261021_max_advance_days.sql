-- Regole di prenotazione: quanto in anticipo i clienti possono prenotare (in giorni).
-- 90 = comportamento di sempre (circa 3 mesi). Valori ammessi: 7, 14, 30, 60, 90, 180.
alter table businesses
  add column if not exists max_advance_days integer not null default 90;
