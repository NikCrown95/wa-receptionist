alter table gym_bookings add column if not exists checked_in boolean not null default false;
alter table gym_pt_bookings add column if not exists checked_in boolean not null default false;
