import Link from "next/link";

import { Card, Input, Button, ErrorBanner } from "@/components/ui";

import { signUp } from "@/app/actions/auth";
import { getSettings } from "@/lib/services/settings";

const MESSAGES: Record<string, string> = {
  short: "Use at least 8 characters for your password.",
  failed: "Could not create that account. It may already exist.",
  closed: "Registrations are closed right now.",
};

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const query = await searchParams;
  const settings = await getSettings();

  const error = typeof query.error === "string" ? MESSAGES[query.error] : undefined;

  return (
    <main className="mx-auto max-w-md px-4 py-10 sm:px-8">
      <h1 className="text-2xl font-bold text-slate-900">Create an account</h1>

      <p className="mb-6 mt-1 text-sm text-slate-600">
        Free for the first year. Contributing earns credits you can spend later.
      </p>

      <Card>
        {settings.registrations_enabled ? (
          <form action={signUp} className="space-y-4">
            <Input label="Email" name="email" type="email" autoComplete="email" required />

            <Input
              label="Password"
              name="password"
              type="password"
              autoComplete="new-password"
              minLength={8}
              hint="At least 8 characters"
              required
            />

            {error && <ErrorBanner message={error} />}

            <Button type="submit" className="w-full">
              Create account
            </Button>
          </form>
        ) : (
          <p className="text-sm text-slate-600">
            Registrations are closed at the moment.
          </p>
        )}

        <p className="mt-4 text-center text-sm text-slate-600">
          Already have one?{" "}
          <Link href="/login" className="font-semibold underline">
            Log In
          </Link>
        </p>
      </Card>
    </main>
  );
}
