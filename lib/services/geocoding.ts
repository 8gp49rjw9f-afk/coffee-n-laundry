/* ====================================================== */
/* GEOCODING — reverse lookup and forward search           */
/* ====================================================== */

export interface ReverseGeocodeResult {
  city: string | null;
  country: string | null;
  countryCode: string | null;
}

export interface GeocodeHit {
  label: string;
  latitude: number;
  longitude: number;
}

const EMPTY: ReverseGeocodeResult = {
  city: null,
  country: null,
  countryCode: null,
};

interface CacheEntry {
  result: ReverseGeocodeResult;
  at: number;
}

const cacheWithTTL = new Map<string, CacheEntry>();
const CACHE_TTL = 1000 * 60 * 60; // 1 hour

const USER_AGENT =
  "coffee-n-laundry/1.0 (community map of coffee and laundromats)";

export async function reverseGeocode(
  latitude: number,
  longitude: number
): Promise<ReverseGeocodeResult> {
  const key = `${latitude.toFixed(3)},${longitude.toFixed(3)}`;

  const cached = cacheWithTTL.get(key);

  if (cached && Date.now() - cached.at < CACHE_TTL) {
    return cached.result;
  }

  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${latitude}&lon=${longitude}`,
      { headers: { "User-Agent": USER_AGENT } }
    );

    if (!response.ok) return EMPTY;

    const data = await response.json();

    const result: ReverseGeocodeResult = {
      city:
        data.address?.city ??
        data.address?.town ??
        data.address?.village ??
        data.address?.hamlet ??
        null,
      country: data.address?.country ?? null,
      countryCode: data.address?.country_code?.toUpperCase() ?? null,
    };

    cacheWithTTL.set(key, { result, at: Date.now() });

    return result;
  } catch {
    return EMPTY;
  }
}

export async function searchAddress(query: string): Promise<GeocodeHit[]> {
  const clean = query.trim();

  if (clean.length < 3) return [];

  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&q=${encodeURIComponent(clean)}`,
      { headers: { "User-Agent": USER_AGENT } }
    );

    if (!response.ok) return [];

    const data = await response.json();

    return (data as { display_name: string; lat: string; lon: string }[]).map(
      (hit) => ({
        label: hit.display_name,
        latitude: Number(hit.lat),
        longitude: Number(hit.lon),
      })
    );
  } catch {
    return [];
  }
}

/* A human-readable label for a coordinate pair. */
export function geocodeLabel(latitude: number, longitude: number): string {
  return `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
}
