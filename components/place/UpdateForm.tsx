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
 */
const PAYMENT_KEYS = [
  { value: "cash", label: "💵 Cash / Coins" },
  { value: "card", label: "💳 Cards" },
  { value: "online", label: "📱 Online App" },
  { value: "laundry_card", label: "🎟️ Laundry Card" },
];

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
      className={`min-h-9 rounded-lg border px-2.5 text-xs font-semibold transition ${
        value
          ? "border-slate-900 bg-slate-900 text-white"
          : "border-slate-300 bg-white text-slate-700"
      }`}
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
  const [laptop, setLaptop] = useState(Boolean(place.coffee?.laptop_friendly));

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

  const [description, setDescription] = useState(place.description ?? "");
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
    formData.set("description", description.trim());

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

    /* The currency comes off the place's own prices; a place with none
       keeps whatever it already had. */
    if (place.prices.length > 0) {
      formData.set("currency", place.prices[0].currency);
    }

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
    } else {
      formData.set("detergent_included", String(detergentIncluded));
      formData.set("detergent_purchasable", String(detergentPurchasable));
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

      <Card>
        <p className="mb-2 text-sm font-semibold text-slate-700">
          How do you pay?
        </p>

        <div className="flex flex-wrap gap-1.5">
          {PAYMENT_KEYS.map((option) => {
            const on = payments.includes(option.value);

            return (
              <button
                key={option.value}
                type="button"
                aria-pressed={on}
                onClick={() => {
                  /* Leaving Cards takes the card detail with it: a row
                     saying "Visa" under a place that does not take
                     cards is worse than no row at all. */
                  if (option.value === "card" && on) {
                    setPayments(
                      payments.filter(
                        (p) =>
                          p !== "card" &&
                          !CARD_KINDS.some((c) => c.value === p)
                      )
                    );
                    return;
                  }

                  toggleIn(payments, setPayments, option.value);
                }}
                className={`min-h-9 rounded-lg border px-2.5 text-xs font-semibold transition ${
                  on
                    ? "border-slate-900 bg-slate-900 text-white"
                    : "border-slate-300 bg-white text-slate-700"
                }`}
              >
                {option.label}
              </button>
            );
          })}
        </div>

        {payments.includes("card") && (
          <div className="mt-2 flex flex-wrap gap-1.5 border-l-2 border-slate-200 pl-2">
            {CARD_KINDS.map((option) => {
              const on = payments.includes(option.value);

              return (
                <button
                  key={option.value}
                  type="button"
                  aria-pressed={on}
                  onClick={() => toggleIn(payments, setPayments, option.value)}
                  className={`min-h-8 rounded-lg border px-2.5 text-xs font-semibold transition ${
                    on
                      ? "border-slate-900 bg-slate-900 text-white"
                      : "border-slate-200 bg-white text-slate-600"
                  }`}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
        )}

        <label className="mt-2 block">
          <span className="mb-1 block text-xs font-medium text-slate-500">
            Or add your own — {PAYMENT_NOTE_MAX} characters at most
          </span>

          <input
            value={paymentNote}
            onChange={(e) =>
              setPaymentNote(e.target.value.slice(0, PAYMENT_NOTE_MAX))
            }
            maxLength={PAYMENT_NOTE_MAX}
            placeholder="Exact change only, tokens at the counter…"
            className={field}
          />
        </label>

        <div className="mt-3 grid grid-cols-3 gap-1.5">
          <Toggle label="📶 Wi-Fi" value={wifi} onChange={setWifi} />
          <Toggle label="🔌 Power" value={power} onChange={setPower} />
          <Toggle label="🅿️ Parking" value={parking} onChange={setParking} />
          <Toggle label="🪑 Seating" value={seating} onChange={setSeating} />
          <Toggle label="🚻 Toilets" value={toilets} onChange={setToilets} />
        </div>

        {isCoffee && (
          <>
            <p className="mt-4 mb-2 text-sm font-semibold text-slate-700">
              Beans and milk
            </p>

            <div className="grid grid-cols-2 gap-1.5">
              <Toggle
                label="🫘 Beans for sale"
                value={sellsBeans}
                onChange={setSellsBeans}
              />

              <Toggle
                label="🔥 Has a roaster"
                value={hasRoaster}
                onChange={setHasRoaster}
              />

              <Toggle
                label="🌙 Decaf"
                value={hasDecaf}
                onChange={setHasDecaf}
              />

              <Toggle
                label="💻 Laptop-friendly"
                value={laptop}
                onChange={setLaptop}
              />
            </div>

            <div className="mt-2 flex flex-wrap gap-1.5">
              {MILKS.map((option) => {
                const on = milks.includes(option.key);

                return (
                  <button
                    key={option.key}
                    type="button"
                    aria-pressed={on}
                    onClick={() => toggleIn(milks, setMilks, option.key)}
                    className={`min-h-9 rounded-lg border px-2.5 text-xs font-semibold transition ${
                      on
                        ? "border-slate-900 bg-slate-900 text-white"
                        : "border-slate-300 bg-white text-slate-700"
                    }`}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>

            <div className="mt-2 flex flex-wrap gap-1.5">
              {AMBIENCE.map((option) => {
                const on = ambience.includes(option.key);

                return (
                  <button
                    key={option.key}
                    type="button"
                    aria-pressed={on}
                    onClick={() => toggleIn(ambience, setAmbience, option.key)}
                    className={`min-h-9 rounded-lg border px-2.5 text-xs font-semibold transition ${
                      on
                        ? "border-slate-900 bg-slate-900 text-white"
                        : "border-slate-300 bg-white text-slate-700"
                    }`}
                  >
                    {option.emoji} {option.label}
                  </button>
                );
              })}
            </div>

            <div className="mt-2 flex flex-wrap gap-1.5">
              {FOOD.map((option) => {
                const on = food.includes(option.key);

                return (
                  <button
                    key={option.key}
                    type="button"
                    aria-pressed={on}
                    onClick={() => toggleIn(food, setFood, option.key)}
                    className={`min-h-9 rounded-lg border px-2.5 text-xs font-semibold transition ${
                      on
                        ? "border-slate-900 bg-slate-900 text-white"
                        : "border-slate-300 bg-white text-slate-700"
                    }`}
                  >
                    {option.emoji} {option.label}
                  </button>
                );
              })}
            </div>

            {hasRoaster && (
              <label className="mt-2 block">
                <span className="mb-1 block text-xs font-medium text-slate-500">
                  Roaster name
                </span>

                <input
                  value={roaster}
                  onChange={(e) => setRoaster(e.target.value)}
                  className={field}
                />
              </label>
            )}
          </>
        )}

        {!isCoffee && (
          <>
            <p className="mt-4 mb-2 text-sm font-semibold text-slate-700">
              Machines
            </p>

            <div className="grid grid-cols-3 gap-1.5">
              {MACHINE_SIZES.map((option) => {
                const on = machineSizes.includes(option.key);

                return (
                  <button
                    key={option.key}
                    type="button"
                    aria-pressed={on}
                    onClick={() =>
                      toggleIn(machineSizes, setMachineSizes, option.key)
                    }
                    className={`min-h-9 rounded-lg border px-2.5 text-xs font-semibold transition ${
                      on
                        ? "border-slate-900 bg-slate-900 text-white"
                        : "border-slate-300 bg-white text-slate-700"
                    }`}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>

            <p className="mt-4 mb-2 text-sm font-semibold text-slate-700">
              Timing
            </p>

            <div className="grid grid-cols-2 gap-1.5">
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-slate-500">
                  Wash takes
                </span>

                <select
                  value={washMinutes}
                  onChange={(e) => setWashMinutes(e.target.value)}
                  className={field}
                >
                  <option value="">—</option>

                  {DURATIONS.map((d) => (
                    <option key={d} value={d}>
                      {d} min
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="mb-1 block text-xs font-medium text-slate-500">
                  Dryer takes
                </span>

                <select
                  value={dryerMinutes}
                  onChange={(e) => setDryerMinutes(e.target.value)}
                  className={field}
                >
                  <option value="">—</option>

                  {DURATIONS.map((d) => (
                    <option key={d} value={d}>
                      {d} min
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="mt-2">
              <Toggle
                label="🕛 Open 24 hours"
                value={open24h}
                onChange={setOpen24h}
              />
            </div>

            {!open24h && (
              <label className="mt-2 block">
                <span className="mb-1 block text-xs font-medium text-slate-500">
                  Last entry
                </span>

                <select
                  value={lastEntry}
                  onChange={(e) => setLastEntry(e.target.value)}
                  className={field}
                >
                  <option value="">—</option>

                  {ENTRY_TIMES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </label>
            )}

            <div className="mt-2 grid grid-cols-2 gap-1.5">
              <Toggle
                label="🧼 Detergent included"
                value={detergentIncluded}
                onChange={setDetergentIncluded}
              />

              <Toggle
                label="🛒 Can buy it there"
                value={detergentPurchasable}
                onChange={setDetergentPurchasable}
              />
            </div>
          </>
        )}
      </Card>

      <Card>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-slate-500">
            Anything useful to know?
          </span>

          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            className={field}
          />
        </label>

        <label className="mt-3 block">
          <span className="mb-1 block text-xs font-medium text-slate-500">
            Website
          </span>

          <input
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
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

export default UpdateForm;
