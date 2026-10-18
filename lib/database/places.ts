import { createClient } from "@/lib/supabase/server";

import type {
  Place,
  PlaceWithFreshness,
  PlacePhoto,
  PlaceType,
  Price,
  CoffeeDetails,
  LaundryDetails,
} from "@/lib/types";

/* ====================================================== */
/* READ QUERIES — all reads use the server client so RLS   */
/* applies, and none of them leak the service key.         */
/* ====================================================== */

const PHOTO_BUCKET = "place-photos";

/*
 * Who did something, named as a person rather than a UUID.
 *
 * `places.created_by` holds an id, which means nothing to somebody
 * reading the page. The username is what they can recognise, search
 * for, and say out loud — and it is public, so this is safe to show.
 *
 * The email is deliberately not the fallback: an address printed
 * under a place name is a leak. An account with no name yet reads as
 * "someone", which is honest and does no harm.
 */
export async function displayNameFor(userId: string): Promise<string> {
  const supabase = await createClient();

  const { data } = await supabase
    .from("profiles")
    .select("username")
    .eq("id", userId)
    .maybeSingle();

  return data?.username ?? "someone";
}

export interface MapPlaces {
  places: PlaceWithFreshness[];
  bucketUrl: string;
}

export async function getPlacesForMap(): Promise<MapPlaces> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("places_with_freshness")
    .select("*")
    .neq("status", "closed")
    .order("last_verified_at", { ascending: false });

  if (error) throw error;

  const { data: publicUrl } = supabase.storage
    .from(PHOTO_BUCKET)
    .getPublicUrl("");

  return {
    places: (data ?? []) as PlaceWithFreshness[],
    bucketUrl: publicUrl.publicUrl.replace(/\/$/, ""),
  };
}

export interface FieldCheckRow {
  field_key: string;
  verified_at: string;
  value_snapshot: string | null;
  verified_by_name: string;
}

export interface PriceHistoryRow {
  field_key: string;
  old_value: string | null;
  new_value: string | null;
  created_at: string;
}

export interface CommentRow {
  id: string;
  author_name: string;
  body: string;
  created_at: string;
}

/*
 * How many comments one page shows.
 *
 * Twenty rather than all of them: a place that collects a hundred is
 * rare, and a page that grows without limit is slow to open on a
 * phone. Nothing says "and more" underneath, deliberately — the
 * header counts what is rendered, so it never claims a total it is
 * not showing. If the list ever needs to go past twenty, this is the
 * one number to change.
 */
const COMMENTS_PER_PAGE = 20;

export async function getPlace(id: string): Promise<
  | (PlaceWithFreshness & {
      prices: Price[];
      coffee: CoffeeDetails | null;
      laundry: LaundryDetails | null;
      photos: PlacePhoto[];
      photo_bucket_url: string;
      comments: CommentRow[];
      field_checks: FieldCheckRow[];
      creator_name: string | null;
    })
  | null
> {
  const supabase = await createClient();

  const { data: place, error } = await supabase
    .from("places_with_freshness")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error || !place) return null;

  /*
   * Six reads, in parallel. Five of them were already here; the one
   * that changed is the FOURTH — `place_updates` became
   * `place_comments`.
   *
   * `place_updates` is still written by every field change, and
   * getPriceHistory below still reads it for the "was 6$" line. What
   * went away is the panel that listed those rows on the page, so
   * the read that fed it goes with it — five rows fetched on every
   * page load to render nothing would be the worst of both.
   */
  const [coffee, laundry, prices, comments, checks, photos] =
    await Promise.all([
      supabase
        .from("place_coffee_details")
        .select("*")
        .eq("place_id", id)
        .maybeSingle(),

      supabase
        .from("place_laundry_details")
        .select("*")
        .eq("place_id", id)
        .maybeSingle(),

      supabase
        .from("place_prices")
        .select("*")
        .eq("place_id", id)
        .order("kind"),

      /* Newest first: what somebody said most recently is what a
         reader wants, and it is the order the panel draws. */
      supabase
        .from("place_comments")
        .select("id, author_name, body, created_at")
        .eq("place_id", id)
        .order("created_at", { ascending: false })
        .limit(COMMENTS_PER_PAGE),

      /* One row per field: who last verified it, and when. */
      supabase.from("place_latest_checks").select("*").eq("place_id", id),

      supabase
        .from("place_photos")
        .select("*")
        .eq("place_id", id)
        .order("created_at", { ascending: false })
        .limit(12),
    ]);

  /*
   * A missing table is not an error worth throwing. 0021 creates
   * `place_comments`, and migrations on this project do NOT apply
   * themselves — they are pasted into the Supabase SQL editor by
   * hand. Until that happens, this read fails with 42P01 and the
   * page would die for a table nobody has used yet.
   *
   * So it is swallowed here and the list comes back empty. The
   * PLACE still renders, which is the important half; and writing
   * a comment answers COMMENT_NOT_READY, which says out loud where
   * to look. Silence about the read, a sentence about the write.
   */
  if (comments.error) {
    console.error(
      "[getPlace] comments",
      comments.error.message,
      comments.error.code
    );
  }

  /* Resolved here, so the page renders a name and never has to know
     where it came from. */
  const owner = (place as { created_by?: string | null }).created_by;

  const creatorName = owner ? await displayNameFor(owner) : null;

  const { data: publicUrl } = supabase.storage
    .from(PHOTO_BUCKET)
    .getPublicUrl("");

  return {
    ...(place as PlaceWithFreshness),
    prices: (prices.data ?? []) as Price[],
    coffee: (coffee.data as CoffeeDetails) ?? null,
    laundry: (laundry.data as LaundryDetails) ?? null,
    photos: (photos.data ?? []) as PlacePhoto[],
    photo_bucket_url: publicUrl.publicUrl.replace(/\/$/, ""),
    comments: (comments.data ?? []) as CommentRow[],
    field_checks: (checks.data ?? []) as FieldCheckRow[],
    creator_name: creatorName,
  };
}

