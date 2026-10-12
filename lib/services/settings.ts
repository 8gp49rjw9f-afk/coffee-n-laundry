import { createClient } from "@/lib/supabase/server";

/* ====================================================== */
/* SITE SETTINGS — dynamic, editable without a deploy      */
/* ====================================================== */

export interface SiteSettings {
  site_name: string;
  tagline: string;

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
 * TWO CACHES, NOT ONE.
 *
 * Everything in `site_settings` is read on nearly every request —
 * the proxy alone runs on each one that is not a static asset — and
 * almost none of it changes during a day. A minute of staleness on
 * a label, a length limit or a map zoom costs nothing, and caching
 * it keeps a database read off the hot path.
 *
 * The maintenance switch is the exception, and it is the reason
 * these are two caches rather than one. It is an emergency lever:
 * the moment it is flipped, the site should be resting. Under the
 * single minute-long cache it took up to sixty seconds to bite,
 * repeated per warm instance on Vercel — long enough that flipping
 * it looked like it did nothing at all, which is exactly what it
 * looked like.
 *
 * So the switch gets its own short window. Five seconds is fast
 * enough that a person who flips it, reloads and finds the site
 * still up knows something else is wrong, and slow enough that a
 * burst of traffic does not turn into a burst of queries.
 */

let cached: SiteSettings | null = null;
let cachedAt = 0;
const CACHE_TTL = 1000 * 60; // 1 minute — everything but the switch

let cachedMaintenance: boolean | null = null;
let cachedMaintenanceAt = 0;
const MAINTENANCE_TTL = 1000 * 5; // 5 seconds

export async function getSettings(): Promise<SiteSettings> {
  if (cached && Date.now() - cachedAt < CACHE_TTL) {
    /*
     * The cached copy is a minute old, which is fine for the rest of
     * it and not fine for this one field. Ask about the switch on its
     * own, far more cheaply than re-reading the whole row.
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
      return DEFAULT_SETTINGS;
    }

    cached = { ...DEFAULT_SETTINGS, ...(data as SiteSettings) };
    cachedAt = Date.now();

    /* The row just told us the switch's value, so start its own
       window from now rather than making a second query. */
    cachedMaintenance = cached.maintenance_mode;
    cachedMaintenanceAt = Date.now();

    return cached;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

/**
 * The maintenance flag, on a five-second window of its own.
 *
 * One column, not the whole row. A failure returns the last known
 * value rather than `false`: an unreachable database must not be
 * what lifts a maintenance mode, since that is the one moment the
 * site most needs to stay closed.
 */
async function readMaintenanceMode(): Promise<boolean> {
  if (cachedMaintenance !== null && Date.now() - cachedMaintenanceAt < MAINTENANCE_TTL) {
    return cachedMaintenance;
  }

  try {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("site_settings")
      .select("maintenance_mode")
      .eq("id", 1)
      .single();

    if (error || !data) {
      return cachedMaintenance ?? DEFAULT_SETTINGS.maintenance_mode;
    }

    cachedMaintenance = Boolean(data.maintenance_mode);
    cachedMaintenanceAt = Date.now();

    return cachedMaintenance;
  } catch {
    return cachedMaintenance ?? DEFAULT_SETTINGS.maintenance_mode;
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

export function clearSettingsCache() {
  cached = null;
  cachedAt = 0;
  cachedMaintenance = null;
  cachedMaintenanceAt = 0;
}
