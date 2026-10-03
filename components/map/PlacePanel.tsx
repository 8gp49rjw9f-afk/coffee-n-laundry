"use client";

import { useState } from "react";

import { formatDistance } from "@/lib/services/distance";
import { AMBIENCE_EMOJI, AMBIENCE_LABEL } from "@/lib/coffee";

import type { PlaceWithFreshness } from "@/lib/types";

/* Days between a date and now — computed from a fixed "now" passed in,
   never from Date.now(), so server and browser agree. */

function daysAgo(iso: string, today: number) {
  const then = new Date(iso).getTime();

  return Math.max(0, Math.floor((today - then) / (1000 * 60 * 60 * 24)));
}

function clockTime(minutes: number | null) {
  if (minutes == null) return null;

  const h = Math.floor(minutes / 60);
  const m = minutes % 60;

  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

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

  /* ---------- type-specific facts ---------- */

  const facts: string[] = [];

  if (isCoffee) {
    if (place.coffee_kind === "barista") facts.push("☕ Specialty / Barista");
    else if (place.coffee_kind === "both") facts.push("☕ Both");
    else if (place.coffee_kind === "regular") facts.push("☕ Regular");

    for (const key of (place.ambience ?? []).slice(0, 3)) {
      facts.push(`${AMBIENCE_EMOJI[key] ?? ""} ${AMBIENCE_LABEL[key] ?? key}`);
    }

    if (place.sells_beans) facts.push("🫘 Beans for sale");
  } else {
    if (place.wash_minutes) facts.push(`Wash ~${place.wash_minutes} min`);
    if (place.dryer_minutes) facts.push(`Dry ~${place.dryer_minutes} min`);

    const lastEntry = clockTime(place.last_entry_minutes);
    if (lastEntry) facts.push(`Last entry ${lastEntry}`);

    if (place.detergent_included) facts.push("Detergent included");
  }


  return (
    <div>
      {/* The cover photo is the place's face. A square, because the
          photo was cropped as one — a 16:9 frame would trim away the
          very part someone chose to show. */}
      <div className="flex justify-center bg-slate-100 px-5 pt-5">
        {place.primary_photo_path ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={`${bucketUrl}/${place.primary_photo_path}`}
            alt={place.name}
            className="aspect-square w-full max-w-[200px] rounded-2xl border border-slate-200 object-cover shadow-sm"
          />
        ) : (
          <div className="flex aspect-square w-full max-w-[200px] items-center justify-center rounded-2xl border border-slate-200 bg-white text-5xl shadow-sm">
            {isCoffee ? "☕" : "🧺"}
          </div>
        )}
      </div>

      <div className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
              {isCoffee ? "☕ Coffee" : "🧺 Laundromat"}
            </p>

            <h2 className="mt-1 truncate text-xl font-bold text-slate-900">
              {place.name}
            </h2>

            <p className="mt-1 truncate text-sm text-slate-500">
              {[place.address, place.city, place.country]
                .filter(Boolean)
                .join(" · ") || "No address yet"}
            </p>
          </div>

          <button
            onClick={onClose}
            aria-label="Close"
            className="h-9 w-9 shrink-0 rounded-full bg-slate-100 text-lg hover:bg-slate-200"
          >
            ✕
          </button>
        </div>

        {/* Prices — the first thing anyone looks for */}

        {!isCoffee && (place.wash_amount || place.dryer_amount) && (
          <div className="mt-3 flex flex-wrap gap-2 text-sm font-semibold">
            {place.wash_amount && (
              <span className="rounded-lg bg-sky-50 px-2.5 py-1 text-sky-900">
                🧺 {place.wash_amount} {place.wash_currency}
              </span>
            )}

            {place.dryer_amount && (
              <span className="rounded-lg bg-orange-50 px-2.5 py-1 text-orange-900">
                🔥 {place.dryer_amount} {place.dryer_currency}
              </span>
            )}
          </div>
        )}

        {/* Facts, one per chip */}

        {facts.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5 text-sm">
            {facts.map((fact) => (
              <span
                key={fact}
                className="rounded-lg bg-slate-100 px-2.5 py-1 text-slate-700"
              >
                {fact}
              </span>
            ))}
          </div>
        )}

        {/* Payment and amenities */}

        <div className="mt-2 flex flex-wrap gap-1.5">
          {(place.accepted_payments ?? []).slice(0, 5).map((key) => (
            <span
              key={key}
              className="rounded-lg bg-slate-100 px-2 py-1 text-sm text-slate-700"
            >
              {paymentIcon(key)}
            </span>
          ))}

          {place.has_wifi && (
            <span className="rounded-lg bg-slate-100 px-2 py-1 text-sm">📶</span>
          )}

          {place.has_power && (
            <span className="rounded-lg bg-slate-100 px-2 py-1 text-sm">🔌</span>
          )}

          {place.has_parking && (
            <span className="rounded-lg bg-slate-100 px-2 py-1 text-sm">🅿️</span>
          )}
        </div>

        {/* Freshness — the whole point of the site */}

        <p className="mt-3 text-xs text-slate-500">
          {fresh != null && fresh <= 45 ? "✅ " : "🕓 "}
          {freshLabel}
          {place.last_verifier && ` · ${place.last_verifier}`}
        </p>

        {distanceLabel && (
          <p className="mt-0.5 text-xs text-slate-500">📍 {distanceLabel} away</p>
        )}

        {/* The newest note, truncated */}

        {place.latest_note && (
          <p className="mt-3 line-clamp-2 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">
            “{place.latest_note}”
          </p>
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

function paymentIcon(key: string) {
  return (
    {
      cash: "💵",
      card: "💳",
      debit: "🏧",
      contactless: "📱",
      apple_pay: "🍎",
      google_pay: "🟢",
      laundry_card: "🎟️",
      coins: "🪙",
      other: "➖",
    }[key] ?? "➖"
  );
}

export { formatDistance };
