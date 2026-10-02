import { redirect } from "next/navigation";

import { NewPlaceForm } from "@/components/place/NewPlaceForm";

import { createPlace } from "@/app/actions/places";

import { createClient } from "@/lib/supabase/server";
import { getSettings } from "@/lib/services/settings";
import { getChainPatterns } from "@/lib/database/chainFlags";

export default async function NewPlacePage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/new");
  }

  const [settings, chainPatterns] = await Promise.all([
    getSettings(),
    getChainPatterns(),
  ]);

  return (
    <main className="mx-auto max-w-2xl px-4 py-6 sm:px-8">
      <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">
        Add a place
      </h1>

      <p className="mb-6 mt-1 text-sm text-slate-600">
        Two minutes now saves everyone else a wasted trip. Independent places
        only — a chain is not worth driving across town for.
      </p>

      <NewPlaceForm
        submit={createPlace}
        currencyHint={settings.currency_hint}
        chainPatterns={chainPatterns}
      />
    </main>
  );
}
