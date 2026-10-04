-- =====================================================================
-- coffee'n'laundry — 0013: the name chosen at signup
-- =====================================================================
-- 0012 lets a person change their username once. That is the right
-- rule for someone who has been here a while.
--
-- It is the wrong rule for the minute after signing up. The trigger
-- has just assigned a name derived from the email — `simon` for
-- simon@gmail.com — and if that becomes the "change", a new account
-- has spent its one edit before its owner has seen the site.
--
-- So the name given during signup is claimed here, and the clock is
-- left alone: the one change in 0012 is still ahead of them.
--
-- Idempotent, like the migrations before it.
-- =====================================================================

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
  /* The caller has just created this account. They may not have a
     session yet if confirmation is switched on in Supabase, so
     auth.uid() is not a usable check here.

     What makes this safe is the timing: the function only acts on a
     profile created in the last ten minutes, and only when its
     username has never been changed — which is to say it is still
     the one the trigger generated, chosen by nobody. A stale call
     therefore does nothing, and a name already picked by its owner
     cannot be overwritten. */
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

  /* username_changed_at stays null on purpose — the one change from
     0012 belongs to the person, not to their signup form. */

  return true;
end $$;

/* Granted so the signup action can call it. It is not dangerous: the
   guard above refuses anything that is not a brand-new profile whose
   name has never been set. */
grant execute on function public.claim_username_at_signup(uuid, text)
  to anon, authenticated;
