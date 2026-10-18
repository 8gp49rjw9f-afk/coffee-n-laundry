import Link from "next/link";

import { createClient } from "@/lib/supabase/server";
import {
  getPlace,
  getMyWeekChecks,
  getPriceHistory,
} from "@/lib/database/places";

import { PlaceHeader } from "@/components/place/PlaceHeader";
import { PhotoStrip } from "@/components/place/PhotoStrip";
import { CoffeeTable } from "@/components/place/CoffeeTable";
import { LaundryTable } from "@/components/place/LaundryTable";
import { CommentSection } from "@/components/place/CommentSection";
import { ReportForm } from "@/components/place/ReportForm";

import { Card, Button, DirectionsButton } from "@/components/ui";

import {
  verifyField,
  hasConfirmedThisWeek,
} from "@/app/actions/verify";
import { hasCommentedToday } from "@/app/actions/comments";

import { getFreshness } from "@/lib/services/freshness";
import { currentAdmin } from "@/lib/services/admin";

export default async function PlacePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { id } = await params;
  const query = await searchParams;

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  /* Two independent reads, so they go together — and the admin check
     is done here, once, rather than in the header: whether this person
     may delete the place is a server fact, not a rendering choice. */
  const [place, admin] = await Promise.all([getPlace(id), currentAdmin()]);

  if (!place) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-16 text-center">
        <div className="text-5xl">🧭</div>

        <h1 className="mt-4 text-2xl font-bold text-slate-900">No such place</h1>

        <p className="mt-2 text-slate-600">
          It may have been removed, or the link is wrong.
        </p>

        <Button href="/" className="mt-6">
          ← Back to the map
        </Button>
      </main>
    );
  }

  /*
   * Five reads, in parallel, and all five feed the page:
   *
   *   lastConfirmation  — the “last on …” line beside the count
   *   myWeekChecks      — which per-field buttons say “This week”
   *   confirmedThisWeek — what the verify button in the header says
   *   priceHistory      — the “was 6$” line under a price
   *   writtenToday      — whether to offer the comment field
   *
   * The last one is new with the comments panel. It asks the same
   * question writeComment will ask, so the form is not offered and
   * then refused — and it is read here, on the server, because a
   * client component cannot answer it before rendering.
   */
  const [
    lastConfirmation,
    myWeekChecks,
    confirmedThisWeek,
    priceHistory,
    writtenToday,
  ] = await Promise.all([
    supabase
      .from("place_confirmations")
      .select("created_at")
      .eq("place_id", id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()
      .then((r) => r.data),

    user ? getMyWeekChecks(id, user.id) : Promise.resolve([] as string[]),

    user ? hasConfirmedThisWeek(id, user.id) : Promise.resolve(false),

    getPriceHistory(id),

    user ? hasCommentedToday(id, user.id) : Promise.resolve(false),
  ]);

  const freshness = getFreshness(place.last_verified_at);

  return (
    <main className="mx-auto max-w-3xl space-y-4 px-4 py-5 sm:px-8">
      {query.updated && (
        <p className="rounded-xl bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">
          ✅ Thanks — your update is on the page and you earned credits.
        </p>
      )}

      {query.unchanged && (
        <p className="rounded-xl bg-slate-100 px-4 py-3 text-sm font-semibold text-slate-700">
          Nothing had changed, so nothing was logged. Thanks for checking.
        </p>
      )}

      {query.reported && (
        <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">
          🚩 Reported. Someone will take a look.
        </p>
      )}

      {place.status === "closed" && (
        <p className="rounded-xl bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-800">
          ❌ Reported permanently closed. The information below may be out of
          date.
        </p>
      )}

      {place.status === "unverified" && (
        <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">
          ⚠️ Several people reported this place as wrong. Take the details
          below with a pinch of salt.
        </p>
      )}

      <PlaceHeader
        place={place}
        freshness={freshness}
        signedIn={Boolean(user)}
        confirmedThisWeek={confirmedThisWeek}
        creatorName={place.creator_name}
        canDelete={Boolean(admin)}
      />

      {/*
       * The photo strip. Cards are 38% wide on a phone — narrow enough
       * that one is always cut off at the edge, which is what tells you
       * the rail swipes — with a row of dots underneath.
       */}
      <PhotoStrip
        photos={place.photos}
        bucketUrl={place.photo_bucket_url}
        placeId={place.id}
        signedIn={Boolean(user)}
      />

      {place.place_type === "coffee" && (
        <CoffeeTable
          key={place.id}
          placeId={place.id}
          facts={{
            prices: place.prices ?? [],
            coffee_kind: place.coffee?.coffee_kind ?? null,
            roaster: place.coffee?.roaster ?? null,
            sells_beans: place.coffee?.sells_beans ?? null,
            has_roaster: place.coffee?.has_roaster ?? null,

            /*
             * All five milks, cow included. The interface declared only
             * the four plant ones, so the milk row could not name
             * dairy even though the column exists and the form asks
             * for it — a café that pours cow milk and nothing else
             * showed an empty line.
             */
            has_milk: place.coffee?.has_milk ?? null,
            has_oat_milk: place.coffee?.has_oat_milk ?? null,
            has_soy_milk: place.coffee?.has_soy_milk ?? null,
            has_coconut_milk: place.coffee?.has_coconut_milk ?? null,
            has_almond_milk: place.coffee?.has_almond_milk ?? null,

            has_decaf: place.coffee?.has_decaf ?? null,

            ambience: place.coffee?.ambience ?? [],
            food: place.coffee?.food ?? [],
            laptop_friendly: place.coffee?.laptop_friendly ?? null,
            has_wifi: place.has_wifi,
            has_power: place.has_power,
            has_parking: place.has_parking,
            has_seating: place.has_seating,
            has_toilets: place.has_toilets,
          }}
          checks={place.field_checks}
          priceHistory={priceHistory}
          verify={verifyField}
          doneThisWeek={myWeekChecks}
        />
      )}

      {place.place_type === "laundry" && (
        <LaundryTable
          key={place.id}
          placeId={place.id}
          facts={{
            prices: place.prices ?? [],
            detergent_included: place.laundry?.detergent_included ?? null,
            detergent_purchasable: place.laundry?.detergent_purchasable ?? null,
            machine_sizes: place.laundry?.machine_sizes ?? [],
            open_24h: place.laundry?.open_24h ?? null,
            wash_minutes: place.laundry?.wash_minutes ?? null,
            dryer_minutes: place.laundry?.dryer_minutes ?? null,
            last_entry_minutes: place.laundry?.last_entry_minutes ?? null,
            has_wifi: place.has_wifi,
            has_power: place.has_power,
            has_parking: place.has_parking,
            has_seating: place.has_seating,
            has_toilets: place.has_toilets,
          }}
          checks={place.field_checks}
          priceHistory={priceHistory}
          verify={verifyField}
          doneThisWeek={myWeekChecks}
        />
      )}

      {/* WHAT TO DO WITH THE PLACE, before how to get to it.

          The update link used to sit BELOW the directions row, which put
          “how do I drive there” ahead of “the price is wrong, let me fix
          it” — the second of which is the whole point of the site. It
          now opens the block of actions.

          The Directions row and the Website link stay together under it:
          both are “leave the page and go somewhere”. */}
      <Link
        href={`/update/${place.id}`}
        className="flex min-h-11 items-center justify-center rounded-xl border border-slate-300 bg-white px-4 font-semibold text-slate-800 hover:bg-slate-50"
      >
        📷 Submit an update or a photo
      </Link>

      <div className="flex flex-wrap justify-center gap-2">
        <DirectionsButton latitude={place.latitude} longitude={place.longitude} />

        {place.website && (
          <a
            href={place.website}
            target="_blank"
            rel="noreferrer"
            className="inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-300 bg-white px-4 font-semibold text-slate-800 hover:bg-slate-50"
          >
            🔗 Website
          </a>
        )}
      </div>

      {/* THE COMMENTS PANEL, where the “Last 5 updates” card used to be.

          That card is gone. What CHANGED about a place still shows — the
          price table says “was 6$” under the price itself, and the count
          of confirmations sits in this header. What was missing was a
          voice, and this is it.

          The confirmations and their date come down with it, and the
          place they left is written in CommentSection. */}
      <CommentSection
        placeId={place.id}
        comments={place.comments}
        signedIn={Boolean(user)}
        writtenToday={writtenToday}
        confirmations={place.confirmations_count}
        lastConfirmedAt={lastConfirmation?.created_at ?? null}
      />

      <Card padding="sm">
        <ReportForm placeId={place.id} />
      </Card>

      <div className="pb-8 text-center text-xs text-slate-400">
        {place.updates_count} updates · {place.photos_count} photos
      </div>
    </main>
  );
}
