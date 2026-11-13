import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { createClient } from "@/lib/supabase/server";

/*
 * Supabase sends recovery links through its own domain, which hands
 * this app a one-time code. That code has to be exchanged for a real
 * session on the server before /reset-password can do anything —
 * without this step the page loads with no user and blows up.
 *
 * WHERE THE FAILURE IS REPORTED, AND WHY IT MATTERS.
 *
 * This route used to end every failure at the same address,
 * `/forgot-password?error=failed` — whether the link had expired,
 * had already been used, or had been refused outright. The page
 * behind that code explains link rewriting by mail gateways, which
 * is one real cause among several, so somebody whose link had simply
 * timed out was told a story about their email provider that had
 * nothing to do with what happened.
 *
 * Worse, the route never READ what Supabase sent back. When a verify
 * fails, Supabase appends `error` and `error_code` to the redirect —
 * `otp_expired`, `access_denied`, and others. The old code looked
 * only for `code` and `token_hash`, found neither, and fell through
 * to the generic branch with the explanation sitting in the URL,
 * unread.
 *
 * So the parameters are read now, and each outcome gets its own code.
 * The page decides the wording; this file decides which fact it is.
 */

/*
 * Supabase's own vocabulary, mapped to ours.
 *
 * `otp_expired` and `access_denied` are the two that arrive in
 * practice — the first when the link sat too long, the second when
 * it has already been consumed or the token was rejected. Anything
 * unrecognised keeps the generic code rather than being folded into
 * one of these: guessing which failure it was would put a confident
 * wrong sentence on the screen, which is the habit this file is
 * being fixed to break.
 */
function errorCode(raw: string | null): string {
  switch (raw) {
    case "otp_expired":
      return "expired";
    case "access_denied":
      return "used";
    default:
      return "failed";
  }
}

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);

  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type");

  /* What Supabase already told us, before anything is attempted. A
     refusal that arrives in the URL is not retried: the token behind
     it is spent, and a second exchange would fail the same way while
     burning another attempt. */
  const refused = searchParams.get("error_code") ?? searchParams.get("error");

  if (!code && !tokenHash && refused) {
    return NextResponse.redirect(
      `${origin}/forgot-password?error=${errorCode(refused)}`
    );
  }

  const supabase = await createClient();

  /* The newer flow: a code to exchange. */
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      return NextResponse.redirect(`${origin}/reset-password`);
    }

    /*
     * The exchange itself refused. `error.code` is the Supabase code
     * that arrived with it — the same vocabulary as above, so it goes
     * through the same mapping instead of collapsing to "failed".
     *
     * The message stays in the logs, because a database string is
     * useful in exactly one place and this is it.
     */
    console.error("[auth/confirm] exchange", error.code, error.message);

    return NextResponse.redirect(
      `${origin}/forgot-password?error=${errorCode(error.code ?? null)}`
    );
  }

  /* The older flow: a token hash to verify. */
  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({
      type: type as "recovery",
      token_hash: tokenHash,
    });

    if (!error) {
      return NextResponse.redirect(`${origin}/reset-password`);
    }

    console.error("[auth/confirm] verifyOtp", error.code, error.message);

    return NextResponse.redirect(
      `${origin}/forgot-password?error=${errorCode(error.code ?? null)}`
    );
  }

  /* Nothing usable arrived: no code, no token, no refusal to read.
     That is the one case where the link really is the problem — it
     was truncated on its way, most often by a mail gateway that
     rewrote the address. This is the only path that keeps `failed`. */
  return NextResponse.redirect(`${origin}/forgot-password?error=failed`);
}
