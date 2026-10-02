/* ====================================================== */
/* FILTERING — one place so the chips and the map agree     */
/* ====================================================== */

import type { MapFilters, PlaceWithFreshness } from "@/lib/types";

export function applyFilters(
  places: PlaceWithFreshness[],
  filters: MapFilters
): PlaceWithFreshness[] {
  return places.filter((place) => {
    if (filters.type !== "all" && place.place_type !== filters.type) {
      return false;
    }

    if (filters.wifi && !place.has_wifi) return false;
    if (filters.power && !place.has_power) return false;
    if (filters.parking && !place.has_parking) return false;

    if (filters.openNow && !isOpenNow(place.opening_hours)) return false;

    if (filters.type !== "laundry" && filters.coffeeKind !== "any") {
      const kind = place.coffee?.coffee_kind;

      if (!kind) return false;

      /* "both" is a superset, not a third category: it satisfies
         a barista filter and a regular filter alike. */
      if (filters.coffeeKind === "barista" && kind === "regular") return false;
      if (filters.coffeeKind === "regular" && kind === "barista") return false;
    }

    if (filters.payments.length > 0) {
      const accepted = place.accepted_payments ?? [];

      if (!filters.payments.some((p) => accepted.includes(p))) return false;
    }

    return true;
  });
}

/* ====================================================== */
/* OPEN NOW                                                */
/* opening_hours shape:                                    */
/* { mon: [[480, 1080]], tue: ..., sun: null }             */
/* Minutes from midnight, so any locale can be represented. */
/* ====================================================== */

const WEEKDAYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;

type HoursShape = Record<string, [number, number][] | null> | null;

export function isOpenNow(
  openingHours: unknown,
  now: Date = new Date()
): boolean {
  if (!openingHours || typeof openingHours !== "object") return false;

  const hours = openingHours as HoursShape;

  if (!hours) return false;

  const windows = hours[WEEKDAYS[now.getDay()]];

  if (!windows || windows.length === 0) return false;

  const minutes = now.getHours() * 60 + now.getMinutes();

  return windows.some(([open, close]) => {
    /* Windows crossing midnight, e.g. [1200, 120] */
    if (close <= open) return minutes >= open || minutes <= close;

    return minutes >= open && minutes <= close;
  });
}
