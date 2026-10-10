"use client";

import { useState } from "react";
import imageCompression from "browser-image-compression";

import { Button, Card, ErrorBanner } from "@/components/ui";
import { LocationPicker } from "@/components/location/LocationPicker";
import { SquareCrop } from "@/components/place/SquareCrop";

import { matchesChain } from "@/lib/chainFlags";
import { AMBIENCE, COFFEE_KINDS, FOOD } from "@/lib/coffee";
import { CURRENCIES } from "@/lib/currencies";

import type { PlaceType } from "@/lib/types";

/* Photos are deliberately crushed: we care about being able to
   recognise a machine and read a price list, not about the image.
   The input accepts 10MB because that is what a phone camera sends;
   compression brings it down to roughly 400KB before upload.

   Order matters: crop first, then compress. Cropping a photo that
   has already been through a lossy pass throws away pixels twice,
   and the crop is the step that decides what the photo even shows. */

const PHOTO_OPTIONS = {
  maxSizeMB: 0.4,
  maxWidthOrHeight: 1400,
  useWebWorker: true,
};

const MAX_INPUT_MB = 10;

/* Duration steps of five minutes, from 5 to 90. A short cycle exists
   and so does a long one; the old list started at 15 and skipped 55. */
const DURATIONS = Array.from({ length: 18 }, (_, i) => (i + 1) * 5);

/* Half-hour steps across the whole day, so 22:30 is possible and
   00:00 is not a dead end. */
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

function SectionTitle({ title, note }: { title: string; note?: string }) {
  return (
    <div className="flex items-baseline gap-2 pt-2">
      <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">
        {title}
      </h2>

      {note && <span className="text-xs text-slate-400">{note}</span>}
    </div>
  );
}

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

