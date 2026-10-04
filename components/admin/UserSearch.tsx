import Link from "next/link";

import { Card, Badge } from "@/components/ui";

import { searchUsers, type UserSearchRow } from "@/lib/database/users";

/*
 * Search by username or email. Both, because an admin arriving with a
 * complaint has an email, and an admin browsing the site sees a
 * username — asking either one to translate into the other would make
 * this screen useless for half its purpose.
 *
 * THIS IS A SERVER COMPONENT, and that is not an accident.
 *
 * It was written as a client component first, and the build rejected
 * it: searching reads `lib/database/users.ts`, which reads
 * `lib/supabase/server.ts`, which needs next/headers — none of which
 * a browser can have. Client-side search would have meant shipping a
 * browser Supabase client and doing the query with the anon key, and
 * the emails in the results cannot be fetched that way at all.
 *
 * So the term travels in the URL and the query runs on the server.
 * Two things fall out of that which a client component could not
 * give: the search is linkable (`/admin?tab=users&q=simon` can be
 * sent to the other admin), and the field still works with
 * JavaScript off — the results are already in the HTML.
 */

export async function UserSearch({ term }: { term: string }) {
  const clean = term.trim();

  /* One letter matches most of the table, which is a list, not an
     answer. Below two characters the page stays quiet. */
  const rows: UserSearchRow[] = clean.length >= 2 ? await searchUsers(clean) : [];

  const searched = clean.length >= 2;

  return (
    <div className="space-y-3">
      <Card>
        {/* A GET form: the browser puts the term in the query string
            itself, so there is no state to keep in sync. */}
        <form action="/admin" method="get" className="block">
          <input type="hidden" name="tab" value="users" />

          <label className="block">
            <span className="mb-1.5 block text-sm font-semibold text-slate-700">
              Find a user
            </span>

            <input
              name="q"
              defaultValue={clean}
              placeholder="Username or email"
              autoComplete="off"
              enterKeyHint="search"
              className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-base outline-none focus:border-slate-500"
            />

            <span className="mt-1 block text-xs text-slate-500">
              Two letters or more. Press enter to search.
            </span>
          </label>

          <button
            type="submit"
            className="mt-3 min-h-11 w-full rounded-xl bg-slate-900 px-4 font-semibold text-white transition hover:bg-slate-800"
          >
            Search
          </button>
        </form>
      </Card>

      {searched && rows.length === 0 && (
        <Card>
          <p className="text-sm text-slate-500">
            Nobody matches “{clean}”.
          </p>
        </Card>
      )}

      {rows.map((row) => (
        <Link key={row.id} href={`/admin/user/${row.id}`} className="block">
          <Card padding="sm">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate font-semibold text-slate-900">
                  @{row.username ?? "unnamed"}
                </p>

                <p className="mt-0.5 truncate text-xs text-slate-500">
                  {row.email ?? "no address"}
                </p>
              </div>

              <div className="flex shrink-0 flex-wrap justify-end gap-1">
                {row.is_founder && (
                  <Badge className="bg-[#6f4e37] text-white">Founder</Badge>
                )}

                {row.is_admin && (
                  <Badge className="bg-slate-900 text-white">Admin</Badge>
                )}

                <Badge className="bg-slate-100 text-slate-700">
                  {row.credit_balance} credits
                </Badge>
              </div>
            </div>

            <p className="mt-2 text-xs text-slate-400">
              {row.places_added} {row.places_added === 1 ? "place" : "places"} ·
              joined {new Date(row.created_at).toISOString().slice(0, 10)}
            </p>
          </Card>
        </Link>
      ))}
    </div>
  );
}

export default UserSearch;
