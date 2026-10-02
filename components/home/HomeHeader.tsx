import { createClient } from "@/lib/supabase/server";
import { isAdmin } from "@/lib/services/settings";

import HeaderClient from "./HeaderClient";

/* Server component: reads the session, then hands the two facts
   the menu needs to the client component below it. */

export default async function HomeHeader() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const admin = user ? await isAdmin() : false;

  return <HeaderClient signedIn={Boolean(user)} admin={admin} />;
}
