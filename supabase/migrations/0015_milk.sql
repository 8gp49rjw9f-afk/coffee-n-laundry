-- =====================================================================
-- coffee'n'laundry — 0015: cow milk, and a note on the rest
-- =====================================================================
-- Companion to 0014. That one added `food` and `detergent_price`,
-- which the code wrote and the type refused. This one adds `milk` —
-- cow milk, the fifth option beside oat / soy / coconut / almond,
-- which the form is about to offer.
--
-- The rest of the enum is left alone on purpose. Removing a value
-- from a Postgres enum is not a DELETE: it means recreating the type,
-- migrating the column and rebuilding every index and policy that
-- depends on it. Four values here have no writer, and none of them is
-- worth that operation. They stay, documented in COMMENT below, so the
-- next person to read the schema is not left guessing.
--
--   opening_hours  — retired in spirit. Hours will come from a photo,
--                    not from someone typing them in. Not written by
--                    the app any more; left in the type.
--   disputed       — no writer, no reader, purpose unknown. Kept
--                    rather than dropped on a guess.
--   amenities      — superseded by wifi / power / parking / seating /
--                    toilets, which each have their own key.
--   website        — the URL lives on `places.website`. Kept in case
--                    it is ever useful to record who confirmed it.
--   open_24h       — the setting works as a boolean on
--                    `place_laundry_details`. Only this key is unused.
--
-- Idempotent: re-running is harmless.
-- =====================================================================

do $$ begin
  alter type public.place_field add value if not exists 'milk';
exception when duplicate_object then null; end $$;

comment on type public.place_field is
  'Which fact about a place a verification refers to. The writer is '
  'lib/fieldKeys.ts — that file is the list the app actually writes, '
  'and the two have to agree. Values here with no writer: '
  'opening_hours (retired, hours will come from a photo), website '
  '(kept, the URL lives on places.website), open_24h (kept, the '
  'setting is a boolean elsewhere), disputed and amenities (no writer, '
  'no reader, purpose unestablished).';
