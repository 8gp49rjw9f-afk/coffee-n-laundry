import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

/*
 * Next 16 renamed the "middleware" convention to "proxy". Same file,
 * same shape, only the filename and the exported name changed.
 *
 * Two jobs now, in this order:
 *
 *   1. Maintenance mode. When the switch in the admin panel is on,
 *      visitors get the message instead of the site. Admins keep
 *      working — an admin locked out of their own site cannot turn
 *      the switch back off, which is the one mistake this feature
 *      must not make.
 *
 *   2. Session refresh. Without rewriting the cookies here, a stale
 *      session survives signOut.
 *
 * WHY THE MAINTENANCE READ IS DONE HERE, BY HAND
 *
 * The first version of this function asked `getSettings()` for the
 * switch, and `getSettings()` builds its client on `cookies()` from
 * `next/headers`. That works in a page and NOT here: in a middleware
 * there is no cookie store to read, the call throws, and
 * `getSettings()` catches its own failure and answers
 * `DEFAULT_SETTINGS` — where `maintenance_mode` is `false`.
 *
 * So the switch was read as OFF on every request, whatever the
 * database said, and the site stayed open. The build log showed the
 * same failure four times, at static generation:
 *
 *   [getSettings] threw: Dynamic server usage: Route /maintenance
 *   couldn't be rendered statically because it used `cookies`
 *
 * The fix is to read the one column over PostgREST, with the anon
 * key, and no session at all: `site_settings` is readable by anybody,
 * and this needs no cookie store it cannot reach.
 *
 * AND THE FALLBACK IS BACKWARDS-SAFE NOW
 *
 * If that read fails, the answer is "the site is resting", not "the
 * site is open". A site closed by mistake is reopened in thirty
 * seconds by flipping the switch; a site left open through a
 * maintenance nobody notices is the failure that costs something.
 * The switch is an emergency lever and it fails closed.
 */

/* Everything a visitor may still reach while the site is resting.
   Without these, the maintenance page itself would redirect to
   itself, and the sign-in screen would be unreachable — so an admin
   could never get in to switch it back off. */
const ALWAYS_ALLOWED = [
  "/login",
  "/signup",
  "/signout",
  "/auth",
  "/maintenance",
];

function isAllowed(pathname: string) {
  if (ALWAYS_ALLOWED.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
    return true;
  }

  /* Static assets and the icon, or the page would render unstyled. */
  if (/\.[a-z0-9]+$/i.test(pathname)) return true;

  /*
   * The sitemap and the robots file, which moved out of Next's
   * metadata convention and are served by plain routes now — see
   * app/sitemap/route.ts. A crawler that arrives while the site is
   * resting should still be told how to come back.
   */
  if (pathname === "/sitemap" || pathname === "/robots.txt") return true;

  return false;
}

export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },

        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => {
            request.cookies.set(name, value);
          });

          response = NextResponse.next({ request });

          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  /*
   * Refresh the session FIRST, because the admin check below needs to
   * know who this is — and that cannot be answered from a cookie that
   * has not been refreshed.
   *
   * A cookie whose refresh token no longer exists server-side throws
   * on EVERY request that passes the matcher — eight times for one
   * page load, filling the terminal with noise that hides real
   * errors. It is not a failure: it just means the session is gone.
   * Clearing the sb-* cookies lets the next request start clean.
   */
  let user = null;

  try {
    const { data } = await supabase.auth.getUser();

    user = data.user;
  } catch (error) {
    const code = (error as { code?: string } | null)?.code;

    if (code !== "refresh_token_not_found") throw error;

    request.cookies.getAll().forEach(({ name }) => {
      if (name.startsWith("sb-")) {
        response.cookies.delete(name);
      }
    });
  }

  /* ---------- maintenance ---------- */

  const resting = await readMaintenanceSwitch();

  if (resting) {
    /* An admin is never redirected: they are the only one who can end
       the maintenance, and locking them out would make it permanent. */
    let admin = false;

    if (user?.email) {
      const { data } = await supabase
        .from("admins")
        .select("email")
        .eq("email", user.email)
        .maybeSingle();

      admin = Boolean(data);
    }

    if (!admin && !isAllowed(pathname)) {
      const url = request.nextUrl.clone();

      url.pathname = "/maintenance";
      url.search = "";

      return NextResponse.redirect(url);
    }
  }

  return response;
}

/*
 * The one column, over PostgREST, with the anon key.
 *
 * Deliberately NOT `getSettings()`: see the note at the top. This
 * asks the REST API directly for `maintenance_mode`, which RLS allows
 * anybody to read, and it needs no session and no cookie store.
 *
 * FAILS CLOSED. Any failure — a network blip, a missing row, a
 * missing environment variable, a malformed response — answers
 * `true`. The switch exists to take the site down on purpose; if the
 * answer is unknown, the safe reading is that it is down.
 */
async function readMaintenanceSwitch(): Promise<boolean> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    console.error("[proxy] maintenance: Supabase env vars are missing");

    return true;
  }

  try {
    const response = await fetch(
      `${url}/rest/v1/site_settings?select=maintenance_mode&id=eq.1`,
      {
        headers: {
          apikey: key,
          Authorization: `Bearer ${key}`,
        },
        cache: "no-store",
      }
    );

    if (!response.ok) {
      console.error(
        "[proxy] maintenance:",
        response.status,
        await response.text()
      );

      return true;
    }

    const rows = (await response.json()) as { maintenance_mode?: boolean }[];

    if (!Array.isArray(rows) || rows.length === 0) {
      console.error("[proxy] maintenance: no site_settings row with id = 1");

      return true;
    }

    return Boolean(rows[0].maintenance_mode);
  } catch (error) {
    console.error("[proxy] maintenance read threw:", error);

    return true;
  }
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|icon.svg|robots.txt|sitemap).*)$",
  ],
};
