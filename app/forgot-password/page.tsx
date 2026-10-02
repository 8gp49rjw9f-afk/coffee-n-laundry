import Link from "next/link";

import { Card, Input, Button, ErrorBanner } from "@/components/ui";

import { requestPasswordReset } from "@/app/actions/password";

const MESSAGES: Record<string, string> = {
  missing: "Enter your email address.",
};

export default async function ForgotPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const query = await searchParams;

  const error = typeof query.error === "string" ? MESSAGES[query.error] : undefined;
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
    </main>
  );
}
