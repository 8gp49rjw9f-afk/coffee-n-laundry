-- =====================================================================
-- coffee'n'laundry — 0022: one comment per person per day
-- =====================================================================
-- 0021 created place_comments and gave it an index on
-- (user_id, place_id, created_at desc), because the rule at the
-- time was “one comment per person PER PLACE per 24 hours”.
--
-- THAT RULE WAS WRONG, and not by a little. What it was there to
-- stop is a wave — one person opening twenty places and leaving a
-- word on each in ten minutes. A per-place ceiling does not stop
-- that at all: it lets every one of the twenty through, because
-- each is a different place. The rule that stops a wave is a
-- ceiling per PERSON.
--
-- So the window is now:
--
--   one comment per person per 24 hours, wherever it is posted.
--
-- Same place twice, or twenty different places — the question is
-- only whether this person has written anything in the last day.
--
-- WHAT THIS FILE CHANGES
--
-- Just the index. The rule itself lives in writeComment, in
-- app/actions/comments.ts, for the reason 0020 wrote down: 24 hours
-- is a moving window, not a bucket, and an index cannot express one.
-- An index over created_at would answer “did they write today”,
-- which is a different rule with a different edge — 23:59 and 00:01
-- are two minutes apart in reality and on different days by the
-- calendar.
--
-- The index has to match the query the action actually runs, and it
-- no longer mentions the place at all:
--
--   where user_id = me and created_at >= now - 24h
--
-- place_id leading in the middle of that index was work the query
-- could never use — Postgres can skip over it when the leading
-- columns match, but it is dead weight in the sort key, and the
-- index existed for a rule that no longer applies.
--
-- Additive and idempotent, like the migrations before it.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. THE INDEX THE NEW WINDOW WANTS
-- ---------------------------------------------------------------------

create index if not exists place_comments_user_recent_idx
  on public.place_comments (user_id, created_at desc);


-- ---------------------------------------------------------------------
-- 2. AND THE OLD ONE GOES
-- ---------------------------------------------------------------------
-- Dropped rather than left in place: it was created for the per-place
-- rule, nothing queries it now, and every index is paid for on every
-- insert. Recreating the table from 0021 alone would bring it back,
-- which is why this file drops it by name rather than assuming.

drop index if exists public.place_comments_recent_idx;


-- ---------------------------------------------------------------------
-- 3. THE CHECK, SO THIS CANNOT BE MISSED
-- ---------------------------------------------------------------------
-- The lesson of 0019 and 0020: a migration meant to change something
-- says, in the database, that it did. Here that is one thing — the
-- index the window check needs exists, under its new name. Without
-- it the check still works and scans the whole table instead, which
-- is exactly the kind of quiet wrongness these files exist to catch.

do $$
declare
  present boolean;
begin
  select exists (
    select 1 from pg_indexes
    where schemaname = 'public'
      and tablename = 'place_comments'
      and indexname = 'place_comments_user_recent_idx'
  ) into present;

  if not present then
    raise exception
      'place_comments_user_recent_idx is missing: the daily window check would scan the whole table';
  end if;
end $$;
