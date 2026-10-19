"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { requireAdmin, requireMaster } from "@/lib/services/admin";
import { clearSettingsCache } from "@/lib/services/settings";
import { revokePlaceCredits } from "@/lib/services/credits";

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
 *
 * Every failure throws a CODE, never a sentence with a database
 * message inside it.
 */

/* ---------- site settings ---------- */

/*
 * The form sends only what it shows. Each field is read with a
 * fallback to the value already in the row, so a form that covers
 * part of the settings can never blank out the rest.
 *
 * That fallback is why the list below and the list of fields on the
 * form have to stay in step. A field the form sends but this function
 * never reads is simply ignored; a field this function writes but the
 * form never sends becomes its fallback — which for a number is 0.
 */

/*
 * A payment address, made absolute.
 *
 * The field says "Payment address" and people type what PayPal shows
 * them: `paypal.me/CoffeeNLaundry`. That is not a URL a browser will
 * follow on its own — and without a scheme it is treated as a PATH on
 * our own site, which is how a tap on the button landed on the 404.
 *
 * So the scheme is added here rather than demanded of the person.
 * Anything already absolute is left exactly as typed, and anything
 * else gets `https://` in front. An empty value stays empty, which is
 * the switch being off rather than an error.
 *
 * A scheme that is not http(s) is REFUSED rather than rewritten: a
 * `javascript:` in a link is not a typo, and prefixing it would be
 * worse than dropping it.
 */
function absoluteUrl(value: string): string {
  const text = value.trim();

  if (!text) return "";

  if (/^https?:\/\//i.test(text)) return text;

  if (/^[a-z][a-z0-9+.-]*:/i.test(text)) return "";

  return `https://${text.replace(/^\/+/, "")}`;
}

export async function saveSettings(formData: FormData): Promise<void> {
  await requireAdmin();

  const supabase = await createClient();

  const { data: current } = await supabase
    .from("site_settings")
    .select("*")
    .eq("id", 1)
    .maybeSingle();

  if (!current) throw new Error("ADMIN_SETTINGS_MISSING");

  const str = (key: string, fallback: string) => {
    const raw = formData.get(key);

    return raw == null ? fallback : String(raw).trim();
  };

  const num = (key: string, fallback: number) => {
    const raw = formData.get(key);
    const n = Number(raw);

    return raw != null && String(raw).trim() !== "" && Number.isFinite(n)
      ? n
      : fallback;
  };

  const bool = (key: string, fallback: boolean) => {
    const raw = formData.get(key);

    return raw == null ? fallback : String(raw) === "true";
  };

  const row = current as {
    donation_enabled?: boolean;
    donation_url?: string | null;
    donation_amount?: number;
  };

  /*
   * The donation address, put in the shape the button needs.
   *
   * The stored value may have been typed without `https://` — the
   * field does not demand it, and the first version of this function
   * stored whatever arrived. The button then refused to build a link
   * and hid itself, with nothing on screen to say why. Normalising
   * here repairs a value already saved as well as one typed now.
   */
  const donationInput = str("donation_url", row.donation_url ?? "");
  const donationUrl = absoluteUrl(donationInput) || null;

  /* The amount, kept inside what 0025 allows: a donation of zero
     opens a payment page with nothing to pay. */
  const amount = num("donation_amount", row.donation_amount ?? 2);
  const donationAmount = Math.min(1000, Math.max(1, Math.round(amount)));

  const { error } = await supabase
    .from("site_settings")
    .update({
      site_name: str("site_name", current.site_name),
      tagline: str("tagline", current.tagline),

      subscription_price_usd: num(
        "subscription_price_usd",
        current.subscription_price_usd
      ),
      free_period_days: num("free_period_days", current.free_period_days),
      credits_per_free_month: num(
        "credits_per_free_month",
        current.credits_per_free_month
      ),

      maintenance_mode: bool("maintenance_mode", current.maintenance_mode),
      maintenance_message:
        str("maintenance_message", current.maintenance_message ?? "") || null,

      donation_enabled: bool("donation_enabled", row.donation_enabled ?? false),
      donation_url: donationUrl,
      donation_amount: donationAmount,

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
    console.error("[saveSettings]", error.message);

    throw new Error("ADMIN_SETTINGS_SAVE_FAILED");
  }

  clearSettingsCache();

  revalidatePath("/admin");
  revalidatePath("/");
  revalidatePath("/pricing");
}

/* ---------- credit rules ---------- */

export async function saveCreditRule(formData: FormData): Promise<void> {
  await requireAdmin();

  const supabase = await createClient();

  const actionKey = String(formData.get("action_key") ?? "");

  if (!actionKey) throw new Error("ADMIN_RULE_SAVE_FAILED");

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
    console.error("[saveCreditRule]", error.message);

    throw new Error("ADMIN_RULE_SAVE_FAILED");
  }

  revalidatePath("/admin");
}

/* ---------- moderation ---------- */

export async function resolveReport(formData: FormData): Promise<void> {
  await requireAdmin();

  const supabase = await createClient();

  const placeId = String(formData.get("place_id") ?? "");
  const outcome = String(formData.get("outcome") ?? "reject");

  if (!placeId) throw new Error("PLACE_NOT_FOUND");

  if (outcome === "flag" || outcome === "close") {
    const { error } = await supabase
      .from("places")
      .update({ status: outcome === "close" ? "closed" : "unverified" })
      .eq("id", placeId);

    if (error) {
      console.error("[resolveReport] place", error.message);

      throw new Error("ADMIN_PLACE_UPDATE_FAILED");
    }
  }

  if (outcome === "close") {
    await revokePlaceCredits(placeId, "Place closed by an admin");
  }

  const { error } = await supabase
    .from("place_reports")
    .update({ resolved: true })
    .eq("place_id", placeId)
    .eq("resolved", false);

  if (error) {
    console.error("[resolveReport] reports", error.message);

    throw new Error("ADMIN_REPORTS_CLOSE_FAILED");
  }

  revalidatePath("/admin");
  revalidatePath(`/place/${placeId}`);
  revalidatePath("/");
}

export async function restorePlace(placeId: string): Promise<void> {
  await requireAdmin();

  const supabase = await createClient();

  const { error } = await supabase
    .from("places")
    .update({ status: "active" })
    .eq("id", placeId);

  if (error) {
    console.error("[restorePlace]", error.message);

    throw new Error("ADMIN_RESTORE_FAILED");
  }

  revalidatePath("/admin");
  revalidatePath(`/place/${placeId}`);
  revalidatePath("/");
}

/* ---------- deleting a place completely ---------- */

export async function deletePlace(formData: FormData): Promise<void> {
  await requireAdmin();

  const supabase = await createClient();

  const placeId = String(formData.get("place_id") ?? "");

  if (!placeId) throw new Error("PLACE_NOT_FOUND");

  const { data: place, error: readError } = await supabase
    .from("places")
    .select("name")
    .eq("id", placeId)
    .maybeSingle();

  if (readError || !place) {
    console.error("[deletePlace] read", readError?.message ?? "not found");

    throw new Error("PLACE_NOT_FOUND");
  }

  await revokePlaceCredits(placeId, "Place deleted by an admin");

  const children = [
    "place_photos",
    "place_reports",
    "place_confirmations",
    "place_updates",
    "place_field_checks",
    "place_prices",
    "place_comments",
  ];

  for (const table of children) {
    const { error } = await supabase
      .from(table)
      .delete()
      .eq("place_id", placeId);

    if (error && error.code !== "42P01") {
      console.error(`[deletePlace] ${table}`, error.message);

      throw new Error("ADMIN_DELETE_FAILED");
    }
  }

  const { error } = await supabase.from("places").delete().eq("id", placeId);

  if (error) {
    console.error("[deletePlace] places", error.message);

    throw new Error("ADMIN_DELETE_FAILED");
  }

  revalidatePath("/admin");
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
    throw new Error("ADMIN_EMAIL_INVALID");
  }

  const { error } = await supabase.from("admins").insert({ email });

  if (error) {
    console.error("[addAdmin]", error.message);

    throw new Error(
      error.code === "23505" ? "ADMIN_ALREADY_ADMIN" : "ADMIN_REMOVE_FAILED"
    );
  }

  revalidatePath("/admin");
}

