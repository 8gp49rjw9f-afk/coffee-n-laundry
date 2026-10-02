import Link from "next/link";

import { Card, Badge } from "@/components/ui";
import { StillOpenButton } from "@/components/place/StillOpenButton";

import type { PlaceWithFreshness } from "@/lib/types";
import type { Freshness } from "@/lib/services/freshness";

export function PlaceHeader({
  place,
  freshness,
  signedIn,
  confirmedThisWeek,
}: {
  place: PlaceWithFreshness;
  freshness: Freshness;
  signedIn: boolean;
  confirmedThisWeek: boolean;
}) {
  const isCoffee = place.place_type === "coffee";

  const where =
    [place.address, place.city, place.country].filter(Boolean).join(" · ") ||
    `${place.latitude.toFixed(4)}, ${place.longitude.toFixed(4)}`;

  return (
    <Card>
      <Link
        href="/"
        className="text-sm font-semibold text-slate-500 hover:text-slate-900"
      >
        ← Back to the map
      </Link>

      <div className="mt-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold leading-tight text-slate-900 sm:text-3xl">
            {place.name}
          </h1>

          <p
            className={`mt-1 text-base font-semibold ${
              isCoffee ? "text-[#6f4e37]" : "text-sky-700"
            }`}
          >
            {isCoffee ? "☕ Coffee" : "🧺 Laundromat"}
          </p>

          <p className="mt-1 text-sm text-slate-600">📍 {where}</p>
        </div>

        <div className="flex shrink-0 flex-col items-end gap-1.5">
          <Badge className={freshness.className}>
            {freshness.emoji} {freshness.label}
          </Badge>

          <StillOpenButton
            placeId={place.id}
            signedIn={signedIn}
            alreadyThisWeek={confirmedThisWeek}
          />

          {place.confirmations_count > 0 && (
            <span className="text-[10px] leading-tight text-slate-400">
              👍 {place.confirmations_count} confirmed
            </span>
          )}
        </div>
      </div>
    </Card>
  );
}
