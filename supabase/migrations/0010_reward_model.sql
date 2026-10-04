-- =====================================================================
-- coffee'n'laundry — 0010: the reward model
-- =====================================================================
-- Decided here, once:
--
--   price           2.00 USD per month
--   credits         100 credits = one free month (so 1 credit = 0.02 USD)
--   add_place       paid only when SOMEONE ELSE has verified the place
--   confirm_place   5 per day, not 20 — 20 is twenty minutes of tapping
--   demotion        a place that is closed or flagged takes its credits back
--   Founder         5 verified places before the paywall, 12 months free
--
-- The central change is the first one. Rewarding a place at creation
-- rewards empty pins: add thirty of them, collect three hundred
-- credits, and a year is free without having contributed anything. The
-- award waits for a stranger to confirm the place exists — and a
-- stranger can only confirm it by having been there.
--
-- Additive and idempotent, like the migrations before it.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. THE PRICE, AND WHAT A MONTH COSTS IN CREDITS
-- ---------------------------------------------------------------------

update public.site_settings
  set subscription_price_usd = 2.00,
      credits_per_free_month = 100,
      free_period_days = 365,
      updated_at = now()
  where id = 1;


-- ---------------------------------------------------------------------
-- 2. THE RULES, ADJUSTED
-- ---------------------------------------------------------------------
-- Descriptions are rewritten so the admin panel explains what each
-- one now means — "add_place" no longer pays on the spot.

update public.credit_rules
  set credits = 10,
      daily_cap = 10,
      description = 'A place you added, once someone else verifies it',
      updated_at = now()
  where action_key = 'add_place';

update public.credit_rules
  set credits = 2,
      daily_cap = 5,
      description = 'Confirm a place is still accurate (5 a day)',
      updated_at = now()
  where action_key = 'confirm_place';

/* An edit is a visit, so it counts as a verification too — smaller
   than a confirmation, because correcting a price is not the same
   as vouching for the whole place. */
update public.credit_rules
  set credits = 3,
      daily_cap = 30,
      description = 'Correct or complete a place someone else added',
      updated_at = now()
  where action_key = 'submit_update';


-- ---------------------------------------------------------------------
-- 3. ONE AWARD PER PLACE, EVER
-- ---------------------------------------------------------------------
-- "The place has already paid its creator" is a question asked at
-- every confirmation. Without an index it is a scan of the ledger.

create index if not exists credit_transactions_place_award_idx
  on public.credit_transactions (place_id, action_key)
  where action_key in ('add_place', 'place_demoted');


-- ---------------------------------------------------------------------
-- 4. THE FOUNDER FLAG
-- ---------------------------------------------------------------------
-- Filled in once, by hand, when the paywall goes up — a status is
-- frozen at a date, not recomputed forever. Until then it is null,
-- which reads as "not yet decided", not as "no".

alter table public.profiles
  add column if not exists is_founder boolean not null default false;

alter table public.profiles
  add column if not exists founder_since timestamptz;

alter table public.profiles
  add column if not exists founder_places integer not null default 0;


-- ---------------------------------------------------------------------
-- 5. WHAT THE FOUNDER DECISION WILL READ
-- ---------------------------------------------------------------------
-- One row per person: how many places they added that a second person
-- later confirmed. That is the number the threshold is applied to —
-- not places added, which anyone can inflate.

create or replace view public.contributor_place_counts as
select
  p.created_by as user_id,
  count(distinct p.id) as verified_places
from public.places p
where p.created_by is not null
  and exists (
    select 1 from public.place_confirmations c
    where c.place_id = p.id
      and c.user_id <> p.created_by
  )
  and not exists (
    /* A place that is closed or flagged does not count towards a
       Founder status: the reward tracks places that are still good. */
    select 1 from public.place_reports r
    where r.place_id = p.id
      and r.resolved = false
      and r.reason ilike '%fake%'
  )
  and p.status <> 'closed'
  and p.status <> 'unverified'
  and not exists (
    /* And one that has already cost its creator credits has neither
       paid nor counted. */
    select 1 from public.credit_transactions t
    where t.place_id = p.id
      and t.action_key = 'place_demoted'
  )
  and not exists (
    select 1 from public.place_confirmations own
    where own.place_id = p.id
      and own.user_id = p.created_by
    group by own.place_id
    having count(*) > 0 and count(distinct own.user_id) = 1
  )
group by p.created_by;


-- ---------------------------------------------------------------------
-- 6. THE FOUNDER AWARD, FOR WHEN YOU FLIP THE SWITCH
-- ---------------------------------------------------------------------
-- Not run automatically: this is the command to paste on the day the
-- paywall goes up. Until then, contributing is free and everyone who
-- earns it keeps earning it.
--
--   select * from public.grant_founder_status(5, 365);
--
-- Five verified places, twelve months of subscription added to
-- whatever period the person already has.

create or replace function public.grant_founder_status(
  min_places integer default 5,
  free_days integer default 365
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  granted integer := 0;
  row_record record;
begin
  for row_record in
    select v.user_id, v.verified_places
    from public.contributor_place_counts v
    where v.verified_places >= min_places
      and not exists (
        select 1 from public.profiles pr
        where pr.id = v.user_id and pr.is_founder
      )
  loop
    update public.profiles
      set is_founder = true,
          founder_since = now(),
          founder_places = row_record.verified_places
      where id = row_record.user_id;

    insert into public.subscriptions (
      user_id, status, source, current_period_start, current_period_end, updated_at
    )
    select
      row_record.user_id,
      'active',
      'trial',
      coalesce(s.current_period_end, now()),
      coalesce(s.current_period_end, now()) + make_interval(days => free_days),
      now()
    from public.subscriptions s
    where s.user_id = row_record.user_id
    on conflict (user_id) do update
      set status = 'active',
          source = 'trial',
          current_period_end = excluded.current_period_end,
          updated_at = now();

    insert into public.credit_transactions (
      user_id, action_key, amount, note
    )
    select
      row_record.user_id,
      'add_place',
      -1,
      'Founder award — 12 months, not credits'
    where false; /* placeholder: the award is a period, not credits */

    granted := granted + 1;
  end loop;

  return granted;
end $$;

/* The zero-value insert above is dead code kept out of the ledger on
   purpose — "where false" means it never runs. Subscription time is
   not a credit and should not appear as one; the ledger records
   credits only. */


-- ---------------------------------------------------------------------
-- 7. WHAT A PERSON HAS CONTRIBUTED
-- ---------------------------------------------------------------------
-- The profile page shows facts, not a score: how many places they
-- added, how many hold up to someone else's confirmation.

create or replace view public.contributor_stats as
select
  pr.id as user_id,
  pr.credit_balance,
  pr.is_founder,
  (select count(*) from public.places p where p.created_by = pr.id) as places_added,
  coalesce(v.verified_places, 0) as places_verified_by_others,
  (select count(*) from public.place_confirmations c where c.user_id = pr.id) as confirmations_made,
  (select count(*) from public.place_photos ph where ph.uploaded_by = pr.id) as photos_added
from public.profiles pr
left join public.contributor_place_counts v on v.user_id = pr.id;
