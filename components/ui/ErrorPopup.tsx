"use client";

/*
 * ======================================================
 * ERROR POPUP
 * ======================================================
 *
 * One popup for the whole site. Every failure a person can meet
 * ends up here, in the same place, saying the same kind of thing —
 * so it is recognisable rather than a different red box each time.
 *
 * WHERE IT APPEARS
 *
 * Bottom of the screen on a phone, where the thumb already is;
 * bottom-right on a wider screen, out of the way of what someone
 * was reading. It sits above the map (z-50 in the header, z-1200 in
 * the photo lightbox, so this is 1300).
 *
 * THREE THINGS IT SHOWS
 *
 *   What went wrong   — three or four words, in the title.
 *   What to do        — one sentence of plain English.
 *   A reference       — four characters, small. For quoting when
 *                       writing to us, and for finding the line in
 *                       the logs.
 *
 * WHAT IT NEVER SHOWS
 *
 * The raw message. If a Postgres string reached this component, it
 * would be shown to somebody who cannot act on it and should not
 * see it. `describeError` is what stands between the two: a string
 * it does not recognise becomes the generic text, and the original
 * is dropped.
 *
 * SEVERITY
 *
 *   blocking — red. The action did not happen.
 *   warning  — amber. It happened, but something was lost.
 *   muted    — grey, and it does not appear as a card at all: it
 *              slides in quietly and fades by itself. This is the
 *              one for "credits are paused", where interrupting
 *              someone would be worse than the news.
 *
 * HOW A COMPONENT USES IT
 *
 * Not by rendering it. The popup is mounted once, in the layout,
 * and components talk to it through a small store — because the
 * things that fail are often not in a position to render anything:
 * a panel inside a map, a card that has already unmounted.
 *
 *     import { showError } from "@/components/ui/ErrorPopup";
 *     ...
 *     catch (err) {
 *       showError(err);
 *     }
 *
 * The error is described at the moment it is shown, so callers pass
 * whatever they caught — an Error, a code, anything.
 */

import { useEffect, useState } from "react";

import { describeError, type DescribedError } from "@/lib/errors";

/* ====================================================== */
/* THE STORE — module level, so anything can reach it       */
/* ====================================================== */

type Listener = (described: DescribedError | null) => void;

/*
 * One current error, and the components watching for it.
 *
 * Deliberately not a queue: two failures at once is almost always
 * one cause, and stacking cards would push the second out of sight
 * anyway. The newest wins.
 */
let current: DescribedError | null = null;
const listeners = new Set<Listener>();

function publish(next: DescribedError | null) {
  current = next;

  for (const listener of listeners) listener(next);
}

/**
 * Show an error.
 *
 * Takes anything thrown. A known code gets its copy; an Error gets
 * the code found inside it; a Postgres sentence gets the generic
 * text, with the sentence dropped.
 */
export function showError(thrown: unknown): DescribedError {
  const described = describeError(thrown);

  publish(described);

  return described;
}

/**
 * Show something we know the meaning of without a thrown error —
 * for the muted notices, which no exception produces.
 */
export function showErrorCode(code: string): DescribedError {
  return showError(code);
}

/** Clear it. Used by the dismiss button and the retry handler. */
export function clearError() {
  publish(null);
}

/* ====================================================== */
/* THE POPUP                                                */
/* ====================================================== */

export function ErrorPopup() {
  const [error, setError] = useState<DescribedError | null>(current);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    const listener: Listener = (next) => {
      setLeaving(false);
      setError(next);
    };

    listeners.add(listener);

    /* Something may have failed before this mounted — a server
       render that threw during hydration, for instance. */
    if (current) listener(current);

    return () => {
      listeners.delete(listener);
    };
  }, []);

  /* A muted notice leaves on its own. It carries no decision, so
     making somebody dismiss it would only add a step. */
  useEffect(() => {
    if (!error || error.severity !== "muted") return;

    const timer = setTimeout(() => setLeaving(true), 6000);

    return () => clearTimeout(timer);
  }, [error]);

  /* The fade before unmounting, so it does not vanish mid-sentence. */
  useEffect(() => {
    if (!leaving) return;

    const timer = setTimeout(() => {
      setError(null);
      clearError();
      setLeaving(false);
    }, 200);

    return () => clearTimeout(timer);
  }, [leaving]);

  /* Escape dismisses, like every other overlay on the site. */
  useEffect(() => {
    if (!error) return;

    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setLeaving(true);
    }

    document.addEventListener("keydown", onKey);

    return () => document.removeEventListener("keydown", onKey);
  }, [error]);

  if (!error) return null;

  const muted = error.severity === "muted";

  if (muted) {
    return (
      <div
        role="status"
        aria-live="polite"
        className={`fixed inset-x-4 bottom-4 z-[1300] transition-opacity duration-200 sm:left-auto sm:right-6 sm:max-w-sm ${
          leaving ? "opacity-0" : "opacity-100"
        }`}
      >
        <div className="flex items-start gap-3 rounded-xl bg-slate-900/90 px-4 py-3 text-white shadow-lg backdrop-blur">
          <span className="text-base leading-none">i</span>

          <div className="min-w-0">
            <p className="text-sm font-semibold">{error.title}</p>

            <p className="mt-0.5 text-xs leading-relaxed text-slate-200">
              {error.body}
            </p>
          </div>
        </div>
      </div>
    );
  }

  const tone =
    error.severity === "warning"
      ? {
          card: "border-amber-300 bg-amber-50",
          title: "text-amber-900",
          body: "text-amber-800",
        }
      : {
          card: "border-rose-300 bg-rose-50",
          title: "text-rose-900",
          body: "text-rose-800",
        };

  return (
    <div
      role="alert"
      aria-live="assertive"
      className={`fixed inset-x-4 bottom-4 z-[1300] transition-opacity duration-200 sm:left-auto sm:right-6 sm:max-w-md ${
        leaving ? "opacity-0" : "opacity-100"
      }`}
    >
      <div className={`rounded-2xl border p-4 shadow-xl ${tone.card}`}>
        <div className="flex items-start gap-3">
          <span className="text-xl leading-none">!</span>

          <div className="min-w-0 flex-1">
            <p className={`text-base font-bold ${tone.title}`}>
              {error.title}
            </p>

            <p className={`mt-1 text-sm leading-relaxed ${tone.body}`}>
              {error.body}
            </p>

            {/* The reference, for quoting. Muted on purpose: it is
                here if it is needed, not competing with the message. */}
            <p
              className={`mt-2 text-[11px] font-medium ${tone.body} opacity-60`}
            >
              Ref. {error.reference}
            </p>
          </div>

          <button
            type="button"
            onClick={() => setLeaving(true)}
            aria-label="Dismiss"
            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold transition hover:bg-black/5 ${tone.title}`}
          >
            x
          </button>
        </div>

        {(error.retry || error.severity === "warning") && (
          <div className="mt-3 flex gap-2">
            {error.retry && (
              <button
                type="button"
                onClick={() => {
                  /* A full reload rather than a router refresh. The
                     failures that reach here are usually a server
                     render that threw, and re-running the same
                     navigation is what clears those. */
                  window.location.reload();
                }}
                className="min-h-10 flex-1 rounded-xl border border-black/10 bg-white px-4 text-sm font-semibold text-slate-800 transition hover:bg-slate-100"
              >
                Try again
              </button>
            )}

            <button
              type="button"
              onClick={() => setLeaving(true)}
              className="min-h-10 flex-1 rounded-xl border border-black/10 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
            >
              Dismiss
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default ErrorPopup;
