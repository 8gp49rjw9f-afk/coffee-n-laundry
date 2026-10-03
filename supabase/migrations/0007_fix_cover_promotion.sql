-- =====================================================================
-- coffee'n'laundry — 0007: fix the cover promotion on delete
-- =====================================================================
-- Deleting a photo raised an error, and in production Next reported
-- only "An error occurred in the Server Components render".
--
-- The cause is in 0003's AFTER DELETE trigger. Its subquery picked
-- the oldest photo of the place without excluding the row being
-- deleted, so when the deleted photo WAS the oldest — the common
-- case — the trigger tried to mark the row that was on its way out.
-- The partial unique index then saw two primaries in the same
-- statement and raised.
--
-- Two fixes, and they are independent:
--   1. exclude the deleted row from the candidate,
--   2. never let this trigger fail the delete. A place with no cover
--      is a cosmetic problem; a photo that cannot be deleted is a
--      broken page.
--
-- Additive and idempotent, like the migrations before it.
-- =====================================================================


create or replace function public.place_photos_promote_after_delete()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  candidate uuid;
begin
  /* Only a primary's departure leaves a hole. */
  if not old.is_primary then
    return old;
  end if;

  /* Be explicit about excluding the row being deleted: it costs
     nothing and removes any doubt about what the subquery sees. */
  select p.id into candidate
    from public.place_photos p
    where p.place_id = old.place_id
      and p.id <> old.id
    order by p.created_at asc
    limit 1;

  /* The last photo of a place: nothing to promote, and that is fine. */
  if candidate is null then
    return old;
  end if;

  begin
    update public.place_photos
      set is_primary = true
      where id = candidate;
  exception
    when unique_violation then
      /* Another primary appeared in the same statement — a second
         delete, or a concurrent cover change. Losing that race is not
         a reason to fail the delete that triggered us. */
      null;
  end;

  return old;
end $$;

/* SECURITY DEFINER, so the promotion is not subject to the caller's
   RLS. Without it the trigger would silently do nothing for a delete
   allowed by the delete policy but not by the update policy —
   leaving the place with no cover and no error to explain it. */


-- ---------------------------------------------------------------------
-- Repair: any place left without a cover gets one
-- ---------------------------------------------------------------------

with first_photo as (
  select distinct on (place_id) id, place_id
  from public.place_photos
  order by place_id, created_at asc
),
needing as (
  select f.id
  from first_photo f
  where not exists (
    select 1 from public.place_photos p
    where p.place_id = f.place_id
      and p.is_primary
  )
)
update public.place_photos
  set is_primary = true
  where id in (select id from needing);
