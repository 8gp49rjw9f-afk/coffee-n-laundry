import Link from "next/link";

import { Card, Input, Button, ErrorBanner } from "@/components/ui";

import { requestPasswordReset } from "@/app/actions/password";

/*
 * Two ways in, and they are not the same screen.
 *
 *   ?sent=1    — the form was submitted. The confirmation is the same
 *                whether or not the address exists; saying which ones
 *                are registered is not our business.
 *
 *   ?error=…   — something was refused, and WHICH something is the
 *                point of this block.
 *
 * THE CODES, AND WHY THERE ARE FOUR OF THEM.
 *
 * There used to be two, and the second one was doing three jobs.
 * `failed` was returned for a link that arrived damaged, for a send
 * Supabase had refused, and for anything else that went wrong — so a
 * person whose request never left the building was shown "Links can
 * be altered in transit", a sentence about email gateways, with no
 * send ever having happened.
 *
 * Each failure now carries its own code, because each has a
 * different thing to say and a different thing to do about it:
 *
 *   missing  — the form arrived empty.
 *   send     — Supabase refused to send the email. Almost always its
 *              rate limit on a small project, so the advice is to
 *              wait rather than to check anything.
 *   expired  — the link was opened too late.
 *   used     — the link had already been consumed, often by a mail
 *              scanner visiting it before its owner did.
 *   failed   — the link arrived without a code or a token. This is
 *              the ONLY case the gateway note below describes, and
 *              the only one it is still shown for.
 *
 * `expired` and `used` are set by /auth/confirm, which reads them
 * from the parameters Supabase appends when a verify is refused.
 */

const MESSAGES: Record<string, string> = {
  missing: "Enter your email address.",
  send: "The email could not be sent. Wait a little and try once more.",
  expired: "That link has expired. Ask for a new one below.",
  used: "That link has already been used. Ask for a new one below.",
  failed:
    "That link did not work. Links can be altered in transit — see the note below.",
};

export default async function ForgotPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const query = await searchParams;

  const code = typeof query.error === "string" ? query.error : undefined;

  const error = code ? MESSAGES[code] : undefined;

  /*
   * The long note appears for `failed` alone.
   *
   * It was written for one failure — a link rewritten on its way
   * through a mail gateway — and it describes that failure in three
   * steps. Shown for an expired link, or for a send Supabase
   * refused, it teaches a procedure that cannot help and implies the
   * person's email provider did something it did not do.
   */
  const linkFailed = code === "failed";

  const sent = Boolean(query.sent);

  return (
    <main className="mx-auto max-w-md px-4 py-10 sm:px-8">
      <h1 className="text-2xl font-bold text-slate-900">Reset your password</h1>

      <p className="mb-6 mt-1 text-sm text-slate-600">
        We will email you a link. It works once, and only for a short while.
      </p>

      <Card>
        {sent ? (
          <p className="rounded-xl bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">
            ✅ If that address has an account, the link is on its way. Check
            your spam folder too.
          </p>
        ) : (
          <form action={requestPasswordReset} className="space-y-4">
            <Input
              label="Email"
              name="email"
              type="email"
              autoComplete="email"
              required
            />

            {error && <ErrorBanner message={error} />}

            <Button type="submit" className="w-full">
              Send the link
            </Button>
          </form>
        )}

        <p className="mt-4 text-center text-sm text-slate-600">
          <Link href="/login" className="font-semibold underline">
            Back to log in
          </Link>
        </p>
      </Card>

      {/*
       * The repair, in three steps, only where it is needed.
       *
       * SHOWN AFTER `failed` AND NOT ALWAYS. Someone who typed the
       * wrong address does not need a lesson in link rewriting, and
       * a page that explains a rare failure to everybody teaches no
       * one. It appears when the link has actually failed, which is
       * the only moment the instruction has a subject — and now
       * that the other failures have codes of their own, that is the
       * only moment it appears at all.
       */}
      {linkFailed && (
        <Card>
          <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">
            The link did not work
          </h2>

          <p className="mt-2 text-sm leading-relaxed text-slate-700">
            Some email providers alter the addresses of links before you
            receive them. The link in the email was right — it is the
            copy you got that points somewhere else. You can put it
            back yourself:
          </p>

          <ol className="mt-3 space-y-2 text-sm leading-relaxed text-slate-700">
            <li>
              <span className="font-semibold">1.</span> Open the email on a
              computer, or on the phone where the link is easier to copy.
            </li>

            <li>
              <span className="font-semibold">2.</span> Copy the address of
              the link instead of opening it — right-click and choose
              &ldquo;copy link address&rdquo;, or press and hold on a phone.
            </li>

            <li>
              <span className="font-semibold">3.</span> Paste it into your
              browser, and replace everything before the word{" "}
              <code className="rounded bg-slate-100 px-1 py-0.5 text-xs">
                /auth/confirm
              </code>{" "}
              with{" "}
              <code className="rounded bg-slate-100 px-1 py-0.5 text-xs">
                https://coffee-n-laundry.com
              </code>
              . Keep everything after it exactly as it is, then press
              enter.
            </li>
          </ol>

          <p className="mt-3 text-xs leading-relaxed text-slate-400">
            That part of the address is what carries your one-time code.
            Do not retype it — copy and paste it, or a single changed
            character will make it stop working.
          </p>

          <p className="mt-4 text-sm text-slate-600">
            Or simply ask for a new link below — many providers leave the
            second one alone.
          </p>
        </Card>
      )}

      {/*
       * A link that had already been used gets one line of its own,
       * and it is here rather than in the banner because it is not a
       * fault. A mail scanner opening the link first is the usual
       * cause, and the person did nothing wrong — so the note names
       * the cause instead of asking for a fix.
       */}
      {code === "used" && (
        <Card>
          <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">
            Most likely, nothing is broken
          </h2>

          <p className="mt-2 text-sm leading-relaxed text-slate-700">
            Some email providers open the links in a message to check
            them before the message reaches you. Opening the link is
            what uses it up, so it can be spent before you ever see
            it. Ask for a new one and it will usually arrive intact.
          </p>
        </Card>
      )}
    </main>
  );
}
