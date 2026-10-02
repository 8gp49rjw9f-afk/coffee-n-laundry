import { createClient } from "@/lib/supabase/server";

/*
 * Words that suggest a chain. Read from the database so the list can
 * change without a deploy — this is a nudge, never a ban.
 */

export async function getChainPatterns(): Promise<string[]> {
  try {
    const supabase = await createClient();

    const { data } = await supabase
      .from("chain_flags")
      .select("pattern")
      .eq("active", true);

    return (data ?? []).map((row) => String(row.pattern).toLowerCase());
  } catch {
    return [];
  }
}
