import Link from "next/link";

import { Button, Card } from "@/components/ui";

import { getSettings } from "@/lib/services/settings";

/*
 * About and the brief were two pages saying the same thing in two
 * registers: one in prose, one as a pasted specification. Nobody
 * reads a specification to decide whether they want the thing.
 *
 * So: one page, short lines, no paragraphs. The long version is
 * still in SPEC.md for whoever wants it.
 */

export default async function AboutPage() {
  const settings = await getSettings();

  return (
    <main className="mx-auto max-w-2xl space-y-4 px-4 py-8 sm:px-8">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">
          {settings.site_name}
        </h1>

        <p className="mt-2 text-lg text-slate-600">{settings.tagline}</p>
      </div>

      <Card>
        <p className="text-base leading-relaxed text-slate-700">
          A map of good coffee and good laundromats, built by people who are
          actually on the road.
        </p>

        <p className="mt-3 text-base leading-relaxed text-slate-700">
          Two things you need after six hours of driving. Nothing else.
        </p>
      </Card>

      <Card>
        <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">
          What you find here
        </h2>

        <ul className="mt-3 space-y-2.5 text-sm text-slate-700">
          <li className="flex gap-2.5">
            <span>💳</span>
            <span>Real prices, always with a currency. Which payments work.</span>
          </li>

          <li className="flex gap-2.5">
            <span>🧼</span>
            <span>Whether the detergent is included, or what it costs.</span>
          </li>

          <li className="flex gap-2.5">
            <span>📶</span>
            <span>Wi-Fi and a plug, because you might be working.</span>
          </li>

          <li className="flex gap-2.5">
            <span>🕓</span>
            <span>
              When someone last checked. Old information looks old.
            </span>
          </li>
        </ul>
      </Card>

      <Card>
        <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">
          What you will not find
        </h2>

        <ul className="mt-3 space-y-2.5 text-sm text-slate-700">
          <li className="flex gap-2.5">
            <span>🚫</span>
            <span>Big chains kept in the list just for being famous.</span>
          </li>

          <li className="flex gap-2.5">
            <span>🚫</span>
            <span>Star ratings, rankings, leaderboards.</span>
          </li>

          <li className="flex gap-2.5">
            <span>🚫</span>
            <span>A directory of every business in town.</span>
          </li>
        </ul>
      </Card>

      <Card>
        <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">
          Keeping it honest
        </h2>

        <p className="mt-3 text-sm leading-relaxed text-slate-700">
          Anyone signed in can correct a price, fix a detail, or say a place is
          still there. Every change is logged with a name on it, so the page is
          a record, not a rumour.
        </p>

        <p className="mt-3 text-sm leading-relaxed text-slate-700">
          {settings.credits_per_free_month} credits covers a month. Credits are
          a thank-you, not a score — there is no hall of fame.
        </p>
      </Card>

      <div className="flex flex-wrap gap-2 pb-8">
        <Button href="/new">+ Add a place</Button>

        <Button href="/" variant="ghost">
          Back to the map
        </Button>
      </div>

      <p className="pb-8 text-center text-xs text-slate-400">
        The full specification is in{" "}
        <Link href="/brief" className="underline">
          the brief
        </Link>
        .
      </p>
    </main>
  );
}
