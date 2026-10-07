"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { getSettings } from "@/lib/services/settings";
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
 *
 * Every failure below throws a CODE. The database message still goes
 * to the logs beside it, where it belongs; it no longer reaches a
 * screen.
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

  if (!name) throw new Error("PLACE_NAME_REQUIRED");

  if (name.length > settings.max_name_length) {
    throw new Error("PLACE_NAME_TOO_LONG");
  }

  if (description.length > settings.max_description_length) {
    throw new Error("PLACE_DESCRIPTION_TOO_LONG");
  }

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    throw new Error("PLACE_POSITION_REQUIRED");
  }

  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
    throw new Error("PLACE_POSITION_INVALID");
  }

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const { count: recentCount } = await supabase
    .from("places")
    .select("id", { count: "exact", head: true })
    .eq("created_by", user.id)
    .gte("created_at", since);

  if ((recentCount ?? 0) >= settings.max_places_per_user_per_day) {
    throw new Error("PLACE_DAILY_LIMIT");
  }

  /*
   * The lookup may not answer — and when it does not, the place still
   * goes on the map with no city and no country. The flag is logged so
   * a run of failures is visible; nothing is said to the visitor,
   * because an empty city is the normal shape of a place in the
   * countryside and the two are not worth telling apart on screen.
   */
  const geo = await reverseGeocode(latitude, longitude);

  if (geo.failed) console.error("[createPlace] reverse geocode failed");

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
    if (error) console.error("[createPlace] place", error.message);

    throw new Error("PLACE_SAVE_FAILED");
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
         silently useless to the person who drives there. This is the
         one failure here that WARNS rather than blocks, so the place
         is kept and the visitor is told what was lost. */
      if (priceError) {
        console.error("[createPlace] prices", priceError.message);

        throw new Error("PLACE_PRICES_REFUSED");
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
        has_milk: readBool(formData.get("has_milk")),
        has_oat_milk: readBool(formData.get("has_oat_milk")),
        has_soy_milk: readBool(formData.get("has_soy_milk")),
        has_coconut_milk: readBool(formData.get("has_coconut_milk")),
        has_almond_milk: readBool(formData.get("has_almond_milk")),
        laptop_friendly: readBool(formData.get("laptop_friendly")),
        ambience,
        food,
      });

    if (coffeeError) {
      console.error("[createPlace] coffee", coffeeError.message);

      throw new Error("PLACE_COFFEE_DETAILS_REFUSED");
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
      console.error("[createPlace] laundry", laundryError.message);

      throw new Error("PLACE_LAUNDRY_DETAILS_REFUSED");
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
    } catch (photoError) {
      /* A failed photo must never lose the place itself. It is worth a
         line in the logs, and worth a quiet word — but not a block. */
      console.error("[createPlace] photo", photoError);
    }
  }

  /* ---------- who verified what ---------- */

  /*
   * The username, not the part of the email before the @.
   *
   * `simon@gmail.com` and `simon@hotmail.fr` both read as "simon" on
   * the page — two people wearing one name, and no way to tell which
   * of them filled in a wrong price. The username is unique, so it
   * names exactly one person.
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
    if (readBool(formData.get("has_milk"))) push("milk", "yes");
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

    if (checkError) {
      console.error("[createPlace] checks", checkError.message);

      throw new Error("PLACE_CHECKS_REFUSED");
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
