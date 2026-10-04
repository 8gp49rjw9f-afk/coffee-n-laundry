import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { Card, Badge } from "@/components/ui";

import { currentAdmin } from "@/lib/services/admin";
import {
  getUserDetail,
  getUserLedger,
  getUserPlaces,
} from "@/lib/database/users";

/*
 * One person, as an admin needs to see them when something has gone
 * wrong: who they are, what they have contributed, what they have
 * earned, and every place they have put on the map.
 *
 * The email is shown here and only here. Elsewhere the username is
 * what appears, because an address is personal data and a public
 * timeline is not the place for it.
 */

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

export default async function AdminUserPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const admin = await currentAdmin();

  if (!admin) {
    redirect("/");
  }

  const { id } = await params;

  const user = await getUserDetail(id);

  if (!user) {
    notFound();
  }

  const [ledger, places] = await Promise.all([
    getUserLedger(id),
    getUserPlaces(id),
  ]);

  const joined = new Date(user.joined_at).toISOString().slice(0, 10);

  return (
    <main className="mx-auto max-w-3xl space-y-4 px-4 py-6 sm:px-8">
      <Link
        href="/admin?tab=users"
        className="text-sm font-semibold text-slate-500 hover:text-slate-900"
      >
        ← Back to users
      </Link>

      <div>
        <h1 className="text-2xl font-bold text-slate-900">
          @{user.username ?? "unnamed"}
        </h1>

        <p className="mt-1 text-sm text-slate-600">
          {user.email ?? "No address on record"}
        </p>

        <div className="mt-2 flex flex-wrap gap-1.5">
          {user.is_master && (
            <Badge className="bg-[#6f4e37] text-white">Master</Badge>
          )}

          {user.is_admin && !user.is_master && (
            <Badge className="bg-slate-900 text-white">Admin</Badge>
          )}

          {user.is_founder && (
            <Badge className="bg-amber-100 text-amber-900">🏅 Founder</Badge>
          )}

          {user.is_blocked && (
            <Badge className="bg-rose-100 text-rose-800">Blocked</Badge>
          )}
        </div>
      </div>

      <Card>
        <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">
          Contribution
        </h2>

        <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
          <div>
            <dt className="text-slate-500">Places added</dt>
            <dd className="text-lg font-bold text-slate-900">
              {user.places_added}
            </dd>
          </div>

          <div>
            <dt className="text-slate-500">Verified by someone else</dt>
            <dd className="text-lg font-bold text-slate-900">
              {user.places_verified_by_others}
            </dd>
          </div>

          <div>
            <dt className="text-slate-500">Confirmations made</dt>
            <dd className="text-lg font-bold text-slate-900">
              {user.confirmations_made}
            </dd>
          </div>

          <div>
            <dt className="text-slate-500">Photos added</dt>
            <dd className="text-lg font-bold text-slate-900">
              {user.photos_added}
            </dd>
          </div>
        </dl>

        <p className="mt-3 text-xs text-slate-500">
          Joined {joined}
          {user.is_founder &&
            ` · Founder since ${
              user.founder_since
                ? new Date(user.founder_since).toISOString().slice(0, 10)
                : "—"
            } with ${user.founder_places} confirmed places`}
        </p>
      </Card>

      <Card>
        <div className="flex items-baseline justify-between">
          <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">
            Credits
          </h2>

          <span className="text-2xl font-bold text-slate-900">
            {user.credit_balance}
          </span>
        </div>

        {ledger.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">Nothing earned yet.</p>
        ) : (
          <ul className="mt-3 divide-y divide-slate-100">
            {ledger.map((row) => (
              <li
                key={row.id}
                className="flex items-center justify-between gap-3 py-2"
              >
                <span className="min-w-0 text-sm text-slate-700">
                  <span className="block truncate">
                    {ACTION_LABEL[row.action_key] ?? row.action_key}
                  </span>

                  <span className="block text-xs text-slate-400">
                    {new Date(row.created_at).toISOString().slice(0, 10)}
                    {row.note ? ` · ${row.note}` : ""}
                  </span>
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

      <Card>
        <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">
          Places added ({places.length})
        </h2>

        {places.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">None yet.</p>
        ) : (
          <ul className="mt-3 divide-y divide-slate-100">
            {places.map((place) => (
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

                  {place.status !== "active" && (
                    <Badge
                      className={
                        place.status === "closed"
                          ? "bg-rose-100 text-rose-800"
                          : "bg-amber-100 text-amber-800"
                      }
                    >
                      {place.status === "closed" ? "Closed" : "Flagged"}
                    </Badge>
                  )}

                  <span className="shrink-0 text-xs text-slate-400">
                    {place.city ?? place.country ?? ""}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </main>
  );
}
