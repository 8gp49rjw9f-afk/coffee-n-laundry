"use client";

import { useState } from "react";

import { formatDistance } from "@/lib/services/distance";

import type { PlaceWithFreshness } from "@/lib/types";

/* Days between a date and now — computed from a fixed "now" passed in,
   never from Date.now(), so server and browser agree. */

function daysAgo(iso: string, today: number) {
  const then = new Date(iso).getTime();

  return Math.max(0, Math.floor((today - then) / (1000 * 60 * 60 * 24)));
}

/*
 * WHAT THIS PANEL SHOWS, AND WHAT IT NO LONGER SHOWS
 *
 * The panel is what a tap on a pin opens — a card on a phone, a
 * column beside the map on a wide screen. It answers one question:
 * is this place worth walking to? So it carries, in this order:
 *
 *   the cover photo, the type, the name, the address,
 *   how you pay, whether anyone has checked it lately,
 *   Directions, Full details, the counts, and Share.
 *
 * IT WAS CARRYING TOO MUCH. Removed from this file, on request:
 *
 *   - the "facts" chips — ambience, beans for sale, wash and dryer
 *     durations, last entry, detergent. Five tags of equal weight sat
 *     between the address and the payment line, and a reader had to
 *     scan them all before reaching the two things that decide a
 *     visit. They are all still on the place page, which is where
 *     somebody goes to compare rather than to decide.
 *
 *   - the amenity icons — wifi, power, parking. Three glyphs with no
 *     words, on a card whose whole job is to be read in five seconds.
 *
 *   - the wash and dryer prices. They were the laundromat's own
 *     version of the same problem: two coloured pills sitting above
 *     everything else, when the price is already the first thing the
 *     place page shows.
 *
 *   - the newest note, `latest_note`, shown between quotation marks.
 *     It was capped at two lines, so a long note was cut mid-sentence
 *     — and a note nobody can finish does not help anyone decide.
 *
 * WHAT CHANGED ABOUT PAYMENT
 *
 * It used to be five icons and a hard cut: `.slice(0, 5)`, with a
 * lookup table that drew 💵 for cash, 💳 for card, and a bare ➖ for
 * anything it did not recognise. Two problems at once — a laundromat
 * that accepts four methods showed three, and ➖ told the reader
 * nothing about the fourth.
 *
 * Now every method is printed, in words, and nothing is cut. The keys
 * the add-a-place form writes are the four below; the rest of the map
 * is kept for places entered before the form was simplified, where
 * those keys really do exist in the column.
 */

