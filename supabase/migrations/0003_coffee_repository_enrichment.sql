-- Coffee Brewing Calculator — Phase 3 Feature #3 (Coffee Repository).
-- Enriches the shared coffee_catalog + per-user beans with the full scraped
-- roastery profile, so a bean added from the catalog carries brand, roastery,
-- origin, variety, process, roast level, tasting notes, altitude and variants
-- forward. PRD §13 / Decision #67. Run after 0002_beans_and_catalog.sql.
-- Idempotent: every add is `if not exists`.

-- ---------------------------------------------------------------------------
-- coffee_catalog: full scraped profile + provenance.
alter table public.coffee_catalog add column if not exists roast_level    text;
alter table public.coffee_catalog add column if not exists roastery       text;
alter table public.coffee_catalog add column if not exists origin_country text;
alter table public.coffee_catalog add column if not exists origin_region  text;
alter table public.coffee_catalog add column if not exists origin_estate  text;
alter table public.coffee_catalog add column if not exists altitude       text;
alter table public.coffee_catalog add column if not exists variety        text;
alter table public.coffee_catalog add column if not exists process        text;
alter table public.coffee_catalog add column if not exists tasting_notes  text;
alter table public.coffee_catalog add column if not exists variants       jsonb;
alter table public.coffee_catalog add column if not exists availability   text;
alter table public.coffee_catalog add column if not exists source_url     text;
alter table public.coffee_catalog add column if not exists source         text default 'user';  -- 'user' | 'scraped'

-- One catalog row per coffee (case-insensitive brand+name). Backs both the
-- app's manual upsert and the seed's ON CONFLICT, and enforces the §13.2
-- de-duplication rule (a scraped seed replaces a matching user row).
create unique index if not exists coffee_catalog_brand_name_uidx
  on public.coffee_catalog (lower(brand), lower(coffee_name));

-- ---------------------------------------------------------------------------
-- beans: mirror the catalog profile so a bean chosen from the catalog keeps its
-- full record (beans already carries altitude / roast_level / notes from 0002).
alter table public.beans add column if not exists roastery       text;
alter table public.beans add column if not exists origin_country text;
alter table public.beans add column if not exists origin_region  text;
alter table public.beans add column if not exists origin_estate  text;
alter table public.beans add column if not exists variety        text;
alter table public.beans add column if not exists process        text;
alter table public.beans add column if not exists tasting_notes  text;
alter table public.beans add column if not exists variants       jsonb;
alter table public.beans add column if not exists availability   text;
alter table public.beans add column if not exists source_url     text;
alter table public.beans add column if not exists source         text default 'user';
