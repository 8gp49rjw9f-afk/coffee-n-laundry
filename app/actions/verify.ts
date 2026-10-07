"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { awardCredits, awardPlaceCreditsOnce } from "@/lib/services/credits";
import { displayNameFor } from "@/lib/database/places";

/*
 * A Postgres code, turned into one of ours.
 *
 * The raw message used to be returned here, which put database text
 * in front of a person. Now every path leads to a code the catalogue
 * knows, and an unrecognised failure becomes VERIFY_FAILED rather
 * than whatever Postgres happened to say.
 */

function explain(error: { code?: string }): string {
  return error.code === "23505" ? "VERIFY_ALREADY_THIS_WEEK" : "VERIFY_FAILED";
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
    throw new Error("VERIFY_SIGNED_OUT");
  }

  /*
   * The username, not the local part of the email — the last place
   * the old convention survived. Two people called simon were still
   * both "simon" on their own verifications, which is exactly what
   * the username was introduced to stop.
   */
  const displayName = await displayNameFor(user.id);

  const { error } = await supabase.from("place_field_checks").insert({
    place_id: placeId,
    field_key: fieldKey as never,
    verified_by: user.id,
    verified_by_name: displayName,
    value_snapshot: null,
    comment: null,
  });

  if (error) {
    /* The raw message stays in the logs, where it is useful. */
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
    throw new Error("VERIFY_SIGNED_OUT");
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
