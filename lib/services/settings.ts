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

let cached: SiteSettings | null = null;
let cachedAt = 0;
const CACHE_TTL = 1000 * 60; // 1 minute

export async function getSettings(): Promise<SiteSettings> {
  if (cached && Date.now() - cachedAt < CACHE_TTL) {
    return cached;
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

    return cached;
  } catch {
    return DEFAULT_SETTINGS;
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
}
