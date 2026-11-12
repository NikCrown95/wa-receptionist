-- Personal trainer: durata del pacchetto (scadenza) e massimo di coaching a settimana.
-- Sul pacchetto in catalogo (services): mesi di validita' (vuoto = senza scadenza) e massimo a settimana (vuoto = nessun limite).
alter table services add column if not exists pt_months integer;
alter table services add column if not exists pt_per_week integer;
-- Sul pacchetto dell'iscritto (pt_packs): copia dei valori al momento dell'assegnazione, cosi' modificare il catalogo non cambia i pacchetti gia' venduti.
alter table pt_packs add column if not exists starts_on date;
alter table pt_packs add column if not exists expires_on date;
alter table pt_packs add column if not exists per_week integer;
