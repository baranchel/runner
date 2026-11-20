-- RA-3: full start time of a run (date stays the local day). Run once in Supabase → SQL Editor.
alter table public.runs add column started_at timestamptz;
