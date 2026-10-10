import { useEffect } from "react";
import { useMap } from "react-leaflet";

/*
 * Leaflet caches its container size. When a sibling panel opens and
 * changes the map's width, tiles are laid out for the old size until
 * invalidateSize() runs.
 *
 * THE TIMER NEEDS THE GUARD. It fires 250ms after mount, and the
 * component can be gone by then — the pin picker remounts its map on
 * a `key` change, and the modal that holds it closes. Calling
 * invalidateSize() on a map that has been torn down throws, and the
 * error boundary answers, which is what made the picker's crosshair
 * appear and then vanish.
 *
 * A removed map has no container, and asking for one is the cheapest
 * way to know. The same guard sits in the picker's own settle timer.
 */

export default function MapResizeFix({ trigger }: { trigger: boolean }) {
  const map = useMap();

  useEffect(() => {
    const timer = setTimeout(() => {
      if (!map.getContainer()) return;

      map.invalidateSize();
    }, 250);

    return () => clearTimeout(timer);
  }, [map, trigger]);

  return null;
}
