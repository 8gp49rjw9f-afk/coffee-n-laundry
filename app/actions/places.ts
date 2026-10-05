"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { getSettings } from "@/lib/services/settings";
import { awardCredits } from "@/lib/services/credits";
import { reverseGeocode } from "@/lib/services/geocoding";
import { uploadPlacePhoto } from "@/lib/services/upload";

import { displayNameFor } from "@/lib/database/places";

import type { PlaceType } from "@/lib/types";

/*
 * Which field each answer belongs to, so every filled-in value gets
 * its own "verified by" row in the table below it.
 *
 * This list and the `place_field` enum in the database have to agree.
 * They did not: `food` and `detergent_price` were written here for
 * months while the enum had never heard of them, and because the
 * insert below had no error handling, ticking a single Food option
 * took the whole action down with an opaque production error.
 * Migration 0014 added the two missing values.
 */

type FieldKey =
  | "wash_price"
  | "dryer_price"
  | "wash_minutes"
  | "dryer_minutes"
  | "last_entry"
  | "detergent"
  | "detergent_purchase"
  | "detergent_price"
  | "machines"
  | "wifi"
  | "power"
  | "parking"
  | "toilets"
  | "seating"
  | "coffee_kind"
  | "espresso_price"
  | "filter_price"
  | "flat_white_price"
  | "beans"
  | "roaster_available"
  | "ambience"
  | "food"
  | "oat_milk"
  | "soy_milk"
  | "coconut_milk"
  | "almond_milk"
  | "decaf"
  | "laptop"
  | "payment_methods";

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

