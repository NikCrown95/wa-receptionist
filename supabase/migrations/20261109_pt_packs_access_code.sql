-- Codice di accesso dell'iscritto (personal trainer): lo imposta il trainer, il cliente lo inserisce per prenotare
alter table pt_packs add column if not exists access_code text;
