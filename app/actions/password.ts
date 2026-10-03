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
    console.error("[requestPasswordReset]", error.message);

    redirect("/forgot-password?error=failed");
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
