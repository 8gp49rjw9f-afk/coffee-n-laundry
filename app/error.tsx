"use client";

import Link from "next/link";
import { useEffect } from "react";

import { describeError, logError } from "@/lib/errors";

/*
 * ======================================================
 * THE GLOBAL ERROR BOUNDARY — TEMPORARY DIAGNOSTIC
 * ======================================================
 *
 * The real message and the digest are printed on the page, in a
 * panel at the bottom.
 *
 * WHY: a production Next build replaces the message of anything
 * that fails during a server render with a single sentence, and
 * keeps the real text in the logs. The logs could not be reached,
 * so for now the text comes to the screen instead. One reload, and
 * the cause is readable.
 *
 * REMOVE THIS PANEL once the cause is found. It shows a raw message
 * to a visitor, which the catalogue exists to prevent — this is a
 * deliberate, temporary exception, not a new behaviour.
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

      {/* ---------- TEMPORARY: the raw truth ---------- */}

      <div className="mt-6 w-full rounded-xl border border-slate-300 bg-slate-900 p-4 text-left">
        <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
          Diagnostic — remove once fixed
        </p>

        <p className="mt-2 break-all text-xs font-semibold text-amber-300">
          message: {error?.message || "(empty)"}
        </p>

        <p className="mt-1 break-all text-xs font-semibold text-sky-300">
          digest: {error?.digest || "(none)"}
        </p>

        <p className="mt-1 break-all text-xs font-semibold text-emerald-300">
          name: {error?.name || "(none)"}
        </p>

        {error?.stack && (
          <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap break-all text-[10px] leading-tight text-slate-300">
            {error.stack}
          </pre>
        )}
      </div>

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
    </main>
  );
}