/*
 * The last recorded change per price field, so a table can say
 * "was 3.40" rather than silently showing the new number.
 *
 * Untouched by the move to comments: this is the line that made the
 * timeline unnecessary, because the change appears where the price
 * is instead of five rows lower down.
 */
export async function getPriceHistory(
  placeId: string
): Promise<PriceHistoryRow[]> {
  const supabase = await createClient();

  const { data } = await supabase
    .from("place_updates")
    .select("field_changed, old_value, new_value, created_at")
    .eq("place_id", placeId)
    .in("field_changed", [
      "wash_price",
      "dryer_price",
      "espresso_price",
      "filter_price",
      "flat_white_price",
    ])
    .order("created_at", { ascending: false })
    .limit(20);

  return (data ?? []).map((row) => ({
    field_key: String(row.field_changed),
    old_value: row.old_value,
    new_value: row.new_value,
    created_at: String(row.created_at),
  }));
}

/* The fields this user already verified this week. */
export async function getMyWeekChecks(
  placeId: string,
  userId: string
): Promise<string[]> {
  const supabase = await createClient();

  const since = new Date();
  since.setDate(since.getDate() - 7);

  const { data } = await supabase
    .from("place_field_checks")
    .select("field_key")
    .eq("place_id", placeId)
    .eq("verified_by", userId)
    .gte("verified_at", since.toISOString());

  return (data ?? []).map((row) => String(row.field_key));
}

export async function getPlacesNearby(
  latitude: number,
  longitude: number,
  radiusKm = 25,
  type?: PlaceType
): Promise<PlaceWithFreshness[]> {
  const supabase = await createClient();

  /* Bounding box first (index-friendly), exact distance after. */
  const latDelta = radiusKm / 111;
  const lngDelta =
    radiusKm / (111 * Math.max(0.1, Math.cos((latitude * Math.PI) / 180)));

  let query = supabase
    .from("places_with_freshness")
    .select("*")
    .gte("latitude", latitude - latDelta)
    .lte("latitude", latitude + latDelta)
    .gte("longitude", longitude - lngDelta)
    .lte("longitude", longitude + lngDelta)
    .neq("status", "closed")
    .limit(200);

  if (type) query = query.eq("place_type", type);

  const { data, error } = await query;

  if (error) throw error;

  return (data ?? []) as PlaceWithFreshness[];
}

export async function searchPlaces(term: string): Promise<PlaceWithFreshness[]> {
  const supabase = await createClient();

  const clean = term.trim().replace(/[%,]/g, "");

  if (!clean) return [];

  const { data, error } = await supabase
    .from("places_with_freshness")
    .select("*")
    .or(`name.ilike.%${clean}%,city.ilike.%${clean}%,country.ilike.%${clean}%`)
    .neq("status", "closed")
    .limit(30);

  if (error) throw error;

  return (data ?? []) as PlaceWithFreshness[];
}

export async function getPlacesByUser(userId: string): Promise<Place[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("places")
    .select("id, name, place_type, city, country, created_at, status")
    .eq("created_by", userId)
    .order("created_at", { ascending: false });

  if (error) throw error;

  return (data ?? []) as unknown as Place[];
}

export async function getGlobalCounts() {
  const supabase = await createClient();

  const [coffee, laundry] = await Promise.all([
    supabase
      .from("places")
      .select("id", { count: "exact", head: true })
      .eq("place_type", "coffee")
      .neq("status", "closed"),

    supabase
      .from("places")
      .select("id", { count: "exact", head: true })
      .eq("place_type", "laundry")
      .neq("status", "closed"),
  ]);

  return { coffee: coffee.count ?? 0, laundry: laundry.count ?? 0 };
}
