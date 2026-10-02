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

export async function getCreditRules(): Promise<Record<string, CreditRule>> {
  try {
    const supabase = await createClient();

    const { data } = await supabase
      .from("credit_rules")
      .select("action_key, credits, daily_cap, description")
      .eq("active", true);

    const rules: Record<string, CreditRule> = {};

    for (const row of (data ?? []) as CreditRule[]) {
      rules[row.action_key] = row;
    }

    return rules;
  } catch {
    return {};
  }
}

export async function creditValue(action: string): Promise<number> {
  const rules = await getCreditRules();

  return rules[action]?.credits ?? 0;
}
