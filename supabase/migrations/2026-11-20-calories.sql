-- RA-3: active calories from HealthKit. Run once in Supabase → SQL Editor, BEFORE the app update opens.
alter table public.runs add column calories double precision;
