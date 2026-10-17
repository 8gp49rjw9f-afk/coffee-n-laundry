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
 *   ?error=…   — something was refused. `missing` is the form itself.
 *                `failed` is the other one: it arrives from
 *                /auth/confirm, when a recovery link could not be
 *                exchanged for a session. That code had no entry here
 *                for a long time, so MESSAGES returned undefined, the
 *                banner never rendered, and a person whose link had
 *                broken was shown the request form again with no word
 *                about what had just happened.
 *
 * `failed` therefore gets more than a sentence. A recovery link can be
 * rewritten on its way through a mail gateway — the address is
 * correct, the gateway substitutes its own domain to inspect the
 * target, and the substitution does not resolve. The person sees a
 * page that has nothing to do with us. That is not their fault and
 * there is nothing to fix on their side, so the help below spells out
 * the one repair they can make: put our address back at the front and
 * keep the rest.
 */

const MESSAGES: Record<string, string> = {
  missing: "Enter your email address.",
  failed:
    "That link did not work. Links can be altered in transit — see the note below.",
};

export default async function ForgotPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const query = await searchParams;

  const error = typeof query.error === "string" ? MESSAGES[query.error] : undefined;

  const linkFailed = query.error === "failed";

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
       * SHOWN AFTER `failed` AND NOT ALWAYS. Someone who simply typed
       * the wrong address does not need a lesson in link rewriting,
       * and a page that explains a rare failure to everybody teaches
       * no one. It appears when the link has actually failed, which is
       * the only moment the instruction has a subject.
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
    </main>
  );
}
