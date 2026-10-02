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
