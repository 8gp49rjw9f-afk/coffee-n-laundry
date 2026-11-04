import Link from "next/link";

import MapViewLoader from "@/components/home/MapViewLoader";
import { Card } from "@/components/ui";

import { getPlacesForMap, getGlobalCounts } from "@/lib/database/places";
import { getSettings } from "@/lib/services/settings";

/*
 * The map is the heart of the app, so it is the first thing on the
 * page. Stats and the explanation sit under it.
 *
 * `today` is read on the server and handed to the map, so the
 * "verified N days ago" line is identical on the server and in the
 * browser — computing it with Date.now() on both sides is what breaks
 * hydration.
 */

export default async function HomePage() {
  const [{ places, bucketUrl }, counts, settings] = await Promise.all([
    getPlacesForMap(),
    getGlobalCounts(),
    getSettings(),
  ]);

  const today = Date.now();

  return (
    <main className="mx-auto max-w-7xl px-4 py-5 sm:px-8">
      <section className="mb-4">
        <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">
          Where&apos;s the good coffee? Where do I do laundry?
        </h1>

        <p className="mt-1 text-sm text-slate-600 sm:text-base">
          {settings.tagline}
        </p>
      </section>

      <MapViewLoader
        places={places}
        bucketUrl={bucketUrl}
        today={today}
        showFilters
      />

      {/*
       * Three figures, in one row on a phone as well as a laptop.
       *
       * The grid was two columns because there were two numbers. The
       * row now carries three, and it stays `grid-cols-3` at every
       * width rather than wrapping to a second line: the three are
       * read as one sentence — what is on the map, and who put it
       * there — and a number alone on its own row would read as a
       * footnote to the other two.
       *
       * `padding="sm"` and the smaller rounding keep each card
       * narrow enough that three fit side by side on the smallest
       * phone width without the label wrapping under its own number.
       */}
      <section className="mt-6 grid grid-cols-3 gap-3">
        <Card padding="sm" className="text-center">
          <p className="text-3xl font-bold text-slate-900">{counts.coffee}</p>
          <p className="mt-1 text-sm text-slate-500">☕ coffee spots</p>
        </Card>

        <Card padding="sm" className="text-center">
          <p className="text-3xl font-bold text-slate-900">{counts.laundry}</p>
          <p className="mt-1 text-sm text-slate-500">🧺 laundromats</p>
        </Card>

        {/* The person glyph matches the one on a place page, where
            the line above the address reads “👤 @name”. Same glyph,
            same meaning: a person, counted. */}
        <Card padding="sm" className="text-center">
          <p className="text-3xl font-bold text-slate-900">{counts.users}</p>
          <p className="mt-1 text-sm text-slate-500">👤 users</p>
        </Card>
      </section>

      <section className="mt-4">
        <Card>
          <h2 className="text-base font-bold text-slate-900">
            Everything here comes from people who were actually there.
          </h2>

          <p className="mt-2 text-sm text-slate-600">
            Real prices with a currency. Which payments are accepted. Whether
            the detergent is included. When someone last checked.
          </p>

          <div className="mt-4 flex flex-wrap gap-2">
            <Link
              href="/new"
              className="inline-flex min-h-11 items-center rounded-xl bg-slate-900 px-5 font-semibold text-white hover:bg-slate-800"
            >
              + Add a place
            </Link>

            <Link
              href="/about"
              className="inline-flex min-h-11 items-center rounded-xl border border-slate-300 bg-white px-5 font-semibold text-slate-800 hover:bg-slate-50"
            >
              How it works
            </Link>
          </div>
        </Card>
      </section>
    </main>
  );
}
