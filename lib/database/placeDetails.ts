import { createClient } from "@/lib/supabase/server";
import { distanceKm } from "@/lib/services/distance";

import type { PlaceWithFreshness, CoffeeDetails } from "@/lib/types";

/* ====================================================== */
/* PHOTOS, UPDATES, CONFIRMATIONS — read side              */
/* ====================================================== */

/*
 * These three used to end with a bare `throw error`, which put a raw
 * Postgres string on the path to a screen. Each one now throws a code,
 * so the error boundary can say something a person can read and the
 * reference leads back to the line.
 *
 * The message is still logged, in the standard shape, because that is
 * where a database string is actually useful.
 */

export async function getPlacePhotos(placeId: string) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("place_photos")
    .select("*")
    .eq("place_id", placeId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[getPlacePhotos]", error.message);

    throw new Error("PAGE_PLACE_FAILED");
  }

  return data ?? [];
}

export async function getPlaceUpdates(placeId: string) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("place_updates")
    .select("*")
    .eq("place_id", placeId)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    console.error("[getPlaceUpdates]", error.message);

    throw new Error("PAGE_PLACE_FAILED");
  }

  return data ?? [];
}

export async function getPlaceConfirmations(placeId: string) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("place_confirmations")
    .select("*")
    .eq("place_id", placeId)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    console.error("[getPlaceConfirmations]", error.message);

    throw new Error("PAGE_PLACE_FAILED");
  }

  return data ?? [];
}

/* ====================================================== */
/* COFFEE NEAR LAUNDRY — one trip, both jobs done           */
/* Coffee and laundry stay independent places; this is a    */
/* proximity join, computed in the app for V1.              */
/* ====================================================== */

export interface NearbyPair {
  wash: { id: string; name: string; latitude: number; longitude: number };
  coffee: {
    id: string;
    name: string;
    latitude: number;
    longitude: number;
    coffee_kind: string | null;
  };
  metres: number;
}

export function pairCoffeeWithLaundry(
  laundry: PlaceWithFreshness[],
  coffee: (PlaceWithFreshness & { coffee?: CoffeeDetails | null })[],
  maxMetres = 400
): NearbyPair[] {
  const pairs: NearbyPair[] = [];

  for (const shop of laundry) {
    for (const cafe of coffee) {
      const metres = Math.round(
        distanceKm(shop.latitude, shop.longitude, cafe.latitude, cafe.longitude) *
          1000
      );

      if (metres <= maxMetres) {
        pairs.push({
          wash: {
            id: shop.id,
            name: shop.name,
            latitude: shop.latitude,
            longitude: shop.longitude,
          },
          coffee: {
            id: cafe.id,
            name: cafe.name,
            latitude: cafe.latitude,
            longitude: cafe.longitude,
            coffee_kind: cafe.coffee?.coffee_kind ?? null,
          },
          metres,
        });
      }
    }
  }

  return pairs.sort((a, b) => a.metres - b.metres);
}
