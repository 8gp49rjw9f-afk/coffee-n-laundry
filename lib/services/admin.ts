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
    throw new Error("That page is for admins only.");
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
    throw new Error("Only the master account can change the admins.");
  }

  return admin;
}
