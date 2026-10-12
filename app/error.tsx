"use client";

import Link from "next/link";
import { useEffect } from "react";

import { describeError, logError } from "@/lib/errors";

/*
 * ======================================================
 * THE GLOBAL ERROR BOUNDARY
 * ======================================================
 *
 * The last thing a visitor should meet when something breaks. It says
 * what happened in plain English, offers a way onward, and prints a
 * short reference that points at the line in the logs.
 *
 * The raw message is NEVER shown. A Postgres string, a thrown code
 * like PLACE_PHOTO_REQUIRED, or a stack trace tells a visitor nothing
 * they can act on, and it tells whoever is reading the page over
 * their shoulder more than they should see. Everything technical goes
 * to logError below, which is where it is actually useful.
 *
 * A diagnostic panel used to sit here and print message, digest, name
 * and stack to the screen. It did its job while the cause was being
 * hunted and then had to go: it was defeating the whole point of the
 * catalogue in lib/errors.ts. If something needs pinning down again,
 * read the logs — not this page.
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
