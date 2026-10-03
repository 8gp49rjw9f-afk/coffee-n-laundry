-- =====================================================================
-- coffee'n'laundry — reconciliation migration
-- =====================================================================
-- Brings the database in line with what the TypeScript code already
-- assumes. Safe to run whether or not 0001_init.sql was applied:
-- every object is created conditionally, nothing is dropped, and no
-- existing value is overwritten.
--
-- Four groups of changes:
--   1. price_kind — the code inserts espresso / filter / flat_white,
--      which 0001 never declared.
--   2. place_updates — two columns the daily edit limit filters on.
--   3. place_field_checks + place_latest_checks — the per-field
--      verification system, absent from 0001.
--   4. site_settings — reports_to_flag was read under a different
--      name by lib/services/settings.ts.
-- =====================================================================


-- =====================================================================
-- 1. PRICE_KIND — add the coffee price kinds
-- =====================================================================
-- NOTE: ALTER TYPE ... ADD VALUE cannot run inside a transaction block
-- in the same statement as a use of the new value. Run this statement
-- on its own (the Supabase SQL editor does this fine). Re-running is
-- harmless: duplicate_object is swallowed.

do $$ begin
  alter type price_kind add value if not exists 'espresso';
exception when duplicate_object then null; end $$;

do $$ begin
  alter type price_kind add value if not exists 'filter';
exception when duplicate_object then null; end $$;

do $$ begin
  alter type price_kind add value if not exists 'flat_white';
exception when duplicate_object then null; end $$;


-- =====================================================================
-- 2. PLACE_UPDATES — place_kind and update_day
-- =====================================================================
-- The daily edit limit reads both of these:
--   app/actions/updatePlace.ts        .eq("place_kind", …).eq("update_day", …)
--   app/update/[placeId]/page.tsx     .eq("place_kind", …).eq("update_day", …)
--
-- They are derived in spirit: update_day is the date part of created_at,
-- place_kind is the parent place's type. A trigger fills them on insert
-- so no application code has to remember to.

alter table public.place_updates
  add column if not exists place_kind place_type;

alter table public.place_updates
  add column if not exists update_day date;

-- Backfill anything inserted before these columns existed.
update public.place_updates u
  set place_kind = p.place_type
  from public.places p
  where u.place_id = p.id
    and u.place_kind is null;

update public.place_updates
  set update_day = (created_at at time zone 'utc')::date
  where update_day is null;

create index if not exists place_updates_limit_idx
  on public.place_updates (user_id, place_kind, update_day)
  where update_type <> 'photo';

-- A trigger keeps them honest on every future insert, without the
-- application having to send them.
create or replace function public.place_updates_fill_derived()
returns trigger language plpgsql as $$
begin
  new.update_day = coalesce(
    new.update_day,
    (coalesce(new.created_at, now()) at time zone 'utc')::date
  );

  if new.place_kind is null then
    select p.place_type into new.place_kind
      from public.places p
      where p.id = new.place_id;
  end if;

  return new;
end $$;

drop trigger if exists place_updates_fill_derived on public.place_updates;
create trigger place_updates_fill_derived
  before insert on public.place_updates
  for each row execute function public.place_updates_fill_derived();


-- =====================================================================
-- 3. PLACE_FIELD_CHECKS — "who verified this field, and when"
-- =====================================================================
-- Written by app/actions/verify.ts and by createPlace (one row per
-- field the person filled in). Read by getMyWeekChecks and by the
-- place page, which renders one row per field underneath the tables.

create table if not exists public.place_field_checks (
  id uuid primary key default gen_random_uuid(),
  place_id uuid not null references public.places(id) on delete cascade,
  field_key text not null,
  verified_by uuid references auth.users(id) on delete set null,
  verified_by_name text not null default 'someone',
  value_snapshot text,
  comment text,
  verified_at timestamptz not null default now()
);

create index if not exists place_field_checks_place_idx
  on public.place_field_checks (place_id, verified_at desc);

create index if not exists place_field_checks_user_idx
  on public.place_field_checks (verified_by, verified_at desc);

-- One check per field, per person, per calendar week.
-- verify.ts catches the 23505 this produces and turns it into
-- "You already checked this week. Come back in a few days."
--
-- date_trunc('week', …) is ISO: weeks start on Monday.
create unique index if not exists place_field_checks_weekly_uniq
  on public.place_field_checks (
    place_id,
    field_key,
    verified_by,
    (date_trunc('week', verified_at))
  );


-- =====================================================================
-- 4. PLACE_LATEST_CHECKS — one row per field, the most recent check
-- =====================================================================
-- getPlace() reads this to show "last verified by X, N days ago" next
-- to each value. DISTINCT ON keeps the newest row per field.

create or replace view public.place_latest_checks as
select distinct on (c.place_id, c.field_key)
  c.place_id,
  c.field_key,
  c.verified_at,
  c.value_snapshot,
  c.verified_by,
  c.verified_by_name
from public.place_field_checks c
order by c.place_id, c.field_key, c.verified_at desc;


-- =====================================================================
-- 5. SITE_SETTINGS — reports_to_hide / reporters_to_hide
-- =====================================================================
-- 0001 declared reports_to_flag, but lib/services/settings.ts reads
-- reports_to_hide and reporters_to_hide. Rename the first and add the
-- second, so the value already in the table is kept.
--
-- The rename is conditional: if 0001 was never applied, the column
-- does not exist and both are simply created with their defaults.

do $$ begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'site_settings'
      and column_name = 'reports_to_flag'
  ) and not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'site_settings'
      and column_name = 'reports_to_hide'
  ) then
    alter table public.site_settings
      rename column reports_to_flag to reports_to_hide;
  end if;
end $$;

alter table public.site_settings
  add column if not exists reports_to_hide integer not null default 8;

alter table public.site_settings
  add column if not exists reporters_to_hide integer not null default 5;


-- =====================================================================
-- 6. ROW LEVEL SECURITY
-- =====================================================================
-- Same shape as every other table in 0001: anyone may read, only the
-- signed-in author may write their own row.

alter table public.place_field_checks enable row level security;

drop policy if exists "field checks are readable by all"
  on public.place_field_checks;

create policy "field checks are readable by all"
  on public.place_field_checks
  for select
  using (true);

drop policy if exists "users insert their own field checks"
  on public.place_field_checks;

create policy "users insert their own field checks"
  on public.place_field_checks
  for insert
  to authenticated
  with check (auth.uid() = verified_by);

drop policy if exists "users update their own field checks"
  on public.place_field_checks;

create policy "users update their own field checks"
  on public.place_field_checks
  for update
  to authenticated
  using (auth.uid() = verified_by)
  with check (auth.uid() = verified_by);
