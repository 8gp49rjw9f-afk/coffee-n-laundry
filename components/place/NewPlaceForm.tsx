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

/*
 * ONE BUTTON SHAPE FOR THE WHOLE FORM.
 *
 * These controls used to come in two sizes — a big one for the rows
 * that sat alone, a smaller one for the rows of five or six, on the
 * theory that a dense row needs smaller buttons. On screen it read as
 * an accident rather than a decision: the same kind of choice was a
 * different height and a different type size depending on which card
 * it lived in.
 *
 * So there is one shape now: 44px tall, 14px text. min-h-11 is the
 * shortest height that stays comfortable under a thumb, which matters
 * more here than fitting one extra chip per line.
 */
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
      className={`min-h-11 rounded-xl border px-4 text-sm font-semibold transition ${
        value
          ? "border-slate-900 bg-slate-900 text-white"
          : "border-slate-300 bg-white text-slate-700"
      }`}
    >
      {label}
    </button>
  );
}

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
          className="flex flex-col items-center rounded-2xl border-2 border-slate-200 bg-white p-8 transition hover:border-sky-600 hover:shadow-lg"
        >
          <span className="text-5xl">🧺</span>
          <span className="mt-3 text-lg font-bold text-slate-900">
            Laundromat
          </span>
          <span className="mt-1 text-sm text-slate-500">
            Where the machines are
          </span>
        </button>
      </div>
    );
  }

  if (step === "notice") {
    return (
      <Card>
        <h2 className="text-lg font-bold text-slate-900">
          Before you add it
        </h2>

        <p className="mt-2 text-sm text-slate-600">
          Two things are asked of every place on this map: a photo, and a
          position. A place nobody can see is not one anybody can judge.
        </p>

        <div className="mt-4 flex gap-2">
          <Button
            variant="ghost"
            onClick={() => {
              setType(null);
              setStep("choose");
            }}
          >
            ← Back
          </Button>

          <Button className="flex-1" onClick={() => setStep("form")}>
            Got it
          </Button>
        </div>
      </Card>
    );
  }

  const isCoffee = type === "coffee";

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* ---------- 1. where it is ---------- */}

      <Card>
        <SectionTitle title="Where it is" />

        <div className="mt-3 space-y-3">
          <label className="block">
            <span className="mb-1.5 block text-sm font-semibold text-slate-700">
              Name
            </span>

            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={120}
              placeholder="Café Lumière"
              className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-slate-500"
            />
          </label>

          {/*
           * The picker takes ONE prop — `onPicked(lat, lng)` — and
           * keeps its own resolved position, its own search box and
           * its own map dialog. It does not read latitude, longitude
           * or address back from the parent: an earlier version of
           * this form passed `value` and `onChange` as if it were a
           * controlled input, which it is not, and the build failed on
           * the prop that does not exist.
           */}
          <LocationPicker
            onPicked={(lat, lng) => {
              setLatitude(lat);
              setLongitude(lng);
            }}
          />

          <label className="block">
            <span className="mb-1.5 block text-sm font-semibold text-slate-700">
              Address
            </span>

            <input
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="123 Main Street"
              className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-slate-500"
            />
          </label>
        </div>
      </Card>

      {/* ---------- the type-specific side ---------- */}

      {isCoffee ? (
        <Card>
          <SectionTitle title="Coffee" />

          <div className="mt-3 space-y-3">
            <div>
              <span className="mb-1.5 block text-sm font-semibold text-slate-700">
                Kind
              </span>

              <div className="flex flex-wrap gap-1.5">
                {COFFEE_KINDS.map((option) => (
                  <Toggle
                    key={option.key}
                    label={option.label}
                    value={coffeeKind === option.key}
                    onChange={() => setCoffeeKind(option.key)}
                  />
                ))}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-1.5">
              <label className="block">
                <span className="mb-1.5 block text-sm font-semibold text-slate-700">
                  Espresso
                </span>

                <input
                  value={espressoPrice}
                  onChange={(e) => setEspressoPrice(e.target.value)}
                  inputMode="decimal"
                  placeholder="3.50"
                  className="w-full rounded-xl border border-slate-300 px-3 py-3 outline-none focus:border-slate-500"
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
                  placeholder="4.50"
                  className="w-full rounded-xl border border-slate-300 px-3 py-3 outline-none focus:border-slate-500"
                />
              </label>

              <CurrencyPicker
                value={currency}
                onChange={setCurrency}
                selectClass="w-full rounded-xl border border-slate-300 px-3 py-3 outline-none focus:border-slate-500"
              />
            </div>

            <div>
              <span className="mb-1.5 block text-sm font-semibold text-slate-700">
                Milk
              </span>

              <div className="flex flex-wrap gap-1.5">
                {MILKS.map((option) => (
                  <Toggle
                    key={option.key}
                    label={option.label}
                    value={milks.includes(option.key)}
                    onChange={() => toggleIn(milks, setMilks, option.key)}
                  />
                ))}
              </div>
            </div>

            <div className="flex flex-wrap gap-1.5">
              <Toggle
                label="🫘 Beans for sale"
                value={sellsBeans}
                onChange={setSellsBeans}
              />

              <Toggle
                label="🔥 Own roaster"
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

            {hasRoaster && (
              <label className="block">
                <span className="mb-1.5 block text-sm font-semibold text-slate-700">
                  Roaster name
                </span>

                <input
                  value={roasterName}
                  onChange={(e) => setRoasterName(e.target.value)}
                  placeholder="Square Mile"
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-slate-500"
                />
              </label>
            )}

            <div>
              <span className="mb-1.5 block text-sm font-semibold text-slate-700">
                Ambience
              </span>

              <div className="flex flex-wrap gap-1.5">
                {AMBIENCE.map((option) => (
                  <Toggle
                    key={option.key}
                    label={option.label}
                    value={ambience.includes(option.key)}
                    onChange={() => toggleIn(ambience, setAmbience, option.key)}
                  />
                ))}
              </div>
            </div>

            <div>
              <span className="mb-1.5 block text-sm font-semibold text-slate-700">
                Food
              </span>

              <div className="flex flex-wrap gap-1.5">
                {FOOD.map((option) => (
                  <Toggle
                    key={option.key}
                    label={option.label}
                    value={food.includes(option.key)}
                    onChange={() => toggleIn(food, setFood, option.key)}
                  />
                ))}
              </div>
            </div>
          </div>
        </Card>
      ) : (
        <Card>
          <SectionTitle title="Laundry" />

          <div className="mt-3 space-y-3">
            <div className="grid grid-cols-3 gap-1.5">
              <label className="block">
                <span className="mb-1.5 block text-sm font-semibold text-slate-700">
                  Wash
                </span>

                <input
                  value={washAmount}
                  onChange={(e) => setWashAmount(e.target.value)}
                  inputMode="decimal"
                  placeholder="8.00"
                  className="w-full rounded-xl border border-slate-300 px-3 py-3 outline-none focus:border-slate-500"
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
                  placeholder="6.00"
                  className="w-full rounded-xl border border-slate-300 px-3 py-3 outline-none focus:border-slate-500"
                />
              </label>

              <CurrencyPicker
                value={currency}
                onChange={setCurrency}
                selectClass="w-full rounded-xl border border-slate-300 px-3 py-3 outline-none focus:border-slate-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-1.5">
              <label className="block">
                <span className="mb-1.5 block text-sm font-semibold text-slate-700">
                  Wash duration
                </span>

                <select
                  value={washMinutes}
                  onChange={(e) => setWashMinutes(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-3 outline-none focus:border-slate-500"
                >
                  <option value="">—</option>
                  {DURATIONS.map((m) => (
                    <option key={m} value={String(m)}>
                      {m} min
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="mb-1.5 block text-sm font-semibold text-slate-700">
                  Dryer duration
                </span>

                <select
                  value={dryerMinutes}
                  onChange={(e) => setDryerMinutes(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-3 outline-none focus:border-slate-500"
                >
                  <option value="">—</option>
                  {DURATIONS.map((m) => (
                    <option key={m} value={String(m)}>
                      {m} min
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div>
              <span className="mb-1.5 block text-sm font-semibold text-slate-700">
                Machines
              </span>

              <div className="flex flex-wrap gap-1.5">
                {MACHINE_SIZES.map((option) => (
                  <Toggle
                    key={option.key}
                    label={option.label}
                    value={machineSizes.includes(option.key)}
                    onChange={() =>
                      toggleIn(machineSizes, setMachineSizes, option.key)
                    }
                  />
                ))}
              </div>
            </div>

            <div className="flex flex-wrap gap-1.5">
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

              <Toggle
                label="🕒 Open 24 h"
                value={open24h}
                onChange={setOpen24h}
              />
            </div>

            {detergentPurchasable && !detergentIncluded && (
              <label className="block">
                <span className="mb-1.5 block text-sm font-semibold text-slate-700">
                  Detergent price
                </span>

                <input
                  value={detergentPrice}
                  onChange={(e) => setDetergentPrice(e.target.value)}
                  inputMode="decimal"
                  placeholder="1.00"
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-slate-500"
                />
              </label>
            )}

            {!open24h && (
              <label className="block">
                <span className="mb-1.5 block text-sm font-semibold text-slate-700">
                  Last entry
                </span>

                <select
                  value={lastEntry}
                  onChange={(e) => setLastEntry(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-3 outline-none focus:border-slate-500"
                >
                  <option value="">—</option>
                  {ENTRY_TIMES.map((t) => (
                    <option key={t.value} value={String(t.value)}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>
        </Card>
      )}

      {/* ---------- payment ---------- */}

      <Card>
        <SectionTitle title="Payment" />

        <div className="mt-3 flex flex-wrap gap-1.5">
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
          <div className="mt-3 flex flex-wrap gap-1.5 border-t border-slate-100 pt-3">
            {CARD_KINDS.map((option) => (
              <Toggle
                key={option.value}
                label={option.label}
                value={payments.includes(option.value)}
                onChange={() => toggleIn(payments, setPayments, option.value)}
              />
            ))}
          </div>
        )}

        <label className="mt-3 block">
          <span className="mb-1.5 block text-sm font-semibold text-slate-700">
            Anything else? (optional)
          </span>

          <input
            value={paymentNote}
            onChange={(e) => setPaymentNote(e.target.value)}
            maxLength={PAYMENT_NOTE_MAX}
            placeholder="Exact change only"
            className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-slate-500"
          />
        </label>
      </Card>

      {/* ---------- amenities ---------- */}

      <Card>
        <SectionTitle title="Others" />

        <div className="mt-3 flex flex-wrap gap-1.5">
          <Toggle label="📶 Wifi" value={wifi} onChange={setWifi} />
          <Toggle label="🔌 Power" value={power} onChange={setPower} />
          <Toggle label="🅿️ Parking" value={parking} onChange={setParking} />
          <Toggle
            label={isCoffee ? "🪑 Seating" : "🧺 Folding table"}
            value={isCoffee ? seating : toilets}
            onChange={isCoffee ? setSeating : setToilets}
          />
        </div>
      </Card>

      {/* ---------- 9. comments ---------- */}

      <Card>
        <SectionTitle
          title="Add some comments"
          note="optional"
        />

        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={4}
          maxLength={200}
          placeholder="The machines take cards, the dryer on the left is the fast one…"
          className="mt-3 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-slate-500"
        />
      </Card>

      {/* ---------- website ---------- */}

      <Card>
        <label className="block">
          <span className="mb-1.5 block text-sm font-semibold text-slate-700">
            Website
          </span>

          <input
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
            placeholder="https://"
            className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-slate-500"
          />
        </label>
      </Card>

      {/* ---------- photos ---------- */}

      <Card>
        <SectionTitle
          title="Photos"
          note="at least one"
        />

        <input
          type="file"
          accept="image/*"
          multiple
          onChange={(e) => handlePhotos(e.target.files)}
          className="mt-3 block w-full text-sm text-slate-600"
        />

        {compressing && (
          <p className="mt-2 text-sm text-slate-500">Compressing…</p>
        )}

        {photos.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {photos.map((photo, index) => (
              <div key={index} className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={URL.createObjectURL(photo)}
                  alt=""
                  className="h-20 w-20 rounded-lg object-cover"
                />

                <button
                  type="button"
                  onClick={() => removePhoto(index)}
                  className="absolute -right-1 -top-1 flex h-6 w-6 items-center justify-center rounded-full bg-rose-600 text-xs text-white shadow"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}
      </Card>

      {chainHit && !chainConfirmed && (
        <Card className="border-amber-300 bg-amber-50">
          <p className="text-sm font-semibold text-amber-900">
            “{chainHit}” looks like a chain.
          </p>

          <p className="mt-1 text-xs text-amber-800">
            This map is for independent places. If it really is a chain,
            please do not add it.
          </p>

          <div className="mt-3 flex gap-2">
            <Button
              variant="ghost"
              onClick={() => {
                setName("");
                setChainConfirmed(false);
              }}
            >
              ← Change the name
            </Button>

            <Button
              variant="ghost"
              className="flex-1"
              onClick={() => setChainConfirmed(true)}
            >
              It is independent
            </Button>
          </div>
        </Card>
      )}

      {error && <ErrorBanner message={error} />}

      <Button
        type="submit"
        disabled={!canSubmit || (Boolean(chainHit) && !chainConfirmed)}
        className="w-full"
      >
        {loading ? "Saving…" : "Add the place"}
      </Button>
    </form>
  );
}

export default NewPlaceForm;
