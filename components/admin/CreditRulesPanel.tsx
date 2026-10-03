"use client";

import { useState, useTransition } from "react";

import { Card } from "@/components/ui";

import { saveCreditRule } from "@/app/actions/admin";

/*
 * One row per action, edited in place. The values live in the database
 * on purpose — the README promises that nothing about rewards is
 * hard-coded, and this is the screen that makes good on it.
 *
 * `active` off does not delete the rule: awarding simply skips it, so
 * turning it back on restores the old numbers.
 */

export interface CreditRuleRow {
  action_key: string;
  credits: number;
  daily_cap: number | null;
  description: string | null;
  active: boolean;
}

const FIELD =
  "w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-base outline-none focus:border-slate-500";

function RuleRow({ rule }: { rule: CreditRuleRow }) {
  const [credits, setCredits] = useState(String(rule.credits));
  const [cap, setCap] = useState(
    rule.daily_cap == null ? "" : String(rule.daily_cap)
  );
  const [active, setActive] = useState(rule.active);

  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  function save() {
    setError("");
    setSaved(false);

    const formData = new FormData();
    formData.set("action_key", rule.action_key);
    formData.set("credits", credits);
    formData.set("daily_cap", cap);
    formData.set("active", String(active));

    startTransition(async () => {
      try {
        await saveCreditRule(formData);
        setSaved(true);
      } catch (err) {
        setError(
          err instanceof Error && err.message
            ? err.message
            : "Could not save that rule."
        );
      }
    });
  }

  return (
    <Card padding="sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-semibold text-slate-900">
            {rule.description ?? rule.action_key}
          </p>

          <p className="mt-0.5 text-xs text-slate-400">{rule.action_key}</p>
        </div>

        <button
          type="button"
          onClick={() => {
            setSaved(false);
            setActive(!active);
          }}
          aria-pressed={active}
          className={`shrink-0 rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wide transition ${
            active
              ? "bg-emerald-100 text-emerald-800"
              : "bg-slate-200 text-slate-500"
          }`}
        >
          {active ? "Active" : "Off"}
        </button>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-slate-600">
            Credits
          </span>

          <input
            type="number"
            value={credits}
            onChange={(event) => {
              setSaved(false);
              setCredits(event.target.value);
            }}
            className={FIELD}
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-slate-600">
            Daily cap <span className="font-normal text-slate-400">(blank = none)</span>
          </span>

          <input
            type="number"
            value={cap}
            onChange={(event) => {
              setSaved(false);
              setCap(event.target.value);
            }}
            className={FIELD}
          />
        </label>
      </div>

      {error && (
        <p className="mt-2 text-xs font-medium text-rose-700">{error}</p>
      )}

      <div className="mt-3 flex items-center gap-3">
        <button
          type="button"
          onClick={save}
          disabled={pending}
          className="min-h-10 flex-1 rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-50"
        >
          {pending ? "Saving…" : "Save"}
        </button>

        {saved && (
          <span className="text-xs font-semibold text-emerald-700">Saved ✓</span>
        )}
      </div>
    </Card>
  );
}

export function CreditRulesPanel({ rules }: { rules: CreditRuleRow[] }) {
  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-600">
        What each contribution is worth. These numbers come from the database,
        not from the code — changing one takes effect on the next award.
      </p>

      {rules.map((rule) => (
        <RuleRow key={rule.action_key} rule={rule} />
      ))}
    </div>
  );
}

export default CreditRulesPanel;
