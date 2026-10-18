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

  /* “last verified” is the same instant the freshness badge counts
     from — place.last_verified_at. Spelled out as a date here because
     the reader wants to know WHICH DAY, not how many days ago. Read
     in UTC to match the freshness computation: a date read in one
     zone and counted in another disagrees by a day at the edges. */
  const lastVerified = place.last_verified_at
    ? new Date(place.last_verified_at).toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
        timeZone: "UTC",
      })
    : null;

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

          {/* VERIFY — moved here from the right-hand column, between
              the city and “Added by”, because it is something you do
              to the place rather than a badge earned by it: it reads
              with the facts above it and leaves the right-hand column
              for what only an admin sees.

              The label is “Verify”, not “Still open”: the button and
              the per-field ticks write the same thing, the same date.

              The date in brackets is a parenthetical detail of the
              button, so it sits beside it and wraps with it. */}
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <StillOpenButton
              placeId={place.id}
              signedIn={signedIn}
              alreadyThisWeek={confirmedThisWeek}
            />

            {lastVerified && (
              <span className="text-[11px] leading-tight text-slate-400">
                ( last verified: {lastVerified} )
              </span>
            )}
          </div>

          {/* Who put this on the map. Shown as a username, never as an
              email — the address is personal data and this line is
              public. */}
          {creatorName && (
            <p className="mt-0.5 text-sm text-slate-500">
              Added by @{creatorName}
            </p>
          )}
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
