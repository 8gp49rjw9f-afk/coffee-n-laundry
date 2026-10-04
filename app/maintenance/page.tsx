import { Card, Badge } from "@/components/ui";

import { getSettings } from "@/lib/services/settings";

export const metadata = { title: "Maintenance — coffee'n'laundry" };

export default async function MaintenancePage() {
  const settings = await getSettings();

  const message =
    settings.maintenance_message?.trim() ||
    "coffee'n'laundry is being worked on. Try again shortly.";

  return (
    <main className="mx-auto flex min-h-[70vh] max-w-2xl flex-col items-center justify-center px-6 py-24 text-center">
      <div className="text-6xl">🛠️</div>

      <h1 className="mt-6 text-3xl font-bold text-slate-900">
        Back in a moment
      </h1>

      <p className="mt-3 text-slate-600">{message}</p>

      {/*
        The way back in, for an admin.

        proxy.ts never redirects an admin here, so anybody reading this
        is a visitor — but if they sign in as an admin from this page,
        they land back on the working site. Without this link the
        maintenance screen would be a dead end for everyone.
      */}
      <p className="mt-10 text-xs text-slate-400">
        Working on the site?{" "}
        <a href="/login" className="font-semibold underline">
          Sign in
        </a>
      </p>
    </main>
  );
}
