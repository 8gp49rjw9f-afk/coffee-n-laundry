"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { deletePlace } from "@/app/actions/admin";
import { describeError } from "@/lib/errors";

/*
 * The one irreversible control on the site.
 *
 * Closing a place is a status change and restorePlace undoes it;
 * deleting one takes the row, its photos, its reports and its credits
 * with it. So this asks first, with a plain yes or no — and while the
 * question is open the destructive answer is the quiet one: “No, keep
 * it” carries the emphasis, and “Yes, delete it” is the outlined
 * button that has to be aimed at.
 *
 * Admin-only, but that is not enforced here. The button is an
 * affordance; deletePlace checks the same thing again on the server,
 * where a forged request cannot get past it.
 */

export function DeletePlaceButton({
  placeId,
  placeName,
}: {
  placeId: string;
  placeName: string;
}) {
  const router = useRouter();

  const [asking, setAsking] = useState(false);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  function confirm() {
    setError("");

    const formData = new FormData();
    formData.set("place_id", placeId);

    startTransition(async () => {
      try {
        await deletePlace(formData);

        /* The page the person is standing on no longer exists, so this
           is a navigate rather than a revalidate. */
        router.push("/");
      } catch (err) {
        const described = describeError(err);

        setError(described.body);
        setAsking(false);
      }
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setAsking(true)}
        className="mt-1 rounded-lg border border-rose-300 bg-rose-50 px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-rose-800 transition hover:bg-rose-100"
      >
        Delete
      </button>

      {error && (
        <span className="mt-1 max-w-40 text-right text-[10px] leading-tight text-rose-700">
          {error}
        </span>
      )}

      {asking && (
        <div className="fixed inset-0 z-[1200] flex items-center justify-center bg-slate-900/60 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl">
            <h2 className="text-lg font-bold text-slate-900">
              Delete this place for good?
            </h2>

            <p className="mt-2 text-sm text-slate-600">
              <span className="font-semibold text-slate-900">{placeName}</span>{" "}
              will be removed completely — the place, its photos, its reports
              and the credits it earned. This cannot be undone.
            </p>

            <div className="mt-5 flex gap-2">
              <button
                type="button"
                onClick={confirm}
                disabled={pending}
                className="min-h-11 flex-1 rounded-xl border border-rose-300 bg-white px-4 font-semibold text-rose-800 transition hover:bg-rose-50 disabled:opacity-50"
              >
                {pending ? "Deleting…" : "Yes, delete it"}
              </button>

              <button
                type="button"
                onClick={() => setAsking(false)}
                disabled={pending}
                className="min-h-11 flex-1 rounded-xl bg-slate-900 px-4 font-semibold text-white transition hover:bg-slate-800 disabled:opacity-50"
              >
                No, keep it
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default DeletePlaceButton;
