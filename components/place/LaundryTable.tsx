"use client";

import { useState, useTransition } from "react";

import { Card } from "@/components/ui";

import type { PriceHistoryRow } from "@/lib/database/places";

export interface FieldCheck {
  field_key: string;
  verified_at: string;
  value_snapshot: string | null;
  verified_by_name: string;
}

export interface LaundryFacts {
  prices: { kind: string; amount: number; currency: string }[];
  detergent_included: boolean | null;
  detergent_purchasable: boolean | null;
  machine_sizes: string[];
  open_24h: boolean | null;
  wash_minutes: number | null;
  dryer_minutes: number | null;
  last_entry_minutes: number | null;
  has_wifi: boolean | null;
  has_power: boolean | null;
  has_parking: boolean | null;
  has_toilets: boolean | null;
  has_seating: boolean | null;
}

function price(p: LaundryFacts, kind: string) {
  const row = p.prices.find((x) => x.kind === kind);

  return row ? `${row.amount} ${row.currency.toUpperCase()}` : null;
}

function yesNo(value: boolean | null) {
  return value == null ? null : value ? "yes" : "no";
}

/* Minutes from midnight → "22:00". Built by hand: toLocaleTimeString
   differs between server and browser. */
function clockTime(minutes: number | null) {
  if (minutes == null) return null;

  const h = Math.floor(minutes / 60);
  const m = minutes % 60;

  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function duration(minutes: number | null) {
  return minutes == null ? null : `~${minutes} min`;
}

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

function formatDate(iso: string) {
  const d = new Date(iso);

  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
}

const ROWS: {
  key: string;
  label: string;
  emoji: string;
  fallback: (place: LaundryFacts) => string | null;
}[] = [
  { key: "wash_price", label: "Wash", emoji: "🧺", fallback: (p) => price(p, "wash") },
  {
    key: "wash_minutes",
    label: "Wash takes",
    emoji: "⏱️",
    fallback: (p) => duration(p.wash_minutes),
  },
  { key: "dryer_price", label: "Dryer", emoji: "🔥", fallback: (p) => price(p, "dryer") },
  {
    key: "dryer_minutes",
    label: "Dryer takes",
    emoji: "⏳",
    fallback: (p) => duration(p.dryer_minutes),
  },
  {
    key: "detergent",
    label: "Detergent",
    emoji: "🧼",
    fallback: (p) =>
      p.detergent_included == null
        ? null
        : p.detergent_included
          ? "included"
          : "not included",
  },
  {
    key: "detergent_purchase",
    label: "Buy detergent",
    emoji: "🛒",
    fallback: (p) =>
      p.detergent_purchasable == null
        ? null
        : p.detergent_purchasable
          ? "yes"
          : "no",
  },
  {
    key: "machines",
    label: "Machines",
    emoji: "📏",
    fallback: (p) =>
      p.machine_sizes.length > 0 ? p.machine_sizes.join(", ") : null,
  },
  {
    key: "open_24h",
    label: "Open 24 hours",
    emoji: "🕛",
    fallback: (p) => (p.open_24h ? "yes" : null),
  },
  {
    key: "last_entry",
    label: "Last entry",
    emoji: "🔒",
    fallback: (p) => (p.open_24h ? null : clockTime(p.last_entry_minutes)),
  },
  {
    key: "amenities",
    label: "Others",
    emoji: "•",
    fallback: (p) => {
      /* Icons only, and only the ones that are there. */
      const icons: string[] = [];

      if (p.has_wifi) icons.push("📶");
      if (p.has_power) icons.push("🔌");
      if (p.has_seating) icons.push("🪑");
      if (p.has_parking) icons.push("🅿️");
      if (p.has_toilets) icons.push("🚻");

      return icons.length > 0 ? icons.join("  ") : null;
    },
  },
];

export function LaundryTable({
  placeId,
  facts,
  checks,
  priceHistory = [],
  verify,
  doneThisWeek = [],
}: {
  placeId: string;
  facts: LaundryFacts;
  checks: FieldCheck[];
  priceHistory?: PriceHistoryRow[];
  verify: (placeId: string, fieldKey: string) => Promise<void>;
  doneThisWeek?: string[];
}) {
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const byField = new Map(checks.map((c) => [c.field_key, c]));
  const historyFor = (key: string) =>
    priceHistory.find((h) => h.field_key === key) ?? null;

  function stamp(fieldKey: string) {
    setPendingKey(fieldKey);
    setErrorKey(null);

    startTransition(async () => {
      try {
        await verify(placeId, fieldKey);
      } catch {
        setErrorKey(fieldKey);
      } finally {
        setPendingKey(null);
      }
    });
  }

  return (
    <Card padding="none">
      <div className="grid grid-cols-12 items-center gap-3 border-b border-slate-200 px-4 py-2 text-[10px] font-bold uppercase tracking-wide text-slate-400">
        <span className="col-span-5">Item</span>
        <span className="col-span-4">Value</span>
        <span className="col-span-3 text-right">Checked</span>
      </div>

      <ul className="divide-y divide-slate-100">
        {ROWS.map((row) => {
          const check = byField.get(row.key);
          const value = check?.value_snapshot ?? row.fallback(facts);
          const already = doneThisWeek.includes(row.key);
          const history = historyFor(row.key);

          if (!value && !check) return null;

          return (
            <li
              key={row.key}
              className="grid grid-cols-12 items-center gap-3 px-4 py-2.5"
            >
              <span className="col-span-5 flex min-w-0 items-center gap-2 text-sm font-semibold text-slate-900">
                <span className="text-base">{row.emoji}</span>
                <span className="truncate">{row.label}</span>
              </span>

              <span className="col-span-4 min-w-0">
                <span className="block truncate text-sm font-bold text-slate-900">
                  {value ?? "—"}
                </span>

                {history?.old_value && history.old_value !== value && (
                  <span className="block truncate text-[10px] leading-tight text-amber-700">
                    was {history.old_value}
                  </span>
                )}
              </span>

              <span className="col-span-3 flex flex-col items-end">
                <button
                  type="button"
                  onClick={() => stamp(row.key)}
                  disabled={pendingKey === row.key || already}
                  className={`rounded-md border px-2 py-0.5 text-[11px] font-semibold transition disabled:opacity-60 ${
                    already
                      ? "border-slate-200 bg-slate-50 text-slate-400"
                      : check
                        ? "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                        : "border-slate-300 bg-white text-slate-500 hover:bg-slate-50"
                  }`}
                >
                  {pendingKey === row.key
                    ? "…"
                    : already
                      ? "This week ✓"
                      : "Verify"}
                </button>

                <span className="mt-0.5 text-right text-[9px] leading-tight text-slate-400">
                  {errorKey === row.key
                    ? "failed"
                    : check
                      ? `${formatDate(check.verified_at)} · ${check.verified_by_name}`
                      : "never"}
                </span>
              </span>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
