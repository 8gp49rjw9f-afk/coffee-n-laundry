"use client";

import { useState, useTransition } from "react";

import { Button, Card, ErrorBanner } from "@/components/ui";
import { IdentityBlock } from "@/components/place/IdentityBlock";

import { updatePlace } from "@/app/actions/updatePlace";

import { AMBIENCE, COFFEE_KINDS, FOOD } from "@/lib/coffee";
import { CURRENCIES } from "@/lib/currencies";

import type { PlaceType } from "@/lib/types";

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
    coffee: {
      coffee_kind: string;
      roaster: string | null;
      sells_beans: boolean | null;
      has_roaster: boolean | null;
      has_decaf: boolean | null;
      has_oat_milk: boolean | null;
      has_soy_milk: boolean | null;
      has_coconut_milk: boolean | null;
      has_almond_milk: boolean | null;
      laptop_friendly: boolean | null;
      ambience: string[];
      food: string[];
    } | null;
    laundry: {
      machine_sizes: string[];
      detergent_included: boolean | null;
      detergent_purchasable: boolean | null;
      open_24h: boolean;
      wash_minutes: number | null;
      dryer_minutes: number | null;
      last_entry_minutes: number | null;
    } | null;
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
  const [hasOat, setHasOat] = useState(Boolean(place.coffee?.has_oat_milk));
  const [hasSoy, setHasSoy] = useState(Boolean(place.coffee?.has_soy_milk));
  const [hasCoconut, setHasCoconut] = useState(
    Boolean(place.coffee?.has_coconut_milk)
  );
  const [hasAlmond, setHasAlmond] = useState(
    Boolean(place.coffee?.has_almond_milk)
  );
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
      formData.set("has_oat_milk", String(hasOat));
      formData.set("has_soy_milk", String(hasSoy));
      formData.set("has_coconut_milk", String(hasCoconut));
      formData.set("has_almond_milk", String(hasAlmond));
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

          <div className="mt-4 grid grid-cols-3 gap-2">
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

          <label className="mt-3 block">
            <span className="mb-1.5 block text-sm font-semibold text-slate-700">
              Currency
            </span>

            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              className={selectClass}
            >
              {CURRENCIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.country} — {c.code}
                </option>
              ))}
            </select>
          </label>

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

            <Toggle
              label="🌙 Decaf"
              value={hasDecaf}
              onChange={setHasDecaf}
            />
            <Toggle label="🌾 Oat milk" value={hasOat} onChange={setHasOat} />
            <Toggle label="🛫 Soy milk" value={hasSoy} onChange={setHasSoy} />
            <Toggle
              label="🥥 Coconut milk"
              value={hasCoconut}
              onChange={setHasCoconut}
            />
            <Toggle
              label="🌰 Almond milk"
              value={hasAlmond}
              onChange={setHasAlmond}
            />
            <Toggle
              label="💻 Laptop-friendly"
              value={laptop}
              onChange={setLaptop}
            />
          </div>

          {hasRoaster && (
            <label className="mt-3 block">
              <span className="mb-1.5 block text-sm font-semibold text-slate-700">
                Roaster name
              </span>

              <input
                value={roasterName}
                onChange={(e) => setRoasterName(e.target.value)}
                className={selectClass}
              />
            </label>
          )}

          <div className="mt-4 flex flex-wrap gap-2">
            {AMBIENCE.map((option) => (
              <button
                key={option.key}
                type="button"
                onClick={() => toggleIn(ambience, setAmbience, option.key)}
                aria-pressed={ambience.includes(option.key)}
                className={`min-h-10 rounded-full border px-3 text-sm font-semibold transition ${
                  ambience.includes(option.key)
                    ? "border-slate-900 bg-slate-900 text-white"
                    : "border-slate-300 bg-white text-slate-700"
                }`}
              >
                {option.emoji} {option.label}
              </button>
            ))}
          </div>

          <div className="mt-4">
            <p className="mb-2 text-sm font-semibold text-slate-700">Food</p>

            <div className="flex flex-wrap gap-2">
              {FOOD.map((option) => (
                <button
                  key={option.key}
                  type="button"
                  onClick={() => toggleIn(food, setFood, option.key)}
                  aria-pressed={food.includes(option.key)}
                  className={`min-h-10 rounded-full border px-3 text-sm font-semibold transition ${
                    food.includes(option.key)
                      ? "border-slate-900 bg-slate-900 text-white"
                      : "border-slate-300 bg-white text-slate-700"
                  }`}
                >
                  {option.emoji} {option.label}
                </button>
              ))}
            </div>
          </div>
        </Card>
      ) : (
        <Card>
          <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-500">
            The machines
          </h2>

          <div className="grid grid-cols-2 gap-2">
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

          <label className="mt-3 block">
            <span className="mb-1.5 block text-sm font-semibold text-slate-700">
              Currency
            </span>

            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              className={selectClass}
            >
              {CURRENCIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.country} — {c.code}
                </option>
              ))}
            </select>
          </label>

          <div className="mt-4 grid grid-cols-3 gap-2">
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
                {DURATIONS.map((minutes) => (
                  <option key={minutes} value={minutes}>
                    {minutes}
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
                {DURATIONS.map((minutes) => (
                  <option key={minutes} value={minutes}>
                    {minutes}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="mb-1.5 block text-sm font-semibold text-slate-700">
                Last entry
              </span>

              <select
                value={lastEntry}
                onChange={(e) => setLastEntry(e.target.value)}
                disabled={open24h}
                className={`${selectClass} disabled:opacity-50`}
              >
                <option value="">—</option>
                {ENTRY_TIMES.map((time) => (
                  <option key={time.value} value={time.value}>
                    {time.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2">
            <Toggle label="🕛 Open 24h" value={open24h} onChange={setOpen24h} />

            <Toggle
              label="🧴 Detergent included"
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
            <label className="mt-3 block">
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

          <div className="mt-4 flex flex-wrap gap-2">
            {MACHINE_SIZES.map((option) => (
              <button
                key={option.key}
                type="button"
                onClick={() => toggleIn(machineSizes, setMachineSizes, option.key)}
                aria-pressed={machineSizes.includes(option.key)}
                className={`min-h-10 rounded-full border px-3 text-sm font-semibold transition ${
                  machineSizes.includes(option.key)
                    ? "border-slate-900 bg-slate-900 text-white"
                    : "border-slate-300 bg-white text-slate-700"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </Card>
      )}

      <Card>
        <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-500">
          How you pay
        </h2>

        <div className="flex flex-wrap gap-2">
          {PAYMENT_KEYS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => toggleIn(payments, setPayments, option.value)}
              aria-pressed={payments.includes(option.value)}
              className={`min-h-10 rounded-full border px-3 text-sm font-semibold transition ${
                payments.includes(option.value)
                  ? "border-slate-900 bg-slate-900 text-white"
                  : "border-slate-300 bg-white text-slate-700"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </Card>

      <Card>
        <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-500">
          Good to know
        </h2>

        <div className="grid grid-cols-2 gap-2">
          <Toggle label="📶 Wi-Fi" value={wifi} onChange={setWifi} />
          <Toggle label="🔌 Power sockets" value={power} onChange={setPower} />
          <Toggle label="🅿️ Parking" value={parking} onChange={setParking} />
          <Toggle label="🪑 Seating" value={seating} onChange={setSeating} />
          <Toggle label="🚻 Toilets" value={toilets} onChange={setToilets} />
        </div>

        <label className="mt-4 block">
          <span className="mb-1.5 block text-sm font-semibold text-slate-700">
            Website
          </span>

          <input
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
            placeholder="https://…"
            className={selectClass}
          />
        </label>

        <label className="mt-3 block">
          <span className="mb-1.5 block text-sm font-semibold text-slate-700">
            Anything else worth knowing
          </span>

          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className={selectClass}
          />
        </label>
      </Card>

      <Card>
        <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-500">
          Why?
        </h2>

        <label className="block">
          <span className="mb-1.5 block text-sm font-semibold text-slate-700">
            Leave a note <span className="font-normal text-slate-400">(optional)</span>
          </span>

          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={2}
            placeholder="Prices went up in June, the dryer on the left is broken…"
            className={selectClass}
          />
        </label>
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

export default UpdateForm;
