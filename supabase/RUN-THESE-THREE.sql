-- =====================================================================
-- coffee'n'laundry — run these three in order, nothing else
-- =====================================================================
-- 0011, 0012 and 0013 belong together. Paste each block into the SQL
-- editor and run it before moving to the next — 0012 alters the
-- constraint 0011 creates, and 0013 reads the column 0012 adds.
--
-- On a database that already has data:
--
--   1. 0011 adds `username`, fills it for everyone already here, and
--      adds the admin read policies.
--   2. 0012 shortens the ceiling to ten characters. Names longer than
--      that are trimmed first, and trimmed names that collide get a
--      suffix.
--   3. 0013 adds the function the signup form calls.
--
-- To undo, in reverse: drop `claim_username_at_signup`, drop
-- `change_username` and `username_available`, drop the
-- `profiles_username_shape` constraint, drop the index
-- `profiles_username_key`, then drop the column `username`. The admin
-- policies can stay — they are correct on their own.
-- =====================================================================


-- ####################################################################
-- STEP 1 OF 3 — same as 0011_usernames.sql
-- ####################################################################

alter table public.profiles
  add column if not exists username text;

alter table public.profiles
  drop constraint if exists profiles_username_shape;

alter table public.profiles
  add constraint profiles_username_shape
  check (
    username is null
    or username ~ '^[a-z0-9_-]{3,20}$'
  );

create unique index if not exists profiles_username_key
  on public.profiles (lower(username))
  where username is not null;

with derived as (
  select
    p.id,
    lower(
      regexp_replace(
        split_part(u.email, '@', 1),
        '[^a-z0-9_-]',
        '',
        'g'
      )
    ) as base
  from public.profiles p
  join auth.users u on u.id = p.id
  where p.username is null
    and u.email is not null
),
cleaned as (
  select
    id,
    case
      when length(base) < 3 then 'user' || substr(id::text, 1, 4)
      when length(base) > 20 then substr(base, 1, 20)
      else base
    end as base
  from derived
),
numbered as (
  select
    id,
    base,
    row_number() over (partition by base order by id) as n,
    base || '_' || row_number() over (partition by base order by id) as suffixed
  from cleaned
)
update public.profiles p
  set username = case
    when n.n = 1 then n.base
    when length(n.suffixed) <= 20 then n.suffixed
    else substr(n.base, 1, 16) || '_' || n.n
  end
from numbered n
where p.id = n.id
  and p.username is null;

update public.profiles
  set username = 'user' || substr(id::text, 1, 6)
  where username is null;

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
  elsif length(base) > 20 then
    base := substr(base, 1, 20);
  end if;

  candidate := base;

  while exists (
    select 1 from public.profiles p
    where lower(p.username) = candidate
      and p.id <> new.id
  ) loop
    attempt := attempt + 1;
    candidate := substr(base, 1, 16) || '_' || attempt;
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

drop policy if exists profiles_admin_read on public.profiles;
create policy profiles_admin_read
  on public.profiles
  for select
  to authenticated
  using (public.is_admin());

drop policy if exists ledger_admin_read on public.credit_transactions;
create policy ledger_admin_read
  on public.credit_transactions
  for select
  to authenticated
  using (public.is_admin());

drop policy if exists subscriptions_admin_read on public.subscriptions;
create policy subscriptions_admin_read
  on public.subscriptions
  for select
  to authenticated
  using (public.is_admin());

create or replace function public.search_users(term text)
returns table (
  id uuid,
  username text,
  email text,
  is_admin boolean,
  is_founder boolean,
  credit_balance integer,
  places_added bigint,
  created_at timestamptz
)
language sql
security definer
set search_path = public
stable
as $$
  select
    p.id,
    p.username,
    u.email::text,
    exists (select 1 from public.admins a where a.email = u.email) as is_admin,
    p.is_founder,
    p.credit_balance,
    (select count(*) from public.places pl where pl.created_by = p.id) as places_added,
    u.created_at
  from public.profiles p
  join auth.users u on u.id = p.id
  where public.is_admin()
    and (
      coalesce(term, '') = ''
      or p.username ilike '%' || term || '%'
      or u.email ilike '%' || term || '%'
    )
  order by p.credit_balance desc, p.username
  limit 30;
$$;

create or replace function public.admin_user_detail(p_user_id uuid)
returns table (
  id uuid,
  username text,
  email text,
  is_admin boolean,
  is_master boolean,
  is_founder boolean,
  founder_since timestamptz,
  founder_places integer,
  credit_balance integer,
  is_blocked boolean,
  joined_at timestamptz,
  places_added bigint,
  places_verified_by_others bigint,
  confirmations_made bigint,
  photos_added bigint
)
language sql
security definer
set search_path = public
stable
as $$
  select
    p.id,
    p.username,
    u.email::text,
    exists (select 1 from public.admins a where a.email = u.email),
    exists (select 1 from public.admins a where a.email = u.email and a.is_master),
    p.is_founder,
    p.founder_since,
    p.founder_places,
    p.credit_balance,
    p.is_blocked,
    u.created_at,
    (select count(*) from public.places pl where pl.created_by = p.id),
    coalesce((select v.verified_places from public.contributor_place_counts v
              where v.user_id = p.id), 0),
    (select count(*) from public.place_confirmations c where c.user_id = p.id),
    (select count(*) from public.place_photos ph where ph.uploaded_by = p.id)
  from public.profiles p
  join auth.users u on u.id = p.id
  where p.id = p_user_id
    and public.is_admin();
$$;


-- ####################################################################
-- STEP 2 OF 3 — same as 0012_username_choice.sql
-- ####################################################################

alter table public.profiles
  drop constraint if exists profiles_username_shape;

update public.profiles
  set username = substr(username, 1, 10)
  where username is not null
    and length(username) > 10;

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


-- ####################################################################
-- STEP 3 OF 3 — same as 0013_claim_at_signup.sql
-- ####################################################################

create or replace function public.claim_username_at_signup(
  p_user_id uuid,
  p_username text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  clean text;
begin
  if not exists (
    select 1
    from public.profiles p
    where p.id = p_user_id
      and p.created_at > now() - interval '10 minutes'
      and p.username_changed_at is null
  ) then
    return false;
  end if;

  clean := lower(trim(coalesce(p_username, '')));

  if clean !~ '^[a-z0-9_-]{3,10}$' then
    return false;
  end if;

  if exists (
    select 1 from public.profiles p
    where lower(p.username) = clean
      and p.id <> p_user_id
  ) then
    return false;
  end if;

  update public.profiles
    set username = clean
    where id = p_user_id;

  return true;
end $$;

grant execute on function public.claim_username_at_signup(uuid, text)
  to anon, authenticated;
