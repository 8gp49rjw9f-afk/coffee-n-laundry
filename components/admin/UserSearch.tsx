import Link from "next/link";

import { Card, Badge } from "@/components/ui";

import { createClient } from "@/lib/supabase/server";
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

/*
 * THE TWO NUMBERS ABOVE THE FIELD.
 *
 * How many accounts exist, and who arrived last. Both read from
 * `profiles`, and both are read here rather than through a new
 * Postgres function.
 *
 * The tempting route was a `admin_stats()` function alongside
 * `search_users`, which is `SECURITY DEFINER` and reads auth.users.
 * Nothing here needs the email, though: a name is enough for the
 * line, and `profiles` is already readable — so no migration, and
 * nothing new to paste into the Supabase SQL editor, which is where
 * this project has lost the most time.
 *
 * What that choice costs, said plainly: the count includes a
 * sign-up that never confirmed its address. `auth.users` is where
 * `email_confirmed_at` lives, and reaching it would mean the
 * function after all. A count that is slightly generous is the right
 * trade for a line that is only ever read.
 */
async function userStats(): Promise<{
  total: number;
  latest: string | null;
}> {
  const supabase = await createClient();

  /* head:true asks for the number and nothing else — Postgres counts
     the rows without sending them. */
  const { count } = await supabase
    .from("profiles")
    .select("id", { count: "exact", head: true });

  const { data } = await supabase
    .from("profiles")
    .select("username")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return {
    total: count ?? 0,
    latest: data?.username ?? null,
  };
}

export async function UserSearch({ term }: { term: string }) {
  const clean = term.trim();

  /* One letter matches most of the table, which is a list, not an
     answer. Below two characters the page stays quiet. */
  const rows: UserSearchRow[] = clean.length >= 2 ? await searchUsers(clean) : [];

  const searched = clean.length >= 2;

  /* Fails softly: a missing `profiles` row or an unreadable table
     leaves the line off the page rather than taking the tab down
     with it. */
  let stats: { total: number; latest: string | null } = {
    total: 0,
    latest: null,
  };

  try {
    stats = await userStats();
  } catch (error) {
    console.error("[UserSearch] stats", error);
  }

  const countLabel = `${stats.total} ${
    stats.total === 1 ? "user" : "users"
  }`;

  return (
    <div className="space-y-3">
      <Card>
        {/* The two numbers, said the way a person would say them.
            No heading: the sentence is short enough to read as one
            fact, and a label above it would say it twice. */}
        <p className="mb-3 text-sm text-slate-600">
          <span className="font-semibold text-slate-900">{countLabel}</span>
          {stats.latest && (
            <>
              {" · "}
              last new user ={" "}
              <span className="font-semibold text-slate-900">
                {stats.latest}
              </span>
            </>
          )}
        </p>

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
