"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { awardCredits } from "@/lib/services/credits";
import { uploadPlacePhoto } from "@/lib/services/upload";

/* Photos are for deciding whether to walk over: a machine, a price
   list, the front door. They are compressed on the client before
   they reach this action. */

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

    /* The bucket returns a full URL; the row stores the path. */
    const storagePath = url.split("/").slice(-2).join("/");

    await supabase.from("place_photos").insert({
      place_id: placeId,
      uploaded_by: user.id,
      storage_path: storagePath,
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
