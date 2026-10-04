import { createClient } from "@/lib/supabase/server";

/* ====================================================== */
/* USERS — what an admin needs to look someone up          */
/* ====================================================== */

/*
 * Both functions below are Postgres functions, not table reads.
 *
 * An email lives in `auth.users`, which no client can select from.
 * The alternative would be shipping the service role key to a server
 * action, and that key opens the whole database — far too much for
 * reading one address. The function is SECURITY DEFINER and checks
 * is_admin() itself, so it answers admins and nobody else.
 */

export interface UserSearchRow {
  id: string;
  username: string | null;
  email: string | null;
  is_admin: boolean;
  is_founder: boolean;
  credit_balance: number;
  places_added: number;
  created_at: string;
}

export async function searchUsers(term: string): Promise<UserSearchRow[]> {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("search_users", {
    term: term.trim(),
  });

  if (error) {
    console.error("[searchUsers]", error.message);

    return [];
  }

  return (data ?? []) as UserSearchRow[];
}

export interface AdminUserDetail {
  id: string;
  username: string | null;
  email: string | null;
  is_admin: boolean;
  is_master: boolean;
  is_founder: boolean;
  founder_since: string | null;
  founder_places: number;
  credit_balance: number;
  is_blocked: boolean;
  joined_at: string;
  places_added: number;
  places_verified_by_others: number;
  confirmations_made: number;
  photos_added: number;
}

export async function getUserDetail(
  userId: string
): Promise<AdminUserDetail | null> {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("admin_user_detail", {
    p_user_id: userId,
  });

  if (error) {
    console.error("[getUserDetail]", error.message);

    return null;
  }

  const rows = (data ?? []) as AdminUserDetail[];

  /* No row means either the id is unknown or the caller is not an
     admin — the function returns nothing in both cases, which is the
     point of checking inside it. */
  return rows.length > 0 ? rows[0] : null;
}

/* The ledger, for the detail page. RLS lets an admin read another
   person's rows through the policy added in 0011. */

export interface LedgerRow {
  id: string;
  action_key: string;
  amount: number;
  note: string | null;
  created_at: string;
}

export async function getUserLedger(userId: string): Promise<LedgerRow[]> {
  const supabase = await createClient();

  const { data } = await supabase
    .from("credit_transactions")
    .select("id, action_key, amount, note, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(40);

  return (data ?? []) as LedgerRow[];
}

export interface UserPlaceRow {
  id: string;
  name: string;
  place_type: string;
  city: string | null;
  country: string | null;
  status: string;
  created_at: string;
}

export async function getUserPlaces(userId: string): Promise<UserPlaceRow[]> {
  const supabase = await createClient();

  const { data } = await supabase
    .from("places")
    .select("id, name, place_type, city, country, status, created_at")
    .eq("created_by", userId)
    .order("created_at", { ascending: false })
    .limit(50);

  return (data ?? []) as UserPlaceRow[];
}