export function PlacePanel({
  place,
  bucketUrl,
  distanceLabel,
  today,
  onClose,
}: {
  place: PlaceWithFreshness;
  bucketUrl: string;
  distanceLabel?: string | null;
  today: number;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);

  const isCoffee = place.place_type === "coffee";

  /* ---------- one line of freshness ---------- */

  const fresh = place.last_verified_at
    ? daysAgo(place.last_verified_at, today)
    : null;

  const freshLabel =
    fresh == null
      ? "never verified"
      : fresh === 0
        ? "verified today"
        : fresh === 1
          ? "verified yesterday"
          : fresh < 30
            ? `verified ${fresh} days ago`
            : `verified ${Math.round(fresh / 30)} months ago`;

  /* ---------- how you pay, in words ---------- */

  const payments = (place.accepted_payments ?? []).filter(
    (value): value is string => typeof value === "string" && value.length > 0
  );

  return (
    <div className="relative">
      {/*
       * The sticky close bar. It sits above the photo in the column and
       * is never scrolled away. `-mb-9` takes back the space it
       * occupies, so the photo still begins at the top edge.
       */}
      <div className="sticky top-0 z-20 -mb-9 flex justify-end bg-gradient-to-b from-black/25 to-transparent pb-1 pr-2 pt-2">
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-900/60 text-lg text-white backdrop-blur transition hover:bg-slate-900/80"
        >
          ✕
        </button>
      </div>

      {/* The cover photo fills the top of the card, edge to edge. */}
      <div className="w-full overflow-hidden bg-slate-100">
        {place.primary_photo_path ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={`${bucketUrl}/${place.primary_photo_path}`}
            alt={place.name}
            className="aspect-square w-full object-cover"
          />
        ) : (
          <div className="flex aspect-square w-full items-center justify-center bg-white text-6xl">
            {isCoffee ? "☕" : "🧺"}
          </div>
        )}
      </div>

      <div className="p-5">
        <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
          {isCoffee ? "☕ Barista" : "🧺 Laundromat"}
        </p>

        <h2 className="mt-1 break-words text-xl font-bold text-slate-900">
          {place.name}
        </h2>

        <p className="mt-1 break-words text-sm text-slate-500">
          {[place.address, place.city, place.country]
            .filter(Boolean)
            .join(" · ") || "No address yet"}
        </p>

        {/* How you pay — every method, in words. */}

        {payments.length > 0 && (
          <div className="mt-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              Payment
            </p>

            <div className="mt-1 flex flex-wrap gap-1.5">
              {payments.map((key) => (
                <span
                  key={key}
                  className="rounded-lg bg-slate-100 px-2.5 py-1 text-sm font-medium text-slate-700"
                >
                  {paymentLabel(key)}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Freshness — the whole point of the site */}

        <p className="mt-3 text-xs text-slate-500">
          {fresh != null && fresh <= 45 ? "✅ " : "🕓 "}
          {freshLabel}
          {place.last_verifier && ` · ${place.last_verifier}`}
        </p>

        {distanceLabel && (
          <p className="mt-0.5 text-xs text-slate-500">📍 {distanceLabel} away</p>
        )}

        <div className="mt-4 grid grid-cols-2 gap-2">
          <a
            href={`https://www.google.com/maps/dir/?api=1&destination=${place.latitude},${place.longitude}`}
            target="_blank"
            rel="noreferrer"
            className="flex min-h-11 items-center justify-center rounded-xl bg-slate-900 px-4 font-semibold text-white hover:bg-slate-800"
          >
            🧭 Directions
          </a>

          <a
            href={`/place/${place.id}`}
            className="flex min-h-11 items-center justify-center rounded-xl border border-slate-300 bg-white px-4 font-semibold text-slate-800 hover:bg-slate-50"
          >
            Full details →
          </a>
        </div>

        <p className="mt-2 text-center text-[10px] text-slate-400">
          {place.updates_count} updates · {place.photos_count} photos ·{" "}
          {place.confirmations_count} confirmed
        </p>

        <button
          onClick={() => {
            const url = `${window.location.origin}/place/${place.id}`;

            if (navigator.clipboard) {
              navigator.clipboard.writeText(url);
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            }
          }}
          className="mt-1 w-full rounded-xl py-2 text-sm font-semibold text-slate-500 hover:bg-slate-50"
        >
          {copied ? "Link copied ✓" : "Share this place"}
        </button>
      </div>
    </div>
  );
}

/*
 * The payment keys, in words.
 *
 * The four at the top are what the add-a-place form writes. The rest
 * are kept because they are real values in `accepted_payments` for
 * places added before that form was simplified — dropping them would
 * turn an old laundromat's payment line into a row of question marks.
 *
 * An unknown key prints as it was stored, minus the underscores: a
 * person typing "exact change only" into the payment note field gets
 * their own words back rather than a dash.
 */
const PAYMENT_WORDS: Record<string, string> = {
  cash: "Cash",
  card: "Cards",
  online: "Online app",
  laundry_card: "Laundry card",
  debit: "Debit",
  contactless: "Contactless",
  apple_pay: "Apple Pay",
  google_pay: "Google Pay",
  coins: "Coins",
  other: "Other",
};

function paymentLabel(key: string): string {
  const known = PAYMENT_WORDS[key];

  if (known) return known;

  return key.replace(/_/g, " ");
}

export { formatDistance };
