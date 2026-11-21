-- RA-9: zone settings on profiles; runs keep an HR histogram instead of zone totals.
-- Run once in the Supabase SQL Editor BEFORE opening the new app code.
alter table public.profiles
  add column zone_method text check (zone_method in ('hrmax', 'hrr', 'lthr', 'manual')),
  add column lthr        double precision,
  add column zone_bounds jsonb;

alter table public.runs
  add column hr_hist jsonb,
  drop column zones;

-- Then re-import (existing runs have no histogram): delete from public.runs;  → log out and in on the phone.
