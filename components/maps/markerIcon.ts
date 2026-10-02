import L from "leaflet";

import { getFreshness } from "@/lib/services/freshness";

import type { PlaceWithFreshness } from "@/lib/types";

/*
 * Visually distinct markers per type. A stale or never-verified
 * place gets a dimmed, dashed pin so old data reads as old.
 */

export function markerIcon(place: PlaceWithFreshness) {
  const freshness = getFreshness(place.last_verified_at);

  const emoji = place.place_type === "coffee" ? "☕" : "🧺";
  const tone =
    place.place_type === "coffee" ? "cnl-pin-coffee" : "cnl-pin-laundry";

  const stale = freshness.tier === "stale" || freshness.tier === "unknown";

  return L.divIcon({
    className: "cnl-marker",
    html: `<div class="cnl-pin ${tone}${stale ? " cnl-pin-stale" : ""}">${emoji}</div>`,
    iconSize: [38, 38],
    iconAnchor: [19, 19],
  });
}
