"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { Card, Badge } from "@/components/ui";

import { searchUsers, type UserSearchRow } from "@/lib/database/users";

/*
 * Search by username or email. Both, because an admin arriving with a
 * complaint has an email, and an admin browsing the site sees a
 * username — asking either one to translate into the other would make
 * this screen useless for half its purpose.
 *
 * The query waits for a pause rather than firing on every keystroke:
 * each one is a database round trip, and typing "simon" would spend
 * five of them to answer one question.
 */

export function UserSearch() {
  const [term, setTerm] = useState("");
  const [rows, setRows] = useState<UserSearchRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    const clean = term.trim();

    if (clean.length < 2) {
      setRows([]);
      setTouched(false);
      return;
    }

    setLoading(true);

    const timer = setTimeout(async () => {
      const results = await searchUsers(clean);

      setRows(results);
      setLoading(false);
      setTouched(true);
    }, 350);

    return () => clearTimeout(timer);
  }, [term]);

  return (
    <div className="space-y-3">
      <Card>
        <label className="block">
          <span className="mb-1.5 block text-sm font-semibold text-slate-700">
            Find a user
          </span>

          <input
            value={term}
            onChange={(event) => setTerm(event.target.value)}
            placeholder="Username or email"
            autoComplete="off"
            className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-base outline-none focus:border-slate-500"
          />

          <span className="mt-1 block text-xs text-slate-500">
            Two letters or more. {loading && "Searching…"}
          </span>
        </label>
      </Card>

      {touched && rows.length === 0 && !loading && (
        <Card>
          <p className="text-sm text-slate-500">
            Nobody matches “{term.trim()}”.
          </p>
        </Card>
      )}

      {rows.map((row) => (
        <Link
          key={row.id}
          href={`/admin/user/${row.id}`}
          className="block"
        >
          <Card padding="sm" hover>
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
