-- Run Detail HR chart: each run keeps a small real HR line (80 × [min, max] bpm).
-- Run once in the Supabase SQL Editor BEFORE opening the new app code.
alter table public.runs add column hr_curve jsonb;

-- Then re-import (existing runs have no curve): delete from public.runs;  → log out and in on the phone.
