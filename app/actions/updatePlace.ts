"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { awardCredits } from "@/lib/services/credits";

import type { PlaceType } from "@/lib/types";

/*
 * The client sends the whole form; the server decides what actually
 * changed by comparing against the row it already has. That keeps the
 * update log honest — nobody declares "I changed the price", the
 * difference is computed — and it means a stale form cannot overwrite
 * a value someone else edited in the meantime without that edit
 * showing up as a change.
 *
 * `place_updates` carries one row per field that moved, so the
 * timeline reads as a list of facts rather than one vague "edited".
 */

type FieldKey =
  | "wash_price"
  | "dryer_price"
  | "wash_minutes"
  | "dryer_minutes"
  | "last_entry"
  | "open_24h"
  | "detergent"
  | "detergent_purchase"
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
  | "oat_milk"
  | "soy_milk"
  | "coconut_milk"
  | "almond_milk"
  | "decaf"
  | "laptop"
  | "payment_methods"
  | "website"
  | "description";

const AMBIENCE_VALUES = [
  "cosy",
  "minimal",
  "lively",
  "quiet",
  "work-friendly",
  "outdoor-seating",
];

const UPDATE_TYPE_FOR: Partial<Record<FieldKey, string>> = {
  wash_price: "price",
  dryer_price: "price",
  espresso_price: "price",
  filter_price: "price",
  flat_white_price: "price",
  wash_minutes: "hours",
  dryer_minutes: "hours",
  last_entry: "hours",
  open_24h: "hours",
  detergent: "detergent",
  detergent_purchase: "detergent",
  machines: "general",
  wifi: "general",
  power: "general",
  parking: "general",
  toilets: "general",
  seating: "general",
  coffee_kind: "coffee",
  beans: "coffee",
  roaster_available: "coffee",
  ambience: "coffee",
  oat_milk: "coffee",
  soy_milk: "coffee",
  coconut_milk: "coffee",
  almond_milk: "coffee",
  decaf: "coffee",
  laptop: "coffee",
  payment_methods: "payment_method",
  website: "general",
  description: "general",
};

