"use client";

import { useMemo, useState } from "react";

import { Button, ErrorBanner } from "@/components/ui";
import LocationMapPicker from "@/components/location/LocationMapPickerLoader";

import { searchAddress, type GeocodeHit } from "@/lib/services/geocoding";

/* Three ways in: my position, a search, or a pin placed by hand. */

export function LocationPicker({
  onPicked,
}: {
  onPicked: (latitude: number, longitude: number) => void;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [resolved, setResolved] = useState<string | null>(null);
  const [chosen, setChosen] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);

  const [mapOpen, setMapOpen] = useState(false);

  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<GeocodeHit[]>([]);
  const [searching, setSearching] = useState(false);

  const canSearch = useMemo(() => query.trim().length >= 3, [query]);

  function detect() {
    setError("");

    if (!navigator.geolocation) {
      setError("This device cannot give us a position.");
      return;
    }

    setLoading(true);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;

        onPicked(latitude, longitude);
        setChosen({ latitude, longitude });
        setResolved(`${latitude.toFixed(4)}, ${longitude.toFixed(4)}`);
        setLoading(false);
      },
      () => {
        setLoading(false);
        setError("Could not get your position. Place a pin instead.");
      },
      { enableHighAccuracy: true, timeout: 10_000 }
    );
  }

  async function runSearch() {
    setSearching(true);
    setError("");

    const results = await searchAddress(query);

    setHits(results);
    setSearching(false);

    if (results.length === 0) {
      setError(
        "Nothing found. If the address does not exist in this country yet, place a pin instead."
      );
    }
  }

  return (
    <div className="space-y-3">
      <Button onClick={detect} disabled={loading} className="w-full">
        {loading ? "Locating…" : "📍 Use my current position"}
      </Button>

      <button
        type="button"
        onClick={() => setMapOpen(true)}
        className="flex min-h-11 w-full items-center justify-center rounded-xl border border-slate-300 bg-white px-5 font-semibold text-slate-800 transition hover:bg-slate-50"
      >
        📌 Place a pin on the map
      </button>

      {resolved && (
        <p className="rounded-xl bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">
          ✅ {resolved}
        </p>
      )}

      <div className="rounded-xl border border-slate-200 p-4">
        <label className="mb-2 block text-sm font-semibold text-slate-700">
          Or search for the address
        </label>

        <div className="flex gap-2">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                runSearch();
              }
            }}
            placeholder="Street, city or postcode"
            className="min-w-0 flex-1 rounded-xl border border-slate-300 px-4 py-3 text-base outline-none focus:border-slate-500"
          />

          <Button onClick={runSearch} disabled={searching || !canSearch}>
            {searching ? "…" : "Search"}
          </Button>
        </div>

        {hits.length > 0 && (
          <ul className="mt-3 divide-y divide-slate-100">
            {hits.map((hit) => (
              <li key={`${hit.latitude},${hit.longitude}`}>
                <button
                  type="button"
                  onClick={() => {
                    onPicked(hit.latitude, hit.longitude);
                    setChosen({
                      latitude: hit.latitude,
                      longitude: hit.longitude,
                    });
                    setResolved(hit.label);
                    setHits([]);
                    setQuery(hit.label);
                  }}
                  className="w-full py-2 text-left text-sm text-slate-700 hover:text-slate-900"
                >
                  {hit.label}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {error && <ErrorBanner message={error} />}

      <LocationMapPicker
        open={mapOpen}
        initial={chosen}
        onCancel={() => setMapOpen(false)}
        onConfirm={(latitude, longitude) => {
          onPicked(latitude, longitude);
          setChosen({ latitude, longitude });
          setResolved(`${latitude.toFixed(4)}, ${longitude.toFixed(4)}`);
          setMapOpen(false);
        }}
      />
    </div>
  );
}

export default LocationPicker;
