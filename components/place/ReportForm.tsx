"use client";

import { useState } from "react";

import { Button } from "@/components/ui";

import { reportPlace } from "@/app/actions/updates";

import { showError } from "@/components/ui/ErrorPopup";

/* Collapsed by default: it should never be the loudest thing
   on the page. */

/*
 * The action answers with a RESULT now — `{ ok, code }` — instead of
 * throwing. That is the whole point of the change, and this form is
 * where it shows.
 *
 * It used to wrap the call in a try/catch, because the action ended
 * with `redirect(...)` and a redirect is an exception in a Server
 * Action. The success path therefore landed in the catch, `showError`
 * was handed a redirect it could not read, and the person who had
 * just successfully reported a place got the generic "Something went
 * wrong" card with a reference that pointed at nothing.
 *
 * No try/catch now: nothing is thrown, so there is nothing to catch,
 * and a caught error here would only ever be a genuine crash rather
 * than the result of the action.
 *
 * The shape matches ContactForm, which reads `result.ok` and passes
 * `result.code` to the popup. One pattern for both forms.
 */

export function ReportForm({ placeId }: { placeId: string }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  if (!open) {
    return (
      <div>
        {sent && (
          <p className="mb-3 rounded-xl bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">
            🚩 Reported. Someone will take a look.
          </p>
        )}

        <button
          type="button"
          onClick={() => setOpen(true)}
          className="w-full rounded-xl py-2 text-sm font-semibold text-slate-500 hover:bg-slate-50"
        >
          🚩 Something wrong here?
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <textarea
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        rows={3}
        placeholder="The wash price is wrong, and it seems to have moved."
        className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-slate-500"
      />

      <div className="flex gap-2">
        <Button
          variant="ghost"
          onClick={() => {
            setOpen(false);
            setReason("");
          }}
        >
          Cancel
        </Button>

        <Button
          variant="danger"
          className="flex-1"
          disabled={loading || reason.trim().length === 0}
          onClick={async () => {
            setLoading(true);

            const formData = new FormData();
            formData.set("place_id", placeId);
            formData.set("reason", reason.trim());

            const result = await reportPlace(formData);

            setLoading(false);

            if (!result.ok) {
              /* A duplicate report is a muted notice rather than a
                 fault, so the form closes like a success would: the
                 person has said their piece either way. The severity
                 still comes from the catalogue, which is the one place
                 that decides how loudly a code speaks. */
              const described = showError(result.code ?? "REPORT_FAILED");

              if (described.severity === "muted") {
                setOpen(false);
                setReason("");
                setSent(true);
              }

              return;
            }

            /* Confirmed on the page itself, not by navigating to
               `?reported=1`. The redirect that used to do that was the
               thing being mistaken for a crash. */
            setOpen(false);
            setReason("");
            setSent(true);
          }}
        >
          {loading ? "Sending…" : "Send report"}
        </Button>
      </div>
    </div>
  );
}

export default ReportForm;
