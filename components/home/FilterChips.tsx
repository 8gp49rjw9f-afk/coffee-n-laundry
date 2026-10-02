"use client";

import type { MapFilters, PlaceType } from "@/lib/types";

/*
 * Three buttons, nothing else. Everything that used to sit here —
 * Wi-Fi, power, payment, open now — was noise once there were twenty
 * places: it hid the map for a filter almost nobody used.
 */

export function FilterChips({
  filters,
  onChange,
}: {
  filters: MapFilters;
  onChange: (next: MapFilters) => void;
}) {
  function setType(type: MapFilters["type"]) {
    onChange({ ...filters, type });
  }

  return (
    <div className="flex gap-2">
      <TypeChip
        label="All"
        active={filters.type === "all"}
        onClick={() => setType("all")}
      />

      <TypeChip
        label="☕ Barista"
        active={filters.type === "coffee"}
        onClick={() => setType("coffee")}
        tone="coffee"
      />

      <TypeChip
        label="🧺 Laundry"
        active={filters.type === "laundry"}
        onClick={() => setType("laundry")}
        tone="laundry"
      />
    </div>
  );
}

function TypeChip({
  label,
  active,
  onClick,
  tone = "neutral",
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  tone?: "neutral" | PlaceType;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`min-h-11 flex-1 rounded-xl px-4 text-sm font-bold transition ${
        active
          ? tone === "coffee"
            ? "bg-[#6f4e37] text-white shadow"
            : tone === "laundry"
              ? "bg-sky-600 text-white shadow"
              : "bg-slate-900 text-white shadow"
          : "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
      }`}
    >
      {label}
    </button>
  );
}
