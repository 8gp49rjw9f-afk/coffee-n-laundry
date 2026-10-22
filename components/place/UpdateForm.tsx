"use client";

import { useState, useTransition } from "react";

import { Button, Card, ErrorBanner } from "@/components/ui";
import { IdentityBlock } from "@/components/place/IdentityBlock";

import { updatePlace } from "@/app/actions/updatePlace";

import { AMBIENCE, COFFEE_KINDS, FOOD } from "@/lib/coffee";
import { CURRENCIES } from "@/lib/currencies";

import type {
  CoffeeDetails,
  LaundryDetails,
  PlaceType,
} from "@/lib/types";

/* Duration steps of five minutes, from 5 to 90. A short cycle exists
   and so does a long one; the old list started at 15 and skipped 55. */
const DURATIONS = Array.from({ length: 18 }, (_, i) => (i + 1) * 5);

const ENTRY_TIMES = Array.from({ length: 48 }, (_, i) => {
  const minutes = i * 30;

  return { value: minutes, label: clockTime(minutes) };
});

function clockTime(minutes: number) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;

  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/*
 * Four ways to pay, and the card detail behind one of them.
 *
 * The old list had thirteen flat options and several of them meant the
 * same thing: Visa competed with Card, and "All major credit cards"
 * competed with both. Nobody could tell which to pick, and the same
 * shop got tagged three different ways depending on who filled the
 * form — which made the column useless to count from.
 *
 * Visa is not an alternative to Cards. It is a refinement of it, so it
 * lives underneath, and only appears once Cards is chosen.
 *
 * A laundry card is a laundromat's own stored-value card, sold at the
 * counter and swiped on its machines. A café has nothing of the kind,
 * so the option is filtered out for one — see paymentKeysFor below.
 */
const PAYMENT_KEYS = [
  { value: "cash", label: "💵 Cash / Coins" },
  { value: "card", label: "💳 Cards" },
  { value: "online", label: "📱 Online App" },
  { value: "laundry_card", label: "🎟️ Laundry Card" },
];

/* The laundromat-only option, removed for a café. */
function paymentKeysFor(isCoffee: boolean) {
  return isCoffee
    ? PAYMENT_KEYS.filter((option) => option.value !== "laundry_card")
    : PAYMENT_KEYS;
}

const CARD_KINDS = [
  { value: "mastercard", label: "MasterCard" },
  { value: "visa", label: "Visa" },
  { value: "amex", label: "Amex" },
  { value: "major_cards", label: "Major Local Credit Cards" },
];

/* A person may write one thing of their own — "exact change only",
   "tokens at the counter". It goes into accepted_payments beside the
   rest, capped so a note cannot become a paragraph. */
const PAYMENT_NOTE_MAX = 25;

/* The milks, listed once so the form and the payload agree. */
const MILKS = [
  { key: "milk", label: "🥛 Cow" },
  { key: "oat_milk", label: "🌾 Oat" },
  { key: "soy_milk", label: "🫘 Soy" },
  { key: "coconut_milk", label: "🥥 Coconut" },
  { key: "almond_milk", label: "🌰 Almond" },
];

const MACHINE_SIZES = [
  { key: "small", label: "Small" },
  { key: "medium", label: "Medium" },
  { key: "large", label: "Large" },
];

/*
 * ONE BUTTON SHAPE FOR THE WHOLE FORM, and it is the one the coffee
 * rows use.
 *
 * The coffee sections — Coffee type, Milk, Food, Ambiance — write
 * their buttons inline rather than through this component, and they
 * were left at the small size while this one was enlarged. The
 * result was one form with two heights and two type sizes: the same
 * kind of choice looked different depending on which card it was in.
 *
 * Both are the same shape now: 44px tall, 14px text. The inline
 * buttons below were changed with it. min-h-11 is the shortest
 * height that stays comfortable under a thumb, which matters more
 * than fitting one extra chip per line.
 */
const BUTTON_SHAPE =
  "min-h-11 rounded-xl border px-4 text-sm font-semibold transition";

const BUTTON_OFF = "border-slate-300 bg-white text-slate-700";
const BUTTON_ON = "border-slate-900 bg-slate-900 text-white";

function Toggle({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      aria-pressed={value}
      className={`${BUTTON_SHAPE} ${value ? BUTTON_ON : BUTTON_OFF}`}
    >
      {label}
    </button>
  );
}

