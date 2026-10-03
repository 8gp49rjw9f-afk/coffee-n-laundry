"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { requireAdmin, requireMaster } from "@/lib/services/admin";
import { clearSettingsCache } from "@/lib/services/settings";

/* ====================================================== */
/* ADMIN ACTIONS                                            */
/* ====================================================== */

/*
 * Every one of these opens with a gate. The menu hides /admin from
 * people who are not admins, but a menu is only a suggestion — these
 * functions are reachable by anyone who can forge a request, so the
 * check happens here, on the server, every time.
 *
 * The database repeats the check through RLS. Two locks, because the
 * cost of being wrong is an open admin panel.
 */

/* ---------- site settings ---------- */

/*
 * The form sends only what it shows. Each field is read with a
 * fallback to the value already in the row, so a form that covers
 * part of the settings can never blank out the rest.
 */

export async function saveSettings(formData: FormData): Promise<void> {
  await requireAdmin();

  const supabase = await createClient();

  const { data: current } = await supabase
    .from("site_settings")
    .select("*")
    .eq("id", 1)
    .maybeSingle();

  if (!current) throw new Error("Site settings are missing.");

  const str = (key: string, fallback: string) => {
    const raw = formData.get(key);

    return raw == null ? fallback : String(raw).trim();
  };

  const num = (key: string, fallback: number) => {
    const raw = formData.get(key);
    const n = Number(raw);

    return raw != null && Number.isFinite(n) ? n : fallback;
  };

  const bool = (key: string, fallback: boolean) => {
    const raw = formData.get(key);

    return raw == null ? fallback : String(raw) === "true";
  };

  const { error } = await supabase
    .from("site_settings")
    .update({
      site_name: str("site_name", current.site_name),
      tagline: str("tagline", current.tagline),

      maintenance_mode: bool("maintenance_mode", current.maintenance_mode),
      maintenance_message:
        str("maintenance_message", current.maintenance_message ?? "") || null,

      registrations_enabled: bool(
        "registrations_enabled",
        current.registrations_enabled
      ),

      max_photo_size_mb: num("max_photo_size_mb", current.max_photo_size_mb),
      max_name_length: num("max_name_length", current.max_name_length),
      max_description_length: num(
        "max_description_length",
        current.max_description_length
      ),
      max_comment_length: num(
        "max_comment_length",
        current.max_comment_length
      ),
      max_places_per_user_per_day: num(
        "max_places_per_user_per_day",
        current.max_places_per_user_per_day
      ),
      min_minutes_between_updates: num(
        "min_minutes_between_updates",
        current.min_minutes_between_updates
      ),

      reports_to_hide: num("reports_to_hide", current.reports_to_hide),
      reporters_to_hide: num("reporters_to_hide", current.reporters_to_hide),

      currency_hint: str("currency_hint", current.currency_hint)
        .toUpperCase()
        .slice(0, 3),

      map_default_lat: num("map_default_lat", current.map_default_lat),
      map_default_lng: num("map_default_lng", current.map_default_lng),
      map_default_zoom: num("map_default_zoom", current.map_default_zoom),

      max_markers_zoom_2: num(
        "max_markers_zoom_2",
        current.max_markers_zoom_2
      ),
      max_markers_zoom_3: num(
        "max_markers_zoom_3",
        current.max_markers_zoom_3
      ),
      max_markers_zoom_4: num(
        "max_markers_zoom_4",
        current.max_markers_zoom_4
      ),

      updated_at: new Date().toISOString(),
    })
    .eq("id", 1);

  if (error) {
    throw new Error(`Could not save the settings: ${error.message}`);
  }

  /* The service caches for a minute; without this the admin would
     save and still see the old values. */
  clearSettingsCache();

  revalidatePath("/admin");
  revalidatePath("/");
}

/* ---------- credit rules ---------- */

