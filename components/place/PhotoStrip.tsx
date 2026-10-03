"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import imageCompression from "browser-image-compression";

import { SquareCrop } from "@/components/place/SquareCrop";

import {
  deletePlacePhoto,
  replacePlacePhoto,
  setPrimaryPhoto,
} from "@/app/actions/photos";

import type { PlacePhoto } from "@/lib/types";

/*
 * The strip scrolls sideways, as it always did. The cover photo is
 * outlined and labelled, so what you see matches what is true; the
 * per-photo actions sit underneath it.
 *
 * The cover lives in a real column (is_primary, see 0003), not in the
 * order the photos happen to arrive in. "Set as cover" points it at a
 * different photo, and the strip re-sorts with the cover first.
 *
 * Signed out, the strip is read-only: the actions are not rendered at
 * all. Hiding them is the honest move — the database would refuse the
 * write anyway, and a button that always fails is worse than no button.
 *
 * Tapping the image still opens it full-screen: a price list is
 * unreadable in a 140px square.
 */

const PHOTO_OPTIONS = {
  maxSizeMB: 0.4,
  maxWidthOrHeight: 1400,
  useWebWorker: true,
};

async function compress(file: File): Promise<File> {
  const result = await imageCompression(file, PHOTO_OPTIONS);

  return new File([result], file.name.replace(/\.[^.]+$/, "") + ".jpg", {
    type: "image/jpeg",
  });
}

export function PhotoStrip({
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
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  /* The photo being replaced, and the one waiting to be cropped. */
  const [replacingId, setReplacingId] = useState<string | null>(null);
  const [cropping, setCropping] = useState<File | null>(null);

  const fileInput = useRef<HTMLInputElement>(null);

  const ordered = [...photos].sort((a, b) => {
    if (a.is_primary === b.is_primary) return 0;
    return a.is_primary ? -1 : 1;
  });

  const open = openIndex !== null ? ordered[openIndex] : null;

  /* Lightbox: Escape closes, arrows move, the page does not scroll. */
  useEffect(() => {
    if (openIndex === null) return;

    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpenIndex(null);

      if (event.key === "ArrowRight") {
        setOpenIndex((i) => ((i ?? 0) + 1) % ordered.length);
      }

      if (event.key === "ArrowLeft") {
        setOpenIndex((i) => ((i ?? 0) - 1 + ordered.length) % ordered.length);
      }
    }

    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [openIndex, ordered.length]);

  function pickReplacement(photoId: string) {
    setError("");
    setReplacingId(photoId);
    fileInput.current?.click();
  }

  function onFileChosen(list: FileList | null) {
    if (!list || list.length === 0) {
      setReplacingId(null);
      return;
    }

    /* Always clear the input, or picking the same file twice fires
       no change event the second time. */
    if (fileInput.current) fileInput.current.value = "";

    setCropping(list[0]);
  }

  async function acceptCropped(cropped: File) {
    const photoId = replacingId;

    setCropping(null);

    if (!photoId) return;

    setError("");

    try {
      const compressed = await compress(cropped);

      const formData = new FormData();
      formData.set("place_id", placeId);
      formData.set("photo_id", photoId);
      formData.set("photo", compressed);

      startTransition(async () => {
        try {
          await replacePlacePhoto(formData);
        } catch (err) {
          setError(
            err instanceof Error && err.message
              ? err.message
              : "Could not change that photo."
          );
        } finally {
          setReplacingId(null);
        }
      });
    } catch {
      setError("Could not process that photo. Try a smaller one.");
      setReplacingId(null);
    }
  }

  function makeCover(photoId: string) {
    setError("");

    startTransition(async () => {
      try {
        await setPrimaryPhoto(placeId, photoId);
      } catch (err) {
        setError(
          err instanceof Error && err.message
            ? err.message
            : "Could not change the cover photo."
        );
      }
    });
  }

  function remove(photoId: string) {
    if (!confirm("Delete this photo? This cannot be undone.")) return;

    setError("");

    startTransition(async () => {
      try {
        await deletePlacePhoto(placeId, photoId);
      } catch (err) {
        setError(
          err instanceof Error && err.message
            ? err.message
            : "Could not delete that photo."
        );
      }
    });
  }

  /* The crop owns the screen while it lasts. */
  if (cropping) {
    return (
      <SquareCrop
        file={cropping}
        onCancel={() => {
          setCropping(null);
          setReplacingId(null);
        }}
        onDone={acceptCropped}
      />
    );
  }

  if (ordered.length === 0) return null;

  return (
    <div className="space-y-2">
      {signedIn && (
        <input
          ref={fileInput}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(event) => onFileChosen(event.target.files)}
        />
      )}

      <div className="-mx-4 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
        <ul className="flex snap-x snap-mandatory gap-3">
          {ordered.map((photo, index) => (
            <li
              key={photo.id}
              className="w-[62%] shrink-0 snap-start sm:w-[calc((100%-2rem)/3)]"
            >
              <button
                type="button"
                onClick={() => setOpenIndex(index)}
                /* A light blue ring marks the cover: enough to read at
                   a glance, quiet enough not to fight the photo. */
                className={`block w-full overflow-hidden rounded-xl transition ${
                  photo.is_primary
                    ? "ring-2 ring-sky-400 ring-offset-2"
                    : "ring-0"
                }`}
                aria-label={
                  photo.is_primary
                    ? "Cover photo — open full size"
                    : "Open this photo"
                }
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`${bucketUrl}/${photo.storage_path}`}
                  alt={photo.caption ?? "Photo of this place"}
                  loading="lazy"
                  className="aspect-square w-full border border-slate-200 object-cover"
                />
              </button>

              {photo.is_primary && (
                <p className="mt-1 text-center text-[11px] font-bold uppercase tracking-wide text-sky-600">
                  Cover
                </p>
              )}

              {signedIn && (
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => pickReplacement(photo.id)}
                    disabled={pending}
                    className="min-h-9 flex-1 rounded-lg border border-slate-300 bg-white px-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
                  >
                    Modify
                  </button>

                  <button
                    type="button"
                    onClick={() => remove(photo.id)}
                    disabled={pending}
                    className="min-h-9 flex-1 rounded-lg border border-rose-200 bg-white px-2 text-xs font-semibold text-rose-700 transition hover:bg-rose-50 disabled:opacity-50"
                  >
                    Delete
                  </button>

                  {!photo.is_primary && (
                    <button
                      type="button"
                      onClick={() => makeCover(photo.id)}
                      disabled={pending}
                      className="min-h-9 w-full rounded-lg border border-slate-300 bg-white px-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
                    >
                      Set as cover
                    </button>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      </div>

      {error && (
        <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-medium text-rose-800">
          {error}
        </p>
      )}

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

          {ordered.length > 1 && (
            <div className="absolute bottom-6 left-1/2 flex -translate-x-1/2 gap-2">
              {ordered.map((photo, index) => (
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
    </div>
  );
}

export default PhotoStrip;
