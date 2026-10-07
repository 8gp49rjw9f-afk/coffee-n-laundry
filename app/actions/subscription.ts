"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { getSettings } from "@/lib/services/settings";

/* ====================================================== */
/* REDEEM CREDITS FOR SUBSCRIPTION TIME                    */
/* V1: the state change is real, no money moves.           */
/* ====================================================== */

/*
 * The failures here return a code rather than a sentence. The one
 * exception is the not-enough-credits case, which used to name the
 * exact numbers (`You need 100 credits. You have 42.`) — useful, but
 * it was the only place in the app that built a sentence server-side,
 * and the caller could not translate it. The popup now carries the
 * copy, and the numbers are on the profile page above the button.
 */

export async function redeemCreditsForMonth(): Promise<{
  ok: boolean;
  code?: string;
  until?: string;
}> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, code: "CREDITS_SIGNED_OUT" };
  }

  const settings = await getSettings();

  const { data: profile } = await supabase
    .from("profiles")
    .select("credit_balance")
    .eq("id", user.id)
    .maybeSingle();

  const balance = profile?.credit_balance ?? 0;

  if (balance < settings.credits_per_free_month) {
    return { ok: false, code: "CREDITS_NOT_ENOUGH" };
  }

  const { data: subscription } = await supabase
    .from("subscriptions")
    .select("user_id, current_period_end")
    .eq("user_id", user.id)
    .maybeSingle();

  const base = subscription?.current_period_end
    ? new Date(subscription.current_period_end)
    : new Date();

  const from = base > new Date() ? base : new Date();
  const until = new Date(from.getTime() + 30 * 24 * 60 * 60 * 1000);

  /* The ledger records the spend; the balance trigger follows it. */
  const { error: ledgerError } = await supabase
    .from("credit_transactions")
    .insert({
      user_id: user.id,
      action_key: "add_place",
      amount: -settings.credits_per_free_month,
      note: "Redeemed for one free month",
    });

  if (ledgerError) {
    console.error("[redeemCreditsForMonth]", ledgerError.message);

    return { ok: false, code: "CREDITS_REDEEM_FAILED" };
  }

  await supabase.from("subscriptions").upsert({
    user_id: user.id,
    status: "credit_month",
    source: "credits",
    current_period_start: from.toISOString(),
    current_period_end: until.toISOString(),
    updated_at: new Date().toISOString(),
  });

  revalidatePath("/profile");

  return { ok: true, until: until.toISOString() };
}

/* ====================================================== */
/* SYNC — an expired period becomes an expired status       */
/* ====================================================== */

export async function syncSubscriptionState(): Promise<void> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return;

  const { data: subscription } = await supabase
    .from("subscriptions")
    .select("status, current_period_end")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!subscription) return;

  if (
    subscription.current_period_end &&
    new Date(subscription.current_period_end).getTime() < Date.now() &&
    subscription.status !== "expired"
  ) {
    await supabase
      .from("subscriptions")
      .update({ status: "expired" })
      .eq("user_id", user.id);
  }
}
