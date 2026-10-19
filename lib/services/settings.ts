import { createClient } from "@/lib/supabase/server";

/* ====================================================== */
/* SITE SETTINGS — dynamic, editable without a deploy      */
/* ====================================================== */

export interface SiteSettings {
  site_name: string;
  tagline: string;

  /* The donation button — 0024 and 0025. Optional here, and nothing
     else in this interface is, on purpose: a deployment where the
     migrations have not been pasted into Supabase yet still reads the
     row, the column is simply absent, the value is undefined, and the
     button hides itself. Marking them optional is what lets the rest
     of the site build and run against a database that is a step
     behind the code. */
  donation_enabled?: boolean;
  donation_url?: string | null;
  donation_amount?: number;

  maintenance_mode: boolean;
  maintenance_message: string | null;
  maintenance_allow_listed: boolean;

  registrations_enabled: boolean;

  max_photo_size_mb: number;
  max_name_length: number;
  max_description_length: number;
  max_comment_length: number;
  max_places_per_user_per_day: number;
  min_minutes_between_updates: number;

  subscription_price_usd: number;
  free_period_days: number;
  credits_per_free_month: number;

  max_markers_zoom_2: number;
  max_markers_zoom_3: number;
  max_markers_zoom_4: number;

  map_default_lat: number;
  map_default_lng: number;
  map_default_zoom: number;

  reports_to_hide: number;
  reporters_to_hide: number;

  currency_hint: string;
}

export const DEFAULT_SETTINGS: SiteSettings = {
  site_name: "coffee'n'laundry",
  tagline: "Good coffee. Clean clothes. Keep moving.",

  /* Off, and at the price of a coffee. An admin turns it on by
     filling the address in — see Admin → Site. */
  donation_enabled: false,
  donation_url: null,
  donation_amount: 2,

  maintenance_mode: false,
  maintenance_message: null,
  maintenance_allow_listed: false,

  registrations_enabled: true,

  max_photo_size_mb: 5,
  max_name_length: 120,
  max_description_length: 2000,
  max_comment_length: 500,
  max_places_per_user_per_day: 10,
  min_minutes_between_updates: 1,

  subscription_price_usd: 1,
  free_period_days: 365,
  credits_per_free_month: 100,

  max_markers_zoom_2: 200,
  max_markers_zoom_3: 400,
  max_markers_zoom_4: 800,

  map_default_lat: 20,
  map_default_lng: 0,
  map_default_zoom: 2,

  reports_to_hide: 8,
  reporters_to_hide: 5,

  currency_hint: "EUR",
};

/*
 * TWO CACHES, NOT ONE — AND WHY THE FIVE-SECOND ONE STILL FAILED
 *
 * Everything in `site_settings` is read on nearly every request, and
 * almost none of it changes during a day. A minute of staleness on a
 * label, a length limit or a map zoom costs nothing.
 *
 * The maintenance switch is the exception, and it is the whole reason
 * there were two caches. It is an emergency lever: the moment it is
 * flipped, the site should be resting.
 *
 * THAT WAS THE BUG. The switch had a five-second window of its own,
 * and getSettings refreshed it on every call — so in principle it
 * turned over quickly. But each warm serverless instance keeps ITS
 * OWN copy of these module-level variables, and the sequence below is
 * what made the switch feel dead:
 *
 *   1. An admin flips the switch and the row is written. Correct.
 *   2. `clearSettingsCache()` runs, so the cache is emptied. Correct.
 *   3. But clearing it in the instance that handled the save does
 *      nothing for the dozen others still serving requests, each
 *      holding the pre-flip row. Nothing here can reach them: there
 *      is no shared cache, so there is no shared invalidation.
 *   4. Those instances go on answering `maintenance_mode: false`
 *      until their own window expires — and on a busy site, every
 *      request through them can push that window forward again.
 *
 * The fix is not a cleverer cache. It is to stop caching the one
 * field that must not be stale: `readMaintenanceMode` now always asks
 * the database, and the row cache is allowed to hold everything else.
 * One indexed lookup on a single-column primary key, on requests where
 * the proxy already touches the database for the session — a cost
 * worth paying for a lever that has to work the first time.
 *
 * WHAT IS STILL NOT PROVEN
 *
 * Nobody has watched this in the Vercel logs. The reasoning above is
 * sound and the double read in proxy.ts was certainly wrong, but the
 * only way to know is to flip the switch and watch. If it still does
 * not take, the next suspect is the save itself — whether the row is
 * actually written — and that is read from the database, not guessed.
 */

let cached: SiteSettings | null = null;
let cachedAt = 0;
const CACHE_TTL = 1000 * 60; // 1 minute — everything except the switch

export async function getSettings(): Promise<SiteSettings> {
  if (cached && Date.now() - cachedAt < CACHE_TTL) {
    /*
     * The cached copy is a minute old, which is fine for the rest of
     * it and not fine for this one field. Asked fresh, every time.
     */
    return { ...cached, maintenance_mode: await readMaintenanceMode() };
  }

  try {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("site_settings")
      .select("*")
      .eq("id", 1)
      .single();

    if (error || !data) {
      console.error(
        "[getSettings]",
        error?.message ?? "no site_settings row with id = 1"
      );

      return DEFAULT_SETTINGS;
    }

    cached = { ...DEFAULT_SETTINGS, ...(data as SiteSettings) };
    cachedAt = Date.now();

    return cached;
  } catch (error) {
    console.error("[getSettings] threw:", error);

    return DEFAULT_SETTINGS;
  }
}

/**
 * The maintenance flag, asked fresh every single time.
 *
 * One column, not the whole row — and no cache at all. The five-second
 * window that used to live here was the last place a stale `false`
 * could hide, in a warm instance that had not yet noticed the switch
 * had been thrown. Five seconds is short, but “the site stays up for
 * another five seconds” is not a property an emergency lever should
 * have.
 *
 * A failure returns the last known value rather than `false`: an
 * unreachable database must not be what lifts a maintenance mode,
 * since that is the one moment the site most needs to stay closed.
 * It returns THAT and not the default, so a blip does not silently
 * un-rest a site that was resting.
 */
let lastKnownMaintenance: boolean | null = null;

export async function readMaintenanceMode(): Promise<boolean> {
  try {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("site_settings")
      .select("maintenance_mode")
      .eq("id", 1)
      .single();

    if (error) {
      console.error("[readMaintenanceMode]", error.message);

      return lastKnownMaintenance ?? DEFAULT_SETTINGS.maintenance_mode;
    }

    if (!data) {
      console.error("[readMaintenanceMode] no site_settings row with id = 1");

      return lastKnownMaintenance ?? DEFAULT_SETTINGS.maintenance_mode;
    }

    lastKnownMaintenance = Boolean(data.maintenance_mode);

    return lastKnownMaintenance;
  } catch (error) {
    console.error("[readMaintenanceMode] threw:", error);

    return lastKnownMaintenance ?? DEFAULT_SETTINGS.maintenance_mode;
  }
}

export async function isAdmin(): Promise<boolean> {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user?.email) return false;

    const { data } = await supabase
      .from("admins")
      .select("email")
      .eq("email", user.email)
      .maybeSingle();

    return !!data;
  } catch {
    return false;
  }
}

/*
 * Emptied after a settings save, so the instance that handled the
 * write does not go on serving its own stale copy.
 *
 * It does NOT reach the other warm instances — nothing can, from
 * here. That is why the switch above is not cached: clearing a cache
 * you cannot clear everywhere is not a strategy, and the field that
 * matters most is the one that must not depend on it.
 */
export function clearSettingsCache() {
  cached = null;
  cachedAt = 0;
}
