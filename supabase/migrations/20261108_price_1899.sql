update public.plans set price_eur = 18.99 where name = 'Base+Lia';
alter table public.referral_partners alter column reward_eur set default 18.99;
update public.referral_partners set reward_eur = 18.99 where reward_eur = 21.99;
