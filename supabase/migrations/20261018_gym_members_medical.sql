-- Certificato medico: l'owner scrive quando e' stato fatto e quando scade (di solito dopo un anno)
alter table gym_members add column if not exists medical_from date, add column if not exists medical_until date;
