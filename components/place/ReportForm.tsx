"use client";

import { useState } from "react";

import { Button } from "@/components/ui";

import { reportPlace } from "@/app/actions/updates";

import { showError } from "@/components/ui/ErrorPopup";

/* Collapsed by default: it should never be the loudest thing
   on the page. */

export function ReportForm({ placeId }: { placeId: string }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full rounded-xl py-2 text-sm font-semibold text-slate-500 hover:bg-slate-50"
      >
        🚩 Something wrong here?
      </button>
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

            try {
              const formData = new FormData();
              formData.set("place_id", placeId);
              formData.set("reason", reason.trim());

              await reportPlace(formData);
            } catch (err) {
              /* The action throws a code and the popup translates it.
                 A duplicate report is a muted notice rather than a
                 fault, so the form closes like a success would: the
                 person has said their piece either way. */
              const described = showError(err);

              if (described.severity === "muted") {
                setOpen(false);
                setReason("");
              }

              setLoading(false);
            }
          }}
        >
          {loading ? "Sending…" : "Send report"}
        </Button>
      </div>
    </div>
  );
}

export default ReportForm;
