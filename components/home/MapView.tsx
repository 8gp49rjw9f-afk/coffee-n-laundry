"use client";

import { useMemo, useState } from "react";

import WorldMap from "@/components/maps/WorldMap";
import { FilterChips } from "@/components/home/FilterChips";
import { PlacePanel } from "@/components/map/PlacePanel";

import { applyFilters } from "@/lib/filters";
import { distanceKm, formatDistance } from "@/lib/services/distance";

import type { PlaceWithFreshness, MapFilters } from "@/lib/types";

/*
 * Filtering happens entirely on the client so a chip tap never costs a
 * server round-trip. `today` is a timestamp from the server: the
 * "verified N days ago" line must not be computed with Date.now(),
 * or the server and browser disagree and React rebuilds the tree.
 */

export default function MapView({
  places,
  bucketUrl,
  today,
  showFilters = true,
}: {
  places: PlaceWithFreshness[];
  bucketUrl: string;
  today: number;
  showFilters?: boolean;
}) {
  const [filters, setFilters] = useState<MapFilters>({
    type: "all",
    openNow: false,
    wifi: false,
    power: false,
    parking: false,
    coffeeKind: "any",
    payments: [],
  });

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [nearMe, setNearMe] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState("");

  /*
   * Every press of "Where am I?" should fly, even when the position
   * has not changed since the last one. A counter is what makes that
   * a new event: the coordinates alone would be an unchanged prop and
   * the map would sit still the second time.
   */
  const [flyRequest, setFlyRequest] = useState(0);

  const withDistance = useMemo(() => {
    if (!nearMe) return places;

    return places.map((place) => ({
      ...place,
      distance_km: distanceKm(
        nearMe.latitude,
        nearMe.longitude,
        place.latitude,
        place.longitude
      ),
    }));
  }, [places, nearMe]);

  const visible = useMemo(
    () => applyFilters(withDistance, filters),
    [withDistance, filters]
  );

  const selected = useMemo(
    () => visible.find((p) => p.id === selectedId) ?? null,
    [visible, selectedId]
  );

  /*
   * One geolocation call, two callers. "Near me" under the map wants
   * the distance list as well; the button on the map wants only to
   * move. Sharing the lookup keeps the permission prompt to one, and
   * a refusal is worth showing — a person who taps no is left
   * wondering why nothing moved.
   */
  function locate(thenFly: boolean) {
    if (!navigator.geolocation) {
      setLocationError("This device cannot give us a position.");
      return;
    }

    setLocating(true);
    setLocationError("");

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setNearMe({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
        setLocating(false);

        if (thenFly) setFlyRequest((current) => current + 1);
      },
      () => {
        setLocating(false);
        setLocationError(
          "Could not get your position. Check the browser's permission for this site."
        );
      },
      { enableHighAccuracy: true, timeout: 10_000 }
    );
  }

  return (
    <div className="space-y-3">
      {showFilters && (
        <FilterChips filters={filters} onChange={setFilters} />
      )}

      <WorldMap
        places={visible}
        selectedId={selectedId}
        me={nearMe}
        request={flyRequest}
        locating={locating}
        onWhereAmI={() => locate(true)}
        onSelect={setSelectedId}
        panel={
          selected ? (
            <PlacePanel
              place={selected}
              bucketUrl={bucketUrl}
              today={today}
              distanceLabel={
                selected.distance_km != null
                  ? formatDistance(selected.distance_km)
                  : null
              }
              onClose={() => setSelectedId(null)}
            />
          ) : null
        }
      />

      {/* "Near me" sits directly under the map: it belongs to what you
          do with the map, not to the filters above it. It sorts the
          list by distance; the map's own button just moves. */}

      <div className="flex flex-col items-center gap-2 sm:flex-row sm:justify-center">
        <button
          type="button"
          onClick={nearMe ? () => setNearMe(null) : () => locate(false)}
          className={`flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border px-5 font-semibold transition sm:w-auto ${
            nearMe
              ? "border-slate-900 bg-slate-900 text-white"
              : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
          }`}
        >
          {locating
            ? "Locating…"
            : nearMe
              ? "📍 Near me ✓ — tap to clear"
              : "📍 Near me"}
        </button>
      </div>

      {locationError && (
        <p className="text-center text-sm font-medium text-rose-700">
          {locationError}
        </p>
      )}

      <p className="text-center text-sm text-slate-500">
        {visible.length} {visible.length === 1 ? "place" : "places"} shown
      </p>

      {nearMe && (
        <NearestList
          places={withDistance}
          filters={filters}
          onSelect={setSelectedId}
        />
      )}
    </div>
  );
}

function NearestList({
  places,
  filters,
  onSelect,
}: {
  places: PlaceWithFreshness[];
  filters: MapFilters;
  onSelect: (id: string) => void;
}) {
  const sorted = useMemo(
    () =>
      applyFilters(places, filters)
        .slice()
        .sort((a, b) => (a.distance_km ?? 0) - (b.distance_km ?? 0))
        .slice(0, 12),
    [places, filters]
  );

  if (sorted.length === 0) return null;

  return (
    <ul className="space-y-2 pb-6">
      {sorted.map((place) => (
        <li key={place.id}>
          <button
            onClick={() => onSelect(place.id)}
            className="flex w-full items-center gap-3 rounded-xl bg-white px-4 py-3 text-left shadow-sm transition hover:bg-slate-50"
          >
            <span className="text-2xl">
              {place.place_type === "coffee" ? "☕" : "🧺"}
            </span>

            <span className="min-w-0 flex-1">
              <span className="block truncate font-semibold text-slate-900">
                {place.name}
              </span>

              <span className="block truncate text-sm text-slate-500">
                {place.city ?? place.address ?? "Unknown location"}
              </span>
            </span>

            {place.distance_km != null && (
              <span className="shrink-0 text-sm font-semibold text-slate-500">
                {formatDistance(place.distance_km)}
              </span>
            )}
          </button>
        </li>
      ))}
    </ul>
  );
}
