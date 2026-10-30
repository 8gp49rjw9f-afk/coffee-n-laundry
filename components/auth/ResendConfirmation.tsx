"use client";

import { useEffect, useState } from "react";

import { Button, ErrorBanner } from "@/components/ui";

import { createClient } from "@/lib/supabase/browser";

/*
 * The screen a person lands on the moment their account is created.
 *
 * It exists because Supabase holds the session back until the link in
 * the confirmation email is opened — and the site used to say nothing
 * about that. People signed up, arrived at the home page signed out,
 * tried to log in, were told their password was wrong, and gave up
 * believing the site was broken. Nothing was broken; nobody had told
 * them to read their email.
 *
 * So the address is shown in full. That is what catches a typo: if it
 * is wrong, they see it here rather than waiting forever for a letter
 * that went somewhere else.
 *
 * The resend button locks for a minute. Without that, a worried person
 * taps it six times and their provider starts treating us as a source
 * of junk mail.
 */

const WAIT_SECONDS = 60;

export function ResendConfirmation({ email }: { email: string }) {
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [failed, setFailed] = useState(false);
  const [wait, setWait] = useState(0);

  /* The countdown. It runs only while there is time left on it. */
  useEffect(() => {
    if (wait <= 0) return;

    const id = window.setTimeout(() => setWait((n) => n - 1), 1000);

    return () => window.clearTimeout(id);
  }, [wait]);

  async function resend() {
    setBusy(true);
    setFailed(false);

    try {
      const supabase = createClient();

      const { error } = await supabase.auth.resend({
        type: "signup",
        email,
      });

      if (error) {
        setFailed(true);
      } else {
        setSent(true);
        setWait(WAIT_SECONDS);
      }
    } catch {
      setFailed(true);
    }

    setBusy(false);
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-700">
        We sent a confirmation link to{" "}
        <strong className="break-all">{email}</strong>.
      </p>

      <p className="text-sm text-slate-700">
        Open that email and click the link — your account isn&apos;t active
        until you do. Until then, you won&apos;t be able to sign in.
      </p>

      <p className="text-sm text-slate-600">
        Nothing after a few minutes? Look in your spam folder. If it&apos;s
        still not there, send it again.
      </p>

      {sent && (
        <p className="text-sm font-medium text-slate-700">
          Sent. Have another look in your inbox.
        </p>
      )}

      {failed && (
        <ErrorBanner message="Could not send it just now. Try again in a moment." />
      )}

      <Button
        type="button"
        onClick={resend}
        disabled={busy || wait > 0}
        className="w-full"
      >
        {wait > 0
          ? `Send it again in ${wait}s`
          : busy
            ? "Sending…"
            : sent
              ? "Send it again"
              : "Resend the email"}
      </Button>
    </div>
  );
}
