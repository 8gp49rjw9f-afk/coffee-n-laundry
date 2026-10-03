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
    throw new Error("You need to be signed in to add photos.");
  }

  if (!placeId) {
    throw new Error("That place no longer exists.");
  }

  const files = formData
    .getAll("photo")
    .filter((value): value is File => value instanceof File && value.size > 0)
    .slice(0, 5);

  if (files.length === 0) {
    throw new Error("No photos were attached.");
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
 * cache that can miss one created after the service started — the
 * call then answers "function not found" while the function works
 * perfectly in the SQL editor. Two plain table updates use the same
 * path as the rest of this file, which is known to work.
 *
 * Order matters and is not interchangeable: the partial unique index
 * allows one primary per place, so the old one must be cleared before
 * the new one is set. Each write is checked, and a failure on the
 * second one puts the old cover back rather than leaving the place
 * with none.
 *
 * No ownership check: choosing which photo represents a place is the
 * same kind of act as correcting a price, and anyone signed in may do
 * it. Who may DELETE a photo is a different question, and that one is
 * enforced in the database (see 0003's delete policy).
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
    throw new Error("You need to be signed in to choose a cover photo.");
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
    throw new Error(`Could not change the cover photo: ${clearError.message}`);
  }

  const { data: updated, error } = await supabase
    .from("place_photos")
    .update({ is_primary: true })
    .eq("id", photoId)
    .eq("place_id", placeId)
    .select("id");

  if (error || !updated || updated.length === 0) {
    /* Put the old cover back rather than leaving the place bare. */
    if (previous?.id) {
      await supabase
        .from("place_photos")
        .update({ is_primary: true })
        .eq("id", previous.id);
    }

    throw new Error(
      error?.message ?? "That photo could not be set as the cover."
    );
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
    throw new Error("You need to be signed in to delete a photo.");
  }

  const { data: photo } = await supabase
    .from("place_photos")
    .select("id, storage_path")
    .eq("id", photoId)
    .eq("place_id", placeId)
    .maybeSingle();

  if (!photo) {
    throw new Error("That photo is already gone.");
  }

  const { data: deleted, error } = await supabase
    .from("place_photos")
    .delete()
    .eq("id", photoId)
    .eq("place_id", placeId)
    .select("id");

  if (error) {
    throw new Error(`Could not delete that photo: ${error.message}`);
  }

  if (!deleted || deleted.length === 0) {
    throw new Error(
      "Only the person who added this photo, or the person who added the place, can delete it."
    );
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
    throw new Error("You need to be signed in to change a photo.");
  }

  const placeId = String(formData.get("place_id") ?? "");
  const photoId = String(formData.get("photo_id") ?? "");

  const file = formData.get("photo");

  if (!placeId || !photoId) {
    throw new Error("That photo no longer exists.");
  }

  if (!(file instanceof File) || file.size === 0) {
    throw new Error("No photo was attached.");
  }

  const { data: photo } = await supabase
    .from("place_photos")
    .select("id, storage_path, uploaded_by")
    .eq("id", photoId)
    .eq("place_id", placeId)
    .maybeSingle();

  if (!photo) {
    throw new Error("That photo no longer exists.");
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
    throw new Error(
      "Only the person who added this photo, or the person who added the place, can change it."
    );
  }

  const previousPath = photo.storage_path;

  const url = await uploadPlacePhoto(placeId, file);

  const { error } = await supabase
    .from("place_photos")
    .update({ storage_path: storagePathFrom(url) })
    .eq("id", photoId);

  if (error) {
    /* The new object is already in the bucket; drop it rather than
       leaving something no row points at. */
    await supabase.storage.from(PHOTO_BUCKET).remove([storagePathFrom(url)]);

    throw new Error("Could not save the new photo.");
  }

  await supabase.storage.from(PHOTO_BUCKET).remove([previousPath]);

  revalidatePath(`/place/${placeId}`);
  revalidatePath("/");
}
