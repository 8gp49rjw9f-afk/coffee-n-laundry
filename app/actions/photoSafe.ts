"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";

import { deletePlacePhoto } from "./photos";
import { replacePlacePhoto } from "./photos";

import type { PlacePhoto } from "@/lib/types";

/*
 * The strip is a client component, and a client component cannot tell
 * the difference between "the write failed" and "the render failed".
 * In production Next replaces both with the same opaque sentence.
 *
 * That is fine for a crash, and useless for a rejected write. So the
 * strip calls THESE instead: they swallow nothing, but they turn any
 * thrown error into a return value, which crosses the boundary as
 * data and arrives in the browser intact.
 *
 * The actions underneath now throw CODES, so what comes back in
 * `message` is a code the popup can translate. A non-Error becomes the
 * generic photo code rather than an English sentence. The type is
 * named `code` for that reason — `message` invited callers to print it.
 */

export interface PhotoResult {
  ok: boolean;
  code?: string;
}

export async function removePhoto(
  placeId: string,
  photoId: string
): Promise<PhotoResult> {
  try {
    await deletePlacePhoto(placeId, photoId);

    return { ok: true };
  } catch (error) {
    console.error("[removePhoto]", error);

    return {
      ok: false,
      code:
        error instanceof Error && error.message
          ? error.message
          : "PHOTO_UPLOAD_FAILED",
    };
  }
}

export async function changePhoto(formData: FormData): Promise<PhotoResult> {
  try {
    await replacePlacePhoto(formData);

    return { ok: true };
  } catch (error) {
    console.error("[changePhoto]", error);

    return {
      ok: false,
      code:
        error instanceof Error && error.message
          ? error.message
          : "PHOTO_UPLOAD_FAILED",
    };
  }
}

/* Nothing here needs the type, but importing it keeps the two shapes
   in step if PlacePhoto grows. */
export type { PlacePhoto };
