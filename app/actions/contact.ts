"use server";

import { createClient } from "@/lib/supabase/server";
import { currentBan } from "@/lib/services/admin";

/*
 * Bug reports and messages, both sent to the admins as a plain email
 * through Resend — no queue, no table.
 *
 * The subject opens with the kind, so an inbox sorts itself:
 *
 *   Bug : <first words of the message>
 *   Reach Us : <first words of the message>
 *
 * The sender's address goes in `reply_to`, never in `from`: Resend
 * only sends from a domain you have verified, and a forged From would
 * be rejected or land in spam.
 *
 * Every failure answers with a CODE. This action returns rather than
 * throws — it is called from a client component across the boundary —
 * so a code in the return value is what reaches the popup.
 *
 * AND A BANNED ACCOUNT IS REFUSED. The form is open to visitors, so
 * somebody suspended can still reach it — the gate has to be here,
 * not only in the screens they are signed into.
 */

export interface ContactResult {
  ok: boolean;
  code?: string;
}

const PREFIX: Record<string, string> = {
  bug: "Bug",
  reach: "Reach Us",
  place: "Bad or fake place",
  other: "Message",
};

/* The first few words, so the subject says something. Enough to
   recognise the message, short enough not to wrap in a list view. */
function opening(message: string): string {
  const firstLine = message.split("\n")[0].trim();

  return firstLine.length > 60 ? `${firstLine.slice(0, 57)}…` : firstLine;
}

export async function sendContact(formData: FormData): Promise<ContactResult> {
  /* First, before anything is read or sent. A suspended account keeps
     the right to read the site and to write to us about the
     suspension — but not through this form, which posts a message
     into the admins' inbox. */
  const ban = await currentBan();
  if (ban.banned) return { ok: false, code: "ACCOUNT_BANNED" };

  const kind = String(formData.get("kind") ?? "other");
  const message = String(formData.get("message") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const placeUrl = String(formData.get("place_url") ?? "").trim();

  if (!message) {
    return { ok: false, code: "CONTACT_EMPTY" };
  }

  if (message.length > 2000) {
    return { ok: false, code: "CONTACT_TOO_LONG" };
  }

  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.CONTACT_FROM_EMAIL;

  if (!apiKey || !from) {
    /* Deliberately explicit in the popup rather than silent: a contact
       form that quietly drops its message is worse than one that
       admits it is not wired up. */
    return { ok: false, code: "CONTACT_NOT_CONFIGURED" };
  }

  /*
   * The recipients are the admins, read with the service key when it
   * is available. Through the visitor's own session it would return
   * nothing: RLS reserves `admins` for admins, so a signed-out person
   * could never send anything at all.
   */
  const recipients = await adminEmails();

  if (recipients.length === 0) {
    return { ok: false, code: "CONTACT_NO_RECIPIENT" };
  }

  const prefix = PREFIX[kind] ?? PREFIX.other;
  const subject = `${prefix} : ${opening(message)}`;

  const body = [
    message,
    "",
    placeUrl ? `Page: ${placeUrl}` : null,
    email ? `From: ${email}` : "From: a visitor (no address given)",
  ]
    .filter((line) => line !== null)
    .join("\n");

  try {
    const response = await fetch("[api.resend.com](https://api.resend.com/emails)", {
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

      return { ok: false, code: "CONTACT_SEND_FAILED" };
    }

    return { ok: true };
  } catch (error) {
    console.error("[sendContact]", error);

    return { ok: false, code: "CONTACT_SEND_FAILED" };
  }
}

/*
 * Who the message goes to.
 *
 * Not every admin wants this mail. `notify_email` is the switch, set
 * from the admin page, and an admin who turns it off keeps every other
 * right — they still see the panel, still approve places. They just
 * stop receiving a copy of what a visitor wrote.
 *
 * The filter is not applied in `currentAdmin` or `isMaster`: those
 * answer "may this person act?", which has nothing to do with whether
 * they want the mail.
 *
 * A service key is the plain way to read a table RLS keeps closed,
 * and it is what runs in production. Without one, the fallback is the
 * visitor's own session — which only works for an admin testing the
 * form, and returns nothing for everyone else. That is why the reply
 * above names the missing configuration instead of staying silent.
 */
async function adminEmails(): Promise<string[]> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (url && serviceKey) {
    try {
      const response = await fetch(
        `${url}/rest/v1/admins?select=email&notify_email=is.true&limit=20`,
        {
          headers: {
            apikey: serviceKey,
            Authorization: `Bearer ${serviceKey}`,
          },
          cache: "no-store",
        }
      );

      if (response.ok) {
        const rows = (await response.json()) as { email?: string }[];

        return rows
          .map((row) => row.email)
          .filter((value): value is string => Boolean(value));
      }

      console.error("[adminEmails]", response.status, await response.text());
    } catch (error) {
      console.error("[adminEmails]", error);
    }
  }

  const supabase = await createClient();

  const { data } = await supabase
    .from("admins")
    .select("email")
    .eq("notify_email", true)
    .limit(20);

  return (data ?? [])
    .map((row) => row.email)
    .filter((value): value is string => Boolean(value));
}
