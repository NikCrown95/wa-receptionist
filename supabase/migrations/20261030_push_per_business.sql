-- Un telefono puo' ricevere gli avvisi di piu' attivita': l'unicita' passa da (endpoint) a (business_id, endpoint).
-- Prima, aprire la dashboard di un'attivita' spostava il telefono da quella di prima, che smetteva di ricevere le notifiche.
alter table public.push_subscriptions drop constraint if exists push_subscriptions_endpoint_key;
alter table public.push_subscriptions add constraint push_subscriptions_business_endpoint_key unique (business_id, endpoint);