export async function createPlace(formData: FormData): Promise<void> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/new");
  }

  const settings = await getSettings();

  const placeType = String(formData.get("place_type") ?? "coffee") as PlaceType;
  const name = String(formData.get("name") ?? "").trim();
  const address = String(formData.get("address") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const website = String(formData.get("website") ?? "").trim();

  const latitude = Number(formData.get("latitude"));
  const longitude = Number(formData.get("longitude"));

  /* ---------- validation ---------- */

  if (!name) throw new Error("A name is required.");

  if (name.length > settings.max_name_length) {
    throw new Error("That name is too long.");
  }

  if (description.length > settings.max_description_length) {
    throw new Error("That description is too long.");
  }

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    throw new Error("A position is required. Use the location picker.");
  }

  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
    throw new Error("Those coordinates are outside the map.");
  }

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const { count: recentCount } = await supabase
    .from("places")
    .select("id", { count: "exact", head: true })
    .eq("created_by", user.id)
    .gte("created_at", since);

  if ((recentCount ?? 0) >= settings.max_places_per_user_per_day) {
    throw new Error(
      "You have added a lot of places today. Try again tomorrow, or update an existing one."
    );
  }

  const geo = await reverseGeocode(latitude, longitude);

  /* ---------- what the form sent ---------- */

  const list = (key: string) =>
    formData
      .getAll(key)
      .map((value) => String(value))
      .filter(Boolean);

  const payments = list("payments");

  const machineSizes = list("machine_sizes").filter((value) =>
    ["small", "medium", "large"].includes(value)
  );

  const ambience = list("ambience").filter((value) =>
    AMBIENCE_VALUES.includes(value)
  );

  const food = list("food").filter((value) => FOOD_VALUES.includes(value));

  const hasWifi = readBool(formData.get("has_wifi"));
  const hasPower = readBool(formData.get("has_power"));
  const hasParking = readBool(formData.get("has_parking"));
  const hasSeating = readBool(formData.get("has_seating"));
  const hasToilets = readBool(formData.get("has_toilets"));

  /* ---------- the place itself ---------- */

  const { data: place, error } = await supabase
    .from("places")
    .insert({
      place_type: placeType,
      name,
      address: address || null,
      description: description || null,
      website: website || null,
      latitude,
      longitude,
      city: geo.city,
      country: geo.country,
      country_code: geo.countryCode,
      has_wifi: hasWifi,
      has_power: hasPower,
      has_parking: hasParking,
      has_seating: hasSeating,
      has_toilets: hasToilets,
      accepted_payments: payments,
      created_by: user.id,
    })
    .select("id")
    .single();

  /* This one is fatal, and says so. A place that was not saved has
     nothing to redirect to, and the person needs to know why. */
  if (error || !place) {
    throw new Error(
      error ? `Could not save that place: ${error.message}` : "Could not save that place."
    );
  }

  /* ---------- prices, for either type ---------- */

  const currency = String(formData.get("currency") ?? "")
    .trim()
    .toUpperCase()
    .slice(0, 3);

  const priceRows: {
    place_id: string;
    kind: string;
    amount: number;
    currency: string;
    created_by: string;
  }[] = [];

  /* A number without a currency is refused: it tells nobody anything. */
  if (currency.length === 3) {
    const add = (kind: string, raw: FormDataEntryValue | null) => {
      const amount = Number(raw);

      if (Number.isFinite(amount) && amount > 0) {
        priceRows.push({
          place_id: place.id,
          kind,
          amount,
          currency,
          created_by: user.id,
        });
      }
    };

    if (placeType === "laundry") {
      add("wash", formData.get("wash_amount"));
      add("dryer", formData.get("dryer_amount"));

      /* Detergent is only priced when it is bought there and not
         already part of the wash price. */
      if (
        readBool(formData.get("detergent_purchasable")) &&
        !readBool(formData.get("detergent_included"))
      ) {
        add("detergent", formData.get("detergent_price"));
      }
    } else {
      add("espresso", formData.get("espresso_price"));
      add("filter", formData.get("filter_price"));
      add("flat_white", formData.get("flat_white_price"));
    }

    if (priceRows.length > 0) {
      const { error: priceError } = await supabase
        .from("place_prices")
        .insert(priceRows);

      /* The place is real and saved; losing its prices would leave it
         silently useless to the person who drives there. */
      if (priceError) {
        console.error("[createPlace] prices:", priceError.message);
      }
    }
  }

  /* ---------- the type-specific row ---------- */

  if (placeType === "coffee") {
    const rawKind = String(formData.get("coffee_kind") ?? "regular");

    const kind = ["barista", "regular", "both"].includes(rawKind)
      ? rawKind
      : "regular";

    const roasterName = String(formData.get("roaster_name") ?? "").trim();
    const sellsBeans = readBool(formData.get("sells_beans"));
    const hasRoaster = readBool(formData.get("has_roaster"));

    const { error: coffeeError } = await supabase
      .from("place_coffee_details")
      .insert({
        place_id: place.id,
        coffee_kind: kind,
        roaster: roasterName || null,
        sells_beans: sellsBeans,
        has_roaster: hasRoaster || Boolean(roasterName),
        has_decaf: readBool(formData.get("has_decaf")),
        has_oat_milk: readBool(formData.get("has_oat_milk")),
        has_soy_milk: readBool(formData.get("has_soy_milk")),
        has_coconut_milk: readBool(formData.get("has_coconut_milk")),
        has_almond_milk: readBool(formData.get("has_almond_milk")),
        laptop_friendly: readBool(formData.get("laptop_friendly")),
        ambience,
        food,
      });

    /*
     * This used to be a console.error and nothing else.
     *
     * That is how the missing `food` enum value stayed invisible for
     * months: the coffee row failed, the action carried on, and the
     * page came up without the coffee facts that were just typed in.
     * A place with no details and no explanation is worse than an
     * error message, so this now stops and says what went wrong.
     */
    if (coffeeError) {
      throw new Error(
        `Saved the place, but its coffee details were refused: ${coffeeError.message}`
      );
    }
  } else {
    const { error: laundryError } = await supabase
      .from("place_laundry_details")
      .insert({
        place_id: place.id,
        machine_sizes: machineSizes,
        detergent_included: readBool(formData.get("detergent_included")),
        detergent_purchasable: readBool(formData.get("detergent_purchasable")),
        open_24h: readBool(formData.get("open_24h")),
        wash_minutes: numberOrNull(formData.get("wash_minutes")),
        dryer_minutes: numberOrNull(formData.get("dryer_minutes")),
        last_entry_minutes: numberOrNull(formData.get("last_entry_minutes")),
      });

    if (laundryError) {
      throw new Error(
        `Saved the place, but its laundry details were refused: ${laundryError.message}`
      );
    }
  }

  /* ---------- photos ---------- */

  const photoFiles = formData
    .getAll("photo")
    .filter((value): value is File => value instanceof File && value.size > 0)
    .slice(0, 5);

  for (const file of photoFiles) {
    try {
      const url = await uploadPlacePhoto(place.id, file);

      const storagePath = url.split("/").slice(-2).join("/");

      await supabase.from("place_photos").insert({
        place_id: place.id,
        uploaded_by: user.id,
        storage_path: storagePath,
        photo_type: "detail",
      });

      await awardCredits({
        userId: user.id,
        action: "add_photo",
        placeId: place.id,
      });
    } catch {
      /* A failed photo must never lose the place itself. */
    }
  }

  /* ---------- who verified what ---------- */

  /*
   * The username, not the part of the email before the @.
   *
   * `user.email.split("@")[0]` made `simon@gmail.com` and
   * `simon@hotmail.fr` both read as "simon" on the page — two people
   * wearing one name, and no way to tell which of them filled in a
   * wrong price. The username is unique, so it names one person.
   *
   * The email is not a fallback: an address printed under a place's
   * details is a leak. An account with no name yet reads as "someone".
   */
  const displayName = await displayNameFor(user.id);

  const checks: {
    place_id: string;
    field_key: FieldKey;
    verified_by: string;
    verified_by_name: string;
    value_snapshot: string | null;
  }[] = [];

  const push = (field: FieldKey, value: string | null) =>
    checks.push({
      place_id: place.id,
      field_key: field,
      verified_by: user.id,
      verified_by_name: displayName,
      value_snapshot: value,
    });

  if (placeType === "coffee") {
    push("coffee_kind", String(formData.get("coffee_kind") ?? "regular"));

    const named = (field: FieldKey, key: string) => {
      const value = String(formData.get(key) ?? "").trim();

      if (value) push(field, `${value} ${currency}`.trim());
    };

    named("espresso_price", "espresso_price");
    named("filter_price", "filter_price");
    named("flat_white_price", "flat_white_price");

    if (readBool(formData.get("sells_beans"))) push("beans", "yes");

    if (readBool(formData.get("has_roaster"))) {
      const roasterName = String(formData.get("roaster_name") ?? "").trim();

      push("roaster_available", roasterName ? `yes · ${roasterName}` : "yes");
    }

    if (ambience.length > 0) push("ambience", ambience.join(", "));
    if (food.length > 0) push("food", food.join(", "));
    if (readBool(formData.get("has_decaf"))) push("decaf", "yes");
    if (readBool(formData.get("has_oat_milk"))) push("oat_milk", "yes");
    if (readBool(formData.get("has_soy_milk"))) push("soy_milk", "yes");
    if (readBool(formData.get("has_coconut_milk"))) push("coconut_milk", "yes");
    if (readBool(formData.get("has_almond_milk"))) push("almond_milk", "yes");
    if (readBool(formData.get("laptop_friendly"))) push("laptop", "yes");
  } else {
    const wash = formData.get("wash_amount");
    const dryer = formData.get("dryer_amount");

    if (wash) push("wash_price", `${wash} ${currency}`.trim());
    if (dryer) push("dryer_price", `${dryer} ${currency}`.trim());

    const washMin = numberOrNull(formData.get("wash_minutes"));
    const dryerMin = numberOrNull(formData.get("dryer_minutes"));
    const lastEntry = numberOrNull(formData.get("last_entry_minutes"));

    if (washMin) push("wash_minutes", `${washMin} min`);
    if (dryerMin) push("dryer_minutes", `${dryerMin} min`);
    if (lastEntry != null) push("last_entry", clockTime(lastEntry));

    if (machineSizes.length > 0) push("machines", machineSizes.join(", "));

    push(
      "detergent",
      readBool(formData.get("detergent_included"))
        ? "included"
        : "not included"
    );

    if (readBool(formData.get("detergent_purchasable"))) {
      push("detergent_purchase", "yes");

      const detergentPrice = String(
        formData.get("detergent_price") ?? ""
      ).trim();

      if (detergentPrice && !readBool(formData.get("detergent_included"))) {
        push("detergent_price", `${detergentPrice} ${currency}`.trim());
      }
    }
  }

  if (hasWifi) push("wifi", "yes");
  if (hasPower) push("power", "yes");
  if (hasParking) push("parking", "yes");
  if (hasSeating) push("seating", "yes");
  if (hasToilets) push("toilets", "yes");

  if (payments.length > 0) push("payment_methods", payments.join(", "));

  if (checks.length > 0) {
    const { error: checkError } = await supabase
      .from("place_field_checks")
      .insert(checks);

    /*
     * This is the line that used to be missing entirely, and it is
     * why the `food` bug was so hard to find.
     *
     * The insert had no error handling at all. One value the database
     * did not recognise in `field_key` took the whole action down, and
     * Next.js reported it as an opaque digest. With this in place the
     * next missing enum value names itself in the message.
     */
    if (checkError) {
      throw new Error(
        `Saved the place, but its verification rows were refused: ${checkError.message}`
      );
    }
  }

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

/* ====================================================== */
/* HELPERS                                                 */
/* ====================================================== */

function readBool(value: FormDataEntryValue | null): boolean {
  return String(value) === "true";
}

function numberOrNull(value: FormDataEntryValue | null): number | null {
  const n = Number(value);

  return Number.isFinite(n) && n >= 0 ? n : null;
}

function clockTime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;

  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}
