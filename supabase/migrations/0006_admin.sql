-- =====================================================================
-- coffee'n'laundry — 0006: the admin panel
-- =====================================================================
-- Two levels:
--   Admin  — moderates content, edits the site's own settings.
--   Master — does all of that, and decides who the admins are.
--
-- The Master is a flag on a row rather than an email in code: put
-- your own address in the table and nothing personal enters the repo.
--
-- Every policy here is written against a helper function so the rule
-- lives in one place. Without them, `admins` would be readable and
-- writable by anyone — a user could promote themselves with a single
-- insert.
--
-- Additive and idempotent, like the migrations before it.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. THE MASTER FLAG
-- ---------------------------------------------------------------------

alter table public.admins
  add column if not exists is_master boolean not null default false;


-- ---------------------------------------------------------------------
-- 2. WHO IS ASKING
-- ---------------------------------------------------------------------
-- SECURITY DEFINER so the check itself is not subject to the very
-- policies it is used to write: a policy on `admins` that calls a
-- function which reads `admins` would otherwise recurse.
--
-- `search_path` is pinned, as SECURITY DEFINER functions must be.

create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.admins a
    where a.email = nullif(current_setting('request.jwt.claims', true)::jsonb ->> 'email', '')
  );
$$;

create or replace function public.is_master()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.admins a
    where a.email = nullif(current_setting('request.jwt.claims', true)::jsonb ->> 'email', '')
      and a.is_master
  );
$$;


-- ---------------------------------------------------------------------
-- 3. ADMINS — read by admins, written by the Master alone
-- ---------------------------------------------------------------------

alter table public.admins enable row level security;

drop policy if exists admins_read on public.admins;
create policy admins_read
  on public.admins
  for select
  to authenticated
  using (public.is_admin());

drop policy if exists admins_insert on public.admins;
create policy admins_insert
  on public.admins
  for insert
  to authenticated
  with check (public.is_master());

drop policy if exists admins_delete on public.admins;
create policy admins_delete
  on public.admins
  for delete
  to authenticated
  using (public.is_master());

/* A Master cannot be demoted through the table: an update may only
   clear is_master on a row that is not the caller's own. */

drop policy if exists admins_update on public.admins;
create policy admins_update
  on public.admins
  for update
  to authenticated
  using (public.is_master())
  with check (public.is_master());


-- ---------------------------------------------------------------------
-- 4. SITE SETTINGS — every admin may edit
-- ---------------------------------------------------------------------

alter table public.site_settings enable row level security;

drop policy if exists settings_read on public.site_settings;
create policy settings_read
  on public.site_settings
  for select
  using (true);

drop policy if exists settings_update on public.site_settings;
create policy settings_update
  on public.site_settings
  for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());


-- ---------------------------------------------------------------------
-- 5. CREDIT RULES — every admin may edit
-- ---------------------------------------------------------------------

alter table public.credit_rules enable row level security;

drop policy if exists rules_read on public.credit_rules;
create policy rules_read
  on public.credit_rules
  for select
  using (true);

drop policy if exists rules_update on public.credit_rules;
create policy rules_update
  on public.credit_rules
  for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());


-- ---------------------------------------------------------------------
-- 6. REPORTS — every admin may resolve one
-- ---------------------------------------------------------------------

alter table public.place_reports enable row level security;

drop policy if exists reports_read on public.place_reports;
create policy reports_read
  on public.place_reports
  for select
  using (true);

drop policy if exists reports_insert on public.place_reports;
create policy reports_insert
  on public.place_reports
  for insert
  to authenticated
  with check (auth.uid() = reported_by);

drop policy if exists reports_update on public.place_reports;
create policy reports_update
  on public.place_reports
  for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());


-- ---------------------------------------------------------------------
-- 7. PLACES — an admin may set a place's status
-- ---------------------------------------------------------------------
-- Reporting already moves a place to 'unverified' automatically once
-- enough people agree. This lets an admin do it deliberately, and lets
-- them close a place outright.

drop policy if exists places_admin_status on public.places;
create policy places_admin_status
  on public.places
  for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());


-- ---------------------------------------------------------------------
-- 8. ONE REPORT PER PERSON, ENFORCED
-- ---------------------------------------------------------------------
-- reportPlace already treats 23505 as "already reported", so the
-- unique index it expects has to exist.

create unique index if not exists place_reports_one_per_user_idx
  on public.place_reports (place_id, reported_by)
  where reported_by is not null;
