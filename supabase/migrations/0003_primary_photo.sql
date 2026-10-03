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
