import { createClient } from "@/lib/supabase/server";

import { awardAction, revokePlaceCredits } from "@/lib/services/credits";

/*
 * CHECKING A PLACE
 *
 * Two different jobs live under one word, and they were being
 * confused:
 *
 *   - A CHECK is someone who has actually been there telling us what
 *     has changed: the price, the hours, whether it still exists.
 *     That is worth a credit, because it is work.
 *
 *   - A CONFIRMATION is someone saying "yes, this place is real",
 *     which is what releases the deferred credit to whoever added it.
 *
 * So the credit for checking goes to the person checking, and the
 * credit for the place goes to the person who added it — but only
 * once, and only when somebody other than the author says so. A
 * person confirming their own place releases nothing, or the whole
 * system pays people for approving themselves.
 */

export interface CheckInput {
  placeId: string;
  userId: string;
  priceKinds: string[];
  note?: string | null;
  stillOpen: boolean;
}

/*
 * The display name attached to a check.
 *
 * It used to be the part of the email before the @, which meant
 * `simon@gmail.com` and `simon@hotmail.fr` were both stored as
 * "simon" — two people, one name, and no way to tell them apart when
 * a check turned out to be wrong. The username is unique, so it names
 * exactly one person.
 *
 * The email is not used as a fallback. An address on a public
 * timeline is a leak, and a check from an account with no name yet is
 * better labelled "someone" than labelled with their email.
 */
async function displayName(userId: string): Promise<string> {
  const supabase = await createClient();

  const { data } = await supabase
    .from("profiles")
    .select("username")
    .eq("id", userId)
    .maybeSingle();

  return data?.username ?? "someone";
}

export async function submitCheck(input: CheckInput) {
  const supabase = await createClient();

  const name = await displayName(input.userId);

  const { data: check, error: checkError } = await supabase
    .from("place_field_checks")
    .insert({
      place_id: input.placeId,
      verified_by: input.userId,
      verified_by_name: name,
      note: input.note ?? null,
      still_open: input.stillOpen,
    })
    .select("id")
    .single();

  if (checkError) {
    return { ok: false as const, message: checkError.message };
  }

  if (input.priceKinds.length > 0) {
    await supabase.from("place_price_updates").insert(
      input.priceKinds.map((kind) => ({
        place_id: input.placeId,
        price_kind: kind,
        reported_by: input.userId,
        reported_by_name: name,
        check_id: check.id,
      }))
    );
  }

  /* A person reporting a place closed is a signal, not a decision: it
     goes to moderation rather than closing anything on its own. */
  if (!input.stillOpen) {
    await supabase.from("place_reports").insert({
      place_id: input.placeId,
      reported_by: input.userId,
      reason: "Reported closed at a field check",
    });
  }

  /* The checker is paid for the visit. The author is not paid here —
     that comes from confirmPlace, when somebody else chimes in. */
  await awardAction({
    userId: input.userId,
    actionKey: "confirm_place",
    placeId: input.placeId,
    note: `Checked at ${name}`,
  });

  return { ok: true as const, checkId: check.id, name };
}

/*
 * The confirmation that releases the deferred credit.
 *
 * Returns early when the confirmer is the author: self-confirmation
 * would let anyone pay themselves by opening two tabs.
 */
export async function confirmPlace({
  placeId,
  userId,
}: {
  placeId: string;
  userId: string;
}) {
  const supabase = await createClient();

  const { data: place } = await supabase
    .from("places")
    .select("created_by")
    .eq("id", placeId)
    .maybeSingle();

  if (!place) {
    return { ok: false as const, message: "Place not found." };
  }

  if (place.created_by === userId) {
    return {
      ok: false as const,
      message: "You cannot confirm your own place — someone else has to.",
    };
  }

  const name = await displayName(userId);

  const { error } = await supabase.from("place_confirmations").insert({
    place_id: placeId,
    user_id: userId,
    user_name: name,
  });

  if (error) {
    /* The unique constraint on (place_id, user_id) is what stops one
       person confirming the same place twice, which is the cheapest
       possible way to farm credits. */
    if (error.code === "23505") {
      return { ok: false as const, message: "You already confirmed this." };
    }

    return { ok: false as const, message: error.message };
  }

  /* The deferred credit lands now, on the author's account, once. */
  await awardAction({
    userId: place.created_by,
    actionKey: "add_place",
    placeId,
    note: `Confirmed by ${name}`,
  });

  await awardAction({
    userId,
    actionKey: "confirm_place",
    placeId,
    note: "You confirmed a place added by someone else",
  });

  return { ok: true as const };
}

/*
 * Closing a place takes back what it paid.
 *
 * Without this, adding ten invented places and waiting for a friend to
 * confirm them is profitable — the credits stay after the places are
 * gone. `revokePlaceCredits` was written for this and had no caller.
 */
export async function closePlace({
  placeId,
  reason,
}: {
  placeId: string;
  reason?: string;
}) {
  const supabase = await createClient();

  const { data: place } = await supabase
    .from("places")
    .select("created_by, name")
    .eq("id", placeId)
    .maybeSingle();

  if (!place) {
    return { ok: false as const, message: "Place not found." };
  }

  const { error } = await supabase
    .from("places")
    .update({ status: "closed" })
    .eq("id", placeId);

  if (error) {
    return { ok: false as const, message: error.message };
  }

  await revokePlaceCredits({
    placeId,
    userId: place.created_by,
    note: reason ?? `Place removed: ${place.name}`,
  });

  return { ok: true as const };
}
