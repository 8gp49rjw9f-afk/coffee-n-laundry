import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

import { getSettings } from "@/lib/services/settings";

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

  return false;
}

export async function proxy(request: NextRequest) {
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
   * Refresh the session first, because the maintenance check below
   * needs to know whether this person is an admin — and that question
   * cannot be answered from a cookie that has not been refreshed.
   *
   * A cookie whose refresh token no longer exists server-side throws
   * on EVERY request that passes the matcher — eight times for one
   * page load, filling the terminal with noise that hides real errors.
   * It is not a failure: it just means the session is gone. Clearing
   * the sb-* cookies lets the next request start clean.
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

  const settings = await getSettings();

  if (settings.maintenance_mode) {
    const pathname = request.nextUrl.pathname;

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

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|icon.svg|robots.txt|sitemap.xml).*)$",
  ],
};
