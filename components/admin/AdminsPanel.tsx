"use client";

import { useState, useTransition } from "react";

import { Button, Card, ErrorBanner, Badge } from "@/components/ui";

import {
  addAdmin,
  removeAdmin,
  promoteAdmin,
  setAdminNotify,
} from "@/app/actions/admin";

/*
 * MASTER ONLY. An admin edits the site; a master decides who the
 * admins are — that separation is the whole point of the level, and
 * it is why this is the one panel a plain admin never sees.
 *
 * WHO LEAVES, AND HOW — the rule, as it was finally stated:
 *
 *   An ordinary admin  ← any master can remove them.
 *   A master           ← ONLY THEMSELVES. Nobody else, not even
 *                        another master. "Step down" is the button
 *                        on your own row, and it is the only way out.
 *   The last master    ← nobody, not even themselves. Somebody has to
 *                        be able to change this list.
 *
 * The server enforces all three, and 0023 puts a trigger under the
 * table for the third one. What is on this screen is the shape of
 * the rule, not the rule itself: every button here can be forged.
 */

export interface AdminRow {
  email: string;
  is_master: boolean;
  created_at: string;
  notify_email: boolean;
}

const FIELD =
  "w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-base outline-none focus:border-slate-500";

const SMALL =
  "rounded-lg border px-3 py-1.5 text-xs font-semibold transition disabled:opacity-50";

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
  const masters = admins.filter((admin) => admin.is_master).length;

  function run(work: () => Promise<void>, fallback: string) {
    setError("");

    startTransition(async () => {
      try {
        await work();
      } catch (err) {
        setError(err instanceof Error && err.message ? err.message : fallback);
      }
    });
  }

  function submit() {
    const formData = new FormData();
    formData.set("email", email.trim());

    run(async () => {
      await addAdmin(formData);
      setEmail("");
    }, "Could not add that admin.");
  }

  function remove(target: string) {
    if (!confirm(`Remove ${target} as an admin?`)) return;

    run(() => removeAdmin(target), "Could not remove that admin.");
  }

  /* Stepping down is your own decision and only yours — so it asks
     first, and it says what it means. Leaving the panel is not the
     same thing as losing an account: the account stays, the admin
     rights go. */
  function stepDown(target: string) {
    if (
      !confirm(
        `Step down as master?\n\nYou keep your account and stop being an admin. Nobody can do this for you, so it takes another master to invite you back.`
      )
    ) {
      return;
    }

    run(() => removeAdmin(target), "Could not step down.");
  }

  function promote(target: string) {
    if (!confirm(`Make ${target} a master?\n\nThey will be able to add and remove admins.`)) {
      return;
    }

    run(() => promoteAdmin(target), "Could not make that admin a master.");
  }

  function toggleNotify(target: string, next: boolean) {
    const formData = new FormData();
    formData.set("email", target);
    formData.set("notify_email", String(next));

    run(
      () => setAdminNotify(formData),
      "Could not change that notification."
    );
  }

  /* The last master cannot leave, so the button says so rather than
     sending the person on a round-trip to be refused. The server and
     the database both refuse it too — this is only the shape. */
  const lastMaster = masters <= 1;

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-600">
        Admins can edit the site settings and moderate reports. They cannot
        change this list — that is a master's job, and yours is a master
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

                  {/* An ordinary admin: any master may remove them. */}
                  {!admin.is_master && (
                    <button
                      type="button"
                      onClick={() => remove(admin.email)}
                      disabled={pending}
                      className={`${SMALL} border-rose-200 bg-white text-rose-700 hover:bg-rose-50`}
                    >
                      Remove
                    </button>
                  )}

                  {/* A master who is not you: offered nothing. No
                     Remove, because nobody else can remove a master;
                     no Step down, because it is not yours to take. */}

                  {/* Your own master row: the only door out, and only
                     for you. */}
                  {admin.is_master && isSelf && (
                    <button
                      type="button"
                      onClick={() => stepDown(admin.email)}
                      disabled={pending || lastMaster}
                      title={
                        lastMaster
                          ? "Somebody has to be able to change this list."
                          : undefined
                      }
                      className={`${SMALL} border-slate-300 bg-white text-slate-600 hover:bg-slate-50`}
                    >
                      Step down
                    </button>
                  )}

                  {!admin.is_master && (
                    <button
                      type="button"
                      onClick={() => promote(admin.email)}
                      disabled={pending}
                      className={`${SMALL} border-slate-300 bg-white text-slate-600 hover:bg-slate-50`}
                    >
                      Make master
                    </button>
                  )}
                </div>
              </div>

              <div className="mt-3 flex items-center justify-between gap-3 border-t border-slate-100 pt-3">
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-slate-700">
                    Receive emails from users
                  </p>

                  {/* The three things this switch governs, named. A
                     single word like "notifications" would leave an
                     admin guessing which of them they had just
                     stopped receiving. */}
                  <p className="mt-0.5 text-[11px] leading-relaxed text-slate-400">
                    {admin.notify_email
                      ? "Bug reports, contact messages, and “something is wrong” reports on a place."
                      : "Not being sent any of them."}
                  </p>
                </div>

                <button
                  type="button"
                  role="switch"
                  aria-checked={admin.notify_email}
                  aria-label={`Send emails from users to ${admin.email}`}
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
