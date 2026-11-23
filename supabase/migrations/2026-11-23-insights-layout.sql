-- RA-29: the Insights tab's hide/order choice. Run once in the Supabase SQL Editor
-- BEFORE opening the new app code (a profile push rejected for a missing column is marked failed for good).
alter table public.profiles
  add column if not exists insights_layout jsonb;
