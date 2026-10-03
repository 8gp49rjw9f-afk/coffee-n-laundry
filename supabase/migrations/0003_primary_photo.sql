-- =====================================================================
-- coffee'n'laundry — 0003: the primary photo
-- =====================================================================
-- A place's photo strip keeps one photo marked as the primary: the
-- one that represents the place on the map and anywhere a single
-- image is needed. Until now nothing carried that fact — the strip
-- simply rendered whatever came back, in arrival order.
--
-- Additive and idempotent, like 0002: safe to re-run, nothing dropped
-- except the view, which is dropped and rebuilt in section 6.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. THE COLUMN
-- ---------------------------------------------------------------------

alter table public.place_photos
  add column if not exists is_primary boolean not null default false;


-- ---------------------------------------------------------------------
-- 2. AT MOST ONE PRIMARY PER PLACE
-- ---------------------------------------------------------------------
-- A partial unique index, not a constraint: it applies only to the
-- rows that are actually primary, so a place with many photos has
-- exactly one true and the rest unconstrained.

create unique index if not exists place_photos_one_primary_idx
  on public.place_photos (place_id)
  where is_primary;


-- ---------------------------------------------------------------------
-- 3. BACKFILL
-- ---------------------------------------------------------------------
-- Existing places get their oldest photo as primary, so the strip has
-- something to point at before anyone chooses. The "not exists" guard
-- keeps it from fighting a place that already has one marked, which
-- can happen on a re-run.

update public.place_photos p
  set is_primary = true
  where p.id in (
    select distinct on (ph.place_id) ph.id
    from public.place_photos ph
    where not exists (
      select 1 from public.place_photos x
      where x.place_id = ph.place_id
        and x.is_primary
    )
    order by ph.place_id, ph.created_at asc
  );


-- ---------------------------------------------------------------------
-- 4. A NEW PLACE'S FIRST PHOTO IS PRIMARY BY DEFAULT
-- ---------------------------------------------------------------------
-- Otherwise every upload would land unmarked and the strip would have
-- nothing to show. The trigger marks a photo primary when its place
-- has none yet.

create or replace function public.place_photos_default_primary()
returns trigger language plpgsql as $$
begin
  if not new.is_primary then
    select not exists (
      select 1 from public.place_photos p
      where p.place_id = new.place_id
        and p.is_primary
    ) into new.is_primary;
  end if;

  return new;
end $$;

drop trigger if exists place_photos_default_primary on public.place_photos;
create trigger place_photos_default_primary
  before insert on public.place_photos
  for each row execute function public.place_photos_default_primary();


-- ---------------------------------------------------------------------
-- 5. DELETING THE PRIMARY PROMOTES ANOTHER
-- ---------------------------------------------------------------------
-- Without this, deleting the primary leaves the place with no image.
-- The oldest remaining photo takes over.

create or replace function public.place_photos_promote_after_delete()
returns trigger language plpgsql as $$
begin
  if old.is_primary then
    update public.place_photos
      set is_primary = true
      where id = (
        select id from public.place_photos
        where place_id = old.place_id
        order by created_at asc
        limit 1
      );
  end if;

  return old;
end $$;

drop trigger if exists place_photos_promote_after_delete on public.place_photos;
create trigger place_photos_promote_after_delete
  after delete on public.place_photos
  for each row execute function public.place_photos_promote_after_delete();


-- ---------------------------------------------------------------------
-- 6. EXPOSE IT ON THE FRESHNESS VIEW
-- ---------------------------------------------------------------------
-- The strip reads place_photos directly, but the map panel and any
-- single-image surface want the path without a second query.
--
-- A view has to be DROPPED and recreated to gain a column: Postgres'
-- CREATE OR REPLACE VIEW only accepts a definition compatible with the
-- existing one (same columns, same order), and adding one at the end
-- is not. Without the drop it fails with 42P16.
--
-- Dropping is safe here: nothing in the database depends on this view.
-- The reads that use it (getPlacesForMap, getPlace, getPlacesNearby,
-- searchPlaces) are application calls, not SQL dependencies.

drop view if exists public.places_with_freshness;

create view public.places_with_freshness as
select
  p.*,
  greatest(
    p.updated_at,
    coalesce((select max(c.created_at) from public.place_confirmations c
              where c.place_id = p.id), p.created_at),
    coalesce((select max(u.created_at) from public.place_updates u
              where u.place_id = p.id), p.created_at)
  ) as last_verified_at,
  (select count(*) from public.place_confirmations c
   where c.place_id = p.id) as confirmations_count,
  (select count(*) from public.place_updates u
   where u.place_id = p.id) as updates_count,
  (select count(*) from public.place_photos ph
   where ph.place_id = p.id) as photos_count,
  (select ph.storage_path from public.place_photos ph
   where ph.place_id = p.id
   order by ph.is_primary desc, ph.created_at asc
   limit 1) as primary_photo_path
from public.places p;


-- ---------------------------------------------------------------------
-- 7. RLS FOR DELETE
-- ---------------------------------------------------------------------
-- 0001 let authenticated users write their own rows. Deleting a photo
-- needs the same idea: the person who uploaded it, or the person who
-- created the place. Anyone else cannot.

drop policy if exists "uploaders and owners delete photos"
  on public.place_photos;

create policy "uploaders and owners delete photos"
  on public.place_photos
  for delete
  to authenticated
  using (
    auth.uid() = uploaded_by
    or auth.uid() = (
      select pl.created_by from public.places pl where pl.id = place_id
    )
  );
