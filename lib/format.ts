import type { Place, PlaceWithFreshness } from "@/lib/types";

/* ====================================================== */
/* MONEY — a price always carries a currency                */
/* ====================================================== */

export function formatMoney(amount: number, currency: string): string {
  const value = Number.isInteger(amount) ? String(amount) : amount.toFixed(2);

  return `${value} ${currency.toUpperCase()}`;
}

/* ====================================================== */
/* TYPES + LABELS                                          */
/* ====================================================== */

export const TYPE_LABEL: Record<string, string> = {
  coffee: "Coffee",
  laundry: "Laundromat",
};

export const TYPE_EMOJI: Record<string, string> = {
  coffee: "☕",
  laundry: "🧺",
};

export const COFFEE_KIND_LABEL: Record<string, string> = {
  barista: "Barista coffee",
  regular: "Regular coffee",
  both: "Barista + regular",
};

export const PHOTO_TYPE_LABEL: Record<string, string> = {
  exterior: "Exterior",
  interior: "Interior",
  machines: "Machines",
  prices: "Prices",
  detail: "Detail",
};

export const UPDATE_TYPE_LABEL: Record<string, string> = {
  price: "Price changed",
  payment_method: "Payment method changed",
  hours: "Opening hours changed",
  detergent: "Detergent info",
  coffee: "Coffee info",
  photo: "New photo",
  closed: "Reported closed",
  moved: "Moved",
  general: "General update",
};

/* ====================================================== */
/* PAYMENTS                                                */
/* ====================================================== */

/*
 * Four categories, and the card detail behind one of them.
 *
 * The list used to hold thirteen flat options whose meanings
 * overlapped: Visa sat beside Card, and "All major credit cards"
 * competed with both. Nobody could tell which to pick, and the same
 * shop got tagged three different ways depending on who filled the
 * form.
 *
 * The keys that are no longer offered are kept below, so a place
 * tagged `coins` or `contactless` before this change still renders a
 * label instead of falling back to its raw key.
 */

export const PAYMENT_OPTIONS = [
  { key: "cash", label: "Cash / Coins", emoji: "💵" },
  { key: "card", label: "Cards", emoji: "💳" },
  { key: "online", label: "Online App", emoji: "📱" },
  { key: "laundry_card", label: "Laundry Card", emoji: "🎟️" },
] as const;

/* The card detail, shown only under Cards. */
export const CARD_KINDS = [
  { key: "mastercard", label: "MasterCard", emoji: "💳" },
  { key: "visa", label: "Visa", emoji: "💳" },
  { key: "amex", label: "Amex", emoji: "💳" },
  { key: "major_cards", label: "Major Local Credit Cards", emoji: "💳" },
] as const;

/* Retired keys, kept so old rows still read as words. */
const RETIRED_PAYMENTS: Record<string, { label: string; emoji: string }> = {
  coins: { label: "Coins only", emoji: "🪙" },
  contactless: { label: "Contactless", emoji: "📱" },
  debit: { label: "Debit", emoji: "🏧" },
  apple_pay: { label: "Apple Pay", emoji: "🍎" },
  google_pay: { label: "Google Pay", emoji: "🟢" },
  other: { label: "Other", emoji: "➖" },
};

const ALL_PAYMENTS = [...PAYMENT_OPTIONS, ...CARD_KINDS];

/*
 * A label for anything in accepted_payments.
 *
 * The four categories and the four card kinds are looked up; the
 * retired keys above still resolve; and anything else is free text a
 * person typed into the 25-character field, which is shown exactly as
 * written — `key` is the fallback on purpose.
 */
export function paymentLabel(key: string): string {
  const known = ALL_PAYMENTS.find((p) => p.key === key);

  if (known) return known.label;

  return RETIRED_PAYMENTS[key]?.label ?? key;
}

export function paymentEmoji(key: string): string {
  const known = ALL_PAYMENTS.find((p) => p.key === key);

  if (known) return known.emoji;

  return RETIRED_PAYMENTS[key]?.emoji ?? "➖";
}

/* The laundromat answer, in one line. */
export function describePlace(place: Place | PlaceWithFreshness): string[] {
  const parts: string[] = [];

  const wash = place.prices?.find((p) => p.kind === "wash");
  const dryer = place.prices?.find((p) => p.kind === "dryer");

  if (wash) parts.push(`🧺 ${formatMoney(wash.amount, wash.currency)} wash`);
  if (dryer) parts.push(`🔥 ${formatMoney(dryer.amount, dryer.currency)} dryer`);

  for (const key of (place.accepted_payments ?? []).slice(0, 3)) {
    parts.push(`${paymentEmoji(key)} ${paymentLabel(key)}`);
  }

  if (place.place_type === "laundry") {
    parts.push(
      place.laundry?.detergent_included
        ? "🧼 Detergent included"
        : "🧼 Detergent NOT included"
    );
  }

  return parts;
}
