/*
 * The field keys, in one place.
 *
 * WHY THIS FILE EXISTS
 *
 * The same list used to live in three places that could not check each
 * other: the `place_field` enum in Postgres, a `type FieldKey` inside
 * app/actions/places.ts, and the `push()` calls next to it. They
 * drifted. The enum was missing `food` and `detergent_price` while the
 * code wrote both, and because the verification insert had no error
 * handling, ticking a single Food option on a coffee shop took the
 * whole action down with an opaque production error. Migration 0014
 * repaired the enum; this file stops the drift.
 *
 * HOW IT IS USED
 *
 * `FIELD_KEYS` is the runtime list — the values the app actually
 * writes. `FieldKey` is derived from it, so a `push("food")` with
 * `food` missing from the array is a compile error rather than a
 * production surprise.
 *
 * WHAT THIS LIST IS NOT
 *
 * It is not every value the database enum accepts. The enum carries
 * several values nothing writes — see the note below — and this list
 * deliberately covers only what has a writer. Adding a key here means
 * two things at once: the type accepts it, and the enum must accept it
 * too. Migrations are where the second half happens.
 */

export const FIELD_KEYS = [
  /* coffee */
  "coffee_kind",
  "espresso_price",
  "filter_price",
  "flat_white_price",
  "beans",
  "roaster_available",
  "ambience",
  "food",
  "decaf",
  "milk",
  "oat_milk",
  "soy_milk",
  "coconut_milk",
  "almond_milk",
  "laptop",

  /* laundry */
  "wash_price",
  "dryer_price",
  "wash_minutes",
  "dryer_minutes",
  "last_entry",
  "machines",
  "detergent",
  "detergent_purchase",
  "detergent_price",

  /* both */
  "wifi",
  "power",
  "parking",
  "seating",
  "toilets",
  "payment_methods",
] as const;

export type FieldKey = (typeof FIELD_KEYS)[number];

/*
 * VALUES IN THE ENUM THAT NOTHING WRITES
 *
 * Documented here rather than deleted, because removing a value from a
 * Postgres enum is not a DROP: it means recreating the type, migrating
 * the column and rebuilding every index that depends on it. That is a
 * real risk to take on data for no functional gain, so they stay and
 * are explained instead.
 *
 *   website        — kept on purpose. The URL lives on `places.website`;
 *                    this key could one day record who confirmed it.
 *   open_24h       — kept on purpose. The setting itself is a boolean on
 *                    `place_laundry_details` and works; only the
 *                    verification key is unused, and it may be worth
 *                    recording who confirmed the 24h claim.
 *   disputed       — purpose never established. Nothing writes it and
 *                    nothing reads it. Left alone rather than removed
 *                    on a guess.
 *   amenities      — a catch-all, superseded by the wifi / power /
 *                    parking / seating / toilets keys that each have
 *                    their own. Dead weight, kept for the same reason
 *                    as the rest.
 *   opening_hours  — being retired. Hours will come from a photo rather
 *                    than from someone typing them in, so this key is
 *                    not part of FIELD_KEYS and should not be written.
 *                    It stays in the enum until a future migration
 *                    rebuilds the type, if that is ever worth doing.
 *   milk           — WAS unused, and is now live: it means COW MILK,
 *                    sitting beside the four alternatives above. The
 *                    form offers it and createPlace writes it.
 */
