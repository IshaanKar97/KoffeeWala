-- Coffee Brewing Calculator — Phase 3 Feature #2 schema.
-- Bean Repository (per-user) + shared Global Coffee Catalog + brew→bean link.
-- Run this in the Supabase SQL Editor (or via the Supabase CLI) after 0001_init.sql.

-- ---------------------------------------------------------------------------
-- Bean Repository: one row per bag of coffee a user owns.
create table if not exists public.beans (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references auth.users (id) on delete cascade default auth.uid(),
  created_at          timestamptz not null default now(),
  brand               text not null,
  coffee_name         text not null,
  roast_date          date not null,
  initial_amount_g    numeric not null check (initial_amount_g > 0),
  remaining_amount_g  numeric not null check (remaining_amount_g >= 0),
  altitude            text,   -- optional bean profile: growing altitude (free text, e.g. "1,800–2,100 masl")
  roast_level         text,   -- optional bean profile: Light … Dark
  notes               text    -- optional bean profile: free-form tasting/origin notes
);

-- Additive columns for the optional bean profile — safe to re-run if the beans
-- table was created before these fields existed.
alter table public.beans add column if not exists altitude    text;
alter table public.beans add column if not exists roast_level text;
alter table public.beans add column if not exists notes       text;

create index if not exists beans_user_created_idx on public.beans (user_id, created_at desc);

alter table public.beans enable row level security;

drop policy if exists "beans_select_own" on public.beans;
create policy "beans_select_own" on public.beans
  for select using (auth.uid() = user_id);

drop policy if exists "beans_insert_own" on public.beans;
create policy "beans_insert_own" on public.beans
  for insert with check (auth.uid() = user_id);

drop policy if exists "beans_update_own" on public.beans;
create policy "beans_update_own" on public.beans
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "beans_delete_own" on public.beans;
create policy "beans_delete_own" on public.beans
  for delete using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- Global Coffee Catalog: shared across ALL users (confirmed 2026-07-13, PRD
-- Phase 3 Feature #2 §7 / Decision #65). Powers independent Brand / Coffee-Name
-- autocomplete + amount prefill on an exact (case-insensitive) match. No
-- per-row ownership — any authenticated user may contribute or update an entry.
create table if not exists public.coffee_catalog (
  id             uuid primary key default gen_random_uuid(),
  brand          text not null,
  coffee_name    text not null,
  last_amount_g  numeric,
  updated_at     timestamptz not null default now()
);

-- Case-insensitive lookups for autocomplete + exact-match prefill.
create index if not exists coffee_catalog_brand_idx on public.coffee_catalog (lower(brand));
create index if not exists coffee_catalog_name_idx on public.coffee_catalog (lower(coffee_name));

alter table public.coffee_catalog enable row level security;

drop policy if exists "coffee_catalog_select_authenticated" on public.coffee_catalog;
create policy "coffee_catalog_select_authenticated" on public.coffee_catalog
  for select to authenticated using (true);

drop policy if exists "coffee_catalog_insert_authenticated" on public.coffee_catalog;
create policy "coffee_catalog_insert_authenticated" on public.coffee_catalog
  for insert to authenticated with check (true);

drop policy if exists "coffee_catalog_update_authenticated" on public.coffee_catalog;
create policy "coffee_catalog_update_authenticated" on public.coffee_catalog
  for update to authenticated using (true) with check (true);

-- ---------------------------------------------------------------------------
-- Link a brew to the bean it was made with (nullable — older brews and
-- brews made without selecting a bean have none). bean_label is a stored
-- display snapshot ("Brand — Coffee Name") so the Logbook doesn't need to
-- join against beans (mirrors the grind_size readable-summary pattern).
alter table public.brews add column if not exists bean_id uuid references public.beans (id) on delete set null;
alter table public.brews add column if not exists bean_label text;

create index if not exists brews_bean_idx on public.brews (bean_id);
