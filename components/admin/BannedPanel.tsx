import Link from "next/link";

import { Card } from "@/components/ui";

import { unbanUser } from "@/app/actions/admin";

/*
 * The way back.
 *
 * A ban is meant to be reversible, and until this panel existed it
 * would not have been: the only screen that lists a suspended account
 * is the search result, and an admin who has forgotten the name has
 * no way to find it. Suspensions that cannot be lifted stop being
 * suspensions and become deletions.
 *
 * The reason is shown, because that is what the ban was FOR — six
 * months later, "spam in the comments" is the only thing that tells
 * an admin whether this was a real decision or a slip.
 *
 * No email in this list. The tab needs a name to recognise and a
 * button to press, and an address is personal data.
 */

export interface BannedRow {
  id: string;
  username: string | null;
  banned_at: string;
  banned_reason: string | null;
  places_added: number;
}

export function BannedPanel({ rows }: { rows: BannedRow[] }) {
  if (rows.length === 0) {
    return (
      <Card>
        <p className="text-sm text-slate-500">
          Nobody is suspended. The map is quiet.
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-600">
        {rows.length} suspended {rows.length === 1 ? "account" : "accounts"}.
        Their places are still on the map unless they were hidden when the
        ban was set.
      </p>

      {rows.map((row) => (
        <Card key={row.id} padding="sm">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <Link
                href={`/admin/user/${row.id}`}
                className="truncate font-semibold text-slate-900 hover:underline"
              >
                @{row.username ?? "unnamed"}
              </Link>

              <p className="mt-0.5 text-xs text-slate-500">
                Suspended {new Date(row.banned_at).toISOString().slice(0, 10)}
                {" · "}
                {row.places_added}{" "}
                {row.places_added === 1 ? "place" : "places"}
              </p>

              {row.banned_reason ? (
                <p className="mt-1 text-xs italic text-slate-600">
                  “{row.banned_reason}”
                </p>
              ) : (
                <p className="mt-1 text-xs text-slate-400">No reason given.</p>
              )}
            </div>

            <form action={unbanUser} className="shrink-0">
              <input type="hidden" name="user_id" value={row.id} />

              <button
                type="submit"
                className="min-h-11 rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                Unban
              </button>
            </form>
          </div>
        </Card>
      ))}
    </div>
  );
}

export default BannedPanel;
