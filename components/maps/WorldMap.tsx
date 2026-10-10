"use client";

import { useEffect, useMemo, useState } from "react";

import {
  MapContainer,
  TileLayer,
  Marker,
  CircleMarker,
  useMap,
} from "react-leaflet";

import "leaflet/dist/leaflet.css";

import MapResizeFix from "@/components/map/MapResizeFix";
import { markerIcon } from "@/components/maps/markerIcon";

import type { PlaceWithFreshness } from "@/lib/types";

interface BoundsLike {
  contains: (point: [number, number]) => boolean;
}

export interface MePoint {
  latitude: number;
  longitude: number;
}

/*
 * Anything that calls useMap() has to be a CHILD of MapContainer.
 * React-Leaflet provides the map through context, and context only
 * flows downwards — a sibling of the container never sees it.
 *
 * That is not a style note. Rendering a control that calls useMap()
 * anywhere else throws "No context provided", which takes the whole
 * page to the error boundary. ZoomBar and CentreArrow are therefore
 * mounted ONCE each, inside the map, and nowhere else.
 */

function MapState({
  onZoom,
  onBounds,
}: {
  onZoom: (z: number) => void;
  onBounds: (b: BoundsLike) => void;
}) {
  const map = useMap();

  useEffect(() => {
    function update() {
      onZoom(map.getZoom());
      onBounds(map.getBounds());
    }

    update();

    map.on("zoomend", update);
    map.on("moveend", update);

    return () => {
      map.off("zoomend", update);
      map.off("moveend", update);
    };
  }, [map, onZoom, onBounds]);

  return null;
}

/*
 * The zoom bar: one horizontal rail, minus on the left, plus on the
 * right. It sits at bottom-left by absolute positioning, so its place
 * on screen does not depend on where it is mounted.
 *
 * The end stops are disabled rather than silently inert: a button that
 * looks pressable when it is not is a small lie.
 */
function ZoomBar({
  breakpoint,
}: {
  breakpoint: "phone" | "desktop";
}) {
  const map = useMap();

  const visible = breakpoint === "phone" ? "md:hidden" : "hidden md:flex";

  const [zoom, setZoom] = useState(map.getZoom());
  const [min, setMin] = useState(map.getMinZoom());
  const [max, setMax] = useState(map.getMaxZoom());

  useEffect(() => {
    function update() {
      setZoom(map.getZoom());
      setMin(map.getMinZoom());
      setMax(map.getMaxZoom());
    }

    update();

    map.on("zoomend", update);

    return () => {
      map.off("zoomend", update);
    };
  }, [map]);

  return (
    <div
      className={`${visible} absolute bottom-3 left-3 z-[500] flex-row items-center overflow-hidden rounded-xl bg-white/95 shadow-lg backdrop-blur`}
    >
      <button
        type="button"
        onClick={() => map.zoomOut()}
        disabled={zoom <= min}
        aria-label="Zoom out"
        className="flex h-10 w-12 items-center justify-center text-xl font-bold text-slate-700 transition hover:bg-slate-100 disabled:opacity-40"
      >
        −
      </button>

      {/* A hairline, not a gap: two buttons that touch read as one
          control, which is what they are. */}
      <span className="h-6 w-px bg-slate-200" aria-hidden />

      <button
        type="button"
        onClick={() => map.zoomIn()}
        disabled={zoom >= max}
        aria-label="Zoom in"
        className="flex h-10 w-12 items-center justify-center text-xl font-bold text-slate-700 transition hover:bg-slate-100 disabled:opacity-40"
      >
        +
      </button>
    </div>
  );
}

/*
 * The arrow at the centre of the map.
 *
 * Not a marker and not a control: a glyph pinned to the middle of the
 * viewport, reading as "the point you are looking at".
 *
 * pointer-events-none matters — a crosshair that eats clicks would
 * make the middle of the map undraggable, a worse bug than a missing
 * arrow ever was. It calls no map method, so it can be mounted
 * anywhere; it is kept beside ZoomBar for the two breakpoint copies
 * to stay in step.
 */
