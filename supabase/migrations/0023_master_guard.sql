-- =====================================================================
-- coffee'n'laundry — 0023: a master cannot be removed by others
-- =====================================================================
-- THE RULE, as it was finally stated:
--
--   A master can only remove THEMSELVES. Nobody else can remove a
--   master, and the last master cannot leave at all.
--
-- WHY THERE IS NO "ONE MASTER ONLY" CONSTRAINT HERE
--
-- Earlier drafts of this file were going to enforce a single master
-- with a partial unique index. The database says otherwise: there
-- are two, both legitimate, and the rule the project landed on is
-- that a master can PROMOTE another admin to master. So more than
-- one master is a valid state, not an anomaly — a unique index
-- would have refused to build on the existing table, and would have
-- made the legitimate case impossible.
--
-- WHAT THIS FILE DOES
--
-- Exactly one thing, and it is the floor under all the rest: the
-- LAST master cannot be deleted. Not by an admin action, not by a
-- mistake in the SQL editor.
--
-- The rest of the rule — "only yourself", "not another master" —
-- cannot live here. A trigger sees the row and nothing else: it
-- cannot know WHO is asking. That part belongs in removeAdmin, in
-- app/actions/admin.ts, which knows the caller. Same split as the
-- reporting window in 0020: the part an index or a trigger can
-- express is enforced in the database, the part that needs to know
-- who is acting lives in the action.
--
-- HOW THE FLOOR WORKS, AND WHAT IT MEANS IN PRACTICE
--
-- The trigger counts masters BEFORE the delete and refuses when
-- only one is left. So the last master can never be removed by a
-- DELETE statement, whoever runs it.
--
-- The consequence, worth stating plainly: to REPLACE the last
-- master you promote somebody else first, then step down. You
-- cannot delete your way to a new master.
--
-- Additive and idempotent, like the migrations before it.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. THE FUNCTION
-- ---------------------------------------------------------------------

create or replace function public.admins_keep_last_master()
returns trigger
language plpgsql
as $$
declare
  masters_left integer;
begin
  /* Only rows that ARE masters matter. Deleting an ordinary admin
     has nothing to do with this rule. */
  if not old.is_master then
    return old;
  end if;

  select count(*) into masters_left
    from public.admins
    where is_master is true
      and email <> old.email;

  if masters_left < 1 then
    raise exception
      'the last master cannot be removed: promote another admin to master first'
      using errcode = 'P0001';
  end if;

  return old;
end $$;


-- ---------------------------------------------------------------------
-- 2. THE TRIGGER
-- ---------------------------------------------------------------------
-- BEFORE, not AFTER: the check has to run while the row is still
-- there. Dropped and recreated rather than "create or replace",
-- because Postgres has no replace for a trigger.

drop trigger if exists admins_keep_last_master on public.admins;

create trigger admins_keep_last_master
  before delete on public.admins
  for each row
  execute function public.admins_keep_last_master();


-- ---------------------------------------------------------------------
-- 3. THE CHECK, SO THIS CANNOT BE MISSED
-- ---------------------------------------------------------------------
-- 0019, 0020 and 0022 all taught the same lesson: a migration that
-- is meant to change something says, in the database, that it did.
-- Here that is the trigger existing, and at least one master still
-- being on the list — the second half matters because this file is
-- about to make masters harder to remove, and running it against a
-- table with none would lock the panel for good.

do $$
declare
  has_trigger boolean;
  master_count integer;
begin
  select exists (
    select 1 from pg_trigger
    where tgname = 'admins_keep_last_master'
      and tgrelid = 'public.admins'::regclass
      and not tgisinternal
  ) into has_trigger;

  if not has_trigger then
    raise exception
      'admins_keep_last_master was not created: the last master could be deleted';
  end if;

  select count(*) into master_count
    from public.admins
    where is_master is true;

  if master_count < 1 then
    raise exception
      'admins has no master: nobody could change the list';
  end if;
end $$;
