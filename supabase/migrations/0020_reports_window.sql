-- =====================================================================
-- coffee'n'laundry — 0020: who may report a place, and how often
-- =====================================================================
-- The rule used to live in an index and nowhere else:
--
--   CREATE UNIQUE INDEX place_reports_user_idx
--     ON public.place_reports (place_id, reported_by);
--
-- No WHERE, no date, no exceptions. So the rule it enforced was
-- "one report per person per place, for ever" — and it could not say
-- anything else, because an index sees columns and nothing more.
--
-- Two things were wrong with that.
--
--   1. An ADMIN could not report a place twice, ever. The person
--      responsible for deciding about a reported place is the one
--      most likely to have already reported it, and the index
--      refused them a second word about it.
--
--   2. An ordinary person could not report the same place twice
--      either, not even a year later, after the earlier report had
--      been resolved and the price had changed again.
--
-- WHAT THIS CHANGES
--
-- The uniqueness moves out of the index and into the action.
-- `reportPlace` can ask two questions an index cannot: is this
-- person an admin, and what did they report in the last 24 hours.
--
--   Admins      — no ceiling at all.
--   Everyone    — one report per place per 24 hours.
--
-- The index below stays, without UNIQUE. It is the same index a
-- lookup on (place_id, reported_by) wants, and dropping it outright
-- would leave the check in the action scanning the table.
--
-- WHY NOT AN INDEX ON A DATE COLUMN
--
-- "Once every 24 hours" is a moving window, not a bucket. An index
-- over reported_at would answer "was there a report today", which is
-- a different rule with a different edge: 23:59 and 00:01 would be
-- two days apart by the calendar and two minutes apart in reality.
-- The action counts backwards from now, which is what was asked for.
--
-- Additive and idempotent, like the migrations before it.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. THE UNIQUENESS COMES OFF
-- ---------------------------------------------------------------------
-- Dropped and recreated rather than altered: Postgres has no ALTER
-- INDEX for this, and the two statements together are idempotent in
-- the way the rest of these migrations are.

drop index if exists public.place_reports_user_idx;

create index if not exists place_reports_user_idx
  on public.place_reports (place_id, reported_by);


-- ---------------------------------------------------------------------
-- 2. THE WINDOW THE ACTION NEEDS
-- ---------------------------------------------------------------------
-- The 24-hour check looks for one person's recent reports on one
-- place, newest first. This index is what keeps it from reading the
-- whole table — the same shape as place_reports_open_idx, which
-- already covers the other query on this table.

create index if not exists place_reports_recent_idx
  on public.place_reports (reported_by, place_id, created_at desc);


-- ---------------------------------------------------------------------
-- 3. THE CHECK, SO THIS CANNOT BE MISSED
-- ---------------------------------------------------------------------
-- After 0019 taught the lesson twice over, a migration that is
-- supposed to change something says what it changed. The unique
-- index must be gone: if it is still there, an admin still cannot
-- report a place twice and the whole point of this file is lost —
-- silently, which is the failure mode these files keep meeting.

do $$
declare
  still_unique boolean;
begin
  select bool_or(indexdef ilike '%unique%')
    into still_unique
    from pg_indexes
    where schemaname = 'public'
      and tablename = 'place_reports'
      and indexname = 'place_reports_user_idx';

  if still_unique then
    raise exception
      'place_reports_user_idx is still UNIQUE: an admin cannot report a place twice';
  end if;
end $$;
