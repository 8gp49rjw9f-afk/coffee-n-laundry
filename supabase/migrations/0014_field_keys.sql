-- =====================================================================
-- coffee'n'laundry — 0014: two field keys the form writes and the type
--                            refused
-- =====================================================================
-- The symptom: adding a coffee place and ticking a Food option threw
-- an opaque production error, and the place was created but its page
-- would not load.
--
-- The cause: `createPlace` writes one row per filled-in field into
-- `place_field_checks.field_key`, which is the enum `place_field`.
-- Two of the values it writes were never added to that enum:
--
--   food             — written when any Food option is ticked
--   detergent_price  — written when a laundry sells detergent
--
-- The insert carries no try/catch, so one refused value takes the
-- whole action down. Coffee places hit it as soon as a food option is
-- chosen, which is why it looked like a "barista" problem: that is
-- where the Food section lives.
--
-- Run this, then reload. ALTER TYPE ... ADD VALUE cannot be used in
-- the same transaction that uses the new value, which is why each one
-- sits in its own do block with duplicate_object swallowed — the same
-- shape 0002 already uses for price_kind.
--
-- Idempotent: re-running is harmless.
-- =====================================================================

do $$ begin
  alter type public.place_field add value if not exists 'food';
exception when duplicate_object then null; end $$;

do $$ begin
  alter type public.place_field add value if not exists 'detergent_price';
exception when duplicate_object then null; end $$;
