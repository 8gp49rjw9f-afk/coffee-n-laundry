import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

/* Sign out happens here, in the same response cycle as the
   redirect — calling a server action that redirects too would
   leave the browser on a stale session. */

export default async function SignoutPage() {
  const supabase = await createClient();

  await supabase.auth.signOut();

  redirect("/");
}
