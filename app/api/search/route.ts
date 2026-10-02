import { NextResponse } from "next/server";

import { searchPlaces } from "@/lib/database/places";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const term = searchParams.get("q") ?? "";

  if (term.trim().length < 2) {
    return NextResponse.json({ results: [] });
  }

  try {
    const places = await searchPlaces(term);

    return NextResponse.json({
      results: places.slice(0, 20).map((place) => ({
        id: place.id,
        name: place.name,
        place_type: place.place_type,
        city: place.city,
        country: place.country,
        latitude: place.latitude,
        longitude: place.longitude,
      })),
    });
  } catch {
    return NextResponse.json({ results: [], error: "search_failed" });
  }
}
