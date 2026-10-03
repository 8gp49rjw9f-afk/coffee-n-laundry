-- =====================================================================
-- coffee'n'laundry — 0005: everyone signed in may update photos
-- =====================================================================
-- place_photos had INSERT and SELECT policies but no UPDATE. PostgREST
-- then refuses an update silently: zero rows change, no error comes
-- back. Choosing a cover photo looked like it worked and quietly did
-- nothing.
--
-- The policy is deliberately open to any authenticated user. This is a
-- community map: marking which photo represents a place is the same
-- kind of act as correcting a price, which anyone signed in may do.
-- Who may DELETE a photo is a different and stricter question, and
-- 0003 answers it (uploader or place creator).
--
-- Additive and idempotent, like the migrations before it.
-- =====================================================================

drop policy if exists update_photos on public.place_photos;

create policy update_photos
  on public.place_photos
  for update
  to authenticated
  using (true)
  with check (true);


-- ---------------------------------------------------------------------
-- And the same for the cover, in case anyone deleted their account
-- ---------------------------------------------------------------------
-- A photo whose uploader is gone (uploaded_by is null) can still be
-- deleted by the place's creator, but nothing stops the place being
-- left with no cover if 0003's AFTER DELETE trigger cannot find a
-- candidate. This is the repair, run the same way as 0004.

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
