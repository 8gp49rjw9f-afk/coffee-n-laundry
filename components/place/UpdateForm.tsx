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

const PAYMENT_KEYS = [
  { value: "cash", label: "💵 Cash" },
  { value: "coins", label: "🪙 Coins" },
  { value: "card", label: "💳 Card" },
  { value: "visa", label: "💳 Visa" },
  { value: "mastercard", label: "💳 Mastercard" },
  { value: "amex", label: "💳 American Express" },
  { value: "major_cards", label: "💳 All major credit cards" },
  { value: "debit", label: "🏧 Debit" },
  { value: "contactless", label: "📱 Contactless" },
  { value: "apple_pay", label: "🍎 Apple Pay" },
  { value: "google_pay", label: "🟢 Google Pay" },
  { value: "laundry_card", label: "🎟️ Laundry card" },
  { value: "other", label: "➖ Other" },
];

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
      className={`min-h-11 rounded-xl border text-sm font-semibold transition ${
        value
          ? "border-slate-900 bg-slate-900 text-white"
          : "border-slate-300 bg-white text-slate-700"
      }`}
    >
      {label}
    </button>
  );
}

function CurrencyPicker({
  value,
  onChange,
  selectClass,
}: {
  value: string;
  onChange: (next: string) => void;
  selectClass: string;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-semibold text-slate-700">
        Currency
      </span>

      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={selectClass}
      >
        {CURRENCIES.map((c) => (
          <option key={c.code} value={c.code}>
            {c.country} — {c.code}
          </option>
        ))}
      </select>
    </label>
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

    /*
     * The two detail rows come from lib/types.ts, NOT from a second
     * copy written out here.
     *
     * This file used to spell out both shapes inline. The inline copy
     * and the real interface disagreed the moment a column was added:
     * `has_milk` existed in one and not the other, and the build failed
     * on a type that had nothing to do with the change. One declaration,
     * imported, is the only version that cannot drift.
     */
    coffee: CoffeeDetails | null;
    laundry: LaundryDetails | null;
    prices: { kind: string; amount: number; currency: string }[];
  };
  canEdit: boolean;
  blockedMessage: string;
  isOwner: boolean;
}) {
  const isCoffee = place.place_type === "coffee";

  const priceOf = (kind: string) =>
    place.prices.find((p) => p.kind === kind)?.amount?.toString() ?? "";

  /* The currency comes from the place's own prices: a place with none
     has no currency yet, and the picker opens on the site default. */
  const [currency, setCurrency] = useState(place.prices[0]?.currency ?? "SGD");

  /* ---------- state, seeded from the place ---------- */

  const [website, setWebsite] = useState(place.website ?? "");
  const [description, setDescription] = useState(place.description ?? "");
  const [comment, setComment] = useState("");

  /* owner-only: the place's identity */
  const [name, setName] = useState(place.name);
  const [address, setAddress] = useState(place.address ?? "");
  const [latitude, setLatitude] = useState(place.latitude);
  const [longitude, setLongitude] = useState(place.longitude);

  const [payments, setPayments] = useState<string[]>(
    place.accepted_payments ?? []
  );

  const [wifi, setWifi] = useState(Boolean(place.has_wifi));
  const [power, setPower] = useState(Boolean(place.has_power));
  const [parking, setParking] = useState(Boolean(place.has_parking));
  const [seating, setSeating] = useState(Boolean(place.has_seating));
  const [toilets, setToilets] = useState(Boolean(place.has_toilets));

  /* coffee */
  const [coffeeKind, setCoffeeKind] = useState(
    place.coffee?.coffee_kind ?? "regular"
  );
  const [espressoPrice, setEspressoPrice] = useState(priceOf("espresso"));
  const [filterPrice, setFilterPrice] = useState(priceOf("filter"));
  const [flatWhitePrice, setFlatWhitePrice] = useState(priceOf("flat_white"));

  const [sellsBeans, setSellsBeans] = useState(
    Boolean(place.coffee?.sells_beans)
  );
  const [hasRoaster, setHasRoaster] = useState(
    Boolean(place.coffee?.has_roaster)
  );
  const [roasterName, setRoasterName] = useState(place.coffee?.roaster ?? "");

  const [hasDecaf, setHasDecaf] = useState(Boolean(place.coffee?.has_decaf));

  /*
   * The milks as a set, seeded from the five columns. The columns are
   * unchanged and still written one by one on save — only the asking
   * changed, so a café with three plant milks answers once instead of
   * five times.
   */
  const [milks, setMilks] = useState<string[]>(() => {
    const held: string[] = [];

    if (place.coffee?.has_milk) held.push("milk");
    if (place.coffee?.has_oat_milk) held.push("oat_milk");
    if (place.coffee?.has_soy_milk) held.push("soy_milk");
    if (place.coffee?.has_coconut_milk) held.push("coconut_milk");
    if (place.coffee?.has_almond_milk) held.push("almond_milk");

    return held;
  });

  const [laptop, setLaptop] = useState(Boolean(place.coffee?.laptop_friendly));

  const [ambience, setAmbience] = useState<string[]>(
    place.coffee?.ambience ?? []
  );

  const [food, setFood] = useState<string[]>(place.coffee?.food ?? []);

  /* laundry */
  const [washAmount, setWashAmount] = useState(priceOf("wash"));
  const [dryerAmount, setDryerAmount] = useState(priceOf("dryer"));
  const [washMinutes, setWashMinutes] = useState(
    place.laundry?.wash_minutes?.toString() ?? ""
  );
  const [dryerMinutes, setDryerMinutes] = useState(
    place.laundry?.dryer_minutes?.toString() ?? ""
  );
  const [open24h, setOpen24h] = useState(Boolean(place.laundry?.open_24h));
  const [lastEntry, setLastEntry] = useState(
    place.laundry?.last_entry_minutes?.toString() ?? ""
  );
  const [machineSizes, setMachineSizes] = useState<string[]>(
    place.laundry?.machine_sizes ?? []
  );
  const [detergentIncluded, setDetergentIncluded] = useState(
    Boolean(place.laundry?.detergent_included)
  );
  const [detergentPurchasable, setDetergentPurchasable] = useState(
    Boolean(place.laundry?.detergent_purchasable)
  );
  const [detergentPrice, setDetergentPrice] = useState(priceOf("detergent"));

  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  function toggleIn(list: string[], set: (v: string[]) => void, key: string) {
    set(list.includes(key) ? list.filter((k) => k !== key) : [...list, key]);
  }

  function submit() {
    setError("");

    const formData = new FormData();

    formData.set("place_id", place.id);
    formData.set("website", website.trim());
    formData.set("description", description.trim());
    formData.set("comment", comment.trim());

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

    formData.set("currency", currency);

    payments.forEach((p) => formData.append("payments", p));
    machineSizes.forEach((s) => formData.append("machine_sizes", s));

    if (isCoffee) {
      formData.set("coffee_kind", coffeeKind);
      formData.set("espresso_price", espressoPrice);
      formData.set("filter_price", filterPrice);
      formData.set("flat_white_price", flatWhitePrice);

      formData.set("sells_beans", String(sellsBeans));
      formData.set("has_roaster", String(hasRoaster));
      formData.set("roaster_name", roasterName.trim());

      formData.set("has_decaf", String(hasDecaf));

      /* The set goes back to five columns, because that is the shape
         the table has. */
      formData.set("has_milk", String(milks.includes("milk")));
      formData.set("has_oat_milk", String(milks.includes("oat_milk")));
      formData.set("has_soy_milk", String(milks.includes("soy_milk")));
      formData.set(
        "has_coconut_milk",
        String(milks.includes("coconut_milk"))
      );
      formData.set(
        "has_almond_milk",
        String(milks.includes("almond_milk"))
      );

      formData.set("laptop_friendly", String(laptop));

      ambience.forEach((a) => formData.append("ambience", a));
      food.forEach((f) => formData.append("food", f));
    } else {
      formData.set("wash_amount", washAmount);
      formData.set("dryer_amount", dryerAmount);
      formData.set("wash_minutes", washMinutes);
      formData.set("dryer_minutes", dryerMinutes);
      formData.set("open_24h", String(open24h));
      formData.set("last_entry_minutes", open24h ? "" : lastEntry);
      formData.set("detergent_included", String(detergentIncluded));
      formData.set("detergent_purchasable", String(detergentPurchasable));
      formData.set(
        "detergent_price",
        detergentIncluded ? "" : detergentPrice
      );
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

  /* ---------- the day is used up ---------- */

  if (!canEdit) {
    return (
      <Card>
        <p className="text-base font-semibold text-slate-900">
          {blockedMessage}
        </p>

        <p className="mt-2 text-sm text-slate-600">
          One coffee shop and one laundromat per day, per person — that is what
          keeps the prices believable. What is on the page right now was last
          written by someone who had the same limit.
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

  const selectClass =
    "w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-base outline-none focus:border-slate-500";

  return (
    <div className="space-y-4">
      {/* The identity — name, address, pin — belongs to the creator
          alone; everyone else sees it read-only. The server enforces
          the same rule, so a stranger's form cannot slip past it. */}

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
            Name, address and position are fixed. If this place moved or changed
            name, report it instead.
          </p>

          <p className="text-lg font-bold text-slate-900">{place.name}</p>

          <p className="mt-1 text-sm text-slate-600">
            {[place.address, place.city, place.country].filter(Boolean).join(" · ") ||
              "No address recorded"}
          </p>

          <p className="mt-1 text-xs text-slate-400">
            {place.latitude.toFixed(5)}, {place.longitude.toFixed(5)}
          </p>
        </Card>
      )}

      {isCoffee ? (
        <Card>
          <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-500">
            The coffee
          </h2>

          <div className="grid grid-cols-3 gap-2">
            {COFFEE_KINDS.map((option) => (
              <button
                key={option.key}
                type="button"
                onClick={() => setCoffeeKind(option.key)}
                className={`min-h-11 rounded-xl border text-sm font-bold transition ${
                  coffeeKind === option.key
                    ? "border-[#6f4e37] bg-[#6f4e37] text-white"
                    : "border-slate-300 bg-white text-slate-700"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>

          <div className="mt-4">
            <CurrencyPicker
              value={currency}
              onChange={setCurrency}
              selectClass={selectClass}
            />
          </div>

          <div className="mt-3 grid grid-cols-3 gap-2">
            <label className="block">
              <span className="mb-1.5 block text-sm font-semibold text-slate-700">
                Espresso
              </span>

              <input
                value={espressoPrice}
                onChange={(e) => setEspressoPrice(e.target.value)}
                inputMode="decimal"
                className={selectClass}
              />
            </label>

            <label className="block">
              <span className="mb-1.5 block text-sm font-semibold text-slate-700">
                Filter
              </span>

              <input
                value={filterPrice}
                onChange={(e) => setFilterPrice(e.target.value)}
                inputMode="decimal"
                className={selectClass}
              />
            </label>

            <label className="block">
              <span className="mb-1.5 block text-sm font-semibold text-slate-700">
                Flat white
              </span>

              <input
                value={flatWhitePrice}
                onChange={(e) => setFlatWhitePrice(e.target.value)}
                inputMode="decimal"
                className={selectClass}
              />
            </label>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2">
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

            <Toggle label="🌙 Decaf" value={hasDecaf} onChange={setHasDecaf} />
            <Toggle
              label="💻 Laptop-friendly"
              value={laptop}
              onChange={setLaptop}
            />
          </div>

          {/* One question, one list. Same five columns underneath —
              only the asking changed. */}
          <p className="mt-4 mb-2 text-sm font-semibold text-slate-700">
            Which milks?
          </p>

          <div className="flex flex-wrap gap-2">
            {MILKS.map((option) => {
              const on = milks.includes(option.key);

              return (
                <button
                  key={option.key}
                  type="button"
                  aria-pressed={on}
                  onClick={() => toggleIn(milks, setMilks, option.key)}
                  className={`min-h-10 rounded-full border px-3 text-sm font-semibold transition ${
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

          {hasRoaster && (
            <label className="mt-3 block">
              <span className="mb-1.5 block text-sm font-semibold text-slate-700">
                Roaster name
              </span>

              <input
                value={roasterName}
                onChange={(e) => setRoasterName(e.target.value)}
                placeholder="Tim Wendelboe"
                className={selectClass}
              />
            </label>
          )}
        </Card>
      ) : (
        <Card>
          <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-500">
            The machines
          </h2>

          <div className="mt-4">
            <CurrencyPicker
              value={currency}
              onChange={setCurrency}
              selectClass={selectClass}
            />
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2">
            <label className="block">
              <span className="mb-1.5 block text-sm font-semibold text-slate-700">
                Wash
              </span>

              <input
                value={washAmount}
                onChange={(e) => setWashAmount(e.target.value)}
                inputMode="decimal"
                className={selectClass}
              />
            </label>

            <label className="block">
              <span className="mb-1.5 block text-sm font-semibold text-slate-700">
                Dryer
              </span>

              <input
                value={dryerAmount}
                onChange={(e) => setDryerAmount(e.target.value)}
                inputMode="decimal"
                className={selectClass}
              />
            </label>
          </div>

          <p className="mt-4 mb-2 text-sm font-semibold text-slate-700">
            Machine sizes
          </p>

          <div className="grid grid-cols-3 gap-2">
            {MACHINE_SIZES.map((size) => {
              const on = machineSizes.includes(size.key);

              return (
                <button
                  key={size.key}
                  type="button"
                  aria-pressed={on}
                  onClick={() => toggleIn(machineSizes, setMachineSizes, size.key)}
                  className={`min-h-11 rounded-xl border text-sm font-semibold transition ${
                    on
                      ? "border-slate-900 bg-slate-900 text-white"
                      : "border-slate-300 bg-white text-slate-700"
                  }`}
                >
                  {size.label}
                </button>
              );
            })}
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2">
            <Toggle
              label="🧼 Detergent included"
              value={detergentIncluded}
              onChange={setDetergentIncluded}
            />

            <Toggle
              label="🛒 Detergent for sale"
              value={detergentPurchasable}
              onChange={setDetergentPurchasable}
            />
          </div>

          {detergentPurchasable && !detergentIncluded && (
            <label className="mt-2 block">
              <span className="mb-1.5 block text-sm font-semibold text-slate-700">
                Detergent price
              </span>

              <input
                value={detergentPrice}
                onChange={(e) => setDetergentPrice(e.target.value)}
                inputMode="decimal"
                className={selectClass}
              />
            </label>
          )}

          <div className="mt-3 grid grid-cols-2 gap-2">
            <label className="block">
              <span className="mb-1.5 block text-sm font-semibold text-slate-700">
                Wash minutes
              </span>

              <select
                value={washMinutes}
                onChange={(e) => setWashMinutes(e.target.value)}
                className={selectClass}
              >
                <option value="">—</option>

                {DURATIONS.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="mb-1.5 block text-sm font-semibold text-slate-700">
                Dryer minutes
              </span>

              <select
                value={dryerMinutes}
                onChange={(e) => setDryerMinutes(e.target.value)}
                className={selectClass}
              >
                <option value="">—</option>

                {DURATIONS.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="mt-3">
            <Toggle
              label="🕒 Open 24 hours"
              value={open24h}
              onChange={setOpen24h}
            />
          </div>

          {!open24h && (
            <label className="mt-2 block">
              <span className="mb-1.5 block text-sm font-semibold text-slate-700">
                Last entry
              </span>

              <select
                value={lastEntry}
                onChange={(e) => setLastEntry(e.target.value)}
                className={selectClass}
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
        </Card>
      )}

      <Card>
        <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-500">
          Anything else
        </h2>

        <div className="space-y-3">
          <label className="block">
            <span className="mb-1.5 block text-sm font-semibold text-slate-700">
              Website
            </span>

            <input
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              className={selectClass}
              placeholder="https://"
            />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-sm font-semibold text-slate-700">
              Notes
            </span>

            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className={selectClass}
              placeholder="Anything a visitor should know"
            />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-sm font-semibold text-slate-700">
              Why did it change?
            </span>

            <input
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              className={selectClass}
              placeholder="Optional, but it helps the next person"
            />
          </label>
        </div>

        <p className="mt-3 mb-2 text-sm font-semibold text-slate-700">
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
                onClick={() => toggleIn(payments, setPayments, option.value)}
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
              Ambience
            </p>

            <div className="flex flex-wrap gap-1.5">
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
                    {option.label}
                  </button>
                );
              })}
            </div>

            <p className="mt-4 mb-2 text-sm font-semibold text-slate-700">
              Food
            </p>

            <div className="flex flex-wrap gap-1.5">
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
                    {option.label}
                  </button>
                );
              })}
            </div>
          </>
        )}
      </Card>

      {error && <ErrorBanner message={error} />}

      <Button onClick={submit} disabled={pending} className="w-full">
        {pending ? "Saving…" : "Save changes"}
      </Button>

      <p className="pb-6 text-center text-xs text-slate-600">
        Everything you correct is logged, with your name on it.
      </p>
    </div>
  );
}
