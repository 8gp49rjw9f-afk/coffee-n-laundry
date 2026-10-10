"use client";

import { useEffect, useRef, useState } from "react";

import { MapContainer, TileLayer, useMap, useMapEvents } from "react-leaflet";

import "leaflet/dist/leaflet.css";

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
 *
 * NOTHING HERE RESIZES THE MAP AFTER A DELAY. There is no
 * invalidateSize() call at all, and no timer of any kind.
 *
 * Two timers used to run in this one map — MapResizeFix (250ms) and
 * SettleOnOpen (200ms) — both calling invalidateSize(). The map is
 * remounted on a `key` change, and a map caught mid-mount can still
 * answer getContainer() while being unable to resize: the call throws,
 * the error boundary takes the page, and the crosshair that had just
 * appeared is gone. 200ms is exactly how long the crosshair survived.
 *
 * Neither timer was needed. MapContainer measures its container at
 * creation, and this modal gives it a fixed height (h-[420px]
 * sm:h-[520px]) rather than a flexible one, so there is no first-paint
 * measurement to correct.
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
    let alive = true;

    function report() {
      if (!alive) return;

      const centre = map.getCenter();

      latest.current(centre.lat, centre.lng);
    }

    report();

    map.on("moveend", report);
    map.on("zoomend", report);

    return () => {
      alive = false;

      map.off("moveend", report);
      map.off("zoomend", report);
    };
  }, [map]);

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

  const lat = initial?.latitude;
  const lng = initial?.longitude;

  /*
   * Two numbers, not the object. `initial` is rebuilt by the parent on
   * every render, so depending on it would re-run this effect and bump
   * `key` each time — remounting the map in a loop, which is its own
   * way to make the crosshair flicker. The coordinates only change when
   * the caller actually picks a new point.
   */
  useEffect(() => {
    if (!open) return;

    const target: [number, number] =
      lat != null && lng != null ? [lat, lng] : [20, 0];

    setStart(target);
    setCentre(target);
    setZoom(lat != null ? 16 : 2);
    moved.current = false;
    setKey((current) => current + 1);
  }, [open, lat, lng]);

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