export async function updatePlace(formData: FormData): Promise<void> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const placeId = String(formData.get("place_id") ?? "");

  if (!user) {
    redirect(`/login?next=/update/${placeId}`);
  }

  if (!placeId) throw new Error("That place no longer exists.");

  /* ---------- the place as it stands ---------- */

  const { data: place } = await supabase
    .from("places")
    .select("*")
    .eq("id", placeId)
    .maybeSingle();

  if (!place) throw new Error("That place no longer exists.");

  const placeType = place.place_type as PlaceType;

  const [coffeeRow, laundryRow] = await Promise.all([
    supabase
      .from("place_coffee_details")
      .select("*")
      .eq("place_id", placeId)
      .maybeSingle(),
    supabase
      .from("place_laundry_details")
      .select("*")
      .eq("place_id", placeId)
      .maybeSingle(),
  ]);

  const { data: priceRows } = await supabase
    .from("place_prices")
    .select("kind, amount, currency")
    .eq("place_id", placeId);

  const prices = new Map(
    (priceRows ?? []).map((row) => [
      row.kind as string,
      { amount: Number(row.amount), currency: String(row.currency) },
    ])
  );

  /* ---------- the daily limit ---------- */

  /* The person who added the place can keep fixing it: they are the
     one who knows it. The limit exists to stop strangers rewriting
     the same café over and over. */
  const isOwner = place.created_by === user.id;

  const today = new Date().toISOString().slice(0, 10);

  if (!isOwner) {
    const { count: editsToday } = await supabase
      .from("place_updates")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("place_kind", placeType)
      .eq("update_day", today)
      .neq("update_type", "photo");

    if ((editsToday ?? 0) > 0) {
      throw new Error(
        placeType === "coffee"
          ? "You already edited a coffee shop today. You can edit another one tomorrow."
          : "You already edited a laundromat today. You can edit another one tomorrow."
      );
    }
  }

  /* ---------- what the form sent ---------- */

  const text = (key: string) => String(formData.get(key) ?? "").trim();

  const list = (key: string) =>
    formData
      .getAll(key)
      .map((value) => String(value))
      .filter(Boolean);

  const bool = (key: string) => String(formData.get(key)) === "true";

  const numberOrNull = (key: string): number | null => {
    const n = Number(formData.get(key));

    return Number.isFinite(n) && n >= 0 ? n : null;
  };

  const currency = text("currency").toUpperCase().slice(0, 3);

  const changes: {
    field: FieldKey;
    oldValue: string | null;
    newValue: string | null;
  }[] = [];

  /* Records a change only when the value actually moved. */
  const change = (
    field: FieldKey,
    before: string | null,
    after: string | null
  ) => {
    const a = before ?? "";
    const b = after ?? "";

    if (a !== b) changes.push({ field, oldValue: before, newValue: after });
  };

  /* ---------- comparisons ---------- */

  change("website", place.website, text("website") || null);
  change("description", place.description, text("description") || null);

  const payments = list("payments").sort();
  const paymentsBefore = [...((place.accepted_payments ?? []) as string[])].sort();

  change(
    "payment_methods",
    paymentsBefore.join(", ") || null,
    payments.join(", ") || null
  );

  const amenities: [FieldKey, boolean, boolean][] = [
    ["wifi", Boolean(place.has_wifi), bool("has_wifi")],
    ["power", Boolean(place.has_power), bool("has_power")],
    ["parking", Boolean(place.has_parking), bool("has_parking")],
    ["seating", Boolean(place.has_seating), bool("has_seating")],
    ["toilets", Boolean(place.has_toilets), bool("has_toilets")],
  ];

  for (const [field, before, after] of amenities) {
    change(field, before ? "yes" : null, after ? "yes" : null);
  }

  const placeUpdates: Record<string, unknown> = {
    has_wifi: bool("has_wifi"),
    has_power: bool("has_power"),
    has_parking: bool("has_parking"),
    has_seating: bool("has_seating"),
    has_toilets: bool("has_toilets"),
    accepted_payments: payments,
    website: text("website") || null,
    description: text("description") || null,
  };


  /* ---------- the type-specific side ---------- */

  if (placeType === "coffee") {
    const details = coffeeRow.data ?? {};

    const ambience = list("ambience").filter((v) =>
      AMBIENCE_VALUES.includes(v)
    );

    const before = {
      kind: details.coffee_kind ?? "regular",
      roaster: details.roaster ?? null,
      beans: Boolean(details.sells_beans),
      hasRoaster: Boolean(details.has_roaster),
      decaf: Boolean(details.has_decaf),
      oat: Boolean(details.has_oat_milk),
      soy: Boolean(details.has_soy_milk),
      coconut: Boolean(details.has_coconut_milk),
      almond: Boolean(details.has_almond_milk),
      laptop: Boolean(details.laptop_friendly),
      ambience: ((details.ambience ?? []) as string[]).sort(),
    };

    change("coffee_kind", before.kind, text("coffee_kind") || null);

    /* Prices, one row each, only when the number or currency moved. */
    const priceChange = (field: FieldKey, kind: string, key: string) => {
      const amount = Number(formData.get(key));
      const existing = prices.get(kind);
      const has = Number.isFinite(amount) && amount > 0;

      change(
        field,
        existing ? `${existing.amount} ${existing.currency}` : null,
        has ? `${amount} ${currency}` : null
      );
    };

    priceChange("espresso_price", "espresso", "espresso_price");
    priceChange("filter_price", "filter", "filter_price");
    priceChange("flat_white_price", "flat_white", "flat_white_price");

    change("beans", before.beans ? "yes" : null, bool("sells_beans") ? "yes" : null);
    change("decaf", before.decaf ? "yes" : null, bool("has_decaf") ? "yes" : null);
    change("oat_milk", before.oat ? "yes" : null, bool("has_oat_milk") ? "yes" : null);
    change("soy_milk", before.soy ? "yes" : null, bool("has_soy_milk") ? "yes" : null);
    change(
      "coconut_milk",
      before.coconut ? "yes" : null,
      bool("has_coconut_milk") ? "yes" : null
    );
    change(
      "almond_milk",
      before.almond ? "yes" : null,
      bool("has_almond_milk") ? "yes" : null
    );
    change(
      "laptop",
      before.laptop ? "yes" : null,
      bool("laptop_friendly") ? "yes" : null
    );

    const roasterName = text("roaster_name");
    const hasRoaster = bool("has_roaster");

    change(
      "roaster_available",
      before.hasRoaster ? before.roaster || "yes" : before.roaster,
      hasRoaster ? roasterName || "yes" : null
    );

    change(
      "ambience",
      before.ambience.join(", ") || null,
      ambience.slice().sort().join(", ") || null
    );

    const { error: coffeeError } = await supabase
      .from("place_coffee_details")
      .update({
        coffee_kind: text("coffee_kind") || "regular",
        roaster: roasterName || null,
        sells_beans: bool("sells_beans"),
        has_roaster: hasRoaster,
        has_decaf: bool("has_decaf"),
        has_oat_milk: bool("has_oat_milk"),
        has_soy_milk: bool("has_soy_milk"),
        has_coconut_milk: bool("has_coconut_milk"),
        has_almond_milk: bool("has_almond_milk"),
        laptop_friendly: bool("laptop_friendly"),
        ambience,
      })
      .eq("place_id", placeId);

    if (coffeeError) {
      console.error("[updatePlace] coffee details:", coffeeError.message);
      throw new Error("Could not save the coffee details.");
    }

    const writePrice = async (kind: string, key: string) => {
      const amount = Number(formData.get(key));

      if (!Number.isFinite(amount) || amount <= 0 || currency.length !== 3) {
        return;
      }

      if (prices.has(kind)) {
        await supabase
          .from("place_prices")
          .update({ amount, currency, updated_at: new Date().toISOString() })
          .eq("place_id", placeId)
          .eq("kind", kind);
      } else {
        await supabase.from("place_prices").insert({
          place_id: placeId,
          kind,
          amount,
          currency,
          created_by: user.id,
        });
      }
    };

    await writePrice("espresso", "espresso_price");
    await writePrice("filter", "filter_price");
    await writePrice("flat_white", "flat_white_price");
  } else {
    const details = laundryRow.data ?? {};

    const before = {
      wash: prices.get("wash")
        ? `${prices.get("wash")!.amount} ${prices.get("wash")!.currency}`
        : null,
      dryer: prices.get("dryer")
        ? `${prices.get("dryer")!.amount} ${prices.get("dryer")!.currency}`
        : null,
      washMin: details.wash_minutes ?? null,
      dryerMin: details.dryer_minutes ?? null,
      open24h: Boolean(details.open_24h),
      lastEntry: details.last_entry_minutes ?? null,
      machines: ((details.machine_sizes ?? []) as string[]).sort(),
      detergent: Boolean(details.detergent_included),
      buyable: Boolean(details.detergent_purchasable),
    };

    const priceChange = (field: FieldKey, kind: string, key: string) => {
      const amount = Number(formData.get(key));
      const has = Number.isFinite(amount) && amount > 0;

      change(
        field,
        kind === "wash" ? before.wash : before.dryer,
        has ? `${amount} ${currency}` : null
      );
    };

    priceChange("wash_price", "wash", "wash_amount");
    priceChange("dryer_price", "dryer", "dryer_amount");

    const washMin = numberOrNull("wash_minutes");
    const dryerMin = numberOrNull("dryer_minutes");
    const open24h = bool("open_24h");
    const lastEntry = open24h ? null : numberOrNull("last_entry_minutes");

    change(
      "wash_minutes",
      before.washMin ? `${before.washMin} min` : null,
      washMin ? `${washMin} min` : null
    );

    change(
      "dryer_minutes",
      before.dryerMin ? `${before.dryerMin} min` : null,
      dryerMin ? `${dryerMin} min` : null
    );

    change("open_24h", before.open24h ? "yes" : null, open24h ? "yes" : null);

    change(
      "last_entry",
      before.lastEntry != null ? clockTime(Number(before.lastEntry)) : null,
      lastEntry != null ? clockTime(lastEntry) : null
    );

    const machines = list("machine_sizes")
      .filter((v) => ["small", "medium", "large"].includes(v))
      .sort();

    change(
      "machines",
      before.machines.join(", ") || null,
      machines.join(", ") || null
    );

    change(
      "detergent",
      before.detergent ? "included" : "not included",
      bool("detergent_included") ? "included" : "not included"
    );

    change(
      "detergent_purchase",
      before.buyable ? "yes" : null,
      bool("detergent_purchasable") ? "yes" : null
    );

    const { error: laundryError } = await supabase
      .from("place_laundry_details")
      .update({
        machine_sizes: machines,
        detergent_included: bool("detergent_included"),
        detergent_purchasable: bool("detergent_purchasable"),
        open_24h: open24h,
        wash_minutes: washMin,
        dryer_minutes: dryerMin,
        last_entry_minutes: lastEntry,
      })
      .eq("place_id", placeId);

    if (laundryError) {
      console.error("[updatePlace] laundry details:", laundryError.message);
      throw new Error("Could not save the laundromat details.");
    }

    const writePrice = async (kind: string, key: string) => {
      const amount = Number(formData.get(key));

      if (!Number.isFinite(amount) || amount <= 0 || currency.length !== 3) {
        return;
      }

      if (prices.has(kind)) {
        await supabase
          .from("place_prices")
          .update({ amount, currency, updated_at: new Date().toISOString() })
          .eq("place_id", placeId)
          .eq("kind", kind);
      } else {
        await supabase.from("place_prices").insert({
          place_id: placeId,
          kind,
          amount,
          currency,
          created_by: user.id,
        });
      }
    };

    await writePrice("wash", "wash_amount");
    await writePrice("dryer", "dryer_amount");
  }

  /* ---------- the place row ---------- */

  await supabase.from("places").update(placeUpdates).eq("id", placeId);

  /* ---------- nothing moved ---------- */

  if (changes.length === 0) {
    revalidatePath(`/place/${placeId}`);

    redirect(`/place/${placeId}?unchanged=1`);
  }

  /* ---------- the log ---------- */

  const displayName = (user.email ?? "").split("@")[0] || "someone";

  const updateRows = changes.map((c) => ({
    place_id: placeId,
    user_id: user.id,
    update_type: UPDATE_TYPE_FOR[c.field] ?? "general",
    field_changed: c.field,
    old_value: c.oldValue,
    new_value: c.newValue,
    comment: text("comment") || null,
    applied: true,
  }));

  const { error: logError } = await supabase
    .from("place_updates")
    .insert(updateRows);

  /* The daily index rejects the second edit — but never for the
     owner, who the index itself excludes. */
  if (logError) {
    if (logError.code === "23505" && !isOwner) {
      throw new Error(
        placeType === "coffee"
          ? "You already edited a coffee shop today. You can edit another one tomorrow."
          : "You already edited a laundromat today. You can edit another one tomorrow."
      );
    }

    console.error("[updatePlace] log:", logError.message, logError.details);

    throw new Error("Could not save those changes.");
  }

  /* ---------- the freshness stamps ---------- */

  /* These are what make the table below the map show a new value.
     A silent failure here is why an edit could appear in the timeline
     while the row above kept the old number. */
  const { error: checkError } = await supabase.from("place_field_checks").insert(
    changes.map((c) => ({
      place_id: placeId,
      field_key: c.field as never,
      verified_by: user.id,
      verified_by_name: displayName,
      value_snapshot: c.newValue,
      comment: null,
    }))
  );

  if (checkError) {
    console.error(
      "[updatePlace] field checks:",
      checkError.message,
      checkError.details,
      checkError.hint
    );
  }

  await awardCredits({
    userId: user.id,
    action: "submit_update",
    placeId,
  });

  revalidatePath(`/place/${placeId}`);
  revalidatePath("/");

  redirect(`/place/${placeId}?updated=1`);
}

function clockTime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;

  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}
