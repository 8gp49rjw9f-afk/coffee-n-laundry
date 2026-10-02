import { Card } from "@/components/ui";

import { paymentEmoji, paymentLabel } from "@/lib/format";

import type { Place } from "@/lib/types";

/* Missing values are shown as missing, not hidden: an absent
   fact is itself useful information. */

export function FactsList({ place }: { place: Place }) {
  const isCoffee = place.place_type === "coffee";

  const rows: { label: string; value: string }[] = [];

  if (place.website) rows.push({ label: "🔗 Website", value: place.website });
  if (place.phone) rows.push({ label: "📞 Phone", value: place.phone });

  if (isCoffee) {
    rows.push({
      label: "☕ Coffee type",
      value:
        place.coffee?.coffee_kind === "barista"
          ? "Barista"
          : place.coffee?.coffee_kind === "both"
            ? "Barista and regular"
            : place.coffee?.coffee_kind === "regular"
              ? "Regular"
              : "Not recorded",
    });

    if (place.coffee?.roaster) {
      rows.push({ label: "🔥 Roaster", value: place.coffee.roaster });
    }
  }

  if (!isCoffee) {
    const laundry = place.laundry;

    rows.push({
      label: "🧼 Detergent",
      value:
        laundry?.detergent_included == null
          ? "Not recorded"
          : laundry.detergent_included
            ? "Included in the price"
            : "Not included",
    });

    rows.push({
      label: "🛒 Buy detergent there",
      value:
        laundry?.detergent_purchasable == null
          ? "Not recorded"
          : laundry.detergent_purchasable
            ? "Yes"
            : "No",
    });

    rows.push({
      label: "📏 Machines",
      value:
        laundry?.machine_sizes && laundry.machine_sizes.length > 0
          ? laundry.machine_sizes.join(", ")
          : "Not recorded",
    });

    rows.push({
      label: "🧑‍🔧 Attended",
      value:
        laundry?.attended == null
          ? "Not recorded"
          : laundry.attended
            ? "Attended"
            : "Self-service",
    });

    rows.push({
      label: "🌬️ Drying",
      value: laundry?.drying_available
        ? {
            dryer: "Dryers",
            line: "Line dry",
            both: "Dryers and line",
            none: "No drying",
          }[laundry.drying_available]
        : "Not recorded",
    });
  }

  rows.push({
    label: "💳 Payment",
    value:
      (place.accepted_payments ?? []).length > 0
        ? place.accepted_payments
            .map((key) => `${paymentEmoji(key)} ${paymentLabel(key)}`)
            .join(", ")
        : "Not recorded",
  });

  const amenities: string[] = [];

  amenities.push(place.has_wifi ? "📶 Wi-Fi" : "📶 No Wi-Fi");
  amenities.push(place.has_power ? "🔌 Power" : "🔌 No power");
  amenities.push(place.has_parking ? "🅿️ Parking" : "🅿️ No parking");

  amenities.push(
    isCoffee
      ? place.has_seating
        ? "🪑 Seating"
        : "🪑 No seating"
      : place.has_toilets
        ? "🚻 Toilets"
        : "🚻 No toilets"
  );

  return (
    <Card>
      <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-500">
        The practical bits
      </h2>

      <dl className="divide-y divide-slate-100">
        {rows.map((row) => (
          <div
            key={row.label}
            className="flex items-start justify-between gap-4 py-2.5"
          >
            <dt className="shrink-0 text-sm font-semibold text-slate-500">
              {row.label}
            </dt>

            <dd className="min-w-0 break-words text-right text-sm font-semibold text-slate-900">
              {row.value}
            </dd>
          </div>
        ))}
      </dl>

      <div className="mt-4 flex flex-wrap gap-1.5">
        {amenities.map((item) => (
          <span
            key={item}
            className="rounded-lg bg-slate-100 px-2.5 py-1 text-sm font-semibold text-slate-700"
          >
            {item}
          </span>
        ))}
      </div>

      {!place.opening_hours && (
        <p className="mt-4 text-xs text-slate-500">
          Opening hours are not recorded yet.
        </p>
      )}
    </Card>
  );
}
