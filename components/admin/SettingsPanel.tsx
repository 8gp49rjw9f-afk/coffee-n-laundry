"use client";

import { useState, useTransition } from "react";

import { Button, Card, ErrorBanner } from "@/components/ui";

import { saveSettings } from "@/app/actions/admin";

import type { SiteSettings } from "@/lib/services/settings";

/*
 * Grouped, not alphabetical. The groups match how the settings are
 * actually thought about: what the site says it is, whether it is up,
 * what it lets people do, and how the map behaves.
 */

const FIELD =
  "w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-base outline-none focus:border-slate-500";

function Group({
  title,
  note,
  children,
}: {
  title: string;
  note?: string;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">
        {title}
      </h2>

      {note && <p className="mt-1 text-xs text-slate-400">{note}</p>}

      <div className="mt-4 space-y-3">{children}</div>
    </Card>
  );
}

function Text({
  label,
  hint,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  hint?: string;
  value: string | number;
  onChange: (next: string) => void;
  type?: "text" | "number";
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-semibold text-slate-700">
        {label}
      </span>

      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={FIELD}
      />

      {hint && <span className="mt-1 block text-xs text-slate-500">{hint}</span>}
    </label>
  );
}

function Switch({
  label,
  hint,
  value,
  onChange,
}: {
  label: string;
  hint?: string;
  value: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      aria-pressed={value}
      className="flex w-full items-start gap-3 rounded-xl border border-slate-300 bg-white p-3 text-left transition hover:bg-slate-50"
    >
      <span
        className={`mt-0.5 flex h-6 w-11 shrink-0 items-center rounded-full transition ${
          value ? "bg-emerald-500" : "bg-slate-300"
        }`}
      >
        <span
          className={`ml-0.5 h-5 w-5 rounded-full bg-white shadow transition ${
            value ? "translate-x-5" : "translate-x-0"
          }`}
        />
      </span>

      <span className="min-w-0">
        <span className="block text-sm font-semibold text-slate-800">
          {label}
        </span>

        {hint && (
          <span className="mt-0.5 block text-xs text-slate-500">{hint}</span>
        )}
      </span>
    </button>
  );
}

export function SettingsPanel({ settings }: { settings: SiteSettings }) {
  const [draft, setDraft] = useState(settings);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  function set<K extends keyof SiteSettings>(key: K, value: SiteSettings[K]) {
    setSaved(false);
    setDraft((current) => ({ ...current, [key]: value }));
  }

  function submit() {
    setError("");
    setSaved(false);

    const formData = new FormData();

    for (const [key, value] of Object.entries(draft)) {
      formData.set(key, value == null ? "" : String(value));
    }

    startTransition(async () => {
      try {
        await saveSettings(formData);
        setSaved(true);
      } catch (err) {
        setError(
          err instanceof Error && err.message
            ? err.message
            : "Could not save the settings."
        );
      }
    });
  }

  return (
    <div className="space-y-4">
      <Group title="Identity">
        <Text
          label="Site name"
          value={draft.site_name}
          onChange={(v) => set("site_name", v)}
        />

        <Text
          label="Tagline"
          hint="The line under the map's title."
          value={draft.tagline}
          onChange={(v) => set("tagline", v)}
        />

        <Text
          label="Currency hint"
          hint="Three letters. The default currency in the add-a-place form."
          value={draft.currency_hint}
          onChange={(v) => set("currency_hint", v)}
        />
      </Group>

      <Group
        title="Maintenance"
        note="With this on, visitors get the message instead of the site."
      >
        <Switch
          label="Maintenance mode"
          value={draft.maintenance_mode}
          onChange={(v) => set("maintenance_mode", v)}
        />

        <Text
          label="Message"
          value={draft.maintenance_message ?? ""}
          onChange={(v) => set("maintenance_message", v)}
        />
      </Group>

      <Group title="Who may take part">
        <Switch
          label="Registrations open"
          hint="Off means new accounts cannot be created."
          value={draft.registrations_enabled}
          onChange={(v) => set("registrations_enabled", v)}
        />

        <Text
          label="New places per person per day"
          type="number"
          value={draft.max_places_per_user_per_day}
          onChange={(v) => set("max_places_per_user_per_day", Number(v))}
        />

        <Text
          label="Minutes between updates"
          type="number"
          value={draft.min_minutes_between_updates}
          onChange={(v) => set("min_minutes_between_updates", Number(v))}
        />
      </Group>

      <Group title="What people may write" note="In characters.">
        <Text
          label="Name"
          type="number"
          value={draft.max_name_length}
          onChange={(v) => set("max_name_length", Number(v))}
        />

        <Text
          label="Description"
          type="number"
          value={draft.max_description_length}
          onChange={(v) => set("max_description_length", Number(v))}
        />

        <Text
          label="Comment"
          type="number"
          value={draft.max_comment_length}
          onChange={(v) => set("max_comment_length", Number(v))}
        />

        <Text
          label="Photo size"
          hint="In megabytes, per photo."
          type="number"
          value={draft.max_photo_size_mb}
          onChange={(v) => set("max_photo_size_mb", Number(v))}
        />
      </Group>

      <Group
        title="Reports"
        note="A place is flagged only when both numbers are reached."
      >
        <Text
          label="Reports before a place is flagged"
          type="number"
          value={draft.reports_to_hide}
          onChange={(v) => set("reports_to_hide", Number(v))}
        />

        <Text
          label="Different people before a place is flagged"
          type="number"
          value={draft.reporters_to_hide}
          onChange={(v) => set("reporters_to_hide", Number(v))}
        />
      </Group>

      <Group
        title="Map"
        note="Where the map opens, and how many pins it draws."
      >
        <div className="grid grid-cols-3 gap-2">
          <Text
            label="Latitude"
            type="number"
            value={draft.map_default_lat}
            onChange={(v) => set("map_default_lat", Number(v))}
          />

          <Text
            label="Longitude"
            type="number"
            value={draft.map_default_lng}
            onChange={(v) => set("map_default_lng", Number(v))}
          />

          <Text
            label="Zoom"
            type="number"
            value={draft.map_default_zoom}
            onChange={(v) => set("map_default_zoom", Number(v))}
          />
        </div>

        <div className="grid grid-cols-3 gap-2">
          <Text
            label="Pins at zoom 2"
            type="number"
            value={draft.max_markers_zoom_2}
            onChange={(v) => set("max_markers_zoom_2", Number(v))}
          />

          <Text
            label="At zoom 3"
            type="number"
            value={draft.max_markers_zoom_3}
            onChange={(v) => set("max_markers_zoom_3", Number(v))}
          />

          <Text
            label="At zoom 4"
            type="number"
            value={draft.max_markers_zoom_4}
            onChange={(v) => set("max_markers_zoom_4", Number(v))}
          />
        </div>
      </Group>

      {error && <ErrorBanner message={error} />}

      {saved && (
        <p className="rounded-xl bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">
          ✅ Saved.
        </p>
      )}

      <Button onClick={submit} disabled={pending} className="w-full">
        {pending ? "Saving…" : "Save settings"}
      </Button>
    </div>
  );
}

export default SettingsPanel;
