"use client";

import { useState, useTransition } from "react";

import { Button, Card, ErrorBanner, Badge } from "@/components/ui";

import { addAdmin, removeAdmin } from "@/app/actions/admin";

/*
 * Master only. An admin edits the site; the master decides who the
 * admins are — that separation is the whole point of the level, and
 * it is why this is the one panel a plain admin never sees.
 *
 * The master cannot remove themselves, and cannot remove another
 * master: a panel that can lock out its own last key holder is a trap.
 * The server enforces both; this is only the shape of the screen.
 */

export interface AdminRow {
  email: string;
  is_master: boolean;
  created_at: string;
}

const FIELD =
  "w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-base outline-none focus:border-slate-500";

export function AdminsPanel({
  admins,
  self,
}: {
  admins: AdminRow[];
  self: string;
}) {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  const sorted = [...admins].sort((a, b) => {
    if (a.is_master === b.is_master) return a.email.localeCompare(b.email);
    return a.is_master ? -1 : 1;
  });

  function submit() {
    setError("");

    const formData = new FormData();
    formData.set("email", email.trim());

    startTransition(async () => {
      try {
        await addAdmin(formData);
        setEmail("");
      } catch (err) {
        setError(
          err instanceof Error && err.message
            ? err.message
            : "Could not add that admin."
        );
      }
    });
  }

  function remove(target: string) {
    if (!confirm(`Remove ${target} as an admin?`)) return;

    setError("");

    startTransition(async () => {
      try {
        await removeAdmin(target);
      } catch (err) {
        setError(
          err instanceof Error && err.message
            ? err.message
            : "Could not remove that admin."
        );
      }
    });
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-600">
        Admins can edit the site settings and moderate reports. They cannot
        change this list — that is the master's job, and yours is the master
        account.
      </p>

      <Card>
        <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">
          Add an admin
        </h2>

        <p className="mt-1 text-xs text-slate-400">
          The address must already have an account on the site.
        </p>

        <div className="mt-3 space-y-3">
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                submit();
              }
            }}
            placeholder="name@example.com"
            className={FIELD}
          />

          {error && <ErrorBanner message={error} />}

          <Button
            onClick={submit}
            disabled={pending || email.trim().length === 0}
            className="w-full"
          >
            {pending ? "Adding…" : "Add admin"}
          </Button>
        </div>
      </Card>

      <div className="space-y-2">
        {sorted.map((admin) => {
          const isSelf = admin.email.toLowerCase() === self.toLowerCase();

          return (
            <Card key={admin.email} padding="sm">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-semibold text-slate-900">
                    {admin.email}
                  </p>

                  {isSelf && (
                    <p className="mt-0.5 text-xs text-slate-400">
                      That is you.
                    </p>
                  )}
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  {admin.is_master && (
                    <Badge className="bg-[#6f4e37] text-white">Master</Badge>
                  )}

                  {!admin.is_master && !isSelf && (
                    <button
                      type="button"
                      onClick={() => remove(admin.email)}
                      disabled={pending}
                      className="rounded-lg border border-rose-200 bg-white px-3 py-1.5 text-xs font-semibold text-rose-700 transition hover:bg-rose-50 disabled:opacity-50"
                    >
                      Remove
                    </button>
                  )}
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

export default AdminsPanel;
