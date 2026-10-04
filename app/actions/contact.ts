"use server";

import { createClient } from "@/lib/supabase/server";

/*
 * Contact, and report a bad listing. Both go to the admins' inbox as a
 * plain email through Resend — no queue, no table. If the key is not
 * configured the action says so instead of pretending it worked.
 *
 * The sender's address goes in `reply_to`, never in `from`: Resend
 * only sends from a domain you have verified, and a forged From would
 * be rejected or land in spam.
 */

export interface ContactResult {
  ok: boolean;
  message?: string;
}

const SUBJECTS: Record<string, string> = {
  bug: "Bug report",
  place: "Bad or fake place",
  other: "Message",
};

export async function sendContact(formData: FormData): Promise<ContactResult> {
  const kind = String(formData.get("kind") ?? "other");
  const message = String(formData.get("message") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const placeUrl = String(formData.get("place_url") ?? "").trim();

  if (!message) {
    return { ok: false, message: "Write something first." };
  }

  if (message.length > 2000) {
    return { ok: false, message: "That message is too long." };
  }

  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.CONTACT_FROM_EMAIL;

  if (!apiKey || !from) {
    /* Deliberately explicit: a contact form that silently drops its
       message is worse than one that admits it is not wired up. */
    return {
      ok: false,
      message:
        "The contact form is not configured on this deployment. Reach the admins another way.",
    };
  }

  /* The admins are the recipients. Read with the visitor's own client:
     a signed-out person sees nothing, so a message from them would
     have nowhere to go — hence the fallback below. */
  const supabase = await createClient();

  const { data: admins } = await supabase
    .from("admins")
    .select("email")
    .limit(20);

  const recipients = (admins ?? [])
    .map((row) => row.email)
    .filter((value): value is string => Boolean(value));

  if (recipients.length === 0) {
    return {
      ok: false,
      message:
        "Could not find an admin address. Try again once you are signed in.",
    };
  }

  const subject = SUBJECTS[kind] ?? SUBJECTS.other;

  const body = [
    message,
    "",
    placeUrl ? `Page: ${placeUrl}` : null,
    email ? `From: ${email}` : "From: a visitor (no address given)",
  ]
    .filter((line) => line !== null)
    .join("\n");

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: recipients,
        subject: `[coffee'n'laundry] ${subject}`,
        text: body,
        ...(email ? { reply_to: email } : {}),
      }),
    });

    if (!response.ok) {
      const detail = await response.text();

      console.error("[sendContact]", response.status, detail);

      return { ok: false, message: "Could not send that. Try again later." };
    }

    return { ok: true };
  } catch (error) {
    console.error("[sendContact]", error);

    return { ok: false, message: "Could not send that. Try again later." };
  }
}
