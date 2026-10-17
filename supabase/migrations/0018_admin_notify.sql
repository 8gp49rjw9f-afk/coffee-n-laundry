-- =====================================================================
-- coffee'n'laundry — 0018: which admins want the notification mail
-- =====================================================================
-- The contact form sends to the admins, and every admin got a copy of
-- everything a visitor wrote. There was no way to decline: the list of
-- recipients was the whole table, read without a filter.
--
-- So a second admin, added only to help moderate places, also started
-- receiving every bug report and every message. The options were to
-- keep the mail or to be removed as an admin, and those are two
-- different things that should not be one choice.
--
-- WHAT THIS ADDS
--
--   1. `notify_email` on public.admins — true by default, so the
--      admins who already existed keep receiving and nobody loses the
--      mail by a migration they did not ask for.
--   2. A NOT NULL, so the switch has two states rather than three.
--      A nullable boolean would let a row sit at NULL, and `is.true`
--      in the contact form's filter does not match NULL — that admin
--      would stop receiving with nobody having touched the switch.
--
-- THE LAST ONE KEEPS IT ON
--
-- The application refuses to turn off the last switch that is on (see
-- setAdminNotify in app/actions/admin.ts, code ADMIN_LAST_NOTIFY).
-- That is a rule about a running site, not about the shape of the
-- table: at the moment this runs, an empty table or every row off is
-- still a valid state to migrate into.
--
-- Additive and idempotent, like the migrations before it.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. THE COLUMN
-- ---------------------------------------------------------------------
alter table public.admins
  add column if not exists notify_email boolean not null default true;


-- ---------------------------------------------------------------------
-- 2. SETTLING WHAT IS ALREADY THERE
-- ---------------------------------------------------------------------
-- `add column ... default true` fills existing rows on a modern
-- Postgres, so this is a belt on top of braces. It is here because the
-- column was first created by hand in the SQL editor on this project,
-- without a default — so on that database there may be a row sitting
-- at NULL, and NULL does not match `notify_email=is.true`.

update public.admins
  set notify_email = true
  where notify_email is null;


-- ---------------------------------------------------------------------
-- 3. THE COLUMN IS NOT NULL, FROM HERE ON
-- ---------------------------------------------------------------------
-- The `is not null` is separate from the `add column` above on
-- purpose. `add column if not exists ... not null` is a no-op when the
-- column already exists — which is exactly the case on the database
-- that already has it, and the case where the constraint is missing.

alter table public.admins
  alter column notify_email set default true;

alter table public.admins
  alter column notify_email set not null;
