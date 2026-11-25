-- RA-8 Shoes. Run ONCE (not re-runnable: creates fail the second time) in the Supabase SQL Editor BEFORE opening the new app code
-- (a push rejected for an unknown table/column is marked failed for good).
-- Then run 2026-11-24-shoe-catalogue.sql (the brand/model list).

create table public.shoes (
  id             uuid primary key,                 -- made on the phone (Crypto.randomUUID)
  user_id        uuid not null default auth.uid() references auth.users on delete cascade,
  brand          text not null,
  model          text not null,
  name           text,
  color          text,
  in_use_from    date not null,
  limit_km       double precision not null,
  extra_km       double precision not null default 0,
  retired        boolean not null default false,
  alert_level    int not null default 0,
  card_dismissed int not null default 0,
  updated_at     timestamptz not null default now()
);
create index shoes_user_updated on public.shoes (user_id, updated_at);
grant select, insert, update, delete on public.shoes to authenticated;
alter table public.shoes enable row level security;
create policy "own rows" on public.shoes for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create trigger touch before insert or update on public.shoes for each row execute function public.touch_updated_at();

alter table public.runs      add column shoe_id         uuid references public.shoes on delete set null;
alter table public.run_types add column default_shoe_id uuid references public.shoes on delete set null;

-- Catalogue: shared, read-only for the app (written only here / in the SQL Editor).
create table public.shoe_brands (
  id   serial primary key,
  name text not null unique,
  sort int  not null
);
create table public.shoe_models (
  id             serial primary key,
  brand_id       int  not null references public.shoe_brands on delete cascade,
  name           text not null,
  recommended_km int  not null,
  unique (brand_id, name)
);
grant select on public.shoe_brands, public.shoe_models to authenticated;
alter table public.shoe_brands enable row level security;
alter table public.shoe_models enable row level security;
create policy "read" on public.shoe_brands for select to authenticated using (true);
create policy "read" on public.shoe_models for select to authenticated using (true);

-- Brand logos: public bucket, file = brand name lowercased, non-letters → '-' (nike.png, new-balance.png).
insert into storage.buckets (id, name, public) values ('brand-logos', 'brand-logos', true)
  on conflict (id) do nothing;
