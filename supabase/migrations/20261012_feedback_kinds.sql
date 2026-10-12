-- Feedback dei titolari: nuovo tipo di richiesta e notifica una tantum
alter table public.support_requests drop constraint support_requests_kind_check;
alter table public.support_requests add constraint support_requests_kind_check check (kind = any (array['support','plan_change','subscription_cancel','account_delete','whatsapp_activation','feedback']));
alter table public.notification_events drop constraint notification_events_event_type_check;
alter table public.notification_events add constraint notification_events_event_type_check check (event_type = any (array['booked','cancelled','weekly_recap','closures_reminder','feedback_ask']));
create unique index if not exists notification_events_feedback_ask_uniq on public.notification_events (business_id) where event_type = 'feedback_ask';
