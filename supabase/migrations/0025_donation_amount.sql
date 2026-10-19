-- =====================================================================
-- coffee'n'laundry — 0025: the amount the coffee costs
-- =====================================================================
-- 0024 added `donation_enabled` and `donation_url`. It deliberately
-- left the amount out, with the reasoning written in that file: the
-- number travelled inside the link — paypal.me/CoffeeNLaundry/2 — and
-- a second copy in a column would drift from the first.
--
-- THAT REASONING WAS WRONG, and this file corrects it.
--
-- The argument for one copy holds only if the link is hand-edited,
-- which is exactly what it would have been. But the admin panel is
-- the whole point of making this a setting: the button is meant to be
-- switched off at the end of the first year without a deploy, and an
-- amount that can only be changed by editing a string in a settings
-- field is not switched, it is retyped — with the leading slash and
-- the network name to get right, on a phone, at night.
--
-- So the number gets a column, and the LINK IS BUILT FROM IT:
--
--   url + "/" + amount
--
-- One place to type the number, and the address keeps being nothing
-- but the account. An admin who wants 5 types 5, and both the button
-- in the header and the line in the phone menu follow.
--
-- WHY 2 IS THE DEFAULT
--
-- The price of a coffee, not a decision. A default that is already
-- the wrong shape — 0, or null — would ask the admin to think before
-- the button ever appeared, and the first thing they would see is a
-- feature that does nothing.
--
-- Additive and idempotent, like the migrations before it.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. THE COLUMN
-- ---------------------------------------------------------------------

alter table public.site_settings
  add column if not exists donation_amount integer not null default 2;


-- ---------------------------------------------------------------------
-- 2. AND A FLOOR UNDER IT
-- ---------------------------------------------------------------------
-- A donation of zero is not a donation: it opens the payment page with
-- nothing to pay, which looks broken and wastes the person's time. A
-- negative number is worse. The check is in the database as well as
-- in the form, because the form is a suggestion and this is the rule.

do $$
declare
  constraint_exists boolean;
begin
  select exists (
    select 1 from pg_constraint
    where conrelid = 'public.site_settings'::regclass
      and conname = 'site_settings_donation_amount_positive'
  ) into constraint_exists;

  if not constraint_exists then
    alter table public.site_settings
      add constraint site_settings_donation_amount_positive
      check (donation_amount >= 1 and donation_amount <= 1000);
  end if;
end $$;


-- ---------------------------------------------------------------------
-- 3. THE CHECK, SO THIS CANNOT BE MISSED
-- ---------------------------------------------------------------------
-- 0019, 0020, 0022, 0023 and 0024 all taught the same lesson: a
-- migration that is meant to change something says, in the database,
-- that it did. Here that is the column existing and holding a usable
-- number — a missing column fails silently, and the button would show
-- an empty price for a reason no log explains.

do $$
declare
  has_column boolean;
  current_amount integer;
begin
  select exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'site_settings'
      and column_name = 'donation_amount'
  ) into has_column;

  if not has_column then
    raise exception
      'site_settings.donation_amount is missing: the donation button could never show a price';
  end if;

  select donation_amount into current_amount
    from public.site_settings where id = 1;

  if current_amount is null or current_amount < 1 then
    raise exception
      'donation_amount is % — a donation of nothing opens a payment page with nothing to pay',
      coalesce(current_amount::text, 'null');
  end if;
end $$;
