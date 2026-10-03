"use client";

import { useEffect, useMemo, useState } from "react";

import { MapContainer, TileLayer, Marker, useMap } from "react-leaflet";

import "leaflet/dist/leaflet.css";

import MapResizeFix from "@/components/map/MapResizeFix";
import { markerIcon } from "@/components/maps/markerIcon";

import type { PlaceWithFreshness } from "@/lib/types";

interface BoundsLike {
  contains: (point: [number, number]) => boolean;
}

/*
 * Anything that calls useMap() has to be a CHILD of MapContainer.
 * React-Leaflet provides the map through context, and context only
 * flows downwards — a sibling of the container never sees it. That
 * is why MapState lives inside TheMap below, and why there is one
 * copy per breakpoint rather than one shared above them.
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

function FlyToSelected({ place }: { place: PlaceWithFreshness | null }) {
  const map = useMap();

  useEffect(() => {
    if (!place) return;

    map.panTo([place.latitude, place.longitude], { animate: true });
  }, [map, place]);

  return null;
}

/*
 * The map. World bounds are enforced, and pins are budgeted by zoom so
 * the whole world stays readable when zoomed out.
 *
 * Two separate MapContainers, one per breakpoint: React cannot mount
 * the same element in two places, so a single instance shared between
 * the mobile and desktop containers would initialise inside whichever
 * one was hidden — Leaflet renders into a 0px box and the visible map
 * stays grey.
 */

function TheMap({
  places,
  visible,
  selected,
  onSelect,
  panelOpen,
  onZoom,
  onBounds,
}: {
  places: PlaceWithFreshness[];
  visible: PlaceWithFreshness[];
  selected: PlaceWithFreshness | null;
  onSelect: (id: string) => void;
  panelOpen: boolean;
  onZoom: (z: number) => void;
  onBounds: (b: BoundsLike) => void;
}) {
  return (
    <MapContainer
      center={[20, 0]}
      zoom={2}
      minZoom={2}
      maxZoom={18}
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

      <TileLayer
        attribution='&copy; <a href="[openstreetmap.org](https://www.openstreetmap.org/copyright)">OpenStreetMap</a> contributors'
        url="[tile.openstreetmap.org](https://tile.openstreetmap.org/{z}/{x}/{y}.png)"
      />

      {visible.map((place) => (
        <Marker
          key={place.id}
          position={[place.latitude, place.longitude]}
          icon={markerIcon(place)}
          eventHandlers={{ click: () => onSelect(place.id) }}
        />
      ))}

      {visible.length < places.length && (
        <div className="pointer-events-none absolute bottom-3 right-3 z-10 rounded-lg bg-white/95 px-3 py-1.5 text-xs font-semibold text-slate-600 shadow">
          {visible.length} of {places.length} pins · zoom in
        </div>
      )}
    </MapContainer>
  );
}

export default function WorldMap({
  places,
  selectedId,
  onSelect,
  panel,
}: {
  places: PlaceWithFreshness[];
  selectedId: string | null;
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
            onSelect={onSelect}
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
            onSelect={onSelect}
            panelOpen={panelOpen}
            onZoom={setZoom}
            onBounds={setBounds}
          />
        </div>
      </div>
    </>
  );
}
