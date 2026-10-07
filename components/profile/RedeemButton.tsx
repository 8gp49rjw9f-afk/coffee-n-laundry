"use client";

import { useState, useTransition } from "react";

import { redeemCreditsForMonth } from "@/app/actions/subscription";

import { showError } from "@/components/ui/ErrorPopup";

export function RedeemButton({ canRedeem }: { canRedeem: boolean }) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState("");

  if (!canRedeem) {
    return (
      <p className="text-sm text-slate-500">
        Not enough credits for a free month yet. Keep contributing.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const result = await redeemCreditsForMonth();

            if (result.ok) {
              setMessage("Done — one free month added.");
              return;
            }

            /* The action answers with a code now, so the popup says
               what happened rather than this component guessing. The
               line under the button stays for the success case, which
               is the only thing worth reading there. */
            showError(result.code ?? "CREDITS_REDEEM_FAILED");
          })
        }
        className="flex min-h-11 w-full items-center justify-center rounded-xl bg-slate-900 px-5 font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60"
      >
        {pending ? "Redeeming…" : "Redeem credits for a free month"}
      </button>

      {message && <p className="text-sm font-semibold text-slate-700">{message}</p>}
    </div>
  );
}
