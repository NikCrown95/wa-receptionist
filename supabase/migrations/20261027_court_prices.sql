-- Prezzo dei campi a testa: un prezzo per i soci e uno per i non soci.
-- Il totale di una prenotazione = soci x prezzo socio + non soci x prezzo non socio.
alter table public.courts add column if not exists price_member_eur numeric(8,2) check (price_member_eur is null or price_member_eur >= 0);
alter table public.courts add column if not exists price_guest_eur numeric(8,2) check (price_guest_eur is null or price_guest_eur >= 0);
-- campi gia' esistenti: il vecchio prezzo a campo diventa prezzo a testa dei non soci (diviso 4) e dei soci (meta')
update public.courts set price_guest_eur = round(price_eur / 4, 2), price_member_eur = round(price_eur / 8, 2)
 where price_eur is not null and price_guest_eur is null and price_member_eur is null;
