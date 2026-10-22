-- Campanella: "letto fino a" condiviso tra tutti i dispositivi del titolare.
alter table public.businesses add column if not exists notif_seen_at timestamptz;
