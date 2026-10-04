"use client";

import { useState, useTransition } from "react";

import { Card } from "@/components/ui";

import { FOOD_EMOJI, FOOD_LABEL } from "@/lib/coffee";

import type { PriceHistoryRow } from "@/lib/database/places";

export interface FieldCheck {
  field_key: string;
  verified_at: string;
  value_snapshot: string | null;
  verified_by_name: string;
}

export interface CoffeeFacts {
  prices: { kind: string; amount: number; currency: string }[];
  coffee_kind: string | null;
  roaster: string | null;
  sells_beans: boolean | null;
  has_roaster: boolean | null;
  has_decaf: boolean | null;
  has_oat_milk: boolean | null;
  has_soy_milk: boolean | null;
  has_coconut_milk: boolean | null;
  has_almond_milk: boolean | null;
  ambience: string[];
  food: string[];
  laptop_friendly: boolean | null;
  has_wifi: boolean | null;
  has_power: boolean | null;
  has_parking: boolean | null;
  has_seating: boolean | null;
  has_toilets: boolean | null;
}

function price(p: CoffeeFacts, kind: string) {
  const row = p.prices.find((x) => x.kind === kind);

  return row ? `${row.amount} ${row.currency.toUpperCase()}` : null;
}

function yesNo(value: boolean | null) {
  return value == null ? null : value ? "yes" : "no";
}

/* Dates are formatted by hand in UTC — toLocaleDateString differs
   between the server and the browser and breaks hydration. */

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
  fallback: (place: CoffeeFacts) => string | null;
}[] = [
  {
    key: "coffee_kind",
    label: "Coffee type",
    emoji: "☕",
    fallback: (p) =>
      p.coffee_kind === "barista"
        ? "Specialty / Barista"
        : p.coffee_kind === "both"
          ? "Both"
          : p.coffee_kind === "regular"
            ? "Regular"
            : null,
  },
  {
    key: "espresso_price",
    label: "Espresso",
    emoji: "💰",
    fallback: (p) => price(p, "espresso"),
  },
  {
    key: "filter_price",
    label: "Filter coffee",
    emoji: "🫖",
    fallback: (p) => price(p, "filter"),
  },
  {
    key: "flat_white_price",
    label: "Flat white",
    emoji: "🥛",
    fallback: (p) => price(p, "flat_white"),
  },
  {
    key: "food",
    label: "Food",
    emoji: "🍽️",
    fallback: (p) =>
      p.food && p.food.length > 0
        ? p.food
            .map((f) => `${FOOD_EMOJI[f] ?? ""} ${FOOD_LABEL[f] ?? f}`.trim())
            .join(", ")
        : null,
  },
  {
    key: "beans",
    label: "Beans for sale",
    emoji: "🫘",
    fallback: (p) => yesNo(p.sells_beans),
  },
  {
    key: "roaster_available",
    label: "Has a roaster",
    emoji: "🔥",
    fallback: (p) =>
      p.has_roaster == null
        ? p.roaster
        : p.has_roaster
          ? p.roaster
            ? `yes · ${p.roaster}`
            : "yes"
          : "no",
  },
  {
    key: "ambience",
    label: "Ambience",
    emoji: "🪑",
    fallback: (p) =>
      p.ambience && p.ambience.length > 0
        ? p.ambience
            .map((a) => `${AMBIENCE_EMOJI[a] ?? ""} ${AMBIENCE_LABEL[a] ?? a}`)
            .join(", ")
        : null,
  },
  {
    key: "decaf",
    label: "Decaf",
    emoji: "🌙",
    fallback: (p) => yesNo(p.has_decaf),
  },
  {
    key: "milk",
    label: "Milk / PBM",
    emoji: "🥛",
    fallback: (p) => {
      /* One line for all the plant milks: four separate rows pushed
         the useful facts below the fold. */
      const found: string[] = [];

      if (p.has_oat_milk) found.push("Oat");
      if (p.has_soy_milk) found.push("Soy");
      if (p.has_coconut_milk) found.push("Coconut");
      if (p.has_almond_milk) found.push("Almond");

      return found.length > 0 ? found.join(", ") : null;
    },
  },
  {
    key: "laptop",
    label: "Laptop-friendly",
    emoji: "💻",
    fallback: (p) => yesNo(p.laptop_friendly),
  },
  {
    key: "amenities",
    label: "Others",
    emoji: "•",
    fallback: (p) => {
      /* Icons only, and only the ones that are there. An amenity that
         does not exist is not worth a line. */
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

export function CoffeeTable({
  placeId,
  facts,
  checks,
  priceHistory = [],
  verify,
  doneThisWeek = [],
}: {
  placeId: string;
  facts: CoffeeFacts;
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
