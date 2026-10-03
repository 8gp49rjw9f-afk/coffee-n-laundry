import { createClient } from "@/lib/supabase/server";
import { currentAdmin } from "@/lib/services/admin";

import HeaderClient from "./HeaderClient";

/*
 * Server component: reads the session, then hands the two facts the
 * menu needs to the client component below it.
 *
 * `currentAdmin` is the single source of truth for "is this person an
 * admin" — the admin actions call it too. Two functions answering the
 * same question would eventually disagree.
 */

export default async function HomeHeader() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const admin = user ? await currentAdmin() : null;

  return <HeaderClient signedIn={Boolean(user)} admin={Boolean(admin)} />;
}
