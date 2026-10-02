"use server";

import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

/*
 * Supabase sends a recovery link that lands back on this app. The
 * link carries a one-time code, which /auth/confirm exchanges for a
 * session before handing the user to /reset-password.
 */

export async function requestPasswordReset(formData: FormData): Promise<void> {
  const supabase = await createClient();

  const email = String(formData.get("email") ?? "").trim();

  if (!email) {
    redirect("/forgot-password?error=missing");
  }

  const site = process.env.NEXT_PUBLIC_SITE_URL ?? "[localhost](http://localhost:3000)";

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${site}/auth/confirm`,
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

  const { error } = await supabase.auth.updateUser({ password });

  if (error) {
    console.error("[setNewPassword]", error.message);

    redirect("/reset-password?error=failed");
  }

  redirect("/?password=changed");
}