export function NewPlaceForm({
  submit,
  currencyHint = "SGD",
  chainPatterns = [],
}: {
  submit: (formData: FormData) => Promise<void>;
  currencyHint?: string;
  chainPatterns?: string[];
}) {
  const [step, setStep] = useState<"choose" | "notice" | "form">("choose");
  const [type, setType] = useState<PlaceType | null>(null);

  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);

  const [coffeeKind, setCoffeeKind] = useState("regular");
  const [washAmount, setWashAmount] = useState("");
  const [dryerAmount, setDryerAmount] = useState("");
  const [currency, setCurrency] = useState(currencyHint);

  const [espressoPrice, setEspressoPrice] = useState("");
  const [filterPrice, setFilterPrice] = useState("");
  const [flatWhitePrice, setFlatWhitePrice] = useState("");

  const [sellsBeans, setSellsBeans] = useState(false);
  const [hasRoaster, setHasRoaster] = useState(false);
  const [roasterName, setRoasterName] = useState("");

  const [hasMilk, setHasMilk] = useState(false);
  const [hasOat, setHasOat] = useState(false);
  const [hasSoy, setHasSoy] = useState(false);
  const [hasCoconut, setHasCoconut] = useState(false);
  const [hasAlmond, setHasAlmond] = useState(false);
  const [hasDecaf, setHasDecaf] = useState(false);
  const [laptop, setLaptop] = useState(false);

  const [ambience, setAmbience] = useState<string[]>([]);
  const [food, setFood] = useState<string[]>([]);

  const [machineSizes, setMachineSizes] = useState<string[]>([]);
  const [detergentIncluded, setDetergentIncluded] = useState(false);
  const [detergentPurchasable, setDetergentPurchasable] = useState(false);
  const [detergentPrice, setDetergentPrice] = useState("");
  const [open24h, setOpen24h] = useState(false);
  const [washMinutes, setWashMinutes] = useState("");
  const [dryerMinutes, setDryerMinutes] = useState("");
  const [lastEntry, setLastEntry] = useState("");

  const [payments, setPayments] = useState<string[]>([]);

  const [wifi, setWifi] = useState(false);
  const [power, setPower] = useState(false);
  const [parking, setParking] = useState(false);
  const [seating, setSeating] = useState(false);
  const [toilets, setToilets] = useState(false);

  const [description, setDescription] = useState("");
  const [website, setWebsite] = useState("");

  const [photos, setPhotos] = useState<File[]>([]);
  const [compressing, setCompressing] = useState(false);

  const [cropping, setCropping] = useState<File | null>(null);
  const [queue, setQueue] = useState<File[]>([]);

  const [chainConfirmed, setChainConfirmed] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const hasPosition = latitude !== null && longitude !== null;
  const canSubmit = name.trim().length > 0 && hasPosition && !loading;

  const chainHit = matchesChain(name, chainPatterns);

  function handlePhotos(files: FileList | null) {
    if (!files || files.length === 0) return;

    setError("");

    const picked = Array.from(files).slice(0, 5);

    const tooBig = picked.find((file) => file.size > MAX_INPUT_MB * 1_000_000);

    if (tooBig) {
      setError(`One photo is larger than ${MAX_INPUT_MB} MB.`);
      return;
    }

    setQueue(picked.slice(1));
    setCropping(picked[0]);
  }

  async function acceptCropped(cropped: File) {
    setCropping(null);
    setCompressing(true);

    try {
      const result = await imageCompression(cropped, PHOTO_OPTIONS);

      const compressed = new File(
        [result],
        cropped.name.replace(/\.[^.]+$/, "") + ".jpg",
        { type: "image/jpeg" }
      );

      setPhotos((current) => [...current, compressed].slice(0, 5));
    } catch {
      setError("Could not process that photo. Try a smaller one.");
    }

    setCompressing(false);

    if (queue.length > 0) {
      setCropping(queue[0]);
      setQueue((current) => current.slice(1));
    }
  }

  function toggleIn(list: string[], set: (v: string[]) => void, key: string) {
    set(list.includes(key) ? list.filter((k) => k !== key) : [...list, key]);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setLoading(true);
    setError("");

    try {
      const formData = new FormData();

      formData.set("place_type", type ?? "coffee");
      formData.set("name", name.trim());
      formData.set("address", address.trim());
      formData.set("latitude", String(latitude));
      formData.set("longitude", String(longitude));
      formData.set("description", description.trim());
      formData.set("website", website.trim());

      formData.set("has_wifi", String(wifi));
      formData.set("has_power", String(power));
      formData.set("has_parking", String(parking));
      formData.set("has_seating", String(seating));
      formData.set("has_toilets", String(toilets));

      formData.set("currency", currency);

      payments.forEach((p) => formData.append("payments", p));
      machineSizes.forEach((s) => formData.append("machine_sizes", s));
      photos.forEach((p) => formData.append("photo", p));

      if (chainHit) formData.set("chain_flagged", chainHit);

      if (type === "coffee") {
        formData.set("coffee_kind", coffeeKind);

        formData.set("espresso_price", espressoPrice);
        formData.set("filter_price", filterPrice);
        formData.set("flat_white_price", flatWhitePrice);

        formData.set("sells_beans", String(sellsBeans));
        formData.set("has_roaster", String(hasRoaster));
        formData.set("roaster_name", roasterName.trim());

        formData.set("has_milk", String(hasMilk));
        formData.set("has_oat_milk", String(hasOat));
        formData.set("has_soy_milk", String(hasSoy));
        formData.set("has_coconut_milk", String(hasCoconut));
        formData.set("has_almond_milk", String(hasAlmond));
        formData.set("has_decaf", String(hasDecaf));
        formData.set("laptop_friendly", String(laptop));

        ambience.forEach((a) => formData.append("ambience", a));
        food.forEach((f) => formData.append("food", f));
      }

      if (type === "laundry") {
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

      await submit(formData);
    } catch (err) {
      setError(
        err instanceof Error && err.message
          ? err.message
          : "Something went wrong. Try again."
      );

      setLoading(false);
    }
  }

  if (cropping) {
    return (
      <SquareCrop
        file={cropping}
        onCancel={() => {
          setCropping(null);
          setQueue([]);
        }}
        onDone={acceptCropped}
      />
    );
  }

  if (step === "choose") {
    return (
      <div className="grid gap-3 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => {
            setType("coffee");
            setStep("notice");
          }}
          className="flex flex-col items-center rounded-2xl border-2 border-slate-200 bg-white p-8 transition hover:border-[#6f4e37] hover:shadow-lg"
        >
          <span className="text-5xl">☕</span>
          <span className="mt-3 text-lg font-bold text-slate-900">Coffee</span>
          <span className="mt-1 text-sm text-slate-500">
            A place worth stopping for
          </span>
        </button>

        <button
          type="button"
          onClick={() => {
            setType("laundry");
            setStep("notice");
          }}
          className="flex flex-col items-center rounded-2xl border-2 border-slate-200 bg-white p-8 transition hover:border-sky-600 hover:shadow-lg"
        >
          <span className="text-5xl">🧺</span>
          <span className="mt-3 text-lg font-bold text-slate-900">Laundry</span>
          <span className="mt-1 text-sm text-slate-500">
            Somewhere to wash and dry
          </span>
        </button>
      </div>
    );
  }

  if (step === "notice") {
    const isCoffee = type === "coffee";

    return (
      <div className="space-y-4">
        <button
          type="button"
          onClick={() => setStep("choose")}
          className="text-sm font-semibold text-slate-500 hover:text-slate-900"
        >
          ← Choose again
        </button>

        <Card>
          <div className="text-center text-4xl">{isCoffee ? "☕" : "🧺"}</div>

          <h2 className="mt-3 text-center text-lg font-bold text-slate-900">
            {isCoffee ? "Coffee shops" : "Laundromats"}
          </h2>

          <p className="mt-3 text-center text-base leading-relaxed text-slate-700">
            {isCoffee
              ? "No big brands. Only a proper barista or a respected coffee shop."
              : "Laundromats only. No dry cleaners or laundry services."}
          </p>

          {isCoffee && (
            <p className="mt-2 text-center text-sm leading-relaxed text-slate-500">
              Starbucks and Tim Hortons are not barista.
            </p>
          )}

          <p className="mt-4 text-center text-xs text-slate-400">
            If a place does not fit, it will be reported and taken off the map.
          </p>

          <Button onClick={() => setStep("form")} className="mt-5 w-full">
            I accept
          </Button>
        </Card>
      </div>
    );
  }

  const isCoffee = type === "coffee";

  const selectClass =
    "w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-base outline-none focus:border-slate-500";

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <button
        type="button"
        onClick={() => setStep("choose")}
        className="text-sm font-semibold text-slate-500 hover:text-slate-900"
      >
        ← {isCoffee ? "☕ Coffee" : "🧺 Laundry"}
      </button>

      <Card>
        <label className="block">
          <span className="mb-1.5 block text-sm font-semibold text-slate-700">
            Name
          </span>

          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={isCoffee ? "Joe's Coffee" : "Downtown Laundry"}
            className="w-full rounded-xl border border-slate-300 px-4 py-3 text-base outline-none focus:border-slate-500"
            required
          />
        </label>

        <label className="mt-4 block">
          <span className="mb-1.5 block text-sm font-semibold text-slate-700">
            Address
          </span>

          <input
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="123 Main Street"
            className="w-full rounded-xl border border-slate-300 px-4 py-3 text-base outline-none focus:border-slate-500"
          />
        </label>
      </Card>

      <Card>
        <h3 className="mb-3 text-sm font-semibold text-slate-700">
          Where is it?
        </h3>

        <LocationPicker
          onPicked={(lat, lng) => {
            setLatitude(lat);
            setLongitude(lng);
          }}
        />
      </Card>

      {isCoffee && (
        <Card>
          <h3 className="mb-3 text-sm font-semibold text-slate-700">
            Coffee type
          </h3>

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
        </Card>
      )}

      {isCoffee && (
        <Card>
          <h3 className="mb-3 text-sm font-semibold text-slate-700">Food</h3>

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
        </Card>
      )}

      {isCoffee && (
        <Card>
          <h3 className="mb-3 text-sm font-semibold text-slate-700">
            Beans and milk
          </h3>

          <div className="grid grid-cols-2 gap-2">
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
            <Toggle label="🥛 Cow milk" value={hasMilk} onChange={setHasMilk} />
            <Toggle label="🌾 Oat milk" value={hasOat} onChange={setHasOat} />
            <Toggle label="🫘 Soy milk" value={hasSoy} onChange={setHasSoy} />
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
                placeholder="Tim Wendelboe"
                className={selectClass}
              />
            </label>
          )}
        </Card>
      )}

      {isCoffee && (
        <Card>
          <h3 className="mb-3 text-sm font-semibold text-slate-700">
            Ambience
          </h3>

          <div className="flex flex-wrap gap-2">
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
        </Card>
      )}

      {!isCoffee && (
        <Card>
          <h3 className="mb-3 text-sm font-semibold text-slate-700">
            Machines
          </h3>

          <div className="grid grid-cols-3 gap-2">
            {MACHINE_SIZES.map((option) => (
              <button
                key={option.key}
                type="button"
                onClick={() => toggleIn(machineSizes, setMachineSizes, option.key)}
                aria-pressed={machineSizes.includes(option.key)}
                className={`min-h-11 rounded-xl border text-sm font-bold transition ${
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

      {!isCoffee && (
        <Card>
          <h3 className="mb-3 text-sm font-semibold text-slate-700">
            Timing
          </h3>

          <div className="grid grid-cols-2 gap-2">
            <label className="block">
              <span className="mb-1.5 block text-sm font-semibold text-slate-700">
                Wash takes
              </span>

              <select
                value={washMinutes}
                onChange={(e) => setWashMinutes(e.target.value)}
                className={selectClass}
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
              <span className="mb-1.5 block text-sm font-semibold text-slate-700">
                Dryer takes
              </span>

              <select
                value={dryerMinutes}
                onChange={(e) => setDryerMinutes(e.target.value)}
                className={selectClass}
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

          <div className="mt-3">
            <Toggle
              label="🕛 Open 24 hours"
              value={open24h}
              onChange={setOpen24h}
            />
          </div>

          {!open24h && (
            <label className="mt-3 block">
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

      {!isCoffee && (
        <Card>
          <h3 className="mb-3 text-sm font-semibold text-slate-700">
            Detergent
          </h3>

          <div className="grid grid-cols-2 gap-2">
            <Toggle
              label="🧼 Included in the price"
              value={detergentIncluded}
              onChange={setDetergentIncluded}
            />

            <Toggle
              label="🛒 Can buy it there"
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
                placeholder="0.50"
                className={selectClass}
              />
            </label>
          )}
        </Card>
      )}

      <Card>
        <h3 className="mb-3 text-sm font-semibold text-slate-700">Payment</h3>

        <div className="flex flex-wrap gap-2">
          {PAYMENT_KEYS.map((key) => (
            <button
              key={key.value}
              type="button"
              onClick={() => toggleIn(payments, setPayments, key.value)}
              aria-pressed={payments.includes(key.value)}
              className={`min-h-10 rounded-full border px-3 text-sm font-semibold transition ${
                payments.includes(key.value)
                  ? "border-slate-900 bg-slate-900 text-white"
                  : "border-slate-300 bg-white text-slate-700"
              }`}
            >
              {key.label}
            </button>
          ))}
        </div>
      </Card>

      <Card>
        <h3 className="mb-3 text-sm font-semibold text-slate-700">
          Amenities
        </h3>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          <Toggle label="📶 Wi-Fi" value={wifi} onChange={setWifi} />
          <Toggle label="🔌 Power" value={power} onChange={setPower} />
          <Toggle label="🅿️ Parking" value={parking} onChange={setParking} />
          <Toggle label="🪑 Seating" value={seating} onChange={setSeating} />
          <Toggle label="🚻 Toilets" value={toilets} onChange={setToilets} />
        </div>
      </Card>

      <Card>
        <h3 className="mb-3 text-sm font-semibold text-slate-700">
          Photos
        </h3>

        <input
          id="photos"
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => handlePhotos(e.target.files)}
        />

        <label
          htmlFor="photos"
          className="flex min-h-11 cursor-pointer items-center justify-center rounded-xl border border-slate-300 bg-white px-4 font-semibold text-slate-700 transition hover:bg-slate-50"
        >
          {compressing ? "Compressing…" : "📷 Add up to 5 photos"}
        </label>

        {photos.length > 0 && (
          <ul className="mt-3 space-y-1 text-sm text-slate-600">
            {photos.map((photo, index) => (
              <li
                key={`${photo.name}-${photo.size}-${index}`}
                className="flex items-center justify-between gap-3"
              >
                <span className="min-w-0 truncate">{photo.name}</span>

                <span className="shrink-0 text-xs text-slate-400">
                  {Math.round(photo.size / 1024)} KB
                </span>
              </li>
            ))}
          </ul>
        )}

        <p className="mt-2 text-xs text-slate-500">
          Up to {MAX_INPUT_MB} MB each. Each photo is squared, then compressed
          to 1400px before upload.
        </p>
      </Card>

      <Card>
        <label className="block">
          <span className="mb-1.5 block text-sm font-semibold text-slate-700">
            Anything useful to know?
          </span>

          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            placeholder="Cash only, bring coins. Machines take about 30 minutes."
            className="w-full rounded-xl border border-slate-300 px-4 py-3 text-base outline-none focus:border-slate-500"
          />
        </label>

        <label className="mt-4 block">
          <span className="mb-1.5 block text-sm font-semibold text-slate-700">
            Website
          </span>

          <input
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
            placeholder="https://"
            className="w-full rounded-xl border border-slate-300 px-4 py-3 text-base outline-none focus:border-slate-500"
          />
        </label>
      </Card>

      {chainHit && !chainConfirmed && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
          <p className="text-sm font-semibold text-amber-900">
            “{chainHit}” looks like a chain.
          </p>

          <p className="mt-1 text-sm text-amber-800">
            coffee&apos;n&apos;laundry keeps independent places — the whole
            point is that someone chose this one. If it genuinely is
            independent, or the chain does something worth the trip, carry on.
          </p>

          <button
            type="button"
            onClick={() => setChainConfirmed(true)}
            className="mt-3 inline-flex min-h-10 items-center rounded-xl bg-amber-900 px-4 text-sm font-semibold text-white transition hover:bg-amber-800"
          >
            It&apos;s worth listing anyway
          </button>
        </div>
      )}

      {error && <ErrorBanner message={error} />}

      <Button
        type="submit"
        disabled={!canSubmit || (Boolean(chainHit) && !chainConfirmed)}
        className="w-full"
      >
        {loading ? "Saving…" : "Add this place"}
      </Button>
    </form>
  );
}
