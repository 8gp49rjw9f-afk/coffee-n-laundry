"use server";

import { redirect } from "next/navigation";
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

export async function reportPlace(formData: FormData): Promise<void> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const placeId = String(formData.get("place_id") ?? "");
  const reason = String(formData.get("reason") ?? "").trim();

  if (!placeId || !reason) throw new Error("REPORT_REASON_REQUIRED");

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
    throw new Error("REPORT_ALREADY_SENT");
  }

  if (error) {
    console.error("[reportPlace]", error.message);

    throw new Error("REPORT_FAILED");
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

  revalidatePath(`/place/${placeId}`);
  revalidatePath("/");

  redirect(`/place/${placeId}?reported=1`);
}
