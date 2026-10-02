import Link from "next/link";

import { Card, Input, Button, ErrorBanner } from "@/components/ui";

import { signIn } from "@/app/actions/auth";

const MESSAGES: Record<string, string> = {
  missing: "Enter your email and password.",
  invalid: "That email and password do not match.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const query = await searchParams;

  const error = typeof query.error === "string" ? MESSAGES[query.error] : undefined;
  const next = typeof query.next === "string" ? query.next : "/";

  return (
    <main className="mx-auto max-w-md px-4 py-10 sm:px-8">
      <h1 className="text-2xl font-bold text-slate-900">Log in</h1>

      <p className="mb-6 mt-1 text-sm text-slate-600">
        You need an account to add places and submit updates.
      </p>

      <Card>
        <form action={signIn} className="space-y-4">
          <input type="hidden" name="next" value={next} />

          <Input
            label="Email"
            name="email"
            type="email"
            autoComplete="email"
            required
          />

          <Input
            label="Password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
          />

          {error && <ErrorBanner message={error} />}

          <Button type="submit" className="w-full">
            Log in
          </Button>
        </form>

        <p className="mt-4 text-center text-sm text-slate-600">
          <Link href="/forgot-password" className="font-semibold underline">
            Forgot your password?
          </Link>
        </p>

        <p className="mt-2 text-center text-sm text-slate-600">
          No account?{" "}
          <Link href="/signup" className="font-semibold underline">
            Create one
          </Link>
        </p>
      </Card>
    </main>
  );
}
