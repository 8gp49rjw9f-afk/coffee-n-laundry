-- =====================================================================
-- coffee'n'laundry — 0017: deleting a place, for an admin
-- =====================================================================
-- The DELETE button in the place header worked from the interface and
-- did nothing to the database. Not a bug in the button: there was no
-- policy to allow it.
--
-- 0001 declares `delete_prices` on place_prices and nothing else. On
-- `places`, on place_photos, on place_reports there was no DELETE
-- policy at all — and a table with RLS enabled and no delete policy
-- refuses in silence. `delete ... where id = …` affects zero rows and
-- returns no error, so the action reported success over a place that
-- was still there.
--
-- WHAT THIS ADDS
--
--   1. DELETE policies for admins on places, place_photos and
--      place_reports — the three tables the interface clears. The
--      helper public.is_admin() already exists from 0006 and is
--      reused rather than repeated.
--   2. public.delete_place(uuid): one call that removes the row and
--      RAISES IF IT WAS NOT THERE, so "nothing happened" can never
--      again be reported as success.
--
-- The child tables need no separate work: 0001 declares every
-- place_id reference as `on delete cascade`, so removing the row in
-- `places` takes the coffee details, laundry details, prices, photos,
-- updates and confirmations with it.
--
-- Additive and idempotent, like the migrations before it.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. THE POLICIES
-- ---------------------------------------------------------------------
-- Same shape as places_admin_status in 0006: admins only, and the
-- rule lives in one function rather than being retyped per table.

drop policy if exists places_admin_delete on public.places;
create policy places_admin_delete
  on public.places
  for delete
  to authenticated
  using (public.is_admin());

drop policy if exists photos_admin_delete on public.place_photos;
create policy photos_admin_delete
  on public.place_photos
  for delete
  to authenticated
  using (public.is_admin());

drop policy if exists reports_admin_delete on public.place_reports;
create policy reports_admin_delete
  on public.place_reports
  for delete
  to authenticated
  using (public.is_admin());


-- ---------------------------------------------------------------------
-- 2. ONE CALL THAT CANNOT FAIL QUIETLY
-- ---------------------------------------------------------------------
-- SECURITY DEFINER so the cascade runs with the privileges the policy
-- above grants; `search_path` is pinned, as SECURITY DEFINER functions
-- must be.
--
-- The gate is checked inside as well as in the caller. The application
-- already calls requireAdmin() before getting here, but a function
-- that deletes a place should not depend on its caller having
-- remembered — two locks, the same reasoning as the panel itself.
--
-- get diagnostics ... = row_count is the point of the whole migration:
-- zero rows deleted is the failure we could not see before, and here
-- it raises instead of returning a polite nothing.

create or replace function public.delete_place(target_place_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  removed integer;
begin
  if not public.is_admin() then
    raise exception 'ADMIN_ONLY'
      using errcode = '42501';
  end if;

  delete from public.places where id = target_place_id;

  get diagnostics removed = row_count;

  if removed = 0 then
    raise exception 'PLACE_NOT_FOUND'
      using errcode = 'P0002';
  end if;
end $$;

/* Only signed-in people may call it, and the function itself decides
   whether they are an admin. */
revoke all on function public.delete_place(uuid) from public;
grant execute on function public.delete_place(uuid) to authenticated;
