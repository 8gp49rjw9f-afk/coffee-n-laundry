# coffee'n'laundry

A community-driven map of good coffee and good laundry, for people on the road.

**Good coffee. Clean clothes. Keep moving.**

Grew out of the **Iter** project — same Next.js + Supabase + Leaflet foundation,
different purpose. The object/observation domain was replaced with a two-type
place model (coffee, laundry). See `MIGRATION.md` for what changed.

## Stack

- Next.js 16 (App Router), React 19, TypeScript
- Tailwind CSS v4 (CSS-first, no config file)
- Supabase (`@supabase/ssr`) — auth, Postgres, storage
- Leaflet + react-leaflet 5

## Getting started

```bash
npm install
```

Create `.env.local` (see `.env.example`).

```bash
npm run dev
```

## Database

The schema lives in `supabase/migrations/`. Apply it before first run:

```bash
npx supabase link --project-ref <your-project-ref>
npx supabase db push
```

Or paste `supabase/migrations/0001_init.sql` into the Supabase SQL editor.
It is idempotent — running it twice is safe.

One storage bucket is expected by the code: `place-photos` (public read).
The migration creates it; create it in the dashboard if the insert does not take.

The migration creates `places`, the two detail tables, prices, updates,
photos, confirmations, the credit ledger, `credit_rules`, `site_settings`
and `subscriptions`. RLS is enabled everywhere: anonymous users can read,
only authenticated users can write their own rows.

## Structure

```
app/
  page.tsx              map + filters (the heart)
  place/[id]/           place page
  new/                  add a place (coffee | laundry branch)
  update/[placeId]/     submit an update
  about/  brief/
  login/ signup/ signout/
  profile/              credits + subscription state
  admin/                reports queue
  actions/              server actions (all mutations)
  api/search/           search endpoint
components/
  maps/                 Leaflet map, marker icons, wrapper
  map/                  map sidebar + placement panel
  place/                place UI (price strip, facts, timelines, forms)
  home/                 header, filter chips, map view
  ui/                   design system
  location/             geolocation picker
lib/
  supabase/             browser / server / auth clients
  database/             read queries
  services/             settings, credits, distance, geocoding, upload, freshness
supabase/migrations/    versioned schema
```

## Concepts

- **Two place types**, one `places` table, `place_type` discriminator.
  Coffee and laundry are independent places, associated later by geography.
- **Prices always carry a currency.** Never assume USD.
- **Credit values live in `credit_rules`**, not in code. Same for subscription
  config in `site_settings`. Nothing about rewards is hard-coded.
- **Freshness is computed, not stored** — `last_verified_at` is derived from
  confirmations and updates at read time. No rollup columns going stale.
- **No leaderboards, no rankings, no user popularity.** Credits are a reward,
  not a game.
