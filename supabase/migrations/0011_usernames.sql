-- =====================================================================
-- coffee'n'laundry — 0011: a name you can point at
-- =====================================================================
-- Two problems, one fix.
--
-- First: nothing in this database identifies a person. A place carries
-- `created_by`, which is a UUID; a verification carries
-- `verified_by_name`, filled with the part of an email before the @.
-- So `simon@gmail.com` and `simon@hotmail.fr` both render as "simon" —
-- two different people wearing one name, and no way to tell them
-- apart when something goes wrong.
--
-- Second: an email is personal data. Putting it on a public timeline
-- to fix the first problem would leak it.
--
-- A username solves both. It is unique, public, and carries no
-- address. The email stays where it belongs: visible to admins, on
-- the user detail page, and nowhere else.
--
-- Additive and idempotent, like the migrations before it.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. THE COLUMN
-- ---------------------------------------------------------------------

alter table public.profiles
  add column if not exists username text;

/* Shape is enforced here as well as in the form: letters, digits,
   hyphen and underscore, 3 to 20, always lowercase. A CHECK cannot
   stop a race, but it does stop a stray write. */
alter table public.profiles
  drop constraint if exists profiles_username_shape;

alter table public.profiles
  add constraint profiles_username_shape
  check (
    username is null
    or username ~ '^[a-z0-9_-]{3,20}$'
  );

/* Case-insensitive uniqueness: `Simon` and `simon` must not coexist.
   The lower() index is what the CHECK cannot express. */
create unique index if not exists profiles_username_key
  on public.profiles (lower(username))
  where username is not null;


-- ---------------------------------------------------------------------
-- 2. FILLING IT FOR THE PEOPLE ALREADY HERE
-- ---------------------------------------------------------------------
-- Derived from the email, then tidied and made unique with a numeric
-- suffix. Nobody is left without a name, and nobody has to be asked.

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

/* Anyone the block above could not name — no email, or a freshly
   created account — gets something readable rather than nothing. */
update public.profiles
  set username = 'user' || substr(id::text, 1, 6)
  where username is null;


-- ---------------------------------------------------------------------
-- 3. EVERYONE NEW GETS ONE WITHOUT ASKING TWICE
-- ---------------------------------------------------------------------
-- The signup form proposes a name and the person can change it. This
-- trigger is the floor: even if that form is bypassed, an account is
-- never nameless.

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

  /* Derived from the email, trimmed to the allowed shape. */
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


-- ---------------------------------------------------------------------
-- 4. ADMINS MAY READ WHAT THEY MODERATE
-- ---------------------------------------------------------------------
-- These tables are readable by their owner only, which is right —
-- and makes the user detail page impossible. An admin needs to see
-- the profile, the credit ledger and the subscription of the person
-- they are looking into.

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


-- ---------------------------------------------------------------------
-- 5. SEARCH, WITH EMAIL, FOR ADMINS ONLY
-- ---------------------------------------------------------------------
-- Emails live in `auth.users`, which the client cannot read. A
-- SECURITY DEFINER function is the only way to search by them without
-- shipping the service key to the browser — and it refuses anyone who
-- is not an admin, so it is not a hole.

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


-- ---------------------------------------------------------------------
-- 6. THE SAME QUESTION, ANSWERED IN ONE ROW
-- ---------------------------------------------------------------------

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
