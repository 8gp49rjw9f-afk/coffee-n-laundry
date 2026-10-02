import Link from "next/link";
import { redirect } from "next/navigation";

import { Card, Button, Badge } from "@/components/ui";

import { createClient } from "@/lib/supabase/server";
import { getCreditSummary } from "@/lib/services/credits";
import { getSettings } from "@/lib/services/settings";
import { getPlacesByUser } from "@/lib/database/places";

import { RedeemButton } from "@/components/profile/RedeemButton";

const STATUS_LABEL: Record<string, string> = {
  free_trial: "Free year",
  active: "Active",
  credit_month: "Free month from credits",
  expired: "Expired",
};

const ACTION_LABEL: Record<string, string> = {
  add_place: "Added a place",
  add_price: "Added a price",
  update_price: "Updated a price",
  add_photo: "Uploaded a photo",
  add_info: "Filled in information",
  confirm_place: "Confirmed a place",
  report_closed: "Reported a place closed",
  submit_update: "Submitted an update",
};

export default async function ProfilePage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/profile");
  }

  const [summary, settings, myPlaces, subscription] = await Promise.all([
    getCreditSummary(user.id),
    getSettings(),
    getPlacesByUser(user.id),
    supabase
      .from("subscriptions")
      .select("status, current_period_end")
      .eq("user_id", user.id)
      .maybeSingle(),
  ]);

  const status = subscription.data?.status ?? "free_trial";
  const canRedeem = summary.balance >= settings.credits_per_free_month;

  return (
    <main className="mx-auto max-w-2xl space-y-4 px-4 py-6 sm:px-8">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Me</h1>

          <p className="mt-1 text-sm text-slate-600">{user.email}</p>
        </div>

        <Link href="/signout" className="text-sm font-semibold text-slate-500 underline">
          Sign out
        </Link>
      </div>

      <Card>
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
              Your credits
            </p>

            <p className="text-4xl font-bold text-slate-900">{summary.balance}</p>
          </div>

          <Badge className="bg-slate-100 text-slate-700">
            {STATUS_LABEL[status] ?? status}
          </Badge>
        </div>

        <p className="mt-3 text-sm text-slate-600">
          {settings.credits_per_free_month} credits = one free month. Credits
          are a thank-you for keeping the map accurate — there is no ranking,
          and nobody else can see your balance.
        </p>

        <div className="mt-4">
          <RedeemButton canRedeem={canRedeem} />
        </div>
      </Card>

      <Card>
        <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-500">
          Places you added ({myPlaces.length})
        </h2>

        {myPlaces.length === 0 ? (
          <p className="text-sm text-slate-500">
            Nothing yet.{" "}
            <Link href="/new" className="font-semibold underline">
              Add the first one
            </Link>
            .
          </p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {myPlaces.map((place) => (
              <li key={place.id}>
                <Link
                  href={`/place/${place.id}`}
                  className="flex items-center gap-3 py-2.5 hover:text-slate-900"
                >
                  <span className="text-xl">
                    {place.place_type === "coffee" ? "☕" : "🧺"}
                  </span>

                  <span className="min-w-0 flex-1 truncate font-semibold text-slate-800">
                    {place.name}
                  </span>

                  <span className="shrink-0 text-xs text-slate-400">
                    {place.city ?? place.country ?? ""}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-500">
          Credit history
        </h2>

        {summary.history.length === 0 ? (
          <p className="text-sm text-slate-500">
            No credits yet. Adding a place is the quickest way to start.
          </p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {summary.history.map((row) => (
              <li
                key={row.id}
                className="flex items-center justify-between gap-3 py-2.5"
              >
                <span className="min-w-0 text-sm text-slate-700">
                  {row.note ?? ACTION_LABEL[row.action_key] ?? row.action_key}
                </span>

                <span
                  className={`shrink-0 text-sm font-bold ${
                    row.amount > 0 ? "text-emerald-700" : "text-rose-700"
                  }`}
                >
                  {row.amount > 0 ? "+" : ""}
                  {row.amount}
                </span>
              </li>
            ))}
          </ul>
        )}
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
