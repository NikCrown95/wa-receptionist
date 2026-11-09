-- Calendario sul telefono (iPhone/iPad): ogni attivita' ha un proprio link segreto, diverso dal codice della dashboard
alter table businesses add column if not exists cal_token text;
create unique index if not exists businesses_cal_token_key on businesses(cal_token) where cal_token is not null;
