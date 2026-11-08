-- Invito a installare l'app (avviso di Lia): chi usa solo il browser dal telefono riceve ogni tanto un suggerimento.
-- app_first_browser_at: primo accesso dal browser del telefono; app_installed_at: primo accesso dall'app installata (da quel momento
-- l'avviso non compare piu'); app_invite_off: il titolare ha scelto "Non mi interessa".
alter table businesses add column if not exists app_first_browser_at timestamptz;
alter table businesses add column if not exists app_installed_at timestamptz;
alter table businesses add column if not exists app_invite_off boolean not null default false;
