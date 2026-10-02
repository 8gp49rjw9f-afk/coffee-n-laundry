"use client";

import { useState, useTransition } from "react";

import { redeemCreditsForMonth } from "@/app/actions/subscription";

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

            setMessage(
              result.ok
                ? "Done — one free month added."
                : (result.error ?? "Could not redeem right now.")
            );
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
