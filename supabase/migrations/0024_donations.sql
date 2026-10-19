-- =====================================================================
-- coffee'n'laundry — 0024: the donation button
-- =====================================================================
-- Two columns on site_settings, so the button is a SETTING and not a
-- piece of code that has to be deployed away when it is no longer
-- wanted.
--
-- WHY IT IS A SETTING
--
-- The plan is to keep this for the first year and see whether it
-- covers the domain. That is a decision with a date on it, and the
-- date should not require a commit. With the two columns below, the
-- button is turned off from Admin → Site the same day the year is
-- up — and turned back on for a month if the hosting bill lands
-- awkwardly. Nothing else changes.
--
-- WHY THERE IS NO AMOUNT COLUMN
--
-- The amount travels in the URL — `paypal.me/CoffeeNLaundry/2` — and
-- that is the whole of it. A `donation_amount` column would be a
-- second place to change the same number, and the two would drift:
-- the form would say 2 while the link asked for 5. One number, in
-- one place, in the link the button opens.
--
-- WHY `donation_enabled` IS SEPARATE FROM A NON-EMPTY URL
--
-- An empty URL already hides the button, so on the surface a second
-- column is redundant. It is not, for one case that matters: the
-- year runs out, the site keeps working, and somebody wants to see
-- the button again WITHOUT putting the address back. Enabled + a
-- stored address means the switch is a switch, and the address is
-- not lost when the button goes quiet.
--
-- Additive and idempotent, like the migrations before it.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. THE TWO COLUMNS
-- ---------------------------------------------------------------------

alter table public.site_settings
  add column if not exists donation_enabled boolean not null default false;

alter table public.site_settings
  add column if not exists donation_url text;


-- ---------------------------------------------------------------------
-- 2. THE CHECK
-- ---------------------------------------------------------------------
-- 0019, 0020, 0022 and 0023 all taught the same lesson: a migration
-- that is meant to change something says, in the database, that it
-- did. Here that is both columns existing, because a missing one
-- fails silently — the form writes a field nobody stores, and the
-- button never appears for a reason no log explains.

do $$
declare
  missing text[];
begin
  select array_agg(c) into missing
    from unnest(array['donation_enabled', 'donation_url']) as c
    where not exists (
      select 1 from information_schema.columns
      where table_schema = 'public'
        and table_name = 'site_settings'
        and column_name = c
    );

  if missing is not null then
    raise exception
      'site_settings is missing: % — the donation button could never appear',
      array_to_string(missing, ', ');
  end if;
end $$;
