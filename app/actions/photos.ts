"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { awardCredits } from "@/lib/services/credits";
import { uploadPlacePhoto } from "@/lib/services/upload";

/* Photos are for deciding whether to walk over: a machine, a price
   list, the front door. They are compressed on the client before
   they reach this action. */

const PHOTO_BUCKET = "place-photos";

/*
 * The bucket returns a full URL; the row stores the path.
 * A path is always "<placeId>/<uuid>.<ext>".
 */
function storagePathFrom(url: string): string {
  return url.split("/").slice(-2).join("/");
}

export async function addPlacePhotos(formData: FormData): Promise<void> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const placeId = String(formData.get("place_id") ?? "");

  if (!user) {
    throw new Error("PHOTO_SIGNED_OUT");
  }

  if (!placeId) {
    throw new Error("PLACE_NOT_FOUND");
  }

  const files = formData
    .getAll("photo")
    .filter((value): value is File => value instanceof File && value.size > 0)
    .slice(0, 5);

  if (files.length === 0) {
    throw new Error("PHOTO_NONE_ATTACHED");
  }

  for (const file of files) {
    const url = await uploadPlacePhoto(placeId, file);

    await supabase.from("place_photos").insert({
      place_id: placeId,
      uploaded_by: user.id,
      storage_path: storagePathFrom(url),
      photo_type: "detail",
    });
  }

  await awardCredits({
    userId: user.id,
    action: "add_photo",
    placeId,
  });

  revalidatePath(`/place/${placeId}`);
}

/* ====================================================== */
/* PRIMARY                                                  */
/* ====================================================== */

/*
 * One photo per place represents the place: on the map, on a shared
 * link, anywhere a single image is needed.
 *
 * The swap is two statements rather than a database function. A
 * plpgsql function called through PostgREST's rpc endpoint was the
 * tidier design, but PostgREST discovers functions through a schema
 * cache that can miss one created after the service started.
 *
 * Order matters and is not interchangeable: the partial unique index
 * allows one primary per place, so the old one must be cleared before
 * the new one is set. Each write is checked, and a failure on the
 * second one puts the old cover back rather than leaving the place
 * with none.
 */

export async function setPrimaryPhoto(
  placeId: string,
  photoId: string
): Promise<void> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("PHOTO_SIGNED_OUT");
  }

  /* Remember the current cover so it can be restored if the second
     write fails. */
  const { data: previous } = await supabase
    .from("place_photos")
    .select("id")
    .eq("place_id", placeId)
    .eq("is_primary", true)
    .maybeSingle();

  if (previous?.id === photoId) return;

  const { error: clearError } = await supabase
    .from("place_photos")
    .update({ is_primary: false })
    .eq("place_id", placeId)
    .eq("is_primary", true);

  if (clearError) {
    console.error("[setPrimaryPhoto] clear", clearError.message);

    throw new Error("PHOTO_COVER_FAILED");
  }

  const { data: updated, error } = await supabase
    .from("place_photos")
    .update({ is_primary: true })
    .eq("id", photoId)
    .eq("place_id", placeId)
    .select("id");

  if (error || !updated || updated.length === 0) {
    if (error) console.error("[setPrimaryPhoto] set", error.message);

    /* Put the old cover back rather than leaving the place bare. */
    if (previous?.id) {
      await supabase
        .from("place_photos")
        .update({ is_primary: true })
        .eq("id", previous.id);
    }

    throw new Error("PHOTO_COVER_FAILED");
  }

  /* Both surfaces read the cover: the place page shows the strip, the
     home page's map panel shows a single square. */
  revalidatePath(`/place/${placeId}`);
  revalidatePath("/");
}

/* ====================================================== */
/* DELETE                                                   */
/* ====================================================== */

/*
 * Two things go: the row, and the object in the bucket. Doing only
 * the first leaves the storage bill growing with orphans nobody can
 * reach; doing only the second leaves a row pointing at a 404.
 *
 * The order is row first. If the bucket delete then fails, we have a
 * harmless orphan object rather than a broken page. The database's
 * AFTER DELETE trigger promotes another photo when the deleted one
 * was primary.
 *
 * Permission is enforced by RLS (uploader or place creator). A
 * refused delete returns no rows rather than an error, so the row
 * count is what tells us whether it was allowed.
 */

export async function deletePlacePhoto(
  placeId: string,
  photoId: string
): Promise<void> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("PHOTO_SIGNED_OUT");
  }

  const { data: photo } = await supabase
    .from("place_photos")
    .select("id, storage_path")
    .eq("id", photoId)
    .eq("place_id", placeId)
    .maybeSingle();

  if (!photo) {
    throw new Error("PHOTO_ALREADY_GONE");
  }

  const { data: deleted, error } = await supabase
    .from("place_photos")
    .delete()
    .eq("id", photoId)
    .eq("place_id", placeId)
    .select("id");

  if (error) {
    console.error("[deletePlacePhoto]", error.message);

    throw new Error("PHOTO_UPLOAD_FAILED");
  }

  if (!deleted || deleted.length === 0) {
    throw new Error("PHOTO_DELETE_DENIED");
  }

  await supabase.storage.from(PHOTO_BUCKET).remove([photo.storage_path]);

  revalidatePath(`/place/${placeId}`);
  revalidatePath("/");
}

/* ====================================================== */
/* REPLACE                                                  */
/* ====================================================== */

/*
 * Modify keeps the same row: a new object is uploaded, the row's
 * storage_path is pointed at it, and the old object is removed. The
 * id stays stable, so the primary flag and anything else hanging off
 * the row survive untouched.
 */

export async function replacePlacePhoto(formData: FormData): Promise<void> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("PHOTO_SIGNED_OUT");
  }

  const placeId = String(formData.get("place_id") ?? "");
  const photoId = String(formData.get("photo_id") ?? "");

  const file = formData.get("photo");

  if (!placeId || !photoId) {
    throw new Error("PHOTO_ALREADY_GONE");
  }

  if (!(file instanceof File) || file.size === 0) {
    throw new Error("PHOTO_NONE_ATTACHED");
  }

  const { data: photo } = await supabase
    .from("place_photos")
    .select("id, storage_path, uploaded_by")
    .eq("id", photoId)
    .eq("place_id", placeId)
    .maybeSingle();

  if (!photo) {
    throw new Error("PHOTO_ALREADY_GONE");
  }

  /* Same rule as deleting: the uploader, or the person who added the
     place. A photo is someone's contribution; rewriting it silently
     under them would be worse than removing it. */
  const { data: place } = await supabase
    .from("places")
    .select("created_by")
    .eq("id", placeId)
    .maybeSingle();

  const allowed =
    photo.uploaded_by === user.id || place?.created_by === user.id;

  if (!allowed) {
    throw new Error("PHOTO_REPLACE_DENIED");
  }

  const previousPath = photo.storage_path;

  const url = await uploadPlacePhoto(placeId, file);

  const { error } = await supabase
    .from("place_photos")
    .update({ storage_path: storagePathFrom(url) })
    .eq("id", photoId);

  if (error) {
    console.error("[replacePlacePhoto]", error.message);

    /* The new object is already in the bucket; drop it rather than
       leaving something no row points at. */
    await supabase.storage.from(PHOTO_BUCKET).remove([storagePathFrom(url)]);

    throw new Error("PHOTO_UPLOAD_FAILED");
  }

  await supabase.storage.from(PHOTO_BUCKET).remove([previousPath]);

  revalidatePath(`/place/${placeId}`);
  revalidatePath("/");
}
