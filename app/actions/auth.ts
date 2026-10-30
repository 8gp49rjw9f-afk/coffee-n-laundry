"use server";

import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { getSettings } from "@/lib/services/settings";

export async function signIn(formData: FormData): Promise<void> {
  const supabase = await createClient();

  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const next = String(formData.get("next") ?? "/");

  if (!email || !password) {
    redirect(`/login?error=missing&next=${encodeURIComponent(next)}`);
  }

  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    redirect(`/login?error=invalid&next=${encodeURIComponent(next)}`);
  }

  redirect(next);
}

const USERNAME_PATTERN = /^[a-z0-9_-]{3,10}$/;

function tidyUsername(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, "")
    .slice(0, 10);
}

/*
 * Creating an account.
 *
 * The username is taken here, before the address is even created, so
 * the name is free by the time the trigger tries to assign one. The
 * trigger would generate something either way — this is what lets the
 * person choose rather than accept whatever their email suggests.
 *
 * Order matters: availability is checked first, because signing up and
 * then discovering the name is taken would leave an account nobody can
 * rename for the rest of the day.
 */
export async function signUp(formData: FormData): Promise<void> {
  const supabase = await createClient();

  const settings = await getSettings();

  if (!settings.registrations_enabled) {
    redirect("/signup?error=closed");
  }

  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const username = tidyUsername(String(formData.get("username") ?? ""));

  if (!email || password.length < 8) {
    redirect("/signup?error=short");
  }

  /* Empty is allowed on purpose: the trigger assigns a name derived
     from the email, and the person can change it once from their
     profile. A wrong name is not worth blocking a signup over. */
  if (username.length > 0 && !USERNAME_PATTERN.test(username)) {
    redirect("/signup?error=username_shape");
  }

  if (username.length > 0) {
    const { data: free, error: lookupError } = await supabase.rpc(
      "username_available",
      { p_username: username }
    );

    if (lookupError) {
      redirect("/signup?error=failed");
    }

    if (!free) {
      redirect(
        `/signup?error=username_taken&username=${encodeURIComponent(username)}`
      );
    }
  }

  const { data, error } = await supabase.auth.signUp({ email, password });

  if (error || !data.user) {
    redirect("/signup?error=failed");
  }

  /* The account exists and the trigger has already run, so the name can
     be claimed. requireUsernameChange resets the "changed once" clock,
     which is what makes this a choice rather than the free change every
     new account would otherwise be spending. */
  if (username.length > 0) {
    await supabase.rpc("claim_username_at_signup", {
      p_user_id: data.user.id,
      p_username: username,
    });
  }

  redirect(username.length > 0 ? "/" : "/profile?welcome=name");
}
