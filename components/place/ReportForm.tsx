"use client";

import { useState } from "react";

import { Button, ErrorBanner } from "@/components/ui";

import { reportPlace } from "@/app/actions/updates";

/* Collapsed by default: it should never be the loudest thing
   on the page. */

export function ReportForm({ placeId }: { placeId: string }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

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

      {error && <ErrorBanner message={error} />}

      <div className="flex gap-2">
        <Button
          variant="ghost"
          onClick={() => {
            setOpen(false);
            setError("");
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
            setError("");

            try {
              const formData = new FormData();
              formData.set("place_id", placeId);
              formData.set("reason", reason.trim());

              await reportPlace(formData);
            } catch (err) {
              setError(
                err instanceof Error && err.message
                  ? err.message
                  : "Could not send that report."
              );

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