export function UpdateForm({
  place,
  canEdit,
  blockedMessage,
  isOwner,
}: {
  place: {
    id: string;
    name: string;
    place_type: PlaceType;
    address: string | null;
    city: string | null;
    country: string | null;
    latitude: number;
    longitude: number;
    website: string | null;
    description: string | null;
    accepted_payments: string[];
    has_wifi: boolean | null;
    has_power: boolean | null;
    has_parking: boolean | null;
    has_seating: boolean | null;
    has_toilets: boolean | null;
    coffee: CoffeeDetails | null;
    laundry: LaundryDetails | null;
    prices: { kind: string; amount: number; currency: string }[];
  };
  /* Whether today's edit is still available, and the sentence to show
     when it is not. Both are decided by the page, which reads the same
     counter the server does. */
  canEdit: boolean;
  blockedMessage: string;
  /* Only the creator may touch the name, the address or the pin. */
  isOwner: boolean;
}) {
  const [pending, startTransition] = useTransition();

  const [name, setName] = useState(place.name);
  const [address, setAddress] = useState(place.address ?? "");
  const [latitude, setLatitude] = useState(place.latitude);
  const [longitude, setLongitude] = useState(place.longitude);

  /* The prices this page shows, seeded from the place's own rows so a
     wrong number can be corrected rather than only added. */
  const amountOf = (kind: string) =>
    place.prices.find((p) => p.kind === kind)?.amount?.toString() ?? "";

  const [espressoPrice, setEspressoPrice] = useState(amountOf("espresso"));
  const [flatWhitePrice, setFlatWhitePrice] = useState(amountOf("flat_white"));
  const [currency, setCurrency] = useState(place.prices[0]?.currency ?? "SGD");

  const [payments, setPayments] = useState<string[]>(
    place.accepted_payments ?? []
  );

  /* Whatever the person wrote in the free field. Held apart from
     `payments` so the button list stays the four categories, and
     folded in at send time. */
  const [paymentNote, setPaymentNote] = useState("");

  const [wifi, setWifi] = useState(Boolean(place.has_wifi));
  const [power, setPower] = useState(Boolean(place.has_power));
  const [parking, setParking] = useState(Boolean(place.has_parking));
  const [seating, setSeating] = useState(Boolean(place.has_seating));
  const [toilets, setToilets] = useState(Boolean(place.has_toilets));

  /* coffee */
  const [coffeeKind, setCoffeeKind] = useState(
    place.coffee?.coffee_kind ?? "regular"
  );
  const [roaster, setRoaster] = useState(place.coffee?.roaster ?? "");
  const [sellsBeans, setSellsBeans] = useState(
    Boolean(place.coffee?.sells_beans)
  );
  const [hasRoaster, setHasRoaster] = useState(
    Boolean(place.coffee?.has_roaster)
  );
  const [hasDecaf, setHasDecaf] = useState(Boolean(place.coffee?.has_decaf));
  const [laptop, setLaptop] = useState(
    Boolean(place.coffee?.laptop_friendly)
  );

  const [milks, setMilks] = useState<string[]>(
    MILKS.filter((m) =>
      Boolean(
        (place.coffee as unknown as Record<string, unknown> | null)?.[
          `has_${m.key === "milk" ? "milk" : m.key}`
        ]
      )
    ).map((m) => m.key)
  );

  const [ambience, setAmbience] = useState<string[]>(
    place.coffee?.ambience ?? []
  );
  const [food, setFood] = useState<string[]>(place.coffee?.food ?? []);

  /* laundry */
  const [machineSizes, setMachineSizes] = useState<string[]>(
    place.laundry?.machine_sizes ?? []
  );

  const [detergentIncluded, setDetergentIncluded] = useState(
    Boolean(place.laundry?.detergent_included)
  );
  const [detergentPurchasable, setDetergentPurchasable] = useState(
    Boolean(place.laundry?.detergent_purchasable)
  );

  /* Seeded from the place's own row so a wrong detergent price can be
     corrected, the same way the wash and dryer amounts are. */
  const [detergentPrice, setDetergentPrice] = useState(amountOf("detergent"));

  const [open24h, setOpen24h] = useState(Boolean(place.laundry?.open_24h));
  const [washMinutes, setWashMinutes] = useState(
    place.laundry?.wash_minutes != null
      ? String(place.laundry.wash_minutes)
      : ""
  );
  const [dryerMinutes, setDryerMinutes] = useState(
    place.laundry?.dryer_minutes != null
      ? String(place.laundry.dryer_minutes)
      : ""
  );
  const [lastEntry, setLastEntry] = useState(
    place.laundry?.last_entry_minutes != null
      ? String(place.laundry.last_entry_minutes)
      : ""
  );

  /* The laundry prices, seeded the same way the coffee ones are. */
  const [washAmount, setWashAmount] = useState(amountOf("wash"));
  const [dryerAmount, setDryerAmount] = useState(amountOf("dryer"));

  const [website, setWebsite] = useState(place.website ?? "");

  const [error, setError] = useState("");

  const isCoffee = place.place_type === "coffee";

  const field =
    "w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-slate-500";

  function toggleIn(list: string[], set: (v: string[]) => void, key: string) {
    set(list.includes(key) ? list.filter((k) => k !== key) : [...list, key]);
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setError("");

    const formData = new FormData();

    formData.set("place_id", place.id);
    formData.set("website", website.trim());

    /*
     * NO DESCRIPTION FIELD HERE ANY MORE.
     *
     * This form used to carry one — "Anything useful to know?" — and
     * the note went into `places.description`, where nothing has ever
     * read it. On the creation form the same field now becomes the
     * first COMMENT on the place; here there is nothing to become
     * one, because a comment already exists by then.
     *
     * So the field is gone rather than renamed. A box labelled
     * "Add some comments" that saves text nobody can see would be a
     * worse lie than the old label was, and leaving the description
     * untouched is the only honest behaviour: this form changes
     * prices and facts, and comments are written on the place page.
     *
     * The server still accepts `description` on this path and updates
     * the column if it is sent — see updatePlace.ts. It simply is not
     * sent any more, so the existing text is preserved rather than
     * cleared.
     */

    /* The identity fields travel with the form either way; the server
       honours them only for the creator. */
    if (isOwner) {
      formData.set("name", name.trim());
      formData.set("address", address.trim());
      formData.set("latitude", String(latitude));
      formData.set("longitude", String(longitude));
    }

    formData.set("has_wifi", String(wifi));
    formData.set("has_power", String(power));
    formData.set("has_parking", String(parking));
    formData.set("has_seating", String(seating));
    formData.set("has_toilets", String(toilets));

    payments.forEach((p) => formData.append("payments", p));

    if (paymentNote.trim()) {
      formData.append("payments", paymentNote.trim());
    }

    machineSizes.forEach((s) => formData.append("machine_sizes", s));
    ambience.forEach((a) => formData.append("ambience", a));
    food.forEach((f) => formData.append("food", f));

    /* The currency is the one chosen with the amounts. A place with no
       price yet has no currency of its own to fall back on, which is
       why the picker sits with the amounts. */
    formData.set("currency", currency);

    if (isCoffee) {
      formData.set("coffee_kind", coffeeKind);
      formData.set("roaster_name", roaster.trim());
      formData.set("sells_beans", String(sellsBeans));
      formData.set("has_roaster", String(hasRoaster));
      formData.set("has_decaf", String(hasDecaf));
      formData.set("laptop_friendly", String(laptop));

      formData.set("has_milk", String(milks.includes("milk")));
      formData.set("has_oat_milk", String(milks.includes("oat_milk")));
      formData.set("has_soy_milk", String(milks.includes("soy_milk")));
      formData.set("has_coconut_milk", String(milks.includes("coconut_milk")));
      formData.set("has_almond_milk", String(milks.includes("almond_milk")));

      formData.set("espresso_price", espressoPrice);
      formData.set("flat_white_price", flatWhitePrice);
    } else {
      formData.set("wash_amount", washAmount);
      formData.set("dryer_amount", dryerAmount);
      formData.set("detergent_included", String(detergentIncluded));
      formData.set("detergent_purchasable", String(detergentPurchasable));
      formData.set("detergent_price", detergentPrice);
      formData.set("open_24h", String(open24h));
      formData.set("wash_minutes", washMinutes);
      formData.set("dryer_minutes", dryerMinutes);
      formData.set("last_entry_minutes", open24h ? "" : lastEntry);
    }

    startTransition(async () => {
      try {
        await updatePlace(formData);
      } catch (err) {
        setError(
          err instanceof Error && err.message
            ? err.message
            : "Could not save those changes."
        );
      }
    });
  }

  /* One edit per day, per type, per person. The page reads the same
     counter, so this is the reason rather than a late failure. */
  if (!canEdit) {
    return (
      <Card>
        <p className="text-base font-semibold text-slate-900">
          {blockedMessage}
        </p>

        <p className="mt-2 text-sm text-slate-600">
          One coffee shop and one laundromat per day, per person — that is
          what keeps the prices believable. What is on the page right now
          was last written by someone who had the same limit.
        </p>

        <a
          href={`/place/${place.id}`}
          className="mt-4 inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-300 bg-white px-5 font-semibold text-slate-800 hover:bg-slate-50"
        >
          ← Back to {place.name}
        </a>
      </Card>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Name, address and pin belong to the creator; everyone else
          sees them read-only. The server enforces the same rule, so a
          stranger's form cannot slip past it. */}
      {isOwner ? (
        <IdentityBlock
          placeId={place.id}
          name={name}
          address={address}
          latitude={latitude}
          longitude={longitude}
          onNameChange={setName}
          onAddressChange={setAddress}
          onPositionChange={(lat, lng) => {
            setLatitude(lat);
            setLongitude(lng);
          }}
        />
      ) : (
        <Card>
          <h2 className="mb-1 text-sm font-bold uppercase tracking-wide text-slate-500">
            What it is
          </h2>

          <p className="mb-3 text-xs text-slate-400">
            Name, address and position are fixed. If this place moved or
            changed name, report it instead.
          </p>

          <p className="text-lg font-bold text-slate-900">{place.name}</p>

          <p className="mt-1 text-sm text-slate-600">
            {[place.address, place.city, place.country]
              .filter(Boolean)
              .join(" · ") || "No address recorded"}
          </p>
        </Card>
      )}

      {/* ---------- price and time ---------- */}

      {isCoffee ? (
        <Card>
          <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-500">
            Coffee Prices
          </h2>

          <div className="grid grid-cols-3 gap-1.5">
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-slate-500">
                Espresso
              </span>

              <input
                value={espressoPrice}
                onChange={(e) => setEspressoPrice(e.target.value)}
                inputMode="decimal"
                placeholder="3.50"
                className={field}
              />
            </label>

            <label className="block">
              <span className="mb-1 block text-xs font-medium text-slate-500">
                Flat white
              </span>

              <input
                value={flatWhitePrice}
                onChange={(e) => setFlatWhitePrice(e.target.value)}
                inputMode="decimal"
                placeholder="4.50"
                className={field}
              />
            </label>

            <label className="block">
              <span className="mb-1 block text-xs font-medium text-slate-500">
                Currency
              </span>

              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className={field}
              >
                {CURRENCIES.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.code}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </Card>
      ) : (
        <Card>
          <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-500">
            Laundry Prices
          </h2>

          <div className="grid grid-cols-3 gap-1.5">
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-slate-500">
                Wash
              </span>

              <input
                value={washAmount}
                onChange={(e) => setWashAmount(e.target.value)}
                inputMode="decimal"
                placeholder="8.00"
                className={field}
              />
            </label>

            <label className="block">
              <span className="mb-1 block text-xs font-medium text-slate-500">
                Dryer
              </span>

              <input
                value={dryerAmount}
                onChange={(e) => setDryerAmount(e.target.value)}
                inputMode="decimal"
                placeholder="6.00"
                className={field}
              />
            </label>

            <label className="block">
              <span className="mb-1 block text-xs font-medium text-slate-500">
                Currency
              </span>

              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className={field}
              >
                {CURRENCIES.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.code}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </Card>
      )}

      {/* ---------- payment ---------- */}

      <Card>
        <h2 className="mb-1 text-sm font-bold uppercase tracking-wide text-slate-500">
          Payment
        </h2>

        <p className="mb-3 text-xs text-slate-400">
          Pick everything this place takes.
        </p>

        <div className="flex flex-wrap gap-1.5">
          {paymentKeysFor(isCoffee).map((option) => (
            <Toggle
              key={option.value}
              label={option.label}
              value={payments.includes(option.value)}
              onChange={() =>
                toggleIn(payments, setPayments, option.value)
              }
            />
          ))}
        </div>

        {payments.includes("card") && (
          <div className="mt-3 flex flex-wrap gap-1.5 border-t border-slate-100 pt-3">
            {CARD_KINDS.map((option) => (
              <Toggle
                key={option.value}
                label={option.label}
                value={payments.includes(option.value)}
                onChange={() =>
                  toggleIn(payments, setPayments, option.value)
                }
              />
            ))}
          </div>
        )}

        <label className="mt-3 block">
          <span className="mb-1 block text-xs font-medium text-slate-500">
            Anything else? (optional)
          </span>

          <input
            value={paymentNote}
            onChange={(e) => setPaymentNote(e.target.value)}
            maxLength={PAYMENT_NOTE_MAX}
            placeholder="Exact change only"
            className={field}
          />
        </label>
      </Card>

      {/* ---------- amenities ---------- */}

      <Card>
        <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-500">
          Amenities
        </h2>

        <div className="flex flex-wrap gap-1.5">
          <Toggle
            label="📶 Wifi"
            value={wifi}
            onChange={setWifi}
          />

          <Toggle
            label="🔌 Power"
            value={power}
            onChange={setPower}
          />

          <Toggle
            label="🅿️ Parking"
            value={parking}
            onChange={setParking}
          />

          <Toggle
            label={isCoffee ? "🪑 Seating" : "🧺 Folding table"}
            value={isCoffee ? seating : toilets}
            onChange={isCoffee ? setSeating : setToilets}
          />
        </div>
      </Card>

      <Card>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-slate-500">
            Website
          </span>

          <input
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
            placeholder="https://"
            className={field}
          />
        </label>
      </Card>

      {error && <ErrorBanner message={error} />}

      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Saving…" : "Save changes"}
      </Button>
    </form>
  );
}
