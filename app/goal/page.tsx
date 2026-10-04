import { Button, Card } from "@/components/ui";

import { getSettings } from "@/lib/services/settings";

/*
 * About and the brief, merged and cut down.
 *
 * The old pair said the same thing twice: once as prose, once as a
 * pasted specification. Neither is how anyone decides whether they
 * want a thing. What is left here is the goal in a few lines, and
 * what the map refuses to become.
 */

export const metadata = { title: "The goal — coffee'n'laundry" };

export default async function GoalPage() {
  const settings = await getSettings();

  return (
    <main className="mx-auto max-w-2xl space-y-4 px-4 py-8 sm:px-8">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">The goal</h1>

        <p className="mt-2 text-lg text-slate-600">{settings.tagline}</p>
      </div>

      <Card>
        <p className="text-base leading-relaxed text-slate-700">
          If you are on the road, this should tell you where to actually go.
        </p>

        <p className="mt-3 text-base leading-relaxed text-slate-700">
          Two things after a long drive: a good coffee, and somewhere to wash
          your clothes. That is the whole map.
        </p>
      </Card>

      <Card>
        <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">
          What it holds
        </h2>

        <ul className="mt-3 space-y-2 text-sm text-slate-700">
          <li>💳 Prices with a currency, and the payments that work.</li>
          <li>🧼 Whether detergent is included, or what it costs.</li>
          <li>📶 Wi-Fi and a plug, because you might be working.</li>
          <li>🕓 When someone last checked. Old information looks old.</li>
        </ul>
      </Card>

      <Card>
        <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">
          What it refuses to be
        </h2>

        <ul className="mt-3 space-y-2 text-sm text-slate-700">
          <li>🚫 A directory of every business in town.</li>
          <li>🚫 A place for chains kept in just for being famous.</li>
          <li>🚫 Star ratings, rankings, leaderboards.</li>
        </ul>
      </Card>

      <Card>
        <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">
          Why you can trust it
        </h2>

        <p className="mt-3 text-sm leading-relaxed text-slate-700">
          Everything comes from someone who was there. Anyone signed in can
          correct a price or confirm a place is still open, and every change is
          logged with a name on it.
        </p>

        <p className="mt-3 text-sm leading-relaxed text-slate-700">
          No popularity, no score to chase. {settings.credits_per_free_month}{" "}
          credits covers a month, and that is the whole reward system.
        </p>
      </Card>

      <div className="flex flex-wrap gap-2 pb-8">
        <Button href="/new">+ Add a place</Button>

        <Button href="/" variant="ghost">
          Back to the map
        </Button>
      </div>
    </main>
  );
}
