-- RA-39: new runs (started after signup) wait for the user's type answer.
-- Run once in the Supabase SQL Editor BEFORE opening the new app code
-- (a push rejected for the unknown column is marked failed for good).
alter table public.runs add column needs_type boolean not null default false;
