-- =====================================================================
-- coffee'n'laundry — 0016: the cow milk column
-- =====================================================================
-- 0015 added `milk` to the place_field enum (who verified it), but no
-- migration ever added the COLUMN that stores the answer. createPlace
-- and updatePlace now write `place_coffee_details.has_milk`, so without
-- this every coffee place would fail to save.
--
-- Run this BEFORE deploying the code that writes has_milk.
-- Idempotent: re-running is harmless.
-- =====================================================================

alter table public.place_coffee_details
  add column if not exists has_milk boolean;
