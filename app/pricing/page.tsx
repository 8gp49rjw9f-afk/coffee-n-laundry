import { Button, Card } from "@/components/ui";

import { getSettings } from "@/lib/services/settings";

/*
 * What it costs, and what you get for contributing — in the order a
 * person actually asks the questions.
 *
 * The Founder offer has an end date. An open-ended promise is not a
 * decision, it is a wish: people need to know whether the window is
 * still open before they invest an evening in adding places.
 */

export const metadata = { title: "Pricing — coffee'n'laundry" };

/* Frozen on purpose: this is a promise with a date, not a setting
   that drifts. */
const FOUNDER_CLOSES = "1 January 2027";
const FOUNDER_PLACES = 5;
const FOUNDER_MONTHS = 12;

export default async function PricingPage() {
  const settings = await getSettings();

  const price = Number(settings.subscription_price_usd ?? 2).toFixed(2);
  const creditsPerMonth = settings.credits_per_free_month;

  return (
    <main className="mx-auto max-w-2xl space-y-4 px-4 py-8 sm:px-8">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Pricing</h1>

        <p className="mt-2 text-lg text-slate-600">
          Free for now. Small and simple after that.
        </p>
      </div>

      <Card className="border-2 border-emerald-200 bg-emerald-50/50">
        <h2 className="text-sm font-bold uppercase tracking-wide text-emerald-800">
          Right now — free
        </h2>

        <p className="mt-3 text-base leading-relaxed text-slate-800">
          Everything is open, and nobody pays anything. This is the year the
          map gets built, and building it is the whole job.
        </p>

        <p className="mt-3 text-base leading-relaxed text-slate-800">
          Add places, correct prices, confirm what is still there. It all
          counts — see below.
        </p>
      </Card>

      <Card>
        <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">
          After that — {price} USD a month
        </h2>

        <p className="mt-3 text-base leading-relaxed text-slate-700">
          One price, no tiers, no features held back. When the free year ends,
          using the map will cost about the price of a coffee — per month, not
          per search.
        </p>

        <p className="mt-3 text-sm leading-relaxed text-slate-700">
          Nothing about the map itself changes: every place stays visible, and
          contributing stays free.
        </p>
      </Card>

      <Card>
        <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">
          Or contribute instead of paying
        </h2>

        <p className="mt-3 text-base leading-relaxed text-slate-700">
          Credits are earned by adding real information, and {creditsPerMonth}{" "}
          credits covers one month. Nobody has to pay a cent if they help keep
          the map honest.
        </p>

        <ul className="mt-3 space-y-2 text-sm text-slate-700">
          <li>
            ☕ <strong>A place you added</strong> — paid once, and only when
            somebody else confirms it exists.
          </li>
          <li>💰 A price you add or correct</li>
          <li>📷 A photo you upload</li>
          <li>🧾 A useful update on someone else's place</li>
          <li>👍 Confirming a place is still there — up to five a day</li>
        </ul>

        <p className="mt-4 rounded-xl bg-slate-50 px-4 py-3 text-sm leading-relaxed text-slate-600">
          Adding a place pays only after a stranger has confirmed it. That is
          deliberate: it means the reward tracks places that are real, not
          pins dropped from a sofa.
        </p>
      </Card>

      <Card className="border-2 border-[#6f4e37]/30">
        <h2 className="text-sm font-bold uppercase tracking-wide text-[#6f4e37]">
          🏅 Founder — until {FOUNDER_CLOSES}
        </h2>

        <p className="mt-3 text-base leading-relaxed text-slate-700">
          If you help build the map before the free year ends, we do not forget
          it. Anyone with <strong>{FOUNDER_PLACES} places confirmed by another
          user</strong> gets <strong>{FOUNDER_MONTHS} months free</strong> once
          paying starts, and keeps a Founder mark on their profile for good.
        </p>

        <p className="mt-3 text-sm leading-relaxed text-slate-600">
          The window closes on {FOUNDER_CLOSES}. Status is decided by places
          that another person has confirmed — not by how many you typed in.
        </p>

        <p className="mt-3 text-sm leading-relaxed text-slate-600">
          Five is a low bar for someone who actually travels with this open.
          It is a high bar for someone who does not.
        </p>
      </Card>

      <Card>
        <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">
          The short version
        </h2>

        <ul className="mt-3 space-y-2 text-sm text-slate-700">
          <li>· Free today, for everyone.</li>
          <li>· {price} USD a month when the free year ends.</li>
          <li>· Free forever if you contribute enough.</li>
          <li>· Founder status if you start now — {FOUNDER_MONTHS} months, once.</li>
          <li>· No ads. Nobody is watching you to sell something.</li>
        </ul>
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
