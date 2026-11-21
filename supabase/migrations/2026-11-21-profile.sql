-- RA-11: personal info on profiles. Run once in the Supabase SQL Editor.
alter table public.profiles
  add column first_name    text,
  add column last_name     text,
  add column dob           date,
  add column sex           text check (sex in ('female', 'male', 'undisclosed')),
  add column height_cm     double precision,
  add column weight_kg     double precision,
  add column resting_hr    double precision,
  add column vo2max        double precision,
  add column hr_max        double precision,
  add column hr_max_manual boolean not null default false;
