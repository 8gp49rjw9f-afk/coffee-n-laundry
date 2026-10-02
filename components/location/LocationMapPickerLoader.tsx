"use client";

import dynamic from "next/dynamic";

/*
 * Leaflet reads window when its module is evaluated, so this map
 * can never be part of server rendering.
 */

const LocationMapPicker = dynamic(() => import("./LocationMapPicker"), {
  ssr: false,
});

export default LocationMapPicker;
