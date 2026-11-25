"use client";

import { useEffect, useRef, useState } from "react";

import { MapContainer, TileLayer, useMap } from "react-leaflet";

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
 * WHY THE CROSSHAIR NEEDED A Z-INDEX
 *
 * It kept vanishing a moment after the modal opened, and reappearing
 * at maximum zoom — which is the clue that solved it. Leaflet builds
 * its own panes inside the container and they climb to z-index 700;
 * the crosshair had none, so as soon as the tiles painted it was
 * covered. At maximum zoom the map goes grey because the tile source
 * has no imagery that deep: nothing repaints over the guide and it is
 * visible again. It was never a mount or a timer problem — the
 * crosshair was simply underneath the map.
 *
 * No timer of any kind here, and no invalidateSize(). Two used to run
 * in this one map — MapResizeFix (250ms) and SettleOnOpen (200ms) —
 * and a map caught mid-mount can still answer getContainer() while
 * being unable to resize, so the call throws and the error boundary
 * takes the modal.
 *
 * NothingOnTap is gone too: it called useMapEvents({}) — an empty
 * listener object, which attaches nothing — so it never prevented the
 * page scroll it claimed to, and it was the only useMapEvents in the
 * project.
 *
 * THE GREY AT FULL ZOOM, PROPERLY FIXED
 *
 * The note above recorded the grey as a symptom of the crosshair
 * problem and moved on, because the crosshair was the thing being
 * chased. It was a second, unrelated fault sitting in the same
 * screenful: OpenStreetMap's own tile service does not carry imagery
 * all the way down everywhere, so past its deepest level for the area
 * the server answers empty tiles. Leaflet paints nothing, and the
 * container shows its grey. Nothing about the crosshair can fix that,
 * and hiding it behind a z-index never did.
 *
 * The tile source is ESRI World Imagery now, which is served in
 * raster down to level 19 — the level this map already asks for, so
 * no zoom had to be surrendered. It needs no key, and it is licensed
 * for non-commercial use, which is what this site is.
 *
 * THE ATTRIBUTION IS PART OF THE DEAL, not decoration. ESRI and its
 * data partners require the credit to be visible, and the line below
 * names the providers the tiles actually come from. It is longer than
 * the OSM line it replaced and that is how it has to be; shortening
 * it by dropping the partner names would breach the terms the tiles
 * are given under.
 *
 * ONE THING TO KNOW IF THE GREY EVER COMES BACK: this source serves
 * imagery, not street names, so at high zoom the map reads as a
 * photograph. That is the trade for having a floor at 19 at all. If
 * the labels are wanted back, the answer is a second label layer on
 * top of this one, not a return to the source that ran out.
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
   * `key` each time — remounting the map in a loop. The coordinates
   * only change when the caller actually picks a new point.
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

            {/* maxNativeZoom is what stops the grey: ESRI serves this
                imagery to level 19, the map never asks past it, and
                the two numbers now agree. */}

            <TileLayer
              attribution='&copy; <a href="https://www.esri.com/">Esri</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, and the GIS community'
              url={"https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"}
              maxNativeZoom={19}
              maxZoom={19}
            />

            <CentreWatcher
              onCentre={(lat, lng) => {
                moved.current = true;
                setCentre([lat, lng]);
              }}
            />
          </MapContainer>

          {/* The crosshair: a guide, never a target. The small hole in
              the middle is what you line the door up with.

              z-[800] lifts it above every Leaflet pane — the tile
              pane alone reaches 700 — which is what kept it hidden
              once the tiles began to paint. */}
          <div className="pointer-events-none absolute inset-0 z-[800] flex items-center justify-center">
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
