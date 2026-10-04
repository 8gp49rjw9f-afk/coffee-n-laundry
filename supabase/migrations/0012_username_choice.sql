-- =====================================================================
-- coffee'n'laundry — 0012: ten characters, and yours to choose
-- =====================================================================
-- 0011 introduced the username but settled on 20 characters, and left
-- it to the trigger alone. Two things wrong with that.
--
-- Ten is the right ceiling. A username has to survive being said out
-- loud, written on a napkin, and remembered a week later. "@simon"
-- does; "_simon_duprey_2026" does not.
--
-- And the name must be chosen, not assigned. The trigger stays as the
-- floor — no account is ever nameless — but the person gets to say
-- what they are called, once, from their profile.
--
-- Idempotent, like the migrations before it.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. THE CONSTRAINT BECOMES TEN
-- ---------------------------------------------------------------------

alter table public.profiles
  drop constraint if exists profiles_username_shape;

/* Existing names are trimmed before the constraint is applied, or the
   ALTER fails on any row longer than the new ceiling. */
update public.profiles
  set username = substr(username, 1, 10)
  where username is not null
    and length(username) > 10;

/* Trimming can collide: "alexandrine" and "alexandrina" both become
   "alexandrin". The duplicates get a numeric suffix, which the unique
   index would otherwise reject. */
with ranked as (
  select
    id,
    username,
    row_number() over (partition by lower(username) order by id) as n
  from public.profiles
  where username is not null
)
update public.profiles p
  set username = substr(r.username, 1, 8) || '_' || r.n
from ranked r
where p.id = r.id
  and r.n > 1;

alter table public.profiles
  add constraint profiles_username_shape
  check (
    username is null
    or username ~ '^[a-z0-9_-]{3,10}$'
  );


-- ---------------------------------------------------------------------
-- 2. CHANGING IT, ONCE
-- ---------------------------------------------------------------------
-- A username that can change freely breaks every reference to it and
-- invites impersonation: pick a well-known name, post, hand it back.
-- One change is enough to fix a mistake made on the day of signup,
-- and not enough to run a scam.

alter table public.profiles
  add column if not exists username_changed_at timestamptz;

create or replace function public.change_username(p_new text)
returns table (ok boolean, message text, username text)
language plpgsql
security definer
set search_path = public
as $$
declare
  clean text;
  current_username text;
  changed_at timestamptz;
begin
  if auth.uid() is null then
    return query select false, 'You need to be signed in.'::text, null::text;
    return;
  end if;

  clean := lower(trim(coalesce(p_new, '')));

  if clean !~ '^[a-z0-9_-]{3,10}$' then
    return query select
      false,
      'Three to ten characters: letters, numbers, hyphen or underscore.'::text,
      null::text;
    return;
  end if;

  select p.username, p.username_changed_at
    into current_username, changed_at
    from public.profiles p
    where p.id = auth.uid();

  if current_username = clean then
    return query select true, 'That is already your name.'::text, clean;
    return;
  end if;

  if changed_at is not null then
    return query select
      false,
      'A username can only be changed once.'::text,
      null::text;
    return;
  end if;

  if exists (
    select 1 from public.profiles p
    where lower(p.username) = clean
      and p.id <> auth.uid()
  ) then
    return query select false, 'That name is taken.'::text, null::text;
    return;
  end if;

  update public.profiles
    set username = clean,
        username_changed_at = now()
    where id = auth.uid();

  return query select true, 'Saved.'::text, clean;
end $$;


-- ---------------------------------------------------------------------
-- 3. WHAT THE SIGNUP FORM MAY OFFER
-- ---------------------------------------------------------------------
-- Called before an account exists, so it cannot check auth.uid(). It
-- answers one question — is this name available? — and nothing else.

create or replace function public.username_available(p_username text)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select
    lower(trim(coalesce(p_username, ''))) ~ '^[a-z0-9_-]{3,10}$'
    and not exists (
      select 1 from public.profiles p
      where lower(p.username) = lower(trim(p_username))
    );
$$;


-- ---------------------------------------------------------------------
-- 4. THE TRIGGER RESPECTS TEN TOO
-- ---------------------------------------------------------------------
-- Same shape as 0011, with the shorter ceiling, so a generated name
-- can never break the constraint that now applies.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  base text;
  candidate text;
  attempt integer := 0;
begin
  insert into public.profiles (id) values (new.id)
    on conflict (id) do nothing;

  insert into public.subscriptions (user_id, status, source)
    values (new.id, 'free_trial', 'trial')
    on conflict (user_id) do nothing;

  base := lower(
    regexp_replace(
      coalesce(split_part(new.email, '@', 1), ''),
      '[^a-z0-9_-]',
      '',
      'g'
    )
  );

  if length(base) < 3 then
    base := 'user' || substr(new.id::text, 1, 4);
  elsif length(base) > 10 then
    base := substr(base, 1, 10);
  end if;

  candidate := base;

  while exists (
    select 1 from public.profiles p
    where lower(p.username) = candidate
      and p.id <> new.id
  ) loop
    attempt := attempt + 1;
    candidate := substr(base, 1, 7) || '_' || attempt;
  end loop;

  update public.profiles
    set username = candidate
    where id = new.id
      and username is null;

  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
