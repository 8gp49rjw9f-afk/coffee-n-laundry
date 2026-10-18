import Link from "next/link";

import { Card, Badge } from "@/components/ui";
import { StillOpenButton } from "@/components/place/StillOpenButton";
import { DeletePlaceButton } from "@/components/place/DeletePlaceButton";

import type { PlaceWithFreshness } from "@/lib/types";
import type { Freshness } from "@/lib/services/freshness";

export function PlaceHeader({
  place,
  freshness,
  signedIn,
  confirmedThisWeek,
  creatorName,
  canDelete = false,
}: {
  place: PlaceWithFreshness;
  freshness: Freshness;
  signedIn: boolean;
  confirmedThisWeek: boolean;
  creatorName?: string | null;
  /* Set by the page when the signed-in person is an admin. The button
     is only the affordance — deletePlace checks the same thing again
     on the server, where a forged request cannot get past it. */
  canDelete?: boolean;
}) {
  const isCoffee = place.place_type === "coffee";

  const where =
    [place.address, place.city, place.country].filter(Boolean).join(" · ") ||
    `${place.latitude.toFixed(4)}, ${place.longitude.toFixed(4)}`;

  const freshnessLabel = "text-sm font-semibold text-slate-700";
  const freshnessValue = "mt-1 text-sm text-slate-500";
  const lastCheck = place.confirmations_count > 0 ? "this week" : "never";

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

          {/* Who put this on the map. Shown as a username, never as an
              email — the address is personal data and this line is
              public. */}
          {creatorName && (
            <p className="mt-0.5 text-sm text-slate-500">
              Added by @{creatorName}
            </p>
          )}

          {/* VERIFY — its own row under “Added by”, and a step larger
              than the rest of the identity lines.

              It was moved up between the city and “Added by” first,
              and that was too tight for the most-used control on the
              page: it sat inside the block of things you READ, when
              what it is is the one thing you DO here. On its own
              line, at text-base, it reads as a button.

              It stays on the left, with Delete alone on the right,
              because deleting belongs to an admin and this belongs
              to whoever is standing outside the place.

              The old “Still open” label lives in StillOpenButton.tsx
              and has not been renamed yet. */}
          <StillOpenButton
            placeId={place.id}
            signedIn={signedIn}
            alreadyThisWeek={confirmedThisWeek}
            size="lg"
            className="mt-3"
          />

          {/* FRESHNESS — the badge that used to sit at the top of the
              right-hand column, as two plain lines under the button.
              Same data, same computation (getFreshness), same colour
              coding as the badge had, so nothing was lost when the
              badge went: only the shape changed, from a pill to text.
              The tier is spelled out for anyone who cannot see the
              colour. */}
          <div className="mt-3">
            <p className={freshnessLabel}>Freshness</p>

            <p className={freshnessValue}>
              {freshness.emoji} {freshness.label} · {freshness.tier}
            </p>

            <p className={freshnessValue}>Last check : {lastCheck}</p>
          </div>
        </div>

        {/* The right-hand column is down to the one thing that belongs
            to nobody but an admin. */}
        <div className="flex shrink-0 flex-col items-end gap-1.5">
          {canDelete && (
            <DeletePlaceButton placeId={place.id} placeName={place.name} />
          )}
        </div>
      </div>
    </Card>
  );
}
