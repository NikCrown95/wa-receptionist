-- Link brevi al pannello: prenolia.it/a/CODICE
alter table businesses add column if not exists short_code text;
update businesses set short_code = translate(encode(gen_random_bytes(12),'base64'),'+/=','Xyz') where short_code is null;
alter table businesses alter column short_code set default translate(encode(gen_random_bytes(12),'base64'),'+/=','Xyz');
create unique index if not exists businesses_short_code_key on businesses(short_code);
