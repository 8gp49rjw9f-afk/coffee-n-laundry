-- =====================================================================
-- coffee'n'laundry — 0019: reading the reports, for an admin
-- =====================================================================
-- The moderation tab showed "Nothing waiting. The map is holding up."
-- while the reports were in the table. Not a bug in the panel: the
-- panel was reading correctly what RLS let it see, and RLS let it
-- see nothing.
--
-- 0017 added policies for DELETE on place_reports, places and
-- place_photos. INSERT already had one. UPDATE already had one. What
-- was never added, anywhere, is SELECT — and a table with RLS
-- enabled and no SELECT policy returns zero rows with no error at
-- all. `select * from place_reports where resolved = false` came
-- back as an empty list, so `groups` was empty, so the tab said
-- there was nothing to do.
--
-- The same silence as 0017, on the reading side rather than the
-- deleting side. Both are the shape a missing policy takes: the
-- query succeeds, the answer is wrong, and nothing says so.
--
-- WHY NOT WIDER
--
-- Reporting needs no SELECT: the insert policy is enough, and a
-- person reporting a place should not be able to list who reported
-- what. Reading is for admins deciding what to do about a place.
--
-- Additive and idempotent, like the migrations before it.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. THE POLICY
-- ---------------------------------------------------------------------
-- Same shape as profiles_admin_read in 0011 and places_admin_delete
-- in 0017: the rule lives in one function rather than being retyped.

drop policy if exists reports_admin_read on public.place_reports;
create policy reports_admin_read
  on public.place_reports
  for select
  to authenticated
  using (public.is_admin());


-- ---------------------------------------------------------------------
-- 2. A CHECK, SO THIS CANNOT BE MISSED TWICE
-- ---------------------------------------------------------------------
-- The insert policy is required for the form to work at all; the
-- select policy is the one this migration adds. Both are asserted
-- here, and the migration fails loudly if either is absent — which
-- is the opposite of what a missing policy did before.

do $$
declare
  missing text[];
begin
  select array_agg(needed)
    into missing
    from unnest(array['insert_reports', 'reports_admin_read']) as needed
    where not exists (
      select 1 from pg_policies
      where schemaname = 'public'
        and tablename = 'place_reports'
        and policyname = needed
    );

  if missing is not null then
    raise exception 'place_reports is missing policies: %', array_to_string(missing, ', ');
  end if;
end $$;
