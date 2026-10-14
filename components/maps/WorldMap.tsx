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
 * page to the error boundary. ZoomBar is therefore mounted ONCE,
 * inside the map, and nowhere else.
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
 * right, bottom-left by absolute positioning.
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
 * When a place is chosen on a phone, the drawer covers the bottom third
 * of the map. The pin being looked at is very often underneath it.
 *
 * panBy pushes the map's own view up by half the drawer's height, so
 * the selected pin ends up in the part that is still visible. It is
 * done to the CONTAINER, not to the marker's coordinates, so the pin
 * does not lie about where the place is.
 */
function NudgeForDrawer({
  place,
  drawerPx,
}: {
  place: PlaceWithFreshness | null;
  drawerPx: number;
}) {
  const map = useMap();

  useEffect(() => {
    if (!place || drawerPx <= 0) return;

    /* Half the drawer, so the pin sits in the middle of what remains. */
    map.panBy([0, drawerPx / 2], { animate: true });
  }, [map, place, drawerPx]);

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
  drawerPx,
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
  drawerPx: number;
  onZoom: (z: number) => void;
  onBounds: (b: BoundsLike) => void;
}) {
  /* Each copy hides its controls at the breakpoint where its twin is
     shown, so only one set is ever on screen. */
  const ownBreakpoint = breakpoint === "phone" ? "md:hidden" : "hidden md:flex";

  /* The controls sit above the drawer while it is open, so the zoom bar
     and "Where am I?" are never buried under the card. */
  const lift = drawerPx > 0 ? { bottom: drawerPx + 12 } : undefined;

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
        <NudgeForDrawer place={selected} drawerPx={drawerPx} />

        {/* The zoom bar calls into the map, so it lives HERE and only
            here. A copy outside MapContainer has no Leaflet context
            and throws. */}
        <ZoomBar breakpoint={breakpoint} />

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
            way every map app draws it. */}
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

      {/*
        The map's own controls, lifted clear of the drawer.

        The zoom bar is inside the MapContainer and cannot read the
        drawer's height from here; it keeps its own corner. This button
        and the pin counter do move, because they are siblings of the
        map rather than children of it.

        z-[500] is deliberate: globals.css pins Leaflet's panes at
        400 with !important, so anything below that is drawn under
        the tiles and disappears.
      */}
      <button
        type="button"
        onClick={onWhereAmI}
        disabled={locating}
        aria-label="Zoom to where I am"
        style={ownBreakpoint === "md:hidden" ? lift : undefined}
        className={`${ownBreakpoint} absolute right-3 z-[500] min-h-10 items-center gap-2 rounded-xl bg-white/95 px-3 text-sm font-semibold text-slate-700 shadow-lg backdrop-blur transition-all hover:bg-white disabled:opacity-70 ${
          drawerPx > 0 ? "" : "bottom-3"
        }`}
      >
        <span className="text-base">{locating ? "⏳" : "📍"}</span>
        <span className="hidden sm:inline">
          {locating ? "Locating…" : "Where am I?"}
        </span>
      </button>

      {/* How many pins are drawn — only when something is hidden. */}
      {visible.length < places.length && (
        <div
          style={ownBreakpoint === "md:hidden" ? lift : undefined}
          className={`${ownBreakpoint} pointer-events-none absolute right-3 z-[500] rounded-lg bg-white/95 px-3 py-1.5 text-xs font-semibold text-slate-600 shadow ${
            drawerPx > 0 ? "" : "bottom-16"
          }`}
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
      {/*
       * ---------- phone: the map, with the card as a short drawer ----------
       *
       * A THIRD OF THE SCREEN, measured, not a fraction of the map.
       *
       * The card first sat ABOVE the map in normal flow, 60vh of it,
       * with the map capped at 58vh — 118% of the screen, so opening a
       * place pushed the map off the bottom and every other pin seemed
       * to vanish. It then became an overlay at 55vh, which kept the
       * pins but buried most of the map.
       *
       * It is a third now. The map is the point of this page, and a
       * third is enough to read what a place is, what it costs to get
       * there, and to press through to the full page — where the
       * photos and every fact live. The drawer scrolls inside itself
       * if the content needs more.
       *
       * The height is computed rather than set in vh so the same
       * number can be handed to the map: the pin you tapped is nudged
       * above the drawer, and the controls move up with it.
       */

      <div className="md:hidden">
        <div
          className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
          style={{ height: "min(72vh, 640px)" }}
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
            drawerPx={panelOpen ? PHONE_DRAWER_PX : 0}
            onZoom={setZoom}
            onBounds={setBounds}
          />

          {/*
           * The drawer. z-[600] puts it above the map's own controls
           * (z-[500]) and above Leaflet's panes (400).
           */}
          {panelOpen && (
            <div
              className="absolute inset-x-0 bottom-0 z-[600] overflow-y-auto overscroll-contain rounded-t-2xl border-t border-slate-200 bg-white shadow-[0_-4px_16px_rgba(0,0,0,0.12)]"
              style={{ height: PHONE_DRAWER_PX }}
            >
              {panel}
            </div>
          )}
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
            drawerPx={0}
            onZoom={setZoom}
            onBounds={setBounds}
          />
        </div>
      </div>
    </>
  );
}