export async function saveCreditRule(formData: FormData): Promise<void> {
  await requireAdmin();

  const supabase = await createClient();

  const actionKey = String(formData.get("action_key") ?? "");

  if (!actionKey) throw new Error("Which rule?");

  const rawCap = formData.get("daily_cap");

  const cap =
    rawCap == null || String(rawCap).trim() === ""
      ? null
      : Number(rawCap);

  const { error } = await supabase
    .from("credit_rules")
    .update({
      credits: Number(formData.get("credits") ?? 0),
      daily_cap: cap != null && Number.isFinite(cap) ? cap : null,
      active: String(formData.get("active")) === "true",
      updated_at: new Date().toISOString(),
    })
    .eq("action_key", actionKey);

  if (error) {
    throw new Error(`Could not save that rule: ${error.message}`);
  }

  revalidatePath("/admin");
}

/* ---------- moderation ---------- */

/*
 * Three ways out of the queue, and they are not the same thing:
 *
 *   reject  — the report was wrong. Mark it resolved, move on.
 *   flag    — the information is doubtful. The place stays on the
 *             map with a warning on it ('unverified').
 *   close   — the place is gone. It disappears from the map ('closed').
 */

export async function resolveReport(formData: FormData): Promise<void> {
  await requireAdmin();

  const supabase = await createClient();

  const placeId = String(formData.get("place_id") ?? "");
  const outcome = String(formData.get("outcome") ?? "reject");

  if (!placeId) throw new Error("That place is gone.");

  if (outcome === "flag" || outcome === "close") {
    const { error } = await supabase
      .from("places")
      .update({ status: outcome === "close" ? "closed" : "unverified" })
      .eq("id", placeId);

    if (error) {
      throw new Error(`Could not change the place: ${error.message}`);
    }
  }

  /* Every open report on this place closes together: leaving the rest
     in the queue would ask the next admin the same question again. */
  const { error } = await supabase
    .from("place_reports")
    .update({ resolved: true })
    .eq("place_id", placeId)
    .eq("resolved", false);

  if (error) {
    throw new Error(`Could not close the reports: ${error.message}`);
  }

  revalidatePath("/admin");
  revalidatePath(`/place/${placeId}`);
  revalidatePath("/");
}

/* Brings a place back without touching the reports: the queue is
   about doubt, and this clears the doubt. */
export async function restorePlace(placeId: string): Promise<void> {
  await requireAdmin();

  const supabase = await createClient();

  const { error } = await supabase
    .from("places")
    .update({ status: "active" })
    .eq("id", placeId);

  if (error) {
    throw new Error(`Could not restore that place: ${error.message}`);
  }

  revalidatePath("/admin");
  revalidatePath(`/place/${placeId}`);
  revalidatePath("/");
}

/* ---------- admins: master only ---------- */

export async function addAdmin(formData: FormData): Promise<void> {
  await requireMaster();

  const supabase = await createClient();

  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();

  if (!email || !email.includes("@")) {
    throw new Error("That does not look like an email address.");
  }

  const { error } = await supabase.from("admins").insert({ email });

  if (error) {
    throw new Error(
      error.code === "23505"
        ? "That address is already an admin."
        : `Could not add that admin: ${error.message}`
    );
  }

  revalidatePath("/admin");
}

/*
 * A master cannot be removed here, and cannot remove themselves: a
 * panel that can lock its own last key holder out is a trap.
 */
export async function removeAdmin(email: string): Promise<void> {
  const master = await requireMaster();

  const target = email.trim().toLowerCase();

  if (target === master.email.toLowerCase()) {
    throw new Error("You cannot remove your own master account.");
  }

  const supabase = await createClient();

  const { data: row } = await supabase
    .from("admins")
    .select("is_master")
    .eq("email", target)
    .maybeSingle();

  if (row?.is_master) {
    throw new Error("A master account cannot be removed.");
  }

  const { error } = await supabase
    .from("admins")
    .delete()
    .eq("email", target);

  if (error) {
    throw new Error(`Could not remove that admin: ${error.message}`);
  }

  revalidatePath("/admin");
}
