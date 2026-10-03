"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";

import { deletePlacePhoto } from "./photos";
import { replacePlacePhoto } from "./photos";

import type { PlacePhoto } from "@/lib/types";

/*
 * The strip is a client component, and a client component cannot tell
 * the difference between "the write failed" and "the render failed".
 * In production Next replaces both with the same opaque sentence:
 *
 *   An error occurred in the Server Components render.
 *
 * That is fine for a crash, and useless for a rejected write. So the
 * strip calls THESE instead: they swallow nothing, but they turn any
 * thrown error into a return value, which crosses the boundary as
 * data and arrives in the browser intact.
 *
 * Same actions underneath — this is a wrapper, not a second copy.
 */

export interface PhotoResult {
  ok: boolean;
  message?: string;
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
      message:
        error instanceof Error && error.message
          ? error.message
          : "Could not delete that photo.",
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
      message:
        error instanceof Error && error.message
          ? error.message
          : "Could not change that photo.",
    };
  }
}

/* Nothing here needs the type, but importing it keeps the two shapes
   in step if PlacePhoto grows. */
export type { PlacePhoto };
