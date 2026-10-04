"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Card, Button } from "@/components/ui";

import { createClient } from "@/lib/supabase/client";

/*
 * Choosing a username.
 *
 * The warning sits above the button, not in a confirmation dialog:
 * a dialog is clicked through in a second, a sentence under the field
 * is read. This is the one thing on this screen somebody can regret.
 *
 * The form keeps the name lowercase as it is typed, because the
 * database stores it lowercase anyway — silently rewriting what
 * someone typed after they saved would be worse than doing it live.
 */

const PATTERN = /^[a-z0-9_-]{3,10}$/;

function tidy(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, "")
    .slice(0, 10);
}

export function UsernameForm({
  current,
  changedAt,
}: {
  current: string | null;
  changedAt: string | null;
}) {
  const router = useRouter();

  const [value, setValue] = useState(current ?? "");
  const [status, setStatus] = useState<"idle" | "taken" | "free">("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const alreadyChanged = changedAt !== null;
  const unchanged = value === (current ?? "");
  const shapeOk = PATTERN.test(value);

  async function checkAvailability(candidate: string) {
    if (!PATTERN.test(candidate)) {
      setStatus("idle");
      return;
    }

    const supabase = createClient();

    const { data } = await supabase.rpc("username_available", {
      p_username: candidate,
    });

    setStatus(data ? "free" : "taken");
  }

  async function save() {
    if (!shapeOk || alreadyChanged) return;

    setSaving(true);
    setMessage(null);

    const supabase = createClient();

    const { data, error } = await supabase.rpc("change_username", {
      p_new: value,
    });

    setSaving(false);

    if (error) {
      setMessage(error.message);
      return;
    }

    /* The function answers with one row: did it work, and why not. */
    const row = Array.isArray(data) ? data[0] : data;

    if (!row?.ok) {
      setMessage(row?.message ?? "That did not work.");
      return;
    }

    setMessage(row.message);
    router.refresh();
  }

  const hint = !shapeOk
    ? "Three to ten characters: letters, numbers, hyphen or underscore."
    : status === "taken"
      ? "That name is taken."
      : status === "free"
        ? "Available."
        : "";

  return (
    <Card>
      <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">
        Your username
      </h2>

      <p className="mt-1 text-sm text-slate-600">
        This is the name other people see on the places you add. Your email
        stays private.
      </p>

      <label className="mt-3 block">
        <span className="mb-1.5 block text-sm font-semibold text-slate-700">
          Username
        </span>

        <div className="flex items-center gap-2">
          <span className="text-lg font-semibold text-slate-400">@</span>

          <input
            value={value}
            disabled={alreadyChanged}
            onChange={(event) => {
              const next = tidy(event.target.value);
              setValue(next);
              setMessage(null);
              checkAvailability(next);
            }}
            autoComplete="off"
            spellCheck={false}
            className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-base outline-none focus:border-slate-500 disabled:bg-slate-100 disabled:text-slate-500"
          />
        </div>

        {hint && (
          <span
            className={`mt-1 block text-xs ${
              status === "taken" || !shapeOk
                ? "text-rose-600"
                : status === "free"
                  ? "text-emerald-700"
                  : "text-slate-500"
            }`}
          >
            {hint}
          </span>
        )}
      </label>

      {alreadyChanged ? (
        <p className="mt-3 rounded-xl bg-slate-100 p-3 text-xs text-slate-600">
          A username can only be changed once, and yours has been. Write to us
          if there is a problem with it.
        </p>
      ) : (
        <p className="mt-3 rounded-xl bg-amber-50 p-3 text-xs text-amber-900">
          Choose carefully — you can only change this once.
        </p>
      )}

      {message && (
        <p className="mt-2 text-sm font-semibold text-slate-700">{message}</p>
      )}

      <Button
        onClick={save}
        disabled={alreadyChanged || unchanged || !shapeOk || saving}
        className="mt-3 w-full"
      >
        {saving ? "Saving…" : alreadyChanged ? "Locked" : "Save username"}
      </Button>
    </Card>
  );
}

export default UsernameForm;
