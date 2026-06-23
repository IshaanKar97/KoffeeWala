-- Coffee Brewing Calculator — Phase 2 Supabase schema (Task 1: foundation)
-- Single `brews` table with per-user Row-Level Security (RLS).
-- Run this in the Supabase SQL Editor (or via the Supabase CLI) on a new project.

create table if not exists public.brews (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users (id) on delete cascade default auth.uid(),
  created_at       timestamptz not null default now(),
  name             text,                       -- display name (date + time)
  instrument       text not null check (instrument in ('v60', 'filter', 'mokka')),
  method           text,                       -- v60: 1-pour|3-pour|10-pour|advanced ; filter: with-milk|with-water
  with_ice         boolean not null default false,
  coffee_g         numeric not null check (coffee_g > 0),
  ratio            numeric,                    -- water/brew ratio (v60 default 16; filter water ratio 5)
  total_water_g    numeric,
  bloom_water_g    numeric,
  bloom_time       text,                       -- mm:ss
  brew_water_g     numeric,                    -- water actually poured (total − ice when iced)
  ice_factor       numeric,                    -- default 0.4 when iced
  ice_g            numeric,
  milk_ratio       numeric,                    -- filter: with-milk
  milk_g           numeric,
  dilution_ratio   numeric,                    -- filter: with-water
  dilution_water_g numeric,
  grind_size       text,                       -- v60
  water_temp       text,                       -- optional, any instrument
  drawdown_time    text,                       -- filter
  pours            jsonb not null default '[]'::jsonb,  -- [{ "water": <cumulative g>, "time": "mm:ss" }, ...] (1–10)
  rating           numeric check (rating >= 0 and rating <= 10),
  notes            text
);

-- Indexes for the combined list view (newest first) and instrument chip filter.
create index if not exists brews_user_created_idx on public.brews (user_id, created_at desc);
create index if not exists brews_user_instrument_idx on public.brews (user_id, instrument);

-- Row-Level Security: each user can only see/modify their own brews.
alter table public.brews enable row level security;

create policy "brews_select_own" on public.brews
  for select using (auth.uid() = user_id);

create policy "brews_insert_own" on public.brews
  for insert with check (auth.uid() = user_id);

create policy "brews_update_own" on public.brews
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "brews_delete_own" on public.brews
  for delete using (auth.uid() = user_id);