function CentreArrow({
  breakpoint,
}: {
  breakpoint: "phone" | "desktop";
}) {
  const visible = breakpoint === "phone" ? "md:hidden" : "hidden md:block";

  return (
    <div
      className={`${visible} pointer-events-none absolute left-1/2 top-1/2 z-[500] -translate-x-1/2 -translate-y-1/2`}
      aria-hidden
    >
      <svg
        width="26"
        height="26"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="text-slate-900/70 drop-shadow-[0_1px_2px_rgba(255,255,255,0.9)]"
      >
        <line x1="12" y1="2" x2="12" y2="8" />
        <line x1="12" y1="16" x2="12" y2="22" />
        <line x1="2" y1="12" x2="8" y2="12" />
        <line x1="16" y1="12" x2="22" y2="12" />
        <circle cx="12" cy="12" r="2.5" />
      </svg>
    </div>
  );
}

function FlyToSelected({ place }: { place: PlaceWithFreshness | null }) {
  const map = useMap();

  useEffect(() => {
    if (!place) return;

    map.panTo([place.latitude, place.longitude], { animate: true });
  }, [map, place]);

  return null;
}

/*
 * Flying to the viewer's own position. The map only reads its `center`
 * prop at creation, so recentring an already-mounted map means calling
 * flyTo — not changing a prop.
 *
 * `request` is a counter, not the point: pressing the button twice
 * with the same coordinates has to fly twice.
 */
function FlyToMe({
  target,
  request,
}: {
  target: MePoint | null;
  request: number;
}) {
  const map = useMap();

  useEffect(() => {
    if (!target) return;

    map.flyTo([target.latitude, target.longitude], 14, { animate: true });
  }, [map, target, request]);

  return null;
}

/*
 * The map. Two MapContainers, one per breakpoint: React cannot mount
 * the same element in two places, so a shared instance would
 * initialise inside whichever one was hidden — Leaflet renders into a
 * 0px box and the visible map stays grey.
 *
 * `breakpoint` decides which controls belong to this instance. Without
 * it both copies render their own button and badge, and both are in
 * the DOM at once — which is why "Where am I?" appeared twice.
 */

function TheMap({
  places,
  visible,
  selected,
  me,
  request,
  locating,
  breakpoint,
  onSelect,
  onWhereAmI,
  panelOpen,
  onZoom,
  onBounds,
}: {
  places: PlaceWithFreshness[];
  visible: PlaceWithFreshness[];
  selected: PlaceWithFreshness | null;
  me: MePoint | null;
  request: number;
  locating: boolean;
  breakpoint: "phone" | "desktop";
  onSelect: (id: string) => void;
  onWhereAmI: () => void;
  panelOpen: boolean;
  onZoom: (z: number) => void;
  onBounds: (b: BoundsLike) => void;
}) {
  /* Each copy hides its controls at the breakpoint where its twin is
     shown, so only one set is ever on screen. */
  const ownBreakpoint = breakpoint === "phone" ? "md:hidden" : "hidden md:flex";

  return (
    /* The wrapper is relative so the overlays can sit over the map
       without being invalid children of MapContainer. */
    <div className="relative h-full w-full">
      <MapContainer
        center={[20, 0]}
        zoom={2}
        minZoom={2}
        maxZoom={18}
        /* Leaflet's own control is a tall rounded bar down the left
           edge. Replaced by the horizontal bar below. */
        zoomControl={false}
        worldCopyJump
        maxBounds={[
          [-90, -180],
          [90, 180],
        ]}
        maxBoundsViscosity={1}
        style={{ height: "100%", width: "100%" }}
      >
        <MapState onZoom={onZoom} onBounds={onBounds} />
        <MapResizeFix trigger={panelOpen} />
        <FlyToSelected place={selected} />
        <FlyToMe target={me} request={request} />

        {/* Both of these call into the map, so both live HERE and
            only here. A second copy outside MapContainer has no
            Leaflet context and throws. */}
        <ZoomBar breakpoint={breakpoint} />
        <CentreArrow breakpoint={breakpoint} />

        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {visible.map((place) => (
          <Marker
            key={place.id}
            position={[place.latitude, place.longitude]}
            icon={markerIcon(place)}
            eventHandlers={{ click: () => onSelect(place.id) }}
          />
        ))}

        {/* Where you are, exactly: a dot with a soft ring around it, the
            way every map app draws it. The ring says "somewhere around
            here"; the dot says where. */}
        {me && (
          <>
            <CircleMarker
              center={[me.latitude, me.longitude]}
              radius={22}
              pathOptions={{
                color: "#0ea5e9",
                weight: 1,
                opacity: 0.35,
                fillColor: "#0ea5e9",
                fillOpacity: 0.15,
              }}
            />

            <CircleMarker
              center={[me.latitude, me.longitude]}
              radius={7}
              pathOptions={{
                color: "#ffffff",
                weight: 3,
                fillColor: "#0ea5e9",
                fillOpacity: 1,
              }}
            />
          </>
        )}
      </MapContainer>

      {/* "Where am I" sits on the map rather than under it: it is a
          thing you do TO the map, and your thumb already knows where
          the map is. Bottom left, beside the zoom bar.

          z-[500] is deliberate: globals.css pins Leaflet's panes at
          400 with !important, so anything below that is drawn under
          the tiles and disappears. */}
      <button
        type="button"
        onClick={onWhereAmI}
        disabled={locating}
        aria-label="Zoom to where I am"
        className={`${ownBreakpoint} absolute bottom-3 left-[6.4rem] z-[500] min-h-10 items-center gap-2 rounded-xl bg-white/95 px-3 text-sm font-semibold text-slate-700 shadow-lg backdrop-blur transition hover:bg-white disabled:opacity-70`}
      >
        <span className="text-base">{locating ? "⏳" : "📍"}</span>
        <span className="hidden sm:inline">
          {locating ? "Locating…" : "Where am I?"}
        </span>
      </button>

      {/* How many pins are drawn — the counter for a zoomed-out view. */}
      {visible.length < places.length && (
        <div
          className={`${ownBreakpoint} pointer-events-none absolute bottom-3 right-3 z-[500] rounded-lg bg-white/95 px-3 py-1.5 text-xs font-semibold text-slate-600 shadow`}
        >
          {visible.length} of {places.length} pins · zoom in
        </div>
      )}

      {me && (
        <div
          className={`${ownBreakpoint} pointer-events-none absolute right-3 top-3 z-[500] rounded-lg bg-sky-600/95 px-3 py-1.5 text-xs font-semibold text-white shadow`}
        >
          📍 you are here
        </div>
      )}
    </div>
  );
}

