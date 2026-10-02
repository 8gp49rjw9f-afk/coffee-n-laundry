"use client";

import { useState, useTransition } from "react";
import imageCompression from "browser-image-compression";

import { ErrorBanner } from "@/components/ui";

import { addPlacePhotos } from "@/app/actions/photos";

/*
 * A phone camera produces up to about 10MB. Refusing below that locks
 * out entire handsets — the compression is what brings the file down,
 * not the input limit. 800px and roughly 80KB is plenty to recognise
 * a machine and read a price list.
 */

const PHOTO_OPTIONS = {
  maxSizeMB: 0.4,
  maxWidthOrHeight: 1600,
  useWebWorker: true,
};

const MAX_INPUT_MB = 10;

export function PhotoUpload({ placeId }: { placeId: string }) {
  const [files, setFiles] = useState<File[]>([]);
  const [compressing, setCompressing] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  async function handleFiles(list: FileList | null) {
    if (!list || list.length === 0) return;

    setCompressing(true);
    setError("");
    setDone(false);

    try {
      const compressed: File[] = [];

      for (const file of Array.from(list).slice(0, 5)) {
        if (file.size > MAX_INPUT_MB * 1_000_000) {
          setError(`One photo is larger than ${MAX_INPUT_MB} MB.`);
          continue;
        }

        const result = await imageCompression(file, PHOTO_OPTIONS);

        compressed.push(
          new File([result], file.name.replace(/\.[^.]+$/, "") + ".jpg", {
            type: "image/jpeg",
          })
        );
      }

      setFiles((current) => [...current, ...compressed].slice(0, 5));
    } catch {
      setError("Could not process those photos. Try smaller ones.");
    }

    setCompressing(false);
  }

  function upload() {
    if (files.length === 0) return;

    setError("");

    const formData = new FormData();

    formData.set("place_id", placeId);
    files.forEach((file) => formData.append("photo", file));

    startTransition(async () => {
      try {
        await addPlacePhotos(formData);

        setFiles([]);
        setDone(true);
      } catch (err) {
        setError(
          err instanceof Error && err.message
            ? err.message
            : "Could not upload those photos."
        );
      }
    });
  }

  return (
    <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4">
      <input
        id="new-photos"
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />

      <label
        htmlFor="new-photos"
        className="flex min-h-12 cursor-pointer items-center justify-center rounded-xl border border-slate-300 bg-white px-4 font-semibold text-slate-700 transition hover:bg-slate-50"
      >
        {compressing ? "Compressing…" : "📷 Choose photos"}
      </label>

      {files.length > 0 && (
        <ul className="space-y-1 text-sm text-slate-600">
          {files.map((file, index) => (
            <li key={index} className="flex items-center justify-between gap-3">
              <span className="min-w-0 truncate">{file.name}</span>

              <span className="shrink-0 text-xs text-slate-400">
                {Math.round(file.size / 1024)} KB
              </span>
            </li>
          ))}
        </ul>
      )}

      {error && <ErrorBanner message={error} />}

      {done && (
        <p className="rounded-xl bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-800">
          ✅ Photos added.
        </p>
      )}

      {files.length > 0 && (
        <button
          type="button"
          onClick={upload}
          disabled={pending}
          className="flex min-h-12 w-full items-center justify-center rounded-xl bg-slate-900 px-4 font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60"
        >
          {pending ? "Uploading…" : `Upload ${files.length}`}
        </button>
      )}

      <p className="text-xs text-slate-500">
        Up to {MAX_INPUT_MB} MB each photo. They are compressed to 800px before
        upload — a phone photo of a washing machine does not need to be 12
        megapixels.
      </p>
    </div>
  );
}
