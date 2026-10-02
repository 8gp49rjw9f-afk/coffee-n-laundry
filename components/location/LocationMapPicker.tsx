"use client";

import { useEffect, useState } from "react";

import {
  MapContainer,
  TileLayer,
  Marker,
  useMap,
  useMapEvents,
} from "react-leaflet";

import L from "leaflet";

import "leaflet/dist/leaflet.css";

import MapResizeFix from "@/components/map/MapResizeFix";

import { Button } from "@/components/ui";

/*
 * Placing a pin by hand. Nominatim does not know every address, and
 * sometimes you spot a laundromat from the road and cannot stop for
 * it — two ways of needing a point you did not arrive at.
 */

const pinIcon = L.divIcon({
  className: "",
  html: '<div style="width:20px;height:20px;border-radius:50%;background:#0f172a;border:3px solid white;box-shadow:0 3px 10px rgba(0,0,0,.4)"></div>',
  iconSize: [20, 20],
  iconAnchor: [10, 10],
});

function Recentre({ target }: { target: [number, number] | null }) {
  const map = useMap();

  useEffect(() => {
    if (target) map.flyTo(target, 15, { animate: true });
  }, [map, target]);

  return null;
}

function ClickToPlace({
  onPlace,
}: {
  onPlace: (lat: number, lng: number) => void;
}) {
  useMapEvents({
    click(event) {
      onPlace(event.latlng.lat, event.latlng.lng);
    },
  });

  return null;
}

export function LocationMapPicker({
  open,
  initial,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  initial: { latitude: number; longitude: number } | null;
  onCancel: () => void;
  onConfirm: (latitude: number, longitude: number) => void;
}) {
  const [point, setPoint] = useState<[number, number] | null>(
    initial ? [initial.latitude, initial.longitude] : null
  );
  const [finding, setFinding] = useState(false);

  useEffect(() => {
    if (open) {
      setPoint(initial ? [initial.latitude, initial.longitude] : null);
    }
  }, [open, initial]);

  if (!open) return null;

  function useMyPosition() {
    if (!navigator.geolocation) return;

    setFinding(true);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setPoint([position.coords.latitude, position.coords.longitude]);
        setFinding(false);
      },
      () => setFinding(false),
      { enableHighAccuracy: true, timeout: 10_000 }
    );
  }

  return (
    <div className="fixed inset-0 z-[1100] flex items-center justify-center bg-slate-900/50 p-4">
      <div className="flex w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
          <div className="min-w-0">
            <p className="text-sm font-bold text-slate-900">Place a pin</p>

            <p className="truncate text-xs text-slate-500">
              {point
                ? `${point[0].toFixed(5)}, ${point[1].toFixed(5)}`
                : "Tap the map where the place is"}
            </p>
          </div>

          <button
            type="button"
            onClick={onCancel}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-2xl text-slate-500 hover:bg-slate-100"
            aria-label="Cancel"
          >
            ✕
          </button>
        </div>

        <div className="relative h-[420px] w-full sm:h-[520px]">
          <MapContainer
            center={point ?? [20, 0]}
            zoom={point ? 15 : 2}
            minZoom={2}
            maxZoom={19}
            worldCopyJump
            maxBounds={[
              [-90, -180],
              [90, 180],
            ]}
            maxBoundsViscosity={1}
            style={{ height: "100%", width: "100%" }}
          >
            {/* The URL is inside braces so JSX leaves {z}/{x}/{y}
                alone for Leaflet to substitute. Written as a plain
                attribute, JSX reads them as JS and the path breaks. */}

            <TileLayer
              attribution='&copy; <a href="[www](https://www)openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url={"https://tile.openstreetmap.org/{z}/{x}/{y}.png"}
            />

            <MapResizeFix trigger={open} />
            <ClickToPlace onPlace={(lat, lng) => setPoint([lat, lng])} />
            <Recentre target={point} />

            {point && <Marker position={point} icon={pinIcon} />}
          </MapContainer>

          <button
            type="button"
            onClick={useMyPosition}
            disabled={finding}
            className="absolute bottom-3 right-3 z-[1000] rounded-xl bg-white px-3 py-2 text-sm font-semibold text-slate-800 shadow-lg disabled:opacity-60"
          >
            {finding ? "Locating…" : "📍 Where I am"}
          </button>
        </div>

        <div className="flex gap-2 border-t border-slate-200 p-4">
          <Button variant="ghost" onClick={onCancel}>
            Cancel
          </Button>

          <Button
            onClick={() => point && onConfirm(point[0], point[1])}
            disabled={!point}
            className="flex-1"
          >
            {point ? "Use this point" : "Tap the map first"}
          </Button>
        </div>
      </div>
    </div>
  );
}

export default LocationMapPicker;
