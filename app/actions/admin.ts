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
 * message inside it. Six places here used to end with
 * `\`...: ${error.message}\``, which put constraint names and table
 * names in front of an admin. The raw text still goes to the logs;
 * the code goes to the popup.
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

  const { error } = await supabase
    .from("site_settings")
    .update({
      site_name: str("site_name", current.site_name),
      tagline: str("tagline", current.tagline),

      /* Subscription. The threshold is what decides when a month is
         free — it applies to what comes next, and a balance already
         earned is never touched. */
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

  /* The service caches for a minute; without this the admin would
     save and still see the old values. */
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

/*
 * Three ways out of the queue, and they are not the same thing:
 *
 *   reject  — the report was wrong. Mark it resolved, move on.
 *   flag    — the information is doubtful. The place stays on the
 *             map with a warning on it ('unverified').
 *   close   — the place is gone. It disappears from the map ('closed').
 *
 * Closing also takes back the credits the place paid. That is the
 * half of the anti-farming rule that was missing: without it, adding
 * ten invented places, letting two of them be confirmed by distracted
 * strangers, and keeping the points was a profitable afternoon.
 */

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

  /* Taking the credits back, on a close. The ledger is append-only,
     so this writes a negative row rather than deleting anything — the
     history stays honest about what happened. */
  if (outcome === "close") {
    await revokePlaceCredits(placeId, "Place closed by an admin");
  }

  /* Every open report on this place closes together: leaving the rest
     in the queue would ask the next admin the same question again. */
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
    console.error("[restorePlace]", error.message);

    throw new Error("ADMIN_RESTORE_FAILED");
  }

  revalidatePath("/admin");
  revalidatePath(`/place/${placeId}`);
  revalidatePath("/");
}

/* ---------- deleting a place completely ---------- */

/*
 * Removing a place, for good.
 *
 * Not the same thing as closing one. Closing sets status = 'closed':
 * the place leaves the map and restorePlace can bring it back, which
 * is the right answer for a laundromat that shut down, or a report
 * that turned out to be wrong.
 *
 * Deleting is for a place that should never have been on the map:
 * invented to farm credits, spam, a duplicate, something illegal.
 * Keeping a row for those is a hiding place, not a safety net. It
 * cannot be undone, so the button that calls it asks first.
 *
 * ADMINS ONLY — any admin, not only the master. The button lives on
 * the place page, but the check is here, on the server: a hidden
 * button protects nothing, since this function is reachable by anyone
 * who can forge a request.
 *
 * THE ORDER MATTERS
 *
 * Credits are withdrawn first, through the same append-only ledger
 * the close path uses — a negative row, never a deletion, so the
 * history stays honest. Then every child row, then the place itself.
 * If a step fails the function stops: a place still on the map with
 * its credits intact is recoverable, a place gone with its credits
 * left behind is not.
 */

export async function deletePlace(formData: FormData): Promise<void> {
  await requireAdmin();

  const supabase = await createClient();

  const placeId = String(formData.get("place_id") ?? "");

  if (!placeId) throw new Error("PLACE_NOT_FOUND");

  /* Read first, so a stale page cannot delete something that is no
     longer there — and so the failure is a readable code rather than
     a silent zero-row delete. */
  const { data: place, error: readError } = await supabase
    .from("places")
    .select("name")
    .eq("id", placeId)
    .maybeSingle();

  if (readError || !place) {
    console.error("[deletePlace] read", readError?.message ?? "not found");

    throw new Error("PLACE_NOT_FOUND");
  }

  /* Before the row goes: revokePlaceCredits looks the place up by id. */
  await revokePlaceCredits(placeId, "Place deleted by an admin");

  /* Every table that points at this place, cleared before its parent.
     A foreign key would otherwise block the delete, or leave rows
     pointing at a place that no longer exists.

     The list is wider than this schema on purpose: a table that is not
     there is skipped rather than fatal, so a place is never left
     half-deleted over a name that did not exist. 42P01 is Postgres
     for "undefined table". */
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

/*
 * WHO MAY CHANGE THE LIST, AND WHY THAT IS NOT NEGOTIABLE
 *
 * Every function below opens with requireMaster(). Adding an admin,
 * promoting one, removing one — none of it is an admin's business.
 * An admin runs the site; a master decides who runs the site. The
 * menu hides this panel from a plain admin, but the menu is only the
 * shape of the screen: these functions are reachable by anyone who
 * can forge a request, so the gate is here.
 */

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

/*
 * WHO A MASTER IS, AND HOW ONE LEAVES
 *
 * The rule, as it was finally stated: A MASTER CAN ONLY REMOVE
 * THEMSELVES. Nobody else can remove a master — not another master,
 * not an ordinary admin.
 *
 * So there is no "master removal" here at all, and no request-and-vote
 * flow either: a master who wants out does it from their own row, and
 * the only thing standing between them and the door is the count.
 *
 * That is what the checks below are, in order:
 *
 *   1. not yourself, unless you ARE a master and you are the target
 *   2. never another master
 *   3. never the last master, which the database refuses too
 *
 * (3) is belt and braces on purpose. 0023 puts a trigger under this
 * table that refuses to delete the last master row whoever runs the
 * statement — including a hand-typed DELETE in the Supabase editor.
 * The check here exists so the failure arrives as a readable code
 * instead of a Postgres exception, not because the database needs
 * the help.
 */
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

  /*
   * The two refusals, and the order between them matters for the
   * message the person reads.
   *
   * Removing ANOTHER master is refused first: it is the rule that is
   * absolute, and it does not depend on how many masters there are.
   * "A master steps down on their own" is the sentence that teaches
   * the rule; "the last master stays" would answer a different
   * question than the one being asked.
   */
  if (row.is_master && target !== self) {
    throw new Error("ADMIN_OTHER_MASTER_REMOVE");
  }

  /* Stepping down, or removing an ordinary admin — both are allowed,
     but the last master cannot leave. Counted across the table, not
     against the caller: what matters is how many are left, not who
     is asking. */
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

/*
 * MAKING AN ADMIN A MASTER
 *
 * A master can hand the level to another admin. That is the only way
 * a second master comes into being — there is no self-service path
 * to it, which is the point of the level.
 *
 * ANY ADMIN, including the master who promoted them, can later be
 * removed from the panel — an ordinary admin by any master, a master
 * only by themselves. Promotion is not permanent, and it is not
alse meant to be: the whole reason the removal rule exists is that
 * a list of masters can go wrong.
 */
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

/*
 * The notification switch, one per admin.
 *
 * Cancelling it is not a downgrade: the admin keeps the panel, keeps
 * every other right. It only stops the copy of what a visitor wrote
 * from arriving in their inbox.
 *
 * ANY admin may set this — including their own — because it changes
 * what they receive, not who can act. Only the master decides who the
 * admins are, and that rule is untouched here.
 *
 * THE LAST ONE CANNOT OPT OUT
 *
 * Three things land in these inboxes, all three through the same
 * switch: a bug report, a message from the contact form, and a
 * "something is wrong with this place" report. With every switch off,
 * the three senders find no recipients and the messages are lost
 * silently — the forms would look like they worked. So turning the
 * last one off is refused with a code of its own.
 */
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

  /* Leaving the last recipient alone. Counting only when a switch is
     being turned OFF, so the ordinary case costs no extra query. */
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
