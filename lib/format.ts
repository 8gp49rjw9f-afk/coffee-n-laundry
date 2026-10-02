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

export const PAYMENT_OPTIONS = [
  { key: "cash", label: "Cash", emoji: "💵" },
  { key: "card", label: "Card", emoji: "💳" },
  { key: "visa", label: "Visa", emoji: "💳" },
  { key: "mastercard", label: "Mastercard", emoji: "💳" },
  { key: "amex", label: "American Express", emoji: "💳" },
  { key: "major_cards", label: "All major credit cards", emoji: "💳" },
  { key: "debit", label: "Debit", emoji: "🏧" },
  { key: "contactless", label: "Contactless", emoji: "📱" },
  { key: "apple_pay", label: "Apple Pay", emoji: "🍎" },
  { key: "google_pay", label: "Google Pay", emoji: "🟢" },
  { key: "laundry_card", label: "Laundry card", emoji: "🎟️" },
  { key: "coins", label: "Coins only", emoji: "🪙" },
  { key: "other", label: "Other", emoji: "➖" },
] as const;



export function paymentLabel(key: string): string {
  return PAYMENT_OPTIONS.find((p) => p.key === key)?.label ?? key;
}

export function paymentEmoji(key: string): string {
  return PAYMENT_OPTIONS.find((p) => p.key === key)?.emoji ?? "➖";
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
