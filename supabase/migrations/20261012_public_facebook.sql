-- Link Facebook dell'attività (insieme a public_phone e public_instagram già presenti)
alter table public.businesses add column if not exists public_facebook text;
