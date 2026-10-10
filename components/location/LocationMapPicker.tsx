"use client";

import { useEffect, useRef, useState } from "react";

import { MapContainer, TileLayer, useMap, useMapEvents } from "react-leaflet";

import "leaflet/dist/leaflet.css";

import MapResizeFix from "@/components/map/MapResizeFix";

import { Button } from "@/components/ui";

/*
 * Placing a pin by hand. Nominatim does not know every address, and
 * sometimes you spot a laundromat from the road and cannot stop for
 * it — two ways of needing a point you did not arrive at.
 *
 * The crosshair sits in the middle of the screen and the MAP moves
 * under it, rather than the tap choosing the point. Two reasons: a
 * finger covers about 40px, which is enough to hide the very spot you
 * are aiming at, and the exact pixel you tapped is decided at
 * touch-up, which on a moving map is not where you aimed.
 *
 * The centre is read once per settle, not on every frame: `moveend`
 * fires when the gesture finishes, which is also when the coordinate
 * under the crosshair stops changing.
 */

function CentreWatcher({
  onCentre,
}: {
  onCentre: (latitude: number, longitude: number) => void;
}) {
  const map = useMap();

  /*
   * The caller passes a new arrow function every render, so putting
   * `onCentre` in the dependency list restarted this effect on every
   * render and re-attached its two listeners each time. Held in a
   * ref instead, the listeners are attached once and always call the
   * current callback.
   */
  const latest = useRef(onCentre);

  useEffect(() => {
    latest.current = onCentre;
  }, [onCentre]);

  useEffect(() => {
    function report() {
      /* A removed map has no container, and asking for one is the
         cheap way to know this listener has outlived its map. */
      if (!map.getContainer()) return;

      const centre = map.getCenter();

      latest.current(centre.lat, centre.lng);
    }

    report();

    map.on("moveend", report);
    map.on("zoomend", report);

    return () => {
      map.off("moveend", report);
      map.off("zoomend", report);
    };
  }, [map]);

  return null;
}

/*
 * A nudge of the map after it opens, so the centre is measured against
 * a real layout. Leaflet caches the container size, and in a modal the
 * first measurement can be taken before the box has its final width —
 * the centre then reads back slightly off, and the saved point drifts.
 *
 * The 200ms delay is why a removed map has to be guarded against: the
 * timer outlives a closing modal, and `invalidateSize()` on a torn-down
 * map throws — which took the whole page to the error boundary, and is
 * why the crosshair was visible for a moment and then gone.
 */
function SettleOnOpen({ open }: { open: boolean }) {
  const map = useMap();

  useEffect(() => {
    if (!open) return;

    const timer = setTimeout(() => {
      if (!map.getContainer()) return;

      map.invalidateSize();
    }, 200);

    return () => clearTimeout(timer);
  }, [map, open]);

  return null;
}

/* Keeps the gesture from being read as a page scroll on a phone. */
function NothingOnTap() {
  useMapEvents({});

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
  /* Where the map is parked, and what the crosshair is over. */
  const [start, setStart] = useState<[number, number]>(
    initial ? [initial.latitude, initial.longitude] : [20, 0]
  );

  const [centre, setCentre] = useState<[number, number]>(
    initial ? [initial.latitude, initial.longitude] : [20, 0]
  );

  const [zoom, setZoom] = useState(initial ? 16 : 2);
  const [finding, setFinding] = useState(false);

  /* The map is remounted each time the modal opens, so a stale centre
     from the previous edit cannot leak into the new one. */
  const [key, setKey] = useState(0);

  const moved = useRef(false);

  useEffect(() => {
    if (!open) return;

    const target: [number, number] = initial
      ? [initial.latitude, initial.longitude]
      : [20, 0];

    setStart(target);
    setCentre(target);
    setZoom(initial ? 16 : 2);
    moved.current = false;
    setKey((current) => current + 1);
  }, [open, initial]);

  if (!open) return null;

  function useMyPosition() {
    if (!navigator.geolocation) return;

    setFinding(true);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const here: [number, number] = [
          position.coords.latitude,
          position.coords.longitude,
        ];

        setStart(here);
        setCentre(here);
        setZoom(16);
        setFinding(false);

        /* A fresh mount is what actually recentres the map: the
           container's `center` prop is only read on creation. */
        setKey((current) => current + 1);
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
              {moved.current
                ? `${centre[0].toFixed(5)}, ${centre[1].toFixed(5)}`
                : "Move the map so the cross sits where the place is"}
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
            key={key}
            center={start}
            zoom={zoom}
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
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url={"https://tile.openstreetmap.org/{z}/{x}/{y}.png"}
            />

            <MapResizeFix trigger={open} />
            <SettleOnOpen open={open} />
            <NothingOnTap />

            <CentreWatcher
              onCentre={(lat, lng) => {
                moved.current = true;
                setCentre([lat, lng]);
              }}
            />
          </MapContainer>

          {/* The crosshair: a guide, never a target. The small hole in
              the middle is what you line the door up with. */}
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="relative h-12 w-12">
              <span className="absolute left-1/2 top-0 h-4 w-0.5 -translate-x-1/2 bg-slate-900 shadow-[0_0_3px_rgba(255,255,255,0.9)]" />
              <span className="absolute bottom-0 left-1/2 h-4 w-0.5 -translate-x-1/2 bg-slate-900 shadow-[0_0_3px_rgba(255,255,255,0.9)]" />
              <span className="absolute left-0 top-1/2 h-0.5 w-4 -translate-y-1/2 bg-slate-900 shadow-[0_0_3px_rgba(255,255,255,0.9)]" />
              <span className="absolute right-0 top-1/2 h-0.5 w-4 -translate-y-1/2 bg-slate-900 shadow-[0_0_3px_rgba(255,255,255,0.9)]" />

              <span className="absolute left-1/2 top-1/2 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-slate-900 shadow-[0_0_3px_rgba(255,255,255,0.9)]" />
            </div>
          </div>

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
            onClick={() => onConfirm(centre[0], centre[1])}
            className="flex-1"
          >
            Use this point
          </Button>
        </div>
      </div>
    </div>
  );
}

export default LocationMapPicker;