export async function removeAdmin(email: string): Promise<void> {
  const master = await requireMaster();

  const supabase = await createClient();

  const target = email.trim().toLowerCase();
  const self = master.email.toLowerCase();

  const { data: row, error: readError } = await supabase
    .from("admins")
    .select("is_master")
    .eq("email", target)
    .maybeSingle();

  if (readError || !row) {
    console.error("[removeAdmin] read", readError?.message ?? "not found");

    throw new Error("ADMIN_REMOVE_FAILED");
  }

  if (row.is_master && target !== self) {
    throw new Error("ADMIN_OTHER_MASTER_REMOVE");
  }

  if (row.is_master) {
    const { data: others } = await supabase
      .from("admins")
      .select("email")
      .eq("is_master", true)
      .neq("email", target)
      .limit(1);

    if (!others || others.length === 0) {
      throw new Error("ADMIN_LAST_MASTER");
    }
  }

  const { error } = await supabase
    .from("admins")
    .delete()
    .eq("email", target);

  if (error) {
    console.error("[removeAdmin]", error.message);

    throw new Error("ADMIN_REMOVE_FAILED");
  }

  revalidatePath("/admin");
}

export async function promoteAdmin(email: string): Promise<void> {
  await requireMaster();

  const supabase = await createClient();

  const target = email.trim().toLowerCase();

  const { data: row, error: readError } = await supabase
    .from("admins")
    .select("is_master")
    .eq("email", target)
    .maybeSingle();

  if (readError || !row) {
    console.error("[promoteAdmin] read", readError?.message ?? "not found");

    throw new Error("ADMIN_PROMOTE_FAILED");
  }

  if (row.is_master) {
    throw new Error("ADMIN_ALREADY_MASTER");
  }

  const { error } = await supabase
    .from("admins")
    .update({ is_master: true })
    .eq("email", target);

  if (error) {
    console.error("[promoteAdmin]", error.message);

    throw new Error("ADMIN_PROMOTE_FAILED");
  }

  revalidatePath("/admin");
}

export async function setAdminNotify(formData: FormData): Promise<void> {
  await requireAdmin();

  const supabase = await createClient();

  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();

  const next = String(formData.get("notify_email")) === "true";

  if (!email) throw new Error("ADMIN_EMAIL_INVALID");

  const { data: row, error: readError } = await supabase
    .from("admins")
    .select("notify_email")
    .eq("email", email)
    .maybeSingle();

  if (readError || !row) {
    console.error("[setAdminNotify] read", readError?.message ?? "not found");

    throw new Error("ADMIN_NOTIFY_SAVE_FAILED");
  }

  if (!next && row.notify_email === true) {
    const { data: others } = await supabase
      .from("admins")
      .select("email")
      .eq("notify_email", true)
      .neq("email", email)
      .limit(1);

    if (!others || others.length === 0) {
      throw new Error("ADMIN_LAST_NOTIFY");
    }
  }

  const { error } = await supabase
    .from("admins")
    .update({ notify_email: next })
    .eq("email", email);

  if (error) {
    console.error("[setAdminNotify]", error.message);

    throw new Error("ADMIN_NOTIFY_SAVE_FAILED");
  }

  revalidatePath("/admin");
}
