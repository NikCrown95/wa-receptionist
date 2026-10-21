-- Prenotare piu' ore di fila (ripetizioni, campi, trattamenti lunghi).
-- services.max_units: massimo di blocchi consecutivi prenotabili in un solo appuntamento (1 = come sempre).
-- appointments.units: quanti blocchi dura l'appuntamento (serve a moltiplicare il prezzo nelle statistiche).
alter table services add column if not exists max_units integer not null default 1;
alter table services drop constraint if exists services_max_units_check;
alter table services add constraint services_max_units_check check (max_units between 1 and 8);

alter table appointments add column if not exists units integer not null default 1;
alter table appointments drop constraint if exists appointments_units_check;
alter table appointments add constraint appointments_units_check check (units between 1 and 8);
