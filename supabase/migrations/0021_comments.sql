-- =====================================================================
-- coffee'n'laundry — 0021: comments on a place
-- =====================================================================
-- A comment is not an update. An update says what CHANGED about a
-- place and is written by the form that edits it; a comment is one
-- person saying one thing and nothing else. They have nothing to do
-- with each other, so they get separate tables.
--
-- WHAT WAS HERE BEFORE
--
-- There was a panel on the place page — “Last 5 updates” — reading
-- place_updates and rendering a timeline. It is gone, and the one
-- thing that was worth keeping from it, the count of confirmations,
-- now sits under the comments. `place_updates` itself is untouched:
-- it still records the history every field change goes through, and
-- the page still uses it for the “was 6$” line under a price. What
-- disappeared is the panel, not the record.
--
-- WHAT THIS FILE CREATES
--
--   place_comments   one row per comment
--
-- THE ONCE-A-DAY RULE IS NOT HERE
--
-- “One comment per person per place per 24 hours” is deliberately
-- absent from this file, for the reason 0020 spelled out for
-- reports: that rule is a moving window, and an index cannot
-- express one. A UNIQUE (place_id, user_id) would enforce “one
-- comment per place, for ever” — which is not what was asked, and
-- could never be relaxed later without another migration.
--
-- The rule lives in `writeComment`, in app/actions/comments.ts,
-- which counts backwards 24 hours from now and can therefore tell
-- 23:59 from 00:01 — a calendar bucket cannot.
--
-- The index below is the one that query wants: this person, this
-- place, newest first. Without it the check reads the whole table.
--
-- Additive and idempotent, like the migrations before it.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. THE TABLE
-- ---------------------------------------------------------------------

create table if not exists public.place_comments (
  id uuid primary key default gen_random_uuid(),

  place_id uuid not null
    references public.places (id) on delete cascade,

  user_id uuid not null
    references auth.users (id) on delete cascade,

  /* The name at the moment of writing, kept beside the id.
     Removing a user must not empty the comment: the row keeps the
     name it was posted under, the same way place_field_checks
     keeps verified_by_name. */
  author_name text not null default 'someone',

  /* 200 characters, enforced in the database rather than trusted
     to the form. Not a word count and not shown as one: the field
     simply refuses a novel. The check below is the real limit; the
     form only says “keep it short”. */
  body text not null
    check (char_length(btrim(body)) between 1 and 200),

  created_at timestamptz not null default now()
);


-- ---------------------------------------------------------------------
-- 2. THE INDEX THE WINDOW CHECK NEEDS
-- ---------------------------------------------------------------------
-- writeComment asks one question: did this person already comment on
-- this place in the last 24 hours. Same shape as
-- place_reports_recent_idx, which 0020 added for the same reason.

create index if not exists place_comments_recent_idx
  on public.place_comments (user_id, place_id, created_at desc);

/* And the plain read: the newest comments on one place. */

create index if not exists place_comments_place_idx
  on public.place_comments (place_id, created_at desc);


-- ---------------------------------------------------------------------
-- 3. RLS — AND THE SELECT POLICY THAT IS EASY TO FORGET
-- ---------------------------------------------------------------------
-- 0019 exists because this table's sibling had INSERT, UPDATE and
-- DELETE policies and NO SELECT policy. In that state RLS returns
-- zero rows and reports no error — the tab showed “nothing waiting”
-- while the rows sat in the database. All four policies are written
-- here, together, on purpose.

alter table public.place_comments enable row level security;

/* Comments are public. Anyone may read them, signed in or not. */
drop policy if exists place_comments_read on public.place_comments;
create policy place_comments_read
  on public.place_comments
  for select
  using (true);

/* Anyone signed in may write one — as themselves. Not as somebody
   else: the insert must carry the caller's own id. */
drop policy if exists place_comments_insert on public.place_comments;
create policy place_comments_insert
  on public.place_comments
  for insert
  to authenticated
  with check (auth.uid() = user_id);

/* An author may correct their own wording. */
drop policy if exists place_comments_update on public.place_comments;
create policy place_comments_update
  on public.place_comments
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

/* And withdraw it. */
drop policy if exists place_comments_delete on public.place_comments;
create policy place_comments_delete
  on public.place_comments
  for delete
  to authenticated
  using (auth.uid() = user_id);


-- ---------------------------------------------------------------------
-- 4. THE CHECK, SO THIS CANNOT BE MISSED
-- ---------------------------------------------------------------------
-- 0019 and 0020 both taught the same lesson: a migration that is
-- meant to change something must say, in the database, that it did.
-- Here that means one thing above all — the SELECT policy exists.
-- Without it this table behaves exactly like place_reports did, and
-- the failure is silent.

do $$
declare
  missing text[];
begin
  select array_agg(p) into missing
    from unnest(array['select', 'insert', 'update', 'delete']) as p
    where not exists (
      select 1 from pg_policies
      where schemaname = 'public'
        and tablename = 'place_comments'
        and cmd = upper(p)
    );

  if missing is not null then
    raise exception
      'place_comments is missing policies for: % — RLS would return nothing, silently',
      array_to_string(missing, ', ');
  end if;
end $$;
