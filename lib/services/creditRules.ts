import { createClient } from "@/lib/supabase/server";

/* ====================================================== */
/* CREDIT RULES — values come from the database            */
/* ====================================================== */

export interface CreditRule {
  action_key: string;
  credits: number;
  daily_cap: number | null;
  description: string | null;
}

/*
 * The rules, or an empty set.
 *
 * Returns {} when the table cannot be read — which means contributions
 * quietly stop earning. Before this the failure was silent: a visitor
 * added a price, the ledger insert did nothing, and nothing anywhere
 * said why.
 *
 * `listener` is how a caller finds out. It is called on the way out
 * with `true` when the read failed, and it is optional so server code
 * that only wants the numbers can ignore it.
 */
export async function getCreditRules(
  listener?: (failed: boolean) => void
): Promise<Record<string, CreditRule>> {
  try {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("credit_rules")
      .select("action_key, credits, daily_cap, description")
      .eq("active", true);

    if (error) {
      console.error("[getCreditRules]", error.message);
      listener?.(true);

      return {};
    }

    const rules: Record<string, CreditRule> = {};

    for (const row of (data ?? []) as CreditRule[]) {
      rules[row.action_key] = row;
    }

    return rules;
  } catch (error) {
    console.error("[getCreditRules]", error);
    listener?.(true);

    return {};
  }
}

export async function creditValue(action: string): Promise<number> {
  const rules = await getCreditRules();

  return rules[action]?.credits ?? 0;
}
