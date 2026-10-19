import { createClient } from "@/lib/supabase/server";
import { currentAdmin } from "@/lib/services/admin";
import { getSettings } from "@/lib/services/settings";

import HeaderClient from "./HeaderClient";

/*
 * Server component: reads the session, then hands the facts the menu
 * needs to the client component below it.
 *
 * `currentAdmin` is the single source of truth for "is this person an
 * admin" — the admin actions call it too. Two functions answering the
 * same question would eventually disagree.
 *
 * WHY THE DONATION ADDRESS IS READ HERE
 *
 * The button lives in a client component and the address lives in
 * the database, so somebody has to cross the gap once per request.
 * That is this component: it already reads the session and the admin
 * row, so the settings come along for the same trip rather than a
 * fetch from the browser.
 *
 * THREE WAYS IT COMES BACK EMPTY, and all three mean the same thing
 * — no button:
 *
 *   - the switch is off in Admin → Site;
 *   - the address was never filled in;
 *   - `donation_url` does not exist yet, because 0024 has not been
 *     pasted into the Supabase SQL editor. `getSettings()` merges the
 *     row over DEFAULT_SETTINGS, where the column is absent, so the
 *     value is simply undefined and the button stays hidden. The
 *     site works either way, which is why this is safe to deploy
 *     before the migration is applied.
 */

export default async function HomeHeader() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [admin, settings] = await Promise.all([
    user ? currentAdmin() : Promise.resolve(null),
    getSettings(),
  ]);

  /* The switch AND the address — see the note above. */
  const donationUrl = settings.donation_enabled
    ? (settings as { donation_url?: string | null }).donation_url ?? null
    : null;

  return (
    <HeaderClient
      signedIn={Boolean(user)}
      admin={Boolean(admin)}
      donationUrl={donationUrl}
    />
  );
}
