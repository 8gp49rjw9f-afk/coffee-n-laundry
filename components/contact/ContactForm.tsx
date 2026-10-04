"use client";

import { useState } from "react";

import { Button, Card, ErrorBanner, Input, Textarea } from "@/components/ui";

import { sendContact } from "@/app/actions/contact";

/*
 * One form, two pages. "Report a bug" and "Reach us" differ only in
 * the subject line the admins see, so they differ only in the `kind`
 * this component is handed.
 *
 * The address is optional on purpose: a traveller who spots a broken
 * page should not have to have an account to say so.
 */

export function ContactForm({
  kind,
  intro,
  placeholder,
  subjectPrefix,
}: {
  kind: "bug" | "reach";
  intro: string;
  placeholder: string;
  subjectPrefix: string;
}) {
  const [message, setMessage] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setError("");
    setBusy(true);

    const formData = new FormData();
    formData.set("kind", kind);
    formData.set("message", message.trim());
    formData.set("email", email.trim());

    const result = await sendContact(formData);

    setBusy(false);

    if (!result.ok) {
      setError(result.message ?? "Could not send that.");
      return;
    }

    setSent(true);
  }

  if (sent) {
    return (
      <Card>
        <p className="text-base font-semibold text-emerald-800">
          ✅ Sent. Thank you.
        </p>

        <p className="mt-2 text-sm text-slate-600">
          An admin will read it. If you left an address, they can answer you
          directly.
        </p>

        <Button href="/" variant="ghost" className="mt-4 w-full">
          Back to the map
        </Button>
      </Card>
    );
  }

  return (
    <Card>
      <Textarea
        label="What happened?"
        hint={intro}
        value={message}
        onChange={(event) => setMessage(event.target.value)}
        rows={6}
        placeholder={placeholder}
      />

      <div className="mt-4">
        <Input
          label="Your email"
          hint="Optional. Without it we cannot answer you."
          type="email"
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="name@example.com"
        />
      </div>

      {error && (
        <div className="mt-4">
          <ErrorBanner message={error} />
        </div>
      )}

      <Button
        onClick={submit}
        disabled={busy || message.trim().length === 0}
        className="mt-4 w-full"
      >
        {busy ? "Sending…" : `Send — ${subjectPrefix}`}
      </Button>

      <p className="mt-3 text-center text-xs text-slate-400">
        Goes straight to the admins. Nothing is posted publicly.
      </p>
    </Card>
  );
}

export default ContactForm;
