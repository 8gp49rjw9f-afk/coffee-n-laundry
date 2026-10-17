"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { getSettings } from "@/lib/services/settings";

/* ====================================================== */
/* REPORT — flag information that looks wrong              */
/* ====================================================== */

/*
 * A place is only hidden once enough *different* people say so.
 * Eight reports from two accounts is not a verdict, so the rule
 * counts both the reports and the distinct reporters.
 */

/*
 * WHY THIS RETURNS A CODE INSTEAD OF THROWING ONE
 *
 * It used to throw, and to end with `redirect(...)` on the way out.
 * Both are wrong for a caller that sits across the boundary, and the
 * combination produced a bug that looked like a total failure where
 * there was none.
 *
 *   - A thrown code is rewritten on its way to the browser. Next.js
 *     replaces the message with a generic sentence and keeps the real
 *     one in the logs, so `throw new Error("REPORT_FAILED")` arrives
 *     as something `describeError` cannot recognise. The person then
 *     sees "Something went wrong" and a reference that leads nowhere.
 *
 *   - A redirect in a Server Action is ALSO an exception, on purpose:
 *     Next.js throws a special one the client unwraps to navigate.
 *     So `await reportPlace(...)` inside a try/catch caught the
 *     SUCCESS as if it were a fault. Sending a report that worked
 *     perfectly showed the generic error card, every time.
 *
 * Returning `{ ok, code }` fixes both: a returned value crosses the
 * boundary intact, and nothing is thrown on the way out. The caller
 * decides what to show. This is the same contract `sendContact`
 * already used, which is why that form never had the problem.
 *
 * The final redirect is gone with it. It was there to land the person
 * back on the place page with `?reported=1`, but the form that calls
 * this already answers that question itself — and a redirect cannot
 * coexist with a returned result anyway.
 */

export interface ReportResult {
  ok: boolean;
  code?: string;
}

export async function reportPlace(formData: FormData): Promise<ReportResult> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  /* Signed out is a code, not a redirect: the form shows the popup
     the catalogue already has copy for, instead of navigating away
     from what the person was reading. */
  if (!user) {
    return { ok: false, code: "REPORT_SIGNED_OUT" };
  }

  const placeId = String(formData.get("place_id") ?? "");
  const reason = String(formData.get("reason") ?? "").trim();

  if (!placeId || !reason) {
    return { ok: false, code: "REPORT_REASON_REQUIRED" };
  }

  /* One report per person. The unique index enforces it, so a second
     press comes back as 23505 rather than adding a row — and that is
     not a failure worth alarming anyone about, so it is reported as
     "already sent" rather than as a fault. */
  const { error } = await supabase.from("place_reports").insert({
    place_id: placeId,
    reported_by: user.id,
    reason,
  });

  if (error && error.code === "23505") {
    return { ok: false, code: "REPORT_ALREADY_SENT" };
  }

  if (error) {
    console.error("[reportPlace]", error.message);

    return { ok: false, code: "REPORT_FAILED" };
  }

  const settings = await getSettings();

  const { count: reports } = await supabase
    .from("place_reports")
    .select("id", { count: "exact", head: true })
    .eq("place_id", placeId)
    .eq("resolved", false);

  const { data: reporters } = await supabase
    .from("place_reports")
    .select("reported_by")
    .eq("place_id", placeId)
    .eq("resolved", false);

  const distinct = new Set(
    (reporters ?? []).map((row) => row.reported_by).filter(Boolean)
  ).size;

  if (
    (reports ?? 0) >= settings.reports_to_hide &&
    distinct >= settings.reporters_to_hide
  ) {
    await supabase
      .from("places")
      .update({ status: "unverified" })
      .eq("id", placeId);
  }

  /*
   * And now the admins get told.
   *
   * A report was the one thing on this site that arrived nowhere: it
   * went into `place_reports` and waited for somebody to open the
   * moderation tab. On a quiet week that is fine; a reported place
   * can sit wrong on the map for days because nobody thought to look.
   *
   * This is the same call the contact form makes, so it lands in the
   * same inboxes and obeys the same per-admin switch — someone who
   * turned notifications off does not start getting these either.
   *
   * LAST, AND NEVER FATAL. The report is already saved by the time
   * this runs, so a failure here is only a missed notification, not a
   * lost report. Swallowing it is deliberate: the person reporting a
   * wrong wash price should not be told that the email bounced, and
   * the row is on the moderation tab either way.
   */
  await notifyAdmins({ placeId, reason });

  revalidatePath(`/place/${placeId}`);
  revalidatePath("/");

  return { ok: true };
}

/*
 * The notification itself, in its own function so the main path stays
 * readable and so this can never throw into it.
 *
 * The recipients are read here rather than imported from the contact
 * action: that module is `"use server"` too, and a helper it does not
 * export cannot be reused. The query is the same one, with the same
 * `notify_email` filter and the same service-key fallback.
 */
async function notifyAdmins({
  placeId,
  reason,
}: {
  placeId: string;
  reason: string;
}): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.CONTACT_FROM_EMAIL;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!apiKey || !from) return;

  try {
    let recipients: string[] = [];

    if (url && serviceKey) {
      const response = await fetch(
        `${url}/rest/v1/admins?select=email&notify_email=is.true&limit=20`,
        {
          headers: {
            apikey: serviceKey,
            Authorization: `Bearer ${serviceKey}`,
          },
          cache: "no-store",
        }
      );

      if (response.ok) {
        const rows = (await response.json()) as { email?: string }[];

        recipients = rows
          .map((row) => row.email)
          .filter((value): value is string => Boolean(value));
      } else {
        console.error("[notifyAdmins]", response.status, await response.text());
      }
    }

    /* Without a service key the visitor's own session is no use here
       — the reporter is not an admin — so there is nothing to fall
       back to. The report is saved regardless. */
    if (recipients.length === 0) return;

    /* The place's name, for a subject that says something. Read with
       the same public client: `places` is readable by RLS. */
    let name = "a place";

    const supabase = await createClient();

    const { data } = await supabase
      .from("places")
      .select("name")
      .eq("id", placeId)
      .maybeSingle();

    if (data?.name) name = data.name;

    const opening = reason.length > 60 ? `${reason.slice(0, 57)}…` : reason;

    const body = [
      reason,
      "",
      `Place: ${name}`,
      `Page: /place/${placeId}`,
    ].join("\n");

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: recipients,
        subject: `[coffee'n'laundry] Reported: ${opening}`,
        text: body,
      }),
    });

    if (!response.ok) {
      console.error("[notifyAdmins]", response.status, await response.text());
    }
  } catch (error) {
    console.error("[notifyAdmins]", error);
  }
}
