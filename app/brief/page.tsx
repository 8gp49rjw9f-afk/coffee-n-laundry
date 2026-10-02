import Link from "next/link";

import { Card, Button } from "@/components/ui";

import { getSettings } from "@/lib/services/settings";

export default async function BriefPage() {
  const settings = await getSettings();

  return (
    <main className="mx-auto max-w-3xl space-y-4 px-4 py-6 sm:px-8">
      <h1 className="text-2xl font-bold text-slate-900">The brief</h1>

      <p className="text-sm text-slate-600">
        What {settings.site_name} is for, in the words it was specified in.
      </p>

      <Card>
        <pre className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700">
{`GOOD COFFEE / GOOD LAUNDRY

Where can I get genuinely good coffee around here?
Where can I do my laundry without wasting my time?

The emphasis is on useful, current, real-world information,
not generic business listings.

THE PHILOSOPHY

Favour independent coffee shops, genuinely good coffee,
useful laundromats, accurate prices, payment information,
practical information for travellers, recent user updates.

Avoid turning this into a generic business directory.
Starbucks is not part of the normal coffee database.

The goal: "If I'm on the road, this website tells me where
I should actually go."

The full specification lives in SPEC.md at the root of
this repository.`}
        </pre>
      </Card>

      <Button href="/" variant="ghost">
        ← Back to the map
      </Button>
    </main>
  );
}
