"use client";

import { useState } from "react";

import { Button } from "@/components/ui";
import LocationMapPicker from "@/components/location/LocationMapPickerLoader";

import type { PlaceType } from "@/lib/types";

/*
 * The identity block: name, address, and where the pin sits. Shown to
 * the person who created the place, and only to them — a form is a
 * suggestion, and the real rule lives in updatePlace.ts, but showing
 * a stranger fields the server will ignore would be a lie.
 *
 * The address is typed by hand on purpose. Reverse geocoding answers
 * "what is near this point", which is a neighbourhood, not a shop's
 * address — the owner is the one who knows the real one.
 *
 * Moving the pin and correcting the address are independent: a place
 * can be renamed without moving, or moved without touching the
 * address. Only a real change is sent.
 */

export function IdentityBlock({
  placeId,
  name,
  address,
  latitude,
  longitude,
  onNameChange,
  onAddressChange,
  onPositionChange,
}: {
  placeId: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  onNameChange: (next: string) => void;
  onAddressChange: (next: string) => void;
  onPositionChange: (lat: number, lng: number) => void;
}) {
  const [mapOpen, setMapOpen] = useState(false);

  const moved =
    Math.abs(latitude) > 1e-6 || Math.abs(longitude) > 1e-6;

  const field =
    "w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-base outline-none focus:border-slate-500";

  return (
    <section className="rounded-2xl border border-amber-200 bg-amber-50/60 p-5">
      <h2 className="text-sm font-bold uppercase tracking-wide text-amber-800">
        You added this place
      </h2>

      <p className="mt-1 text-xs text-amber-700">
        You can correct its name, its address and where it sits. Nobody else
        can — those three are what make it this place and not another one.
      </p>

      <label className="mt-4 block">
        <span className="mb-1.5 block text-sm font-semibold text-slate-700">
          Name
        </span>

        <input
          value={name}
          onChange={(event) => onNameChange(event.target.value)}
          maxLength={120}
          className={field}
        />
      </label>

      <label className="mt-3 block">
        <span className="mb-1.5 block text-sm font-semibold text-slate-700">
          Address
        </span>

        <input
          value={address}
          onChange={(event) => onAddressChange(event.target.value)}
          placeholder="123 Main Street"
          className={field}
        />

        <span className="mt-1 block text-xs text-slate-500">
          The automatic lookup only finds the area, not the shop. Put the
          real address here when you know it.
        </span>
      </label>

      <div className="mt-3 rounded-xl border border-slate-200 bg-white p-4">
        <p className="text-sm font-semibold text-slate-700">Position</p>

        <p className="mt-1 text-xs text-slate-500">
          {latitude.toFixed(5)}, {longitude.toFixed(5)}
        </p>

        <button
          type="button"
          onClick={() => setMapOpen(true)}
          className="mt-3 flex min-h-11 w-full items-center justify-center rounded-xl border border-slate-300 bg-white px-5 font-semibold text-slate-800 transition hover:bg-slate-50"
        >
          📌 Move the pin on the map
        </button>

        {moved && (
          <p className="mt-2 text-xs font-semibold text-amber-700">
            The pin has moved. Save to apply it.
          </p>
        )}
      </div>

      <LocationMapPicker
        open={mapOpen}
        initial={{ latitude, longitude }}
        onCancel={() => setMapOpen(false)}
        onConfirm={(lat, lng) => {
          onPositionChange(lat, lng);
          setMapOpen(false);
        }}
      />

      <input type="hidden" name="place_id" value={placeId} />
    </section>
  );
}

export default IdentityBlock;
