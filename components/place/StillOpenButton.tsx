"use client";

import { useState, useTransition } from "react";

import { confirmStillOpen } from "@/app/actions/verify";

import { showError } from "@/components/ui/ErrorPopup";

/*
 * A single tap, for someone standing outside. It confirms the place
 * is still trading — nothing more. The price rows keep their own
 * dates, because this button has not looked at any of them.
 *
 * SIZE IS A PROP, DEFAULTING TO THE OLD LOOK. Every call site that
 * existed before this prop existed still renders exactly the compact
 * 11 px pill it used to — the header of a place page asks for
 * size="lg", because there it is the main action of the page rather
 * than an annotation on a row.
 *
 * THREE STATES, and the date is not this component's business. It
 * shows what the reader can do right now: sign in, or already done
 * this week, or the button itself. “last verified” is rendered by
 * PlaceHeader beside it, from the same last_verified_at the
 * freshness tier counts from.
 */

type Size = "sm" | "lg";

/* The two sizes, in one place, so the three states cannot drift
   apart — they are the same button and must stay the same shape. */
const SHELL: Record<Size, string> = {
  sm: "rounded-md px-2 py-0.5 text-[11px]",
  lg: "rounded-lg px-3.5 py-1.5 text-sm",
};

export function StillOpenButton({
  placeId,
  signedIn,
  alreadyThisWeek,
  size = "sm",
  className = "",
}: {
  placeId: string;
  signedIn: boolean;
  alreadyThisWeek: boolean;
  size?: Size;
  className?: string;
}) {
  const [pending, startTransition] = useTransition();
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  const shell = SHELL[size];

  if (!signedIn) {
    return (
      <a
        href={`/login?next=/place/${placeId}`}
        className={`inline-flex w-fit shrink-0 items-center border border-slate-300 bg-white font-semibold text-slate-500 hover:bg-slate-50 ${shell} ${className}`}
      >
        Log in to confirm
      </a>
    );
  }

  if (done || alreadyThisWeek) {
    return (
      <span
        className={`inline-flex w-fit shrink-0 items-center border border-emerald-200 bg-emerald-50 font-semibold text-emerald-700 ${shell} ${className}`}
      >
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
      className={`inline-flex w-fit shrink-0 items-center border font-semibold transition disabled:opacity-60 ${shell} ${
        error
          ? "border-amber-200 bg-amber-50 text-amber-700"
          : "border-slate-300 bg-white text-slate-500 hover:bg-slate-50"
      } ${className}`}
    >
      {pending ? "…" : error || "Still open"}
    </button>
  );
}

export default StillOpenButton;
