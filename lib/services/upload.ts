import { createClient } from "@/lib/supabase/server";

/* ====================================================== */
/* IMAGE UPLOAD — place-photos bucket                      */
/* ====================================================== */

/*
 * The client compresses to about 80KB before sending, so anything
 * that arrives here close to this limit came from a browser that
 * skipped compression. The ceiling is 10MB because that is what a
 * phone camera produces, and refusing at 5MB locked out some
 * handsets entirely.
 */

export const MAX_INPUT_BYTES = 10_000_000;

export const VALID_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/heic",
  "image/heif",
];

export function assertValidImage(file: File, maxMb = 10) {
  if (file.size > maxMb * 1_000_000) {
    throw new Error(`That photo is larger than ${maxMb} MB.`);
  }

  if (!VALID_IMAGE_TYPES.includes(file.type)) {
    throw new Error("That image format is not supported.");
  }
}

export async function uploadPlacePhoto(
  placeId: string,
  file: File
): Promise<string> {
  const supabase = await createClient();

  const extension = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const path = `${placeId}/${crypto.randomUUID()}.${extension}`;

  const arrayBuffer = await file.arrayBuffer();

  const { error } = await supabase.storage
    .from("place-photos")
    .upload(path, arrayBuffer, { contentType: file.type, upsert: false });

  if (error) throw error;

  const { data } = supabase.storage.from("place-photos").getPublicUrl(path);

  return data.publicUrl;
}

export function storagePathFromUrl(url: string): string | null {
  const marker = "/storage/v1/object/public/place-photos/";
  const index = url.indexOf(marker);

  if (index === -1) return null;

  return url.substring(index + marker.length);
}
