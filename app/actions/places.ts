import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { getSettings } from "@/lib/services/settings";
import { awardCredits } from "@/lib/services/credits";
import { reverseGeocode } from "@/lib/services/geocoding";
import { uploadPlacePhoto } from "@/lib/services/upload";

import { displayNameFor } from "@/lib/database/places";

import type { FieldKey } from "@/lib/fieldKeys";
import type { PlaceType } from "@/lib/types";

/*
 * The field keys come from lib/fieldKeys.ts — one list, shared with
 * the database enum's writer expectations. The type used to be
 * declared here, in a second copy that could not be checked against
 * the first. Migration 0014 exists because those two copies drifted.
 */

const AMBIENCE_VALUES = [
  "cosy",
  "minimal",
  "lively",
  "quiet",
  "work-friendly",
  "outdoor-seating",
];

/* The same four the form offers. A stray string must not reach the
   column, which is why this list is checked rather than trusted. */
const FOOD_VALUES = ["full_meals", "vegan", "sandwich", "pastries"];
