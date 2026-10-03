import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

/*
 * Next 16 renamed the "middleware" convention to "proxy". Same file,
 * same body, same matcher — only the filename and the exported name
 * changed.
 */

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
   * Refresh the session on every request. Without the setAll above,
   * cookies are never rewritten and signOut leaves a stale session.
   *
   * A cookie whose refresh token no longer exists server-side throws
   * here on EVERY request that passes the matcher — eight times for one
   * page load, filling the terminal with noise that hides real errors.
   * It is not a failure: it just means the session is gone. Clearing
   * the sb-* cookies lets the next request start clean.
   */
  try {
    await supabase.auth.getUser();
  } catch (error) {
    const code = (error as { code?: string } | null)?.code;

    if (code !== "refresh_token_not_found") throw error;

    request.cookies.getAll().forEach(({ name }) => {
      if (name.startsWith("sb-")) {
        response.cookies.delete(name);
      }
    });
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|icon.svg|robots.txt|sitemap.xml).*)$",
  ],
};
