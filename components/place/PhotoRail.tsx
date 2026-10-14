"use client";

import { useState, useTransition } from "react";

import { showError } from "@/components/ui/ErrorPopup";

import { setPrimaryPhoto } from "@/app/actions/photos";

import type { PlacePhoto } from "@/lib/types";

/*
 * The photo rail on the place page, built for a phone first.
 *
 * A horizontal flex row inside overflow-x-auto has ALWAYS scrolled —
 * that part was never wrong. What was missing was any sign of it: the
 * arrows are `hidden sm:flex`, so on a phone there was nothing to say
 * there were more photos to the right, and a rail that does not look
 * scrollable is one nobody tries to scroll.
 *
 * So this rail does three things the old strip did not:
 *
 *   - the cards are narrow enough that one is always cut off at the
 *     edge of the screen — the clearest invitation to swipe there is;
 *   - a row of dots sits under it, phone only, one per photo;
 *   - the dots follow the scroll (measured, not computed) and tapping
 *     one jumps the rail to that photo.
 */

/*
 * Built by hand, and in UTC: toLocaleDateString renders differently on
 * the server and in the browser, which breaks hydration the moment
 * this rail is server-rendered.
 */
function formatPhotoDate(iso: string) {
  const d = new Date(iso);

  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];

  return `${d.getUTCDate()} ${months[d.getUTCMonth()]}`;
}

/*
 * Two and a half cards on a phone, three on a laptop.
 *
 * 38% means the third card starts before the right edge — the swipe
 * is discovered by looking, not by trying. The laptop figure is a
 * third of the rail minus the two gaps. Both are basis rather than
 * width so the flex row can shrink them if it ever has to.
 */
const PHONE_CARD = "basis-[38%] shrink-0 grow-0";
const DESKTOP_CARD = "sm:basis-[calc((100%-1.5rem)/3)]";

export function PhotoRail({
  photos,
  bucketUrl,
  placeId,
  signedIn = false,
}: {
  photos: PlacePhoto[];
  bucketUrl: string;
  placeId: string;
  signedIn?: boolean;
}) {
  const [lightbox, setLightbox] = useState<number | null>(null);
  const [active, setActive] = useState(0);

  const [, startTransition] = useTransition();

  async function makeCover(photoId: string) {
    try {
      await setPrimaryPhoto(placeId, photoId);
    } catch (error) {
      showError(error);
    }
  }

  const sorted = [...photos].sort((a, b) => {
    if (a.is_primary === b.is_primary) return 0;

    return a.is_primary ? -1 : 1;
  });

  if (sorted.length === 0) return null;

  function syncActive(event: React.UIEvent<HTMLUListElement>) {
    const rail = event.currentTarget;

    /*
     * The card width is a percentage of the rail, so it is read from
     * the element rather than assumed: 38% on a phone, a third on a
     * laptop, and this file knows neither number.
     */
    const card = rail.querySelector("li");

    if (!card) return;

    const step = card.getBoundingClientRect().width + 12;
    const index = Math.round(rail.scrollLeft / step);

    setActive(Math.min(index, sorted.length - 1));
  }

  function jumpTo(index: number) {
    const rail = document.getElementById(`photo-rail-${placeId}`);
    const card = rail?.querySelectorAll("li")[index];

    if (!rail || !card) return;

    rail.scrollTo({
      left: (card as HTMLElement).offsetLeft - rail.offsetLeft,
      behavior: "smooth",
    });
  }

  return (
    <div className="space-y-2">
      {/* The rail bleeds past the page padding, so a card is never
          clipped by the container it sits in. */}
      <ul
        id={`photo-rail-${placeId}`}
        onScroll={syncActive}
        className="flex snap-x snap-mandatory gap-3 overflow-x-auto overscroll-x-contain px-4 [scrollbar-width:none] sm:px-0"
      >
        {sorted.map((photo, index) => (
          <li
            key={photo.id}
            className={`${PHONE_CARD} ${DESKTOP_CARD} snap-start`}
          >
            <button
              type="button"
              onClick={() => setLightbox(index)}
              className="block w-full overflow-hidden rounded-xl border border-slate-200 bg-white"
              aria-label={photo.caption ?? `Photo ${index + 1}`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`${bucketUrl}/${photo.storage_path}`}
                alt={photo.caption ?? "Photo of this place"}
                loading="lazy"
                className="aspect-square w-full object-cover"
              />
            </button>

            <div className="mt-1 flex items-center justify-between gap-2 px-0.5">
              <span className="truncate text-[10px] text-slate-400">
                {formatPhotoDate(photo.created_at)}
              </span>

              {signedIn && !photo.is_primary && (
                <button
                  type="button"
                  onClick={() => startTransition(() => makeCover(photo.id))}
                  className="shrink-0 rounded px-1 py-0.5 text-[10px] font-semibold text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                >
                  Set cover
                </button>
              )}

              {photo.is_primary && (
                <span className="shrink-0 text-[10px] font-semibold text-slate-400">
                  Cover
                </span>
              )}
            </div>
          </li>
        ))}
      </ul>

      {/* The dots — phone only, and only when there is more than one
          photo. Tapping one scrolls the rail to it, which is a gesture
          the arrows could never offer on a touch screen. */}
      {sorted.length > 1 && (
        <div className="flex justify-center gap-2 sm:hidden">
          {sorted.map((photo, index) => (
            <button
              key={photo.id}
              type="button"
              onClick={() => jumpTo(index)}
              aria-label={`Photo ${index + 1} of ${sorted.length}`}
              className={`h-2 w-2 rounded-full transition ${
                index === active ? "bg-slate-500" : "bg-slate-300"
              }`}
            />
          ))}
        </div>
      )}

      {lightbox !== null && (
        <div
          className="fixed inset-0 z-[1200] flex items-center justify-center bg-black/90 p-4"
          onClick={() => setLightbox(null)}
          role="dialog"
          aria-modal="true"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`${bucketUrl}/${sorted[lightbox].storage_path}`}
            alt={sorted[lightbox].caption ?? "Photo of this place"}
            className="max-h-full max-w-full object-contain"
          />

          <button
            type="button"
            onClick={() => setLightbox(null)}
            aria-label="Close"
            className="absolute right-4 top-4 flex h-11 w-11 items-center justify-center rounded-full bg-white/20 text-2xl text-white hover:bg-white/30"
          >
            ✕
          </button>

          {sorted.length > 1 && (
            <div className="absolute bottom-6 left-1/2 flex -translate-x-1/2 gap-2">
              {sorted.map((photo, index) => (
                <button
                  key={photo.id}
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    setLightbox(index);
                  }}
                  aria-label={`Photo ${index + 1}`}
                  className={`h-2.5 w-2.5 rounded-full transition ${
                    index === lightbox ? "bg-white" : "bg-white/40"
                  }`}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default PhotoRail;
