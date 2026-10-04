-- =====================================================================
-- coffee'n'laundry — 0009: food, and what the detergent costs
-- =====================================================================
-- Two additions the forms now send.
--
--   food            — what a coffee shop serves besides coffee, four
--                     coarse choices. A text array, like `ambience`
--                     and `machine_sizes`: the values are validated
--                     in the action against a fixed list, so a stray
--                     string cannot end up in the column.
--
--   detergent price — a `place_prices` row with kind 'detergent',
--                     not a new column. Prices already carry a
--                     currency, and reusing the table means the
--                     strip, the history and the verification all
--                     work on it with no further code.
--
-- Additive and idempotent, like the migrations before it.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. FOOD, on the coffee details
-- ---------------------------------------------------------------------

alter table public.place_coffee_details
  add column if not exists food text[] not null default '{}';


-- ---------------------------------------------------------------------
-- 2. A PRICE KIND FOR THE DETERGENT
-- ---------------------------------------------------------------------
-- ALTER TYPE ... ADD VALUE cannot run in the same transaction as a use
-- of the new value. It is on its own here.

do $$ begin
  alter type price_kind add value if not exists 'detergent';
exception when duplicate_object then null; end $$;


-- ---------------------------------------------------------------------
-- 3. THE UPDATED-AT TRIGGER ON THE DETAIL TABLE
-- ---------------------------------------------------------------------
-- The coffee details row is updated on every edit; without a trigger
-- the timestamp never moves. Cheap to add, and it makes the freshness
-- calculation correct for a place whose coffee facts changed.

create or replace function public.place_coffee_details_touch()
returns trigger language plpgsql as $$
begin
  new.notes = new.notes; -- no-op, kept for clarity of intent

  return new;
end $$;

/* There is no updated_at column on this table, so the function above
   does nothing useful — it is not installed. The trigger block is
   here as a note that freshness for coffee facts is derived from the
   parent place row, which already carries updated_at. */
