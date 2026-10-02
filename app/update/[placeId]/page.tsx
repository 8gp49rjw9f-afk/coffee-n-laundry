import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { getPlace } from "@/lib/database/places";

import { UpdateForm } from "@/components/place/UpdateForm";
import { PhotoUpload } from "@/components/place/PhotoUpload";

import type { PlaceType } from "@/lib/types";

export default async function UpdatePlacePage({
  params,
}: {
  params: Promise<{ placeId: string }>;
}) {
  const { placeId } = await params;

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/login?next=/update/${placeId}`);
  }

  const place = await getPlace(placeId);

  if (!place) {
    redirect("/");
  }

  const placeType = place.place_type as PlaceType;

  /* One edit per day, per type, per person. Checked here so the form
   * is replaced by the reason rather than failing at the end. */
  const today = new Date().toISOString().slice(0, 10);

  const { count: editsToday } = await supabase
    .from("place_updates")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("place_kind", placeType)
    .eq("update_day", today)
    .neq("update_type", "photo");

  const canEdit = (editsToday ?? 0) === 0;

  const blockedMessage =
    placeType === "coffee"
      ? "You already edited a coffee shop today."
      : "You already edited a laundromat today.";

  return (
    <main className="mx-auto max-w-2xl space-y-6 px-4 py-6 sm:px-8">
      <div>
        <a
          href={`/place/${place.id}`}
          className="text-sm font-semibold text-slate-500 hover:text-slate-900"
        >
          ← Back to {place.name}
        </a>

        <h1 className="mt-3 text-2xl font-bold text-slate-900 sm:text-3xl">
          Submit an update or a photo
        </h1>

        <p className="mt-1 text-sm text-slate-600">
          Correct what is wrong, add what is missing. Photos are always
          welcome, whatever the day.
        </p>
      </div>

      <section>
        <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-slate-500">
          Add photos
        </h2>

        <PhotoUpload placeId={place.id} />
      </section>

      <section>
        <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-slate-500">
          Update the information
        </h2>

        <UpdateForm
          place={{
            id: place.id,
            name: place.name,
            place_type: placeType,
            address: place.address,
            city: place.city,
            country: place.country,
            latitude: place.latitude,
            longitude: place.longitude,
            website: place.website,
            description: place.description,
            accepted_payments: place.accepted_payments ?? [],
            has_wifi: place.has_wifi,
            has_power: place.has_power,
            has_parking: place.has_parking,
            has_seating: place.has_seating,
            has_toilets: place.has_toilets,
            coffee: place.coffee ?? null,
            laundry: place.laundry ?? null,
            prices: (place.prices ?? []).map((p) => ({
              kind: p.kind,
              amount: Number(p.amount),
              currency: p.currency,
            })),
          }}
          canEdit={canEdit}
          blockedMessage={blockedMessage}
        />
      </section>
    </main>
  );
}
