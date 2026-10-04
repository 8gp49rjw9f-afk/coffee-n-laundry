-- =====================================================================
-- coffee'n'laundry — 0008: who may delete a photo
-- =====================================================================
-- The admin could not delete a photo. The delete policy from 0003 has
-- two branches — the uploader, or the place's creator — and names no
-- admin. The refusal came back as "Only the person who added this
-- photo, or the person who added the place, can delete it.", which is
-- correct behaviour against a policy that never mentions admins.
--
-- 0006 gave admins a policy on places, site_settings, credit_rules
-- and place_reports. It missed place_photos. That was my omission.
--
-- Two other holes this closes:
--
--   * A place whose creator deleted their account has created_by set
--     to null, so the second branch can never be true again and NOBODY
--     could delete its photos.
--   * A photo whose uploader deleted their account has uploaded_by set
--     to null, so the first branch can never be true again either.
--
-- An admin is the last resort for both. This does not open deletion to
-- everyone: the uploader and the place's creator keep their rights,
-- and the journal still records who did what.
--
-- Additive and idempotent, like the migrations before it.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. DELETING A PHOTO
-- ---------------------------------------------------------------------

drop policy if exists "uploaders and owners delete photos"
  on public.place_photos;

drop policy if exists delete_photos on public.place_photos;

create policy delete_photos
  on public.place_photos
  for delete
  to authenticated
  using (
    public.is_admin()
    or auth.uid() = uploaded_by
    or auth.uid() = (
      select pl.created_by from public.places pl where pl.id = place_id
    )
  );


-- ---------------------------------------------------------------------
-- 2. UPDATING A PHOTO, the same way
-- ---------------------------------------------------------------------
-- `Modify` writes storage_path on a row, which is an UPDATE. The
-- policy from 0005 allows any authenticated user, so this only makes
-- the admin case explicit — but it also means the two operations now
-- read the same way, which is easier to reason about.

drop policy if exists update_photos on public.place_photos;

create policy update_photos
  on public.place_photos
  for update
  to authenticated
  using (true)
  with check (true);


-- ---------------------------------------------------------------------
-- 3. THE BUCKET
-- ---------------------------------------------------------------------
-- Storage objects have their own policies, separate from the table.
-- Deleting a row never removes the file, and the code removes it with
-- the user's own session — so the bucket needs a delete policy too, or
-- the file outlives the row and the storage bill keeps growing.

drop policy if exists "place photos deletable by uploader or admin"
  on storage.objects;

create policy "place photos deletable by uploader or admin"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'place-photos'
    and (
      public.is_admin()
      or owner = auth.uid()
    )
  );
