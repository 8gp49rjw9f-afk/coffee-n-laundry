import Link from "next/link";

import { createClient } from "@/lib/supabase/server";

import { Card, Input, Button, ErrorBanner } from "@/components/ui";

import { setNewPassword } from "@/app/actions/password";

const MESSAGES: Record<string, string> = {
  short: "Use at least 8 characters.",
  mismatch: "The two passwords do not match.",
  failed: "That link has expired. Ask for a new one.",
};

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const query = await searchParams;

  const error = typeof query.error === "string" ? MESSAGES[query.error] : undefined;

  /* The page is only usable with a session, which /auth/confirm
     establishes. Without one the form could never save, so say so
     instead of showing a button that fails. */
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <main className="mx-auto max-w-md px-4 py-10 sm:px-8">
        <h1 className="text-2xl font-bold text-slate-900">
          This link has expired
        </h1>

        <p className="mb-6 mt-1 text-sm text-slate-600">
          Recovery links only work once, and only for a short while.
        </p>

        <Card>
          <Link
            href="/forgot-password"
            className="flex min-h-11 items-center justify-center rounded-xl bg-slate-900 px-5 font-semibold text-white hover:bg-slate-800"
          >
            Ask for a new link
          </Link>

          <p className="mt-4 text-center text-sm text-slate-600">
            <Link href="/login" className="font-semibold underline">
              Back to log in
            </Link>
          </p>
        </Card>

        {/*
         * The other reason this page appears without a session.
         *
         * "Expired" is the honest headline for the common case — the
         * link was used, or sat too long. But a link that was ALTERED
         * on its way through a mail gateway lands here too, and that
         * person has not done anything wrong and has no idea why the
         * page is telling them their link is old. It is not old; it
         * never arrived as it was sent.
         *
         * So the possibility is named, with the repair. It is kept
         * short here rather than repeated in full: the long version
         * lives on /forgot-password, one tap away, and a page that
         * shouts a rare case at everybody stops being read.
         */}
        <Card>
          <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">
            If the link in the email looked odd
          </h2>

          <p className="mt-2 text-sm leading-relaxed text-slate-700">
            Some email providers rewrite the address of a link before
            you receive it, and the rewritten one can lead nowhere.
            Copying the address and changing the part before{" "}
            <code className="rounded bg-slate-100 px-1 py-0.5 text-xs">
              /auth/confirm
            </code>{" "}
            to{" "}
            <code className="rounded bg-slate-100 px-1 py-0.5 text-xs">
              https://coffee-n-laundry.com
            </code>{" "}
            is enough to put it right.
          </p>

          <p className="mt-3 text-center text-sm">
            <Link
              href="/forgot-password?error=failed"
              className="font-semibold underline"
            >
              Show me the steps
            </Link>
          </p>
        </Card>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-md px-4 py-10 sm:px-8">
      <h1 className="text-2xl font-bold text-slate-900">
        Choose a new password
      </h1>

      <p className="mb-6 mt-1 text-sm text-slate-600">
        You are signed in as {user.email}.
      </p>

      <Card>
        <form action={setNewPassword} className="space-y-4">
          <Input
            label="New password"
            name="password"
            type="password"
            autoComplete="new-password"
            minLength={8}
            hint="At least 8 characters"
            required
          />

          <Input
            label="Repeat it"
            name="confirm"
            type="password"
            autoComplete="new-password"
            minLength={8}
            required
          />

          {error && <ErrorBanner message={error} />}

          <Button type="submit" className="w-full">
            Save the new password
          </Button>
        </form>
      </Card>
    </main>
  );
}
