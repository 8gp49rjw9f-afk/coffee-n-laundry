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
