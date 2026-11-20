-- RA-34 cloud schema. Run once in Supabase → SQL Editor → New query → paste → Run.
-- Every table: rows belong to auth.users (deleted with the account), RLS = own rows only,
-- updated_at stamped by the server (sync pulls by it, so the phone clock never matters).

-- ─── Tables ──────────────────────────────────────────────────────────────────

create table public.profiles (
  user_id    uuid primary key default auth.uid() references auth.users on delete cascade,
  unit       text not null default 'km' check (unit in ('km', 'mi')),
  updated_at timestamptz not null default now()
);

create table public.run_types (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users on delete cascade,
  name       text not null,
  hue        int  not null,
  deleted    boolean not null default false,
  updated_at timestamptz not null default now()
);

create table public.runs (
  id             uuid not null,                  -- = HealthKit workout UUID for Apple Health runs
  user_id        uuid not null default auth.uid() references auth.users on delete cascade,
  healthkit_uuid text,
  type_id        uuid references public.run_types on delete set null,  -- null = unclassified
  name           text not null,
  date           date not null,
  distance_km    double precision not null,
  time_sec       double precision not null,
  avg_hr         double precision,
  max_hr         double precision,
  min_hr         double precision,
  elev_gain      double precision,
  cadence        double precision,
  source         text not null,
  notes          text,
  splits         jsonb not null,
  segments       jsonb,
  zones          jsonb,
  weather        jsonb,
  edits          jsonb not null default '{}',    -- manual edits on top of HealthKit values
  updated_at     timestamptz not null default now(),
  primary key (user_id, id),
  unique (user_id, healthkit_uuid)
);
create index runs_user_updated on public.runs (user_id, updated_at);
create index run_types_user_updated on public.run_types (user_id, updated_at);

grant select, insert, update, delete on public.profiles, public.run_types, public.runs to authenticated;

-- ─── Row Level Security: each user sees and changes only their own rows ─────

alter table public.profiles  enable row level security;
alter table public.run_types enable row level security;
alter table public.runs      enable row level security;

create policy "own rows" on public.profiles  for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "own rows" on public.run_types for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "own rows" on public.runs      for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- ─── updated_at: always the server clock ────────────────────────────────────

create function public.touch_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end $$;

create trigger touch before insert or update on public.profiles  for each row execute function public.touch_updated_at();
create trigger touch before insert or update on public.run_types for each row execute function public.touch_updated_at();
create trigger touch before insert or update on public.runs      for each row execute function public.touch_updated_at();

-- ─── New account: profile + 7 default run types ─────────────────────────────

create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (user_id) values (new.id);
  insert into public.run_types (user_id, name, hue) values
    (new.id, 'Race', 20), (new.id, 'Tempo', 70), (new.id, 'Hills', 120), (new.id, 'Easy', 170),
    (new.id, 'Long', 220), (new.id, 'Fartlek', 270), (new.id, 'Interval', 320);
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ─── Backfill accounts that existed before this script ──────────────────────

insert into public.profiles (user_id) select id from auth.users on conflict do nothing;

insert into public.run_types (user_id, name, hue)
select u.id, t.name, t.hue
from auth.users u
cross join (values ('Race', 20), ('Tempo', 70), ('Hills', 120), ('Easy', 170),
                   ('Long', 220), ('Fartlek', 270), ('Interval', 320)) as t(name, hue)
where not exists (select 1 from public.run_types r where r.user_id = u.id);
  