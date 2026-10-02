"use client";

import { useEffect, useState } from "react";

import type { PlacePhoto } from "@/lib/types";

/*
 * Photos are for deciding whether to walk over — a machine, a price
 * list, the front door. Three at a time on desktop, one on a phone,
 * and the tap opens the whole picture: a price list is unreadable in
 * a 140px thumbnail.
 */

export function PhotoStrip({
  photos,
  bucketUrl,
}: {
  photos: PlacePhoto[];
  bucketUrl: string;
}) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const open = openIndex !== null ? photos[openIndex] : null;

  /* Escape closes it, and the page must not scroll behind it. */
  useEffect(() => {
    if (openIndex === null) return;

    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpenIndex(null);
    }

    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [openIndex]);

  if (!photos || photos.length === 0) return null;

  return (
    <>
      <div className="-mx-4 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
        <ul className="flex snap-x snap-mandatory gap-2">
          {photos.map((photo, index) => (
            <li
              key={photo.id}
              className="w-[88%] shrink-0 snap-start sm:w-[calc((100%-1rem)/3)]"
            >
              <button
                type="button"
                onClick={() => setOpenIndex(index)}
                className="block w-full"
                aria-label="Open this photo"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`${bucketUrl}/${photo.storage_path}`}
                  alt={photo.caption ?? "Photo of this place"}
                  loading="lazy"
                  className="h-40 w-full rounded-xl border border-slate-200 object-cover sm:h-44"
                />
              </button>
            </li>
          ))}
        </ul>
      </div>

      {open && (
        <div
          className="fixed inset-0 z-[1200] flex items-center justify-center bg-black/90 p-4"
          onClick={() => setOpenIndex(null)}
          role="dialog"
          aria-modal="true"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`${bucketUrl}/${open.storage_path}`}
            alt={open.caption ?? "Photo of this place"}
            className="max-h-full max-w-full object-contain"
          />

          <button
            type="button"
            onClick={() => setOpenIndex(null)}
            aria-label="Close"
            className="absolute right-4 top-4 flex h-11 w-11 items-center justify-center rounded-full bg-white/20 text-2xl text-white hover:bg-white/30"
          >
            ✕
          </button>

          {photos.length > 1 && (
            <div className="absolute bottom-6 left-1/2 flex -translate-x-1/2 gap-2">
              {photos.map((photo, index) => (
                <button
                  key={photo.id}
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    setOpenIndex(index);
                  }}
                  aria-label={`Photo ${index + 1}`}
                  className={`h-2.5 w-2.5 rounded-full transition ${
                    index === openIndex ? "bg-white" : "bg-white/40"
                  }`}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </>
  );
}
