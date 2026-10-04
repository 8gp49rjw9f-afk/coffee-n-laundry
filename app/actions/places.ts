  /*
   * No `add_place` award here.
   *
   * The credits for this place are paid when somebody else verifies
   * it, not now — see `awardPlaceCreditsOnce` in lib/services/credits.
   * Paying at creation would reward empty pins, and an empty pin is
   * worth nothing to the person who drives to it.
   */

  revalidatePath("/");
  revalidatePath("/new");

  redirect(`/place/${place.id}`);
}