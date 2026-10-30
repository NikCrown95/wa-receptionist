-- Pagina "Promoter": seconda mensilita' (a un anno), attivita' assegnate a mano, premio di base = un mese di Smart.
-- Si puo' eseguire piu' volte senza danni.

alter table public.referrals
  add column if not exists reward2_eur numeric(8,2),          -- seconda mensilita' (importo al momento in cui matura)
  add column if not exists reward2_at timestamptz,            -- quando e' maturata (un anno dopo il primo pagamento, se l'attivita' e' ancora iscritta)
  add column if not exists reward2_paid_at timestamptz,       -- quando l'hai consegnata al promoter
  add column if not exists assigned_manually boolean not null default false;  -- collegata a mano dalla super dashboard

-- premio di base per un nuovo promoter: un mese di Smart (si puo' sempre cambiare persona per persona)
alter table public.referral_partners alter column reward_eur set default 21.99;

-- una stessa attivita' non puo' essere collegata a due promoter
create unique index if not exists referrals_one_per_business
  on public.referrals (referred_business_id) where referred_business_id is not null;
