-- =====================================================================
-- coffee'n'laundry — initial schema
-- =====================================================================
-- Idempotent: safe to run more than once.
-- Replaces Iter's objects + observations model with:
--   places (+ per-type detail tables)  -> the two location types
--   place_updates                      -> community updates + freshness
--   place_photos                       -> exterior / interior / machines / prices
--   place_confirmations                -> "still accurate" signals
--   credit_transactions + credit_rules -> rewards, configurable
--   subscriptions                      -> architecture only, no billing yet
-- =====================================================================

create extension if not exists pgcrypto;

-- =====================================================================
-- ENUMS
-- =====================================================================

do $$ begin
  create type place_type as enum ('coffee', 'laundry');
exception when duplicate_object then null; end $$;

do $$ begin
  create type coffee_kind as enum ('barista', 'regular', 'both');
exception when duplicate_object then null; end $$;

do $$ begin
  create type price_kind as enum ('wash', 'dryer', 'wash_fold', 'service');
exception when duplicate_object then null; end $$;

do $$ begin
  create type update_type as enum (
    'price', 'payment_method', 'hours', 'detergent', 'coffee',
    'photo', 'closed', 'moved', 'general'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type photo_type as enum (
    'exterior', 'interior', 'machines', 'prices', 'detail'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type subscription_status as enum (
    'free_trial', 'active', 'credit_month', 'expired'
  );
exception when duplicate_object then null; end $$;

-- =====================================================================
-- PROFILES
-- =====================================================================

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  credit_balance integer not null default 0,
  is_blocked boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.profiles
  add column if not exists credit_balance integer not null default 0;

-- =====================================================================
-- PLACES
-- =====================================================================

create table if not exists public.places (
  id uuid primary key default gen_random_uuid(),
  place_type place_type not null,

  name text not null,
  description text,
  address text,

  latitude double precision not null,
  longitude double precision not null,

  city text,
  country text,
  country_code char(2),

  website text,
  phone text,
  opening_hours jsonb,

  has_wifi boolean,
  has_power boolean,
  has_parking boolean,
  has_seating boolean,
  has_toilets boolean,

  accepted_payments text[] not null default '{}',

  status text not null default 'active'
    check (status in ('active', 'closed', 'unverified')),

  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists places_type_idx on public.places (place_type);
create index if not exists places_country_idx on public.places (country_code);
create index if not exists places_city_idx on public.places (lower(city));
create index if not exists places_latlng_idx on public.places (latitude, longitude);

-- =====================================================================
-- COFFEE DETAILS
-- =====================================================================

create table if not exists public.place_coffee_details (
  place_id uuid primary key references public.places(id) on delete cascade,
  coffee_kind coffee_kind not null default 'regular',
  roaster text,
  brew_methods text[] not null default '{}',
  has_decaf boolean,
  has_plant_milk boolean,
  notes text
);

-- =====================================================================
-- LAUNDRY DETAILS
-- =====================================================================

create table if not exists public.place_laundry_details (
  place_id uuid primary key references public.places(id) on delete cascade,
  machine_sizes text[] not null default '{}',
  machine_count integer,
  detergent_included boolean,
  detergent_purchasable boolean,
  self_service boolean,
  attended boolean,
  drying_available text
    check (drying_available in ('dryer', 'line', 'both', 'none')),
  has_change_machine boolean,
  typical_duration_minutes integer,
  notes text
);

-- =====================================================================
-- PRICES — always carry a currency
-- =====================================================================

create table if not exists public.place_prices (
  id uuid primary key default gen_random_uuid(),
  place_id uuid not null references public.places(id) on delete cascade,
  kind price_kind not null,
  label text,
  amount numeric(10, 2) not null,
  currency char(3) not null,
  machine_size text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists place_prices_place_idx on public.place_prices (place_id, kind);

-- =====================================================================
-- PHOTOS
-- =====================================================================

create table if not exists public.place_photos (
  id uuid primary key default gen_random_uuid(),
  place_id uuid not null references public.places(id) on delete cascade,
  uploaded_by uuid references auth.users(id) on delete set null,
  storage_path text not null,
  photo_type photo_type not null default 'detail',
  caption text,
  created_at timestamptz not null default now()
);

create index if not exists place_photos_place_idx
  on public.place_photos (place_id, created_at desc);

-- =====================================================================
-- UPDATES — the community correction system
-- =====================================================================

create table if not exists public.place_updates (
  id uuid primary key default gen_random_uuid(),
  place_id uuid not null references public.places(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  update_type update_type not null,
  field_changed text,
  old_value text,
  new_value text,
  comment text,
  photo_id uuid references public.place_photos(id) on delete set null,
  applied boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists place_updates_place_idx
  on public.place_updates (place_id, created_at desc);
create index if not exists place_updates_user_idx
  on public.place_updates (user_id, created_at desc);

-- =====================================================================
-- CONFIRMATIONS — "I was there, this is still accurate"
-- =====================================================================

create table if not exists public.place_confirmations (
  id uuid primary key default gen_random_uuid(),
  place_id uuid not null references public.places(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  comment text,
  created_at timestamptz not null default now()
);

create index if not exists place_confirmations_place_idx
  on public.place_confirmations (place_id, created_at desc);

-- =====================================================================
-- FRESHNESS VIEW — computed, never stored
-- =====================================================================

create or replace view public.places_with_freshness as
select
  p.*,
  greatest(
    p.updated_at,
    coalesce((select max(c.created_at) from public.place_confirmations c
              where c.place_id = p.id), p.created_at),
    coalesce((select max(u.created_at) from public.place_updates u
              where u.place_id = p.id), p.created_at)
  ) as last_verified_at,
  (select count(*) from public.place_confirmations c
   where c.place_id = p.id) as confirmations_count,
  (select count(*) from public.place_updates u
   where u.place_id = p.id) as updates_count,
  (select count(*) from public.place_photos ph
   where ph.place_id = p.id) as photos_count
from public.places p;

-- =====================================================================
-- CREDIT RULES — configurable, never hard-coded
-- =====================================================================

create table if not exists public.credit_rules (
  action_key text primary key,
  credits integer not null default 0,
  daily_cap integer,
  description text,
  active boolean not null default true,
  updated_at timestamptz not null default now()
);

insert into public.credit_rules (action_key, credits, daily_cap, description) values
  ('add_place',    10, 10, 'Create a new place'),
  ('add_price',     3, 30, 'Add a missing price'),
  ('update_price',  5, 30, 'Correct or update a price'),
  ('add_photo',     3, 30, 'Upload a photo'),
  ('add_info',      4, 40, 'Fill in missing information'),
  ('confirm_place', 2, 20, 'Confirm a place is still accurate'),
  ('report_closed', 5, 20, 'Report a place as closed'),
  ('submit_update', 3, 30, 'Submit a useful update')
on conflict (action_key) do nothing;

-- =====================================================================
-- CREDIT LEDGER — append-only, source of truth
-- =====================================================================

create table if not exists public.credit_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  action_key text not null references public.credit_rules(action_key),
  amount integer not null,
  place_id uuid references public.places(id) on delete set null,
  update_id uuid references public.place_updates(id) on delete set null,
  note text,
  created_at timestamptz not null default now()
);

create index if not exists credit_transactions_user_idx
  on public.credit_transactions (user_id, created_at desc);

-- =====================================================================
-- SUBSCRIPTIONS — architecture only. No billing in V1.
-- =====================================================================

create table if not exists public.subscriptions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  status subscription_status not null default 'free_trial',
  source text check (source in ('trial', 'credits', 'payment')),
  current_period_start timestamptz,
  current_period_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- =====================================================================
-- SITE SETTINGS — singleton
-- =====================================================================

create table if not exists public.site_settings (
  id integer primary key default 1 check (id = 1),

  site_name text not null default 'coffee''n''laundry',
  tagline text not null default 'Good coffee. Clean clothes. Keep moving.',

  maintenance_mode boolean not null default false,
  maintenance_message text,
  maintenance_allow_listed boolean not null default false,

  registrations_enabled boolean not null default true,

  max_photo_size_mb integer not null default 5,
  max_name_length integer not null default 120,
  max_description_length integer not null default 2000,
  max_comment_length integer not null default 500,
  max_places_per_user_per_day integer not null default 10,
  min_minutes_between_updates integer not null default 1,

  reports_to_flag integer not null default 3,

  subscription_price_usd numeric(6,2) not null default 1.00,
  free_period_days integer not null default 365,
  credits_per_free_month integer not null default 100,

  max_markers_zoom_2 integer not null default 200,
  max_markers_zoom_3 integer not null default 400,
  max_markers_zoom_4 integer not null default 800,

  map_default_lat double precision not null default 20,
  map_default_lng double precision not null default 0,
  map_default_zoom integer not null default 2,

  currency_hint char(3) not null default 'EUR',

  updated_at timestamptz not null default now()
);

insert into public.site_settings (id) values (1)
  on conflict (id) do nothing;

-- =====================================================================
-- REPORTS
-- =====================================================================

create table if not exists public.place_reports (
  id uuid primary key default gen_random_uuid(),
  place_id uuid not null references public.places(id) on delete cascade,
  update_id uuid references public.place_updates(id) on delete cascade,
  reported_by uuid references auth.users(id) on delete set null,
  reason text not null,
  resolved boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists place_reports_open_idx
  on public.place_reports (resolved, created_at desc);

-- =====================================================================
-- ADMINS
-- =====================================================================

create table if not exists public.admins (
  email text primary key,
  created_at timestamptz not null default now()
);

-- =====================================================================
-- TRIGGERS
-- =====================================================================

create or replace function public.places_before_write()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists places_before_write on public.places;
create trigger places_before_write
  before insert or update on public.places
  for each row execute function public.places_before_write();

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id) values (new.id)
    on conflict (id) do nothing;

  insert into public.subscriptions (user_id, status, source)
    values (new.id, 'free_trial', 'trial')
    on conflict (user_id) do nothing;

  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.apply_credit_transaction()
returns trigger language plpgsql as $$
begin
  if new.amount <> 0 then
    update public.profiles
      set credit_balance = credit_balance + new.amount
      where id = new.user_id;
  end if;
  return new;
end $$;

drop trigger if exists credit_ledger_apply on public.credit_transactions;
create trigger credit_ledger_apply
  after insert on public.credit_transactions
  for each row execute function public.apply_credit_transaction();

-- =====================================================================
-- ROW LEVEL SECURITY
-- =====================================================================

alter table public.profiles              enable row level security;
alter table public.places                enable row level security;
alter table public.place_coffee_details  enable row level security;
alter table public.place_laundry_details enable row level security;
alter table public.place_prices          enable row level security;
alter table public.place_photos          enable row level security;
alter table public.place_updates         enable row level security;
alter table public.place_confirmations   enable row level security;
alter table public.credit_transactions   enable row level security;
alter table public.credit_rules          enable row level security;
alter table public.subscriptions         enable row level security;
alter table public.place_reports         enable row level security;
alter table public.site_settings         enable row level security;
alter table public.admins                enable row level security;

drop policy if exists read_places on public.places;
create policy read_places on public.places for select using (true);

drop policy if exists read_coffee on public.place_coffee_details;
create policy read_coffee on public.place_coffee_details for select using (true);

drop policy if exists read_laundry on public.place_laundry_details;
create policy read_laundry on public.place_laundry_details for select using (true);

drop policy if exists read_prices on public.place_prices;
create policy read_prices on public.place_prices for select using (true);

drop policy if exists read_photos on public.place_photos;
create policy read_photos on public.place_photos for select using (true);

drop policy if exists read_updates on public.place_updates;
create policy read_updates on public.place_updates for select using (true);

drop policy if exists read_confirmations on public.place_confirmations;
create policy read_confirmations on public.place_confirmations for select using (true);

drop policy if exists read_credit_rules on public.credit_rules;
create policy read_credit_rules on public.credit_rules for select using (true);

drop policy if exists read_settings on public.site_settings;
create policy read_settings on public.site_settings for select using (true);

drop policy if exists read_profiles on public.profiles;
create policy read_profiles on public.profiles for select using (true);

drop policy if exists insert_places on public.places;
create policy insert_places on public.places for insert to authenticated
  with check (auth.uid() is not null);

drop policy if exists update_places on public.places;
create policy update_places on public.places for update to authenticated
  using (auth.uid() is not null) with check (auth.uid() is not null);

drop policy if exists insert_coffee on public.place_coffee_details;
create policy insert_coffee on public.place_coffee_details for insert to authenticated
  with check (auth.uid() is not null);

drop policy if exists update_coffee on public.place_coffee_details;
create policy update_coffee on public.place_coffee_details for update to authenticated
  using (auth.uid() is not null) with check (auth.uid() is not null);

drop policy if exists insert_laundry on public.place_laundry_details;
create policy insert_laundry on public.place_laundry_details for insert to authenticated
  with check (auth.uid() is not null);

drop policy if exists update_laundry on public.place_laundry_details;
create policy update_laundry on public.place_laundry_details for update to authenticated
  using (auth.uid() is not null) with check (auth.uid() is not null);

drop policy if exists insert_prices on public.place_prices;
create policy insert_prices on public.place_prices for insert to authenticated
  with check (auth.uid() is not null);

drop policy if exists update_prices on public.place_prices;
create policy update_prices on public.place_prices for update to authenticated
  using (auth.uid() is not null) with check (auth.uid() is not null);

drop policy if exists delete_prices on public.place_prices;
create policy delete_prices on public.place_prices for delete to authenticated
  using (auth.uid() is not null);

drop policy if exists insert_photos on public.place_photos;
create policy insert_photos on public.place_photos for insert to authenticated
  with check (auth.uid() is not null);

drop policy if exists insert_updates on public.place_updates;
create policy insert_updates on public.place_updates for insert to authenticated
  with check (auth.uid() is not null);

drop policy if exists insert_confirmations on public.place_confirmations;
create policy insert_confirmations on public.place_confirmations for insert to authenticated
  with check (auth.uid() is not null);

drop policy if exists insert_reports on public.place_reports;
create policy insert_reports on public.place_reports for insert to authenticated
  with check (auth.uid() is not null);

drop policy if exists own_credit_transactions on public.credit_transactions;
create policy own_credit_transactions on public.credit_transactions for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists own_subscription on public.subscriptions;
create policy own_subscription on public.subscriptions for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists update_own_profile on public.profiles;
create policy update_own_profile on public.profiles for update to authenticated
  using (auth.uid() = id) with check (auth.uid() = id);

-- =====================================================================
-- STORAGE
-- =====================================================================

insert into storage.buckets (id, name, public)
  values ('place-photos', 'place-photos', true)
  on conflict (id) do nothing;

drop policy if exists read_place_photos on storage.objects;
create policy read_place_photos on storage.objects for select
  using (bucket_id = 'place-photos');

drop policy if exists upload_place_photos on storage.objects;
create policy upload_place_photos on storage.objects for insert to authenticated
  with check (bucket_id = 'place-photos');

-- =====================================================================
-- GRANTS
-- =====================================================================

grant usage on schema public to anon, authenticated;
grant select on all tables in schema public to anon, authenticated;
grant insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to anon, authenticated;
