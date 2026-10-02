import { useEffect } from "react";
import { useMap } from "react-leaflet";

/*
 * Leaflet caches its container size. When a sibling panel opens
 * and changes the map's width, tiles are laid out for the old
 * size until invalidateSize() runs.
 */

export default function MapResizeFix({ trigger }: { trigger: boolean }) {
  const map = useMap();

  useEffect(() => {
    const timer = setTimeout(() => map.invalidateSize(), 250);

    return () => clearTimeout(timer);
  }, [map, trigger]);

  return null;
}
