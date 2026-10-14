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
const MAX_PHOTOS = 5;

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

/*
 * Four ways to pay, and the card detail behind one of them.
 *
 * The old list had thirteen flat options and several of them meant
 * the same thing: Visa competed with Card, and "All major credit
 * cards" competed with both. Nobody could tell which to pick, and the
 * same shop got tagged three different ways depending on who filled
 * the form — which made the column useless to count from.
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

/* The card detail, asked only once Cards has been chosen. */
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
  size = "lg",
}: {
  label: string;
  value: boolean;
  onChange: (next: boolean) => void;
  size?: "sm" | "lg";
}) {
  const shape =
    size === "lg"
      ? "min-h-11 rounded-xl px-4 text-sm"
      : "min-h-9 rounded-lg px-2.5 text-xs";

  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      aria-pressed={value}
      className={`${shape} border font-semibold transition ${
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
  const [flatWhitePrice, setFlatWhitePrice] = useState("");

  const [sellsBeans, setSellsBeans] = useState(false);
  const [hasRoaster, setHasRoaster] = useState(false);
  const [roasterName, setRoasterName] = useState("");

  /* The milks as a set. The five columns still exist and are
     written one by one below — what changed is the asking. */
  const [milks, setMilks] = useState<string[]>([]);
  const [hasDecaf, setHasDecaf] = useState(false);
  const [laptop, setLaptop] = useState(false);

  const [ambience, setAmbience] = useState<string[]>([]);
  const [food, setFood] = useState<string[]>([]);

  /*
   * Laundry. The durations live with the prices — a wash is a
   * number and a length of time, and separating them made the person
   * scroll to answer one question. Opening hours keep their own card.
   */
  const [machineSizes, setMachineSizes] = useState<string[]>([]);
  const [detergentIncluded, setDetergentIncluded] = useState(false);
  const [detergentPurchasable, setDetergentPurchasable] = useState(false);
  const [detergentPrice, setDetergentPrice] = useState("");
  const [open24h, setOpen24h] = useState(false);
  const [washMinutes, setWashMinutes] = useState("");
  const [dryerMinutes, setDryerMinutes] = useState("");
  const [lastEntry, setLastEntry] = useState("");

  const [payments, setPayments] = useState<string[]>([]);

  /* Held apart from `payments` so the button list stays the four
     categories, and folded in at send time. */
  const [paymentNote, setPaymentNote] = useState("");

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

    /* Already-chosen photos count towards the ceiling: adding three
       when two are held must not end with five uploaded silently. */
    const room = MAX_PHOTOS - photos.length;

    if (room <= 0) {
      setError(`That is already ${MAX_PHOTOS} photos. Remove one to add another.`);
      return;
    }

    const picked = Array.from(files).slice(0, room);

    const tooBig = picked.find((file) => file.size > MAX_INPUT_MB * 1_000_000);

    if (tooBig) {
      setError(`One photo is larger than ${MAX_INPUT_MB} MB.`);
      return;
    }

    /* Crop, then compress — in that order, one photo at a time. */
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

      setPhotos((current) => [...current, compressed].slice(0, MAX_PHOTOS));
    } catch {
      setError("Could not process that photo. Try a smaller one.");
    }

    setCompressing(false);

    /*
     * The next photo in the queue, read with the updater form rather
     * than off `queue` directly.
     *
     * `queue` here is the value captured when this callback was
     * created, not the one live at the moment it runs. On a desktop
     * the crop finishes fast enough that React has re-rendered in
     * between, so the captured value happens to be current and the
     * next photo opens. On iOS Safari the 1400×1400 canvas takes
     * long enough that the render has not happened yet, the captured
     * queue still reads as empty, and the strip simply stops — which
     * looked like "I picked four photos and nothing happened".
     *
     * Taking the head inside the updater removes the timing from the
     * question: whatever the queue holds when the update is applied
     * is what gets used, and the rest is set back in the same pass.
     */
    setQueue((current) => {
      if (current.length === 0) return current;

      setCropping(current[0]);

      return current.slice(1);
    });
  }

  /* Taking one back before the form is sent. Filtering by position
     rather than by name: two photos from the same phone can share a
     name once the crop has renamed them both "-square.jpg". */
  function removePhoto(index: number) {
    setPhotos((current) => current.filter((_, i) => i !== index));
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

      if (paymentNote.trim()) {
        formData.append("payments", paymentNote.trim());
      }

      machineSizes.forEach((s) => formData.append("machine_sizes", s));

      /* One entry per file, under "photo" — createPlace reads them
         with getAll. */
      photos.forEach((p) => formData.append("photo", p));

      if (chainHit) formData.set("chain_flagged", chainHit);

      if (type === "coffee") {
        formData.set("coffee_kind", coffeeKind);

        formData.set("espresso_price", espressoPrice);
        formData.set("flat_white_price", flatWhitePrice);

        formData.set("sells_beans", String(sellsBeans));
        formData.set("has_roaster", String(hasRoaster));
        formData.set("roaster_name", roasterName.trim());

        formData.set("has_milk", String(milks.includes("milk")));
        formData.set("has_oat_milk", String(milks.includes("oat_milk")));
        formData.set("has_soy_milk", String(milks.includes("soy_milk")));
        formData.set("has_coconut_milk", String(milks.includes("coconut_milk")));
        formData.set("has_almond_milk", String(milks.includes("almond_milk")));
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
          className="flex flex-col items-center rounded-2xl border-2 border-sky-600 bg-white p-8 transition hover:border-sky-600 hover:shadow-lg"
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

      {/* ---------- 1. what and where ---------- */}

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

        <label className="mt-3 block">
          <span className="mb-1.5 block text-sm font-semibold text-slate-700">
            Address
          </span>

          <input
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="Street, number"
            className="w-full rounded-xl border border-slate-300 px-4 py-3 text-base outline-none focus:border-slate-500"
          />
        </label>

        <label className="mt-3 block">
          <span className="mb-1.5 block text-sm font-semibold text-slate-700">
            Website
          </span>

          <input
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
            placeholder="https://"
            inputMode="url"
            className="w-full rounded-xl border border-slate-300 px-4 py-3 text-base outline-none focus:border-slate-500"
          />
        </label>

        <div className="mt-3">
          <LocationPicker
            onPicked={(lat, lng) => {
              setLatitude(lat);
              setLongitude(lng);
            }}
          />
        </div>
      </Card>

      {/* ---------- 2. price and time ---------- */}

      {isCoffee ? (
        <Card>
          <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-500">
            Coffee Prices
          </h2>

          <div className="grid grid-cols-2 gap-2">
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-slate-500">
                Espresso
              </span>

              <input
                value={espressoPrice}
                onChange={(e) => setEspressoPrice(e.target.value)}
                inputMode="decimal"
                placeholder="3.50"
                className={selectClass}
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
                className={selectClass}
              />
            </label>
          </div>

          <div className="mt-2">
            <CurrencyPicker
              value={currency}
              onChange={setCurrency}
              selectClass={selectClass}
            />
          </div>
        </Card>
      ) : (
        <Card>
          <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-500">
            Price and time
          </h2>

          <div className="grid grid-cols-2 gap-2">
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-slate-500">
                🧺 Wash
              </span>

              <input
                value={washAmount}
                onChange={(e) => setWashAmount(e.target.value)}
                inputMode="decimal"
                placeholder="6.00"
                className={selectClass}
              />
            </label>

            <label className="block">
              <span className="mb-1 block text-xs font-medium text-slate-500">
                ⏱️ Wash takes
              </span>

              <select
                value={washMinutes}
                onChange={(e) => setWashMinutes(e.target.value)}
                className={selectClass}
              >
                <option value="">Not recorded</option>

                {DURATIONS.map((d) => (
                  <option key={d} value={d}>
                    {d} min
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="mb-1 block text-xs font-medium text-slate-500">
                🔥 Dryer
              </span>

              <input
                value={dryerAmount}
                onChange={(e) => setDryerAmount(e.target.value)}
                inputMode="decimal"
                placeholder="4.00"
                className={selectClass}
              />
            </label>

            <label className="block">
              <span className="mb-1 block text-xs font-medium text-slate-500">
                ⏱️ Dryer takes
              </span>

              <select
                value={dryerMinutes}
                onChange={(e) => setDryerMinutes(e.target.value)}
                className="selectClass"
              >
                <option value="">Not recorded</option>

                {DURATIONS.map((d) => (
                  <option key={d} value={d}>
                    {d} min
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="mt-2">
            <CurrencyPicker
              value={currency}
              onChange={setCurrency}
              selectClass={selectClass}
            />
          </div>
        </Card>
      )}

      {/* ---------- 3. payment ---------- */}

      <Card>
        <SectionTitle title="How do you pay?" note={`up to ${PAYMENT_NOTE_MAX} characters`} />

        <div className="mt-2 flex flex-wrap gap-2">
          {paymentKeysFor(isCoffee).map((option) => (
            <Toggle
              key={option.value}
              label={option.label}
              value={payments.includes(option.value)}
              onChange={() => toggleIn(payments, setPayments, option.value)}
            />
          ))}
        </div>

        {payments.includes("card") && (
          <div className="mt-3 border-t border-slate-100 pt-3">
            <p className="mb-2 text-xs font-semibold text-slate-500">
              Which cards?
            </p>

            <div className="flex flex-wrap gap-2">
              {CARD_KINDS.map((option) => (
                <Toggle
                  key={option.value}
                  label={option.label}
                  value={payments.includes(option.value)}
                  onChange={() => toggleIn(payments, setPayments, option.value)}
                  size="sm"
                />
              ))}
            </div>
          </div>
        )}

        <label className="mt-3 block">
          <span className="mb-1 block text-xs font-semibold text-slate-500">
            Anything else?
          </span>

          <input
            value={paymentNote}
            onChange={(e) => setPaymentNote(e.target.value)}
            maxLength={PAYMENT_NOTE_MAX}
            placeholder="Exact change only"
            className={selectClass}
          />
        </label>
      </Card>

      {/* ---------- coffee only ---------- */}

      {isCoffee && (
        <Card>
          <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-500">
            Coffee type
          </h2>

          <div className="grid grid-cols-3 gap-2">
            {COFFEE_KINDS.map((option) => (
              <Toggle
                key={option.key}
                label={option.label}
                value={coffeeKind === option.key}
                onChange={() => setCoffeeKind(option.key)}
                size="sm"
              />
            ))}
          </div>
        </Card>
      )}

      {isCoffee && (
        <Card>
          <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-500">
            Milk / PBM
          </h2>

          <div className="flex flex-wrap gap-2">
            {MILKS.map((option) => (
              <Toggle
                key={option.key}
                label={option.label}
                value={milks.includes(option.key)}
                onChange={() => toggleIn(milks, setMilks, option.key)}
                size="sm"
              />
            ))}
          </div>
        </Card>
      )}

      {isCoffee && (
        <Card>
          <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-500">
            Decaf
          </h2>

          <Toggle
            label="Decaf available"
            value={hasDecaf}
            onChange={setHasDecaf}
          />
        </Card>
      )}

      {isCoffee && (
        <Card>
          <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-500">
            Beans
          </h2>

          <div className="flex flex-wrap gap-2">
            <Toggle
              label="Beans for sale"
              value={sellsBeans}
              onChange={setSellsBeans}
            />

            <Toggle
              label="Has a roaster"
              value={hasRoaster}
              onChange={setHasRoaster}
            />
          </div>

          {hasRoaster && (
            <label className="mt-3 block">
              <span className="mb-1 block text-xs font-semibold text-slate-500">
                Which roaster?
              </span>

              <input
                value={roasterName}
                onChange={(e) => setRoasterName(e.target.value)}
                placeholder="Roaster name"
                className={selectClass}
              />
            </label>
          )}
        </Card>
      )}

      {isCoffee && (
        <Card>
          <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-500">
            Food
          </h2>

          <div className="flex flex-wrap gap-2">
            {FOOD.map((option) => (
              <Toggle
                key={option.key}
                label={`${option.emoji} ${option.label}`}
                value={food.includes(option.key)}
                onChange={() => toggleIn(food, setFood, option.key)}
                size="sm"
              />
            ))}
          </div>
        </Card>
      )}

      {isCoffee && (
        <Card>
          <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-500">
            Ambiance
          </h2>

          <div className="flex flex-wrap gap-2">
            {AMBIENCE.map((option) => (
              <Toggle
                key={option.key}
                label={`${option.emoji} ${option.label}`}
                value={ambience.includes(option.key)}
                onChange={() => toggleIn(ambience, setAmbience, option.key)}
                size="sm"
              />
            ))}

            <Toggle
              label="💻 Laptop-friendly"
              value={laptop}
              onChange={setLaptop}
            />
          </div>
        </Card>
      )}

      {/* ---------- 4. machines ---------- */}

      {!isCoffee && (
        <Card>
          <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-500">
            Machine size
          </h2>

          <p className="mb-2 text-xs text-slate-400">
            Tick every size this laundromat has.
          </p>

          <div className="grid grid-cols-3 gap-2">
            {MACHINE_SIZES.map((option) => (
              <Toggle
                key={option.key}
                label={option.label}
                value={machineSizes.includes(option.key)}
                onChange={() => toggleIn(machineSizes, setMachineSizes, option.key)}
              />
            ))}
          </div>
        </Card>
      )}

      {/* ---------- 5. detergent ---------- */}

      {!isCoffee && (
        <Card>
          <SectionTitle title="Detergent" note="bought there or already included" />

          <div className="mt-2 grid grid-cols-2 gap-2">
            <Toggle
              label="🧼 Included"
              value={detergentIncluded}
              onChange={setDetergentIncluded}
            />

            <Toggle
              label="🛒 Buy it there"
              value={detergentPurchasable}
              onChange={setDetergentPurchasable}
            />
          </div>

          {detergentPurchasable && !detergentIncluded && (
            <label className="mt-3 block">
              <span className="mb-1 block text-xs font-semibold text-slate-500">
                Price
              </span>

              <input
                value={detergentPrice}
                onChange={(e) => setDetergentPrice(e.target.value)}
                inputMode="decimal"
                placeholder="1.00"
                className={selectClass}
              />
            </label>
          )}
        </Card>
      )}

      {/* ---------- 6. opening hours ---------- */}

      {!isCoffee && (
        <Card>
          <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-500">
            Opening hours
          </h2>

          <div className="grid grid-cols-2 gap-2">
            <Toggle
              label="Open 24h"
              value={open24h}
              onChange={setOpen24h}
            />
            <span />
          </div>

          {/* 24h means there is no last entry to record. */}
          {!open24h && (
            <label className="mt-3 block">
              <span className="mb-1 block text-xs font-semibold text-slate-500">
                Last entry
              </span>

              <select
                value={lastEntry}
                onChange={(e) => setLastEntry(e.target.value)}
                className={selectClass}
              >
                <option value="">Not recorded</option>

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

      {/* ---------- 7. amenities ---------- */}

      <Card>
        <SectionTitle title="Amenities" note="what else is there" />

        <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Toggle label="📶 Wi-Fi" value={wifi} onChange={setWifi} />
          <Toggle label="🔌 Power" value={power} onChange={setPower} />
          <Toggle label="🅿️ Parking" value={parking} onChange={setParking} />

          <Toggle
            label={isCoffee ? "🪑 Seating" : "🚻 Toilets"}
            value={isCoffee ? seating : toilets}
            onChange={isCoffee ? setSeating : setToilets}
          />
        </div>
      </Card>

      {/* ---------- 8. photos ---------- */}

      <Card>
        <SectionTitle title="Photos" note={`up to ${MAX_PHOTOS}`} />

        {/*
         * The input is hidden and the label below is the button that
         * opens it. Without the label there is nothing to click: a
         * bare file input renders as inert text on a phone, which is
         * exactly what happened when this card was rewritten.
         */}
        <input
          id="new-photos"
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => {
            handlePhotos(e.target.files);

            /* Cleared so choosing the same file twice still fires a
               change event. */
            e.target.value = "";
          }}
        />

        <label
          htmlFor="new-photos"
          className="mt-2 flex min-h-12 cursor-pointer items-center justify-center rounded-xl border border-slate-300 bg-white px-4 font-semibold text-slate-700 transition hover:bg-slate-50"
        >
          {compressing ? "Compressing…" : "📷 Choose photos"}
        </label>

        {photos.length > 0 && (
          <ul className="mt-3 space-y-2">
            {photos.map((file, index) => (
              <li
                key={`${file.name}-${index}`}
                className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 p-2"
              >
                <span className="min-w-0 flex-1 truncate text-sm text-slate-700">
                  {file.name}
                </span>

                <span className="shrink-0 text-xs text-slate-400">
                  {Math.round(file.size / 1024)} KB
                </span>

                <button
                  type="button"
                  onClick={() => removePhoto(index)}
                  aria-label={`Remove ${file.name}`}
                  title="Remove this photo"
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-rose-200 bg-white text-sm font-bold text-rose-600 transition hover:bg-rose-50"
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
        )}

        <p className="mt-2 text-xs text-slate-500">
          Up to {MAX_INPUT_MB} MB each photo. Each one is squared, then
          compressed to 1400px. At least one is needed to add the place.
        </p>
      </Card>

      {/* ---------- 9. description ---------- */}

      <Card>
        <SectionTitle title="Description" />

        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          placeholder="What makes this place worth the trip?"
          className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 text-base outline-none focus:border-slate-500"
        />
      </Card>

      {chainHit && (
        <Card>
          <label className="flex items-start gap-3">
            <input
              type="checkbox"
              checked={chainConfirmed}
              onChange={(e) => setChainConfirmed(e.target.checked)}
              className="mt-1"
            />

            <span className="text-sm text-slate-700">
              This looks like a chain. Tick to confirm it is the
              independent place you meant to add.
            </span>
          </label>
        </Card>
      )}

      {error && <ErrorBanner message={error} />}

      <Button type="submit" disabled={!canSubmit} className="w-full">
        Add the place
      </Button>
    </form>
  );
}

export default NewPlaceForm;