export default function WorldMap({
  places,
  selectedId,
  me,
  request = 0,
  locating = false,
  onWhereAmI,
  onSelect,
  panel,
}: {
  places: PlaceWithFreshness[];
  selectedId: string | null;
  me?: MePoint | null;
  request?: number;
  locating?: boolean;
  onWhereAmI?: () => void;
  onSelect: (id: string | null) => void;
  panel?: React.ReactNode;
}) {
  const [zoom, setZoom] = useState(2);
  const [bounds, setBounds] = useState<BoundsLike | null>(null);

  const selected = useMemo(
    () => places.find((p) => p.id === selectedId) ?? null,
    [places, selectedId]
  );

  const panelOpen = Boolean(panel);

  const visible = useMemo(() => {
    const max = zoom <= 2 ? 200 : zoom === 3 ? 400 : zoom === 4 ? 800 : Infinity;

    const inBounds = bounds
      ? places.filter((p) => bounds.contains([p.latitude, p.longitude]))
      : places;

    return inBounds.slice(0, max);
  }, [places, zoom, bounds]);

  /* Without a handler the button would do nothing, which is worse than
     not being there. */
  const whereAmI = onWhereAmI ?? (() => {});

  return (
    <>
      {/* ---------- phone: panel first, map below ---------- */}

      <div className="space-y-3 md:hidden">
        {panelOpen && (
          <div className="max-h-[60vh] overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
            {panel}
          </div>
        )}

        <div
          className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
          style={{ height: "min(58vh, 520px)" }}
        >
          <TheMap
            places={places}
            visible={visible}
            selected={selected}
            me={me ?? null}
            request={request}
            locating={locating}
            breakpoint="phone"
            onSelect={onSelect}
            onWhereAmI={whereAmI}
            panelOpen={panelOpen}
            onZoom={setZoom}
            onBounds={setBounds}
          />
        </div>
      </div>

      {/* ---------- desktop: panel beside the map ---------- */}

      <div
        className="relative hidden overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm md:flex"
        style={{ height: "min(68vh, 620px)" }}
      >
        {panelOpen && (
          <aside className="relative z-10 h-full w-[360px] shrink-0 overflow-y-auto border-r border-slate-200 bg-white">
            {panel}
          </aside>
        )}

        <div className="relative h-full flex-1">
          <TheMap
            places={places}
            visible={visible}
            selected={selected}
            me={me ?? null}
            request={request}
            locating={locating}
            breakpoint="desktop"
            onSelect={onSelect}
            onWhereAmI={whereAmI}
            panelOpen={panelOpen}
            onZoom={setZoom}
            onBounds={setBounds}
          />
        </div>
      </div>
    </>
  );
}
