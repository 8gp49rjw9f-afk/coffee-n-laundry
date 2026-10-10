"use client";

import Link from "next/link";
import { useEffect } from "react";

import { describeError, logError } from "@/lib/errors";

/*
 * ======================================================
 * THE GLOBAL ERROR BOUNDARY
 * ======================================================
 *
 * The catch-all for anything below it in the tree. It shows the same
 * catalogue copy the popup uses, plus a way back, so a broken render
 * is never a blank screen.
 *
 * It does NOT try to guess the cause. `describeError` turns the error
 * into copy it knows, and for anything unrecognised it shows the
 * generic text and a reference — the raw message is dropped rather
 * than printed.
 *
 * A TEMPORARY panel used to print the raw message and the stack here,
 * while a cause was being hunted. It did its job and is gone: showing
 * a database message to a visitor is what this boundary and the
 * catalogue exist to prevent.
 *
 * WHY A CLIENT COMPONENT
 *
 * Next.js requires an error boundary to be one: it needs
 * componentDidCatch semantics to hold the error and a reset()
 * callback to try again. That is the framework's shape, not a choice
 * worth arguing with.
 */

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const described = describeError(error);

  useEffect(() => {
    /* The reference is logged beside the code, so "Ref. 4F2A" from a
       screenshot leads straight to this line in the logs. */
    logError("app/error", error);
  }, [error]);

  return (
    <main className="mx-auto flex min-h-[70vh] max-w-md flex-col items-center justify-center px-4 py-16 text-center sm:px-8">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-rose-100 text-2xl font-bold text-rose-700">
        !
      </div>

      <h1 className="mt-5 text-2xl font-bold text-slate-900">
        {described.title}
      </h1>

      <p className="mt-3 text-base leading-relaxed text-slate-600">
        {described.body}
      </p>

      <p className="mt-2 text-xs font-medium text-slate-400">
        Ref. {described.reference}
      </p>

      <div className="mt-6 flex w-full flex-col gap-2">
        <button
          type="button"
          onClick={reset}
          className="min-h-11 w-full rounded-xl bg-slate-900 px-5 font-semibold text-white transition hover:bg-slate-800"
        >
          Try again
        </button>

        <Link
          href="/"
          className="flex min-h-11 w-full items-center justify-center rounded-xl border border-slate-300 bg-white px-5 font-semibold text-slate-800 transition hover:bg-slate-50"
        >
          Back to the map
        </Link>
      </div>

      <p className="mt-6 text-xs text-slate-400">
        If it keeps happening, send us the reference above — it points at the
        exact line.
      </p>
    </main>
  );
}
