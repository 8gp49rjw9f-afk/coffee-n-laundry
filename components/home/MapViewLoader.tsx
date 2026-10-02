"use client";

import dynamic from "next/dynamic";

import type { PlaceWithFreshness } from "@/lib/types";

const MapView = dynamic(() => import("./MapView"), { ssr: false });

export default function MapViewLoader({
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
  return (
    <MapView
      places={places}
      bucketUrl={bucketUrl}
      today={today}
      showFilters={showFilters}
    />
  );
}
