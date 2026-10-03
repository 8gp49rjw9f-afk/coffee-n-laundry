-- =====================================================================
-- coffee'n'laundry — 0004: atomic cover swap
-- =====================================================================
-- setPrimaryPhoto used to clear the old primary and set the new one in
-- two separate statements. Between them the place had no cover, and a
-- failure on the second write left it that way for good. The partial
-- unique index means the two cannot run in the other order either.
--
-- One function, one transaction: the place either gets a new cover or
-- nothing moved. SECURITY INVOKER is the default and is what we want —
-- RLS on place_photos still applies to whoever calls this.
--
-- Additive and idempotent, like 0002 and 0003.
-- =====================================================================

create or replace function public.set_primary_photo(
  p_place_id uuid,
  p_photo_id uuid
)
returns void
language plpgsql
as $$
declare
  target uuid;
begin
  /* The photo must belong to this place. Without this check a caller
     could point one place's cover at another place's photo. */
  select id into target
    from public.place_photos
    where id = p_photo_id
      and place_id = p_place_id;

  if target is null then
    raise exception 'photo % does not belong to place %',
      p_photo_id, p_place_id;
  end if;

  /* Clear first: the unique index allows only one true at a time, so
     setting the new one before clearing the old one would collide. */
  update public.place_photos
    set is_primary = false
    where place_id = p_place_id
      and is_primary
      and id <> target;

  update public.place_photos
    set is_primary = true
    where id = target;
end $$;


-- ---------------------------------------------------------------------
-- Repair: mark one cover per place that has photos but none marked
-- ---------------------------------------------------------------------
-- The 0003 backfill left every existing row at false. The same shape
-- as the repair run by hand, kept here so a fresh database ends up in
-- the same state as a repaired one.

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
