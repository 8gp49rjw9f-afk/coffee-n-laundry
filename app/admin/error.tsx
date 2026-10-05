"use client";

import Link from "next/link";
import { useEffect } from "react";

import { describeError, logError } from "@/lib/errors";

/* The admin panel could not be loaded. Typically one of its reads:
   the site settings row, the credit rules, or the report queue. */

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const described = describeError(error);

  useEffect(() => {
    logError("app/admin/error", error);
  }, [error]);

  return (
    <main className="mx-auto flex min-h-[70vh] max-w-md flex-col items-center justify-center px-4 py-16 text-center sm:px-8">
      <div className="text-5xl">🧭</div>

      <h1 className="mt-5 text-2xl font-bold text-slate-900">
        The admin panel could not be loaded
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
          ← Back to the map
        </Link>
      </div>
    </main>
  );
}
