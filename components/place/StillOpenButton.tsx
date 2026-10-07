"use client";

import { useState, useTransition } from "react";

import { confirmStillOpen } from "@/app/actions/verify";

import { showError } from "@/components/ui/ErrorPopup";

/*
 * A single tap, for someone standing outside. It confirms the place
 * is still trading — nothing more. The price rows keep their own
 * dates, because this button has not looked at any of them.
 */

export function StillOpenButton({
  placeId,
  signedIn,
  alreadyThisWeek,
}: {
  placeId: string;
  signedIn: boolean;
  alreadyThisWeek: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  if (!signedIn) {
    return (
      <a
        href={`/login?next=/place/${placeId}`}
        className="shrink-0 rounded-md border border-slate-300 bg-white px-2 py-0.5 text-[11px] font-semibold text-slate-500 hover:bg-slate-50"
      >
        Log in to confirm
      </a>
    );
  }

  if (done || alreadyThisWeek) {
    return (
      <span className="shrink-0 rounded-md border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
        This week ✓
      </span>
    );
  }

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          setError("");

          try {
            await confirmStillOpen(placeId);
            setDone(true);
          } catch (err) {
            /*
             * The button used to print the word "failed" inside
             * itself — the least useful thing on the busiest page.
             * Now the popup explains it, and the button only keeps
             * the state the person cares about.
             */
            const described = showError(err);

            if (described.code === "VERIFY_ALREADY_THIS_WEEK") {
              setError("This week ✓");
            }
          }
        })
      }
      className={`shrink-0 rounded-md border px-2 py-0.5 text-[11px] font-semibold transition disabled:opacity-60 ${
        error
          ? "border-amber-200 bg-amber-50 text-amber-700"
          : "border-slate-300 bg-white text-slate-500 hover:bg-slate-50"
      }`}
    >
      {pending ? "…" : error || "Still open"}
    </button>
  );
}

export default StillOpenButton;
