"use client";

import { useState, useTransition } from "react";

import { Button, Card, ErrorBanner, Badge } from "@/components/ui";

import { addAdmin, removeAdmin, setAdminNotify } from "@/app/actions/admin";

/*
 * Master only. An admin edits the site; the master decides who the
 * admins are — that separation is the whole point of the level, and
 * it is why this is the one panel a plain admin never sees.
 *
 * The master cannot remove themselves, and cannot remove another
 * master: a panel that can lock out its own last key holder is a trap.
 * The server enforces both; this is only the shape of the screen.
 */

/*
 * The notification switch, on every row — including the master's.
 *
 * It is NOT a master-only control, and it sits outside the master's
 * panel on purpose: it changes what one person receives, not who may
 * act. Gating it behind the master would mean only the master could
 * unsubscribe themselves, which is the wrong lock on the wrong door.
 * The server allows any admin to set it, their own included.
 *
 * The last one cannot be turned off. That is refused in
 * setAdminNotify, and it has to be: with every switch off, the
 * contact form finds no recipients, answers CONTACT_NO_RECIPIENT,
 * and every message a visitor writes is thrown away in silence.
 *
 * `switchable` is computed here rather than sent from the server: it
 * is arithmetic on what this screen already has, and the count can
 * only be right for the moment the page was rendered. If it is
 * stale, the server refuses anyway — this only stops the person
 * before the round-trip, it does not replace the check.
 */

/*
 * A place for these switches, separate from the panel the master
 * sees. Every admin, master or not, has to be able to reach their
 * own. Until the parent page renders this, the server function has
 * no caller — see the note in the hand-off.
 */

export interface AdminRow {
  email: string;
  is_master: boolean;
  created_at: string;
  notify_email: boolean;
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

  const receiving = admins.filter((admin) => admin.notify_email).length;

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

  function toggleNotify(target: string, next: boolean) {
    setError("");

    const formData = new FormData();
    formData.set("email", target);
    formData.set("notify_email", String(next));

    startTransition(async () => {
      try {
        await setAdminNotify(formData);
      } catch (err) {
        setError(
          err instanceof Error && err.message
            ? err.message
            : "Could not change that notification."
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

          /* Turning this one off would leave nobody receiving. The
             server refuses it; the button is already disabled so the
             person is not sent on a round-trip to be told. */
          const switchable = !(admin.notify_email && receiving <= 1);

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

              <div className="mt-3 flex items-center justify-between gap-3 border-t border-slate-100 pt-3">
                <div>
                  <p className="text-xs font-semibold text-slate-700">
                    Bug reports and messages
                  </p>

                  <p className="mt-0.5 text-[11px] text-slate-400">
                    {admin.notify_email
                      ? "Get a copy of what visitors write."
                      : "Not being sent these."}
                  </p>
                </div>

                <button
                  type="button"
                  role="switch"
                  aria-checked={admin.notify_email}
                  aria-label={`Send bug reports and messages to ${admin.email}`}
                  onClick={() => toggleNotify(admin.email, !admin.notify_email)}
                  disabled={pending || !switchable}
                  title={
                    switchable
                      ? undefined
                      : "Somebody has to receive these messages."
                  }
                  className={`relative h-6 w-11 shrink-0 rounded-full transition disabled:opacity-40 ${
                    admin.notify_email ? "bg-slate-900" : "bg-slate-300"
                  }`}
                >
                  <span
                    className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition ${
                      admin.notify_email ? "left-[22px]" : "left-0.5"
                    }`}
                  />
                </button>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

export default AdminsPanel;
