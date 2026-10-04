"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { awardCredits, awardPlaceCreditsOnce } from "@/lib/services/credits";

/* Postgres refuses the second insert in the same week. Turn that into
   something a person can read. */

function explain(error: { code?: string; message: string }): string {
  if (error.code === "23505") {
    return "You already checked this week. Come back in a few days.";
  }

  return error.message;
}

export async function verifyField(
  placeId: string,
  fieldKey: string
): Promise<void> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("You need to be signed in to verify.");
  }

  const displayName = (user.email ?? "").split("@")[0] || "someone";

  const { error } = await supabase.from("place_field_checks").insert({
    place_id: placeId,
    field_key: fieldKey as never,
    verified_by: user.id,
    verified_by_name: displayName,
    value_snapshot: null,
    comment: null,
  });

  if (error) {
    console.error("[verifyField]", error.message, error.details, error.hint);
    throw new Error(explain(error));
  }

  await awardCredits({
    userId: user.id,
    action: "confirm_place",
    placeId,
  });

  /* The person who added this place earns its credits now — but only
     because somebody else has just confirmed it. That is the whole
     defence against adding empty pins for the reward. */
  await awardPlaceCreditsOnce(placeId, user.id);

  revalidatePath(`/place/${placeId}`);
}

export async function confirmStillOpen(placeId: string): Promise<void> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("You need to be signed in to confirm.");
  }

  const { error } = await supabase.from("place_confirmations").insert({
    place_id: placeId,
    user_id: user.id,
  });

  if (error) {
    console.error("[confirmStillOpen]", error.message, error.details);
    throw new Error(explain(error));
  }

  await awardCredits({
    userId: user.id,
    action: "confirm_place",
    placeId,
  });

  await awardPlaceCreditsOnce(placeId, user.id);

  revalidatePath(`/place/${placeId}`);
}

/* Has this user already said "still open" this week? Lets the button
   say so before it is pressed. */
export async function hasConfirmedThisWeek(
  placeId: string,
  userId: string
): Promise<boolean> {
  const supabase = await createClient();

  const since = new Date();
  since.setDate(since.getDate() - 7);

  const { count } = await supabase
    .from("place_confirmations")
    .select("id", { count: "exact", head: true })
    .eq("place_id", placeId)
    .eq("user_id", userId)
    .gte("created_at", since.toISOString());

  return (count ?? 0) > 0;
}
