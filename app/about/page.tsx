import Link from "next/link";

import { Card, Button } from "@/components/ui";

import { getSettings } from "@/lib/services/settings";

export default async function AboutPage() {
  const settings = await getSettings();

  return (
    <main className="mx-auto max-w-2xl space-y-4 px-4 py-6 sm:px-8">
      <h1 className="text-3xl font-bold text-slate-900">{settings.site_name}</h1>

      <p className="text-lg text-slate-600">{settings.tagline}</p>

      <Card>
        <h2 className="text-base font-bold text-slate-900">
          Two things, done properly
        </h2>

        <p className="mt-2 text-sm text-slate-600">
          A map of good coffee and good laundromats, built by people who are
          actually on the road. Not a business directory, not a review site.
          Just the two things you need when you have been driving for six hours.
        </p>
      </Card>

      <Card>
        <h2 className="text-base font-bold text-slate-900">
          Why the information is different here
        </h2>

        <ul className="mt-3 space-y-2 text-sm text-slate-700">
          <li>🧺 A wash price always comes with a currency. Never just a number.</li>
          <li>💳 Which payment methods actually work — cash, card, contactless, a laundry card.</li>
          <li>🧼 Whether detergent is included or has to be bought there.</li>
          <li>📶 Whether there is Wi-Fi and a plug, because you might be working.</li>
          <li>🕓 When someone last confirmed the place. Old information reads as old.</li>
        </ul>
      </Card>

      <Card>
        <h2 className="text-base font-bold text-slate-900">What we do not do</h2>

        <ul className="mt-3 space-y-2 text-sm text-slate-700">
          <li>No chain cafés kept in the database just for being famous.</li>
          <li>No rankings, no leaderboards, no popularity contest.</li>
          <li>No five-star ratings — facts instead.</li>
        </ul>
      </Card>

      <Card>
        <h2 className="text-base font-bold text-slate-900">Credits</h2>

        <p className="mt-2 text-sm text-slate-600">
          Adding a place, fixing a price, confirming something is still open —
          all of it earns credits. The first year is free, and after that it
          costs about a dollar a month. Credits can cover it:{" "}
          <strong>{settings.credits_per_free_month} credits</strong> is one free
          month.
        </p>

        <p className="mt-2 text-sm text-slate-600">
          There is no hall of fame and no ranking of contributors. Credits are a
          thank-you, not a score.
        </p>
      </Card>

      <div className="flex flex-wrap gap-2 pb-8">
        <Button href="/new">+ Add a place</Button>

        <Button href="/" variant="ghost">
          Back to the map
        </Button>

        <Link
          href="/brief"
          className="inline-flex min-h-11 items-center px-2 font-semibold text-slate-600 underline"
        >
          The brief
        </Link>
      </div>
    </main>
  );
}
