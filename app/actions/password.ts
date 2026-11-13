"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

/*
 * Supabase sends a recovery link that lands back on this app. The
 * link carries a one-time code, which /auth/confirm exchanges for a
 * session before handing the user to /reset-password.
 *
 * The redirect target is read from the request itself rather than
 * from NEXT_PUBLIC_SITE_URL. That variable is not set on this
 * deployment, so the old fallback was doing all the work — and it was
 * written in Markdown, "[localhost](http://localhost:3000)", which is
 * not a URL. Supabase accepted it, the email went out, and the link
 * arrived at /auth/confirm with no code in it.
 *
 * The request's own origin cannot be wrong: it is the address that
 * just worked in a browser. For a deployment behind a proxy, the
 * forwarded headers carry the public host.
 */

async function siteOrigin(): Promise<string> {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim();

  if (configured && /^https?:\/\/[^\s]+$/.test(configured)) {
    return configured.replace(/\/$/, "");
  }

  const store = await headers();

  const host =
    store.get("x-forwarded-host") ?? store.get("host") ?? "localhost:3000";

  const proto =
    store.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");

  return `${proto}://${host}`;
}

/*
 * TWO FAILURES, TWO CODES — and this is a correction.
 *
 * The send used to end at `?error=failed` whatever went wrong, and
 * that code is the one /forgot-password renders as "That link did not
 * work. Links can be altered in transit." The sentence is about a
 * link that arrived damaged, and it was being shown to somebody
 * whose link had never been sent at all: Supabase had refused the
 * request, the action swallowed the reason into the logs, and the
 * page explained mail gateways to a person who was still looking at
 * the form.
 *
 * So `send` is a code of its own now. `failed` stays where it
 * belongs — on the link that comes back wrong, which /auth/confirm
 * still uses for exactly that case and nothing else.
 *
 * WHAT ACTUALLY REFUSES A SEND, since it is worth knowing while
 * reading the logs: Supabase rate-limits these emails hard on a
 * small project, and a run of attempts in one evening will hit the
 * ceiling. `over_email_send_rate_limit` is the one to expect. No
 * code change fixes that — the wait does — but the screen should
 * stop blaming the link for it.
 */
export async function requestPasswordReset(formData: FormData): Promise<void> {
  const supabase = await createClient();

  const email = String(formData.get("email") ?? "").trim();

  if (!email) {
    redirect("/forgot-password?error=missing");
  }

  const origin = await siteOrigin();

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/auth/confirm`,
  });

  if (error) {
    /* The real reason stays in the logs, where it is useful. The
       screen gets a code it can word honestly. */
    console.error(
      "[requestPasswordReset]",
      error.code ?? "",
      error.message
    );

    redirect("/forgot-password?error=send");
  }

  /* The same answer whether or not the address exists: telling a
     stranger which emails are registered is not our business. */
  redirect("/forgot-password?sent=1");
}

export async function setNewPassword(formData: FormData): Promise<void> {
  const supabase = await createClient();

  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");

  if (password.length < 8) {
    redirect("/reset-password?error=short");
  }

  if (password !== confirm) {
    redirect("/reset-password?error=mismatch");
  }

  /* The reset flow signs the user in through /auth/confirm. If that
     did not happen — an expired link, or a browser that dropped the
     cookie between the two steps — updateUser would report a generic
     failure. Saying which one it is saves the person a loop. */
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/reset-password?error=expired");
  }

  const { error } = await supabase.auth.updateUser({ password });

  if (error) {
    console.error("[setNewPassword]", error.message);

    redirect("/reset-password?error=failed");
  }

  redirect("/?password=changed");
}
