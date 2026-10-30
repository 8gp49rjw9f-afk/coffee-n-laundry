import { createClient } from "@/lib/supabase/server";

/* ====================================================== */
/* ADMIN GATE — the rule lives here, not in the UI          */
/* ====================================================== */

/*
 * A hidden menu item is not a protection: anyone can POST to a server
 * action. These two functions are the real gate, and every admin
 * action calls one of them before touching anything.
 *
 * The database enforces the same rule through RLS, so this is the
 * second lock rather than the only one — but it is the one that
 * produces a readable error instead of a silent zero-row write.
 *
 * Both throw a CODE, because these are the two failures an admin can
 * hit by following a stale link, and the popup should be able to say
 * what happened rather than pass on a sentence.
 */

export interface AdminIdentity {
  id: string;
  email: string;
}

export async function currentAdmin(): Promise<AdminIdentity | null> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.email) return null;

  const { data } = await supabase
    .from("admins")
    .select("email")
    .eq("email", user.email)
    .maybeSingle();

  if (!data) return null;

  return { id: user.id, email: user.email };
}

export async function requireAdmin(): Promise<AdminIdentity> {
  const admin = await currentAdmin();

  if (!admin) {
    throw new Error("ADMIN_ONLY");
  }

  return admin;
}

/*
 * The Master is the admin who decides who the admins are. The list of
 * admins is readable by any admin, but only this one may change it.
 */

export async function isMaster(): Promise<boolean> {
  const admin = await currentAdmin();

  if (!admin) return false;

  const supabase = await createClient();

  const { data } = await supabase
    .from("admins")
    .select("is_master")
    .eq("email", admin.email)
    .maybeSingle();

  return Boolean(data?.is_master);
}

export async function requireMaster(): Promise<AdminIdentity> {
  const admin = await requireAdmin();

  if (!(await isMaster())) {
    throw new Error("MASTER_ONLY");
  }

  return admin;
}

/* ====================================================== */
/* BANNED — the gate that keeps a suspended account still   */
/* ====================================================== */

/*
 * A ban leaves the account alive: the person signs in, reads the map,
 * and sees a banner saying it is suspended. What stops is writing.
 *
 * WHY THIS IS A HELPER AND NOT A CHECK IN EACH ACTION
 *
 * Seven actions write something — a place, a comment, a report, a
 * confirmation, a price, a photo, a message. Testing the column in
 * each one means seven chances to forget, and the failure is silent:
 * a banned person quietly contributing again, with nothing on screen
 * to say the gate was missed. One function, called first in every one
 * of them, is the only version of this that stays true.
 *
 * It throws a CODE, like every other guard here, so describeError can
 * turn it into a sentence.
 */

export interface BanState {
  banned: boolean;
  reason: string | null;
}

export async function currentBan(): Promise<BanState> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { banned: false, reason: null };

  /* 0026 adds these columns. Before it is applied the read fails with
     a missing-column error, and the honest answer then is "not
     banned" — a site that refuses every write because a migration has
     not been pasted yet would be worse than the ban it is guarding. */
  const { data, error } = await supabase
    .from("profiles")
    .select("banned_at, banned_reason")
    .eq("id", user.id)
    .maybeSingle();

  if (error || !data) return { banned: false, reason: null };

  return {
    banned: Boolean(data.banned_at),
    reason: (data.banned_reason as string | null) ?? null,
  };
}

export async function requireNotBanned(): Promise<void> {
  const { banned } = await currentBan();

  if (banned) {
    throw new Error("ACCOUNT_BANNED");
  }
}
