/* ====================================================== */
/* AWARDS — the ledger is the source of truth              */
/* ====================================================== */

import { createClient } from "@/lib/supabase/server";

import { getCreditRules } from "./creditRules";

export type CreditAction =
  | "add_place"
  | "add_price"
  | "update_price"
  | "add_photo"
  | "add_info"
  | "confirm_place"
  | "report_closed"
  | "submit_update";

export async function awardCredits({
  userId,
  action,
  placeId,
  updateId,
  note,
}: {
  userId: string;
  action: CreditAction;
  placeId?: string | null;
  updateId?: string | null;
  note?: string | null;
}): Promise<{ awarded: number; reason?: string }> {
  const rules = await getCreditRules();
  const rule = rules[action];

  if (!rule || rule.credits <= 0) {
    return { awarded: 0, reason: "rule_inactive" };
  }

  const supabase = await createClient();

  /* The daily cap is counted from the ledger, not a counter column. */
  if (rule.daily_cap != null) {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const { count } = await supabase
      .from("credit_transactions")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("action_key", action)
      .gte("created_at", since);

    if ((count ?? 0) >= rule.daily_cap) {
      return { awarded: 0, reason: "daily_cap" };
    }
  }

  const { error } = await supabase.from("credit_transactions").insert({
    user_id: userId,
    action_key: action,
    amount: rule.credits,
    place_id: placeId ?? null,
    update_id: updateId ?? null,
    note: note ?? null,
  });

  if (error) {
    return { awarded: 0, reason: "insert_failed" };
  }

  return { awarded: rule.credits };
}

/* ====================================================== */
/* THE DEFERRED AWARD for adding a place                   */
/* ====================================================== */

/*
 * A place pays its creator only once SOMEBODY ELSE has verified it.
 *
 * Rewarding the act of adding would reward empty pins: add thirty of
 * them in an evening, collect three hundred credits, and a year is
 * free without having contributed anything at all. Waiting for a
 * stranger means the reward tracks places that a second person stood
 * in front of — which is the only thing this map is worth.
 *
 * The function is idempotent: the ledger is asked whether this place
 * has already paid, so twenty verifications pay once. The index from
 * migration 0010 is what makes that question cheap.
 *
 * Called from the verification actions, never from createPlace.
 */

export async function awardPlaceCreditsOnce(
  placeId: string,
  verifierId: string
): Promise<{ awarded: number; reason?: string }> {
  const supabase = await createClient();

  const { data: place } = await supabase
    .from("places")
    .select("id, created_by")
    .eq("id", placeId)
    .maybeSingle();

  if (!place?.created_by) {
    return { awarded: 0, reason: "no_owner" };
  }

  /* Verifying your own place is not a second opinion. */
  if (place.created_by === verifierId) {
    return { awarded: 0, reason: "own_place" };
  }

  const { data: existing } = await supabase
    .from("credit_transactions")
    .select("id")
    .eq("place_id", placeId)
    .eq("action_key", "add_place")
    .limit(1);

  if (existing && existing.length > 0) {
    return { awarded: 0, reason: "already_paid" };
  }

  return awardCredits({
    userId: place.created_by,
    action: "add_place",
    placeId,
    note: "verified by another user",
  });
}

/* ====================================================== */
/* TAKING CREDITS BACK                                     */
/* ====================================================== */

/*
 * A place reported as fake, or closed as gone, gives back what it
 * paid. Without this, farming stays profitable: add thirty doubtful
 * places, let two of them be confirmed by distracted strangers, keep
 * the points.
 *
 * The ledger is append-only, so nothing is deleted — a negative row
 * is written instead, and the history stays honest about what
 * happened. The entry is tagged `place_demoted`, which is also what
 * the Founder view reads to exclude a place that already cost its
 * creator credits.
 */

export async function revokePlaceCredits(
  placeId: string,
  reason: string
): Promise<{ revoked: number }> {
  const supabase = await createClient();

  const { data: paid } = await supabase
    .from("credit_transactions")
    .select("amount, user_id")
    .eq("place_id", placeId)
    .eq("action_key", "add_place");

  if (!paid || paid.length === 0) {
    return { revoked: 0 };
  }

  const { data: already } = await supabase
    .from("credit_transactions")
    .select("id")
    .eq("place_id", placeId)
    .eq("action_key", "place_demoted")
    .limit(1);

  if (already && already.length > 0) {
    return { revoked: 0 };
  }

  const total = paid.reduce((sum, row) => sum + Number(row.amount), 0);
  const owner = paid[0].user_id;

  if (!owner || total === 0) {
    return { revoked: 0 };
  }

  const { error } = await supabase.from("credit_transactions").insert({
    user_id: owner,
    action_key: "place_demoted" as never,
    amount: -total,
    place_id: placeId,
    note: reason,
  });

  if (error) {
    console.error("[revokePlaceCredits]", error.message);

    return { revoked: 0 };
  }

  return { revoked: total };
}

/* ====================================================== */
/* SUMMARY for the profile page                            */
/* ====================================================== */

export async function getCreditSummary(userId: string) {
  const supabase = await createClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("credit_balance")
    .eq("id", userId)
    .maybeSingle();

  const { data: history } = await supabase
    .from("credit_transactions")
    .select("id, action_key, amount, note, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(30);

  return {
    balance: profile?.credit_balance ?? 0,
    history: history ?? [],
  };
}
