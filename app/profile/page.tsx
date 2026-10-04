import Link from "next/link";
import { redirect } from "next/navigation";

import { Card, Button, Badge } from "@/components/ui";

import { createClient } from "@/lib/supabase/server";
import { getCreditSummary } from "@/lib/services/credits";
import { getSettings } from "@/lib/services/settings";
import { getPlacesByUser } from "@/lib/database/places";

import { RedeemButton } from "@/components/profile/RedeemButton";
import { UsernameForm } from "@/components/profile/UsernameForm";

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
  place_demoted: "Place removed — credits taken back",
};

export default async function ProfilePage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/profile");
  }

  const [summary, settings, myPlaces, subscription, profile, stats] =
    await Promise.all([
      getCreditSummary(user.id),
      getSettings(),
      getPlacesByUser(user.id),
      supabase
        .from("subscriptions")
        .select("status, current_period_end")
        .eq("user_id", user.id)
        .maybeSingle(),

      /* The username and Founder status live on the profile, which the
         page never read before — it showed only credits and places. */
      supabase
        .from("profiles")
        .select(
          "username, username_changed_at, is_founder, founder_places, created_at"
        )
        .eq("id", user.id)
        .maybeSingle(),

      /* Counted in the database, not in the browser. Counting here
         would download every contribution to display two numbers. */
      supabase
        .from("contributor_stats")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle(),
    ]);

  const status = subscription.data?.status ?? "free_trial";
  const canRedeem = summary.balance >= settings.credits_per_free_month;

  const placesAdded = stats?.places_added ?? myPlaces.length;
  const verifiedByOthers = stats?.verified_places ?? 0;

  return (
    <main className="mx-auto max-w-2xl space-y-4 px-4 py-6 sm:px-8">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-bold text-slate-900">
            @{profile?.username ?? "unnamed"}
          </h1>

          {/* The address is shown to its owner, and only to its owner. */}
          <p className="mt-1 truncate text-sm text-slate-600">{user.email}</p>

          {profile?.is_founder && (
            <div className="mt-2">
              <Badge className="bg-amber-100 text-amber-900">
                🏅 Founder · {profile.founder_places} places verified
              </Badge>
            </div>
          )}
        </div>

        <Link
          href="/signout"
          className="shrink-0 text-sm font-semibold text-slate-500 underline"
        >
          Sign out
        </Link>
      </div>

      <UsernameForm
        current={profile?.username ?? null}
        changedAt={profile?.username_changed_at ?? null}
      />

      <Card>
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
              Your credits
            </p>

            <p className="text-4xl font-bold text-slate-900">
              {summary.balance}
            </p>
          </div>

          <Badge className="bg-slate-100 text-slate-700">
            {STATUS_LABEL[status] ?? status}
          </Badge>
        </div>

        <dl className="mt-4 grid grid-cols-3 gap-2 text-center">
          <div className="rounded-xl bg-slate-50 p-3">
            <dt className="text-xs font-semibold uppercase text-slate-500">
              Added
            </dt>
            <dd className="text-xl font-bold text-slate-900">{placesAdded}</dd>
          </div>

          <div className="rounded-xl bg-slate-50 p-3">
            <dt className="text-xs font-semibold uppercase text-slate-500">
              Verified
            </dt>
            <dd className="text-xl font-bold text-slate-900">
              {verifiedByOthers}
            </dd>
          </div>

          <div className="rounded-xl bg-slate-50 p-3">
            <dt className="text-xs font-semibold uppercase text-slate-500">
              Checks
            </dt>
            <dd className="text-xl font-bold text-slate-900">
              {stats?.confirmations_made ?? 0}
            </dd>
          </div>
        </dl>

        <p className="mt-3 text-sm text-slate-600">
          {settings.credits_per_free_month} credits = one free month. Credits
          are a thank-you for keeping the map accurate — there is no ranking,
          and nobody else can see your balance. “Verified” counts your places
          that someone else has confirmed, which is when the credit is
          released to you.
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
